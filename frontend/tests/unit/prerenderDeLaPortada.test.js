import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ARRANQUE,
  TEMA,
  arrancarDespuesDelPintado,
  compilar,
  hashCsp,
  precargarPantalla,
  incrustarTema,
  recursosDe,
  renderizarPortada,
  textoEnLinea,
  verificar,
  verificarCsp,
} from "../../prerender.mjs";

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

/* PINTAR ANTES DEL JAVASCRIPT (septiembre de 2026, medido en producción).
 *
 * Con el HTML ya dibujado, la portada igual tardaba en verse: tema.js era un
 * archivo sincrónico en el <head> (un viaje de red antes de pintar) y el bundle
 * llegaba antes de terminar de leer el HTML y se ejecutaba ahí mismo, una
 * tarea de ~240 ms sin limitar el CPU, antes del primer pintado. */

const CABEZA_DE_VITE = `<head>
    <script src="/tema.js"></script>
    <script type="module" crossorigin src="/assets/index-AAAA1111.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-react-BBBB2222.js">
    <link rel="stylesheet" crossorigin href="/assets/index-CCCC3333.css">
  </head>`;

test("tema.js va en línea, tal cual el archivo", () => {
  const html = incrustarTema(CABEZA_DE_VITE);
  assert.doesNotMatch(html, /src="\/tema\.js"/);
  assert.ok(html.includes(`<script>${textoEnLinea(TEMA)}</script>`));
  assert.throws(() => incrustarTema("<head></head>"), /tema\.js/);
});

test("en la portada el bundle se precarga y arranca después del primer pintado", () => {
  const html = arrancarDespuesDelPintado(CABEZA_DE_VITE, [
    "/assets/HomePage-DDDD4444.js",
    "/assets/vendor-react-BBBB2222.js",
  ]);
  assert.doesNotMatch(html, /<script type="module"/);
  assert.match(html, /<link rel="modulepreload" crossorigin href="\/assets\/index-AAAA1111\.js" id="arranque-app">/);
  /* Los módulos de la portada también, para que la hidratación no espere la
     red; lo que Vite ya precargaba no se repite. */
  assert.match(html, /<link rel="modulepreload" crossorigin href="\/assets\/HomePage-DDDD4444\.js">/);
  assert.equal(html.match(/vendor-react-BBBB2222/g).length, 1);
  /* El arranque lee el enlace: tiene que ir después. */
  const arranque = html.indexOf(`<script>${textoEnLinea(ARRANQUE)}</script>`);
  assert.ok(arranque > html.indexOf('id="arranque-app"'));
  assert.throws(() => arrancarDespuesDelPintado("<head></head>"), /bundle/);
});

test("la CSP autoriza exactamente esos dos scripts en línea, por hash", () => {
  const vercel = JSON.parse(leer("vercel.json"));
  assert.doesNotThrow(() => verificarCsp(vercel));
  const csp = vercel.headers.flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy").value;
  const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
  assert.doesNotMatch(scriptSrc, /unsafe-inline/, "con 'unsafe-inline' la CSP no protegería nada");
  assert.equal(scriptSrc.match(/'sha256-/g).length, 2);

  /* Si falta, el build falla diciendo qué hash poner. */
  const sinHashes = { headers: [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: "script-src 'self'" }] }] };
  assert.throws(
    () => verificarCsp(sinHashes),
    (error) => error.message.includes(hashCsp(textoEnLinea(TEMA))),
  );
});

test("el hash no depende de los saltos de línea de la máquina", () => {
  /* En Windows git deja CRLF, en el CI y en Vercel LF: sin normalizar, el hash
     calculado acá no sería el que ve el navegador. */
  const carpeta = mkdtempSync(path.join(tmpdir(), "hash-"));
  try {
    writeFileSync(path.join(carpeta, "crlf.js"), "var a = 1;\r\nvar b = 2;\r\n");
    writeFileSync(path.join(carpeta, "lf.js"), "var a = 1;\nvar b = 2;\n");
    assert.equal(
      hashCsp(textoEnLinea(path.join(carpeta, "crlf.js"))),
      hashCsp(textoEnLinea(path.join(carpeta, "lf.js"))),
    );
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});

test("recursosDe junta el CSS y los módulos de la portada, sin los del punto de entrada", () => {
  const manifiesto = {
    "index.html": { file: "assets/index-A.js", isEntry: true, css: ["assets/index-A.css"] },
    "src/pages/HomePage.jsx": {
      file: "assets/HomePage-B.js",
      isDynamicEntry: true,
      imports: ["index.html", "_compartido-C.js"],
      css: ["assets/HomePage-B.css"],
    },
    "_compartido-C.js": { file: "assets/compartido-C.js", css: ["assets/compartido-C.css"] },
  };
  assert.deepEqual(recursosDe(manifiesto, "src/pages/HomePage.jsx"), {
    hojas: ["assets/HomePage-B.css", "assets/compartido-C.css"],
    modulos: ["assets/HomePage-B.js", "assets/compartido-C.js"],
  });
});

/* /reservar BAJA EL KIOSCO DESDE EL HTML (reservar.html).
 *
 * Con red limitada de verdad, el pedido del código del kiosco salía a los
 * ~3,2 s: recién cuando React dibujaba la pantalla. Precargado en el HTML sale
 * junto con el bundle. */

test("precargarPantalla suma los módulos y el CSS de la pantalla, sin repetir y sin frenar el pintado", () => {
  const html = precargarPantalla(CABEZA_DE_VITE, {
    modulos: ["/assets/BookingKiosk-EEEE5555.js", "/assets/vendor-react-BBBB2222.js"],
    hojas: ["/assets/BookingKiosk-FFFF6666.css"],
  });
  assert.match(html, /<link rel="modulepreload" crossorigin href="\/assets\/BookingKiosk-EEEE5555\.js">/);
  assert.equal(html.match(/vendor-react-BBBB2222/g).length, 1, "lo que Vite ya precargaba no se repite");
  /* preload y no stylesheet: una hoja en el <head> frenaría el primer pintado
     de la barra, que en /reservar es lo primero que se ve. */
  assert.match(html, /<link rel="preload" as="style" crossorigin href="\/assets\/BookingKiosk-FFFF6666\.css">/);
  assert.doesNotMatch(html, /rel="stylesheet"[^>]+BookingKiosk/);
  /* El bundle sigue arrancando como siempre. */
  assert.match(html, /<script type="module" crossorigin src="\/assets\/index-AAAA1111\.js"><\/script>/);
  assert.throws(() => precargarPantalla(CABEZA_DE_VITE, {}), /nada que precargar/);
});

test("Vercel sirve reservar.html en /reservar, antes del comodín", () => {
  const { rewrites } = JSON.parse(leer("vercel.json"));
  const reservar = rewrites.findIndex((r) => r.source === "/reservar");
  assert.ok(reservar >= 0, "falta el rewrite de /reservar");
  assert.equal(rewrites[reservar].destination, "/reservar.html");
  assert.ok(reservar < rewrites.length - 1, "después del comodín no se usaría nunca");
  assert.match(leer("prerender.mjs"), /fs\.writeFileSync\(path\.join\(DIST, "reservar\.html"\), reservar\)/);
});
