const TIME_ZONE = "America/Argentina/Buenos_Aires";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export class ScheduleValidationError extends Error {
  constructor(message, fieldId = "availability-editor-title") {
    super(message);
    this.name = "ScheduleValidationError";
    this.fieldId = fieldId;
  }
}

const fail = (message, fieldId) => {
  throw new ScheduleValidationError(message, fieldId);
};

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const integer = (value, min, max, label, fieldId) => {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${label} debe ser un entero entre ${min} y ${max}.`, fieldId);
  }
  return number;
};

const validDate = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const timeToMinutes = (value) => {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) return null;
  if (value === "24:00") return 1440;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

const normalizeIntervals = (
  intervals,
  { label, fieldPrefix, slotDurationMinutes, allowEmpty = true },
) => {
  if (!Array.isArray(intervals) || (!allowEmpty && intervals.length === 0)) {
    fail(`${label} debe contener uno o más intervalos.`, fieldPrefix);
  }

  const normalized = intervals.map((entry, index) => {
    const fieldId = `${fieldPrefix}-${index}-start`;
    if (!isObject(entry)) fail(`${label} contiene un intervalo inválido.`, fieldId);
    const startMinutes = timeToMinutes(entry.start);
    const endMinutes = timeToMinutes(entry.end);
    if (
      startMinutes === null ||
      endMinutes === null ||
      startMinutes >= endMinutes ||
      startMinutes === 1440
    ) {
      fail(`${label} contiene un intervalo inválido.`, fieldId);
    }
    if (
      startMinutes % slotDurationMinutes !== 0 ||
      endMinutes % slotDurationMinutes !== 0
    ) {
      fail(
        `Todos los intervalos deben respetar la grilla de ${slotDurationMinutes} minutos.`,
        fieldId,
      );
    }
    return { start: entry.start, end: entry.end, startMinutes, endMinutes };
  }).sort((left, right) => left.startMinutes - right.startMinutes);

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].startMinutes < normalized[index - 1].endMinutes) {
      fail(`${label} contiene intervalos que se superponen.`, `${fieldPrefix}-${index}-start`);
    }
  }

  return normalized.map(({ start, end }) => ({ start, end }));
};

const normalizePolicy = (value, slotDurationMinutes, { requireSource = false } = {}) => {
  if (!isObject(value)) fail("La política de disponibilidad es inválida.");
  if (requireSource && !["legacy", "policy"].includes(value.source)) {
    fail("La configuración horaria recibida es inválida.");
  }

  const weekly = value.weeklyAvailability;
  if (
    !isObject(weekly) ||
    Object.keys(weekly).length !== 7 ||
    Object.keys(weekly).some((key) => !/^[0-6]$/.test(key))
  ) {
    fail("La semana debe definir exactamente los siete días.", "weekly-0-enabled");
  }

  const weeklyAvailability = Object.fromEntries(
    Array.from({ length: 7 }, (_, weekday) => {
      const key = String(weekday);
      const day = weekly[key];
      if (!isObject(day) || typeof day.enabled !== "boolean") {
        fail(`El día ${weekday} es inválido.`, `weekly-${weekday}-enabled`);
      }
      const intervals = normalizeIntervals(day.intervals, {
        label: `Los horarios del día ${weekday}`,
        fieldPrefix: `weekly-${weekday}-interval`,
        slotDurationMinutes,
        allowEmpty: !day.enabled,
      });
      if (!day.enabled && intervals.length > 0) {
        fail(
          "Un día deshabilitado no puede conservar horarios.",
          `weekly-${weekday}-enabled`,
        );
      }
      const excludedIntervals = normalizeIntervals(day.excludedIntervals ?? [], {
        label: `Los descansos del día ${weekday}`,
        fieldPrefix: `weekly-${weekday}-break`,
        slotDurationMinutes,
      });
      return [key, { enabled: day.enabled, intervals, excludedIntervals }];
    }),
  );

  const bufferBeforeMinutes = integer(
    value.bufferBeforeMinutes,
    0,
    240,
    "El buffer previo",
    "availability-buffer-before",
  );
  const bufferAfterMinutes = integer(
    value.bufferAfterMinutes,
    0,
    240,
    "El buffer posterior",
    "availability-buffer-after",
  );
  if (
    bufferBeforeMinutes % slotDurationMinutes !== 0 ||
    bufferAfterMinutes % slotDurationMinutes !== 0
  ) {
    fail(
      `Los buffers deben ser múltiplos de ${slotDurationMinutes} minutos.`,
      "availability-buffer-before",
    );
  }

  if (!Array.isArray(value.holidays)) {
    fail("Los feriados deben ser una lista.", "availability-holiday-new");
  }
  const holidays = [...new Set(value.holidays)];
  if (holidays.some((date) => !validDate(date))) {
    fail("Hay un feriado con fecha inválida.", "availability-holiday-new");
  }

  if (!Array.isArray(value.dateExceptions)) {
    fail("Las excepciones por fecha deben ser una lista.", "availability-exception-add");
  }
  const exceptionDates = new Set();
  const dateExceptions = value.dateExceptions.map((entry, index) => {
    const prefix = `exception-${index}`;
    if (!isObject(entry) || !validDate(entry.date)) {
      fail("Hay una excepción con fecha inválida.", `${prefix}-date`);
    }
    if (exceptionDates.has(entry.date)) {
      fail("No puede haber dos excepciones para la misma fecha.", `${prefix}-date`);
    }
    exceptionDates.add(entry.date);
    if (typeof entry.closed !== "boolean" || !["override", "add"].includes(entry.mode)) {
      fail("Hay una excepción inválida.", `${prefix}-closed`);
    }
    const intervals = normalizeIntervals(entry.intervals ?? [], {
      label: `Los horarios de la excepción ${index + 1}`,
      fieldPrefix: `${prefix}-interval`,
      slotDurationMinutes,
      allowEmpty: entry.closed,
    });
    if (entry.closed && intervals.length > 0) {
      fail("Una fecha cerrada no puede abrir horarios.", `${prefix}-closed`);
    }
    return {
      date: entry.date,
      closed: entry.closed,
      mode: entry.mode,
      intervals,
      excludedIntervals: normalizeIntervals(entry.excludedIntervals ?? [], {
        label: `Los descansos de la excepción ${index + 1}`,
        fieldPrefix: `${prefix}-break`,
        slotDurationMinutes,
      }),
    };
  });

  if (!Array.isArray(value.blockedIntervals)) {
    fail("Los bloqueos parciales deben ser una lista.", "availability-block-add");
  }
  const blockedIntervals = value.blockedIntervals.map((entry, index) => {
    const prefix = `block-${index}`;
    if (!isObject(entry) || !validDate(entry.date)) {
      fail("Hay un bloqueo parcial con fecha inválida.", `${prefix}-date`);
    }
    const [interval] = normalizeIntervals([entry], {
      label: `El bloqueo parcial ${index + 1}`,
      fieldPrefix: prefix,
      slotDurationMinutes,
      allowEmpty: false,
    });
    if (typeof entry.reason !== "string" || entry.reason.length > 500) {
      fail("El motivo privado no puede superar 500 caracteres.", `${prefix}-reason`);
    }
    return { date: entry.date, ...interval, reason: entry.reason.trim() };
  });

  return {
    weeklyAvailability,
    bufferBeforeMinutes,
    bufferAfterMinutes,
    minimumNoticeMinutes: integer(
      value.minimumNoticeMinutes,
      0,
      60 * 24 * 30,
      "La anticipación mínima",
      "availability-minimum-notice",
    ),
    maximumAdvanceDays: integer(
      value.maximumAdvanceDays,
      1,
      730,
      "El horizonte máximo",
      "availability-maximum-horizon",
    ),
    holidays: holidays.sort(),
    dateExceptions,
    blockedIntervals,
  };
};

const normalizeSchedule = (value, { requireRevision = false, requireSource = false } = {}) => {
  if (!isObject(value)) fail("La configuración horaria recibida es inválida.");
  const revision = requireRevision
    ? integer(value.revision, 0, Number.MAX_SAFE_INTEGER, "La revisión", "availability-editor-title")
    : value.revision;
  const openingHour = integer(value.openingHour, 0, 23, "La hora de apertura", "availability-opening-hour");
  const closingHour = integer(value.closingHour, 1, 24, "La hora de cierre", "availability-closing-hour");
  if (closingHour <= openingHour) {
    fail("La hora de cierre debe ser posterior a la apertura.", "availability-closing-hour");
  }
  const slotDurationMinutes = integer(
    value.slotDurationMinutes,
    5,
    120,
    "La duración de la grilla",
    "availability-slot-duration",
  );
  if (value.timeZone !== TIME_ZONE) {
    fail(`La zona horaria debe ser ${TIME_ZONE}.`, "availability-time-zone");
  }

  const availabilityPolicy = normalizePolicy(value.availabilityPolicy, slotDurationMinutes, {
    requireSource,
  });
  const activeWeekdays = Object.entries(availabilityPolicy.weeklyAvailability)
    .filter(([, day]) => day.enabled)
    .map(([weekday]) => Number(weekday));
  if (activeWeekdays.length === 0) {
    fail("Debe quedar al menos un día semanal activo.", "weekly-0-enabled");
  }
  if (requireRevision) {
    if (
      !Array.isArray(value.activeWeekdays) ||
      value.activeWeekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    ) {
      fail("La configuración horaria recibida es inválida.");
    }
    integer(
      value.advanceNoticeMinutes,
      0,
      60 * 24 * 30,
      "La anticipación mínima",
      "availability-minimum-notice",
    );
    if (
      value.advanceNoticeMinutes !== availabilityPolicy.minimumNoticeMinutes ||
      value.activeWeekdays.length !== activeWeekdays.length ||
      value.activeWeekdays.some((day, index) => day !== activeWeekdays[index])
    ) {
      fail("La configuración horaria recibida es inconsistente.");
    }
  }

  return {
    ...(requireRevision ? { revision } : {}),
    openingHour,
    closingHour,
    advanceNoticeMinutes: availabilityPolicy.minimumNoticeMinutes,
    slotDurationMinutes,
    timeZone: TIME_ZONE,
    activeWeekdays,
    availabilityPolicy,
  };
};

export const validateScheduleDraft = (draft) => {
  try {
    return { valid: true, schedule: normalizeSchedule(draft), error: null, fieldId: null };
  } catch (error) {
    if (!(error instanceof ScheduleValidationError)) throw error;
    return { valid: false, schedule: null, error: error.message, fieldId: error.fieldId };
  }
};

export const serializeScheduleDraft = (draft) => {
  const result = validateScheduleDraft(draft);
  if (!result.valid) throw new ScheduleValidationError(result.error, result.fieldId);
  return result.schedule;
};

export const parseAdminScheduleResponse = (responseBody) => {
  try {
    if (!isObject(responseBody) || responseBody.success !== true) {
      fail("La configuración horaria recibida es inválida.");
    }
    return normalizeSchedule(responseBody.data, { requireRevision: true, requireSource: true });
  } catch (error) {
    if (error instanceof ScheduleValidationError) {
      throw new ScheduleValidationError(
        `La configuración horaria recibida es inválida: ${error.message}`,
        error.fieldId,
      );
    }
    throw error;
  }
};

const REVISION_CODES = new Set([
  "SCHEDULE_REVISION_CONFLICT",
  "SCHEDULE_REVISION_REQUIRED",
]);
const RETRYABLE_CODES = new Set([
  "SLOT_DURATION_CHANGE_BLOCKED",
  "SCHEDULE_CHANGE_BUSY",
]);

export const classifyScheduleSaveError = (error) => {
  const code = error?.response?.data?.code;
  const message = error?.response?.data?.message || error?.message || "No se pudo guardar la disponibilidad.";
  if (REVISION_CODES.has(code)) return { kind: "revision", code, message };
  if (RETRYABLE_CODES.has(code)) return { kind: "retryable", code, message };
  return { kind: "error", code, message };
};

export const parseLegacyBlockedDatesResponse = (responseBody) => {
  if (!isObject(responseBody) || responseBody.success !== true || !Array.isArray(responseBody.data)) {
    throw new ScheduleValidationError("La respuesta de bloqueos anteriores es inválida.");
  }
  return responseBody.data.map((record) => {
    if (
      !isObject(record) ||
      typeof record.date !== "string" ||
      !DATE_PATTERN.test(record.date) ||
      (record.reason !== undefined && typeof record.reason !== "string")
    ) {
      throw new ScheduleValidationError("La respuesta de bloqueos anteriores es inválida.");
    }
    return { date: record.date, reason: record.reason || "" };
  });
};
