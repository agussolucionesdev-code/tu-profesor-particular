import BookingSlot from "../models/BookingSlot.js";
import Booking from "../models/Booking.js";

export class BookingSlotConflictError extends Error {
  constructor() {
    super("Horario ocupado.");
    this.name = "BookingSlotConflictError";
  }
}

const SLOT_MS = 60 * 1000;
const SLOT_CLEANUP_ATTEMPTS = 3;
const ORPHAN_SLOT_GRACE_MS = Number(
  process.env.BOOKING_SLOT_ORPHAN_GRACE_MS || 60 * 1000,
);

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
    .select("status timeSlot endTime bufferBeforeMinutes bufferAfterMinutes deletedAt slotMutationLockExpiresAt")
    .lean();

  if (!owner) {
    // A new reservation claims slots immediately before saving its Booking.
    // The grace period prevents another request from deleting those in-flight
    // claims, while still making hard-delete orphans recoverable.
    return Date.now() - new Date(slot.createdAt).getTime() >= ORPHAN_SLOT_GRACE_MS;
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

// Claiming each block through its unique index is safe on a standalone Mongo
// server too. A transaction can improve cleanup, but is not required for the
// no-double-booking invariant enforced by the unique slotStart index.
export const claimBookingSlots = async ({
  bookingId,
  slotStarts,
  slotDurationMinutes,
}) => {
  const insertedSlotIds = [];

  try {
    for (const slotStart of slotStarts) {
      let existing = await BookingSlot.findOne({ slotStart })
        .select("booking slotStart createdAt")
        .lean();

      if (existing) {
        if (String(existing.booking) === String(bookingId)) continue;
        if (await evictStaleSlot(existing)) {
          existing = await BookingSlot.findOne({ slotStart })
            .select("booking slotStart createdAt")
            .lean();
        }
        if (existing) throw new BookingSlotConflictError();
      }

      try {
        const slot = await BookingSlot.create({
          booking: bookingId,
          slotStart,
          slotDurationMinutes,
        });
        insertedSlotIds.push(slot._id);
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new BookingSlotConflictError();
        throw error;
      }
    }

    return { insertedSlotIds };
  } catch (error) {
    if (insertedSlotIds.length > 0) {
      await deleteManyWithRetry({
        filter: { _id: { $in: insertedSlotIds } },
        operation: "compensate-partial-claim",
        bookingId,
      });
    }
    throw error;
  }
};

export const releaseBookingSlots = async (bookingId) =>
  deleteManyWithRetry({
    filter: { booking: bookingId },
    operation: "release-all",
    bookingId,
  });

export const clearBookingSlots = async () => deleteManyWithRetry({
  filter: {},
  operation: "clear-all",
});

export const releaseBookingSlotsExcept = async (bookingId, slotStarts) =>
  deleteManyWithRetry({
    filter: {
      booking: bookingId,
      slotStart: { $nin: slotStarts },
    },
    operation: "release-except",
    bookingId,
  });

export const releaseClaimedBookingSlots = async (insertedSlotIds) => {
  if (!insertedSlotIds?.length) return;
  return deleteManyWithRetry({
    filter: { _id: { $in: insertedSlotIds } },
    operation: "release-claimed",
  });
};
