import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* LA CITA DEL PASO 4 SE VE COMO LO QUE ES.
 *
 * Agustín la pidió «entre comillas, estilo cita textual, como si fueran normas APA».
 * Hasta ahora se mostraba como un párrafo con una barra al costado: se podía leer
 * como un texto del sitio y no como algo que él dijo.
 *
 * Las comillas y la raya de la firma van por CSS y no escritas en el texto. Si
 * estuvieran en el texto, dejaría de coincidir con la constante de voz.js, y esa
 * coincidencia exacta es lo que prueba —en KioskVozAgustin.test.jsx— que nadie
 * reescribió la cita a mano en el JSX.
 */

const css = readFileSync(
  new URL("../../src/components/BookingKiosk.css", import.meta.url),
  "utf8",
);

test("la cita abre y cierra con comillas dobles tipográficas", () => {
  /* APA 7 en español: las citas de menos de cuarenta palabras van entre comillas
     dobles. Tipográficas y no rectas: " se lee como un carácter de código. */
  assert.match(css, /\.kiosk-voz-cita::before\s*\{[^}]*content:\s*"“"/);
  assert.match(css, /\.kiosk-voz-cita::after\s*\{[^}]*content:\s*"”"/);
});

test("la firma va precedida por una raya, como en una cita", () => {
  assert.match(css, /\.kiosk-voz-firma::before\s*\{[^}]*content:\s*"— "/);
});
