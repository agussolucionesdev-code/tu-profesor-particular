import nodemailer from "nodemailer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADULT_RELATIONSHIP_VALUE,
  formatDate,
  formatResponsibleRelationshipLabel,
} from "../utils/bookingRules.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_PATH = path.resolve(__dirname, "../assets/logo-icon.png");
const LOGO_CID = "tpp-logo@tuprofesorparticular";

const BRAND = {
  teacher: "Agustín Elías Sosa",
  role: "Profesor particular",
  name: "Tu Profesor Particular",
  tagline: "Clases claras, resultados que se notan.",
  navy: "#1f3f63",
  navyDeep: "#142e4d",
  navyInk: "#0a1c33",
  navySoft: "#eaf0f8",
  green: "#3f8f57",
  greenDeep: "#2f7344",
  greenSoft: "#e6f3eb",
  amber: "#b56b18",
  amberDeep: "#92560f",
  amberSoft: "#fdf2e2",
  rose: "#a82433",
  roseDeep: "#85182a",
  roseSoft: "#fbecee",
  gold: "#c89b3c",
  page: "#eef3f9",
  surface: "#ffffff",
  surfaceAlt: "#f7fafd",
  border: "#cfdce9",
  borderSoft: "#e2ebf3",
  text: "#0d2238",
  muted: "#4a627d",
  soft: "#7791ac",
  whatsapp: "#22c25b",
};

const TEACHER_ADDRESS =
  process.env.TEACHER_ADDRESS || "Jujuy 414, Temperley, Buenos Aires";
const TEACHER_MAPS_URL =
  process.env.TEACHER_MAPS_URL ||
  "https://maps.google.com/?q=Jujuy+414,Temperley,Buenos+Aires";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const canSendEmail = () =>
  process.env.NODE_ENV !== "test" &&
  Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const getTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: String(process.env.EMAIL_PASS || "").replace(/\s+/g, ""),
    },
  });

const getFrontendUrl = () =>
  String(process.env.FRONTEND_URL || "https://tu-profesor-particular.com").replace(
    /\/$/,
    "",
  );

const getManagementUrl = (code) =>
  `${getFrontendUrl()}/portal?code=${encodeURIComponent(code || "")}`;

const getContactPhone = () =>
  String(process.env.CONTACT_PHONE || "+54 9 11 6423-6675").trim();

const getWhatsappSelfUrl = () => {
  const raw = getContactPhone().replace(/\D/g, "");
  return raw ? `https://wa.me/${raw}` : "";
};

const EVENT_THEMES = {
  created: {
    accent: BRAND.green,
    accentDeep: BRAND.greenDeep,
    accentSoft: BRAND.greenSoft,
    badgeLabel: "Reserva confirmada",
    badgeIcon: "✓",
    clientTitle: "Tu turno quedó reservado",
    ownerTitle: "Nueva reserva confirmada",
    clientIntro:
      "Todo listo. Tu clase quedó reservada y estos son los datos importantes para llegar sin vueltas.",
    ownerIntro:
      "Se confirmó una nueva reserva. Te dejo abajo los datos de la familia y del turno para que los tengas a mano.",
    clientCtaLabel: "Ir a Mis Turnos",
    nextAction:
      "Guardá el código. Te sirve para revisar, reprogramar o cancelar el turno desde Mis Turnos.",
    footerNote:
      "Guardá este correo como respaldo. La gestión principal se hace con el código del turno.",
    showAddress: true,
  },
  rescheduled: {
    accent: BRAND.amber,
    accentDeep: BRAND.amberDeep,
    accentSoft: BRAND.amberSoft,
    badgeLabel: "Turno reprogramado",
    badgeIcon: "↻",
    clientTitle: "Tu turno fue reprogramado",
    ownerTitle: "Turno reprogramado",
    clientIntro:
      "Ya ajusté el turno. Te dejo el nuevo detalle para que lo tengas claro y puedas volver a gestionarlo cuando lo necesites.",
    ownerIntro:
      "Se reprogramó un turno existente. Abajo vas a ver el horario anterior y el nuevo, junto con los datos de la familia.",
    clientCtaLabel: "Ver en Mis Turnos",
    nextAction:
      "Guardá este mensaje. Si algo no coincide, podés entrar a Mis Turnos o escribirme.",
    footerNote:
      "Si el nuevo horario no te funciona, escribime y lo acomodamos sin vueltas.",
    showAddress: true,
  },
  cancelled: {
    accent: BRAND.rose,
    accentDeep: BRAND.roseDeep,
    accentSoft: BRAND.roseSoft,
    badgeLabel: "Turno cancelado",
    badgeIcon: "×",
    clientTitle: "Tu turno fue cancelado",
    ownerTitle: "Turno cancelado",
    clientIntro:
      "El turno quedó cancelado. No hace falta que respondas este correo; si necesitás otro horario, podés reservar nuevamente cuando quieras.",
    ownerIntro:
      "Se canceló un turno. Dejo los datos de referencia por si querés contactar a la familia o liberar el espacio en tu agenda.",
    clientCtaLabel: "Reservar otro turno",
    nextAction:
      "El código queda como referencia de gestión. Para una nueva clase, reservá otro horario desde la web.",
    footerNote:
      "Si la cancelación fue un error, escribime y lo resolvemos al instante.",
    showAddress: false,
  },
  reminder: {
    accent: BRAND.amber,
    accentDeep: BRAND.amberDeep,
    accentSoft: BRAND.amberSoft,
    badgeLabel: "Recordatorio de clase",
    badgeIcon: "⏰",
    clientTitle: "Recordatorio: tu clase es mañana",
    ownerTitle: "Recordatorio de clase — mañana",
    clientIntro:
      "Te recordamos que mañana tenés una clase agendada. Si necesitás reprogramar o cancelar, avisanos con anticipación.",
    ownerIntro:
      "Recordatorio automático generado 24 horas antes de la clase.",
    clientCtaLabel: "Ver mi turno en Mis Turnos",
    nextAction:
      "Si necesitás reprogramar o cancelar, entrá a Mis Turnos con tu código, email o teléfono.",
    footerNote:
      "Este recordatorio se envía automáticamente 24 horas antes de la clase.",
    showAddress: true,
  },
};

