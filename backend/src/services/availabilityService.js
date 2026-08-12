import AppSettings from "../models/AppSettings.js";
import BlockedDate from "../models/BlockedDate.js";
import {
  atBusinessTime,
  businessDateKey,
  normalizeTimeZone,
} from "../utils/timeZone.js";
import {
  AVAILABILITY_POLICY_KEY,
  AvailabilityPolicyValidationError,
  normalizeAvailabilityPolicy,
  resolveDateAvailabilityIntervals,
  timeStringToMinutes,
} from "./availabilityPolicy.js";

export { AVAILABILITY_POLICY_KEY, AvailabilityPolicyValidationError };
export const SCHEDULE_AGGREGATE_KEY = "schedule.aggregate";

/* Horario propio por modalidad, y traslado entre modalidades.
 *
 * Dar clase online a las 7 de la mañana no cuesta nada; abrir el espacio de
 * Temperley a esa hora sí, y un alumno de secundaria volviendo a las 22 tampoco es
 * razonable. Por eso cada modalidad puede recortar su propia ventana.
 *
 * LO QUE NO CAMBIA, Y ES LO MÁS IMPORTANTE DE ESTE ARCHIVO: la ventana es por
 * modalidad, la OCUPACIÓN es una sola. Un turno presencial de 18 a 20 deja las 18
 * ocupadas también para online, porque el profesor es uno y no puede estar en dos
 * lados. Si alguien alguna vez separa esto en dos bolsas de disponibilidad, dos
 * personas van a poder reservar las 18:00 —una online, una presencial— y va a haber
 * dos clases al mismo tiempo. `overlaps` compara rangos y NO mira modalidad: eso es
 * deliberado. Está fijado en tests/modalityAvailability.test.js.
 *
 * El buffer, en cambio, sí depende de la modalidad: entre dos clases online seguidas
 * no hace falta moverse, pero entre una online y una presencial hay que viajar. Un
 * buffer global no puede distinguir esos dos casos, así que regalaría agenda en el
 * primero o vendería un imposible en el segundo. */
export const MODALITY_SCHEDULE_DEFAULTS = Object.freeze({
  /* Online no lleva ventana propia: su horario ES el general (07:00–22:00), y
     escribirlo acá sería repetir el mismo dato en dos lugares para que se
     desincronicen la primera vez que se cambie uno.
     Presencial recorta a 09:00–21:00: abrir el espacio a las 7 le cuesta al profesor,
     y a las 21 ya nadie tiene que estar volviendo a su casa desde Temperley. */
  "schedule.modalityWindows": Object.freeze({
    presencial: Object.freeze({ openingHour: 9, closingHour: 21 }),
  }),
  /* 45 minutos de traslado entre una clase online y una presencial. Se aplica SOLO
     cuando la modalidad cambia: entre dos online seguidas es cero. */
  "schedule.modalityChangeBufferMinutes": 45,
});

export const SCHEDULE_DEFAULTS = Object.freeze({
  "schedule.openingHour": 7,
  "schedule.closingHour": 22,
  "schedule.advanceNoticeMinutes": 60,
  "schedule.slotDurationMinutes": 30,
  "schedule.timeZone": "America/Argentina/Buenos_Aires",
  // Sunday is intentionally excluded from the public booking calendar.
  "schedule.activeWeekdays": [1, 2, 3, 4, 5, 6],
  ...MODALITY_SCHEDULE_DEFAULTS,
  [AVAILABILITY_POLICY_KEY]: null,
});

export const MODALITIES = Object.freeze(["online", "presencial"]);

/* Una hora usable del reloj, o null. El panel lo edita una persona: puede quedar
   texto, un negativo o un 30. Ante un valor que no se entiende se cae a la ventana
   general en lugar de inventar un horario. */
const horaDelReloj = (valor) =>
  Number.isInteger(valor) && valor >= 0 && valor <= 24 ? valor : null;

/* La ventana configurada para una modalidad, o null si no hay ninguna usable.
 *
 * Devuelve SOLO lo cargado para esa modalidad, sin mezclarlo con
 * `openingHour`/`closingHour`. Esas dos son el fallback legacy que se usa para
 * sintetizar una política cuando no hay ninguna cargada; NO son un techo sobre la
 * política. Tratarlas como techo rompía los horarios que cruzan la medianoche —una
 * política con intervalo 23:00–24:00 quedaba vacía al intersectarla contra 07:00–22:00
 * y toda reserva nocturna respondía 400.
 *
 * El techo real es la política semanal, y el recorte se aplica contra sus intervalos:
 * así la ventana de la modalidad solo puede achicar lo que ya está habilitado, nunca
 * abrir un horario nuevo. Cada lado es independiente: se puede configurar solo la
 * apertura, solo el cierre, o los dos. */
