import { useEffect, useState } from "react";
import { FaHistory } from "react-icons/fa";
import {
  getBookingStatusLabel as bookingStatusLabel,
} from "../../utils/bookingFormatters";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const FIELD_LABELS = { notes: "Notas", studentEvolution: "Evolución", emotionalState: "Estado emocional" };

const NotesHistoryPanel = ({ history }) => {
  const [open, setOpen] = useState(false);
  if (!history || history.length === 0) return null;
  const sorted = [...history].reverse();
  return (
    <div className="notes-history-panel">
      <button
        type="button"
        className="notes-history-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <FaHistory aria-hidden="true" /> Ver historial de notas ({history.length})
      </button>
      {open && (
        <ul className="notes-history-list" aria-label="Historial de notas">
          {sorted.map((entry, i) => (
            <li key={i} className="notes-history-entry">
              <div className="notes-history-meta">
                <span className="notes-history-field">{FIELD_LABELS[entry.field] || entry.field}</span>
                <time className="notes-history-date">
                  {entry.savedAt ? new Date(entry.savedAt).toLocaleString("es-AR") : "—"}
                </time>
              </div>
              <p className="notes-history-text">{entry.text || <em>vacío</em>}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const MAX_NOTES = 2000;
const MAX_EVOLUTION = 5000;
const MAX_EMOTIONAL = 1000;

const CharCounter = ({ value, max }) => {
  const len = (value || "").length;
  const near = len > max * 0.85;
  const over = len > max;
  return (
    <span
      className={`admin-char-counter${near ? " near" : ""}${over ? " over" : ""}`}
      aria-live="polite"
      aria-label={`${len} de ${max} caracteres`}
    >
      {len}/{max}
    </span>
  );
};

const BookingEditModal = ({
  booking,
  editNotes,
  editEvolution,
  editEmotionalState,
  attendanceStatus,
  attendanceNotes,
  attendanceSaving,
  attendanceFeedback,
  editSaving,
  editFeedback,
  onClose,
  onNotesChange,
  onEvolutionChange,
  onEmotionalStateChange,
  onAttendanceStatusChange,
  onAttendanceNotesChange,
  onStatusChange,
  onSave,
  onAttendanceSave,
}) => {
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    const trigger = document.activeElement;
    return () => { trigger?.focus?.(); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !attendanceSaving && !editSaving) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [attendanceSaving, editSaving, onClose]);

  return (
    <div
      className="admin-modal-overlay"
      onClick={attendanceSaving || editSaving ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        className="admin-modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        aria-describedby={editFeedback ? "edit-booking-feedback" : undefined}
        aria-busy={editSaving}
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
              disabled={editSaving}
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Confirmado">Confirmado</option>
              <option value="Finalizado">Finalizado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </label>

          <section className="attendance-section" aria-labelledby="attendance-section-title" aria-busy={attendanceSaving}>
            <div className="admin-field-header attendance-heading">
              <div>
                <span className="card-kicker">Seguimiento de la clase</span>
                <h4 id="attendance-section-title">Asistencia</h4>
              </div>
              <span className="attendance-badge">{attendanceStatus || "Sin registrar"}</span>
            </div>

            <div className="admin-field">
              <label htmlFor="edit-attendance-status">Resultado de asistencia</label>
              <select
                id="edit-attendance-status"
                className="admin-input"
                value={attendanceStatus}
                onChange={onAttendanceStatusChange}
                disabled={attendanceSaving}
              >
                <option value="Sin registrar">Sin registrar</option>
                <option value="Presente">Presente</option>
                <option value="Ausente">Ausente</option>
                <option value="Cancelación tardía">Cancelación tardía</option>
                <option value="No-show">No-show</option>
                <option value="Recuperatorio">Recuperatorio</option>
              </select>
            </div>

            <div className="admin-field">
              <div className="admin-field-header">
                <label htmlFor="edit-attendance-notes">Observación de asistencia (opcional)</label>
                <CharCounter value={attendanceNotes} max={1000} />
              </div>
              <textarea
                id="edit-attendance-notes"
                className="admin-input admin-textarea"
                rows="3"
                maxLength={1000}
                value={attendanceNotes}
                onChange={onAttendanceNotesChange}
                disabled={attendanceSaving || attendanceStatus === "Sin registrar"}
                placeholder="Ej.: avisó con poca anticipación o coordinó recuperatorio."
              />
            </div>

            {attendanceFeedback && (
              <p
                className={`attendance-feedback ${attendanceFeedback.type}`}
                role="status"
                aria-live="polite"
              >
                {attendanceFeedback.message}
              </p>
            )}

            <button
              type="button"
              className="admin-secondary-btn attendance-save-btn"
              onClick={onAttendanceSave}
              disabled={attendanceSaving}
            >
              {attendanceSaving ? "Guardando asistencia..." : "Guardar asistencia"}
            </button>
          </section>

          <div className="admin-field">
            <div className="admin-field-header">
              <label htmlFor="edit-notes">Notas privadas</label>
              <CharCounter value={editNotes} max={MAX_NOTES} />
            </div>
            <textarea
              id="edit-notes"
              className="admin-input admin-textarea"
              rows="4"
              maxLength={MAX_NOTES}
              value={editNotes}
              onChange={onNotesChange}
              disabled={editSaving}
              placeholder="Seguimiento, dudas frecuentes, temas a reforzar..."
            />
          </div>

          <div className="admin-field">
            <div className="admin-field-header">
              <label htmlFor="edit-evolution">Evolución del alumno</label>
              <CharCounter value={editEvolution} max={MAX_EVOLUTION} />
            </div>
            <textarea
              id="edit-evolution"
              className="admin-input admin-textarea"
              rows="5"
              maxLength={MAX_EVOLUTION}
              value={editEvolution}
              onChange={onEvolutionChange}
              disabled={editSaving}
              placeholder="¿Qué avances ha tenido? Temas superados, dificultades actuales..."
            />
          </div>

          <div className="admin-field">
            <div className="admin-field-header">
              <label htmlFor="edit-emotional">Estado emocional y actitudinal</label>
              <CharCounter value={editEmotionalState} max={MAX_EMOTIONAL} />
            </div>
            <textarea
              id="edit-emotional"
              className="admin-input admin-textarea"
              rows="3"
              maxLength={MAX_EMOTIONAL}
              value={editEmotionalState}
              onChange={onEmotionalStateChange}
              disabled={editSaving}
              placeholder="¿Cómo se siente el alumno? Motivación, estrés, actitud ante el estudio..."
            />
          </div>
        </div>

        <NotesHistoryPanel history={booking?.notesHistory} />

        {editFeedback && (
          <p
            id="edit-booking-feedback"
            className={`attendance-feedback ${editFeedback.type}`}
            role={editFeedback.type === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {editFeedback.message}
          </p>
        )}

        <div className="admin-modal-footer">
          <button
            type="button"
            className="admin-secondary-btn"
            onClick={onClose}
            disabled={attendanceSaving || editSaving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="admin-primary-btn slim"
            onClick={onSave}
            disabled={attendanceSaving || editSaving}
          >
            {editSaving ? "Guardando cambios..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingEditModal;
