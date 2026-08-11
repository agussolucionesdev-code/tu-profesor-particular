import nodemailer from "nodemailer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADULT_RELATIONSHIP_VALUE,
  formatDate,
  formatModalityLabel,
  formatResponsibleRelationshipLabel,
} from "../utils/bookingRules.js";
import { getSetting } from "../controllers/settingsController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_PATH = path.resolve(__dirname, "../assets/logo-icon.png");
const LOGO_CID = "tpp-logo@tuprofesorparticular";

/* Paleta de la marca, la de verdad.

   Los mails venían con una paleta propia que no era la del logo: un navy más
   claro (#1f3f63), un verde apagado (#3f8f57) y dos colores que la marca no
   tiene —un bordó y un dorado—. Por eso no parecían del mismo negocio que la
   web: eran otro negocio.

   Estos son los valores muestreados del logo maestro, los mismos que están en
   frontend/src/styles/tokens.css. El verde de marca da 3.91:1 sobre blanco, así
   que para TEXTO se usa greenInk (6.55:1) y el pleno queda para superficies. */
const BRAND = {
  teacher: "Agustín Elías Sosa",
  role: "Profesor particular",
  name: "Tu Profesor Particular",
  tagline: "Clases claras, resultados que se notan.",

  navy: "#00214c",       // 15.89:1 sobre blanco
  navyDeep: "#001636",
  navyInk: "#000b2b",
  navySoft: "#f2f7fe",

  green: "#01953c",      // superficies y sellos, NO texto chico
  greenInk: "#006d1f",   //  6.55:1 — el verde cuando es texto
  greenDeep: "#004b04",
  greenSoft: "#eafdec",

  amber: "#b45309",
  amberDeep: "#92400e",
  amberSoft: "#fef6e7",

  rose: "#b91c1c",       //  6.47:1 — cancelación
  roseDeep: "#991b1b",
  roseSoft: "#fdeceb",

  page: "#f6f7f8",
  surface: "#ffffff",
  surfaceAlt: "#f9fbfd",
  border: "#d4dde8",
  borderSoft: "#e6ecf3",
  text: "#00214c",
  muted: "#53595f",      //  7.09:1
  soft: "#5a7498",       //  4.79:1 — el mínimo que se usa para texto
  whatsapp: "#16803f",   //  5.01:1 con blanco
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
  (process.env.NODE_ENV !== "test" || Boolean(transporterForTests)) &&
  Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

let transporter = null;
let transporterForTests = null;

const getTransporter = () => {
  if (transporterForTests) return transporterForTests;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: String(process.env.EMAIL_PASS || "").replace(/\s+/g, ""),
    },
  });
  return transporter;
};

const EMAIL_VERIFY_TIMEOUT_MS = 10_000;
const EMAIL_VERIFY_TTL_MS = 10 * 60 * 1000;
let verificationPromise = null;
let verificationState = {
  verified: false,
  status: "unknown",
  checkedAt: null,
  expiresAt: null,
};

const getEmailConfiguration = () => {
  const userConfigured = Boolean(String(process.env.EMAIL_USER || "").trim());
  const passwordConfigured = Boolean(String(process.env.EMAIL_PASS || "").replace(/\s+/g, ""));
  let transporterConfigured = false;
  if (userConfigured && passwordConfigured) {
    try {
      const candidate = getTransporter();
      transporterConfigured = typeof candidate?.sendMail === "function" &&
        typeof candidate?.verify === "function";
    } catch {
      transporterConfigured = false;
    }
  }
  return { userConfigured, passwordConfigured, transporterConfigured };
};

const resetVerificationState = () => {
  verificationPromise = null;
  verificationState = {
    verified: false,
    status: "unknown",
    checkedAt: null,
    expiresAt: null,
  };
};

export const setEmailTransporterForTests = (next) => {
  if (next != null && (typeof next?.sendMail !== "function" || typeof next?.verify !== "function")) {
    throw new TypeError("Email transporter must expose sendMail and verify.");
  }
  transporterForTests = next;
  transporter = null;
  resetVerificationState();
};

