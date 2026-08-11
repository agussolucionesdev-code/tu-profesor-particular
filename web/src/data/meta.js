import { BRAND, CONTACT } from "./site.js";

export const SITIO = "https://tuprofesorparticular.com.ar";
export const IMAGEN_POR_DEFECTO = `${SITIO}/og-cover.png`;

/* Metadatos de cada ruta, en un solo lugar.

   Estaban escritos dentro de cada página, en la llamada a usePageMeta. Eso
   alcanzaba mientras los escribiera React en el navegador, pero el prerender
   corre en Node —sin DOM y sin ejecutar effects—, así que necesita leerlos
   antes de renderizar. Con los textos acá, el cliente y el script de build usan
   exactamente los mismos: no hay forma de que uno diga una cosa y el otro otra.

   El orden importa: `prerender.mjs` recorre estas claves para saber qué rutas
   generar, así que agregar una entrada acá es todo lo que hace falta para que
   una página nueva salga prerenderizada. */
export const META_POR_RUTA = {
  "/": {
    title:
      "Tu Profesor Particular · Agustín Elías Sosa | Clases particulares en Temperley y online",
    description:
      "Clases particulares de Matemáticas, Física, Fisicoquímica, Química e Inglés. Online y presenciales en Temperley. Desde primaria hasta universitario, sin pagos por adelantado.",
  },
  "/sobre-mi": {
    title: "Sobre mí · Agustín Elías Sosa | Tu Profesor Particular",
    description: `Profesor particular con más de ${BRAND.yearsTeaching} años de experiencia. Clases de Matemáticas, Física, Química e Inglés en Temperley y online.`,
  },
  "/materias": {
    title: "Materias y niveles · Tu Profesor Particular",
    description:
      "Matemáticas, Física, Fisicoquímica, Química e Inglés, y más materias a consultar. Desde primaria hasta universitario, incluida secundaria técnica.",
  },
  "/como-trabajo": {
    title: "Cómo trabajo · Tu Profesor Particular",
    description:
      "Primera clase de diagnóstico, plan concreto, clases con orden y seguimiento del avance. Así se trabaja en Tu Profesor Particular.",
  },
  "/contacto": {
    title: "Contacto · Tu Profesor Particular",
    description: `Escribime por WhatsApp al ${CONTACT.whatsappDisplay} o por email. Clases presenciales en ${CONTACT.addressLine} y online para toda Argentina.`,
  },
  /* Va acá, y no como un caso aparte, para que se prerenderice y tenga su propio
     canonical: alguien que busca "cómo manejan mis datos" tiene que poder
     encontrarla, y quien la comparte tiene que ver la vista previa correcta. */
  "/privacidad": {
    title: "Privacidad y datos personales · Tu Profesor Particular",
    description:
      "Qué datos se piden al reservar una clase, para qué se usan, quién más los ve y cómo pedir que se corrijan o se borren.",
  },
};

/* El 404 va aparte de META_POR_RUTA porque no es una ruta del sitio: no entra al
   sitemap y su <head> se arma distinto —noindex, sin canonical y sin Open
   Graph—. Sí se prerenderiza, pero a `dist/404.html`, que es el archivo que
   Vercel sirve con status 404 para cualquier ruta inexistente. */
export const META_404 = {
  title: "Página no encontrada · Tu Profesor Particular",
  description:
    "La página que buscabas no existe. Volvé al inicio para ver materias, niveles y reservar tu clase.",
};

export const urlDe = (ruta) => (ruta === "/" ? `${SITIO}/` : `${SITIO}${ruta}`);