const getTheme = (event) => EVENT_THEMES[event] || EVENT_THEMES.created;

const buildRelationshipLabel = (booking) =>
  formatResponsibleRelationshipLabel(
    booking?.responsibleRelationship,
    booking?.responsibleRelationshipOther,
  );

const isAdultBooking = (booking) =>
  booking?.responsibleRelationship === ADULT_RELATIONSHIP_VALUE;

const getGreetingName = ({
  studentName,
  responsibleName,
  responsibleRelationship,
}) =>
  responsibleRelationship === ADULT_RELATIONSHIP_VALUE
    ? studentName
    : responsibleName || studentName;

const buildSafeBooking = (booking = {}, dateStr = "", previousDateStr = "") => {
  const code = booking.bookingCode || booking.code || "";
  const adult = isAdultBooking(booking);
  return {
    code: escapeHtml(code),
    rawCode: code,
    studentName: escapeHtml(booking.studentName || "Alumno/a"),
    responsibleName: escapeHtml(booking.responsibleName || "No especificado"),
    relationshipLabel: escapeHtml(buildRelationshipLabel(booking)),
    isAdult: adult,
    greetingName: escapeHtml(getGreetingName(booking) || "Hola"),
    subject: escapeHtml(booking.subject || "Materia a definir"),
    educationLevel: escapeHtml(booking.educationLevel || "Nivel no cargado"),
    yearGrade: escapeHtml(booking.yearGrade || ""),
    school: escapeHtml(booking.school || "Institución no cargada"),
    phone: escapeHtml(booking.phone || "-"),
    rawPhone: booking.phone || "",
    email: escapeHtml(booking.email || "-"),
    rawEmail: booking.email || "",
    academicSituation: escapeHtml(
      booking.academicSituation || "Sin comentarios adicionales.",
    ),
    dateStr: escapeHtml(dateStr || formatDate(booking.timeSlot)),
    previousDateStr: escapeHtml(previousDateStr || ""),
    duration: escapeHtml(
      booking.duration != null ? `${booking.duration} hs` : "",
    ),
    managementUrl: escapeHtml(getManagementUrl(code)),
    contactPhone: escapeHtml(getContactPhone()),
    whatsappSelfUrl: escapeHtml(getWhatsappSelfUrl()),
  };
};

