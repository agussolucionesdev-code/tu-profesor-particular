import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Tipografía autohospedada (bundleada por Vite, sin CDN externo).
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/inter/wght.css";
import "./styles/base.css";
import App from "./App.jsx";
import { precargarPagina } from "./paginas.js";

/* Primero el código de la página en la que ya estás, después el dibujo: así el
   primer cuadro de React es idéntico al HTML prerenderizado y nada salta
   (paginas.js explica el CLS 1 que esto evita). Mientras tanto se ve el HTML
   del servidor, que ya está completo. */
precargarPagina(window.location.pathname).then(() => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});
