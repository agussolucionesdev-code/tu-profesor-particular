import { BRAND, CONTACT } from "./site.js";

export const SITIO = "https://tuprofesorparticular.com.ar";
/* JPEG y no PNG: el PNG pesaba 1,08 MB y WhatsApp tarda en mostrar la tarjeta
   hasta bajarlo entero. WebP no sirve acá: varios bots de vista previa no lo
   leen. */
export const IMAGEN_POR_DEFECTO = `${SITIO}/og-cover.jpg`;

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
    /* `nombre` es cómo se llama la página en las migas de pan de Google. */
    nombre: "Inicio",
    /* Lo que se busca primero y dónde: «clases particulares en Temperley».
       El nombre de Agustín pasa a la descripción, que es donde lo lee quien ya
       lo busca por nombre. Propuesta de ChatGPT, siguiendo la guía de Google
       de títulos descriptivos por página. */
    title: "Clases particulares en Temperley | Tu Profesor Particular",
    description:
      "Clases particulares con Agustín Elías Sosa, online y en Temperley. Matemática, Física, Química, Fisicoquímica e Inglés, desde primaria hasta la facultad.",
  },
  "/sobre-mi": {
    nombre: "Sobre mí",
    title: "Sobre mí · Agustín Elías Sosa | Tu Profesor Particular",
    description: `Profesor particular con más de ${BRAND.yearsTeaching} años de experiencia. Clases de Matemáticas, Física, Química e Inglés en Temperley y online.`,
  },
  "/materias": {
    nombre: "Materias y niveles",
    title: "Materias y niveles · Tu Profesor Particular",
    description:
      "Matemáticas, Física, Fisicoquímica, Química e Inglés, y más materias a consultar. Desde primaria hasta universitario, incluida secundaria técnica.",
  },
  "/como-trabajo": {
    nombre: "Cómo trabajo",
    title: "Cómo trabajo · Tu Profesor Particular",
    description:
      "La primera clase empieza por ver qué está costando. Después, un plan concreto, clases con orden y seguimiento del avance.",
  },
  "/contacto": {
    nombre: "Contacto",
    title: "Contacto · Tu Profesor Particular",
    description: `Escribime por WhatsApp al ${CONTACT.whatsappDisplay} o por email. Clases presenciales en ${CONTACT.addressLine} y online para toda Argentina.`,
  },
  /* Va acá, y no como un caso aparte, para que se prerenderice y tenga su propio
     canonical: alguien que busca "cómo manejan mis datos" tiene que poder
     encontrarla, y quien la comparte tiene que ver la vista previa correcta. */
  "/privacidad": {
    nombre: "Privacidad",
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
