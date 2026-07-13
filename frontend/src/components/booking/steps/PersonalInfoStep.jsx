import { useCallback, useMemo, useRef, useEffect } from "react";
import {
  FaUserGraduate,
  FaWhatsapp,
  FaCheckCircle,
  FaUserCheck,
  FaIdCard,
  FaEnvelope,
} from "react-icons/fa";
import {
  RESPONSIBLE_RELATIONSHIP_OPTIONS,
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
} from "../../../utils/bookingFormatters";
import useFieldFlow from "../../../hooks/useFieldFlow";
import FieldBlock from "../shared/FieldBlock";
import SelectField from "../shared/SelectField";
import VerificationScreen from "../shared/VerificationScreen";

/**
 * @component PersonalInfoStep
 * @description Paso 1 del wizard: datos personales del alumno y responsable.
 * Muestra un campo a la vez con animación de slide, y al completar todos
 * presenta la pantalla de verificación. No tiene botón de avance propio —
 * el wizard avanza cuando ambas secciones (personal + académica) están completas.
 */
const PersonalInfoStep = ({
  formData,
  isAdult,
  isVisible = true,
  hasAttemptedNext,
  setHasAttemptedNext,
  isValidField,
  getFieldStateClass,
  handleChange,
  toggleAdultMode,
  onContinueToAcademic,
  onValidationError,
}) => {
  // ── Definición de campos según modo adulto ──────────────────────────────
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

  // ── Hook de flujo ────────────────────────────────────────────────────────
  const {
    activeIndex,
    showVerification,
    setFieldRef,
    goNext,
    jumpTo,
    enterVerification,
    exitVerification,
  } = useFieldFlow({ fields, resetTrigger: isAdult });

  // ── Validación de campo antes de confirmar ───────────────────────────────
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

  /**
   * Confirma el campo actual. Si es email (último), entra a verificación.
   * Si no pasa validación, marca intento y aborta.
   */
  const confirmField = useCallback(
    (fieldKey) => {
      if (!isFieldConfirmed(fieldKey)) {
        onValidationError?.(fieldKey);
        setHasAttemptedNext(true);
        return;
      }
      setHasAttemptedNext(false);
      if (fieldKey === "email") {
        enterVerification();
      } else {
        goNext();
      }
    },
    [enterVerification, goNext, isFieldConfirmed, onValidationError, setHasAttemptedNext],
  );

  // ── Enter en inputs de texto ─────────────────────────────────────────────
  const handleKey = useCallback(
    (e, fieldKey) => {
      if (e.key !== "Enter" || fieldKey === "adultMode") return;
      e.preventDefault();
      confirmField(fieldKey);
    },
    [confirmField],
  );

  // ── Auto-confirm en select responsibleRelationship ───────────────────────
  // Cuando el usuario elige un valor, se confirma después de 280ms.
  // Se cancela si el componente se desmonta.
  const selectTimeoutRef = useRef(null);
  const handleRelationshipChange = useCallback(
    (e) => {
      handleChange(e);
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
      const value = e.target.value;
      if (value) {
        selectTimeoutRef.current = setTimeout(() => {
          confirmField("responsibleRelationship");
        }, 280);
      }
    },
    [confirmField, handleChange],
  );
  useEffect(() => {
    return () => {
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
    };
  }, []);

  // ── Salto automático a responsibleRelationshipOther cuando se elige "otro" ─
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

  // ── Datos para la pantalla de verificación ───────────────────────────────
  const verificationFields = useMemo(() => {
    const f = [
      { key: "studentName", label: "Nombre del alumno", value: formData.studentName },
      { key: "phone", label: "WhatsApp", value: formData.phone },
    ];
    if (!isAdult) {
      f.push({
        key: "responsibleName",
        label: "Adulto responsable",
        value: formData.responsibleName,
      });
      f.push({
        key: "responsibleRelationship",
        label: "Vínculo",
        value: formData.responsibleRelationship,
      });
      if (
        formData.responsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE
      ) {
        f.push({
          key: "responsibleRelationshipOther",
          label: "Vínculo específico",
          value: formData.responsibleRelationshipOther,
        });
      }
    }
    f.push({
      key: "email",
      label: "Email",
      value: formData.email || "—",
      isOptional: true,
    });
    return f;
  }, [formData, isAdult]);

  // ── Índice activo del campo que se muestra actualmente ───────────────────
  const activeField = fields[activeIndex];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="form-section-block"
      style={{ display: isVisible ? undefined : "none" }}
      aria-hidden={isVisible ? undefined : "true"}
    >
      <h1 className="section-title" tabIndex={-1}>
        <FaIdCard aria-hidden="true" />
        Reservá tu clase
      </h1>
      <p className="step-empathy-note">
        Vamos de a un dato por vez, con confirmación clara y sin abrumarte.
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
            data-step-label={`${activeIndex + 1} de ${fields.length}`}
            aria-label="Progreso de datos personales"
          >
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

          {/* ── Campo activo único ── */}
          {activeField && (
            <div className="field-flow-single" key={activeField.key}>
              {/* ── studentName ── */}
              {activeField.key === "studentName" && (
                <FieldBlock
                  key="studentName"
                  fieldKey="studentName"
                  label="Nombre del alumno"
                  required
                  errorText={
                    hasAttemptedNext && !isValidField("studentName")
                      ? "Escribí un nombre válido"
                      : null
                  }
                  helperText="Escribilo como te gustaría verlo en el comprobante y en los avisos."
                  isActive
                  isCompleted={isValidField("studentName")}
                  fieldRef={(el) => {
                    setFieldRef("studentName", el);
                  }}
                  onConfirm={() => confirmField("studentName")}
                  showBack={false}
                >
                  <div
                    className={`neuro-input-wrapper premium-input ${getFieldStateClass("studentName")}`}
                  >
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
              )}

              {/* ── phone ── */}
              {activeField.key === "phone" && (
                <FieldBlock
                  key="phone"
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
                  isActive
                  isCompleted={isValidField("phone")}
                  fieldRef={(el) => {
                    setFieldRef("phone", el);
                  }}
                  onConfirm={() => confirmField("phone")}
                  onBack={() => jumpTo(0)}
                  showBack
                >
                  <div
                    className={`neuro-input-wrapper premium-input ${getFieldStateClass("phone")}`}
                  >
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
              )}

              {/* ── adultMode ── */}
              {activeField.key === "adultMode" && (
                <FieldBlock
                  key="adultMode"
                  fieldKey="adultMode"
                  label="¿El alumno es mayor de edad?"
                  helperText={
                    isAdult
                      ? "Usaremos sus propios datos como contacto."
                      : "Vamos a pedir los datos de un adulto responsable."
                  }
                  isActive
                  isCompleted={activeIndex > fields.findIndex((f) => f.key === "adultMode")}
                  fieldRef={(el) => {
                    setFieldRef("adultMode", el);
                  }}
                  onConfirm={() => confirmField("adultMode")}
                  onBack={() => jumpTo(activeIndex - 1)}
                  showBack
                  confirmLabel="Seguir"
                >
                  <button
                    id="adultMode"
                    type="button"
                    className={`adult-toggle-clean ${isAdult ? "is-on" : ""}`}
                    role="switch"
                    aria-checked={isAdult}
                    aria-label="Indicar que el alumno es mayor de edad"
                    onClick={toggleAdultMode}
                  >
                    <span className="adult-toggle-label">
                      {isAdult ? "Sí, es mayor" : "No, es menor"}
                    </span>
                    <div
                      className={`neuro-toggle ${isAdult ? "active" : ""}`}
                    ></div>
                  </button>
                  <span
                    role="status"
                    aria-live="polite"
                    className="sr-only"
                  >
                    {isAdult
                      ? "Modo adulto activado. No se pedirán datos de responsable."
                      : "Modo menor activado. Se pedirán datos del adulto responsable."}
                  </span>
                </FieldBlock>
              )}

              {/* ── responsibleName ── */}
              {activeField.key === "responsibleName" && (
                <FieldBlock
                  key="responsibleName"
                  fieldKey="responsibleName"
                  label="Adulto responsable"
                  required
                  errorText={
                    hasAttemptedNext && !isValidField("responsibleName")
                      ? "Escribí un nombre válido"
                      : null
                  }
                  helperText="Puede ser madre, padre, abuelo, abuela o quien acompañe el proceso."
                  isActive
                  isCompleted={isValidField("responsibleName")}
                  fieldRef={(el) => {
                    setFieldRef("responsibleName", el);
                  }}
                  onConfirm={() => confirmField("responsibleName")}
                  onBack={() => jumpTo(activeIndex - 1)}
                  showBack
                >
                  <div
                    className={`neuro-input-wrapper premium-input ${getFieldStateClass("responsibleName")}`}
                  >
                    <FaUserCheck className="input-icon" aria-hidden="true" />
                    <input
                      id="responsibleName"
                      type="text"
                      name="responsibleName"
                      value={formData.responsibleName}
                      onChange={handleChange}
                      autoComplete="name"
                      aria-invalid={
                        hasAttemptedNext && !isValidField("responsibleName")
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
              )}

              {/* ── responsibleRelationship ── */}
              {activeField.key === "responsibleRelationship" && (
                <FieldBlock
                  key="responsibleRelationship"
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
                  isActive
                  isCompleted={isValidField("responsibleRelationship")}
                  fieldRef={(el) => {
                    setFieldRef("responsibleRelationship", el);
                  }}
                  onConfirm={() => confirmField("responsibleRelationship")}
                  onBack={() => jumpTo(activeIndex - 1)}
                  showBack
                >
                  <SelectField
                    id="responsibleRelationship"
                    name="responsibleRelationship"
                    value={formData.responsibleRelationship}
                    onChange={handleRelationshipChange}
                    options={RESPONSIBLE_RELATIONSHIP_OPTIONS}
                    placeholder="Seleccioná el vínculo"
                    isValid={isValidField("responsibleRelationship")}
                    stateClass={getFieldStateClass("responsibleRelationship")}
                    aria-invalid={
                      hasAttemptedNext &&
                      !isValidField("responsibleRelationship")
                        ? "true"
                        : "false"
                    }
                    aria-describedby="responsibleRelationship-help"
                  />
                  <p id="responsibleRelationship-help" className="sr-only">
                    Así queda claro quién está gestionando el turno.
                  </p>
                </FieldBlock>
              )}

              {/* ── responsibleRelationshipOther ── */}
              {activeField.key === "responsibleRelationshipOther" && (
                <FieldBlock
                  key="responsibleRelationshipOther"
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
                  isActive
                  isCompleted={isValidField("responsibleRelationshipOther")}
                  fieldRef={(el) => {
                    setFieldRef("responsibleRelationshipOther", el);
                  }}
                  onConfirm={() => confirmField("responsibleRelationshipOther")}
                  onBack={() => jumpTo(activeIndex - 1)}
                  showBack
                >
                  <div
                    className={`neuro-input-wrapper premium-input ${getFieldStateClass("responsibleRelationshipOther")}`}
                  >
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
                      onKeyDown={(e) =>
                        handleKey(e, "responsibleRelationshipOther")
                      }
                    />
                    {isValidField("responsibleRelationshipOther") && (
                      <FaCheckCircle className="valid-icon" aria-hidden="true" />
                    )}
                  </div>
                  <p id="responsibleRelationshipOther-help" className="sr-only">
                    Escribilo como querés que figure en el resumen y en el comprobante.
                  </p>
                </FieldBlock>
              )}

              {/* ── email ── */}
              {activeField.key === "email" && (
                <FieldBlock
                  key="email"
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
                      ? "Recomendado: te enviamos el comprobante de reserva por correo y podés usarlo para gestionar tu turno."
                      : "Recomendado: si lo cargás, enviamos el comprobante al responsable por email."
                  }
                  isActive
                  isCompleted={
                    formData.email.trim() === "" || isValidField("email")
                  }
                  fieldRef={(el) => {
                    setFieldRef("email", el);
                  }}
                  onConfirm={() => confirmField("email")}
                  onBack={() => jumpTo(activeIndex - 1)}
                  showBack
                  confirmLabel="Listo"
                >
                  <div
                    className={`neuro-input-wrapper premium-input ${getFieldStateClass("email", true)}`}
                  >
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
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Pantalla de verificación ── */
        <VerificationScreen
          title="Tus datos personales"
          fields={verificationFields}
          onEdit={(index) => {
            // Mapear el índice del campo de verificación al índice del campo
            // en el array fields (puede diferir si hay campos opcionales)
            const fieldKey = verificationFields[index]?.key;
            const fieldIndex = fields.findIndex((f) => f.key === fieldKey);
            exitVerification(fieldIndex !== -1 ? fieldIndex : index);
          }}
          onContinue={onContinueToAcademic}
          continueLabel="Ir al perfil académico →"
          canContinue
        />
      )}
    </div>
  );
};

export default PersonalInfoStep;
