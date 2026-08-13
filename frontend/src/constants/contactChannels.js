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
 * El número de WhatsApp también vive acá porque estaba repetido a mano en 7 archivos
 * de este proyecto. La última vez que cambió hubo que tocarlos todos, y alcanzaba con
 * olvidarse de uno para dejar un teléfono viejo en producción.
 *
 * Espeja el criterio de `web/src/data/site.js`, que hace exactamente esto en el sitio
 * institucional.
 */

import { isConfiguredSocialUrl } from "../utils/socialUrl";

export const WHATSAPP_NUMBER = "5491133365937";
export const WHATSAPP_DISPLAY = "+54 9 11 3336-5937";
export const CONTACT_EMAIL = "agustinsosa.profe@gmail.com";

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
    href: "https://www.instagram.com/tuprofesor.ar/",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/agustin-sosa",
  },
  // { id: "facebook", label: "Facebook", href: "https://www.facebook.com/<pagina>" },
];

/* Se sigue pasando por el guard aunque las URLs ahora sean literales: es la red que
   impide publicar un enlace a la portada de una red social en lugar de a un perfil.
   Cuesta nada y ya atrapó un error real. */
export const SOCIAL_PROFILES = Object.freeze(
  PERFILES.filter((perfil) => isConfiguredSocialUrl(perfil.href)).map((perfil) =>
    Object.freeze(perfil),
  ),
);
