import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { SUBJECTS } from "../src/data/site.js";

const fuenteSubjects = readFileSync(new URL("../src/pages/Subjects.jsx", import.meta.url), "utf8");
const fuenteEstilos = readFileSync(new URL("../src/pages/Inner.css", import.meta.url), "utf8");

/* LAS PORTADAS DE MATERIA EN EL SITIO INSTITUCIONAL.
 *
 * Las ilustraciones ya existían y se usaban SÓLO en el kiosco de reserva: quien
 * llegaba por el sitio veía cinco tarjetas de texto y recién se encontraba con
 * la imagen después de hacer clic. Ahora las tarjetas las muestran, y las dos
 * pantallas se reconocen entre sí.
 *
 * Son archivos COPIADOS de `frontend/`: los dos proyectos tienen bundles y
 * deploys separados y ninguno puede alcanzar los assets del otro. Por eso el
 * test verifica que el archivo exista de este lado.
 */

const RUTA = (slug) => new URL(`../public/subjects/${slug}.webp`, import.meta.url);

/* El slug de la materia es la llave, así que el nombre del archivo se deduce de
   los datos y no de una lista paralela que se desincronice. `matematicas` en el
   sitio es `matematica.webp` en los assets —plural contra singular, la misma
   distinción que ya costó plata en el enlace de reserva—, de ahí el mapa. */
const ARCHIVO_POR_SLUG = {
  matematicas: "matematica",
  fisica: "fisica",
  fisicoquimica: "fisicoquimica",
  quimica: "quimica",
  ingles: "ingles",
};

test("cada materia publicada tiene su portada", () => {
  const sinPortada = SUBJECTS.filter((s) => {
    const archivo = ARCHIVO_POR_SLUG[s.slug];
    return !archivo || !existsSync(RUTA(archivo));
  }).map((s) => s.slug);

  assert.deepEqual(sinPortada, [], `materias sin portada: ${sinPortada.join(", ")}`);
});

test("ninguna portada pesa más de lo que aporta", () => {
  /* Esta página era texto puro y volaba. Sumarle cinco ilustraciones es una
     decisión con costo, y el costo tiene techo: 80 KB por archivo. Por encima
     de eso hay que volver a comprimir, no publicar y ver qué pasa. */
  const pesadas = Object.values(ARCHIVO_POR_SLUG)
    .map((archivo) => ({ archivo, kb: Math.round(statSync(RUTA(archivo)).size / 1024) }))
    .filter((a) => a.kb > 80);

  assert.deepEqual(pesadas, [], `portadas por encima de 80 KB: ${JSON.stringify(pesadas)}`);
});

