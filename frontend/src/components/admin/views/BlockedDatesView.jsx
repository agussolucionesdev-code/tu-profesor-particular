import { useEffect, useState } from "react";
import { FaBan, FaCalendarAlt, FaTrashAlt } from "react-icons/fa";
import {
  fetchBlockedDates,
  addBlockedDate,
  removeBlockedDate,
} from "../../../api/bookingApi";

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
    <>
      <section className="admin-content-grid">
        <article className="admin-card">
          <div className="admin-card-header">
            <div>
              <span className="card-kicker">Disponibilidad</span>
              <h3>Bloquear fechas</h3>
            </div>
          </div>

          <form onSubmit={handleAdd} style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label htmlFor="blocked-date-input" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                  <FaCalendarAlt aria-hidden="true" /> Fecha
                </label>
                <input
                  id="blocked-date-input"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                  style={{ padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1.5px solid var(--color-border, #e2e8f0)", fontSize: "0.9rem" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "160px" }}>
                <label htmlFor="blocked-reason-input" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                  Motivo (opcional)
                </label>
                <input
                  id="blocked-reason-input"
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  maxLength={500}
                  placeholder="Ej: feriado, viaje, etc."
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1.5px solid var(--color-border, #e2e8f0)", fontSize: "0.9rem" }}
                />
              </div>
              <button
                type="submit"
                className="admin-primary-btn slim"
                disabled={saving || !newDate}
              >
                <FaBan aria-hidden="true" /> {saving ? "Bloqueando…" : "Bloquear día"}
              </button>
            </div>
            {saveError && (
              <p style={{ color: "var(--color-danger, #e53e3e)", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                {saveError}
              </p>
            )}
          </form>

          {loading ? (
            <p className="empty-copy">Cargando…</p>
          ) : error ? (
            <p className="empty-copy" style={{ color: "var(--color-danger, #e53e3e)" }}>{error}</p>
          ) : blockedDates.length === 0 ? (
            <p className="empty-copy">No hay fechas bloqueadas actualmente.</p>
          ) : (
            <div className="admin-priority-stack">
              {blockedDates.map((record) => (
                <div key={record.date} className="priority-card info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{record.date}</strong>
                    {record.reason && <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.75 }}>{record.reason}</p>}
                  </div>
                  <button
                    type="button"
                    className="inline-action danger"
                    aria-label={`Desbloquear ${record.date}`}
                    onClick={() => handleRemove(record.date)}
                  >
                    <FaTrashAlt aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  );
};

export default BlockedDatesView;
