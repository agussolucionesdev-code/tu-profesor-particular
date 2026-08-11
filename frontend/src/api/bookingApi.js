import apiClient from "./apiClient";
import { createIdempotencyKey, withIdempotencyKey } from "../utils/idempotencyKey";

const managementConfig = (managementToken) => ({
  headers: { "X-Booking-Manage-Token": managementToken },
});

/**
 * Public booking endpoints
 */
export const fetchAvailability = (params, managementToken) =>
  apiClient.get(
    "/api/bookings/availability",
    managementToken
      ? { params, ...managementConfig(managementToken) }
      : { params },
  );

export const createBooking = (data, idempotencyKey = createIdempotencyKey()) =>
  apiClient.post("/api/bookings/reserve", data, withIdempotencyKey(idempotencyKey));

export const requestManagementLink = (data) =>
  apiClient.post("/api/bookings/manage/request-link", data);

// A bearer link token is sent exclusively in this request header. Never put
// it in a URL, Axios defaults, browser storage, or telemetry.
export const getManagedBooking = (managementToken) =>
  apiClient.get("/api/bookings/manage", managementConfig(managementToken));

export const revokeManagementAccess = (managementToken) =>
  apiClient.post("/api/bookings/manage/revoke", {}, managementConfig(managementToken));

/* Entrada al portal con el código de reserva. Devuelve el mismo token de
   gestión que antes llegaba por mail, pero en el acto.

   El token que vuelve de acá se guarda SOLO en memoria, por la misma razón que
   dice el comentario de arriba: nada de localStorage ni sessionStorage. Si la
   persona recarga, vuelve a escribir su código —son seis caracteres— y eso es
   preferible a dejar una llave de 30 días tirada en el disco del navegador. */
export const createPortalSession = (bookingCode) =>
  apiClient.post("/api/bookings/portal/session", { bookingCode });

export const fetchPortalHistory = (managementToken) =>
  apiClient.get("/api/bookings/portal/history", managementConfig(managementToken));

export const rescheduleBooking = (
  data,
  managementToken,
  idempotencyKey = createIdempotencyKey(),
) =>
  apiClient.post(
    "/api/bookings/reschedule",
    data,
    withIdempotencyKey(
      idempotencyKey,
      managementToken ? managementConfig(managementToken) : undefined,
    ),
  );

export const cancelBooking = (data, managementToken) =>
  apiClient.post(
    "/api/bookings/cancel",
    data,
    managementToken ? managementConfig(managementToken) : undefined,
  );

/* Mismo caso que updateStudentNotes: la ruta exige el token de gestión y este
   wrapper no lo mandaba, así que habría dado 401 siempre. Nadie lo notó porque
   ninguna pantalla lo llamaba —el endpoint estaba construido y sin usar—. */
export const confirmAttendance = (bookingCode, managementToken) =>
  apiClient.post(
    "/api/bookings/confirm-attendance",
    { bookingCode },
    managementConfig(managementToken),
  );

/**
 * Admin-only endpoints — require Authorization header via authConfig
 * authConfig shape: { headers: { Authorization: "Bearer <token>" } }
 */
export const fetchAllBookings = (authConfig) =>
  apiClient.get("/api/bookings", authConfig);

export const fetchAdminAvailability = (params, authConfig, signal) =>
  apiClient.get("/api/bookings/admin/availability", {
    ...authConfig,
    params,
    signal,
  });

export const createAdminBooking = (
  data,
  authConfig,
  idempotencyKey = createIdempotencyKey(),
) =>
  apiClient.post(
    "/api/bookings",
    data,
    withIdempotencyKey(idempotencyKey, authConfig),
  );

export const updateBooking = (id, data, authConfig) =>
  apiClient.put(`/api/bookings/${id}`, data, authConfig);

export const updateBookingAttendance = (id, data, authConfig) =>
  apiClient.patch(`/api/bookings/${id}/attendance`, data, authConfig);

export const fetchStudents = (params, authConfig) =>
  apiClient.get("/api/students", { ...authConfig, params });

export const fetchStudentById = (id, authConfig, signal) =>
  apiClient.get(`/api/students/${encodeURIComponent(id)}`, {
    ...authConfig,
    signal,
  });

export const fetchAdminNotifications = (params, authConfig, signal) =>
  apiClient.get("/api/notifications", {
    ...authConfig,
    params,
    signal,
  });

export const retryAdminNotification = (id, authConfig) =>
  apiClient.post(
    `/api/notifications/${encodeURIComponent(id)}/retry`,
    {},
    authConfig,
  );

export const deleteBooking = (id, authConfig) =>
  apiClient.delete(`/api/bookings/${id}`, authConfig);

export const loginAdmin = (credentials) =>
  apiClient.post("/api/auth/login", credentials);

/**
 * Blocked dates
 */
export const fetchBlockedDates = (authConfig) =>
  apiClient.get("/api/blocked-dates", authConfig);

export const addBlockedDate = (data, authConfig) =>
  apiClient.post("/api/blocked-dates", data, authConfig);

export const removeBlockedDate = (date, authConfig) =>
  apiClient.delete(`/api/blocked-dates/${date}`, authConfig);

/**
 * Settings
 */
export const fetchPublicSettings = () =>
  apiClient.get("/api/settings");

export const fetchAdminSettings = (authConfig) =>
  apiClient.get("/api/settings/admin", authConfig);

export const fetchAdminSchedule = (authConfig) =>
  apiClient.get("/api/settings/admin/schedule", authConfig);

export const updateAdminSchedule = (schedule, revision, authConfig) =>
  apiClient.put(
    "/api/settings/admin/schedule",
    { schedule },
    {
      ...authConfig,
      headers: {
        ...authConfig?.headers,
        "If-Match": `"${revision}"`,
      },
    },
  );

export const fetchAdminSubjects = (authConfig, signal) =>
  apiClient.get("/api/settings/admin/subjects", {
    ...authConfig,
    signal,
  });

export const updateAdminSubjects = (subjects, revision, authConfig) =>
  apiClient.put(
    "/api/settings/admin/subjects",
    subjects,
    {
      ...authConfig,
      headers: {
        ...authConfig?.headers,
        "If-Match": `"${revision}"`,
      },
    },
  );

export const updateSetting = (key, value, authConfig) =>
  apiClient.put(`/api/settings/${encodeURIComponent(key)}`, { value }, authConfig);

/**
 * Student notes (public, by booking code)
 */
/* La ruta exige el token de gestión: `managementBookingForCode` compara el
   código del token contra el de la URL. Este wrapper no lo mandaba, así que
   devolvía 401 siempre —y como el panel que lo usaba nunca se había montado en
   ninguna pantalla, nadie lo notó—. */
export const updateStudentNotes = (code, studentNotes, managementToken) =>
  apiClient.put(
    `/api/bookings/${encodeURIComponent(code)}/notes`,
    { studentNotes },
    managementConfig(managementToken),
  );

/* Resumen de una serie por email: un correo con todas las fechas y códigos en
   lugar de ocho confirmaciones que llegan juntas.
   Va con el token de gestión de CUALQUIER clase de la serie. El backend verifica
   que ese token sea de esa serie: el seriesId agrupa y no autoriza. */
export const sendSeriesSummary = (seriesId, managementToken) =>
  apiClient.post(
    "/api/bookings/series/summary",
    { seriesId },
    managementConfig(managementToken),
  );
