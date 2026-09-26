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
 * el rewrite en vercel.json). /reservar recibe `reservar.html`: el mismo HTML
 * vacío, pero bajando el código del kiosco desde el principio
 * (precargarPantalla).
 *
 * CÓMO: es el mismo camino que el sitio institucional (web/prerender.mjs), con
 * lo que allá se aprendió midiendo:
 *   · dos pasadas y sin límite de bloque: React 19.2 si no saca el contenido a
 *     un <div hidden> con scripts en línea que la CSP bloquea;
 *   · el CSS de la portada en el <head>: Vite lo separa con el código diferido
 *     y el HTML se pintaría sin estilos (salto de 0,5 medido en el sitio);
 *   · redes que hacen FALLAR el build si algo de eso vuelve.
 * En el navegador React HIDRATA ese HTML con la portada ya precargada
 * (src/main.jsx, src/paginas.js): adopta los nodos y no hay parpadeo.
 *
 * Y DOS COSAS PARA QUE SE PINTE ANTES (septiembre de 2026, medido): tema.js va
 * en línea en todas las páginas, y en la portada el bundle se ejecuta después
 * del primer pintado (ver incrustarTema y arrancarDespuesDelPintado).
 */
import { createHash } from "node:crypto";
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

/* El CSS y los módulos JS de la portada (y lo que importa), sin los del punto
   de entrada, que ya están en la plantilla. */
export const recursosDe = (manifiesto, archivo) => {
  const hojas = new Set();
  const modulos = new Set();
  const vistos = new Set();
  const recorrer = (clave) => {
    if (vistos.has(clave)) return;
    vistos.add(clave);
    const entrada = manifiesto[clave];
    if (!entrada) throw new Error(`${clave} no está en el manifiesto de Vite: ¿se movió la portada?`);
    if (entrada.isEntry) return;
    modulos.add(entrada.file);
    for (const hoja of entrada.css ?? []) hojas.add(hoja);
    for (const importado of entrada.imports ?? []) recorrer(importado);
  };
  recorrer(archivo);
  return { hojas: [...hojas], modulos: [...modulos] };
};

/* SCRIPTS EN LÍNEA, AUTORIZADOS POR HASH.
 *
 * La CSP es `script-src 'self'`: un <script> en línea sólo corre si su hash
 * está en vercel.json. El texto se normaliza (saltos de línea LF, sin espacios
 * en los bordes) para que el hash sea el mismo en Windows, en el CI y en
 * Vercel: con CRLF en una máquina y LF en otra, el hash no coincidiría. */
export const TEMA = path.join(RAIZ, "public/tema.js");
export const ARRANQUE = path.join(RAIZ, "scripts/arranque-en-linea.js");

export const textoEnLinea = (archivo) => fs.readFileSync(archivo, "utf8").replace(/\r\n/g, "\n").trim();
export const hashCsp = (texto) => `'sha256-${createHash("sha256").update(texto, "utf8").digest("base64")}'`;

/* Si falta un hash, el build falla y dice cuál poner. */
export const verificarCsp = (vercel) => {
  const csp = vercel.headers
    .flatMap((regla) => regla.headers)
    .find((h) => h.key === "Content-Security-Policy")?.value;
  if (!csp) throw new Error("vercel.json no tiene Content-Security-Policy.");
  const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
  for (const archivo of [TEMA, ARRANQUE]) {
    const hash = hashCsp(textoEnLinea(archivo));
    if (!scriptSrc.includes(hash)) {
      throw new Error(`La CSP de vercel.json no autoriza ${path.relative(RAIZ, archivo)} en línea: agregá ${hash} a script-src.`);
    }
  }
};

/* tema.js EN LÍNEA. Era un archivo cargado de forma sincrónica en el <head>:
   frenaba la lectura del HTML un viaje de red entero antes de poder pintar
   (Lighthouse: ~150 ms en celular). Tiene que correr antes del primer pintado,
   así que va en línea en todas las páginas (index.html y app.html). */
export const incrustarTema = (html) => {
  const etiqueta = '<script src="/tema.js"></script>';
  if (!html.includes(etiqueta)) throw new Error(`dist/index.html no trae ${etiqueta}: ¿cambió la plantilla?`);
  return html.replace(etiqueta, () => `<script>${textoEnLinea(TEMA)}</script>`);
};

/* EN LA PORTADA, EL JS ARRANCA DESPUÉS DEL PRIMER PINTADO (ver
   scripts/arranque-en-linea.js). El <script type="module"> del bundle pasa a
   ser un modulepreload —se descarga igual desde el principio— y se suman los
   módulos de la portada, para que la hidratación no espere la red. */
