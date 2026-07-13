// `null` deliberately matches both new documents and legacy documents where
// the additive soft-delete field does not exist yet.
export const ACTIVE_BOOKING_FILTER = Object.freeze({ deletedAt: null });

export const TRASHED_BOOKING_FILTER = Object.freeze({
  deletedAt: { $type: "date" },
});

export const withActiveBooking = (filter = {}) => ({
  ...filter,
  ...ACTIVE_BOOKING_FILTER,
});

export const withTrashedBooking = (filter = {}) => ({
  ...filter,
  ...TRASHED_BOOKING_FILTER,
});
