/* Prerender de las rutas estáticas, después del build de Vite.
   Se ejecuta como parte de `npm run build`.

   POR QUÉ EXISTE
   El sitio es una SPA: el HTML que sirve Vercel es un <div id="root"> vacío y
   todo lo demás lo arma JavaScript. Los bots de WhatsApp, Facebook, Instagram
   y LinkedIn NO ejecutan JavaScript, así que veían siempre lo mismo: el título
   y la descripción de la portada, sin importar qué enlace se compartiera. Para
   un negocio cuyo canal principal es WhatsApp, eso es el problema de difusión
   más caro que tenía el sitio.

   Google sí ejecuta JS, pero lo hace en una segunda pasada y con presupuesto
   limitado; recibir el contenido en el HTML es estrictamente mejor.

   CÓMO
   Se renderiza cada ruta con react-dom/static, se inyecta el markup dentro del
   #root del index.html ya construido y se reemplazan las etiquetas del <head>
   por las de esa ruta. Los textos salen de src/data/meta.js, el mismo módulo
   que usa el hook en el navegador: no hay dos copias que puedan divergir.

   No usa Puppeteer a propósito: bajar un Chromium para renderizar cinco páginas
   estáticas agrega minutos al CI y una dependencia enorme para algo que React
   resuelve en milisegundos.

   LÍMITE CONOCIDO
   Los efectos no corren al renderizar fuera del navegador, así que ni los
   metadatos ni el JSON-LD salen del componente: los dos se inyectan acá, leyendo
   los mismos módulos de datos. Y los elementos con data-reveal quedan en su
   estado inicial; eso no afecta a los bots —leen el markup, no la pintura— y en
   el navegador el reveal los muestra igual al hidratar. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist");
const require = createRequire(import.meta.url);

/* Registro para poder importar JSX y CSS desde Node: el build de Vite ya
   generó los assets, acá sólo hace falta ejecutar los componentes. */
const esbuild = require("esbuild");

const compilarModulo = async (entrada) => {
  const salida = path.join(__dirname, ".prerender-tmp.mjs");
  await esbuild.build({
    entryPoints: [entrada],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: salida,
    jsx: "automatic",
    /* React se resuelve desde node_modules; el CSS no aporta nada al HTML y
       se descarta para que Node no intente interpretarlo. */
    external: ["react", "react-dom", "react-dom/server", "react-router-dom"],
    loader: { ".css": "empty", ".png": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
    logLevel: "silent",
  });
  const mod = await import(`file://${salida}?t=${Date.now()}`);
  fs.rmSync(salida, { force: true });
  return mod;
};

const escaparAtributo = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/* Quita SOLO los metadatos que este script vuelve a escribir.
 *
 * Antes esto era un `html.replace(/<title>[\s\S]*?<\/head>/, nuevoHead)`, o sea
 * borraba TODO lo que hubiera entre el <title> y el cierre del head. Y ahí es
 * exactamente donde Vite inyecta el bundle:
 *
 *   <script type="module" crossorigin src="/assets/index-*.js">
 *   <link rel="stylesheet" crossorigin href="/assets/index-*.css">
 *
 * Resultado: el sitio quedó sirviendo HTML sin CSS ni JavaScript. Los bots veían
 * el contenido perfecto —que era lo que yo estaba verificando— y una persona veía
 * la página en blanco y negro, con la navegación como lista de puntos.
 *
 * La lección: verificar lo que se buscaba arreglar no alcanza. Había que verificar
 * también lo que no se quería romper. Para eso está `verificarAssets` más abajo,
 * que hace fallar el build si el bundle no sobrevive. */
const quitarMetadatosViejos = (html) =>
  html
    .replace(/\s*<title>[\s\S]*?<\/title>/gi, "")
    .replace(/\s*<meta\s+name="description"[^>]*>/gi, "")
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/\s*<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/\s*<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/\s*<meta\s+name="robots"[^>]*>/gi, "")
    .replace(/\s*<script\s+type="application\/ld\+json"[\s\S]*?<\/script>/gi, "");

