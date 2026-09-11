import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

const siteNav = leer("../src/components/SiteNav.css");
const contact = leer("../src/pages/Contact.css");

/* WCAG 2.5.5 — Target Size: 44×44 CSS px mínimo.
 *
 * Medido a 375px sobre producción, este sitio tenía cinco controles por debajo,
 * y dos a menos de la mitad: los enlaces de acción de las tarjetas de contacto
 * ("Escribir un email", "Ver en el mapa") medían 23px de alto.
 *
 * Esto se verifica leyendo el CSS y no renderizando porque `web/` no tiene
 * Playwright: sus tests son de inspección de fuente, con el runner de Node. Es
 * menos fuerte que medir el DOM —no ve un contenedor que aplaste al hijo— pero
 * atrapa la regresión que importa, que es alguien borrando el `min-height` sin
 * saber por qué estaba. La app de turnos sí lo mide de verdad, en
 * `frontend/tests/e2e/blancos-tactiles.spec.js`.
 *
 * Dos cosas quedan deliberadamente afuera y conviene no "arreglarlas":
 *  · El enlace "Cómo manejo tus datos" vive dentro de un párrafo, y WCAG exime
 *    los enlaces en línea dentro de un bloque de texto.
 *  · El honeypot del formulario mide 223×32, pero cuelga de un contenedor
 *    `aria-hidden="true"` a `left: -9999px` y tiene `tabindex="-1"`. Agrandarlo
 *    sería romper su función sin ganar accesibilidad.
 */

const bloque = (css, selector) => {
  const i = css.indexOf(selector + " {");
  assert.notEqual(i, -1, `no encontré la regla ${selector}`);
  return css.slice(i, css.indexOf("}", i));
};

test("los controles de la barra de navegación llegan a 44px", () => {
  assert.match(bloque(siteNav, ".snav-brand"), /min-height:\s*44px/);

  const burger = bloque(siteNav, ".snav-burger");
  assert.match(burger, /min-height:\s*44px/);
  assert.match(burger, /min-width:\s*44px/);
  /* `min-*` además de `width`/`height`, y `flex-shrink: 0`, a propósito: en la
     app de turnos este mismo botón llegó a producción midiendo 14px de ancho
     porque era un flex item y el contenedor lo encogió pese al `width` fijo.
     Una medida que un flex container puede ignorar no es una garantía. */
  assert.match(burger, /flex-shrink:\s*0/);
});

test("los controles de la página de contacto llegan a 44px", () => {
  /* Medían 23 y 36 de alto. Son las acciones de las tarjetas de contacto: el
     camino más corto para que alguien escriba o llegue al lugar. */
  assert.match(bloque(contact, ".ct-link"), /min-height:\s*44px/);
  assert.match(bloque(contact, ".ct-copy"), /min-height:\s*44px/);
});
