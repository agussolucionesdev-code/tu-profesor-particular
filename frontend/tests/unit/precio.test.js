import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarDescuento,
  desglosarPrecio,
  formatearPesos,
  precioDeUnaClase,
  resolverTarifa,
  tarifaUsable,
} from "../../src/utils/precio.js";

/* El precio que se le muestra a quien está por reservar.
 *
 * LA REGLA QUE ESTOS TESTS PROTEGEN: cuando no hay tarifa cargada, no se muestra nada.
 * Nunca "$0".
 *
 * Un "$0" se lee como "es gratis", y es una promesa que el negocio no hizo. El valor
 * sale de un ajuste que carga una persona en el panel, así que el caso "todavía no lo
 * cargó" es real y va a pasar: la primera vez que alguien reserve después de un deploy
 * limpio, la tarifa es cero. Mostrar el hueco es honesto; mostrar $0 es mentir.
 */

test("una tarifa sin cargar no es una tarifa", () => {
  // Todos los valores que puede devolver un ajuste que nadie completó.
  for (const malo of [0, -100, null, undefined, "", "  ", "gratis", NaN, Infinity]) {
    assert.equal(tarifaUsable(malo), null, `${JSON.stringify(malo)} no debería pasar`);
  }
});

test("acepta una tarifa real, venga como número o como texto", () => {
  // El endpoint público puede devolver el número como string.
  assert.equal(tarifaUsable(12000), 12000);
  assert.equal(tarifaUsable("12000"), 12000);
  assert.equal(tarifaUsable(12500.5), 12500.5);
});

test("sin tarifa no hay precio, y devuelve null en lugar de cero", () => {
  /* Es la diferencia entre "no sabemos" y "sale cero". Devolver 0 obligaría a cada
     pantalla a acordarse de chequearlo, y alguna se va a olvidar. */
  assert.equal(precioDeUnaClase(0, 2), null);
  assert.equal(precioDeUnaClase(null, 2), null);
  assert.equal(desglosarPrecio({ tarifaPorHora: 0, duracionHoras: 2 }), null);
});

test("sin duración tampoco hay precio", () => {
  for (const duracion of [0, -1, null, undefined, "", "dos"]) {
    assert.equal(precioDeUnaClase(10000, duracion), null);
  }
});

test("multiplica la tarifa por las horas", () => {
  assert.equal(precioDeUnaClase(10000, 1), 10000);
  assert.equal(precioDeUnaClase(10000, 2), 20000);
  // Media hora y hora y media son duraciones ofrecidas de verdad.
  assert.equal(precioDeUnaClase(10000, 0.5), 5000);
  assert.equal(precioDeUnaClase(10000, 1.5), 15000);
});

test("formatea en pesos argentinos, sin centavos", () => {
  const texto = formatearPesos(20000);
  assert.match(texto, /20\.000/);
  assert.doesNotMatch(texto, /,00|\.00$/, "no debería mostrar centavos");
});

test("el desglose de una sola clase no inventa un total de serie", () => {
  const d = desglosarPrecio({ tarifaPorHora: 10000, duracionHoras: 2, clases: 1 });

  assert.equal(d.porClase, 20000);
  assert.equal(d.clases, 1);
  // null y no el mismo número: una clase no es una serie, y mostrar "1 clase: $20.000
  // en total" al lado de "$20.000 por clase" es decir dos veces lo mismo.
  assert.equal(d.totalSerie, null);
  assert.equal(d.totalSerieTexto, null);
});

test("con varias clases muestra el total, que es EL número de la decisión", () => {
  /* Alguien que reserva ocho clases de dos horas está comprometiendo ocho veces el
     precio de una. Confirmar viendo sólo el precio por clase es enterarse del total
     después de haber confirmado. */
  const d = desglosarPrecio({ tarifaPorHora: 10000, duracionHoras: 2, clases: 8 });

  assert.equal(d.porClase, 20000);
  assert.equal(d.totalSerie, 160000);
  assert.match(d.totalSerieTexto, /160\.000/);
});

test("una cantidad de clases inválida cuenta como una", () => {
  // Mejor mostrar el precio de una clase que romper la pantalla del paso 3.
  for (const clases of [0, -3, 2.5, null, undefined, "ocho"]) {
    const d = desglosarPrecio({ tarifaPorHora: 10000, duracionHoras: 1, clases });
    assert.equal(d.clases, 1, `clases=${JSON.stringify(clases)}`);
    assert.equal(d.totalSerie, null);
  }
});