const RESPONSIVE_STYLES = `
  <style>
    @media only screen and (max-width: 620px) {
      .tpp-shell { width:100% !important; max-width:100% !important; border-radius:0 !important; box-shadow:none !important; border-left:0 !important; border-right:0 !important; }
      .tpp-outer { padding:0 !important; }
      .tpp-pad { padding-left:18px !important; padding-right:18px !important; }
      .tpp-pad-lg { padding-left:18px !important; padding-right:18px !important; padding-top:20px !important; padding-bottom:14px !important; }
      .tpp-header { padding:20px 18px !important; }
      .tpp-header-table td { display:block !important; width:100% !important; text-align:center !important; padding:0 !important; }
      .tpp-header-logo { margin:0 auto 10px !important; }
      .tpp-header-text { padding:0 0 12px !important; text-align:center !important; }
      .tpp-header-badge-cell { padding-top:4px !important; }
      .tpp-badge { display:inline-block !important; }
      .tpp-h1 { font-size:22px !important; line-height:1.25 !important; }
      .tpp-intro { font-size:14px !important; }
      .tpp-row-label { width:100% !important; display:block !important; padding:8px 0 0 !important; font-size:12px !important; }
      .tpp-row-value { width:100% !important; display:block !important; padding:2px 0 8px !important; font-size:14px !important; }
      .tpp-data-card { padding:14px !important; }
      .tpp-code-panel { padding:18px 14px !important; }
      .tpp-code { font-size:24px !important; letter-spacing:.18em !important; }
      .tpp-cta { display:block !important; width:100% !important; box-sizing:border-box !important; padding:14px 12px !important; font-size:15px !important; }
      .tpp-cta-row { padding:6px 18px 14px !important; }
      .tpp-link-fallback { word-break:break-all !important; font-size:11px !important; }
      .tpp-schedule td { display:block !important; width:100% !important; padding:6px 0 !important; text-align:left !important; }
      .tpp-schedule-arrow { font-size:22px !important; padding:6px 0 !important; }
      .tpp-address-card td { display:block !important; width:100% !important; text-align:left !important; padding:0 !important; }
      .tpp-address-cta { display:block !important; margin:12px 0 0 !important; text-align:center !important; }
      .tpp-actions a { display:block !important; width:100% !important; box-sizing:border-box !important; margin:0 0 8px !important; text-align:center !important; }
      .tpp-signature td { display:block !important; width:100% !important; text-align:center !important; padding:0 !important; }
      .tpp-signature-logo { margin:0 auto 10px !important; }
      .tpp-footer { padding:14px 18px !important; font-size:11px !important; }
      .tpp-meta { font-size:10px !important; padding:10px 12px 18px !important; }
    }
    @media only screen and (max-width: 380px) {
      .tpp-h1 { font-size:20px !important; }
      .tpp-code { font-size:22px !important; }
    }
  </style>
`;

const pretitle = (label, color) =>
  `<p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${color};font-weight:800;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</p>`;

const logoImg = (size = 56) =>
  `<img src="cid:${LOGO_CID}" alt="${escapeHtml(BRAND.name)}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border-radius:14px;background:#ffffff;padding:6px;box-sizing:border-box;box-shadow:0 6px 18px rgba(15,35,56,0.18);" />`;

