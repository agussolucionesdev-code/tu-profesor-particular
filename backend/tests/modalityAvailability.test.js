import { describe, expect, it } from "vitest";
import {
  MODALITY_SCHEDULE_DEFAULTS,
  SCHEDULE_DEFAULTS,
  calculateAvailableSlots,
  normalizeSchedule,
  resolveModalityWindow,
} from "../src/services/availabilityService.js";

/* Horarios por modalidad y buffer por traslado.
 *
 * TRES REQUISITOS, Y EL PRIMERO ES EL QUE NO SE PUEDE ROMPER NUNCA:
 *
 * 1. La agenda es UNA SOLA. Si hay un presencial de 18 a 20, las 18 no están
 *    libres para online tampoco: el profesor no puede estar en dos lados. Esto ya
 *    funcionaba —`overlaps` compara rangos y nunca miró la modalidad— y estos
 *    tests están para que nadie lo "optimice" separando las bolsas de
 *    disponibilidad. Si alguien lo hiciera, dos personas podrían reservar las
 *    18:00, una online y una presencial.
 *
 * 2. Cada modalidad puede tener su propia VENTANA. Online abre temprano y cierra
 *    tarde porque no cuesta nada; presencial abre más tarde —abrir el espacio a
 *    las 7 le cuesta al profesor— y cierra antes, para que un chico de secundaria
 *    no viaje de noche.
 *
 * 3. Cuando la modalidad CAMBIA entre dos turnos contiguos hace falta tiempo de
 *    traslado. Un online que termina 19:00 y un presencial que arranca 19:00 son
 *    imposibles: hay que viajar. Un buffer global no sirve porque dejaría huecos
 *    muertos entre dos clases online seguidas, donde no hace falta moverse.
 */

const TZ = "America/Argentina/Buenos_Aires";

/* El schedule se arma con `normalizeSchedule` y no a mano: es la misma función que
   usa producción, así que la policy semanal, los buffers y la ventana temporal salen
   exactamente como salen en la app. Un objeto escrito a mano acá probaría una forma
   que el sistema nunca produce. */
const schedule = ({
  openingHour = 7,
  closingHour = 22,
  modalityWindows = null,
  modalityChangeBufferMinutes = 0,
} = {}) =>
  normalizeSchedule({
    ...SCHEDULE_DEFAULTS,
    "schedule.openingHour": openingHour,
    "schedule.closingHour": closingHour,
    "schedule.modalityWindows": modalityWindows,
    "schedule.modalityChangeBufferMinutes": modalityChangeBufferMinutes,
  });

/* Un miércoles fijo, con `now` el día anterior: sin fijar los dos, la ventana
   temporal descarta slots según el día en que corra el test —y el aviso mínimo de
   60 minutos se comería los primeros horarios si `now` cayera el mismo día. */
const DIA = "2026-08-12";
const AHORA = new Date("2026-08-10T12:00:00.000Z");
/* El rango va de medianoche a medianoche DE BUENOS AIRES, no de UTC. Con
   `2026-08-12T00:00:00Z` el rango arrancaba el 11 a las 21:00 hora local, aparecían
   tres slots del día anterior y `slots[0]` era "21:00". Peor: como las aserciones
   comparan solo la hora, un slot libre del 11 podía tapar un bloqueo real del 12. */
const desde = new Date("2026-08-12T03:00:00.000Z");
const hasta = new Date("2026-08-13T03:00:00.000Z");

/* Hora de Buenos Aires (UTC-3) a instante UTC. */
const enBA = (hora, minuto = 0) =>
  new Date(`${DIA}T${String(hora + 3).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00.000Z`);

const horaBA = (fecha) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(fecha));

const reserva = ({ hora, duracionHoras = 2, modality = "online" }) => ({
  timeSlot: enBA(hora),
  endTime: enBA(hora + duracionHoras),
  modality,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
});

