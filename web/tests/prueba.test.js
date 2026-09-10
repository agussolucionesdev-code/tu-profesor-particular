import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HECHOS,
  NOTA_TESTIMONIOS,
  PRUEBA,
  TESTIMONIOS,
  hayTestimonios,
  problemasDelTestimonio,
} from "../src/data/prueba.js";
import { REASONS } from "../src/data/site.js";

const fuenteHome = readFileSync(new URL("../src/pages/Home.jsx", import.meta.url), "utf8");

/* LA PRUEBA, Y SOBRE TODO LO QUE NO SE PUEDE PUBLICAR.
 *
 * Estos tests cuidan dos cosas distintas y hay que no confundirlas:
 *
 * 1. Que nunca se publique un testimonio sin permiso registrado. Un descuido acá no
 *    es un bug de UI: es publicar las palabras de una persona sin haberle preguntado,
 *    y si esa persona es la madre de un menor, es peor.
 *
 * 2. Que la sección no se convierta en marketing. El día que alguien tenga apuro, la
 *    tentación va a ser agregar un hecho que suene bien y no se pueda comprobar.
 *
 * EL PUNTO IMPORTANTE DE DISEÑO: la lista de testimonios está vacía hoy, así que
 * recorrerla no prueba nada —pasaría igual con el validador roto—. Por eso el
 * validador se prueba contra CASOS FALSOS armados acá, y aparte se corre sobre la
 * lista real. El primero garantiza que el validador funciona; el segundo, que la
 * lista real lo cumple. Los dos juntos son lo que hace que esto sirva.
 */

/* ── Casos falsos, para probar el validador ─────────────────────────────────
   Son inventados a propósito y viven sólo acá dentro. Nada de esto se publica. */
const TESTIMONIO_VALIDO = Object.freeze({
  texto: "Mi hijo pasó de llevarse matemática a aprobar el trimestre con siete.",
  quien: "Mamá de un alumno de secundaria",
  nombre: null,
  permiso: Object.freeze({
    fecha: "2026-01-15",
    canal: "WhatsApp",
    alcance: "el texto, sin nombre",
  }),
});

test("el validador acepta un testimonio bien cargado", () => {
  /* Sin esto, un validador que rechaza TODO también pasaría los tests de abajo y
     el sistema quedaría imposible de usar el día que llegue un testimonio real. */
  assert.deepEqual(problemasDelTestimonio(TESTIMONIO_VALIDO), []);
});

test("sin permiso registrado, no se publica", () => {
  // La regla que justifica todo el archivo.
  const { permiso, ...sinPermiso } = TESTIMONIO_VALIDO;
  assert.ok(permiso, "la fixtura tiene que tener permiso para que esto pruebe algo");

  const problemas = problemasDelTestimonio(sinPermiso);
  assert.ok(
    problemas.some((p) => /permiso/i.test(p)),
    `tendría que rechazarlo por falta de permiso, dijo: ${problemas.join(" / ")}`,
  );
});

test("un permiso sin fecha, sin canal o sin alcance no alcanza", () => {
  /* «Me dijo que sí» no es un permiso registrado. Si no se puede decir cuándo y por
     dónde, dentro de un año no hay forma de sostenerlo. */
  for (const campo of ["fecha", "canal", "alcance"]) {
    const permiso = { ...TESTIMONIO_VALIDO.permiso, [campo]: "" };
    const problemas = problemasDelTestimonio({ ...TESTIMONIO_VALIDO, permiso });
    assert.ok(
      problemas.some((p) => p.includes(campo)),
      `tendría que quejarse de permiso.${campo}`,
    );
  }
});

test("autorizar el texto NO es autorizar el nombre", () => {
  /* El error más fácil y más caro: la persona autoriza que publiques lo que
     escribió, y aparece publicada con nombre y apellido.

     Este test volteó la primera versión del validador, que buscaba la palabra
     "nombre" dentro de `permiso.alcance`: la fixtura dice «el texto, sin nombre»
     —que es el caso MÁS común— y contenía la palabra, así que pasaba el control
     y publicaba el nombre. Por eso ahora la autorización es una bandera
     explícita y no algo que se deduce leyendo prosa. */
  const conNombre = { ...TESTIMONIO_VALIDO, nombre: "Carolina" };
  const problemas = problemasDelTestimonio(conNombre);
  assert.ok(
    problemas.some((p) => /nombre/i.test(p)),
    `tendría que rechazar el nombre sin autorización explícita: ${problemas.join(" / ")}`,
  );

  /* Y el caso que hay que sostener: un `alcance` que NOMBRA el nombre para
     negarlo no puede alcanzar para publicarlo. */
  assert.ok(
    problemasDelTestimonio({
      ...conNombre,
      permiso: { ...TESTIMONIO_VALIDO.permiso, alcance: "el texto, sin nombre" },
    }).length > 0,
    "«sin nombre» no puede leerse como autorización del nombre",
  );

  // Con la bandera explícita, pasa.
  assert.deepEqual(
    problemasDelTestimonio({
      ...conNombre,
      permiso: {
        ...TESTIMONIO_VALIDO.permiso,
        alcance: "el texto y su nombre de pila",
        incluyeNombre: true,
      },
    }),
    [],
  );
});

