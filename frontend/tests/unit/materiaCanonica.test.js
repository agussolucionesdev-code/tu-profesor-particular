import assert from "node:assert/strict";
import test from "node:test";
import {
  MATERIAS_CONOCIDAS,
  esMateriaConocida,
  materiaCanonica,
} from "../../src/utils/materiaCanonica.js";
import { SUBJECT_SUGGESTIONS_BY_LEVEL } from "../../src/constants/bookingWizard.js";

/* LA MATERIA QUE LLEGA POR LA URL.
 *
 * Este archivo nació de un bug que estuvo meses en producción y costaba plata:
 * el sitio institucional enlazaba `?materia=Matemáticas` en plural, el kiosco
 * guardaba ese texto, y la excepción de precios —cargada como "Matemática"— no
 * coincidía. Una clase de Secundaria se cotizaba a $20.000 en vez de $25.000,
 * en la materia más pedida y entrando desde el propio sitio.
 *
 * Los tests están escritos alrededor de la tensión real del problema: normalizar
 * lo suficiente para no perder una reserva, y NO tanto como para elegirle al
 * alumno una materia que no pidió.
 */

test("el caso exacto que costaba plata", () => {
  assert.equal(materiaCanonica("Matemáticas"), "Matemática");
});

test("tolera mayúsculas, tildes y espacios de más", () => {
  /* Las tres cosas que cambian sin que nadie lo decida: alguien tipea sin tilde,
     un enlace viejo trae mayúsculas, un copiar y pegar arrastra un espacio. */
  for (const entrada of ["MATEMÁTICA", "matematica", "  Matemática  ", "MATEMATICAS"]) {
    assert.equal(materiaCanonica(entrada), "Matemática", `falló con "${entrada}"`);
  }
});

test("las materias que ya son plurales siguen coincidiendo consigo mismas", () => {
  /* El riesgo de sacar la "s" final: romper las que nacieron en plural. No pasa
     porque la "s" se saca de los DOS lados de la comparación, pero eso hay que
     fijarlo — es la clase de simetría que alguien rompe "optimizando". */
  for (const m of ["Ciencias Naturales", "Ciencias Sociales", "Prácticas Docentes", "Máquinas"]) {
    assert.equal(materiaCanonica(m), m, `se rompió "${m}"`);
  }
});

test("NO adivina: lo que no conoce lo devuelve tal cual", () => {
  /* El paso 1 acepta materia escrita a mano. Si esto intentara acercar "Mate" a
     "Matemática", terminaría eligiendo por el alumno una materia que no pidió y,
     con ella, una tarifa que no eligió. Ese error es peor que el que arregla. */
  assert.equal(materiaCanonica("Mate"), "Mate");
  assert.equal(materiaCanonica("Análisis Matemático II"), "Análisis Matemático II");
  assert.equal(esMateriaConocida("Mate"), false);
});

test("no pierde lo que el alumno escribió", () => {
  // Nunca devuelve null ni undefined para texto: el paso 1 depende de eso.
  assert.equal(materiaCanonica("  Taller de Tesis  "), "Taller de Tesis");
  assert.equal(materiaCanonica(""), "");
  assert.equal(materiaCanonica(null), "");
  assert.equal(materiaCanonica(undefined), "");
  assert.equal(materiaCanonica(42), "");
});

test("una sola letra no se toma como plural", () => {
  /* Borde del recorte de la "s": con la regla aplicada a ciegas, "s" quedaba en
     cadena vacía y cualquier entrada de una letra colapsaba contra otra. */
  assert.equal(materiaCanonica("s"), "s");
  assert.equal(materiaCanonica("A"), "A");
});

test("ninguna materia real colisiona con otra al normalizarse", () => {
  /* El peligro de fondo de todo el archivo: que la normalización junte dos
     materias distintas y el kiosco elija la equivocada. Hoy son 39 y ninguna
     choca, pero la lista crece —Fisicoquímica se agregó después— y este test es
     lo que va a avisar el día que alguien sume una que sí choque. */
  const todas = [...new Set(Object.values(SUBJECT_SUGGESTIONS_BY_LEVEL).flat())];
  assert.equal(
    MATERIAS_CONOCIDAS.length,
    todas.length,
    `dos materias distintas se normalizan igual: ${todas.length} en las listas, ${MATERIAS_CONOCIDAS.length} después de normalizar`,
  );
});

test("toda materia conocida es punto fijo", () => {
  // Normalizar algo ya canónico no puede cambiarlo. Si no, el kiosco reescribiría
  // la materia cada vez que se vuelve al paso 1.
  for (const m of MATERIAS_CONOCIDAS) {
    assert.equal(materiaCanonica(m), m, `"${m}" no es punto fijo`);
    assert.equal(esMateriaConocida(m), true);
  }
});

test("normalizar dos veces da lo mismo que normalizar una", () => {
  for (const entrada of ["Matemáticas", "Mate", "  QUÍMICAS  ", "Ciencias Naturales"]) {
    assert.equal(materiaCanonica(materiaCanonica(entrada)), materiaCanonica(entrada));
  }
});