export const resolveModalityWindow = (schedule, modality) => {
  const propia = schedule.modalityWindows?.[modality];
  if (!propia || typeof propia !== "object") return null;

  const openingHour = horaDelReloj(propia.openingHour);
  const closingHour = horaDelReloj(propia.closingHour);
  if (openingHour === null && closingHour === null) return null;
  /* Una ventana invertida (abre 20, cierra 9) dejaría la agenda vacía sin que se
     entienda por qué desde el panel. Se ignora entera. */
  if (openingHour !== null && closingHour !== null && openingHour >= closingHour) {
    return null;
  }

  return { openingHour, closingHour };
};

export const SCHEDULE_SETTING_KEYS = Object.freeze(Object.keys(SCHEDULE_DEFAULTS));

const nextDateKey = (dateKey) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const addDaysToDateKey = (dateKey, days) => {
  let result = dateKey;
  for (let index = 0; index < days; index += 1) result = nextDateKey(result);
  return result;
};

const validInteger = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
};

const normalizeActiveWeekdays = (value) => {
  if (!Array.isArray(value)) return SCHEDULE_DEFAULTS["schedule.activeWeekdays"];
  const uniqueDays = [...new Set(value.map(Number).filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  ))];
  return uniqueDays.length > 0 ? uniqueDays : SCHEDULE_DEFAULTS["schedule.activeWeekdays"];
};

const legacyScheduleFromSettings = (settings) => {
  const openingHour = validInteger(
    settings["schedule.openingHour"],
    0,
    23,
    SCHEDULE_DEFAULTS["schedule.openingHour"],
  );
  const requestedClosingHour = validInteger(
    settings["schedule.closingHour"],
    1,
    24,
    SCHEDULE_DEFAULTS["schedule.closingHour"],
  );
  const closingHour = requestedClosingHour > openingHour
    ? requestedClosingHour
    : SCHEDULE_DEFAULTS["schedule.closingHour"];

  return {
    openingHour,
    closingHour,
    advanceNoticeMinutes: validInteger(
      settings["schedule.advanceNoticeMinutes"],
      0,
      60 * 24 * 30,
      SCHEDULE_DEFAULTS["schedule.advanceNoticeMinutes"],
    ),
    slotDurationMinutes: validInteger(
      settings["schedule.slotDurationMinutes"],
      5,
      120,
      SCHEDULE_DEFAULTS["schedule.slotDurationMinutes"],
    ),
    timeZone: normalizeTimeZone(settings["schedule.timeZone"]),
    activeWeekdays: normalizeActiveWeekdays(settings["schedule.activeWeekdays"]),
  };
};

export const normalizeSchedule = (settings) => {
  const legacy = legacyScheduleFromSettings(settings);
  const availabilityPolicy = normalizeAvailabilityPolicy(
    settings[AVAILABILITY_POLICY_KEY],
    legacy,
  );
  const activeWeekdays = Array.from({ length: 7 }, (_, weekday) => weekday)
    .filter((weekday) => availabilityPolicy.weeklyAvailability[String(weekday)].enabled);

  return {
    ...legacy,
    activeWeekdays,
    advanceNoticeMinutes: availabilityPolicy.minimumNoticeMinutes,
    bufferBeforeMinutes: availabilityPolicy.bufferBeforeMinutes,
    bufferAfterMinutes: availabilityPolicy.bufferAfterMinutes,
    minimumNoticeMinutes: availabilityPolicy.minimumNoticeMinutes,
    maximumAdvanceDays: availabilityPolicy.maximumAdvanceDays,
    weeklyAvailability: availabilityPolicy.weeklyAvailability,
    holidays: availabilityPolicy.holidays,
    dateExceptions: availabilityPolicy.dateExceptions,
    blockedIntervals: availabilityPolicy.blockedIntervals,
    availabilityPolicy,
    modalityWindows: normalizeModalityWindows(settings["schedule.modalityWindows"]),
    modalityChangeBufferMinutes: normalizeModalityChangeBuffer(
      settings["schedule.modalityChangeBufferMinutes"],
    ),
  };
};