test("`nombre` ausente no es lo mismo que `nombre: null`", () => {
  /* Ausente significa "nadie se lo preguntó"; `null` significa "se preguntó y dijo
     que no". Confundirlos es cómo alguien termina publicando un nombre "porque no
     decía que no". */
  const { nombre, ...sinClave } = TESTIMONIO_VALIDO;
  assert.equal(nombre, null);
  assert.ok(problemasDelTestimonio(sinClave).some((p) => /nombre/i.test(p)));
});

test("un testimonio vacío o de dos palabras no pasa", () => {
  assert.ok(problemasDelTestimonio(null).length > 0);
  assert.ok(problemasDelTestimonio({}).length > 0);
  assert.ok(
    problemasDelTestimonio({ ...TESTIMONIO_VALIDO, texto: "Muy bueno" }).length > 0,
    "un texto de dos palabras es un campo pegado a medias, no un testimonio",
  );
});

test("todos los testimonios publicados cumplen la regla", () => {
  /* Hoy la lista está vacía y esto no prueba nada — por eso están los casos falsos
     de arriba. Empieza a proteger el día que alguien agregue el primero, que es
     justamente el día en que nadie va a estar mirando este archivo. */
  for (const [i, t] of TESTIMONIOS.entries()) {
    assert.deepEqual(
      problemasDelTestimonio(t),
      [],
      `el testimonio ${i + 1} no se puede publicar: ${problemasDelTestimonio(t).join(" / ")}`,
    );
  }
});

test("no hay testimonios de muestra comentados esperando a que alguien los descomente", () => {
  /* El modo de falla clásico: dejar dos ejemplos "de muestra" comentados en el
     archivo para que se vea el formato, y que dentro de seis meses alguien los
     descomente creyendo que son reales. Un testimonio falso publicado no es un bug
     de formato: es una mentira con la cara de un alumno.

     La primera versión de este test buscaba «cinco estrellas» y «Mariana G.» en
     todo el archivo, y se rompió sola: el encabezado usa esos ejemplos justamente
     para explicar por qué NO se hace. Buscar palabras sueltas en un archivo que
     habla de esas palabras no puede funcionar.

     Lo que se busca ahora es la estructura: una línea COMENTADA que declare los
     campos de un testimonio. Prosa explicando el problema no lo dispara; un objeto
     comentado listo para descomentar, sí. */
  const fuente = readFileSync(new URL("../src/data/prueba.js", import.meta.url), "utf8");
  const comentadas = fuente
    .split("\n")
    .filter((linea) => /^\s*(\/\/|\*|\/\*)/.test(linea))
    .filter((linea) => /\b(texto|permiso|quien)\s*:/.test(linea));

  assert.deepEqual(
    comentadas,
    [],
    `hay campos de testimonio comentados, listos para descomentarse:\n${comentadas.join("\n")}`,
  );
});

test("hayTestimonios dice la verdad", () => {
  // De esto depende que la sección no renderice un título con nada abajo.
  assert.equal(hayTestimonios(), TESTIMONIOS.length > 0);
});

test("los hechos son cuatro y todos tienen dato y detalle", () => {
  assert.ok(HECHOS.length >= 4);
  for (const h of HECHOS) {
    assert.ok(String(h.dato ?? "").trim(), "un hecho sin dato no dice nada");
    assert.ok(String(h.detalle ?? "").trim(), "un hecho sin detalle no se puede verificar");
  }
});

test("los hechos no prometen nada que no se pueda comprobar", () => {
  /* La sección se llama "lo que se puede verificar". El día que alguien agregue
     "cientos de alumnos satisfechos", deja de ser cierto el título entero. */
  const texto = JSON.stringify(HECHOS).toLocaleLowerCase("es-AR");
  for (const prohibido of [
    "cientos",
    "miles",
    "satisfech",
    "garantiz",
    "el mejor",
    "líder",
    "%",
  ]) {
    assert.ok(
      !texto.includes(prohibido),
      `"${prohibido}" es una promesa que no se puede comprobar`,
    );
  }
});

