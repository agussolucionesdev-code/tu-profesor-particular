import { useCallback, useMemo, useRef, useEffect } from "react";
import {
  FaGraduationCap,
  FaBookOpen,
  FaSchool,
  FaCheckCircle,
  FaLightbulb,
} from "react-icons/fa";
import { getSubjectSuggestions } from "../../../constants/bookingWizard";
import useFieldFlow from "../../../hooks/useFieldFlow";
import FieldBlock from "../shared/FieldBlock";
import SelectField from "../shared/SelectField";
import AutocompleteField from "../shared/AutocompleteField";
import VerificationScreen from "../shared/VerificationScreen";

const EDUCATION_LEVEL_OPTIONS = [
  { value: "Primaria", label: "Primaria" },
  { value: "Secundaria", label: "Secundaria" },
  { value: "Secundaria Tecnica", label: "Secundaria técnica" },
  { value: "Terciario", label: "Terciario / Superior" },
  { value: "Universitario", label: "Universitario" },
];

const ACADEMIC_FIELDS = [
  { key: "educationLevel" },
  { key: "yearGrade" },
  { key: "subject" },
  { key: "school" },
  { key: "academicSituation" },
];

/**
 * @component AcademicInfoStep
 * @description Sección de perfil académico del wizard. Se muestra solo cuando
 * isPersonalInfoComplete es true. Un campo a la vez con animación. Al completar
 * todos los campos, muestra la pantalla de verificación con botón para avanzar
 * al paso 2 (fecha/hora).
 */
