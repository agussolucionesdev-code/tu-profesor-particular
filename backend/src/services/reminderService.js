import Booking from "../models/Booking.js";
import AppSettings from "../models/AppSettings.js";
import { enqueueBookingNotifications } from "./notificationOutboxService.js";
import { ACTIVE_BOOKING_FILTER } from "../utils/bookingFilters.js";

export const processReminders = async ({ now = new Date(), batchSize = 500 } = {}) => {
  const boundedBatchSize = Math.max(1, Math.min(500, Number(batchSize) || 500));
  let processed = 0;
  let queued = 0;
  let failed = 0;
  let cursor = null;
  for (;;) {
    let bookings;
    try {
      bookings = await Booking.find({
        ...ACTIVE_BOOKING_FILTER,
        status: "Confirmado",
        email: { $exists: true, $ne: "" },
        timeSlot: { $gt: now },
        ...(cursor ? {
          $or: [
            { timeSlot: { $gt: cursor.timeSlot } },
            { timeSlot: cursor.timeSlot, _id: { $gt: cursor._id } },
          ],
        } : {}),
      })
        .sort({ timeSlot: 1, _id: 1 })
        .limit(boundedBatchSize)
        .lean();
    } catch (error) {
      console.error("REMINDERS: DB query failed:", error.message);
      failed += 1;
      break;
    }
    if (!bookings.length) break;
    cursor = {
      timeSlot: bookings.at(-1).timeSlot,
      _id: bookings.at(-1)._id,
    };
    processed += bookings.length;
    // Bound concurrency so legacy backfills finish promptly without opening
    // hundreds of simultaneous DB operations on a small production instance.
    for (let offset = 0; offset < bookings.length; offset += 20) {
      await Promise.all(bookings.slice(offset, offset + 20).map(async (booking) => {
        try {
          const records = await enqueueBookingNotifications({
            booking,
            type: "booking_reminder",
            eventKey: new Date(booking.timeSlot).toISOString(),
            includeOwner: false,
          });
          if (records.length > 0) queued += 1;
        } catch (error) {
          failed += 1;
          console.error("REMINDERS: durable enqueue failed:", error.message);
        }
      }));
    }
    if (bookings.length < boundedBatchSize) break;
  }

  const summary = {
    processed,
    queued,
    failed,
    date: new Date().toISOString(),
  };
  try {
    await AppSettings.findOneAndUpdate(
      { key: "cron.lastReminderRun" },
      { key: "cron.lastReminderRun", value: summary },
      { upsert: true },
    );
  } catch (error) {
    console.error("REMINDERS: could not persist run log:", error.message);
  }
  return summary;
};

export const createReminderRunner = ({ processor = processReminders } = {}) => {
  let active = null;
  return () => {
    if (active) return active;
    active = Promise.resolve(processor()).finally(() => { active = null; });
    return active;
  };
};
