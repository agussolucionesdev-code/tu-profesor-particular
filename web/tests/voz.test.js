import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  A_UNA_MADRE,
  COMO_COBRO,
  COMO_EXPLICO,
  EL_CASO,
  FORMACION,
  LA_AUTONOMIA,
  LO_QUE_SE_ESCUCHAN,
  POR_QUE_ENSENO,
  PRIMERA_CLASE,
} from "../src/data/voz.js";
import { BRAND, SUBJECTS } from "../src/data/site.js";

const fuenteVoz = readFileSync(new URL("../src/data/voz.js", import.meta.url), "utf8");
const fuenteAbout = readFileSync(new URL("../src/pages/About.jsx", import.meta.url), "utf8");

/* La voz de Agustín, y sobre todo los LÍMITES que él puso.
 *
 * Estos tests existen porque el material salió de audios donde contó cosas que
 * explícitamente pidió no publicar, y cosas sobre terceras personas de las que no
 * tiene consentimiento. Un descuido acá no es un bug: es exponer a alguien.
 *
 * Lo que protegen, en orden de gravedad:
 *
 * 1. Que no se publique ningún dato que identifique a una alumna menor de edad.
 * 2. Que no se publique lo que pidió explícitamente dejar afuera.
 * 3. Que no se inventen credenciales ni se anuncie un título que todavía no tiene.
 * 4. Que las cifras verificables sean las correctas.
 */

const todoElTexto = JSON.stringify([
  POR_QUE_ENSENO,
  LA_AUTONOMIA,
  COMO_EXPLICO,
  PRIMERA_CLASE,
  EL_CASO,
  A_UNA_MADRE,
  COMO_COBRO,
  FORMACION,
  LO_QUE_SE_ESCUCHAN,
]).toLocaleLowerCase("es-AR");

test("no publica nada que identifique a la alumna del caso", () => {
  /* Agustín pidió no dar nombres porque no tiene el consentimiento, y pidió no
     publicar lo de psicología y psiquiatría. El bullying no lo prohibió, pero se sacó
     igual: es un dato sensible de una menor y es lo que más la haría reconocerse si
     entra a la página. Él mismo dijo «no quiero poner el caso exacto porque si entra a
     mi página y lo ve, se da cuenta». */
  for (const prohibido of [
    "sofía",
    "sofia",
    "tommy",
    "tomi",
    "psicolog",
    "psiquiatr",
    "bullying",
    "acoso",
  ]) {
    assert.ok(
      !todoElTexto.includes(prohibido),
      `"${prohibido}" no puede aparecer publicado: identifica o expone a una menor`,
    );
  }
});

test("no publica el caso de las siete horas y media", () => {
  /* Lo contó como ejemplo de su compromiso, y lo es. Pero leído por una madre que no
     lo conoce dice otra cosa: un menor con estrés fuerte, sin comer, pidiendo que lo
     vinieran a buscar. Además expone a una familia identificable. */
  for (const prohibido of ["siete horas", "7 horas", "esquelétic", "esqueletic"]) {
    assert.ok(!todoElTexto.includes(prohibido), `"${prohibido}" no se publica`);
  }
});

test("no publica las carreras que empezó y dejó", () => {
  // Textual suyo: "esto te aclaro que no lo pongas en lo que vendría a ser mi página".
  for (const prohibido of ["alimentos", "profesorado de química", "unla"]) {
    assert.ok(!todoElTexto.includes(prohibido), `"${prohibido}" lo pidió dejar afuera`);
  }
});

test("no anuncia un título que todavía no tiene", () => {
  /* Sus palabras fueron «está a tres materias y un final». También dijo que en
     diciembre "estaría" recibiéndose — condicional, y una fecha se corre. Una
     credencial anunciada y no cumplida hace más daño que una que no se anunció. */
  const profesor = FORMACION.find((f) => f.titulo.includes("Profesor Universitario"));
  assert.ok(profesor, "falta la formación en curso");
  assert.match(profesor.detalle, /a tres materias y un final/i);
  assert.doesNotMatch(JSON.stringify(FORMACION), /diciembre|20\d\d/i);
});

