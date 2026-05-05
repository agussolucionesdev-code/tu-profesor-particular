export const formatCurrencyARS = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const ADULT_RELATIONSHIP_VALUE = "self";
export const RESPONSIBLE_RELATIONSHIP_OTHER_VALUE = "otro";

export const RESPONSIBLE_RELATIONSHIP_OPTIONS = [
  { value: "madre", label: "Madre" },
  { value: "padre", label: "Padre" },
  { value: "hermana", label: "Hermana mayor de edad" },
  { value: "hermano", label: "Hermano mayor de edad" },
  { value: "tia", label: "Tía" },
  { value: "tio", label: "Tío" },
  { value: "abuela", label: "Abuela" },
  { value: "abuelo", label: "Abuelo" },
  { value: "prima", label: "Prima mayor de edad" },
  { value: "primo", label: "Primo mayor de edad" },
  { value: RESPONSIBLE_RELATIONSHIP_OTHER_VALUE, label: "Otro vínculo" },
];

const RESPONSIBLE_RELATIONSHIP_LABELS = new Map(
  RESPONSIBLE_RELATIONSHIP_OPTIONS.map((option) => [option.value, option.label]),
);

const capitalizeWords = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

export const toSafeDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isSameCalendarDay = (first, second) =>
  !!first &&
  !!second &&
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

export const formatDayLabel = (value) =>
  value.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit" });

export const formatLongDateLabel = (value) =>
  value.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

export const formatShortDateLabel = (value) =>
  value.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

export const formatTimeLabel = (value) =>
  value.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export const formatDurationOptionLabel = (duration) => {
  const totalMinutes = Math.round(Number(duration) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (hours > 0) {
    return `${hours} h`;
  }

  return `${minutes} min`;
};

export const formatDurationVoiceLabel = (duration) => {
  const totalMinutes = Math.round(Number(duration) * 60);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "una duración pendiente de definir";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (hours === 1) parts.push("1 hora");
  if (hours > 1) parts.push(`${hours} horas`);
  if (minutes === 1) parts.push("1 minuto");
  if (minutes > 1) parts.push(`${minutes} minutos`);

  return parts.join(" y ");
};

export const formatPhoneMaskAr = (value) => {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("549")) digits = digits.substring(3);
  else if (digits.startsWith("54")) digits = digits.substring(2);
  else if (digits.startsWith("9")) digits = digits.substring(1);

  if (digits.startsWith("0")) digits = digits.substring(1);

  digits = digits.substring(0, 10);

  if (!digits.length) return "";

  let result = "+54 9 ";
  if (digits.length > 0) result += digits.substring(0, 2);
  if (digits.length >= 3) result += `-${digits.substring(2, 6)}`;
  if (digits.length >= 7) result += `-${digits.substring(6, 10)}`;
  return result;
};

export const sanitizePersonNameAr = (value) =>
  String(value ?? "")
    .replace(/[^a-zA-ZÀ-ÿñÑ\s']/g, "")
    .replace(/\s{2,}/g, " ")
    .trimStart();

export const sanitizeRelationshipOtherAr = (value) =>
  String(value ?? "")
    .replace(/[^a-zA-ZÀ-ÿñÑ\s']/g, "")
    .replace(/\s{2,}/g, " ")
    .trimStart();

export const formatDniMaskAr = (value) => {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .substring(0, 8);

  if (!digits) return "";

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const formatCuitMaskAr = (value) => {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .substring(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.substring(0, 2)}-${digits.substring(2)}`;
  return `${digits.substring(0, 2)}-${digits.substring(2, 10)}-${digits.substring(10)}`;
};

const FRIENDLY_CONNECTION_MESSAGE =
  "No pudimos conectar con el sistema. Revisá tu conexión e intentá otra vez; tus datos siguen acá.";

const TECHNICAL_ERROR_PATTERN =
  /(localhost|127\.0\.0\.1|0\.0\.0\.0|ECONN|ENOTFOUND|ETIMEDOUT|Network Error|Failed to fetch|ERR_|http:\/\/|https:\/\/)/i;

export const getBookingApiMessage = (error) => {
  if (!error?.response) {
    return FRIENDLY_CONNECTION_MESSAGE;
  }

  if (error.response.status >= 500) {
    return FRIENDLY_CONNECTION_MESSAGE;
  }

  const apiMessage = String(error.response?.data?.message ?? "").trim();

  if (!apiMessage || TECHNICAL_ERROR_PATTERN.test(apiMessage)) {
    return "No pudimos completar la operación ahora mismo. Intentá nuevamente en unos segundos o comunicate por WhatsApp si necesitás ayuda.";
  }

  return apiMessage;
};

export const isAdultBooking = (booking) => {
  const relationship = String(booking?.responsibleRelationship ?? "")
    .trim()
    .toLowerCase();

  if (relationship === ADULT_RELATIONSHIP_VALUE) {
    return true;
  }

  const student = normalizeText(booking?.studentName);
  const responsible = normalizeText(booking?.responsibleName);

  return (
    String(booking?.responsibleName ?? "").trim() === "Mayor de edad / Responsable" ||
    (!!student && student === responsible)
  );
};

export const formatResponsibleRelationshipLabel = (relationship, otherValue = "") => {
  const normalized = String(relationship ?? "")
    .trim()
    .toLowerCase();

  if (normalized === ADULT_RELATIONSHIP_VALUE) {
    return "Alumno mayor de edad";
  }

  if (normalized === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE) {
    return capitalizeWords(sanitizeRelationshipOtherAr(otherValue)) || "Otro vínculo";
  }

  return RESPONSIBLE_RELATIONSHIP_LABELS.get(normalized) || "Vínculo no especificado";
};

export const getResponsibleDisplay = (booking) => {
  if (isAdultBooking(booking)) {
    return "Alumno mayor de edad";
  }

  const student = normalizeText(booking.studentName);
  const responsible = normalizeText(booking.responsibleName);

  if (!booking.responsibleName || student === responsible) {
    return "Alumno mayor de edad";
  }

  return booking.responsibleName;
};

export const getResponsibleRelationshipDisplay = (booking) =>
  formatResponsibleRelationshipLabel(
    isAdultBooking(booking)
      ? ADULT_RELATIONSHIP_VALUE
      : booking?.responsibleRelationship,
    booking?.responsibleRelationshipOther,
  );

export const getResponsibleSummary = (booking) => {
  if (isAdultBooking(booking)) {
    return "Reserva directa del alumno";
  }

  const name = String(booking?.responsibleName ?? "").trim();
  const relationship = getResponsibleRelationshipDisplay(booking);

  if (!name) {
    return relationship;
  }

  return `${relationship}: ${name}`;
};

export const getBookingStatusBucket = (status) =>
  String(status ?? "").trim() === "Cancelado" ? "Cancelado" : "Confirmado";

export const getBookingStatusLabel = (status) => getBookingStatusBucket(status);

export const buildStudentKey = (booking) =>
  [
    normalizeText(booking.studentName),
    String(booking.phone ?? "").replace(/\D/g, ""),
    normalizeText(booking.responsibleName),
    normalizeText(booking.responsibleRelationship),
    normalizeText(booking.responsibleRelationshipOther),
  ].join("|");
