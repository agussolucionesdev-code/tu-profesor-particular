import mongoose from "mongoose";

const actorSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    role: { type: String, required: true, immutable: true, maxlength: 40 },
    username: { type: String, required: true, immutable: true, maxlength: 160 },
  },
  { _id: false },
);

const auditEventSchema = new mongoose.Schema(
  {
    actor: { type: actorSchema, required: true, immutable: true },
    action: {
      type: String,
      enum: ["booking.deleted", "booking.restored", "booking.attendance.updated"],
      required: true,
      immutable: true,
    },
    entityType: { type: String, required: true, immutable: true, default: "Booking" },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
      index: true,
    },
    requestId: { type: String, required: true, immutable: true, maxlength: 100 },
    before: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
    after: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

auditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });

const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);
export default AuditEvent;
