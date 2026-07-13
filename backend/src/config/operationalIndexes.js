const BOOKING_INDEXES = [
  { key: { deletedAt: 1 }, name: "deletedAt_1" },
  {
    key: { deletedAt: 1, timeSlot: -1 },
    name: "deletedAt_1_timeSlot_-1",
  },
  { key: { studentId: 1, timeSlot: -1 }, name: "studentId_1_timeSlot_-1" },
  { key: { "studentLink.runId": 1 }, name: "studentLink.runId_1" },
];

const STUDENT_INDEXES = [
  {
    key: { identityKeys: 1 },
    name: "identityKeys_1",
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
  { key: { deletedAt: 1, normalizedName: 1 }, name: "deletedAt_1_normalizedName_1" },
  { key: { "contact.email": 1 }, name: "contact.email_1" },
  { key: { "contact.phoneDigits": 1 }, name: "contact.phoneDigits_1" },
  { key: { "responsible.normalizedName": 1 }, name: "responsible.normalizedName_1" },
];

const STUDENT_IDENTITY_EVENT_INDEXES = [
  { key: { bookingId: 1, createdAt: -1 }, name: "bookingId_1_createdAt_-1" },
  { key: { runId: 1, createdAt: -1 }, name: "runId_1_createdAt_-1" },
];

const STUDENT_MIGRATION_RUN_INDEXES = [
  { key: { runId: 1 }, name: "runId_1", unique: true },
];

const STUDENT_MIGRATION_DRY_RUN_OBSERVATION_INDEXES = [
  { key: { runId: 1, bookingId: 1 }, name: "runId_1_bookingId_1", unique: true },
  { key: { runId: 1, identityHashes: 1 }, name: "runId_1_identityHashes_1" },
];

const AUDIT_EVENT_INDEXES = [
  { key: { entityId: 1 }, name: "entityId_1" },
  {
    key: { entityType: 1, entityId: 1, createdAt: -1 },
    name: "entityType_1_entityId_1_createdAt_-1",
  },
  {
    key: { action: 1, createdAt: -1 },
    name: "action_1_createdAt_-1",
  },
];

// Native `createIndexes` is additive and idempotent when name/spec match.
// Never use `syncIndexes` here: it may drop unrelated production indexes.
export const ensureOperationalIndexes = async (connection) => {
  if (!connection || connection.readyState !== 1) {
    throw new Error("A connected MongoDB connection is required to provision indexes.");
  }

  await Promise.all([
    connection.collection("bookings").createIndexes(BOOKING_INDEXES),
    connection.collection("auditevents").createIndexes(AUDIT_EVENT_INDEXES),
    connection.collection("students").createIndexes(STUDENT_INDEXES),
    connection.collection("studentidentityevents").createIndexes(STUDENT_IDENTITY_EVENT_INDEXES),
    connection.collection("studentmigrationruns").createIndexes(STUDENT_MIGRATION_RUN_INDEXES),
    connection.collection("studentmigrationdryrunobservations").createIndexes(
      STUDENT_MIGRATION_DRY_RUN_OBSERVATION_INDEXES,
    ),
  ]);

  console.info("DATABASE: operational indexes verified.");
};

export const OPERATIONAL_INDEXES = Object.freeze({
  bookings: BOOKING_INDEXES,
  auditEvents: AUDIT_EVENT_INDEXES,
  students: STUDENT_INDEXES,
  studentIdentityEvents: STUDENT_IDENTITY_EVENT_INDEXES,
  studentMigrationRuns: STUDENT_MIGRATION_RUN_INDEXES,
  studentMigrationDryRunObservations: STUDENT_MIGRATION_DRY_RUN_OBSERVATION_INDEXES,
});