test("el primer hecho es el único que es comportamiento de otras personas", () => {
  /* Va primero porque es lo más cerca de prueba social que hay hoy, y porque es lo
     que casi nadie puede decir: gente que volvió años después sin obligación. */
  assert.match(HECHOS[0].dato, /volvieron/i);
  assert.match(HECHOS[0].dato, /cuatro y cinco años/i);
});

test("la sección entera habla en primera persona", () => {
  /* El lead dice «No hace falta que me creas». Si los hechos dicen «Empezó» y
     «Mira el caso», queda un bloque que habla DE Agustín en medio de una página
     donde Agustín habla, y se nota como un pegote de otra fuente.

     No se detectó leyendo el archivo: se vio recién con la sección renderizada.
     Por eso queda fijado acá — la próxima persona que agregue un hecho va a
     escribirlo en tercera sin darse cuenta, igual que yo. */
  const texto = JSON.stringify([HECHOS, PRUEBA.lead, NOTA_TESTIMONIOS]);
  for (const tercera of [
    "Empezó",
    "Mira el caso",
    "no puede ayudarte",
    "lo dice —",
    "te ahorra",
    "Recibido en",
  ]) {
    assert.ok(!texto.includes(tercera), `"${tercera}" está en tercera persona`);
  }

  // Y las marcas de que sí está en primera.
  assert.match(JSON.stringify(HECHOS), /Empecé/);
  assert.match(JSON.stringify(HECHOS), /Me recibí/);
});

test("la formación se declara como está, no como va a estar", () => {
  /* Misma regla que en `voz.test.js`: sus palabras fueron «a tres materias y un
     final». Acá el riesgo es peor que allá, porque esta sección se llama "lo que se
     puede verificar" — anunciar un título que todavía no tiene la desarma entera. */
  const formacion = HECHOS.find((h) => /profesor universitario/i.test(h.dato));
  assert.ok(formacion, "falta el hecho de la formación");
  assert.match(formacion.detalle, /a tres materias y un final/i);
  assert.doesNotMatch(
    `${formacion.dato} ${formacion.detalle}`,
    /diciembre|20\d\d|por recibirse|próximo a recibirse/i,
  );
});

test("ningún hecho repite lo que ya dice otra sección de la misma página", () => {
  /* Repetir «sin pagos por adelantado» dos secciones después de las condiciones de
     trabajo no refuerza: rellena, y el lector lo lee como que no había con qué
     llenar la sección. REASONS es la fuente de esas condiciones. */
  const hechos = JSON.stringify(HECHOS).toLocaleLowerCase("es-AR");
  for (const razon of REASONS) {
    const titulo = razon.title.toLocaleLowerCase("es-AR");
    assert.ok(
      !hechos.includes(titulo),
      `"${razon.title}" ya está publicado en las condiciones de trabajo`,
    );
  }
});

test("la nota sobre los testimonios no promete una fecha", () => {
  /* «Muy pronto» es una promesa que vence sola. La nota promete un MÉTODO —cuando
     alguien autorice— y eso no se puede incumplir por el paso del tiempo. */
  const texto = NOTA_TESTIMONIOS.texto.toLocaleLowerCase("es-AR");
  for (const prohibido of ["pronto", "en breve", "próximamente", "estamos trabajando"]) {
    assert.ok(!texto.includes(prohibido), `"${prohibido}" es una promesa con fecha de vencimiento`);
  }
  assert.match(NOTA_TESTIMONIOS.texto, /no voy a inventar/i);
});

test("la portada renderiza la prueba y no la deja escrita sin usar", () => {
  // Sin esto, todos los tests de arriba pasan con la página sin un solo cambio.
  assert.ok(fuenteHome.includes("PRUEBA"), "Home.jsx no está usando PRUEBA");
});

test("la sección está armada para no dejar un hueco cuando no hay testimonios", () => {
  /* Un `<h2>Testimonios</h2>` con nada abajo es peor que no tener la sección. El
     render tiene que estar condicionado. */
  assert.ok(
    /hayTestimonios\(\)|TESTIMONIOS\.length/.test(fuenteHome),
    "el bloque de testimonios se renderiza sin preguntar si hay alguno",
  );
});

test("PRUEBA expone todo lo que la sección necesita", () => {
  assert.equal(PRUEBA.hechos, HECHOS);
  assert.equal(PRUEBA.nota, NOTA_TESTIMONIOS);
  for (const campo of ["kicker", "title", "lead"]) {
    assert.ok(String(PRUEBA[campo] ?? "").trim(), `falta ${campo}`);
  }
});
