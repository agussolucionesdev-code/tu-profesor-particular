import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

/* El archivo sin sus comentarios.
 *
 * Hace falta porque estos tests buscan etiquetas en el código, y los comentarios
 * de este proyecto EXPLICAN el bug —«como <h3> producía un salto…»—. Sin quitar
 * los comentarios, el test se dispara con la explicación de por qué el problema
 * ya no está, que es el peor falso positivo posible: el que aparece justo cuando
 * alguien documenta bien. Ya pasó una vez, en el test de testimonios. */
const sinComentarios = (fuente) => fuente
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/* LA JERARQUÍA DE ENCABEZADOS.
 *
 * Cuatro de las siete páginas saltaban de h1 a h3 sin pasar por h2: la portada,
 * /materias, /como-trabajo y /contacto. No se ve mirando la pantalla —el diseño
 * queda idéntico— y por eso vivió meses. Quien navega con lector de pantalla sí
 * lo nota: se anuncia el salto de nivel y la persona asume que se perdió una
 * sección entera y vuelve a buscarla.
 *
 * POR QUÉ ESTOS TESTS MIRAN EL CÓDIGO FUENTE Y NO EL DOM.
 *
 * La verificación de verdad se hizo en el navegador, en producción, recorriendo
 * las siete rutas. Pero CI no tiene navegador, y sin nada acá el arreglo dura
 * hasta el próximo componente que alguien copie y pegue de otro.
 *
 * Así que esto no intenta reconstruir el árbol de encabezados —sería frágil y
 * mentiroso—. Fija las CUATRO decisiones concretas que resolvieron el problema,
 * cada una con su motivo. Si alguien las revierte, falla algo con un nombre que
 * explica qué se rompió.
 */

test("los números de la portada no son encabezados", () => {
  /* "años dando clases" es la etiqueta del número que tiene arriba, no el título
     de una sección. Como <h3> hacía dos cosas mal a la vez: el salto h1→h3, y
     —peor— metía cuatro entradas sin sentido al principio del índice del
     documento, por delante de todas las secciones reales. Un lector de pantalla
     que navega por encabezados se encontraba primero con "años dando clases".
     La región ya tiene nombre: la <section> lleva aria-label="En números". */
  const fuente = sinComentarios(leer("../src/components/Credentials.jsx"));
  assert.doesNotMatch(fuente, /<h[1-6]/, "Credentials volvió a usar encabezados para los stats");
  assert.match(
    leer("../src/components/Credentials.jsx"),
    /aria-label="En números"/,
    "la región tiene que seguir nombrada",
  );
});

test("los pasos del método reciben su nivel de quien los monta", () => {
  /* El mismo componente vive en dos profundidades:
       Inicio         h1 → h2 ("El mismo recorrido") → PASOS   => h3
       /como-trabajo  h1 ("Un método, no improvisación") → PASOS => h2
     Con un nivel fijo, una de las dos siempre queda mal. Por eso es un prop. */
  const componente = sinComentarios(leer("../src/components/MethodSteps.jsx"));
  assert.match(componente, /nivelDeTitulo = 3/, "el default tiene que seguir siendo 3 (el Inicio)");
  assert.doesNotMatch(componente, /<h3 className="display display--md ms-title"/, "volvió el h3 fijo");

  const metodo = leer("../src/pages/Method.jsx");
  assert.match(
    metodo,
    /<MethodSteps nivelDeTitulo=\{2\} \/>/,
    "/como-trabajo tiene que pedir nivel 2: sus pasos cuelgan directo del h1",
  );

  const inicio = leer("../src/pages/Home.jsx");
  assert.match(inicio, /<MethodSteps compacto \/>/, "el Inicio usa el default, que es 3");
});

test("las tarjetas de /materias son h2, y los niveles siguen en h3", () => {
  /* El encabezado de la sección 01 ES el h1 de la página (SectionHead as="h1"),
     así que sus hijos directos son de segundo nivel. La sección 02 sí tiene su
     propio h2, y ahí los niveles van bien en h3: la diferencia es el punto. */
  const fuente = sinComentarios(leer("../src/pages/Subjects.jsx"));
  assert.match(fuente, /<h2 className="display display--md subj-card-name"/, "las tarjetas volvieron a h3");
  assert.match(fuente, /<h2>Doy muchas más materias<\/h2>/);
  assert.match(fuente, /<h3>\{l\.label\}<\/h3>/, "los niveles de la sección 02 tienen que quedarse en h3");
});

test("/contacto no tiene ningún h3", () => {
  /* Sus cinco títulos —el bloque de reservar, WhatsApp, Email, Clases
     presenciales y el formulario— son hermanos que cuelgan del único h1. */
  const fuente = sinComentarios(leer("../src/pages/Contact.jsx"));
  assert.doesNotMatch(fuente, /<h3/, "volvió un h3 a /contacto");
});

test("el estilo no quedó atado a la etiqueta que se cambió", () => {
  /* La trampa de arreglar jerarquías: el CSS apuntaba a `.subj-extra h3` y al
     pasar el marcado a h2 el bloque se quedaba sin estilo, en silencio. El
     selector ahora acepta los dos, así que el diseño no depende del nivel. */
  const css = leer("../src/pages/Inner.css");
  assert.match(css, /\.subj-extra h2,\s*\r?\n\s*\.subj-extra h3/);
});
