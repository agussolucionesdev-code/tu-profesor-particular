import crypto from "node:crypto";
import Booking from "../models/Booking.js";
import NotificationOutbox from "../models/NotificationOutbox.js";
import AuditEvent from "../models/AuditEvent.js";
import { reconcilePendingBookingAudits } from "./auditService.js";
import AppSettings from "../models/AppSettings.js";
import {
  prepareNotificationOutboxMessage,
  refreshEmailDeliveryHealth,
} from "../config/mailer.js";
import {
  decryptNotificationPayload,
  encryptNotificationPayload,
} from "./notificationPayloadCrypto.js";
import {
  combineMutationGuards,
  withoutActiveManagementLinkRequest,
  withoutActiveNotificationDeliveryFence,
  withoutActiveSlotMutation,
} from "./bookingMutationFenceService.js";

const DEFAULT_LEASE_MS = 30_000;
const PROVIDER_TIMEOUT_MS = 20_000;
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const DEAD_PAYLOAD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const UNKNOWN_PAYLOAD_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;
const REMINDER_MAX_LATENESS_MS = 6 * 60 * 60 * 1000;
const CANCELLATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ERROR_COPY = Object.freeze({
  provider: "El proveedor no confirmó la entrega.",
  configuration: "La entrega no está configurada correctamente.",
  security: "El contenido protegido no pudo validarse.",
  superseded: "La notificación quedó obsoleta por un cambio posterior.",
  unknown: "La entrega no pudo completarse.",
});

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const matchesRevision = (field, revision) => Number(revision || 0) === 0
  ? { $or: [{ [field]: 0 }, { [field]: { $exists: false } }] }
  : { [field]: Number(revision) };
