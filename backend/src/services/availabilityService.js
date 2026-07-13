import AppSettings from "../models/AppSettings.js";
import BlockedDate from "../models/BlockedDate.js";
import {
  atBusinessTime,
  businessDateKey,
  normalizeTimeZone,
} from "../utils/timeZone.js";
import {
  AVAILABILITY_POLICY_KEY,
  AvailabilityPolicyValidationError,
  normalizeAvailabilityPolicy,
  resolveDateAvailabilityIntervals,
  timeStringToMinutes,
} from "./availabilityPolicy.js";

export { AVAILABILITY_POLICY_KEY, AvailabilityPolicyValidationError };
export const SCHEDULE_AGGREGATE_KEY = "schedule.aggregate";

export const SCHEDULE_DEFAULTS = Object.freeze({
  "schedule.openingHour": 7,
  "schedule.closingHour": 22,
  "schedule.advanceNoticeMinutes": 60,
  "schedule.slotDurationMinutes": 30,
  "schedule.timeZone": "America/Argentina/Buenos_Aires",
  // Sunday is intentionally excluded from the public booking calendar.
  "schedule.activeWeekdays": [1, 2, 3, 4, 5, 6],
  [AVAILABILITY_POLICY_KEY]: null,
});

export const SCHEDULE_SETTING_KEYS = Object.freeze(Object.keys(SCHEDULE_DEFAULTS));

const nextDateKey = (dateKey) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const addDaysToDateKey = (dateKey, days) => {
  let result = dateKey;
  for (let index = 0; index < days; index += 1) result = nextDateKey(result);
  return result;
};

const validInteger = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
};

const normalizeActiveWeekdays = (value) => {
  if (!Array.isArray(value)) return SCHEDULE_DEFAULTS["schedule.activeWeekdays"];
  const uniqueDays = [...new Set(value.map(Number).filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  ))];
  return uniqueDays.length > 0 ? uniqueDays : SCHEDULE_DEFAULTS["schedule.activeWeekdays"];
};

const legacyScheduleFromSettings = (settings) => {
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

export const normalizeSchedule = (settings) => {
  const legacy = legacyScheduleFromSettings(settings);
  const availabilityPolicy = normalizeAvailabilityPolicy(
    settings[AVAILABILITY_POLICY_KEY],
    legacy,
  );
  const activeWeekdays = Array.from({ length: 7 }, (_, weekday) => weekday)
    .filter((weekday) => availabilityPolicy.weeklyAvailability[String(weekday)].enabled);

  return {
    ...legacy,
    activeWeekdays,
    advanceNoticeMinutes: availabilityPolicy.minimumNoticeMinutes,
    bufferBeforeMinutes: availabilityPolicy.bufferBeforeMinutes,
    bufferAfterMinutes: availabilityPolicy.bufferAfterMinutes,
    minimumNoticeMinutes: availabilityPolicy.minimumNoticeMinutes,
    maximumAdvanceDays: availabilityPolicy.maximumAdvanceDays,
    weeklyAvailability: availabilityPolicy.weeklyAvailability,
    holidays: availabilityPolicy.holidays,
    dateExceptions: availabilityPolicy.dateExceptions,
    blockedIntervals: availabilityPolicy.blockedIntervals,
    availabilityPolicy,
  };
};

const strictInteger = (value, min, max, key) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AvailabilityPolicyValidationError(
      `${key} debe ser un entero entre ${min} y ${max}.`,
    );
  }
};

export const validateScheduleSettings = (settings) => {
  strictInteger(settings["schedule.openingHour"], 0, 23, "schedule.openingHour");
  strictInteger(settings["schedule.closingHour"], 1, 24, "schedule.closingHour");
  if (settings["schedule.closingHour"] <= settings["schedule.openingHour"]) {
    throw new AvailabilityPolicyValidationError("El horario de cierre debe ser posterior a la apertura.");
  }
  strictInteger(
    settings["schedule.advanceNoticeMinutes"],
    0,
    60 * 24 * 30,
    "schedule.advanceNoticeMinutes",
  );
  strictInteger(settings["schedule.slotDurationMinutes"], 5, 120, "schedule.slotDurationMinutes");
  if (
    !Array.isArray(settings["schedule.activeWeekdays"]) ||
    settings["schedule.activeWeekdays"].length === 0 ||
    settings["schedule.activeWeekdays"].some(
      (day) => !Number.isInteger(day) || day < 0 || day > 6,
    )
  ) {
    throw new AvailabilityPolicyValidationError("schedule.activeWeekdays es inválido.");
  }
  if (settings["schedule.timeZone"] !== "America/Argentina/Buenos_Aires") {
    throw new AvailabilityPolicyValidationError(
      "La zona horaria debe ser America/Argentina/Buenos_Aires.",
    );
  }

  return normalizeSchedule(settings);
};

