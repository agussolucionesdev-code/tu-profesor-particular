import { z } from "zod";
import {
  atBusinessTime,
  businessDateKey,
  businessDayRange,
  DEFAULT_TIME_ZONE,
  parseBusinessDateTime,
} from "./timeZone.js";

export const BOOKING_STATUS = [
  "Confirmado",
  "Pendiente",
  "Cancelado",
  "Finalizado",
];

export const ATTENDANCE_STATUS = [
  "Sin registrar",
  "Presente",
  "Ausente",
  "Cancelación tardía",
  "No-show",
  "Recuperatorio",
];

// La modalidad es un dato operativo, no cosmetico: decide si el mail lleva el
// enlace de la clase o la direccion del consultorio. Vive como enum y no como
// texto libre para que el panel pueda filtrar por ella.
export const BOOKING_MODALITY = ["online", "presencial"];

// Las reservas anteriores a este campo no tienen modalidad. El default las deja
// validas en lugar de invalidar el historico entero.
export const DEFAULT_BOOKING_MODALITY = "online";

const MODALITY_LABELS = new Map([
  ["online", "Online"],
  ["presencial", "Presencial"],
]);

export const normalizeModality = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

// Los mails y el panel nunca deben renderizar el valor crudo ni "undefined".
export const formatModalityLabel = (value) =>
  MODALITY_LABELS.get(normalizeModality(value)) ??
  MODALITY_LABELS.get(DEFAULT_BOOKING_MODALITY);

export const ADULT_RELATIONSHIP_VALUE = "self";
export const RESPONSIBLE_RELATIONSHIP_OTHER_VALUE = "otro";
export const RESPONSIBLE_RELATIONSHIP_VALUES = [
  ADULT_RELATIONSHIP_VALUE,
  "madre",
  "padre",
  "hermana",
  "hermano",
  "tia",
  "tio",
  "abuela",
  "abuelo",
  "prima",
  "primo",
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
];

const RESPONSIBLE_RELATIONSHIP_LABELS = new Map([
  [ADULT_RELATIONSHIP_VALUE, "Alumno mayor de edad"],
  ["madre", "Madre"],
  ["padre", "Padre"],
  ["hermana", "Hermana mayor de edad"],
  ["hermano", "Hermano mayor de edad"],
  ["tia", "Tía"],
  ["tio", "Tío"],
  ["abuela", "Abuela"],
  ["abuelo", "Abuelo"],
  ["prima", "Prima mayor de edad"],
  ["primo", "Primo mayor de edad"],
]);

export const TIME_ZONE = DEFAULT_TIME_ZONE;

export const parseDateTimeInput = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/,
  );

  if (match) {
    const [, dd, mm, yyyy, hh, min] = match.map(Number);
    return parseBusinessDateTime(dd, mm, yyyy, hh, min, TIME_ZONE);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (dateObj) =>
  new Date(dateObj).toLocaleString("es-AR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatResponsibleRelationshipLabel = (
  relationship,
  otherValue = "",
) => {
  const normalized = String(relationship ?? "")
    .trim()
    .toLowerCase();

  if (normalized === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE) {
    return String(otherValue ?? "").trim() || "Otro vínculo";
  }

  return RESPONSIBLE_RELATIONSHIP_LABELS.get(normalized) || "Vínculo no especificado";
};

export const normalizeEmail = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "no especificado") return "";
  return normalized;
};

export const normalizePhone = (value) => String(value ?? "").trim();

export const normalizePhoneDigits = (value) =>
  String(value ?? "").replace(/\D/g, "");

export const normalizeCode = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

export const looksLikeEmail = (value) => normalizeEmail(value).includes("@");

export const looksLikePhone = (value) => normalizePhoneDigits(value).length >= 7;

export const phoneDigitsRegex = (value) => {
  const digits = normalizePhoneDigits(value);
  if (digits.length < 7) return null;
  return new RegExp(digits.split("").join("\\D*"));
};

const textField = (min, max) => z.string().trim().min(min).max(max);
const optionalRelationshipDetail = z.string().trim().max(80).optional().default("");

