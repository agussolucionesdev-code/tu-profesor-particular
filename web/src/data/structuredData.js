import { BRAND, CONTACT, SUBJECTS, FAQS, BOOKING_RESERVE_URL } from "./site.js";
import { SITIO } from "./meta.js";

/* Datos estructurados para Google.

   Todo sale de site.js, que es información real y verificada. No se declara
   nada que no se pueda sostener: sin `aggregateRating` (no hay reseñas), sin
   `priceRange` (no hay precios publicados), sin `openingHours` (la agenda la
   maneja el sistema de turnos y cambia). Un dato inventado acá es motivo de
   penalización manual, y además sería mentirle a alguien que busca un profesor
   para su hijo.

   Para un negocio local —"clases particulares en Temperley"— LocalBusiness y
   FAQPage son los dos esquemas que más rinden: el primero alimenta el panel
   lateral de Google Maps, el segundo hace que las preguntas aparezcan
   desplegables debajo del resultado. */
export const construirGrafo = () => {
  const idNegocio = `${SITIO}/#negocio`;
  const idPersona = `${SITIO}/#agustin`;

  const persona = {
    "@type": "Person",
    "@id": idPersona,
    name: BRAND.person,
    jobTitle: "Profesor particular",
    description: `Profesor particular con más de ${BRAND.yearsTeaching} años de experiencia en Matemáticas, Física, Química e Inglés.`,
    url: `${SITIO}/sobre-mi`,
    email: CONTACT.email,
    telephone: CONTACT.whatsappDisplay,
    knowsLanguage: "es-AR",
    worksFor: { "@id": idNegocio },
  };

  const negocio = {
    "@type": ["LocalBusiness", "EducationalOrganization"],
    "@id": idNegocio,
    name: BRAND.name,
    description:
      "Clases particulares de Matemáticas, Física, Fisicoquímica, Química e Inglés. Online y presenciales en Temperley, desde primaria hasta universitario.",
    url: SITIO,
    email: CONTACT.email,
    telephone: CONTACT.whatsappDisplay,
    slogan: BRAND.claim,
    founder: { "@id": idPersona },
    employee: { "@id": idPersona },
    address: {
      "@type": "PostalAddress",
      streetAddress: CONTACT.addressLine,
      addressLocality: "Temperley",
      addressRegion: "Buenos Aires",
      addressCountry: "AR",
    },
    hasMap: CONTACT.mapsUrl,
    /* Presencial en Temperley, y online para el resto del país. */
    areaServed: [
      { "@type": "City", name: "Temperley" },
      { "@type": "Country", name: "Argentina" },
    ],
    availableLanguage: "es-AR",
    potentialAction: {
      "@type": "ReserveAction",
      name: "Reservar una clase",
      target: BOOKING_RESERVE_URL,
    },
  };

  /* Una entrada por materia que realmente se dicta. `provider` referencia al
     negocio en vez de repetirlo: así el grafo queda conectado. */
  const cursos = SUBJECTS.map((s) => ({
    "@type": "Course",
    name: `Clases particulares de ${s.label}`,
    description: `${s.tagline} ${s.hook ?? ""}`.trim(),
    url: `${SITIO}/materias`,
    inLanguage: "es-AR",
    provider: { "@id": idNegocio },
    /* Sin esto Google marca el Course como incompleto. Los dos modos son
       reales: presencial en Temperley y online. */
    hasCourseInstance: [
      {
        "@type": "CourseInstance",
        courseMode: ["Onsite", "Online"],
        courseWorkload: "PT1H",
      },
    ],
  }));

  const faq = {
    "@type": "FAQPage",
    "@id": `${SITIO}/#faq`,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const sitio = {
    "@type": "WebSite",
    "@id": `${SITIO}/#sitio`,
    url: SITIO,
    name: BRAND.name,
    inLanguage: "es-AR",
    publisher: { "@id": idNegocio },
  };

  return { "@context": "https://schema.org", "@graph": [negocio, persona, sitio, faq, ...cursos] };
};

/* El script de prerender necesita el mismo grafo, y los effects no corren al
   renderizar en Node. Se expone la función en vez de duplicar el grafo en el
   build: dos copias se desincronizan en cuanto se agrega una materia. */
