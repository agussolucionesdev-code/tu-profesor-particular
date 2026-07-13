export const AVAILABILITY_POLICY_KEY = "schedule.availabilityPolicy";
export const DEFAULT_MAXIMUM_ADVANCE_DAYS = 120;

export class AvailabilityPolicyValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AvailabilityPolicyValidationError";
  }
}

const fail = (message) => {
  throw new AvailabilityPolicyValidationError(message);
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

const validDateKey = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const timeStringToMinutes = (value) => {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) return null;
  if (value === "24:00") return 24 * 60;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

const minutesToTimeString = (minutes) => {
  if (minutes === 24 * 60) return "24:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

const normalizeIntervals = (intervals, label, { allowEmpty = true } = {}) => {
  if (!Array.isArray(intervals) || (!allowEmpty && intervals.length === 0)) {
    fail(`${label} debe contener uno o más intervalos.`);
  }

  const normalized = intervals.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`${label}[${index}] no es un intervalo válido.`);
    }
    const startMinutes = timeStringToMinutes(entry.start);
    const endMinutes = timeStringToMinutes(entry.end);
    if (
      startMinutes === null ||
      endMinutes === null ||
      startMinutes >= endMinutes ||
      startMinutes === 24 * 60
    ) {
      fail(`${label}[${index}] no es un intervalo válido.`);
    }
    return {
      start: minutesToTimeString(startMinutes),
      end: minutesToTimeString(endMinutes),
      startMinutes,
      endMinutes,
    };
  }).sort((left, right) => left.startMinutes - right.startMinutes);

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].startMinutes < normalized[index - 1].endMinutes) {
      fail(`${label} contiene intervalos que se superponen.`);
    }
  }

  return normalized.map(({ start, end }) => ({ start, end }));
};

