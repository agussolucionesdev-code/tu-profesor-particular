import AppSettings from "../models/AppSettings.js";
import {
  atBusinessTime,
  businessDateKey,
  normalizeTimeZone,
} from "../utils/timeZone.js";

export const SCHEDULE_DEFAULTS = Object.freeze({
  "schedule.openingHour": 7,
  "schedule.closingHour": 22,
  "schedule.advanceNoticeMinutes": 60,
  "schedule.slotDurationMinutes": 30,
  "schedule.timeZone": "America/Argentina/Buenos_Aires",
  // Sunday is intentionally excluded from the public booking calendar.
  "schedule.activeWeekdays": [1, 2, 3, 4, 5, 6],
});

export const SCHEDULE_SETTING_KEYS = Object.freeze(Object.keys(SCHEDULE_DEFAULTS));

const nextDateKey = (dateKey) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const weekdayForDateKey = (dateKey) =>
  new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();

const validInteger = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
};

const normalizeActiveWeekdays = (value) => {
  if (!Array.isArray(value)) return SCHEDULE_DEFAULTS["schedule.activeWeekdays"];

  const uniqueDays = [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return uniqueDays.length > 0 ? uniqueDays : SCHEDULE_DEFAULTS["schedule.activeWeekdays"];
};

export const normalizeSchedule = (settings) => {
  const openingHour = validInteger(
    settings["schedule.openingHour"],
    0,
    23,
    SCHEDULE_DEFAULTS["schedule.openingHour"],
  );
  const requestedClosingHour = validInteger(
    settings["schedule.closingHour"],
    1,
    24,
    SCHEDULE_DEFAULTS["schedule.closingHour"],
  );
  const closingHour = requestedClosingHour > openingHour
    ? requestedClosingHour
    : SCHEDULE_DEFAULTS["schedule.closingHour"];

  return {
    openingHour,
    closingHour,
    advanceNoticeMinutes: validInteger(
      settings["schedule.advanceNoticeMinutes"],
      0,
      60 * 24 * 30,
      SCHEDULE_DEFAULTS["schedule.advanceNoticeMinutes"],
    ),
    slotDurationMinutes: validInteger(
      settings["schedule.slotDurationMinutes"],
      5,
      120,
      SCHEDULE_DEFAULTS["schedule.slotDurationMinutes"],
    ),
    timeZone: normalizeTimeZone(settings["schedule.timeZone"]),
    activeWeekdays: normalizeActiveWeekdays(settings["schedule.activeWeekdays"]),
  };
};

export const getScheduleConfiguration = async () => {
  const records = await AppSettings.find({ key: { $in: SCHEDULE_SETTING_KEYS } }).lean();
  const settings = { ...SCHEDULE_DEFAULTS };
  records.forEach((record) => { settings[record.key] = record.value; });
  return normalizeSchedule(settings);
};

const overlaps = (start, end, booking) => {
  const bookingStart = new Date(booking.timeSlot);
  const bookingEnd = new Date(booking.endTime);
  return start < bookingEnd && end > bookingStart;
};

export const calculateAvailableSlots = ({
  from,
  to,
  bookings,
  blockedDates,
  schedule,
  durationHours,
}) => {
  const durationMinutes = Math.round(Number(durationHours) * 60);
  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < schedule.slotDurationMinutes ||
    durationMinutes % schedule.slotDurationMinutes !== 0
  ) {
    return [];
  }

  const blockedDateSet = new Set(blockedDates);
  const durationMs = durationMinutes * 60 * 1000;
  const slotMs = schedule.slotDurationMinutes * 60 * 1000;
  const slots = [];
  const lastDateKey = businessDateKey(to, schedule.timeZone);
  let currentDateKey = businessDateKey(from, schedule.timeZone);

  while (currentDateKey <= lastDateKey) {
    if (
      schedule.activeWeekdays.includes(weekdayForDateKey(currentDateKey)) &&
      !blockedDateSet.has(currentDateKey)
    ) {
      const dayOpening = atBusinessTime(
        currentDateKey,
        schedule.openingHour,
        0,
        schedule.timeZone,
      );
      const dayClosing = atBusinessTime(
        currentDateKey,
        schedule.closingHour,
        0,
        schedule.timeZone,
      );

      for (
        let startMs = dayOpening.getTime();
        startMs + durationMs <= dayClosing.getTime();
        startMs += slotMs
      ) {
        const timeSlot = new Date(startMs);
        const endTime = new Date(startMs + durationMs);

        if (timeSlot < from || endTime > to) continue;
        if (bookings.some((booking) => overlaps(timeSlot, endTime, booking))) continue;

        slots.push({ timeSlot, endTime, duration: durationMinutes / 60 });
      }
    }

    currentDateKey = nextDateKey(currentDateKey);
  }

  return slots;
};
