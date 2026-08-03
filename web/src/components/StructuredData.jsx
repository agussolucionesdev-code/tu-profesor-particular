import { useEffect } from "react";
import { construirGrafo } from "../data/structuredData.js";

const ID_SCRIPT = "tpp-structured-data";

/* Inyecta el JSON-LD en el <head>.
   El grafo se armó en data/structuredData.js y no acá: el script de prerender
   también lo necesita, y mientras vivía en este archivo había que exportar una
   función desde un módulo de componente. Eso rompe React Refresh —el módulo
   deja de ser recargable en caliente— y en desarrollo aparecía un "Invalid hook
   call" en cada carga. Un archivo, una responsabilidad.

   Se inyecta una sola vez: el grafo describe al negocio, no a la página, así
   que no cambia al navegar. */
const StructuredData = () => {
  useEffect(() => {
    let script = document.getElementById(ID_SCRIPT);
    if (!script) {
      script = document.createElement("script");
      script.id = ID_SCRIPT;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(construirGrafo());
  }, []);

  return null;
};

export default StructuredData;
