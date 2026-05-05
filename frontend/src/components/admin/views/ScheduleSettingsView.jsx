import { useEffect, useState } from "react";
import { FaCog, FaSave } from "react-icons/fa";
import { fetchAdminSettings, updateSetting } from "../../../api/bookingApi";

const FIELD_DEFS = [
  {
    key: "schedule.openingHour",
    label: "Hora de apertura",
    hint: "0–23 (ej: 7 = 07:00)",
    min: 0,
    max: 23,
    type: "number",
  },
  {
    key: "schedule.closingHour",
    label: "Hora de cierre",
    hint: "0–23 (ej: 22 = 22:00)",
    min: 0,
    max: 23,
    type: "number",
  },
  {
    key: "schedule.advanceNoticeMinutes",
    label: "Anticipación mínima (minutos)",
    hint: "Tiempo mínimo para reservar de antemano",
    min: 0,
    max: 1440,
    type: "number",
  },
  {
    key: "schedule.slotDurationMinutes",
    label: "Duración de slot (minutos)",
    hint: "30 o 60",
    min: 15,
    max: 120,
    type: "number",
  },
  {
    key: "booking.pricePerHour",
    label: "Precio por hora ($)",
    hint: "0 = no mostrar precio al alumno",
    min: 0,
    max: 99999,
    type: "number",
  },
];

const ScheduleSettingsView = ({ authConfig }) => {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState(null);
  const [saveStatus, setSaveStatus] = useState({});

  // Toggle field
  const [manualConfirm, setManualConfirm] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchAdminSettings(authConfig);
        const data = res.data.data || {};
        const vals = {};
        FIELD_DEFS.forEach(({ key }) => {
          vals[key] = data[key] ?? "";
        });
        setValues(vals);
        setManualConfirm(!!data["booking.requireManualConfirmation"]);
      } catch {
        setError("No se pudieron cargar los ajustes.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authConfig]);

  const handleSave = async (key) => {
    setSavingKey(key);
    setSaveStatus((prev) => ({ ...prev, [key]: null }));
    try {
      await updateSetting(key, Number(values[key]), authConfig);
      setSaveStatus((prev) => ({ ...prev, [key]: "ok" }));
    } catch {
      setSaveStatus((prev) => ({ ...prev, [key]: "error" }));
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleManualConfirm = async (checked) => {
    setManualConfirm(checked);
    try {
      await updateSetting("booking.requireManualConfirmation", checked, authConfig);
    } catch {
      alert("No se pudo guardar el ajuste.");
      setManualConfirm(!checked);
    }
  };

  if (loading) return <p className="empty-copy">Cargando ajustes…</p>;
  if (error) return <p className="empty-copy" style={{ color: "var(--color-danger, #e53e3e)" }}>{error}</p>;

  return (
    <>
      <section className="admin-content-grid">
        <article className="admin-card">
          <div className="admin-card-header">
            <div>
              <span className="card-kicker">Configuración</span>
              <h3><FaCog aria-hidden="true" /> Horario y precios</h3>
            </div>
          </div>

          <div className="admin-priority-stack">
            {FIELD_DEFS.map((field) => (
              <div key={field.key} className="priority-card info" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", marginBottom: "0.2rem" }}>{field.label}</strong>
                  <small style={{ opacity: 0.7 }}>{field.hint}</small>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type={field.type}
                    min={field.min}
                    max={field.max}
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    style={{ width: "80px", padding: "0.4rem 0.6rem", borderRadius: "8px", border: "1.5px solid var(--color-border, #e2e8f0)", fontSize: "0.9rem" }}
                    aria-label={field.label}
                  />
                  <button
                    type="button"
                    className="admin-primary-btn slim"
                    onClick={() => handleSave(field.key)}
                    disabled={savingKey === field.key}
                    aria-label={`Guardar ${field.label}`}
                  >
                    {savingKey === field.key ? "…" : <FaSave aria-hidden="true" />}
                  </button>
                  {saveStatus[field.key] === "ok" && (
                    <span style={{ color: "var(--color-success, #38a169)", fontSize: "0.8rem" }}>✓</span>
                  )}
                  {saveStatus[field.key] === "error" && (
                    <span style={{ color: "var(--color-danger, #e53e3e)", fontSize: "0.8rem" }}>✗</span>
                  )}
                </div>
              </div>
            ))}

            <div className="priority-card warning" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>Confirmación manual de turnos</strong>
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.75 }}>
                  Si está activo, los nuevos turnos quedan en estado "Pendiente" hasta que los confirmes vos.
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={manualConfirm}
                  onChange={(e) => handleToggleManualConfirm(e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  aria-label="Activar confirmación manual de turnos"
                />
                <span style={{ fontSize: "0.85rem" }}>{manualConfirm ? "Activo" : "Inactivo"}</span>
              </label>
            </div>
          </div>
        </article>
      </section>
    </>
  );
};

export default ScheduleSettingsView;
