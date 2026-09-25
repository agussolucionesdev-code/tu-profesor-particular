/* Prerender de la PORTADA de turnos, después del build de Vite.
 * Corre como parte de `npm run build` (y por lo tanto en CI y en Vercel).
 *
 * POR QUÉ EXISTE
 *
 * Turnos es una app de React: el HTML que servía Vercel era un <div id="root">
 * vacío, y la portada aparecía recién cuando terminaba de bajar y correr todo el
 * JavaScript. Lighthouse lo medía en un celular medio: el elemento principal
 * (el hero) se pintaba a los ~4 s, siempre detrás del JS. Con la portada ya
 * dibujada en el HTML, se ve apenas llega la página.
 *
 * Sólo la portada: es la que recibe gente nueva desde buscadores y enlaces.
 * /reservar, /portal y el resto siguen siendo la app de siempre, servidas por
 * `app.html` —el HTML vacío original—; si recibieran el index.html
 * prerenderizado, mostrarían la portada un instante antes de su pantalla (ver
 * el rewrite en vercel.json).
 *
 * CÓMO: es el mismo camino que el sitio institucional (web/prerender.mjs), con
 * lo que allá se aprendió midiendo:
 *   · dos pasadas y sin límite de bloque: React 19.2 si no saca el contenido a
 *     un <div hidden> con scripts en línea que la CSP bloquea;
 *   · el CSS de la portada en el <head>: Vite lo separa con el código diferido
 *     y el HTML se pintaría sin estilos (salto de 0,5 medido en el sitio);
 *   · redes que hacen FALLAR el build si algo de eso vuelve.
 * En el navegador React dibuja encima (createRoot) con la portada ya precargada
 * (src/paginas.js): el primer dibujo es igual al HTML y no hay parpadeo.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnv } from "vite";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(RAIZ, "dist");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const leerManifiesto = () => {
  const ruta = path.join(DIST, ".vite", "manifest.json");
  if (!fs.existsSync(ruta)) throw new Error("Falta dist/.vite/manifest.json: vite.config.js tiene que tener build.manifest.");
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
};

/* El mismo límite que usa Vite (build.assetsInlineLimit por defecto): lo que
   pesa menos no sale como archivo, va adentro del JS como data: URI. */
const LIMITE_EN_LINEA = 4096;
const TIPOS = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".gif": "image/gif", ".woff": "font/woff", ".woff2": "font/woff2" };
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Las imágenes importadas tienen que salir con la MISMA URL que usa el bundle
   del navegador (con hash). Se buscan en el manifiesto; si Vite no las listó,
   en dist/assets por nombre exacto más el hash de 8 (sin eso,
   «monogram-light» agarraba también «monogram-light-168»). Las chicas van en
   línea, como hace Vite. Si una grande no aparece, el build falla: un logo roto
   en la portada es peor que no prerenderizar. */
const urlDeRecurso = (manifiesto, absoluta) => {
  const clave = path.relative(RAIZ, absoluta).split(path.sep).join("/");
  if (manifiesto[clave]?.file) return `/${manifiesto[clave].file}`;
  const { name, ext } = path.parse(absoluta);
  if (fs.statSync(absoluta).size < LIMITE_EN_LINEA) {
    return `data:${TIPOS[ext.toLowerCase()]};base64,${fs.readFileSync(absoluta).toString("base64")}`;
  }
  const conHash = new RegExp(`^${escapar(name)}-[\\w-]{8}${escapar(ext)}$`);
  const candidato = fs.readdirSync(path.join(DIST, "assets")).find((f) => conHash.test(f));
  if (!candidato) throw new Error(`No encontré en el build el recurso ${clave}.`);
  return `/assets/${candidato}`;
};

/* Las variables VITE_* salen de los mismos lugares que en el build (los .env y
   el entorno de Vercel): si el HTML dijera otra cosa que la app, un buscador
   leería un enlace que la persona no ve. La URL del backend cae en la misma
   de producción que fija vite.config.js. */
const entornoDelBuild = () => ({
  VITE_BACKEND_URL: "https://tu-profesor-particular-backend.onrender.com",
  ...loadEnv("production", RAIZ, "VITE_"),
  PROD: true,
  DEV: false,
  SSR: true,
  MODE: "production",
  BASE_URL: "/",
});

/* Compila un módulo de src/ para Node. `urlDe` decide qué URL recibe cada
   imagen importada: en el build, la del manifiesto; en el test, cualquiera. */
export const compilar = async (entrada, urlDe) => {
  const salida = path.join(RAIZ, `.prerender-${path.parse(entrada).name}-${process.pid}.mjs`);
  await esbuild.build({
    entryPoints: [entrada],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: salida,
    jsx: "automatic",
    /* Lo que Node resuelve solo. axios en particular: empaquetado para Node
       arrastra require() de CommonJS que un módulo ESM no puede hacer. */
    external: ["react", "react-dom", "react-router", "react-router-dom", "@vercel/analytics", "@vercel/speed-insights", "axios"],
    loader: { ".css": "empty" },
    define: {
      "import.meta.env": JSON.stringify(entornoDelBuild()),
    },
    plugins: [
      {
        name: "recursos-con-hash",
        setup(b) {
          b.onLoad({ filter: /\.(png|jpe?g|webp|avif|svg|gif|woff2?)$/ }, (a) => ({
            contents: `export default ${JSON.stringify(urlDe(a.path))};`,
            loader: "js",
          }));
        },
      },
    ],
    logLevel: "silent",
  });
  try {
    return await import(`${pathToFileURL(salida).href}?t=${Date.now()}`);
  } finally {
    fs.rmSync(salida, { force: true });
  }
};

