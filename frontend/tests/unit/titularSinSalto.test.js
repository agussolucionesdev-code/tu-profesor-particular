import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

/* EL TITULAR DE LA PORTADA CORTA IGUAL CON CUALQUIER FUENTE.
 *
 * Mientras llega Fraunces, Chrome dibuja con la serif genérica, más angosta:
 * a 380-426 px el titular quedaba en 2 renglones y al llegar Fraunces pasaba a
 * 3, empujando el héroe 44 px (CLS 0,12 con red lenta, septiembre de 2026).
 * Se fijan los cortes que Fraunces ya hace; si alguien cambia el texto del
 * titular o el tamaño, hay que volver a medirlos (ver HomePage.css). */

const css = leer("../../src/pages/HomePage.css");
const jsx = leer("../../src/pages/HomePage.jsx");

test("hasta 426 px el titular corta después de «Entendé»", () => {
  assert.match(
    css,
    /@media \(max-width: 426px\) \{\s*\.hp-h1-line:not\(\.hp-h1-line--accent\) \.hp-h1-word:first-child \{ display: block; \}/,
  );
});

test("hasta 345 px corta también antes de «memoria»", () => {
  assert.match(css, /@media \(max-width: 345px\) \{\s*\.hp-h1-line--accent \.hp-h1-word:last-child \{ display: block; \}/);
});

test("los cortes corresponden al texto del titular", () => {
  /* Los selectores apuntan a la primera palabra de la primera línea y a la
     última de la segunda: si el texto cambia, los cortes medidos dejan de
     valer. */
  assert.match(jsx, /\["Entendé", "de", "verdad,"\]/);
  assert.match(jsx, /\["no", "de", "memoria"\]/);
  assert.match(css, /font-size: clamp\(2\.9rem, 8\.6vw, 7\.3rem\);/);
});
