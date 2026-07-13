import crypto from "node:crypto";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import IdempotencyKey from "../models/IdempotencyKey.js";
import BlockedDate from "../models/BlockedDate.js";
import { getSetting } from "./settingsController.js";
import { sendBookingNotifications } from "../config/mailer.js";
import {
  appendBookingToSheet,
  deleteBookingFromSheet,
  resetBookingSheet,
  updateBookingInSheet,
} from "../services/sheetsService.js";
import { sendPushToAdmin } from "../services/pushService.js";
import { sendManagementLinkEmail } from "../config/mailer.js";
import {
  hashManagementToken,
  issueManagementToken,
  MANAGEMENT_TOKEN_PATTERN,
} from "../services/managementTokenService.js";
import {
  calculateAvailableSlots,
  getScheduleConfiguration,
  validateConfiguredSlot,
} from "../services/availabilityService.js";
import {
  BookingSlotConflictError,
  clearBookingSlots,
  claimBookingSlots,
  getBookingSlotStarts,
  releaseClaimedBookingSlots,
  releaseBookingSlots,
  releaseBookingSlotsExcept,
} from "../services/bookingSlotService.js";
import {
  decryptIdempotencyResponse,
  encryptIdempotencyResponse,
  fingerprintRequest,
} from "../services/idempotencyService.js";
import {
  availabilityQuerySchema,
  cancelSchema,
  createBookingSchema,
  getDefaultAvailabilityRange,
  normalizeCode,
  normalizeEmail,
  normalizePhone,
  parseDateTimeInput,
  rescheduleSchema,
  updateBookingSchema,
  updateAttendanceSchema,
  validateContact,
} from "../utils/bookingRules.js";
import {
  ACTIVE_BOOKING_FILTER,
  TRASHED_BOOKING_FILTER,
  withActiveBooking,
} from "../utils/bookingFilters.js";
import { recordBookingAudit } from "../services/auditService.js";
import { SLOT_MUTATION_LOCK_MS } from "../config/bookingMutationLease.js";
import { STUDENT_IDENTITY_ALGORITHM_VERSION } from "../services/studentIdentityService.js";

const activeStatusFilter = {
  ...ACTIVE_BOOKING_FILTER,
  status: { $nin: ["Cancelado", "Finalizado"] },
};

const STATUS_TRANSITIONS = {
  Pendiente: ["Confirmado", "Cancelado"],
  Confirmado: ["Finalizado", "Cancelado"],
  Finalizado: [],
  Cancelado: [],
};
const MAX_AVAILABILITY_RANGE_DAYS = Number(
  process.env.MAX_AVAILABILITY_RANGE_DAYS || 120,
);
const MAX_AVAILABILITY_RANGE_MS =
  MAX_AVAILABILITY_RANGE_DAYS * 24 * 60 * 60 * 1000;
const DEFAULT_ADMIN_BOOKING_PAGE_SIZE = 50;
const MAX_ADMIN_BOOKING_PAGE_SIZE = 200;
const BOOKING_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6,12}$/;
const MANAGEMENT_LINK_COOLDOWN_MS = 5 * 60 * 1000;
const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const INVALID_MANAGEMENT_LINK_MESSAGE = "El enlace de gestión no es válido o venció.";

const publicBooking = (booking) => ({
  bookingCode: booking.bookingCode,
  studentName: booking.studentName,
  subject: booking.subject,
  timeSlot: booking.timeSlot,
  endTime: booking.endTime,
  duration: booking.duration,
  status: booking.status,
});

// This is intentionally separate from the unauthenticated public DTO. The
// bearer link may reveal only the information a family needs to manage its own
// booking; teacher-only notes and token metadata never leave the API.
const managedBooking = (booking) => ({
  bookingCode: booking.bookingCode,
  studentName: booking.studentName,
  responsibleName: booking.responsibleName,
  responsibleRelationship: booking.responsibleRelationship,
  responsibleRelationshipOther: booking.responsibleRelationshipOther,
  email: booking.email,
  phone: booking.phone,
  school: booking.school,
  educationLevel: booking.educationLevel,
  yearGrade: booking.yearGrade,
  subject: booking.subject,
  academicSituation: booking.academicSituation,
  timeSlot: booking.timeSlot,
  endTime: booking.endTime,
  duration: booking.duration,
  status: booking.status,
});

const setNoStore = (res) => {
  res.setHeader("Cache-Control", "no-store");
};

const trustedFilter = (filter) => mongoose.trusted(filter);

const badRequest = (res, message, details) =>
  res.status(400).json({
    success: false,
    message,
    details,
    requestId: res.req.requestId,
  });

const notFound = (res, message) =>
  res.status(404).json({
    success: false,
    message,
    requestId: res.req.requestId,
  });

const unauthorizedManagementLink = (res) =>
  res.status(401).json({
    success: false,
    message: INVALID_MANAGEMENT_LINK_MESSAGE,
    requestId: res.req.requestId,
  });

const forbiddenManagementBooking = (res) =>
  res.status(403).json({
    success: false,
    message: "Este enlace no autoriza cambios sobre esa reserva.",
    requestId: res.req.requestId,
  });

const getManagementToken = (req) => String(
  req.get("X-Booking-Manage-Token") || "",
).trim();

const getIdempotencyKey = (req) => String(req.get("Idempotency-Key") || "").trim();

const requiresIdempotencyKey = () => process.env.REQUIRE_IDEMPOTENCY_KEY === "true";

const scopedIdempotencyKey = (scope, idempotencyKey) =>
  fingerprintRequest({ scope, idempotencyKey });

const acquireSlotMutationLock = async (
  bookingId,
  scopeFilter = ACTIVE_BOOKING_FILTER,
) => {
  const lock = crypto.randomUUID();
  const now = new Date();
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      ...scopeFilter,
      $or: [
        { slotMutationLock: null },
        { slotMutationLock: { $exists: false } },
        { slotMutationLockExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        slotMutationLock: lock,
        slotMutationLockExpiresAt: new Date(now.getTime() + SLOT_MUTATION_LOCK_MS),
      },
    },
    { new: true },
  );

  return booking ? {
    booking,
    lock,
    expiresAt: new Date(now.getTime() + SLOT_MUTATION_LOCK_MS),
  } : null;
};

const releaseSlotMutationLock = async (bookingId, lock) =>
  Booking.updateOne(
    { _id: bookingId, slotMutationLock: lock },
    { $unset: { slotMutationLock: 1, slotMutationLockExpiresAt: 1 } },
  );

