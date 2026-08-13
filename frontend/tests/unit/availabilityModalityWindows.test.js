import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MODALITIES,
  campoDe,
  parseAdminScheduleResponse,
  serializeScheduleDraft,
  validateScheduleDraft,
} from "../../src/utils/availabilitySchedule.js";

/* El contrato del panel de horarios por modalidad.
 *
 * Lo que más importa acá es el VIAJE COMPLETO del dato: el panel lee del backend,
 * el profesor edita, y lo editado vuelve. Si cualquiera de los dos extremos pierde
 * las claves nuevas, la pantalla funciona igual —muestra campos, deja tipear, dice
 * "guardado"— y el valor no llega nunca. Ya pasó una vez en este mismo cambio, con
 * un `.select()` de Mongo que no traía `modality`.
 */

const policy = () => ({
  source: "policy",
  timeZone: "America/Argentina/Buenos_Aires",
  slotDurationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minimumNoticeMinutes: 60,
  maximumAdvanceDays: 60,
  holidays: [],
  dateExceptions: [],
  blockedIntervals: [],
  weeklyAvailability: Object.fromEntries(
    Array.from({ length: 7 }, (_, weekday) => [
      String(weekday),
      {
        enabled: weekday !== 0,
        intervals: weekday === 0 ? [] : [{ start: "07:00", end: "22:00" }],
        excludedIntervals: [],
      },
    ]),
  ),
});

const respuesta = (extra = {}) => ({
  success: true,
  data: {
    revision: 4,
    openingHour: 7,
    closingHour: 22,
    advanceNoticeMinutes: 60,
    slotDurationMinutes: 30,
    timeZone: "America/Argentina/Buenos_Aires",
    activeWeekdays: [1, 2, 3, 4, 5, 6],
    availabilityPolicy: policy(),
    ...extra,
  },
});

const borrador = (extra = {}) => {
  const parsed = parseAdminScheduleResponse(respuesta());
  return { ...parsed, ...extra };
};

describe("el panel lee los horarios por modalidad del backend", () => {
  it("trae la ventana de una modalidad tal como vino", () => {
    const parsed = parseAdminScheduleResponse(respuesta({
      modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } },
      modalityChangeBufferMinutes: 45,
    }));

    assert.deepEqual(parsed.modalityWindows, {
      presencial: { openingHour: 9, closingHour: 21 },
    });
    assert.equal(parsed.modalityChangeBufferMinutes, 45);
  });

  it("sin ventanas configuradas queda en null, no en objeto vacío", () => {
    /* Un `{}` y un `null` significan lo mismo —sin recorte— y tener dos formas de
       decirlo obliga a chequear las dos en cada lector. Alguna se va a olvidar. */
    const parsed = parseAdminScheduleResponse(respuesta({ modalityWindows: null }));

    assert.equal(parsed.modalityWindows, null);
  });

  it("una respuesta sin las claves nuevas no rompe la pantalla", () => {
    // Compatibilidad con un backend que todavía no las manda: el panel tiene que
    // cargar igual, no quedarse en el mensaje de error.
    const parsed = parseAdminScheduleResponse(respuesta());

    assert.equal(parsed.modalityWindows, null);
    assert.equal(parsed.modalityChangeBufferMinutes, 0);
  });
});

describe("el panel devuelve lo editado", () => {
  it("serializa la ventana recortada y el traslado", () => {
    const enviado = serializeScheduleDraft(borrador({
      modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } },
      modalityChangeBufferMinutes: 45,
    }));

    assert.deepEqual(enviado.modalityWindows, {
      presencial: { openingHour: 9, closingHour: 21 },
    });
    assert.equal(enviado.modalityChangeBufferMinutes, 45);
  });

  it("destildar una modalidad la manda en null y no con las horas viejas", () => {
    /* Conservar los números al destildar los dejaría desincronizados del horario
       general para siempre, y el profesor no tendría forma de darse cuenta. */
    const enviado = serializeScheduleDraft(borrador({ modalityWindows: null }));

    assert.equal(enviado.modalityWindows, null);
  });

  it("configurar una modalidad no toca la otra", () => {
    const enviado = serializeScheduleDraft(borrador({
      modalityWindows: { online: { openingHour: 7, closingHour: 22 } },
    }));

    assert.deepEqual(Object.keys(enviado.modalityWindows), ["online"]);
  });
});

