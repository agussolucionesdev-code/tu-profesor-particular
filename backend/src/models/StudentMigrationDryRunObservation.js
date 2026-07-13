import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    runId: { type: String, required: true, immutable: true, maxlength: 100 },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, immutable: true },
    identityHashes: { type: [String], required: true, immutable: true },
    decision: { type: String, enum: ["would-create", "would-link", "review"], required: true, immutable: true },
    hasReviewCandidates: { type: Boolean, default: false, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

schema.index({ runId: 1, bookingId: 1 }, { unique: true });
schema.index({ runId: 1, identityHashes: 1 });

export default mongoose.model("StudentMigrationDryRunObservation", schema);