/* El build tiene que FALLAR si el bundle no está en el HTML.
 *
 * Es la red que faltaba. Un prerender que borra el CSS produce un archivo que
 * pasa todas las verificaciones de SEO —título, canonical, h1, contenido— y sirve
 * una página inservible para una persona. Sin este chequeo, el error volvió a
 * producción y estuvo horas ahí. */
const verificarAssets = (html, ruta) => {
  const tieneJs = /<script[^>]+type="module"[^>]+src="[^"]+"/.test(html);
  const tieneCss = /<link[^>]+rel="stylesheet"[^>]+href="[^"]+"/.test(html);
  if (!tieneJs || !tieneCss) {
    throw new Error(
      `${ruta}: el HTML quedó sin ${[!tieneJs && "JavaScript", !tieneCss && "CSS"]
        .filter(Boolean)
        .join(" ni ")}. El prerender no debe tocar las etiquetas que inyecta Vite.`,
    );
  }
};

/* El contenido NO puede traer <script>.
 *
 * React 19.2 "saca afuera" todo límite de Suspense de más de ~12 KB para
 * transmitirlo de a partes (opción `progressiveChunkSize`), AUNQUE YA ESTÉ
 * RESUELTO: el contenido sale en un <div hidden> con scripts en línea ($RC,
 * $RV) que lo mueven a su lugar. El <Suspense> de App.jsx envuelve TODAS las
 * rutas, así que le pasaba a todas, portada incluida. La CSP del sitio es
 * `script-src 'self'` y bloquea esos scripts: medido en producción, /sobre-mi
 * mostraba sólo la barra y el pie hasta que llegaba el bundle, y después todo
 * saltaba (CLS 1,0; Lighthouse lo marcó con errores de CSP). El prerender
 * existía y no se veía.
 *
 * El arreglo está en `renderizar` (sin límite de tamaño por bloque) y en
 * `renderizarPagina` (dos pasadas, para los lazy). Esto es la red: si algún
 * día vuelve a aparecer un <script> o un límite de Suspense sin resolver, el
 * build falla en vez de publicar una página que depende de un script bloqueado. */
const verificarSinSuspenso = (markup, ruta) => {
  if (/<script[\s>]|<div hidden id="S:|<template id="B:/.test(markup)) {
    throw new Error(
      `${ruta}: el contenido salió con un Suspense sin resolver o un <script> en línea. ` +
        "La CSP los bloquea y la página se vería vacía hasta que cargue el JS.",
    );
  }
};

/* Precarga de las dos fuentes que pinta la primera pantalla: Fraunces (títulos)
 * e Inter (texto). Sin esto el navegador las descubre recién al leer el CSS, y
 * el título se dibuja primero en Georgia y después salta. Los nombres llevan el
 * hash de Vite, así que se leen de dist/assets; si @fontsource los cambia, el
 * build falla en vez de precargar un archivo que no existe. */
const FUENTES_CRITICAS = [/^fraunces-latin-opsz-normal-[\w-]+\.woff2$/, /^inter-latin-wght-normal-[\w-]+\.woff2$/];

const conPrecargaDeFuentes = (html) => {
  const archivos = fs.readdirSync(path.join(DIST, "assets"));
  const enlaces = FUENTES_CRITICAS.map((patron) => {
    const archivo = archivos.find((a) => patron.test(a));
    if (!archivo) {
      throw new Error(`No encontré la fuente ${patron} en dist/assets: cambió el nombre del archivo de @fontsource.`);
    }
    return `<link rel="preload" href="/assets/${archivo}" as="font" type="font/woff2" crossorigin />`;
  });
  const bloque = enlaces.map((e) => `    ${e}`).join("\n");
  return html.replace("</head>", `${bloque}\n  </head>`);
};

