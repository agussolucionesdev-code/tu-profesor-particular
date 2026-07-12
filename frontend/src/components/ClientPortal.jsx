import { useEffect, useState } from "react";
import {
  FaCalendarCheck,
  FaCheckCircle,
  FaHourglassHalf,
  FaInfoCircle,
  FaTimesCircle,
  FaWhatsapp,
} from "react-icons/fa";
import "../index.css";
import "./ClientPortal.css";
import "../styles/theme-polish.css";
import "../styles/accessibility-system.css";
import BookingTicket from "./BookingTicket";
import ThemeLogo from "./ui/ThemeLogo";
import { lookupBookings, requestManagementLink } from "../api/bookingApi";
import { getBookingApiMessage } from "../utils/bookingFormatters";
import {
  isVoiceMuted,
  primeVoicePlayback,
  speakAlert,
} from "../utils/neuroToast";
import { usePageMeta } from "../hooks/useDocumentTitle";
import PortalSkeleton from "./portal/PortalSkeleton";

const PORTAL_VOICE_OPTIONS = { rate: 0.86, pitch: 0.98, volume: 0.9 };

const ClientPortal = () => {
  usePageMeta(
    "Mis turnos",
    "Consultá tus clases particulares con Agustin Elias Sosa usando tu código de reserva.",
  );
  const [code, setCode] = useState("");
  const [bookingsList, setBookingsList] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const isBookingActive = (booking) => {
    const endTime = new Date(booking.endTime);
    const now = new Date();
    return endTime > now && booking.status !== "Cancelado";
  };

  const looksLikeBookingCode = (value) =>
    /^[A-Z0-9]{6,12}$/i.test(String(value || "").trim());

  useEffect(() => {
    if (!message) return;
    if (typeof window !== "undefined" && !isVoiceMuted()) {
      speakAlert(message.text, PORTAL_VOICE_OPTIONS);
    }
  }, [message]);

  const setPortalMessage = (text, type = "info") => {
    setMessage({ text, type });
  };

  const handleSearch = async (e, options = {}) => {
    if (e) e.preventDefault();
    const silent = options.silent === true;

    if (!silent) primeVoicePlayback();

    if (!code.trim()) {
      setPortalMessage("Ingresá tu código de reserva exacto para buscar tu turno.", "error");
      return;
    }

    const trimmedCode = code.trim();
    if (!looksLikeBookingCode(trimmedCode)) {
      setPortalMessage(
        "Ingresá un código de reserva válido, de 6 a 12 letras o números.",
        "error",
      );
      return;
    }

    setLoading(true);
    setMessage(null);
    setBookingsList([]);
    setHasSearched(true);

    try {
      const res = await lookupBookings(trimmedCode);
      let results = [];

      if (res.data && Array.isArray(res.data.data)) {
        results = res.data.data;
      } else if (res.data && res.data.data) {
        results = [res.data.data];
      }

      const activeResults = results.filter(isBookingActive);
      setAllResults(results);
      setBookingsList(activeResults);

      if (results.length > 0 && activeResults.length === 0) {
        setPortalMessage(
          "Ese turno ya no está activo. Puede haber sido cancelado, reprogramado o ya haber pasado.",
          "info",
        );
      } else if (activeResults.length === 0) {
        setPortalMessage(
          "No encontramos una reserva activa con ese código. Revisá que lo hayas ingresado completo.",
          "info",
        );
      } else if (!silent) {
        speakAlert(
          activeResults.length === 1
            ? "Ya encontré tu turno activo. Desde acá podés revisarlo, reprogramarlo o cancelarlo."
            : `Ya encontré ${activeResults.length} turnos activos para gestionar.`,
          PORTAL_VOICE_OPTIONS,
        );
      }
    } catch (error) {
      console.error(error);
      setPortalMessage(getBookingApiMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryRequest = async (event) => {
    event.preventDefault();
    setRecoveryLoading(true);
    setRecoveryMessage("");

    try {
      await requestManagementLink({
        bookingCode: recoveryCode.trim().toUpperCase(),
        email: recoveryEmail.trim(),
      });
    } catch {
      // Keep the result deliberately indistinguishable to prevent enumeration.
    } finally {
      setRecoveryLoading(false);
      setRecoveryMessage(
        "Si los datos coinciden con una reserva, vas a recibir un enlace seguro por email.",
      );
    }
  };
  const activeVisibleBookings = bookingsList.filter(isBookingActive);
  const historicalBookings = allResults.filter((b) => !isBookingActive(b));
  const portalMessageMeta = {
    success: {
      icon: <FaCheckCircle aria-hidden="true" />,
      role: "status",
    },
    info: {
      icon: <FaInfoCircle aria-hidden="true" />,
      role: "status",
    },
    error: {
      icon: <FaTimesCircle aria-hidden="true" />,
      role: "alert",
    },
  }[message?.type || "info"];
  return (
    <div className="client-portal-wrapper">
      <div className="portal-container">
        <div className="portal-header">
          <ThemeLogo variant="full" imgClassName="portal-header-logo" alt="Tu Profesor Particular" />
          <h1 className="portal-title">Mis Turnos</h1>
          <p className="portal-subtitle">
            Buscá tu turno con el código de reserva exacto.
          </p>
        </div>

        <form onSubmit={handleSearch} className="search-container">
          <label htmlFor="portal-search-input" className="sr-only">
            Código de reserva exacto
          </label>
          <input
            id="portal-search-input"
            type="search"
            className="search-input"
            placeholder="Ejemplo: ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            aria-describedby="portal-search-help"
            required
          />
          <button
            type="submit"
            className="btn-search"
            disabled={loading}
            aria-label="Buscar mis turnos"
          >
            {loading ? <FaHourglassHalf className="spin" /> : "Buscar"}
          </button>
        </form>

        <p id="portal-search-help" className="search-helper">
          Por seguridad, temporalmente solo podés consultar con el código de reserva exacto. Lo encontrás en tu confirmación.
        </p>
        <section className="portal-recovery-card" aria-labelledby="portal-recovery-title">
          <h2 id="portal-recovery-title">Recuperar acceso seguro</h2>
          <p>
            Te enviamos un enlace privado para reprogramar o cancelar. La
            respuesta nunca confirma si una reserva existe.
          </p>
          <form className="portal-recovery-form" onSubmit={handleRecoveryRequest}>
            <label htmlFor="recovery-booking-code">Código para recuperar acceso</label>
            <input
              id="recovery-booking-code"
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              autoComplete="off"
              minLength={6}
              maxLength={12}
              required
            />
            <label htmlFor="recovery-email">Email usado al reservar</label>
            <input
              id="recovery-email"
              type="email"
              value={recoveryEmail}
              onChange={(event) => setRecoveryEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <button type="submit" disabled={recoveryLoading}>
              {recoveryLoading ? "Enviando…" : "Enviar enlace seguro"}
            </button>
          </form>
          {recoveryMessage && (
            <p className="portal-recovery-status" role="status" aria-live="polite">
              {recoveryMessage}
            </p>
          )}
        </section>

        {hasSearched && activeVisibleBookings.length > 0 && (
          <div className="portal-results-summary" role="status">
            <FaInfoCircle aria-hidden="true" />
            <span>
              {activeVisibleBookings.length} turno
              {activeVisibleBookings.length === 1 ? "" : "s"} activo
              {activeVisibleBookings.length === 1 ? "" : "s"}
            </span>
          </div>
        )}

        {message && (
          <div
            className={`portal-message portal-message--${message.type}`}
            role={portalMessageMeta.role}
            aria-live={message.type === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
            {portalMessageMeta.icon} {message.text}
          </div>
        )}

        {loading && <PortalSkeleton />}

        {hasSearched && !loading && bookingsList.length === 0 && !message && (
          <div className="empty-state">
            <FaCalendarCheck className="empty-state-icon" aria-hidden="true" />
            <p>No hay turnos activos para mostrar.</p>
          </div>
        )}

        <div className="tickets-grid">
          {bookingsList.map((booking) => (
            <div key={booking.bookingCode} className="ticket-wrapper">

              <BookingTicket booking={booking} />

            </div>
          ))}
        </div>

        {hasSearched && !loading && historicalBookings.length > 0 && (
          <div className="portal-history-section">
            <button
              type="button"
              className="portal-history-toggle"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
            >
              {showHistory ? "Ocultar historial" : `Ver historial (${historicalBookings.length} turno${historicalBookings.length !== 1 ? "s" : ""})`}
            </button>

            {showHistory && (
              <div className="tickets-grid tickets-grid--history">
                {historicalBookings.map((booking) => (
                  <div key={booking.bookingCode} className="ticket-wrapper ticket-wrapper--history">
                    <BookingTicket booking={booking} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <a
          className="portal-help-line"
          href="https://wa.me/5491164236675?text=Hola%20Agustin,%20necesito%20ayuda%20con%20un%20turno."
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaWhatsapp aria-hidden="true" />
          <span>¿Necesitás ayuda?</span>
          <strong>Escribinos por WhatsApp</strong>
        </a>
      </div>

    </div>
  );
};

export default ClientPortal;
