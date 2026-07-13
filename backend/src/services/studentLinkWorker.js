import crypto from "node:crypto";
import Booking from "../models/Booking.js";
import { linkBookingToStudent } from "./studentIdentityService.js";

const LEASE_MS = 30_000;

const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    const error = new Error("Student link worker timed out.");
    error.code = "STUDENT_LINK_TIMEOUT";
    reject(error);
  }, timeoutMs);
  Promise.resolve(promise).then(
    (value) => { clearTimeout(timer); resolve(value); },
    (error) => { clearTimeout(timer); reject(error); },
  );
});

const claimPending = async () => {
  const now = new Date();
  const leaseId = crypto.randomUUID();
  const booking = await Booking.findOneAndUpdate(
    {
      deletedAt: null,
      studentId: null,
      "studentLink.status": { $in: ["pending", "failed"] },
      "studentLink.nextAttemptAt": { $lte: now },
      $or: [
        { "studentLink.leaseId": null },
        { "studentLink.leaseId": { $exists: false } },
        { "studentLink.leaseExpiresAt": { $lte: now } },
      ],
    },
    {
      $set: {
        "studentLink.leaseId": leaseId,
        "studentLink.leaseExpiresAt": new Date(now.getTime() + LEASE_MS),
        "studentLink.lastAttemptAt": now,
      },
      $inc: { "studentLink.attempts": 1 },
    },
    { new: true, sort: { createdAt: 1 } },
  );
  return booking ? { booking, leaseId } : null;
};

export const processPendingStudentLinks = async ({
  limit = 25,
  jobTimeoutMs = 10_000,
  retryDelayMs = 60_000,
  linker = linkBookingToStudent,
} = {}) => {
  const summary = { processed: 0, linked: 0, review: 0, failed: 0, skipped: 0 };
  for (let index = 0; index < limit; index += 1) {
    const claimed = await claimPending();
    if (!claimed) break;
    summary.processed += 1;
    try {
      const stillActive = await Booking.exists({
        _id: claimed.booking._id,
        deletedAt: null,
        "studentLink.leaseId": claimed.leaseId,
      });
      if (!stillActive) {
        summary.skipped += 1;
        await Booking.updateOne(
          { _id: claimed.booking._id, "studentLink.leaseId": claimed.leaseId },
          { $unset: { "studentLink.leaseId": "", "studentLink.leaseExpiresAt": "" } },
        );
        continue;
      }
      const result = await withTimeout(
        linker(claimed.booking, {
          source: claimed.booking.studentLink?.source || "booking",
          leaseId: claimed.leaseId,
        }),
        jobTimeoutMs,
      );
      if (result.status === "review") summary.review += 1;
      else summary.linked += 1;
    } catch (error) {
      summary.failed += 1;
      await Booking.updateOne(
        { _id: claimed.booking._id, "studentLink.leaseId": claimed.leaseId, studentId: null },
        {
          $set: {
            "studentLink.status": "failed",
            "studentLink.errorCode": String(error.code || error.name || "STUDENT_LINK_FAILED").slice(0, 80),
            "studentLink.nextAttemptAt": new Date(Date.now() + retryDelayMs),
          },
          $unset: { "studentLink.leaseId": "", "studentLink.leaseExpiresAt": "" },
        },
      );
    }
  }
  return summary;
};

export const createStudentLinkReconciler = ({ processor = processPendingStudentLinks } = {}) => {
  let inFlight = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = Promise.resolve()
      .then(() => processor())
      .finally(() => { inFlight = null; });
    return inFlight;
  };
};
