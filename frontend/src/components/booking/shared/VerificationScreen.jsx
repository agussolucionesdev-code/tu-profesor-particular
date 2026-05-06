import { FaCheckCircle, FaEdit, FaArrowRight } from "react-icons/fa";

/**
 * @component VerificationScreen
 * @description Pantalla de verificación de datos antes de avanzar al siguiente paso.
 * Muestra cada campo con su valor y un botón de edición. Si canContinue es true,
 * muestra un botón para avanzar al siguiente paso del wizard.
 *
 * @param {string} title - Título de la sección ("Tus datos" / "Perfil académico")
 * @param {Array<{key: string, label: string, value: string, isOptional?: boolean}>} fields
 *   Campos a mostrar en la lista de verificación
 * @param {Function} onEdit - Handler(index: number) cuando el usuario quiere editar
 * @param {Function} [onContinue] - Handler para avanzar al siguiente paso del wizard
 * @param {string} [continueLabel] - Texto del botón de avance ("Ir al día →")
 * @param {boolean} [canContinue=false] - Si el botón de avance está habilitado y visible
 */
const VerificationScreen = ({
  title,
  fields,
  onEdit,
  onContinue,
  continueLabel = "Continuar",
  canContinue = false,
}) => (
  <div className="verification-screen" role="region" aria-label={title}>
    {/* ── Header ── */}
    <div className="verification-header">
      <span className="verification-check-icon" aria-hidden="true">
        <FaCheckCircle />
      </span>
      <div>
        <p className="verification-title">✓ Todo listo — revisá tus datos</p>
        <p className="verification-subtitle">{title}</p>
      </div>
    </div>

    {/* ── Lista de campos ── */}
    <ul className="verification-list" role="list">
      {fields.map((field, index) => {
        const isEmpty = !field.value || String(field.value).trim() === "";
        return (
          <li
            key={field.key}
            className="verification-row"
            role="listitem"
            tabIndex={0}
            onClick={() => onEdit(index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit(index);
              }
            }}
            aria-label={`${field.label}: ${isEmpty ? "sin completar" : field.value}. Hacer clic para editar.`}
          >
            <div className="verification-row-content">
              <span className="verification-row-label">{field.label}</span>
              <span
                className={`verification-row-value${isEmpty && field.isOptional ? " is-optional-empty" : ""}`}
              >
                {isEmpty && field.isOptional ? "—" : field.value}
              </span>
            </div>
            <div className="verification-row-actions" aria-hidden="true">
              {!isEmpty && (
                <FaCheckCircle className="verification-done-icon" />
              )}
              <button
                type="button"
                className="verification-edit-btn"
                tabIndex={-1}
                aria-label={`Editar ${field.label}`}
              >
                <FaEdit />
              </button>
            </div>
          </li>
        );
      })}
    </ul>

    {/* ── Botón de avance (solo si canContinue) ── */}
    {canContinue && onContinue && (
      <button
        type="button"
        className="verification-continue-btn"
        onClick={onContinue}
      >
        {continueLabel} <FaArrowRight />
      </button>
    )}
  </div>
);

export default VerificationScreen;
