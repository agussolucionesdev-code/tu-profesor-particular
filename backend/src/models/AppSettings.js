import mongoose from "mongoose";

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    revision: { type: Number, min: 0, default: 0 },
    mutationLock: { type: String, default: null, select: false },
    mutationLockExpiresAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const AppSettings = mongoose.model("AppSettings", appSettingsSchema);
export default AppSettings;
