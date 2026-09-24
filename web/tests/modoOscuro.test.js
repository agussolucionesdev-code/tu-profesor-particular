import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

/* EL SITIO INSTITUCIONAL TIENE MODO OSCURO.
 *
 * No tenía: cero reglas. Quien usa el teléfono o la computadora en oscuro
 * —medido: la máquina de Agustín lo está— recibía una página blanca a las once
 * de la noche, justo cuando una familia se sienta a resolver lo de la escuela.
 *
 * Desde septiembre de 2026 tiene además un botón para elegir claro u oscuro.
 * Por eso el tema ya no cuelga de `prefers-color-scheme` —la media query no se
 * entera del botón— sino de `[data-theme="dark"]`, que `public/tema.js` pone
 * antes de pintar: lo elegido o, si no se eligió nada, lo que diga el sistema.
 * El contrato del botón lo cuida tests/temaDelSitio.test.js.
 *
 * La paleta sale del monograma oscuro oficial: letras blancas y arco verde
 * sobre azul marino.
 */

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const base = leer("../src/styles/base.css");

const hojas = readdirSync(new URL("../src/", import.meta.url), { recursive: true, encoding: "utf8" })
  .filter((r) => r.endsWith(".css"))
  .map((r) => r.replace(/\\/g, "/"));

const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/* ── aritmética de contraste, WCAG 2.x ─────────────────────────────── */
const luminancia = (hex) => {
  const c = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255);
  const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/* Las variables del bloque oscuro, leídas del CSS real y no copiadas acá: si
   alguien cambia un color, este test mide el color nuevo. */
