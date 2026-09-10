import crypto from "node:crypto";
import AppSettings from "../models/AppSettings.js";
import Booking from "../models/Booking.js";
import BookingSlot from "../models/BookingSlot.js";
import {
  AVAILABILITY_POLICY_KEY,
  AvailabilityPolicyValidationError,
  SCHEDULE_DEFAULTS,
  SCHEDULE_SETTING_KEYS,
  getScheduleConfiguration,
  getScheduleSettingsSnapshot,
  normalizeSchedule,
  validateScheduleSettings,
  writeScheduleSettingsAggregate,
} from "../services/availabilityService.js";
import { SLOT_OWNING_BOOKING_FILTER } from "../utils/bookingFilters.js";
import { DEFAULT_PRICING_MATRIX } from "../services/pricingMatrix.js";
import { PRICING_MATRIX_KEY } from "../services/bookingPricing.js";
import {
  acquireScheduleGridChangeLease,
  releaseScheduleGridChangeLease,
} from "../services/scheduleGridChangeLeaseService.js";
import { SLOT_MUTATION_LOCK_MS } from "../config/bookingMutationLease.js";
import { recordSubjectsSettingsAudit } from "../services/auditService.js";
import {
  SUBJECTS_SETTINGS_KEY,
  SubjectsSettingsValidationError,
  parseSubjectsSettingsPayload,
  subjectSettingsAuditSnapshot,
  toAdminSubjectsDto,
  toPublicSubjectsByLevel,
} from "../services/subjectsSettingsService.js";

const SCHEDULE_KEYS = SCHEDULE_SETTING_KEYS;

/* La ubicación es pública a propósito. Estaba en ADMIN_ONLY_KEYS, así que quien
   elegía "Presencial" reservaba sin ver nunca DÓNDE es la clase dentro de la
   app: se enteraba recién por el email, y el .ics que descargaba no llevaba
   ubicación. No hay divulgación nueva —la dirección ya está publicada en
   tuprofesorparticular.com.ar y en el JSON-LD de LocalBusiness que lee
   Google—; la asimetría era ocultarla justo en el único lugar donde alguien
   necesita saberla para llegar. */
const PUBLIC_LOCATION_KEYS = ["teacher.address", "teacher.mapsUrl"];

const PUBLIC_KEYS = [
  ...SCHEDULE_KEYS,
  "booking.pricePerHour",
  "booking.pricingMatrix",
  "booking.subjectsByLevel",
  ...PUBLIC_LOCATION_KEYS,
];
const PUBLIC_NON_SCHEDULE_KEYS = [
  "booking.pricePerHour",
  "booking.pricingMatrix",
  "booking.subjectsByLevel",
  ...PUBLIC_LOCATION_KEYS,
];

/* Sigue privado: son decisiones operativas y estado de infraestructura.
   requireManualConfirmation delataría si una reserva va a quedar Pendiente
   antes de mandarla; las otras dos son ruido interno. */
const ADMIN_ONLY_KEYS = [
  "booking.requireManualConfirmation",
  "sheets.syncStatus",
  "cron.lastReminderRun",
];
const ALLOWED_KEYS = [...PUBLIC_KEYS, ...ADMIN_ONLY_KEYS];

const DEFAULTS = {
  ...SCHEDULE_DEFAULTS,
  "booking.pricePerHour": 0,
  /* La matriz nivel x materia. El default NO es una matriz vacía: son los valores
     acordados con Agustín, para que estrenar esto no deje al sistema sin precios.
     Viaja en el endpoint público porque el kiosco necesita cotizar el estimado del
     paso 3 sin una llamada extra; el precio que se GUARDA igual se recalcula en el
     servidor al crear la reserva. */
  "booking.pricingMatrix": DEFAULT_PRICING_MATRIX,
  "booking.requireManualConfirmation": false,
  "booking.subjectsByLevel": null,
  "teacher.address": process.env.TEACHER_ADDRESS || "Jujuy 414, Temperley, Buenos Aires",
  "teacher.mapsUrl": process.env.TEACHER_MAPS_URL || "https://maps.google.com/?q=Jujuy+414,Temperley,Buenos+Aires",
};

