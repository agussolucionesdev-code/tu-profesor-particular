import { Children, cloneElement, isValidElement } from "react";
import { FaCheckCircle, FaArrowRight, FaArrowLeft } from "react-icons/fa";

const enhanceFieldControl = (children, fieldKey, required, errorText) =>
  Children.map(children, (child) => {
    if (!isValidElement(child)) return child;

    if (child.props.id === fieldKey) {
      const describedBy = [
        child.props["aria-describedby"],
        errorText ? `${fieldKey}-error` : null,
      ]
        .filter(Boolean)
        .join(" ");

      return cloneElement(child, {
        required: required || undefined,
        "aria-required": required ? "true" : undefined,
        "aria-describedby": describedBy || undefined,
      });
    }

    if (!child.props.children) return child;

    return cloneElement(child, {
      children: enhanceFieldControl(
        child.props.children,
        fieldKey,
        required,
        errorText,
      ),
    });
  });

/**
 * @component FieldBlock
 * @description Bloque de campo individual en el flujo paso a paso.
 * Muestra label, input (children), helper text, errores y botones de
 * Confirmar / Anterior. Se anima al entrar con la clase field-flow-block--animate-in.
 *
 * @param {string} fieldKey - ID del campo (para htmlFor y aria)
 * @param {string} label - Etiqueta visible
 * @param {boolean} [required] - Muestra asterisco
 * @param {string} [optional] - Texto entre paréntesis junto al label
 * @param {string|null} errorText - Texto de error (null = sin error)
 * @param {string} [helperText] - Texto de ayuda (solo visible cuando activo)
 * @param {boolean} isActive - Si es el campo actualmente activo
 * @param {boolean} isCompleted - Si el campo fue completado
 * @param {Function} fieldRef - Callback ref para registrar el elemento DOM
 * @param {Function} onConfirm - Handler del botón Confirmar
 * @param {Function} [onBack] - Handler del botón Anterior
 * @param {boolean} [showBack] - Si se muestra el botón Anterior
 * @param {string} [confirmLabel='Confirmar'] - Texto del botón de confirmación
 * @param {React.ReactNode} children - El input/select/etc
 */
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
    className={`field-flow-block field-flow-block--animate-in${isActive ? " is-active" : ""}${isCompleted && !isActive ? " is-done" : ""}`}
    aria-current={isActive ? "step" : undefined}
  >
    <div className="field-flow-label-row">
      <label htmlFor={fieldKey} className="field-flow-label">
        {label}
        {required && (
          <span className="required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
        {optional && <span className="optional"> ({optional})</span>}
      </label>
      {isCompleted && !isActive && (
        <span className="field-flow-done-badge" aria-label="Campo completado">
          <FaCheckCircle />
        </span>
      )}
      {errorText && (
        <span id={`${fieldKey}-error`} className="error-text" role="alert">
          {errorText}
        </span>
      )}
    </div>

    <div className={`field-flow-input-shell${isActive ? " focused" : ""}`}>
      {enhanceFieldControl(children, fieldKey, required, errorText)}
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
        <span className="field-flow-enter-hint" aria-hidden="true">
          o presion&aacute; <kbd>Enter</kbd> ↵
        </span>
      </div>
    )}
  </div>
);

export default FieldBlock;