const AcademicInfoStep = ({
  formData,
  isAdult,
  isVisible = false,
  hasAttemptedNext,
  setHasAttemptedNext,
  isValidField,
  getFieldStateClass,
  handleChange,
  isPersonalInfoComplete,
  isAcademicInfoComplete,
  canProceedToStep2,
  textareaRef,
  getYearGradeOptions,
  goToNext,
  onBackToPersonal,
}) => {
  // ── Hook de flujo: resetea cuando la sección se vuelve visible ───────────
  const {
    activeIndex,
    showVerification,
    fieldRefs,
    goNext,
    jumpTo,
    enterVerification,
    exitVerification,
  } = useFieldFlow({
    fields: ACADEMIC_FIELDS,
    resetTrigger: isVisible,
    startVisible: false,
  });

  // ── Validación de campo ──────────────────────────────────────────────────
  const isFieldConfirmed = useCallback(
    (fieldKey) => {
      if (fieldKey === "academicSituation") return true;
      return isValidField(fieldKey);
    },
    [isValidField],
  );

  /**
   * Confirma el campo actual. Si es academicSituation (último), entra a
   * verificación. Si no pasa validación, marca intento y aborta.
   */
  const confirmField = useCallback(
    (fieldKey) => {
      if (!isFieldConfirmed(fieldKey)) {
        setHasAttemptedNext(true);
        return;
      }
      setHasAttemptedNext(false);
      if (fieldKey === "academicSituation") {
        enterVerification();
      } else {
        goNext();
      }
    },
    [enterVerification, goNext, isFieldConfirmed, setHasAttemptedNext],
  );

  // ── Enter en inputs de texto ─────────────────────────────────────────────
  const handleKey = useCallback(
    (e, fieldKey) => {
      if (e.key !== "Enter" || fieldKey === "academicSituation") return;
      e.preventDefault();
      confirmField(fieldKey);
    },
    [confirmField],
  );

  // ── Auto-confirm en selects (educationLevel, yearGrade) ──────────────────
  const selectTimeoutRef = useRef(null);
  const confirmFieldRef = useRef(confirmField);
  confirmFieldRef.current = confirmField;

  const makeSelectHandler = useCallback(
    (fieldKey) => (e) => {
      handleChange(e);
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
      if (e.target.value) {
        selectTimeoutRef.current = setTimeout(() => {
          confirmFieldRef.current(fieldKey);
        }, 280);
      }
    },
    [handleChange],
  );

  useEffect(() => {
    return () => {
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
    };
  }, []);

  // ── Datos para la pantalla de verificación ───────────────────────────────
  const verificationFields = useMemo(
    () => [
      {
        key: "educationLevel",
        label: "Nivel educativo",
        value: formData.educationLevel,
      },
      {
        key: "yearGrade",
        label: "Año / Curso",
        value: formData.yearGrade,
      },
      {
        key: "subject",
        label: "Materia / Tema",
        value: formData.subject,
      },
      {
        key: "school",
        label: "Institución",
        value: formData.school,
      },
      ...(formData.academicSituation.trim()
        ? [
            {
              key: "academicSituation",
              label: "Comentarios",
              value: formData.academicSituation,
              isOptional: true,
            },
          ]
        : []),
    ],
    [formData],
  );

  const activeField = ACADEMIC_FIELDS[activeIndex];

  // ── Guard: no renderizar hasta que personal info esté completa ───────────
  if (!isPersonalInfoComplete) return null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="progressive-disclosure-grid is-active"
      style={{ display: isVisible ? undefined : "none", marginTop: "0.5rem" }}
      aria-hidden={isVisible ? undefined : "true"}
    >
      <div className="progressive-inner">
        <hr className="section-divider-soft" />
        <h2 className="section-title" tabIndex={-1}>
          <FaGraduationCap aria-hidden="true" />
          Perfil académico
        </h2>
        <p className="step-empathy-note">
          Confirmá cada dato y recién ahí avanzamos al siguiente.
        </p>

        {!showVerification ? (
          <div
            className="field-flow-stage"
            role="region"
            aria-label="Campo activo"
            aria-live="polite"
          >
            {/* ── Progress dots ── */}
            <nav
              className="field-flow-progress"
              data-step-label={`${activeIndex + 1} de ${ACADEMIC_FIELDS.length}`}
              aria-label="Progreso de perfil académico"
            >
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

            {/* ── Campo activo único ── */}
            {activeField && (
              <div className="field-flow-single" key={activeField.key}>
                {/* ── educationLevel ── */}
                {activeField.key === "educationLevel" && (
                  <FieldBlock
                    key="educationLevel"
                    fieldKey="educationLevel"
                    label="Nivel educativo"
                    required
                    errorText={
                      hasAttemptedNext && !isValidField("educationLevel")
                        ? "Elegí el nivel"
                        : null
                    }
                    helperText="Seleccioná el nivel en el que estudia actualmente."
                    isActive
                    isCompleted={isValidField("educationLevel")}
                    fieldRef={(el) => {
                      fieldRefs.current.educationLevel = el;
                    }}
                    onConfirm={() => confirmField("educationLevel")}
                    onBack={onBackToPersonal}
                    showBack={typeof onBackToPersonal === "function"}
                  >
                    <SelectField
                      id="educationLevel"
                      name="educationLevel"
                      value={formData.educationLevel}
                      onChange={makeSelectHandler("educationLevel")}
                      options={EDUCATION_LEVEL_OPTIONS}
                      placeholder="Elegí el nivel educativo"
                      isValid={isValidField("educationLevel")}
                      stateClass={getFieldStateClass("educationLevel")}
                      aria-invalid={
                        hasAttemptedNext && !isValidField("educationLevel")
                          ? "true"
                          : "false"
                      }
                    />
                  </FieldBlock>
                )}

                {/* ── yearGrade ── */}
                {activeField.key === "yearGrade" && (
                  <FieldBlock
                    key="yearGrade"
                    fieldKey="yearGrade"
                    label="Curso, año o grado"
                    required
                    errorText={
                      hasAttemptedNext && !isValidField("yearGrade")
                        ? "Elegí el curso o año"
                        : null
                    }
                    helperText="Te mostramos las opciones correctas según el nivel que acabás de elegir."
                    isActive
                    isCompleted={isValidField("yearGrade")}
                    fieldRef={(el) => {
                      fieldRefs.current.yearGrade = el;
                    }}
                    onConfirm={() => confirmField("yearGrade")}
                    onBack={() => jumpTo(0)}
                    showBack
                  >
                    <SelectField
                      id="yearGrade"
                      name="yearGrade"
                      value={formData.yearGrade}
                      onChange={makeSelectHandler("yearGrade")}
                      options={getYearGradeOptions().map((o) => ({ value: o, label: o }))}
                      placeholder={
                        !formData.educationLevel
                          ? "Elegí el nivel primero"
                          : "Elegí curso, año o grado"
                      }
                      disabled={!formData.educationLevel}
                      isValid={isValidField("yearGrade")}
                      stateClass={getFieldStateClass("yearGrade")}
                      aria-invalid={
                        hasAttemptedNext && !isValidField("yearGrade")
                          ? "true"
                          : "false"
                      }
                    />
                  </FieldBlock>
                )}

                {/* ── subject ── */}
                {activeField.key === "subject" && (
                  <FieldBlock
                    key="subject"
                    fieldKey="subject"
                    label="Materia o tema"
                    required
                    errorText={
                      hasAttemptedNext && !isValidField("subject")
                        ? "Escribí la materia o tema"
                        : null
                    }
                    helperText="Puede ser una materia, un examen o un tema puntual a trabajar."
                    isActive
                    isCompleted={isValidField("subject")}
                    fieldRef={(el) => {
                      fieldRefs.current.subject = el;
                    }}
                    onConfirm={() => confirmField("subject")}
                    onBack={() => jumpTo(1)}
                    showBack
                  >
                    <AutocompleteField
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      suggestions={getSubjectSuggestions(formData.educationLevel)}
                      placeholder="Materia, tema o examen a preparar"
                      icon={<FaBookOpen className="input-icon" aria-hidden="true" />}
                      isValid={isValidField("subject")}
                      stateClass={getFieldStateClass("subject")}
                      aria-invalid={
                        hasAttemptedNext && !isValidField("subject")
                          ? "true"
                          : "false"
                      }
                      onKeyDown={(e) => handleKey(e, "subject")}
                    />
                  </FieldBlock>
                )}

                {/* ── school ── */}
                {activeField.key === "school" && (
                  <FieldBlock
                    key="school"
                    fieldKey="school"
                    label="Institución o colegio"
                    required
                    errorText={
                      hasAttemptedNext && !isValidField("school")
                        ? "Escribí la institución"
                        : null
                    }
                    helperText="Esto ayuda a entender mejor el contexto del alumno."
                    isActive
                    isCompleted={isValidField("school")}
                    fieldRef={(el) => {
                      fieldRefs.current.school = el;
                    }}
                    onConfirm={() => confirmField("school")}
                    onBack={() => jumpTo(2)}
                    showBack
                  >
                    <div
                      className={`neuro-input-wrapper premium-input ${getFieldStateClass("school")}`}
                    >
                      <FaSchool className="input-icon" aria-hidden="true" />
                      <input
                        id="school"
                        type="text"
                        name="school"
                        value={formData.school}
                        onChange={handleChange}
                        autoComplete="organization"
                        aria-invalid={
                          hasAttemptedNext && !isValidField("school")
                            ? "true"
                            : "false"
                        }
                        placeholder="Escuela, facultad o institución"
                        onKeyDown={(e) => handleKey(e, "school")}
                      />
                      {isValidField("school") && (
                        <FaCheckCircle
                          className="valid-icon"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </FieldBlock>
                )}

                {/* ── academicSituation ── */}
                {activeField.key === "academicSituation" && (
                  <FieldBlock
                    key="academicSituation"
                    fieldKey="academicSituation"
                    label="Situación o comentarios"
                    optional="opcional"
                    helperText={
                      isAdult
                        ? "Si querés, dejá contexto para preparar mejor la clase."
                        : "Si querés, contanos qué necesita reforzar el alumno antes de la clase."
                    }
                    isActive
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
                        <FaCheckCircle
                          className="valid-icon"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </FieldBlock>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── Pantalla de verificación con botón de avance ── */
          <VerificationScreen
            title="Perfil académico"
            fields={verificationFields}
            onEdit={(index) => {
              const fieldKey = verificationFields[index]?.key;
              const fieldIndex = ACADEMIC_FIELDS.findIndex(
                (f) => f.key === fieldKey,
              );
              exitVerification(fieldIndex !== -1 ? fieldIndex : index);
            }}
            onContinue={() => {
              setHasAttemptedNext(false);
              goToNext();
            }}
            continueLabel="Ir al día →"
            canContinue={canProceedToStep2}
          />
        )}
      </div>
    </div>
  );
};

export default AcademicInfoStep;
