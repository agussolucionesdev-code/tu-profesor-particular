import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
// Sistema tipográfico autohospedado (bundleado por Vite, sin CDN externo).
// Fraunces = serif de display con optical sizing para titulares editoriales;
// Inter = cuerpo/UI. Antes el sitio declaraba "Inter" pero no la enviaba nunca:
// todos veían la fuente del sistema. Este es el cambio que da el salto de nivel.
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/inter/wght.css";
import "./index.css";
import "react-datepicker/dist/react-datepicker.css";
// Colores del calendario desde la capa semántica: va DESPUÉS de la hoja de la
// librería para ganarle a sus colores fijos. Ver styles/datepicker-tema.css.
import "./styles/datepicker-tema.css";
import App from "./App.jsx";
import { precargarPagina } from "./paginas";

/* LA PORTADA llega prerenderizada (prerender.mjs) y se HIDRATA: React adopta
   esos nodos en vez de reemplazarlos. Con createRoot los reemplazaba, y las
   animaciones de entrada del título volvían a arrancar: en un celular lento, el
   título aparecía, desaparecía y entraba otra vez. Para que coincida, el primer
   dibujo muestra lo mismo que el servidor (hooks/useHidratado.js), y se espera
   el código de la portada: si el primer dibujo pasara por el Suspense, el
   cargador reemplazaría al HTML. Mientras tanto se ve el HTML. Se hidrata sólo
   si el HTML es de ESTA ruta (/index.html sirve la portada con otra dirección).

   EL RESTO de las rutas recibe app.html, vacío, y se dibuja YA: la barra con
   el logo no espera al código de la pantalla. Esperarlo acá no protegía nada y
   atrasaba el logo, que en /reservar es el elemento LCP (medido: +1 s en
   celular). El código de la pantalla igual se pide ahora, en paralelo. */
const raiz = document.getElementById("root");
const hidratar = raiz.dataset.prerender === window.location.pathname;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

const precarga = precargarPagina(window.location.pathname);
if (hidratar) precarga.then(() => hydrateRoot(raiz, app));
else createRoot(raiz).render(app);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
