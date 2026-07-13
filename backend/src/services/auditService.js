import AuditEvent from "../models/AuditEvent.js";
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

export const recordBookingAudit = async ({
  req,
  action,
  bookingId,
  before,
  after,
  leaseExpiresAt,
}) => {
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
    const committed = await AuditEvent.collection.findOne(
      { _id: document._id },
      { timeoutMS: Math.min(1_000, SLOT_MUTATION_LEASE_SAFETY_MARGIN_MS) },
    ).catch(() => null);
    if (!committed) throw error;
  }

  return event;
};
