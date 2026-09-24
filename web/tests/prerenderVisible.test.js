import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

/* EL PRERENDER TIENE QUE VERSE SIN JAVASCRIPT.
 *
 * Medido en producción (septiembre de 2026): React 19.2 prerenderizaba cada
 * página dentro de un <div hidden> con scripts en línea que la mueven a su
 * lugar —lo hace con todo bloque de Suspense de más de ~12 KB
 * (`progressiveChunkSize`), y el <Suspense> de App.jsx envuelve todas las
 * rutas—. La CSP del sitio (`script-src 'self'`) bloquea esos scripts, así que
 * hasta que llegaba el bundle se veían sólo la barra y el pie, y después todo
 * saltaba: CLS 1,0 en /sobre-mi.
 *
 * `prerender.mjs` renderiza sin límite de bloque y dos veces por página (la
 * primera resuelve los lazy). Este test hace lo mismo que el script —compilar
 * App.jsx con esbuild y renderizar con react-dom/static— y verifica que salga
 * con el contenido a la vista, portada incluida. Sin build: compila sólo el árbol
 * de React, en un archivo temporal que borra al terminar.
 */

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

const compilarApp = async () => {
  const esbuild = require("esbuild");
  const salida = path.join(RAIZ, `.prerender-test-${process.pid}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(RAIZ, "src/App.jsx")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: salida,
    jsx: "automatic",
    external: ["react", "react-dom", "react-dom/server", "react-router-dom"],
    loader: { ".css": "empty", ".png": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
    logLevel: "silent",
  });
  try {
    return (await import(`file://${salida}?t=${Date.now()}`)).default;
  } finally {
    fs.rmSync(salida, { force: true });
  }
};

const html = async (elemento) => {
  const { prerenderToNodeStream } = await import("react-dom/static");
  const { prelude } = await prerenderToNodeStream(elemento, { progressiveChunkSize: Number.POSITIVE_INFINITY });
  let texto = "";
  for await (const trozo of prelude) texto += trozo;
  return texto;
};

test("la segunda pasada del prerender sale con el contenido a la vista", async () => {
  const React = await import("react");
  const { StaticRouter } = await import("react-router");
  const App = await compilarApp();
  const pagina = (ruta) => React.createElement(StaticRouter, { location: ruta }, React.createElement(App));

  for (const ruta of ["/", "/sobre-mi", "/materias", "/como-trabajo", "/contacto", "/privacidad"]) {
    await html(pagina(ruta)); // la pasada que resuelve los lazy
    const segunda = await html(pagina(ruta));
    assert.doesNotMatch(segunda, /<div hidden id="S:|<template id="B:/, `${ruta}: quedó un Suspense sin resolver`);
    assert.doesNotMatch(segunda, /<script[\s>]/, `${ruta}: el contenido trae un <script> que la CSP bloquearía`);
    assert.match(segunda, /<h1[\s>]/, `${ruta}: salió sin <h1>`);
  }
});

test("prerender.mjs usa las dos pasadas y la red que rompe el build", () => {
  const fuente = fs.readFileSync(path.join(RAIZ, "prerender.mjs"), "utf8");
  assert.match(fuente, /const renderizarPagina = async/);
  assert.match(fuente, /verificarSinSuspenso\(markup, ruta\)/);
  assert.match(fuente, /await renderizar\(elemento\(\), ruta\);\s*const markup = await renderizar\(elemento\(\), ruta\);/);
  assert.match(fuente, /progressiveChunkSize: Number\.POSITIVE_INFINITY/);
});
