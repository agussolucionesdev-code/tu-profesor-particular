import crypto from "node:crypto";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import IdempotencyKey from "../models/IdempotencyKey.js";
import BlockedDate from "../models/BlockedDate.js";
import { getSetting } from "./settingsController.js";
import {
  buildBookingNotificationIntents,
  reconcileNotificationIntents,
} from "../services/notificationOutboxService.js";
import { enqueueBlindManagementLinkRequest } from "../services/managementLinkRequestService.js";
import {
  appendBookingToSheet,
  deleteBookingFromSheet,
  updateBookingInSheet,
} from "../services/sheetsService.js";
import { sendPushToAdmin } from "../services/pushService.js";
import {
  hashManagementToken,
  issueManagementToken,
  MANAGEMENT_TOKEN_PATTERN,
} from "../services/managementTokenService.js";
import {
  combineMutationGuards,
  withoutActiveManagementLinkRequest,
  withoutActiveNotificationDeliveryFence,
  withoutActiveSlotMutation,
} from "../services/bookingMutationFenceService.js";
import {
  calculateAvailableSlots,
  getScheduleConfiguration,
  normalizeDurationMinutes,
  validateConfiguredSlot,
} from "../services/availabilityService.js";
import {
  BookingSlotConflictError,
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
  adminAvailabilityQuerySchema,
  adminCreateBookingSchema,
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
  SLOT_OWNING_BOOKING_FILTER,
  TRASHED_BOOKING_FILTER,
  withActiveBooking,
} from "../utils/bookingFilters.js";
import {
  buildPendingBookingAudit,
  isAmbiguousAuditWriteError,
  recordBookingAudit,
} from "../services/auditService.js";
import { SLOT_MUTATION_LOCK_MS } from "../config/bookingMutationLease.js";
import { STUDENT_IDENTITY_ALGORITHM_VERSION } from "../services/studentIdentityService.js";
import { isScheduleGridChangeInProgress } from "../services/scheduleGridChangeLeaseService.js";
import { sendSeriesSummary } from "../config/mailer.js";
import {
  buildPricingForNewBooking,
  repricingForReschedule,
} from "../services/bookingPricing.js";

const activeStatusFilter = SLOT_OWNING_BOOKING_FILTER;

/* Pendiente → Finalizado se agregó porque sin él los Pendiente vencidos no
   tenían salida: el cron los ignoraba y el profesor tampoco podía cerrarlos a
   mano desde el panel. Se acumulaban en la agenda para siempre.
   Cancelado y Finalizado siguen siendo terminales: de ahí no se vuelve. */
