import { useEffect, useState } from "react";
import {
  FaCalendarAlt,
  FaCalendarCheck,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHourglassHalf,
  FaInfoCircle,
  FaSearch,
  FaTimesCircle,
  FaWhatsapp,
} from "react-icons/fa";
import "../index.css";
import "./ClientPortal.css";
import "../styles/theme-polish.css";
import "../styles/accessibility-system.css";
import BookingTicket from "./BookingTicket";
import RescheduleModal from "./portal/RescheduleModal";
import CancelModal from "./portal/CancelModal";
import logoIcon from "../assets/images/logo-icon-sin-fondo.png";
import {
  lookupBookings,
  cancelBooking,
} from "../api/bookingApi";
import {
  getBookingApiMessage,
} from "../utils/bookingFormatters";
import {
  isVoiceMuted,
  primeVoicePlayback,
  speakAlert,
  spellCodeForVoice,
  useNeuroToast,
} from "../utils/neuroToast";

const PORTAL_VOICE_OPTIONS = {
  rate: 0.86,
  pitch: 0.98,
  volume: 0.9,
};

const ClientPortal = () => {
  const [code, setCode] = useState("");
  const [bookingsList, setBookingsList] = useState([]);
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
    if (!didStartVoice) {
      speakAlert(guidance, PORTAL_VOICE_OPTIONS);
    }
  };

  useEffect(() => {
    if (!message) return;
    // Only speak if voice was already unlocked by a user gesture — never auto-trigger
    if (typeof window !== "undefined" && !isVoiceMuted()) {
      speakAlert(message, PORTAL_VOICE_OPTIONS);
    }
  }, [message]);

  const handleSearch = async (e, options = {}) => {
    if (e) e.preventDefault();
    const silent = options.silent === true;

    if (!silent) {
      primeVoicePlayback();
    }

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
      setBookingsList(activeResults);

      if (results.length > 0 && activeResults.length === 0) {
        setMessage(
          searchedByCode
            ? "Ese turno ya no está activo. Puede haber sido cancelado, reprogramado o ya haber pasado. Si necesitás otro horario, podés reservar de nuevo o escribirme por WhatsApp."
            : "Encontramos historial, pero no hay turnos activos para gestionar. Si querés, podés reservar un nuevo horario con tranquilidad.",
        );
      } else if (activeResults.length === 0) {
        setMessage(
          "No encontramos reservas activas con ese dato. Revisá el código o probá con el email o teléfono que cargaste al reservar.",
        );
      } else if (!silent) {
        speakAlert(
          activeResults.length === 1
            ? "Ya encontré tu turno activo. Desde acá podés revisarlo, reprogramarlo o cancelarlo con tranquilidad."
            : `Ya encontré ${activeResults.length} turnos activos para gestionar. Podés resolverlos desde esta misma pantalla.`,
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
      `Abrimos la reprogramación del turno de ${booking.studentName}. Elegí una nueva propuesta con calma; nada se cambia hasta que confirmes.`,
    );
  };

  const openCancelModal = (bookingCode) => {
    const bookingToCancel = bookingsList.find(
      (booking) => booking.bookingCode === bookingCode,
    );
    setCancelingBooking(bookingToCancel);

    if (bookingToCancel) {
      speakPortalGuidance(
        `Abrimos la confirmación para cancelar el turno código ${spellCodeForVoice(bookingToCancel.bookingCode)}, de ${bookingToCancel.studentName}. Solo se libera si confirmás la cancelación.`,
      );
    }
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
        : " Podés volver a encontrarla desde Mis Turnos con tu código, email o número de teléfono.";

      setCancelingBooking(null);
      const updatedBookings = bookingsList.filter(
        (booking) => booking.bookingCode !== codeToCancel,
      );
      setBookingsList(updatedBookings);
      setMessage(
        updatedBookings.length > 0
          ? "El turno cancelado ya no aparece entre tus reservas activas."
          : "El turno se canceló correctamente y ya no aparece en Mis Turnos.",
      );

      showToast(
        `Turno cancelado.${followUp}`,
        "success",
        {
          title: "Cancelación confirmada",
          detail:
            "La reserva deja de mostrarse en tu vista activa y el horario vuelve a quedar disponible.",
          speak:
            "Listo. El turno fue cancelado correctamente y ese horario volvió a quedar disponible.",
          voiceOptions: PORTAL_VOICE_OPTIONS,
        },
      );
    } catch (error) {
      console.error(error);
      showToast(getBookingApiMessage(error), "error", {
        title: "No se pudo cancelar",
        speak:
          "No pude cancelar el turno en este momento. Revisá la conexión e intentá nuevamente.",
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
    }
  };

  const handleDeleteForever = (id) => {
    setBookingsList((prev) => prev.filter((booking) => booking._id !== id));
    showToast(
      "Registro ocultado de tu vista. Si lo necesitás, podés volver a buscarlo con el código, email o número de teléfono.",
      "success",
    );
  };

  const activeVisibleBookings = bookingsList.filter(isBookingActive);
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
          <p className="portal-subtitle">Gestioná tus clases próximas.</p>
          <div className="header-decoration"></div>
        </div>

        <div className="portal-guidance" aria-label="Cómo gestionar tus turnos">
          <div className="guidance-card">
            <FaSearch aria-hidden="true" />
            <strong>Empieza por el código</strong>
            <span>Si lo tenés, pegalo tal cual aparece en tu comprobante.</span>
          </div>
          <div className="guidance-card">
            <FaCalendarAlt aria-hidden="true" />
            <strong>También sirve tu contacto</strong>
            <span>Si no tenés el código a mano, usá email o número de teléfono.</span>
          </div>
          <div className="guidance-card">
            <FaWhatsapp aria-hidden="true" />
            <strong>Gestioná sin vueltas</strong>
            <span>Desde acá podés revisar, reprogramar o cancelar.</span>
          </div>
        </div>

        <div className="portal-management-alert" role="note">
          <div className="portal-management-icon" aria-hidden="true">
            <FaInfoCircle />
          </div>
          <div className="portal-management-copy">
            <strong>Tu código vive en Mis Turnos</strong>
            <p>
              Si tenés el código de reserva, pegalo tal cual aparece en el
              comprobante. Si no, también podés usar el email o el número de
              teléfono que cargaste al reservar.
            </p>
            <div className="search-method-pills">
              <span>Código de reserva</span>
              <span>Email cargado</span>
              <span>Teléfono cargado</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="search-container">
          <label htmlFor="portal-search-input" className="sr-only">
            Código de reserva, email o teléfono
          </label>
          <input
            id="portal-search-input"
            type="search"
            className="search-input"
            placeholder="Ingresá tu código, email o número de teléfono"
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
            {loading ? <FaHourglassHalf className="spin" /> : "Ver Mis Turnos"}
          </button>
        </form>

        <p id="portal-search-help" className="search-helper">
          Si reservaste para un menor, también podés buscar con el dato de
          contacto del adulto responsable.
        </p>

        {hasSearched && activeVisibleBookings.length > 0 && (
          <div className="portal-results-summary" role="status">
            <FaInfoCircle aria-hidden="true" />
            <span>
              Encontramos {activeVisibleBookings.length} turno
              {activeVisibleBookings.length === 1 ? "" : "s"} activo
              {activeVisibleBookings.length === 1 ? "" : "s"} para gestionar.
            </span>
          </div>
        )}

        {message && (
          <div className="message-error" role="alert">
            <FaTimesCircle aria-hidden="true" /> {message}
          </div>
        )}

        {hasSearched && !loading && bookingsList.length === 0 && !message && (
          <div className="empty-state">
            <FaCalendarCheck className="empty-state-icon" aria-hidden="true" />
            <p>
              No hay turnos activos para mostrar. Probá con tu código exacto,
              email o número de teléfono cargados al reservar.
            </p>
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
              />
            </div>
          ))}
        </div>

        <section
          className="portal-support-strip"
          aria-label="Ayuda extra para gestionar turnos"
        >
          <article className="portal-support-card">
            <FaCalendarCheck aria-hidden="true" />
            <strong>Revisá antes de salir</strong>
            <p>
              Si reprogramás o cancelás, la confirmación queda guardada al
              instante y vuelve a aparecer en esta misma vista.
            </p>
          </article>

          <article className="portal-support-card">
            <FaInfoCircle aria-hidden="true" />
            <strong>Si no encontrás el turno, no adivines</strong>
            <p>
              Probá con el código, el email o el teléfono del responsable que
              cargaste al reservar.
            </p>
          </article>

          <a
            className="portal-support-card portal-support-cta"
            href="https://wa.me/5491164236675?text=Hola%20Agustin,%20necesito%20ayuda%20para%20gestionar%20un%20turno."
            target="_blank"
            rel="noreferrer"
          >
            <FaWhatsapp aria-hidden="true" />
            <strong>Si algo no aparece, te ayudamos por WhatsApp</strong>
            <p>
              Podés seguir el proceso con acompañamiento humano sin salir del
              circuito de reserva.
            </p>
            <span>Abrir WhatsApp</span>
          </a>
        </section>
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
