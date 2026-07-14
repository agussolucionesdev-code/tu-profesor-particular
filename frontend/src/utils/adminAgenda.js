export const ADMIN_AGENDA_TIME_ZONE = "America/Argentina/Buenos_Aires";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const contractError = () =>
  new TypeError("La respuesta de disponibilidad administrativa no es válida.");

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const validDateKey = (value) => {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const businessDateKey = (
  value,
  timeZone = ADMIN_AGENDA_TIME_ZONE,
) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("La fecha no es válida.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const addBusinessDays = (dateKey, amount) => {
  if (!validDateKey(dateKey) || !Number.isInteger(amount)) {
    throw new TypeError("El rango de agenda no es válido.");
  }
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const weekdayForDateKey = (dateKey) =>
  new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();

export const createAgendaRange = (anchorDateKey, mode) => {
  if (!validDateKey(anchorDateKey) || !["day", "week"].includes(mode)) {
    throw new TypeError("El rango de agenda no es válido.");
  }
  if (mode === "day") {
    return {
      fromDateKey: anchorDateKey,
      toDateKey: addBusinessDays(anchorDateKey, 1),
    };
  }
  const weekday = weekdayForDateKey(anchorDateKey);
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  const fromDateKey = addBusinessDays(anchorDateKey, -daysSinceMonday);
  return { fromDateKey, toDateKey: addBusinessDays(fromDateKey, 7) };
};

export const businessBoundaryIso = (dateKey) => {
  if (!validDateKey(dateKey)) throw new TypeError("La fecha no es válida.");
  return new Date(`${dateKey}T00:00:00-03:00`).toISOString();
};

export const formatBusinessDate = (dateKey, options = {}) => {
  if (!validDateKey(dateKey)) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ADMIN_AGENDA_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...options,
  }).format(new Date(`${dateKey}T12:00:00-03:00`));
};

export const formatBusinessTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ADMIN_AGENDA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

export const durationOptionsForSlotMinutes = (slotDurationMinutes) => {
  if (
    !Number.isInteger(slotDurationMinutes) ||
    slotDurationMinutes <= 0 ||
    slotDurationMinutes > 600
  ) {
    throw new TypeError("La duración de la grilla no es válida.");
  }
  const options = [];
  const firstDurationMinutes = Math.ceil(30 / slotDurationMinutes) * slotDurationMinutes;
  for (
    let minutes = firstDurationMinutes;
    minutes <= 600;
    minutes += slotDurationMinutes
  ) {
    options.push(minutes / 60);
  }
  return options;
};

export const formatDurationLabel = (durationHours) => {
  const minutes = Math.round(Number(durationHours) * 60);
  if (!Number.isSafeInteger(minutes) || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} h`;
  return `${hours} h ${remainder} min`;
};

export const bookingScheduleChanged = (form, booking) => {
  if (!booking) return true;
  const currentStart = new Date(form?.timeSlot).getTime();
  const originalStart = new Date(booking?.timeSlot).getTime();
  return (
    currentStart !== originalStart ||
    Number(form?.duration) !== Number(booking?.duration)
  );
};

export const requiresAuthoritativeSlot = ({ mode, scheduleDirty }) =>
  mode === "create" || Boolean(scheduleDirty);

export const parseAdminAvailabilityResponse = (body) => {
  const data = body?.data;
  if (
    !isObject(body) ||
    body.success !== true ||
    !isObject(data) ||
    data.timeZone !== ADMIN_AGENDA_TIME_ZONE ||
    !isObject(data.range) ||
    !Array.isArray(data.slots) ||
    !isObject(data.schedule)
  ) {
    throw contractError();
  }
  const from = new Date(data.range.from);
  const to = new Date(data.range.to);
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from >= to ||
    !Number.isFinite(data.range.duration) ||
    data.range.duration < 0.5 ||
    !Number.isInteger(data.schedule.slotDurationMinutes) ||
    data.schedule.slotDurationMinutes < 5 ||
    !Number.isInteger(data.schedule.bufferBeforeMinutes) ||
    data.schedule.bufferBeforeMinutes < 0 ||
    !Number.isInteger(data.schedule.bufferAfterMinutes) ||
    data.schedule.bufferAfterMinutes < 0
  ) {
    throw contractError();
  }
  const slots = data.slots.map((slot) => {
    if (!isObject(slot)) throw contractError();
    const start = new Date(slot.timeSlot);
    const end = new Date(slot.endTime);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start ||
      !Number.isFinite(slot.duration) ||
      slot.duration < 0.5
    ) {
      throw contractError();
    }
    return { ...slot };
  });
  if (
    data.excludedBookingId !== null &&
    data.excludedBookingId !== undefined &&
    typeof data.excludedBookingId !== "string"
  ) {
    throw contractError();
  }
  return {
    timeZone: data.timeZone,
    range: { ...data.range },
    slots,
    excludedBookingId: data.excludedBookingId ?? null,
    schedule: { ...data.schedule },
  };
};

const text = (value) => String(value ?? "").trim();
const number = (value) => Number(value);

export const buildAdminCreatePayload = (form) => ({
  responsibleName: text(form.responsibleName),
  responsibleRelationship: text(form.responsibleRelationship),
  responsibleRelationshipOther: text(form.responsibleRelationshipOther),
  studentName: text(form.studentName),
  email: text(form.email),
  phone: text(form.phone),
  school: text(form.school),
  educationLevel: text(form.educationLevel),
  yearGrade: text(form.yearGrade),
  subject: text(form.subject),
  academicSituation: text(form.academicSituation),
  timeSlot: text(form.timeSlot),
  duration: number(form.duration),
  status: text(form.status),
  price: number(form.price || 0),
  notes: text(form.notes),
});

export const buildAdminUpdatePayload = (form, originalBooking = null) => {
  const payload = {
    status: text(form.status),
    price: number(form.price || 0),
    notes: text(form.notes),
    studentEvolution: text(form.studentEvolution),
    emotionalState: text(form.emotionalState),
    subject: text(form.subject),
    academicSituation: text(form.academicSituation),
    school: text(form.school),
    educationLevel: text(form.educationLevel),
    yearGrade: text(form.yearGrade),
    timeSlot: text(form.timeSlot),
    duration: number(form.duration),
  };
  if (originalBooking) {
    const defaultValue = (field) => {
      if (["price"].includes(field)) return 0;
      if (field === "duration") return 1;
      return "";
    };
    for (const [field, value] of Object.entries(payload)) {
      const original = originalBooking[field] ?? defaultValue(field);
      const isDateField = field === "timeSlot";
      const unchanged = isDateField
        ? new Date(value).getTime() === new Date(original).getTime()
        : value === original;
      if (unchanged) delete payload[field];
    }
  }
  return payload;
};
