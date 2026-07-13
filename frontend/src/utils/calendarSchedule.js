export const parseCalendarSchedule = (settings) => {
  if (!settings || typeof settings !== "object") return null;

  const openingHour = Number(settings["schedule.openingHour"]);
  const closingHour = Number(settings["schedule.closingHour"]);
  if (
    !Number.isInteger(openingHour) ||
    !Number.isInteger(closingHour) ||
    openingHour < 0 ||
    closingHour > 24 ||
    openingHour >= closingHour
  ) {
    return null;
  }

  return { openingHour, closingHour };
};

export const createCalendarRange = (schedule) => {
  if (!schedule) return null;
  const totalHours = schedule.closingHour - schedule.openingHour;
  return {
    ...schedule,
    totalHours,
    hours: Array.from(
      { length: totalHours },
      (_, index) => schedule.openingHour + index,
    ),
  };
};