/* Se queda solo con las modalidades conocidas y con las horas que son horas. Lo que
   no se entiende se descarta acá, así `resolveModalityWindow` no tiene que dudar y
   un valor corrupto en la base no vacía la agenda. */
const normalizeModalityWindows = (valor) => {
  if (!valor || typeof valor !== "object") return null;
  const limpio = {};
  for (const modality of MODALITIES) {
    const ventana = valor[modality];
    if (!ventana || typeof ventana !== "object") continue;
    const apertura = horaDelReloj(ventana.openingHour);
    const cierre = horaDelReloj(ventana.closingHour);
    if (apertura === null && cierre === null) continue;
    limpio[modality] = {
      ...(apertura === null ? {} : { openingHour: apertura }),
      ...(cierre === null ? {} : { closingHour: cierre }),
    };
  }
  return Object.keys(limpio).length > 0 ? limpio : null;
};

/* Tope de 4 horas: más que eso no es traslado, es un error de carga, y en la agenda
   se vería como días enteros sin turnos sin explicación visible. */
const normalizeModalityChangeBuffer = (valor) =>
  Number.isInteger(valor) && valor >= 0 && valor <= 240 ? valor : 0;

const strictInteger = (value, min, max, key) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AvailabilityPolicyValidationError(
      `${key} debe ser un entero entre ${min} y ${max}.`,
    );
  }
};

export const validateScheduleSettings = (settings) => {
  strictInteger(settings["schedule.openingHour"], 0, 23, "schedule.openingHour");
  strictInteger(settings["schedule.closingHour"], 1, 24, "schedule.closingHour");
  if (settings["schedule.closingHour"] <= settings["schedule.openingHour"]) {
    throw new AvailabilityPolicyValidationError("El horario de cierre debe ser posterior a la apertura.");
  }
  strictInteger(
    settings["schedule.advanceNoticeMinutes"],
    0,
    60 * 24 * 30,
    "schedule.advanceNoticeMinutes",
  );
  strictInteger(settings["schedule.slotDurationMinutes"], 5, 120, "schedule.slotDurationMinutes");
  if (
    !Array.isArray(settings["schedule.activeWeekdays"]) ||
    settings["schedule.activeWeekdays"].length === 0 ||
    settings["schedule.activeWeekdays"].some(
      (day) => !Number.isInteger(day) || day < 0 || day > 6,
    )
  ) {
    throw new AvailabilityPolicyValidationError("schedule.activeWeekdays es inválido.");
  }
  if (settings["schedule.timeZone"] !== "America/Argentina/Buenos_Aires") {
    throw new AvailabilityPolicyValidationError(
      "La zona horaria debe ser America/Argentina/Buenos_Aires.",
    );
  }

  return normalizeSchedule(settings);
};

export const getScheduleSettingsSnapshot = async () => {
  const records = await AppSettings.find({
    key: { $in: [...SCHEDULE_SETTING_KEYS, SCHEDULE_AGGREGATE_KEY] },
  }).lean();
  const settings = { ...SCHEDULE_DEFAULTS };
  records
    .filter((record) => SCHEDULE_SETTING_KEYS.includes(record.key))
    .forEach((record) => { settings[record.key] = record.value; });
  const aggregate = records.find((record) => record.key === SCHEDULE_AGGREGATE_KEY);
  if (aggregate?.value?.settings && typeof aggregate.value.settings === "object") {
    for (const key of SCHEDULE_SETTING_KEYS) {
      if (Object.hasOwn(aggregate.value.settings, key)) {
        settings[key] = aggregate.value.settings[key];
      }
    }
  }
  const revision = Number.isSafeInteger(aggregate?.value?.revision)
    ? aggregate.value.revision
    : 0;
  return { settings, revision, schedule: normalizeSchedule(settings) };
};

export const getScheduleConfiguration = async () =>
  (await getScheduleSettingsSnapshot()).schedule;

