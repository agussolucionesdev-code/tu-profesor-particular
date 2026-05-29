import {
  formatLongDateLabel as formatDate,
  formatTimeLabel as formatTime,
  toSafeDate as toDate,
} from "./bookingFormatters";

const STORAGE_KEY = "admin_whatsapp_sent";
const TTL_MS = 24 * 60 * 60 * 1000;

const loadSent = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const entries = JSON.parse(raw);
    const now = Date.now();
    const fresh = {};
    for (const [id, ts] of Object.entries(entries)) {
      if (now - ts < TTL_MS) fresh[id] = ts;
    }
    if (Object.keys(fresh).length !== Object.keys(entries).length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    }
    return fresh;
  } catch {
    return {};
  }
};

const persistSent = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
};

export const getSentMessages = () => {
  const raw = loadSent();
  const result = {};
  for (const id of Object.keys(raw)) result[id] = true;
  return result;
};

export const getSentTimestamp = (id) => loadSent()[id] ?? null;

export const sendWhatsApp = (booking) => {
  if (!booking.phone) {
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

  const prev = loadSent();
  const updated = { ...prev, [booking._id]: Date.now() };
  persistSent(updated);

  const result = {};
  for (const id of Object.keys(updated)) result[id] = true;
  return result;
};