const bloqueOscuro = () => {
  const s = sinComentarios(base);
  const rootIni = s.indexOf(':root[data-theme="dark"]');
  assert.ok(rootIni >= 0, 'falta el bloque :root[data-theme="dark"] en base.css');
  const rootFin = s.indexOf("}", rootIni);
  return Object.fromEntries(
    [...s.slice(rootIni, rootFin).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
  );
};

test("hay un modo oscuro completo", () => {
  const v = bloqueOscuro();
  for (const k of ["white", "off", "text", "muted", "green-ink", "navy-800"]) {
    assert.ok(v[k], `el modo oscuro no redefine --${k}`);
  }
  /* Sin esto los controles nativos —barras de desplazamiento, autocompletado,
     el selector de fecha— siguen claros sobre una página oscura. */
  assert.match(sinComentarios(base), /:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark/);
});

test("el botón principal cambia de par con el tema y se lee en los dos", () => {
  /* En oscuro, el verde de fondo #006d1f sobre azul noche quedaba apagado, casi
     del color de la página. Se invierte a verde claro con tinta navy. Fondo y
     tinta son un PAR: cambiar uno sin el otro da blanco sobre verde claro. */
  const s = sinComentarios(base);
  const raiz = s.slice(s.indexOf(":root"), s.indexOf("}", s.indexOf(":root")));
  const claro = Object.fromEntries([...raiz.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  const oscuro = bloqueOscuro();
  for (const [tema, v] of [["claro", claro], ["oscuro", oscuro]]) {
    for (const fondo of ["cta-bg", "cta-bg-hover"]) {
      const r = contraste(v["cta-ink"], v[fondo]);
      assert.ok(r >= 4.5, `${tema}: --cta-ink sobre --${fondo} da ${r.toFixed(2)}:1`);
    }
  }
  /* Y los botones lo usan: ninguno vuelve al blanco fijo sobre --green. */
  for (const [hoja, selector] of [
    ["styles/base.css", ".btn--primary"],
    ["components/SiteNav.css", ".snav-cta"],
    ["components/ContactForm.css", ".cf-enviar"],
    ["pages/Contact.css", ".ct-primary-cta"],
  ]) {
    const css = sinComentarios(leer(`../src/${hoja}`));
    const i = css.indexOf(`${selector} {`);
    const regla = css.slice(i, css.indexOf("}", i));
    assert.match(regla, /background:\s*var\(--cta-bg\)/, `${selector} no usa --cta-bg`);
    assert.match(regla, /color:\s*var\(--cta-ink\)/, `${selector} no usa --cta-ink`);
  }
});

test("todo el texto del modo oscuro se lee, sobre cada fondo", () => {
  const v = bloqueOscuro();
  const fondos = { pagina: v.white, suave: v.off, seccionOscura: v["navy-800"] };
  const textos = { texto: v.text, secundario: v.muted, verde: v["green-ink"] };
  const fallas = [];
  for (const [nt, t] of Object.entries(textos)) {
    for (const [nf, f] of Object.entries(fondos)) {
      const r = contraste(t, f);
      if (r < 4.5) fallas.push(`${nt} ${t} sobre ${nf} ${f}: ${r.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(fallas, [], `pares por debajo de 4,5:1:\n  ${fallas.join("\n  ")}`);
});

test("el verde de texto es una variable propia y no el de los botones", () => {
  /* `--green` pinta el FONDO de seis botones, con texto blanco encima, y el
     TEXTO de veintiún títulos y enlaces. Si el modo oscuro lo aclaraba para los
     textos, los botones quedaban con blanco sobre verde claro: 1,9:1. Por eso
     el texto verde usa `--green-ink`, que el modo oscuro cambia, y los fondos
     siguen en `--green`, que no cambia. */
  const conGreenComoTexto = [];
  for (const r of hojas) {
    const s = sinComentarios(leer(`../src/${r}`));
    /* Cualquier verde de FONDO, no sólo `--green`: la primera versión de este
       test miraba una sola variable y el barrido en pantalla encontró los
       números de pasos de «Sobre mí» en `--green-deep`, a 2,13:1 sobre el
       fondo oscuro. */
    for (const m of s.matchAll(/(^|[;{\s])color:\s*var\(--green(-deep|-brand)?\)/g)) conGreenComoTexto.push(`${r}: ${m[0].trim()}`);
  }
  assert.deepEqual(conGreenComoTexto, [], `texto que todavía usa --green:\n  ${conGreenComoTexto.join("\n  ")}`);
  assert.ok(contraste("#ffffff", "#006d1f") >= 4.5, "blanco sobre el verde de los botones");
});

test("el monograma de la barra tiene su versión para fondo oscuro", () => {
  /* Dos archivos transparentes y el CSS elige por `data-theme`. Un <picture>
     con `prefers-color-scheme` —lo que había— no se entera del botón: con el
     sistema en claro y el sitio en oscuro mostraba el trazo navy sobre azul. */
  const nav = leer("../src/components/SiteNav.jsx");
  const css = sinComentarios(leer("../src/components/SiteNav.css"));
  assert.match(nav, /src="\/marca-claro\.webp"/);
  assert.match(nav, /src="\/marca-oscuro\.webp"/);
  assert.doesNotMatch(sinComentarios(nav).replace(/\{\/\*[\s\S]*?\*\/\}/g, ""), /prefers-color-scheme/);
  assert.match(css, /\[data-theme="dark"\] \.snav-mark--claro/);
  assert.match(css, /\[data-theme="dark"\] \.snav-mark--oscuro\s*\{\s*display:\s*block/);
  for (const f of ["marca-claro.webp", "marca-oscuro.webp"]) {
    assert.ok(existsSync(new URL(`../public/${f}`, import.meta.url)), `falta public/${f}`);
  }
});

test("los campos del formulario se ven y se leen en los dos temas", () => {
  /* Los campos tenían `background: #fff` escrito a mano. En oscuro el texto,
     que sí sigue al tema, quedaba casi blanco sobre blanco: lo que alguien
     escribía era invisible. El barrido de contraste en pantalla NO lo encontró,
     porque mide nodos de texto y el valor de un <input> no lo es. Por eso se
     fija acá, con la aritmética. */
  const s = sinComentarios(base);
  const raiz = s.slice(s.indexOf(":root"), s.indexOf("}", s.indexOf(":root")));
  const claro = Object.fromEntries([...raiz.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  const oscuro = bloqueOscuro();

  for (const [tema, v] of [["claro", claro], ["oscuro", oscuro]]) {
    assert.ok(v["field-bg"] && v["field-border"], `faltan las variables de campo en ${tema}`);
    const texto = contraste(v.text, v["field-bg"]);
    const ayuda = contraste(v.muted, v["field-bg"]);
    const borde = contraste(v["field-border"], v["field-bg"]);
    assert.ok(texto >= 4.5, `${tema}: texto escrito ${texto.toFixed(2)}:1`);
    assert.ok(ayuda >= 4.5, `${tema}: placeholder ${ayuda.toFixed(2)}:1`);
    assert.ok(borde >= 3, `${tema}: contorno del campo ${borde.toFixed(2)}:1 (WCAG 1.4.11 pide 3:1)`);
  }

  const form = sinComentarios(leer("../src/components/ContactForm.css"));
  assert.match(form, /\.cf-input\s*\{[^}]*background:\s*var\(--field-bg\)/);
});
