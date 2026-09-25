import { createElement, lazy } from "react";

/* LAS PÁGINAS INTERNAS, DIFERIDAS PERO PRECARGABLES.
 *
 * Las páginas que no son la portada se piden al navegar (React.lazy): la
 * mayoría de la gente no pasa del inicio y no tiene por qué bajarlas.
 *
 * El problema aparece al ENTRAR DIRECTO a una de ellas. El HTML prerenderizado
 * ya muestra la página completa; después React la vuelve a dibujar desde cero,
 * y en ese primer dibujo el código de la página todavía no llegó: el Suspense
 * vacía el contenido un instante —el pie sube hasta arriba— y cuando llega el
 * código, todo vuelve a bajar. Lighthouse lo midió como CLS 1 en /sobre-mi y
 * /materias, según cuánto tardara el pedido.
 *
 * `paginaDiferida` guarda el módulo cuando llega. `precargarPagina(ruta)` lo
 * pide ANTES del primer dibujo (main.jsx): con el módulo ya en mano, la página
 * se dibuja directo, sin pasar por el Suspense, y el primer cuadro de React es
 * idéntico al HTML que ya estaba. Al navegar dentro del sitio sigue siendo
 * diferida como antes.
 */
const paginaDiferida = (cargar) => {
  let modulo = null;
  const traer = () =>
    cargar().then((m) => {
      modulo = m;
      return m;
    });
  const Diferida = lazy(traer);
  const Pagina = (props) => createElement(modulo ? modulo.default : Diferida, props);
  Pagina.precargar = traer;
  return Pagina;
};

export const About = paginaDiferida(() => import("./pages/About.jsx"));
export const Subjects = paginaDiferida(() => import("./pages/Subjects.jsx"));
export const Method = paginaDiferida(() => import("./pages/Method.jsx"));
export const Contact = paginaDiferida(() => import("./pages/Contact.jsx"));
export const Privacy = paginaDiferida(() => import("./pages/Privacy.jsx"));
export const NotFound = paginaDiferida(() => import("./pages/NotFound.jsx"));

const POR_RUTA = {
  "/sobre-mi": About,
  "/materias": Subjects,
  "/como-trabajo": Method,
  "/contacto": Contact,
  "/privacidad": Privacy,
};

/* La portada va en el bundle inicial; cualquier otra ruta que no esté en el
   mapa es el 404. Si el pedido falla, se dibuja igual: el lazy lo reintenta y
   el Suspense se encarga, como antes. */
export const precargarPagina = (ruta) => {
  if (ruta === "/") return Promise.resolve();
  const pagina = POR_RUTA[ruta.replace(/\/+$/, "") || "/"] ?? NotFound;
  return pagina.precargar().catch(() => {});
};
