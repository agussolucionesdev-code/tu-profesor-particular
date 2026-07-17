import AuditEvent from "../models/AuditEvent.js";
import Booking from "../models/Booking.js";
import {
  SLOT_MUTATION_LOCK_MS,
  SLOT_MUTATION_LEASE_SAFETY_MARGIN_MS,
} from "../config/bookingMutationLease.js";

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const AUDIT_WRITE_TIMEOUT_MS = Math.min(
  parsePositiveInteger(process.env.AUDIT_WRITE_TIMEOUT_MS, 5_000),
  SLOT_MUTATION_LOCK_MS - SLOT_MUTATION_LEASE_SAFETY_MARGIN_MS,
);

if (AUDIT_WRITE_TIMEOUT_MS >= SLOT_MUTATION_LOCK_MS) {
  throw new Error("AUDIT_WRITE_TIMEOUT_MS must be strictly shorter than the booking lock lease.");
}

export const writeAuditDocument = ({ document, timeoutMS = AUDIT_WRITE_TIMEOUT_MS }) =>
  AuditEvent.collection.insertOne(document, { timeoutMS });

let auditWriter = writeAuditDocument;

export class AmbiguousAuditWriteError extends Error {
  constructor(writeError, readbackError) {
    super("Audit write outcome is ambiguous; durable pending audit retained for recovery.", {
      cause: writeError,
    });
    this.name = "AmbiguousAuditWriteError";
    this.writeError = writeError;
    this.readbackError = readbackError;
  }
}

export const isAmbiguousAuditWriteError = (error) =>
  error instanceof AmbiguousAuditWriteError;

// Tests inject a writer that honors the same timeout contract. Returning a
// reset callback prevents one fault-injection test from leaking into another.
export const setAuditWriterForTests = (writer) => {
  if (typeof writer !== "function") throw new TypeError("Audit writer must be a function.");
  const previous = auditWriter;
  auditWriter = writer;
  return () => {
    auditWriter = previous;
  };
};

const AUDITED_BOOKING_FIELDS = [
  "_id",
  "bookingCode",
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
  "timeSlot",
  "endTime",
  "duration",
  "bufferBeforeMinutes",
  "bufferAfterMinutes",
  "price",
  "notes",
  "studentNotes",
  "studentEvolution",
  "emotionalState",
  "status",
  "attendanceStatus",
  "attendanceRecordedAt",
  "attendanceNotes",
  "attendanceUpdatedBy",
  "studentId",
  "studentLink",
  "deletedAt",
  "deletedBy",
  "createdAt",
  "updatedAt",
];

export const sanitizeBookingForAudit = (booking) => {
  const source = typeof booking?.toObject === "function" ? booking.toObject() : booking;
  return Object.fromEntries(
    AUDITED_BOOKING_FIELDS
      .filter((field) => source?.[field] !== undefined)
      .map((field) => [field, source[field]]),
  );
};

export const buildPendingBookingAudit = ({
  req,
  action,
  before,
  after,
  operationId,
  createdAt = new Date(),
}) => ({
  operationId,
  actor: {
    id: req.user.id,
    role: req.user.role,
    username: req.user.username,
  },
  action,
  before: sanitizeBookingForAudit(before),
  after: sanitizeBookingForAudit(after),
  meta: {
    requestId: req.requestId,
    entityType: "Booking",
    createdAt,
  },
});

const pendingAuditEvent = ({ bookingId, pendingAudit }) => new AuditEvent({
  actor: pendingAudit.actor,
  action: pendingAudit.action,
  entityType: pendingAudit.meta.entityType,
  entityId: bookingId,
  requestId: pendingAudit.meta.requestId,
  operationId: pendingAudit.operationId,
  before: pendingAudit.before ?? {},
  after: pendingAudit.after ?? {},
  createdAt: pendingAudit.meta.createdAt,
});

