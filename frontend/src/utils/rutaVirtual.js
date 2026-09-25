import { BOOKING_FUNNEL_EVENT_NAMES as EVENTOS } from "./bookingFunnel.js";

/* EL EMBUDO DEL KIOSCO COMO PÁGINAS VISTAS.
 *
 * El kiosco emite un evento por cada paso (utils/bookingFunnel.js), pero nadie
 * los escuchaba: no había forma de saber en qué paso abandona la gente. Los
 * eventos a medida de Vercel piden el plan pago; las páginas vistas no. Así
 * que cada paso se registra como una página virtual —la URL real no cambia—:
 *
 *   /reservar            paso 1
 *   /reservar/paso-N     pasos siguientes
 *   /reservar/confirmada la reserva se hizo
 *
 * En el panel de Vercel, «Pages» muestra cuánta gente llega a cada una: ese es
 * el embudo. Devuelve null cuando el evento no cambia de página (errores de
 * validación, el arranque), para no inflar el conteo.
 */
export const RUTA_DE_RESERVA = "/reservar";

export function rutaVirtual(evento) {
  switch (evento?.name) {
    case EVENTOS.STAGE_ADVANCE:
    case EVENTOS.STAGE_BACK: {
      const paso = Number(evento.toStage ?? evento.stage);
      if (!Number.isInteger(paso) || paso < 1) return null;
      return paso === 1 ? RUTA_DE_RESERVA : `${RUTA_DE_RESERVA}/paso-${paso}`;
    }
    case EVENTOS.COMPLETION:
      return `${RUTA_DE_RESERVA}/confirmada`;
    default:
      return null;
  }
}
