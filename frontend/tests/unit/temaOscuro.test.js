import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

/* EL TEMA OSCURO VIVE EN UN SOLO LUGAR.
 *
 * El modo oscuro anterior se sostenía con 433 reglas [data-theme="dark"]
 * repartidas en 25 archivos: cada componente nuevo necesitaba su parche, y el
 * que se olvidaba quedaba claro. Agustín lo vio en el paso 1 del kiosco: un
 * recuadro menta con texto blanco encima (1,01:1).
 *
 * Se reescribió así: una capa semántica en tokens.css (--sf-*, --ink-*,
 * --tint-*, los pares --cta-solid-* y --navy-solid-*) que es lo único que
 * cambia con el tema. Estos tests fijan las reglas de esa arquitectura. La
 * prueba de que se ve bien es modo-oscuro.spec.js, en el navegador; esto
 * cuida que nadie vuelva a abrir la puerta por la que entraron los parches.
 */

const RAIZ = new URL("../../src/", import.meta.url);
const archivos = readdirSync(RAIZ, { recursive: true, encoding: "utf8" })
  .map((r) => r.replace(/\\/g, "/"))
  .filter((r) => r.endsWith(".css"));
const leer = (r) => readFileSync(new URL(r, RAIZ), "utf8");
const componentes = archivos.filter((r) => !r.endsWith("styles/tokens.css"));
const tokens = postcss.parse(leer("styles/tokens.css"));

const esOscuro = (regla) => {
  for (let n = regla; n; n = n.parent) {
    if (n.selector && /\[data-theme=["']?dark["']?\]/.test(n.selector)) return true;
    if (n.type === "atrule" && /prefers-color-scheme:\s*dark/.test(n.params)) return true;
  }
  return false;
};
const PROP_DE_COLOR = /^(color|background(-color|-image)?|border(-[a-z-]+)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|caret-color)$/;

test("los componentes no traen parches de color por tema", () => {
  /* Lo único que un componente puede decidir por tema es lo que no es color
     (cambiar un ícono, un filtro de imagen) y el acento de cada materia, que
     viene del dato y en oscuro usa su variante clara. */
  const PERMITIDAS = new Set(["--subject-accent"]);
  const parches = [];
  for (const r of componentes) {
    postcss.parse(leer(r)).walkDecls((d) => {
      if (!esOscuro(d.parent)) return;
      if (PERMITIDAS.has(d.prop)) return;
      if (PROP_DE_COLOR.test(d.prop) || (d.prop.startsWith("--") && /#|rgb|color-mix/.test(d.value))) {
        parches.push(`${r} ${d.parent.selector?.slice(0, 50)} → ${d.prop}`);
      }
    });
  }
  assert.deepEqual(parches, [], `parches de color por tema:\n  ${parches.join("\n  ")}`);
});

test("cada token de la capa semántica tiene su valor en oscuro", () => {
  const claro = new Set();
  const oscuro = new Set();
  tokens.walkDecls((d) => {
    if (!/^--(sf|ink|tint)-?/.test(d.prop)) return;
    if (d.parent.selector === ":root") claro.add(d.prop);
    if (/data-theme="dark"/.test(d.parent.selector || "")) oscuro.add(d.prop);
  });
  assert.ok(claro.size >= 15, `la capa semántica tiene ${claro.size} tokens: el barrido no la encontró`);
  const faltan = [...claro].filter((t) => !oscuro.has(t));
  assert.deepEqual(faltan, [], `tokens semánticos sin valor oscuro: ${faltan.join(", ")}`);
});

test("ningún componente pinta un fondo con una primitiva clara", () => {
  /* Las rampas (--brand-navy-50 … -900, etc.) NO cambian con el tema: son
     primitivas. Un fondo con --brand-green-50 queda menta en oscuro, que es
     exactamente la mancha de la captura. Para fondos está la capa semántica. */
  const CLARAS = /var\(--brand-(navy|green|gray)-(50|100|200)\b|var\(--brand-green-soft\b|var\(--ui-bg-light\b/;
  const hallazgos = [];
  for (const r of componentes) {
    postcss.parse(leer(r)).walkDecls(/^background/, (d) => {
      if (CLARAS.test(d.value)) hallazgos.push(`${r}:${d.source.start.line} ${d.value.slice(0, 60)}`);
    });
  }
  assert.deepEqual(hallazgos, [], `fondos con primitivas claras:\n  ${hallazgos.join("\n  ")}`);
});

test("no hay variables fantasma en propiedades de color", () => {
  /* var(--x, #1e293b) con --x sin definir usa SIEMPRE el respaldo: un gris
     oscuro fijo que en oscuro no se lee. Así estaban los títulos del editor de
     precios del panel (1,1:1) y la agenda. Se permiten las definidas desde JS. */
  const definidas = new Set(["--acciones-lift"]);
  /* Cuerpo con llaves a propósito: en postcss, un callback que devuelve false
     CORTA el recorrido, y `a && b` devuelve false en la primera declaración que
     no es una variable. La primera versión de este test paraba ahí. */
  for (const r of archivos) {
    postcss.parse(leer(r)).walkDecls((d) => {
      if (d.prop.startsWith("--")) definidas.add(d.prop);
    });
  }
  const js = readdirSync(RAIZ, { recursive: true, encoding: "utf8" }).filter((r) => /\.jsx?$/.test(r));
  for (const r of js) for (const m of leer(r.replace(/\\/g, "/")).matchAll(/["'`](--[\w-]+)["'`]/g)) definidas.add(m[1]);

  const fantasmas = [];
  for (const r of componentes) {
    postcss.parse(leer(r)).walkDecls((d) => {
      if (!PROP_DE_COLOR.test(d.prop)) return;
      for (const m of d.value.matchAll(/var\((--[\w-]+)/g)) {
        if (!definidas.has(m[1])) fantasmas.push(`${r}:${d.source.start.line} ${m[1]}`);
      }
    });
  }
  assert.deepEqual(fantasmas, [], `variables que no existen:\n  ${fantasmas.join("\n  ")}`);
});

test("ningún nombre de variable quedó roto por un reemplazo", () => {
  /* Un reemplazo de colores con \bwhite\b convirtió var(--brand-white) en
     var(--brand-var(--sf-card)): CSS inválido que el navegador descarta en
     silencio, también en modo claro. */
  const rotos = componentes.filter((r) => /var\(--[\w-]*var\(/.test(leer(r)));
  assert.deepEqual(rotos, []);
});

test("todas las hojas se pueden parsear", () => {
  for (const r of archivos) assert.doesNotThrow(() => postcss.parse(leer(r)), r);
});
