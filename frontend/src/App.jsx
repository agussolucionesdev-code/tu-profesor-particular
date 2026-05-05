import { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import AccessibilityControls from "./components/accessibility/AccessibilityControls";
import { UISettingsProvider } from "./components/accessibility/UISettingsContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./layouts/Navbar";
import Footer from "./layouts/Footer";
import { bootNeuroVoice } from "./utils/neuroToast";
import "./styles/tokens.css";
import "./index.css";
import "./styles/accessibility-system.css";
import "./styles/minimalist-design.css";
import "./styles/final-polish.css";
import "./styles/booking-interactions.css";
import "./styles/brand-identity-refresh.css";

const BookingForm = lazy(() => import("./components/BookingForm"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const ClientPortal = lazy(() => import("./components/ClientPortal"));

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
  const isBookingExperience = pathname === "/" || pathname === "/reservar" || pathname === "/portal";

  useEffect(() => {
    bootNeuroVoice();
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      <Navbar />
      <main
        id="main-content"
        className={`main-content ${isAdminRoute ? "admin-page-content" : ""} ${
          isBookingExperience ? "immersive-page-content" : ""
        }`}
        tabIndex="-1"
      >
        <Suspense
          fallback={
            <div className="route-loader-shell" role="status" aria-live="polite">
              <div className="route-loader-card">
                <span className="route-loader-badge">Cargando</span>
                <strong>Estamos preparando la experiencia</strong>
                <p>Un momento y seguimos.</p>
              </div>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<BookingForm />} />
            <Route path="/reservar" element={<BookingForm />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/portal" element={<ClientPortal />} />
            <Route path="*" element={<Navigate to="/reservar" replace />} />
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
