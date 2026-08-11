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

const construirHead = ({ title, description, url, imagen, jsonLd }) => {
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
    <meta property="og:image:width" content="1536" />
    <meta property="og:image:height" content="1024" />
    <meta property="og:image:alt" content="Tu Profesor Particular · Agustín Elías Sosa" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${imagen}" />
    <script type="application/ld+json">${jsonLd}</script>`;
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
  const plantilla = fs.readFileSync(path.join(DIST, "index.html"), "utf8");

  const { META_POR_RUTA, META_404, IMAGEN_POR_DEFECTO, urlDe } = await compilarModulo(
    path.join(__dirname, "src/data/meta.js"),
  );
  const { construirGrafo } = await compilarModulo(
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

  const renderizar = async (elemento) => {
    const { prelude } = await prerenderToNodeStream(elemento);
    let html = "";
    for await (const trozo of prelude) html += trozo;
    return html;
  };
  /* En react-router 7 el StaticRouter vive en `react-router`, no en
     `react-router-dom/server` como en v6: ese subpath ya no existe. */
  const { StaticRouter } = await import("react-router");
  const { default: App } = await compilarModulo(path.join(__dirname, "src/App.jsx"));

  const jsonLd = JSON.stringify(construirGrafo());
  const rutas = Object.keys(META_POR_RUTA);
  const generadas = [];

  for (const ruta of rutas) {
    const markup = await renderizar(
      React.createElement(
        StaticRouter,
        { location: ruta },
        React.createElement(App),
      ),
    );

    const { title, description } = META_POR_RUTA[ruta];
    let html = plantilla.replace(
      '<div id="root"></div>',
      `<div id="root">${markup}</div>`,
    );

    /* Se reemplaza todo el bloque entre el viewport y el cierre del head: la
       plantilla trae los metadatos de la portada y quedarían duplicados. */
    html = html.replace(/<title>[\s\S]*?<\/head>/, `${construirHead({
      title,
      description,
      url: urlDe(ruta),
      imagen: IMAGEN_POR_DEFECTO,
      jsonLd,
    })}\n  </head>`);

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
  const markup404 = await renderizar(
    React.createElement(
      StaticRouter,
      // Cualquier ruta inexistente cae en la <Route path="*"> del App.
      { location: "/404" },
      React.createElement(App),
    ),
  );
  let html404 = plantilla.replace(
    '<div id="root"></div>',
    `<div id="root">${markup404}</div>`,
  );
  html404 = html404.replace(
    /<title>[\s\S]*?<\/head>/,
    `${construirHead404(META_404)}\n  </head>`,
  );
  fs.writeFileSync(path.join(DIST, "404.html"), html404);
  generadas.push(`(no encontrado) → 404.html (${Math.round(html404.length / 1024)} KB)`);

  console.log("Prerender:\n  " + generadas.join("\n  "));
};

main().catch((e) => {
  console.error("Prerender falló:", e.message);
  process.exit(1);
});
