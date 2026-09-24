import { SITIO_INSTITUCIONAL, SOCIAL_PROFILES, WHATSAPP_DISPLAY } from "../../constants/contactChannels";
import { FALLBACK_TEACHER_LOCATION } from "../../constants/teacherLocation";
import { FAQS } from "../../constants/preguntasFrecuentes";

/* Datos estructurados de turnos.tuprofesorparticular.com.ar.
 *
 * EL NEGOCIO ES UNO SOLO, EN LOS DOS DOMINIOS. El sitio institucional ya lo
 * describe con `@id` `https://tuprofesorparticular.com.ar/#negocio`
 * (web/src/data/structuredData.js). Este grafo usaba OTRO `@id`, así que Google
 * veía dos entidades distintas con el mismo nombre; además declaraba el
 * servicio en tuprofesorparticular.com.ar/reservar —una página que no existe—,
 * el logo en una URL que daba 404 y el enlace de WhatsApp como si fuera un
 * perfil. Ahora referencia la misma entidad, con el mismo logo y las mismas
 * redes, y describe lo que ESTE dominio tiene: la reserva en línea.
 *
 * Sin reseñas, precios ni horarios inventados: los mismos límites que el sitio. */

const TURNOS = "https://turnos.tuprofesorparticular.com.ar";
const ID_NEGOCIO = `${SITIO_INSTITUCIONAL}/#negocio`;

const perfil = (id) => SOCIAL_PROFILES.find((p) => p.id === id)?.href;

export const construirGrafo = (ruta) => {
  const [calle, localidad] = FALLBACK_TEACHER_LOCATION.address.split(",").map((s) => s.trim());
  const negocio = {
    "@type": ["LocalBusiness", "EducationalOrganization"],
    "@id": ID_NEGOCIO,
    name: "Tu Profesor Particular",
    url: `${SITIO_INSTITUCIONAL}/`,
    logo: `${SITIO_INSTITUCIONAL}/icon-512.png`,
    telephone: WHATSAPP_DISPLAY,
    founder: { "@type": "Person", name: "Agustín Elías Sosa", sameAs: [perfil("linkedin")].filter(Boolean) },
    address: {
      "@type": "PostalAddress",
      streetAddress: calle,
      addressLocality: localidad,
      addressRegion: "Buenos Aires",
      addressCountry: "AR",
    },
    sameAs: [perfil("instagram")].filter(Boolean),
  };
  const sitio = {
    "@type": "WebSite",
    "@id": `${TURNOS}/#sitio`,
    url: `${TURNOS}/`,
    name: "Turnos · Tu Profesor Particular",
    inLanguage: "es-AR",
    publisher: { "@id": ID_NEGOCIO },
  };
  const reserva = {
    "@type": "Service",
    "@id": `${TURNOS}/#reserva`,
    name: "Clases particulares con Agustín Elías Sosa",
    serviceType: "Clases particulares",
    description:
      "Clases particulares de Matemática, Física, Química, Fisicoquímica e Inglés, online o presenciales en Temperley. Reserva en línea, sin registro y sin pago por adelantado.",
    provider: { "@id": ID_NEGOCIO },
    areaServed: [
      { "@type": "City", name: "Temperley" },
      { "@type": "Country", name: "Argentina" },
    ],
    availableChannel: {
      "@type": "ServiceChannel",
      name: "Reserva en línea",
      serviceUrl: `${TURNOS}/reservar`,
    },
  };
  /* Las preguntas frecuentes, sólo donde se ven: la portada. */
  const faq =
    ruta === "/"
      ? [
          {
            "@type": "FAQPage",
            "@id": `${TURNOS}/#preguntas`,
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : [];
  return { "@context": "https://schema.org", "@graph": [negocio, sitio, reserva, ...faq] };
};