export const resetEmailDeliveryHealthForTests = resetVerificationState;

export const refreshEmailDeliveryHealth = async ({
  force = false,
  timeoutMs = EMAIL_VERIFY_TIMEOUT_MS,
  ttlMs = EMAIL_VERIFY_TTL_MS,
} = {}) => {
  const config = getEmailConfiguration();
  if (!config.userConfigured || !config.passwordConfigured || !config.transporterConfigured) {
    resetVerificationState();
    verificationState.status = "unconfigured";
    return getEmailDeliveryHealth();
  }
  const currentTime = Date.now();
  if (!force && verificationState.verified && verificationState.expiresAt?.getTime() > currentTime) {
    return getEmailDeliveryHealth();
  }
  if (verificationPromise) return verificationPromise;
  verificationPromise = (async () => {
    const checkedAt = new Date();
    let timeoutId;
    try {
      await Promise.race([
        Promise.resolve(getTransporter().verify()),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            const error = new Error("SMTP verification timed out.");
            error.code = "EMAIL_VERIFY_TIMEOUT";
            reject(error);
          }, Math.max(1, Number(timeoutMs) || EMAIL_VERIFY_TIMEOUT_MS));
          timeoutId.unref?.();
        }),
      ]);
      verificationState = {
        verified: true,
        status: "healthy",
        checkedAt,
        expiresAt: new Date(checkedAt.getTime() + Math.max(1, Number(ttlMs) || EMAIL_VERIFY_TTL_MS)),
      };
    } catch (error) {
      verificationState = {
        verified: false,
        status: error?.code === "EMAIL_VERIFY_TIMEOUT" ? "timeout" : "unhealthy",
        checkedAt,
        expiresAt: new Date(checkedAt.getTime() + Math.max(1, Number(ttlMs) || EMAIL_VERIFY_TTL_MS)),
      };
    } finally {
      clearTimeout(timeoutId);
      verificationPromise = null;
    }
    return getEmailDeliveryHealth();
  })();
  return verificationPromise;
};

export const getEmailDeliveryHealth = () => {
  const { userConfigured, passwordConfigured, transporterConfigured } = getEmailConfiguration();
  if (!userConfigured || !passwordConfigured || !transporterConfigured) {
    return {
      configured: false,
      userConfigured,
      passwordConfigured,
      transporterConfigured,
      verified: false,
      status: "unconfigured",
      checkedAt: null,
      expiresAt: null,
    };
  }
  const stale = Boolean(
    verificationState.checkedAt &&
    verificationState.expiresAt &&
    verificationState.expiresAt.getTime() <= Date.now(),
  );
  const verified = verificationState.verified && !stale;
  return {
    configured: verified,
    userConfigured,
    passwordConfigured,
    transporterConfigured,
    verified,
    status: stale ? "stale" : verificationState.status,
    checkedAt: verificationState.checkedAt?.toISOString() || null,
    expiresAt: verificationState.expiresAt?.toISOString() || null,
  };
};

/* El dominio real es tuprofesorparticular.com.ar. El valor que estaba acá
   —"tu-profesor-particular.com", con guiones y sin .ar— no existe: si
   FRONTEND_URL no está seteada en el entorno, cada enlace del mail llevaba a
   la nada. Y en desarrollo el fallback ni siquiera entra en juego, así que el
   error solo aparecía en producción. */
const PUBLIC_SITE_URL = "https://turnos.tuprofesorparticular.com.ar";

const getFrontendUrl = () =>
  String(process.env.FRONTEND_URL || PUBLIC_SITE_URL).replace(/\/$/, "");

