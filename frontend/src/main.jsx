import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
// Sistema tipográfico autohospedado (bundleado por Vite, sin CDN externo).
// Fraunces = serif de display con optical sizing para titulares editoriales;
// Inter = cuerpo/UI. Antes el sitio declaraba "Inter" pero no la enviaba nunca:
// todos veían la fuente del sistema. Este es el cambio que da el salto de nivel.
import "@fontsource-variable/fraunces/opsz.css";
// Inter con font-display: optional, en lugar de la hoja de @fontsource (que usa
// swap): así nunca cambia con la página a la vista. Ver styles/fuente-inter.css.
import "./styles/fuente-inter.css";
import "./index.css";
// La hoja de react-datepicker y su tema NO van acá: viajan con el calendario
// (ver styles/datepicker-tema.css).
import App from "./App.jsx";
import { precargarPagina } from "./paginas";

/* LA PORTADA Y /reservar llegan prerenderizadas (prerender.mjs) y se HIDRATAN: React adopta
   esos nodos en vez de reemplazarlos. Con createRoot los reemplazaba, y las
   animaciones de entrada del título volvían a arrancar: en un celular lento, el
   título aparecía, desaparecía y entraba otra vez. Para que coincida, el primer
   dibujo muestra lo mismo que el servidor (hooks/useHidratado.js), y se espera
   el código de la portada: si el primer dibujo pasara por el Suspense, el
   cargador reemplazaría al HTML. Mientras tanto se ve el HTML. Se hidrata sólo
   si el HTML es de ESTA ruta (/index.html sirve la portada con otra dirección).

   EL RESTO de las rutas recibe app.html, vacío, y se dibuja YA, sin precargar:
   primero la barra con el cargador, después la pantalla, cuando llega. En
   /reservar el logo de la barra es el elemento LCP. Medido en producción:
     · esperar la pantalla antes de dibujar: LCP 4,1-4,3 s;
     · pedirla antes de dibujar, sin esperarla: 3,5-3,7 s. El código llegaba y
       se evaluaba antes que el primer dibujo, que entonces cargaba con todo el
       kiosco y pedía el logo más tarde;
     · pedirla al dibujar (así): 3,0-3,2 s, el valor de antes de todo esto. */
const raiz = document.getElementById("root");
const hidratar = raiz.dataset.prerender === window.location.pathname;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (hidratar) precargarPagina(window.location.pathname).then(() => hydrateRoot(raiz, app));
else createRoot(raiz).render(app);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
