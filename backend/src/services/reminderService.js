import Booking from "../models/Booking.js";
import { sendReminderNotification } from "../config/mailer.js";

// Find bookings whose timeSlot falls 20–28 hours from now.
// Running at 09:00 AM daily catches classes from 05:00 tomorrow to 13:00 tomorrow,
// which covers the full practical range without double-sending.
const WINDOW_START_HOURS = 20;
const WINDOW_END_HOURS = 28;

export const processReminders = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_START_HOURS * 3_600_000);
  const windowEnd = new Date(now.getTime() + WINDOW_END_HOURS * 3_600_000);

  let bookings;
  try {
    bookings = await Booking.find({
      status: "Confirmado",
      email: { $exists: true, $ne: "" },
      timeSlot: { $gte: windowStart, $lte: windowEnd },
    }).lean();
  } catch (err) {
    console.error("REMINDERS: DB query failed:", err.message);
    return { processed: 0, sent: 0, failed: 0 };
  }

  if (bookings.length === 0) {
    console.log("REMINDERS: no bookings in window — nothing to send.");
    return { processed: 0, sent: 0, failed: 0 };
  }

  console.log(`REMINDERS: ${bookings.length} booking(s) in window — sending...`);

  let sent = 0;
  let failed = 0;

  for (const booking of bookings) {
    try {
      const result = await sendReminderNotification(booking);
      if (result.sent) {
        sent++;
        console.log(`REMINDERS: ✓ ${booking.bookingCode} → ${result.recipient}`);
      } else {
        failed++;
        console.log(`REMINDERS: – ${booking.bookingCode} skipped (email disabled or missing)`);
      }
    } catch (err) {
      failed++;
      console.error(`REMINDERS: ✗ ${booking.bookingCode} error:`, err.message);
    }
  }

  console.log(`REMINDERS: done — sent: ${sent}, skipped/failed: ${failed}`);
  return { processed: bookings.length, sent, failed };
};
