import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { META_POR_RUTA } from "../src/data/meta.js";
import { BRAND } from "../src/data/site.js";

/* EL COPY DEL REDISEÑO, Y LO QUE SE SACÓ A PROPÓSITO.
 *
 * El hero pasó a hablarle a la familia. Lo decidió Agustín, con la
 * recomendación de ChatGPT (GPT-6 Astra) de por medio: en primaria y secundaria
 * el que reserva y paga suele ser un adulto, y hasta ahora la portada le
 * hablaba sólo al estudiante. El otro público no se pierde: tiene su acceso
 * propio debajo de los botones, sin carrusel que alterne mensajes.
 *
 * Y se sacaron tres frases que no resistían una revisión honesta:
 *
 *   · «Nunca te las explicaron bien» le echaba la culpa a otros docentes.
 *   · «El filtro más duro de cualquier carrera» generalizaba sin sustento.
 *   · «Reservás en menos de un minuto» es una promesa que nadie midió.
 *
 * Este test barre TODO `src/`, no una página: una frase retirada que sobrevive
 * en el FAQ o en un metadato sigue publicada igual.
 */

const RAIZ = new URL("../src/", import.meta.url);
const fuentes = readdirSync(RAIZ, { recursive: true, encoding: "utf8" })
  .filter((r) => /\.(jsx?|mjs)$/.test(r))
  .map((r) => r.replace(/\\/g, "/"));
const leer = (r) => readFileSync(new URL(r, RAIZ), "utf8");
const sinComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const RETIRADAS = [
  /Nunca te las explicaron/i,
  /filtro más duro/i,
  /menos de un minuto/i,
  /* La misma promesa con otras palabras («Reservás en 1 minuto»): en turnos
     sobrevivió así. Misma lista que frontend/tests/unit/frasesRetiradas.test.js. */
  /(reserv\w*|lleva)[^.<\n]{0,25}\b(1|un) minuto/i,
  /Reservar mi clase/,
];

test("las frases retiradas no aparecen en ningún lado del sitio", () => {
  const hallazgos = [];
  for (const r of fuentes) {
    const codigo = sinComentarios(leer(r));
    for (const patron of RETIRADAS) {
      if (patron.test(codigo)) hallazgos.push(`${r} → ${patron}`);
    }
  }
  assert.deepEqual(hallazgos, [], `frases retiradas que siguen publicadas:\n  ${hallazgos.join("\n  ")}`);
});

test("el hero le habla a la familia", () => {
  const home = sinComentarios(leer("pages/Home.jsx"));
  assert.match(home, /¿Tu hijo estudia, pero/);
  assert.match(home, /sigue sin entender\?/);
});

test("el otro público tiene su acceso, sin carrusel", () => {
  const home = sinComentarios(leer("pages/Home.jsx"));
  assert.match(home, /className="hero-otro-publico"/);
});

test("el botón principal dice lo mismo en todo el sitio", () => {
  /* Un solo texto para la acción principal: «Reservar una clase». Había TRES:
     el menú decía «Reservar turno», el hero, contacto y el bloque de cierre
     «Reservar mi clase», y el pie y la política de privacidad «Reservar una
     clase». Si el encabezado dice una cosa y el hero otra, la persona duda de si
     son la misma acción.

     La primera versión de este test contaba cuántos archivos decían «Reservar
     una clase» y pasaba ANTES del cambio: ya eran tres. Lo que había que
     verificar no era cuántas veces aparece el texto correcto, sino que no quede
     ninguno de los otros. */
  const variantes = new Map();
  for (const r of fuentes) {
    for (const m of sinComentarios(leer(r)).matchAll(/Reservar (turno|mi clase|una clase|clase)\b/g)) {
      variantes.set(m[0], [...(variantes.get(m[0]) ?? []), r]);
    }
  }
  assert.deepEqual(
    [...variantes.keys()],
    ["Reservar una clase"],
    `textos de la acción principal: ${JSON.stringify(Object.fromEntries(variantes))}`,
  );
});

test("el eslogan declarado a los buscadores es el de la marca", () => {
  /* El dato estructurado le decía a Google que el eslogan era «Entendé de
     verdad, no de memoria». El eslogan de Tu Profesor Particular, el del logo,
     es otro. */
  const sd = sinComentarios(leer("data/structuredData.js"));
  assert.match(sd, /slogan:\s*BRAND\.tagline/);
  assert.equal(BRAND.tagline, "Juntos, despejando el camino a la meta.");
});

test("el título de la portada nombra lo que se busca y dónde", () => {
  const { title, description } = META_POR_RUTA["/"];
  assert.match(title, /^Clases particulares en Temperley/);
  assert.match(description, /Agustín Elías Sosa/);
  assert.ok(description.length <= 170, `descripción de ${description.length} caracteres`);
});
