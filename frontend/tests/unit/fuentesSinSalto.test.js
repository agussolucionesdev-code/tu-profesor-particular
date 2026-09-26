import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const leer = (ruta) => readFileSync(path.resolve(AQUI, ruta), "utf8");

/* EL CAMBIO DE FUENTE NO MUEVE LA PORTADA.
 *
 * La portada se pinta antes de que llegue Inter. Con swap, al llegar, el
 * eslogan y los botones del héroe partían las líneas distinto y todo el héroe
 * (centrado) se movía: CLS 0,127 en Lighthouse con red y CPU limitados de
 * verdad (septiembre de 2026). Todo lo que se movía estaba en Inter.
 *
 * Se probaron primero caras de respaldo ajustadas con local(): sacaban el
 * salto pero atrasaban el primer pintado 0,3-0,6 s. Por eso ya no están. */

const inter = leer("../../src/styles/fuente-inter.css");
const caras = [...inter.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]);

test("Inter se declara con font-display: optional, nunca con swap", () => {
  assert.equal(caras.length, 7, "las mismas siete caras que @fontsource");
  for (const cara of caras) {
    assert.match(cara, /font-family: 'Inter Variable';/);
    assert.match(cara, /font-display: optional;/);
  }
  assert.doesNotMatch(inter.replace(/\/\*[\s\S]*?\*\//g, ""), /font-display: swap/);
});

test("las caras apuntan a los archivos de @fontsource, que existen", () => {
  for (const cara of caras) {
    const [, url] = cara.match(/url\(([^)]+)\)/);
    const archivo = path.resolve(AQUI, "../../src/styles", url);
    assert.ok(existsSync(archivo), `no existe ${url}`);
  }
  /* La precarga del HTML busca este nombre en el build (precargaDeFuentes.js). */
  assert.match(inter, /inter-latin-wght-normal\.woff2/);
});

test("main.jsx usa la hoja propia de Inter y no la de @fontsource", () => {
  const main = leer("../../src/main.jsx").replace(/^\s*\/\/.*$/gm, "");
  assert.match(main, /import "\.\/styles\/fuente-inter\.css";/);
  assert.doesNotMatch(main, /@fontsource-variable\/inter/);
  /* Fraunces, la de los titulares, sigue con swap: su alto no depende de la fuente. */
  assert.match(main, /import "@fontsource-variable\/fraunces\/opsz\.css";/);
});

test("no quedan caras de respaldo con local() en las pilas de fuentes", () => {
  const tokens = leer("../../src/styles/tokens.css");
  assert.doesNotMatch(tokens, /Respaldo/);
});