const withNormalizedScheduleDto = (settings) => {
  const schedule = normalizeSchedule(settings);
  return {
    ...settings,
    [AVAILABILITY_POLICY_KEY]: schedule.availabilityPolicy,
  };
};

const toAdminScheduleDto = ({ revision, schedule }) => ({
  revision,
  openingHour: schedule.openingHour,
  closingHour: schedule.closingHour,
  advanceNoticeMinutes: schedule.minimumNoticeMinutes,
  slotDurationMinutes: schedule.slotDurationMinutes,
  timeZone: schedule.timeZone,
  activeWeekdays: schedule.activeWeekdays,
  /* `null` significa "esta modalidad usa el horario general", y el panel lo muestra
     así en lugar de repetir las horas generales en dos campos editables: dos campos
     con el mismo dato se desincronizan el primer día. */
  modalityWindows: schedule.modalityWindows,
  modalityChangeBufferMinutes: schedule.modalityChangeBufferMinutes,
  availabilityPolicy: schedule.availabilityPolicy,
});

/* `actuales` son los settings ya guardados, y son la red de seguridad de este DTO.
   Este endpoint reemplaza la configuración entera con lo que venga en el body: una
   clave ausente se guarda como ausente. Sin el fallback, un panel que todavía no
   conoce los horarios por modalidad los borraría la primera vez que el profesor
   toque cualquier otra cosa del horario —y el borrado se vería recién semanas
   después, como presenciales entrando a las 7 de la mañana. */
/* Clave ausente = "no la conozco, dejá lo que había". `null` explícito = "borrala".
   Con `??` los dos casos son el mismo, y destildar una modalidad en el panel no se
   podía guardar nunca: volvía sola al recargar. Por eso el chequeo es por presencia de
   la clave y no por su valor. */
const heredaSiFalta = (body, clave, actuales, claveGuardada) =>
  (body && Object.hasOwn(body, clave) ? body[clave] : actuales[claveGuardada]);

const settingsFromAdminScheduleDto = (schedule, actuales = {}) => ({
  "schedule.openingHour": schedule?.openingHour,
  "schedule.closingHour": schedule?.closingHour,
  "schedule.advanceNoticeMinutes": schedule?.advanceNoticeMinutes,
  "schedule.slotDurationMinutes": schedule?.slotDurationMinutes,
  "schedule.timeZone": schedule?.timeZone,
  "schedule.activeWeekdays": schedule?.activeWeekdays,
  "schedule.modalityWindows": heredaSiFalta(
    schedule,
    "modalityWindows",
    actuales,
    "schedule.modalityWindows",
  ),
  "schedule.modalityChangeBufferMinutes": heredaSiFalta(
    schedule,
    "modalityChangeBufferMinutes",
    actuales,
    "schedule.modalityChangeBufferMinutes",
  ),
  [AVAILABILITY_POLICY_KEY]: schedule?.availabilityPolicy,
});

/* Valida la matriz de precios y devuelve el problema como texto, o null si está bien.
 *
 * Devuelve texto y no lanza porque el mensaje va tal cual a la pantalla del profesor:
 * "El precio de Secundaria tiene que ser un número mayor a cero" se puede corregir;
 * "validation failed" no. */
