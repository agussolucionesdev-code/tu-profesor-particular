import { useEffect, useState } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { FaExclamationTriangle } from "react-icons/fa";

/**
 * Reusable confirmation dialog.
 *
 * Props:
 *   isOpen       — controls visibility
 *   title        — dialog heading
 *   message      — body text (string or node)
 *   confirmLabel — text on the confirm button (default "Confirmar")
 *   cancelLabel  — text on the cancel button (default "Cancelar")
 *   danger       — adds red styling to the confirm button
 *   typeToConfirm — string that must be typed to enable confirm (e.g. "ELIMINAR")
 *   onConfirm    — called when user confirms
 *   onCancel     — called when user cancels / presses Escape
 */
const ConfirmDialogContent = ({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  typeToConfirm,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useFocusTrap(true);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  const canConfirm = typeToConfirm ? typed === typeToConfirm : true;

  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="admin-modal-card confirm-dialog-card"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabIndex={-1}
      >
        <div className={`confirm-dialog-header ${danger ? "danger" : ""}`}>
          <FaExclamationTriangle aria-hidden="true" className="confirm-dialog-icon" />
          <h3 id="confirm-dialog-title">{title}</h3>
        </div>

        <div className="confirm-dialog-body">
          <p id="confirm-dialog-message">{message}</p>

          {typeToConfirm && (
            <div className="confirm-dialog-type-field">
              <label htmlFor="confirm-type-input" className="confirm-dialog-type-label">
                Escribí <strong>{typeToConfirm}</strong> para confirmar:
              </label>
              <input
                id="confirm-type-input"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="settings-input confirm-type-input"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn-neuro-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`admin-primary-btn${danger ? " danger" : ""}${!canConfirm ? " btn-disabled" : ""}`}
            onClick={canConfirm ? onConfirm : undefined}
            disabled={!canConfirm}
            aria-disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmDialog = ({ isOpen, ...props }) => {
  if (!isOpen) return null;

  return <ConfirmDialogContent {...props} />;
};

export default ConfirmDialog;
