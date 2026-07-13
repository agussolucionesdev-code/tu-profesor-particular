export const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const formatterCache = new Map();

const getFormatter = (timeZone) => {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }),
    );
  }

  return formatterCache.get(timeZone);
};

export const normalizeTimeZone = (value) => {
  const candidate = String(value || DEFAULT_TIME_ZONE);
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
};

export const getBusinessTimeParts = (date, timeZone = DEFAULT_TIME_ZONE) =>
  Object.fromEntries(
    getFormatter(normalizeTimeZone(timeZone))
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

export const businessDateKey = (date, timeZone = DEFAULT_TIME_ZONE) => {
  const parts = getBusinessTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

const timezoneOffsetAt = (date, timeZone) => {
  const parts = getBusinessTimeParts(date, timeZone);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - date.getTime();
};

export const atBusinessTime = (
  dateKey,
  hour,
  minute = 0,
  timeZone = DEFAULT_TIME_ZONE,
) => {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const [year, month, day] = dateKey.split("-").map(Number);
  const nominalUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let result = new Date(
    nominalUtc - timezoneOffsetAt(new Date(nominalUtc), normalizedTimeZone),
  );
  const correctedOffset = timezoneOffsetAt(result, normalizedTimeZone);

  if (nominalUtc - correctedOffset !== result.getTime()) {
    result = new Date(nominalUtc - correctedOffset);
  }

  return result;
};

export const parseBusinessDateTime = (
  day,
  month,
  year,
  hour,
  minute,
  timeZone = DEFAULT_TIME_ZONE,
) => {
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const candidate = atBusinessTime(dateKey, hour, minute, timeZone);
  const parts = getBusinessTimeParts(candidate, timeZone);

  return (
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute
  )
    ? candidate
    : null;
};

export const businessDayRange = (now = new Date(), daysAhead = 90, timeZone = DEFAULT_TIME_ZONE) => {
  const dateKey = businessDateKey(now, timeZone);
  const start = atBusinessTime(dateKey, 0, 0, timeZone);
  const endCalendarDate = new Date(`${dateKey}T12:00:00.000Z`);
  endCalendarDate.setUTCDate(endCalendarDate.getUTCDate() + daysAhead);
  const endDateKey = endCalendarDate.toISOString().slice(0, 10);
  const end = atBusinessTime(endDateKey, 23, 59, timeZone);
  end.setSeconds(59, 999);
  return { from: start, to: end };
};