test("expone la tarifa por hora para poder explicar de dónde sale el número", () => {
  /* Mostrar "$20.000" solo obliga a confiar. Mostrar "$20.000 por clase de 2 horas
     ($10.000 por hora)" permite verificarlo, y eso es lo que baja la desconfianza. */
  const d = desglosarPrecio({ tarifaPorHora: 10000, duracionHoras: 2 });

  assert.equal(d.tarifaPorHora, 10000);
  assert.match(d.tarifaTexto, /10\.000/);
});

/* La resolución por matriz.
 *
 * Esta lógica existe TAMBIÉN en el backend (`services/pricingMatrix.js`). Son dos
 * proyectos sin paquete compartido, y la alternativa era pedirle al servidor una
 * cotización por cada cambio de duración en el paso 3 — una llamada de red justo cuando
 * la persona está decidiendo.
 *
 * La duplicación es segura porque la autoridad está repartida: esta copia sólo MUESTRA
 * un estimado y el precio que se guarda lo recalcula el servidor. Pero "seguro" no es
 * "gratis": estos tests fijan los MISMOS casos que los del backend, así que si alguien
 * cambia una de las dos copias, la otra queda con un test que ya no la describe.
 */

const MATRIZ = {
  porNivel: { Primaria: 16000, Secundaria: 20000 },
  excepciones: [
    { nivel: "Secundaria", materias: ["Matemática", "Física"], precio: 25000 },
  ],
  descuento: { desdeHoras: 2, porcentaje: 10 },
};

test("resuelve la base del nivel cuando la materia no tiene excepción", () => {
  assert.equal(resolverTarifa(MATRIZ, { nivel: "Secundaria", materia: "Lengua" }), 20000);
});

test("la excepción de la materia le gana a la base del nivel", () => {
  assert.equal(resolverTarifa(MATRIZ, { nivel: "Secundaria", materia: "Física" }), 25000);
});

test("una excepción vale sólo dentro de su nivel", () => {
  // Matemática en secundaria son $25.000; en primaria, primaria.
  assert.equal(resolverTarifa(MATRIZ, { nivel: "Primaria", materia: "Matemática" }), 16000);
});

test("ignora mayúsculas y espacios al comparar la materia", () => {
  for (const escrita of ["física", "  Física  ", "FÍSICA"]) {
    assert.equal(resolverTarifa(MATRIZ, { nivel: "Secundaria", materia: escrita }), 25000);
  }
});

test("cae en la tarifa general cuando la matriz no cubre la combinación", () => {
  assert.equal(
    resolverTarifa(MATRIZ, { nivel: "Universitario", materia: "Física", tarifaGeneral: 30000 }),
    30000,
  );
});

test("sin nada que resolver devuelve null, nunca cero", () => {
  assert.equal(resolverTarifa(MATRIZ, { nivel: "Universitario", materia: "Física" }), null);
  assert.equal(resolverTarifa(null, { nivel: "Secundaria" }), null);
});

test("el descuento aplica desde el mínimo y no antes", () => {
  assert.equal(aplicarDescuento(25000, 1, MATRIZ.descuento), 25000);
  assert.equal(aplicarDescuento(25000, 1.5, MATRIZ.descuento), 25000);
  assert.equal(aplicarDescuento(25000, 2, MATRIZ.descuento), 22500);
});

test("un descuento imposible se ignora en lugar de regalar la clase", () => {
  for (const malo of [-10, 100, 150, "diez", NaN]) {
    assert.equal(aplicarDescuento(25000, 2, { desdeHoras: 2, porcentaje: malo }), 25000);
  }
});

test("el desglose cotiza desde la matriz y marca el descuento", () => {
  const d = desglosarPrecio({
    matriz: MATRIZ,
    nivel: "Secundaria",
    materia: "Física",
    duracionHoras: 2,
  });

  assert.equal(d.tarifaPorHora, 25000);
  assert.equal(d.tarifaAplicada, 22500);
  assert.equal(d.huboDescuento, true);
  assert.equal(d.porClase, 45000);
});

test("sin descuento, la tarifa aplicada es la base y no se marca ahorro", () => {
  const d = desglosarPrecio({
    matriz: MATRIZ,
    nivel: "Secundaria",
    materia: "Física",
    duracionHoras: 1,
  });

  assert.equal(d.tarifaAplicada, 25000);
  assert.equal(d.huboDescuento, false);
});

test("una tarifa explícita gana sobre la resolución", () => {
  /* Es lo que mantiene funcionando a quien ya llamaba con `tarifaPorHora` a secas. */
  const d = desglosarPrecio({ matriz: MATRIZ, nivel: "Secundaria", tarifaPorHora: 9000, duracionHoras: 1 });

  assert.equal(d.tarifaPorHora, 9000);
});

test("sin tarifa para la combinación no hay desglose", () => {
  assert.equal(
    desglosarPrecio({ matriz: MATRIZ, nivel: "Universitario", duracionHoras: 2 }),
    null,
  );
});
