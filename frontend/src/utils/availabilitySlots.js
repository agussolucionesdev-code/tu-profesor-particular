const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const getBusinessDateKey = (date, timeZone = DEFAULT_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

/**
 * Keeps the deployed legacy schedule only for servers that do not return slots.
 * An empty `slots` array is authoritative and must remain empty.
 */
export const selectSlotsForDate = ({
  selectedDate,
  backendSlots,
  fallbackSlots,
  timeZone = DEFAULT_TIME_ZONE,
}) => {
  if (!Array.isArray(backendSlots)) return fallbackSlots;
  if (!selectedDate) return [];

  const selectedDateKey = getBusinessDateKey(selectedDate, timeZone);
  return backendSlots.flatMap((slot) => {
    const timeObj = new Date(slot.timeSlot);
    if (Number.isNaN(timeObj.getTime()) || getBusinessDateKey(timeObj, timeZone) !== selectedDateKey) {
      return [];
    }

    return [{
      ...slot,
      timeObj,
      isOccupied: false,
      status: "available",
      source: "backend",
    }];
  });
};

export const getAvailableBackendDateKeys = (backendSlots, timeZone = DEFAULT_TIME_ZONE) => {
  if (!Array.isArray(backendSlots)) return null;

  return new Set(
    backendSlots.flatMap((slot) => {
      const time = new Date(slot.timeSlot);
      return Number.isNaN(time.getTime()) ? [] : [getBusinessDateKey(time, timeZone)];
    }),
  );
};
