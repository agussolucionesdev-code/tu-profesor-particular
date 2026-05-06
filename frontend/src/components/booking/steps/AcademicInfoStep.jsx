import { useEffect, useRef } from "react";
import {
  FaGraduationCap,
  FaLayerGroup,
  FaSortNumericDown,
  FaBookOpen,
  FaSchool,
  FaCheckCircle,
  FaLightbulb,
  FaArrowRight,
} from "react-icons/fa";
import { getSubjectSuggestions } from "../../../constants/bookingWizard";

const AcademicInfoStep = ({
  formData,
  isAdult,
  hasAttemptedNext,
  isValidField,
  getFieldStateClass,
  handleChange,
  isPersonalInfoComplete,
  isAcademicInfoComplete,
  canProceedToStep2,
  textareaRef,
  getYearGradeOptions,
  goToNext,
}) => {
  const showYearGrade = isValidField("educationLevel");
  const showSubjectSchool = showYearGrade && isValidField("yearGrade");

  const yearGradeRef = useRef(null);
  const subjectSchoolRef = useRef(null);

  useEffect(() => {
    if (showYearGrade) {
      const t = setTimeout(
        () => yearGradeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80
      );
      return () => clearTimeout(t);
    }
  }, [showYearGrade]);

  useEffect(() => {
    if (showSubjectSchool) {
      const t = setTimeout(
        () => subjectSchoolRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80
      );
      return () => clearTimeout(t);
    }
  }, [showSubjectSchool]);

  return (
    <>
      <div
        className={`progressive-disclosure-grid ${isPersonalInfoComplete ? "is-active" : ""}`}
      >
        <div className="progressive-inner">
          <hr className="section-divider-soft" />
          <h3 className="section-title" tabIndex={-1}>
            <FaGraduationCap /> Perfil académico
          </h3>
          <div className="form-grid-2">
            <div className="neuro-input-group">
              <div className="label-row">
                <label htmlFor="educationLevel">
                  Nivel Educativo <span className="required">*</span>
                </label>
                {hasAttemptedNext && !isValidField("educationLevel") && (
                  <span className="error-text">Requerido</span>
                )}
              </div>
              <div
                className={`neuro-input-wrapper premium-input ${getFieldStateClass("educationLevel")}`}
              >
                <FaLayerGroup className="input-icon" />
                <select
                  id="educationLevel"
                  name="educationLevel"
                  value={formData.educationLevel}
                  onChange={handleChange}
                  aria-invalid={
                    hasAttemptedNext && !isValidField("educationLevel")
                  }
                >
                  <option value="">Elegí el nivel educativo</option>
                  <option value="Primaria">Primaria</option>
                  <option value="Secundaria">Secundaria</option>
                  <option value="Secundaria Tecnica">
                    Secundaria técnica
                  </option>
                  <option value="Terciario">Terciario / Superior</option>
                  <option value="Universitario">Universitario</option>
                </select>
                {isValidField("educationLevel") && (
                  <FaCheckCircle className="valid-icon select-valid" />
                )}
              </div>
            </div>

            <div
              className="field-reveal"
              data-visible={String(showYearGrade || hasAttemptedNext)}
              ref={yearGradeRef}
            >
              <div className="neuro-input-group">
                <div className="label-row">
                  <label htmlFor="yearGrade">
                    Año / grado <span className="required">*</span>
                  </label>
                  {hasAttemptedNext && !isValidField("yearGrade") && (
                    <span className="error-text">Requerido</span>
                  )}
                </div>
                <div
                  className={`neuro-input-wrapper premium-input ${getFieldStateClass("yearGrade")}`}
                >
                  <FaSortNumericDown className="input-icon" />
                  <select
                    id="yearGrade"
                    name="yearGrade"
                    value={formData.yearGrade}
                    onChange={handleChange}
                    disabled={!formData.educationLevel}
                    aria-invalid={
                      hasAttemptedNext && !isValidField("yearGrade")
                    }
                    tabIndex={showYearGrade || hasAttemptedNext ? undefined : -1}
                  >
                    {!formData.educationLevel && (
                      <option value="">Elegí el nivel primero</option>
                    )}
                    {formData.educationLevel && (
                      <option value="">Elegí curso, año o grado</option>
                    )}
                    {getYearGradeOptions().map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {isValidField("yearGrade") && (
                    <FaCheckCircle className="valid-icon select-valid" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className="field-reveal"
            data-visible={String(showSubjectSchool || hasAttemptedNext)}
            ref={subjectSchoolRef}
          >
            <div className="form-grid-2">
              <div className="neuro-input-group">
                <div className="label-row">
                  <label htmlFor="subject">
                    Materia a Preparar <span className="required">*</span>
                  </label>
                  {hasAttemptedNext && !isValidField("subject") && (
                    <span className="error-text">Requerido</span>
                  )}
                </div>
                <div
                  className={`neuro-input-wrapper premium-input ${getFieldStateClass("subject")}`}
                >
                  <FaBookOpen className="input-icon" />
                  <input
                    id="subject"
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    list="subject-suggestions"
                    aria-invalid={hasAttemptedNext && !isValidField("subject")}
                    placeholder="Materia, tema o examen a preparar"
                    autoComplete="off"
                    tabIndex={showSubjectSchool || hasAttemptedNext ? undefined : -1}
                  />
                  {isValidField("subject") && (
                    <FaCheckCircle className="valid-icon" />
                  )}
                </div>
                <datalist id="subject-suggestions">
                  {getSubjectSuggestions(formData.educationLevel).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="neuro-input-group">
                <div className="label-row">
                  <label htmlFor="school">
                    Institución / colegio{" "}
                    <span className="required">*</span>
                  </label>
                  {hasAttemptedNext && !isValidField("school") && (
                    <span className="error-text">Requerido</span>
                  )}
                </div>
                <div
                  className={`neuro-input-wrapper premium-input ${getFieldStateClass("school")}`}
                >
                  <FaSchool className="input-icon" />
                  <input
                    id="school"
                    type="text"
                    name="school"
                    value={formData.school}
                    onChange={handleChange}
                    autoComplete="organization"
                    aria-invalid={hasAttemptedNext && !isValidField("school")}
                    placeholder="Escuela, facultad o institución"
                    tabIndex={showSubjectSchool || hasAttemptedNext ? undefined : -1}
                  />
                  {isValidField("school") && (
                    <FaCheckCircle className="valid-icon" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`progressive-disclosure-grid ${isAcademicInfoComplete ? "is-active" : ""}`}
      >
        <div className="progressive-inner">
          <div className="neuro-input-group" style={{ marginTop: "1.5rem" }}>
            <div className="label-row">
              <label htmlFor="academicSituation">
                Situación / comentarios{" "}
                <span className="optional">(Opcional pero recomendado)</span>
              </label>
            </div>
            <div className="neuro-textarea-wrapper premium-input">
              <FaLightbulb className="input-icon" />
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
                <FaCheckCircle className="valid-icon" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="step-actions right-align"
        style={{ marginTop: "2.5rem" }}
      >
        <button
          type="button"
          className={`btn-neuro-primary ${!canProceedToStep2 ? "btn-disabled" : "btn-ready"}`}
          onClick={goToNext}
        >
          Continuar <FaArrowRight />
        </button>
      </div>
    </>
  );
};

export default AcademicInfoStep;
