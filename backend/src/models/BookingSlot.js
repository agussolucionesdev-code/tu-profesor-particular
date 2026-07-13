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

const BookingSlot = mongoose.model("BookingSlot", bookingSlotSchema);
export default BookingSlot;
