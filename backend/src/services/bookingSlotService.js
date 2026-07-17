import BookingSlot from "../models/BookingSlot.js";
import Booking from "../models/Booking.js";
import crypto from "node:crypto";

export class BookingSlotConflictError extends Error {
  constructor() {
    super("Horario ocupado.");
    this.name = "BookingSlotConflictError";
  }
}

const SLOT_MS = 60 * 1000;
const SLOT_CLEANUP_ATTEMPTS = 3;

const cleanupLog = ({ level = "error", operation, bookingId, attempt, error }) => {
  const payload = {
    event: "booking_slot_cleanup_failed",
    operation,
    bookingId: bookingId ? String(bookingId) : null,
    attempt,
    maxAttempts: SLOT_CLEANUP_ATTEMPTS,
    error: error?.message || String(error),
  };
  console[level]("[booking-slot-reconciliation]", JSON.stringify(payload));
};

const deleteManyWithRetry = async ({ filter, operation, bookingId = null }) => {
  let lastError = null;

  for (let attempt = 1; attempt <= SLOT_CLEANUP_ATTEMPTS; attempt += 1) {
    try {
      const result = await BookingSlot.deleteMany(filter);
      if (attempt > 1) {
        console.info("[booking-slot-reconciliation]", JSON.stringify({
          event: "booking_slot_cleanup_recovered",
          operation,
          bookingId: bookingId ? String(bookingId) : null,
          attempt,
        }));
      }
      return { acknowledged: true, pending: false, result };
    } catch (error) {
      lastError = error;
      cleanupLog({
        level: attempt === SLOT_CLEANUP_ATTEMPTS ? "error" : "warn",
        operation,
        bookingId,
        attempt,
        error,
      });
    }
  }

  // The Booking document is authoritative. A stale lock that survives all
  // bounded retries is evicted lazily by claimBookingSlots below, so a
  // transient cleanup outage cannot permanently block the calendar.
  return { acknowledged: false, pending: true, error: lastError };
};

const isStaleBookingSlot = async (slot) => {
  const owner = await Booking.findById(slot.booking)
    .select("status timeSlot endTime bufferBeforeMinutes bufferAfterMinutes deletedAt +creationState +slotMutationLock +slotMutationLockExpiresAt")
    .lean();

  if (!owner) {
    // New reservations persist a fenced draft before claiming. Therefore an
    // absent owner is unambiguously orphaned; no wall-clock grace/race exists.
    return true;
  }

  if (owner.creationState === "abandoned") return true;

  if (owner.creationState === "claiming") {
    // The database clock both expires the creator and makes that decision
    // durable. A stalled creator's later activation CAS can no longer win.
    const abandoned = await Booking.collection.findOneAndUpdate(
      {
        _id: owner._id,
        creationState: "claiming",
        slotMutationLock: owner.slotMutationLock,
        $expr: {
          $lte: [
            { $ifNull: ["$slotMutationLockExpiresAt", new Date(0)] },
            "$$NOW",
          ],
        },
      },
      { $set: { creationState: "abandoned" } },
      { returnDocument: "after", projection: { _id: 1, creationState: 1 } },
    );
    const abandonedDocument = abandoned && Object.prototype.hasOwnProperty.call(abandoned, "value")
      ? abandoned.value
      : abandoned;
    if (abandonedDocument?.creationState === "abandoned") return true;

    const current = await Booking.collection.findOne(
      { _id: owner._id },
      { projection: { creationState: 1 } },
    );
    return current?.creationState === "abandoned";
  }

  if (
    owner.slotMutationLockExpiresAt &&
    new Date(owner.slotMutationLockExpiresAt).getTime() > Date.now()
  ) {
    return false;
  }

  if (owner.deletedAt || ["Cancelado", "Finalizado"].includes(owner.status)) return true;

  const slotStart = new Date(slot.slotStart).getTime();
  const authoritativeStart = new Date(owner.timeSlot).getTime()
    - Number(owner.bufferBeforeMinutes || 0) * 60 * 1000;
  const authoritativeEnd = new Date(owner.endTime).getTime()
    + Number(owner.bufferAfterMinutes || 0) * 60 * 1000;

  return (
    !Number.isFinite(authoritativeStart) ||
    !Number.isFinite(authoritativeEnd) ||
    slotStart < authoritativeStart ||
    slotStart >= authoritativeEnd
  );
};

const evictStaleSlot = async (slot) => {
  if (!(await isStaleBookingSlot(slot))) return false;

  const result = await BookingSlot.deleteOne({
    _id: slot._id,
    booking: slot.booking,
    slotStart: slot.slotStart,
    ...(Object.prototype.hasOwnProperty.call(slot, "claimGeneration")
      ? { claimGeneration: slot.claimGeneration }
      : { claimGeneration: { $exists: false } }),
    ...(Object.prototype.hasOwnProperty.call(slot, "claimToken")
      ? { claimToken: slot.claimToken }
      : { claimToken: { $exists: false } }),
  });
  if (result.deletedCount === 1) {
    console.info("[booking-slot-reconciliation]", JSON.stringify({
      event: "booking_slot_phantom_reconciled",
      bookingId: String(slot.booking),
      slotStart: new Date(slot.slotStart).toISOString(),
    }));
    return true;
  }

  return false;
};