export const getScheduleSettingsSnapshot = async () => {
  const records = await AppSettings.find({
    key: { $in: [...SCHEDULE_SETTING_KEYS, SCHEDULE_AGGREGATE_KEY] },
  }).lean();
  const settings = { ...SCHEDULE_DEFAULTS };
  records
    .filter((record) => SCHEDULE_SETTING_KEYS.includes(record.key))
    .forEach((record) => { settings[record.key] = record.value; });
  const aggregate = records.find((record) => record.key === SCHEDULE_AGGREGATE_KEY);
  if (aggregate?.value?.settings && typeof aggregate.value.settings === "object") {
    for (const key of SCHEDULE_SETTING_KEYS) {
      if (Object.hasOwn(aggregate.value.settings, key)) {
        settings[key] = aggregate.value.settings[key];
      }
    }
  }
  const revision = Number.isSafeInteger(aggregate?.value?.revision)
    ? aggregate.value.revision
    : 0;
  return { settings, revision, schedule: normalizeSchedule(settings) };
};

export const getScheduleConfiguration = async () =>
  (await getScheduleSettingsSnapshot()).schedule;

const canonicalScheduleSettings = (settings, normalized) => ({
  "schedule.openingHour": settings["schedule.openingHour"],
  "schedule.closingHour": settings["schedule.closingHour"],
  "schedule.advanceNoticeMinutes": settings["schedule.advanceNoticeMinutes"],
  "schedule.slotDurationMinutes": settings["schedule.slotDurationMinutes"],
  "schedule.timeZone": settings["schedule.timeZone"],
  "schedule.activeWeekdays": [...settings["schedule.activeWeekdays"]],
  [AVAILABILITY_POLICY_KEY]: settings[AVAILABILITY_POLICY_KEY] == null
    ? null
    : normalized.availabilityPolicy,
});

