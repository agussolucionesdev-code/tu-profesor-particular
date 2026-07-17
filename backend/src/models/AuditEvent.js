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
      enum: [
        "booking.created",
        "booking.updated",
        "booking.rescheduled",
        "booking.deleted",
        "booking.restored",
        "booking.attendance.updated",
        "settings.subjects.updated",
        "notification.retry.requested",
        "notification.retry.committed",
        "notification.retry.failed",
      ],
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
    operationId: { type: String, default: null, immutable: true, maxlength: 80 },
    before: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
    after: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    minimize: false,
  },
);

auditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });
auditEventSchema.index(
  { action: 1, operationId: 1 },
  { unique: true, partialFilterExpression: { operationId: { $type: "string" } } },
);

const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);
export default AuditEvent;
