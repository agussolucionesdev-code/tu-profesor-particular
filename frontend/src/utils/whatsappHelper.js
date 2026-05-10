import {
  formatLongDateLabel as formatDate,
  formatTimeLabel as formatTime,
  toSafeDate as toDate,
} from "./bookingFormatters";

const SESSION_KEY = "admin_whatsapp_sent";

const loadSent = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
  } catch {
    return {};
  }
};

const persistSent = (state) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
};

export const getSentMessages = () => loadSent();

export const sendWhatsApp = (booking) => {
  if (!booking.phone) {
    alert("Este registro no tiene un teléfono válido para WhatsApp.");
    return null;
  }

  let phone = String(booking.phone).replace(/\D/g, "");
  if (phone.length === 10) phone = `549${phone}`;

  const start = toDate(booking.timeSlot);
  const when = start
    ? `${formatDate(start)} a las ${formatTime(start)} h`
    : "fecha pendiente";
  const name = booking.studentName || "Alumno";
  const message = `Hola ${name}, soy Agustín Sosa. Te escribo por tu turno de ${booking.subject} previsto para ${when}.`;

  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    "_blank",
  );

  const updated = { ...loadSent(), [booking._id]: true };
  persistSent(updated);
  return updated;
};
