import { useEffect, useState } from "react";
import { FaBan, FaCalendarAlt, FaTrashAlt } from "react-icons/fa";
import {
  fetchBlockedDates,
  addBlockedDate,
  removeBlockedDate,
} from "../../../api/bookingApi";
import ConfirmDialog from "../../ui/ConfirmDialog";
import "./SettingsView.css";

const BlockedDatesView = ({ authConfig }) => {
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDateEnd, setNewDateEnd] = useState("");
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dateToUnblock, setDateToUnblock] = useState(null);
  const [removeError, setRemoveError] = useState("");

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

  const getDatesInRange = (from, to) => {
    const dates = [];
    const current = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newDate) return;
    setSaving(true);
    setSaveError("");
    try {
      const dates = newDateEnd && newDateEnd >= newDate
        ? getDatesInRange(newDate, newDateEnd)
        : [newDate];
      await Promise.all(dates.map((d) => addBlockedDate({ date: d, reason: newReason }, authConfig)));
      setNewDate("");
      setNewDateEnd("");
      setNewReason("");
      await load();
    } catch (err) {
      setSaveError(err?.response?.data?.message || "Error al bloquear las fechas.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!dateToUnblock) return;
    setRemoveError("");
    try {
      await removeBlockedDate(dateToUnblock, authConfig);
      setBlockedDates((prev) => prev.filter((r) => r.date !== dateToUnblock));
      setDateToUnblock(null);
    } catch {
      setRemoveError("No se pudo desbloquear la fecha. Intentá de nuevo.");
    }
  };

  return (
    <>
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
                <FaCalendarAlt aria-hidden="true" /> Desde
              </label>
              <input
                id="blocked-date-input"
                type="date"
                value={newDate}
                onChange={(e) => { setNewDate(e.target.value); if (newDateEnd && e.target.value > newDateEnd) setNewDateEnd(""); }}
                min={new Date().toISOString().slice(0, 10)}
                required
                className="settings-input"
              />
            </div>
            <div className="settings-field-group">
              <label htmlFor="blocked-date-end-input" className="settings-label">
                Hasta <small>(opcional)</small>
              </label>
              <input
                id="blocked-date-end-input"
                type="date"
                value={newDateEnd}
                onChange={(e) => setNewDateEnd(e.target.value)}
                min={newDate || new Date().toISOString().slice(0, 10)}
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
              {saving ? "Bloqueando…" : newDateEnd && newDateEnd > newDate ? "Bloquear rango" : "Bloquear día"}
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
                  onClick={() => setDateToUnblock(record.date)}
                >
                  <FaTrashAlt aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>

      <ConfirmDialog
        isOpen={dateToUnblock !== null}
        title="Desbloquear fecha"
        message={`¿Desbloquear el ${dateToUnblock}? Quedará disponible para nuevas reservas.`}
        confirmLabel="Desbloquear"
        cancelLabel="Cancelar"
        onConfirm={handleRemove}
        onCancel={() => { setDateToUnblock(null); setRemoveError(""); }}
      />

      {removeError && (
        <p role="alert" style={{ color: "var(--color-error-deep)", padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
          {removeError}
        </p>
      )}
    </>
  );
};

export default BlockedDatesView;
