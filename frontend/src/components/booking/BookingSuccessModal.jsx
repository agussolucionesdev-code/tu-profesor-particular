import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaCopy,
  FaEnvelope,
  FaExclamationCircle,
  FaHourglassHalf,
  FaInfoCircle,
  FaSearch,
  FaTimes,
  FaWhatsapp,
} from "react-icons/fa";
import { Link } from "react-router-dom";

const getDeliveryAlert = (successData) => {
  const emailRecipient = successData?.notifications?.client?.recipient;
  const emailSent = successData?.notifications?.client?.sent;

  if (emailRecipient && emailSent) {
    return {
      type: "success",
      icon: <FaEnvelope aria-hidden="true" />,
      text: `Comprobante enviado a ${emailRecipient}.`,
    };
  }

  if (successData?.email) {
    return {
      type: "warning",
      icon: <FaExclamationCircle aria-hidden="true" />,
      text: "Guardá el código — si el correo tarda, buscá tu turno desde Mis Turnos.",
    };
  }

  return {
    type: "info",
    icon: <FaInfoCircle aria-hidden="true" />,
    text: "Sin email cargado — el código es tu referencia principal para Mis Turnos.",
  };
};

const BookingSuccessModal = ({
  show,
  successData,
  whatsappConfirmText,
  onCopyCode,
  onClose,
}) => {
  const dialogRef = useRef(null);

  // Focus trap + body scroll lock
  useEffect(() => {
    if (!show) return;
    dialogRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  // Escape to close
  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  const alert = getDeliveryAlert(successData);
  const durationText =
    successData?.durationLabel ||
    `${successData?.actualDuration || "--"} hs`;

  const detailRows = [
    { label: "Alumno", value: successData?.cleanStudentName },
    { label: "Responsable", value: successData?.responsibleLabel },
    { label: "Parentesco", value: successData?.responsibleRelationshipLabel },
    { label: "Nivel", value: successData?.educationLevel },
    { label: "Materia", value: successData?.subject },
    { label: "Institución", value: successData?.school },
  ].filter((r) => r.value);

  return createPortal(
    <div
      className="success-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="success-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        tabIndex={-1}
      >
        {/* Close */}
        <button
          type="button"
          className="success-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <FaTimes />
        </button>

        {/* Header */}
        <div className="success-header">
          <FaCheckCircle className="success-check-icon" aria-hidden="true" />
          <h2 id="booking-success-title">Tu turno ya quedó listo</h2>
          <div className="success-header-facts">
            <span>
              <FaCalendarAlt aria-hidden="true" /> {successData?.day}
            </span>
            <span>
              <FaClock aria-hidden="true" /> {successData?.startTime} a{" "}
              {successData?.endTime} hs
            </span>
            <span>
              <FaHourglassHalf aria-hidden="true" /> {durationText}
            </span>
          </div>
        </div>

        {/* Code */}
        <div className="success-code-section">
          <span className="success-code-label">Código de gestión</span>
          <h3 className="success-code-value">{successData?.bookingCode}</h3>
          <p className="success-code-hint">
            Guardalo — es tu llave para gestionar el turno desde Mis Turnos.
          </p>
          <button
            type="button"
            className="success-copy-btn"
            onClick={onCopyCode}
          >
            <FaCopy aria-hidden="true" /> Copiar código
          </button>
        </div>

        {/* Details */}
        <div className="success-details">
          {detailRows.map((row) => (
            <div key={row.label} className="success-detail-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>

        {/* Delivery alert */}
        <div className={`success-alert success-alert-${alert.type}`}>
          {alert.icon}
          <span>{alert.text}</span>
        </div>

        {/* Actions */}
        <div className="success-actions">
          <Link to="/portal" className="success-btn-primary" onClick={onClose}>
            <FaSearch aria-hidden="true" /> Ir a Mis Turnos
          </Link>
          <a
            href={`https://wa.me/5491164236675?text=${encodeURIComponent(whatsappConfirmText)}`}
            className="success-btn-whatsapp"
            target="_blank"
            rel="noreferrer"
          >
            <FaWhatsapp aria-hidden="true" /> Enviar comprobante
          </a>
          <button
            type="button"
            className="success-btn-dismiss"
            onClick={onClose}
          >
            Cerrar y volver
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default BookingSuccessModal;