/* El teléfono es dato de MARCA, no configuración de infraestructura, y por eso
   deja de leerse de CONTACT_PHONE.

   Qué pasó: el número cambió a 3336-5937 y se actualizó en los 10 archivos del
   repo donde estaba, pero la variable de entorno del servidor quedó con el
   viejo. Y la variable le gana al código, así que los mails —lo único que la
   usaba— siguieron mandando 15-6423-6675 durante semanas sin que nada fallara
   ni avisara. Un dato que se cambia una vez cada varios años no justifica un
   punto de desincronización silenciosa.

   Si algún día cambia de verdad: se cambia acá y en web/src/data/site.js.
   La variable CONTACT_PHONE de Render puede borrarse; ya no la lee nadie. */
const CONTACT_PHONE = "+54 9 11 3336-5937";

const getContactPhone = () => CONTACT_PHONE;

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
      "Entrá a Mis Turnos para revisar la reserva. Si no recibiste un acceso directo, solicitá uno nuevo por email. El código es solo una referencia.",
    footerNote:
      "Guardá este correo como respaldo. La gestión se autoriza únicamente mediante el enlace seguro.",
    showAddress: true,
  },
  pending: {
    accent: BRAND.amber,
    accentDeep: BRAND.amberDeep,
    accentSoft: BRAND.amberSoft,
    badgeLabel: "Solicitud recibida",
    badgeIcon: "•",
    clientTitle: "Recibimos tu solicitud de turno",
    ownerTitle: "Nueva solicitud pendiente",
    clientIntro:
      "Recibimos tu solicitud. El horario todavía está pendiente de confirmación y te avisaremos cuando quede confirmado.",
    ownerIntro:
      "Ingresó una solicitud pendiente. Revisala antes de confirmar el horario.",
    clientCtaLabel: "Ir a Mis Turnos",
    nextAction:
      "Este mensaje no confirma el turno. Podés consultar su estado desde Mis Turnos y solicitar un acceso nuevo por email.",
    footerNote:
      "Esperá la confirmación antes de asistir. El código es solo una referencia.",
    showAddress: false,
  },
  pending_updated: {
    accent: BRAND.amber,
    accentDeep: BRAND.amberDeep,
    accentSoft: BRAND.amberSoft,
    badgeLabel: "Solicitud actualizada",
    badgeIcon: "↻",
    clientTitle: "Actualizamos tu solicitud pendiente",
    ownerTitle: "Solicitud pendiente actualizada",
    clientIntro:
      "Actualizamos los datos solicitados. El turno sigue pendiente de confirmación y te avisaremos cuando quede confirmado.",
    ownerIntro:
      "Se modificó una solicitud pendiente. Revisala antes de confirmar el horario.",
    clientCtaLabel: "Ir a Mis Turnos",
    nextAction:
      "Este mensaje no confirma el turno. Podés consultar su estado desde Mis Turnos.",
    footerNote:
      "Esperá la confirmación antes de asistir. El código es solo una referencia.",
    showAddress: false,
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
      "El código queda solo como referencia. Para una nueva clase, reservá otro horario desde la web.",
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
    clientTitle: "Recordatorio de tu próxima clase",
    ownerTitle: "Recordatorio de próxima clase",
    clientIntro:
      "Te recordamos que tenés una próxima clase agendada. Revisá abajo la fecha y el horario exactos.",
    ownerIntro:
      "Recordatorio automático generado dentro de la ventana previa a la clase.",
    clientCtaLabel: "Ver mi turno en Mis Turnos",
    nextAction:
      "Si necesitás reprogramar o cancelar, entrá a Mis Turnos y solicitá un enlace seguro nuevo por email.",
    footerNote:
      "Este recordatorio se envía automáticamente dentro de la ventana previa a la clase.",
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
    // formatModalityLabel ya cae en la etiqueta del default ante un valor
    // ausente o desconocido: el mail nunca muestra el valor crudo.
    modality: escapeHtml(formatModalityLabel(booking.modality)),
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
    managementUrl: booking.managementUrl
      ? escapeHtml(booking.managementUrl)
      : "",
    portalUrl: escapeHtml(booking.portalUrl || `${getFrontendUrl()}/portal`),
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
    <!-- Navy pleno, sin degradado. El degradado iba de navy al color del
         evento, así que el mail de cancelación abría con una franja que viraba
         a bordó: la primera impresión era una alarma, no la marca. El estado lo
         comunica el sello de la derecha, que para eso está. Además Outlook no
         renderiza gradientes CSS y caía a un fondo plano cualquiera. -->
    <td class="tpp-header" style="background:${BRAND.navy};padding:28px 28px 22px;">
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

const signatureBlock = ({
  address = TEACHER_ADDRESS,
  mapsUrl = TEACHER_MAPS_URL,
} = {}) => {
  const email = getTeacherEmail();
  const phone = getContactPhone();
  /* La firma muestra SIEMPRE el sitio público, no getFrontendUrl(). En
     desarrollo esa variable vale http://localhost:5174, y un mail enviado
     desde una prueba local llegaba a la casilla real con "Web localhost:5174"
     en la firma del profesor. Los enlaces que tienen que funcionar (gestión
     del turno) siguen usando el entorno; esto es identidad de marca. */
  const web = PUBLIC_SITE_URL;
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
            <p style="margin:3px 0 0;color:${BRAND.greenInk};font-size:13px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(BRAND.role)} · ${escapeHtml(BRAND.name)}</p>
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
                  <a href="${escapeHtml(mapsUrl)}" style="color:${BRAND.navy};text-decoration:none;font-weight:700;">${escapeHtml(address)}</a>
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

const addressBlock = ({ address, mapsUrl }) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 4px;border:1px solid ${BRAND.borderSoft};border-radius:14px;overflow:hidden;background:${BRAND.surfaceAlt};">
    <tr>
      <td style="padding:16px 18px;">
        <table role="presentation" class="tpp-address-card" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td width="48" valign="top" style="width:48px;">
              <div style="width:42px;height:42px;border-radius:12px;background:${BRAND.navy};color:#ffffff;font-size:22px;line-height:42px;text-align:center;font-family:Arial,Helvetica,sans-serif;">📍</div>
            </td>
            <td valign="top" style="padding-left:12px;">
              <p style="margin:0;color:${BRAND.navyDeep};font-size:11px;text-transform:uppercase;letter-spacing:.14em;font-weight:800;font-family:Arial,Helvetica,sans-serif;">Lugar de la clase</p>
              <p style="margin:4px 0 0;color:${BRAND.text};font-size:15px;font-weight:800;line-height:1.45;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(address)}</p>
              <p style="margin:4px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">Tocá el botón para abrir Google Maps con la ubicación exacta.</p>
            </td>
            <td valign="middle" align="right" style="white-space:nowrap;">
              <a href="${escapeHtml(mapsUrl)}" class="tpp-address-cta" style="display:inline-block;background:${BRAND.navy};color:#ffffff;text-decoration:none;border-radius:10px;padding:10px 14px;font-weight:800;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Cómo llegar</a>
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
  teacherAddress,
  teacherMapsUrl,
} = {}) => {
  const address = teacherAddress || TEACHER_ADDRESS;
  const mapsUrl = teacherMapsUrl || TEACHER_MAPS_URL;
  const theme = getTheme(event);
  const safe = buildSafeBooking(booking, dateStr, previousDateStr);
  const cancelled = event === "cancelled";
  const ctaHref = cancelled
    ? escapeHtml(`${getFrontendUrl()}/`)
    : safe.managementUrl || safe.portalUrl;
  /* Color pleno: el botón es lo único que se toca en el mail y tiene que
     verse igual en Gmail que en Outlook, que ignora los gradientes CSS.
     Después de cancelar el CTA invita a reservar de nuevo, así que va en el
     verde de acción, no en el rojo del estado. */
  const ctaBg = cancelled ? BRAND.greenInk : theme.accentDeep;
  const showClientCta = cancelled || Boolean(safe.managementUrl || safe.portalUrl);

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
                    ${infoRow("Modalidad", safe.modality)}
                    ${infoRow("Nivel", nivelValue)}
                    ${safe.school && safe.school !== "Institución no cargada" ? infoRow("Institución", safe.school) : ""}
                  </table>
                </div>
              </td>
            </tr>
            ${
              theme.showAddress
                ? `<tr><td class="tpp-pad" style="padding:16px 28px 0;">${addressBlock({ address, mapsUrl })}</td></tr>`
                : ""
            }
            <tr>
              <td class="tpp-pad" style="padding:18px 28px 4px;">
                <div class="tpp-code-panel" style="text-align:center;padding:22px 18px;border:1px dashed ${theme.accent};background:${theme.accentSoft};border-radius:14px;">
                  <p style="margin:0 0 6px;color:${theme.accentDeep};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;font-family:Arial,Helvetica,sans-serif;">Código de referencia</p>
                  <p class="tpp-code" style="margin:0;font-family:Consolas,Menlo,'Courier New',monospace;font-size:30px;letter-spacing:.24em;font-weight:800;color:${BRAND.navyDeep};">${safe.code}</p>
                  <p style="margin:10px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.55;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(theme.nextAction)}</p>
                </div>
              </td>
            </tr>
            ${
              showClientCta
                ? `<tr>
              <td class="tpp-cta-row" style="padding:10px 28px 18px;">
                <p class="tpp-intro" style="margin:16px 0 18px;color:${BRAND.muted};font-size:14px;line-height:1.65;font-family:Arial,Helvetica,sans-serif;">Podés revisar el turno desde <strong style="color:${BRAND.text};">Mis Turnos</strong>. Si necesitás ayuda, escribime y lo vemos con calma.</p>
                <p style="text-align:center;margin:0 0 6px;">
                  <a href="${ctaHref}" class="tpp-cta" style="display:inline-block;background:${ctaBg};color:#ffffff;text-decoration:none;border-radius:12px;padding:14px 26px;font-weight:800;font-size:15px;letter-spacing:.01em;box-shadow:0 10px 22px rgba(20,46,77,0.22);font-family:Arial,Helvetica,sans-serif;">${escapeHtml(theme.clientCtaLabel)}</a>
                </p>
                ${safe.managementUrl ? `<p class="tpp-link-fallback" style="margin:16px 0 0;text-align:center;color:${BRAND.soft};font-size:12px;font-family:Arial,Helvetica,sans-serif;">o copiá este enlace: <span style="color:${BRAND.navy};">${safe.managementUrl}</span></p>` : ""}
              </td>
            </tr>`
                : ""
            }
            ${signatureBlock({ address, mapsUrl })}
            ${footerBand(theme)}
          </table>
          <!-- muted: esta línea cae fuera de la tarjeta, sobre el gris de la
               página, donde soft no llega a 4.5. -->
          <p class="tpp-meta" style="margin:14px 0 0;color:${BRAND.muted};font-size:11px;font-family:Arial,Helvetica,sans-serif;">© ${new Date().getFullYear()} ${escapeHtml(BRAND.name)} · ${escapeHtml(BRAND.teacher)}</p>
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
  teacherAddress,
  teacherMapsUrl,
} = {}) => {
  const address = teacherAddress || TEACHER_ADDRESS;
  const mapsUrl = teacherMapsUrl || TEACHER_MAPS_URL;
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
    `Modalidad: ${safe.modality}`,
    `Código de referencia: ${safe.rawCode}`,
    "",
  );

  if (theme.showAddress) {
    lines.push(`Lugar: ${address}`, `Mapa: ${mapsUrl}`, "");
  }

  lines.push(`Mis Turnos: ${safe.managementUrl || safe.portalUrl}`, "");

  lines.push(
    `${BRAND.teacher} — ${BRAND.name}`,
    `WhatsApp: ${getContactPhone()}`,
  );

  return lines.join("\n");
};

