import { useEffect, useState } from "react";
import {
  FaCalendarCheck,
  FaCheckCircle,
  FaExclamationTriangle,
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
import StudentNotesPanel from "./portal/StudentNotesPanel";
import RescheduleModal from "./portal/RescheduleModal";
import CancelModal from "./portal/CancelModal";
import logoIcon from "../assets/images/logo-icon-sin-fondo.png";
import { lookupBookings, cancelBooking, confirmAttendance } from "../api/bookingApi";
import { getBookingApiMessage } from "../utils/bookingFormatters";
import {
  isVoiceMuted,
  primeVoicePlayback,
  speakAlert,
  spellCodeForVoice,
  useNeuroToast,
} from "../utils/neuroToast";
import { usePageMeta } from "../hooks/useDocumentTitle";
import PortalSkeleton from "./portal/PortalSkeleton";

const PORTAL_VOICE_OPTIONS = { rate: 0.86, pitch: 0.98, volume: 0.9 };

const ClientPortal = () => {
  usePageMeta(
    "Mis turnos",
    "Consultá, reprogramá o cancelá tus clases particulares con Agustin Elias Sosa. Ingresa tu codigo de reserva, email o telefono.",
  );
  const [code, setCode] = useState("");
  const [bookingsList, setBookingsList] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const { toast, showToast } = useNeuroToast({ duration: 4000 });
  const [editingBooking, setEditingBooking] = useState(null);
  const [cancelingBooking, setCancelingBooking] = useState(null);

  const isBookingActive = (booking) => {
    const endTime = new Date(booking.endTime);
    const now = new Date();
    return endTime > now && booking.status !== "Cancelado";
  };

  const looksLikeBookingCode = (value) =>
    /^[A-Z0-9]{6,12}$/i.test(String(value || "").trim());

  const speakPortalGuidance = (guidance) => {
    if (!guidance) return;
    const didStartVoice = primeVoicePlayback({
      message: guidance,
      voiceOptions: PORTAL_VOICE_OPTIONS,
    });
    if (!didStartVoice) speakAlert(guidance, PORTAL_VOICE_OPTIONS);
  };

  useEffect(() => {
    if (!message) return;
    if (typeof window !== "undefined" && !isVoiceMuted()) {
      speakAlert(message, PORTAL_VOICE_OPTIONS);
    }
  }, [message]);

  const handleSearch = async (e, options = {}) => {
    if (e) e.preventDefault();
    const silent = options.silent === true;

    if (!silent) primeVoicePlayback();

    if (!code.trim()) {
      setMessage("Ingresá tu código, email o número de teléfono para buscar tus turnos.");
      return;
    }

    const trimmedCode = code.trim();
    const searchedByCode = looksLikeBookingCode(trimmedCode);

    setLoading(true);
    setMessage("");
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
        setMessage(
          searchedByCode
            ? "Ese turno ya no está activo. Puede haber sido cancelado, reprogramado o ya haber pasado."
            : "Encontramos historial, pero no hay turnos activos para gestionar.",
        );
      } else if (activeResults.length === 0) {
        setMessage(
          "No encontramos reservas activas con ese dato. Revisá el código o probá con el email o teléfono que cargaste al reservar.",
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
      setMessage(getBookingApiMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (booking) => {
    primeVoicePlayback();
    setEditingBooking(booking);
    speakPortalGuidance(
      `Abrimos la reprogramación del turno de ${booking.studentName}. Elegí una nueva propuesta con calma.`,
    );
  };

  const openCancelModal = (booking) => {
    setCancelingBooking(booking);
    speakPortalGuidance(
      `Confirmación para cancelar el turno código ${spellCodeForVoice(booking.bookingCode)}.`,
    );
  };

  const confirmCancel = async () => {
    if (!cancelingBooking) return;
    primeVoicePlayback();

    const codeToCancel = cancelingBooking.bookingCode;

    try {
      const response = await cancelBooking({ bookingCode: codeToCancel });
      const notifications = response.data.notifications;
      const clientSent =
        notifications?.client?.sent ?? notifications?.clientEmailSent ?? false;
      const clientRecipient =
        notifications?.client?.recipient || notifications?.clientRecipient || "";
      const followUp = clientSent && clientRecipient
        ? ` También enviamos el detalle a ${clientRecipient}.`
        : "";

      setCancelingBooking(null);
      const updatedBookings = bookingsList.filter(
        (booking) => booking.bookingCode !== codeToCancel,
      );
      setBookingsList(updatedBookings);
      setMessage(
        updatedBookings.length > 0
          ? "El turno cancelado ya no aparece entre tus reservas activas."
          : "El turno se canceló correctamente.",
      );

      showToast(`Turno cancelado.${followUp}`, "success", {
        title: "Cancelación confirmada",
        speak: "Listo. El turno fue cancelado y el horario volvió a quedar disponible.",
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
    } catch (error) {
      console.error(error);
      showToast(getBookingApiMessage(error), "error", {
        title: "No se pudo cancelar",
        speak: "No pude cancelar el turno. Revisá la conexión e intentá nuevamente.",
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
    }
  };

  const handleConfirmAttendance = async (booking) => {
    primeVoicePlayback();
    try {
      await confirmAttendance(booking.bookingCode);
      handleSearch(null, { silent: true });
      showToast("Asistencia confirmada. ¡Nos vemos en clase!", "success", {
        title: "Confirmación registrada",
        speak: "Listo. Tu asistencia quedó confirmada.",
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
    } catch (error) {
      console.error(error);
      showToast(getBookingApiMessage(error), "error", {
        title: "No se pudo confirmar",
        speak: "No pude confirmar tu asistencia. Revisá la conexión e intentá nuevamente.",
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
    }
  };

  const handleDeleteForever = (id) => {
    setBookingsList((prev) => prev.filter((booking) => booking._id !== id));
    showToast("Registro ocultado de tu vista.", "success");
  };

  const activeVisibleBookings = bookingsList.filter(isBookingActive);
  const historicalBookings = allResults.filter((b) => !isBookingActive(b));
  const portalToastMeta = {
    success: {
      icon: <FaCheckCircle aria-hidden="true" />,
      title: "Movimiento confirmado",
    },
    warning: {
      icon: <FaExclamationTriangle aria-hidden="true" />,
      title: "Atención",
    },
    error: {
      icon: <FaTimesCircle aria-hidden="true" />,
      title: "No pude completarlo",
    },
    info: {
      icon: <FaInfoCircle aria-hidden="true" />,
      title: "Información útil",
    },
  }[toast.type || "info"];

  return (
    <div className="client-portal-wrapper">
      {toast.show && (
        <div
          className={`portal-toast ${toast.type}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={`portal-toast-icon ${toast.type || "info"}`}>
            {portalToastMeta.icon}
          </div>
          <div className="portal-toast-copy">
            <strong>{toast.title || portalToastMeta.title}</strong>
            <span>{toast.message}</span>
            {toast.detail ? <small>{toast.detail}</small> : null}
          </div>
        </div>
      )}

      <div className="portal-container">
        <div className="portal-header">
          <img
            src={logoIcon}
            alt=""
            aria-hidden="true"
            className="portal-header-logo"
          />
          <h1 className="portal-title">Mis Turnos</h1>
          <p className="portal-subtitle">
            Buscá tu turno con el código, email o teléfono.
          </p>
        </div>

        <form onSubmit={handleSearch} className="search-container">
          <label htmlFor="portal-search-input" className="sr-only">
            Código de reserva, email o teléfono
          </label>
          <input
            id="portal-search-input"
            type="search"
            className="search-input"
            placeholder="Código, email o teléfono"
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
          Si reservaste para un menor, también podés buscar con el dato del adulto responsable.
        </p>

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
          <div className="message-error" role="alert">
            <FaTimesCircle aria-hidden="true" /> {message}
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
            <div key={booking._id} className="ticket-wrapper">
              <BookingTicket
                booking={booking}
                onEdit={startEdit}
                onCancel={openCancelModal}
                onDelete={handleDeleteForever}
                onConfirmAttendance={handleConfirmAttendance}
              />
              <StudentNotesPanel booking={booking} />
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
                  <div key={booking._id} className="ticket-wrapper ticket-wrapper--history">
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

      {editingBooking && (
        <RescheduleModal
          editingBooking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSuccess={() => {
            setEditingBooking(null);
            handleSearch(null, { silent: true });
          }}
          showToast={showToast}
        />
      )}

      {cancelingBooking && (
        <CancelModal
          cancelingBooking={cancelingBooking}
          onClose={() => setCancelingBooking(null)}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  );
};

export default ClientPortal;