// El wizard manda la modalidad como viene del boton; se normaliza antes de
// validar para no rechazar "Presencial" o " online " por un detalle de forma.
const modalityEnum = z.preprocess(
  (value) => (typeof value === "string" ? normalizeModality(value) : value),
  z.enum(BOOKING_MODALITY),
);
const modalityField = modalityEnum.optional().default(DEFAULT_BOOKING_MODALITY);

export const createBookingSchema = z
  .object({
    responsibleName: textField(3, 80),
    responsibleRelationship: z.enum(RESPONSIBLE_RELATIONSHIP_VALUES),
    responsibleRelationshipOther: optionalRelationshipDetail,
    studentName: textField(3, 80),
    tutorName: z.string().trim().max(80).optional().default("Agustin"),
    email: z.string().optional().default(""),
    phone: z.string().optional().default(""),
    school: z.string().trim().max(120).optional().default(""),
    educationLevel: textField(3, 60),
    yearGrade: textField(2, 60),
    subject: textField(2, 120),
    modality: modalityField,
    academicSituation: z.string().trim().max(1200).optional().default(""),
    timeSlot: z.union([z.string(), z.date()]),
    duration: z.coerce.number(),

    /* Serie semanal. El cliente los manda: el wizard genera un seriesId y hace una
       llamada por semana, cada una con su clave de idempotencia. Que lo genere el
       cliente es aceptable porque el seriesId AGRUPA y no autoriza —cada clase
       sigue protegida por su token— así que lo peor que alguien puede hacer con
       uno inventado es agrupar sus propias reservas de forma rara.
       Igual se valida el formato: es un UUID y termina en la base, así que no
       tiene sentido aceptar texto arbitrario. */
    seriesId: z.string().uuid().optional().default(null).nullable(),
    seriesIndex: z.coerce.number().int().min(1).max(60).optional().default(null).nullable(),
    seriesTotal: z.coerce.number().int().min(1).max(60).optional().default(null).nullable(),
  })
  .superRefine((data, ctx) => {
    /* Los tres campos de serie van juntos o no van. Una reserva con seriesId pero
       sin posición no se puede mostrar como "clase 3 de 8", y una con posición sin
       seriesId no se puede agrupar con nada. */
    const deSerie = [data.seriesId, data.seriesIndex, data.seriesTotal];
    const puestos = deSerie.filter((v) => v !== null && v !== undefined).length;
    if (puestos > 0 && puestos < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Una clase de una serie necesita seriesId, seriesIndex y seriesTotal.",
        path: ["seriesId"],
      });
    }
    if (data.seriesIndex && data.seriesTotal && data.seriesIndex > data.seriesTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La posición no puede ser mayor que el total de la serie.",
        path: ["seriesIndex"],
      });
    }
  })
  .superRefine((data, ctx) => {
    if (
      data.responsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE &&
      data.responsibleRelationshipOther.trim().length < 3
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar cuál es el vínculo cuando eliges Otro.",
        path: ["responsibleRelationshipOther"],
      });
    }
  });

// Manual creation deliberately accepts the complete immutable booking
// snapshot, not a Student id. Identity reconciliation remains asynchronous so
// an admin request cannot accidentally merge two people by contact data.
export const adminCreateBookingSchema = z
  .object({
    responsibleName: textField(3, 80),
    responsibleRelationship: z.enum(RESPONSIBLE_RELATIONSHIP_VALUES),
    responsibleRelationshipOther: optionalRelationshipDetail,
    studentName: textField(3, 80),
    email: z.string().optional().default(""),
    phone: z.string().optional().default(""),
    school: textField(1, 120),
    educationLevel: textField(3, 60),
    yearGrade: textField(2, 60),
    subject: textField(2, 120),
    modality: modalityField,
    academicSituation: textField(1, 1200),
    timeSlot: z.union([z.string(), z.date()]),
    duration: z.coerce.number(),
    status: z.enum(["Pendiente", "Confirmado"]).optional().default("Confirmado"),
    price: z.coerce.number().min(0).max(99999999).optional().default(0),
    notes: z.string().trim().max(2000).optional().default(""),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.responsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE &&
      data.responsibleRelationshipOther.trim().length < 3
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar cuál es el vínculo cuando eliges Otro.",
        path: ["responsibleRelationshipOther"],
      });
    }
  });