const construirHead = ({ title, description, url, imagen, ancho, alto, jsonLd, idGrafo }) => {
  const t = escaparAtributo(title);
  const d = escaparAtributo(description);
  return `
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="es_AR" />
    <meta property="og:site_name" content="Tu Profesor Particular" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${imagen}" />
    <meta property="og:image:width" content="${ancho}" />
    <meta property="og:image:height" content="${alto}" />
    <meta property="og:image:alt" content="Tu Profesor Particular · Agustín Elías Sosa" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${imagen}" />
    <script type="application/ld+json" id="${idGrafo}">${jsonLd}</script>`;
};

/* El <head> del 404 es distinto al de una página real, y las diferencias
   importan:

   · noindex. Un 404 no se indexa. Sin esto, Google puede llegar a listarlo.
   · Sin canonical. Un canonical declara "esta es la versión buena de esta
     página", y en un 404 eso es una contradicción: le estaría diciendo a Google
     que la página existe.
   · Sin JSON-LD. El grafo describe al negocio y a los cursos; colgarlo de una
     página que no existe no aporta nada y ensucia los datos estructurados.
   · Sin Open Graph. Nadie comparte a propósito un 404, y si se comparte por
     error es mejor que la vista previa quede vacía que que muestre la portada
     como si el enlace funcionara. */
const construirHead404 = ({ title, description }) => `
    <title>${escaparAtributo(title)}</title>
    <meta name="description" content="${escaparAtributo(description)}" />
    <meta name="robots" content="noindex, follow" />`;

