const BOOKING_INDEXES = [
  { key: { deletedAt: 1 }, name: "deletedAt_1" },
  {
    key: { deletedAt: 1, timeSlot: -1 },
    name: "deletedAt_1_timeSlot_-1",
  },
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
  ]);

  console.info("DATABASE: operational indexes verified.");
};

export const OPERATIONAL_INDEXES = Object.freeze({
  bookings: BOOKING_INDEXES,
  auditEvents: AUDIT_EVENT_INDEXES,
});