export const writeScheduleSettingsAggregate = async (settings, expectedRevision) => {
  const normalized = validateScheduleSettings(settings);
  const nextRevision = expectedRevision + 1;
  const filter = expectedRevision === 0
    ? {
      key: SCHEDULE_AGGREGATE_KEY,
      $or: [
        { "value.revision": 0 },
        { "value.revision": { $exists: false } },
      ],
    }
    : { key: SCHEDULE_AGGREGATE_KEY, "value.revision": expectedRevision };

  try {
    const updated = await AppSettings.findOneAndUpdate(
      filter,
      {
        $set: {
          key: SCHEDULE_AGGREGATE_KEY,
          value: {
            revision: nextRevision,
            settings: canonicalScheduleSettings(settings, normalized),
          },
        },
      },
      { upsert: expectedRevision === 0, new: true },
    );
    return updated ? { revision: nextRevision, schedule: normalized } : null;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

const dateIntervalBounds = (dateKey, interval, timeZone) => {
  const startMinutes = timeStringToMinutes(interval.start);
  const endMinutes = timeStringToMinutes(interval.end);
  return {
    start: atBusinessTime(
      dateKey,
      Math.floor(startMinutes / 60),
      startMinutes % 60,
      timeZone,
    ),
    end: atBusinessTime(
      dateKey,
      Math.floor(endMinutes / 60),
      endMinutes % 60,
      timeZone,
    ),
  };
};

export const normalizeDurationMinutes = (duration, slotDurationMinutes) => {
  const durationHours = Number(duration);
  const durationMinutes = durationHours * 60;
  if (!Number.isFinite(durationHours) || !Number.isSafeInteger(durationMinutes)) {
    return {
      error: "La duración debe expresarse en minutos completos.",
      durationMinutes: null,
    };
  }
  if (
    durationMinutes < 30 ||
    durationMinutes > 600
  ) {
    return { error: "La duración debe estar entre 0.5 y 10 horas.", durationMinutes };
  }
  if (durationMinutes % slotDurationMinutes !== 0) {
    return {
      error: `La duración debe respetar intervalos de ${slotDurationMinutes} minutos.`,
      durationMinutes,
    };
  }
  return { error: null, durationMinutes };
};

const createTemporalWindow = (schedule, now) => {
  const nowDate = new Date(now);
  const horizonDateKey = addDaysToDateKey(
    businessDateKey(nowDate, schedule.timeZone),
    schedule.maximumAdvanceDays,
  );
  return {
    minimumStartMs: nowDate.getTime() + schedule.minimumNoticeMinutes * 60 * 1000,
    horizonEndMs: atBusinessTime(horizonDateKey, 24, 0, schedule.timeZone).getTime(),
  };
};

const temporalWindowError = (startTime, schedule, temporalWindow) => {
  if (startTime.getTime() < temporalWindow.minimumStartMs) {
    return `Los turnos deben reservarse con al menos ${schedule.minimumNoticeMinutes} minutos de anticipación.`;
  }
  if (startTime.getTime() >= temporalWindow.horizonEndMs) {
    return `Los turnos solo pueden reservarse con hasta ${schedule.maximumAdvanceDays} días de anticipación.`;
  }
  return null;
};

export const evaluateConfiguredSlot = ({
  startTime,
  duration,
  schedule,
  blockedDates = [],
  resolvedIntervals = null,
  temporalWindow = null,
  now = new Date(),
}) => {
  if (!(startTime instanceof Date) || Number.isNaN(startTime.getTime())) {
    return { error: "La fecha y hora del turno no es válida." };
  }
  const durationValidation = normalizeDurationMinutes(duration, schedule.slotDurationMinutes);
  if (durationValidation.error) return { error: durationValidation.error };

  const dateKey = businessDateKey(startTime, schedule.timeZone);
  const blockedDateSet = blockedDates instanceof Set ? blockedDates : new Set(blockedDates);
  if (blockedDateSet.has(dateKey)) {
    return { error: "Ese día no está disponible para reservas." };
  }
  const intervals = resolvedIntervals ?? resolveDateAvailabilityIntervals(
    dateKey,
    schedule.availabilityPolicy,
  );
  if (intervals.length === 0) {
    return { error: "Ese día no está disponible para reservas." };
  }

  const endTime = new Date(
    startTime.getTime() + durationValidation.durationMinutes * 60 * 1000,
  );
  const containing = intervals
    .map((interval) => dateIntervalBounds(dateKey, interval, schedule.timeZone))
    .find(({ start, end }) => startTime >= start && endTime <= end);
  if (!containing) {
    if (schedule.availabilityPolicy.source === "legacy") {
      return {
        error: `El turno debe estar dentro del horario de ${String(schedule.openingHour).padStart(2, "0")}:00 a ${String(schedule.closingHour).padStart(2, "0")}:00.`,
      };
    }
    return { error: "El turno no está dentro de un intervalo disponible." };
  }
  if (
    (startTime.getTime() - containing.start.getTime()) %
      (schedule.slotDurationMinutes * 60 * 1000) !== 0
  ) {
    return {
      error: `Los turnos deben comenzar en intervalos de ${schedule.slotDurationMinutes} minutos.`,
    };
  }

  const timingError = temporalWindowError(
    startTime,
    schedule,
    temporalWindow ?? createTemporalWindow(schedule, now),
  );
  if (timingError) return { error: timingError };

  return { error: null, endTime, durationMinutes: durationValidation.durationMinutes };
};

export const validateConfiguredSlot = async (startTime, duration, { now = new Date() } = {}) => {
  const schedule = await getScheduleConfiguration();
  const dateKey = startTime instanceof Date && !Number.isNaN(startTime.getTime())
    ? businessDateKey(startTime, schedule.timeZone)
    : null;
  const blocked = dateKey && await BlockedDate.exists({ date: dateKey });
  const evaluated = evaluateConfiguredSlot({
    startTime,
    duration,
    schedule,
    blockedDates: blocked ? [dateKey] : [],
    now,
  });
  return { ...evaluated, schedule };
};

const overlaps = (start, end, booking) => {
  const bookingStart = new Date(booking.timeSlot).getTime()
    - Number(booking.bufferBeforeMinutes || 0) * 60 * 1000;
  const bookingEnd = new Date(booking.endTime).getTime()
    + Number(booking.bufferAfterMinutes || 0) * 60 * 1000;
  return start.getTime() < bookingEnd && end.getTime() > bookingStart;
};

export const calculateAvailableSlots = ({
  from,
  to,
  bookings,
  blockedDates,
  schedule,
  durationHours,
  now = new Date(),
}) => {
  const { error, durationMinutes } = normalizeDurationMinutes(
    durationHours,
    schedule.slotDurationMinutes,
  );
  if (error) return [];

  const blockedDateSet = new Set(blockedDates);
  const temporalWindow = createTemporalWindow(schedule, now);
  const durationMs = durationMinutes * 60 * 1000;
  const slotMs = schedule.slotDurationMinutes * 60 * 1000;
  const candidateBufferBeforeMs = schedule.bufferBeforeMinutes * 60 * 1000;
  const candidateBufferAfterMs = schedule.bufferAfterMinutes * 60 * 1000;
  const slots = [];
  const lastDateKey = businessDateKey(to, schedule.timeZone);
  let currentDateKey = businessDateKey(from, schedule.timeZone);

  while (currentDateKey <= lastDateKey) {
    if (!blockedDateSet.has(currentDateKey)) {
      const intervals = resolveDateAvailabilityIntervals(
        currentDateKey,
        schedule.availabilityPolicy,
      );
      for (const interval of intervals) {
        const { start: intervalStart, end: intervalEnd } = dateIntervalBounds(
          currentDateKey,
          interval,
          schedule.timeZone,
        );
        for (
          let startMs = intervalStart.getTime();
          startMs + durationMs <= intervalEnd.getTime();
          startMs += slotMs
        ) {
          const timeSlot = new Date(startMs);
          const endTime = new Date(startMs + durationMs);
          if (timeSlot < from || endTime > to) continue;
          if (temporalWindowError(timeSlot, schedule, temporalWindow)) continue;
          const claimStart = new Date(startMs - candidateBufferBeforeMs);
          const claimEnd = new Date(endTime.getTime() + candidateBufferAfterMs);
          if (bookings.some((booking) => overlaps(claimStart, claimEnd, booking))) continue;
          slots.push({ timeSlot, endTime, duration: durationMinutes / 60 });
        }
      }
    }
    currentDateKey = nextDateKey(currentDateKey);
  }

  return slots;
};
