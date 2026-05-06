import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import {
  FaUserGraduate,
  FaWhatsapp,
  FaCheckCircle,
  FaUserCheck,
  FaIdCard,
  FaEnvelope,
  FaChevronDown,
  FaArrowRight,
  FaArrowLeft,
} from "react-icons/fa";
import {
  RESPONSIBLE_RELATIONSHIP_OPTIONS,
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
} from "../../../utils/bookingFormatters";

const useFieldFlow = ({ fields, isAdult }) => {
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
      () =>
        el
          .querySelector("input, select, textarea, button[role='switch']")
          ?.focus?.({ preventScroll: true }),
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
    setActiveIndex(0);
    setTimeout(() => scrollToField(0), 120);
  }, [isAdult, scrollToField]);

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

const PersonalInfoStep = ({
  formData,
  isAdult,
  hasAttemptedNext,
  setHasAttemptedNext,
  isValidField,
  getFieldStateClass,
  handleChange,
  toggleAdultMode,
}) => {
  const fields = useMemo(() => {
    const base = [
      { key: "studentName" },
      { key: "phone" },
      { key: "adultMode" },
    ];

    if (!isAdult) {
      base.push({ key: "responsibleName" });
      base.push({ key: "responsibleRelationship" });
      if (
        formData.responsibleRelationship ===
        RESPONSIBLE_RELATIONSHIP_OTHER_VALUE
      ) {
        base.push({ key: "responsibleRelationshipOther" });
      }
    }

    base.push({ key: "email" });
    return base;
  }, [formData.responsibleRelationship, isAdult]);

  const { activeIndex, fieldRefs, goNext, jumpTo } = useFieldFlow({
    fields,
    isAdult,
  });

  const isFieldConfirmed = useCallback(
    (fieldKey) => {
      if (fieldKey === "adultMode") return true;
      if (fieldKey === "email") {
        return formData.email.trim() === "" || isValidField("email");
      }
      return isValidField(fieldKey);
    },
    [formData.email, isValidField],
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
      if (e.key !== "Enter" || fieldKey === "adultMode") return;
      e.preventDefault();
      confirmField(fieldKey);
    },
    [confirmField],
  );

  const prevRelationshipRef = useRef(formData.responsibleRelationship);
  useEffect(() => {
    if (
      prevRelationshipRef.current !== formData.responsibleRelationship &&
      formData.responsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE
    ) {
      const nextIndex = fields.findIndex(
        (field) => field.key === "responsibleRelationshipOther",
      );
      if (nextIndex !== -1) {
        setTimeout(() => jumpTo(nextIndex), 120);
      }
    }
    prevRelationshipRef.current = formData.responsibleRelationship;
  }, [fields, formData.responsibleRelationship, jumpTo]);

  return (
    <div className="form-section-block">
      <h1 className="section-title" tabIndex={-1}>
        <FaIdCard aria-hidden="true" />
        Reservá tu clase
      </h1>
      <p className="step-empathy-note">
        Vamos de a un dato por vez, con confirmación clara y sin abrumarte.
      </p>

      <div className="field-flow-list" role="list">
        <div role="listitem">
          <FieldBlock
            fieldKey="studentName"
            label="Nombre del alumno"
            required
            errorText={
              hasAttemptedNext && !isValidField("studentName")
                ? "Escribí un nombre válido"
                : null
            }
            helperText="Escribilo como te gustaría verlo en el comprobante y en los avisos."
            isActive={activeIndex === 0}
            isCompleted={isValidField("studentName")}
            fieldRef={(el) => {
              fieldRefs.current.studentName = el;
            }}
            onConfirm={() => confirmField("studentName")}
            showBack={false}
          >
            <div className={`neuro-input-wrapper premium-input ${getFieldStateClass("studentName")}`}>
              <FaUserGraduate className="input-icon" aria-hidden="true" />
              <input
                id="studentName"
                type="text"
                name="studentName"
                value={formData.studentName}
                onChange={handleChange}
                autoComplete="name"
                aria-invalid={
                  hasAttemptedNext && !isValidField("studentName")
                    ? "true"
                    : "false"
                }
                aria-describedby="studentName-help"
                placeholder="Nombre y apellido del alumno"
                onKeyDown={(e) => handleKey(e, "studentName")}
              />
              {isValidField("studentName") && (
                <FaCheckCircle className="valid-icon" aria-hidden="true" />
              )}
            </div>
            <p id="studentName-help" className="sr-only">
              Escribilo como te gustaría verlo en el comprobante y en los avisos.
            </p>
          </FieldBlock>
        </div>

        {activeIndex >= 1 && (
          <div role="listitem">
            <FieldBlock
              fieldKey="phone"
              label="Número de WhatsApp"
              required
              optional="sin 0 ni 15"
              errorText={
                hasAttemptedNext && !isValidField("phone")
                  ? "Completá un WhatsApp válido"
                  : null
              }
              helperText="Lo usamos para recordatorios, cambios y seguimiento rápido."
              isActive={activeIndex === 1}
              isCompleted={isValidField("phone")}
              fieldRef={(el) => {
                fieldRefs.current.phone = el;
              }}
              onConfirm={() => confirmField("phone")}
              onBack={() => jumpTo(0)}
              showBack
            >
              <div className={`neuro-input-wrapper premium-input ${getFieldStateClass("phone")}`}>
                <FaWhatsapp className="input-icon" aria-hidden="true" />
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={
                    hasAttemptedNext && !isValidField("phone")
                      ? "true"
                      : "false"
                  }
                  aria-describedby="phone-help"
                  placeholder="+54 9 11-2222-3333"
                  onKeyDown={(e) => handleKey(e, "phone")}
                />
                {isValidField("phone") && (
                  <FaCheckCircle className="valid-icon" aria-hidden="true" />
                )}
              </div>
              <p id="phone-help" className="sr-only">
                Lo usamos para recordatorios, cambios y seguimiento rápido.
              </p>
            </FieldBlock>
          </div>
        )}

        {activeIndex >= 2 && (
          <div role="listitem">
            <FieldBlock
              fieldKey="adultMode"
              label="Quién reserva"
              helperText={
                isAdult
                  ? "Si cambiás de idea, podés volver al modo con responsable cuando quieras."
                  : "Si el turno es para un menor, pedimos un adulto responsable para acompañar el contacto."
              }
              isActive={activeIndex === 2}
              isCompleted={activeIndex > 2}
              fieldRef={(el) => {
                fieldRefs.current.adultMode = el;
              }}
              onConfirm={() => confirmField("adultMode")}
              onBack={() => jumpTo(1)}
              showBack
              confirmLabel="Seguir"
            >
              <button
                id="adultMode"
                type="button"
                className={`neuro-toggle-wrapper premium-input ${isAdult ? "active-box" : ""}`}
                role="switch"
                aria-checked={isAdult}
                aria-label="Indicar que el alumno es mayor de edad"
                aria-describedby="adult-mode-help"
                onClick={toggleAdultMode}
              >
                <div className="toggle-text">
                  <span className={`toggle-pill ${isAdult ? "active" : "inactive"}`}>
                    {isAdult ? "Reserva directa" : "Con responsable"}
                  </span>
                  <span className="toggle-title">El alumno es mayor de edad</span>
                  <span className="toggle-subtitle">
                    {isAdult
                      ? "Usaremos sus propios datos como contacto principal."
                      : "Vamos a pedir también los datos del adulto responsable."}
                  </span>
                </div>
                <div className="toggle-control-shell" aria-hidden="true">
                  <span className={`toggle-state-label ${isAdult ? "active" : ""}`}>
                    {isAdult ? "Activo" : "Activar"}
                  </span>
                  <div className={`neuro-toggle ${isAdult ? "active" : ""}`}></div>
                </div>
              </button>
              <p id="adult-mode-help" className="adult-mode-helper">
                {isAdult
                  ? "Si cambiás de idea, podés volver al modo con responsable en cualquier momento."
                  : "Podés activarlo cuando quieras; si ya habías cargado responsable, limpiamos esos datos."}
              </p>
            </FieldBlock>
          </div>
        )}

        {!isAdult && activeIndex >= 3 && (
          <div role="listitem">
            <FieldBlock
              fieldKey="responsibleName"
              label="Adulto responsable"
              required
              errorText={
                hasAttemptedNext && !isValidField("responsibleName")
                  ? "Escribí un nombre válido"
                  : null
              }
              helperText="Puede ser madre, padre, abuelo, abuela o quien acompañe el proceso."
              isActive={activeIndex === 3}
              isCompleted={isValidField("responsibleName")}
              fieldRef={(el) => {
                fieldRefs.current.responsibleName = el;
              }}
              onConfirm={() => confirmField("responsibleName")}
              onBack={() => jumpTo(2)}
              showBack
            >
              <div className={`neuro-input-wrapper premium-input ${getFieldStateClass("responsibleName")}`}>
                <FaUserCheck className="input-icon" aria-hidden="true" />
                <input
                  id="responsibleName"
                  type="text"
                  name="responsibleName"
                  value={formData.responsibleName}
                  onChange={handleChange}
                  autoComplete="name"
                  aria-invalid={
                    hasAttemptedNext &&
                    !isValidField("responsibleName")
                      ? "true"
                      : "false"
                  }
                  aria-describedby="responsibleName-help"
                  placeholder="Nombre del responsable"
                  onKeyDown={(e) => handleKey(e, "responsibleName")}
                />
                {isValidField("responsibleName") && (
                  <FaCheckCircle className="valid-icon" aria-hidden="true" />
                )}
              </div>
              <p id="responsibleName-help" className="sr-only">
                Puede ser madre, padre, abuelo, abuela o quien acompañe el proceso.
              </p>
            </FieldBlock>
          </div>
        )}

        {!isAdult && activeIndex >= 4 && (
          <div role="listitem">
            <FieldBlock
              fieldKey="responsibleRelationship"
              label="Vínculo con el alumno"
              required
              errorText={
                hasAttemptedNext &&
                !isValidField("responsibleRelationship")
                  ? "Elegí el vínculo"
                  : null
              }
              helperText="Así queda claro quién está gestionando el turno."
              isActive={activeIndex === 4}
              isCompleted={isValidField("responsibleRelationship")}
              fieldRef={(el) => {
                fieldRefs.current.responsibleRelationship = el;
              }}
              onConfirm={() => confirmField("responsibleRelationship")}
              onBack={() => jumpTo(3)}
              showBack
            >
              <div className={`neuro-input-wrapper premium-input select-input-wrapper ${getFieldStateClass("responsibleRelationship")}`}>
                <FaIdCard className="input-icon" aria-hidden="true" />
                <select
                  id="responsibleRelationship"
                  name="responsibleRelationship"
                  value={formData.responsibleRelationship}
                  onChange={handleChange}
                  aria-invalid={
                    hasAttemptedNext &&
                    !isValidField("responsibleRelationship")
                      ? "true"
                      : "false"
                  }
                  aria-describedby="responsibleRelationship-help"
                >
                  <option value="">Seleccioná el vínculo</option>
                  {RESPONSIBLE_RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FaChevronDown className="select-chevron" aria-hidden="true" />
                {isValidField("responsibleRelationship") && (
                  <FaCheckCircle className="valid-icon select-valid" aria-hidden="true" />
                )}
              </div>
              <p id="responsibleRelationship-help" className="sr-only">
                Así queda claro quién está gestionando el turno.
              </p>
            </FieldBlock>
          </div>
        )}

        {!isAdult &&
          formData.responsibleRelationship ===
            RESPONSIBLE_RELATIONSHIP_OTHER_VALUE &&
          activeIndex >= 5 && (
            <div role="listitem">
              <FieldBlock
                fieldKey="responsibleRelationshipOther"
                label="Cuál es el vínculo"
                required
                errorText={
                  hasAttemptedNext &&
                  !isValidField("responsibleRelationshipOther")
                    ? "Escribí el vínculo"
                    : null
                }
                helperText="Escribilo como querés que figure en el resumen y en el comprobante."
                isActive={activeIndex === 5}
                isCompleted={isValidField("responsibleRelationshipOther")}
                fieldRef={(el) => {
                  fieldRefs.current.responsibleRelationshipOther = el;
                }}
                onConfirm={() => confirmField("responsibleRelationshipOther")}
                onBack={() => jumpTo(4)}
                showBack
              >
                <div className={`neuro-input-wrapper premium-input ${getFieldStateClass("responsibleRelationshipOther")}`}>
                  <FaUserCheck className="input-icon" aria-hidden="true" />
                  <input
                    id="responsibleRelationshipOther"
                    type="text"
                    name="responsibleRelationshipOther"
                    value={formData.responsibleRelationshipOther}
                    onChange={handleChange}
                    aria-invalid={
                      hasAttemptedNext &&
                      !isValidField("responsibleRelationshipOther")
                        ? "true"
                        : "false"
                    }
                    aria-describedby="responsibleRelationshipOther-help"
                    placeholder="Ej.: Tutor legal, madrina, referente familiar"
                    onKeyDown={(e) => handleKey(e, "responsibleRelationshipOther")}
                  />
                  {isValidField("responsibleRelationshipOther") && (
                    <FaCheckCircle className="valid-icon" aria-hidden="true" />
                  )}
                </div>
                <p id="responsibleRelationshipOther-help" className="sr-only">
                  Escribilo como querés que figure en el resumen y en el comprobante.
                </p>
              </FieldBlock>
            </div>
          )}

        {activeIndex >= fields.length - 1 && (
          <div role="listitem">
            <FieldBlock
              fieldKey="email"
              label={isAdult ? "Email" : "Email de contacto"}
              optional="opcional"
              errorText={
                hasAttemptedNext &&
                formData.email.trim() !== "" &&
                !isValidField("email")
                  ? "Escribí un email válido"
                  : null
              }
              helperText={
                isAdult
                  ? "Si lo completás, también te enviamos el resumen por correo."
                  : "Si lo dejás, el adulto responsable también recibe respaldo por correo."
              }
              isActive={activeIndex === fields.length - 1}
              isCompleted={formData.email.trim() === "" || isValidField("email")}
              fieldRef={(el) => {
                fieldRefs.current.email = el;
              }}
              onConfirm={() => confirmField("email")}
              onBack={() => jumpTo(fields.length - 2)}
              showBack
              confirmLabel="Listo"
            >
              <div className={`neuro-input-wrapper premium-input ${getFieldStateClass("email", true)}`}>
                <FaEnvelope className="input-icon" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  aria-invalid={
                    hasAttemptedNext &&
                    formData.email.trim() !== "" &&
                    !isValidField("email")
                      ? "true"
                      : "false"
                  }
                  aria-describedby="email-help"
                  placeholder="correo@ejemplo.com"
                  onKeyDown={(e) => handleKey(e, "email")}
                />
                {formData.email.trim() !== "" && isValidField("email") && (
                  <FaCheckCircle className="valid-icon" aria-hidden="true" />
                )}
              </div>
              <p id="email-help" className="sr-only">
                {isAdult
                  ? "Si lo completás, también te enviamos el resumen por correo."
                  : "Si lo dejás, el adulto responsable también recibe respaldo por correo."}
              </p>
            </FieldBlock>
          </div>
        )}
      </div>

      <nav className="field-flow-progress" aria-label="Progreso de datos personales">
        {fields.map((field, index) => (
          <button
            key={field.key}
            type="button"
            className={`field-flow-dot${index === activeIndex ? " active" : ""}${index < activeIndex ? " done" : ""}`}
            onClick={() => {
              if (index <= activeIndex) jumpTo(index);
            }}
            aria-label={`Dato ${index + 1}${index < activeIndex ? ", confirmado" : index === activeIndex ? ", activo" : ", pendiente"}`}
            disabled={index > activeIndex}
          />
        ))}
      </nav>
    </div>
  );
};

export default PersonalInfoStep;