export const rescheduleSchema = z.object({
  bookingCode: textField(6, 12),
  newTimeSlot: z.union([z.string(), z.date()]),
  newDuration: z.coerce.number(),
});

export const cancelSchema = z.object({
  bookingCode: textField(6, 12),
});

export const updateBookingSchema = z
  .object({
    status: z.enum(BOOKING_STATUS).optional(),
    price: z.coerce.number().min(0).max(99999999).optional(),
    notes: z.string().trim().max(2000).optional(),
    studentEvolution: z.string().trim().max(5000).optional(),
    emotionalState: z.string().trim().max(1000).optional(),
    subject: textField(2, 120).optional(),
    // Patch: sin default. Omitir la modalidad debe dejarla como está, no
    // resetearla silenciosamente a online.
    modality: modalityEnum.optional(),
    academicSituation: textField(1, 1200).optional(),
    school: textField(1, 120).optional(),
    educationLevel: textField(3, 60).optional(),
    yearGrade: textField(2, 60).optional(),
    timeSlot: z.union([z.string(), z.date()]).optional(),
    duration: z.coerce.number().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const updateAttendanceSchema = z
  .object({
    attendanceStatus: z.enum(ATTENDANCE_STATUS),
    attendanceNotes: z.string().trim().max(1000).optional().default(""),
  })
  .strict();

export const availabilityQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  duration: z.coerce.number().min(0.5).max(10).optional(),
});

export const adminAvailabilityQuerySchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    duration: z.coerce.number().min(0.5).max(10),
    excludeBookingId: z.string().trim().min(1).optional(),
  })
  .strict();

export const validateContact = ({ email, phone }) => {
  if (!email && !phone) {
    return "Debes ingresar al menos un método de contacto: email o teléfono.";
  }

  if (email) {
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) return "El email ingresado no es válido.";
  }

  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      return "El teléfono debe tener entre 8 y 15 dígitos.";
    }
  }

  return null;
};

export const validateSlot = (
  startTime,
  duration,
  openingHour = 7,
  closingHour = 22,
  advanceNoticeMinutes = 60,
  slotMinutes = 30,
  timeZone = TIME_ZONE,
) => {
  if (!startTime || Number.isNaN(startTime.getTime())) {
    return "La fecha y hora del turno no es válida.";
  }

  if (!Number.isFinite(duration) || duration < 0.5 || duration > 10) {
    return "La duración debe estar entre 0.5 y 10 horas.";
  }

  if ((duration * 60) % slotMinutes !== 0) {
    return `La duración debe respetar intervalos de ${slotMinutes} minutos.`;
  }

  const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
  const dateKey = businessDateKey(startTime, timeZone);
  const opening = atBusinessTime(dateKey, openingHour, 0, timeZone);
  const closing = atBusinessTime(dateKey, closingHour, 0, timeZone);
  const slotMs = slotMinutes * 60 * 1000;

  if ((startTime.getTime() - opening.getTime()) % slotMs !== 0) {
    return `Los turnos deben comenzar en intervalos de ${slotMinutes} minutos.`;
  }

  if (startTime < opening || endTime > closing) {
    return `El turno debe estar dentro del horario de ${String(openingHour).padStart(2, "0")}:00 a ${String(closingHour).padStart(2, "0")}:00.`;
  }

  const minStart = new Date(Date.now() + advanceNoticeMinutes * 60 * 1000);
  if (startTime < minStart) {
    return `Los turnos deben reservarse con al menos ${advanceNoticeMinutes} minutos de anticipación.`;
  }

  return null;
};

export const getDefaultAvailabilityRange = () => {
  return businessDayRange(new Date(), 90, TIME_ZONE);
};
