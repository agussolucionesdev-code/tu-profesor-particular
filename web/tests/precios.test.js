import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { armarGrilla, formatearPesos } from "../src/data/precios.js";
import {
  DEFAULT_PRICING_MATRIX,
  cotizar,
} from "../../backend/src/services/pricingMatrix.js";

/* LOS PRECIOS QUE MUESTRA EL SITIO SON LOS QUE COBRA EL SISTEMA DE TURNOS.
 *
 * El institucional no tiene precios propios: lee en vivo la misma matriz que usa
 * el backend para cotizar cada reserva, y que Agustín edita desde el panel. Así un
 * cambio de tarifa aparece solo en los dos sitios.
 *
 * Lo que este test cuida es la otra mitad: que la cuenta que hace el sitio para
 * mostrar la grilla sea la misma que hace el servidor para cobrar. Si el sitio
 * dijera «2 horas: $45.000» y el turno saliera $50.000, el precio publicado sería
 * una promesa rota en el primer paso. Por eso se compara contra `cotizar`, la
 * función del backend, y no contra números escritos a mano.
 */

const ORDEN = ["Primaria", "Secundaria", "Secundaria Tecnica", "CENS", "Terciario", "Universitario"];

test("cada fila coincide con lo que cotiza el servidor, por hora y por dos horas", () => {
  const filas = armarGrilla(DEFAULT_PRICING_MATRIX);
  assert.ok(filas.length > 0, "la grilla quedó vacía");

  for (const fila of filas) {
    const unaHora = cotizar(DEFAULT_PRICING_MATRIX, { nivel: fila.nivel, duracionHoras: 1 });
    const dosHoras = cotizar(DEFAULT_PRICING_MATRIX, { nivel: fila.nivel, duracionHoras: 2 });
    assert.equal(fila.hora, unaHora.price, `${fila.nivel}: la hora no coincide`);
    assert.equal(fila.dosHoras, dosHoras.price, `${fila.nivel}: las dos horas no coinciden`);

    if (fila.ciencias) {
      for (const materia of fila.ciencias.materias) {
        const c1 = cotizar(DEFAULT_PRICING_MATRIX, { nivel: fila.nivel, materia, duracionHoras: 1 });
        const c2 = cotizar(DEFAULT_PRICING_MATRIX, { nivel: fila.nivel, materia, duracionHoras: 2 });
        assert.equal(fila.ciencias.hora, c1.price, `${fila.nivel} / ${materia}: hora`);
        assert.equal(fila.ciencias.dosHoras, c2.price, `${fila.nivel} / ${materia}: dos horas`);
      }
    }
  }
});

test("los niveles salen en el orden del kiosco y con su nombre escrito bien", () => {
  const filas = armarGrilla(DEFAULT_PRICING_MATRIX);
  const niveles = filas.map((f) => f.nivel);
  assert.deepEqual(niveles, ORDEN.filter((n) => niveles.includes(n)));
  // La clave interna va sin tilde; lo que se lee, con tilde.
  assert.equal(filas.find((f) => f.nivel === "Secundaria Tecnica").etiqueta, "Secundaria Técnica");
});

test("el CENS tiene precio, y es el de secundaria", () => {
  /* El nivel CENS se sumó al kiosco sin tarifa: una reserva de CENS se guardaba en
     $0, que el sistema lee como «a acordar». Es secundaria para adultos, con las
     mismas materias, así que cobra lo mismo. */
  const filas = armarGrilla(DEFAULT_PRICING_MATRIX);
  const cens = filas.find((f) => f.nivel === "CENS");
  const secundaria = filas.find((f) => f.nivel === "Secundaria");
  assert.ok(cens, "el CENS no aparece en la grilla");
  assert.equal(cens.hora, secundaria.hora);
  assert.deepEqual(cens.ciencias, secundaria.ciencias);
});

test("un nivel sin tarifa no aparece: nunca se publica $0", () => {
  /* Un cero en pantalla se lee como «es gratis». Si el panel deja un nivel sin
     cargar, ese nivel no se muestra y listo. */
  const filas = armarGrilla({
    porNivel: { Primaria: 16000, Secundaria: 0, Terciario: "" },
    excepciones: [],
    descuento: { desdeHoras: 2, porcentaje: 10 },
  });
  assert.deepEqual(filas.map((f) => f.nivel), ["Primaria"]);
});

test("una matriz rota o ausente da una grilla vacía, no un error", () => {
  for (const rota of [null, undefined, "hola", [], { porNivel: "x" }]) {
    assert.deepEqual(armarGrilla(rota), []);
  }
});

test("sin descuento configurado, dos horas valen el doble", () => {
  const filas = armarGrilla({ porNivel: { Primaria: 16000 }, excepciones: [] });
  assert.equal(filas[0].dosHoras, 32000);
  assert.equal(filas[0].hayDescuento, false);
});

test("los importes se escriben en pesos, redondos y con punto de miles", () => {
  assert.equal(formatearPesos(25000), "$25.000");
  assert.equal(formatearPesos(28800), "$28.800");
  assert.equal(formatearPesos(1000000), "$1.000.000");
});

test("la página de materias muestra la grilla y tiene qué decir si no carga", () => {
  /* El backend está en Render y puede tardar en despertar. Mientras tanto —o si no
     responde— la sección no inventa números: manda a ver el precio al reservar,
     que es donde el sistema lo calcula igual. */
  const pagina = readFileSync(new URL("../src/pages/Subjects.jsx", import.meta.url), "utf8");
  assert.match(pagina, /usePrecios\(\)/);
  assert.match(pagina, /id="precios"/);
  assert.match(pagina, /antes de dejar tus datos/);
});