const canonicalScheduleSettings = (settings, normalized) => ({
  "schedule.openingHour": settings["schedule.openingHour"],
  "schedule.closingHour": settings["schedule.closingHour"],
  "schedule.advanceNoticeMinutes": settings["schedule.advanceNoticeMinutes"],
  "schedule.slotDurationMinutes": settings["schedule.slotDurationMinutes"],
  "schedule.timeZone": settings["schedule.timeZone"],
  "schedule.activeWeekdays": [...settings["schedule.activeWeekdays"]],
  /* Se guarda lo NORMALIZADO, no lo que llegó: así un valor raro cargado una vez no
     queda latente en la base esperando el día que alguien lea la clave sin sanear. */
  "schedule.modalityWindows": normalized.modalityWindows,
  "schedule.modalityChangeBufferMinutes": normalized.modalityChangeBufferMinutes,
  [AVAILABILITY_POLICY_KEY]: settings[AVAILABILITY_POLICY_KEY] == null
    ? null
    : normalized.availabilityPolicy,
});

export const writeScheduleSettingsAggregate = async (settings, expectedRevision) => {
  const normalized = validateScheduleSettings(settings);
  const nextRevision = expectedRevision + 1;
  const filter = expectedRevision === 0
    ? {
      key: SCHEDULE_AGGREGATE_KEY,
      $or: [
        { "value.revision": 0 },
        { "value.revision": { $exists: false } },
      ],
    }
    : { key: SCHEDULE_AGGREGATE_KEY, "value.revision": expectedRevision };

  try {
    const updated = await AppSettings.findOneAndUpdate(
      filter,
      {
        $set: {
          key: SCHEDULE_AGGREGATE_KEY,
          value: {
            revision: nextRevision,
            settings: canonicalScheduleSettings(settings, normalized),
          },
        },
      },
      { upsert: expectedRevision === 0, new: true },
    );
    return updated ? { revision: nextRevision, schedule: normalized } : null;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

const dateIntervalBounds = (dateKey, interval, timeZone) => {
  const startMinutes = timeStringToMinutes(interval.start);
  const endMinutes = timeStringToMinutes(interval.end);
  return {
    start: atBusinessTime(
      dateKey,
      Math.floor(startMinutes / 60),
      startMinutes % 60,
      timeZone,
    ),
    end: atBusinessTime(
      dateKey,
      Math.floor(endMinutes / 60),
      endMinutes % 60,
      timeZone,
    ),
  };
};

/* Recorta un intervalo del día a la ventana de la modalidad.
   Es una INTERSECCIÓN, nunca una extensión: si el intervalo ya era más chico que la
   ventana, queda como estaba. Cuando no hay modalidad pedida devuelve el intervalo
   tal cual, así el comportamiento anterior no cambia. */
const clampToModalityWindow = (bounds, dateKey, ventana, timeZone) => {
  if (!ventana) return bounds;
  let { start, end } = bounds;
  // Cada lado se recorta solo si está configurado, y solo hacia adentro: el resultado
  // nunca es más ancho que el intervalo que ya habilitaba la política.
  if (ventana.openingHour !== null) {
    const apertura = atBusinessTime(dateKey, ventana.openingHour, 0, timeZone);
    if (apertura > start) start = apertura;
  }
  if (ventana.closingHour !== null) {
    const cierre = atBusinessTime(dateKey, ventana.closingHour, 0, timeZone);
    if (cierre < end) end = cierre;
  }
  return { start, end };
};

export const normalizeDurationMinutes = (duration, slotDurationMinutes) => {
  const durationHours = Number(duration);
  const durationMinutes = durationHours * 60;
  if (!Number.isFinite(durationHours) || !Number.isSafeInteger(durationMinutes)) {
    return {
      error: "La duración debe expresarse en minutos completos.",
      durationMinutes: null,
    };
  }
  if (
    durationMinutes < 30 ||
    durationMinutes > 600
  ) {
    return { error: "La duración debe estar entre 0.5 y 10 horas.", durationMinutes };
  }
  if (durationMinutes % slotDurationMinutes !== 0) {
    return {
      error: `La duración debe respetar intervalos de ${slotDurationMinutes} minutos.`,
      durationMinutes,
    };
  }
  return { error: null, durationMinutes };
};

const createTemporalWindow = (schedule, now) => {
  const nowDate = new Date(now);
  const horizonDateKey = addDaysToDateKey(
    businessDateKey(nowDate, schedule.timeZone),
    schedule.maximumAdvanceDays,
  );
  return {
    minimumStartMs: nowDate.getTime() + schedule.minimumNoticeMinutes * 60 * 1000,
    horizonEndMs: atBusinessTime(horizonDateKey, 24, 0, schedule.timeZone).getTime(),
  };
};

const temporalWindowError = (startTime, schedule, temporalWindow) => {
  if (startTime.getTime() < temporalWindow.minimumStartMs) {
    return `Los turnos deben reservarse con al menos ${schedule.minimumNoticeMinutes} minutos de anticipación.`;
  }
  if (startTime.getTime() >= temporalWindow.horizonEndMs) {
    return `Los turnos solo pueden reservarse con hasta ${schedule.maximumAdvanceDays} días de anticipación.`;
  }
  return null;
};

export const evaluateConfiguredSlot = ({
  startTime,
  duration,
  schedule,
  blockedDates = [],
  resolvedIntervals = null,
  temporalWindow = null,
  now = new Date(),
  modality = null,
}) => {
  if (!(startTime instanceof Date) || Number.isNaN(startTime.getTime())) {
    return { error: "La fecha y hora del turno no es válida." };
  }
  const durationValidation = normalizeDurationMinutes(duration, schedule.slotDurationMinutes);
  if (durationValidation.error) return { error: durationValidation.error };

  const dateKey = businessDateKey(startTime, schedule.timeZone);
  const blockedDateSet = blockedDates instanceof Set ? blockedDates : new Set(blockedDates);
  if (blockedDateSet.has(dateKey)) {
    return { error: "Ese día no está disponible para reservas." };
  }
  const intervals = resolvedIntervals ?? resolveDateAvailabilityIntervals(
    dateKey,
    schedule.availabilityPolicy,
  );
  if (intervals.length === 0) {
    return { error: "Ese día no está disponible para reservas." };
  }

  const endTime = new Date(
    startTime.getTime() + durationValidation.durationMinutes * 60 * 1000,
  );
  /* La misma ventana por modalidad que usa el calendario.
     Tiene que estar acá y no solo al listar: el listado es una sugerencia, esto es la
     puerta. Sin este recorte, un POST armado a mano —o el calendario de otra
     modalidad todavía en pantalla— entraría un presencial a las 07:00 aunque el
     espacio abra a las 9. */
  const ventana = modality ? resolveModalityWindow(schedule, modality) : null;
  const containing = intervals
    .map((interval) => clampToModalityWindow(
      dateIntervalBounds(dateKey, interval, schedule.timeZone),
      dateKey,
      ventana,
      schedule.timeZone,
    ))
    .find(({ start, end }) => startTime >= start && endTime <= end);
  if (!containing) {
    if (schedule.availabilityPolicy.source === "legacy") {
      /* El horario del mensaje es el EFECTIVO, no el general: decirle "de 07:00 a
         22:00" a quien acaba de ser rechazado a las 08:00 por elegir presencial es
         un error que nadie puede resolver solo. */
      const apertura = ventana?.openingHour ?? schedule.openingHour;
      const cierre = ventana?.closingHour ?? schedule.closingHour;
      const hh = (h) => `${String(h).padStart(2, "0")}:00`;
      // Se nombra la modalidad solo si su ventana es la que recortó: decirla cuando el
      // horario es el general haría pensar que cambiar de modalidad resuelve algo.
      const porModalidad = ventana && modality ? ` para la modalidad ${modality}` : "";
      return {
        error: `El turno debe estar dentro del horario de ${hh(apertura)} a ${hh(cierre)}${porModalidad}.`,
      };
    }
    return { error: "El turno no está dentro de un intervalo disponible." };
  }
  if (
    (startTime.getTime() - containing.start.getTime()) %
      (schedule.slotDurationMinutes * 60 * 1000) !== 0
  ) {
    return {
      error: `Los turnos deben comenzar en intervalos de ${schedule.slotDurationMinutes} minutos.`,
    };
  }

  const timingError = temporalWindowError(
    startTime,
    schedule,
    temporalWindow ?? createTemporalWindow(schedule, now),
  );
  if (timingError) return { error: timingError };

  return { error: null, endTime, durationMinutes: durationValidation.durationMinutes };
};

export const validateConfiguredSlot = async (
  startTime,
  duration,
  { now = new Date(), modality = null } = {},
) => {
  const schedule = await getScheduleConfiguration();
  const dateKey = startTime instanceof Date && !Number.isNaN(startTime.getTime())
    ? businessDateKey(startTime, schedule.timeZone)
    : null;
  const blocked = dateKey && await BlockedDate.exists({ date: dateKey });
  const evaluated = evaluateConfiguredSlot({
    startTime,
    duration,
    schedule,
    blockedDates: blocked ? [dateKey] : [],
    now,
    modality,
  });
  return { ...evaluated, schedule };
};

/* Cuánto tiempo extra hay que dejar libre alrededor de `booking` porque el turno que
   se está evaluando es de OTRA modalidad y hay que viajar.
   Cero cuando no se puede afirmar que haya un cambio: si no se sabe la modalidad
   pedida, o la reserva guardada no la tiene (las anteriores al campo), es mejor no
   bloquear que bloquear de más por un dato ausente. */
const trasladoEntre = (booking, modality, bufferMs) => {
  if (!bufferMs || !modality || !booking.modality) return 0;
  return booking.modality === modality ? 0 : bufferMs;
};

/* La modalidad NO entra en esta comparación, y es a propósito: la agenda es una sola.
   Solo modifica cuánto se extiende la ventana ocupada, nunca si se compara o no. */
const overlaps = (start, end, booking, modality, modalityChangeBufferMs = 0) => {
  const traslado = trasladoEntre(booking, modality, modalityChangeBufferMs);
  const bookingStart = new Date(booking.timeSlot).getTime()
    - Number(booking.bufferBeforeMinutes || 0) * 60 * 1000
    - traslado;
  const bookingEnd = new Date(booking.endTime).getTime()
    + Number(booking.bufferAfterMinutes || 0) * 60 * 1000
    + traslado;
  return start.getTime() < bookingEnd && end.getTime() > bookingStart;
};

export const calculateAvailableSlots = ({
  from,
  to,
  bookings,
  blockedDates,
  schedule,
  durationHours,
  now = new Date(),
  modality = null,
  /* La ventana por modalidad es una política de OFERTA al cliente, no una
     restricción física: el profesor tiene que poder agendarse un presencial a las 8
     desde el panel aunque al público le abra a las 9. El panel pasa `false`.
     Lo físico —la agenda compartida y el traslado— no se puede desactivar. */
  applyModalityWindow = true,
}) => {
  const { error, durationMinutes } = normalizeDurationMinutes(
    durationHours,
    schedule.slotDurationMinutes,
  );
  if (error) return [];

  const blockedDateSet = new Set(blockedDates);
  const temporalWindow = createTemporalWindow(schedule, now);
  const durationMs = durationMinutes * 60 * 1000;
  const slotMs = schedule.slotDurationMinutes * 60 * 1000;
  const candidateBufferBeforeMs = schedule.bufferBeforeMinutes * 60 * 1000;
  const candidateBufferAfterMs = schedule.bufferAfterMinutes * 60 * 1000;
  const modalityChangeBufferMs =
    Number(schedule.modalityChangeBufferMinutes || 0) * 60 * 1000;
  const ventana = modality && applyModalityWindow
    ? resolveModalityWindow(schedule, modality)
    : null;
  const slots = [];
  const lastDateKey = businessDateKey(to, schedule.timeZone);
  let currentDateKey = businessDateKey(from, schedule.timeZone);

  while (currentDateKey <= lastDateKey) {
    if (!blockedDateSet.has(currentDateKey)) {
      const intervals = resolveDateAvailabilityIntervals(
        currentDateKey,
        schedule.availabilityPolicy,
      );
      for (const interval of intervals) {
        const { start: intervalStart, end: intervalEnd } = clampToModalityWindow(
          dateIntervalBounds(currentDateKey, interval, schedule.timeZone),
          currentDateKey,
          ventana,
          schedule.timeZone,
        );
        for (
          let startMs = intervalStart.getTime();
          startMs + durationMs <= intervalEnd.getTime();
          startMs += slotMs
        ) {
          const timeSlot = new Date(startMs);
          const endTime = new Date(startMs + durationMs);
          if (timeSlot < from || endTime > to) continue;
          if (temporalWindowError(timeSlot, schedule, temporalWindow)) continue;
          const claimStart = new Date(startMs - candidateBufferBeforeMs);
          const claimEnd = new Date(endTime.getTime() + candidateBufferAfterMs);
          /* Se comparan TODAS las reservas del día, de cualquier modalidad: el
             profesor es uno. La modalidad solo agrega el traslado. */
          if (bookings.some((booking) =>
            overlaps(claimStart, claimEnd, booking, modality, modalityChangeBufferMs),
          )) continue;
          slots.push({ timeSlot, endTime, duration: durationMinutes / 60 });
        }
      }
    }
    currentDateKey = nextDateKey(currentDateKey);
  }

  return slots;
};
