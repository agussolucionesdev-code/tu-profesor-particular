import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

/* Sin comentarios: una aserción que prohíbe un texto falla si ese texto sobrevive
   dentro del comentario que explica por qué se dejó de usar. Mismo recurso que
   erroresDeCampoAccesibles.test.js. */
const sinComentarios = (fuente) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const controles = leer("../../src/components/accessibility/AccessibilityControls.jsx");
const controlesCss = leer("../../src/components/accessibility/AccessibilityControls.css");
const footerCss = leer("../../src/layouts/Footer.css");
const kioscoJsx = leer("../../src/components/BookingKiosk.jsx");

/* LOS BOTONES FLOTANTES NO PUEDEN TAPAR «VOLVER» NI «CONTINUAR».
 *
 * En la reserva hay dos botones fijos en las esquinas de abajo: accesibilidad a la
 * izquierda y «volver al inicio de la página» a la derecha. La fila de acciones del
 * wizard —Volver y Continuar— termina justo ahí cuando la persona scrollea hasta
 * verla, que es lo que hace siempre.
 *
 * Medido en un teléfono de 375 × 812, en el paso 4:
 *
 *   accesibilidad   x 14–66    tapaba 39 px del lado izquierdo de «Volver»
 *   volver arriba   x 309–355  tapaba 39 px del lado derecho de «Continuar»
 *
 * Los 39 px de «Continuar» son los de la flecha: tocar ahí subía la página en vez
 * de avanzar la reserva.
 *
 * El mecanismo para apartarlos ya existía y apuntaba a una pantalla que ya no
 * existe (`.form-slide-panel`, `.field-flow-btn`, `.btn-neuro-primary`: el
 * formulario viejo, hoy código muerto sin importadores). Como el selector no
 * encontraba nada, el levante quedaba siempre en cero.
 */

test("el levante mira las filas de acción que el kiosco tiene hoy", () => {
  for (const clase of ["kiosk-nav", "kiosk-selection-dock"]) {
    assert.ok(
      kioscoJsx.includes(`className="${clase}"`),
      `${clase} ya no existe en el kiosco: hay que actualizar el selector`,
    );
    assert.match(
      controles,
      new RegExp(`\\.${clase}`),
      `el levante no mira .${clase}, que es donde están los botones del paso`,
    );
  }
});

test("ya no apunta al formulario viejo", () => {
  /* Si alguna de estas vuelve a aparecer, es que el selector volvió a quedar
     mirando la pantalla equivocada. */
  for (const muerta of [
    "form-slide-panel",
    "field-flow-next",
    "btn-date-next",
    "btn-neuro-primary",
  ]) {
    assert.doesNotMatch(
      sinComentarios(controles),
      new RegExp(muerta),
      `sigue apuntando a .${muerta}`,
    );
  }
});

test("el levante se publica para todos los flotantes, no sólo para accesibilidad", () => {
  /* El botón de «volver al inicio» vive en el pie y no sabe nada del wizard. Por
     eso la medida se escribe en el documento como variable y la usan los dos: si
     se guardara sólo en el estado del panel de accesibilidad, el otro botón
     seguiría tapando «Continuar». */
  assert.match(controles, /VARIABLE_LEVANTE = "--acciones-lift"/);
  assert.match(controles, /setProperty\(VARIABLE_LEVANTE/);
  assert.match(
    footerCss,
    /\.btn-up-floating[\s\S]{0,400}var\(--acciones-lift, 0px\)/,
    "el botón de volver arriba no usa el levante",
  );
  assert.match(
    controlesCss,
    /var\(--acciones-lift, 0px\)/,
    "el botón de accesibilidad no usa el levante",
  );
});

test("el levante se limpia al salir de la reserva", () => {
  /* La variable vive en <html> y sobrevive a los cambios de página: sin limpiarla,
     el botón de volver arriba quedaría flotando a media pantalla en el resto del
     sitio. */
  assert.match(controles, /removeProperty\(VARIABLE_LEVANTE\)/);
});

test("el levante corre en cualquier ancho, sólo si la fila pasa por debajo de un flotante", () => {
  /* Corría sólo hasta 720 px. A 768 × 1024, 1024 × 647 y 1280 × 720 el muelle de
     «Continuar» quedaba debajo de Accesibilidad (medido; lo cubre el e2e «los
     flotantes y el muelle de Continuar» de booking-accessibility.spec.js). */
  const codigo = sinComentarios(controles);
  assert.doesNotMatch(codigo, /innerWidth\s*>\s*720/);
  assert.match(codigo, /FLOTANTES = \[".a11y-fab", ".btn-up-floating"\]/);
  assert.match(codigo, /r\.left < f\.right && r\.right > f\.left/);

  /* Y el botón de accesibilidad lo aplica también fuera del celular. */
  const reglaBase = controlesCss.match(/^\.a11y-shell\s*\{[^}]*\}/m)?.[0] ?? "";
  assert.match(reglaBase, /var\(--acciones-lift, 0px\)/);
});
