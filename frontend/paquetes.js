/* A qué paquete de carga va cada módulo de terceros. Lo usa `vite.config.js`
 * como `manualChunks`.
 *
 * Era un objeto —`{ "vendor-datepicker": ["react-datepicker", "date-fns"] }`— y
 * con esa forma el agrupador metía en el paquete del calendario también la HOJA
 * de estilos de la librería. Como esa hoja se importa en `main.jsx`, el paquete
 * entero pasaba a ser dependencia del punto de entrada: la portada precargaba
 * 175 KB de calendario sin tener ningún calendario.
 *
 * Como función se puede decir lo que el objeto no permite: el CSS no va a
 * ningún paquete de terceros —queda con el resto de las hojas, en el mismo
 * lugar de la cascada— y el JavaScript del calendario sólo lo piden las
 * pantallas que lo usan.
 *
 * Vive en un archivo aparte y no adentro del config para poder probarla con
 * `node --test` sin levantar Vite. Ver `tests/unit/paquetesDeCarga.test.js`. */

/* Se compara por CARPETA COMPLETA de `node_modules`, no por prefijo:
   `react-datepicker` empieza con `react`, y una comparación ingenua mandaría el
   calendario al paquete de React —que se carga en todas las páginas—. */
const GRUPOS = [
  ["vendor-react", ["react", "react-dom", "react-router", "react-router-dom", "scheduler", "@remix-run/router"]],
  /* date-fns va aparte del calendario: el kiosco formatea fechas desde el
     primer paso, y juntas arrastraban react-datepicker (43 KB sin usar, medido
     por Lighthouse en /reservar) a la primera pantalla. El calendario se pide
     recién cuando hace falta (ver BookingKiosk.jsx). */
  ["vendor-fechas", ["date-fns"]],
  ["vendor-datepicker", ["react-datepicker", "@floating-ui/react", "@floating-ui/react-dom", "@floating-ui/dom", "@floating-ui/core", "@floating-ui/utils"]],
  ["vendor-icons", ["react-icons"]],
];

const carpetaDePaquete = (id) => {
  const ruta = id.replace(/\\/g, "/");
  const m = ruta.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  return m ? m[1] : null;
};

export const paqueteDe = (id) => {
  if (/\.css(\?|$)/.test(id)) return undefined;
  const paquete = carpetaDePaquete(id);
  if (!paquete) return undefined;
  for (const [nombre, paquetes] of GRUPOS) {
    if (paquetes.includes(paquete)) return nombre;
  }
  return undefined;
};
