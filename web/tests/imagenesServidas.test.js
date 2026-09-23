import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/* NINGUNA IMAGEN DE ESTE SITIO SE IMPORTA. TODAS SE SIRVEN POR RUTA.
 *
 * `prerender.mjs` compila los componentes con esbuild para poder ejecutarlos en
 * Node y le declara `".png": "dataurl"`, `".webp": "dataurl"`, `".svg":
 * "dataurl"`. Eso convierte CADA import de imagen en base64 y lo deja empotrado
 * dentro del HTML prerenderizado.
 *
 * Lo que costaba, medido sobre el build:
 *
 *   404.html          29 KB  →  18 KB eran imágenes  (62 %)
 *   /                 94 KB  →  49 KB                 (52 %)
 *   /sobre-mi         82 KB  →  49 KB                 (60 %)
 *   /privacidad       46 KB  →  18 KB                 (39 %)
 *
 * Y el monograma del encabezado —un PNG de 7 KB— aparecía TRECE VECES en cinco
 * páginas, porque cada página se lo lleva adentro. Servido por ruta se descarga
 * una sola vez para todo el sitio y queda en la caché del navegador; empotrado
 * viaja de nuevo en cada página que alguien abre.
 *
 * Encima, el bundle de Vite sí usa el archivo con hash: al hidratar, React
 * cambia el `src` y el navegador se descarga la imagen OTRA VEZ. Se paga dos
 * veces por lo mismo.
 *
 * La regla, entonces: las imágenes viven en `public/` y se nombran por su ruta.
 * Se resigna el hash de cache-busting que Vite le pone a los assets importados;
 * para un logo y una foto que no cambian es barato, y cuando cambien se
 * renombra el archivo.
 *
 * ESTE TEST BARRE TODO `src/` A PROPOSITO. La primera versión de la regla se
 * escribió mirando un solo archivo —el de las portadas— y dejó los otros cinco
 * imports intactos. Un test que afirma una regla general y revisa un caso
 * particular es peor que no tenerlo: da por cerrado un problema abierto.
 */

const RAIZ = new URL("../src/", import.meta.url);
const PUBLICO = new URL("../public/", import.meta.url);

const EXTENSIONES_DE_IMAGEN = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

const archivosDeCodigo = readdirSync(RAIZ, { recursive: true, encoding: "utf8" })
  .filter((ruta) => /\.(jsx?|tsx?)$/.test(ruta))
  .map((ruta) => ruta.replace(/\\/g, "/"));

const leer = (ruta) => readFileSync(new URL(ruta, RAIZ), "utf8");

/* Las aserciones que PROHÍBEN algo se hacen sobre el código sin comentarios:
   explicar en prosa qué se dejó de usar no puede hacer fallar al test que
   verifica que ya no se usa. */
const sinComentarios = (fuente) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("ninguna imagen se importa desde el código", () => {
  const conImport = [];

  for (const ruta of archivosDeCodigo) {
    const codigo = sinComentarios(leer(ruta));
    const imports = [...codigo.matchAll(/from\s+["']([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((especificador) => EXTENSIONES_DE_IMAGEN.test(especificador));

    for (const especificador of imports) {
      conImport.push(`${ruta} → ${especificador}`);
    }
  }

  assert.deepEqual(
    conImport,
    [],
    `estas imágenes se importan y terminan empotradas en el HTML:\n  ${conImport.join("\n  ")}`,
  );
});

test("las imágenes que el código nombra existen en public/", () => {
  /* La contracara: al servirlas por ruta se pierde la red que daba el bundler.
     Un `import` de un archivo que no existe rompe el build y se ve enseguida;
     un `src="/monogram.png"` mal escrito compila igual y sale a producción como
     una imagen rota. Esto lo devuelve. */
  const rotas = [];

  for (const ruta of archivosDeCodigo) {
    const codigo = sinComentarios(leer(ruta));
    const referencias = [...codigo.matchAll(/["'](\/[^"']*\.(?:png|jpe?g|webp|gif|avif|svg))["']/gi)]
      .map((m) => m[1]);

    for (const referencia of referencias) {
      if (!existsSync(new URL(`.${referencia}`, PUBLICO))) {
        rotas.push(`${ruta} → ${referencia}`);
      }
    }
  }

  assert.deepEqual(rotas, [], `rutas de imagen que no existen en public/:\n  ${rotas.join("\n  ")}`);
});