const validarMatrizDePrecios = (valor) => {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return "Los precios tienen que venir como un objeto.";
  }

  const { porNivel, excepciones, descuento } = valor;

  if (porNivel !== undefined) {
    if (!porNivel || typeof porNivel !== "object" || Array.isArray(porNivel)) {
      return "Los precios por nivel tienen que venir como un objeto.";
    }
    for (const [nivel, precio] of Object.entries(porNivel)) {
      /* Vacío es válido y significa "sin precio para este nivel": el panel lo muestra
         como campo en blanco y el kiosco dice "a acordar". Lo que NO se acepta es un
         número que no sirve, porque eso sí es un error de carga. */
      if (precio === "" || precio === null || precio === undefined) continue;
      const numero = Number(precio);
      if (!Number.isFinite(numero) || numero <= 0) {
        return `El precio de ${nivel} tiene que ser un número mayor a cero.`;
      }
    }
  }

  if (excepciones !== undefined) {
    if (!Array.isArray(excepciones)) return "Las excepciones tienen que venir como una lista.";
    for (const [i, e] of excepciones.entries()) {
      const cual = `La excepción ${i + 1}`;
      if (!e || typeof e !== "object") return `${cual} está mal formada.`;
      if (!String(e.nivel ?? "").trim()) return `${cual} necesita un nivel.`;
      const materias = Array.isArray(e.materias) ? e.materias.filter((m) => String(m).trim()) : [];
      if (materias.length === 0) return `${cual} necesita al menos una materia.`;
      const numero = Number(e.precio);
      if (!Number.isFinite(numero) || numero <= 0) {
        return `${cual} necesita un precio mayor a cero.`;
      }
    }
  }

  if (descuento !== undefined && descuento !== null) {
    if (typeof descuento !== "object" || Array.isArray(descuento)) {
      return "El descuento tiene que venir como un objeto.";
    }
    const horas = Number(descuento.desdeHoras);
    const pct = Number(descuento.porcentaje);
    // Ambos vacíos = sin descuento, y eso es una configuración válida.
    const sinDescuento =
      (descuento.desdeHoras === "" || descuento.desdeHoras == null) &&
      (descuento.porcentaje === "" || descuento.porcentaje == null);
    if (!sinDescuento) {
      if (!Number.isFinite(horas) || horas <= 0) {
        return "El descuento necesita a partir de cuántas horas se aplica.";
      }
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
        return "El descuento tiene que ser un porcentaje entre 1 y 99.";
      }
    }
  }

  return null;
};

const parseIfMatchRevision = (value) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(?:W\/)?"?(\d+)"?$/);
  if (!match) return null;
  const revision = Number(match[1]);
  return Number.isSafeInteger(revision) ? revision : null;
};

const slotDurationChangeBlocker = async (currentDuration, nextDuration) => {
  if (currentDuration === nextDuration) return null;
  const [activeBooking, liveSlotClaim] = await Promise.all([
    Booking.exists(SLOT_OWNING_BOOKING_FILTER),
    BookingSlot.exists({}),
  ]);
  return activeBooking || liveSlotClaim;
};

const scheduleBusy = (res, requestId) => res.status(409).json({
  success: false,
  code: "SCHEDULE_CHANGE_BUSY",
  message: "La configuración horaria está siendo actualizada. Reintentá.",
  requestId,
});

const acquireScheduleMutationLease = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const lease = await acquireScheduleGridChangeLease();
    if (lease) return lease;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return null;
};

const invalidSchedule = (res, requestId, error) => res.status(400).json({
  success: false,
  message: error.message,
  requestId,
});

const blockedSlotDuration = (res, requestId) => res.status(409).json({
  success: false,
  code: "SLOT_DURATION_CHANGE_BLOCKED",
  message:
    "No se puede cambiar la duración de la grilla mientras existan reservas activas o bloques en uso.",
  requestId,
});

const subjectsRevisionFilter = (revision) => revision === 0
  ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
  : { revision };

const unlockedSettingsFilter = (now) => ({
  $or: [
    { mutationLock: null },
    { mutationLock: { $exists: false } },
    { mutationLockExpiresAt: { $lte: now } },
  ],
});

const releaseSubjectsMutationLock = (settingsId, lock) => AppSettings.updateOne(
  { _id: settingsId, mutationLock: lock },
  { $unset: { mutationLock: "", mutationLockExpiresAt: "" } },
);

