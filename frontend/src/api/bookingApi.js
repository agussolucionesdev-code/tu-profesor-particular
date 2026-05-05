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

export const rescheduleBooking = (data) =>
  apiClient.post("/api/bookings/reschedule", data);

export const cancelBooking = (data) =>
  apiClient.post("/api/bookings/cancel", data);

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
