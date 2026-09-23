import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

/* LAS FRASES QUE SE RETIRARON DEL SITIO, TAMPOCO EN TURNOS.
 *
 * En el rediseño se sacaron del sitio institucional tres frases que no
 * resistían una revisión honesta (lo decidió Agustín, con ChatGPT de por medio):
 *
 *   · «Nunca te las explicaron bien» le echaba la culpa a otros docentes.
 *   · «El filtro más duro de cualquier carrera» generalizaba sin sustento.
 *   · «Reservás en menos de un minuto» es una promesa que nadie midió.
 *
 * El test de aquel cambio (web/tests/copyFamilias.test.js) barría sólo
 * `web/src`. Turnos las siguió publicando las tres, en la portada y en el FAQ:
 * la misma persona leía en un sitio lo que el otro ya no afirmaba. Este barre
 * TODO `src/` de turnos y el index.html, con la misma lista.
 */

const RAIZ = new URL("../../", import.meta.url);
const fuentes = [
  "index.html",
  ...readdirSync(new URL("src/", RAIZ), { recursive: true, encoding: "utf8" })
    .filter((r) => /\.(jsx?|mjs)$/.test(r))
    .map((r) => `src/${r.replace(/\\/g, "/")}`),
];
const sinComentarios = (s) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const RETIRADAS = [
  /Nunca te las explicaron/i,
  /filtro más duro/i,
  /menos de un minuto/i,
  /* La misma promesa con otras palabras: «Reservás en 1 minuto» estaba en un
     cartel del hero y el primer barrido no lo vio. «Esperá un minuto», en un
     mensaje de error, no promete nada y no entra. */
  /(reserv\w*|lleva)[^.<\n]{0,25}\b(1|un) minuto/i,
  /Reservar mi clase/,
];

test("el barrido encuentra las fuentes", () => {
  assert.ok(fuentes.length > 50, `sólo ${fuentes.length} archivos: el barrido no está mirando src/`);
  assert.ok(fuentes.includes("src/pages/HomePage.jsx"));
});

test("las frases retiradas del sitio no aparecen en turnos", () => {
  const hallazgos = [];
  for (const r of fuentes) {
    const codigo = sinComentarios(readFileSync(new URL(r, RAIZ), "utf8"));
    for (const patron of RETIRADAS) {
      if (patron.test(codigo)) hallazgos.push(`${r} → ${patron}`);
    }
  }
  assert.deepEqual(hallazgos, [], `frases retiradas que siguen publicadas:\n  ${hallazgos.join("\n  ")}`);
});
