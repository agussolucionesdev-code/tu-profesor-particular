import apiClient from "./apiClient";

/**
 * Public booking endpoints
 */
export const fetchAvailability = (params) =>
  apiClient.get("/api/bookings/availability", { params });

export const createBooking = (data) =>
  apiClient.post("/api/bookings/reserve", data);

export const lookupBookings = (identifier) =>
  apiClient.get(`/api/bookings/${encodeURIComponent(identifier)}`);

export const requestManagementLink = (data) =>
  apiClient.post("/api/bookings/manage/request-link", data);

export const rescheduleBooking = (data) =>
  apiClient.post("/api/bookings/reschedule", data);

export const cancelBooking = (data) =>
  apiClient.post("/api/bookings/cancel", data);

export const confirmAttendance = (bookingCode) =>
  apiClient.post("/api/bookings/confirm-attendance", { bookingCode });

/**
 * Admin-only endpoints — require Authorization header via authConfig
 * authConfig shape: { headers: { Authorization: "Bearer <token>" } }
 */
export const fetchAllBookings = (authConfig) =>
  apiClient.get("/api/bookings", authConfig);

export const updateBooking = (id, data, authConfig) =>
  apiClient.put(`/api/bookings/${id}`, data, authConfig);

export const deleteBooking = (id, authConfig) =>
  apiClient.delete(`/api/bookings/${id}`, authConfig);

export const deleteAllBookings = (authConfig) =>
  apiClient.delete("/api/bookings/all", authConfig);

export const loginAdmin = (credentials) =>
  apiClient.post("/api/auth/login", credentials);

/**
 * Blocked dates
 */
export const fetchBlockedDates = () =>
  apiClient.get("/api/blocked-dates");

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

export const updateSetting = (key, value, authConfig) =>
  apiClient.put(`/api/settings/${encodeURIComponent(key)}`, { value }, authConfig);

/**
 * Student notes (public, by booking code)
 */
export const updateStudentNotes = (code, studentNotes) =>
  apiClient.put(`/api/bookings/${encodeURIComponent(code)}/notes`, { studentNotes });
