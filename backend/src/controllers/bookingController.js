import mongoose from "mongoose";
import Booking from "../models/Booking.js";
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
import {
  availabilityQuerySchema,
  cancelSchema,
  createBookingSchema,
  getDefaultAvailabilityRange,
  looksLikeEmail,
  looksLikePhone,
  normalizeCode,
  normalizeEmail,
  normalizePhone,
  parseDateTimeInput,
  phoneDigitsRegex,
  rescheduleSchema,
  updateBookingSchema,
  validateContact,
  validateSlot,
} from "../utils/bookingRules.js";

const activeStatusFilter = { status: { $nin: ["Cancelado", "Finalizado"] } };

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

const publicBooking = (booking) => ({
  _id: booking._id,
  bookingCode: booking.bookingCode,
  responsibleName: booking.responsibleName,
  responsibleRelationship: booking.responsibleRelationship,
  responsibleRelationshipOther: booking.responsibleRelationshipOther,
  studentName: booking.studentName,
  tutorName: booking.tutorName,
  phone: booking.phone,
  email: booking.email,
  school: booking.school,
  educationLevel: booking.educationLevel,
  yearGrade: booking.yearGrade,
  subject: booking.subject,
  academicSituation: booking.academicSituation,
  timeSlot: booking.timeSlot,
  endTime: booking.endTime,
  duration: booking.duration,
  status: booking.status,
  studentNotes: booking.studentNotes,
  createdAt: booking.createdAt,
  updatedAt: booking.updatedAt,
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

const buildClientLookupCriteria = (identifier) => {
  const trimmed = String(identifier ?? "").trim();
  const email = normalizeEmail(trimmed);
  const phoneRegex = phoneDigitsRegex(trimmed);
  const code = normalizeCode(trimmed);

  if (looksLikeEmail(trimmed)) {
    return { email };
  }

  if (looksLikePhone(trimmed) && phoneRegex) {
    return { phone: phoneRegex };
  }

  return { bookingCode: code };
};

const getLookupMode = (identifier) => {
  const trimmed = String(identifier ?? "").trim();

  if (looksLikeEmail(trimmed)) {
    return "email";
  }

  if (looksLikePhone(trimmed)) {
    return "phone";
  }

  return "code";
};

const buildHistoryCriteria = (booking, fallbackIdentifier) => {
  const phoneRegex = phoneDigitsRegex(booking.phone);

  if (booking.phone && phoneRegex) {
    return { phone: phoneRegex };
  }

  if (booking.email) {
    return { email: booking.email };
  }

  return buildClientLookupCriteria(fallbackIdentifier);
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

  return { from, to };
};

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

export const createBooking = async (req, res, next) => {
  try {
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

    const [openingHour, closingHour, advanceNoticeMinutes, requireManual, slotDurationMinutes] = await Promise.all([
      getSetting("schedule.openingHour"),
      getSetting("schedule.closingHour"),
      getSetting("schedule.advanceNoticeMinutes"),
      getSetting("booking.requireManualConfirmation"),
      getSetting("schedule.slotDurationMinutes"),
    ]);

    const slotError = validateSlot(startTime, duration, openingHour, closingHour, advanceNoticeMinutes, slotDurationMinutes ?? 30);
    if (slotError) {
      return badRequest(res, slotError);
    }

    // Check if the day is blocked
    const dateStr = startTime.toISOString().slice(0, 10);
    const isBlocked = await BlockedDate.exists({ date: dateStr });
    if (isBlocked) {
      return badRequest(res, "Ese día no está disponible para reservas.");
    }

    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
    const conflict = await hasConflict(startTime, endTime);
    if (conflict) {
      return badRequest(res, "Horario ocupado.");
    }

    const bookingStatus = requireManual ? "Pendiente" : "Confirmado";

    const newBooking = await Booking.create({
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
    });

    // Respond immediately after DB insert — side effects run in background
    res.status(201).json({
      success: true,
      message: "Reserva confirmada con exito.",
      data: publicBooking(newBooking),
      notifications: null,
      requestId: req.requestId,
    });

    Promise.allSettled([
      appendBookingToSheet(newBooking),
      sendBookingNotifications({ booking: newBooking, event: "created" }),
      sendPushToAdmin({
        title: "Nueva reserva",
        body: `${newBooking.studentName} · ${newBooking.subject}`,
        url: "/admin",
      }),
    ]).catch((err) => console.error("[createBooking side-effects]", err.message));
  } catch (error) {
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

    const [bookings, blockedRecords, openingHour, closingHour] = await Promise.all([
      Booking.find(
        trustedFilter({
          ...activeStatusFilter,
          timeSlot: { $lte: range.to },
          endTime: { $gte: range.from },
        }),
      )
        .select("timeSlot endTime duration status")
        .lean()
        .sort({ timeSlot: 1 }),
      BlockedDate.find().select("date").lean(),
      getSetting("schedule.openingHour"),
      getSetting("schedule.closingHour"),
    ]);

    const blockedDates = blockedRecords.map((r) => r.date);

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
      schedule: { openingHour, closingHour },
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

    const page = Math.max(1, parseInt(req.query.page, 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 0));

    if (page > 0 && limit > 0) {
      const skip = (page - 1) * limit;
      const [bookings, total] = await Promise.all([
        Booking.find().sort({ timeSlot: -1 }).skip(skip).limit(limit).lean(),
        Booking.countDocuments(),
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

    const bookings = await Booking.find().sort({ timeSlot: -1 }).lean();

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
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { status: "Finalizado", timeSlot: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$price", 0] } } } },
      ]),
      Booking.aggregate([
        { $match: { status: "Finalizado", timeSlot: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
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

export const getBookingByCode = async (req, res, next) => {
  try {
    const identifier = String(req.params.code ?? "").trim();
    const isValidLookup =
      normalizeCode(identifier).length >= 6 ||
      looksLikeEmail(identifier) ||
      looksLikePhone(identifier);

    if (!isValidLookup) {
      return badRequest(res, "Ingresa un codigo, email o telefono valido.");
    }

    const lookupMode = getLookupMode(identifier);
    const keyBooking = await Booking.findOne(buildClientLookupCriteria(identifier)).lean();

    if (!keyBooking) {
      return notFound(res, "No encontramos ninguna reserva.");
    }

    const searchCriteria =
      lookupMode === "code"
        ? { bookingCode: keyBooking.bookingCode }
        : buildHistoryCriteria(keyBooking, identifier);

    const history = await Booking.find(searchCriteria).sort({ timeSlot: -1 }).lean();

    setNoStore(res);
    res.status(200).json({
      success: true,
      data: history.map(publicBooking),
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

export const updateBooking = async (req, res, next) => {
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
      const current = await Booking.findById(req.params.id).select("status").lean();
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

    if (updateData.timeSlot !== undefined) {
      const existing = await Booking.findById(req.params.id).select("duration").lean();
      if (!existing) {
        return notFound(res, "Reserva no encontrada.");
      }

      const startTime = parseDateTimeInput(updateData.timeSlot);
      const duration = Number(existing.duration) || 1;
      const slotError = validateSlot(startTime, duration);
      if (slotError) {
        return badRequest(res, slotError);
      }

      const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
      const conflict = await hasConflict(startTime, endTime, req.params.id);
      if (conflict) {
        return badRequest(res, "El nuevo horario tiene conflicto con otra reserva activa.");
      }

      updateData.timeSlot = startTime;
      updateData.endTime = endTime;
    }

    const NOTE_FIELDS = ["notes", "studentEvolution", "emotionalState"];
    const historyPush = NOTE_FIELDS
      .filter((f) => updateData[f] !== undefined)
      .map((f) => ({ field: f, text: updateData[f], savedAt: new Date() }));

    const mongoUpdate = { $set: updateData };
    if (historyPush.length > 0) {
      mongoUpdate.$push = { notesHistory: { $each: historyPush } };
    }

    const updatedBooking = await Booking.findByIdAndUpdate(req.params.id, mongoUpdate, {
      new: true,
      runValidators: true,
    });

    if (!updatedBooking) {
      return notFound(res, "Reserva no encontrada.");
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

export const deleteBooking = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return badRequest(res, "Identificador de reserva invalido.");
    }

    const deletedBooking = await Booking.findByIdAndDelete(req.params.id);
    if (!deletedBooking) {
      return notFound(res, "Reserva no encontrada.");
    }

    await deleteBookingFromSheet(deletedBooking.bookingCode);

    setNoStore(res);
    res.status(200).json({
      success: true,
      message: "Reserva eliminada.",
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

export const deleteAllBookings = async (req, res, next) => {
  try {
    await Booking.deleteMany({});
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

export const rescheduleBooking = async (req, res, next) => {
  try {
    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Datos de reprogramacion invalidos.", parsed.error.flatten());
    }

    const cleanCode = normalizeCode(parsed.data.bookingCode);
    const booking = await Booking.findOne({ bookingCode: cleanCode });

    if (!booking) {
      return notFound(res, "Codigo no encontrado.");
    }

    if (!isManageableByClient(booking)) {
      return badRequest(
        res,
        "Solo se pueden reprogramar turnos activos que todavia no finalizaron.",
      );
    }

    const startTime = parseDateTimeInput(parsed.data.newTimeSlot);
    const duration = Number(parsed.data.newDuration);
    const slotError = validateSlot(startTime, duration);
    if (slotError) {
      return badRequest(res, slotError);
    }

    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
    const conflict = await hasConflict(startTime, endTime, booking._id);
    if (conflict) {
      return badRequest(res, "Horario ocupado.");
    }

    const previousTimeSlot = booking.timeSlot;

    booking.timeSlot = startTime;
    booking.endTime = endTime;
    booking.duration = duration;
    booking.status = "Confirmado";
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Turno reprogramado.",
      data: publicBooking(booking),
      notifications: null,
      requestId: req.requestId,
    });

    Promise.allSettled([
      updateBookingInSheet(booking),
      sendBookingNotifications({ booking, event: "rescheduled", previousTimeSlot }),
    ]).catch((err) => console.error("[rescheduleBooking side-effects]", err.message));
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

    const booking = await Booking.findOne({ bookingCode: code });
    if (!booking) {
      return notFound(res, "Reserva no encontrada.");
    }

    if (booking.status === "Cancelado" || booking.status === "Finalizado") {
      return badRequest(res, "No se pueden actualizar notas en reservas canceladas o finalizadas.");
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
  try {
    const parsed = cancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Codigo de cancelacion invalido.", parsed.error.flatten());
    }

    const booking = await Booking.findOne({
      bookingCode: normalizeCode(parsed.data.bookingCode),
    });

    if (!booking) {
      return notFound(res, "No encontrado.");
    }

    if (!isManageableByClient(booking)) {
      return badRequest(
        res,
        "Solo se pueden cancelar turnos activos que todavia no finalizaron.",
      );
    }

    booking.status = "Cancelado";
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Turno cancelado.",
      data: publicBooking(booking),
      notifications: null,
      requestId: req.requestId,
    });

    Promise.allSettled([
      updateBookingInSheet(booking),
      sendBookingNotifications({ booking, event: "cancelled" }),
    ]).catch((err) => console.error("[cancelBooking side-effects]", err.message));
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

export const confirmAttendanceClient = async (req, res, next) => {
  try {
    const parsed = cancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Código de reserva inválido.", parsed.error.flatten());
    }

    const booking = await Booking.findOne({
      bookingCode: normalizeCode(parsed.data.bookingCode),
    });

    if (!booking) {
      return notFound(res, "No encontrado.");
    }

    if (booking.status !== "Pendiente") {
      return badRequest(res, "Solo se pueden confirmar turnos que están en estado Pendiente.");
    }

    if (!isManageableByClient(booking)) {
      return badRequest(res, "Este turno ya no se puede modificar.");
    }

    booking.status = "Confirmado";
    await booking.save();

    setNoStore(res);
    res.status(200).json({
      success: true,
      message: "Asistencia confirmada. ¡Nos vemos en la clase!",
      data: publicBooking(booking),
      requestId: req.requestId,
    });

    Promise.allSettled([
      updateBookingInSheet(booking),
    ]).catch((err) => console.error("[confirmAttendance side-effects]", err.message));
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
