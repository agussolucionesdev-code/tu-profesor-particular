import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAllBookings,
  createAdminBooking as apiCreateAdminBooking,
  updateBooking,
  updateBookingAttendance as apiUpdateBookingAttendance,
  deleteBooking as apiDeleteBooking,
} from "../api/bookingApi";
import { toSafeDate as toDate } from "../utils/bookingFormatters";
import {
  createSingleFlight,
  normalizeCanonicalBooking,
  replaceBookingWithCanonical,
} from "../utils/adminOperations";

const AUTO_REFRESH_INTERVAL_MS = 60_000;

export const useBookingsData = ({
  authConfig,
  isAuthenticated,
  handleLogout,
  pauseAutoRefreshRef,
}) => {
  const [bookings, setBookings] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const refreshControllerRef = useRef(null);
  if (!refreshControllerRef.current) {
    refreshControllerRef.current = createSingleFlight();
  }

  const fetchBookings = useCallback(({ silent = false } = {}) => {
    return refreshControllerRef.current.run(async () => {
      if (!silent) setDataLoading(true);
      try {
        const response = await fetchAllBookings(authConfig);
        setBookings(Array.isArray(response.data.data) ? response.data.data : []);
        setLastRefreshedAt(new Date());
      } catch (error) {
        console.error("Error al cargar reservas:", error);
        if (error.response?.status === 401) {
          handleLogout();
          setBookings([]);
        }
      } finally {
        if (!silent) setDataLoading(false);
      }
    });
  }, [authConfig, handleLogout]);

  useEffect(() => {
    if (isAuthenticated) fetchBookings();
  }, [isAuthenticated, fetchBookings]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const intervalId = window.setInterval(() => {
      if (!pauseAutoRefreshRef?.current) {
        fetchBookings({ silent: true });
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [fetchBookings, isAuthenticated, pauseAutoRefreshRef]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isAuthenticated) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        fetchBookings();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthenticated, fetchBookings]);

  const sortedBookings = useMemo(
    () =>
      [...bookings].sort((a, b) => {
        const first = toDate(a.timeSlot)?.getTime() ?? 0;
        const second = toDate(b.timeSlot)?.getTime() ?? 0;
        return first - second;
      }),
    [bookings],
  );

  const handleQuickStatusChange = useCallback(
    async (id, newStatus) => {
      try {
        const response = await updateBooking(
          id,
          { status: newStatus },
          authConfig,
        );
        const updatedBooking = normalizeCanonicalBooking(
          id,
          response?.data?.data,
        );
        setBookings((current) =>
          replaceBookingWithCanonical(current, id, updatedBooking),
        );
        return { ok: true, booking: updatedBooking };
      } catch (error) {
        console.error("No se pudo actualizar el estado del turno:", id);
        return {
          ok: false,
          error:
            error?.response?.data?.message ||
            "No se pudo actualizar el estado del turno.",
        };
      }
    },
    [authConfig],
  );

  const updateBookingFields = useCallback(
    async (id, payload) => {
      const response = await updateBooking(id, payload, authConfig);
      const updatedBooking = normalizeCanonicalBooking(id, response?.data?.data);
      setBookings((current) =>
        replaceBookingWithCanonical(current, id, updatedBooking),
      );
      return updatedBooking;
    },
    [authConfig],
  );

  const createAdminBooking = useCallback(
    async (payload, idempotencyKey) => {
      const response = await apiCreateAdminBooking(
        payload,
        authConfig,
        idempotencyKey,
      );
      const createdBooking = normalizeCanonicalBooking(
        response?.data?.data?._id,
        response?.data?.data,
      );
      setBookings((current) => [
        createdBooking,
        ...current.filter((booking) => booking._id !== createdBooking._id),
      ]);
      return createdBooking;
    },
    [authConfig],
  );

  const updateBookingAttendance = useCallback(
    async (id, payload) => {
      const response = await apiUpdateBookingAttendance(id, payload, authConfig);
      const updatedBooking = response.data.data;
      setBookings((current) =>
        current.map((booking) =>
          booking._id === id ? updatedBooking : booking,
        ),
      );
      return updatedBooking;
    },
    [authConfig],
  );

  const handleDeleteBooking = useCallback(
    async (id) => {
      try {
        await apiDeleteBooking(id, authConfig);
        setBookings((current) => current.filter((booking) => booking._id !== id));
      } catch {
        console.error("Error al eliminar la reserva:", id);
        throw new Error("No se pudo eliminar la reserva.");
      }
    },
    [authConfig],
  );

  const clearBookings = useCallback(() => setBookings([]), []);

  return {
    bookings,
    sortedBookings,
    dataLoading,
    lastRefreshedAt,
    refreshBookings: fetchBookings,
    handleQuickStatusChange,
    createAdminBooking,
    updateBookingFields,
    updateBookingAttendance,
    deleteBooking: handleDeleteBooking,
    clearBookings,
  };
};
