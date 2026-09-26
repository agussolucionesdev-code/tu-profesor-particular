import { Suspense, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import AccessibilityControls from "./components/accessibility/AccessibilityControls";
import { UISettingsProvider } from "./components/accessibility/UISettingsContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./layouts/Navbar";
import Footer from "./layouts/Footer";
import BrandLoader from "./components/ui/BrandLoader";
import JsonLd from "./components/seo/JsonLd";
import AnaliticaDeTurnos from "./components/analitica/AnaliticaDeTurnos";
import MaintenancePage from "./components/errors/MaintenancePage";
import { bootNeuroVoice } from "./utils/neuroToast";
import useEstadoDelServidor from "./hooks/useEstadoDelServidor";
import "./styles/tokens.css";
import "./index.css";
import "./styles/accessibility-system.css";
import "./styles/minimalist-design.css";
import "./styles/final-polish.css";
import "./styles/booking-interactions.css";
import "./styles/brand-identity-refresh.css";
import "./styles/motion-system.css";

/* Diferidas pero precargables: ver paginas.js. */
import {
  AdminPanel,
  BookingKiosk,
  ClientPortal,
  HomePage,
  ManageBooking,
  NotFoundPage,
} from "./paginas";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    window.scrollTo(0, 0);

    if (previousPathRef.current === pathname) return undefined;
    previousPathRef.current = pathname;

    const frameId = window.requestAnimationFrame(() => {
      window.document.getElementById("main-content")?.focus({
        preventScroll: true,
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [pathname]);

  return null;
};

const AppContent = () => {
  const { pathname } = useLocation();
  const isAdminRoute = pathname === "/admin";
  const isLandingRoute = pathname === "/";
  const isBookingExperience = pathname === "/reservar" || pathname === "/portal" || pathname === "/m";
  /* La página se dibuja al instante; esto despierta al servidor de fondo y
     sólo manda a mantenimiento si de verdad no contesta. Ver el hook. */
  const estadoDelServidor = useEstadoDelServidor();

  useEffect(() => {
    bootNeuroVoice();
  }, []);

  if (!isLandingRoute && estadoDelServidor === "caido") return <MaintenancePage />;

  return (
    <>
      <JsonLd />
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      <Navbar />
      <main
        id="main-content"
        key={pathname}
        className={`main-content page-enter ${isAdminRoute ? "admin-page-content" : ""} ${
          isBookingExperience ? "immersive-page-content" : ""
        }`}
        tabIndex="-1"
      >
        <Suspense fallback={<BrandLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/reservar" element={<BookingKiosk />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/portal" element={<ClientPortal />} />
            <Route path="/m" element={<ManageBooking />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      {/* Un límite de Suspense sin nada que esperar: en la portada, que se
          HIDRATA, React adopta de un tirón lo de afuera y lo de adentro lo
          hidrata después, en porciones cortas y con la prioridad más baja. El
          pie está debajo del pliegue: no apura. Si alguien lo toca antes,
          React lo hidrata en el momento y repite el toque. En las rutas que se
          dibujan de cero no cambia nada.

          SÓLO lo que no lee estado del navegador: lo que está adentro se
          hidrata DESPUÉS de que el contexto de preferencias pasó a lo real, y
          tiene que coincidir con el HTML. Por eso el panel de accesibilidad
          (lee las preferencias) queda afuera. Lo cuida HidratarLaPortada. */}
      <Suspense fallback={null}>{!isAdminRoute && <Footer />}</Suspense>
      <AccessibilityControls
        isAdminRoute={isAdminRoute}
        isBookingRoute={isBookingExperience}
      />
    </>
  );
};

/* El router entra desde afuera: BrowserRouter en el navegador y StaticRouter
   en el prerender de la portada (prerender.mjs), que corre en Node, donde no
   hay `window` ni historial. */
function App({ enrutador, routerProps = {} }) {
  /* Variable aparte y no renombrada en la firma: este ESLint no ve el uso
     dentro del JSX de un parámetro desestructurado. */
  const Router = enrutador ?? BrowserRouter;
  return (
    <ErrorBoundary>
      <UISettingsProvider>
        <Router {...routerProps}>
          <ScrollToTop />
          <AppContent />
          {/* Dentro del Router: necesita la ruta. Registra además cada paso del
              kiosco como una página virtual (ver utils/rutaVirtual). */}
          <AnaliticaDeTurnos />
        </Router>

        {/* Medición. Hasta ahora la app de turnos no tenía ninguna —el sitio
            institucional sí— así que era imposible saber cuánta gente entra a
            /reservar y en qué paso abandona. Sin ese dato, cualquier decisión sobre
            el flujo de reserva es una corazonada, y el flujo de reserva ES el
            negocio.

            Vercel Analytics y no GA4, la misma elección que ya se tomó en `web/`:
            no usa cookies ni identificadores persistentes, así que no hace falta
            banner de consentimiento. Si algún día se cambia por una herramienta que
            sí rastree, hay que agregar el consentimiento.

            POR QUÉ ES SEGURO ACÁ, que no era obvio: la analítica registra el
            pathname, y las seis rutas de esta app son estáticas —no hay ningún
            `:param` donde pudiera colarse un código de reserva—. El único dato
            sensible es el token de gestión, y viaja en el FRAGMENTO de la URL
            (`ManageBooking.jsx:31`), que el navegador nunca manda a ningún
            servidor y que además se borra del historial con `replaceState` antes
            del primer render. Si alguna vez se agrega una ruta con el código en el
            path, esto hay que revisarlo de nuevo.

            Speed Insights mide Core Web Vitals de visitantes reales, que es la
            única forma honesta de saberlo: en una máquina de desarrollo todo carga
            rápido. */}
        <SpeedInsights />
      </UISettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
