import mongoose from "mongoose";

const countsSchema = new mongoose.Schema(
  {
    processed: { type: Number, default: 0 },
    linked: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    reused: { type: Number, default: 0 },
    reviewCandidates: { type: Number, default: 0 },
    wouldCreate: { type: Number, default: 0 },
    wouldLink: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    rolledBackLinks: { type: Number, default: 0 },
    rolledBackStudents: { type: Number, default: 0 },
  },
  { _id: false },
);

const studentMigrationRunSchema = new mongoose.Schema(
  {
    runId: { type: String, required: true, immutable: true, maxlength: 100 },
    algorithmVersion: { type: String, required: true, immutable: true, maxlength: 40 },
    mode: { type: String, enum: ["dry-run", "apply"], required: true, immutable: true },
    status: {
      type: String,
      enum: ["running", "completed", "completed-with-errors", "rolled-back"],
      default: "running",
    },
    checkpoint: {
      lastBookingId: { type: mongoose.Schema.Types.ObjectId, default: null },
      processed: { type: Number, default: 0 },
    },
    counts: { type: countsSchema, default: () => ({}) },
    createdStudentIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    linkedBookingIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    errorSamples: {
      type: [{ bookingId: mongoose.Schema.Types.ObjectId, message: String, _id: false }],
      default: [],
    },
    completedAt: { type: Date, default: null },
    rolledBackAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

studentMigrationRunSchema.index({ runId: 1 }, { unique: true });

const StudentMigrationRun = mongoose.model("StudentMigrationRun", studentMigrationRunSchema);
export default StudentMigrationRun;