const main = async () => {
  const plantilla = conPrecargaDeFuentes(fs.readFileSync(path.join(DIST, "index.html"), "utf8"));

  const { META_POR_RUTA, META_404, IMAGEN_POR_DEFECTO, IMAGEN_ANCHO, IMAGEN_ALTO, urlDe } = await compilarModulo(
    path.join(__dirname, "src/data/meta.js"),
  );
  const { construirGrafo, grafoComoTexto, ID_GRAFO } = await compilarModulo(
    path.join(__dirname, "src/data/structuredData.js"),
  );
  /* prerenderToNodeStream y NO renderToString: las páginas internas se cargan
     con React.lazy, y renderToString no espera a que un Suspense resuelva —
     escribe el fallback y sigue. El resultado eran cinco HTML con el cartel de
     carga en lugar del contenido: prerender de adorno.
     La API de react-dom/static sí espera a que todo resuelva antes de cerrar el
     stream, así que convive con el code splitting. */
  const { prerenderToNodeStream } = await import("react-dom/static");
  const React = await import("react");

  /* onError hace que un fallo de render REVIENTE el build.
   *
   * Sin esto React atrapa el error, devuelve el subárbol vacío y el stream cierra
   * igual: el build termina en verde y publica una página con solo el header y el
   * footer. Es lo que pasó con /contacto —un `import.meta.env` inexistente en
   * Node— y estuvo así en producción sin que ninguna verificación lo notara.
   *
   * Un prerender que falla en silencio es peor que uno que no existe. */
  const renderizar = async (elemento, ruta) => {
    const errores = [];
    const { prelude } = await prerenderToNodeStream(elemento, {
      /* Sin límite: un HTML estático no se transmite de a partes, y partirlo
         exige scripts en línea que la CSP bloquea. Ver `verificarSinSuspenso`. */
      progressiveChunkSize: Number.POSITIVE_INFINITY,
      onError: (error) => errores.push(error),
    });
    let html = "";
    for await (const trozo of prelude) html += trozo;
    if (errores.length > 0) {
      throw new Error(
        `${ruta}: falló el render — ${errores.map((e) => e.message).join(" | ")}`,
      );
    }
    return html;
  };

  /* Y una segunda red, por si algún día un componente devuelve vacío sin lanzar:
     lo que se publica tiene que tener contenido de verdad. El h1 es el marcador
     más simple y no ambiguo —toda página del sitio tiene exactamente uno—. */
  const verificarContenido = (html, ruta) => {
    if (!/<h1[\s>]/.test(html)) {
      throw new Error(`${ruta}: el HTML salió sin <h1>, o sea sin contenido.`);
    }
  };
  /* En react-router 7 el StaticRouter vive en `react-router`, no en
     `react-router-dom/server` como en v6: ese subpath ya no existe. */
  const { StaticRouter } = await import("react-router");
  const { default: App } = await compilarModulo(path.join(__dirname, "src/App.jsx"));

  /* DOS PASADAS POR PÁGINA. En la primera, cada React.lazy de la ruta arranca
     su import y el render espera a que resuelva: el resultado trae el
     contenido escondido detrás de un Suspense (ver `verificarSinSuspenso`) y se
     descarta. El lazy queda resuelto en el módulo, así que en la segunda
     pasada la página se renderiza de un tirón, con el contenido a la vista. */
  const renderizarPagina = async (ruta, ubicacion = ruta) => {
    const elemento = () =>
      React.createElement(StaticRouter, { location: ubicacion }, React.createElement(App));
    await renderizar(elemento(), ruta);
    const markup = await renderizar(elemento(), ruta);
    verificarSinSuspenso(markup, ruta);
    return markup;
  };

  const rutas = Object.keys(META_POR_RUTA);
  const generadas = [];

  for (const ruta of rutas) {
    const markup = await renderizarPagina(ruta);

    const { title, description } = META_POR_RUTA[ruta];
    let html = plantilla.replace(
      '<div id="root"></div>',
      `<div id="root">${markup}</div>`,
    );

    /* Se quitan SOLO los metadatos de la portada —si no quedarían duplicados— y
       el bloque nuevo se inserta justo antes de </head>. Todo lo demás que haya
       en el head queda intacto: el bundle, el favicon, las fuentes. */
    html = quitarMetadatosViejos(html).replace(
      "</head>",
      `${construirHead({
        title,
        description,
        url: urlDe(ruta),
        imagen: META_POR_RUTA[ruta].imagen ?? IMAGEN_POR_DEFECTO,
        ancho: IMAGEN_ANCHO,
        alto: IMAGEN_ALTO,
        jsonLd: grafoComoTexto(construirGrafo(ruta)),
        idGrafo: ID_GRAFO,
      })}\n  </head>`,
    );
    verificarAssets(html, ruta);
    verificarContenido(html, ruta);

    const destino =
      ruta === "/"
        ? path.join(DIST, "index.html")
        : path.join(DIST, ruta.replace(/^\//, ""), "index.html");
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, html);
    generadas.push(`${ruta} → ${path.relative(DIST, destino)} (${Math.round(html.length / 1024)} KB)`);
  }

  /* dist/404.html — el archivo que Vercel sirve, con status 404, para cualquier
     ruta que no exista.

     Hace falta porque `cleanUrls` cambió el comportamiento: antes el rewrite
     catch-all mandaba todo al index, así que una ruta inventada devolvía 200 y
     el router del navegador pintaba esta misma pantalla. Malo para Google
     —indexaba páginas que no existen— pero al menos la persona veía una página
     con la marca y un camino de vuelta.

     Con cleanUrls, Vercel resuelve contra el filesystem antes de llegar al
     rewrite y devolvía SU propio 404: 78 bytes de "The page could not be found",
     sin navegación ni forma de volver. Status correcto, experiencia peor.

     Con este archivo se obtienen las dos cosas: 404 de verdad para los bots y la
     pantalla del sitio para la persona. */
  // Cualquier ruta inexistente cae en la <Route path="*"> del App.
  const markup404 = await renderizarPagina("404.html", "/404");
  let html404 = plantilla.replace(
    '<div id="root"></div>',
    `<div id="root">${markup404}</div>`,
  );
  html404 = quitarMetadatosViejos(html404).replace(
    "</head>",
    `${construirHead404(META_404)}\n  </head>`,
  );
  verificarAssets(html404, "404.html");
  verificarContenido(html404, "404.html");
  fs.writeFileSync(path.join(DIST, "404.html"), html404);
  generadas.push(`(no encontrado) → 404.html (${Math.round(html404.length / 1024)} KB)`);

  console.log("Prerender:\n  " + generadas.join("\n  "));
};

main().catch((e) => {
  console.error("Prerender falló:", e.message);
  process.exit(1);
});
