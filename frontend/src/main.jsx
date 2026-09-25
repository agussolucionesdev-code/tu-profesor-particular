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

/* Primero el código de la pantalla en la que ya estás, después el dibujo.
   Mientras tanto se ve el HTML del servidor.

   La portada llega prerenderizada (prerender.mjs) y se HIDRATA: React adopta
   esos nodos en vez de reemplazarlos. Con createRoot los reemplazaba, y las
   animaciones de entrada del título volvían a arrancar: en un celular lento, el
   título aparecía, desaparecía y entraba otra vez. Para que coincida, el primer
   dibujo muestra lo mismo que el servidor (hooks/useHidratado.js). El resto de
   las rutas recibe app.html, vacío: ahí se dibuja de cero. Se hidrata sólo si
   el HTML es de ESTA ruta (/index.html sirve la portada con otra dirección). */
const raiz = document.getElementById("root");
const hidratar = raiz.dataset.prerender === window.location.pathname;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

precargarPagina(window.location.pathname).then(() => {
  if (hidratar) hydrateRoot(raiz, app);
  else createRoot(raiz).render(app);
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
