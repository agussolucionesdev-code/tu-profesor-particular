import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SUBJECT_SUGGESTIONS_BY_LEVEL, ordenarPorPrioridad } from "../../src/constants/bookingWizard.js";
import { getSubjectPresentation, OTHER_SUBJECT_PRESENTATION } from "../../src/constants/presentacionesDeMaterias.js";

/* LO QUE SE RESCATÓ DEL PR #74.
 *
 * El #74 (agosto) traía una colección de portadas 3D, tarjetas con una
 * descripción por materia, la ruta «entender → practicar → aplicar» y varios
 * cambios de listas. Después de ese PR se decidieron otras cosas: las portadas
 * por nivel que hoy están en producción (Agustín eligió quedarse con esas) y
 * las listas de materias depuradas a lo que él da. Se trajo lo que no choca con
 * eso, y estos tests lo fijan.
 */

const kiosco = readFileSync(new URL("../../src/components/BookingKiosk.jsx", import.meta.url), "utf8");

test("Matemática va primera en la grilla, no sexta", () => {
  /* La lista está alfabética para mantenerla, pero el kiosco la mostraba así:
     Matemática, la materia principal, caía en la segunda fila. Ya existía
     getSubjectSuggestions con el orden de prioridad; el kiosco no la usaba. */
  assert.equal(ordenarPorPrioridad(SUBJECT_SUGGESTIONS_BY_LEVEL.Secundaria)[0], "Matemática");
  assert.match(kiosco, /ordenarPorPrioridad\(/, "el kiosco no ordena las materias por prioridad");
});

test("el orden también se aplica a la lista que carga el panel", () => {
  /* Si Agustín edita las materias desde el panel, esa lista reemplaza a la
     embebida: tiene que pasar por el mismo orden. */
  const delPanel = ["Biología", "Inglés", "Matemática", "Física"];
  assert.deepEqual(ordenarPorPrioridad(delPanel), ["Matemática", "Física", "Inglés", "Biología"]);
  assert.deepEqual(delPanel, ["Biología", "Inglés", "Matemática", "Física"], "no muta la lista original");
});

test("cada materia de cada nivel tiene su propia descripción", () => {
  const sinPropia = [];
  for (const [nivel, materias] of Object.entries(SUBJECT_SUGGESTIONS_BY_LEVEL)) {
    for (const materia of materias) {
      if (getSubjectPresentation(materia, nivel).key === "general") sinPropia.push(`${nivel}: ${materia}`);
    }
  }
  assert.deepEqual(sinPropia, [], `materias con la descripción genérica:\n  ${sinPropia.join("\n  ")}`);
});

test("primaria le habla a primaria", () => {
  /* Misma decisión que las portadas: la madre que busca apoyo para cuarto grado
     y el que rinde un final no son la misma persona. */
  assert.notEqual(
    getSubjectPresentation("Matemática", "Primaria").description,
    getSubjectPresentation("Matemática", "Secundaria").description,
  );
});

test("las descripciones no prometen lo que no se puede sostener", () => {
  /* El #74 decía que Inglés daba «fluidez». El sitio dice lo contrario, a
     propósito: «No es un curso de conversación: no vas a salir hablando». */
  const PROMESAS = /fluidez|fluido|garantiz|asegur|100\s?%|aprob(á|as|ar)|en (pocas|dos|tres) clases|siempre|nunca más/i;
  const todas = [];
  for (const [nivel, materias] of Object.entries(SUBJECT_SUGGESTIONS_BY_LEVEL)) {
    for (const materia of materias) todas.push(getSubjectPresentation(materia, nivel));
  }
  todas.push(OTHER_SUBJECT_PRESENTATION);
  for (const p of todas) {
    assert.doesNotMatch(`${p.kicker} ${p.description}`, PROMESAS, `promesa en «${p.description}»`);
  }
});

test("la tarjeta muestra la descripción y la lee el lector de pantalla", () => {
  assert.match(kiosco, /className="kiosk-subject-description"/);
  assert.match(kiosco, /aria-describedby=/, "la descripción no está atada a la tarjeta");
  /* El nombre accesible sigue siendo corto. Con la descripción adentro del
     nombre, cada tarjeta se anunciaba como un párrafo. */
  assert.match(kiosco, /aria-label=\{`Materia: \$\{subject\}`\}/);
});

test("la ruta de aprendizaje está y es una lista", () => {
  assert.match(kiosco, /className="kiosk-ruta"/);
  assert.match(kiosco, /<ol[^>]*className="kiosk-ruta-pasos"/);
});

test("el aviso de lo elegido no envuelve al botón de continuar", () => {
  /* Una región viva con un control adentro se vuelve a anunciar entera cada
     vez que algo cambia. El anuncio va en su propio texto oculto. */
  const dock = kiosco.match(/<div className="kiosk-selection-dock"[^>]*>/);
  assert.ok(dock, "no encontré el dock de la elección");
  assert.doesNotMatch(dock[0], /role="status"|aria-live/);
});
