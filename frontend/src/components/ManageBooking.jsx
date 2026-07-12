import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaCheckCircle, FaLock, FaTimesCircle } from "react-icons/fa";
import BookingTicket from "./BookingTicket";
import CancelModal from "./portal/CancelModal";
import RescheduleModal from "./portal/RescheduleModal";
import {
  cancelBooking,
  getManagedBooking,
  revokeManagementAccess,
} from "../api/bookingApi";
import { getBookingApiMessage } from "../utils/bookingFormatters";
import { usePageMeta } from "../hooks/useDocumentTitle";
import "./ClientPortal.css";
import "./ManageBooking.css";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const consumeManagementToken = () => {
  const fragment = window.location.hash.slice(1);
  const parsed = new URLSearchParams(fragment);
  const token = parsed.get("token") || "";

  // Clear the complete fragment and query before rendering. The token must
  // never remain in history, the DOM, storage, or future requests.
  window.history.replaceState(null, "", window.location.pathname);
  return TOKEN_PATTERN.test(token) && [...parsed.keys()].every((key) => key === "token")
    ? token
    : null;
};

const isManageable = (booking) =>
  booking &&
  booking.status !== "Cancelado" &&
  booking.status !== "Finalizado" &&
  new Date(booking.endTime) > new Date();

const ManageBooking = () => {
  usePageMeta("Gestionar turno", "Gestioná de forma segura tu clase particular.");
  const [managementToken] = useState(consumeManagementToken);
  const [booking, setBooking] = useState(null);
  const [state, setState] = useState(managementToken ? "loading" : "invalid");
  const [message, setMessage] = useState("");
  const [cancelingBooking, setCancelingBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);

  const loadBooking = async () => {
    if (!managementToken) return;
    setState("loading");
    try {
      const response = await getManagedBooking(managementToken);
      setBooking(response.data.data);
      setState("ready");
    } catch {
      setState("invalid");
    }
  };

  useEffect(() => {
    loadBooking();
  // The bearer is intentionally captured only in component memory.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managementToken]);

  const handleCancel = async () => {
    if (!cancelingBooking || !managementToken) return;
    try {
      await cancelBooking({ bookingCode: cancelingBooking.bookingCode }, managementToken);
      setCancelingBooking(null);
      setMessage("El turno se canceló correctamente.");
      await loadBooking();
    } catch (error) {
      setMessage(getBookingApiMessage(error));
      setCancelingBooking(null);
    }
  };

  const handleRevoke = async () => {
    if (!managementToken) return;
    try {
      await revokeManagementAccess(managementToken);
      setBooking(null);
      setState("revoked");
    } catch (error) {
      setMessage(getBookingApiMessage(error));
    }
  };

  if (state === "loading") {
    return <div className="manage-page-state" role="status">Verificando tu enlace seguro…</div>;
  }

  if (state === "invalid" || state === "revoked") {
    return (
      <section className="manage-page-state manage-page-state--invalid">
        <FaTimesCircle aria-hidden="true" />
        <h1>Enlace no disponible</h1>
        <p>Este enlace venció, fue revocado o no es válido. Pedí uno nuevo desde Mis Turnos.</p>
        <Link to="/portal">Ir a Mis Turnos</Link>
      </section>
    );
  }

  const manageable = isManageable(booking);
  return (
    <div className="client-portal-wrapper manage-booking-wrapper">
      <section className="portal-container manage-booking-container" aria-labelledby="manage-booking-title">
        <header className="portal-header">
          <FaLock aria-hidden="true" className="manage-booking-lock" />
          <h1 id="manage-booking-title" className="portal-title">Gestioná tu turno</h1>
          <p className="portal-subtitle">Este acceso es privado y está vinculado únicamente a tu reserva.</p>
        </header>

        {message && <p className="portal-message portal-message--info" role="status">{message}</p>}

        <BookingTicket
          booking={booking}
          onEdit={manageable ? setEditingBooking : undefined}
          onCancel={manageable ? setCancelingBooking : undefined}
        />

        {!manageable && (
          <p className="portal-message portal-message--info" role="status">
            Este turno ya no admite cambios desde este enlace.
          </p>
        )}

        <div className="manage-booking-security">
          <FaCheckCircle aria-hidden="true" />
          <p>Cuando termines, podés desactivar este enlace en este dispositivo.</p>
          <button type="button" onClick={handleRevoke}>Desactivar enlace</button>
        </div>
      </section>

      {cancelingBooking && (
        <CancelModal
          cancelingBooking={cancelingBooking}
          onClose={() => setCancelingBooking(null)}
          onConfirm={handleCancel}
        />
      )}
      {editingBooking && (
        <RescheduleModal
          editingBooking={editingBooking}
          managementToken={managementToken}
          onClose={() => setEditingBooking(null)}
          onSuccess={async () => {
            setEditingBooking(null);
            setMessage("Turno reprogramado correctamente.");
            await loadBooking();
          }}
          showToast={(text) => setMessage(text)}
        />
      )}
    </div>
  );
};

export default ManageBooking;