export const getBookingSlotStarts = ({ startTime, endTime, slotDurationMinutes }) => {
  const slotMs = Number(slotDurationMinutes) * SLOT_MS;
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();

  if (
    !Number.isFinite(slotMs) ||
    slotMs <= 0 ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs ||
    (endMs - startMs) % slotMs !== 0
  ) {
    throw new Error("La reserva no coincide con la granularidad configurada.");
  }

  return Array.from(
    { length: (endMs - startMs) / slotMs },
    (_, index) => new Date(startMs + index * slotMs),
  );
};

const isDuplicateKeyError = (error) => error?.code === 11000;
const normalizedGeneration = (value) => {
  const generation = Number(value);
  return Number.isSafeInteger(generation) && generation >= 0 ? generation : 0;
};

const observedOwnershipFilter = (slot) => ({
  _id: slot._id,
  booking: slot.booking,
  ...(Object.prototype.hasOwnProperty.call(slot, "claimGeneration")
    ? { claimGeneration: slot.claimGeneration }
    : { claimGeneration: { $exists: false } }),
  ...(Object.prototype.hasOwnProperty.call(slot, "claimToken")
    ? { claimToken: slot.claimToken }
    : { claimToken: { $exists: false } }),
});

const claimDescriptor = ({ slot, bookingId, generation, claimToken }) => ({
  _id: slot._id,
  booking: bookingId,
  slotStart: slot.slotStart,
  claimGeneration: generation,
  claimToken,
});

const descriptorFilter = (descriptor) => ({
  _id: descriptor._id,
  booking: descriptor.booking,
  claimGeneration: normalizedGeneration(descriptor.claimGeneration),
  claimToken: descriptor.claimToken,
});

// Claiming each block through its unique index is safe on a standalone Mongo
// server too. A transaction can improve cleanup, but is not required for the
// no-double-booking invariant enforced by the unique slotStart index.
export const claimBookingSlots = async ({
  bookingId,
  slotStarts,
  slotDurationMinutes,
  claimGeneration = 0,
}) => {
  const insertedSlotIds = [];
  const insertedSlots = [];
  const claimedSlots = [];
  const generation = normalizedGeneration(claimGeneration);
  const claimToken = crypto.randomUUID();

  try {
    for (const slotStart of slotStarts) {
      let claimed = false;
      for (let attempt = 0; attempt < 8 && !claimed; attempt += 1) {
        const existing = await BookingSlot.findOne({ slotStart })
          .select("booking slotStart createdAt claimGeneration claimToken")
          .lean();

        if (!existing) {
          try {
            const slot = await BookingSlot.create({
              booking: bookingId,
              slotStart,
              slotDurationMinutes,
              scheduleRevision: generation,
              claimGeneration: generation,
              claimToken,
            });
            const descriptor = claimDescriptor({ slot, bookingId, generation, claimToken });
            insertedSlotIds.push(slot._id);
            insertedSlots.push(descriptor);
            claimedSlots.push(descriptor);
            claimed = true;
            continue;
          } catch (error) {
            if (isDuplicateKeyError(error)) continue;
            throw error;
          }
        }

        if (String(existing.booking) === String(bookingId)) {
          if (normalizedGeneration(existing.claimGeneration) > generation) {
            throw new BookingSlotConflictError();
          }
          const adopted = await BookingSlot.collection.updateOne(
            observedOwnershipFilter(existing),
            { $set: { claimGeneration: generation, scheduleRevision: generation, claimToken } },
          );
          if (adopted.modifiedCount === 1) {
            claimedSlots.push(claimDescriptor({
              slot: existing,
              bookingId,
              generation,
              claimToken,
            }));
            claimed = true;
          }
          // A failed CAS means another operation adopted the document between
          // read and write. Re-read and either adopt that exact observation or
          // abort if it advanced beyond this generation.
          continue;
        }

        if (!(await evictStaleSlot(existing))) throw new BookingSlotConflictError();
      }
      if (!claimed) throw new BookingSlotConflictError();
    }

    return {
      insertedSlotIds,
      insertedSlots,
      claimedSlots,
      claimGeneration: generation,
      claimToken,
    };
  } catch (error) {
    if (insertedSlots.length > 0) {
      await deleteManyWithRetry({
        filter: { $or: insertedSlots.map(descriptorFilter) },
        operation: "compensate-partial-claim",
        bookingId,
      });
    }
    throw error;
  }
};

export const releaseBookingSlots = async (bookingId, claimGeneration = 0) =>
  deleteManyWithRetry({
    filter: {
      booking: bookingId,
      $or: [
        { claimGeneration: { $exists: false } },
        { claimGeneration: { $lte: normalizedGeneration(claimGeneration) } },
      ],
    },
    operation: "release-all",
    bookingId,
  });

export const releaseBookingSlotsExcept = async (
  bookingId,
  slotStarts,
  claimGeneration = 0,
) =>
  deleteManyWithRetry({
    filter: {
      booking: bookingId,
      slotStart: { $nin: slotStarts },
      $or: [
        { claimGeneration: { $exists: false } },
        { claimGeneration: { $lte: normalizedGeneration(claimGeneration) } },
      ],
    },
    operation: "release-except",
    bookingId,
  });

export const releaseClaimedBookingSlots = async (claims) => {
  const descriptors = Array.isArray(claims)
    ? claims
    : claims?.insertedSlots;
  if (!descriptors?.length) return;
  return deleteManyWithRetry({
    filter: { $or: descriptors.map(descriptorFilter) },
    operation: "release-claimed",
  });
};
