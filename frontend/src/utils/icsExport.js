const pad = (n) => String(n).padStart(2, "0");

const toIcsDate = (date) => {
  const d = new Date(date);
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    "T",
    pad(d.getHours()),
    pad(d.getMinutes()),
    "00",
  ].join("");
};

const icsEscape = (str) =>
  String(str ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

export const buildBookingIcsEvent = (booking) => {
  const start = toIcsDate(booking.timeSlot);
  const end = booking.endTime
    ? toIcsDate(booking.endTime)
    : toIcsDate(new Date(new Date(booking.timeSlot).getTime() + (Number(booking.duration) || 1) * 3600000));

  const summary = icsEscape(`Clase con ${booking.studentName} — ${booking.subject}`);
  const description = icsEscape(
    [
      `Alumno: ${booking.studentName}`,
      `Materia: ${booking.subject}`,
      `Nivel: ${booking.educationLevel}`,
      booking.academicSituation ? `Notas: ${booking.academicSituation}` : "",
    ]
      .filter(Boolean)
      .join("\\n"),
  );

  return [
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `UID:${booking.bookingCode}@tuprofesorparticular.com.ar`,
    `STATUS:CONFIRMED`,
    "END:VEVENT",
  ].join("\r\n");
};

export const buildIcsContent = (bookings) => {
  const events = (Array.isArray(bookings) ? bookings : [bookings])
    .map(buildBookingIcsEvent)
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tu Profesor Particular//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    events,
    "END:VCALENDAR",
  ].join("\r\n");
};

export const downloadIcs = (bookings, filename = "clases.ics") => {
  const content = buildIcsContent(bookings);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
