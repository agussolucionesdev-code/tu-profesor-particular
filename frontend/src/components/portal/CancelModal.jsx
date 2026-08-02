import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import {
  formatDateLong,
  formatTime,
} from "../../utils/bookingFormatters";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useAccionDeModal } from "../../hooks/useAccionDeModal";
import EstadoAccion from "../ui/EstadoAccion";
import "./CancelModal.css";

const CancelModal = ({ cancelingBooking, onClose, onConfirm }) => {
  const dialogRef = useFocusTrap(true);
  const accion = useAccionDeModal({
    enCurso: "Cancelando tu turno y liberando el horario…",
    exito: "Listo, tu turno quedó cancelado.",
    erroresPorEstado: {
      401: "Tu acceso venció. Volvé a entrar con tu código y probá otra vez.",
      403: "Ese turno no se puede cancelar desde acá. Escribinos y lo resolvemos.",
      404: "No encontramos ese turno. Puede que ya estuviera cancelado.",
      429: "Hiciste varios intentos seguidos. Esperá un momento y volvé a probar.",
    },
  });
  const isSubmitting = accion.trabajando;

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

  /* Antes esto era try/finally SIN catch: si fallaba, el error se propagaba,
     el botón volvía a la normalidad y no se decía nada. El hook se encarga de
     los tres estados y del mensaje que se anuncia por aria-live. */
  const handleConfirm = () => accion.ejecutar(onConfirm);

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

        <EstadoAccion estado={accion.estado} mensaje={accion.mensaje} />

        {/* Actions */}
        <div className="cancel-footer">
          <button
            type="button"
            className="cancel-btn-keep"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {accion.fallo ? "Cerrar" : "No, mantenerlo"}
          </button>
          <button
            type="button"
            className="cancel-btn-confirm"
            onClick={handleConfirm}
            disabled={isSubmitting || accion.salioBien}
          >
            {isSubmitting
              ? "Liberando horario…"
              : accion.fallo
                ? "Reintentar"
                : "Sí, liberar horario"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CancelModal;
