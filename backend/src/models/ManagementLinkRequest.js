import mongoose from "mongoose";

const managementLinkRequestSchema = new mongoose.Schema(
  {
    requestKey: { type: String, required: true, immutable: true, maxlength: 64 },
    bookingCodeLookup: { type: String, required: true, immutable: true, select: false, maxlength: 64 },
    emailLookup: { type: String, required: true, immutable: true, select: false, maxlength: 64 },
    payloadCiphertext: { type: String, required: true, immutable: true, select: false },
    payloadIv: { type: String, required: true, immutable: true, select: false },
    payloadAuthTag: { type: String, required: true, immutable: true, select: false },
    encryptionKeyVersion: { type: String, required: true, immutable: true, select: false, maxlength: 40 },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "discarded"],
      default: "queued",
    },
    nextAttemptAt: { type: Date, default: Date.now },
    attempts: { type: Number, default: 0, min: 0, max: 20 },
    leaseOwner: { type: String, default: null, select: false, maxlength: 100 },
    leaseExpiresAt: { type: Date, default: null, select: false },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

managementLinkRequestSchema.index({ requestKey: 1 }, { unique: true });
managementLinkRequestSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
managementLinkRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("ManagementLinkRequest", managementLinkRequestSchema);
