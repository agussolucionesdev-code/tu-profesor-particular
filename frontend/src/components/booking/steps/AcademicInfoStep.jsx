import { useRef, useEffect, useCallback, useState } from "react";
import {
  FaGraduationCap,
  FaLayerGroup,
  FaSortNumericDown,
  FaBookOpen,
  FaSchool,
  FaCheckCircle,
  FaLightbulb,
  FaArrowRight,
  FaArrowLeft,
} from "react-icons/fa";
import { getSubjectSuggestions } from "../../../constants/bookingWizard";

const ACADEMIC_FIELDS = [
  { key: "educationLevel" },
  { key: "yearGrade" },
  { key: "subject" },
  { key: "school" },
  { key: "academicSituation" },
];

const useAcademicFlow = ({ fields, isVisible }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const fieldRefs = useRef({});

  const scrollToField = useCallback((index) => {
    const key = fields[index]?.key;
    if (!key) return;
    const el = fieldRefs.current[key];
    if (!el) return;

    const navH =
      document.querySelector(".navbar-elite")?.getBoundingClientRect().height ??
      72;
    const top = el.getBoundingClientRect().top + window.scrollY - navH - 24;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: reduced ? "auto" : "smooth",
    });
    setTimeout(
      () => el.querySelector("input, select, textarea")?.focus?.({ preventScroll: true }),
      80,
    );
  }, [fields]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => {
      const next = Math.min(prev + 1, fields.length - 1);
      setTimeout(() => scrollToField(next), 80);
      return next;
    });
  }, [fields.length, scrollToField]);

  const jumpTo = useCallback((index) => {
    setActiveIndex(index);
    setTimeout(() => scrollToField(index), 80);
  }, [scrollToField]);

  useEffect(() => {
    if (!isVisible) return;
    setActiveIndex(0);
    setTimeout(() => scrollToField(0), 120);
  }, [isVisible, scrollToField]);

  return { activeIndex, fieldRefs, goNext, jumpTo };
};

const FieldBlock = ({
  fieldKey,
  label,
  required,
  optional,
  errorText,
  helperText,
  isActive,
  isCompleted,
  fieldRef,
  onConfirm,
  onBack,
  showBack,
  confirmLabel = "Confirmar",
  children,
}) => (
  <div
    ref={fieldRef}
    className={`field-flow-block${isActive ? " is-active" : ""}${isCompleted && !isActive ? " is-done" : ""}`}
    aria-current={isActive ? "step" : undefined}
  >
    <div className="field-flow-label-row">
      <label htmlFor={fieldKey} className="field-flow-label">
        {label}
        {required && <span className="required" aria-hidden="true"> *</span>}
        {optional && <span className="optional"> ({optional})</span>}
      </label>
      {isCompleted && !isActive && (
        <span className="field-flow-done-badge" aria-label="Campo completado">
          <FaCheckCircle />
        </span>
      )}
      {errorText && <span className="error-text" role="alert">{errorText}</span>}
    </div>

    <div className={`field-flow-input-shell${isActive ? " focused" : ""}`}>
      {children}
    </div>

    {helperText && isActive && (
      <p className="field-helper field-flow-helper">{helperText}</p>
    )}

    {isActive && (
      <div className="field-flow-actions">
        {showBack && (
          <button
            type="button"
            className="field-flow-btn field-flow-back"
            onClick={onBack}
            aria-label="Volver al campo anterior"
          >
            <FaArrowLeft /> Anterior
          </button>
        )}
        <button
          type="button"
          className="field-flow-btn field-flow-next"
          onClick={onConfirm}
        >
          {confirmLabel} <FaArrowRight />
        </button>
      </div>
    )}
  </div>
);

