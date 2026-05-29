import { useDeferredValue, useMemo, useState } from "react";
import {
  normalizeText as norm,
  getBookingStatusBucket as bookingStatusBucket,
} from "../utils/bookingFormatters";

export const useBookingFilters = (sortedBookings) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const deferredSearch = useDeferredValue(searchTerm);

  const filteredBookings = useMemo(() => {
    const term = norm(deferredSearch);
    return sortedBookings.filter((booking) => {
      const blob = norm(
        [
          booking.studentName,
          booking.responsibleName,
          booking.bookingCode,
          booking.phone,
          booking.email,
          booking.subject,
        ].join(" "),
      );
      const matchesSearch = !term || blob.includes(term);
      const matchesStatus =
        filterStatus === "Todos" ||
        booking.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [filterStatus, deferredSearch, sortedBookings]);

  return {
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filteredBookings,
    matchCount: filteredBookings.length,
    totalCount: sortedBookings.length,
  };
};