const eligibleCreationState = () => ({
  $or: [
    { creationState: "active" },
    { creationState: { $exists: false } },
  ],
});
const portalUrl = () => `${String(process.env.FRONTEND_URL || "https://turnos.tuprofesorparticular.com.ar").replace(/\/$/u, "")}/portal`;
const managementTokenFingerprint = (managementUrl) => {
  const match = String(managementUrl || "").match(/#token=([A-Za-z0-9_-]{43})$/u);
  return match ? sha256(match[1]) : null;
};
const maskEmail = (email) => {
  const [local, domain] = String(email || "").trim().toLowerCase().split("@");
  if (!local || !domain) return "***";
  if (local.length === 1) return `*@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local.at(-1)}@${domain}`;
};

const snapshot = (booking) => ({
  _id: String(booking._id),
  bookingCode: booking.bookingCode,
  studentName: booking.studentName,
  responsibleName: booking.responsibleName,
  responsibleRelationship: booking.responsibleRelationship,
  responsibleRelationshipOther: booking.responsibleRelationshipOther,
  phone: booking.phone,
  email: booking.email,
  school: booking.school,
  educationLevel: booking.educationLevel,
  yearGrade: booking.yearGrade,
  subject: booking.subject,
  academicSituation: booking.academicSituation,
  duration: booking.duration,
  timeSlot: new Date(booking.timeSlot).toISOString(),
  status: booking.status,
  deletedAt: booking.deletedAt ? new Date(booking.deletedAt).toISOString() : null,
  notificationRevision: Number(booking.notificationRevision || 0),
  reminderRevision: Number(booking.reminderRevision || 0),
  scheduleRevision: Number(booking.scheduleRevision || 0),
});

const scheduledForType = (booking, type, now) => type === "booking_reminder"
  ? new Date(Math.max(now.getTime(), new Date(booking.timeSlot).getTime() - 24 * 60 * 60 * 1000))
  : now;

const expiresAtForType = (booking, type, now) => {
  if (type === "booking_cancelled") return new Date(now.getTime() + CANCELLATION_TTL_MS);
  if (type === "management_link_requested") {
    return new Date(booking.managementTokenExpiresAt || booking.endTime || booking.timeSlot);
  }
  const classAt = new Date(booking.timeSlot).getTime();
  if (type === "booking_reminder") {
    return new Date(classAt - REMINDER_LEAD_MS + REMINDER_MAX_LATENESS_MS);
  }
  return new Date(classAt);
};

export const buildBookingNotificationIntents = ({
  booking,
  type,
  eventKey = crypto.randomUUID(),
  previousTimeSlot,
  managementUrl,
  includeOwner = true,
  maxAttempts = 5,
  now = new Date(),
  auditCommitOperationId = null,
}) => {
  const effectiveType = type === "booking_confirmation" && booking?.status !== "Confirmado"
    ? "booking_received_pending"
    : type === "booking_rescheduled" && booking?.status !== "Confirmado"
      ? "booking_pending_updated"
      : type;
  const eventId = sha256(String(eventKey));
  const bookingRevision = Number(booking.notificationRevision || 0);
  const reminderRevision = Number(booking.reminderRevision || 0);
  const scheduleRevision = Number(booking.scheduleRevision || 0);
  const dedupeEventId = effectiveType === "booking_reminder"
    ? sha256(`reminder:${reminderRevision}`)
    : eventId;
  const recipients = [];
  if (booking?.email) recipients.push({ kind: "client", email: booking.email });
  const ownerEmail = String(process.env.OWNER_NOTIFICATION_EMAIL || "").trim();
  if (includeOwner && effectiveType !== "booking_reminder" && ownerEmail) {
    recipients.push({ kind: "owner", email: ownerEmail });
  }
  return recipients.map(({ kind, email }) => {
    const dedupeKey = sha256([
      String(booking._id), effectiveType, dedupeEventId, "email", kind,
    ].join(":"));
    const tokenFingerprint = kind === "client"
      ? managementTokenFingerprint(managementUrl)
      : null;
    const encrypted = encryptNotificationPayload({
      recipient: String(email).trim().toLowerCase(),
      recipientKind: kind,
      booking: snapshot(booking),
      type: effectiveType,
      previousTimeSlot: previousTimeSlot ? new Date(previousTimeSlot).toISOString() : null,
      managementUrl: kind === "client" ? managementUrl || null : null,
      managementTokenFingerprint: tokenFingerprint,
      portalUrl: portalUrl(),
      templateVersion: 1,
    }, dedupeKey);
    return {
      eventId,
      dedupeKey,
      type: effectiveType,
      channel: "email",
      recipientKind: kind,
      recipientMasked: maskEmail(email),
      managementTokenFingerprint: tokenFingerprint,
      templateVersion: 1,
      ...encrypted,
      scheduledFor: scheduledForType(booking, type, now),
      expiresAt: expiresAtForType(booking, type, now),
      maxAttempts,
      occurredAt: now,
      auditCommitOperationId,
      bookingRevision,
      reminderRevision,
      scheduleRevision,
    };
  });
};

const outboxInsert = (booking, intent) => NotificationOutbox.findOneAndUpdate(
  { dedupeKey: intent.dedupeKey },
  {
    $setOnInsert: {
      booking: booking._id,
      bookingCode: booking.bookingCode,
      status: "queued",
      type: intent.type,
      channel: intent.channel,
      recipientKind: intent.recipientKind,
      recipientMasked: intent.recipientMasked,
      managementTokenFingerprint: intent.managementTokenFingerprint || null,
      templateVersion: intent.templateVersion,
      eventId: intent.eventId,
      eventOccurredAt: intent.occurredAt,
      bookingRevision: intent.bookingRevision || 0,
      reminderRevision: intent.reminderRevision || 0,
      scheduleRevision: intent.scheduleRevision || 0,
      dedupeKey: intent.dedupeKey,
      payloadCiphertext: intent.payloadCiphertext,
      payloadIv: intent.payloadIv,
      payloadAuthTag: intent.payloadAuthTag,
      encryptionKeyVersion: intent.encryptionKeyVersion,
      attempts: 0,
      maxAttempts: intent.maxAttempts,
      nextAttemptAt: intent.scheduledFor,
      expiresAt: intent.expiresAt,
    },
  },
  { upsert: true, new: true, runValidators: true },
);

const supersedePending = async ({
  bookingId,
  exceptKeys = [],
  revision,
  revisionField = "bookingRevision",
  types,
}) => {
  const now = new Date();
  await NotificationOutbox.collection.updateMany(
    {
      booking: bookingId,
      // A provider call already in flight has an unknowable delivery boundary.
      // Never rewrite or purge it as if supersession were certain.
      $and: [
        {
          $or: [
            { status: { $in: ["queued", "failed", "dead"] } },
            { status: "processing", deliveryPhase: "leased" },
          ],
        },
        ...(Number.isFinite(Number(revision)) ? [{
          $or: [
            { [revisionField]: { $lte: Number(revision) } },
            { [revisionField]: { $exists: false } },
          ],
        }] : []),
      ],
      ...(types?.length ? { type: { $in: types } } : {}),
      ...(exceptKeys.length ? { dedupeKey: { $nin: exceptKeys } } : {}),
    },
    {
      $set: {
        status: "superseded",
        errorCategory: "superseded",
        failureDisposition: "terminal",
        lastError: ERROR_COPY.superseded,
        nextAttemptAt: null,
        payloadPurgedAt: now,
        updatedAt: now,
      },
      $unset: {
        leaseOwner: "",
        leaseExpiresAt: "",
        deliveryPhase: "",
        payloadCiphertext: "",
        payloadIv: "",
        payloadAuthTag: "",
        encryptionKeyVersion: "",
      },
    },
  );
};

export const reconcileNotificationIntents = async ({ bookingId, limit = 100 } = {}) => {
  const batchSize = Math.max(1, Math.min(500, Number(limit) || 100));
  let reconciled = 0;
  let bookingsProcessed = 0;
  let cursor = null;
  // An abandoned creation draft can never cross the activation CAS. Its
  // encrypted intents are therefore unreachable and safe to purge, whereas a
  // claiming draft must retain them for the owner that may still activate it.
  await Booking.collection.updateMany(
    {
      ...(bookingId ? { _id: bookingId } : {}),
      creationState: "abandoned",
      "notificationIntents.0": { $exists: true },
    },
    { $unset: { notificationIntents: "" } },
  );
  // Cursor pagination prevents a permanently retained, uncommitted intent from
  // starving every booking behind it. The safety bound is deliberately high
  // enough for operational recovery while keeping one worker tick finite.
  for (let batch = 0; batch < 1_000; batch += 1) {
    const filter = {
      ...(bookingId ? { _id: bookingId } : cursor ? { _id: { $gt: cursor } } : {}),
      "notificationIntents.0": { $exists: true },
      ...eligibleCreationState(),
    };
    const bookings = await Booking.find(filter)
      .select("+notificationIntents")
      .sort({ _id: 1 })
      .limit(bookingId ? 1 : batchSize);
    if (!bookings.length) break;
    for (const booking of bookings) {
      cursor = booking._id;
      bookingsProcessed += 1;
      const allIntents = booking.notificationIntents.map((intent) => intent.toObject());
      const operationIds = [...new Set(allIntents
        .map((intent) => intent.auditCommitOperationId)
        .filter(Boolean))];
      const committed = operationIds.length
        ? await AuditEvent.distinct("operationId", {
          entityType: "Booking",
          entityId: booking._id,
          operationId: { $in: operationIds },
        })
        : [];
      const committedSet = new Set(committed.map(String));
      const intents = allIntents.filter((intent) =>
        !intent.auditCommitOperationId || committedSet.has(String(intent.auditCommitOperationId)));
      if (!intents.length) continue;
    for (const intent of intents) {
      await outboxInsert(booking, intent);
      reconciled += 1;
    }
      const lifecycleGroups = new Map();
      const reminderGroups = new Map();
    for (const intent of intents) {
      const isReminder = intent.type === "booking_reminder";
      const revision = isReminder
        ? Number(intent.reminderRevision || 0)
        : Number(intent.bookingRevision || 0);
      const groups = isReminder ? reminderGroups : lifecycleGroups;
      const group = groups.get(revision) || [];
      group.push(intent);
      groups.set(revision, group);
    }
    const orderedLifecycleGroups = [...lifecycleGroups.entries()]
      .sort(([left], [right]) => left - right);
    for (const [revision, group] of orderedLifecycleGroups) {
      const eventTypes = new Set(group.map((intent) => intent.type));
      const supersededTypes = eventTypes.has("booking_cancelled")
        ? ["booking_confirmation", "booking_received_pending", "booking_pending_updated", "booking_rescheduled", "booking_cancelled"]
        : eventTypes.has("booking_rescheduled") || eventTypes.has("booking_confirmation")
          ? ["booking_confirmation", "booking_received_pending", "booking_pending_updated", "booking_rescheduled"]
          : eventTypes.has("booking_pending_updated")
            ? ["booking_received_pending", "booking_pending_updated"]
          : eventTypes.has("booking_received_pending")
            ? ["booking_received_pending"]
          : eventTypes.has("management_link_requested")
            ? ["management_link_requested"]
          : [...eventTypes];
      await supersedePending({
        bookingId: booking._id,
        exceptKeys: group.map((intent) => intent.dedupeKey),
        revision,
        revisionField: "bookingRevision",
        types: supersededTypes,
      });
      const invalidatesEarlierReminders = [
        "booking_cancelled",
        "booking_rescheduled",
        "booking_confirmation",
        "booking_pending_updated",
      ].some((type) => eventTypes.has(type));
      if (invalidatesEarlierReminders) {
        const reminderRevision = Math.max(...group.map((intent) =>
          Number(intent.reminderRevision || 0)));
        await supersedePending({
          bookingId: booking._id,
          // A lifecycle mutation can enqueue the replacement reminder in the
          // same durable batch. Preserve that exact reminder generation while
          // invalidating earlier ones with the reminder counter only.
          exceptKeys: (reminderGroups.get(reminderRevision) || [])
            .map((intent) => intent.dedupeKey),
          revision: reminderRevision,
          revisionField: "reminderRevision",
          types: ["booking_reminder"],
        });
      }
    }
    const orderedReminderGroups = [...reminderGroups.entries()]
      .sort(([left], [right]) => left - right);
    for (const [revision, group] of orderedReminderGroups) {
      await supersedePending({
        bookingId: booking._id,
        exceptKeys: group.map((intent) => intent.dedupeKey),
        revision,
        revisionField: "reminderRevision",
        types: ["booking_reminder"],
      });
    }
      const keys = intents.map((intent) => intent.dedupeKey);
      await Booking.collection.updateOne(
        {
          _id: booking._id,
          ...combineMutationGuards(
            matchesRevision("notificationRevision", booking.notificationRevision),
            matchesRevision("reminderRevision", booking.reminderRevision),
          ),
        },
        { $pull: { notificationIntents: { dedupeKey: { $in: keys } } } },
      );
    }
    if (bookingId || bookings.length < batchSize) break;
  }
  return { bookings: bookingsProcessed, reconciled };
};

export const enqueueBookingNotifications = async (options) => {
  const intents = buildBookingNotificationIntents(options);
  if (!intents.length) return [];
  const booking = options.booking;
  const now = new Date();
  const isReminder = intents.every((intent) => intent.type === "booking_reminder");
  const expectedDeletedAt = booking.deletedAt ? new Date(booking.deletedAt) : null;
  const pushed = await Booking.collection.updateOne(
    {
      _id: booking._id,
      ...eligibleCreationState(),
      status: booking.status,
      timeSlot: new Date(booking.timeSlot),
      email: String(booking.email || "").trim().toLowerCase(),
      deletedAt: expectedDeletedAt,
      ...combineMutationGuards(
        isReminder
          ? matchesRevision("reminderRevision", booking.reminderRevision)
          : matchesRevision("notificationRevision", booking.notificationRevision),
        withoutActiveSlotMutation(now),
        withoutActiveManagementLinkRequest(now),
        withoutActiveNotificationDeliveryFence(now),
      ),
    },
    { $push: { notificationIntents: { $each: intents } } },
  );
  if (pushed.modifiedCount !== 1) return [];
  await reconcileNotificationIntents({ bookingId: options.booking._id });
  return NotificationOutbox.find({ dedupeKey: { $in: intents.map((item) => item.dedupeKey) } });
};

let provider = prepareNotificationOutboxMessage;
export const setNotificationProviderForTests = (next, { stage = "transport" } = {}) => {
  if (typeof next !== "function") throw new TypeError("Notification provider must be a function.");
  const previous = provider;
  provider = stage === "preflight"
    ? next
    : async (payload) => ({ send: () => next(payload) });
  return () => { provider = previous; };
};

const leaseNext = ({ workerId, now, leaseMs }) => NotificationOutbox.findOneAndUpdate(
  {
    status: { $in: ["queued", "failed"] },
    nextAttemptAt: { $lte: now },
    expiresAt: { $gt: now },
    $expr: { $lt: ["$attempts", "$maxAttempts"] },
  },
  {
    $set: {
      status: "processing",
      deliveryPhase: "leased",
      leaseOwner: workerId,
      leaseExpiresAt: new Date(now.getTime() + leaseMs),
    },
    $inc: { attempts: 1 },
  },
  { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } },
).select("+recipientKind +dedupeKey +managementTokenFingerprint +payloadCiphertext +payloadIv +payloadAuthTag +encryptionKeyVersion +leaseOwner +leaseExpiresAt +deliveryPhase");