const integerInRange = (value, min, max, label) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${label} debe ser un entero entre ${min} y ${max}.`);
  }
  return value;
};

const normalizeWeeklyAvailability = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("weeklyAvailability debe ser un objeto con los días 0 a 6.");
  }
  const keys = Object.keys(value);
  if (
    keys.length !== 7 ||
    keys.some((key) => !/^[0-6]$/.test(key))
  ) {
    fail("weeklyAvailability debe definir exactamente los días 0 a 6.");
  }

  return Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => {
    const day = value[String(weekday)];
    if (!day || typeof day !== "object" || typeof day.enabled !== "boolean") {
      fail(`weeklyAvailability.${weekday} es inválido.`);
    }
    const intervals = normalizeIntervals(
      day.intervals,
      `weeklyAvailability.${weekday}.intervals`,
      { allowEmpty: !day.enabled },
    );
    if (!day.enabled && intervals.length > 0) {
      fail(`weeklyAvailability.${weekday} no puede tener intervalos si está deshabilitado.`);
    }
    const excludedIntervals = normalizeIntervals(
      day.excludedIntervals ?? [],
      `weeklyAvailability.${weekday}.excludedIntervals`,
    );
    return [String(weekday), { enabled: day.enabled, intervals, excludedIntervals }];
  }));
};

const normalizeExceptions = (value) => {
  if (!Array.isArray(value)) fail("dateExceptions debe ser un arreglo.");
  const seenDates = new Set();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || !validDateKey(entry.date)) {
      fail(`dateExceptions[${index}] tiene una fecha inválida.`);
    }
    if (seenDates.has(entry.date)) fail("dateExceptions contiene fechas duplicadas.");
    seenDates.add(entry.date);
    if (typeof entry.closed !== "boolean" || !["override", "add"].includes(entry.mode)) {
      fail(`dateExceptions[${index}] es inválida.`);
    }
    const intervals = normalizeIntervals(
      entry.intervals ?? [],
      `dateExceptions[${index}].intervals`,
      { allowEmpty: entry.closed },
    );
    if (entry.closed && intervals.length > 0) {
      fail(`dateExceptions[${index}] no puede abrir intervalos si está cerrada.`);
    }
    return {
      date: entry.date,
      closed: entry.closed,
      mode: entry.mode,
      intervals,
      excludedIntervals: normalizeIntervals(
        entry.excludedIntervals ?? [],
        `dateExceptions[${index}].excludedIntervals`,
      ),
    };
  });
};

const normalizeBlockedIntervals = (value) => {
  if (!Array.isArray(value)) fail("blockedIntervals debe ser un arreglo.");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || !validDateKey(entry.date)) {
      fail(`blockedIntervals[${index}] tiene una fecha inválida.`);
    }
    const [normalized] = normalizeIntervals(
      [{ start: entry.start, end: entry.end }],
      `blockedIntervals[${index}]`,
      { allowEmpty: false },
    );
    return {
      date: entry.date,
      ...normalized,
      reason: typeof entry.reason === "string" ? entry.reason.trim().slice(0, 500) : "",
    };
  });
};

const legacyPolicy = (legacy) => ({
  source: "legacy",
  weeklyAvailability: Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => {
    const enabled = legacy.activeWeekdays.includes(weekday);
    return [String(weekday), {
      enabled,
      intervals: enabled
        ? [{
          start: `${String(legacy.openingHour).padStart(2, "0")}:00`,
          end: legacy.closingHour === 24
            ? "24:00"
            : `${String(legacy.closingHour).padStart(2, "0")}:00`,
        }]
        : [],
      excludedIntervals: [],
    }];
  })),
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minimumNoticeMinutes: legacy.advanceNoticeMinutes,
  maximumAdvanceDays: DEFAULT_MAXIMUM_ADVANCE_DAYS,
  holidays: [],
  dateExceptions: [],
  blockedIntervals: [],
});

const validatePolicyGrid = (policy, slotDurationMinutes) => {
  const intervalGroups = [
    ...Object.values(policy.weeklyAvailability).flatMap((day) => [
      day.intervals,
      day.excludedIntervals,
    ]),
    ...policy.dateExceptions.flatMap((exception) => [
      exception.intervals,
      exception.excludedIntervals,
    ]),
    policy.blockedIntervals.map(({ start, end }) => ({ start, end })),
  ];

  for (const intervals of intervalGroups) {
    for (const { start, end } of intervals) {
      if (
        timeStringToMinutes(start) % slotDurationMinutes !== 0 ||
        timeStringToMinutes(end) % slotDurationMinutes !== 0
      ) {
        fail(`Todos los intervalos deben respetar la grilla de ${slotDurationMinutes} minutos.`);
      }
    }
  }
};

export const normalizeAvailabilityPolicy = (value, legacy) => {
  if (value == null) return legacyPolicy(legacy);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("La política de disponibilidad debe ser un objeto.");
  }

  const slotDurationMinutes = integerInRange(
    legacy.slotDurationMinutes,
    5,
    120,
    "slotDurationMinutes",
  );
  const bufferBeforeMinutes = integerInRange(value.bufferBeforeMinutes, 0, 240, "bufferBeforeMinutes");
  const bufferAfterMinutes = integerInRange(value.bufferAfterMinutes, 0, 240, "bufferAfterMinutes");
  if (
    bufferBeforeMinutes % slotDurationMinutes !== 0 ||
    bufferAfterMinutes % slotDurationMinutes !== 0
  ) {
    fail(`Los buffers deben ser múltiplos de ${slotDurationMinutes} minutos.`);
  }

  if (!Array.isArray(value.holidays)) fail("holidays debe ser un arreglo.");
  const holidays = [...new Set(value.holidays)];
  if (holidays.some((date) => !validDateKey(date))) fail("holidays contiene una fecha inválida.");

  const policy = {
    source: "policy",
    weeklyAvailability: normalizeWeeklyAvailability(value.weeklyAvailability),
    bufferBeforeMinutes,
    bufferAfterMinutes,
    minimumNoticeMinutes: integerInRange(value.minimumNoticeMinutes, 0, 60 * 24 * 30, "minimumNoticeMinutes"),
    maximumAdvanceDays: integerInRange(value.maximumAdvanceDays, 1, 730, "maximumAdvanceDays"),
    holidays: holidays.sort(),
    dateExceptions: normalizeExceptions(value.dateExceptions),
    blockedIntervals: normalizeBlockedIntervals(value.blockedIntervals),
  };
  validatePolicyGrid(policy, slotDurationMinutes);
  return policy;
};

const toNumericIntervals = (intervals) => intervals.map(({ start, end }) => ({
  start: timeStringToMinutes(start),
  end: timeStringToMinutes(end),
}));

const mergeNumericIntervals = (intervals) => {
  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  const merged = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
};

const subtractNumericIntervals = (allowed, excluded) => {
  let result = mergeNumericIntervals(allowed);
  for (const block of mergeNumericIntervals(excluded)) {
    result = result.flatMap((current) => {
      if (block.end <= current.start || block.start >= current.end) return [current];
      return [
        ...(block.start > current.start ? [{ start: current.start, end: block.start }] : []),
        ...(block.end < current.end ? [{ start: block.end, end: current.end }] : []),
      ];
    });
  }
  return result;
};

export const resolveDateAvailabilityIntervals = (dateKey, policy) => {
  if (!validDateKey(dateKey)) return [];
  if (policy.holidays.includes(dateKey)) return [];

  const weekday = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
  const weekly = policy.weeklyAvailability[String(weekday)];
  let allowed = weekly.enabled ? toNumericIntervals(weekly.intervals) : [];
  let excluded = weekly.enabled ? toNumericIntervals(weekly.excludedIntervals) : [];

  const exception = policy.dateExceptions.find(({ date }) => date === dateKey);
  if (exception?.closed) return [];
  if (exception) {
    const exceptionIntervals = toNumericIntervals(exception.intervals);
    allowed = exception.mode === "override"
      ? exceptionIntervals
      : [...allowed, ...exceptionIntervals];
    excluded = [...excluded, ...toNumericIntervals(exception.excludedIntervals)];
  }

  excluded = [
    ...excluded,
    ...policy.blockedIntervals
      .filter(({ date }) => date === dateKey)
      .map(({ start, end }) => ({
        start: timeStringToMinutes(start),
        end: timeStringToMinutes(end),
      })),
  ];

  return subtractNumericIntervals(allowed, excluded).map(({ start, end }) => ({
    start: minutesToTimeString(start),
    end: minutesToTimeString(end),
  }));
};
