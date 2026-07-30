const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const availabilityContractError = () =>
  new Error("La respuesta de disponibilidad del servidor es inválida.");

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isValidDateKey = (value) => {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const addDaysToDateKey = (dateKey, days) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const localDateFromBusinessKey = (dateKey) =>
  new Date(`${dateKey}T12:00:00-03:00`);

const formatDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
};

/* Días que se piden al abrir el paso de turnos. Antes no se enviaba rango, así
   que el servidor devolvía su máximo (92 días): 242 KB y más de 2.500 slots que
   bloqueaban el hilo principal al procesarse —el navegador llegaba a reportar
   "long-running script"— y con el timeout de 15 s de apiClient la carga no
   terminaba nunca. Con 21 días alcanza para la lista de próximos turnos y para
   las primeras semanas del calendario; si hace falta más, se pide el rango
   completo recién cuando el visitante abre el calendario. */
export const AVAILABILITY_INITIAL_DAYS = 21;

/** Fin de día (23:59:59.999) `days` días después de hoy, hora local. */
const endOfDayAfter = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 59, 999);
  return date;
};

/**
 * Parámetros de la consulta de disponibilidad.
 * @param duration duración elegida en horas (>= 0.5)
 * @param options.days ventana a pedir; `null` pide el rango completo del
 *        servidor (se usa al abrir el calendario, que necesita toda la agenda).
 */
export const availabilityRequestParams = (
  duration,
  { days = AVAILABILITY_INITIAL_DAYS } = {},
) => {
  const numericDuration = Number(duration);
  if (!Number.isFinite(numericDuration) || numericDuration < 0.5) {
    return undefined;
  }
  if (days === null) return { duration: numericDuration };

  // El backend valida `from`/`to` y acota el resultado a ese intervalo.
  return {
    duration: numericDuration,
    from: new Date().toISOString(),
    to: endOfDayAfter(days).toISOString(),
  };
};

export const isSelectedTimeAvailable = ({ selectedTime, backendSlots }) => {
  if (!selectedTime || selectedTime.getHours() === 0) {
    return true;
  }
  if (!Array.isArray(backendSlots)) return false;

  const selectedTimeValue = selectedTime.getTime();
  return backendSlots.some((slot) => {
    const slotTime = new Date(slot.timeSlot);
    return !Number.isNaN(slotTime.getTime()) && slotTime.getTime() === selectedTimeValue;
  });
};

export const isVerifiedAvailabilitySelection = ({
  availabilityStatus,
  selectedTime,
  backendSlots,
}) =>
  availabilityStatus === "ready" &&
  isSelectedTimeAvailable({ selectedTime, backendSlots });

export const getBusinessDateKey = (date, timeZone = DEFAULT_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const selectSlotsForDate = ({
  selectedDate,
  backendSlots,
  timeZone = DEFAULT_TIME_ZONE,
}) => {
  if (!Array.isArray(backendSlots)) return [];
  if (!selectedDate) return [];

  const selectedDateKey = getBusinessDateKey(selectedDate, timeZone);
  return backendSlots.flatMap((slot) => {
    const timeObj = new Date(slot.timeSlot);
    if (Number.isNaN(timeObj.getTime()) || getBusinessDateKey(timeObj, timeZone) !== selectedDateKey) {
      return [];
    }

    return [{
      ...slot,
      timeObj,
      isOccupied: false,
      status: "available",
      source: "backend",
    }];
  });
};

export const getAvailableBackendDateKeys = (backendSlots, timeZone = DEFAULT_TIME_ZONE) => {
  if (!Array.isArray(backendSlots)) return null;

  return new Set(
    backendSlots.flatMap((slot) => {
      const time = new Date(slot.timeSlot);
      return Number.isNaN(time.getTime()) ? [] : [getBusinessDateKey(time, timeZone)];
    }),
  );
};

export const parsePublicAvailabilityResponse = (body, now = new Date()) => {
  if (
    !isObject(body) ||
    body.success !== true ||
    !Array.isArray(body.data) ||
    !Array.isArray(body.blockedDates) ||
    !Array.isArray(body.slots) ||
    !isObject(body.schedule) ||
    !isObject(body.range)
  ) {
    throw availabilityContractError();
  }
  if (body.data.length !== 0) throw availabilityContractError();

  const schedule = body.schedule;
  if (
    schedule.timeZone !== DEFAULT_TIME_ZONE ||
    !Number.isInteger(schedule.slotDurationMinutes) ||
    schedule.slotDurationMinutes < 5 ||
    schedule.slotDurationMinutes > 120 ||
    !Number.isInteger(schedule.minimumNoticeMinutes) ||
    schedule.minimumNoticeMinutes < 0 ||
    schedule.minimumNoticeMinutes > 60 * 24 * 30 ||
    !Number.isInteger(schedule.maximumAdvanceDays) ||
    schedule.maximumAdvanceDays < 1 ||
    schedule.maximumAdvanceDays > 730 ||
    body.blockedDates.some((date) => !isValidDateKey(date))
  ) {
    throw availabilityContractError();
  }

  const rangeFrom = new Date(body.range.from);
  const rangeTo = new Date(body.range.to);
  if (
    Number.isNaN(rangeFrom.getTime()) ||
    Number.isNaN(rangeTo.getTime()) ||
    rangeFrom >= rangeTo
  ) {
    throw availabilityContractError();
  }

  for (const slot of body.slots) {
    if (!isObject(slot)) throw availabilityContractError();
    const start = new Date(slot.timeSlot);
    const end = new Date(slot.endTime);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start ||
      !Number.isFinite(slot.duration) ||
      slot.duration < 0.5 ||
      slot.duration > 10
    ) {
      throw availabilityContractError();
    }
  }

  const currentDateKey = getBusinessDateKey(now, schedule.timeZone);
  const rangeStartDateKey = getBusinessDateKey(rangeFrom, schedule.timeZone);
  const horizonDateKey = addDaysToDateKey(currentDateKey, schedule.maximumAdvanceDays);
  const inclusiveRangeEnd = new Date(rangeTo.getTime() - 1);
  const rangeEndDateKey = getBusinessDateKey(inclusiveRangeEnd, schedule.timeZone);
  const effectiveEndDateKey = horizonDateKey <= rangeEndDateKey
    ? horizonDateKey
    : rangeEndDateKey;
  const horizonControlsWindow = horizonDateKey <= rangeEndDateKey;
  if (effectiveEndDateKey < rangeStartDateKey) throw availabilityContractError();

  return {
    existingBookings: body.data,
    blockedDates: [...body.blockedDates],
    slots: body.slots.map((slot) => ({ ...slot })),
    schedule: {
      timeZone: schedule.timeZone,
      slotDurationMinutes: schedule.slotDurationMinutes,
      minimumNoticeMinutes: schedule.minimumNoticeMinutes,
      maximumAdvanceDays: schedule.maximumAdvanceDays,
    },
    range: {
      from: new Date(rangeFrom),
      to: new Date(rangeTo),
    },
    minDate: localDateFromBusinessKey(rangeStartDateKey),
    maxDate: localDateFromBusinessKey(effectiveEndDateKey),
    rangeLabel: horizonControlsWindow
      ? `los próximos ${schedule.maximumAdvanceDays} días`
      : `el período habilitado hasta el ${formatDateKey(effectiveEndDateKey)}`,
  };
};
