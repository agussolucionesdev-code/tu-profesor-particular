import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isSameDay, startOfDay } from "date-fns";
import { fetchAvailability } from "../api/bookingApi";
import { getBookingApiMessage } from "../utils/bookingFormatters";
import {
  availabilityRequestParams,
  getAvailableBackendDateKeys,
  getBusinessDateKey,
  isSelectedTimeAvailable,
  isVerifiedAvailabilitySelection,
  selectSlotsForDate,
} from "../utils/availabilitySlots";

const SLOT_SECTIONS_DEFINITION = [
  {
    id: "morning",
    label: "Mañana",
    match: (hour) => hour < 12,
  },
  {
    id: "afternoon",
    label: "Tarde",
    match: (hour) => hour >= 12 && hour < 17,
  },
  {
    id: "evening",
    label: "Tarde noche",
    match: (hour) => hour >= 17,
  },
];

const describeSlotRange = (slots) => {
  if (slots.length === 0) return "";
  return `${format(slots[0].timeObj, "HH:mm")} a ${format(slots.at(-1).timeObj, "HH:mm")}`;
};

export const useBookingAvailability = (selectedDate, selectedDuration, showToast) => {
  const [existingBookings, setExistingBookings] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [backendSlots, setBackendSlots] = useState(undefined);
  const [availabilityTimeZone, setAvailabilityTimeZone] = useState(undefined);
  const [resolvedAvailabilityDuration, setResolvedAvailabilityDuration] = useState(null);
  const [availabilityStatus, setAvailabilityStatus] = useState("loading");
  const [availabilityRequestVersion, setAvailabilityRequestVersion] = useState(0);

  useEffect(() => {
    let isCurrentRequest = true;
    const requestParams = availabilityRequestParams(selectedDuration);
    const requestedDuration = requestParams?.duration ?? null;

    const loadBookings = async () => {
      try {
        const res = await fetchAvailability(requestParams);
        if (!isCurrentRequest) return;
        setExistingBookings(
          (Array.isArray(res.data.data) ? res.data.data : []).filter(
            (booking) => booking.status !== "Cancelado",
          ),
        );
        setBlockedDates(Array.isArray(res.data.blockedDates) ? res.data.blockedDates : []);
        setBackendSlots(Array.isArray(res.data.slots) ? res.data.slots : undefined);
        setAvailabilityTimeZone(res.data.schedule?.timeZone);
        setResolvedAvailabilityDuration(requestedDuration);
        setAvailabilityStatus(Array.isArray(res.data.slots) ? "ready" : "error");
      } catch (error) {
        if (!isCurrentRequest) return;
        console.error("Error fetching bookings", error);
        setBackendSlots(undefined);
        setResolvedAvailabilityDuration(requestedDuration);
        setAvailabilityStatus("error");
        showToast?.(getBookingApiMessage(error), "warning");
      }
    };

    loadBookings();
    return () => {
      isCurrentRequest = false;
    };
  }, [availabilityRequestVersion, selectedDuration, showToast]);

  const requestedDuration = availabilityRequestParams(selectedDuration)?.duration ?? null;
  const effectiveAvailabilityStatus = resolvedAvailabilityDuration === requestedDuration
    ? availabilityStatus
    : "loading";

  const availableSlots = useMemo(
    () =>
      effectiveAvailabilityStatus === "ready"
        ? selectSlotsForDate({
          selectedDate,
          backendSlots,
          timeZone: availabilityTimeZone,
        })
        : [],
    [effectiveAvailabilityStatus, selectedDate, backendSlots, availabilityTimeZone],
  );

  const availableBackendDateKeys = useMemo(
    () => getAvailableBackendDateKeys(backendSlots, availabilityTimeZone),
    [backendSlots, availabilityTimeZone],
  );

  const getDayClassName = useCallback(
    (date) => {
      const today = new Date();
      const dayKey = getBusinessDateKey(date, availabilityTimeZone);
      const base = isSameDay(date, today) ? "custom-today" : "";

      if (blockedDates.includes(dayKey)) {
        return base ? `${base} day-blocked` : "day-blocked";
      }
      if (effectiveAvailabilityStatus === "ready" && !availableBackendDateKeys?.has(dayKey)) {
        return base ? `${base} day-full` : "day-full";
      }
      if (availableBackendDateKeys?.has(dayKey)) {
        return base ? `${base} day-partial` : "day-partial";
      }
      return base;
    },
    [effectiveAvailabilityStatus, blockedDates, availableBackendDateKeys, availabilityTimeZone],
  );

  const renderDayContents = useCallback(
    (day, date) => {
      const dayKey = getBusinessDateKey(date, availabilityTimeZone);
      let statusLabel = "disponibilidad pendiente";
      if (blockedDates.includes(dayKey)) statusLabel = "bloqueado";
      else if (effectiveAvailabilityStatus === "ready" && !availableBackendDateKeys?.has(dayKey)) {
        statusLabel = "sin cupos";
      } else if (availableBackendDateKeys?.has(dayKey)) {
        statusLabel = "con horarios disponibles";
      }

      return (
        <>
          {day}
          <span className="sr-only">, {statusLabel}</span>
        </>
      );
    },
    [effectiveAvailabilityStatus, blockedDates, availableBackendDateKeys, availabilityTimeZone],
  );

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
      SLOT_SECTIONS_DEFINITION.map((section) => {
        const slots = availableSlots.filter((slot) =>
          section.match(slot.timeObj.getHours()),
        );
        return {
          ...section,
          helper: describeSlotRange(slots),
          slots,
        };
      }).filter((section) => section.slots.length > 0),
    [availableSlots],
  );

  const maxAllowedDuration = 3;
  const durationOptions = useMemo(() => {
    const options = [];
    for (let current = 0.5; current <= maxAllowedDuration; current += 0.5) {
      options.push(Number(current.toFixed(1)));
    }
    return options;
  }, []);

  const isDateAvailable = useCallback(
    (date) => {
      const dayKey = getBusinessDateKey(date, availabilityTimeZone);
      return (
        effectiveAvailabilityStatus === "ready" &&
        !blockedDates.includes(dayKey) &&
        Boolean(availableBackendDateKeys?.has(dayKey))
      );
    },
    [effectiveAvailabilityStatus, blockedDates, availableBackendDateKeys, availabilityTimeZone],
  );

  const hasAnyAvailability =
    effectiveAvailabilityStatus === "ready" && Boolean(availableBackendDateKeys?.size);

  return {
    existingBookings,
    blockedDates,
    availableSlots,
    slotSections,
    getDayClassName,
    renderDayContents,
    isDateAvailable,
    hasAnyAvailability,
    maxAllowedDuration,
    durationOptions,
    availableSlotCount,
    nextFreeSlot,
    selectedDayOnly,
    isSelectedTimeAvailable: isSelectedTimeAvailable({
      selectedTime: selectedDate,
      backendSlots,
    }),
    isSelectedTimeVerified: isVerifiedAvailabilitySelection({
      availabilityStatus: effectiveAvailabilityStatus,
      selectedTime: selectedDate,
      backendSlots,
    }),
    availabilityMatchesSelectedDuration: resolvedAvailabilityDuration === requestedDuration,
    availabilityStatus: effectiveAvailabilityStatus,
    retryAvailability: () => {
      setAvailabilityStatus("loading");
      setBackendSlots(undefined);
      setAvailabilityRequestVersion((version) => version + 1);
    },
  };
};
