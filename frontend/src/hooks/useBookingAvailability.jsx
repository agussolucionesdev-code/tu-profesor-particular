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
  parsePublicAvailabilityResponse,
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

/**
 * @param fullRange cuando es true se pide toda la agenda del servidor en lugar
 *        de la ventana inicial corta. Lo activa el kiosco al abrir el
 *        calendario, que sí necesita ver los meses siguientes.
 */
export const useBookingAvailability = (
  selectedDate,
  selectedDuration,
  showToast,
  fullRange = false,
  /* La modalidad ya elegida en el paso 2. Va al backend porque cada modalidad tiene
     su propia ventana horaria: presencial abre más tarde y cierra antes que online.
     Sin mandarla, el calendario ofrece horarios que la confirmación después rechaza,
     y el usuario se entera recién en el último paso. */
  modality = null,
) => {
  const [existingBookings, setExistingBookings] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [backendSlots, setBackendSlots] = useState(undefined);
  const [availabilityTimeZone, setAvailabilityTimeZone] = useState(undefined);
  const [availabilityMinDate, setAvailabilityMinDate] = useState(null);
  const [availabilityMaxDate, setAvailabilityMaxDate] = useState(null);
  const [availabilityRangeLabel, setAvailabilityRangeLabel] = useState("");
  const [resolvedAvailabilityDuration, setResolvedAvailabilityDuration] = useState(null);
  const [availabilityStatus, setAvailabilityStatus] = useState("loading");
  const [availabilityRequestVersion, setAvailabilityRequestVersion] = useState(0);

  useEffect(() => {
    let isCurrentRequest = true;
    const requestParams = availabilityRequestParams(selectedDuration, {
      days: fullRange ? null : undefined,
      modality,
    });
    const requestedDuration = requestParams?.duration ?? null;

    const loadBookings = async () => {
      try {
        const res = await fetchAvailability(requestParams);
        const parsed = parsePublicAvailabilityResponse(res.data);
        if (!isCurrentRequest) return;
        setExistingBookings(
          parsed.existingBookings.filter(
            (booking) => booking.status !== "Cancelado",
          ),
        );
        setBlockedDates(parsed.blockedDates);
        setBackendSlots(parsed.slots);
        setAvailabilityTimeZone(parsed.schedule.timeZone);
        setAvailabilityMinDate(parsed.minDate);
        setAvailabilityMaxDate(parsed.maxDate);
        setAvailabilityRangeLabel(parsed.rangeLabel);
        setResolvedAvailabilityDuration(requestedDuration);
        setAvailabilityStatus("ready");
      } catch (error) {
        if (!isCurrentRequest) return;
        console.error("Error fetching bookings", error);
        setExistingBookings([]);
        setBlockedDates([]);
        setBackendSlots(undefined);
        setAvailabilityTimeZone(undefined);
        setAvailabilityMinDate(null);
        setAvailabilityMaxDate(null);
        setAvailabilityRangeLabel("");
        setResolvedAvailabilityDuration(requestedDuration);
        setAvailabilityStatus("error");
        showToast?.(getBookingApiMessage(error), "warning");
      }
    };

    loadBookings();
    return () => {
      isCurrentRequest = false;
    };
    // fullRange entra como dependencia: al abrir el calendario hay que volver a
    // pedir la agenda, esta vez completa.
    // modality entra como dependencia: cambiar de online a presencial cambia la
    // ventana horaria, así que hay que volver a pedir la agenda.
  }, [availabilityRequestVersion, selectedDuration, showToast, fullRange, modality]);

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

  // Kiosco: los próximos turnos agrupados por día, ordenados de más cercano a
  // más lejano. Permite "elegí y listo" sin obligar a navegar un calendario.
  // Aditivo: el flujo clásico lo ignora.
  const upcomingSlotsByDay = useMemo(() => {
    if (effectiveAvailabilityStatus !== "ready" || !Array.isArray(backendSlots)) {
      return [];
    }
    const sorted = backendSlots
      .map((slot) => ({ ...slot, timeObj: new Date(slot.timeSlot) }))
      .filter((slot) => !Number.isNaN(slot.timeObj.getTime()))
      .sort((a, b) => a.timeObj - b.timeObj);

    const byDay = new Map();
    for (const slot of sorted) {
      const key = getBusinessDateKey(slot.timeObj, availabilityTimeZone);
      if (!byDay.has(key)) byDay.set(key, { dateKey: key, dayObj: slot.timeObj, slots: [] });
      byDay.get(key).slots.push(slot);
    }
    return [...byDay.values()];
  }, [effectiveAvailabilityStatus, backendSlots, availabilityTimeZone]);

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
      const minimumKey = availabilityMinDate
        ? getBusinessDateKey(availabilityMinDate, availabilityTimeZone)
        : null;
      const maximumKey = availabilityMaxDate
        ? getBusinessDateKey(availabilityMaxDate, availabilityTimeZone)
        : null;
      return (
        effectiveAvailabilityStatus === "ready" &&
        minimumKey !== null &&
        maximumKey !== null &&
        dayKey >= minimumKey &&
        dayKey <= maximumKey &&
        !blockedDates.includes(dayKey) &&
        Boolean(availableBackendDateKeys?.has(dayKey))
      );
    },
    [
      effectiveAvailabilityStatus,
      blockedDates,
      availableBackendDateKeys,
      availabilityTimeZone,
      availabilityMinDate,
      availabilityMaxDate,
    ],
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
    upcomingSlotsByDay,
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
    availabilityMinDate,
    availabilityMaxDate,
    availabilityRangeLabel,
    retryAvailability: () => {
      setAvailabilityStatus("loading");
      setBackendSlots(undefined);
      setBlockedDates([]);
      setAvailabilityMinDate(null);
      setAvailabilityMaxDate(null);
      setAvailabilityRangeLabel("");
      setAvailabilityRequestVersion((version) => version + 1);
    },
  };
};
