import { useEffect } from "react";
import {
  getBookingStatusLabel as bookingStatusLabel,
} from "../../utils/bookingFormatters";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const BookingEditModal = ({
  booking,
  editNotes,
  editEvolution,
  editEmotionalState,
  onClose,
  onNotesChange,
  onEvolutionChange,
  onEmotionalStateChange,
  onStatusChange,
  onSave,
}) => {
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="admin-modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        tabIndex={-1}
      >
        <div className="admin-modal-header">
          <div>
            <span className="card-kicker">Ajustes de la reserva</span>
            <h3 id="edit-modal-title">{booking.studentName}</h3>
          </div>
          <span className="code-mono">{booking.bookingCode}</span>
        </div>

        <div className="admin-modal-body">
          <label className="admin-field">
            <span>Estado</span>
            <select
              className="admin-input"
              value={bookingStatusLabel(booking.status)}
              onChange={onStatusChange}
            >
              <option value="Confirmado">Confirmado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </label>

          <label className="admin-field">
            <span>Notas privadas</span>
            <textarea
              className="admin-input admin-textarea"
              rows="4"
              value={editNotes}
              onChange={onNotesChange}
              placeholder="Seguimiento, dudas frecuentes, temas a reforzar..."
            />
          </label>

          <label className="admin-field">
            <span>Evolución del alumno</span>
            <textarea
              className="admin-input admin-textarea"
              rows="5"
              value={editEvolution}
              onChange={onEvolutionChange}
              placeholder="¿Qué avances ha tenido? Temas superados, dificultades actuales..."
            />
          </label>

          <label className="admin-field">
            <span>Estado emocional y actitudinal</span>
            <textarea
              className="admin-input admin-textarea"
              rows="3"
              value={editEmotionalState}
              onChange={onEmotionalStateChange}
              placeholder="¿Cómo se siente el alumno? Motivación, estrés, actitud ante el estudio..."
            />
          </label>
        </div>

        <div className="admin-modal-footer">
          <button
            type="button"
            className="admin-secondary-btn"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="admin-primary-btn slim"
            onClick={onSave}
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingEditModal;