const findCommittedPendingAudit = ({ bookingId, pendingAudit }) =>
  AuditEvent.collection.findOne({
    action: pendingAudit.action,
    operationId: pendingAudit.operationId,
    entityType: pendingAudit.meta.entityType,
    entityId: bookingId,
  });

export const materializePendingBookingAudit = async ({
  bookingId,
  pendingAudit,
  leaseExpiresAt = null,
}) => {
  const alreadyCommitted = await findCommittedPendingAudit({ bookingId, pendingAudit });
  if (alreadyCommitted) return alreadyCommitted;

  const event = pendingAuditEvent({ bookingId, pendingAudit });
  await event.validate();
  const document = event.toObject({ depopulate: true, versionKey: false });
  let timeoutMS = AUDIT_WRITE_TIMEOUT_MS;
  if (leaseExpiresAt) {
    const leaseRemainingMS = new Date(leaseExpiresAt).getTime() - Date.now();
    timeoutMS = Math.min(
      AUDIT_WRITE_TIMEOUT_MS,
      leaseRemainingMS - SLOT_MUTATION_LEASE_SAFETY_MARGIN_MS,
    );
    if (!Number.isFinite(timeoutMS) || timeoutMS <= 0) {
      throw new Error("Booking mutation lease is too close to expiry for an audit write.");
    }
  }

  try {
    await auditWriter({ document, timeoutMS });
  } catch (error) {
    // Both a network timeout after commit and a concurrent recovery can make
    // the insert look failed. The operation id is the durable idempotency key.
    let committed;
    try {
      committed = await findCommittedPendingAudit({ bookingId, pendingAudit });
    } catch (readbackError) {
      throw new AmbiguousAuditWriteError(error, readbackError);
    }
    if (!committed) throw error;
    return committed;
  }
  return event;
};

export const recordBookingAudit = async ({
  req,
  action,
  bookingId,
  before,
  after,
  leaseExpiresAt,
  operationId = null,
  pendingAudit = null,
}) => {
  if (pendingAudit) {
    return materializePendingBookingAudit({ bookingId, pendingAudit, leaseExpiresAt });
  }
  const createdAt = new Date();
  const event = new AuditEvent({
    actor: {
      id: req.user.id,
      role: req.user.role,
      username: req.user.username,
    },
    action,
    entityType: "Booking",
    entityId: bookingId,
    requestId: req.requestId,
    operationId,
    before: sanitizeBookingForAudit(before),
    after: sanitizeBookingForAudit(after),
    createdAt,
  });

  await event.validate();
  const document = event.toObject({ depopulate: true, versionKey: false });
  const leaseRemainingMS = new Date(leaseExpiresAt).getTime() - Date.now();
  const timeoutMS = Math.min(
    AUDIT_WRITE_TIMEOUT_MS,
    leaseRemainingMS - SLOT_MUTATION_LEASE_SAFETY_MARGIN_MS,
  );
  if (!Number.isFinite(timeoutMS) || timeoutMS <= 0) {
    throw new Error("Booking mutation lease is too close to expiry for an audit write.");
  }

  try {
    await auditWriter({ document, timeoutMS });
  } catch (error) {
    // A driver timeout can be ambiguous if the server committed immediately
    // before the client observed the timeout. The deterministic _id lets us
    // recognize that committed event instead of compensating a valid write.
    let committed;
    try {
      committed = await AuditEvent.collection.findOne(
        { _id: document._id },
        { timeoutMS: Math.min(1_000, SLOT_MUTATION_LEASE_SAFETY_MARGIN_MS) },
      );
    } catch (readbackError) {
      throw new AmbiguousAuditWriteError(error, readbackError);
    }
    if (!committed) throw error;
  }

  return event;
};

let pendingAuditReconciliation = null;

