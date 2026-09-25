import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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

/* Primero el código de la pantalla en la que ya estás, después el dibujo. La
   portada llega prerenderizada: sin esto, el primer dibujo de React pasaría por
   el cargador del Suspense y la portada parpadearía entera (ver paginas.js).
   Mientras tanto se ve el HTML del servidor. */
precargarPagina(window.location.pathname).then(() => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
