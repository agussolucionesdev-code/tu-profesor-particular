import mongoose from "mongoose";

const bookingSlotSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
      immutable: true,
    },
    slotStart: {
      type: Date,
      required: true,
      immutable: true,
    },
    slotDurationMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 120,
      immutable: true,
    },
    // Monotonic ownership generation. Missing legacy values are generation 0.
    // Both names are persisted while older operational tooling migrates from
    // scheduleRevision to the explicit claimGeneration terminology.
    scheduleRevision: { type: Number, default: 0, min: 0, immutable: true },
    claimGeneration: { type: Number, default: 0, min: 0 },
    // Unique ownership nonce for one claim invocation. Generation orders
    // schedule mutations; this token prevents two operations in the same
    // generation from compensating each other's claims.
    claimToken: { type: String, default: null, maxlength: 80 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// This is the concurrency boundary: two active bookings can never own the
// same configured calendar block, even when both requests pass a prior read.
bookingSlotSchema.index({ slotStart: 1 }, { unique: true });
bookingSlotSchema.index({ booking: 1, slotStart: 1 }, { unique: true });
bookingSlotSchema.index({ booking: 1, claimGeneration: 1, slotStart: 1 });
bookingSlotSchema.index({ booking: 1, claimToken: 1, slotStart: 1 });
bookingSlotSchema.index({ booking: 1, scheduleRevision: 1, slotStart: 1 });

const BookingSlot = mongoose.model("BookingSlot", bookingSlotSchema);
export default BookingSlot;
