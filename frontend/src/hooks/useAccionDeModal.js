import { useCallback, useRef, useState } from "react";

/* Ciclo de vida de una acción dentro de un modal: quieta → trabajando → salió
   bien o falló.

   Existe porque cada modal lo resolvía a su manera, y varios ni siquiera lo
   resolvían. CancelModal, por ejemplo, envolvía la llamada en try/finally SIN
   catch: si la red se caía o el servidor rechazaba, el error se propagaba, el
   botón volvía a su estado normal y la persona quedaba sin saber si su turno
   se había cancelado o no. En una acción que no se puede deshacer, ese silencio
   es lo peor que puede pasar.

   Devuelve además el texto de lo que está ocurriendo, para anunciarlo por
   aria-live: quien no ve la pantalla también tiene que enterarse de que algo
   está en curso, y de cómo terminó. */

export const ESTADO = {
  QUIETA: "quieta",
  TRABAJANDO: "trabajando",
  OK: "ok",
  ERROR: "error",
};

const MENSAJE_ERROR_GENERICO =
  "No pudimos completar la acción. Revisá tu conexión y probá de nuevo.";

/* Traduce la respuesta del servidor a algo que se entienda. Un 409 en una
   reserva no es "error 409": es que alguien tomó ese horario. */
const mensajeDeError = (error, porEstado = {}) => {
  const status = error?.response?.status;
  if (status && porEstado[status]) return porEstado[status];
  const delServidor = error?.response?.data?.message;
  if (typeof delServidor === "string" && delServidor.trim().length > 3) {
    return delServidor.trim();
  }
  if (error?.code === "ECONNABORTED") {
    return "La conexión tardó demasiado. Probá de nuevo en un momento.";
  }
  return MENSAJE_ERROR_GENERICO;
};

export const useAccionDeModal = ({
  enCurso = "Procesando…",
  exito = "Listo.",
  erroresPorEstado = {},
} = {}) => {
  const [estado, setEstado] = useState(ESTADO.QUIETA);
  const [mensaje, setMensaje] = useState("");
  /* Ref además del estado: dos clics rápidos en "Confirmar" entran antes de
     que React vuelva a renderizar, y el segundo pasaría el chequeo. Con una
     acción que cobra o cancela, eso es una operación duplicada. */
  const corriendoRef = useRef(false);

  const ejecutar = useCallback(
    async (accion) => {
      if (corriendoRef.current) return { ok: false, duplicada: true };
      corriendoRef.current = true;
      setEstado(ESTADO.TRABAJANDO);
      setMensaje(enCurso);
      try {
        const resultado = await accion();
        setEstado(ESTADO.OK);
        setMensaje(exito);
        return { ok: true, resultado };
      } catch (error) {
        setEstado(ESTADO.ERROR);
        setMensaje(mensajeDeError(error, erroresPorEstado));
        return { ok: false, error };
      } finally {
        corriendoRef.current = false;
      }
    },
    [enCurso, exito, erroresPorEstado],
  );

  const reiniciar = useCallback(() => {
    setEstado(ESTADO.QUIETA);
    setMensaje("");
  }, []);

  return {
    estado,
    mensaje,
    ejecutar,
    reiniciar,
    trabajando: estado === ESTADO.TRABAJANDO,
    fallo: estado === ESTADO.ERROR,
    salioBien: estado === ESTADO.OK,
  };
};

export default useAccionDeModal;
