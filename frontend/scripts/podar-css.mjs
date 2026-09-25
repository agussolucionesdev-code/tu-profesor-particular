/* Encuentra (y, con --aplicar, borra) las reglas CSS que ya no puede usar nada.
 *
 *   node scripts/podar-css.mjs            simula: lista qué borraría
 *   node scripts/podar-css.mjs --aplicar  borra
 *
 * POR QUÉ EXISTE
 *
 * La app pasó por varios rediseños (los nombres de styles/ lo delatan:
 * minimalist-design → brand-identity-refresh → final-polish → theme-polish) y
 * cada capa dejó reglas de componentes que ya no existen. Medido en septiembre
 * de 2026: ~630 reglas y ~100 KB de CSS fuente que ningún componente usa, que
 * el navegador igual descarga, parsea y compara contra cada elemento.
 *
 * CUÁNDO UNA REGLA ESTÁ MUERTA (y el criterio es conservador a propósito):
 * TODAS las variantes de su selector (lo separado por comas) nombran al menos
 * una clase que no aparece en ningún lado —ni en src/, ni en index.html ni en
 * public/*.html— y que tampoco puede salir de un nombre armado en tiempo de
 * ejecución (`tpp-footer-red--${id}`: se protege el prefijo). Las clases de
 * react-datepicker las pone la librería y quedan fuera. Ante la duda, la regla
 * queda: borrar de más rompe; dejar de más sólo pesa.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const aplicar = process.argv.includes("--aplicar");

const archivos = (dir, patron) =>
  fs.readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => patron.test(f))
    .map((f) => path.join(dir, f));

const fuentes = [
  ...archivos(path.join(RAIZ, "src"), /\.(jsx?|tsx?)$/),
  path.join(RAIZ, "index.html"),
  ...archivos(path.join(RAIZ, "public"), /\.html$/),
].map((f) => fs.readFileSync(f, "utf8"));
const codigo = fuentes.join("\n");

/* Prefijos de clases armadas en tiempo de ejecución: `algo-${x}` o "algo-" + x. */
const prefijos = new Set([
  ...[...codigo.matchAll(/([a-z][\w-]*-)\$\{/g)].map((m) => m[1]),
  ...[...codigo.matchAll(/["'`]([a-z][\w-]*-)["'`]\s*\+/g)].map((m) => m[1]),
]);
const DE_LIBRERIAS = [/^react-datepicker/];

const existe = (clase) =>
  codigo.includes(clase) ||
  DE_LIBRERIAS.some((r) => r.test(clase)) ||
  [...prefijos].some((p) => clase.startsWith(p));

const clasesDe = (selector) => [...selector.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);

const estaMuerta = (regla) =>
  regla.selectors.every((s) => {
    const clases = clasesDe(s);
    return clases.length > 0 && clases.some((c) => !existe(c));
  });

let total = 0;
let bytes = 0;
for (const hoja of archivos(path.join(RAIZ, "src"), /\.css$/)) {
  const texto = fs.readFileSync(hoja, "utf8");
  const raiz = postcss.parse(texto, { from: hoja });
  const muertas = [];
  raiz.walkRules((regla) => {
    if (regla.parent?.type === "atrule" && /keyframes$/i.test(regla.parent.name)) return;
    if (estaMuerta(regla)) muertas.push(regla);
  });
  if (!muertas.length) continue;
  const peso = muertas.reduce((n, r) => n + r.toString().length, 0);
  total += muertas.length;
  bytes += peso;
  console.log(`${path.relative(RAIZ, hoja).split(path.sep).join("/")}: ${muertas.length} reglas (~${Math.round(peso / 1024)} KB)`);
  if (aplicar) {
    for (const regla of muertas) {
      const padre = regla.parent;
      regla.remove();
      /* Un @media que se quedó vacío también se va. */
      if (padre?.type === "atrule" && padre.nodes.length === 0) padre.remove();
    }
    fs.writeFileSync(hoja, raiz.toString());
  }
}
console.log(`${aplicar ? "Borradas" : "Se borrarían"}: ${total} reglas, ~${Math.round(bytes / 1024)} KB.`);
