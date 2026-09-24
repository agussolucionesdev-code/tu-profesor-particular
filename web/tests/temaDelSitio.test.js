import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

/* EL SITIO TIENE UN BOTÓN DE TEMA: CLARO U OSCURO.
 *
 * Lo pidió Agustín. Si la persona no elige nada, el sitio sigue al sistema;
 * si elige, la elección gana y se recuerda.
 *
 * Hay dos piezas que tienen que decidir lo mismo:
 *
 *   public/tema.js       corre antes de pintar y pone `data-theme` en <html>.
 *   src/hooks/useTema.js lo lee de ahí, escucha al sistema y guarda la elección.
 *
 * Si una guardara con una clave y la otra leyera con otra, la elección se
 * perdería en cada visita; si el script no corriera antes de pintar, quien
 * eligió oscuro vería la página blanca un instante. Esto lo fija.
 */

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const tema = leer("../public/tema.js");
const hook = leer("../src/hooks/useTema.js");
const html = leer("../index.html");

/* Ejecuta tema.js de verdad, con un <html>, un localStorage y un sistema
   falsos, y devuelve lo que dejó escrito. */
const correr = ({ guardado, sistemaOscuro = false, sinAlmacenamiento = false }) => {
  const dataset = {};
  const clases = new Set();
  const window = {
    localStorage: {
      getItem: (k) => {
        if (sinAlmacenamiento) throw new Error("bloqueado");
        return k === "tpp-tema" ? guardado ?? null : null;
      },
    },
    matchMedia: (q) => ({ matches: q.includes("dark") && sistemaOscuro }),
  };
  vm.runInNewContext(tema, { window, document: { documentElement: { dataset, classList: { add: (c) => clases.add(c) } } } });
  assert.ok(clases.has("js"), "tema.js tiene que marcar que hay JavaScript");
  return dataset;
};

test("sin elección, sigue al sistema", () => {
  assert.deepEqual(correr({ sistemaOscuro: false }), { theme: "light", themePreference: "system" });
  assert.deepEqual(correr({ sistemaOscuro: true }), { theme: "dark", themePreference: "system" });
});

test("lo elegido gana al sistema", () => {
  assert.equal(correr({ guardado: "dark", sistemaOscuro: false }).theme, "dark");
  assert.equal(correr({ guardado: "light", sistemaOscuro: true }).theme, "light");
});

test("un valor roto o el almacenamiento bloqueado caen al sistema", () => {
  assert.deepEqual(correr({ guardado: "violeta", sistemaOscuro: true }), { theme: "dark", themePreference: "system" });
  assert.deepEqual(correr({ sinAlmacenamiento: true, sistemaOscuro: true }), { theme: "dark", themePreference: "system" });
});

test("el script y el hook usan la misma clave", () => {
  assert.match(tema, /getItem\("tpp-tema"\)/);
  assert.match(hook, /export const CLAVE_TEMA = "tpp-tema"/);
  assert.match(hook, /localStorage\.setItem\(CLAVE_TEMA/);
});

test("el script corre antes de pintar", () => {
  /* En el <head>, antes del bundle, y sin defer ni async ni type=module: los
     tres lo mandarían a después del parseo. En archivo y no en línea porque la
     CSP del sitio es script-src 'self'. */
  const head = html.slice(0, html.indexOf("</head>"));
  const etiqueta = head.match(/<script[^>]*src="\/tema\.js"[^>]*><\/script>/);
  assert.ok(etiqueta, "index.html no carga /tema.js en el <head>");
  assert.doesNotMatch(etiqueta[0], /defer|async|type="module"/);
  assert.ok(html.indexOf("/tema.js") < html.indexOf("/src/main.jsx"));
});

test("ninguna hoja depende de prefers-color-scheme", () => {
  /* La media query no se entera del botón: una regla colgada de ahí quedaría
     en oscuro con el sitio en claro. Todo el oscuro va por [data-theme]. */
  const hojas = readdirSync(new URL("../src/", import.meta.url), { recursive: true, encoding: "utf8" })
    .filter((r) => r.endsWith(".css"))
    .map((r) => r.replace(/\\/g, "/"));
  const conMedia = hojas.filter((r) => /prefers-color-scheme/.test(sinComentarios(leer(`../src/${r}`))));
  assert.deepEqual(conMedia, [], `hojas que todavía usan la media query:\n  ${conMedia.join("\n  ")}`);
});

test("el botón dice qué va a hacer, en la barra y en el menú", () => {
  const nav = leer("../src/components/SiteNav.jsx");
  assert.match(nav, /aria-label=\{oscuro \? "Cambiar a modo claro" : "Cambiar a modo oscuro"\}/);
  assert.match(nav, /<BotonTema variante="barra"/);
  assert.match(nav, /<BotonTema variante="menu"/);
});