/* El CSS que generó el código de la portada (y lo que importa), sin el del
   punto de entrada, que ya está en la plantilla. */
const cssDe = (manifiesto, archivo) => {
  const hojas = new Set();
  const vistos = new Set();
  const recorrer = (clave) => {
    if (vistos.has(clave)) return;
    vistos.add(clave);
    const entrada = manifiesto[clave];
    if (!entrada) throw new Error(`${clave} no está en el manifiesto de Vite: ¿se movió la portada?`);
    if (entrada.isEntry) return;
    for (const hoja of entrada.css ?? []) hojas.add(hoja);
    for (const importado of entrada.imports ?? []) recorrer(importado);
  };
  recorrer(archivo);
  return [...hojas];
};

/* Las redes. Cada una existe porque su ausencia produjo alguna vez un
   resultado falso en este repo (ver web/prerender.mjs). */
export const verificar = (markup) => {
  if (/<script[\s>]|<div hidden id="S:|<template id="B:/.test(markup)) {
    throw new Error("La portada salió con un Suspense sin resolver o un <script> en línea: la CSP lo bloquearía.");
  }
  if (/brand-loader/.test(markup)) throw new Error("La portada salió con el cargador en vez del contenido.");
  if (!/<h1[\s>]/.test(markup)) throw new Error("La portada salió sin <h1>, o sea sin contenido.");
};

/* La portada como la ve quien llega a "/". Dos pasadas: la primera resuelve
   los lazy y se descarta. */
export const renderizarPortada = async (App) => {
  const React = await import("react");
  const { StaticRouter } = await import("react-router");
  const { prerenderToNodeStream } = await import("react-dom/static");
  const errores = [];
  const renderizar = async () => {
    const { prelude } = await prerenderToNodeStream(
      React.createElement(App, { enrutador: StaticRouter, routerProps: { location: "/" } }),
      { progressiveChunkSize: Number.POSITIVE_INFINITY, onError: (e) => errores.push(e) },
    );
    let html = "";
    for await (const trozo of prelude) html += trozo;
    return html;
  };
  await renderizar();
  const markup = await renderizar();
  if (errores.length) throw new Error(`Falló el render de la portada: ${errores.map((e) => e.message).join(" | ")}`);
  verificar(markup);
  return markup;
};

const main = async () => {
  const plantilla = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  if (!plantilla.includes('<div id="root"></div>')) throw new Error("dist/index.html no trae el <div id=\"root\"></div> vacío.");
  const manifiesto = leerManifiesto();
  const urlDe = (absoluta) => urlDeRecurso(manifiesto, absoluta);

  /* El HTML vacío original queda para el resto de las rutas. */
  fs.writeFileSync(path.join(DIST, "app.html"), plantilla);

  const { default: App } = await compilar(path.join(RAIZ, "src/App.jsx"), urlDe);
  const { construirGrafo } = await compilar(path.join(RAIZ, "src/components/seo/grafoEstructurado.js"), urlDe);
  const markup = await renderizarPortada(App);
  const hojas = cssDe(manifiesto, "src/pages/HomePage.jsx")
    .map((h) => `    <link rel="stylesheet" crossorigin href="/${h}">`)
    .join("\n");
  const grafo = JSON.stringify(construirGrafo("/")).replace(/</g, "\\u003c");
  /* Con función y no con texto: en un reemplazo de texto, un «$&» o un «$'»
     del contenido (un precio, por ejemplo) se interpretaría como patrón. */
  const html = plantilla
    /* data-prerender: main.jsx hidrata sólo si coincide con la ruta. */
    .replace('<div id="root"></div>', () => `<div id="root" data-prerender="/">${markup}</div>`)
    .replace(
      "</head>",
      () => `${hojas}\n    <script type="application/ld+json" id="json-ld-structured-data">${grafo}</script>\n  </head>`,
    );
  if (!/<link[^>]+rel="stylesheet"/.test(html) || !/<script[^>]+type="module"[^>]+src=/.test(html)) {
    throw new Error("El index.html prerenderizado quedó sin el CSS o el JS del bundle.");
  }
  fs.writeFileSync(path.join(DIST, "index.html"), html);

  /* El manifiesto sólo le sirve a este script: no se publica. */
  fs.rmSync(path.join(DIST, ".vite"), { recursive: true, force: true });
  console.log(`Prerender de la portada: ${Math.round(html.length / 1024)} KB, ${hojas.split("\n").filter(Boolean).length} hojas propias.`);
};

/* Sólo corre cuando se lo llama (`node prerender.mjs`); el test importa las
   piezas sin disparar el build. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error("Prerender falló:", e.message);
    process.exit(1);
  });
}
