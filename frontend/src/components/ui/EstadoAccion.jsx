import { FaCheckCircle, FaExclamationCircle, FaSpinner } from "react-icons/fa";
import { ESTADO } from "../../hooks/useAccionDeModal";
import "./EstadoAccion.css";

/* La franja que cuenta en qué paso va la acción del modal.

   Va con aria-live para que también se escuche: "Cancelando tu turno…" y
   después "Tu turno quedó cancelado". Sin esto, quien usa lector de pantalla
   apretaba Confirmar y no recibía ninguna señal de que algo estaba pasando.

   role cambia según el caso: `status` (aria-live polite) mientras trabaja y
   cuando sale bien, porque no hay que interrumpir; `alert` (assertive) cuando
   falla, porque ahí sí hay que enterarse ya. */
const EstadoAccion = ({ estado, mensaje, className = "" }) => {
  if (estado === ESTADO.QUIETA || !mensaje) return null;

  const esError = estado === ESTADO.ERROR;
  const Icono =
    estado === ESTADO.TRABAJANDO
      ? FaSpinner
      : esError
        ? FaExclamationCircle
        : FaCheckCircle;

  return (
    <p
      className={`ea ea--${estado} ${className}`.trim()}
      role={esError ? "alert" : "status"}
      aria-live={esError ? "assertive" : "polite"}
    >
      <Icono
        className={estado === ESTADO.TRABAJANDO ? "ea-icono ea-gira" : "ea-icono"}
        aria-hidden="true"
      />
      <span>{mensaje}</span>
    </p>
  );
};

export default EstadoAccion;
