import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

/* UNA PÁGINA PRECARGADA SE DIBUJA SIN SUSPENDER.
 *
 * Es la garantía que evita el CLS 1 de /sobre-mi y /materias (ver
 * src/paginas.js): main.jsx precarga la página actual antes del primer dibujo,
 * y ese dibujo no puede pasar por el Suspense. `renderToString` no espera a
 * nada: si algo suspende, devuelve el fallback o falla. Así que si esto pasa,
 * el primer cuadro de React es la página entera. */

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

test("después de precargar(), cada página interna se dibuja de un tirón", async () => {
  const salida = path.join(RAIZ, `.paginas-test-${process.pid}.mjs`);
  await require("esbuild").build({
    entryPoints: [path.join(RAIZ, "src/paginas.js")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: salida,
    jsx: "automatic",
    external: ["react", "react-dom", "react-dom/server", "react-router-dom"],
    loader: { ".css": "empty", ".png": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
    logLevel: "silent",
  });
  let paginas;
  try {
    paginas = await import(`file://${salida}?t=${Date.now()}`);
  } finally {
    fs.rmSync(salida, { force: true });
  }
  const React = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { StaticRouter } = await import("react-router");

  for (const [ruta, nombre] of [["/sobre-mi", "About"], ["/materias", "Subjects"], ["/como-trabajo", "Method"], ["/contacto", "Contact"], ["/privacidad", "Privacy"]]) {
    await paginas.precargarPagina(ruta);
    const html = renderToString(
      React.createElement(StaticRouter, { location: ruta }, React.createElement(paginas[nombre])),
    );
    assert.match(html, /<h1[\s>]/, `${ruta}: no se dibujó entera después de precargar`);
  }
});
