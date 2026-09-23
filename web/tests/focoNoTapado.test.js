import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* WCAG 2.4.11 (AA): EL FOCO NO QUEDA TAPADO POR LA BARRA FIJA.
 *
 * Al retroceder con Shift+Tab, el navegador desplaza lo justo para que el
 * elemento entre por arriba y lo deja pegado al borde superior, donde está la
 * barra. Medido en el navegador antes del arreglo: hasta cuatro elementos
 * tapados en la portada, y la pregunta «¿Las clases son online o
 * presenciales?» del FAQ, entera.
 *
 * El sitio no tiene tests de navegador (el CI sólo corre `node --test`), así
 * que esto no mide la página: fija la regla y el alto medido. La cápsula
 * visible termina en 78px en escritorio y 74px en celular. Si la barra crece,
 * este número tiene que crecer con ella.
 */

const ALTO_MEDIDO_DE_LA_BARRA = 78;
const AIRE = 12;

const css = readFileSync(new URL("../src/styles/base.css", import.meta.url), "utf8");
const bloquesHtml = [...css.matchAll(/(?:^|\n)html\s*\{([^}]*)\}/g)].map((m) => m[1]);

test("el html reserva el alto de la barra para el foco y las anclas", () => {
  const valores = bloquesHtml
    .map((b) => b.match(/scroll-padding-top:\s*(\d+)px/))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  assert.equal(valores.length, 1, "tiene que haber exactamente un scroll-padding-top en `html`");
  assert.ok(
    valores[0] >= ALTO_MEDIDO_DE_LA_BARRA + AIRE,
    `${valores[0]}px no alcanza: la barra mide ${ALTO_MEDIDO_DE_LA_BARRA}px más ${AIRE} de aire`,
  );
});

test("ninguna regla lo apaga más abajo", () => {
  assert.doesNotMatch(css, /scroll-padding(-top)?:\s*(0|auto)\b/);
});
