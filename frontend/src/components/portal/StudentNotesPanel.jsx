import { useState } from "react";
import { updateStudentNotes } from "../../api/bookingApi";
import "./StudentNotesPanel.css";

const StudentNotesPanel = ({ booking }) => {
  const [notes, setNotes] = useState(booking.studentNotes || "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'ok' | 'error' | null

  const endTime = new Date(booking.endTime);
  const isEditable =
    booking.status !== "Cancelado" &&
    booking.status !== "Finalizado" &&
    endTime > new Date();

  if (!isEditable) return null;

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await updateStudentNotes(booking.bookingCode, notes);
      setStatus("ok");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="notes-panel">
      <label htmlFor={`notes-${booking._id}`} className="notes-label">
        Notas para el profe
      </label>
      <textarea
        id={`notes-${booking._id}`}
        className="notes-textarea"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setStatus(null);
        }}
        maxLength={500}
        rows={3}
        placeholder="Contale algo al profe antes de la clase (dudas, temas, contexto…)"
      />
      <div className="notes-footer">
        <small className="notes-counter">{notes.length}/500</small>
        <div className="notes-actions">
          {status === "ok" && (
            <small className="notes-status-ok">¡Guardado!</small>
          )}
          {status === "error" && (
            <small className="notes-status-error">No se pudo guardar.</small>
          )}
          <button
            type="button"
            className="notes-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentNotesPanel;