const brandHeader = (theme) => `
  <tr>
    <td class="tpp-header" style="background:linear-gradient(135deg, ${BRAND.navyDeep} 0%, ${BRAND.navy} 55%, ${theme.accentDeep} 100%);padding:28px 28px 22px;">
      <table role="presentation" class="tpp-header-table" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td width="64" valign="middle" style="width:64px;" class="tpp-header-logo">${logoImg(56)}</td>
          <td valign="middle" class="tpp-header-text" style="padding-left:14px;">
            <p style="margin:0;color:#ffffff;font-size:16px;font-weight:800;letter-spacing:.01em;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(BRAND.name)}</p>
            <p style="margin:2px 0 0;color:rgba(237,244,251,0.9);font-size:12px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(BRAND.tagline)}</p>
          </td>
          <td align="right" valign="middle" class="tpp-header-badge-cell" style="white-space:nowrap;">
            <span class="tpp-badge" style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.32);color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(theme.badgeIcon)} ${escapeHtml(theme.badgeLabel)}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

const getTeacherEmail = () =>
  String(process.env.TEACHER_EMAIL || process.env.EMAIL_USER || "agustinsosa.profe@gmail.com").trim();

const signatureBlock = () => {
  const email = getTeacherEmail();
  const phone = getContactPhone();
  const web = getFrontendUrl();
  const webLabel = web.replace(/^https?:\/\//, "");

  return `
  <tr>
    <td class="tpp-pad" style="padding:22px 28px 6px;border-top:1px solid ${BRAND.borderSoft};">
      <p style="margin:0 0 14px;color:${BRAND.muted};font-size:13px;font-family:Arial,Helvetica,sans-serif;font-style:italic;">Un saludo cordial,</p>
      <table role="presentation" class="tpp-signature" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td width="64" valign="top" class="tpp-signature-logo" style="width:64px;">${logoImg(56)}</td>
          <td valign="top" style="padding-left:14px;">
            <p style="margin:0;color:${BRAND.text};font-size:16px;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.01em;">${escapeHtml(BRAND.teacher)}</p>
            <p style="margin:3px 0 0;color:${BRAND.green};font-size:13px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(BRAND.role)} · ${escapeHtml(BRAND.name)}</p>
            <p style="margin:2px 0 0;color:${BRAND.soft};font-size:12px;font-style:italic;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(BRAND.tagline)}</p>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;">
              <tr>
                <td style="padding:3px 0;color:${BRAND.muted};font-size:13px;font-family:Arial,Helvetica,sans-serif;">
                  <span style="display:inline-block;width:62px;color:${BRAND.soft};">WhatsApp</span>
                  <a href="${escapeHtml(getWhatsappSelfUrl())}" style="color:${BRAND.navy};text-decoration:none;font-weight:700;">${escapeHtml(phone)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:3px 0;color:${BRAND.muted};font-size:13px;font-family:Arial,Helvetica,sans-serif;">
                  <span style="display:inline-block;width:62px;color:${BRAND.soft};">Email</span>
                  <a href="mailto:${escapeHtml(email)}" style="color:${BRAND.navy};text-decoration:none;font-weight:700;">${escapeHtml(email)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:3px 0;color:${BRAND.muted};font-size:13px;font-family:Arial,Helvetica,sans-serif;">
                  <span style="display:inline-block;width:62px;color:${BRAND.soft};">Web</span>
                  <a href="${escapeHtml(web)}" style="color:${BRAND.navy};text-decoration:none;font-weight:700;">${escapeHtml(webLabel)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:3px 0;color:${BRAND.muted};font-size:13px;font-family:Arial,Helvetica,sans-serif;">
                  <span style="display:inline-block;width:62px;color:${BRAND.soft};">Estudio</span>
                  <a href="${escapeHtml(TEACHER_MAPS_URL)}" style="color:${BRAND.navy};text-decoration:none;font-weight:700;">${escapeHtml(TEACHER_ADDRESS)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
};

const footerBand = (theme) => `
  <tr>
    <td class="tpp-footer" style="background:${BRAND.navyInk};padding:16px 28px;text-align:center;color:#c7d5e3;font-size:12px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
      ${escapeHtml(theme.footerNote)}
    </td>
  </tr>`;

const infoRow = (label, value) =>
  `<tr>
    <td class="tpp-row-label" style="padding:6px 0;color:${BRAND.muted};font-size:13px;width:130px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</td>
    <td class="tpp-row-value" style="padding:6px 0;color:${BRAND.text};font-size:14px;font-weight:700;vertical-align:top;font-family:Arial,Helvetica,sans-serif;">${value}</td>
  </tr>`;

const buildResponsibleValue = (safe) => {
  if (safe.isAdult) {
    return `<span style="color:${BRAND.text};">Mayor de edad</span>`;
  }
  return `${safe.responsibleName} <span style="color:${BRAND.muted};font-weight:400;">(${safe.relationshipLabel})</span>`;
};

const buildScheduleChangeBlock = (safe, theme) => {
  if (!safe.previousDateStr) return "";
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border:1px solid ${theme.accentSoft};border-radius:14px;overflow:hidden;">
      <tr>
        <td style="background:${theme.accentSoft};padding:12px 16px;color:${theme.accentDeep};font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">
          Cambio de horario
        </td>
      </tr>
      <tr>
        <td style="padding:14px 16px;background:#ffffff;">
          <table role="presentation" class="tpp-schedule" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align:top;padding-right:10px;">
                <p style="margin:0;color:${BRAND.soft};font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;font-family:Arial,Helvetica,sans-serif;">Antes</p>
                <p style="margin:4px 0 0;color:${BRAND.muted};font-size:14px;text-decoration:line-through;font-family:Arial,Helvetica,sans-serif;">${safe.previousDateStr}</p>
              </td>
              <td width="28" align="center" class="tpp-schedule-arrow" style="vertical-align:middle;color:${theme.accentDeep};font-size:18px;font-weight:900;">→</td>
              <td style="vertical-align:top;padding-left:10px;">
                <p style="margin:0;color:${theme.accentDeep};font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;font-family:Arial,Helvetica,sans-serif;">Ahora</p>
                <p style="margin:4px 0 0;color:${BRAND.text};font-size:15px;font-weight:800;font-family:Arial,Helvetica,sans-serif;">${safe.dateStr}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
};

const addressBlock = () => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 4px;border:1px solid ${BRAND.borderSoft};border-radius:14px;overflow:hidden;background:linear-gradient(135deg, ${BRAND.navySoft} 0%, #ffffff 100%);">
    <tr>
      <td style="padding:16px 18px;">
        <table role="presentation" class="tpp-address-card" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td width="48" valign="top" style="width:48px;">
              <div style="width:42px;height:42px;border-radius:12px;background:${BRAND.navy};color:#ffffff;font-size:22px;line-height:42px;text-align:center;font-family:Arial,Helvetica,sans-serif;">📍</div>
            </td>
            <td valign="top" style="padding-left:12px;">
              <p style="margin:0;color:${BRAND.navyDeep};font-size:11px;text-transform:uppercase;letter-spacing:.14em;font-weight:800;font-family:Arial,Helvetica,sans-serif;">Lugar de la clase</p>
              <p style="margin:4px 0 0;color:${BRAND.text};font-size:15px;font-weight:800;line-height:1.45;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(TEACHER_ADDRESS)}</p>
              <p style="margin:4px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">Tocá el botón para abrir Google Maps con la ubicación exacta.</p>
            </td>
            <td valign="middle" align="right" style="white-space:nowrap;">
              <a href="${escapeHtml(TEACHER_MAPS_URL)}" class="tpp-address-cta" style="display:inline-block;background:${BRAND.navy};color:#ffffff;text-decoration:none;border-radius:10px;padding:10px 14px;font-weight:800;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Cómo llegar</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

const documentHead = (title) => `
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${escapeHtml(title)}</title>
    ${RESPONSIVE_STYLES}
  </head>`;

export const buildBookingEmailHtml = ({
  booking,
  event = "created",
  dateStr,
  previousDateStr,
} = {}) => {
  const theme = getTheme(event);
  const safe = buildSafeBooking(booking, dateStr, previousDateStr);
  const cancelled = event === "cancelled";
  const ctaHref = cancelled
    ? escapeHtml(`${getFrontendUrl()}/`)
    : safe.managementUrl;
  const ctaBg = cancelled
    ? `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.green} 100%)`
    : `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accentDeep} 100%)`;

  const nivelValue = `${safe.educationLevel}${safe.yearGrade ? ` · ${safe.yearGrade}` : ""}`;

  return `<!doctype html>
<html lang="es-AR">
  ${documentHead(theme.clientTitle)}
  <body style="margin:0;padding:0;background:${BRAND.page};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(theme.clientTitle)} — ${safe.dateStr}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="tpp-outer" style="background:${BRAND.page};padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="tpp-shell" style="max-width:640px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;box-shadow:0 18px 44px rgba(15,35,56,0.08);">
            ${brandHeader(theme)}
            <tr>
              <td class="tpp-pad-lg" style="padding:26px 28px 8px;">
                ${pretitle(theme.badgeLabel, theme.accentDeep)}
                <h1 class="tpp-h1" style="margin:0;color:${BRAND.navyDeep};font-size:26px;line-height:1.2;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(theme.clientTitle)}</h1>
                <p class="tpp-intro" style="margin:12px 0 0;color:${BRAND.muted};font-size:15px;line-height:1.65;font-family:Arial,Helvetica,sans-serif;">Hola <strong style="color:${BRAND.text};">${safe.greetingName}</strong>. ${escapeHtml(theme.clientIntro)}</p>
              </td>
            </tr>
            <tr>
              <td class="tpp-pad" style="padding:18px 28px 0;">
                ${buildScheduleChangeBlock(safe, theme)}
                <div class="tpp-data-card" style="border:1px solid ${BRAND.borderSoft};border-left:5px solid ${theme.accent};border-radius:14px;padding:18px 20px;background:${BRAND.surfaceAlt};">
                  <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:${theme.accentDeep};font-weight:800;font-family:Arial,Helvetica,sans-serif;">Datos del turno</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    ${infoRow("Fecha y horario", `<span style="${cancelled ? "text-decoration:line-through;color:" + BRAND.muted + ";" : ""}">${safe.dateStr}</span>`)}
                    ${safe.duration ? infoRow("Duración", safe.duration) : ""}
                    ${infoRow("Alumno/a", safe.studentName)}
                    ${infoRow("Responsable", buildResponsibleValue(safe))}
                    ${infoRow("Materia", safe.subject)}
                    ${infoRow("Nivel", nivelValue)}
                    ${safe.school && safe.school !== "Institución no cargada" ? infoRow("Institución", safe.school) : ""}
                  </table>
                </div>
              </td>
            </tr>
            ${
              theme.showAddress
                ? `<tr><td class="tpp-pad" style="padding:16px 28px 0;">${addressBlock()}</td></tr>`
                : ""
            }
            <tr>
              <td class="tpp-pad" style="padding:18px 28px 4px;">
                <div class="tpp-code-panel" style="text-align:center;padding:22px 18px;border:1px dashed ${theme.accent};background:${theme.accentSoft};border-radius:14px;">
                  <p style="margin:0 0 6px;color:${theme.accentDeep};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;font-family:Arial,Helvetica,sans-serif;">Código de gestión</p>
                  <p class="tpp-code" style="margin:0;font-family:Consolas,Menlo,'Courier New',monospace;font-size:30px;letter-spacing:.24em;font-weight:800;color:${BRAND.navyDeep};">${safe.code}</p>
                  <p style="margin:10px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.55;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(theme.nextAction)}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td class="tpp-cta-row" style="padding:10px 28px 18px;">
                <p class="tpp-intro" style="margin:16px 0 18px;color:${BRAND.muted};font-size:14px;line-height:1.65;font-family:Arial,Helvetica,sans-serif;">Podés revisar el turno, reprogramarlo o cancelarlo desde <strong style="color:${BRAND.text};">Mis Turnos</strong>. Si necesitás ayuda, escribime y lo vemos con calma.</p>
                <p style="text-align:center;margin:0 0 6px;">
                  <a href="${ctaHref}" class="tpp-cta" style="display:inline-block;background:${ctaBg};color:#ffffff;text-decoration:none;border-radius:12px;padding:14px 26px;font-weight:800;font-size:15px;letter-spacing:.01em;box-shadow:0 10px 22px rgba(20,46,77,0.22);font-family:Arial,Helvetica,sans-serif;">${escapeHtml(theme.clientCtaLabel)}</a>
                </p>
                <p class="tpp-link-fallback" style="margin:16px 0 0;text-align:center;color:${BRAND.soft};font-size:12px;font-family:Arial,Helvetica,sans-serif;">o copiá este enlace: <span style="color:${BRAND.navy};">${safe.managementUrl}</span></p>
              </td>
            </tr>
            ${signatureBlock()}
            ${footerBand(theme)}
          </table>
          <p class="tpp-meta" style="margin:14px 0 0;color:${BRAND.soft};font-size:11px;font-family:Arial,Helvetica,sans-serif;">© ${new Date().getFullYear()} ${escapeHtml(BRAND.name)} · ${escapeHtml(BRAND.teacher)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const buildBookingEmailText = ({
  booking,
  event = "created",
  dateStr,
  previousDateStr,
} = {}) => {
  const theme = getTheme(event);
  const safe = buildSafeBooking(booking, dateStr, previousDateStr);

  const lines = [
    theme.clientTitle,
    "",
    `Hola ${safe.greetingName}. ${theme.clientIntro}`,
    "",
  ];

  if (safe.previousDateStr) {
    lines.push(`Horario anterior: ${safe.previousDateStr}`);
    lines.push(`Nuevo horario: ${safe.dateStr}`);
  } else {
    lines.push(`Fecha y horario: ${safe.dateStr}`);
  }

  const responsibleLine = safe.isAdult
    ? "Responsable: Mayor de edad"
    : `Responsable: ${safe.responsibleName} (${safe.relationshipLabel})`;

  lines.push(
    `Alumno/a: ${safe.studentName}`,
    responsibleLine,
    `Materia: ${safe.subject}`,
    `Código de gestión: ${safe.rawCode}`,
    "",
  );

  if (theme.showAddress) {
    lines.push(`Lugar: ${TEACHER_ADDRESS}`, `Mapa: ${TEACHER_MAPS_URL}`, "");
  }

  lines.push(
    `Mis Turnos: ${getManagementUrl(safe.rawCode)}`,
    "",
    `${BRAND.teacher} — ${BRAND.name}`,
    `WhatsApp: ${getContactPhone()}`,
  );

  return lines.join("\n");
};

const buildOwnerEmailHtml = ({ booking, event, dateStr, previousDateStr }) => {
  const theme = getTheme(event);
  const safe = buildSafeBooking(booking, dateStr, previousDateStr);
  const whatsappDigits = String(booking?.phone || "").replace(/\D/g, "");
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
        `Hola ${String(booking?.responsibleName || booking?.studentName || "").trim()}, te escribo por el turno ${safe.rawCode}.`,
      )}`
    : "";
  const mailToUrl = safe.rawEmail ? `mailto:${safe.rawEmail}` : "";

  const contactLinks = [
    whatsappUrl
      ? `<a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;margin:0 6px 8px 0;padding:11px 16px;background:${BRAND.whatsapp};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;font-size:13px;font-family:Arial,Helvetica,sans-serif;">WhatsApp a la familia</a>`
      : "",
    mailToUrl
      ? `<a href="${escapeHtml(mailToUrl)}" style="display:inline-block;margin:0 6px 8px 0;padding:11px 16px;background:${BRAND.navy};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Responder por mail</a>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html lang="es-AR">
  ${documentHead(theme.ownerTitle)}
  <body style="margin:0;padding:0;background:${BRAND.page};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="tpp-outer" style="background:${BRAND.page};padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="tpp-shell" style="max-width:640px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;box-shadow:0 18px 44px rgba(15,35,56,0.08);">
            ${brandHeader(theme)}
            <tr>
              <td class="tpp-pad-lg" style="padding:26px 28px 6px;">
                ${pretitle("Agenda docente", theme.accentDeep)}
                <h1 class="tpp-h1" style="margin:0;color:${BRAND.navyDeep};font-size:24px;line-height:1.25;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(theme.ownerTitle)}</h1>
                <p class="tpp-intro" style="margin:10px 0 0;color:${BRAND.muted};font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(theme.ownerIntro)}</p>
              </td>
            </tr>
            <tr>
              <td class="tpp-pad" style="padding:16px 28px 0;">
                ${buildScheduleChangeBlock(safe, theme)}
                <div class="tpp-data-card" style="border:1px solid ${BRAND.borderSoft};border-left:5px solid ${theme.accent};border-radius:14px;padding:16px 18px;background:${BRAND.surfaceAlt};">
                  <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:${theme.accentDeep};font-weight:800;font-family:Arial,Helvetica,sans-serif;">Turno</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    ${infoRow("Fecha", safe.dateStr)}
                    ${safe.duration ? infoRow("Duración", safe.duration) : ""}
                    ${infoRow("Materia", safe.subject)}
                    ${infoRow("Nivel", `${safe.educationLevel}${safe.yearGrade ? ` · ${safe.yearGrade}` : ""}`)}
                    ${infoRow("Institución", safe.school)}
                    ${infoRow("Código", `<span style="font-family:Consolas,Menlo,monospace;font-weight:800;letter-spacing:.16em;color:${BRAND.navyDeep};">${safe.code}</span>`)}
                  </table>
                </div>
              </td>
            </tr>
            <tr>
              <td class="tpp-pad" style="padding:14px 28px 0;">
                <div class="tpp-data-card" style="border:1px solid ${BRAND.borderSoft};border-radius:14px;padding:16px 18px;background:#ffffff;">
                  <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:${BRAND.navy};font-weight:800;font-family:Arial,Helvetica,sans-serif;">Familia</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    ${infoRow("Alumno/a", safe.studentName)}
                    ${infoRow("Responsable", buildResponsibleValue(safe))}
                    ${infoRow("Teléfono", safe.phone)}
                    ${infoRow("Email", safe.email)}
                  </table>
                  <p style="margin:14px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:${BRAND.muted};font-weight:800;font-family:Arial,Helvetica,sans-serif;">Contexto académico</p>
                  <p style="margin:0;color:${BRAND.text};font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${safe.academicSituation}</p>
                </div>
              </td>
            </tr>
            ${
              contactLinks
                ? `<tr><td class="tpp-pad tpp-actions" style="padding:18px 28px 0;text-align:left;">${contactLinks}</td></tr>`
                : ""
            }
            ${signatureBlock()}
            ${footerBand(theme)}
          </table>
          <p class="tpp-meta" style="margin:14px 0 0;color:${BRAND.soft};font-size:11px;font-family:Arial,Helvetica,sans-serif;">Notificación interna · ${escapeHtml(BRAND.name)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildMailAttachments = () => [
  {
    filename: "logo-icon.png",
    path: LOGO_PATH,
    cid: LOGO_CID,
  },
];

export const sendBookingEmail = async (
  studentName,
  toEmail,
  dateStr,
  code,
  extraData = {},
) => {
  if (!toEmail || !canSendEmail()) return false;

  const event = extraData.event || "created";
  const booking = {
    ...extraData,
    studentName,
    bookingCode: code,
  };
  const theme = getTheme(event);
  const previousDateStr = extraData.previousDateStr || "";

  try {
    await getTransporter().sendMail({
      from: `"${BRAND.name}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `${theme.clientTitle}: ${booking.subject || "Clase particular"} - ${dateStr}`,
      html: buildBookingEmailHtml({ booking, event, dateStr, previousDateStr }),
      text: buildBookingEmailText({ booking, event, dateStr, previousDateStr }),
      attachments: buildMailAttachments(),
    });

    return true;
  } catch (error) {
    console.error("Email error:", error.message);
    return false;
  }
};

export const sendBookingNotifications = async ({
  booking,
  event = "created",
  previousTimeSlot,
} = {}) => {
  const formattedDate = formatDate(booking.timeSlot);
  const previousDateStr = previousTimeSlot ? formatDate(previousTimeSlot) : "";

  const clientEmailSent = booking.email
    ? await sendBookingEmail(
        booking.studentName,
        booking.email,
        formattedDate,
        booking.bookingCode,
        {
          responsibleName: booking.responsibleName,
          responsibleRelationship: booking.responsibleRelationship,
          responsibleRelationshipOther: booking.responsibleRelationshipOther,
          subject: booking.subject,
          educationLevel: booking.educationLevel,
          yearGrade: booking.yearGrade,
          school: booking.school,
          phone: booking.phone,
          academicSituation: booking.academicSituation,
          duration: booking.duration,
          event,
          previousDateStr,
        },
      )
    : false;

  const ownerEmail = String(process.env.OWNER_NOTIFICATION_EMAIL ?? "").trim();
  if (!ownerEmail || !canSendEmail()) {
    return {
      client: {
        sent: clientEmailSent,
        recipient: booking.email || "",
      },
      owner: {
        sent: false,
        recipient: ownerEmail,
      },
    };
  }

  const theme = getTheme(event);


  try {
    await getTransporter().sendMail({
      from: `"${BRAND.name}" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: `${theme.ownerTitle}: ${booking.studentName} · ${booking.subject || "Clase"} · ${formattedDate}`,
      html: buildOwnerEmailHtml({
        booking,
        event,
        dateStr: formattedDate,
        previousDateStr,
      }),
      text: buildBookingEmailText({
        booking,
        event,
        dateStr: formattedDate,
        previousDateStr,
      }),
      attachments: buildMailAttachments(),
    });

    return {
      client: {
        sent: clientEmailSent,
        recipient: booking.email || "",
      },
      owner: {
        sent: true,
        recipient: ownerEmail,
      },
    };
  } catch (error) {
    console.error("Owner notification error:", error.message);
    return {
      client: {
        sent: clientEmailSent,
        recipient: booking.email || "",
      },
      owner: {
        sent: false,
        recipient: ownerEmail,
      },
    };
  }
};

export const sendReminderNotification = async (booking) => {
  if (!booking?.email || !canSendEmail()) {
    return { sent: false, recipient: booking?.email || "" };
  }

  const dateStr = formatDate(booking.timeSlot);
  const sent = await sendBookingEmail(
    booking.studentName,
    booking.email,
    dateStr,
    booking.bookingCode,
    {
      event: "reminder",
      responsibleName: booking.responsibleName,
      responsibleRelationship: booking.responsibleRelationship,
      responsibleRelationshipOther: booking.responsibleRelationshipOther,
      subject: booking.subject,
      educationLevel: booking.educationLevel,
      yearGrade: booking.yearGrade,
      school: booking.school,
      phone: booking.phone,
      academicSituation: booking.academicSituation,
      duration: booking.duration,
    },
  );

  return { sent, recipient: booking.email };
};