const acquireTokenDeliveryLock = async ({ record, workerId, now, leaseMs }) => {
  if (!record.managementTokenFingerprint) return true;
  const lockExpiresAt = new Date(now.getTime() + Math.max(leaseMs, PROVIDER_TIMEOUT_MS + 5_000));
  const acquired = await Booking.collection.updateOne(
    {
      _id: record.booking,
      ...eligibleCreationState(),
      managementTokenHash: record.managementTokenFingerprint,
      managementTokenRevokedAt: null,
      managementTokenExpiresAt: { $gt: now },
      $and: [
        { $or: [
          { managementLinkRequestLock: null },
          { managementLinkRequestLock: { $exists: false } },
          { managementLinkRequestLockExpiresAt: { $lte: now } },
        ] },
        { $or: [
          { managementTokenDeliveryLock: null },
          { managementTokenDeliveryLock: { $exists: false } },
          { managementTokenDeliveryLockExpiresAt: { $lte: now } },
          {
            managementTokenDeliveryLock: workerId,
            managementTokenDeliveryLockOutbox: record._id,
          },
        ] },
      ],
    },
    {
      $set: {
        managementTokenDeliveryLock: workerId,
        managementTokenDeliveryLockOutbox: record._id,
        managementTokenDeliveryLockFingerprint: record.managementTokenFingerprint,
        managementTokenDeliveryLockExpiresAt: lockExpiresAt,
      },
    },
  );
  return acquired.modifiedCount === 1 || acquired.matchedCount === 1;
};

