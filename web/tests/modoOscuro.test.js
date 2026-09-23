import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

/* EL SITIO INSTITUCIONAL TIENE MODO OSCURO.
 *
 * No tenía: cero reglas. Quien usa el teléfono o la computadora en oscuro
 * —medido: la máquina de Agustín lo está— recibía una página blanca a las once
 * de la noche, justo cuando una familia se sienta a resolver lo de la escuela.
 *
 * Sigue la preferencia del sistema con `prefers-color-scheme`, sin JavaScript:
 * la página prerenderizada ya sale del servidor con el tema correcto y no hay
 * destello blanco antes de que cargue nada.
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
  const i = s.indexOf("@media (prefers-color-scheme: dark)");
  assert.ok(i >= 0, "falta el bloque @media (prefers-color-scheme: dark) en base.css");
  const rootIni = s.indexOf(":root", i);
  const rootFin = s.indexOf("}", rootIni);
  return Object.fromEntries(
    [...s.slice(rootIni, rootFin).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
  );
};

test("hay un modo oscuro que sigue al sistema", () => {
  const v = bloqueOscuro();
  for (const k of ["white", "off", "text", "muted", "green-ink", "navy-800"]) {
    assert.ok(v[k], `el modo oscuro no redefine --${k}`);
  }
  /* Sin esto los controles nativos —barras de desplazamiento, autocompletado,
     el selector de fecha— siguen claros sobre una página oscura. */
  assert.match(sinComentarios(base), /prefers-color-scheme:\s*dark[\s\S]*?color-scheme:\s*dark/);
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
  const nav = leer("../src/components/SiteNav.jsx");
  assert.match(nav, /<source[\s\S]*?media="\(prefers-color-scheme: dark\)"[\s\S]*?srcSet="\/monogram-oscuro\.png"/);
  assert.ok(existsSync(new URL("../public/monogram-oscuro.png", import.meta.url)));
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
