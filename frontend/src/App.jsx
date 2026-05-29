import { Suspense, lazy, useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
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
const BookingForm = lazy(() => import("./components/BookingForm"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const ClientPortal = lazy(() => import("./components/ClientPortal"));
const NotFoundPage = lazy(() => import("./components/errors/NotFoundPage"));

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const AppContent = () => {
  const { pathname } = useLocation();
  const isAdminRoute = pathname === "/admin";
  const isBookingExperience = pathname === "/reservar" || pathname === "/portal";
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

  if (backendStatus === "loading") return <BrandLoader />;
  if (backendStatus === "down") return <MaintenancePage />;

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
            <Route path="/reservar" element={<BookingForm />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/portal" element={<ClientPortal />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && <Footer />}
      <AccessibilityControls />
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
      </UISettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
