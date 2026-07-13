import mongoose from "mongoose";

const studentIdentityEventSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    outcome: {
      type: String,
      enum: ["linked", "already-linked", "review", "failed"],
      required: true,
    },
    source: { type: String, enum: ["booking", "migration", "repair"], required: true },
    runId: { type: String, trim: true, default: null, maxlength: 100 },
    algorithmVersion: { type: String, required: true, maxlength: 40 },
    candidateIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    reason: { type: String, trim: true, default: "", maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

studentIdentityEventSchema.index({ bookingId: 1, createdAt: -1 });
studentIdentityEventSchema.index({ runId: 1, createdAt: -1 });

const StudentIdentityEvent = mongoose.model("StudentIdentityEvent", studentIdentityEventSchema);
export default StudentIdentityEvent;