test("las citas son textuales y no se pulieron a lenguaje de folleto", () => {
  /* «Me llena enseñar» no se cambia por «siento una profunda vocación docente»: lo
     segundo lo escribe cualquiera, lo primero lo dijo él. La repetición triple es de
     él y se conserva entera. */
  const primera = POR_QUE_ENSENO.parrafos[0].cita;
  assert.equal(primera, "Me fascina enseñar. Me apasiona enseñar. Me llena enseñar.");
});

test("la frase que más pesa está publicada tal cual la dicen los alumnos", () => {
  // Es el material más valioso: quien lo lee ya se lo escuchó decir a su hijo.
  assert.ok(LO_QUE_SE_ESCUCHAN.includes("No me da la cabeza."));
  assert.ok(LO_QUE_SE_ESCUCHAN.length >= 3);
});

test("la autonomía está declarada como meta, con su prueba al lado", () => {
  /* Es el diferencial contracomercial y lo único que no se puede copiar. Sin la
     prueba —volvieron a los cuatro y cinco años— sería una frase más. */
  assert.match(LA_AUTONOMIA.citas[0], /se libere de mí/i);
  assert.match(LA_AUTONOMIA.prueba, /cuatro y cinco años/i);
});

test("dice cuándo NO puede ayudar", () => {
  /* La cita que más confianza construye de todo el archivo: alguien que avisa cuándo
     no puede es alguien a quien le creés cuando dice que sí. */
  assert.ok(
    A_UNA_MADRE.citas.some((c) => /con la mano en el corazón/i.test(c)),
    "falta la frase que dice que avisa cuando no puede ayudar",
  );
});

test("el caso publica MÉTODO verificable, no emoción", () => {
  /* Lo que hace creíble al caso no es lo que se sintió: son los pasos concretos, que
     además se pueden contrastar en la primera clase. */
  const metodo = EL_CASO.metodo.join(" ").toLocaleLowerCase("es-AR");
  assert.ok(metodo.includes("lapicera"), "falta el detalle de los resultados en lapicera");
  assert.ok(
    metodo.includes("método que da el profesor"),
    "falta el detalle de seguir el método del profesor del colegio",
  );
  assert.ok(EL_CASO.metodo.length >= 5);
});

test("los años de experiencia son diez, no ocho", () => {
  /* Empezó a los 17 y tiene 27: el número se deriva de dos datos que él dio, no de
     que alguien se acuerde. Decía 8 y subdeclaraba dos años. */
  assert.equal(BRAND.yearsTeaching, 10);
});

test("Inglés ya no promete conversación", () => {
  /* Estuvo publicado «el miedo a hablar se trabaja» y «práctica oral», cuando él dice
     textualmente que NO enseña a hablar inglés. Era una reserva que después había que
     cancelar. */
  const ingles = SUBJECTS.find((s) => s.label === "Inglés");
  assert.ok(ingles, "falta la materia Inglés");
  const texto = `${ingles.tagline} ${ingles.hook} ${ingles.detail}`.toLocaleLowerCase("es-AR");
  assert.ok(!texto.includes("práctica oral"), "sigue prometiendo práctica oral");
  assert.ok(!texto.includes("miedo a hablar"), "sigue prometiendo trabajar el habla");
  assert.ok(
    texto.includes("no vas a salir hablando"),
    "tiene que aclarar explícitamente que no es conversación",
  );
});

test("la página renderiza la voz y no la deja escrita sin usar", () => {
  /* El modo de falla clásico: escribir el contenido y no montarlo. Sin esto, todos los
     tests de arriba pasarían con la página sin un solo cambio visible. */
  for (const seccion of [
    "POR_QUE_ENSENO",
    "LO_QUE_SE_ESCUCHAN",
    "LA_AUTONOMIA",
    "COMO_EXPLICO",
    "EL_CASO",
    "PRIMERA_CLASE",
    "COMO_COBRO",
    "A_UNA_MADRE",
    "FORMACION",
  ]) {
    assert.ok(fuenteAbout.includes(seccion), `About.jsx no está usando ${seccion}`);
  }
});

test("el archivo deja escrita la regla de que las citas son textuales", () => {
  /* La próxima persona que edite acá va a querer «mejorar» la redacción. La regla
     tiene que estar donde se edita. */
  assert.match(fuenteVoz, /Todo lo que está entre comillas es TEXTUAL/);
});