export const buildManagementLinkEmailHtml = ({ booking, managementUrl }) => `<!doctype html>
<html lang="es-AR">
  ${documentHead("Tu enlace seguro para gestionar el turno")}
  <body style="margin:0;padding:24px;background:${BRAND.page};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
          ${brandHeader(EVENT_THEMES.created)}
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;color:${BRAND.navyDeep};font-size:24px;">Tu enlace seguro</h1>
            <p style="color:${BRAND.muted};line-height:1.6;">Hola ${escapeHtml(booking?.studentName || "")}. Usá este enlace para gestionar el turno <strong>${escapeHtml(booking?.bookingCode || "")}</strong>.</p>
            <p style="margin:24px 0;text-align:center;"><a href="${escapeHtml(managementUrl)}" style="display:inline-block;padding:14px 22px;background:${BRAND.green};color:#fff;text-decoration:none;border-radius:10px;font-weight:800;">Gestionar mi turno</a></p>
            <p style="color:${BRAND.soft};font-size:12px;word-break:break-all;">${escapeHtml(managementUrl)}</p>
            <p style="color:${BRAND.muted};font-size:13px;">No compartas este enlace: permite administrar tu reserva.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

export const buildManagementLinkEmailText = ({ booking, managementUrl }) =>
  [
    "Tu enlace seguro para gestionar el turno",
    "",
    `Turno: ${booking?.bookingCode || ""}`,
    `Enlace: ${managementUrl}`,
    "",
    "No compartas este enlace: permite administrar tu reserva.",
  ].join("\n");

/* Exportada igual que su gemela del cliente. Estaba privada, y por eso era la
   única plantilla sin tests ni forma de previsualizarla: la que le llega al
   profesor se veía recién cuando caía en su casilla. */
export const buildOwnerEmailHtml = ({ booking, event, dateStr, previousDateStr }) => {
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
          <!-- muted y no soft: esta línea va sobre el fondo gris de la página,
               donde soft (4.79:1 contra blanco) cae a 4.46 y no llega. -->
          <p class="tpp-meta" style="margin:14px 0 0;color:${BRAND.muted};font-size:11px;font-family:Arial,Helvetica,sans-serif;">Notificación interna · ${escapeHtml(BRAND.name)}</p>
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
      html: buildBookingEmailHtml({ booking, event, dateStr, previousDateStr, teacherAddress: extraData.teacherAddress, teacherMapsUrl: extraData.teacherMapsUrl }),
      text: buildBookingEmailText({ booking, event, dateStr, previousDateStr, teacherAddress: extraData.teacherAddress, teacherMapsUrl: extraData.teacherMapsUrl }),
      attachments: buildMailAttachments(),
    });

    return true;
  } catch (error) {
    console.error("Email error:", error.message);
    return false;
  }
};

export const sendManagementLinkEmail = async ({ booking, managementUrl }) => {
  if (!booking?.email || !managementUrl || !canSendEmail()) {
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: `"${BRAND.name}" <${process.env.EMAIL_USER}>`,
      to: booking.email,
      subject: "Tu enlace seguro para gestionar el turno",
      html: buildManagementLinkEmailHtml({ booking, managementUrl }),
      text: buildManagementLinkEmailText({ booking, managementUrl }),
      attachments: buildMailAttachments(),
    });
    return true;
  } catch {
    return false;
  }
};

export const sendBookingNotifications = async ({
  booking,
  event = "created",
  previousTimeSlot,
  managementUrl,
} = {}) => {
  const formattedDate = formatDate(booking.timeSlot);
  const previousDateStr = previousTimeSlot ? formatDate(previousTimeSlot) : "";

  const [teacherAddress, teacherMapsUrl] = await Promise.all([
    getSetting("teacher.address"),
    getSetting("teacher.mapsUrl"),
  ]);

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
          managementUrl,
          event,
          previousDateStr,
          teacherAddress,
          teacherMapsUrl,
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

export const prepareNotificationOutboxMessage = async ({
  recipient,
  recipientKind,
  booking,
  type,
  previousTimeSlot,
  managementUrl,
  portalUrl,
  correlationKey,
}) => {
  const eventByType = {
    booking_confirmation: "created",
    booking_received_pending: "pending",
    booking_pending_updated: "pending_updated",
    booking_rescheduled: "rescheduled",
    booking_cancelled: "cancelled",
    booking_reminder: "reminder",
    management_link_requested: "management_link",
  };
  const event = eventByType[type];
  if (!event || !recipient) return { sent: false, messageId: null };
  if (!getEmailDeliveryHealth().configured || !canSendEmail()) {
    const error = new Error("Email delivery is not configured.");
    error.code = "EMAIL_CONFIGURATION_ERROR";
    throw error;
  }
  const transporter = getTransporter();
  if (type === "management_link_requested") {
    if (recipientKind !== "client" || !managementUrl) {
      const error = new Error("Management link notification payload is invalid.");
      error.code = "EMAIL_CONFIGURATION_ERROR";
      throw error;
    }
    const mail = {
      from: `"${BRAND.name}" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: "Tu enlace seguro para gestionar el turno",
      html: buildManagementLinkEmailHtml({ booking, managementUrl }),
      text: buildManagementLinkEmailText({ booking, managementUrl }),
      attachments: buildMailAttachments(),
    };
    return {
      send: async () => {
        const info = await transporter.sendMail(mail);
        return { sent: true, messageId: info?.messageId || null };
      },
    };
  }
  const dateStr = formatDate(booking.timeSlot);
  const previousDateStr = previousTimeSlot ? formatDate(previousTimeSlot) : "";
  // Message-ID provides traceability only. SMTP does not guarantee idempotent
  // delivery; the outbox state machine owns duplicate prevention.
  const messageId = /^[a-f0-9]{64}$/u.test(String(correlationKey || ""))
    ? `<${correlationKey}@outbox.tuprofesorparticular.com.ar>`
    : undefined;

  if (recipientKind === "client") {
    const [teacherAddress, teacherMapsUrl] = await Promise.all([
      getSetting("teacher.address"),
      getSetting("teacher.mapsUrl"),
    ]);
    const theme = getTheme(event);
    const mailBooking = { ...booking, bookingCode: booking.bookingCode, managementUrl, portalUrl };
    const mail = {
      from: `"${BRAND.name}" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `${theme.clientTitle}: ${booking.subject || "Clase particular"} - ${dateStr}`,
      html: buildBookingEmailHtml({
        booking: mailBooking,
        event,
        dateStr,
        previousDateStr,
        managementUrl,
        teacherAddress,
        teacherMapsUrl,
      }),
      text: buildBookingEmailText({
        booking: mailBooking,
        event,
        dateStr,
        previousDateStr,
        managementUrl,
        teacherAddress,
        teacherMapsUrl,
      }),
      attachments: buildMailAttachments(),
      ...(messageId ? { messageId } : {}),
    };
    return {
      send: async () => {
        const info = await transporter.sendMail(mail);
        return { sent: true, messageId: info?.messageId || messageId || null };
      },
    };
  }

  if (recipientKind !== "owner") return { sent: false, messageId: null };
  const theme = getTheme(event);
  const mail = {
      from: `"${BRAND.name}" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `${theme.ownerTitle}: ${booking.studentName} · ${booking.subject || "Clase"} · ${dateStr}`,
      html: buildOwnerEmailHtml({ booking, event, dateStr, previousDateStr }),
      text: buildBookingEmailText({ booking, event, dateStr, previousDateStr }),
      attachments: buildMailAttachments(),
      ...(messageId ? { messageId } : {}),
  };
  return {
    send: async () => {
      try {
        const info = await transporter.sendMail(mail);
        return { sent: true, messageId: info?.messageId || messageId || null };
      } catch (error) {
        error.code ||= "EMAIL_PROVIDER_ERROR";
        throw error;
      }
    },
  };
};

