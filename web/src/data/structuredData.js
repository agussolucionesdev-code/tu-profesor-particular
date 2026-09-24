import { BRAND, CONTACT, SUBJECTS, FAQS, BOOKING_RESERVE_URL, SOCIAL } from "./site.js";
import { SITIO, META_POR_RUTA, IMAGEN_POR_DEFECTO, urlDe } from "./meta.js";

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
   desplegables debajo del resultado.

   EL GRAFO DEPENDE DE LA PÁGINA. La marca —negocio, persona, sitio— es la misma
   en todas; lo propio de cada una va aparte: su WebPage, sus migas de pan, las
   preguntas frecuentes sólo donde se ven (la portada) y los cursos donde se
   ofrecen. Google pide que el marcado describa lo que la página muestra.

   PARA QUE AL BUSCAR «Tu Profesor Particular» APAREZCA ESTE SITIO: `WebSite`
   con el nombre y sus variantes (`alternateName`), y la organización con
   `logo` y `sameAs`. De ahí sale el nombre del sitio y el ícono que Google
   pone arriba del resultado. */
export const construirGrafo = (ruta = "/") => {
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
    image: `${SITIO}/agustin.webp`,
    sameAs: [SOCIAL.linkedin],
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
    /* El eslogan de la marca es el del logo. Acá decía «Entendé de verdad,
       no de memoria», que era el titular de la portada. */
    slogan: BRAND.tagline,
    /* El ícono de 512 y no el logo horizontal: Google recorta el logo a un
       cuadrado, y el monograma ya lo es. */
    logo: {
      "@type": "ImageObject",
      "@id": `${SITIO}/#logo`,
      url: `${SITIO}/icon-512.png`,
      width: 512,
      height: 512,
      caption: BRAND.name,
    },
    image: [IMAGEN_POR_DEFECTO, `${SITIO}/agustin.webp`],
    sameAs: [SOCIAL.instagram],
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
    url: `${SITIO}/`,
    name: BRAND.name,
    /* Cómo más la busca la gente: junta, con el dominio o con el nombre de
       Agustín. Google usa esto para decidir qué nombre de sitio mostrar. */
    alternateName: ["TuProfesorParticular", "tuprofesorparticular.com.ar", `${BRAND.name} · ${BRAND.person}`],
    inLanguage: "es-AR",
    publisher: { "@id": idNegocio },
  };

  const url = urlDe(ruta);
  const meta = META_POR_RUTA[ruta] ?? META_POR_RUTA["/"];
  const idMigas = `${url}#migas`;
  const pagina = {
    "@type": ruta === "/sobre-mi" ? ["WebPage", "ProfilePage"] : "WebPage",
    "@id": `${url}#pagina`,
    url,
    name: meta.title,
    description: meta.description,
    inLanguage: "es-AR",
    isPartOf: { "@id": `${SITIO}/#sitio` },
    about: { "@id": ruta === "/sobre-mi" ? idPersona : idNegocio },
    ...(ruta === "/sobre-mi" ? { mainEntity: { "@id": idPersona } } : {}),
    ...(ruta === "/" ? {} : { breadcrumb: { "@id": idMigas } }),
  };
  const migas =
    ruta === "/"
      ? []
      : [
          {
            "@type": "BreadcrumbList",
            "@id": idMigas,
            itemListElement: [
              { "@type": "ListItem", position: 1, name: META_POR_RUTA["/"].nombre, item: urlDe("/") },
              { "@type": "ListItem", position: 2, name: meta.nombre, item: url },
            ],
          },
        ];

  return {
    "@context": "https://schema.org",
    "@graph": [
      negocio,
      persona,
      sitio,
      pagina,
      ...migas,
      ...(ruta === "/" ? [faq] : []),
      ...(ruta === "/" || ruta === "/materias" ? cursos : []),
    ],
  };
};

/* El script de prerender necesita el mismo grafo, y los effects no corren al
   renderizar en Node. Se expone la función en vez de duplicar el grafo en el
   build: dos copias se desincronizan en cuanto se agrega una materia. */

/* El grafo va dentro de un <script>: un «</script>» en algún texto cortaría la
   etiqueta. Se escapa el «<», que en JSON sigue siendo el mismo carácter. */
export const grafoComoTexto = (grafo) => JSON.stringify(grafo).replace(/</g, "\\u003c");

export const ID_GRAFO = "tpp-structured-data";