const releaseTokenDeliveryLock = ({ record, workerId }) => {
  if (!record.managementTokenFingerprint) return Promise.resolve();
  return Booking.collection.updateOne(
    {
      _id: record.booking,
      managementTokenDeliveryLock: workerId,
      managementTokenDeliveryLockOutbox: record._id,
      managementTokenDeliveryLockFingerprint: record.managementTokenFingerprint,
    },
    {
      $unset: {
        managementTokenDeliveryLock: "",
        managementTokenDeliveryLockOutbox: "",
        managementTokenDeliveryLockFingerprint: "",
        managementTokenDeliveryLockExpiresAt: "",
      },
    },
  );
};

const statusPredicateForPayload = (payload) => {
  if (payload.type === "booking_cancelled") return "Cancelado";
  if (["booking_received_pending", "booking_pending_updated"].includes(payload.type)) {
    return "Pendiente";
  }
  if (payload.type === "management_link_requested") return { $in: ["Confirmado", "Pendiente"] };
  return "Confirmado";
};

const acquireNotificationDeliveryFence = async ({ record, payload, workerId, now, leaseMs }) => {
  const expiresAt = new Date(now.getTime() + Math.max(leaseMs, PROVIDER_TIMEOUT_MS + 5_000));
  const effectiveRevision = payload.type === "booking_reminder"
    ? Number(record.reminderRevision || 0)
    : Number(record.bookingRevision || 0);
  const sameFence = {
    "notificationDeliveryFence.outboxId": record._id,
    "notificationDeliveryFence.owner": workerId,
    "notificationDeliveryFence.revision": effectiveRevision,
  };
  const availableFence = {
    $or: [
      { notificationDeliveryFence: null },
      { notificationDeliveryFence: { $exists: false } },
      { "notificationDeliveryFence.expiresAt": { $lte: now } },
      sameFence,
    ],
  };
  const expectedDeletedAt = payload.booking.deletedAt
    ? new Date(payload.booking.deletedAt)
    : null;
  const result = await Booking.collection.updateOne(
    {
      _id: record.booking,
      ...eligibleCreationState(),
      scheduleRevision: Number(record.scheduleRevision || 0),
      status: statusPredicateForPayload(payload),
      timeSlot: new Date(payload.booking.timeSlot),
      email: String(payload.booking.email || "").trim().toLowerCase(),
      deletedAt: expectedDeletedAt,
      ...combineMutationGuards(
        payload.type === "booking_reminder"
          ? matchesRevision("reminderRevision", record.reminderRevision)
          : matchesRevision("notificationRevision", record.bookingRevision),
        withoutActiveSlotMutation(now),
        withoutActiveManagementLinkRequest(now),
        availableFence,
      ),
      ...(record.managementTokenFingerprint ? {
        managementTokenHash: record.managementTokenFingerprint,
        managementTokenRevokedAt: null,
        managementTokenExpiresAt: { $gt: now },
      } : {}),
    },
    {
      $set: {
        notificationDeliveryFence: {
          outboxId: record._id,
          revision: effectiveRevision,
          fingerprint: record.managementTokenFingerprint || null,
          owner: workerId,
          expiresAt,
        },
      },
    },
  );
  return result.modifiedCount === 1 || result.matchedCount === 1;
};

const releaseNotificationDeliveryFence = ({ record, workerId }) => Booking.collection.updateOne(
  {
    _id: record.booking,
    "notificationDeliveryFence.outboxId": record._id,
    "notificationDeliveryFence.owner": workerId,
    "notificationDeliveryFence.revision": record.type === "booking_reminder"
      ? Number(record.reminderRevision || 0)
      : Number(record.bookingRevision || 0),
  },
  { $unset: { notificationDeliveryFence: "" } },
);

const classifyError = (error) => {
  const message = String(error?.message || "");
  if (error?.code === "EMAIL_CONFIGURATION_ERROR" ||
      /keyring|configured|encryption key is unavailable/iu.test(message)) return "configuration";
  if (/authentication failed/iu.test(message)) return "security";
  if (/provider|timeout/iu.test(message)) return "provider";
  return "unknown";
};

const AMBIGUOUS_SMTP_CODES = new Set([
  "ETIMEDOUT",
  "ECONNECTION",
  "ESOCKET",
  "ECONNRESET",
]);
const PRE_ACCEPTANCE_COMMANDS = new Set([
  "CONN",
  "EHLO",
  "HELO",
  "AUTH",
  "AUTH PLAIN",
  "AUTH LOGIN",
  "MAIL FROM",
  "RCPT TO",
  "STARTTLS",
]);

export const classifyProviderOutcome = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const command = String(error?.command || "").trim().toUpperCase();
  // A real SMTP response is authoritative: the remote server explicitly
  // rejected the message, therefore delivery is not ambiguous.
  const responseCode = Number(error?.responseCode);
  if (Number.isInteger(responseCode) && responseCode >= 400 && responseCode < 500) {
    return "retryable";
  }
  if (Number.isInteger(responseCode) && responseCode >= 500 && responseCode < 600) {
    return "terminal";
  }
  if (error?.deliveryDisposition === "terminal") return "terminal";
  // Command stage is authoritative. Nothing can have been accepted before DATA,
  // so connection/auth/envelope failures are safe to retry even when the local
  // socket reports a timeout or reset.
  if (PRE_ACCEPTANCE_COMMANDS.has(command)) return "retryable";
  if (command === "DATA" || command === "DOT" || command === "POST-DATA") {
    return "delivery_unknown";
  }
  if (AMBIGUOUS_SMTP_CODES.has(code) || !command) return "delivery_unknown";
  return "delivery_unknown";
};