const acquireSubjectsMutation = async ({ expectedRevision, storageValue }) => {
  const now = new Date();
  const lock = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + SLOT_MUTATION_LOCK_MS);
  const locked = await AppSettings.findOneAndUpdate(
    {
      key: SUBJECTS_SETTINGS_KEY,
      $and: [
        subjectsRevisionFilter(expectedRevision),
        unlockedSettingsFilter(now),
      ],
    },
    {
      $set: {
        mutationLock: lock,
        mutationLockExpiresAt: expiresAt,
      },
    },
    { new: true },
  ).select("+mutationLock +mutationLockExpiresAt");

  if (locked) {
    const before = {
      _id: locked._id,
      key: locked.key,
      value: locked.value,
      revision: expectedRevision,
    };
    const updated = await AppSettings.findOneAndUpdate(
      {
        _id: locked._id,
        mutationLock: lock,
        ...subjectsRevisionFilter(expectedRevision),
      },
      {
        $set: {
          value: storageValue,
          revision: expectedRevision + 1,
        },
      },
      { new: true, runValidators: true },
    ).select("+mutationLock +mutationLockExpiresAt");
    if (!updated) {
      await releaseSubjectsMutationLock(locked._id, lock);
      return null;
    }
    return { created: false, lock, expiresAt, before, updated };
  }

  if (expectedRevision !== 0) return null;
  try {
    const created = await AppSettings.create({
      key: SUBJECTS_SETTINGS_KEY,
      value: storageValue,
      revision: 1,
      mutationLock: lock,
      mutationLockExpiresAt: expiresAt,
    });
    return { created: true, lock, expiresAt, before: null, updated: created };
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

const compensateSubjectsMutation = async (mutation) => {
  if (mutation.created) {
    const result = await AppSettings.deleteOne({
      _id: mutation.updated._id,
      revision: 1,
      mutationLock: mutation.lock,
    });
    return result.deletedCount === 1;
  }
  const result = await AppSettings.updateOne(
    {
      _id: mutation.updated._id,
      revision: mutation.before.revision + 1,
      mutationLock: mutation.lock,
    },
    {
      $set: {
        value: mutation.before.value,
        revision: mutation.before.revision,
      },
      $unset: { mutationLock: "", mutationLockExpiresAt: "" },
    },
  );
  return result.modifiedCount === 1;
};

export const getPublicSettings = async (req, res, next) => {
  try {
    const [records, schedule] = await Promise.all([
      AppSettings.find({ key: { $in: PUBLIC_NON_SCHEDULE_KEYS } }).lean(),
      getScheduleConfiguration(),
    ]);
    const settings = {
      ...Object.fromEntries(PUBLIC_NON_SCHEDULE_KEYS.map((key) => [key, DEFAULTS[key]])),
    };
    records.forEach((r) => { settings[r.key] = r.value; });
    settings[SUBJECTS_SETTINGS_KEY] = toPublicSubjectsByLevel(
      settings[SUBJECTS_SETTINGS_KEY],
    );

    res.status(200).json({
      success: true,
      data: {
        ...settings,
        "schedule.timeZone": schedule.timeZone,
        "schedule.slotDurationMinutes": schedule.slotDurationMinutes,
        "schedule.advanceNoticeMinutes": schedule.minimumNoticeMinutes,
        "schedule.maximumAdvanceDays": schedule.maximumAdvanceDays,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const getAllSettings = async (req, res, next) => {
  try {
    const [records, scheduleSnapshot] = await Promise.all([
      AppSettings.find({ key: { $in: ALLOWED_KEYS } }).lean(),
      getScheduleSettingsSnapshot(),
    ]);
    const settings = { ...Object.fromEntries(ALLOWED_KEYS.map((k) => [k, DEFAULTS[k]])) };
    records.forEach((r) => { settings[r.key] = r.value; });
    Object.assign(settings, scheduleSnapshot.settings);
    settings[SUBJECTS_SETTINGS_KEY] = toPublicSubjectsByLevel(
      settings[SUBJECTS_SETTINGS_KEY],
    );

    res.status(200).json({
      success: true,
      data: withNormalizedScheduleDto(settings),
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const getAdminSchedule = async (req, res, next) => {
  try {
    const snapshot = await getScheduleSettingsSnapshot();
    return res.status(200).json({
      success: true,
      data: toAdminScheduleDto(snapshot),
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const updateAdminSchedule = async (req, res, next) => {
  let scheduleLease = null;
  try {
    const expectedRevision = parseIfMatchRevision(req.headers["if-match"]);
    if (expectedRevision === null) {
      return res.status(428).json({
        success: false,
        code: "SCHEDULE_REVISION_REQUIRED",
        message: "Debes enviar la revisión actual en If-Match.",
        requestId: req.requestId,
      });
    }

    scheduleLease = await acquireScheduleMutationLease();
    if (!scheduleLease) return scheduleBusy(res, req.requestId);
    const snapshot = await getScheduleSettingsSnapshot();
    if (snapshot.revision !== expectedRevision) {
      return res.status(409).json({
        success: false,
        code: "SCHEDULE_REVISION_CONFLICT",
        message: "La configuración cambió. Recargá antes de guardar.",
        requestId: req.requestId,
      });
    }

    const candidate = settingsFromAdminScheduleDto(req.body?.schedule, snapshot.settings);
    let normalized;
    try {
      normalized = validateScheduleSettings(candidate);
    } catch (error) {
      if (error instanceof AvailabilityPolicyValidationError) {
        return invalidSchedule(res, req.requestId, error);
      }
      throw error;
    }
    if (await slotDurationChangeBlocker(
      snapshot.schedule.slotDurationMinutes,
      normalized.slotDurationMinutes,
    )) {
      return blockedSlotDuration(res, req.requestId);
    }

    const updated = await writeScheduleSettingsAggregate(candidate, snapshot.revision);
    if (!updated) {
      return res.status(409).json({
        success: false,
        code: "SCHEDULE_REVISION_CONFLICT",
        message: "La configuración cambió. Recargá antes de guardar.",
        requestId: req.requestId,
      });
    }
    return res.status(200).json({
      success: true,
      data: toAdminScheduleDto(updated),
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  } finally {
    if (scheduleLease) {
      await releaseScheduleGridChangeLease(scheduleLease.token).catch((error) => {
        console.error("[schedule-change-lease-release]", error.message);
      });
    }
  }
};

export const getAdminSubjects = async (req, res, next) => {
  try {
    const record = await AppSettings.findOne({ key: SUBJECTS_SETTINGS_KEY })
      .select("value revision")
      .lean();
    return res.status(200).json({
      success: true,
      data: toAdminSubjectsDto(record),
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno.",
      requestId: req.requestId,
    });
  }
};

export const updateAdminSubjects = async (req, res, next) => {
  let mutation = null;
  let preserveLock = false;
  try {
    const expectedRevision = parseIfMatchRevision(req.headers["if-match"]);
    if (expectedRevision === null) {
      return res.status(428).json({
        success: false,
        code: "SUBJECTS_REVISION_REQUIRED",
        message: "Debes enviar la revisión actual en If-Match.",
        requestId: req.requestId,
      });
    }

    let parsed;
    try {
      parsed = parseSubjectsSettingsPayload(req.body);
    } catch (error) {
      if (error instanceof SubjectsSettingsValidationError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          requestId: req.requestId,
        });
      }
      throw error;
    }

    mutation = await acquireSubjectsMutation({
      expectedRevision,
      storageValue: parsed.storageValue,
    });
    if (!mutation) {
      return res.status(409).json({
        success: false,
        code: "SUBJECTS_REVISION_CONFLICT",
        message: "La lista de materias cambió. Recargá antes de guardar.",
        requestId: req.requestId,
      });
    }

    const before = mutation.before
      ? subjectSettingsAuditSnapshot(mutation.before)
      : subjectSettingsAuditSnapshot(null);
    const after = subjectSettingsAuditSnapshot(mutation.updated);
    try {
      await recordSubjectsSettingsAudit({
        req,
        settingsId: mutation.updated._id,
        before,
        after,
        leaseExpiresAt: mutation.expiresAt,
      });
    } catch (auditError) {
      const compensated = await compensateSubjectsMutation(mutation);
      if (!compensated) {
        preserveLock = true;
        console.error("[audit-compensation]", JSON.stringify({
          event: "subjects_settings_audit_compensation_lost_lease",
          settingsId: String(mutation.updated._id),
          requestId: req.requestId,
        }));
      } else {
        mutation = null;
      }
      throw auditError;
    }

    const responseData = toAdminSubjectsDto(mutation.updated);
    await releaseSubjectsMutationLock(mutation.updated._id, mutation.lock);
    mutation = null;
    return res.status(200).json({
      success: true,
      data: responseData,
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({
      success: false,
      message: "Error interno.",
      requestId: req.requestId,
    });
  } finally {
    if (mutation && !preserveLock) {
      await releaseSubjectsMutationLock(mutation.updated._id, mutation.lock)
        .catch((error) => console.error("[subjects-lock-release]", error.message));
    }
  }
};

export const updateSetting = async (req, res, next) => {
  let scheduleGridChangeLease = null;
  try {
    const { key } = req.params;

    // Las de ubicación ya vienen dentro de PUBLIC_KEYS: pública para leer no es
    // pública para escribir, esta ruta sigue detrás de requireAdmin.
    const WRITABLE_KEYS = [
      ...PUBLIC_KEYS.filter((writableKey) => writableKey !== SUBJECTS_SETTINGS_KEY),
      "booking.requireManualConfirmation",
    ];
    if (!WRITABLE_KEYS.includes(key)) {
      return res.status(400).json({
        success: false,
        message: `Clave no permitida: ${key}`,
        requestId: req.requestId,
      });
    }

    const { value } = req.body;
    if (value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        message: "Falta el campo 'value'.",
        requestId: req.requestId,
      });
    }

    /* La matriz se valida al ESCRIBIR aunque `normalizarMatriz` ya la sanea al leer.
       No es redundante: sanear al leer descarta lo que no entiende EN SILENCIO, y en un
       panel eso es lo peor que puede pasar — el profesor escribe un precio, guarda, la
       pantalla dice "listo" y el valor no está. Acá se rechaza con un mensaje que dice
       qué corregir. */
    if (key === PRICING_MATRIX_KEY) {
      const problema = validarMatrizDePrecios(value);
      if (problema) {
        return res.status(400).json({ success: false, message: problema, requestId: req.requestId });
      }
    }

    if (SCHEDULE_KEYS.includes(key)) {
      scheduleGridChangeLease = await acquireScheduleMutationLease();
      if (!scheduleGridChangeLease) return scheduleBusy(res, req.requestId);
      const snapshot = await getScheduleSettingsSnapshot();
      const candidateSettings = { ...snapshot.settings };
      candidateSettings[key] = value;
      let normalized;
      try {
        normalized = validateScheduleSettings(candidateSettings);
      } catch (error) {
        if (error instanceof AvailabilityPolicyValidationError) {
          return invalidSchedule(res, req.requestId, error);
        }
        throw error;
      }
      if (await slotDurationChangeBlocker(
        snapshot.schedule.slotDurationMinutes,
        normalized.slotDurationMinutes,
      )) {
        return blockedSlotDuration(res, req.requestId);
      }
      const updatedSchedule = await writeScheduleSettingsAggregate(
        candidateSettings,
        snapshot.revision,
      );
      if (!updatedSchedule) return scheduleBusy(res, req.requestId);
      return res.status(200).json({
        success: true,
        data: { key, value, revision: updatedSchedule.revision },
        requestId: req.requestId,
      });
    }

    const updated = await AppSettings.findOneAndUpdate(
      { key },
      { $set: { key, value } },
      { upsert: true, new: true },
    );

    res.status(200).json({ success: true, data: updated, requestId: req.requestId });
  } catch (error) {
    if (typeof next === "function") return next(error);
    res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  } finally {
    if (scheduleGridChangeLease) {
      await releaseScheduleGridChangeLease(scheduleGridChangeLease.token).catch((error) => {
        console.error("[schedule-grid-change-lease-release]", error.message);
      });
    }
  }
};

/**
 * Helper used by other controllers to read a single setting with fallback.
 */
export const getSetting = async (key) => {
  const record = await AppSettings.findOne({ key }).lean();
  return record !== null ? record.value : DEFAULTS[key];
};
