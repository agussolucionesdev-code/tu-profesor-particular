import { useEffect, useState } from "react";
import { FaCheckCircle, FaLock, FaWhatsapp } from "react-icons/fa";
import "../index.css";
import "./ClientPortal.css";
import "../styles/theme-polish.css";
import "../styles/accessibility-system.css";
import ThemeLogo from "./ui/ThemeLogo";
import { requestManagementLink } from "../api/bookingApi";
import {
  isVoiceMuted,
  primeVoicePlayback,
  speakAlert,
} from "../utils/neuroToast";
import { usePageMeta } from "../hooks/useDocumentTitle";

const PORTAL_VOICE_OPTIONS = { rate: 0.86, pitch: 0.98, volume: 0.9 };
const RECOVERY_MESSAGE =
  "Si los datos coinciden con una reserva, vas a recibir un enlace seguro por email.";

const ClientPortal = () => {
  usePageMeta(
    "Acceso seguro a tus turnos",
    "Solicitá por email un enlace privado para consultar o gestionar tu turno.",
  );

  const [bookingCode, setBookingCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message || isVoiceMuted()) return;
    speakAlert(message, PORTAL_VOICE_OPTIONS);
  }, [message]);

  const handleRecoveryRequest = async (event) => {
    event.preventDefault();
    primeVoicePlayback();
    setLoading(true);
    setMessage("");

    try {
      await requestManagementLink({
        bookingCode: bookingCode.trim().toUpperCase(),
        email: email.trim(),
      });
    } catch {
      // Intentionally indistinguishable: never reveal whether a booking exists.
    } finally {
      setLoading(false);
      setMessage(RECOVERY_MESSAGE);
    }
  };

  return (
    <div className="client-portal-wrapper">
      <main className="portal-container">
        <header className="portal-header">
          <ThemeLogo
            variant="monogram"
            imgClassName="portal-header-logo"
            alt="Tu Profesor Particular"
          />
          <h1 className="portal-title">Acceso seguro a tus turnos</h1>
          <p className="portal-subtitle">
            Tu código identifica la reserva, pero no permite ver datos personales.
            Te enviamos un enlace privado al email usado al reservar.
          </p>
        </header>

        <section
          className="portal-recovery-card"
          aria-labelledby="portal-recovery-title"
        >
          <FaLock className="portal-recovery-icon" aria-hidden="true" />
          <h2 id="portal-recovery-title">Solicitá tu enlace de gestión</h2>
          <p>
            Desde ese enlace podés consultar, reprogramar o cancelar tu turno sin
            exponer información privada.
          </p>

          <form className="portal-recovery-form" onSubmit={handleRecoveryRequest}>
            <label htmlFor="recovery-booking-code">Código de reserva</label>
            <input
              id="recovery-booking-code"
              value={bookingCode}
              onChange={(event) => setBookingCode(event.target.value)}
              autoComplete="off"
              minLength={6}
              maxLength={12}
              pattern="[A-Za-z0-9]{6,12}"
              title="Ingresá entre 6 y 12 letras o números"
              required
            />

            <label htmlFor="recovery-email">Email usado al reservar</label>
            <input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Enviando…" : "Enviar enlace seguro"}
            </button>
          </form>

          {message && (
            <p className="portal-recovery-status" role="status" aria-live="polite">
              <FaCheckCircle aria-hidden="true" />
              {message}
            </p>
          )}
        </section>

        <p className="search-helper">
          ¿No usaste email al reservar o no lo recordás? Escribinos por WhatsApp
          para verificar tu identidad y recuperar el acceso.
        </p>

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
      </main>
    </div>
  );
};

export default ClientPortal;