const MESSAGE_ID_LOCAL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,128}$/u;
const MESSAGE_ID_DOMAIN = /^(?=.{1,63}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/u;

export const normalizeProviderMessageId = (value, dedupeKey) => {
  const cleaned = String(value || "")
    .replace(/[<>]/gu, "")
    .replace(/[\p{Cc}\p{Cs}\p{Default_Ignorable_Code_Point}]/gu, "")
    .trim();
  const separator = cleaned.lastIndexOf("@");
  const local = separator > 0 ? cleaned.slice(0, separator) : "";
  const domain = separator > 0 ? cleaned.slice(separator + 1) : "";
  const valid = cleaned.length <= 200 && MESSAGE_ID_LOCAL.test(local) && MESSAGE_ID_DOMAIN.test(domain);
  if (valid) return `${local}@${domain}`;
  const safeKey = /^[a-f0-9]{64}$/u.test(String(dedupeKey || ""))
    ? String(dedupeKey)
    : sha256(String(dedupeKey || "missing-correlation"));
  return `${safeKey}@outbox.tuprofesorparticular.com.ar`;
};

const backoff = (attempts) => {
  const base = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** Math.max(0, attempts - 1)));
  return base + crypto.randomInt(0, Math.max(1, Math.floor(base / 4)));
};

class DeliveryUnknownError extends Error {
  constructor() {
    super("Provider delivery result is ambiguous.");
    this.name = "DeliveryUnknownError";
    this.code = "DELIVERY_UNKNOWN";
  }
}

const withAmbiguousTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new DeliveryUnknownError()), timeoutMs);
  Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
});

const validateCurrentPayload = async (payload, now) => {
  const current = await Booking.findOne({
    _id: payload.booking._id,
    ...eligibleCreationState(),
  })
    .select("+managementTokenHash +creationState")
    .lean();
  if (!current) return false;
  const payloadDeletedAt = payload.booking.deletedAt
    ? new Date(payload.booking.deletedAt).toISOString()
    : null;
  const currentDeletedAt = current.deletedAt ? new Date(current.deletedAt).toISOString() : null;
  if (payloadDeletedAt !== currentDeletedAt) return false;
  const revisionCurrent = payload.type === "booking_reminder"
    ? Number(payload.booking.reminderRevision || 0) === Number(current.reminderRevision || 0)
    : Number(payload.booking.notificationRevision || 0) === Number(current.notificationRevision || 0);
  if (!revisionCurrent) {
    return false;
  }
  if (payload.recipientKind === "client" &&
      String(payload.recipient || "").trim().toLowerCase() !== String(current.email || "").trim().toLowerCase()) {
    return false;
  }
  if (payload.type === "booking_cancelled") return current.status === "Cancelado";
  if (["booking_received_pending", "booking_pending_updated"].includes(payload.type)) {
    if (current.status !== "Pendiente" ||
      new Date(payload.booking.timeSlot).toISOString() !== new Date(current.timeSlot).toISOString()) {
      return false;
    }
  } else if (payload.type === "booking_reminder") {
    const classAt = new Date(current.timeSlot).getTime();
    const currentTime = now.getTime();
    const windowOpensAt = classAt - REMINDER_LEAD_MS;
    const windowClosesAt = windowOpensAt + REMINDER_MAX_LATENESS_MS;
    const valid = current.status === "Confirmado" &&
      classAt > currentTime &&
      currentTime >= windowOpensAt &&
      currentTime <= windowClosesAt &&
      new Date(payload.booking.timeSlot).toISOString() === new Date(current.timeSlot).toISOString();
    if (!valid) return false;
    // Reminder content is a live operational projection, not a historical
    // event receipt. Rebuild it so edits that do not change the slot (or move
    // away and back) cannot send stale academic details.
    payload.booking = snapshot(current);
  } else if (payload.type === "management_link_requested") {
    if (!["Confirmado", "Pendiente"].includes(current.status) ||
        !payload.managementUrl || !payload.managementTokenFingerprint) return false;
  } else {
    if (current.status !== "Confirmado") return false;
    if (new Date(current.timeSlot).toISOString() !== new Date(payload.booking.timeSlot).toISOString()) {
      return false;
    }
  }
  if (payload.managementUrl) {
    const tokenStillCurrent = Boolean(
      payload.managementTokenFingerprint &&
      current.managementTokenHash === payload.managementTokenFingerprint &&
      !current.managementTokenRevokedAt &&
      current.managementTokenExpiresAt &&
      new Date(current.managementTokenExpiresAt) > now
    );
    // A requested-link message whose token is stale is itself obsolete. It
    // must never degrade into a token-less configuration retry/dead letter.
    if (!tokenStillCurrent && payload.type === "management_link_requested") return false;
    if (!tokenStillCurrent) payload.managementUrl = null;
  }
  payload.portalUrl ||= portalUrl();
  return true;
};

const purgeExpiredPayloads = (now) => NotificationOutbox.collection.updateMany(
  {
    status: { $in: ["sent", "dead", "superseded", "delivery_unknown"] },
    payloadPurgeAt: { $lte: now },
    payloadPurgedAt: null,
  },
  {
    $set: { payloadPurgedAt: now, recipientMasked: "***", updatedAt: now },
    $unset: {
      payloadCiphertext: "", payloadIv: "", payloadAuthTag: "", encryptionKeyVersion: "", payloadPurgeAt: "",
    },
  },
);

