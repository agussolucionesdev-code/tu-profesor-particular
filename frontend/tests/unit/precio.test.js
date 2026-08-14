import assert from "node:assert/strict";
import test from "node:test";
import {
  desglosarPrecio,
  formatearPesos,
  precioDeUnaClase,
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
