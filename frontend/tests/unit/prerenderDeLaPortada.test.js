import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { compilar, renderizarPortada, verificar } from "../../prerender.mjs";

/* LA PORTADA DE TURNOS LLEGA DIBUJADA EN EL HTML.
 *
 * Medido en producción (septiembre de 2026, Lighthouse celular): el HTML era
 * un <div id="root"> vacío y el hero se pintaba recién cuando terminaba todo
 * el JavaScript, a los ~4 s. `prerender.mjs` dibuja "/" en el build y lo
 * escribe en index.html; el resto de las rutas recibe app.html, el vacío.
 *
 * Estos tests corren las MISMAS funciones del script (no una copia), sin build:
 * compilan App.jsx y renderizan la portada.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const leer = (archivo) => readFileSync(path.join(RAIZ, archivo), "utf8");

const portada = async () => {
  const { default: App } = await compilar(path.join(RAIZ, "src/App.jsx"), (absoluta) => `/assets/${path.basename(absoluta)}`);
  return renderizarPortada(App);
};

test("la portada sale con el contenido a la vista y sin scripts que la CSP bloquee", async () => {
  const markup = await portada();
  assert.match(markup, /<h1[\s>]/);
  assert.match(markup, /class="hp-hero"/);
  assert.doesNotMatch(markup, /<div hidden id="S:|<template id="B:|<script[\s>]/);
  assert.doesNotMatch(markup, /brand-loader/);
});

test("el logo del HTML sirve en los dos temas antes de que corra React", async () => {
  /* La variante la elige ThemeLogo.css por data-theme, que tema.js fija
     antes de pintar: el HTML tiene que traer las dos. */
  const markup = await portada();
  assert.match(markup, /theme-logo__image--claro/);
  assert.match(markup, /theme-logo__image--oscuro/);
});

test("las redes del prerender rompen el build si el contenido se esconde", () => {
  assert.throws(() => verificar('<h1>x</h1><div hidden id="S:0"></div>'), /Suspense/);
  assert.throws(() => verificar("<h1>x</h1><script>$RC()</script>"), /script/);
  assert.throws(() => verificar('<div class="brand-loader"></div><h1>x</h1>'), /cargador/);
  assert.throws(() => verificar("<main></main>"), /h1/);
  assert.doesNotThrow(() => verificar('<main><h1 class="t">Hola</h1></main>'));
});

test("el build corre el prerender y Vercel sirve app.html al resto de las rutas", () => {
  const paquete = JSON.parse(leer("package.json"));
  assert.equal(paquete.scripts.build, "vite build && node prerender.mjs");
  assert.match(leer("vite.config.js"), /manifest: true/);

  const vercel = JSON.parse(leer("vercel.json"));
  assert.equal(vercel.rewrites.at(-1).destination, "/app.html");
  /* Ningún rewrite puede mandar "/" al HTML vacío: se perdería la portada. */
  assert.ok(vercel.rewrites.every((r) => r.source !== "/"));
});

test("la app precarga la portada y la hidrata sólo sobre el HTML de su ruta", () => {
  /* Hidratar y no createRoot: createRoot reemplazaba los nodos y las
     animaciones del título volvían a arrancar (el test de componentes
     HidratarLaPortada verifica que el primer dibujo coincida). */
  const main = leer("src/main.jsx");
  assert.match(main, /raiz\.dataset\.prerender === window\.location\.pathname/);
  assert.match(
    main,
    /if \(hidratar\) precargarPagina\(window\.location\.pathname\)\.then\(\(\) => hydrateRoot\(raiz, app\)\);/,
  );
});

test("las rutas sin prerender dibujan la barra primero: ni esperan ni precargan la pantalla", () => {
  /* Medido en producción, LCP de /reservar (el logo de la barra): esperar la
     pantalla antes de dibujar, 4,1-4,3 s; pedirla antes de dibujar sin
     esperarla, 3,5-3,7 s; pedirla al dibujar, 3,0-3,2 s. */
  const main = leer("src/main.jsx");
  assert.match(main, /\n\s*else createRoot\(raiz\)\.render\(app\);/);
  assert.doesNotMatch(main, /\.then\(\(\) => \{?\s*createRoot/);
  /* Fuera de los comentarios, precargarPagina se llama una sola vez: en la
     rama que hidrata. */
  const codigo = main.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(codigo.match(/precargarPagina\(/g)?.length, 1);
});

test("el prerender marca la ruta que dibujó", () => {
  assert.match(leer("prerender.mjs"), /<div id="root" data-prerender="\/">/);
  assert.match(leer("src/App.jsx"), /from "\.\/paginas"/);
});