const libres = (opciones = {}) =>
  calculateAvailableSlots({
    from: desde,
    to: hasta,
    bookings: [],
    blockedDates: [],
    schedule: schedule(),
    durationHours: 1,
    now: AHORA,
    ...opciones,
  }).map((s) => horaBA(s.timeSlot));

describe("1. la agenda es una sola: la modalidad no abre cupo nuevo", () => {
  it("un presencial de 18 a 20 tapa las 18 también para online", () => {
    /* El requisito textual de Agustín: "si está ocupado en modo presencial, en ese
       horario, también se ocupe en virtual, porque no puedo estar en dos lados". */
    const conPresencial = libres({
      bookings: [reserva({ hora: 18, duracionHoras: 2, modality: "presencial" })],
      modality: "online",
    });

    expect(conPresencial).not.toContain("18:00");
    expect(conPresencial).not.toContain("19:00");
  });

  it("un online de 17 a 19 tapa las 18 también para presencial", () => {
    const conOnline = libres({
      bookings: [reserva({ hora: 17, duracionHoras: 2, modality: "online" })],
      modality: "presencial",
    });

    expect(conOnline).not.toContain("17:00");
    expect(conOnline).not.toContain("18:00");
  });

  it("tapa el SOLAPAMIENTO PARCIAL, no solo la hora exacta", () => {
    /* El otro caso que planteó: online de 17 a 19, y alguien quiere presencial de
       18 a 21. Arranca DESPUÉS del online pero se pisa una hora. Con una duración
       de 3 h, las 18:00 tienen que estar bloqueadas. */
    const slots = calculateAvailableSlots({
      from: desde,
      to: hasta,
      bookings: [reserva({ hora: 17, duracionHoras: 2, modality: "online" })],
      blockedDates: [],
      schedule: schedule(),
      durationHours: 3,
      now: AHORA,
      modality: "presencial",
    }).map((s) => horaBA(s.timeSlot));

    expect(slots).not.toContain("18:00");
    // 16:00 con 3 h termina 19:00: también se pisa.
    expect(slots).not.toContain("16:00");
    // 19:00 con 3 h arranca justo cuando el online termina: eso sí entra.
    expect(slots).toContain("19:00");
  });

  it("sin modalidad pedida, el bloqueo sigue igual", () => {
    // Compatibilidad: quien no manda modalidad no pierde el bloqueo.
    const slots = libres({
      bookings: [reserva({ hora: 18, duracionHoras: 2, modality: "presencial" })],
    });

    expect(slots).not.toContain("18:00");
  });
});

describe("2. ventana propia por modalidad", () => {
  it("online usa su ventana: abre 07:00", () => {
    const slots = libres({
      modality: "online",
      schedule: schedule({
        modalityWindows: { online: { openingHour: 7, closingHour: 22 } },
      }),
    });

    expect(slots[0]).toBe("07:00");
  });

  it("presencial abre más tarde y cierra antes", () => {
    const slots = libres({
      modality: "presencial",
      schedule: schedule({
        modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } },
      }),
    });

    expect(slots[0]).toBe("09:00");
    // Cierra 21:00 y la clase dura 1 h, así que el último arranque es 20:00.
    expect(slots[slots.length - 1]).toBe("20:00");
    expect(slots).not.toContain("07:00");
    expect(slots).not.toContain("08:00");
  });

  it("una modalidad sin ventana propia cae en la general", () => {
    // Así configurar una sola no rompe la otra.
    const slots = libres({
      modality: "online",
      schedule: schedule({
        modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } },
      }),
    });

    expect(slots[0]).toBe("07:00");
  });

  it("la ventana de la modalidad nunca AMPLÍA lo habilitado", () => {
    /* El techo es la POLÍTICA SEMANAL, no la ventana de la modalidad. Si lo habilitado
       cierra 20:00 y alguien carga online hasta las 23:00, a las 22 no se reserva: el
       recorte es una intersección contra los intervalos de la política, y una
       intersección solo puede achicar.
       Esta es la propiedad que hace que un valor mal cargado en el panel sea inocuo. */
    const slots = libres({
      modality: "online",
      schedule: schedule({
        openingHour: 9,
        closingHour: 20,
        modalityWindows: { online: { openingHour: 6, closingHour: 23 } },
      }),
    });

    expect(slots[0]).toBe("09:00");
    expect(slots[slots.length - 1]).toBe("19:00");
  });
});

