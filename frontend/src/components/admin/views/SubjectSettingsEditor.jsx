import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaBookOpen,
  FaPlus,
  FaSave,
  FaSyncAlt,
  FaTrashAlt,
} from "react-icons/fa";
import {
  fetchAdminSubjects,
  updateAdminSubjects,
} from "../../../api/bookingApi";
import {
  MAX_SUBJECTS_PER_LEVEL,
  MAX_TOTAL_SUBJECTS,
  SubjectsValidationError,
  classifySubjectsSaveError,
  createSubjectEntry,
  moveSubjectEntry,
  parseAdminSubjectsResponse,
  removeSubjectEntry,
  serializeSubjectsDraft,
  subjectAddButtonId,
  subjectDraftSnapshot,
  subjectEntryInputId,
  updateSubjectEntry,
} from "../../../utils/subjectSettings";

const focusById = (id) => {
  if (!id || typeof document === "undefined") return;
  window.requestAnimationFrame(() => document.getElementById(id)?.focus());
};

const createEntryId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `subject-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const SubjectSettingsEditor = ({ authConfig }) => {
  const [draft, setDraft] = useState(null);
  const [originalSnapshot, setOriginalSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [announcement, setAnnouncement] = useState("");
  const [conflict, setConflict] = useState(false);
  const [validationFieldId, setValidationFieldId] = useState("");
  const requestVersionRef = useRef(0);
  const abortRef = useRef(null);

  const loadSubjects = useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    setFeedback({ type: "", message: "" });
    setConflict(false);
    setValidationFieldId("");
    setDraft(null);
    setOriginalSnapshot(null);
    try {
      const response = await fetchAdminSubjects(authConfig, controller.signal);
      const parsed = parseAdminSubjectsResponse(response.data);
      if (requestVersionRef.current !== requestVersion) return;
      setDraft(parsed);
      setOriginalSnapshot(subjectDraftSnapshot(parsed));
    } catch (loadError) {
      if (controller.signal.aborted || requestVersionRef.current !== requestVersion) return;
      setDraft(null);
      setOriginalSnapshot(null);
      setError(
        loadError?.response?.status === 401
          ? "Tu sesión venció. Volvé a iniciar sesión para administrar las materias."
          : loadError instanceof SubjectsValidationError
            ? "La configuración recibida es inválida. No se habilitó la edición."
            : "No se pudo cargar la configuración de materias.",
      );
    } finally {
      if (requestVersionRef.current === requestVersion) setLoading(false);
    }
  }, [authConfig]);

  useEffect(() => {
    loadSubjects();
    return () => {
      requestVersionRef.current += 1;
      abortRef.current?.abort();
    };
  }, [loadSubjects]);

  const currentSnapshot = useMemo(
    () => draft ? subjectDraftSnapshot(draft) : null,
    [draft],
  );
  const hasDirty = Boolean(
    currentSnapshot &&
    originalSnapshot &&
    JSON.stringify(currentSnapshot) !== JSON.stringify(originalSnapshot),
  );
  const totalSubjects = draft?.levels.reduce(
    (total, entry) => total + entry.subjects.length,
    0,
  ) ?? 0;

  useEffect(() => {
    if (!hasDirty) return undefined;
    const warnUnsaved = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, [hasDirty]);

  const markEdited = () => {
    setValidationFieldId("");
    if (!conflict) setFeedback({ type: "", message: "" });
  };

  const changeMode = (mode) => {
    setDraft((current) => ({ ...current, mode }));
    markEdited();
    setAnnouncement(
      mode === "default"
        ? "Se usará la lista predeterminada al guardar."
        : "Modo personalizado activado.",
    );
  };

  const addSubject = (level) => {
    const id = createEntryId();
    setDraft((current) => createSubjectEntry(current, level, () => id));
    markEdited();
    setAnnouncement(`Materia nueva agregada en ${level}.`);
    focusById(subjectEntryInputId(level, id));
  };

  const changeSubject = (level, id, label) => {
    setDraft((current) => updateSubjectEntry(current, level, id, label));
    markEdited();
  };

  const deleteSubject = (level, id) => {
    const levelEntry = draft.levels.find((entry) => entry.level === level);
    const index = levelEntry.subjects.findIndex((subject) => subject.id === id);
    const nextFocus = levelEntry.subjects[index + 1] || levelEntry.subjects[index - 1];
    setDraft((current) => removeSubjectEntry(current, level, id));
    markEdited();
    setAnnouncement(`Materia eliminada de ${level}.`);
    focusById(
      nextFocus
        ? subjectEntryInputId(level, nextFocus.id)
        : subjectAddButtonId(level),
    );
  };

  const moveSubject = (level, id, direction) => {
    setDraft((current) => moveSubjectEntry(current, level, id, direction));
    markEdited();
    setAnnouncement(
      `Materia movida ${direction < 0 ? "hacia arriba" : "hacia abajo"} en ${level}.`,
    );
    focusById(subjectEntryInputId(level, id));
  };

  const handleSave = async () => {
    let payload;
    try {
      payload = serializeSubjectsDraft(draft);
    } catch (validationError) {
      if (!(validationError instanceof SubjectsValidationError)) throw validationError;
      setValidationFieldId(validationError.fieldId);
      setFeedback({ type: "error", message: validationError.message });
      focusById(validationError.fieldId);
      return;
    }

    setSaving(true);
    setFeedback({ type: "", message: "" });
    setValidationFieldId("");
    try {
      const response = await updateAdminSubjects(payload, draft.revision, authConfig);
      const parsed = parseAdminSubjectsResponse(response.data);
      setDraft(parsed);
      setOriginalSnapshot(subjectDraftSnapshot(parsed));
      setConflict(false);
      setFeedback({ type: "success", message: "Lista de materias guardada de forma atómica." });
    } catch (saveError) {
      const status = saveError?.response?.status;
      const classification = classifySubjectsSaveError(saveError);
      if (classification.kind === "revision") {
        setConflict(true);
        setFeedback({
          type: "error",
          message: "La lista cambió en otra sesión. Tu borrador sigue intacto; recargá antes de volver a guardar.",
        });
      } else if (status === 401) {
        setDraft(null);
        setOriginalSnapshot(null);
        setError("Tu sesión venció. Volvé a iniciar sesión.");
      } else if (saveError instanceof SubjectsValidationError) {
        setDraft(null);
        setOriginalSnapshot(null);
        setError("El servidor devolvió una configuración inválida. Recargá antes de editar nuevamente.");
      } else {
        setFeedback({ type: "error", message: classification.message });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <article className="admin-card settings-card subjects-editor" aria-busy="true">
        <p className="empty-copy settings-loading" role="status" aria-live="polite">
          Cargando materias…
        </p>
      </article>
    );
  }

  if (error || !draft) {
    return (
      <article className="admin-card settings-card subjects-editor">
        <div role="alert">
          <p className="empty-copy settings-error">
            {error || "La configuración de materias no está disponible."}
          </p>
        </div>
        <button type="button" className="admin-primary-btn slim" onClick={loadSubjects}>
          <FaSyncAlt aria-hidden="true" /> Reintentar
        </button>
      </article>
    );
  }

  return (
    <article className="admin-card settings-card subjects-editor" aria-busy={saving}>
      <header className="subjects-editor-header">
        <div>
          <span className="card-kicker">Materias</span>
          <h3 id="subjects-editor-title" tabIndex={-1}>
            <FaBookOpen aria-hidden="true" className="settings-card-icon" />
            Lista de materias por nivel
          </h3>
          <p className="settings-hint">
            El orden se usa en las sugerencias de reserva. El alumno siempre puede escribir una materia o tema libre.
          </p>
        </div>
        <div className="subjects-save-actions">
          <span className="settings-hint">Revisión {draft.revision}</span>
          <span className="settings-hint">{totalSubjects} de {MAX_TOTAL_SUBJECTS} materias</span>
          <button
            type="button"
            className="admin-primary-btn slim"
            onClick={handleSave}
            disabled={!hasDirty || saving || conflict}
          >
            <FaSave aria-hidden="true" /> {saving ? "Guardando…" : "Guardar materias"}
          </button>
        </div>
      </header>

      <fieldset className="subjects-mode-fieldset">
        <legend>Origen de las sugerencias</legend>
        <label htmlFor="subjects-mode-default">
          <input
            id="subjects-mode-default"
            type="radio"
            name="subjects-mode"
            value="default"
            checked={draft.mode === "default"}
            onChange={() => changeMode("default")}
          />
          Usar lista predeterminada
        </label>
        <label htmlFor="subjects-mode-custom">
          <input
            id="subjects-mode-custom"
            type="radio"
            name="subjects-mode"
            value="custom"
            checked={draft.mode === "custom"}
            onChange={() => changeMode("custom")}
          />
          Usar lista personalizada
        </label>
      </fieldset>

      <div
        className={`subjects-live ${feedback.type || "idle"}`}
        role={feedback.type === "error" ? "alert" : "status"}
        aria-live="polite"
        aria-atomic="true"
      >
        <span>
          {feedback.message || (
            hasDirty
              ? "Hay cambios sin guardar."
              : draft.mode === "default"
                ? "Se está usando la lista predeterminada."
                : "Lista personalizada sincronizada."
          )}
        </span>
        {conflict && (
          <button type="button" className="admin-primary-btn slim" onClick={loadSubjects}>
            <FaSyncAlt aria-hidden="true" /> Recargar y descartar mis cambios
          </button>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {draft.mode === "default" ? (
        <p className="subjects-default-copy">
          La reserva usa el catálogo incluido en la aplicación. Elegí “lista personalizada” para administrarlo.
        </p>
      ) : (
        <div className="subjects-level-grid">
          {draft.levels.map(({ level, subjects }) => {
            const atLevelCap = subjects.length >= MAX_SUBJECTS_PER_LEVEL;
            const atTotalCap = totalSubjects >= MAX_TOTAL_SUBJECTS;
            return (
              <fieldset className="subjects-level-card" key={level}>
                <legend>{level} <span>({subjects.length})</span></legend>
                {subjects.length === 0 && (
                  <p className="settings-hint">Sin materias configuradas en este nivel.</p>
                )}
                <ol className="subjects-ordered-list">
                  {subjects.map((subject, index) => {
                    const inputId = subjectEntryInputId(level, subject.id);
                    const errorId = `${inputId}-error`;
                    const isInvalid = validationFieldId === inputId;
                    return (
                      <li className="subjects-row" key={subject.id}>
                        <label htmlFor={inputId}>Materia {index + 1}</label>
                        <input
                          id={inputId}
                          type="text"
                          className="settings-input"
                          value={subject.label}
                          maxLength="80"
                          onChange={(event) => changeSubject(level, subject.id, event.target.value)}
                          aria-invalid={isInvalid ? "true" : "false"}
                          aria-describedby={isInvalid ? errorId : undefined}
                        />
                        {isInvalid && (
                          <p id={errorId} className="subjects-row-error">
                            {feedback.message}
                          </p>
                        )}
                        <div className="subjects-row-actions">
                          <button
                            type="button"
                            className="inline-action"
                            onClick={() => moveSubject(level, subject.id, -1)}
                            disabled={index === 0}
                            aria-label={`Subir ${subject.label || `materia ${index + 1}`} en ${level}`}
                          >
                            <FaArrowUp aria-hidden="true" /> Subir
                          </button>
                          <button
                            type="button"
                            className="inline-action"
                            onClick={() => moveSubject(level, subject.id, 1)}
                            disabled={index === subjects.length - 1}
                            aria-label={`Bajar ${subject.label || `materia ${index + 1}`} en ${level}`}
                          >
                            <FaArrowDown aria-hidden="true" /> Bajar
                          </button>
                          <button
                            type="button"
                            className="inline-action danger"
                            onClick={() => deleteSubject(level, subject.id)}
                            aria-label={`Eliminar ${subject.label || `materia ${index + 1}`} de ${level}`}
                          >
                            <FaTrashAlt aria-hidden="true" /> Eliminar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <button
                  id={subjectAddButtonId(level)}
                  type="button"
                  className="admin-primary-btn slim subjects-add-btn"
                  onClick={() => addSubject(level)}
                  disabled={atLevelCap || atTotalCap}
                  aria-describedby={atLevelCap || atTotalCap ? "subjects-limit-hint" : undefined}
                >
                  <FaPlus aria-hidden="true" /> Agregar materia
                </button>
              </fieldset>
            );
          })}
          <p id="subjects-limit-hint" className="settings-hint">
            Máximo: {MAX_SUBJECTS_PER_LEVEL} por nivel y {MAX_TOTAL_SUBJECTS} en total.
          </p>
        </div>
      )}
    </article>
  );
};

export default SubjectSettingsEditor;
