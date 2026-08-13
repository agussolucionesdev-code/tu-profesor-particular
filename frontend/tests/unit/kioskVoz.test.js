import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  OPCIONES_PARA_QUIEN,
  PARA_MI,
  PARA_OTRO,
  vozDelWizard,
} from "../../src/constants/kioskVoz.js";

/* La voz del wizard según quién esté reservando.
 *
 * El wizard preguntaba «¿Qué nivel estás cursando?» a alguien que casi nunca es el
 * alumno: reserva una madre, un padre, una hermana mayor, un tío, una abuela. Estos
 * tests fijan la regla que ordena todo el archivo:
 *
 *   Quien LEE es siempre quien reserva. Sólo cambia lo que se refiere al ALUMNO.
 *
 * Es la parte fácil de romper: la tentación al editar es cambiar todos los «vos» a
 * tercera persona, y la mitad de los «vos» del wizard son correctos porque le hablan
 * al lector.
 */

const fuente = readFileSync(
  new URL("../../src/constants/kioskVoz.js", import.meta.url),
  "utf8",
);

const CLAVES = [
  "nivelEyebrow",
  "nivelTitulo",
  "nivelSubtitulo",
  "materiaEyebrow",
  "materiaTitulo",
  "otraMateriaTitulo",
  "otraMateriaAyuda",
  "turnoSubtitulo",
  "datosTitulo",
  "objetivoLabel",
  "autoCompleteAlumno",
  "autoCompleteResponsable",
];

test("las dos voces cubren exactamente las mismas claves", () => {
  /* Si una voz gana una clave y la otra no, el wizard renderiza `undefined` en esa
     pantalla y sólo para la mitad de la gente. Es el modo de falla más probable de
     este archivo y el más difícil de ver a ojo. */
  const mi = vozDelWizard(PARA_MI);
  const otro = vozDelWizard(PARA_OTRO);

  assert.deepEqual(Object.keys(mi).sort(), Object.keys(otro).sort());
  for (const clave of CLAVES) {
    assert.equal(typeof mi[clave], "string", `falta ${clave} en la voz propia`);
    assert.equal(typeof otro[clave], "string", `falta ${clave} en la voz de tercera`);
    assert.notEqual(mi[clave].trim(), "", `${clave} vacío en la voz propia`);
    assert.notEqual(otro[clave].trim(), "", `${clave} vacío en la voz de tercera`);
  }
});

test("no trata al lector como alumno cuando reserva para otra persona", () => {
  const otro = vozDelWizard(PARA_OTRO);

  // El caso textual que motivó todo el cambio.
  assert.equal(otro.nivelTitulo, "¿Qué nivel está cursando?");
  assert.doesNotMatch(otro.nivelTitulo, /estás/);

  /* Nada de lo que describe al ALUMNO puede venir en segunda persona. Se revisan las
     claves que hablan del alumno, no todas: `nivelSubtitulo` dice «te mostramos» y eso
     está bien, porque le habla a quien reserva. */
  for (const clave of ["nivelTitulo", "materiaTitulo", "otraMateriaTitulo", "objetivoLabel"]) {
    assert.doesNotMatch(
      otro[clave],
      /\b(estás|querés|tenés|tu|tus|vos)\b/i,
      `${clave} trata al lector como si fuera el alumno: "${otro[clave]}"`,
    );
  }
  assert.match(otro.otraMateriaAyuda, /su plan de estudios/);
});

test("tutea cuando la clase es para quien reserva", () => {
  const mi = vozDelWizard(PARA_MI);

  assert.equal(mi.nivelTitulo, "¿Qué nivel estás cursando?");
  assert.match(mi.materiaTitulo, /querés/);
  assert.match(mi.otraMateriaAyuda, /tu plan de estudios/);
  assert.equal(mi.datosTitulo, "Tus datos");
});

test("sin respuesta cae en la voz de tercera persona", () => {
  /* Es la opción prudente: tratar de «vos» a alguien que resulta ser la abuela es el
     error que vinimos a arreglar. Hablar del alumno en tercera ante alguien que sí es
     el alumno se lee neutro, no incorrecto. */
  for (const valor of [null, undefined, "", "cualquier-cosa"]) {
    assert.equal(vozDelWizard(valor).nivelTitulo, "¿Qué nivel está cursando?");
  }
});

test("el autocompletado apunta a la persona del dispositivo, no al alumno", () => {
  /* El campo «Nombre del alumno» tenía `autoComplete="name"` fijo. Cuando una abuela
     reserva para su nieto, eso le ofrece SU nombre para el campo del nieto —el dato
     equivocado— y el campo del responsable, que sí es ella, no ofrecía nada.
     Exactamente al revés de lo útil. */
  const otro = vozDelWizard(PARA_OTRO);
  assert.equal(otro.autoCompleteAlumno, "off");
  assert.equal(otro.autoCompleteResponsable, "name");

  const mi = vozDelWizard(PARA_MI);
  assert.equal(mi.autoCompleteAlumno, "name");
  assert.equal(mi.autoCompleteResponsable, "off");
});

test("la pregunta ofrece dos opciones, con la mayoritaria primero", () => {
  assert.equal(OPCIONES_PARA_QUIEN.length, 2);
  // Reservar para otra persona es el caso mayoritario del negocio.
  assert.equal(OPCIONES_PARA_QUIEN[0].value, PARA_OTRO);
  assert.equal(OPCIONES_PARA_QUIEN[1].value, PARA_MI);

  for (const opcion of OPCIONES_PARA_QUIEN) {
    assert.equal(typeof opcion.label, "string");
    assert.ok(opcion.hint.trim().length > 0, "cada opción necesita su aclaración");
  }
});

test("la opción propia sigue declarando la mayoría de edad", () => {
  /* La condición estaba en el checkbox viejo («Soy el alumno y soy mayor de edad») y es
     la que decide si se piden los datos de un adulto responsable. Al mover la pregunta
     no se puede perder: sin esto, un menor reservando para sí mismo entraría sin ningún
     adulto asociado y nadie lo notaría. */
  const propia = OPCIONES_PARA_QUIEN.find((o) => o.value === PARA_MI);
  assert.match(propia.hint, /mayor de edad/i);
});

test("la aclaración de la opción para otros nombra vínculos reales", () => {
  // Que alguien se reconozca en la lista es lo que hace que la elija sin dudar.
  const ajena = OPCIONES_PARA_QUIEN.find((o) => o.value === PARA_OTRO);
  assert.match(ajena.hint, /hijo|hermano|nieto/i);
});

test("las voces son inmutables", () => {
  /* Se congelan porque son constantes de módulo compartidas: una mutación accidental
     en un render se arrastraría a todos los siguientes. */
  const otro = vozDelWizard(PARA_OTRO);
  assert.ok(Object.isFrozen(otro));
  assert.ok(Object.isFrozen(OPCIONES_PARA_QUIEN));
});

test("documenta la regla que ordena el archivo", () => {
  /* No es decoración: la próxima persona que edite acá va a querer cambiar todos los
     «vos» a tercera persona, y la mitad son correctos. La regla tiene que estar escrita
     donde se edita. */
  assert.match(fuente, /Quien LEE es siempre quien reserva/);
});
