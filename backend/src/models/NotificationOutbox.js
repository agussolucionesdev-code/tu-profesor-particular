import mongoose from "mongoose";

export const NOTIFICATION_STATUSES = Object.freeze([
  "queued",
  "processing",
  "delivery_unknown",
  "sent",
  "failed",
  "dead",
  "superseded",
]);

export const NOTIFICATION_DELIVERY_PHASES = Object.freeze([
  "leased",
  "provider_started",
  "provider_accepted",
]);

export const NOTIFICATION_FAILURE_DISPOSITIONS = Object.freeze([
  "",
  "retryable",
  "terminal",
  "security",
  "ambiguous",
  "configuration",
]);

export const NOTIFICATION_TYPES = Object.freeze([
  "booking_confirmation",
  "booking_received_pending",
  "booking_pending_updated",
  "booking_rescheduled",
  "booking_cancelled",
  "booking_reminder",
  "management_link_requested",
]);

const notificationOutboxSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      immutable: true,
      index: true,
    },
    bookingCode: { type: String, required: true, immutable: true, maxlength: 12 },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: "queued", index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, immutable: true },
    channel: { type: String, enum: ["email"], default: "email", immutable: true },
    recipientKind: {
      type: String,
      enum: ["client", "owner"],
      required: true,
      immutable: true,
      select: false,
    },
    recipientMasked: { type: String, required: true, immutable: true, maxlength: 200 },
    managementTokenFingerprint: {
      type: String,
      default: null,
      immutable: true,
      select: false,
      maxlength: 64,
    },
    templateVersion: { type: Number, default: 1, min: 1, immutable: true },
    eventId: { type: String, required: true, immutable: true, select: false, maxlength: 64 },
    eventOccurredAt: { type: Date, required: true, immutable: true },
    bookingRevision: { type: Number, default: 0, min: 0, immutable: true },
    reminderRevision: { type: Number, default: 0, min: 0, immutable: true },
    scheduleRevision: { type: Number, default: 0, min: 0, immutable: true },
    dedupeKey: { type: String, required: true, immutable: true, select: false },
    payloadCiphertext: { type: String, required: true, immutable: true, select: false },
    payloadIv: { type: String, required: true, immutable: true, select: false },
    payloadAuthTag: { type: String, required: true, immutable: true, select: false },
    encryptionKeyVersion: { type: String, required: true, immutable: true, select: false },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1, max: 20 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, immutable: true, index: true },
    leaseOwner: { type: String, default: null, select: false, maxlength: 100 },
    leaseExpiresAt: { type: Date, default: null, select: false },
    deliveryPhase: {
      type: String,
      enum: NOTIFICATION_DELIVERY_PHASES,
      default: null,
      select: false,
    },
    providerMessageId: {
      type: String,
      default: null,
      maxlength: 200,
      validate: {
        validator: (value) => value == null || (
          /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,128}@[A-Za-z0-9.-]{1,63}$/u.test(value) &&
          !/[\p{Cc}\p{Cs}\p{Default_Ignorable_Code_Point}<>]/u.test(value)
        ),
        message: "Provider message id inválido.",
      },
    },
    sentAt: { type: Date, default: null },
    errorCategory: {
      type: String,
      enum: ["", "provider", "configuration", "security", "superseded", "unknown"],
      default: "",
    },
    failureDisposition: {
      type: String,
      enum: NOTIFICATION_FAILURE_DISPOSITIONS,
      default: "",
    },
    retryOperationId: { type: String, default: null, select: false, maxlength: 80 },
    retryOperationState: {
      type: String,
      enum: ["", "requested", "committed", "failed", "archived"],
      default: "",
      select: false,
    },
    retryRequestedAt: { type: Date, default: null, select: false },
    retryActorId: { type: mongoose.Schema.Types.ObjectId, default: null, select: false },
    retryActorRole: { type: String, default: null, maxlength: 40, select: false },
    retryActorUsername: { type: String, default: null, maxlength: 160, select: false },
    retryRequestId: { type: String, default: null, maxlength: 100, select: false },
    lastError: { type: String, default: "", maxlength: 120 },
    payloadPurgedAt: { type: Date, default: null, select: false },
    payloadPurgeAt: { type: Date, default: null, select: false },
  },
  { timestamps: true, versionKey: false },
);

notificationOutboxSchema.index({ dedupeKey: 1 }, { unique: true });
notificationOutboxSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
notificationOutboxSchema.index({ status: 1, nextAttemptAt: 1, expiresAt: 1, createdAt: 1 });
notificationOutboxSchema.index({ status: 1, type: 1, createdAt: -1 });
notificationOutboxSchema.index({ booking: 1, createdAt: -1 });
notificationOutboxSchema.index(
  { booking: 1, managementTokenFingerprint: 1, status: 1 },
  {
    name: "booking_tokenFingerprint_active",
    partialFilterExpression: {
      managementTokenFingerprint: { $type: "string" },
      status: { $in: ["queued", "processing", "delivery_unknown", "failed", "dead"] },
    },
  },
);
notificationOutboxSchema.index(
  { retryOperationState: 1, _id: 1 },
  {
    name: "retryOperationState_active__id",
    partialFilterExpression: {
      retryOperationState: { $in: ["requested", "committed", "failed"] },
    },
  },
);

const NotificationOutbox = mongoose.model("NotificationOutbox", notificationOutboxSchema);
export default NotificationOutbox;
