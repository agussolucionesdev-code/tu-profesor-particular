import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import SiteNav from "./components/SiteNav.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Subjects from "./pages/Subjects.jsx";
import Method from "./pages/Method.jsx";
import Contact from "./pages/Contact.jsx";
import NotFound from "./pages/NotFound.jsx";
import useReveal from "./hooks/useReveal.js";

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
    <SiteNav />
    <RouteChrome />
    <main id="main" tabIndex={-1}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sobre-mi" element={<About />} />
        <Route path="/materias" element={<Subjects />} />
        <Route path="/como-trabajo" element={<Method />} />
        <Route path="/contacto" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <SiteFooter />
  </>
);

export default App;
