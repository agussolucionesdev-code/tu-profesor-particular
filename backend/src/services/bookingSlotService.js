import BookingSlot from "../models/BookingSlot.js";

export class BookingSlotConflictError extends Error {
  constructor() {
    super("Horario ocupado.");
    this.name = "BookingSlotConflictError";
  }
}

const SLOT_MS = 60 * 1000;

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
      const existing = await BookingSlot.findOne({ slotStart })
        .select("booking")
        .lean();

      if (existing) {
        if (String(existing.booking) === String(bookingId)) continue;
        throw new BookingSlotConflictError();
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
      await BookingSlot.deleteMany({ _id: { $in: insertedSlotIds } });
    }
    throw error;
  }
};

export const releaseBookingSlots = async (bookingId) =>
  BookingSlot.deleteMany({ booking: bookingId });

export const clearBookingSlots = async () => BookingSlot.deleteMany({});

export const releaseBookingSlotsExcept = async (bookingId, slotStarts) =>
  BookingSlot.deleteMany({
    booking: bookingId,
    slotStart: { $nin: slotStarts },
  });

export const releaseClaimedBookingSlots = async (insertedSlotIds) => {
  if (!insertedSlotIds?.length) return;
  await BookingSlot.deleteMany({ _id: { $in: insertedSlotIds } });
};