const LEGACY_HASH_MIGRATION_KEY = "migration.notificationRecipientHash.v1";
export const purgeLegacyRecipientHashes = async ({ batchSize = 500 } = {}) => {
  const marker = await AppSettings.findOne({ key: LEGACY_HASH_MIGRATION_KEY }).lean();
  if (marker?.value?.completed) return { completed: true, migrated: 0 };
  const state = marker?.value || { phase: "outbox", cursor: null, migrated: 0 };
  const collections = state.phase === "booking"
    ? [{ phase: "booking", collection: Booking.collection, field: "notificationIntents.recipientHash" }]
    : [
      { phase: "outbox", collection: NotificationOutbox.collection, field: "recipientHash" },
      { phase: "booking", collection: Booking.collection, field: "notificationIntents.recipientHash" },
    ];
  let migrated = Number(state.migrated || 0);
  for (const entry of collections) {
    let cursor = state.phase === entry.phase ? state.cursor : null;
    for (;;) {
      const docs = await entry.collection.find({
        ...(cursor ? { _id: { $gt: cursor } } : {}),
        [entry.field]: { $exists: true },
      }, { projection: { _id: 1 } }).sort({ _id: 1 }).limit(batchSize).toArray();
      if (!docs.length) break;
      const ids = docs.map((doc) => doc._id);
      const update = entry.phase === "outbox"
        ? { $unset: { recipientHash: "" } }
        : { $unset: { "notificationIntents.$[].recipientHash": "" } };
      await entry.collection.updateMany({ _id: { $in: ids } }, update);
      migrated += ids.length;
      cursor = ids.at(-1);
      await AppSettings.updateOne(
        { key: LEGACY_HASH_MIGRATION_KEY },
        { $set: { value: { phase: entry.phase, cursor, migrated, completed: false } } },
        { upsert: true },
      );
      if (docs.length < batchSize) break;
    }
    state.phase = entry.phase === "outbox" ? "booking" : "done";
    state.cursor = null;
  }
  await AppSettings.updateOne(
    { key: LEGACY_HASH_MIGRATION_KEY },
    { $set: { value: { phase: "done", cursor: null, migrated, completed: true } } },
    { upsert: true },
  );
  return { completed: true, migrated };
};

const recoverExpiredDeliveries = async (now) => {
  await Booking.collection.updateMany(
    { "notificationDeliveryFence.expiresAt": { $lte: now } },
    { $unset: { notificationDeliveryFence: "" } },
  );
  const beforeProvider = await NotificationOutbox.collection.updateMany(
    {
      status: "processing",
      deliveryPhase: "leased",
      leaseExpiresAt: { $lte: now },
    },
    {
      $set: {
        status: "queued",
        failureDisposition: "",
        errorCategory: "",
        lastError: "",
        nextAttemptAt: now,
        updatedAt: now,
      },
      $inc: { attempts: -1 },
      $unset: { leaseOwner: "", leaseExpiresAt: "", deliveryPhase: "" },
    },
  );
  const afterProvider = await NotificationOutbox.collection.updateMany(
    {
      status: "processing",
      deliveryPhase: { $in: ["provider_started", "provider_accepted", null] },
      leaseExpiresAt: { $lte: now },
    },
    {
      $set: {
        status: "delivery_unknown",
        failureDisposition: "ambiguous",
        errorCategory: "provider",
        lastError: ERROR_COPY.provider,
        nextAttemptAt: null,
        payloadPurgeAt: new Date(now.getTime() + UNKNOWN_PAYLOAD_RETENTION_MS),
        updatedAt: now,
      },
      $unset: { leaseOwner: "", leaseExpiresAt: "", deliveryPhase: "" },
    },
  );
  return {
    requeued: beforeProvider.modifiedCount || 0,
    deliveryUnknown: afterProvider.modifiedCount || 0,
  };
};

const deadLetterExhaustedPending = (now) => NotificationOutbox.collection.updateMany(
  {
    status: { $in: ["queued", "failed"] },
    $expr: { $gte: ["$attempts", "$maxAttempts"] },
  },
  {
    $set: {
      status: "dead",
      errorCategory: "provider",
      lastError: ERROR_COPY.provider,
      nextAttemptAt: null,
      payloadPurgeAt: new Date(now.getTime() + DEAD_PAYLOAD_RETENTION_MS),
      updatedAt: now,
    },
    $unset: { leaseOwner: "", leaseExpiresAt: "", deliveryPhase: "" },
  },
);

const supersedeExpiredPending = (now) => NotificationOutbox.collection.updateMany(
  {
    status: { $in: ["queued", "failed"] },
    expiresAt: { $lte: now },
  },
  {
    $set: {
      status: "superseded",
      errorCategory: "superseded",
      failureDisposition: "terminal",
      lastError: ERROR_COPY.superseded,
      nextAttemptAt: null,
      payloadPurgedAt: now,
      updatedAt: now,
    },
    $unset: {
      deliveryPhase: "", payloadCiphertext: "", payloadIv: "", payloadAuthTag: "", encryptionKeyVersion: "",
    },
  },
);

const startLeaseHeartbeat = ({ record, workerId, leaseMs }) => {
  let stopped = false;
  let pending = Promise.resolve();
  const intervalMs = Math.max(10, Math.floor(leaseMs / 3));
  const renew = () => {
    if (stopped) return;
    const heartbeatAt = new Date();
    pending = pending.then(() => NotificationOutbox.collection.updateOne(
      { _id: record._id, status: "processing", leaseOwner: workerId },
      { $set: { leaseExpiresAt: new Date(heartbeatAt.getTime() + leaseMs), updatedAt: heartbeatAt } },
    ).then(async (leaseResult) => {
      if (leaseResult.modifiedCount !== 1) return;
      await Booking.collection.updateOne(
        {
          _id: record.booking,
          "notificationDeliveryFence.outboxId": record._id,
          "notificationDeliveryFence.owner": workerId,
          "notificationDeliveryFence.revision": record.type === "booking_reminder"
            ? Number(record.reminderRevision || 0)
            : Number(record.bookingRevision || 0),
        },
        {
          $set: {
            "notificationDeliveryFence.expiresAt": new Date(
              heartbeatAt.getTime() + Math.max(leaseMs, PROVIDER_TIMEOUT_MS + 5_000),
            ),
          },
        },
      );
      if (!record.managementTokenFingerprint) return;
      await Booking.collection.updateOne(
        {
          _id: record.booking,
          managementTokenDeliveryLock: workerId,
          managementTokenDeliveryLockOutbox: record._id,
          managementTokenDeliveryLockFingerprint: record.managementTokenFingerprint,
        },
        { $set: { managementTokenDeliveryLockExpiresAt: new Date(heartbeatAt.getTime() + leaseMs) } },
      );
    })).catch(() => {});
  };
  const timer = setInterval(renew, intervalMs);
  timer.unref?.();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await pending;
  };
};

