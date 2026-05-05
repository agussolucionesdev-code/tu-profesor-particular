import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMinutes,
  differenceInMinutes,
  format,
  isSameDay,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import { fetchAvailability } from "../api/bookingApi";
import { getBookingApiMessage } from "../utils/bookingFormatters";

// 30 medias horas entre 07:00 y 22:00 — referencia para colorear días llenos en el calendario.
const TOTAL_DAY_SLOTS = 30;

const SLOT_SECTIONS_DEFINITION = [
  {
    id: "morning",
    label: "Mañana",
    helper: "07:00 a 11:30",
    match: (hour) => hour < 12,
  },
  {
    id: "afternoon",
    label: "Tarde",
    helper: "12:00 a 16:30",
    match: (hour) => hour >= 12 && hour < 17,
  },
  {
    id: "evening",
    label: "Tarde noche",
    helper: "17:00 a 21:30",
    match: (hour) => hour >= 17,
  },
];

export const useBookingAvailability = (selectedDate, showToast) => {
  const [existingBookings, setExistingBookings] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);

  useEffect(() => {
    const loadBookings = async () => {
      try {
        const res = await fetchAvailability();
        setExistingBookings(
          res.data.data.filter((booking) => booking.status !== "Cancelado"),
        );
        setBlockedDates(Array.isArray(res.data.blockedDates) ? res.data.blockedDates : []);
      } catch (error) {
        console.error("Error fetching bookings", error);
        showToast?.(getBookingApiMessage(error), "warning");
      }
    };
    loadBookings();
  }, [showToast]);

  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];

    const dayStart = startOfDay(selectedDate);
    const now = new Date();
    const isToday = isSameDay(dayStart, now);

    let cursor = setHours(setMinutes(dayStart, 0), 7);
    const closingTime = setHours(setMinutes(dayStart, 0), 22);

    const slots = [];
    while (cursor < closingTime) {
      const isOccupiedByBooking = existingBookings.some((booking) => {
        const bookStart = new Date(booking.timeSlot);
        const bookEnd = new Date(booking.endTime);
        return cursor >= bookStart && cursor < bookEnd;
      });

      const isPast = isToday && cursor <= addMinutes(now, 60);
      const status = isPast
        ? "past"
        : isOccupiedByBooking
          ? "occupied"
          : "available";

      slots.push({
        timeObj: new Date(cursor),
        isOccupied: isOccupiedByBooking || isPast,
        status,
      });

      cursor = addMinutes(cursor, 30);
    }
    return slots;
  }, [selectedDate, existingBookings]);

  const dayAvailabilityMap = useMemo(() => {
    const map = new Map();
    for (const booking of existingBookings) {
      const bStart = new Date(booking.timeSlot);
      const bEnd = new Date(booking.endTime);
      const dayKey = format(startOfDay(bStart), "yyyy-MM-dd");
      if (!map.has(dayKey)) map.set(dayKey, 0);
      const windowStart = setHours(setMinutes(startOfDay(bStart), 0), 7);
      const windowEnd = setHours(setMinutes(startOfDay(bStart), 0), 22);
      let slot = new Date(Math.max(bStart.getTime(), windowStart.getTime()));
      const slotEnd = new Date(Math.min(bEnd.getTime(), windowEnd.getTime()));
      while (slot < slotEnd) {
        map.set(dayKey, map.get(dayKey) + 1);
        slot = addMinutes(slot, 30);
      }
    }
    return map;
  }, [existingBookings]);

  const getDayClassName = useCallback(
    (date) => {
      const today = new Date();
      const dayKey = format(startOfDay(date), "yyyy-MM-dd");
      if (blockedDates.includes(dayKey)) {
        return isSameDay(date, today) ? "custom-today day-blocked" : "day-blocked";
      }
      const occupied = dayAvailabilityMap.get(dayKey) ?? 0;
      const base = isSameDay(date, today) ? "custom-today" : "";
      if (occupied === 0) return base;
      if (occupied >= TOTAL_DAY_SLOTS)
        return base ? `${base} day-full` : "day-full";
      return base ? `${base} day-partial` : "day-partial";
    },
    [dayAvailabilityMap, blockedDates],
  );

  const renderDayContents = useCallback(
    (day, date) => {
      const dayKey = format(startOfDay(date), "yyyy-MM-dd");
      const occupied = dayAvailabilityMap.get(dayKey) ?? 0;
      const statusLabel =
        occupied === 0
          ? "libre"
          : occupied >= TOTAL_DAY_SLOTS
            ? "sin cupos"
            : "con turnos parciales";
      return (
        <>
          {day}
          <span className="sr-only">, {statusLabel}</span>
        </>
      );
    },
    [dayAvailabilityMap],
  );

  const maxAllowedDuration = useMemo(() => {
    if (!selectedDate || selectedDate.getHours() === 0) return 10;
    const bookingsSameDay = existingBookings
      .filter((booking) => isSameDay(new Date(booking.timeSlot), selectedDate))
      .map((booking) => ({ start: new Date(booking.timeSlot) }))
      .filter((booking) => booking.start > selectedDate)
      .sort((a, b) => a.start - b.start);

    const closingTime = setHours(setMinutes(selectedDate, 0), 22);
    const nextLimit =
      bookingsSameDay.length > 0 ? bookingsSameDay[0].start : closingTime;
    const diffMinutes = differenceInMinutes(nextLimit, selectedDate);
    return Math.floor(Math.max(0.5, Math.min(diffMinutes / 60, 10)) * 10) / 10;
  }, [selectedDate, existingBookings]);

  const selectedDayOnly = useMemo(() => {
    if (!selectedDate) return null;
    return startOfDay(selectedDate);
  }, [selectedDate]);

  const availableSlotCount = useMemo(
    () => availableSlots.filter((slot) => !slot.isOccupied).length,
    [availableSlots],
  );

  const nextFreeSlot = useMemo(
    () => availableSlots.find((slot) => !slot.isOccupied)?.timeObj ?? null,
    [availableSlots],
  );

  const slotSections = useMemo(
    () =>
      SLOT_SECTIONS_DEFINITION.map((section) => ({
        ...section,
        slots: availableSlots.filter((slot) =>
          section.match(slot.timeObj.getHours()),
        ),
      })).filter((section) => section.slots.length > 0),
    [availableSlots],
  );

  const durationOptions = useMemo(() => {
    const options = [];
    for (let current = 0.5; current <= maxAllowedDuration; current += 0.5) {
      options.push(Number(current.toFixed(1)));
    }
    return options;
  }, [maxAllowedDuration]);

  const isDateAvailable = useCallback(
    (date) => {
      const dayKey = format(startOfDay(date), "yyyy-MM-dd");
      return !blockedDates.includes(dayKey);
    },
    [blockedDates],
  );

  return {
    existingBookings,
    blockedDates,
    availableSlots,
    slotSections,
    getDayClassName,
    renderDayContents,
    isDateAvailable,
    maxAllowedDuration,
    durationOptions,
    availableSlotCount,
    nextFreeSlot,
    selectedDayOnly,
  };
};
