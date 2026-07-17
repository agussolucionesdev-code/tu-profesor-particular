import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  ATTENDANCE_STATUS,
  BOOKING_MODALITY,
  DEFAULT_BOOKING_MODALITY,
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
  RESPONSIBLE_RELATIONSHIP_VALUES,
  normalizeCode,
  normalizeEmail,
  normalizeModality,
  normalizePhone,
} from "../utils/bookingRules.js";

const BOOKING_STATUS = ["Confirmado", "Pendiente", "Cancelado", "Finalizado"];
const BOOKING_CODE_CHARACTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const BOOKING_CODE_LENGTH = 6;
const PENDING_AUDIT_MAX_BYTES = 64 * 1024;

const pendingAuditActorSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    role: { type: String, required: true, maxlength: 40 },
    username: { type: String, required: true, maxlength: 160 },
  },
  { _id: false },
);

const pendingAuditMetaSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, maxlength: 100 },
    entityType: { type: String, required: true, enum: ["Booking"], default: "Booking" },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const pendingAuditSchema = new mongoose.Schema(
  {
    operationId: { type: String, required: true, maxlength: 80 },
    actor: { type: pendingAuditActorSchema, required: true },
    action: {
      type: String,
      required: true,
      enum: [
        "booking.created",
        "booking.updated",
        "booking.rescheduled",
        "booking.attendance.updated",
        "booking.deleted",
        "booking.restored",
      ],
    },
    before: { type: mongoose.Schema.Types.Mixed, required: true },
    after: { type: mongoose.Schema.Types.Mixed, required: true },
    meta: { type: pendingAuditMetaSchema, required: true },
  },
  { _id: false, strict: "throw", minimize: false },
);

pendingAuditSchema.path("operationId").validate(function boundedPendingAudit() {
  const value = this?.toObject?.({ depopulate: true }) ?? this;
  return Buffer.byteLength(JSON.stringify(value), "utf8") <= PENDING_AUDIT_MAX_BYTES;
}, `La auditoria pendiente no puede superar ${PENDING_AUDIT_MAX_BYTES} bytes.`);

const notificationIntentSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, maxlength: 64 },
    dedupeKey: { type: String, required: true, maxlength: 64 },
    type: {
      type: String,
      enum: [
        "booking_confirmation",
        "booking_received_pending",
        "booking_pending_updated",
        "booking_rescheduled",
        "booking_cancelled",
        "booking_reminder",
        "management_link_requested",
      ],
      required: true,
    },
    channel: { type: String, enum: ["email"], default: "email" },
    recipientKind: { type: String, enum: ["client", "owner"], required: true },
    recipientMasked: { type: String, required: true, maxlength: 200 },
    managementTokenFingerprint: { type: String, default: null, maxlength: 64 },
    templateVersion: { type: Number, required: true, default: 1 },
    payloadCiphertext: { type: String, required: true },
    payloadIv: { type: String, required: true },
    payloadAuthTag: { type: String, required: true },
    encryptionKeyVersion: { type: String, required: true, maxlength: 40 },
    scheduledFor: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    maxAttempts: { type: Number, default: 5, min: 1, max: 20 },
    occurredAt: { type: Date, default: Date.now },
    auditCommitOperationId: { type: String, default: null, maxlength: 80 },
    bookingRevision: { type: Number, default: 0, min: 0 },
    reminderRevision: { type: Number, default: 0, min: 0 },
    scheduleRevision: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const hasValidPhoneDigits = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

const looksLikeEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());

const generateBookingCode = () =>
  Array.from({ length: BOOKING_CODE_LENGTH }, () =>
    BOOKING_CODE_CHARACTERS.charAt(
      crypto.randomInt(0, BOOKING_CODE_CHARACTERS.length),
    ),
  ).join("");

const bookingSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    responsibleName: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    responsibleRelationship: {
      type: String,
      enum: RESPONSIBLE_RELATIONSHIP_VALUES,
      required: true,
      default: "self",
    },
    responsibleRelationshipOther: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    tutorName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
      default: "Agustin",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 30,
      set: normalizePhone,
      validate: {
        validator: (value) => !value || hasValidPhoneDigits(value),
        message: "El teléfono debe tener entre 8 y 15 dígitos.",
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 160,
      set: normalizeEmail,
      validate: {
        validator: (value) => !value || looksLikeEmail(value),
        message: "El email ingresado no es válido.",
      },
    },

    school: { type: String, trim: true, default: "", maxlength: 120 },
    educationLevel: { type: String, required: true, trim: true, maxlength: 60 },
    yearGrade: { type: String, required: true, trim: true, maxlength: 60 },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    // Enum y no texto libre: la modalidad decide si el mail lleva el enlace de
    // la clase o la direccion, y el panel filtra por ella. El default mantiene
    // validas las reservas anteriores a este campo.
    modality: {
      type: String,
      enum: BOOKING_MODALITY,
      default: DEFAULT_BOOKING_MODALITY,
      required: true,
      set: (value) =>
        value === undefined || value === null ? value : normalizeModality(value),
    },
    academicSituation: { type: String, trim: true, default: "", maxlength: 1200 },

    timeSlot: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true, index: true },
    duration: { type: Number, required: true, default: 1, min: 0.5, max: 10 },
    // Frozen scheduling buffers keep historical slot claims stable even when
    // the global availability policy changes later.
    bufferBeforeMinutes: { type: Number, default: 0, min: 0, max: 240 },
    bufferAfterMinutes: { type: Number, default: 0, min: 0, max: 240 },

    price: { type: Number, default: 0, min: 0, max: 99999999 },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
    studentNotes: { type: String, trim: true, default: "", maxlength: 500 },
    studentEvolution: { type: String, trim: true, default: "", maxlength: 5000 },
    emotionalState: { type: String, trim: true, default: "", maxlength: 1000 },
    notesHistory: {
      type: [
        {
          field: { type: String, enum: ["notes", "studentEvolution", "emotionalState"] },
          text: { type: String, maxlength: 5000 },
          savedAt: { type: Date, default: Date.now },
          _id: false,
        },
      ],
      default: [],
    },

    bookingCode: {
      type: String,
      unique: true,
      uppercase: true,
      immutable: true,
      minlength: 6,
      maxlength: 12,
      set: normalizeCode,
    },

    managementTokenHash: {
      type: String,
      select: false,
      minlength: 64,
      maxlength: 64,
    },
    managementTokenExpiresAt: { type: Date, default: null },
    managementTokenRevokedAt: { type: Date, default: null },
    managementLinkLastSentAt: { type: Date, default: null, select: false },
    managementLinkRequestLock: { type: String, default: null, select: false, maxlength: 80 },
    managementLinkRequestLockExpiresAt: { type: Date, default: null, select: false },
    managementTokenDeliveryLock: { type: String, default: null, select: false, maxlength: 100 },
    managementTokenDeliveryLockOutbox: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      select: false,
    },
    managementTokenDeliveryLockFingerprint: { type: String, default: null, select: false, maxlength: 64 },
    managementTokenDeliveryLockExpiresAt: { type: Date, default: null, select: false },
    notificationDeliveryFence: {
      type: new mongoose.Schema(
        {
          outboxId: { type: mongoose.Schema.Types.ObjectId, required: true },
          revision: { type: Number, required: true, min: 0 },
          fingerprint: { type: String, default: null, maxlength: 64 },
          owner: { type: String, required: true, maxlength: 100 },
          expiresAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
      select: false,
    },
    managementTokenSupersessionPending: {
      type: new mongoose.Schema(
        {
          fingerprint: { type: String, required: true, maxlength: 64 },
          tokenExpired: { type: Boolean, default: false },
          tokenInactive: { type: Boolean, default: false },
          requestKey: { type: String, required: true, maxlength: 64 },
          createdAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
      select: false,
    },
    notificationRevision: { type: Number, default: 0, min: 0 },
    // Reminder freshness is intentionally independent from management-token
    // rotation. Only reminder-visible content, recipient/schedule, or an
    // invalidating lifecycle transition advances this generation.
    reminderRevision: { type: Number, default: 0, min: 0 },
    scheduleRevision: { type: Number, default: 0, min: 0 },

    // Creation is a durable, fenced state. Persisting the draft before slot
    // claims means a claim never has an absent owner; an expired creator can
    // be abandoned atomically without allowing it to commit afterwards.
    creationState: {
      type: String,
      enum: ["claiming", "active", "abandoned"],
      default: "active",
      select: false,
    },

    // Short-lived ownership lock for operations that need to replace multiple
    // BookingSlot documents without allowing another reprogramming request to
    // release claims it did not create.
    slotMutationLock: { type: String, default: null, select: false },
    slotMutationLockExpiresAt: { type: Date, default: null, select: false },

    status: {
      type: String,
      enum: BOOKING_STATUS,
      default: "Pendiente",
    },
    attendanceStatus: {
      type: String,
      enum: ATTENDANCE_STATUS,
      default: "Sin registrar",
    },
    attendanceRecordedAt: { type: Date, default: null },
    attendanceNotes: { type: String, trim: true, default: "", maxlength: 1000 },
    attendanceUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // The original identity/contact fields above are an immutable historical
    // snapshot. Student updates never cascade back into a Booking.
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
    studentLink: {
      type: new mongoose.Schema(
        {
          status: {
            type: String,
            enum: ["pending", "linked", "review", "failed"],
            required: true,
          },
          source: { type: String, enum: ["booking", "migration", "repair"], required: true },
          algorithmVersion: { type: String, required: true, maxlength: 40 },
          runId: { type: String, trim: true, default: null, maxlength: 100 },
          linkedAt: { type: Date, default: null },
          lastAttemptAt: { type: Date, required: true },
          candidateIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
          errorCode: { type: String, trim: true, default: "", maxlength: 80 },
          attempts: { type: Number, default: 0, min: 0 },
          nextAttemptAt: { type: Date, default: Date.now },
          leaseId: { type: String, default: null, maxlength: 80 },
          leaseExpiresAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    notificationIntents: {
      type: [notificationIntentSchema],
      default: [],
      select: false,
    },
    pendingAudit: {
      type: pendingAuditSchema,
      default: null,
      select: false,
    },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

bookingSchema.pre("validate", async function validateBookingDocument() {
  if (this.responsibleRelationship !== RESPONSIBLE_RELATIONSHIP_OTHER_VALUE) {
    this.responsibleRelationshipOther = "";
  }

  if (!this.email && !this.phone) {
    this.invalidate(
      "phone",
      "Debes ingresar al menos un método de contacto: email o teléfono.",
    );
  }

  if (
    this.responsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE &&
    this.responsibleRelationshipOther.trim().length < 3
  ) {
    this.invalidate(
      "responsibleRelationshipOther",
      "Debes indicar cuál es el vínculo cuando eliges Otro.",
    );
  }

  if (this.timeSlot && this.endTime && this.endTime <= this.timeSlot) {
    this.invalidate("endTime", "La finalización del turno debe ser posterior al inicio.");
  }

  if (!this.isNew || this.bookingCode) {
    return;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateBookingCode();
    const exists = await this.constructor.exists({ bookingCode: candidate });

    if (!exists) {
      this.bookingCode = candidate;
      return;
    }
  }

  throw new Error("No se pudo generar un código de reserva único.");
});

bookingSchema.index({ timeSlot: 1, status: 1 });
bookingSchema.index({ status: 1, timeSlot: 1, endTime: 1 }); // for hasConflict + getAvailability
bookingSchema.index({ deletedAt: 1, timeSlot: -1 });
bookingSchema.index({ deletedAt: 1, status: 1, timeSlot: 1, _id: 1 });
bookingSchema.index({ email: 1 });
bookingSchema.index({ phone: 1 });
bookingSchema.index({ studentId: 1, timeSlot: -1 });
bookingSchema.index({ "studentLink.runId": 1 });
bookingSchema.index(
  { managementTokenHash: 1 },
  { unique: true, sparse: true },
);
bookingSchema.index(
  { "notificationIntents.managementTokenFingerprint": 1 },
  {
    name: "notificationIntents_managementTokenFingerprint_active",
    partialFilterExpression: {
      "notificationIntents.managementTokenFingerprint": { $type: "string" },
    },
  },
);
bookingSchema.index(
  { "pendingAudit.operationId": 1 },
  {
    name: "pendingAudit_operationId_recovery",
    partialFilterExpression: { "pendingAudit.operationId": { $type: "string" } },
  },
);

bookingSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