const supersedeRecord = async (record, now) => NotificationOutbox.collection.updateOne(
  { _id: record._id, status: "processing", leaseOwner: record.leaseOwner, deliveryPhase: "leased" },
  {
    $set: {
      status: "superseded",
      errorCategory: "superseded",
      failureDisposition: "terminal",
      lastError: ERROR_COPY.superseded,
      nextAttemptAt: null,
      payloadPurgedAt: now,
      updatedAt: now,
    },
    $unset: {
      leaseOwner: "", leaseExpiresAt: "", deliveryPhase: "", payloadCiphertext: "", payloadIv: "",
      payloadAuthTag: "", encryptionKeyVersion: "",
    },
  },
);

const requeueAfterLockContention = (record, workerId, now) => NotificationOutbox.collection.updateOne(
  {
    _id: record._id,
    status: "processing",
    leaseOwner: workerId,
    deliveryPhase: "leased",
  },
  {
    $set: { status: "queued", nextAttemptAt: now, updatedAt: now },
    $inc: { attempts: -1 },
    $unset: { leaseOwner: "", leaseExpiresAt: "", deliveryPhase: "" },
  },
);

const markDeliveryUnknown = (record, workerId, now) => NotificationOutbox.collection.updateOne(
  { _id: record._id, status: "processing", leaseOwner: workerId },
  {
    $set: {
      status: "delivery_unknown",
      failureDisposition: "ambiguous",
      errorCategory: "provider",
      lastError: ERROR_COPY.provider,
      nextAttemptAt: null,
      payloadPurgeAt: new Date(now.getTime() + UNKNOWN_PAYLOAD_RETENTION_MS),
      updatedAt: now,
    },
    $unset: { leaseOwner: "", leaseExpiresAt: "", deliveryPhase: "" },
  },
);

