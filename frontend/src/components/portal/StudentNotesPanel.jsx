import { useState } from "react";
import { FaRegStickyNote } from "react-icons/fa";
import { useAccionDeModal } from "../../hooks/useAccionDeModal";
import EstadoAccion from "../ui/EstadoAccion";
import "./StudentNotesPanel.css";

const MAXIMO = 500;

/* Notas que el alumno le deja al profesor antes de la clase.
 *
 * El endpoint existía desde hace tiempo y este componente también, pero nunca
 * se montó en ninguna pantalla. Al cablearlo aparecieron cuatro cosas que lo
 * habrían hecho fallar:
 *
 * · La ruta exige el token de gestión y el wrapper de la API no lo mandaba:
 *   401 siempre. Ahora `onGuardar` lo recibe de quien sí lo tiene, porque el
 *   token vive solo en memoria del portal y no se pasea por props de más.
 * · `studentNotes` no venía en el DTO del portal, así que el panel se abría
 *   vacío aunque hubiera una nota guardada, y el primer "Guardar" la borraba.
 * · El id del textarea se armaba con `booking._id`, que ese DTO tampoco trae:
 *   quedaba `notes-undefined`. Con dos turnos abiertos, dos labels con el mismo
 *   id y el label apuntando al textarea equivocado. Ahora usa el código, que es
 *   único por definición.
 * · El estado de guardado no se anunciaba: quien usa lector de pantalla
 *   apretaba "Guardar" y no recibía ninguna señal. Ahora reusa
 *   useAccionDeModal + EstadoAccion, el mismo par que ya usan los modales.
 */
const StudentNotesPanel = ({ booking, onGuardar }) => {
  const [notas, setNotas] = useState(booking.studentNotes ?? "");
  const accion = useAccionDeModal({
    enCurso: "Guardando tu nota…",
    exito: "Nota guardada. El profe la va a ver antes de la clase.",
    erroresPorEstado: {
      400: "Esa nota no se puede guardar: revisá que no pase de 500 caracteres.",
      401: "Se venció el acceso. Volvé a entrar con tu código.",
      403: "Este acceso no corresponde a este turno. Volvé a entrar con tu código.",
    },
  });

  /* Sin useEffect que sincronice el textarea con la prop, a propósito. Lo tuve
     y el linter lo marcó bien: era un setState dentro de un effect, y además
     redundante. Lo que hay en el textarea es un BORRADOR de la persona; el
     único momento en que el valor del servidor cambia para este turno es justo
     después de que este panel lo guardó, y de eso ya se encarga `guardar`.
     Resetear el borrador ante cualquier recarga del historial le borraría lo
     que está escribiendo a alguien que solo reprogramó otro turno. */
  const guardado = booking.studentNotes ?? "";
  const sinCambios = notas.trim() === guardado.trim();
  const idTextarea = `pt-notas-${booking.bookingCode}`;
  const idAyuda = `${idTextarea}-ayuda`;

  const guardar = async () => {
    const { ok } = await accion.ejecutar(() => onGuardar(notas));
    // El padre refresca el historial: así lo que quedó en el servidor y lo que
    // muestra la pantalla vuelven a ser lo mismo.
    if (ok) setNotas(notas.trim());
  };

  return (
    <div className="pt-notas">
      <label className="pt-notas-label" htmlFor={idTextarea}>
        <FaRegStickyNote aria-hidden="true" /> Nota para el profe
      </label>
      <p className="pt-notas-ayuda" id={idAyuda}>
        Contale qué te está costando o qué querés repasar. Lo lee antes de la
        clase y llega preparado.
      </p>
      <textarea
        id={idTextarea}
        className="pt-notas-textarea"
        value={notas}
        onChange={(e) => {
          setNotas(e.target.value);
          // Un mensaje de "guardado" sobre un texto ya editado miente.
          if (!accion.trabajando) accion.reiniciar();
        }}
        maxLength={MAXIMO}
        rows={3}
        aria-describedby={idAyuda}
        placeholder="Ej: no entiendo las identidades trigonométricas y tengo prueba el jueves."
        disabled={accion.trabajando}
      />
      <div className="pt-notas-pie">
        {/* El contador se anuncia solo al terminar de escribir, no letra por
            letra: con aria-live siempre activo, un lector de pantalla leería
            cada pulsación. */}
        <span className="pt-notas-contador">
          {notas.length}/{MAXIMO}
        </span>
        <button
          type="button"
          className="pt-notas-guardar"
          onClick={guardar}
          disabled={accion.trabajando || sinCambios}
        >
          {accion.trabajando ? "Guardando…" : "Guardar nota"}
        </button>
      </div>
      <EstadoAccion
        estado={accion.estado}
        mensaje={accion.mensaje}
        className="pt-notas-estado"
      />
    </div>
  );
};

export default StudentNotesPanel;