describe("validación antes de guardar", () => {
  const invalido = (modalityWindows) =>
    validateScheduleDraft(borrador({ modalityWindows }));

  it("rechaza un cierre anterior a la apertura y apunta al campo", () => {
    /* Sin `fieldId` el mensaje aparece arriba y el profesor no sabe cuál de los cuatro
       campos de la sección está mal: `handleSave` usa ese id para mover el foco. */
    const r = invalido({ presencial: { openingHour: 21, closingHour: 9 } });

    assert.equal(r.valid, false);
    assert.match(r.error, /posterior a la apertura/);
    assert.equal(r.fieldId, campoDe("presencial", "closing"));
  });

  it("rechaza horas fuera de rango", () => {
    for (const ventana of [
      { openingHour: -1, closingHour: 20 },
      { openingHour: 9, closingHour: 25 },
      { openingHour: 9.5, closingHour: 20 },
    ]) {
      assert.equal(invalido({ presencial: ventana }).valid, false);
    }
  });

  it("rechaza una hora vacía en lugar de guardarla como cero", () => {
    /* El input numérico manda "" cuando se borra el contenido, y `Number("")` es 0:
       sin este chequeo, borrar la apertura la guardaría como medianoche en silencio. */
    const r = invalido({ presencial: { openingHour: "", closingHour: 21 } });

    assert.equal(r.valid, false);
    assert.equal(r.fieldId, campoDe("presencial", "opening"));
  });

  it("rechaza un traslado fuera de rango", () => {
    // Más de 4 horas no es traslado, es un error de carga que vaciaría días enteros.
    assert.equal(
      validateScheduleDraft(borrador({ modalityChangeBufferMinutes: 300 })).valid,
      false,
    );
    assert.equal(
      validateScheduleDraft(borrador({ modalityChangeBufferMinutes: -5 })).valid,
      false,
    );
  });

  it("acepta un borrador sin recortes", () => {
    const r = validateScheduleDraft(borrador({
      modalityWindows: null,
      modalityChangeBufferMinutes: 45,
    }));

    assert.equal(r.valid, true, r.error ?? "");
  });
});

describe("ida y vuelta completo", () => {
  it("lo que se guarda es lo que se vuelve a leer", () => {
    /* La prueba que atrapa un extremo roto: si el DTO de lectura o el de escritura
       pierde una clave, el valor no sobrevive al viaje aunque la pantalla ande. */
    const editado = borrador({
      modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } },
      modalityChangeBufferMinutes: 45,
    });
    const enviado = serializeScheduleDraft(editado);
    /* `source` se repone a mano porque el serializador no lo emite y el backend sí lo
       devuelve siempre: sin esto la simulación falla por un motivo que en producción no
       existe, y el test dejaría de hablar de modalidades. */
    const releido = parseAdminScheduleResponse({
      success: true,
      data: {
        ...respuesta().data,
        ...enviado,
        availabilityPolicy: { ...enviado.availabilityPolicy, source: "policy" },
      },
    });

    assert.deepEqual(releido.modalityWindows, editado.modalityWindows);
    assert.equal(releido.modalityChangeBufferMinutes, 45);
  });

  it("las modalidades del panel son las que entiende el backend", () => {
    // Si alguna vez se agrega una tercera modalidad, este test recuerda que hay que
    // tocar los dos lados: una modalidad que el backend no conoce se rechaza.
    assert.deepEqual(MODALITIES, ["online", "presencial"]);
  });
});
