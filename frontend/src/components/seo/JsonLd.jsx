import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { construirGrafo } from "./grafoEstructurado";

const SCRIPT_ID = "json-ld-structured-data";

/**
 * Inyecta el JSON-LD de la ruta actual en el <head>. No dibuja nada.
 */
const JsonLd = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    /* El «<» escapado: un «</script>» en algún texto cortaría la etiqueta. */
    script.textContent = JSON.stringify(construirGrafo(pathname)).replace(/</g, "\\u003c");
  }, [pathname]);

  useEffect(
    () => () => {
      document.getElementById(SCRIPT_ID)?.remove();
    },
    [],
  );

  return null;
};

export default JsonLd;
