import { useEffect, useRef } from "react";
import { FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import { getResponsibleRelationshipDisplay } from "../../utils/bookingFormatters";

const formatDateLong = (value) =>
  new Date(value).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatTime = (value) =>
  new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const CancelModal = ({ cancelingBooking, onClose, onConfirm }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay cancel-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-box danger-modal cancel-soft-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        tabIndex={-1}
      >
        <div className="cancel-soft-header">
          <div className="danger-icon soft">
            <FaExclamationTriangle />
          </div>
          <div>
            <span className="modal-kicker">Cancelar con claridad</span>
            <h3 id="cancel-title">¿Querés liberar este horario?</h3>
            <p className="danger-text">
              Si confirmás, este turno deja de aparecer en Mis Turnos y el
              horario vuelve a quedar disponible sin dejarte ruido visual.
            </p>
          </div>
        </div>

        <div className="cancel-soft-summary">
          <article>
            <span>Código</span>
            <strong>#{cancelingBooking.bookingCode}</strong>
          </article>
          <article>
            <span>Alumno</span>
            <strong>{cancelingBooking.studentName}</strong>
          </article>
          <article>
            <span>Adulto responsable</span>
            <strong>{cancelingBooking.responsibleName || "No informado"}</strong>
          </article>
          <article>
            <span>Parentesco</span>
            <strong>{getResponsibleRelationshipDisplay(cancelingBooking)}</strong>
          </article>
          <article>
            <span>Fecha</span>
            <strong>{formatDateLong(cancelingBooking.timeSlot)}</strong>
          </article>
          <article>
            <span>Horario</span>
            <strong>
              {formatTime(cancelingBooking.timeSlot)} -{" "}
              {formatTime(cancelingBooking.endTime)} hs
            </strong>
          </article>
        </div>

        <div className="cancel-soft-note">
          <FaInfoCircle />
          <span>
            Si más adelante necesitás otra clase, podés volver a reservar
            normalmente. Este turno cancelado ya no seguirá visible en tu lista
            activa.
          </span>
        </div>

        <div className="modal-footer danger-footer cancel-soft-footer">
          <button onClick={onClose} className="btn-modal safe-return">
            No, mantenerlo
          </button>
          <button onClick={onConfirm} className="btn-modal danger-confirm">
            Sí, liberar horario
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelModal;
