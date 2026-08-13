import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import AccessibilityControls from "./components/accessibility/AccessibilityControls";
import { UISettingsProvider } from "./components/accessibility/UISettingsContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./layouts/Navbar";
import Footer from "./layouts/Footer";
import BrandLoader from "./components/ui/BrandLoader";
import JsonLd from "./components/seo/JsonLd";
import MaintenancePage from "./components/errors/MaintenancePage";
import { bootNeuroVoice } from "./utils/neuroToast";
import { API_BASE } from "./api/apiClient";
import "./styles/tokens.css";
import "./index.css";
import "./styles/accessibility-system.css";
import "./styles/minimalist-design.css";
import "./styles/final-polish.css";
import "./styles/booking-interactions.css";
import "./styles/brand-identity-refresh.css";
import "./styles/motion-system.css";

const HomePage = lazy(() => import("./pages/HomePage"));
const BookingKiosk = lazy(() => import("./components/BookingKiosk"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const ClientPortal = lazy(() => import("./components/ClientPortal"));
const ManageBooking = lazy(() => import("./components/ManageBooking"));
const NotFoundPage = lazy(() => import("./components/errors/NotFoundPage"));

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
  const [backendStatus, setBackendStatus] = useState("loading");

  useEffect(() => {
    bootNeuroVoice();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    fetch(`${API_BASE}/health`, { signal: controller.signal })
      .then((res) => {
        if (res.ok) setBackendStatus("ok");
        else setBackendStatus("down");
      })
      .catch(() => setBackendStatus("down"))
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!isLandingRoute && backendStatus === "loading") return <BrandLoader />;
  if (!isLandingRoute && backendStatus === "down") return <MaintenancePage />;

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
      {!isAdminRoute && <Footer />}
      <AccessibilityControls
        isAdminRoute={isAdminRoute}
        isBookingRoute={isBookingExperience}
      />
    </>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <UISettingsProvider>
        <Router>
          <ScrollToTop />
          <AppContent />
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
        <Analytics />
        <SpeedInsights />
      </UISettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
