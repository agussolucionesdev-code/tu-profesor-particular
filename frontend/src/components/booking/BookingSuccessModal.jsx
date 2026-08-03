import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaCalendarAlt,
  FaCalendarPlus,
  FaCheckCircle,
  FaClock,
  FaCopy,
  FaEnvelope,
  FaExclamationCircle,
  FaHourglassHalf,
  FaInfoCircle,
  FaLink,
  FaMapMarkerAlt,
  FaSearch,
  FaTimes,
  FaWhatsapp,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { downloadIcs } from "../../utils/icsExport";

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
  onCopyManagementLink,
  onClose,
}) => {
  const dialogRef = useFocusTrap(show);
  const [copyAnnouncement, setCopyAnnouncement] = useState("");

  const handleCopyCode = () => {
    onCopyCode?.();
    setCopyAnnouncement("Código copiado al portapapeles");
    setTimeout(() => setCopyAnnouncement(""), 2000);
  };

  // Body scroll lock. Focus containment and restoration are shared by all dialogs.
  useEffect(() => {
    if (!show) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
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
    `${successData?.actualDuration || "--"} h`;

  /* La modalidad faltaba en el comprobante: se elegía en el paso 2 y después no
     volvía a aparecer en ningún lado de la app. */
  const esPresencial = successData?.modality === "presencial";
  const detailRows = [
    { label: "Alumno", value: successData?.cleanStudentName },
    { label: "Responsable", value: successData?.responsibleLabel },
    { label: "Parentesco", value: successData?.responsibleRelationshipLabel },
    { label: "Nivel", value: successData?.educationLevel },
    { label: "Materia", value: successData?.subject },
    { label: "Institución", value: successData?.school },
    { label: "Modalidad", value: esPresencial ? "Presencial" : "Online" },
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
        aria-describedby="booking-success-feedback"
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
              {successData?.endTime} h
            </span>
            <span>
              <FaHourglassHalf aria-hidden="true" /> {durationText}
            </span>
          </div>
        </div>

        {/* Perforado: el corte visual que vuelve comprobante a la tarjeta. */}
        <div className="success-perf" aria-hidden="true">
          <span className="success-perf-notch success-perf-notch--left" />
          <span className="success-perf-line" />
          <span className="success-perf-notch success-perf-notch--right" />
        </div>

        {/* Código. Antes había DOS avisos sobre guardarlo (acá y en la alerta de
            abajo) diciendo casi lo mismo: quedó uno solo, y la instrucción de
            qué hacer con el código vive junto al código. */}
        <div className="success-code-section">
          <span className="success-code-label">Tu código</span>
          <h3 className="success-code-value">{successData?.bookingCode}</h3>
          <p className="success-code-hint">
            Con este código entrás a <strong>Mis Turnos</strong> para
            reprogramar o cancelar.
          </p>
          <div className="success-code-actions">
            <button
              type="button"
              className="success-copy-btn"
              onClick={handleCopyCode}
            >
              <FaCopy aria-hidden="true" /> Copiar código
            </button>
            {successData?.managementUrl && (
              <button
                type="button"
                className="success-copy-btn success-copy-btn--ghost"
                onClick={onCopyManagementLink}
              >
                <FaLink aria-hidden="true" /> Copiar enlace directo
              </button>
            )}
          </div>
          {successData?.managementUrl && (
            <p className="success-code-alt">
              El enlace directo te lleva a gestionar el turno sin escribir el
              código.
            </p>
          )}
          <span role="status" aria-live="polite" className="sr-only">
            {copyAnnouncement}
          </span>
        </div>

        {/* Detalle del turno, en formato recibo. */}
        <div className="success-details">
          {detailRows.map((row) => (
            <div key={row.label} className="success-detail-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>

        {/* Adónde ir. Es lo primero que alguien va a buscar el día de la clase,
            así que va en el comprobante y no solo en el email: si el correo se
            pierde en spam, esta pantalla y el .ics son lo único que queda. */}
        {esPresencial && successData?.teacherLocation?.address && (
          <div className="success-location">
            <span className="success-location-label">
              <FaMapMarkerAlt aria-hidden="true" /> Dónde
            </span>
            <a
              className="success-location-address"
              href={successData.teacherLocation.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {successData.teacherLocation.address}
              <span className="sr-only"> — abrir en el mapa (pestaña nueva)</span>
            </a>
          </div>
        )}

        {/* Estado del envío del comprobante. */}
        <div
          id="booking-success-feedback"
          className={`success-alert success-alert-${alert.type}`}
          role="status"
        >
          {alert.icon}
          <span>{alert.text}</span>
        </div>

        {/* Actions */}
        <div className="success-actions">
          {successData?.managementUrl ? (
            <button
              type="button"
              className="success-btn-primary"
              onClick={() => window.location.assign(successData.managementUrl)}
            >
              <FaSearch aria-hidden="true" /> Gestionar este turno
            </button>
          ) : (
            <Link to="/portal" className="success-btn-primary" onClick={onClose}>
              <FaSearch aria-hidden="true" /> Ir a Mis Turnos
            </Link>
          )}
          <a
            href={`https://wa.me/5491133365937?text=${encodeURIComponent(whatsappConfirmText)}`}
            className="success-btn-whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Enviar comprobante por WhatsApp (abre la app)"
          >
            <FaWhatsapp aria-hidden="true" /> Enviar comprobante
            <span className="success-btn-external-hint"> (WhatsApp)</span>
          </a>
          {successData?.rawTimeSlot && (
            <button
              type="button"
              className="success-btn-calendar"
              onClick={() =>
                downloadIcs(
                  {
                    bookingCode: successData.bookingCode,
                    studentName: successData.cleanStudentName,
                    subject: successData.subject,
                    educationLevel: successData.educationLevel,
                    timeSlot: successData.rawTimeSlot,
                    endTime: successData.rawEndTime,
                    duration: successData.actualDuration,
                    modality: successData.modality,
                    location: successData.teacherLocation?.address,
                  },
                  `turno-${successData.bookingCode}.ics`,
                  // Quien descarga acá es el alumno, no el profesor: el título
                  // del evento nombra la materia, no a sí mismo.
                  { audience: "student" },
                )
              }
            >
              <FaCalendarPlus aria-hidden="true" /> Agregar al calendario
            </button>
          )}
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
