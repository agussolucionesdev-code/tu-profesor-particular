import mongoose from "mongoose";

const blockedDateSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // 'YYYY-MM-DD'
    reason: { type: String, default: "", maxlength: 500, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

const BlockedDate = mongoose.model("BlockedDate", blockedDateSchema);
export default BlockedDate;