describe("resolveModalityWindow", () => {
  /* Devuelve solo lo CONFIGURADO, sin mezclar openingHour/closingHour.
   *
   * Esas dos son el fallback legacy para sintetizar una política cuando no hay
   * ninguna, no un techo sobre la política. Mezclarlas rompió los horarios que cruzan
   * la medianoche: una política con intervalo 23:00–24:00 intersectada contra
   * 07:00–22:00 quedaba vacía y toda reserva nocturna respondía 400. Lo detectó
   * booking.flow.test.js, no este archivo. */
  it("devuelve la ventana configurada tal cual, sin inventar un techo", () => {
    const w = resolveModalityWindow(
      { openingHour: 9, closingHour: 20, modalityWindows: { online: { openingHour: 6, closingHour: 23 } } },
      "online",
    );

    expect(w).toEqual({ openingHour: 6, closingHour: 23 });
  });

  it("devuelve null cuando no hay ventana de esa modalidad", () => {
    // null = no recortar nada. Configurar una modalidad no puede afectar a la otra.
    expect(resolveModalityWindow({ openingHour: 7, closingHour: 22 }, "presencial")).toBe(null);
  });

  it("acepta configurar un solo lado", () => {
    // Que presencial cierre antes es una decisión independiente de cuándo abre.
    const w = resolveModalityWindow(
      { modalityWindows: { presencial: { closingHour: 21 } } },
      "presencial",
    );

    expect(w).toEqual({ openingHour: null, closingHour: 21 });
  });

  it("ignora valores que no son horas usables", () => {
    // El panel lo edita una persona: puede quedar texto, negativo o 30.
    for (const malo of [{ openingHour: "nueve" }, { openingHour: -2 }, { closingHour: 30 }]) {
      expect(resolveModalityWindow({ modalityWindows: { online: malo } }, "online")).toBe(null);
    }
  });

  it("ignora una ventana invertida", () => {
    const w = resolveModalityWindow(
      { modalityWindows: { online: { openingHour: 20, closingHour: 9 } } },
      "online",
    );

    expect(w).toBe(null);
  });
});

