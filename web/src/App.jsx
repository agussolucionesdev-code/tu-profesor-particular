import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import SiteNav from "./components/SiteNav.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import Home from "./pages/Home.jsx";
import StructuredData from "./components/StructuredData.jsx";
import useReveal from "./hooks/useReveal.js";

/* La portada va en el bundle inicial: es la puerta de entrada y cargarla en
   diferido agregaría una espera justo donde no se puede.
   Las otras cinco se piden al navegar. Antes viajaban las seis siempre, aunque
   el visitante no pasara de la home —que es lo que hace la mayoría—. */
const About = lazy(() => import("./pages/About.jsx"));
const Subjects = lazy(() => import("./pages/Subjects.jsx"));
const Method = lazy(() => import("./pages/Method.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

/* Al navegar entre páginas el scroll vuelve arriba (sin animar: un smooth acá
   se siente como un salto raro) y el foco va al contenido, para que quien use
   teclado o lector de pantalla no quede perdido en el navbar. */
const RouteChrome = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname]);

  useReveal(pathname);
  return null;
};

const App = () => (
  <>
    <a className="skip-link" href="#main">
      Saltar al contenido
    </a>
    <StructuredData />
    <SiteNav />
    <RouteChrome />
    <main id="main" tabIndex={-1}>
      {/* Sin spinner a propósito: los chunks de página pesan pocos kB y en una
          conexión normal llegan antes de que un indicador alcance a verse.
          Mostrar y esconder un cartel en 80 ms se percibe como un parpadeo, que
          molesta más que la espera. El aria-live sí avisa a quien no ve la
          pantalla, para los casos en que la espera exista de verdad. */}
      <Suspense
        fallback={
          <p className="shell" role="status" aria-live="polite">
            <span className="sr-only">Cargando la página…</span>
          </p>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sobre-mi" element={<About />} />
          <Route path="/materias" element={<Subjects />} />
          <Route path="/como-trabajo" element={<Method />} />
          <Route path="/contacto" element={<Contact />} />
          <Route path="/privacidad" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </main>
    <SiteFooter />

    {/* Medición. Hasta ahora no había ninguna: era imposible saber qué CTA
        convierte, cuánta gente llega a /materias o dónde abandona, así que
        cualquier decisión sobre el sitio era una corazonada.

        Vercel Analytics y no GA4 a propósito: no usa cookies ni identificadores
        persistentes, así que no hace falta un banner de consentimiento. Esa
        elección está declarada en /privacidad, y si algún día se cambia por una
        herramienta que sí rastree, hay que actualizar esa página y agregar el
        consentimiento. Speed Insights mide las Core Web Vitals de visitantes
        reales, que es la única forma honesta de saber si el sitio carga rápido:
        en una máquina de desarrollo siempre carga rápido. */}
    <Analytics />
    <SpeedInsights />
  </>
);

export default App;
