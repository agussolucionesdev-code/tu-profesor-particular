import { useEffect } from "react";

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      "@id": "https://tuprofesorparticular.com.ar/#organization",
      name: "Tu Profesor Particular",
      alternateName: "Agustin Elias Sosa - Clases particulares",
      url: "https://tuprofesorparticular.com.ar",
      logo: "https://tuprofesorparticular.com.ar/logo-full.png",
      description:
        "Clases particulares personalizadas de matematica, fisica, quimica y mas. Reserva online con confirmacion inmediata.",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Buenos Aires",
        addressCountry: "AR",
      },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+54-9-11-6423-6675",
        contactType: "customer service",
        availableLanguage: "Spanish",
      },
      sameAs: ["https://wa.me/5491164236675"],
    },
    {
      "@type": "Service",
      "@id": "https://tuprofesorparticular.com.ar/#service",
      name: "Clases particulares",
      provider: {
        "@id": "https://tuprofesorparticular.com.ar/#organization",
      },
      serviceType: "Tutoring",
      description:
        "Clases individuales de apoyo escolar y universitario. Matematica, fisica, quimica y mas materias.",
      areaServed: {
        "@type": "City",
        name: "Buenos Aires",
      },
      availableChannel: {
        "@type": "ServiceChannel",
        serviceUrl: "https://tuprofesorparticular.com.ar/reservar",
        name: "Reserva online",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://tuprofesorparticular.com.ar/#website",
      url: "https://tuprofesorparticular.com.ar",
      name: "Tu Profesor Particular",
      publisher: {
        "@id": "https://tuprofesorparticular.com.ar/#organization",
      },
      inLanguage: "es-AR",
    },
  ],
};

const SCRIPT_ID = "json-ld-structured-data";

/**
 * Injects JSON-LD structured data into the document head.
 * Renders nothing visible — SEO only.
 */
const JsonLd = () => {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(STRUCTURED_DATA);
    document.head.appendChild(script);

    return () => {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) existing.remove();
    };
  }, []);

  return null;
};

export default JsonLd;