export const processNotificationOutbox = async ({
  workerId = crypto.randomUUID(),
  limit = 50,
  now = new Date(),
  leaseMs = DEFAULT_LEASE_MS,
  providerTimeoutMs = Math.min(PROVIDER_TIMEOUT_MS, leaseMs - 1000),
} = {}) => {
  const summary = {
    processed: 0,
    sent: 0,
    failed: 0,
    dead: 0,
    superseded: 0,
    deliveryUnknown: 0,
  };
  await purgeLegacyRecipientHashes();
  await reconcilePendingBookingAudits();
  await reconcileNotificationIntents();
  await purgeExpiredPayloads(now);
  const recovered = await recoverExpiredDeliveries(now);
  summary.deliveryUnknown += recovered.deliveryUnknown;
  const expired = await supersedeExpiredPending(now);
  summary.superseded += expired.modifiedCount || 0;
  await deadLetterExhaustedPending(now);
  // Verification is a shared, coalesced startup barrier. Safe durable
  // maintenance still runs while SMTP is unavailable, but no record is leased
  // (and therefore no attempt/configuration failure is persisted) until health
  // is known and fresh.
  const emailHealth = await refreshEmailDeliveryHealth();
  if (!emailHealth.configured) return summary;
  for (let index = 0; index < Math.max(1, Math.min(100, Number(limit) || 50)); index += 1) {
    // A slow batch can outlive the verification TTL. Refresh is coalesced and
    // returns from the healthy TTL cache in the normal case, so this guard is
    // cheap per record while still preventing a stale worker from leasing mail.
    const leaseHealth = await refreshEmailDeliveryHealth();
    if (!leaseHealth.configured || !leaseHealth.verified || leaseHealth.status !== "healthy") break;
    const leaseNow = new Date();
    const leased = await leaseNext({ workerId, now: leaseNow, leaseMs });
    if (!leased) break;
    summary.processed += 1;
    let phase = "pre_provider";
    let tokenLockAcquired = false;
    let retainTokenLock = false;
    let deliveryFenceAcquired = false;
    let retainDeliveryFence = false;
    const stopHeartbeat = startLeaseHeartbeat({
      record: leased,
      workerId,
      leaseMs,
    });
    try {
      const payload = decryptNotificationPayload(leased);
      const currentAt = new Date();
      if (!(await validateCurrentPayload(payload, currentAt))) {
        const result = await supersedeRecord(leased, new Date());
        if (result.modifiedCount === 1) summary.superseded += 1;
        continue;
      }
      // Everything above this line is safe preflight: decryption, lifecycle
      // validation, settings and template creation. Only the prepared send
      // function is allowed to touch the SMTP transport.
      const prepared = await provider({
        ...payload,
        correlationKey: leased.dedupeKey,
      });
      if (!prepared || typeof prepared.send !== "function") {
        throw Object.assign(new Error("Notification provider preflight failed."), {
          code: "EMAIL_CONFIGURATION_ERROR",
        });
      }
      tokenLockAcquired = await acquireTokenDeliveryLock({
        record: leased,
        workerId,
        now: new Date(),
        leaseMs,
      });
      if (!tokenLockAcquired) {
        // Lock contention is not evidence that the payload is stale. Revalidate
        // lifecycle/token state and retry later when another live worker owns it.
        const lockCheckAt = new Date();
        const tokenOwner = leased.managementTokenFingerprint
          ? await Booking.findOne({
            _id: leased.booking,
            managementTokenHash: leased.managementTokenFingerprint,
            managementTokenRevokedAt: null,
            managementTokenExpiresAt: { $gt: lockCheckAt },
          }).select("_id").lean()
          : true;
        const stillCurrent = Boolean(tokenOwner) &&
          await validateCurrentPayload(payload, lockCheckAt);
        if (stillCurrent) {
          await requeueAfterLockContention(leased, workerId, new Date());
        } else {
          const result = await supersedeRecord(leased, new Date());
          if (result.modifiedCount === 1) summary.superseded += 1;
        }
        continue;
      }
      deliveryFenceAcquired = await acquireNotificationDeliveryFence({
        record: leased,
        payload,
        workerId,
        now: new Date(),
        leaseMs,
      });
      if (!deliveryFenceAcquired) {
        const fenceCheckAt = new Date();
        if (await validateCurrentPayload(payload, fenceCheckAt)) {
          await requeueAfterLockContention(leased, workerId, fenceCheckAt);
        } else {
          const result = await supersedeRecord(leased, fenceCheckAt);
          if (result.modifiedCount === 1) summary.superseded += 1;
        }
        continue;
      }
      const started = await NotificationOutbox.collection.updateOne(
        {
          _id: leased._id,
          status: "processing",
          leaseOwner: workerId,
          deliveryPhase: "leased",
          bookingRevision: leased.bookingRevision || 0,
        },
        { $set: { deliveryPhase: "provider_started", updatedAt: new Date() } },
      );
      if (started.modifiedCount !== 1) continue;
      phase = "provider_started";
      const result = await withAmbiguousTimeout(prepared.send(), Math.max(1, providerTimeoutMs));
      if (!result?.sent) throw new Error("Provider did not confirm delivery.");
      // From this exact in-memory boundary onward, retry is forbidden. Persist
      // the boundary before the final sent write so crash recovery is equally
      // conservative.
      phase = "provider_accepted";
      const acceptedAt = new Date();
      const accepted = await NotificationOutbox.collection.updateOne(
        { _id: leased._id, status: "processing", leaseOwner: workerId },
        { $set: { deliveryPhase: "provider_accepted", updatedAt: acceptedAt } },
      );
      if (accepted.modifiedCount !== 1) throw new DeliveryUnknownError();
      const providerMessageId = normalizeProviderMessageId(result.messageId, leased.dedupeKey);
      const sentAt = new Date();
      const resultUpdate = await NotificationOutbox.collection.updateOne(
        { _id: leased._id, status: "processing", leaseOwner: workerId },
        {
          $set: {
            status: "sent", sentAt, providerMessageId, errorCategory: "", failureDisposition: "", lastError: "",
            nextAttemptAt: null, payloadPurgedAt: sentAt, updatedAt: sentAt,
          },
          $unset: {
            leaseOwner: "", leaseExpiresAt: "", deliveryPhase: "", payloadCiphertext: "", payloadIv: "",
            payloadAuthTag: "", encryptionKeyVersion: "",
          },
        },
      );
      if (resultUpdate.modifiedCount !== 1) throw new DeliveryUnknownError();
      summary.sent += 1;
    } catch (error) {
      const failedAt = new Date();
      const providerOutcome = phase === "provider_started"
        ? classifyProviderOutcome(error)
        : phase === "provider_accepted" ? "delivery_unknown" : null;
      if (error?.code === "DELIVERY_UNKNOWN" || providerOutcome === "delivery_unknown" || phase === "provider_accepted") {
        retainTokenLock = true;
        // A timed-out SMTP promise is still running underneath the local
        // timeout. Keep the mutation fence until its bounded database expiry;
        // releasing it here would let cancellation/reschedule cross an active,
        // unknowable provider boundary.
        retainDeliveryFence = true;
        const unknownUpdate = await markDeliveryUnknown(leased, workerId, failedAt);
        if (unknownUpdate.modifiedCount === 1) summary.deliveryUnknown += 1;
        continue;
      }
      const dead = providerOutcome === "terminal" || leased.attempts >= leased.maxAttempts;
      const classified = classifyError(error);
      const category = phase === "provider_started" && classified === "unknown"
        ? "provider"
        : classified;
      const disposition = providerOutcome === "retryable"
        ? "retryable"
        : providerOutcome === "terminal"
          ? "terminal"
          : category === "security"
            ? "security"
            : category === "configuration"
              ? "configuration"
              : "retryable";
      const resultUpdate = await NotificationOutbox.updateOne(
        { _id: leased._id, status: "processing", leaseOwner: workerId },
        {
          $set: {
            status: dead ? "dead" : "failed",
            errorCategory: category,
            failureDisposition: disposition,
            lastError: ERROR_COPY[category],
            nextAttemptAt: dead ? null : new Date(failedAt.getTime() + backoff(leased.attempts)),
            payloadPurgeAt: dead ? new Date(failedAt.getTime() + DEAD_PAYLOAD_RETENTION_MS) : null,
          },
          $unset: { leaseOwner: "", leaseExpiresAt: "", deliveryPhase: "" },
        },
      );
      if (resultUpdate.modifiedCount === 1) summary[dead ? "dead" : "failed"] += 1;
    } finally {
      await stopHeartbeat();
      if (deliveryFenceAcquired && !retainDeliveryFence) {
        await releaseNotificationDeliveryFence({ record: leased, workerId }).catch(() => {});
      }
      if (tokenLockAcquired && !retainTokenLock) {
        await releaseTokenDeliveryLock({ record: leased, workerId }).catch(() => {});
      }
    }
  }
  return summary;
};

export const createNotificationOutboxRunner = ({ processor = processNotificationOutbox } = {}) => {
  let active = null;
  const run = () => {
    if (active) return active;
    active = Promise.resolve(processor()).finally(() => { active = null; });
    return active;
  };
  run.waitForIdle = async ({ timeoutMs = 25_000 } = {}) => {
    if (!active) return true;
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), Math.max(1, timeoutMs));
      timer.unref?.();
    });
    const completed = await Promise.race([active.then(() => true, () => true), timeout]);
    clearTimeout(timer);
    return completed;
  };
  return run;
};