const AUDIT_COMPENSATION_TIMEOUT_CAP_MS = 1_000;
const AUDIT_COMPENSATION_SAFETY_MS = 100;

const compensateWithinOwnedLease = async ({ filter, update, leaseExpiresAt }) => {
  const remainingLeaseMS = new Date(leaseExpiresAt).getTime() - Date.now();
  const timeoutMS = Math.min(
    AUDIT_COMPENSATION_TIMEOUT_CAP_MS,
    remainingLeaseMS - AUDIT_COMPENSATION_SAFETY_MS,
  );
  if (!Number.isFinite(timeoutMS) || timeoutMS <= 0) {
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
  }

  return Booking.updateOne(
    trustedFilter({
      ...filter,
      // The database server, not the application clock, decides whether the
      // lease is still owned at the instant the compensation executes.
      $expr: { $gt: ["$slotMutationLockExpiresAt", "$$NOW"] },
    }),
    update,
    { timeoutMS },
  );
};

const ownedSlotMutationFilter = ({ booking, lock }) => ({
  _id: booking._id,
  slotMutationLock: lock,
  ...(booking.updatedAt ? { updatedAt: booking.updatedAt } : {}),
});

const findManagedBooking = async (req) => {
  const token = getManagementToken(req);
  if (!MANAGEMENT_TOKEN_PATTERN.test(token)) return null;

  const managementTokenHash = hashManagementToken(token);
  if (!managementTokenHash) return null;

  const booking = await Booking.findOne(withActiveBooking({ managementTokenHash }))
    .select("+managementTokenHash")
    .exec();

  if (
    !booking ||
    booking.managementTokenRevokedAt ||
    !booking.managementTokenExpiresAt ||
    new Date(booking.managementTokenExpiresAt).getTime() <= Date.now()
  ) {
    return null;
  }

  return booking;
};

const managementBookingForCode = async (req, res, bookingCode) => {
  const booking = await findManagedBooking(req);
  if (!booking) {
    unauthorizedManagementLink(res);
    return null;
  }

  if (booking.bookingCode !== bookingCode) {
    forbiddenManagementBooking(res);
    return null;
  }

  return booking;
};

const hasConflict = async (startTime, endTime, excludeId = null) => {
  const criteria = {
    ...activeStatusFilter,
    timeSlot: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeId) {
    criteria._id = { $ne: excludeId };
  }

  return Booking.exists(trustedFilter(criteria));
};

const isManageableByClient = (booking) =>
  booking.status !== "Cancelado" &&
  booking.status !== "Finalizado" &&
  new Date(booking.endTime).getTime() > Date.now();

const normalizeBookingPayload = (payload) => ({
  ...payload,
  email: normalizeEmail(payload.email),
  phone: normalizePhone(payload.phone),
  responsibleRelationship: String(payload.responsibleRelationship ?? "")
    .trim()
    .toLowerCase(),
  responsibleRelationshipOther: String(payload.responsibleRelationshipOther ?? "")
    .trim(),
  tutorName: payload.tutorName?.trim() || "Agustin",
});

const parseAvailabilityRange = (query) => {
  const parsed = availabilityQuerySchema.safeParse(query);
  if (!parsed.success) {
    return null;
  }

  const defaults = getDefaultAvailabilityRange();
  const from = parsed.data.from ? parseDateTimeInput(parsed.data.from) : defaults.from;
  const to = parsed.data.to ? parseDateTimeInput(parsed.data.to) : defaults.to;

  if (!from || !to || from > to) {
    return null;
  }

  if (to.getTime() - from.getTime() > MAX_AVAILABILITY_RANGE_MS) {
    return null;
  }

  return { from, to, duration: parsed.data.duration };
};

const parseAdminBookingPagination = (query) => {
  const hasPage = query.page !== undefined;
  const hasLimit = query.limit !== undefined;
  if (!hasPage && !hasLimit) return { enabled: false };

  const parsePositiveInteger = (value) => {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  };
  const page = hasPage ? parsePositiveInteger(query.page) : 1;
  const limit = hasLimit
    ? parsePositiveInteger(query.limit)
    : DEFAULT_ADMIN_BOOKING_PAGE_SIZE;

  if (!page || !limit || limit > MAX_ADMIN_BOOKING_PAGE_SIZE) return null;

  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip < 0) return null;

  return { enabled: true, page, limit, skip };
};

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

