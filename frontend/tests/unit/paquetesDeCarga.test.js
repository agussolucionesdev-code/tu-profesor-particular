import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { paqueteDe } from "../../paquetes.js";

/* EL CALENDARIO NO VIAJA EN LA PORTADA.
 *
 * Medido en producción, con el navegador: la portada de turnos precargaba
 * `vendor-datepicker` —175 KB sin comprimir: react-datepicker, date-fns y
 * floating-ui— y la portada no tiene ningún calendario. Se descargaba y se
 * ejecutaba en la primera pantalla que ve cualquiera que llega.
 *
 * Ningún módulo de JavaScript de la portada lo pedía: se recorrió el grafo de
 * imports estáticos desde `main.jsx` y ninguno llega a esas librerías. Lo
 * arrastraba una sola línea, `import "react-datepicker/dist/react-datepicker.css"`
 * en `main.jsx`. Con `manualChunks` en forma de objeto, el agrupador asignaba
 * ese módulo al paquete del calendario, y un import en el punto de entrada
 * convierte al paquete entero en dependencia de TODAS las páginas.
 *
 * La hoja NO se mueve de `main.jsx` a propósito. Hay ocho reglas globales que
 * pisan estilos del calendario con la misma especificidad que la librería y
 * ganan sólo por venir después; si la hoja pasara a cargarse con el componente,
 * perderían. Lo que cambia es a qué paquete va cada módulo: el CSS queda con el
 * resto de las hojas, en el mismo lugar de la cascada, y el JavaScript del
 * calendario sólo lo piden las pantallas que lo usan.
 */

const nm = (ruta) => `C:/proyecto/node_modules/${ruta}`;

test("la hoja del calendario no arrastra su paquete de JavaScript", () => {
  assert.equal(paqueteDe(nm("react-datepicker/dist/react-datepicker.css")), undefined);
});

test("el JavaScript del calendario sigue agrupado aparte", () => {
  assert.equal(paqueteDe(nm("react-datepicker/dist/index.es.js")), "vendor-datepicker");
  assert.equal(paqueteDe(nm("@floating-ui/react/dist/floating-ui.react.mjs")), "vendor-datepicker");
});

test("date-fns NO viaja con el calendario", () => {
  /* El kiosco formatea fechas desde el primer paso. Con date-fns dentro del
     paquete del calendario, pedir `format` arrastraba react-datepicker entero a
     la primera pantalla de /reservar: 43 KB sin usar, medido por Lighthouse. */
  assert.equal(paqueteDe(nm("date-fns/format.js")), "vendor-fechas");
  assert.equal(paqueteDe(nm("date-fns/locale/es.js")), "vendor-fechas");
});

test("React y los íconos siguen en sus paquetes de siempre", () => {
  assert.equal(paqueteDe(nm("react/index.js")), "vendor-react");
  assert.equal(paqueteDe(nm("react-dom/client.js")), "vendor-react");
  assert.equal(paqueteDe(nm("react-router-dom/dist/index.js")), "vendor-react");
  assert.equal(paqueteDe(nm("react-icons/fa/index.mjs")), "vendor-icons");
});

test("un nombre parecido no se cuela en un paquete ajeno", () => {
  /* `react-datepicker` empieza con `react`: una comparación por prefijo
     mandaría el calendario al paquete de React y volvería a cargarlo en todas
     las páginas. Se compara por carpeta completa. */
  assert.equal(paqueteDe(nm("react-datepicker/dist/index.es.js")), "vendor-datepicker");
  assert.notEqual(paqueteDe(nm("react-datepicker/dist/index.es.js")), "vendor-react");
});

test("rutas de Windows también se reconocen", () => {
  assert.equal(
    paqueteDe("C:\\proyecto\\node_modules\\react-datepicker\\dist\\index.es.js"),
    "vendor-datepicker",
  );
  assert.equal(
    paqueteDe("C:\\proyecto\\node_modules\\react-datepicker\\dist\\react-datepicker.css"),
    undefined,
  );
});

test("el código propio lo reparte Vite, no esta función", () => {
  assert.equal(paqueteDe("C:/proyecto/src/components/KioskSlotCalendar.jsx"), undefined);
});

/* EL CSS DEL CALENDARIO VIAJA CON EL CALENDARIO.
 *
 * main.jsx importaba react-datepicker.css (25 KB) y su tema en TODAS las
 * páginas: frenaban el primer pintado de la portada, que no tiene calendario.
 * Ahora los importan los dos componentes que dibujan uno, en el orden de
 * cascada que hace ganar a nuestros colores: librería, tema, CSS propio. Lo
 * dibujado lo verifican los e2e (axe, contraste, modo-oscuro y
 * modales-portal miden el día elegido). */
const leerFuente = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

test("ninguna hoja del calendario se carga en todas las páginas", () => {
  const main = leerFuente("../../src/main.jsx").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(main, /import\s+"react-datepicker\/dist\/react-datepicker\.css"/);
  assert.doesNotMatch(main, /datepicker-tema\.css/);
  const pulido = leerFuente("../../src/styles/final-polish.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(pulido, /\.react-datepicker/, "final-polish.css es global: el calendario no va ahí");
});

test("cada calendario trae su CSS en orden: librería, tema, propio", () => {
  for (const [componente, tema, propio] of [
    ["../../src/components/KioskSlotCalendar.jsx", "../styles/datepicker-tema.css", "./KioskSlotCalendar.css"],
    ["../../src/components/portal/RescheduleModal.jsx", "../../styles/datepicker-tema.css", "./RescheduleModal.css"],
  ]) {
    const fuente = leerFuente(componente);
    const libreria = fuente.indexOf('import "react-datepicker/dist/react-datepicker.css";');
    const temaEn = fuente.indexOf(`import "${tema}";`);
    const propioEn = fuente.indexOf(`import "${propio}";`);
    assert.ok(libreria > 0 && temaEn > libreria && propioEn > temaEn, `${componente}: el orden tiene que ser librería, tema, propio`);
  }
});
