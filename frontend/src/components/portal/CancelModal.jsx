import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import {
  formatDateLong,
  formatTime,
} from "../../utils/bookingFormatters";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import "./CancelModal.css";

const CancelModal = ({ cancelingBooking, onClose, onConfirm }) => {
  const dialogRef = useFocusTrap(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="cancel-overlay"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cancel-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        aria-describedby="cancel-description"
        aria-busy={isSubmitting}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="cancel-header">
          <span className="cancel-icon" aria-hidden="true">
            <FaExclamationTriangle />
          </span>
          <div>
            <h3 id="cancel-title" className="cancel-title">
              ¿Querés liberar este horario?
            </h3>
            <p id="cancel-description" className="cancel-subtitle">
              Si confirmás, el turno se cancela y el horario vuelve a estar
              disponible.
            </p>
          </div>
        </div>

        {/* Summary grid */}
        <dl className="cancel-grid">
          <div className="cancel-row">
            <dt>Código</dt>
            <dd>#{cancelingBooking.bookingCode}</dd>
          </div>
          <div className="cancel-row">
            <dt>Alumno</dt>
            <dd>{cancelingBooking.studentName}</dd>
          </div>
          <div className="cancel-row">
            <dt>Fecha</dt>
            <dd>{formatDateLong(cancelingBooking.timeSlot)}</dd>
          </div>
          <div className="cancel-row">
            <dt>Horario</dt>
            <dd>
              {formatTime(cancelingBooking.timeSlot)} –{" "}
              {formatTime(cancelingBooking.endTime)} h
            </dd>
          </div>
        </dl>

        {/* Info note */}
        <p className="cancel-note">
          <FaInfoCircle aria-hidden="true" />
          <span>
            Si necesitás otra clase, podés volver a reservar normalmente en
            cualquier momento.
          </span>
        </p>

        {/* Actions */}
        <div className="cancel-footer">
          <button
            type="button"
            className="cancel-btn-keep"
            onClick={onClose}
            disabled={isSubmitting}
          >
            No, mantenerlo
          </button>
          <button
            type="button"
            className="cancel-btn-confirm"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Liberando horario…" : "Sí, liberar horario"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CancelModal;
