import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Tipografía autohospedada (bundleada por Vite, sin CDN externo).
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/inter/wght.css";
import "./styles/base.css";
import App from "./App.jsx";
import { precargarPagina } from "./paginas.js";

const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

/* HIDRATAR Y NO REDIBUJAR. El HTML ya viene completo del prerender. Con
   createRoot, React lo tiraba y lo volvía a crear entero: el navegador
   calculaba estilo y layout de la página dos veces al cargar (lo más pesado que
   medía Lighthouse en la portada). hydrateRoot adopta el HTML que ya está.
   Para eso el primer dibujo tiene que coincidir con el del servidor; lo que
   depende del navegador (tema, reducir movimiento) se lee con
   useSyncExternalStore. Lo cuida e2e/prerender.spec.js: cero errores de
   consola, y una diferencia de hidratación es un error de consola.

   Antes, el código de la página en la que ya estás (paginas.js): con el módulo
   en mano no hay Suspense que resolver. En el servidor de desarrollo no hay
   prerender y el #root viene vacío: ahí se dibuja como siempre. */
const raiz = document.getElementById("root");
precargarPagina(window.location.pathname).then(() => {
  if (raiz.hasChildNodes()) hydrateRoot(raiz, app);
  else createRoot(raiz).render(app);
});