export const arrancarDespuesDelPintado = (html, modulosDeLaPortada = []) => {
  const bundle = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
  if (!bundle) throw new Error('dist/index.html no trae el <script type="module" crossorigin src="…"> del bundle.');
  const yaPrecargados = new Set([...html.matchAll(/<link rel="modulepreload" crossorigin href="([^"]+)">/g)].map((m) => m[1]));
  const precargas = modulosDeLaPortada
    .filter((href) => !yaPrecargados.has(href))
    .map((href) => `<link rel="modulepreload" crossorigin href="${href}">`);
  return html.replace(bundle[0], () =>
    [
      `<link rel="modulepreload" crossorigin href="${bundle[1]}" id="arranque-app">`,
      ...precargas,
      `<script>${textoEnLinea(ARRANQUE)}</script>`,
    ].join("\n    "),
  );
};

/* UNA PANTALLA QUE BAJA SU CÓDIGO DESDE EL HTML (reservar.html).
 *
 * En las rutas que no se prerenderizan, el código de la pantalla se pedía
 * recién cuando React la dibujaba: HTML → bundle → dibujo → recién ahí el
 * kiosco. Con red limitada de verdad (Lighthouse en modo devtools, septiembre
 * de 2026) ese pedido salía a los ~3,2 s. Precargado en el HTML sale junto con
 * el bundle. Los módulos van como modulepreload y el CSS como preload (no
 * frena el primer pintado): cuando el lazy importa la pantalla, Vite agrega la
 * hoja y el navegador la encuentra ya descargada. */
export const precargarPantalla = (html, { modulos = [], hojas = [] }) => {
  const yaPrecargados = new Set([...html.matchAll(/<link rel="modulepreload" crossorigin href="([^"]+)">/g)].map((m) => m[1]));
  const enlaces = [
    ...modulos.filter((href) => !yaPrecargados.has(href)).map((href) => `<link rel="modulepreload" crossorigin href="${href}">`),
    ...hojas.map((href) => `<link rel="preload" as="style" crossorigin href="${href}">`),
  ];
  if (!enlaces.length) throw new Error("precargarPantalla: no hay nada que precargar (¿cambió el manifiesto?).");
  return html.replace("</head>", () => `    ${enlaces.join("\n    ")}\n  </head>`);
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
  verificarCsp(JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8")));
  const plantilla = incrustarTema(fs.readFileSync(path.join(DIST, "index.html"), "utf8"));
  if (!plantilla.includes('<div id="root"></div>')) throw new Error("dist/index.html no trae el <div id=\"root\"></div> vacío.");
  const manifiesto = leerManifiesto();
  const urlDe = (absoluta) => urlDeRecurso(manifiesto, absoluta);

  /* El HTML vacío original (con tema.js en línea) queda para el resto de las
     rutas. Ahí el bundle arranca como siempre: no hay nada dibujado que
     mostrar antes. */
  fs.writeFileSync(path.join(DIST, "app.html"), plantilla);

  /* /reservar: el mismo HTML vacío, pero bajando el kiosco desde el principio
     (ver precargarPantalla y el rewrite en vercel.json). */
  const kiosco = recursosDe(manifiesto, "src/components/BookingKiosk.jsx");
  const reservar = precargarPantalla(plantilla, {
    modulos: kiosco.modulos.map((m) => `/${m}`),
    hojas: kiosco.hojas.map((h) => `/${h}`),
  });
  fs.writeFileSync(path.join(DIST, "reservar.html"), reservar);

  const { default: App } = await compilar(path.join(RAIZ, "src/App.jsx"), urlDe);
  const { construirGrafo } = await compilar(path.join(RAIZ, "src/components/seo/grafoEstructurado.js"), urlDe);
  const markup = await renderizarPortada(App);
  const portada = recursosDe(manifiesto, "src/pages/HomePage.jsx");
  const hojas = portada.hojas.map((h) => `    <link rel="stylesheet" crossorigin href="/${h}">`).join("\n");
  const grafo = JSON.stringify(construirGrafo("/")).replace(/</g, "\\u003c");
  /* Con función y no con texto: en un reemplazo de texto, un «$&» o un «$'»
     del contenido (un precio, por ejemplo) se interpretaría como patrón. */
  const conPortada = plantilla
    /* data-prerender: main.jsx hidrata sólo si coincide con la ruta. */
    .replace('<div id="root"></div>', () => `<div id="root" data-prerender="/">${markup}</div>`)
    .replace(
      "</head>",
      () => `${hojas}\n    <script type="application/ld+json" id="json-ld-structured-data">${grafo}</script>\n  </head>`,
    );
  const html = arrancarDespuesDelPintado(conPortada, portada.modulos.map((m) => `/${m}`));
  if (!/<link[^>]+rel="stylesheet"/.test(html) || !/<link rel="modulepreload" crossorigin href="[^"]+" id="arranque-app">/.test(html)) {
    throw new Error("El index.html prerenderizado quedó sin el CSS o sin el bundle.");
  }
  if (/<script type="module"/.test(html) || html.includes('src="/tema.js"')) {
    throw new Error("El index.html prerenderizado todavía carga un script que frena el primer pintado.");
  }
  fs.writeFileSync(path.join(DIST, "index.html"), html);

  /* El manifiesto sólo le sirve a este script: no se publica. */
  fs.rmSync(path.join(DIST, ".vite"), { recursive: true, force: true });
  console.log(
    `Prerender de la portada: ${Math.round(html.length / 1024)} KB, ${portada.hojas.length} hojas y ${portada.modulos.length} módulos propios; tema.js en línea en index.html, app.html y reservar.html (${kiosco.modulos.length} módulos y ${kiosco.hojas.length} hojas del kiosco precargados).`,
  );
};

/* Sólo corre cuando se lo llama (`node prerender.mjs`); el test importa las
   piezas sin disparar el build. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error("Prerender falló:", e.message);
    process.exit(1);
  });
}
