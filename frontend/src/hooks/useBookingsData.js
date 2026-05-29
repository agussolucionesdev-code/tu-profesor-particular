import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAllBookings,
  updateBooking,
  deleteBooking as apiDeleteBooking,
  deleteAllBookings as apiDeleteAllBookings,
} from "../api/bookingApi";
import { toSafeDate as toDate } from "../utils/bookingFormatters";

export const useBookingsData = ({ authConfig, isAuthenticated, handleLogout }) => {
  const [bookings, setBookings] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const fetchBookings = useCallback(async () => {
    setDataLoading(true);
    try {
      const response = await fetchAllBookings(authConfig);
      setBookings(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      console.error("Error al cargar reservas:", error);
      if (error.response?.status === 401) {
        handleLogout();
        setBookings([]);
      }
    } finally {
      setDataLoading(false);
    }
  }, [authConfig, handleLogout]);

  useEffect(() => {
    if (isAuthenticated) fetchBookings();
  }, [isAuthenticated, fetchBookings]);

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
        await updateBooking(id, { status: newStatus }, authConfig);
        setBookings((current) =>
          current.map((booking) =>
            booking._id === id ? { ...booking, status: newStatus } : booking,
          ),
        );
      } catch {
        console.error("No se pudo actualizar el estado del turno:", id);
      }
    },
    [authConfig],
  );

  const updateBookingFields = useCallback(
    async (id, payload) => {
      await updateBooking(id, payload, authConfig);
      setBookings((current) =>
        current.map((booking) =>
          booking._id === id ? { ...booking, ...payload } : booking,
        ),
      );
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

  const handleDeleteAll = useCallback(
    async () => {
      setDataLoading(true);
      try {
        await apiDeleteAllBookings(authConfig);
        setBookings([]);
      } catch {
        console.error("No se pudo limpiar la base de reservas.");
        throw new Error("No se pudo limpiar la base.");
      } finally {
        setDataLoading(false);
      }
    },
    [authConfig],
  );

  const clearBookings = useCallback(() => setBookings([]), []);

  return {
    bookings,
    sortedBookings,
    dataLoading,
    handleQuickStatusChange,
    updateBookingFields,
    deleteBooking: handleDeleteBooking,
    deleteAllBookings: handleDeleteAll,
    clearBookings,
  };
};
