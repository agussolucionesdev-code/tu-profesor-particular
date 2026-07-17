// `null` deliberately matches both new documents and legacy documents where
// the additive soft-delete field does not exist yet.
export const ACTIVE_BOOKING_FILTER = Object.freeze({
  deletedAt: null,
  // Missing is the legacy active value. Draft/abandoned documents are never
  // exposed as bookings and rely on BookingSlot's unique index while claiming.
  creationState: { $nin: ["claiming", "abandoned"] },
});

export const SLOT_OWNING_BOOKING_FILTER = Object.freeze({
  ...ACTIVE_BOOKING_FILTER,
  status: { $nin: ["Cancelado", "Finalizado"] },
});

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
