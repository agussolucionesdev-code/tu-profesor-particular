import { useEffect, useState } from "react";
import { FaBan, FaCalendarAlt, FaTrashAlt } from "react-icons/fa";
import {
  fetchBlockedDates,
  addBlockedDate,
  removeBlockedDate,
} from "../../../api/bookingApi";
import "./SettingsView.css";

const BlockedDatesView = ({ authConfig }) => {
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchBlockedDates();
      setBlockedDates(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      setError("No se pudieron cargar las fechas bloqueadas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newDate) return;
    setSaving(true);
    setSaveError("");
    try {
      await addBlockedDate({ date: newDate, reason: newReason }, authConfig);
      setNewDate("");
      setNewReason("");
      await load();
    } catch (err) {
      setSaveError(err?.response?.data?.message || "Error al bloquear la fecha.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (date) => {
    if (!window.confirm(`¿Desbloquear el ${date}?`)) return;
    try {
      await removeBlockedDate(date, authConfig);
      setBlockedDates((prev) => prev.filter((r) => r.date !== date));
    } catch {
      alert("No se pudo desbloquear la fecha.");
    }
  };

  return (
    <div className="settings-layout">
      <article className="admin-card settings-card">
        <div className="admin-card-header">
          <div>
            <span className="card-kicker">Disponibilidad</span>
            <h3>
              <FaBan aria-hidden="true" className="settings-card-icon" />
              Bloquear fechas
            </h3>
          </div>
        </div>

        <form onSubmit={handleAdd} className="blocked-dates-form">
          <div className="blocked-dates-inputs">
            <div className="settings-field-group">
              <label htmlFor="blocked-date-input" className="settings-label">
                <FaCalendarAlt aria-hidden="true" /> Fecha
              </label>
              <input
                id="blocked-date-input"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                required
                className="settings-input"
              />
            </div>
            <div className="settings-field-group flex-1">
              <label htmlFor="blocked-reason-input" className="settings-label">
                Motivo (opcional)
              </label>
              <input
                id="blocked-reason-input"
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                maxLength={500}
                placeholder="Ej: feriado, viaje, etc."
                className="settings-input"
              />
            </div>
            <button
              type="submit"
              className="admin-primary-btn slim settings-submit-btn"
              disabled={saving || !newDate}
            >
              <FaBan aria-hidden="true" />
              {saving ? "Bloqueando…" : "Bloquear día"}
            </button>
          </div>
          {saveError && (
            <p className="settings-error-msg" role="alert">{saveError}</p>
          )}
        </form>

        {loading ? (
          <p className="empty-copy">Cargando…</p>
        ) : error ? (
          <p className="empty-copy settings-error">{error}</p>
        ) : blockedDates.length === 0 ? (
          <p className="empty-copy">No hay fechas bloqueadas actualmente.</p>
        ) : (
          <div className="admin-priority-stack">
            {blockedDates.map((record) => (
              <div key={record.date} className="priority-card info blocked-date-row">
                <div>
                  <strong>{record.date}</strong>
                  {record.reason && (
                    <p className="blocked-date-reason">{record.reason}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="inline-action danger"
                  aria-label={`Desbloquear ${record.date}`}
                  title="Desbloquear esta fecha"
                  onClick={() => handleRemove(record.date)}
                >
                  <FaTrashAlt aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
};

export default BlockedDatesView;