const runPendingBookingAuditReconciliation = async ({ limit = 100 } = {}) => {
  const batchSize = Math.max(1, Math.min(500, Number(limit) || 100));
  const summary = { scanned: 0, committed: 0, failed: 0 };
  let cursor = null;
  for (let batch = 0; batch < 1_000; batch += 1) {
    const bookings = await Booking.find({
      $and: [
        { "pendingAudit.operationId": { $type: "string" } },
        ...(cursor ? [{ _id: { $gt: cursor } }] : []),
        {
          $or: [
            { slotMutationLock: null },
            { slotMutationLock: { $exists: false } },
            {
              $expr: {
                $lte: [
                  { $ifNull: ["$slotMutationLockExpiresAt", new Date(0)] },
                  "$$NOW",
                ],
              },
            },
          ],
        },
      ],
    })
      .select("+pendingAudit")
      .sort({ _id: 1 })
      .limit(batchSize);
    if (!bookings.length) break;
    for (const booking of bookings) {
      cursor = booking._id;
      summary.scanned += 1;
      const descriptor = booking.pendingAudit?.toObject?.({ depopulate: true }) ?? booking.pendingAudit;
      if (!descriptor?.operationId) continue;
      try {
        await materializePendingBookingAudit({ bookingId: booking._id, pendingAudit: descriptor });
        const cleared = await Booking.collection.updateOne(
          { _id: booking._id, "pendingAudit.operationId": descriptor.operationId },
          { $unset: { pendingAudit: "" } },
        );
        if (cleared.modifiedCount === 1) summary.committed += 1;
      } catch (error) {
        summary.failed += 1;
        console.error("[audit-recovery]", JSON.stringify({
          bookingId: String(booking._id),
          operationId: descriptor.operationId,
          message: "Pending booking audit remains durable for retry.",
        }));
      }
    }
    if (bookings.length < batchSize) break;
  }
  return summary;
};

export const reconcilePendingBookingAudits = (options = {}) => {
  if (pendingAuditReconciliation) return pendingAuditReconciliation;
  pendingAuditReconciliation = runPendingBookingAuditReconciliation(options)
    .finally(() => { pendingAuditReconciliation = null; });
  return pendingAuditReconciliation;
};

const sanitizeSubjectsSettingsForAudit = (snapshot) => ({
  key: "booking.subjectsByLevel",
  revision: Number.isSafeInteger(snapshot?.revision) ? snapshot.revision : 0,
  mode: snapshot?.mode === "custom" ? "custom" : "default",
  levels: Array.isArray(snapshot?.levels)
    ? snapshot.levels.map((entry) => ({
      level: String(entry?.level || ""),
      subjects: Array.isArray(entry?.subjects)
        ? entry.subjects.map((subject) => String(subject))
        : [],
    }))
    : [],
});

export const recordSubjectsSettingsAudit = async ({
  req,
  settingsId,
  before,
  after,
  leaseExpiresAt,
}) => {
  const event = new AuditEvent({
    actor: {
      id: req.user.id,
      role: req.user.role,
      username: req.user.username,
    },
    action: "settings.subjects.updated",
    entityType: "AppSettings",
    entityId: settingsId,
    requestId: req.requestId,
    before: sanitizeSubjectsSettingsForAudit(before),
    after: sanitizeSubjectsSettingsForAudit(after),
    createdAt: new Date(),
  });

  await event.validate();
  const document = event.toObject({ depopulate: true, versionKey: false });
  const leaseRemainingMS = new Date(leaseExpiresAt).getTime() - Date.now();
  const timeoutMS = Math.min(
    AUDIT_WRITE_TIMEOUT_MS,
    leaseRemainingMS - SLOT_MUTATION_LEASE_SAFETY_MARGIN_MS,
  );
  if (!Number.isFinite(timeoutMS) || timeoutMS <= 0) {
    throw new Error("Settings mutation lease is too close to expiry for an audit write.");
  }

  try {
    await auditWriter({ document, timeoutMS });
  } catch (error) {
    const committed = await AuditEvent.collection.findOne(
      { _id: document._id },
      { timeoutMS: Math.min(1_000, SLOT_MUTATION_LEASE_SAFETY_MARGIN_MS) },
    ).catch(() => null);
    if (!committed) throw error;
  }

  return event;
};
