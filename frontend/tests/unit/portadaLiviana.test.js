import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const sinComentarios = (fuente) => fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/* LO QUE ALIVIANA EL ARRANQUE DE LA PORTADA (septiembre de 2026, medido con
 * trazas de Chrome y CPU x4 en producción). */

test("el paso a paso (3.400 px debajo del pliegue) no se maqueta hasta acercarse", () => {
  /* Tres pares de cargas: el primer diseño bajó ~27 % y el primer pintado
     ~185 ms. */
  const css = sinComentarios(leer("../../src/components/home/BookingStepsShowcase.css"));
  const regla = css.match(/^\.bss\s*\{[^}]*\}/m)?.[0] ?? "";
  assert.match(regla, /content-visibility:\s*auto/);
  assert.match(regla, /contain-intrinsic-size:\s*auto\s+\d+px/);
});

test("el pie se hidrata aparte y el panel de accesibilidad no", () => {
  /* Lo que está dentro de un límite de Suspense se hidrata después, cuando el
     contexto de preferencias ya pasó a lo real: sólo puede ir ahí lo que no lo
     lee. El panel de accesibilidad lo lee; adentro, la hidratación fallaba
     (lo detecta HidratarLaPortada.test.jsx). */
  const app = sinComentarios(leer("../../src/App.jsx"));
  assert.match(app, /<Suspense fallback=\{null\}>\{!isAdminRoute && <Footer \/>\}<\/Suspense>/);
  const panel = app.indexOf("<AccessibilityControls");
  const ultimoSuspense = app.lastIndexOf("<Suspense", panel);
  const cierre = app.lastIndexOf("</Suspense>", panel);
  assert.ok(cierre > ultimoSuspense, "AccessibilityControls no puede quedar adentro de un <Suspense>");
});
