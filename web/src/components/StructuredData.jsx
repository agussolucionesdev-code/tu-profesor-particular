import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { construirGrafo, grafoComoTexto, ID_GRAFO } from "../data/structuredData.js";

/* Inyecta el JSON-LD en el <head>.
   El grafo se armó en data/structuredData.js y no acá: el script de prerender
   también lo necesita, y mientras vivía en este archivo había que exportar una
   función desde un módulo de componente. Eso rompe React Refresh —el módulo
   deja de ser recargable en caliente— y en desarrollo aparecía un "Invalid hook
   call" en cada carga. Un archivo, una responsabilidad.

   El grafo depende de la página (migas de pan, FAQ, cursos), así que se
   reescribe al navegar. Y se REUSA el <script> que dejó el prerender, con el
   mismo id: antes se agregaba uno nuevo y cada página terminaba con el grafo
   dos veces. */
const StructuredData = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    let script = document.getElementById(ID_GRAFO);
    if (!script) {
      script = document.createElement("script");
      script.id = ID_GRAFO;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = grafoComoTexto(construirGrafo(pathname));
  }, [pathname]);

  return null;
};

export default StructuredData;
