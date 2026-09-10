import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SUBJECTS } from "../src/data/site.js";
import { SUBJECT_SUGGESTIONS_BY_LEVEL } from "../../frontend/src/constants/bookingWizard.js";

const fuenteSubjects = readFileSync(new URL("../src/pages/Subjects.jsx", import.meta.url), "utf8");

/* CADA MATERIA QUE ENLAZA EL SITIO TIENE QUE EXISTIR EN EL KIOSCO.
 *
 * Tercer test del repositorio que cruza los dos proyectos, y el que más plata
 * cuida. Existe por un bug que estuvo meses en producción:
 *
 *   `tuprofesorparticular.com.ar/materias` enlazaba `?materia=Matemáticas`.
 *   El kiosco llama a esa materia "Matemática", en singular.
 *
 * Dos consecuencias. La visible: la tarjeta del paso 1 no quedaba seleccionada y
 * había que elegirla de nuevo. La cara: la excepción de precios está cargada en
 * singular, así que la comparación fallaba y una clase de Secundaria se cotizaba
 * a la tarifa base — $20.000 en lugar de $25.000, en la materia más pedida y
 * entrando desde el propio sitio.
 *
 * Nadie lo iba a encontrar leyendo código: hay que abrir el enlace, llegar al
 * paso 1 y notar que no hay nada marcado, y después atar eso con la matriz de
 * precios. Por eso la verificación es automática y corre en CI antes del build.
 *
 * Se sostiene en tres capas, y este test cuida la primera:
 *   1. El sitio manda el nombre canónico          <- acá
 *   2. El kiosco normaliza lo que llega por la URL (`materiaCanonica.js`)
 *   3. El servidor normaliza al cotizar           (`pricingMatrix.js`)
 *
 * Las capas 2 y 3 existen porque esta sola no alcanza: los enlaces con el plural
 * ya se compartieron por WhatsApp y van a seguir existiendo para siempre.
 */

const MATERIAS_DEL_KIOSCO = new Set(
  Object.values(SUBJECT_SUGGESTIONS_BY_LEVEL).flat(),
);

test("todas las materias del sitio existen en el kiosco, escritas igual", () => {
  for (const s of SUBJECTS) {
    assert.ok(
      MATERIAS_DEL_KIOSCO.has(s.bookingParam),
      `"${s.label}" enlaza a la materia "${s.bookingParam}", que el kiosco no tiene. ` +
        "El nombre tiene que coincidir EXACTO con la lista de bookingWizard.js.",
    );
  }
});

test("ninguna materia se quedó sin bookingParam", () => {
  /* El modo de falla del futuro: alguien agrega una materia al sitio copiando el
     bloque de otra y borra el campo, o lo deja con el título en plural. */
  for (const s of SUBJECTS) {
    assert.equal(
      typeof s.bookingParam,
      "string",
      `la materia "${s.label}" no tiene bookingParam`,
    );
    assert.ok(s.bookingParam.trim(), `el bookingParam de "${s.label}" está vacío`);
  }
});

test("el enlace a reservar usa bookingParam y NO label", () => {
  /* El campo puede estar perfecto y no servir de nada si la página sigue
     enlazando el título. Es exactamente lo que pasaba: el dato correcto no
     existía y `label` se usaba para las dos cosas. */
  assert.match(
    fuenteSubjects,
    /\?materia=\$\{encodeURIComponent\(s\.bookingParam\)\}/,
    "Subjects.jsx no está enlazando con bookingParam",
  );
  assert.doesNotMatch(
    fuenteSubjects,
    /\?materia=\$\{encodeURIComponent\(s\.label\)\}/,
    "Subjects.jsx volvió a enlazar con el título visible",
  );
});

test("el caso concreto que falló queda fijado", () => {
  /* Un test con el nombre propio del bug. Los genéricos de arriba lo cubren,
     pero éste es el que va a leer quien vea el fallo dentro de dos años. */
  const matematica = SUBJECTS.find((s) => s.slug === "matematicas");
  assert.ok(matematica, "falta la materia Matemáticas");
  assert.equal(matematica.label, "Matemáticas", "el título se lee en plural, y está bien");
  assert.equal(matematica.bookingParam, "Matemática", "el enlace va en singular");
});
