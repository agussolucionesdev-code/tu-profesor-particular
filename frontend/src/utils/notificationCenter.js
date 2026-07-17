export const NOTIFICATION_STATUSES = Object.freeze([
  "queued",
  "processing",
  "delivery_unknown",
  "sent",
  "failed",
  "dead",
  "superseded",
]);

export const NOTIFICATION_TYPES = Object.freeze([
  "booking_confirmation",
  "booking_received_pending",
  "booking_pending_updated",
  "booking_rescheduled",
  "booking_cancelled",
  "booking_reminder",
  "management_link_requested",
]);

export const NOTIFICATION_STATUS_LABELS = Object.freeze({
  queued: "En cola",
  processing: "Procesando",
  delivery_unknown: "Entrega sin confirmar",
  sent: "Enviada",
  failed: "Fallida",
  dead: "Agotada",
  superseded: "Obsoleta",
});

export const NOTIFICATION_ERROR_MESSAGES = Object.freeze({
  provider: "El proveedor no confirmó la entrega.",
  configuration: "La entrega no está configurada correctamente.",
  security: "El contenido protegido no pudo validarse.",
  superseded: "La notificación quedó obsoleta por un cambio posterior.",
  unknown: "La entrega no pudo completarse.",
});

export const NOTIFICATION_ERROR_CATEGORY_LABELS = Object.freeze({
  provider: "Proveedor",
  configuration: "Configuración",
  security: "Seguridad",
  superseded: "Obsoleta",
  unknown: "Sin clasificar",
});

export const NOTIFICATION_TYPE_LABELS = Object.freeze({
  booking_confirmation: "Confirmación de turno",
  booking_received_pending: "Solicitud pendiente",
  booking_pending_updated: "Actualización de solicitud pendiente",
  booking_rescheduled: "Reprogramación de turno",
  booking_cancelled: "Cancelación de turno",
  booking_reminder: "Recordatorio de turno",
  management_link_requested: "Enlace seguro solicitado",
});

const ITEM_KEYS = Object.freeze([
  "id",
  "status",
  "retryable",
  "failureDisposition",
  "type",
  "channel",
  "booking",
  "recipient",
  "attempts",
  "maxAttempts",
  "nextAttemptAt",
  "expiresAt",
  "providerMessageId",
  "sentAt",
  "lastError",
  "createdAt",
  "updatedAt",
]);

export class NotificationValidationError extends Error {
  constructor(message = "La respuesta de notificaciones es inválida.") {
    super(message);
    this.name = "NotificationValidationError";
  }
}

const fail = () => {
  throw new NotificationValidationError();
};

const isRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value, keys) => {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
};

const safeText = (value, maxLength = 200) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maxLength &&
  !/[\p{Cc}\p{Cs}\p{Default_Ignorable_Code_Point}]/u.test(value);

const parseProviderMessageId = (value) => {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,128}@[A-Za-z0-9.-]{1,63}$/u.test(value) ||
    /[\p{Cc}\p{Cs}\p{Default_Ignorable_Code_Point}<>]/u.test(value)
  ) fail();
  return value;
};

const parseLastError = (value) => {
  if (value === null) return null;
  if (!hasExactKeys(value, ["category", "message"])) fail();
  const expectedMessage = NOTIFICATION_ERROR_MESSAGES[value.category];
  if (!expectedMessage || value.message !== expectedMessage) fail();
  return { category: value.category, message: expectedMessage };
};

const isoDateOrNull = (value) => {
  if (value === null) return null;
  if (typeof value !== "string") fail();
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) fail();
  return value;
};

export const parseNotificationDto = (value) => {
  if (!hasExactKeys(value, ITEM_KEYS)) fail();
  if (
    !safeText(value.id, 100) ||
    !NOTIFICATION_STATUSES.includes(value.status) ||
    typeof value.retryable !== "boolean" ||
    ![null, "retryable", "terminal", "security", "ambiguous", "configuration"].includes(value.failureDisposition) ||
    !NOTIFICATION_TYPES.includes(value.type) ||
    value.channel !== "email" ||
    !hasExactKeys(value.booking, ["id", "bookingCode"]) ||
    !safeText(value.booking.id, 100) ||
    !safeText(value.booking.bookingCode, 32) ||
    !hasExactKeys(value.recipient, ["masked"]) ||
    !safeText(value.recipient.masked, 160) ||
    !value.recipient.masked.includes("*") ||
    !Number.isInteger(value.attempts) ||
    value.attempts < 0 ||
    !Number.isInteger(value.maxAttempts) ||
    value.maxAttempts < 1 ||
    value.attempts > value.maxAttempts
  ) fail();

  return {
    id: value.id,
    status: value.status,
    retryable: value.retryable,
    failureDisposition: value.failureDisposition,
    type: value.type,
    channel: "email",
    booking: { id: value.booking.id, bookingCode: value.booking.bookingCode },
    recipient: { masked: value.recipient.masked },
    attempts: value.attempts,
    maxAttempts: value.maxAttempts,
    providerMessageId: parseProviderMessageId(value.providerMessageId),
    lastError: parseLastError(value.lastError),
    nextAttemptAt: isoDateOrNull(value.nextAttemptAt),
    expiresAt: isoDateOrNull(value.expiresAt),
    sentAt: isoDateOrNull(value.sentAt),
    createdAt: isoDateOrNull(value.createdAt),
    updatedAt: isoDateOrNull(value.updatedAt),
  };
};

export const parseNotificationsListResponse = (responseBody) => {
  if (
    !isRecord(responseBody) ||
    responseBody.success !== true ||
    !hasExactKeys(responseBody.data, ["items", "pagination"]) ||
    !Array.isArray(responseBody.data.items) ||
    !hasExactKeys(responseBody.data.pagination, [
      "page",
      "limit",
      "total",
      "totalPages",
    ])
  ) fail();
  const pagination = responseBody.data.pagination;
  if (
    !Number.isInteger(pagination.page) || pagination.page < 1 ||
    !Number.isInteger(pagination.limit) || pagination.limit < 1 || pagination.limit > 100 ||
    !Number.isInteger(pagination.total) || pagination.total < 0 ||
    !Number.isInteger(pagination.totalPages) || pagination.totalPages < 0 ||
    (pagination.total === 0
      ? pagination.totalPages !== 0 || pagination.page !== 1
      : pagination.totalPages < 1 || pagination.page > pagination.totalPages) ||
    responseBody.data.items.length > pagination.limit
  ) fail();
  return {
    items: responseBody.data.items.map(parseNotificationDto),
    pagination: { ...pagination },
  };
};

export const parseNotificationResponse = (responseBody) => {
  if (!isRecord(responseBody) || responseBody.success !== true) fail();
  return parseNotificationDto(responseBody.data);
};

export const canRetryNotification = (retryable) => retryable === true;

export const replaceNotification = (items, canonical) =>
  items.map((item) => item.id === canonical.id ? canonical : item);

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  dateStyle: "short",
  timeStyle: "short",
});

export const formatNotificationDate = (value) =>
  value ? DATE_FORMATTER.format(new Date(value)) : "—";