export const sendNotificationOutboxMessage = async (payload) => {
  const prepared = await prepareNotificationOutboxMessage(payload);
  return prepared.send();
};

/* ─────────────────────────────────────────────────────────────────────────────
   Mensaje del formulario de contacto del sitio institucional.

   No es una notificación de turno, así que no pasa por el outbox: el outbox
   existe para garantizar la entrega de comprobantes y recordatorios, con
   reintentos y revisiones atadas a una reserva. Un mensaje de contacto no tiene
   reserva ni revisión, y si falla el envío la persona lo ve al instante en la
   pantalla y puede reintentar o escribir por WhatsApp.

   El destinatario lo decide el SERVIDOR con getTeacherEmail(), nunca el cuerpo
   del pedido. Si lo decidiera quien envía, esto sería un relay de spam abierto:
   cualquiera podría mandar correo a cualquier dirección desde esta casilla.
   ──────────────────────────────────────────────────────────────────────────── */

/* El texto del visitante va en el CUERPO de un email HTML, así que se escapa. Y
   los saltos de línea se convierten en <br> DESPUÉS de escapar: al revés, los
   <br> que agrega la función se escaparían y llegarían literales. */
const contactBodyHtml = (message) =>
  escapeHtml(message).replace(/\r?\n/g, "<br />");

