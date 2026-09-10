import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/* CLASES DE CSS QUE NO EXISTEN.
 *
 * En React una clase mal escrita no rompe nada: el elemento se renderiza sin
 * estilo y sigue funcionando. Es el peor tipo de error —no hay excepción, no hay
 * log, no hay test que falle— y la única forma de encontrarlo es mirar la
 * pantalla en el estado exacto donde aparece.
 *
 * Este archivo salió de encontrar tres. `.secondary-button` no está definida en
 * ninguna hoja del proyecto, y estaba puesta en los tres botones de "Reintentar"
 * de los estados de error del panel: alumnos, detalle de alumno y notificaciones.
 * Los tres se veían como un botón crudo del navegador, con el borde gris del
 * sistema, justo en el momento en que algo ya había fallado y la pantalla tiene
 * que dar más confianza que nunca. Se descubrieron de casualidad, escribiendo
 * otra pantalla y copiando la clase de un componente vecino.
 *
 * El chequeo es deliberadamente ACOTADO: una lista de nombres prohibidos, no un
 * cruce completo de todas las clases contra todas las hojas. Ese cruce sería
 * lindo y no funcionaría: hay clases compuestas por template strings, otras que
 * vienen de datos, y librerías que traen las suyas. Un test que da falsos
 * positivos se termina desactivando, y entonces no cuida nada.
 *
 * Para sumar un nombre a la lista: comprobar antes con
 * `rg "\.nombre-de-la-clase" --glob '*.css'` que de verdad no exista.
 */

const PROHIBIDAS = [
  // Las del panel se llaman admin-primary-btn / admin-secondary-btn.
  "primary-button",
  "secondary-button",
];

const raiz = fileURLToPath(new URL("../../src/", import.meta.url));

const archivosJsx = (dir) => {
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivosJsx(ruta));
    else if (/\.jsx?$/.test(entrada)) salida.push(ruta);
  }
  return salida;
};

test("ningún componente usa una clase que no existe en ninguna hoja", () => {
  const culpables = [];

  for (const ruta of archivosJsx(raiz)) {
    const fuente = readFileSync(ruta, "utf8");
    for (const clase of PROHIBIDAS) {
      /* Se busca dentro de un className y no en cualquier parte del archivo: la
         palabra puede aparecer legítimamente en un comentario que explique por
         qué NO se usa —de hecho aparece, en AdminPanel.css—. */
      const re = new RegExp(`className=(?:"|\`)[^"\`]*\\b${clase}\\b`);
      if (re.test(fuente)) {
        culpables.push(`${ruta.split("src")[1]} usa .${clase}`);
      }
    }
  }

  assert.deepEqual(
    culpables,
    [],
    `hay clases sin definir en ninguna hoja:\n${culpables.join("\n")}`,
  );
});

test("la lista de prohibidas sigue siendo cierta", () => {
  /* Un test de nombres prohibidos envejece mal: el día que alguien DEFINA
     .secondary-button en una hoja, el de arriba pasa a prohibir algo válido y
     manda a corregir código que estaba bien. Esto avisa en ese momento. */
  const cssRaiz = fileURLToPath(new URL("../../src/", import.meta.url));
  const hojas = (function css(dir) {
    const salida = [];
    for (const entrada of readdirSync(dir)) {
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) salida.push(...css(ruta));
      else if (entrada.endsWith(".css")) salida.push(ruta);
    }
    return salida;
  })(cssRaiz);

  const todoElCss = hojas.map((h) => readFileSync(h, "utf8")).join("\n");

  for (const clase of PROHIBIDAS) {
    assert.doesNotMatch(
      todoElCss,
      new RegExp(`^\\s*\\.${clase}\\b`, "m"),
      `.${clase} ya está definida: sacala de PROHIBIDAS`,
    );
  }
});
