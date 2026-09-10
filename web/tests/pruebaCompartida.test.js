import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TESTIMONIOS as TESTIMONIOS_WEB,
  problemasDelTestimonio,
} from "../src/data/prueba.js";
import {
  TESTIMONIOS as TESTIMONIOS_TURNOS,
  hayTestimonios as hayTestimoniosTurnos,
} from "../../frontend/src/constants/prueba.js";

/* LOS DOS DOMINIOS TIENEN QUE PUBLICAR LOS MISMOS TESTIMONIOS.
 *
 * Segundo test del repositorio que cruza los dos proyectos —el primero es
 * `vozCompartida.test.js`— y existe por el mismo motivo: `web/` y `frontend/` son
 * proyectos separados sin paquete compartido, así que el contenido está duplicado a
 * propósito y la duplicación sólo es segura mientras algo la vigile.
 *
 * Acá el riesgo es más serio que en la voz. Un testimonio no es copy: son las
 * palabras de una persona real, publicadas con un permiso concreto. Si se edita en
 * un dominio y no en el otro, o si alguien retira su permiso y se borra de un lado
 * solo, queda publicado texto de una persona que ya dijo que no. Eso no es una
 * inconsistencia de marca: es un problema con una persona.
 *
 * Por eso el test compara la lista ENTERA y campo por campo, y no sólo la cantidad.
 *
 * Corre en CI antes del build del institucional, así que una divergencia frena el
 * deploy. Funciona porque `actions/checkout` trae el repositorio entero y recién
 * después entra a `web/`: el import a `../../frontend/` resuelve igual que en local.
 */

test("los dos dominios publican exactamente los mismos testimonios", () => {
  assert.deepEqual(
    TESTIMONIOS_TURNOS,
    TESTIMONIOS_WEB,
    "turnos y el sitio institucional no publican los mismos testimonios",
  );
});

test("hoy no hay ninguno publicado, en ninguno de los dos", () => {
  /* Fija el estado actual a propósito. El día que esto falle va a ser porque alguien
     agregó el primer testimonio, y ese es exactamente el momento en que conviene que
     alguien vuelva a leer las reglas del archivo antes de seguir. */
  assert.equal(TESTIMONIOS_WEB.length, 0);
  assert.equal(TESTIMONIOS_TURNOS.length, 0);
  assert.equal(hayTestimoniosTurnos(), false);
});

test("los testimonios de turnos pasan la misma validación que los del institucional", () => {
  /* El validador vive en el institucional y es la única versión. Si turnos tuviera la
     suya, en dos ediciones estarían diciendo cosas distintas sobre qué es publicable. */
  for (const [i, t] of TESTIMONIOS_TURNOS.entries()) {
    assert.deepEqual(
      problemasDelTestimonio(t),
      [],
      `el testimonio ${i + 1} de turnos no se puede publicar`,
    );
  }
});

test("el archivo de turnos deja escrito que el permiso es obligatorio", () => {
  /* La regla completa vive en el institucional, pero la parte que más se olvida tiene
     que estar donde se edita. Quien pegue un testimonio en turnos probablemente no
     abra el otro archivo. */
  const fuente = readFileSync(
    new URL("../../frontend/src/constants/prueba.js", import.meta.url),
    "utf8",
  );
  assert.match(fuente, /permiso/i);
  assert.match(fuente, /autorizar el texto NO es autorizar el nombre/i);
});
