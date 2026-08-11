import assert from "node:assert/strict";
import test from "node:test";
import {
  OPCIONES_DE_REPETICION,
  SEMANAS_MAXIMO,
  fechasDeLaSerie,
  reservarSerie,
  resumirSerie,
} from "../../src/utils/bookingSeries.js";

/* Serie de clases semanales.
 *
 * 8 clases son 8 reservas con 8 códigos, como en Google Calendar: cada una se
 * cancela y se reprograma sola. Por eso no hay endpoint nuevo — se hace una
 * llamada por semana al mismo endpoint ya probado— y lo que hay que fijar acá es
 * la orquestación: que las fechas sean correctas, que una semana ocupada no
 * arruine el resto, y que cada llamada lleve su propia clave de idempotencia.
 */

const LUNES = new Date(2026, 7, 3, 15, 0, 0); // lunes 3 de agosto de 2026, 15:00

const aFormatoApi = (d) =>
  [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("/") +
  " " +
  String(d.getHours()).padStart(2, "0") +
  ":" +
  String(d.getMinutes()).padStart(2, "0");

const payloadBase = { studentName: "Alumna", subject: "Matemática", duration: 1 };

/* Espía: registra lo que se le pidió y responde lo que le indiquen. Así se prueba
   la orquestación sin red y sin depender del backend. */
const espia = ({ fallarEn = [] } = {}) => {
  const llamadas = [];
  const crearReserva = async (payload, clave) => {
    llamadas.push({ payload, clave });
    const indice = llamadas.length - 1;
    if (fallarEn.includes(indice)) {
      const error = new Error("Horario ocupado.");
      error.response = { status: 409, data: { message: "Horario ocupado." } };
      throw error;
    }
    return { data: { data: { bookingCode: `COD${indice}` } } };
  };
  let n = 0;
  const nuevaClave = () => `clave-${n++}`;
  return { llamadas, crearReserva, nuevaClave };
};

const correr = (semanas, opciones = {}) => {
  const { llamadas, crearReserva, nuevaClave } = espia(opciones);
  return reservarSerie({
    payloadBase,
    primeraFecha: LUNES,
    semanas,
    crearReserva,
    nuevaClave,
    aFormatoApi,
  }).then((r) => ({ ...r, llamadas }));
};

test("las fechas caen el mismo día de la semana, semana a semana", () => {
  const fechas = fechasDeLaSerie(LUNES, 4);

  assert.equal(fechas.length, 4);
  assert.ok(fechas.every((f) => f.getDay() === LUNES.getDay()));
  assert.ok(fechas.every((f) => f.getHours() === 15));
  assert.deepEqual(
    fechas.map((f) => f.getDate()),
    [3, 10, 17, 24],
  );
});

test("una serie de 4 hace 4 llamadas", async () => {
  const { llamadas, resultados } = await correr(4);

  assert.equal(llamadas.length, 4);
  assert.equal(resultados.filter((r) => r.ok).length, 4);
});

test("cada llamada lleva su propia clave de idempotencia", async () => {
  /* Si compartieran clave, el backend trataría la segunda como repetición de la
     primera y devolvería la misma reserva: quedaría UNA clase en lugar de ocho. */
  const { llamadas } = await correr(4);

  const claves = llamadas.map((l) => l.clave);
  assert.equal(new Set(claves).size, 4);
});

test("todas las llamadas comparten el mismo seriesId", async () => {
  const { llamadas, seriesId } = await correr(4);

  assert.ok(seriesId);
  assert.ok(llamadas.every((l) => l.payload.seriesId === seriesId));
});

test("cada clase lleva su posición y el total", async () => {
  const { llamadas } = await correr(3);

  assert.deepEqual(
    llamadas.map((l) => l.payload.seriesIndex),
    [1, 2, 3],
  );
  assert.ok(llamadas.every((l) => l.payload.seriesTotal === 3));
});

test("una sola clase NO lleva campos de serie", async () => {
  // La mayoría de las reservas son de una clase y no tienen que arrastrar
  // seriesId, ni obligar al backend a validar algo que no existe.
  const { llamadas, seriesId } = await correr(1);

  assert.equal(seriesId, null);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].payload.seriesId, undefined);
  assert.equal(llamadas[0].payload.seriesIndex, undefined);
});

test("las llamadas van en serie, no en paralelo", async () => {
  /* Ocho reservas simultáneas compiten por los locks de slots del backend y se
     pisan. El orden secuencial además hace que los resultados salgan en el orden
     de las semanas, que es como se muestran. */
  const orden = [];
  let enVuelo = 0;
  await reservarSerie({
    payloadBase,
    primeraFecha: LUNES,
    semanas: 3,
    aFormatoApi,
    nuevaClave: () => Math.random().toString(36),
    crearReserva: async (payload) => {
      enVuelo += 1;
      assert.equal(enVuelo, 1, "hubo dos llamadas al mismo tiempo");
      await new Promise((r) => setTimeout(r, 5));
      orden.push(payload.seriesIndex);
      enVuelo -= 1;
      return { data: { data: { bookingCode: "X" } } };
    },
  });

  assert.deepEqual(orden, [1, 2, 3]);
});

test("una semana ocupada no arruina las demás", async () => {
  // Best-effort: cancelar las otras siete porque una está tomada haría que un
  // solo horario ocupado tire abajo el mes entero.
  const { resultados } = await correr(4, { fallarEn: [2] });

  assert.equal(resultados.filter((r) => r.ok).length, 3);
  assert.equal(resultados.filter((r) => !r.ok).length, 1);
  assert.equal(resultados[2].ok, false);
});

test("sigue intentando las semanas siguientes a la que falló", async () => {
  // Si se cortara en el primer error, un choque en la semana 2 dejaría sin
  // reservar las seis que sí estaban libres.
  const { llamadas, resultados } = await correr(4, { fallarEn: [1] });

  assert.equal(llamadas.length, 4);
  assert.deepEqual(
    resultados.map((r) => r.ok),
    [true, false, true, true],
  );
});

test("el resumen cuenta lo logrado y lo que quedó afuera", async () => {
  const { resultados } = await correr(4, { fallarEn: [2] });

  const resumen = resumirSerie(resultados);
  assert.equal(resumen.total, 4);
  assert.equal(resumen.logradas.length, 3);
  assert.equal(resumen.falladas.length, 1);
  assert.equal(resumen.todasOk, false);
  assert.equal(resumen.ningunaOk, false);
  assert.deepEqual(resumen.codigos, ["COD0", "COD1", "COD3"]);
});

test("el resumen distingue el caso en que no se logró ninguna", async () => {
  // Ahí no hay nada que festejar y la pantalla tiene que decir otra cosa.
  const { resultados } = await correr(3, { fallarEn: [0, 1, 2] });

  const resumen = resumirSerie(resultados);
  assert.equal(resumen.ningunaOk, true);
  assert.equal(resumen.codigos.length, 0);
});

test("no se pueden pedir más semanas que el máximo", async () => {
  const { llamadas } = await correr(99);

  assert.equal(llamadas.length, SEMANAS_MAXIMO);
});

test("un número de semanas inválido reserva una sola clase", async () => {
  for (const valor of [0, -3, NaN, undefined, "ocho"]) {
    const { llamadas } = await correr(valor);
    assert.equal(llamadas.length, 1, `semanas=${JSON.stringify(valor)}`);
  }
});

test("la opción por defecto es una sola clase", () => {
  // Repetir tiene que ser algo que se elige, no algo que pasa sin querer.
  const recomendada = OPCIONES_DE_REPETICION.find((o) => o.recomendado);
  assert.equal(recomendada.semanas, 1);
});
