import assert from "node:assert/strict";
import test from "node:test";
import { BRAND, SOCIAL } from "../src/data/site.js";
import {
  A_UNA_MADRE,
  COMO_EXPLICO,
  LA_AUTONOMIA,
  LO_QUE_SE_ESCUCHAN as LO_QUE_SE_ESCUCHAN_WEB,
} from "../src/data/voz.js";
import {
  ANOS_ENSENANDO,
  AUTONOMIA_CITA,
  AUTONOMIA_PRUEBA,
  LO_QUE_SE_ESCUCHAN as LO_QUE_SE_ESCUCHAN_TURNOS,
  METODO_CITA,
  NO_PUEDO_AYUDARTE,
} from "../../frontend/src/constants/voz.js";
import { SOCIAL_PROFILES } from "../../frontend/src/constants/contactChannels.js";

/* LOS DOS DOMINIOS TIENEN QUE DECIR LO MISMO.
 *
 * Este es el único test del repositorio que cruza los dos proyectos, y existe por un
 * error concreto que ya ocurrió en producción:
 *
 *   `tuprofesorparticular.com.ar` decía una cantidad de años.
 *   `turnos.tuprofesorparticular.com.ar` decía «+8», escrito a mano en dos lugares.
 *
 * Dos sitios de la misma marca contradiciéndose sobre el dato más fácil de verificar
 * que tiene. Nadie lo iba a notar desde adentro: hay que abrir las dos pestañas al lado
 * y compararlas, y eso no lo hace nadie nunca.
 *
 * Por eso la verificación es automática. `web/` y `frontend/` son proyectos separados
 * sin paquete compartido, así que el texto está duplicado a propósito —está justificado
 * en el encabezado de los dos archivos— pero la duplicación deja de ser un riesgo desde
 * el momento en que hay un test que la vigila.
 *
 * CI corre esto ANTES del build del sitio institucional, así que una divergencia frena
 * el deploy en lugar de publicarse.
 *
 * Funciona porque `actions/checkout` trae el repositorio entero y sólo después entra a
 * `web/`: el import relativo a `../../frontend/` resuelve igual en CI que en local.
 */

test("los dos dominios dicen los mismos años de experiencia", () => {
  assert.equal(
    ANOS_ENSENANDO,
    BRAND.yearsTeaching,
    "turnos y el sitio institucional no coinciden en los años de experiencia",
  );
  // Ocho, y se lee «más de 8»: lo decidió Agustín el 2026-09-26, cuando lo puso así en
  // la bio de Instagram. Los tres canales tienen que decir el mismo número.
  assert.equal(BRAND.yearsTeaching, 8);
});

test("los dos dominios publican el LinkedIn que Agustín confirmó como suyo", () => {
  /* Los dos sitios publicaban `linkedin.com/in/agustin-sosa`, que no es el enlace que
     Agustín confirmó como suyo el 2026-10-07 (`agustineliassosa`, con la barra final
     tal como él lo pasó). Es el mismo error que ya hubo con Instagram: el perfil de
     otra persona es una URL válida, así que no falló el build ni ningún test.

     Se mide contra el literal y no sólo entre los dos sitios: dos copias que
     coinciden pueden estar equivocadas las dos, y eso fue exactamente lo que pasó.
     Cambiar de perfil a propósito sigue siendo posible; lo que no puede pasar es que
     cambie sin que alguien lea este diff. */
  const LINKEDIN_DE_AGUSTIN = "https://www.linkedin.com/in/agustineliassosa/";
  const enTurnos = SOCIAL_PROFILES.find((perfil) => perfil.id === "linkedin")?.href;

  assert.equal(
    SOCIAL.linkedin,
    LINKEDIN_DE_AGUSTIN,
    "el sitio institucional no publica el LinkedIn de Agustín",
  );
  assert.equal(enTurnos, LINKEDIN_DE_AGUSTIN, "turnos no publica el LinkedIn de Agustín");
});

test("las frases de los alumnos son idénticas en los dos proyectos", () => {
  /* Son el material más potente de la marca. Si se editan en un lado y no en el otro,
     dejan de sonar a lo mismo y una de las dos versiones queda vieja sin que nadie se
     entere. */
  assert.deepEqual(LO_QUE_SE_ESCUCHAN_TURNOS, LO_QUE_SE_ESCUCHAN_WEB);
});

test("la cita de la autonomía es idéntica en los dos proyectos", () => {
  // Es el diferencial del negocio: no puede estar dicho de dos maneras distintas.
  assert.equal(AUTONOMIA_CITA, LA_AUTONOMIA.citas[0]);
  assert.equal(AUTONOMIA_PRUEBA, LA_AUTONOMIA.prueba);
});

test("la cita del método es idéntica en los dos proyectos", () => {
  assert.equal(METODO_CITA, COMO_EXPLICO.citas[0]);
});

test("la frase de cuándo NO puede ayudar es idéntica en los dos proyectos", () => {
  assert.ok(
    A_UNA_MADRE.citas.includes(NO_PUEDO_AYUDARTE),
    "la frase de turnos no coincide con ninguna del sitio institucional",
  );
});

test("ninguna copia se pulió a lenguaje de folleto", () => {
  /* La regla de los dos archivos: lo que está entre comillas es textual. El modo de
     falla más probable no es que alguien borre una cita: es que alguien la «mejore».
     Estas marcas son giros propios de él que un redactor tendería a corregir. */
  assert.match(AUTONOMIA_CITA, /un montón de veces/);
  assert.match(AUTONOMIA_CITA, /justamente se libere de mí/);
  assert.match(METODO_CITA, /de mil maneras distintas/);
  assert.match(NO_PUEDO_AYUDARTE, /con la mano en el corazón/);
});

test("la frase de cuándo NO puede ayudar es textual y marca lo que se editó", () => {
  /* Decía «Yo veo el caso y sé si realmente puedo ayudar. Y si no, lo digo con la
     mano en el corazón.», presentada como cita pero con palabras del audio quitadas
     sin marcar: faltaban «realmente» y los dos «yo», y se había cortado
     «transparentemente». Del tercer audio, textual:

       «Yo veo realmente el caso y yo sé si realmente la puedo ayudar. Y si no lo
       digo con la mano en el corazón, transparentemente […]»

     Normas APA, 7.ª edición: lo que se cambia dentro de una cita va entre corchetes.
     El único cambio es «la puedo» por «[puedo]» —el «la» se refería a la madre con la
     que estaba hablando, y en un formulario le habla a cualquiera—; el resto queda
     como lo dijo. Agustín eligió esta versión, que conserva su expresión, frente a
     otra que la quitaba. */
  assert.equal(
    NO_PUEDO_AYUDARTE,
    "Yo veo realmente el caso y yo sé si realmente [puedo] ayudar. Y si no, lo digo con la mano en el corazón, transparentemente.",
  );
});
