import { useEffect, useState } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { FaExclamationTriangle } from "react-icons/fa";
import { useAccionDeModal } from "../../hooks/useAccionDeModal";
import EstadoAccion from "./EstadoAccion";

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

  /* El diálogo pasa a hacerse cargo del resultado. Antes llamaba a onConfirm
     sin esperarlo: los dos usos que tiene son borrados, y ambos mostraban el
     error FUERA, en un párrafo suelto que aparecía cuando el diálogo ya se
     había cerrado. Se confirmaba un borrado, la ventana desaparecía, y el
     fallo quedaba abajo en la página.

     Si onConfirm devuelve una promesa, acá se ve el progreso y el diálogo no
     se cierra si falla —así se puede reintentar sin volver a empezar—. Si no
     devuelve nada, se comporta igual que antes. */
  const accion = useAccionDeModal({
    enCurso: "Procesando…",
    exito: "Listo.",
    erroresPorEstado: {
      401: "Tu sesión venció. Volvé a iniciar sesión e intentá de nuevo.",
      403: "No tenés permiso para hacer esto.",
      404: "El elemento ya no existe. Puede que lo hayan borrado antes.",
      409: "Alguien más lo modificó mientras tanto. Recargá y probá otra vez.",
    },
  });

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !accion.trabajando) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel, accion.trabajando]);

  const canConfirm =
    (typeToConfirm ? typed === typeToConfirm : true) && !accion.trabajando;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    const r = await accion.ejecutar(async () => onConfirm?.());
    /* Sólo se cierra si salió bien. Si falló, el diálogo queda abierto con el
       motivo a la vista y el botón dice "Reintentar". */
    if (r.ok) onCancel?.();
  };

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
                disabled={accion.trabajando}
              />
            </div>
          )}

          <EstadoAccion estado={accion.estado} mensaje={accion.mensaje} />
        </div>

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn-neuro-secondary"
            onClick={onCancel}
            disabled={accion.trabajando}
          >
            {accion.fallo ? "Cerrar" : cancelLabel}
          </button>
          <button
            type="button"
            className={`admin-primary-btn${danger ? " danger" : ""}${!canConfirm ? " btn-disabled" : ""}`}
            onClick={handleConfirm}
            disabled={!canConfirm}
            aria-disabled={!canConfirm}
          >
            {accion.trabajando
              ? "Procesando…"
              : accion.fallo
                ? "Reintentar"
                : confirmLabel}
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
