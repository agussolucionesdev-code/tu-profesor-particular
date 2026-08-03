const pad = (n) => String(n).padStart(2, "0");

/* UTC con sufijo Z, no hora flotante.
   Antes se escribía con los getters LOCALES de quien apretaba el botón y sin
   sufijo. Sin sufijo, iCalendar interpreta la hora como "flotante": significa
   las 14:00 en la zona del dispositivo, cualquiera sea. Combinado con los
   getters locales, el mismo turno generaba archivos distintos según desde dónde
   se descargara, y si el alumno viajaba, el evento se movía con él.
   En UTC el instante es uno solo y cada calendario lo muestra en su zona. */
const toIcsDate = (date) => {
  const d = new Date(date);
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    "T",
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    "00Z",
  ].join("");
};

/* Escapa UN valor de texto según RFC 5545.
   Ojo con el orden: la barra se duplica primero, porque si no, las barras que
   agregan los escapes siguientes se volverían a escapar. Y por eso mismo esta
   función se aplica a cada campo POR SEPARADO y recién después se unen: si se
   escapa el texto ya unido, el separador de líneas —que es una barra y una n—
   se convierte en barra doble más n, e iCalendar lo lee como una barra literal
   en lugar de un salto de línea. Era el bug: la descripción llegaba al
   calendario en un solo renglón con los separadores a la vista. */
const icsEscape = (str) =>
  String(str ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

// El separador de líneas dentro de un valor de texto iCalendar: barra + n.
const ICS_LINE_BREAK = "\\n";

const TEACHER_NAME = "Prof. Agustín";

/* El mismo turno se ve distinto según quién abra el calendario.
   El profesor necesita saber CON QUIÉN es la clase —su agenda son diez alumnos
   distintos—; el alumno necesita saber DE QUÉ es y con quién. Antes había un
   solo título, escrito desde la vereda del profesor, y el alumno que apretaba
   "Agregar al calendario" veía su propio nombre como si la clase fuera con
   otra persona. */
const summaryFor = (booking, audience) =>
  audience === "student"
    ? `${booking.subject} con ${TEACHER_NAME}`
    : `Clase con ${booking.studentName} — ${booking.subject}`;

const MODALITY_LABEL = { presencial: "Presencial", online: "Online" };

/**
 * Un VEVENT del turno.
 *
 * @param booking            datos del turno
 * @param options.audience   "teacher" (default, la agenda del panel) | "student"
 */
export const buildBookingIcsEvent = (booking, { audience = "teacher" } = {}) => {
  const start = toIcsDate(booking.timeSlot);
  const end = booking.endTime
    ? toIcsDate(booking.endTime)
    : toIcsDate(new Date(new Date(booking.timeSlot).getTime() + (Number(booking.duration) || 1) * 3600000));

  const esPresencial = booking.modality === "presencial";
  const modalityLabel = MODALITY_LABEL[booking.modality] ?? null;

  /* La dirección se escribe SOLO si la clase es presencial. En una online
     sería confuso: no hay que ir a ningún lado. Y si es presencial pero nadie
     pasó la dirección, mejor omitir el campo que dejar un "undefined" escrito
     para siempre en el calendario del alumno. */
  const location = esPresencial ? booking.location : null;

  // Cada línea se escapa por separado y recién después se unen con el
  // separador, que ya está escapado y no debe volver a pasar por icsEscape.
  const description = [
    audience === "student" ? null : `Alumno: ${booking.studentName}`,
    `Materia: ${booking.subject}`,
    `Nivel: ${booking.educationLevel}`,
    modalityLabel ? `Modalidad: ${modalityLabel}` : null,
    esPresencial && location ? `Dirección: ${location}` : null,
    booking.bookingCode ? `Código de reserva: ${booking.bookingCode}` : null,
    booking.academicSituation ? `Notas: ${booking.academicSituation}` : null,
  ]
    .filter(Boolean)
    .map(icsEscape)
    .join(ICS_LINE_BREAK);

  return [
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(summaryFor(booking, audience))}`,
    `DESCRIPTION:${description}`,
    ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
    `UID:${booking.bookingCode}@tuprofesorparticular.com.ar`,
    `STATUS:CONFIRMED`,
    "END:VEVENT",
  ].join("\r\n");
};

export const buildIcsContent = (bookings, options = {}) => {
  const events = (Array.isArray(bookings) ? bookings : [bookings])
    .map((booking) => buildBookingIcsEvent(booking, options))
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

export const downloadIcs = (bookings, filename = "clases.ics", options = {}) => {
  const content = buildIcsContent(bookings, options);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