test("las portadas no vuelven a decir el nombre de la materia", () => {
  /* CADA ILUSTRACIÓN TIENE EL NOMBRE DE LA MATERIA ESCRITO EN EL MEDIO.
   *
   * La tarjeta ya lo dice en su encabezado, así que mostrar la imagen entera
   * pondría "MATEMÁTICA" arriba de "Matemáticas" —y encima en singular contra
   * plural, justo la distinción que en este repo ya costó plata en el enlace de
   * reserva—.
   *
   * Por eso la franja recorta la PARTE DE ARRIBA, donde están los objetos: la
   * calculadora y el compás en Matemática, el globo y el pizarrón en Inglés. El
   * nombre queda fuera del recorte a propósito.
   *
   * Este test fija las dos mitades de esa decisión: que el recorte vaya arriba
   * y que la franja no crezca tanto como para que el nombre asome. Las
   * ilustraciones son cuadradas y el título empieza cerca del 38 % de la altura;
   * con la tarjeta más angosta que soporta el diseño, una franja de más de
   * 180 px ya lo estaría mostrando. */
  assert.match(fuenteEstilos, /\.subj-card-media\s+img[\s\S]*?object-position:\s*(center\s+)?top/);

  const alto = fuenteEstilos.match(/\.subj-card-media\s*\{[\s\S]*?height:\s*(\d+)px/);
  assert.ok(alto, "la franja tiene que declarar una altura fija");
  assert.ok(
    Number(alto[1]) <= 180,
    `la franja mide ${alto[1]}px: por encima de 180 el nombre de la ilustración asoma`,
  );
});

test("la portada es decorativa para quien escucha la página", () => {
  /* Mismo problema que arriba, en el otro canal: el nombre de la materia ya
     viaja en el encabezado de la tarjeta. Una portada con `alt="Matemáticas"`
     hace que un lector de pantalla diga la materia dos veces seguidas, y no
     agrega nada —la ilustración no tiene información que el texto no dé—.

     `alt=""` no es "me olvidé del alt": es la forma de declarar que la imagen es
     decorativa y que el lector debe saltearla. */
  const imagenes = [...fuenteSubjects.matchAll(/<img[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.ok(imagenes.length > 0, "la página tiene que renderizar las portadas");

  for (const img of imagenes) {
    assert.match(img, /alt=""/, `portada sin alt vacío:\n${img}`);
  }
});

test("las portadas reservan su lugar antes de cargar", () => {
  /* Sin `width` y `height`, el navegador no sabe cuánto va a ocupar la imagen y
     pinta la tarjeta sin ella: cuando la portada llega, todo lo de abajo salta.
     En una grilla de cinco tarjetas eso es la página entera moviéndose mientras
     alguien ya empezó a leer. */
  const imagenes = [...fuenteSubjects.matchAll(/<img[\s\S]*?\/>/g)].map((m) => m[0]);
  /* Sin esta línea el test pasaba EN FALSO: un `for` sobre cero imágenes no
     ejecuta ninguna aserción y `node --test` lo da por bueno. Lo mismo vale
     para cualquier test que recorra una lista; si la lista puede estar vacía,
     hay que decir que no debe estarlo. */
  assert.ok(imagenes.length > 0, "la página tiene que renderizar las portadas");

  for (const img of imagenes) {
    assert.match(img, /\swidth=[{"]/, `portada sin width:\n${img}`);
    assert.match(img, /\sheight=[{"]/, `portada sin height:\n${img}`);
  }

  /* Los valores llegan por constante, así que se verifica allá que sean números
     y no un `undefined` que el navegador ignora en silencio. El test anterior
     exigía un dígito pegado al `=` y rechazaba precisamente la forma correcta
     de no repetir 480 cinco veces. */
  const fuentePortadas = readFileSync(new URL("../src/data/portadas.js", import.meta.url), "utf8");
  assert.match(fuentePortadas, /PORTADA_SIZE\s*=\s*\{\s*width:\s*\d+\s*,\s*height:\s*\d+\s*\}/);
});

test("sólo la primera portada se carga con prioridad", () => {
  /* Las otras cuatro entran por debajo del pliegue. Cargarlas todas de entrada
     retrasa lo único que la persona está mirando, que es la primera tarjeta. */
  assert.match(fuenteSubjects, /loading=\{[^}]*"lazy"/);
  assert.match(fuenteSubjects, /"eager"/);
});

test("las portadas no viajan adentro del HTML", () => {
  /* ESTE ES EL TEST QUE FALTABA, Y LO DEMOSTRÓ EL BUILD.
   *
   * La primera versión importaba las imágenes (`import x from "…/x.webp"`) y
   * todos los tests pasaban. El build cantó el problema: el HTML de `/materias`
   * saltó de 51 KB a 453.
   *
   * `prerender.mjs` compila los componentes con esbuild para poder ejecutarlos
   * en Node, y le declara `".webp": "dataurl"`. Cada import de imagen se
   * convierte en base64 y queda EMPOTRADO en el HTML prerenderizado. Como el
   * bundle de Vite sí usa el archivo con hash, al hidratar React cambiaba el
   * `src` y el navegador se descargaba las cinco otra vez: unos 700 KB para
   * mostrar 296. Y el `loading="lazy"` no servía para nada, porque una imagen
   * que viaja dentro del HTML ya llegó.
   *
   * Se verifica sobre el CÓDIGO y no sobre `dist/` a propósito: en CI los tests
   * corren ANTES del build —la idea es no desplegar si algo no cierra— así que
   * un test que mire la carpeta construida no encontraría nada.
   *
   * Si alguien vuelve a importar una portada, esto lo frena. */
  const fuentePortadas = readFileSync(new URL("../src/data/portadas.js", import.meta.url), "utf8");
  const sinComentarios = fuentePortadas
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  assert.doesNotMatch(
    sinComentarios,
    /import\s+\w+\s+from\s+["'][^"']*\.(webp|png|jpe?g|svg)["']/,
    "las portadas no se importan: se sirven desde public/ por ruta",
  );

  /* `includes` y no una expresión regular armada con `new RegExp`: en el
     template literal el `\.` se perdía y la expresión terminaba con un punto
     comodín, que hacía pasar `matematicaXwebp`. Lo cazó el linter. Para buscar
     un texto exacto no hace falta una expresión regular. */
  for (const ruta of Object.values(ARCHIVO_POR_SLUG)) {
    assert.ok(
      sinComentarios.includes(`"/subjects/${ruta}.webp"`),
      `falta la ruta pública de ${ruta}`,
    );
  }
});