export const createBooking = async (req, res, next) => {
  let idempotencyRecord = null;

  try {
    const idempotencyKey = getIdempotencyKey(req);
    if (
      (requiresIdempotencyKey() && !idempotencyKey) ||
      (idempotencyKey && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey))
    ) {
      return badRequest(res, "Debes enviar un Idempotency-Key valido para crear la reserva.");
    }

    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Revisa los datos de la reserva.", parsed.error.flatten());
    }

    const payload = normalizeBookingPayload(parsed.data);
    const contactError = validateContact(payload);
    if (contactError) {
      return badRequest(res, contactError);
    }

    const startTime = parseDateTimeInput(payload.timeSlot);
    const duration = Number(payload.duration);

    const [{ error: slotError, schedule }, requireManual] = await Promise.all([
      validateConfiguredSlot(startTime, duration),
      getSetting("booking.requireManualConfirmation"),
    ]);

    if (slotError) {
      return badRequest(res, slotError);
    }

    const { slotDurationMinutes } = schedule;

    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
    const bookingStatus = requireManual ? "Pendiente" : "Confirmado";

    const requestFingerprint = fingerprintRequest({
      ...payload,
      timeSlot: startTime.toISOString(),
      duration,
    });

    if (idempotencyKey) {
      try {
        idempotencyRecord = await IdempotencyKey.create({
          key: idempotencyKey,
          fingerprint: requestFingerprint,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_KEY_TTL_MS),
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;

        const existing = await IdempotencyKey.findOne({ key: idempotencyKey })
          .select("+responseCiphertext +responseIv +responseAuthTag")
          .exec();
        if (!existing || existing.fingerprint !== requestFingerprint) {
          return res.status(409).json({
            success: false,
            message: "Ese Idempotency-Key ya fue usado con una reserva diferente.",
            requestId: req.requestId,
          });
        }

        if (
          existing.status !== "completed" ||
          !existing.responseStatus ||
          !existing.responseCiphertext
        ) {
          return res.status(409).json({
            success: false,
            message: "La reserva con ese Idempotency-Key todavia esta siendo procesada.",
            requestId: req.requestId,
          });
        }

        try {
          return res.status(existing.responseStatus).json(decryptIdempotencyResponse(existing));
        } catch {
          return res.status(409).json({
            success: false,
            message: "No se pudo reutilizar esa reserva de forma segura. Genera una nueva solicitud.",
            requestId: req.requestId,
          });
        }
      }
    }

    if (await hasConflict(startTime, endTime)) {
      if (idempotencyRecord) {
        await IdempotencyKey.deleteOne({ _id: idempotencyRecord._id });
      }
      if (idempotencyKey) {
        return res.status(409).json({
          success: false,
          message: "Horario ocupado.",
          requestId: req.requestId,
        });
      }
      return badRequest(res, "Horario ocupado.");
    }

    const newBooking = new Booking({
      responsibleName: payload.responsibleName,
      responsibleRelationship: payload.responsibleRelationship,
      responsibleRelationshipOther: payload.responsibleRelationshipOther,
      studentName: payload.studentName,
      tutorName: payload.tutorName,
      email: payload.email,
      phone: payload.phone,
      school: payload.school,
      educationLevel: payload.educationLevel,
      yearGrade: payload.yearGrade,
      subject: payload.subject,
      academicSituation: payload.academicSituation,
      timeSlot: startTime,
      endTime,
      duration,
      notes: "",
      status: bookingStatus,
      studentLink: {
        status: "pending",
        source: "booking",
        algorithmVersion: STUDENT_IDENTITY_ALGORITHM_VERSION,
        runId: null,
        linkedAt: null,
        lastAttemptAt: new Date(),
        candidateIds: [],
        errorCode: "",
        attempts: 0,
        nextAttemptAt: new Date(),
      },
    });
    const { managementToken, managementUrl } = issueManagementToken(newBooking);
    const slotStarts = getBookingSlotStarts({
      startTime,
      endTime,
      slotDurationMinutes,
    });
    await claimBookingSlots({
      bookingId: newBooking._id,
      slotStarts,
      slotDurationMinutes,
    });
    try {
      await newBooking.save();
    } catch (error) {
      await releaseBookingSlots(newBooking._id);
      throw error;
    }

    // Respond immediately after DB insert — side effects run in background
    const responseBody = {
      success: true,
      message: "Reserva confirmada con exito.",
      data: {
        ...publicBooking(newBooking),
        managementToken,
        managementUrl,
      },
      notifications: null,
      requestId: req.requestId,
    };

    if (idempotencyRecord) {
      Object.assign(idempotencyRecord, encryptIdempotencyResponse(responseBody), {
        booking: newBooking._id,
        status: "completed",
        responseStatus: 201,
      });
      await idempotencyRecord.save();
    }

    res.status(201).json(responseBody);

    Promise.allSettled([
      appendBookingToSheet(newBooking),
      sendBookingNotifications({
        booking: { ...newBooking.toObject(), managementUrl },
        event: "created",
      }),
      sendPushToAdmin({
        title: "Nueva reserva",
        body: `${newBooking.studentName} · ${newBooking.subject}`,
        url: "/admin",
      }),
    ]).catch((err) => console.error("[createBooking side-effects]", err.message));
  } catch (error) {
    if (idempotencyRecord && idempotencyRecord.status !== "completed") {
      await IdempotencyKey.deleteOne({ _id: idempotencyRecord._id }).catch(() => {});
    }

    if (error instanceof BookingSlotConflictError) {
      return res.status(409).json({
        success: false,
        message: "Horario ocupado.",
        requestId: req.requestId,
      });
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "No se pudo generar un codigo unico. Intenta nuevamente.",
        requestId: req.requestId,
      });
    }

    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const getAvailability = async (req, res, next) => {
  try {
    const range = parseAvailabilityRange(req.query);
    if (!range) {
      return badRequest(
        res,
        `Rango de disponibilidad invalido. Usa un intervalo maximo de ${MAX_AVAILABILITY_RANGE_DAYS} dias.`,
      );
    }

    const schedule = await getScheduleConfiguration();
    const requestedDuration = range.duration ?? schedule.slotDurationMinutes / 60;
    const requestedDurationMinutes = Math.round(requestedDuration * 60);

    if (
      requestedDurationMinutes < schedule.slotDurationMinutes ||
      requestedDurationMinutes % schedule.slotDurationMinutes !== 0
    ) {
      return badRequest(
        res,
        `La duraciÃ³n debe respetar intervalos de ${schedule.slotDurationMinutes} minutos.`,
      );
    }

    // Availability stays public. A valid bearer may only remove the booking
    // bound to that bearer, which lets a family keep its current time while
    // considering a different duration. Query parameters never choose what
    // is excluded, so an unauthenticated caller cannot hide another booking.
    const managedBookingForAvailability = await findManagedBooking(req);
    const exclusionFilter = managedBookingForAvailability
      ? { _id: { $ne: managedBookingForAvailability._id } }
      : {};

    const [bookings, blockedRecords] = await Promise.all([
      Booking.find(
        trustedFilter({
          ...activeStatusFilter,
          ...exclusionFilter,
          timeSlot: { $lte: range.to },
          endTime: { $gte: range.from },
        }),
      )
        .select("timeSlot endTime duration status")
        .lean()
        .sort({ timeSlot: 1 }),
      BlockedDate.find().select("date").lean(),
    ]);

    const blockedDates = blockedRecords.map((r) => r.date);
    const slots = calculateAvailableSlots({
      ...range,
      bookings,
      blockedDates,
      schedule,
      durationHours: requestedDuration,
    });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings.map((booking) => ({
        _id: booking._id,
        timeSlot: booking.timeSlot,
        endTime: booking.endTime,
        duration: booking.duration,
        status: booking.status,
      })),
      blockedDates,
      // Legacy fields are preserved for the deployed frontend. `slots` is the
      // backend-authoritative availability contract for all future consumers.
      schedule,
      slots,
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const getAllBookings = async (req, res, next) => {
  try {
    setNoStore(res);

    const scopeFilter = req.query.scope === "trash"
      ? TRASHED_BOOKING_FILTER
      : ACTIVE_BOOKING_FILTER;

    const pagination = parseAdminBookingPagination(req.query);
    if (!pagination) {
      return badRequest(
        res,
        `La paginación debe usar enteros positivos y un límite máximo de ${MAX_ADMIN_BOOKING_PAGE_SIZE}.`,
      );
    }

    if (pagination.enabled) {
      const { page, limit, skip } = pagination;
      const [bookings, total] = await Promise.all([
        Booking.find(scopeFilter).sort({ timeSlot: -1 }).skip(skip).limit(limit).lean(),
        Booking.countDocuments(scopeFilter),
      ]);
      return res.status(200).json({
        success: true,
        count: bookings.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        data: bookings,
        requestId: req.requestId,
      });
    }

    const bookings = await Booking.find(scopeFilter).sort({ timeSlot: -1 }).lean();

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const getBookingStats = async (req, res, next) => {
  try {
    setNoStore(res);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [statusCounts, monthRevenue, lastMonthRevenue] = await Promise.all([
      Booking.aggregate([
        { $match: ACTIVE_BOOKING_FILTER },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { ...ACTIVE_BOOKING_FILTER, status: "Finalizado", timeSlot: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$price", 0] } } } },
      ]),
      Booking.aggregate([
        { $match: { ...ACTIVE_BOOKING_FILTER, status: "Finalizado", timeSlot: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$price", 0] } } } },
      ]),
    ]);

    const stats = { total: 0, confirmed: 0, pending: 0, cancelled: 0, finished: 0 };
    for (const row of statusCounts) {
      stats.total += row.count;
      if (row._id === "Confirmado") stats.confirmed = row.count;
      else if (row._id === "Pendiente") stats.pending = row.count;
      else if (row._id === "Cancelado") stats.cancelled = row.count;
      else if (row._id === "Finalizado") stats.finished = row.count;
    }

    res.status(200).json({
      success: true,
      data: {
        stats,
        monthRevenue: monthRevenue[0]?.total ?? 0,
        lastMonthRevenue: lastMonthRevenue[0]?.total ?? 0,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const getBookingByCode = (_req, res) => {
  setNoStore(res);
  return res.status(410).json({
    success: false,
    message:
      "La consulta por código fue retirada. Solicitá un enlace seguro con tu código y email.",
  });
};

export const updateBooking = async (req, res, next) => {
  let claimedSlots = null;
  let slotMutationLock = null;

  try {
    if (!isValidObjectId(req.params.id)) {
      return badRequest(res, "Identificador de reserva invalido.");
    }

    const parsed = updateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Datos de actualizacion invalidos.", parsed.error.flatten());
    }

    const updateData = { ...parsed.data };

    // Validate status transition before touching the DB
    if (updateData.status !== undefined) {
      const current = await Booking.findOne(withActiveBooking({ _id: req.params.id }))
        .select("status")
        .lean();
      if (!current) return notFound(res, "Reserva no encontrada.");

      const allowed = STATUS_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(updateData.status)) {
        return res.status(422).json({
          success: false,
          message: `Transición de estado no permitida: ${current.status} → ${updateData.status}.`,
          requestId: req.requestId,
        });
      }
    }

    let slotStarts = null;
    if (updateData.timeSlot !== undefined) {
      const existing = await Booking.findOne(withActiveBooking({ _id: req.params.id }))
        .select("duration")
        .lean();
      if (!existing) {
        return notFound(res, "Reserva no encontrada.");
      }

      const startTime = parseDateTimeInput(updateData.timeSlot);
      const duration = Number(existing.duration) || 1;
      const { error: slotError, schedule } = await validateConfiguredSlot(startTime, duration);
      if (slotError) {
        return badRequest(res, slotError);
      }
      const { slotDurationMinutes } = schedule;

      const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
      const conflict = await hasConflict(startTime, endTime, req.params.id);
      if (conflict) {
        return badRequest(res, "El nuevo horario tiene conflicto con otra reserva activa.");
      }

      slotMutationLock = await acquireSlotMutationLock(req.params.id);
      if (!slotMutationLock) {
        return res.status(409).json({
          success: false,
          message: "La reserva esta siendo modificada. Reintenta en unos segundos.",
          requestId: req.requestId,
        });
      }

      updateData.timeSlot = startTime;
      updateData.endTime = endTime;
      slotStarts = getBookingSlotStarts({
        startTime,
        endTime,
        slotDurationMinutes,
      });
      claimedSlots = await claimBookingSlots({
        bookingId: req.params.id,
        slotStarts,
        slotDurationMinutes,
      });
    }

    const NOTE_FIELDS = ["notes", "studentEvolution", "emotionalState"];
    const historyPush = NOTE_FIELDS
      .filter((f) => updateData[f] !== undefined)
      .map((f) => ({ field: f, text: updateData[f], savedAt: new Date() }));

    const mongoUpdate = { $set: updateData };
    if (historyPush.length > 0) {
      mongoUpdate.$push = { notesHistory: { $each: historyPush } };
    }

    if (!slotMutationLock && updateData.status === "Cancelado") {
      slotMutationLock = await acquireSlotMutationLock(req.params.id);
      if (!slotMutationLock) {
        return res.status(409).json({
          success: false,
          message: "La reserva esta siendo modificada. Reintenta en unos segundos.",
          requestId: req.requestId,
        });
      }
    }

    const updatedBooking = slotMutationLock
      ? await Booking.findOneAndUpdate(
        ownedSlotMutationFilter(slotMutationLock),
        mongoUpdate,
        { new: true, runValidators: true },
      )
      : await Booking.findOneAndUpdate(withActiveBooking({ _id: req.params.id }), mongoUpdate, {
        new: true,
        runValidators: true,
      });

    if (!updatedBooking) {
      await releaseClaimedBookingSlots(claimedSlots?.insertedSlotIds);
      if (slotMutationLock) {
        await releaseSlotMutationLock(
          slotMutationLock.booking._id,
          slotMutationLock.lock,
        );
        slotMutationLock = null;
        return res.status(409).json({
          success: false,
          message: "La reserva cambio mientras era modificada. Reintenta.",
          requestId: req.requestId,
        });
      }
      return notFound(res, "Reserva no encontrada.");
    }

    if (updateData.status === "Cancelado") {
      await releaseBookingSlots(updatedBooking._id);
    } else if (slotStarts) {
      await releaseBookingSlotsExcept(updatedBooking._id, slotStarts);
    }
    claimedSlots = null;
    if (slotMutationLock) {
      await releaseSlotMutationLock(updatedBooking._id, slotMutationLock.lock);
      slotMutationLock = null;
    }

    await updateBookingInSheet(updatedBooking);

    // Fire email side-effects for relevant transitions (non-blocking)
    if (updateData.status === "Cancelado") {
      sendBookingNotifications({ booking: updatedBooking, event: "cancelled" }).catch(
        (err) => console.error("[status-transition email cancelled]", err),
      );
    }

    setNoStore(res);
    res.status(200).json({
      success: true,
      data: updatedBooking,
      requestId: req.requestId,
    });
  } catch (error) {
    await releaseClaimedBookingSlots(claimedSlots?.insertedSlotIds).catch(() => {});
    if (slotMutationLock) {
      await releaseSlotMutationLock(slotMutationLock.booking._id, slotMutationLock.lock)
        .catch(() => {});
    }

    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const updateBookingAttendance = async (req, res, next) => {
  let slotMutationLock = null;

  try {
    if (!isValidObjectId(req.params.id)) {
      return badRequest(res, "Identificador de reserva invalido.");
    }

    const parsed = updateAttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Datos de asistencia invalidos.", parsed.error.flatten());
    }

    slotMutationLock = await acquireSlotMutationLock(req.params.id);
    if (!slotMutationLock) {
      const activeBookingExists = await Booking.exists(withActiveBooking({ _id: req.params.id }));
      if (!activeBookingExists) return notFound(res, "Reserva no encontrada.");
      return res.status(409).json({
        success: false,
        message: "La reserva esta siendo modificada. Reintenta en unos segundos.",
        requestId: req.requestId,
      });
    }

    const beforeAttendance = slotMutationLock.booking.toObject();
    beforeAttendance.attendanceStatus ||= "Sin registrar";
    beforeAttendance.attendanceRecordedAt ??= null;
    beforeAttendance.attendanceNotes ||= "";
    beforeAttendance.attendanceUpdatedBy ??= null;

    const attendanceRecordedAt = parsed.data.attendanceStatus === "Sin registrar"
      ? null
      : new Date();
    const attendanceNotes = parsed.data.attendanceStatus === "Sin registrar"
      ? ""
      : parsed.data.attendanceNotes;
    const updatedBooking = await Booking.findOneAndUpdate(
      {
        ...ownedSlotMutationFilter(slotMutationLock),
        ...ACTIVE_BOOKING_FILTER,
      },
      {
        $set: {
          attendanceStatus: parsed.data.attendanceStatus,
          attendanceRecordedAt,
          attendanceNotes,
          attendanceUpdatedBy: req.user.id,
        },
      },
      { new: true, runValidators: true },
    );

    if (!updatedBooking) {
      await releaseSlotMutationLock(slotMutationLock.booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: "La reserva cambio mientras se registraba la asistencia. Reintenta.",
        requestId: req.requestId,
      });
    }

    try {
      await recordBookingAudit({
        req,
        action: "booking.attendance.updated",
        bookingId: updatedBooking._id,
        before: beforeAttendance,
        after: updatedBooking,
        leaseExpiresAt: slotMutationLock.expiresAt,
      });
    } catch (auditError) {
      const compensation = await compensateWithinOwnedLease({
        filter: {
          _id: updatedBooking._id,
          ...ACTIVE_BOOKING_FILTER,
          updatedAt: updatedBooking.updatedAt,
          slotMutationLock: slotMutationLock.lock,
        },
        update: {
          $set: {
            attendanceStatus: beforeAttendance.attendanceStatus,
            attendanceRecordedAt: beforeAttendance.attendanceRecordedAt,
            attendanceNotes: beforeAttendance.attendanceNotes,
            attendanceUpdatedBy: beforeAttendance.attendanceUpdatedBy,
          },
        },
        leaseExpiresAt: slotMutationLock.expiresAt,
      });
      if (compensation.modifiedCount !== 1) {
        console.error("[audit-compensation]", JSON.stringify({
          event: "booking_attendance_audit_compensation_lost_lease",
          bookingId: String(updatedBooking._id),
          requestId: req.requestId,
        }));
      }
      throw auditError;
    }

    await releaseSlotMutationLock(updatedBooking._id, slotMutationLock.lock);
    slotMutationLock = null;
    setNoStore(res);
    return res.status(200).json({
      success: true,
      message: "Asistencia actualizada.",
      data: updatedBooking,
      requestId: req.requestId,
    });
  } catch (error) {
    if (slotMutationLock) {
      await releaseSlotMutationLock(
        slotMutationLock.booking._id,
        slotMutationLock.lock,
      ).catch(() => {});
    }
    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const deleteBooking = async (req, res, next) => {
  let slotMutationLock = null;

  try {
    if (!isValidObjectId(req.params.id)) {
      return badRequest(res, "Identificador de reserva invalido.");
    }

    slotMutationLock = await acquireSlotMutationLock(req.params.id);
    if (!slotMutationLock) {
      return res.status(409).json({
        success: false,
        message: "La reserva esta siendo modificada. Reintenta en unos segundos.",
        requestId: req.requestId,
      });
    }

    const beforeDeletion = slotMutationLock.booking;
    const deletedAt = new Date();
    const deletedBooking = await Booking.findOneAndUpdate(
      {
        ...ownedSlotMutationFilter(slotMutationLock),
        ...ACTIVE_BOOKING_FILTER,
      },
      {
        $set: { deletedAt, deletedBy: req.user.id },
      },
      { new: true },
    );
    if (!deletedBooking) {
      await releaseSlotMutationLock(slotMutationLock.booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: "La reserva cambio mientras era eliminada. Reintenta.",
        requestId: req.requestId,
      });
    }

    try {
      await recordBookingAudit({
        req,
        action: "booking.deleted",
        bookingId: deletedBooking._id,
        before: beforeDeletion,
        after: deletedBooking,
        leaseExpiresAt: slotMutationLock.expiresAt,
      });
    } catch (auditError) {
      // Standalone MongoDB cannot make the booking and audit writes atomic.
      // Compensate before releasing slots; deleted documents cannot be changed
      // through normal mutations while this compare-and-set runs.
      const compensation = await compensateWithinOwnedLease({
        filter: {
          _id: deletedBooking._id,
          deletedAt,
          deletedBy: req.user.id,
          updatedAt: deletedBooking.updatedAt,
          slotMutationLock: slotMutationLock.lock,
        },
        update: { $set: { deletedAt: null, deletedBy: null } },
        leaseExpiresAt: slotMutationLock.expiresAt,
      });
      if (compensation.modifiedCount !== 1) {
        console.error("[audit-compensation]", JSON.stringify({
          event: "booking_delete_audit_compensation_lost_lease",
          bookingId: String(deletedBooking._id),
          requestId: req.requestId,
        }));
      }
      throw auditError;
    }
    await releaseBookingSlots(deletedBooking._id);
    await releaseSlotMutationLock(deletedBooking._id, slotMutationLock.lock);
    slotMutationLock = null;
    await deleteBookingFromSheet(deletedBooking.bookingCode);

    setNoStore(res);
    res.status(200).json({
      success: true,
      message: "Reserva enviada a la papelera.",
      requestId: req.requestId,
    });
  } catch (error) {
    if (slotMutationLock) {
      await releaseSlotMutationLock(
        slotMutationLock.booking._id,
        slotMutationLock.lock,
      ).catch(() => {});
    }

    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const restoreBooking = async (req, res, next) => {
  let claimedSlots = null;
  let slotMutationLock = null;

  try {
    if (!isValidObjectId(req.params.id)) {
      return badRequest(res, "Identificador de reserva invalido.");
    }

    slotMutationLock = await acquireSlotMutationLock(
      req.params.id,
      TRASHED_BOOKING_FILTER,
    );
    if (!slotMutationLock) {
      return res.status(409).json({
        success: false,
        message: "La reserva no esta en la papelera o esta siendo modificada.",
        requestId: req.requestId,
      });
    }

    const trashedBooking = slotMutationLock.booking;
    const startTime = new Date(trashedBooking.timeSlot);
    const duration = Number(trashedBooking.duration) || 1;
    const { error: slotError, schedule } = await validateConfiguredSlot(startTime, duration);
    if (slotError) {
      await releaseSlotMutationLock(trashedBooking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: `No se puede restaurar en su horario original: ${slotError}`,
        requestId: req.requestId,
      });
    }

    const endTime = new Date(trashedBooking.endTime);
    if (await hasConflict(startTime, endTime, trashedBooking._id)) {
      await releaseSlotMutationLock(trashedBooking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: "El horario original ya esta ocupado.",
        requestId: req.requestId,
      });
    }

    const slotStarts = getBookingSlotStarts({
      startTime,
      endTime,
      slotDurationMinutes: schedule.slotDurationMinutes,
    });
    claimedSlots = await claimBookingSlots({
      bookingId: trashedBooking._id,
      slotStarts,
      slotDurationMinutes: schedule.slotDurationMinutes,
    });

    const restoredBooking = await Booking.findOneAndUpdate(
      {
        ...ownedSlotMutationFilter(slotMutationLock),
        ...TRASHED_BOOKING_FILTER,
      },
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
          ...(!trashedBooking.studentId ? { studentLink: {
            status: "pending",
            source: "repair",
            algorithmVersion: STUDENT_IDENTITY_ALGORITHM_VERSION,
            runId: null,
            linkedAt: null,
            lastAttemptAt: new Date(),
            candidateIds: [],
            errorCode: "",
            attempts: 0,
            nextAttemptAt: new Date(),
          } } : {}),
        },
      },
      { new: true, runValidators: true },
    );
    if (!restoredBooking) {
      await releaseClaimedBookingSlots(claimedSlots.insertedSlotIds);
      claimedSlots = null;
      await releaseSlotMutationLock(trashedBooking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: "La reserva cambio mientras era restaurada. Reintenta.",
        requestId: req.requestId,
      });
    }

    const successfulClaim = claimedSlots;
    claimedSlots = null;
    try {
      await recordBookingAudit({
        req,
        action: "booking.restored",
        bookingId: restoredBooking._id,
        before: trashedBooking,
        after: restoredBooking,
        leaseExpiresAt: slotMutationLock.expiresAt,
      });
    } catch (auditError) {
      const compensation = await compensateWithinOwnedLease({
        filter: {
          _id: restoredBooking._id,
          ...ACTIVE_BOOKING_FILTER,
          updatedAt: restoredBooking.updatedAt,
          slotMutationLock: slotMutationLock.lock,
        },
        update: {
          $set: {
            deletedAt: trashedBooking.deletedAt,
            deletedBy: trashedBooking.deletedBy,
            studentLink: trashedBooking.studentLink || null,
          },
        },
        leaseExpiresAt: slotMutationLock.expiresAt,
      });
      if (compensation.modifiedCount === 1) {
        await releaseBookingSlots(restoredBooking._id);
      } else {
        console.error("[audit-compensation]", JSON.stringify({
          event: "booking_restore_audit_compensation_failed",
          bookingId: String(restoredBooking._id),
          requestId: req.requestId,
          claimedSlotCount: successfulClaim?.insertedSlotIds?.length ?? 0,
        }));
      }
      throw auditError;
    }
    await releaseBookingSlotsExcept(restoredBooking._id, slotStarts);
    await releaseSlotMutationLock(restoredBooking._id, slotMutationLock.lock);
    slotMutationLock = null;
    await updateBookingInSheet(restoredBooking);

    setNoStore(res);
    return res.status(200).json({
      success: true,
      message: "Reserva restaurada.",
      data: restoredBooking,
      requestId: req.requestId,
    });
  } catch (error) {
    await releaseClaimedBookingSlots(claimedSlots?.insertedSlotIds).catch(() => {});
    if (slotMutationLock) {
      await releaseSlotMutationLock(
        slotMutationLock.booking._id,
        slotMutationLock.lock,
      ).catch(() => {});
    }

    if (error instanceof BookingSlotConflictError || error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "El horario original ya esta ocupado.",
        requestId: req.requestId,
      });
    }

    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const deleteAllBookings = async (req, res, next) => {
  try {
    await Booking.deleteMany({});
    await clearBookingSlots();
    await resetBookingSheet();

    setNoStore(res);
    res.status(200).json({
      success: true,
      message: "Sistema reiniciado completamente.",
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const requestManagementLink = async (req, res, next) => {
  const acceptedResponse = () =>
    res.status(202).json({
      success: true,
      message:
        "Si los datos coinciden con una reserva, vas a recibir un enlace seguro por email.",
    });

  try {
    const bookingCode = normalizeCode(req.body?.bookingCode);
    const email = normalizeEmail(req.body?.email);

    // Always return the same response. This endpoint must not become an
    // account/booking enumeration oracle.
    if (!BOOKING_CODE_PATTERN.test(bookingCode) || !email) {
      return acceptedResponse();
    }

    const booking = await Booking.findOne(withActiveBooking({ bookingCode, email }))
      .select("+managementTokenHash +managementLinkLastSentAt")
      .exec();
    if (!booking) return acceptedResponse();

    const sentRecently =
      booking.managementLinkLastSentAt &&
      Date.now() - new Date(booking.managementLinkLastSentAt).getTime() <
        MANAGEMENT_LINK_COOLDOWN_MS;
    if (sentRecently) return acceptedResponse();

    const previousTokenState = {
      managementTokenHash: booking.managementTokenHash,
      managementTokenExpiresAt: booking.managementTokenExpiresAt,
      managementTokenRevokedAt: booking.managementTokenRevokedAt,
      managementLinkLastSentAt: booking.managementLinkLastSentAt,
    };
    const { managementUrl } = issueManagementToken(booking);
    booking.managementLinkLastSentAt = new Date();
    await booking.save();

    const delivered = await sendManagementLinkEmail({ booking, managementUrl });
    if (!delivered) {
      booking.managementTokenHash = previousTokenState.managementTokenHash;
      booking.managementTokenExpiresAt = previousTokenState.managementTokenExpiresAt;
      booking.managementTokenRevokedAt = previousTokenState.managementTokenRevokedAt;
      booking.managementLinkLastSentAt = previousTokenState.managementLinkLastSentAt;
      await booking.save();
    }

    return acceptedResponse();
  } catch (error) {
    if (error instanceof BookingSlotConflictError) {
      return res.status(409).json({
        success: false,
        message: "El nuevo horario tiene conflicto con otra reserva activa.",
        requestId: req.requestId,
      });
    }

    if (typeof next === "function") return next(error);
    return acceptedResponse();
  }
};

export const getManagedBooking = async (req, res, next) => {
  try {
    const booking = await findManagedBooking(req);
    if (!booking) return unauthorizedManagementLink(res);

    setNoStore(res);
    return res.status(200).json({
      success: true,
      data: managedBooking(booking),
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const revokeManagementAccess = async (req, res, next) => {
  try {
    const booking = await findManagedBooking(req);
    if (!booking) return unauthorizedManagementLink(res);

    booking.managementTokenRevokedAt = new Date();
    await booking.save();
    setNoStore(res);
    return res.status(204).send();
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const rescheduleBooking = async (req, res, next) => {
  let claimedSlots = null;
  let idempotencyRecord = null;
  let slotMutationLock = null;

  try {
    const idempotencyKey = getIdempotencyKey(req);
    if (
      (requiresIdempotencyKey() && !idempotencyKey) ||
      (idempotencyKey && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey))
    ) {
      return badRequest(res, "Debes enviar un Idempotency-Key valido para reprogramar.");
    }

    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Datos de reprogramacion invalidos.", parsed.error.flatten());
    }

    const cleanCode = normalizeCode(parsed.data.bookingCode);
    const booking = await managementBookingForCode(req, res, cleanCode);
    if (!booking) return undefined;

    if (!isManageableByClient(booking)) {
      return badRequest(
        res,
        "Solo se pueden reprogramar turnos activos que todavia no finalizaron.",
      );
    }

    const startTime = parseDateTimeInput(parsed.data.newTimeSlot);
    const duration = Number(parsed.data.newDuration);
    const { error: slotError, schedule } = await validateConfiguredSlot(startTime, duration);
    if (slotError) {
      return badRequest(res, slotError);
    }
    const { slotDurationMinutes } = schedule;

    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
    if (idempotencyKey) {
      const storageKey = scopedIdempotencyKey("reschedule", idempotencyKey);
      const requestFingerprint = fingerprintRequest({
        bookingCode: cleanCode,
        newTimeSlot: startTime.toISOString(),
        newDuration: duration,
      });
      try {
        idempotencyRecord = await IdempotencyKey.create({
          key: storageKey,
          fingerprint: requestFingerprint,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_KEY_TTL_MS),
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;
        const existing = await IdempotencyKey.findOne({ key: storageKey })
          .select("+responseCiphertext +responseIv +responseAuthTag")
          .exec();
        if (!existing || existing.fingerprint !== requestFingerprint) {
          return res.status(409).json({
            success: false,
            message: "Ese Idempotency-Key ya fue usado con una reprogramacion diferente.",
            requestId: req.requestId,
          });
        }
        if (
          existing.status !== "completed" ||
          !existing.responseStatus ||
          !existing.responseCiphertext
        ) {
          return res.status(409).json({
            success: false,
            message: "La reprogramacion con ese Idempotency-Key todavia esta siendo procesada.",
            requestId: req.requestId,
          });
        }
        try {
          return res.status(existing.responseStatus).json(decryptIdempotencyResponse(existing));
        } catch {
          return res.status(409).json({
            success: false,
            message: "No se pudo reutilizar esa reprogramacion de forma segura. Genera una nueva solicitud.",
            requestId: req.requestId,
          });
        }
      }
    }

    slotMutationLock = await acquireSlotMutationLock(booking._id);
    if (!slotMutationLock) {
      if (idempotencyRecord) {
        await IdempotencyKey.deleteOne({ _id: idempotencyRecord._id });
      }
      return res.status(409).json({
        success: false,
        message: "Esta reserva esta siendo reprogramada. Reintenta en unos segundos.",
        requestId: req.requestId,
      });
    }
    let lockedBooking = slotMutationLock.booking;
    const conflict = await hasConflict(startTime, endTime, booking._id);
    if (conflict) {
      await releaseSlotMutationLock(booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      if (idempotencyRecord) {
        await IdempotencyKey.deleteOne({ _id: idempotencyRecord._id });
      }
      return badRequest(res, "Horario ocupado.");
    }

    const previousTimeSlot = lockedBooking.timeSlot;
    const slotStarts = getBookingSlotStarts({
      startTime,
      endTime,
      slotDurationMinutes,
    });
    claimedSlots = await claimBookingSlots({
      bookingId: lockedBooking._id,
      slotStarts,
      slotDurationMinutes,
    });

    lockedBooking = await Booking.findOneAndUpdate(
      ownedSlotMutationFilter(slotMutationLock),
      {
        $set: {
          timeSlot: startTime,
          endTime,
          duration,
          status: "Confirmado",
        },
      },
      { new: true, runValidators: true },
    );
    if (!lockedBooking) {
      await releaseClaimedBookingSlots(claimedSlots.insertedSlotIds);
      await releaseSlotMutationLock(
        slotMutationLock.booking._id,
        slotMutationLock.lock,
      );
      slotMutationLock = null;
      if (idempotencyRecord) {
        await IdempotencyKey.deleteOne({ _id: idempotencyRecord._id });
      }
      return res.status(409).json({
        success: false,
        message: "La reserva cambio mientras era reprogramada. Reintenta.",
        requestId: req.requestId,
      });
    }
    await releaseBookingSlotsExcept(lockedBooking._id, slotStarts);
    await releaseSlotMutationLock(lockedBooking._id, slotMutationLock.lock);
    slotMutationLock = null;

    const responseBody = {
      success: true,
      message: "Turno reprogramado.",
      data: publicBooking(lockedBooking),
      notifications: null,
      requestId: req.requestId,
    };
    if (idempotencyRecord) {
      Object.assign(idempotencyRecord, encryptIdempotencyResponse(responseBody), {
        booking: lockedBooking._id,
        status: "completed",
        responseStatus: 200,
      });
      await idempotencyRecord.save();
    }

    res.status(200).json(responseBody);

    Promise.allSettled([
      updateBookingInSheet(lockedBooking),
      sendBookingNotifications({ booking: lockedBooking, event: "rescheduled", previousTimeSlot }),
    ]).catch((err) => console.error("[rescheduleBooking side-effects]", err.message));
  } catch (error) {
    if (slotMutationLock) {
      await releaseSlotMutationLock(slotMutationLock.booking._id, slotMutationLock.lock)
        .catch(() => {});
    }
    if (idempotencyRecord && idempotencyRecord.status !== "completed") {
      await IdempotencyKey.deleteOne({ _id: idempotencyRecord._id }).catch(() => {});
    }

    if (error instanceof BookingSlotConflictError) {
      return res.status(409).json({
        success: false,
        message: "Horario ocupado.",
        requestId: req.requestId,
      });
    }

    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const updateStudentNotes = async (req, res, next) => {
  try {
    const code = normalizeCode(String(req.params.code ?? "").trim());
    if (code.length < 6) {
      return badRequest(res, "Código de reserva inválido.");
    }

    const { studentNotes } = req.body || {};
    if (typeof studentNotes !== "string") {
      return badRequest(res, "El campo 'studentNotes' es requerido.");
    }

    if (studentNotes.length > 500) {
      return badRequest(res, "Las notas no pueden superar los 500 caracteres.");
    }

    const booking = await managementBookingForCode(req, res, code);
    if (!booking) return undefined;

    if (!isManageableByClient(booking)) {
      return badRequest(
        res,
        "Solo se pueden actualizar notas de turnos activos que todavía no finalizaron.",
      );
    }

    booking.studentNotes = studentNotes.trim();
    await booking.save();

    setNoStore(res);
    res.status(200).json({
      success: true,
      message: "Notas actualizadas.",
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const cancelBookingClient = async (req, res, next) => {
  let slotMutationLock = null;

  try {
    const parsed = cancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Codigo de cancelacion invalido.", parsed.error.flatten());
    }

    const bookingCode = normalizeCode(parsed.data.bookingCode);
    const booking = await managementBookingForCode(req, res, bookingCode);
    if (!booking) return undefined;

    if (!isManageableByClient(booking)) {
      return badRequest(
        res,
        "Solo se pueden cancelar turnos activos que todavia no finalizaron.",
      );
    }

    slotMutationLock = await acquireSlotMutationLock(booking._id);
    if (!slotMutationLock) {
      return res.status(409).json({
        success: false,
        message: "La reserva esta siendo modificada. Reintenta en unos segundos.",
        requestId: req.requestId,
      });
    }

    if (!isManageableByClient(slotMutationLock.booking)) {
      await releaseSlotMutationLock(booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return badRequest(
        res,
        "Solo se pueden cancelar turnos activos que todavia no finalizaron.",
      );
    }

    const cancelledBooking = await Booking.findOneAndUpdate(
      ownedSlotMutationFilter(slotMutationLock),
      { $set: { status: "Cancelado" } },
      { new: true, runValidators: true },
    );
    if (!cancelledBooking) {
      await releaseSlotMutationLock(booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: "La reserva cambio mientras era cancelada. Reintenta.",
        requestId: req.requestId,
      });
    }

    await releaseBookingSlots(cancelledBooking._id);
    await releaseSlotMutationLock(cancelledBooking._id, slotMutationLock.lock);
    slotMutationLock = null;

    res.status(200).json({
      success: true,
      message: "Turno cancelado.",
      data: publicBooking(cancelledBooking),
      notifications: null,
      requestId: req.requestId,
    });

    Promise.allSettled([
      updateBookingInSheet(cancelledBooking),
      sendBookingNotifications({ booking: cancelledBooking, event: "cancelled" }),
    ]).catch((err) => console.error("[cancelBooking side-effects]", err.message));
  } catch (error) {
    if (slotMutationLock) {
      await releaseSlotMutationLock(
        slotMutationLock.booking._id,
        slotMutationLock.lock,
      ).catch(() => {});
    }

    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const confirmAttendanceClient = async (req, res, next) => {
  let slotMutationLock = null;

  try {
    const parsed = cancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Código de reserva inválido.", parsed.error.flatten());
    }

    const bookingCode = normalizeCode(parsed.data.bookingCode);
    const booking = await managementBookingForCode(req, res, bookingCode);
    if (!booking) return undefined;

    if (booking.status !== "Pendiente") {
      return badRequest(res, "Solo se pueden confirmar turnos que están en estado Pendiente.");
    }

    if (!isManageableByClient(booking)) {
      return badRequest(res, "Este turno ya no se puede modificar.");
    }

    slotMutationLock = await acquireSlotMutationLock(booking._id);
    if (!slotMutationLock) {
      return res.status(409).json({
        success: false,
        message: "La reserva esta siendo modificada. Reintenta en unos segundos.",
        requestId: req.requestId,
      });
    }

    const lockedBooking = slotMutationLock.booking;
    if (lockedBooking.status !== "Pendiente") {
      await releaseSlotMutationLock(booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return badRequest(res, "Solo se pueden confirmar turnos que están en estado Pendiente.");
    }

    if (!isManageableByClient(lockedBooking)) {
      await releaseSlotMutationLock(booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return badRequest(res, "Este turno ya no se puede modificar.");
    }

    const confirmedBooking = await Booking.findOneAndUpdate(
      ownedSlotMutationFilter(slotMutationLock),
      { $set: { status: "Confirmado" } },
      { new: true, runValidators: true },
    );
    if (!confirmedBooking) {
      await releaseSlotMutationLock(booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: "La reserva cambio mientras era confirmada. Reintenta.",
        requestId: req.requestId,
      });
    }

    await releaseSlotMutationLock(confirmedBooking._id, slotMutationLock.lock);
    slotMutationLock = null;

    setNoStore(res);
    res.status(200).json({
      success: true,
      message: "Asistencia confirmada. ¡Nos vemos en la clase!",
      data: publicBooking(confirmedBooking),
      requestId: req.requestId,
    });

    Promise.allSettled([
      updateBookingInSheet(confirmedBooking),
    ]).catch((err) => console.error("[confirmAttendance side-effects]", err.message));
  } catch (error) {
    if (slotMutationLock) {
      await releaseSlotMutationLock(
        slotMutationLock.booking._id,
        slotMutationLock.lock,
      ).catch(() => {});
    }

    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};
