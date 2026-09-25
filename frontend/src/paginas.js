import { diferido } from "./utils/diferido";

/* LAS PANTALLAS, DIFERIDAS PERO PRECARGABLES.
 *
 * Cada pantalla se pide al navegar (React.lazy). La portada, además, sale
 * prerenderizada (prerender.mjs): el HTML ya trae la página entera. Si el
 * primer dibujo de React pasara por el Suspense —porque el código de la
 * portada todavía no llegó— reemplazaría ese HTML por el cargador y después
 * otra vez por la portada: un parpadeo completo.
 *
 * Cada pantalla es un componente `diferido` (utils/diferido.js), y
 * `precargarPagina(ruta)` la pide ANTES del primer dibujo (main.jsx). Con el
 * módulo en mano, la pantalla se dibuja directo, sin Suspense. Es el mismo
 * patrón que web/src/paginas.js.
 */
export const HomePage = diferido(() => import("./pages/HomePage"));
export const BookingKiosk = diferido(() => import("./components/BookingKiosk"));
export const AdminPanel = diferido(() => import("./components/AdminPanel"));
export const ClientPortal = diferido(() => import("./components/ClientPortal"));
export const ManageBooking = diferido(() => import("./components/ManageBooking"));
export const NotFoundPage = diferido(() => import("./components/errors/NotFoundPage"));

const POR_RUTA = {
  "/": HomePage,
  "/reservar": BookingKiosk,
  "/admin": AdminPanel,
  "/portal": ClientPortal,
  "/m": ManageBooking,
};

/* Si el pedido falla, se dibuja igual: el lazy lo reintenta y el Suspense se
   encarga, como antes. */
export const precargarPagina = (ruta) => {
  const pagina = POR_RUTA[ruta.replace(/\/+$/, "") || "/"] ?? NotFoundPage;
  return pagina.precargar().catch(() => {});
};
