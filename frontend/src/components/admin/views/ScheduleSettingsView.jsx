import { useEffect, useMemo, useState } from "react";
import {
  FaBan,
  FaClock,
  FaCog,
  FaDollarSign,
  FaSave,
  FaToggleOff,
  FaToggleOn,
} from "react-icons/fa";
import { fetchAdminSettings, updateSetting } from "../../../api/bookingApi";
import "./SettingsView.css";

const SECTIONS = [
  {
    id: "schedule",
    icon: FaClock,
    kicker: "Horario",
    title: "Horario de atención",
    fields: [
      {
        key: "schedule.openingHour",
        label: "Hora de apertura",
        hint: "0–23 · ej: 7 = 07:00",
        min: 0,
        max: 23,
      },
      {
        key: "schedule.closingHour",
        label: "Hora de cierre",
        hint: "0–23 · ej: 22 = 22:00",
        min: 0,
        max: 23,
      },
      {
        key: "schedule.advanceNoticeMinutes",
        label: "Anticipación mínima (min)",
        hint: "Tiempo mínimo para reservar de antemano",
        min: 0,
        max: 1440,
      },
      {
        key: "schedule.slotDurationMinutes",
        label: "Duración de slot (min)",
        hint: "30 o 60",
        min: 15,
        max: 120,
      },
    ],
  },
  {
    id: "booking",
    icon: FaBan,
    kicker: "Reservas",
    title: "Comportamiento de reservas",
    fields: [],
    toggles: [
      {
        key: "booking.requireManualConfirmation",
        label: "Confirmación manual",
        hint: "Los nuevos turnos quedan en Pendiente hasta que los confirmes vos.",
      },
    ],
  },
  {
    id: "pricing",
    icon: FaDollarSign,
    kicker: "Precios",
    title: "Precio por hora",
    fields: [
      {
        key: "booking.pricePerHour",
        label: "Precio por hora ($)",
        hint: "0 = no mostrar precio al alumno",
        min: 0,
        max: 99999,
      },
    ],
  },
];

const ALL_KEYS = SECTIONS.flatMap((s) => [
  ...s.fields.map((f) => f.key),
  ...(s.toggles || []).map((t) => t.key),
]);

const ScheduleSettingsView = ({ authConfig }) => {
  const [values, setValues] = useState({});
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingAll, setSavingAll] = useState(false);
  const [saveStatus, setSaveStatus] = useState({}); // key → "ok"|"error"|null

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchAdminSettings(authConfig);
        const data = res.data.data || {};
        const vals = {};
        ALL_KEYS.forEach((key) => { vals[key] = data[key] ?? ""; });
        setValues(vals);
        setOriginal(vals);
      } catch {
        setError("No se pudieron cargar los ajustes.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authConfig]);

  const dirty = useMemo(
    () => ALL_KEYS.filter((k) => String(values[k]) !== String(original[k])),
    [values, original],
  );

  const hasDirty = dirty.length > 0;

  const handleChange = (key, val) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const saveSingle = async (key, val) => {
    setSaveStatus((p) => ({ ...p, [key]: null }));
    try {
      const parsed = typeof val === "boolean" ? val : Number(val);
      await updateSetting(key, parsed, authConfig);
      setOriginal((p) => ({ ...p, [key]: val }));
      setSaveStatus((p) => ({ ...p, [key]: "ok" }));
      setTimeout(() => setSaveStatus((p) => ({ ...p, [key]: null })), 2500);
    } catch {
      setSaveStatus((p) => ({ ...p, [key]: "error" }));
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    const results = await Promise.allSettled(
      dirty.map((key) => saveSingle(key, values[key])),
    );
    setSavingAll(false);
    const anyError = results.some((r) => r.status === "rejected");
    if (anyError) alert("Algunos ajustes no se pudieron guardar.");
  };

  if (loading) return <p className="empty-copy settings-loading">Cargando ajustes…</p>;
  if (error) return <p className="empty-copy settings-error">{error}</p>;

  return (
    <div className="settings-layout">
      {/* Save all bar */}
      {hasDirty && (
        <div className="settings-dirty-bar" role="status">
          <span>{dirty.length} cambio{dirty.length !== 1 ? "s" : ""} sin guardar</span>
          <button
            type="button"
            className="admin-primary-btn slim"
            onClick={saveAll}
            disabled={savingAll}
          >
            <FaSave aria-hidden="true" />
            {savingAll ? "Guardando…" : "Guardar todo"}
          </button>
        </div>
      )}

      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <article key={section.id} className="admin-card settings-card">
            <div className="admin-card-header">
              <div>
                <span className="card-kicker">{section.kicker}</span>
                <h3>
                  <Icon aria-hidden="true" className="settings-card-icon" />
                  {section.title}
                </h3>
              </div>
            </div>

            <div className="settings-fields">
              {section.fields.map((field) => {
                const isDirty = String(values[field.key]) !== String(original[field.key]);
                const status = saveStatus[field.key];
                return (
                  <div
                    key={field.key}
                    className={`settings-field-row ${isDirty ? "is-dirty" : ""}`}
                  >
                    <div className="settings-field-label">
                      <label htmlFor={`field-${field.key}`} className="settings-label">
                        {field.label}
                      </label>
                      <small className="settings-hint">{field.hint}</small>
                    </div>
                    <div className="settings-field-control">
                      <input
                        id={`field-${field.key}`}
                        type="number"
                        min={field.min}
                        max={field.max}
                        value={values[field.key] ?? ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="settings-input"
                        aria-label={field.label}
                      />
                      <button
                        type="button"
                        className="admin-primary-btn slim settings-save-btn"
                        onClick={() => saveSingle(field.key, values[field.key])}
                        disabled={!isDirty}
                        aria-label={`Guardar ${field.label}`}
                        title="Guardar este campo"
                      >
                        <FaSave aria-hidden="true" />
                      </button>
                      {status === "ok" && <span className="settings-status ok" aria-live="polite">✓</span>}
                      {status === "error" && <span className="settings-status error" aria-live="polite">✗</span>}
                    </div>
                  </div>
                );
              })}

              {(section.toggles || []).map((toggle) => {
                const isOn = Boolean(values[toggle.key]);
                return (
                  <div key={toggle.key} className="settings-toggle-row">
                    <div className="settings-field-label">
                      <span className="settings-label">{toggle.label}</span>
                      <small className="settings-hint">{toggle.hint}</small>
                    </div>
                    <button
                      type="button"
                      className={`settings-toggle-btn ${isOn ? "is-on" : ""}`}
                      onClick={async () => {
                        const next = !isOn;
                        handleChange(toggle.key, next);
                        await saveSingle(toggle.key, next);
                      }}
                      aria-pressed={isOn}
                      aria-label={toggle.label}
                    >
                      {isOn
                        ? <FaToggleOn aria-hidden="true" />
                        : <FaToggleOff aria-hidden="true" />}
                      <span>{isOn ? "Activo" : "Inactivo"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default ScheduleSettingsView;
