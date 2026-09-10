/* Con `.js` explícito, y hace falta: los tests unitarios corren con
   `node --test` sobre el archivo tal cual, sin pasar por Vite, y el resolver de
   Node no completa extensiones. Sin la extensión, el módulo importa bien en la
   app y revienta con ERR_MODULE_NOT_FOUND al testearlo. */
import { SITIO_INSTITUCIONAL, WHATSAPP_NUMBER } from "./contactChannels.js";

/* ══════════════════════════════════════════════════════════════════════════
   EL MENSAJE CON EL QUE SE PIDE UNA RESEÑA.

   Es la pieza de la que depende todo lo demás. El panel puede listar candidatos
   perfectamente y el sitio puede tener la sección lista: si el mensaje suena a
   plantilla, nadie contesta y la sección de testimonios queda vacía para siempre.

   Se manda desde el WhatsApp de Agustín, por él, a mano. No lo manda el sistema
   —el porqué está en `backend/src/services/reviewCandidatesService.js`—.

   LAS CUATRO DECISIONES DE ESCRITURA, y cada una tiene su motivo:

   1. NO SE PIDE UNA RESEÑA, SE PIDE UN FAVOR CHICO Y CONCRETO. «¿Me dejarías una
      reseña?» le pasa a la otra persona el problema de decidir qué escribir, y
      esa fricción es donde muere el 80% de los pedidos. Por eso el mensaje pide
      "dos o tres renglones" y sugiere sobre qué: cómo estaba antes y cómo está
      ahora. Una pregunta puntual se contesta; una consigna en blanco se posterga.

   2. SE DA LA SALIDA ANTES DE QUE LA PIDAN. «Si no tenés ganas o no es el
      momento, no pasa absolutamente nada» sube la tasa de respuesta en vez de
      bajarla: saca la obligación de encima y deja el sí como una elección. Y en
      este caso además es coherente con todo lo demás que dice el sitio — el tipo
      que avisa cuándo no puede ayudarte no puede presionar por una reseña.

   3. SE PIDE EL PERMISO EN EL MISMO MENSAJE. El permiso para publicar es
      obligatorio (`web/src/data/prueba.js` no acepta un testimonio sin él), así
      que si no se pide acá hay que volver a escribir después, y ese segundo
      mensaje es el que nadie manda nunca. Se pide separado del texto —publicar
      lo que escribió y publicar su nombre son dos permisos distintos—.

   4. NO SE OFRECE NADA A CAMBIO. Ni un descuento, ni una clase. Una reseña
      comprada no es una reseña, en varias plataformas es motivo de baja, y lo
      último que necesita este proyecto es prueba social con un precio atrás.

   LO QUE NO DICE, y es a propósito: no dice "5 estrellas", no dice "ayudanos a
   crecer", no dice "sólo te lleva un minuto". Las tres son marcas de plantilla y
   quien las lee las reconoce al instante.
══════════════════════════════════════════════════════════════════════════ */

const primerNombre = (nombreCompleto) => String(nombreCompleto ?? "")
  .trim()
  .split(/\s+/)[0] || "";

/* Dónde termina la reseña.
 *
 * Hoy es null y el mensaje pide que la contesten por WhatsApp. NO ES UN
 * PROVISORIO PEREZOSO: es el arranque correcto. Las primeras reseñas de un
 * negocio conviene recibirlas por el canal donde la persona ya está —contestar
 * un WhatsApp cuesta cero; abrir Google, iniciar sesión y escribir una reseña
 * cuesta bastante más— y recién con algunas en la mano tiene sentido mandar
 * tráfico a Google.
 *
 * El día que exista el perfil de Google Business hay que pegar acá el enlace
 * corto de "escribir reseña" y el mensaje cambia solo. Ese perfil todavía NO
 * existe: `CONTACT.mapsUrl` del sitio institucional es una búsqueda por
 * dirección (`maps.google.com/?q=...`), que es lo que se escribe justamente
 * cuando no hay un lugar al que enlazar.
 *
 * Crearlo es tarea de Agustín —pide verificación de identidad y demora días— y
 * es, de lejos, lo que más rinde de todo lo que queda pendiente: una reseña en
 * Google se ve en el buscador sin que nadie entre al sitio. */
export const URL_RESENA_GOOGLE = null;

export const hayCanalDeResenaPublico = () => Boolean(URL_RESENA_GOOGLE);

/* El texto. Se arma con el nombre de quien lo recibe y con la materia, porque un
   mensaje que nombra el caso concreto no se puede confundir con un envío masivo
   —y no serlo no alcanza: tiene que no parecerlo—. */
export const mensajeDePedidoDeResena = ({
  nombreContacto = "",
  nombreAlumno = "",
  esResponsable = false,
  materias = [],
} = {}) => {
  const hola = primerNombre(nombreContacto);
  const saludo = hola ? `Hola ${hola}, ¿cómo va?` : "Hola, ¿cómo va?";

  /* A la madre se le habla del hijo; al alumno adulto, de él. Es la misma regla
     que gobierna el wizard de reserva: quien LEE es quien recibe el mensaje. */
  const sujeto = esResponsable && primerNombre(nombreAlumno)
    ? `con ${primerNombre(nombreAlumno)}`
    : "juntos";

  const materia = materias.filter(Boolean)[0];
  const conMateria = materia ? ` con ${materia.toLowerCase()}` : "";

  const donde = URL_RESENA_GOOGLE
    ? `Si te parece, podés dejarla acá: ${URL_RESENA_GOOGLE}`
    : "Con que me lo contestes por acá me alcanza.";

  return [
    saludo,
    "",
    `Te escribo por algo puntual. Estoy armando la página (${SITIO_INSTITUCIONAL.replace("https://", "")}) y todavía no tengo ni un comentario de nadie que haya dado clases conmigo.`,
    "",
    `¿Me escribirías dos o tres renglones sobre cómo venían las cosas${conMateria} antes de que empezáramos ${sujeto} y cómo están ahora? Con eso me alcanza, no hace falta nada largo.`,
    "",
    donde,
    "",
    "Dos cosas: ¿me dejarías publicarlo en la página tal cual me lo escribas? Y avisame si querés que aparezca tu nombre o preferís que no — se puede poner solo \"mamá de un alumno de secundaria\", como quieras.",
    "",
    "Y si no tenés ganas o no es el momento, no pasa absolutamente nada. Gracias igual.",
  ].join("\n");
};

/* El enlace que abre WhatsApp con el mensaje escrito.
 *
 * `telefonoDigits` viene del alumno; si por lo que sea no está, se cae al número
 * de Agustín para que el botón abra su propio chat en vez de romper: prefiere
 * abrir el chat equivocado —que se ve al instante— a un enlace muerto que parece
 * que anduvo. */
export const enlaceDePedidoDeResena = ({ telefonoDigits, ...datos }) => {
  const destino = String(telefonoDigits ?? "").replace(/\D/g, "") || WHATSAPP_NUMBER;
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensajeDePedidoDeResena(datos))}`;
};