const buildContactEmailHtml = ({ name, email, phone, subjectLabel, message }) => {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const mailTo = `mailto:${encodeURIComponent(email)}`;
  const whatsappDigits = String(phone || "").replace(/\D/g, "");
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
        `Hola ${name}, te escribo por tu consulta desde el sitio.`,
      )}`
    : "";

  /* Responder es la única acción de este mail, así que va arriba y grande. El
     profesor lo abre en el teléfono: tiene que poder contestar de un toque. */
  const acciones = [
    `<a href="${escapeHtml(mailTo)}" style="display:inline-block;margin:0 6px 8px 0;padding:11px 16px;background:${BRAND.navy};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Responder por mail</a>`,
    whatsappUrl
      ? `<a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;margin:0 6px 8px 0;padding:11px 16px;background:${BRAND.whatsapp};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Responder por WhatsApp</a>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const fila = (etiqueta, valor) => `
        <tr>
          <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.navy};opacity:0.75;width:38%;vertical-align:top;">${etiqueta}</td>
          <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.navyInk};font-weight:700;">${valor}</td>
        </tr>`;

  return `<!doctype html>
<html lang="es-AR">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Consulta desde el sitio</title></head>
<body style="margin:0;padding:24px 12px;background:${BRAND.navySoft};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
    <tr>
      <td style="padding:22px 26px;background:${BRAND.navy};">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;opacity:0.8;">Formulario del sitio</p>
        <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#ffffff;">${escapeHtml(subjectLabel)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 26px 6px;">${acciones}</td>
    </tr>
    <tr>
      <td style="padding:0 26px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${fila("Nombre", safeName)}
          ${fila("Email", `<a href="${escapeHtml(mailTo)}" style="color:${BRAND.navy};text-decoration:none;font-weight:700;">${safeEmail}</a>`)}
          ${phone ? fila("Teléfono", escapeHtml(phone)) : ""}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 26px 26px;">
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.navy};opacity:0.75;">Lo que escribió</p>
        <div style="padding:14px 16px;background:${BRAND.navySoft};border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${BRAND.navyInk};">${contactBodyHtml(message)}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const sendContactMessage = async ({ name, email, phone, subjectLabel, message }) => {
  const transport = getTransporter();
  if (!transport) {
    throw new Error("El correo no está configurado en este entorno.");
  }

  return transport.sendMail({
    from: `"${BRAND.name}" <${process.env.EMAIL_USER}>`,
    to: getTeacherEmail(),
    /* replyTo y no from: poner la dirección del visitante en el From haría que
       Gmail lo trate como suplantación y lo mande a spam. Con replyTo, apretar
       "Responder" le contesta a la persona, que es lo que se busca. */
    replyTo: email,
    subject: `${subjectLabel} — ${name}`,
    html: buildContactEmailHtml({ name, email, phone, subjectLabel, message }),
    text: [
      subjectLabel,
      "",
      `Nombre: ${name}`,
      `Email: ${email}`,
      phone ? `Teléfono: ${phone}` : null,
      "",
      message,
    ]
      .filter((linea) => linea !== null)
      .join("\n"),
  });
};
