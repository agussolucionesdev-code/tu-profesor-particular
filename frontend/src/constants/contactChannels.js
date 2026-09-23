/* Los canales por donde alguien puede llegar a Agustín. Fuente única de verdad.
 *
 * ANTES ESTO ERAN VARIABLES DE ENTORNO, y por eso este archivo existe.
 *
 * Las URLs de los perfiles se leían de `import.meta.env.VITE_INSTAGRAM_URL` y
 * compañía. No son secretos: son perfiles públicos. Lo único que aportaba esa
 * indirección era una forma de equivocarse que nadie podía ver, y se materializó:
 * producción estuvo apuntando a `instagram.com/agustinsosa.profe`, un perfil que no
 * es el de Agustín. No falló el build, no falló ningún test, no hubo aviso. El valor
 * vivía en un panel de Vercel que nadie revisa en un code review.
 *
 * Acá, en cambio, cambiar un perfil es un diff que alguien lee.
 *
 * El número de WhatsApp también vive acá porque estaba repetido a mano en este
 * proyecto, y alcanzaba con olvidarse de uno para dejar un teléfono viejo en
 * producción. Ya pasó: cuando el número cambió a 3336-5937 se actualizó en los diez
 * archivos del repo, pero la variable de entorno del servidor quedó con el viejo y los
 * mails siguieron mandando el número anterior durante SEMANAS, sin que nada fallara
 * ni avisara (ver el comentario de `backend/src/config/mailer.js`).
 *
 * ESTE ARCHIVO NO ALCANZÓ POR SÍ SOLO. Se creó, se migró el pie de página, se escribió
 * un test llamado «una sola fuente de verdad»… y otros cinco archivos siguieron con el
 * número escrito a mano, porque ese test miraba únicamente el pie. Una constante no
 * centraliza nada si nadie la usa: lo que lo garantiza es el test que ahora barre todo
 * `src/` y nombra al archivo que se salga de la línea.
 *
 * Espeja el criterio de `web/src/data/site.js`, que hace exactamente esto en el sitio
 * institucional. Son tres proyectos con bundles separados —turnos, sitio y backend— que
 * no pueden importarse entre sí, así que en el repo hay tres literales del número y
 * ninguno más.
 */

/* Con extensión: este módulo lo carga `node --test` sin pasar por Vite, y el
   resolver de Node no completa extensiones. */
import { isConfiguredSocialUrl } from "../utils/socialUrl.js";

/* El sitio institucional. Es el otro dominio de la misma marca, y desde turnos se
   enlaza en un solo caso: cuando alguien quiere seguir leyendo a Agustín. El desarrollo
   largo de su voz vive allá, en `/sobre-mi`; acá sólo entra el fragmento que ayuda a
   decidir. Duplicar el contenido haría competir a las dos páginas por lo mismo. */
export const SITIO_INSTITUCIONAL = "https://tuprofesorparticular.com.ar";
export const SOBRE_MI_URL = `${SITIO_INSTITUCIONAL}/sobre-mi`;

export const WHATSAPP_NUMBER = "5491133365937";
export const WHATSAPP_DISPLAY = "+54 9 11 3336-5937";
export const CONTACT_EMAIL = "agustinsosa.profe@gmail.com";

/* El email partido en la arroba, para poder marcar ahí el punto de corte con `<wbr>`.
 *
 * Es la cadena más larga que muestra el pie —27 caracteres sin un solo espacio— y en
 * una columna angosta el navegador la parte donde le toca: "agustinsosa.profe@gm /
 * ail.com" se lee como un error de tipeo, no como una dirección. Marcando la arroba se
 * parte en "agustinsosa.profe@ / gmail.com", que sigue siendo legible.
 *
 * El corte va en la PRIMERA arroba, que es la que separa usuario de dominio. */
const [usuario, dominio = ""] = CONTACT_EMAIL.split("@");
export const CONTACT_EMAIL_USER = usuario;
export const CONTACT_EMAIL_DOMAIN = dominio;

/* El enlace pelado, sin mensaje. Lo usa el JSON-LD: ahi `sameAs` declara DONDE
   esta Agustin, no que decirle, y un `?text=` en un dato estructurado ensucia lo
   que leen los buscadores. */
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

/* Un wa.me con el mensaje ya escrito. Que el mensaje venga puesto no es un detalle
   estético: quien abre WhatsApp sin saber qué decir muchas veces cierra sin escribir. */
export const waLink = (mensaje) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;

export const WHATSAPP_DEFAULT_MESSAGE =
  "Hola Agustín, vengo desde tu sitio de turnos y quiero hacerte una consulta.";

/* Los perfiles, en el orden en que se muestran.
 *
 * Facebook queda comentado a propósito y no borrado: la página todavía no existe, y
 * cuando exista esto es una línea. Dejar la URL pelada (`facebook.com`) cargada
 * "para después" es peor que no tenerla —manda a la portada de Facebook, no a
 * Agustín— y de hecho es lo que pasaba: `isConfiguredSocialUrl` la venía ocultando
 * en silencio y nadie sabía por qué faltaba el ícono. */
const PERFILES = [
  {
    id: "instagram",
    label: "Instagram",
    detalle: "@tuprofesor.ar",
    href: "https://www.instagram.com/tuprofesor.ar/",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    detalle: "Agustín Elías Sosa",
    href: "https://www.linkedin.com/in/agustin-sosa",
  },
  /* Cuando exista la página: descomentar y poner su URL. El pie ya tiene el logo
     oficial y el estilo listos, así que aparece sola. */
  // { id: "facebook", label: "Facebook", detalle: "Tu Profesor Particular", href: "https://www.facebook.com/<pagina>" },
];

/* Se sigue pasando por el guard aunque las URLs ahora sean literales: es la red que
   impide publicar un enlace a la portada de una red social en lugar de a un perfil.
   Cuesta nada y ya atrapó un error real. */
export const SOCIAL_PROFILES = Object.freeze(
  PERFILES.filter((perfil) => isConfiguredSocialUrl(perfil.href)).map((perfil) =>
    Object.freeze(perfil),
  ),
);