describe("3. buffer de traslado cuando cambia la modalidad", () => {
  const conBuffer = (minutos, extra = {}) =>
    libres({
      schedule: schedule({ modalityChangeBufferMinutes: minutos }),
      ...extra,
    });

  it("un online que termina 19:00 no deja reservar presencial a las 19:00", () => {
    /* Hay que viajar. Con 45 minutos de traslado, el primer presencial posible
       arranca 19:45, o sea el slot de las 20:00. */
    const slots = conBuffer(45, {
      bookings: [reserva({ hora: 17, duracionHoras: 2, modality: "online" })],
      modality: "presencial",
    });

    expect(slots).not.toContain("19:00");
    expect(slots).not.toContain("19:30");
    expect(slots).toContain("20:00");
  });

  it("también reserva el tiempo ANTES del turno ajeno", () => {
    // Presencial de 18 a 20: un online no puede terminar a las 18 en punto,
    // porque hay que salir antes para llegar.
    const slots = conBuffer(45, {
      bookings: [reserva({ hora: 18, duracionHoras: 2, modality: "presencial" })],
      modality: "online",
    });

    expect(slots).not.toContain("17:00");
    expect(slots).not.toContain("17:30");
    expect(slots).toContain("16:00");
  });

  it("NO deja hueco entre dos turnos de la MISMA modalidad", () => {
    /* Es la razón de que el buffer sea por cambio de modalidad y no global: dos
       clases online seguidas no necesitan traslado, y un buffer global regalaría
       45 minutos de agenda cada vez. */
    const slots = conBuffer(45, {
      bookings: [reserva({ hora: 17, duracionHoras: 2, modality: "online" })],
      modality: "online",
    });

    expect(slots).toContain("19:00");
  });

  it("en cero, se comporta como antes", () => {
    const slots = conBuffer(0, {
      bookings: [reserva({ hora: 17, duracionHoras: 2, modality: "online" })],
      modality: "presencial",
    });

    expect(slots).toContain("19:00");
  });

  it("sin modalidad pedida no se inventa traslado", () => {
    // No se sabe hacia qué modalidad se va, así que no se puede afirmar que haya
    // que viajar. Se mantiene el comportamiento anterior.
    const slots = conBuffer(45, {
      bookings: [reserva({ hora: 17, duracionHoras: 2, modality: "online" })],
    });

    expect(slots).toContain("19:00");
  });

  it("una reserva vieja sin modalidad no genera traslado", () => {
    /* Las reservas anteriores al campo `modality` tienen el default online, pero
       si alguna quedó sin valor no se puede deducir un cambio: mejor no bloquear
       que bloquear de más por un dato ausente. */
    const sinModalidad = {
      ...reserva({ hora: 17, duracionHoras: 2 }),
      modality: undefined,
    };
    const slots = conBuffer(45, {
      bookings: [sinModalidad],
      modality: "presencial",
    });

    expect(slots).toContain("19:00");
  });

  it("los valores por defecto son los que decidió el profesor", () => {
    /* Las dos modalidades atienden 07:00–22:00, así que NO hay ventana propia: ese dato
       ya vive en openingHour/closingHour y duplicarlo garantiza que un día se cambie
       uno y el otro quede viejo.
       El traslado sí viene activo en 45. Un default de cero dejaría la función escrita
       y apagada, que es peor que no tenerla: parece que anda. */
    expect(MODALITY_SCHEDULE_DEFAULTS["schedule.modalityWindows"]).toBe(null);
    expect(MODALITY_SCHEDULE_DEFAULTS["schedule.modalityChangeBufferMinutes"]).toBe(45);
  });

  it("por defecto ninguna modalidad recorta su horario", () => {
    // Presencial y online ven la misma ventana. Si mañana se separan, es una decisión
    // explícita en el panel, no un efecto de estrenar esta función.
    const conDefaults = normalizeSchedule({ ...SCHEDULE_DEFAULTS });
    expect(resolveModalityWindow(conDefaults, "presencial")).toBe(null);
    expect(resolveModalityWindow(conDefaults, "online")).toBe(null);
  });

  it("el traslado de 45 minutos del default llega hasta la agenda", () => {
    /* El default tiene que atravesar `normalizeSchedule`. Si no leyera la clave, los
       tests de arriba pasarían igual y la función no haría NADA en producción: es
       exactamente la forma en que una feature queda escrita y muerta. Ya pasó una vez
       en este mismo cambio, con el `.select()` que no traía `modality`. */
    expect(normalizeSchedule({ ...SCHEDULE_DEFAULTS }).modalityChangeBufferMinutes)
      .toBe(45);
  });

  it("la ventana por modalidad sigue funcionando cuando se configura", () => {
    /* El default es "sin recorte", pero el mecanismo tiene que quedar vivo: es lo que
       permite separar los horarios el día que convenga, sin volver a construir nada. */
    const conPresencialRecortado = normalizeSchedule({
      ...SCHEDULE_DEFAULTS,
      "schedule.modalityWindows": { presencial: { openingHour: 9, closingHour: 21 } },
    });

    expect(resolveModalityWindow(conPresencialRecortado, "presencial")).toEqual({
      openingHour: 9,
      closingHour: 21,
    });
    expect(resolveModalityWindow(conPresencialRecortado, "online")).toBe(null);
  });
});
