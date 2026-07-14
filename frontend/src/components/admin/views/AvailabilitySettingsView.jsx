import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaBan,
  FaCalendarAlt,
  FaClock,
  FaCoffee,
  FaPlus,
  FaSave,
  FaSyncAlt,
  FaTrashAlt,
} from "react-icons/fa";
import {
  fetchBlockedDates,
  fetchAdminSchedule,
  removeBlockedDate,
  updateAdminSchedule,
} from "../../../api/bookingApi";
import {
  classifyScheduleSaveError,
  parseAdminScheduleResponse,
  parseLegacyBlockedDatesResponse,
  serializeScheduleDraft,
  validateScheduleDraft,
} from "../../../utils/availabilitySchedule";
import "./SettingsView.css";

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const focusById = (id) => {
  if (!id || typeof document === "undefined") return;
  window.requestAnimationFrame(() => document.getElementById(id)?.focus());
};

const formatMinutes = (minutes) => {
  if (minutes === 1440) return "24:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

const createInterval = (slotDurationMinutes, startMinutes = 9 * 60) => ({
  start: formatMinutes(startMinutes),
  end: formatMinutes(Math.min(1440, startMinutes + Number(slotDurationMinutes || 30))),
});

const IntervalEditor = ({
  idPrefix,
  label,
  intervals,
  slotDurationMinutes,
  onChange,
}) => {
  const addInterval = () => {
    const nextIndex = intervals.length;
    onChange([...intervals, createInterval(slotDurationMinutes)]);
    focusById(`${idPrefix}-${nextIndex}-start`);
  };

  return (
    <div className="availability-interval-group">
      <div className="availability-subheader">
        <strong>{label}</strong>
        <button type="button" className="inline-action" onClick={addInterval}>
          <FaPlus aria-hidden="true" /> Agregar intervalo
        </button>
      </div>
      {intervals.length === 0 ? (
        <p className="settings-hint">Sin intervalos configurados.</p>
      ) : (
        <div className="availability-interval-list">
          {intervals.map((interval, index) => (
            <div className="availability-interval-row" key={`${idPrefix}-${index}`}>
              <label htmlFor={`${idPrefix}-${index}-start`}>
                Desde
                <input
                  id={`${idPrefix}-${index}-start`}
                  type="time"
                  step={slotDurationMinutes * 60}
                  value={interval.start}
                  onChange={(event) => onChange(intervals.map((current, currentIndex) =>
                    currentIndex === index
                      ? { ...current, start: event.target.value }
                      : current))}
                  className="settings-input"
                />
              </label>
              <label htmlFor={`${idPrefix}-${index}-end`}>
                Hasta
                <input
                  id={`${idPrefix}-${index}-end`}
                  type="time"
                  step={slotDurationMinutes * 60}
                  value={interval.end}
                  onChange={(event) => onChange(intervals.map((current, currentIndex) =>
                    currentIndex === index
                      ? { ...current, end: event.target.value }
                      : current))}
                  className="settings-input"
                />
              </label>
              <button
                type="button"
                className="inline-action danger"
                onClick={() => onChange(intervals.filter((_, currentIndex) => currentIndex !== index))}
                aria-label={`Eliminar intervalo ${index + 1} de ${label}`}
              >
                <FaTrashAlt aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AvailabilitySettingsView = ({ authConfig }) => {
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [conflict, setConflict] = useState(false);
  const [newHoliday, setNewHoliday] = useState("");
  const [legacyBlocks, setLegacyBlocks] = useState([]);
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [legacyError, setLegacyError] = useState("");
  const [deletingLegacyDate, setDeletingLegacyDate] = useState("");
  const requestVersionRef = useRef(0);
  const legacyRequestVersionRef = useRef(0);

  const loadSchedule = useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setLoading(true);
    setError("");
    setFeedback({ type: "", message: "" });
    setConflict(false);
    setDraft(null);
    setOriginal(null);
    try {
      const response = await fetchAdminSchedule(authConfig);
      const parsed = parseAdminScheduleResponse(response.data);
      if (requestVersionRef.current !== requestVersion) return;
      setDraft(parsed);
      setOriginal(parsed);
    } catch (loadError) {
      if (requestVersionRef.current !== requestVersion) return;
      const status = loadError?.response?.status;
      if (status === 401) setLegacyBlocks([]);
      setError(
        status === 401
          ? "Tu sesión venció. Volvé a iniciar sesión para administrar la disponibilidad."
          : loadError?.message || "No se pudo cargar la configuración horaria.",
      );
    } finally {
      if (requestVersionRef.current === requestVersion) setLoading(false);
    }
  }, [authConfig]);

  useEffect(() => {
    loadSchedule();
    return () => { requestVersionRef.current += 1; };
  }, [loadSchedule]);

  const loadLegacyBlocks = useCallback(async () => {
    const requestVersion = legacyRequestVersionRef.current + 1;
    legacyRequestVersionRef.current = requestVersion;
    setLegacyLoading(true);
    setLegacyError("");
    setLegacyBlocks([]);
    try {
      const response = await fetchBlockedDates(authConfig);
      const parsed = parseLegacyBlockedDatesResponse(response.data);
      if (legacyRequestVersionRef.current !== requestVersion) return;
      setLegacyBlocks(parsed);
    } catch (loadError) {
      if (legacyRequestVersionRef.current !== requestVersion) return;
      setLegacyBlocks([]);
      setLegacyError(loadError?.response?.status === 401
        ? "Tu sesión venció. Los motivos privados fueron retirados de esta vista."
        : "No se pudieron cargar los bloqueos anteriores. La disponibilidad nueva sigue disponible.");
    } finally {
      if (legacyRequestVersionRef.current === requestVersion) setLegacyLoading(false);
    }
  }, [authConfig]);

  useEffect(() => {
    loadLegacyBlocks();
    return () => { legacyRequestVersionRef.current += 1; };
  }, [loadLegacyBlocks]);

  const hasDirty = useMemo(
    () => Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original)),
    [draft, original],
  );

  useEffect(() => {
    if (!hasDirty) return undefined;
    const warnUnsaved = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, [hasDirty]);

  const updatePolicy = (updater) => setDraft((current) => ({
    ...current,
    availabilityPolicy: updater(current.availabilityPolicy),
  }));

  const updatePolicyField = (field, value) => updatePolicy((policy) => ({
    ...policy,
    [field]: value,
  }));

  const updateWeekday = (weekday, updater) => updatePolicy((policy) => ({
    ...policy,
    weeklyAvailability: {
      ...policy.weeklyAvailability,
      [weekday]: updater(policy.weeklyAvailability[weekday]),
    },
  }));

  const handleSave = async () => {
    const validation = validateScheduleDraft(draft);
    if (!validation.valid) {
      setFeedback({ type: "error", message: validation.error });
      focusById(validation.fieldId);
      return;
    }

    setSaving(true);
    setConflict(false);
    setFeedback({ type: "", message: "" });
    try {
      const schedule = serializeScheduleDraft(draft);
      const response = await updateAdminSchedule(schedule, draft.revision, authConfig);
      const parsed = parseAdminScheduleResponse(response.data);
      setDraft(parsed);
      setOriginal(parsed);
      setFeedback({ type: "success", message: "Disponibilidad guardada de forma atómica." });
    } catch (saveError) {
      const status = saveError?.response?.status;
      const classification = classifyScheduleSaveError(saveError);
      if (classification.kind === "revision") {
        setConflict(true);
        setFeedback({
          type: "error",
          message: "La configuración cambió en otra sesión. Tus datos no fueron sobrescritos; recargá antes de volver a guardar.",
        });
      } else if (status === 401) {
        setDraft(null);
        setOriginal(null);
        setLegacyBlocks([]);
        setError("Tu sesión venció. Volvé a iniciar sesión.");
      } else if (classification.kind === "retryable") {
        setFeedback({
          type: "error",
          message: `${classification.message} Tus cambios siguen listos para reintentar.`,
        });
      } else {
        setFeedback({
          type: "error",
          message: classification.message,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = (event) => {
    event.preventDefault();
    if (!newHoliday) return;
    updatePolicyField("holidays", [...new Set([
      ...draft.availabilityPolicy.holidays,
      newHoliday,
    ])].sort());
    setNewHoliday("");
    focusById("availability-holiday-new");
  };

  const addException = () => {
    const index = draft.availabilityPolicy.dateExceptions.length;
    updatePolicyField("dateExceptions", [
      ...draft.availabilityPolicy.dateExceptions,
      {
        date: "",
        closed: true,
        mode: "override",
        intervals: [],
        excludedIntervals: [],
      },
    ]);
    focusById(`exception-${index}-date`);
  };

  const addPartialBlock = () => {
    const index = draft.availabilityPolicy.blockedIntervals.length;
    const interval = createInterval(draft.slotDurationMinutes);
    updatePolicyField("blockedIntervals", [
      ...draft.availabilityPolicy.blockedIntervals,
      { date: "", ...interval, reason: "" },
    ]);
    focusById(`block-${index}-date`);
  };

  const deleteLegacyBlock = async (date) => {
    setDeletingLegacyDate(date);
    setLegacyError("");
    try {
      await removeBlockedDate(date, authConfig);
      setLegacyBlocks((current) => current.filter((record) => record.date !== date));
    } catch (deleteError) {
      if (deleteError?.response?.status === 401) {
        setLegacyBlocks([]);
        setLegacyError("Tu sesión venció. Los motivos privados fueron retirados de esta vista.");
      } else {
        setLegacyError("No se pudo eliminar el bloqueo anterior. Reintentá.");
      }
    } finally {
      setDeletingLegacyDate("");
    }
  };

  if (loading) {
    return (
      <div className="settings-layout" aria-busy="true">
        <p className="empty-copy settings-loading" role="status" aria-live="polite">
          Cargando disponibilidad…
        </p>
      </div>
    );
  }
  if (error || !draft) {
    return (
      <div className="settings-layout" role="alert">
        <p className="empty-copy settings-error">{error || "La configuración no está disponible."}</p>
        <button type="button" className="admin-primary-btn slim" onClick={loadSchedule}>
          <FaSyncAlt aria-hidden="true" /> Reintentar
        </button>
      </div>
    );
  }

  const policy = draft.availabilityPolicy;

  return (
    <div className="settings-layout availability-editor" aria-busy={saving}>
      <header className="availability-editor-header">
        <div>
          <span className="card-kicker">Agenda autoritativa</span>
          <h2 id="availability-editor-title" tabIndex={-1}>Disponibilidad completa</h2>
          <p>
            Una sola configuración gobierna reservas, reprogramaciones y calendario.
            Los motivos privados sólo se muestran en este panel autenticado.
          </p>
        </div>
        <div className="availability-save-actions">
          <span className="settings-hint">Revisión {draft.revision}</span>
          <button
            type="button"
            className="admin-primary-btn"
            onClick={handleSave}
            disabled={!hasDirty || saving || conflict}
          >
            <FaSave aria-hidden="true" /> {saving ? "Guardando…" : "Guardar disponibilidad"}
          </button>
        </div>
      </header>

      <div
        className={`availability-live ${feedback.type || "idle"}`}
        role={feedback.type === "error" ? "alert" : "status"}
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback.message || (hasDirty ? "Hay cambios sin guardar." : "Configuración sincronizada.")}
        {conflict && (
          <button type="button" className="admin-primary-btn slim" onClick={loadSchedule}>
            <FaSyncAlt aria-hidden="true" /> Recargar configuración
          </button>
        )}
      </div>

      <article className="admin-card settings-card">
        <div className="admin-card-header">
          <div>
            <span className="card-kicker">Reglas globales</span>
            <h3><FaClock aria-hidden="true" /> Grilla y anticipación</h3>
          </div>
        </div>
        <div className="availability-global-grid">
          <label htmlFor="availability-slot-duration">
            Grilla (minutos)
            <input
              id="availability-slot-duration"
              type="number"
              min="5"
              max="120"
              step="1"
              value={draft.slotDurationMinutes}
              onChange={(event) => setDraft((current) => ({
                ...current,
                slotDurationMinutes: event.target.value === "" ? "" : Number(event.target.value),
              }))}
              className="settings-input"
            />
          </label>
          <label htmlFor="availability-buffer-before">
            Buffer previo (minutos)
            <input
              id="availability-buffer-before"
              type="number"
              min="0"
              max="240"
              step={draft.slotDurationMinutes || 1}
              value={policy.bufferBeforeMinutes}
              onChange={(event) => updatePolicyField(
                "bufferBeforeMinutes",
                event.target.value === "" ? "" : Number(event.target.value),
              )}
              className="settings-input"
            />
          </label>
          <label htmlFor="availability-buffer-after">
            Buffer posterior (minutos)
            <input
              id="availability-buffer-after"
              type="number"
              min="0"
              max="240"
              step={draft.slotDurationMinutes || 1}
              value={policy.bufferAfterMinutes}
              onChange={(event) => updatePolicyField(
                "bufferAfterMinutes",
                event.target.value === "" ? "" : Number(event.target.value),
              )}
              className="settings-input"
            />
          </label>
          <label htmlFor="availability-minimum-notice">
            Anticipación mínima (minutos)
            <input
              id="availability-minimum-notice"
              type="number"
              min="0"
              max="43200"
              step="1"
              value={policy.minimumNoticeMinutes}
              onChange={(event) => updatePolicyField(
                "minimumNoticeMinutes",
                event.target.value === "" ? "" : Number(event.target.value),
              )}
              className="settings-input"
            />
          </label>
          <label htmlFor="availability-maximum-horizon">
            Horizonte máximo (días)
            <input
              id="availability-maximum-horizon"
              type="number"
              min="1"
              max="730"
              step="1"
              value={policy.maximumAdvanceDays}
              onChange={(event) => updatePolicyField(
                "maximumAdvanceDays",
                event.target.value === "" ? "" : Number(event.target.value),
              )}
              className="settings-input"
            />
          </label>
          <div id="availability-time-zone" className="availability-readonly-field">
            <span>Zona horaria</span>
            <strong>{draft.timeZone}</strong>
          </div>
        </div>
      </article>

      <article className="admin-card settings-card">
        <div className="admin-card-header">
          <div>
            <span className="card-kicker">Semana habitual</span>
            <h3><FaCalendarAlt aria-hidden="true" /> Horarios y descansos</h3>
          </div>
        </div>
        <div className="availability-week-grid">
          {DAYS.map((dayLabel, weekday) => {
            const day = policy.weeklyAvailability[String(weekday)];
            return (
              <fieldset className="availability-day-card" key={dayLabel}>
                <legend>{dayLabel}</legend>
                <label className="availability-enabled-toggle" htmlFor={`weekly-${weekday}-enabled`}>
                  <input
                    id={`weekly-${weekday}-enabled`}
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(event) => updateWeekday(String(weekday), (current) => ({
                      enabled: event.target.checked,
                      intervals: event.target.checked
                        ? (current.intervals.length > 0
                          ? current.intervals
                          : [createInterval(draft.slotDurationMinutes)])
                        : [],
                      excludedIntervals: event.target.checked ? current.excludedIntervals : [],
                    }))}
                  />
                  {day.enabled ? "Día activo" : "Día cerrado"}
                </label>
                {day.enabled && (
                  <>
                    <IntervalEditor
                      idPrefix={`weekly-${weekday}-interval`}
                      label="Horarios de clase"
                      intervals={day.intervals}
                      slotDurationMinutes={draft.slotDurationMinutes}
                      onChange={(intervals) => updateWeekday(String(weekday), (current) => ({
                        ...current,
                        intervals,
                      }))}
                    />
                    <IntervalEditor
                      idPrefix={`weekly-${weekday}-break`}
                      label="Descansos excluidos"
                      intervals={day.excludedIntervals}
                      slotDurationMinutes={draft.slotDurationMinutes}
                      onChange={(excludedIntervals) => updateWeekday(String(weekday), (current) => ({
                        ...current,
                        excludedIntervals,
                      }))}
                    />
                  </>
                )}
              </fieldset>
            );
          })}
        </div>
      </article>

      <article className="admin-card settings-card">
        <div className="admin-card-header">
          <div>
            <span className="card-kicker">Días completos</span>
            <h3><FaBan aria-hidden="true" /> Feriados y cierres</h3>
          </div>
        </div>
        <form className="availability-inline-form" onSubmit={addHoliday}>
          <label htmlFor="availability-holiday-new">
            Nueva fecha cerrada
            <input
              id="availability-holiday-new"
              type="date"
              value={newHoliday}
              onChange={(event) => setNewHoliday(event.target.value)}
              className="settings-input"
              required
            />
          </label>
          <button type="submit" className="admin-primary-btn slim" disabled={!newHoliday}>
            <FaPlus aria-hidden="true" /> Agregar cierre
          </button>
        </form>
        <ul className="availability-chip-list" aria-label="Fechas cerradas">
          {policy.holidays.map((date) => (
            <li key={date}>
              <span>{date}</span>
              <button
                type="button"
                className="inline-action danger"
                onClick={() => updatePolicyField(
                  "holidays",
                  policy.holidays.filter((holiday) => holiday !== date),
                )}
                aria-label={`Quitar cierre del ${date}`}
              >
                <FaTrashAlt aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </article>

      <article className="admin-card settings-card">
        <div className="admin-card-header">
          <div>
            <span className="card-kicker">Fechas especiales</span>
            <h3><FaCalendarAlt aria-hidden="true" /> Excepciones</h3>
          </div>
          <button type="button" className="admin-primary-btn slim" onClick={addException}>
            <FaPlus aria-hidden="true" /> Agregar excepción
          </button>
        </div>
        <div className="availability-exception-list">
          {policy.dateExceptions.length === 0 && (
            <p className="empty-copy">No hay excepciones por fecha.</p>
          )}
          {policy.dateExceptions.map((exception, index) => (
            <fieldset className="availability-exception-card" key={`exception-${index}`}>
              <legend>Excepción {index + 1}</legend>
              <div className="availability-global-grid">
                <label htmlFor={`exception-${index}-date`}>
                  Fecha
                  <input
                    id={`exception-${index}-date`}
                    type="date"
                    value={exception.date}
                    onChange={(event) => updatePolicyField(
                      "dateExceptions",
                      policy.dateExceptions.map((current, currentIndex) => currentIndex === index
                        ? { ...current, date: event.target.value }
                        : current),
                    )}
                    className="settings-input"
                  />
                </label>
                <label htmlFor={`exception-${index}-mode`}>
                  Aplicación
                  <select
                    id={`exception-${index}-mode`}
                    value={exception.mode}
                    onChange={(event) => updatePolicyField(
                      "dateExceptions",
                      policy.dateExceptions.map((current, currentIndex) => currentIndex === index
                        ? { ...current, mode: event.target.value }
                        : current),
                    )}
                    className="settings-input"
                  >
                    <option value="override">Reemplazar horario semanal</option>
                    <option value="add">Sumar al horario semanal</option>
                  </select>
                </label>
                <label className="availability-enabled-toggle" htmlFor={`exception-${index}-closed`}>
                  <input
                    id={`exception-${index}-closed`}
                    type="checkbox"
                    checked={exception.closed}
                    onChange={(event) => updatePolicyField(
                      "dateExceptions",
                      policy.dateExceptions.map((current, currentIndex) => currentIndex === index
                        ? {
                          ...current,
                          closed: event.target.checked,
                          intervals: event.target.checked
                            ? []
                            : (current.intervals.length
                              ? current.intervals
                              : [createInterval(draft.slotDurationMinutes)]),
                          excludedIntervals: event.target.checked ? [] : current.excludedIntervals,
                        }
                        : current),
                    )}
                  />
                  Fecha completamente cerrada
                </label>
              </div>
              {!exception.closed && (
                <>
                  <IntervalEditor
                    idPrefix={`exception-${index}-interval`}
                    label="Horarios especiales"
                    intervals={exception.intervals}
                    slotDurationMinutes={draft.slotDurationMinutes}
                    onChange={(intervals) => updatePolicyField(
                      "dateExceptions",
                      policy.dateExceptions.map((current, currentIndex) => currentIndex === index
                        ? { ...current, intervals }
                        : current),
                    )}
                  />
                  <IntervalEditor
                    idPrefix={`exception-${index}-break`}
                    label="Descansos especiales"
                    intervals={exception.excludedIntervals}
                    slotDurationMinutes={draft.slotDurationMinutes}
                    onChange={(excludedIntervals) => updatePolicyField(
                      "dateExceptions",
                      policy.dateExceptions.map((current, currentIndex) => currentIndex === index
                        ? { ...current, excludedIntervals }
                        : current),
                    )}
                  />
                </>
              )}
              <button
                type="button"
                className="inline-action danger"
                onClick={() => updatePolicyField(
                  "dateExceptions",
                  policy.dateExceptions.filter((_, currentIndex) => currentIndex !== index),
                )}
              >
                <FaTrashAlt aria-hidden="true" /> Eliminar excepción
              </button>
            </fieldset>
          ))}
        </div>
      </article>

      <article className="admin-card settings-card">
        <div className="admin-card-header">
          <div>
            <span className="card-kicker">Bloqueos puntuales</span>
            <h3><FaCoffee aria-hidden="true" /> Bloqueos parciales</h3>
          </div>
          <button type="button" className="admin-primary-btn slim" onClick={addPartialBlock}>
            <FaPlus aria-hidden="true" /> Agregar bloqueo
          </button>
        </div>
        <div className="availability-block-list">
          {policy.blockedIntervals.length === 0 && (
            <p className="empty-copy">No hay bloqueos parciales.</p>
          )}
          {policy.blockedIntervals.map((block, index) => (
            <fieldset className="availability-exception-card" key={`block-${index}`}>
              <legend>Bloqueo {index + 1}</legend>
              <div className="availability-global-grid">
                <label htmlFor={`block-${index}-date`}>
                  Fecha
                  <input
                    id={`block-${index}-date`}
                    type="date"
                    value={block.date}
                    onChange={(event) => updatePolicyField(
                      "blockedIntervals",
                      policy.blockedIntervals.map((current, currentIndex) => currentIndex === index
                        ? { ...current, date: event.target.value }
                        : current),
                    )}
                    className="settings-input"
                  />
                </label>
                <label htmlFor={`block-${index}-start`}>
                  Desde
                  <input
                    id={`block-${index}-start`}
                    type="time"
                    step={draft.slotDurationMinutes * 60}
                    value={block.start}
                    onChange={(event) => updatePolicyField(
                      "blockedIntervals",
                      policy.blockedIntervals.map((current, currentIndex) => currentIndex === index
                        ? { ...current, start: event.target.value }
                        : current),
                    )}
                    className="settings-input"
                  />
                </label>
                <label htmlFor={`block-${index}-end`}>
                  Hasta
                  <input
                    id={`block-${index}-end`}
                    type="time"
                    step={draft.slotDurationMinutes * 60}
                    value={block.end}
                    onChange={(event) => updatePolicyField(
                      "blockedIntervals",
                      policy.blockedIntervals.map((current, currentIndex) => currentIndex === index
                        ? { ...current, end: event.target.value }
                        : current),
                    )}
                    className="settings-input"
                  />
                </label>
                <label htmlFor={`block-${index}-reason`}>
                  Motivo privado (no se publica)
                  <input
                    id={`block-${index}-reason`}
                    type="text"
                    maxLength="500"
                    value={block.reason}
                    onChange={(event) => updatePolicyField(
                      "blockedIntervals",
                      policy.blockedIntervals.map((current, currentIndex) => currentIndex === index
                        ? { ...current, reason: event.target.value }
                        : current),
                    )}
                    className="settings-input"
                  />
                </label>
              </div>
              <button
                type="button"
                className="inline-action danger"
                onClick={() => updatePolicyField(
                  "blockedIntervals",
                  policy.blockedIntervals.filter((_, currentIndex) => currentIndex !== index),
                )}
              >
                <FaTrashAlt aria-hidden="true" /> Eliminar bloqueo
              </button>
            </fieldset>
          ))}
        </div>
      </article>

      <article className="admin-card settings-card" aria-busy={legacyLoading || Boolean(deletingLegacyDate)}>
        <div className="admin-card-header">
          <div>
            <span className="card-kicker">Compatibilidad operativa</span>
            <h3><FaBan aria-hidden="true" /> Bloqueos anteriores</h3>
            <p className="settings-hint">
              Acá podés revisar y eliminar bloqueos de día completo creados con el sistema anterior.
              Las nuevas excepciones se crean arriba, dentro de la agenda autoritativa.
            </p>
          </div>
          <button type="button" className="inline-action" onClick={loadLegacyBlocks} disabled={legacyLoading}>
            <FaSyncAlt aria-hidden="true" /> Actualizar anteriores
          </button>
        </div>
        {legacyError && <p role="alert" className="settings-error-msg">{legacyError}</p>}
        {legacyLoading ? (
          <p role="status" aria-live="polite" className="empty-copy">Cargando bloqueos anteriores…</p>
        ) : legacyBlocks.length === 0 ? (
          <p className="empty-copy">No hay bloqueos anteriores activos.</p>
        ) : (
          <ul className="admin-priority-stack" aria-label="Bloqueos anteriores de día completo">
            {legacyBlocks.map((record) => (
              <li key={record.date} className="priority-card info blocked-date-row">
                <div>
                  <strong>{record.date}</strong>
                  {record.reason && <p className="blocked-date-reason">{record.reason}</p>}
                </div>
                <button
                  type="button"
                  className="inline-action danger"
                  disabled={Boolean(deletingLegacyDate)}
                  onClick={() => deleteLegacyBlock(record.date)}
                  aria-label={`Eliminar bloqueo anterior del ${record.date}`}
                >
                  <FaTrashAlt aria-hidden="true" />
                  {deletingLegacyDate === record.date ? "Eliminando…" : "Eliminar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
};

export default AvailabilitySettingsView;
