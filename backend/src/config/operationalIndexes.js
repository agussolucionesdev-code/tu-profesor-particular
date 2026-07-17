const BOOKING_INDEXES = [
  { key: { deletedAt: 1 }, name: "deletedAt_1" },
  {
    key: { deletedAt: 1, timeSlot: -1 },
    name: "deletedAt_1_timeSlot_-1",
  },
  {
    key: { deletedAt: 1, status: 1, timeSlot: 1, _id: 1 },
    name: "deletedAt_1_status_1_timeSlot_1__id_1",
  },
  { key: { studentId: 1, timeSlot: -1 }, name: "studentId_1_timeSlot_-1" },
  { key: { "studentLink.runId": 1 }, name: "studentLink.runId_1" },
  {
    key: { "notificationIntents.managementTokenFingerprint": 1 },
    name: "notificationIntents_managementTokenFingerprint_active",
    partialFilterExpression: {
      "notificationIntents.managementTokenFingerprint": { $type: "string" },
    },
  },
  {
    key: { "pendingAudit.operationId": 1 },
    name: "pendingAudit_operationId_recovery",
    partialFilterExpression: { "pendingAudit.operationId": { $type: "string" } },
  },
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
  {
    key: { action: 1, operationId: 1 },
    name: "action_1_operationId_1",
    unique: true,
    partialFilterExpression: { operationId: { $type: "string" } },
  },
];

const NOTIFICATION_OUTBOX_INDEXES = [
  { key: { dedupeKey: 1 }, name: "dedupeKey_1", unique: true },
  {
    key: { status: 1, nextAttemptAt: 1, createdAt: 1 },
    name: "status_1_nextAttemptAt_1_createdAt_1",
  },
  {
    key: { status: 1, nextAttemptAt: 1, expiresAt: 1, createdAt: 1 },
    name: "status_1_nextAttemptAt_1_expiresAt_1_createdAt_1",
  },
  {
    key: { status: 1, type: 1, createdAt: -1 },
    name: "status_1_type_1_createdAt_-1",
  },
  { key: { booking: 1, createdAt: -1 }, name: "booking_1_createdAt_-1" },
  {
    key: { booking: 1, managementTokenFingerprint: 1, status: 1 },
    name: "booking_tokenFingerprint_active",
    partialFilterExpression: {
      managementTokenFingerprint: { $type: "string" },
      status: { $in: ["queued", "processing", "delivery_unknown", "failed", "dead"] },
    },
  },
  {
    key: { retryOperationState: 1, _id: 1 },
    name: "retryOperationState_active__id",
    partialFilterExpression: {
      retryOperationState: { $in: ["requested", "committed", "failed"] },
    },
  },
];

const MANAGEMENT_LINK_REQUEST_INDEXES = [
  { key: { requestKey: 1 }, name: "requestKey_1", unique: true },
  {
    key: { status: 1, nextAttemptAt: 1, createdAt: 1 },
    name: "status_1_nextAttemptAt_1_createdAt_1",
  },
  { key: { expiresAt: 1 }, name: "expiresAt_1", expireAfterSeconds: 0 },
];

const BOOKING_SLOT_INDEXES = [
  { key: { slotStart: 1 }, name: "slotStart_1", unique: true },
  { key: { booking: 1, slotStart: 1 }, name: "booking_1_slotStart_1", unique: true },
  {
    key: { booking: 1, claimGeneration: 1, slotStart: 1 },
    name: "booking_1_claimGeneration_1_slotStart_1",
  },
  {
    key: { booking: 1, scheduleRevision: 1, slotStart: 1 },
    name: "booking_1_scheduleRevision_1_slotStart_1",
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
    connection.collection("notificationoutboxes").createIndexes(NOTIFICATION_OUTBOX_INDEXES),
    connection.collection("managementlinkrequests").createIndexes(MANAGEMENT_LINK_REQUEST_INDEXES),
    connection.collection("bookingslots").createIndexes(BOOKING_SLOT_INDEXES),
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
  notificationOutboxes: NOTIFICATION_OUTBOX_INDEXES,
  managementLinkRequests: MANAGEMENT_LINK_REQUEST_INDEXES,
  bookingSlots: BOOKING_SLOT_INDEXES,
  students: STUDENT_INDEXES,
  studentIdentityEvents: STUDENT_IDENTITY_EVENT_INDEXES,
  studentMigrationRuns: STUDENT_MIGRATION_RUN_INDEXES,
  studentMigrationDryRunObservations: STUDENT_MIGRATION_DRY_RUN_OBSERVATION_INDEXES,
});
