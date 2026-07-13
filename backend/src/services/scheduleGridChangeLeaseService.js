import crypto from "node:crypto";
import AppSettings from "../models/AppSettings.js";

const LEASE_KEY = "internal.scheduleGridChangeLease";
const DEFAULT_LEASE_MS = 15 * 1000;

export const acquireScheduleGridChangeLease = async () => {
  const now = new Date();
  const token = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + DEFAULT_LEASE_MS);

  try {
    const lease = await AppSettings.findOneAndUpdate(
      {
        key: LEASE_KEY,
        $or: [
          { "value.expiresAt": { $lte: now } },
          { "value.expiresAt": { $exists: false } },
        ],
      },
      { $set: { key: LEASE_KEY, value: { token, expiresAt } } },
      { upsert: true, new: true },
    );

    return lease?.value?.token === token ? { token, expiresAt } : null;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

export const isScheduleGridChangeInProgress = async () => {
  const lease = await AppSettings.findOne({
    key: LEASE_KEY,
    "value.expiresAt": { $gt: new Date() },
  })
    .select("_id")
    .lean();
  return Boolean(lease);
};

export const releaseScheduleGridChangeLease = async (token) => {
  if (!token) return;
  await AppSettings.deleteOne({ key: LEASE_KEY, "value.token": token });
};
