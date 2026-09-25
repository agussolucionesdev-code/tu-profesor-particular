import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

/* EL ARRANQUE DE LA PORTADA: el bundle se ejecuta después del primer pintado.
 *
 * scripts/arranque-en-linea.js va en línea en dist/index.html (prerender.mjs)
 * en lugar del <script type="module"> del bundle. Acá se corre el archivo real
 * contra el DOM de jsdom, con los cuadros y los tiempos bajo control. */

const codigo = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/arranque-en-linea.js"),
  "utf8",
);
const correr = () => new Function(codigo)();
const bundles = () => [...document.head.querySelectorAll('script[type="module"]')];

let cuadros;

beforeEach(() => {
  vi.useFakeTimers();
  cuadros = [];
  vi.stubGlobal("requestAnimationFrame", (fn) => cuadros.push(fn));
  document.head.innerHTML =
    '<link rel="modulepreload" crossorigin href="/assets/index-X1.js" id="arranque-app">';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete document.readyState;
  document.head.innerHTML = "";
});

test("con el HTML completo, espera un cuadro pintado y recién ahí agrega el bundle", () => {
  correr();
  expect(bundles()).toHaveLength(0);

  /* requestAnimationFrame corre ANTES de pintar: todavía no. */
  cuadros.shift()(performance.now());
  expect(bundles()).toHaveLength(0);

  /* El setTimeout de adentro corre después del pintado. */
  vi.advanceTimersByTime(0);
  expect(bundles()).toHaveLength(1);
  expect(new URL(bundles()[0].src).pathname).toBe("/assets/index-X1.js");
  /* crossorigin como el modulepreload: si no coinciden, el navegador no reusa
     lo ya descargado y lo baja de nuevo. */
  expect(bundles()[0].getAttribute("crossorigin")).toBe("");

  /* El respaldo de 1,5 s no lo agrega otra vez. */
  vi.advanceTimersByTime(2000);
  expect(bundles()).toHaveLength(1);
});

test("mientras se lee el HTML, no arranca: hidratar un árbol a medio leer no coincide", () => {
  Object.defineProperty(document, "readyState", { configurable: true, get: () => "loading" });
  correr();
  vi.advanceTimersByTime(3000);
  expect(cuadros).toHaveLength(0);
  expect(bundles()).toHaveLength(0);

  document.dispatchEvent(new Event("DOMContentLoaded"));
  cuadros.shift()(performance.now());
  vi.advanceTimersByTime(0);
  expect(bundles()).toHaveLength(1);
});

test("en una pestaña de fondo, sin cuadros, arranca igual a los 1,5 s", () => {
  correr();
  vi.advanceTimersByTime(1499);
  expect(bundles()).toHaveLength(0);
  vi.advanceTimersByTime(1);
  expect(bundles()).toHaveLength(1);
});

test("sin el enlace del bundle (cualquier otra página) no hace nada", () => {
  document.head.innerHTML = "";
  correr();
  vi.advanceTimersByTime(3000);
  expect(cuadros).toHaveLength(0);
  expect(bundles()).toHaveLength(0);
});