const STATUS_TRANSITIONS = {
  Pendiente: ["Confirmado", "Finalizado", "Cancelado"],
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
const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const INVALID_MANAGEMENT_LINK_MESSAGE = "El enlace de gestión no es válido o venció.";

const publicBooking = (booking) => ({
  bookingCode: booking.bookingCode,
  studentName: booking.studentName,
  subject: booking.subject,
  // La modalidad no es sensible y el alumno necesita verla confirmada: es la
  // diferencia entre esperar un enlace y viajar hasta Temperley.
  modality: booking.modality,
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
  modality: booking.modality,
  academicSituation: booking.academicSituation,
  timeSlot: booking.timeSlot,
  endTime: booking.endTime,
  duration: booking.duration,
  status: booking.status,
  /* Las notas que el alumno escribe para el profesor. Faltaban acá, así que la
     pantalla del portal no podía mostrar lo ya guardado: se abría vacía y el
     primer "Guardar" borraba la nota sin que nadie se diera cuenta. Es un dato
     que la propia persona escribió, así que le vuelve a ella. */
  studentNotes: booking.studentNotes ?? "",
  /* Para que el portal pueda mostrar las clases de una serie juntas y decir
     "clase 3 de 8" en lugar de ocho tarjetas que parecen sin relación. Es una
     etiqueta de agrupación, no una credencial: cada clase sigue necesitando su
     propio token. */
  seriesId: booking.seriesId ?? null,
  seriesIndex: booking.seriesIndex ?? null,
  seriesTotal: booking.seriesTotal ?? null,
});

const adminBooking = (booking) => {
  const source = typeof booking?.toObject === "function" ? booking.toObject() : booking;
  return {
    _id: source._id,
    bookingCode: source.bookingCode,
    studentName: source.studentName,
    responsibleName: source.responsibleName,
    responsibleRelationship: source.responsibleRelationship,
    responsibleRelationshipOther: source.responsibleRelationshipOther,
    tutorName: source.tutorName,
    email: source.email,
    phone: source.phone,
    school: source.school,
    educationLevel: source.educationLevel,
    yearGrade: source.yearGrade,
    subject: source.subject,
    academicSituation: source.academicSituation,
    timeSlot: source.timeSlot,
    endTime: source.endTime,
    duration: source.duration,
    bufferBeforeMinutes: source.bufferBeforeMinutes,
    bufferAfterMinutes: source.bufferAfterMinutes,
    price: source.price,
    notes: source.notes,
    studentNotes: source.studentNotes,
    studentEvolution: source.studentEvolution,
    emotionalState: source.emotionalState,
    notesHistory: source.notesHistory,
    status: source.status,
    attendanceStatus: source.attendanceStatus,
    attendanceRecordedAt: source.attendanceRecordedAt,
    attendanceNotes: source.attendanceNotes,
    attendanceUpdatedBy: source.attendanceUpdatedBy,
    studentId: source.studentId,
    studentLink: source.studentLink
      ? {
        status: source.studentLink.status,
        source: source.studentLink.source,
        linkedAt: source.studentLink.linkedAt,
        errorCode: source.studentLink.errorCode,
      }
      : null,
    deletedAt: source.deletedAt,
    deletedBy: source.deletedBy,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

const pendingStudentLink = () => ({
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
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const booking = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        ...scopeFilter,
        ...combineMutationGuards(
          withoutActiveSlotMutation(),
          withoutActiveManagementLinkRequest(),
          withoutActiveNotificationDeliveryFence(),
          { pendingAudit: null },
        ),
      },
      [{
        $set: {
          slotMutationLock: lock,
          slotMutationLockExpiresAt: {
            $dateAdd: {
              startDate: "$$NOW",
              unit: "millisecond",
              amount: SLOT_MUTATION_LOCK_MS,
            },
          },
        },
      }],
      { new: true, updatePipeline: true },
    ).select("+notificationIntents +slotMutationLock +slotMutationLockExpiresAt");

    if (booking) {
      return { booking, lock, expiresAt: booking.slotMutationLockExpiresAt };
    }
    if (attempt < 5) {
      const now = new Date();
      const blocker = await Booking.findById(bookingId)
        .select("+slotMutationLock +slotMutationLockExpiresAt +managementLinkRequestLock +managementLinkRequestLockExpiresAt +notificationDeliveryFence +pendingAudit")
        .lean();
      const activeSlotMutation = blocker?.slotMutationLock &&
        new Date(blocker.slotMutationLockExpiresAt || 0) > now;
      if (activeSlotMutation) return null;
      if (blocker?.pendingAudit?.operationId) return null;
      const activeSharedFence = (
        blocker?.managementLinkRequestLock &&
        new Date(blocker.managementLinkRequestLockExpiresAt || 0) > now
      ) || (
        blocker?.notificationDeliveryFence &&
        new Date(blocker.notificationDeliveryFence.expiresAt || 0) > now
      );
      if (!activeSharedFence) return null;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  return null;
};

const unwrapFindOneAndUpdate = (result) => (
  result && Object.prototype.hasOwnProperty.call(result, "value") ? result.value : result
);

const persistCreationDraft = async (booking) => {
  const lock = crypto.randomUUID();
  booking.creationState = "claiming";
  await booking.save();

  const result = await Booking.collection.findOneAndUpdate(
    {
      _id: booking._id,
      creationState: "claiming",
      $or: [
        { slotMutationLock: null },
        { slotMutationLock: { $exists: false } },
      ],
    },
    [{
      $set: {
        slotMutationLock: lock,
        slotMutationLockExpiresAt: {
          $dateAdd: {
            startDate: "$$NOW",
            unit: "millisecond",
            amount: SLOT_MUTATION_LOCK_MS,
          },
        },
      },
    }],
    {
      returnDocument: "after",
      projection: { _id: 1, slotMutationLock: 1, slotMutationLockExpiresAt: 1 },
    },
  );
  const owner = unwrapFindOneAndUpdate(result);
  if (!owner) throw new Error("Could not acquire booking creation lease.");
  return { lock, expiresAt: owner.slotMutationLockExpiresAt };
};

const activateCreationDraft = async ({ bookingId, lock, unsetPendingAudit = false }) => {
  const unset = {
    slotMutationLock: "",
    slotMutationLockExpiresAt: "",
    ...(unsetPendingAudit ? { pendingAudit: "" } : {}),
  };
  const result = await Booking.collection.findOneAndUpdate(
    {
      _id: bookingId,
      creationState: "claiming",
      slotMutationLock: lock,
      $expr: { $gt: ["$slotMutationLockExpiresAt", "$$NOW"] },
    },
    {
      $set: { creationState: "active" },
      $unset: unset,
    },
    { returnDocument: "after" },
  );
  return unwrapFindOneAndUpdate(result);
};

const discardOwnedCreationDraft = ({ bookingId, lock }) => Booking.deleteOne({
  _id: bookingId,
  creationState: { $in: ["claiming", "abandoned"] },
  slotMutationLock: lock,
});
const SLOT_RELEASING_STATUSES = new Set(["Cancelado", "Finalizado"]);
const REMINDER_RELEVANT_FIELDS = new Set([
  "studentName",
  "responsibleName",
  "responsibleRelationship",
  "responsibleRelationshipOther",
  "tutorName",
  "phone",
  "email",
  "school",
  "educationLevel",
  "yearGrade",
  "subject",
  "academicSituation",
  "duration",
  "timeSlot",
  "status",
]);
const CLIENT_NOTIFICATION_CONTENT_FIELDS = new Set([
  "studentName",
  "responsibleName",
  "responsibleRelationship",
  "responsibleRelationshipOther",
  "phone",
  "email",
  "school",
  "educationLevel",
  "yearGrade",
  "subject",
  "academicSituation",
]);
const reminderValueChanged = (before, after) => {
  if (before instanceof Date || after instanceof Date) {
    return new Date(before).getTime() !== new Date(after).getTime();
  }
  return before !== after;
};

const buildDurableBookingNotificationIntents = ({
  booking,
  type,
  previousTimeSlot,
  managementUrl,
  auditCommitOperationId = null,
  /* Las clases de una serie no mandan confirmación individual: ocho correos que
     llegan juntos, con los mismos datos y códigos distintos, se leen como un
     error del sistema aunque cada uno sea correcto. En su lugar va UN resumen.

     Ojo con el alcance: esto suprime SOLO la confirmación. El recordatorio de
     24 h de cada clase se mantiene —está más abajo, fuera de `primary`— porque
     es el sentido de tener ocho reservas independientes: te avisa antes de cada
     una. Suprimirlo convertiría la serie en una clase con siete fantasmas. */
  suppressPrimary = false,
}) => {
  const eventKey = crypto.randomUUID();
  const now = new Date();
  const primary = suppressPrimary
    ? []
    : buildBookingNotificationIntents({
      booking,
      type,
      eventKey,
      previousTimeSlot,
      managementUrl,
      now,
      auditCommitOperationId,
    });
  const reminder = type !== "booking_cancelled" && booking.status === "Confirmado"
    ? buildBookingNotificationIntents({
      booking,
      type: "booking_reminder",
      eventKey,
      includeOwner: false,
      now,
      auditCommitOperationId,
    })
    : [];
  return [...primary, ...reminder];
};

const reconcileBookingNotifications = async (bookingId) => {
  try {
    await reconcileNotificationIntents({ bookingId });
  } catch (error) {
    console.error("[notification-outbox reconcile]", JSON.stringify({
      bookingId: String(bookingId),
      message: "Reconciliation deferred to worker.",
    }));
  }
};

class ScheduleGridChangedError extends Error {
  constructor() {
    super("La configuración horaria cambió durante la operación.");
    this.name = "ScheduleGridChangedError";
  }
}

const assertScheduleGridUnchanged = async (expectedSlotDurationMinutes) => {
  // Check the lease first. If a change starts after this read, its subsequent
  // Booking/BookingSlot guard will observe this operation's already-owned slots.
  if (await isScheduleGridChangeInProgress()) {
    throw new ScheduleGridChangedError();
  }
  const schedule = await getScheduleConfiguration();
  if (schedule.slotDurationMinutes !== expectedSlotDurationMinutes) {
    throw new ScheduleGridChangedError();
  }
};

const scheduleGridChangedResponse = (res, requestId) => res.status(409).json({
  success: false,
  code: "SCHEDULE_GRID_CHANGED",
  message: "La disponibilidad cambió mientras procesábamos la solicitud. Reintentá.",
  requestId,
});

const releaseSlotMutationLock = async (bookingId, lock) =>
  Booking.updateOne(
    { _id: bookingId, slotMutationLock: lock },
    { $unset: { slotMutationLock: 1, slotMutationLockExpiresAt: 1 } },
  );

export const renewSlotMutationLock = async (slotMutationLock) => {
  const renewed = await Booking.collection.findOneAndUpdate(
    trustedFilter({
      _id: slotMutationLock.booking._id,
      slotMutationLock: slotMutationLock.lock,
      $expr: { $gt: ["$slotMutationLockExpiresAt", "$$NOW"] },
    }),
    [{
      $set: {
        slotMutationLockExpiresAt: {
          $dateAdd: {
            startDate: "$$NOW",
            unit: "millisecond",
            amount: SLOT_MUTATION_LOCK_MS,
          },
        },
      },
    }],
    {
      returnDocument: "after",
      projection: { _id: 1, slotMutationLock: 1, slotMutationLockExpiresAt: 1 },
    },
  );
  const owner = renewed && Object.prototype.hasOwnProperty.call(renewed, "value")
    ? renewed.value
    : renewed;
  if (!owner) throw new Error("Booking mutation lease was lost before slot cleanup.");
  slotMutationLock.expiresAt = owner.slotMutationLockExpiresAt;
};

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

const deleteWithinOwnedLease = async ({ filter, leaseExpiresAt }) => {
  const remainingLeaseMS = new Date(leaseExpiresAt).getTime() - Date.now();
  const timeoutMS = Math.min(
    AUDIT_COMPENSATION_TIMEOUT_CAP_MS,
    remainingLeaseMS - AUDIT_COMPENSATION_SAFETY_MS,
  );
  if (!Number.isFinite(timeoutMS) || timeoutMS <= 0) {
    return { acknowledged: true, deletedCount: 0 };
  }

  try {
    return await Booking.deleteOne(
      trustedFilter({
        ...filter,
        // Exact lock ownership is necessary but not sufficient: an unchanged
        // owner value is stale once the database server observes lease expiry.
        $expr: { $gt: ["$slotMutationLockExpiresAt", "$$NOW"] },
      }),
      { timeoutMS },
    );
  } catch {
    // Driver timeouts are ambiguous: MongoDB may have committed the delete
    // before the acknowledgement was lost. A bounded authoritative read-back
    // distinguishes that case so its durable slot claims are also released.
    const persisted = await Booking.collection.findOne(
      { _id: filter._id },
      { projection: { _id: 1 }, timeoutMS: AUDIT_COMPENSATION_TIMEOUT_CAP_MS },
    ).catch(() => undefined);
    if (persisted === null) {
      return { acknowledged: false, deletedCount: 1, reconciledAfterError: true };
    }
    // If the booking is present, pendingAudit remains the recovery marker. If
    // read-back is itself uncertain, retain the durable slot claims: their
    // orphan reconciler can safely evict them once booking absence is proven.
    return { acknowledged: false, deletedCount: 0, readbackUncertain: persisted === undefined };
  }
};

const ownedSlotMutationFilter = ({ booking, lock }) => ({
  _id: booking._id,
  slotMutationLock: lock,
  $expr: { $gt: ["$slotMutationLockExpiresAt", "$$NOW"] },
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

const bufferedBounds = (
  startTime,
  endTime,
  { bufferBeforeMinutes = 0, bufferAfterMinutes = 0 } = {},
) => ({
  start: new Date(
    new Date(startTime).getTime() - Number(bufferBeforeMinutes) * 60 * 1000,
  ),
  end: new Date(
    new Date(endTime).getTime() + Number(bufferAfterMinutes) * 60 * 1000,
  ),
});

const existingBookingOverlapExpression = (startTime, endTime) => ({
  $and: [
    {
      $lt: [
        {
          $subtract: [
            "$timeSlot",
            { $multiply: [{ $ifNull: ["$bufferBeforeMinutes", 0] }, 60 * 1000] },
          ],
        },
        endTime,
      ],
    },
    {
      $gt: [
        {
          $add: [
            "$endTime",
            { $multiply: [{ $ifNull: ["$bufferAfterMinutes", 0] }, 60 * 1000] },
          ],
        },
        startTime,
      ],
    },
  ],
});

const hasConflict = async (
  startTime,
  endTime,
  excludeId = null,
  buffers = {},
) => {
  const claim = bufferedBounds(startTime, endTime, buffers);
  const criteria = {
    ...activeStatusFilter,
    $expr: existingBookingOverlapExpression(claim.start, claim.end),
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

const parseAdminAvailabilityRange = (query) => {
  const parsed = adminAvailabilityQuerySchema.safeParse(query);
  if (!parsed.success) return null;

  const from = parseDateTimeInput(parsed.data.from);
  const to = parseDateTimeInput(parsed.data.to);
  if (!from || !to || from >= to) return null;
  if (to.getTime() - from.getTime() > MAX_AVAILABILITY_RANGE_MS) return null;
  if (
    parsed.data.excludeBookingId &&
    !mongoose.isValidObjectId(parsed.data.excludeBookingId)
  ) return null;

  return {
    from,
    to,
    duration: parsed.data.duration,
    excludeBookingId: parsed.data.excludeBookingId ?? null,
  };
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

export const createAdminBooking = async (req, res, next) => {
  let idempotencyRecord = null;
  let createdBooking = null;
  let claimedSlots = null;
  let creationLock = null;
  let auditCommitted = false;
  let auditOutcomeAmbiguous = false;
  let auditStarted = false;

  try {
    const idempotencyKey = getIdempotencyKey(req);
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return badRequest(res, "Debes enviar un Idempotency-Key valido para crear la reserva.");
    }

    const parsed = adminCreateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Revisa los datos de la reserva.", parsed.error.flatten());
    }
    const payload = normalizeBookingPayload(parsed.data);
    const contactError = validateContact(payload);
    if (contactError) return badRequest(res, contactError);

    const startTime = parseDateTimeInput(payload.timeSlot);
    const {
      error: slotError,
      schedule,
      durationMinutes,
      endTime,
    } = await validateConfiguredSlot(startTime, Number(payload.duration));
    if (slotError) return badRequest(res, slotError);

    const duration = durationMinutes / 60;
    const storageKey = scopedIdempotencyKey("admin-create", idempotencyKey);
    const requestFingerprint = fingerprintRequest({
      ...payload,
      timeSlot: startTime.toISOString(),
      duration,
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

    if (await hasConflict(startTime, endTime, null, schedule)) {
      await IdempotencyKey.deleteOne({ _id: idempotencyRecord._id });
      idempotencyRecord = null;
      return res.status(409).json({
        success: false,
        message: "Horario ocupado.",
        requestId: req.requestId,
      });
    }

    const auditOperationId = crypto.randomUUID();
    createdBooking = new Booking({
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
      modality: payload.modality,
      academicSituation: payload.academicSituation,
      timeSlot: startTime,
      endTime,
      duration,
      bufferBeforeMinutes: schedule.bufferBeforeMinutes,
      bufferAfterMinutes: schedule.bufferAfterMinutes,
      price: payload.price,
      notes: payload.notes,
      status: payload.status,
      studentLink: pendingStudentLink(),
      creationState: "claiming",
    });
    await createdBooking.validate();
    const { managementUrl } = issueManagementToken(createdBooking);
    createdBooking.notificationIntents = buildDurableBookingNotificationIntents({
      booking: createdBooking,
      type: "booking_confirmation",
      managementUrl,
      auditCommitOperationId: auditOperationId,
    });
    const pendingAudit = buildPendingBookingAudit({
      req,
      action: "booking.created",
      before: {},
      after: createdBooking,
      operationId: auditOperationId,
    });
    createdBooking.pendingAudit = pendingAudit;
    const creationLease = await persistCreationDraft(createdBooking);
    creationLock = creationLease.lock;
    const leaseExpiresAt = creationLease.expiresAt;
    const claim = bufferedBounds(startTime, endTime, schedule);
    const slotStarts = getBookingSlotStarts({
      startTime: claim.start,
      endTime: claim.end,
      slotDurationMinutes: schedule.slotDurationMinutes,
    });
    claimedSlots = await claimBookingSlots({
      bookingId: createdBooking._id,
      slotStarts,
      slotDurationMinutes: schedule.slotDurationMinutes,
    });
    try {
      await assertScheduleGridUnchanged(schedule.slotDurationMinutes);
    } catch (error) {
      await releaseClaimedBookingSlots(claimedSlots);
      claimedSlots = null;
      throw error;
    }

    try {
      auditStarted = true;
      await recordBookingAudit({
        req,
        action: "booking.created",
        bookingId: createdBooking._id,
        before: {},
        after: createdBooking,
        leaseExpiresAt,
        operationId: auditOperationId,
        pendingAudit,
      });
      auditCommitted = true;
    } catch (auditError) {
      if (isAmbiguousAuditWriteError(auditError)) {
        auditOutcomeAmbiguous = true;
        throw auditError;
      }
      const removal = await deleteWithinOwnedLease({
        filter: {
          _id: createdBooking._id,
          slotMutationLock: creationLock,
          slotMutationLockExpiresAt: leaseExpiresAt,
        },
        leaseExpiresAt,
      });
      if (removal.deletedCount === 1) {
        await releaseBookingSlots(createdBooking._id);
        claimedSlots = null;
        createdBooking = null;
      } else {
        console.error("[audit-compensation]", JSON.stringify({
          event: "booking_create_audit_compensation_lost_lease",
          bookingId: String(createdBooking._id),
          requestId: req.requestId,
        }));
      }
      throw auditError;
    }

    const activated = await activateCreationDraft({
      bookingId: createdBooking._id,
      lock: creationLock,
      unsetPendingAudit: true,
    });
    if (!activated) {
      throw new BookingSlotConflictError();
    }
    createdBooking = Booking.hydrate(activated);
    creationLock = null;
    claimedSlots = null;

    const responseBody = {
      success: true,
      message: "Reserva creada por el administrador.",
      data: adminBooking(createdBooking),
      requestId: req.requestId,
    };
    await reconcileBookingNotifications(createdBooking._id);
    Object.assign(idempotencyRecord, encryptIdempotencyResponse(responseBody), {
      booking: createdBooking._id,
      status: "completed",
      responseStatus: 201,
    });
    await idempotencyRecord.save();
    res.status(201).json(responseBody);

    Promise.allSettled([
      appendBookingToSheet(createdBooking),
      sendPushToAdmin({
        title: "Reserva creada",
        body: `${createdBooking.studentName} · ${createdBooking.subject}`,
        url: "/admin",
      }),
    ]).catch((error) => console.error("[createAdminBooking side-effects]", error.message));
  } catch (error) {
    if (!auditStarted && createdBooking?._id && creationLock) {
      await discardOwnedCreationDraft({
        bookingId: createdBooking._id,
        lock: creationLock,
      }).catch(() => {});
    }
    if (!auditCommitted && !auditOutcomeAmbiguous && idempotencyRecord?.status !== "completed") {
      await IdempotencyKey.deleteOne({ _id: idempotencyRecord._id }).catch(() => {});
    }
    if (error instanceof BookingSlotConflictError) {
      return res.status(409).json({
        success: false,
        message: "Horario ocupado.",
        requestId: req.requestId,
      });
    }
    if (error instanceof ScheduleGridChangedError) {
      return scheduleGridChangedResponse(res, req.requestId);
    }
    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const createBooking = async (req, res, next) => {
  let idempotencyRecord = null;
  let claimedSlots = null;
  let newBooking = null;
  let creationLock = null;

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
    const requestedDuration = Number(payload.duration);

    const [{ error: slotError, schedule, durationMinutes, endTime }, requireManual] = await Promise.all([
      validateConfiguredSlot(startTime, requestedDuration),
      getSetting("booking.requireManualConfirmation"),
    ]);

    if (slotError) {
      return badRequest(res, slotError);
    }

    const { slotDurationMinutes } = schedule;
    const duration = durationMinutes / 60;
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

    if (await hasConflict(startTime, endTime, null, schedule)) {
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

    /* El precio se resuelve en el servidor con la tarifa configurada. Antes esto
       no existía y toda reserva self-service quedaba en 0, así que el KPI de
       ingresos solo veía lo que el profesor cargaba a mano. */
    const pricing = await buildPricingForNewBooking(duration);

    newBooking = new Booking({
      ...pricing,
      seriesId: payload.seriesId ?? null,
      seriesIndex: payload.seriesIndex ?? null,
      seriesTotal: payload.seriesTotal ?? null,
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
      modality: payload.modality,
      academicSituation: payload.academicSituation,
      timeSlot: startTime,
      endTime,
      duration,
      bufferBeforeMinutes: schedule.bufferBeforeMinutes,
      bufferAfterMinutes: schedule.bufferAfterMinutes,
      notes: "",
      status: bookingStatus,
      creationState: "claiming",
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
    await newBooking.validate();
    const { managementToken, managementUrl } = issueManagementToken(newBooking);
    newBooking.notificationIntents = buildDurableBookingNotificationIntents({
      booking: newBooking,
      type: "booking_confirmation",
      managementUrl,
      // Las de una serie las cubre el resumen; el recordatorio de cada una sigue.
      suppressPrimary: Boolean(payload.seriesId),
    });
    const creationLease = await persistCreationDraft(newBooking);
    creationLock = creationLease.lock;
    const claim = bufferedBounds(startTime, endTime, schedule);
    const slotStarts = getBookingSlotStarts({
      startTime: claim.start,
      endTime: claim.end,
      slotDurationMinutes,
    });
    claimedSlots = await claimBookingSlots({
      bookingId: newBooking._id,
      slotStarts,
      slotDurationMinutes,
    });
    try {
      await assertScheduleGridUnchanged(slotDurationMinutes);
      const activated = await activateCreationDraft({
        bookingId: newBooking._id,
        lock: creationLock,
      });
      if (!activated) throw new BookingSlotConflictError();
      newBooking = Booking.hydrate(activated);
      creationLock = null;
      claimedSlots = null;
    } catch (error) {
      await releaseClaimedBookingSlots(claimedSlots);
      claimedSlots = null;
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

    await reconcileBookingNotifications(newBooking._id);

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
      sendPushToAdmin({
        title: "Nueva reserva",
        body: `${newBooking.studentName} · ${newBooking.subject}`,
        url: "/admin",
      }),
    ]).catch((err) => console.error("[createBooking side-effects]", err.message));
  } catch (error) {
    if (newBooking?._id && creationLock) {
      await discardOwnedCreationDraft({
        bookingId: newBooking._id,
        lock: creationLock,
      }).catch(() => {});
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

    if (error instanceof ScheduleGridChangedError) {
      return scheduleGridChangedResponse(res, req.requestId);
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
    const durationValidation = normalizeDurationMinutes(
      range.duration ?? schedule.slotDurationMinutes / 60,
      schedule.slotDurationMinutes,
    );
    const requestedDuration = durationValidation.durationMinutes / 60;

    if (durationValidation.error) {
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
          $expr: existingBookingOverlapExpression(range.from, range.to),
        }),
      )
        .select("timeSlot endTime duration bufferBeforeMinutes bufferAfterMinutes status")
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
      count: 0,
      data: [],
      blockedDates,
      // Legacy fields are preserved for the deployed frontend. `slots` is the
      // backend-authoritative availability contract for all future consumers.
      schedule: {
        timeZone: schedule.timeZone,
        slotDurationMinutes: schedule.slotDurationMinutes,
        minimumNoticeMinutes: schedule.minimumNoticeMinutes,
        maximumAdvanceDays: schedule.maximumAdvanceDays,
      },
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
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

export const getAdminAvailability = async (req, res, next) => {
  try {
    const range = parseAdminAvailabilityRange(req.query);
    if (!range) {
      return badRequest(
        res,
        `Rango de disponibilidad invalido. Usa from, to y duration en un intervalo maximo de ${MAX_AVAILABILITY_RANGE_DAYS} dias.`,
      );
    }

    let excludedBooking = null;
    if (range.excludeBookingId) {
      excludedBooking = await Booking.findOne(
        withActiveBooking({ _id: range.excludeBookingId }),
      ).select("_id").lean();
      if (!excludedBooking) return notFound(res, "Reserva a excluir no encontrada.");
    }

    const schedule = await getScheduleConfiguration();
    const durationValidation = normalizeDurationMinutes(
      range.duration,
      schedule.slotDurationMinutes,
    );
    if (durationValidation.error) return badRequest(res, durationValidation.error);

    const exclusionFilter = excludedBooking
      ? { _id: { $ne: excludedBooking._id } }
      : {};
    const [bookings, blockedRecords] = await Promise.all([
      Booking.find(trustedFilter({
        ...activeStatusFilter,
        ...exclusionFilter,
        $expr: existingBookingOverlapExpression(range.from, range.to),
      }))
        .select("timeSlot endTime duration bufferBeforeMinutes bufferAfterMinutes status")
        .lean()
        .sort({ timeSlot: 1 }),
      BlockedDate.find().select("date").lean(),
    ]);
    const slots = calculateAvailableSlots({
      from: range.from,
      to: range.to,
      bookings,
      blockedDates: blockedRecords.map(({ date }) => date),
      schedule,
      durationHours: durationValidation.durationMinutes / 60,
    });

    setNoStore(res);
    return res.status(200).json({
      success: true,
      data: {
        timeZone: schedule.timeZone,
        range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          duration: durationValidation.durationMinutes / 60,
        },
        slots,
        excludedBookingId: excludedBooking ? String(excludedBooking._id) : null,
        schedule: {
          slotDurationMinutes: schedule.slotDurationMinutes,
          bufferBeforeMinutes: schedule.bufferBeforeMinutes,
          bufferAfterMinutes: schedule.bufferAfterMinutes,
        },
      },
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
        data: bookings.map(adminBooking),
        requestId: req.requestId,
      });
    }

    const bookings = await Booking.find(scopeFilter).sort({ timeSlot: -1 }).lean();

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings.map(adminBooking),
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
  let canReleaseClaimedSlotsOnFailure = true;

  try {
    if (!isValidObjectId(req.params.id)) {
      return badRequest(res, "Identificador de reserva invalido.");
    }

    const parsed = updateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Datos de actualizacion invalidos.", parsed.error.flatten());
    }

    const updateData = { ...parsed.data };

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

    const beforeBooking = slotMutationLock.booking.toObject();
    const scheduleChanged = updateData.timeSlot !== undefined || updateData.duration !== undefined;
    const currentStatus = beforeBooking.status;
    if (updateData.status !== undefined) {
      const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(updateData.status)) {
        await releaseSlotMutationLock(beforeBooking._id, slotMutationLock.lock);
        slotMutationLock = null;
        return res.status(422).json({
          success: false,
          message: `Transición de estado no permitida: ${currentStatus} → ${updateData.status}.`,
          requestId: req.requestId,
        });
      }
    }
    if (
      scheduleChanged &&
      (SLOT_RELEASING_STATUSES.has(currentStatus) ||
        SLOT_RELEASING_STATUSES.has(updateData.status))
    ) {
      await releaseSlotMutationLock(beforeBooking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(422).json({
        success: false,
        message: "No se puede reprogramar una reserva finalizada o cancelada.",
        requestId: req.requestId,
      });
    }

    let slotStarts = null;
    let claimGeneration = Number(beforeBooking.scheduleRevision || 0);
    if (scheduleChanged) {
      claimGeneration += 1;
      const startTime = updateData.timeSlot !== undefined
        ? parseDateTimeInput(updateData.timeSlot)
        : new Date(beforeBooking.timeSlot);
      const requestedDuration = updateData.duration !== undefined
        ? Number(updateData.duration)
        : Number(beforeBooking.duration);
      const {
        error: slotError,
        schedule,
        durationMinutes,
        endTime,
      } = await validateConfiguredSlot(startTime, requestedDuration);
      if (slotError) {
        await releaseSlotMutationLock(beforeBooking._id, slotMutationLock.lock);
        slotMutationLock = null;
        return badRequest(res, slotError);
      }
      if (await hasConflict(startTime, endTime, beforeBooking._id, schedule)) {
        await releaseSlotMutationLock(beforeBooking._id, slotMutationLock.lock);
        slotMutationLock = null;
        return res.status(409).json({
          success: false,
          message: "El nuevo horario tiene conflicto con otra reserva activa.",
          requestId: req.requestId,
        });
      }

      updateData.timeSlot = startTime;
      updateData.endTime = endTime;
      updateData.duration = durationMinutes / 60;
      updateData.bufferBeforeMinutes = schedule.bufferBeforeMinutes;
      updateData.bufferAfterMinutes = schedule.bufferAfterMinutes;
      const claim = bufferedBounds(startTime, endTime, schedule);
      slotStarts = getBookingSlotStarts({
        startTime: claim.start,
        endTime: claim.end,
        slotDurationMinutes: schedule.slotDurationMinutes,
      });
      await renewSlotMutationLock(slotMutationLock);
      claimedSlots = await claimBookingSlots({
        bookingId: beforeBooking._id,
        slotStarts,
        slotDurationMinutes: schedule.slotDurationMinutes,
        claimGeneration,
      });
      await assertScheduleGridUnchanged(schedule.slotDurationMinutes);
    }

    await renewSlotMutationLock(slotMutationLock);

    const NOTE_FIELDS = ["notes", "studentEvolution", "emotionalState"];
    const historyPush = NOTE_FIELDS
      .filter((f) => updateData[f] !== undefined)
      .map((f) => ({ field: f, text: updateData[f], savedAt: new Date() }));

    const clientContentChanged = Object.entries(updateData).some(([field, value]) =>
      CLIENT_NOTIFICATION_CONTENT_FIELDS.has(field) && reminderValueChanged(beforeBooking[field], value));
    // Operational/admin-only fields (notes, evolution, emotional state and
    // price) must not invalidate mail already queued for the family.
    const notificationChanged = scheduleChanged || updateData.status !== undefined || clientContentChanged;
    const nextNotificationRevision = Number(beforeBooking.notificationRevision || 0) +
      (notificationChanged ? 1 : 0);
    const reminderChanged = Object.entries(updateData).some(([field, value]) =>
      REMINDER_RELEVANT_FIELDS.has(field) && reminderValueChanged(beforeBooking[field], value));
    const nextReminderRevision = Number(beforeBooking.reminderRevision || 0) + (reminderChanged ? 1 : 0);
    const nextScheduleRevision = Number(beforeBooking.scheduleRevision || 0) + (scheduleChanged ? 1 : 0);
    const mongoUpdate = {
      $set: { ...updateData },
      $inc: {
        ...(notificationChanged ? { notificationRevision: 1 } : {}),
        ...(reminderChanged ? { reminderRevision: 1 } : {}),
        ...(scheduleChanged ? { scheduleRevision: 1 } : {}),
      },
    };
    if (historyPush.length > 0) {
      mongoUpdate.$push = { notesHistory: { $each: historyPush } };
    }
    const finalStatus = updateData.status ?? currentStatus;
    const notificationType = updateData.status === "Cancelado"
      ? "booking_cancelled"
      : scheduleChanged
        ? "booking_rescheduled"
        : updateData.status === "Confirmado" && currentStatus !== "Confirmado"
          ? "booking_confirmation"
          : clientContentChanged && finalStatus === "Pendiente"
            ? "booking_pending_updated"
            : clientContentChanged && finalStatus === "Confirmado"
              ? "booking_confirmation"
              : null;
    const shouldQueueReminder = reminderChanged && finalStatus === "Confirmado";
    const hasNotificationIntent = Boolean(notificationType || shouldQueueReminder);
    const auditOperationId = crypto.randomUUID();
    if (hasNotificationIntent) {
      const notificationBooking = {
        ...beforeBooking,
        ...updateData,
        notificationRevision: nextNotificationRevision,
        reminderRevision: nextReminderRevision,
        scheduleRevision: nextScheduleRevision,
      };
      const notificationIntents = notificationType
        ? buildDurableBookingNotificationIntents({
          booking: notificationBooking,
          type: notificationType,
          previousTimeSlot: scheduleChanged ? beforeBooking.timeSlot : undefined,
          auditCommitOperationId: auditOperationId,
        })
        : buildBookingNotificationIntents({
          booking: notificationBooking,
          type: "booking_reminder",
          includeOwner: false,
          auditCommitOperationId: auditOperationId,
        });
      mongoUpdate.$push ||= {};
      mongoUpdate.$push.notificationIntents = { $each: notificationIntents };
    }
    const pendingAudit = buildPendingBookingAudit({
      req,
      action: scheduleChanged ? "booking.rescheduled" : "booking.updated",
      before: beforeBooking,
      after: {
        ...beforeBooking,
        ...updateData,
        notificationRevision: nextNotificationRevision,
        reminderRevision: nextReminderRevision,
        scheduleRevision: nextScheduleRevision,
      },
      operationId: auditOperationId,
    });
    mongoUpdate.$set.pendingAudit = pendingAudit;

    await renewSlotMutationLock(slotMutationLock);
    const updatedBooking = await Booking.findOneAndUpdate(
      ownedSlotMutationFilter(slotMutationLock),
      mongoUpdate,
      { new: true, runValidators: true },
    );
    if (updatedBooking) canReleaseClaimedSlotsOnFailure = false;

    if (!updatedBooking) {
      await releaseClaimedBookingSlots(claimedSlots);
      await releaseSlotMutationLock(slotMutationLock.booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: "La reserva cambio mientras era modificada. Reintenta.",
        requestId: req.requestId,
      });
    }

    try {
      await recordBookingAudit({
        req,
        action: scheduleChanged ? "booking.rescheduled" : "booking.updated",
        bookingId: updatedBooking._id,
        before: beforeBooking,
        after: updatedBooking,
        leaseExpiresAt: slotMutationLock.expiresAt,
        operationId: auditOperationId,
        pendingAudit,
      });
    } catch (auditError) {
      if (isAmbiguousAuditWriteError(auditError)) throw auditError;
      const fieldsToRestore = new Set([
        ...Object.keys(updateData),
        ...(historyPush.length > 0 ? ["notesHistory"] : []),
      ]);
      const set = {};
      const unset = {};
      for (const field of fieldsToRestore) {
        if (beforeBooking[field] === undefined) unset[field] = "";
        else set[field] = beforeBooking[field];
      }
      const compensationUpdate = {};
      if (Object.keys(set).length > 0) compensationUpdate.$set = set;
      if (Object.keys(unset).length > 0) compensationUpdate.$unset = unset;
      if (hasNotificationIntent) {
        compensationUpdate.$pull = {
          notificationIntents: { auditCommitOperationId: auditOperationId },
        };
      }
      compensationUpdate.$unset ||= {};
      compensationUpdate.$unset.pendingAudit = "";
      compensationUpdate.$inc = {
        ...(notificationChanged ? { notificationRevision: -1 } : {}),
        ...(reminderChanged ? { reminderRevision: -1 } : {}),
        ...(scheduleChanged ? { scheduleRevision: -1 } : {}),
      };
      const compensation = await compensateWithinOwnedLease({
        filter: {
          _id: updatedBooking._id,
          ...ACTIVE_BOOKING_FILTER,
          updatedAt: updatedBooking.updatedAt,
          slotMutationLock: slotMutationLock.lock,
        },
        update: compensationUpdate,
        leaseExpiresAt: slotMutationLock.expiresAt,
      });
      if (compensation.modifiedCount !== 1) {
        console.error("[audit-compensation]", JSON.stringify({
          event: "booking_update_audit_compensation_lost_lease",
          bookingId: String(updatedBooking._id),
          requestId: req.requestId,
        }));
      } else {
        canReleaseClaimedSlotsOnFailure = true;
      }
      throw auditError;
    }

    await renewSlotMutationLock(slotMutationLock);
    if (SLOT_RELEASING_STATUSES.has(updateData.status)) {
      await releaseBookingSlots(updatedBooking._id, nextScheduleRevision);
    } else if (slotStarts) {
      await releaseBookingSlotsExcept(updatedBooking._id, slotStarts, claimGeneration);
    }
    claimedSlots = null;
    await Booking.collection.updateOne(
      { _id: updatedBooking._id, "pendingAudit.operationId": auditOperationId },
      { $unset: { pendingAudit: "" } },
    );
    await releaseSlotMutationLock(updatedBooking._id, slotMutationLock.lock);
    slotMutationLock = null;

    if (hasNotificationIntent) await reconcileBookingNotifications(updatedBooking._id);

    setNoStore(res);
    res.status(200).json({
      success: true,
      data: adminBooking(updatedBooking),
      requestId: req.requestId,
    });

    updateBookingInSheet(updatedBooking).catch(
      (error) => console.error("[admin-update sheet]", error),
    );
  } catch (error) {
    if (canReleaseClaimedSlotsOnFailure) {
      await releaseClaimedBookingSlots(claimedSlots).catch(() => {});
    }
    if (slotMutationLock) {
      await releaseSlotMutationLock(slotMutationLock.booking._id, slotMutationLock.lock)
        .catch(() => {});
    }

    if (error instanceof ScheduleGridChangedError) {
      return scheduleGridChangedResponse(res, req.requestId);
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
    const attendanceUpdate = {
      attendanceStatus: parsed.data.attendanceStatus,
      attendanceRecordedAt,
      attendanceNotes,
      attendanceUpdatedBy: req.user.id,
    };
    const auditOperationId = crypto.randomUUID();
    const pendingAudit = buildPendingBookingAudit({
      req,
      action: "booking.attendance.updated",
      before: beforeAttendance,
      after: { ...beforeAttendance, ...attendanceUpdate },
      operationId: auditOperationId,
    });
    const updatedBooking = await Booking.findOneAndUpdate(
      {
        ...ownedSlotMutationFilter(slotMutationLock),
        ...ACTIVE_BOOKING_FILTER,
      },
      {
        $set: {
          ...attendanceUpdate,
          pendingAudit,
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
        operationId: auditOperationId,
        pendingAudit,
      });
    } catch (auditError) {
      if (isAmbiguousAuditWriteError(auditError)) throw auditError;
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
          $unset: { pendingAudit: "" },
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

    await Booking.collection.updateOne(
      { _id: updatedBooking._id, "pendingAudit.operationId": auditOperationId },
      { $unset: { pendingAudit: "" } },
    );
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
    const auditOperationId = crypto.randomUUID();
    const pendingAudit = buildPendingBookingAudit({
      req,
      action: "booking.deleted",
      before: beforeDeletion,
      after: {
        ...beforeDeletion.toObject(),
        deletedAt,
        deletedBy: req.user.id,
        notificationRevision: Number(beforeDeletion.notificationRevision || 0) + 1,
        reminderRevision: Number(beforeDeletion.reminderRevision || 0) + 1,
      },
      operationId: auditOperationId,
    });
    const deletedBooking = await Booking.findOneAndUpdate(
      {
        ...ownedSlotMutationFilter(slotMutationLock),
        ...ACTIVE_BOOKING_FILTER,
      },
      {
        $set: { deletedAt, deletedBy: req.user.id, pendingAudit },
        $inc: { notificationRevision: 1, reminderRevision: 1 },
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
        operationId: auditOperationId,
        pendingAudit,
      });
    } catch (auditError) {
      if (isAmbiguousAuditWriteError(auditError)) throw auditError;
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
        update: {
          $set: { deletedAt: null, deletedBy: null },
          $unset: { pendingAudit: "" },
          $inc: { notificationRevision: -1, reminderRevision: -1 },
        },
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
    await Booking.collection.updateOne(
      { _id: deletedBooking._id, "pendingAudit.operationId": auditOperationId },
      { $unset: { pendingAudit: "" } },
    );
    await renewSlotMutationLock(slotMutationLock);
    await releaseBookingSlots(deletedBooking._id, deletedBooking.scheduleRevision);
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
    const storedDuration = Number(trashedBooking.duration) || 1;
    const {
      error: slotError,
      schedule,
      durationMinutes,
      endTime,
    } = await validateConfiguredSlot(startTime, storedDuration);
    if (slotError) {
      await releaseSlotMutationLock(trashedBooking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: `No se puede restaurar en su horario original: ${slotError}`,
        requestId: req.requestId,
      });
    }

    const duration = durationMinutes / 60;
    const restoredBuffers = {
      bufferBeforeMinutes: trashedBooking.bufferBeforeMinutes || 0,
      bufferAfterMinutes: trashedBooking.bufferAfterMinutes || 0,
    };
    if (await hasConflict(
      startTime,
      endTime,
      trashedBooking._id,
      restoredBuffers,
    )) {
      await releaseSlotMutationLock(trashedBooking._id, slotMutationLock.lock);
      slotMutationLock = null;
      return res.status(409).json({
        success: false,
        message: "El horario original ya esta ocupado.",
        requestId: req.requestId,
      });
    }

    const restoredClaim = bufferedBounds(startTime, endTime, restoredBuffers);
    const slotStarts = getBookingSlotStarts({
      startTime: restoredClaim.start,
      endTime: restoredClaim.end,
      slotDurationMinutes: schedule.slotDurationMinutes,
    });
    const claimGeneration = Number(trashedBooking.scheduleRevision || 0) + 1;
    await renewSlotMutationLock(slotMutationLock);
    claimedSlots = await claimBookingSlots({
      bookingId: trashedBooking._id,
      slotStarts,
      slotDurationMinutes: schedule.slotDurationMinutes,
      claimGeneration,
    });
    await assertScheduleGridUnchanged(schedule.slotDurationMinutes);
    await renewSlotMutationLock(slotMutationLock);

    const restoredStudentLink = !trashedBooking.studentId ? {
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
    } : trashedBooking.studentLink;
    const auditOperationId = crypto.randomUUID();
    const pendingAudit = buildPendingBookingAudit({
      req,
      action: "booking.restored",
      before: trashedBooking,
      after: {
        ...trashedBooking.toObject(),
        deletedAt: null,
        deletedBy: null,
        studentLink: restoredStudentLink,
        notificationRevision: Number(trashedBooking.notificationRevision || 0) + 1,
        reminderRevision: Number(trashedBooking.reminderRevision || 0) + 1,
        scheduleRevision: claimGeneration,
      },
      operationId: auditOperationId,
    });

    await renewSlotMutationLock(slotMutationLock);
    const restoredBooking = await Booking.findOneAndUpdate(
      {
        ...ownedSlotMutationFilter(slotMutationLock),
        ...TRASHED_BOOKING_FILTER,
      },
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
          ...(!trashedBooking.studentId ? { studentLink: restoredStudentLink } : {}),
          pendingAudit,
        },
        $inc: { notificationRevision: 1, reminderRevision: 1, scheduleRevision: 1 },
      },
      { new: true, runValidators: true },
    );
    if (!restoredBooking) {
      await releaseClaimedBookingSlots(claimedSlots);
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
        operationId: auditOperationId,
        pendingAudit,
      });
    } catch (auditError) {
      if (isAmbiguousAuditWriteError(auditError)) throw auditError;
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
          $unset: { pendingAudit: "" },
          $inc: { notificationRevision: -1, reminderRevision: -1, scheduleRevision: -1 },
        },
        leaseExpiresAt: slotMutationLock.expiresAt,
      });
      if (compensation.modifiedCount === 1) {
        await releaseBookingSlots(restoredBooking._id, claimGeneration);
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
    await renewSlotMutationLock(slotMutationLock);
    await releaseBookingSlotsExcept(restoredBooking._id, slotStarts, claimGeneration);
    await Booking.collection.updateOne(
      { _id: restoredBooking._id, "pendingAudit.operationId": auditOperationId },
      { $unset: { pendingAudit: "" } },
    );
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
    await releaseClaimedBookingSlots(claimedSlots).catch(() => {});
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

    if (error instanceof ScheduleGridChangedError) {
      return scheduleGridChangedResponse(res, req.requestId);
    }

    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const deleteAllBookings = async (req, res) => {
  setNoStore(res);
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({
    success: false,
    code: "BULK_DELETE_DISABLED",
    message: "La eliminacion masiva esta deshabilitada. Usa la papelera auditada por reserva.",
    requestId: req.requestId,
  });
};

export const requestManagementLink = async (req, res, next) => {
  try {
    const bookingCode = normalizeCode(req.body?.bookingCode);
    const email = normalizeEmail(req.body?.email);
    // Crucially, this request path never queries Booking. Known and unknown
    // identities perform the same normalization, HMAC, encryption and durable
    // upsert before receiving the same response. Resolution happens later in a
    // background worker.
    if (BOOKING_CODE_PATTERN.test(bookingCode) && email) {
      await enqueueBlindManagementLinkRequest({ bookingCode, email });
    }
  } catch (error) {
    console.error("[management-link request] request could not be completed", {
      requestId: req.requestId,
    });
  }
  return res.status(202).json({
    success: true,
    message: "Si los datos coinciden con una reserva, vas a recibir un enlace seguro por email.",
  });
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

/* ── Portal: entrar con el código de reserva ────────────────────────────────
   Reemplaza al flujo de "pedí un enlace y buscalo en tu correo". La decisión de
   producto es que el código alcanza: son 6 caracteres sobre un alfabeto de 31
   sin ambiguos (887 millones de combinaciones) generados con crypto.randomInt,
   y sólo lo tiene quien reservó.

   No se inventa un mecanismo de sesión nuevo: se emite el MISMO token de
   gestión que hasta ahora viajaba por mail, con su expiración y su revocación.
   Así reprogramar y cancelar siguen funcionando sin tocarse, y todo lo que ya
   estaba probado sobre ese token sigue valiendo.

   Dos cuidados, porque el código pasó a ser la única llave:
   · el endpoint tiene su propio limitador, más estricto que el resto;
   · la respuesta a un código que no existe es idéntica a la de uno mal
     formado, para no confirmar cuáles existen. */
export const createPortalSession = async (req, res, next) => {
  try {
    const bookingCode = normalizeCode(req.body?.bookingCode);
    if (!BOOKING_CODE_PATTERN.test(bookingCode)) {
      return unauthorizedManagementLink(res);
    }

    const booking = await Booking.findOne(
      withActiveBooking({ bookingCode }),
    ).exec();
    if (!booking) return unauthorizedManagementLink(res);

    const { managementToken } = issueManagementToken(booking);
    await booking.save();

    setNoStore(res);
    /* Sólo el token: los datos se piden después CON el token. Si viajaran acá,
       un código adivinado devolvería la ficha completa en el mismo golpe. */
    return res.status(200).json({
      success: true,
      data: { managementToken },
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

/* Historial completo del titular: todos los turnos que comparten el email de
   la reserva con la que entró. Incluye los pasados y los cancelados —el pedido
   es ver el historial, no sólo lo que viene— y cada uno viene marcado para que
   el frontend no tenga que recalcular contra el reloj del navegador. */
export const getPortalHistory = async (req, res, next) => {
  try {
    const booking = await findManagedBooking(req);
    if (!booking) return unauthorizedManagementLink(res);

    const bookings = await Booking.find(
      trustedFilter({ email: booking.email }),
    )
      .sort({ timeSlot: 1 })
      .exec();

    const ahora = Date.now();
    setNoStore(res);
    return res.status(200).json({
      success: true,
      data: {
        current: booking.bookingCode,
        bookings: bookings.map((b) => ({
          ...managedBooking(b),
          isPast: new Date(b.timeSlot).getTime() < ahora,
        })),
      },
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
  let slotMutationLock = null;
  try {
    const booking = await findManagedBooking(req);
    if (!booking) return unauthorizedManagementLink(res);

    slotMutationLock = await acquireSlotMutationLock(booking._id, {
      ...ACTIVE_BOOKING_FILTER,
      managementTokenHash: hashManagementToken(getManagementToken(req)),
      managementTokenRevokedAt: null,
      managementTokenExpiresAt: { $gt: new Date() },
    });
    if (!slotMutationLock) {
      return res.status(409).json({
        success: false,
        message: "La reserva está siendo actualizada. Reintentá.",
        requestId: req.requestId,
      });
    }
    const revoked = await Booking.findOneAndUpdate(
      ownedSlotMutationFilter(slotMutationLock),
      {
        $set: { managementTokenRevokedAt: new Date() },
        $inc: { notificationRevision: 1 },
      },
      { new: true },
    );
    if (!revoked) throw new Error("Management-token revocation lost its mutation lease.");
    await releaseSlotMutationLock(booking._id, slotMutationLock.lock);
    slotMutationLock = null;
    setNoStore(res);
    return res.status(204).send();
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  } finally {
    if (slotMutationLock) {
      await releaseSlotMutationLock(slotMutationLock.booking._id, slotMutationLock.lock)
        .catch(() => {});
    }
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
    const requestedDuration = Number(parsed.data.newDuration);
    const {
      error: slotError,
      schedule,
      durationMinutes,
      endTime,
    } = await validateConfiguredSlot(startTime, requestedDuration);
    if (slotError) {
      return badRequest(res, slotError);
    }
    const { slotDurationMinutes } = schedule;
    const duration = durationMinutes / 60;
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
    const conflict = await hasConflict(
      startTime,
      endTime,
      booking._id,
      schedule,
    );
    if (conflict) {
      await releaseSlotMutationLock(booking._id, slotMutationLock.lock);
      slotMutationLock = null;
      if (idempotencyRecord) {
        await IdempotencyKey.deleteOne({ _id: idempotencyRecord._id });
      }
      return badRequest(res, "Horario ocupado.");
    }

    const previousTimeSlot = lockedBooking.timeSlot;
    const claim = bufferedBounds(startTime, endTime, schedule);
    const slotStarts = getBookingSlotStarts({
      startTime: claim.start,
      endTime: claim.end,
      slotDurationMinutes,
    });
    const claimGeneration = Number(lockedBooking.scheduleRevision || 0) + 1;
    await renewSlotMutationLock(slotMutationLock);
    claimedSlots = await claimBookingSlots({
      bookingId: lockedBooking._id,
      slotStarts,
      slotDurationMinutes,
      claimGeneration,
    });
    await assertScheduleGridUnchanged(slotDurationMinutes);
    await renewSlotMutationLock(slotMutationLock);

    const rescheduledNotificationIntents = buildDurableBookingNotificationIntents({
      booking: {
        ...lockedBooking.toObject(),
        timeSlot: startTime,
        endTime,
        duration,
        status: "Confirmado",
        notificationRevision: Number(lockedBooking.notificationRevision || 0) + 1,
        reminderRevision: Number(lockedBooking.reminderRevision || 0) + 1,
        scheduleRevision: Number(lockedBooking.scheduleRevision || 0) + 1,
      },
      type: "booking_rescheduled",
      previousTimeSlot,
    });

    await renewSlotMutationLock(slotMutationLock);
    /* Si la duración cambió, el precio se recalcula con la tarifa que se le
       cotizó a esta persona, no con la actual: mover un horario no puede
       encarecerle el turno porque el profesor subió los valores en el medio.
       Devuelve null —y no se toca el precio— cuando la duración es la misma o
       cuando la reserva no tiene tarifa guardada. */
    const repricing = repricingForReschedule({
      booking: slotMutationLock.booking,
      nuevaDuracion: duration,
    });
    lockedBooking = await Booking.findOneAndUpdate(
      ownedSlotMutationFilter(slotMutationLock),
      {
        $set: {
          timeSlot: startTime,
          endTime,
          duration,
          bufferBeforeMinutes: schedule.bufferBeforeMinutes,
          bufferAfterMinutes: schedule.bufferAfterMinutes,
          status: "Confirmado",
          ...(repricing ?? {}),
        },
        $push: { notificationIntents: { $each: rescheduledNotificationIntents } },
        $inc: { notificationRevision: 1, reminderRevision: 1, scheduleRevision: 1 },
      },
      { new: true, runValidators: true },
    );
    if (!lockedBooking) {
      await releaseClaimedBookingSlots(claimedSlots);
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
    await renewSlotMutationLock(slotMutationLock);
    await releaseBookingSlotsExcept(lockedBooking._id, slotStarts, claimGeneration);
    claimedSlots = null;
    await releaseSlotMutationLock(lockedBooking._id, slotMutationLock.lock);
    slotMutationLock = null;

    const responseBody = {
      success: true,
      message: "Turno reprogramado.",
      data: publicBooking(lockedBooking),
      notifications: null,
      requestId: req.requestId,
    };
    await reconcileBookingNotifications(lockedBooking._id);
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
    ]).catch((err) => console.error("[rescheduleBooking side-effects]", err.message));
  } catch (error) {
    await releaseClaimedBookingSlots(claimedSlots).catch(() => {});
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

    if (error instanceof ScheduleGridChangedError) {
      return scheduleGridChangedResponse(res, req.requestId);
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

    const cancellationNotificationIntents = buildDurableBookingNotificationIntents({
      booking: {
        ...slotMutationLock.booking.toObject(),
        status: "Cancelado",
        notificationRevision: Number(slotMutationLock.booking.notificationRevision || 0) + 1,
        reminderRevision: Number(slotMutationLock.booking.reminderRevision || 0) + 1,
      },
      type: "booking_cancelled",
    });
    const cancelledBooking = await Booking.findOneAndUpdate(
      ownedSlotMutationFilter(slotMutationLock),
      {
        $set: {
          status: "Cancelado",
        },
        $push: { notificationIntents: { $each: cancellationNotificationIntents } },
        $inc: { notificationRevision: 1, reminderRevision: 1 },
      },
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

    await renewSlotMutationLock(slotMutationLock);
    await releaseBookingSlots(cancelledBooking._id, cancelledBooking.scheduleRevision);
    await releaseSlotMutationLock(cancelledBooking._id, slotMutationLock.lock);
    slotMutationLock = null;

    await reconcileBookingNotifications(cancelledBooking._id);

    res.status(200).json({
      success: true,
      message: "Turno cancelado.",
      data: publicBooking(cancelledBooking),
      notifications: null,
      requestId: req.requestId,
    });

    Promise.allSettled([
      updateBookingInSheet(cancelledBooking),
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

    const confirmationNotificationIntents = buildDurableBookingNotificationIntents({
      booking: {
        ...lockedBooking.toObject(),
        status: "Confirmado",
        notificationRevision: Number(lockedBooking.notificationRevision || 0) + 1,
        reminderRevision: Number(lockedBooking.reminderRevision || 0) + 1,
      },
      type: "booking_confirmation",
    });
    const confirmedBooking = await Booking.findOneAndUpdate(
      ownedSlotMutationFilter(slotMutationLock),
      {
        $set: {
          status: "Confirmado",
        },
        $push: { notificationIntents: { $each: confirmationNotificationIntents } },
        $inc: { notificationRevision: 1, reminderRevision: 1 },
      },
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
    await reconcileBookingNotifications(confirmedBooking._id);

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

/* ─────────────────────────────────────────────────────────────────────────────
   Resumen de una serie por email.

   Las clases de una serie no mandan confirmación individual, así que este endpoint
   es el que le da a la persona el registro durable de sus 8 fechas y sus 8
   códigos. Lo llama el wizard al terminar el bucle de reservas.

   AUTORIZACIÓN: el seriesId AGRUPA y NO autoriza. Sin el chequeo de que el token
   pertenece a una reserva DE ESA serie, cualquiera con un token propio podría
   pedir el resumen —o sea, las fechas y los códigos— de la serie de otra persona
   pasando su seriesId. Por eso se exige el token y además se compara la serie.
   ──────────────────────────────────────────────────────────────────────────── */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Fecha y hora en la zona del negocio, no en la del servidor: Render corre en UTC
   y sin fijar la zona el email diría un día distinto para las clases de la noche. */
const SERIES_TZ = "America/Argentina/Buenos_Aires";

/* Con AÑO. Un email se guarda y se vuelve a leer: "miércoles 12 de agosto" no dice
   nada dentro de seis meses, ni cuando la casilla tiene clases de dos años. */
const fechaLegible = (fecha) =>
  new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SERIES_TZ,
  }).format(new Date(fecha));

const horaLegible = (fecha) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SERIES_TZ,
  }).format(new Date(fecha));

/* "1 hora", "1 h 30", "2 horas". La duración se dice en palabras además del rango
   porque una clase puede ser de media hora o de tres, y restar dos horarios
   mentalmente es trabajo que el email puede ahorrar. */
const duracionLegible = (horas) => {
  const n = Number(horas);
  if (!Number.isFinite(n) || n <= 0) return "";
  const enteras = Math.floor(n);
  const minutos = Math.round((n - enteras) * 60);
  if (enteras === 0) return `${minutos} min`;
  const parteHoras = enteras === 1 ? "1 hora" : `${enteras} horas`;
  return minutos > 0 ? `${parteHoras} ${minutos} min` : parteHoras;
};

/* El fin se calcula desde endTime si está, y si no desde la duración: las reservas
   viejas pueden no tener endTime y el email no puede quedar sin hora de fin. */
const finDeClase = (booking) => {
  if (booking.endTime) return new Date(booking.endTime);
  const horas = Number(booking.duration) || 1;
  return new Date(new Date(booking.timeSlot).getTime() + horas * 3600000);
};

export const sendSeriesSummaryEmail = async (req, res, next) => {
  try {
    const seriesId = String(req.body?.seriesId ?? "").trim();
    if (!UUID_PATTERN.test(seriesId)) {
      return badRequest(res, "Identificador de serie inválido.");
    }

    // 401 si el token no vale; el helper ya distingue ese caso.
    const booking = await findManagedBooking(req);
    if (!booking) return unauthorizedManagementLink(res);

    /* 403 y no 404: el token es válido —está autenticado— pero no tiene permiso
       sobre esta serie. Y con el mismo 403 para "no es tu serie" y "la serie no
       existe", que si no se podría averiguar qué seriesId existen probando. */
    if (!booking.seriesId || booking.seriesId !== seriesId) {
      return res.status(403).json({
        success: false,
        message: "Este acceso no corresponde a esa serie de clases.",
        requestId: req.requestId,
      });
    }

    /* Se lista lo que EXISTE, no lo que se intentó: si una semana estaba ocupada o
       ya se canceló, prometer 8 y mandar 6 es peor que decir 6. */
    const clases = await Booking.find(
      trustedFilter({ seriesId, status: { $in: ["Confirmado", "Pendiente"] } }),
    )
      .sort({ timeSlot: 1 })
      .lean();

    if (clases.length === 0) {
      return res.status(409).json({
        success: false,
        message: "Esa serie no tiene clases activas para resumir.",
        requestId: req.requestId,
      });
    }

    const destinatario = String(booking.email ?? "").trim();
    if (!destinatario) {
      /* Sin email no hay a dónde mandarlo. No es un error de la persona: el email
         es opcional al reservar, y el comprobante en pantalla ya tiene los códigos. */
      return res.status(200).json({
        success: true,
        message: "La serie quedó reservada. No hay email para enviar el resumen.",
        data: { clases: clases.length, enviado: false },
        requestId: req.requestId,
      });
    }

    /* El envío va en su propio try: las clases YA están reservadas, así que un
       fallo de correo no puede presentarse como si la reserva hubiera fallado.
       Antes el catch de abajo filtraba por /correo/ en el mensaje y cualquier otro
       error de nodemailer —"Missing credentials", por ejemplo— terminaba en un 500
       genérico en lugar del 502 que explica qué pasó de verdad. */
    try {
      await sendSeriesSummary({
      to: destinatario,
      greetingName: booking.responsibleName || booking.studentName || "Hola",
      studentName: booking.studentName,
      subject: booking.subject,
      modality: booking.modality,
      address: process.env.TEACHER_ADDRESS || "Jujuy 414, Temperley, Buenos Aires",
      managePortalUrl: "https://turnos.tuprofesorparticular.com.ar/portal",
      clases: clases.map((c) => ({
        fecha: fechaLegible(c.timeSlot),
        desde: horaLegible(c.timeSlot),
        hasta: horaLegible(finDeClase(c)),
        duracion: duracionLegible(c.duration),
        code: c.bookingCode,
      })),
      });
    } catch (errorDeEnvio) {
      console.error("[series-summary]", errorDeEnvio.message);
      setNoStore(res);
      return res.status(502).json({
        success: false,
        message:
          "Las clases quedaron reservadas, pero no pudimos enviar el resumen por email.",
        data: { clases: clases.length, enviado: false },
        requestId: req.requestId,
      });
    }

    setNoStore(res);
    /* La respuesta NO devuelve los códigos: el wizard ya los tiene de las reservas
       que hizo, y ponerlos acá los expondría a cualquier registro de red sin
       ninguna necesidad. */
    return res.status(200).json({
      success: true,
      message: "Te mandamos un resumen con todas las clases.",
      data: { clases: clases.length, enviado: true },
      requestId: req.requestId,
    });
  } catch (error) {
    /* Acá solo llegan errores que NO son del envío —el envío tiene su propio
       catch—, o sea problemas de la base o bugs nuestros. Esos van al manejador
       general, que es el que sabe qué loguear y qué no exponer. */
    console.error("[series-summary]", error.message);
    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};