const AcademicInfoStep = ({
  formData,
  isAdult,
  hasAttemptedNext,
  setHasAttemptedNext,
  isValidField,
  getFieldStateClass,
  handleChange,
  isPersonalInfoComplete,
  canProceedToStep2,
  textareaRef,
  getYearGradeOptions,
  goToNext,
}) => {
  const { activeIndex, fieldRefs, goNext, jumpTo } = useAcademicFlow({
    fields: ACADEMIC_FIELDS,
    isVisible: isPersonalInfoComplete,
  });

  const isFieldConfirmed = useCallback(
    (fieldKey) => {
      if (fieldKey === "academicSituation") return true;
      return isValidField(fieldKey);
    },
    [isValidField],
  );

  const confirmField = useCallback(
    (fieldKey) => {
      if (!isFieldConfirmed(fieldKey)) {
        setHasAttemptedNext(true);
        return;
      }
      setHasAttemptedNext(false);
      goNext();
    },
    [goNext, isFieldConfirmed, setHasAttemptedNext],
  );

  const handleKey = useCallback(
    (e, fieldKey) => {
      if (e.key !== "Enter" || fieldKey === "academicSituation") return;
      e.preventDefault();
      confirmField(fieldKey);
    },
    [confirmField],
  );

  const prevLevel = useRef(formData.educationLevel);
  useEffect(() => {
    if (prevLevel.current !== formData.educationLevel) {
      prevLevel.current = formData.educationLevel;
    }
  }, [formData.educationLevel]);

  if (!isPersonalInfoComplete) return null;

  return (
    <div className="progressive-disclosure-grid is-active" style={{ marginTop: "0.5rem" }}>
      <div className="progressive-inner">
        <hr className="section-divider-soft" />
        <h2 className="section-title" tabIndex={-1}>
          <FaGraduationCap aria-hidden="true" />
          Perfil académico
        </h2>
        <p className="step-empathy-note">
          Confirmá cada dato y recién ahí avanzamos al siguiente.
        </p>

        <div className="field-flow-list" role="list">
          <div role="listitem">
            <FieldBlock
              fieldKey="educationLevel"
              label="Nivel educativo"
              required
              errorText={hasAttemptedNext && !isValidField("educationLevel") ? "Elegí el nivel" : null}
              helperText="Seleccioná el nivel en el que estudia actualmente."
              isActive={activeIndex === 0}
              isCompleted={isValidField("educationLevel")}
              fieldRef={(el) => {
                fieldRefs.current.educationLevel = el;
              }}
              onConfirm={() => confirmField("educationLevel")}
              showBack={false}
            >
              <div className={`neuro-input-wrapper premium-input ${getFieldStateClass("educationLevel")}`}>
                <FaLayerGroup className="input-icon" aria-hidden="true" />
                <select
                  id="educationLevel"
                  name="educationLevel"
                  value={formData.educationLevel}
                  onChange={handleChange}
                  aria-invalid={hasAttemptedNext && !isValidField("educationLevel") ? "true" : "false"}
                >
                  <option value="">Elegí el nivel educativo</option>
                  <option value="Primaria">Primaria</option>
                  <option value="Secundaria">Secundaria</option>
                  <option value="Secundaria Tecnica">Secundaria técnica</option>
                  <option value="Terciario">Terciario / Superior</option>
                  <option value="Universitario">Universitario</option>
                </select>
                {isValidField("educationLevel") && (
                  <FaCheckCircle className="valid-icon select-valid" aria-hidden="true" />
                )}
              </div>
            </FieldBlock>
          </div>

          {activeIndex >= 1 && (
            <div role="listitem">
              <FieldBlock
                fieldKey="yearGrade"
                label="Curso, año o grado"
                required
                errorText={hasAttemptedNext && !isValidField("yearGrade") ? "Elegí el curso o año" : null}
                helperText="Te mostramos las opciones correctas según el nivel que acabás de elegir."
                isActive={activeIndex === 1}
                isCompleted={isValidField("yearGrade")}
                fieldRef={(el) => {
                  fieldRefs.current.yearGrade = el;
                }}
                onConfirm={() => confirmField("yearGrade")}
                onBack={() => jumpTo(0)}
                showBack
              >
                <div className={`neuro-input-wrapper premium-input ${getFieldStateClass("yearGrade")}`}>
                  <FaSortNumericDown className="input-icon" aria-hidden="true" />
                  <select
                    id="yearGrade"
                    name="yearGrade"
                    value={formData.yearGrade}
                    onChange={handleChange}
                    disabled={!formData.educationLevel}
                    aria-invalid={hasAttemptedNext && !isValidField("yearGrade") ? "true" : "false"}
                  >
                    {!formData.educationLevel && <option value="">Elegí el nivel primero</option>}
                    {formData.educationLevel && <option value="">Elegí curso, año o grado</option>}
                    {getYearGradeOptions().map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {isValidField("yearGrade") && (
                    <FaCheckCircle className="valid-icon select-valid" aria-hidden="true" />
                  )}
                </div>
              </FieldBlock>
            </div>
          )}

          {activeIndex >= 2 && (
            <div role="listitem">
              <FieldBlock
                fieldKey="subject"
                label="Materia o tema"
                required
                errorText={hasAttemptedNext && !isValidField("subject") ? "Escribí la materia o tema" : null}
                helperText="Puede ser una materia, un examen o un tema puntual a trabajar."
                isActive={activeIndex === 2}
                isCompleted={isValidField("subject")}
                fieldRef={(el) => {
                  fieldRefs.current.subject = el;
                }}
                onConfirm={() => confirmField("subject")}
                onBack={() => jumpTo(1)}
                showBack
              >
                <div className={`neuro-input-wrapper premium-input ${getFieldStateClass("subject")}`}>
                  <FaBookOpen className="input-icon" aria-hidden="true" />
                  <input
                    id="subject"
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    list="subject-suggestions"
                    aria-invalid={hasAttemptedNext && !isValidField("subject") ? "true" : "false"}
                    placeholder="Materia, tema o examen a preparar"
                    autoComplete="off"
                    onKeyDown={(e) => handleKey(e, "subject")}
                  />
                  {isValidField("subject") && (
                    <FaCheckCircle className="valid-icon" aria-hidden="true" />
                  )}
                </div>
                <datalist id="subject-suggestions">
                  {getSubjectSuggestions(formData.educationLevel).map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </FieldBlock>
            </div>
          )}

          {activeIndex >= 3 && (
            <div role="listitem">
              <FieldBlock
                fieldKey="school"
                label="Institución o colegio"
                required
                errorText={hasAttemptedNext && !isValidField("school") ? "Escribí la institución" : null}
                helperText="Esto ayuda a entender mejor el contexto del alumno."
                isActive={activeIndex === 3}
                isCompleted={isValidField("school")}
                fieldRef={(el) => {
                  fieldRefs.current.school = el;
                }}
                onConfirm={() => confirmField("school")}
                onBack={() => jumpTo(2)}
                showBack
              >
                <div className={`neuro-input-wrapper premium-input ${getFieldStateClass("school")}`}>
                  <FaSchool className="input-icon" aria-hidden="true" />
                  <input
                    id="school"
                    type="text"
                    name="school"
                    value={formData.school}
                    onChange={handleChange}
                    autoComplete="organization"
                    aria-invalid={hasAttemptedNext && !isValidField("school") ? "true" : "false"}
                    placeholder="Escuela, facultad o institución"
                    onKeyDown={(e) => handleKey(e, "school")}
                  />
                  {isValidField("school") && (
                    <FaCheckCircle className="valid-icon" aria-hidden="true" />
                  )}
                </div>
              </FieldBlock>
            </div>
          )}

          {activeIndex >= 4 && (
            <div role="listitem">
              <FieldBlock
                fieldKey="academicSituation"
                label="Situación o comentarios"
                optional="opcional"
                helperText={
                  isAdult
                    ? "Si querés, dejá contexto para preparar mejor la clase."
                    : "Si querés, contanos qué necesita reforzar el alumno antes de la clase."
                }
                isActive={activeIndex === 4}
                isCompleted={formData.academicSituation.trim().length > 0}
                fieldRef={(el) => {
                  fieldRefs.current.academicSituation = el;
                }}
                onConfirm={() => confirmField("academicSituation")}
                onBack={() => jumpTo(3)}
                showBack
                confirmLabel="Listo"
              >
                <div className="neuro-textarea-wrapper premium-input">
                  <FaLightbulb className="input-icon" aria-hidden="true" />
                  <textarea
                    id="academicSituation"
                    ref={textareaRef}
                    rows={1}
                    name="academicSituation"
                    value={formData.academicSituation}
                    onChange={handleChange}
                    placeholder={
                      !isAdult
                        ? "Ej: Necesita reforzar base, practicar ejercicios y llegar con más seguridad al examen."
                        : "Ej: Quiero ordenar temas, practicar ejercicios y llegar mejor preparado al parcial."
                    }
                    lang="es"
                  />
                  {formData.academicSituation.trim().length > 0 && (
                    <FaCheckCircle className="valid-icon" aria-hidden="true" />
                  )}
                </div>
              </FieldBlock>
            </div>
          )}
        </div>

        <nav className="field-flow-progress" aria-label="Progreso de perfil académico">
          {ACADEMIC_FIELDS.map((field, index) => (
            <button
              key={field.key}
              type="button"
              className={`field-flow-dot${index === activeIndex ? " active" : ""}${index < activeIndex ? " done" : ""}`}
              onClick={() => {
                if (index <= activeIndex) jumpTo(index);
              }}
              aria-label={`Dato académico ${index + 1}${index < activeIndex ? ", confirmado" : index === activeIndex ? ", activo" : ", pendiente"}`}
              disabled={index > activeIndex}
            />
          ))}
        </nav>

        {canProceedToStep2 && activeIndex >= ACADEMIC_FIELDS.length - 1 && (
          <div className="step-actions right-align" style={{ marginTop: "2rem" }}>
            <button
              type="button"
              className="btn-neuro-primary btn-ready"
              onClick={() => {
                setHasAttemptedNext(false);
                goToNext();
              }}
            >
              Ir al día <FaArrowRight />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademicInfoStep;
