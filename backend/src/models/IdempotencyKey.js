import mongoose from "mongoose";

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 8,
      maxlength: 128,
      immutable: true,
    },
    fingerprint: {
      type: String,
      required: true,
      minlength: 64,
      maxlength: 64,
      immutable: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    status: {
      type: String,
      enum: ["processing", "completed"],
      default: "processing",
    },
    responseStatus: { type: Number, default: null },
    responseCiphertext: { type: String, default: "", select: false },
    responseIv: { type: String, default: "", select: false },
    responseAuthTag: { type: String, default: "", select: false },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const IdempotencyKey = mongoose.model("IdempotencyKey", idempotencyKeySchema);
export default IdempotencyKey;
