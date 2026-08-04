import Booking from "../models/Booking.js";
import {
  combineMutationGuards,
  withoutActiveManagementLinkRequest,
  withoutActiveNotificationDeliveryFence,
  withoutActiveSlotMutation,
} from "./bookingMutationFenceService.js";

/* Un turno cuyo horario ya pasó terminó su recorrido, se haya confirmado o no.
 *
 * Antes esto filtraba solo `status: "Confirmado"`, y los Pendiente vencidos se
 * acumulaban para siempre. El embudo no tenía salida por ningún lado: nadie
 * podía confirmarlos —el endpoint existía pero ninguna pantalla lo llamaba— y
 * STATUS_TRANSITIONS tampoco permitía Pendiente → Finalizado, así que el
 * profesor no podía cerrarlos ni a mano.
 *
 * Si la persona asistió es OTRA pregunta y tiene su propio campo,
 * `attendanceStatus`, con su enum: Presente, Ausente, No-show, Recuperatorio.
 * El cron no la puede responder y no la toca: queda en "Sin registrar" para que
 * la complete el profesor. Meter eso en `status` sería duplicar el campo. */
const FINALIZABLES = ["Confirmado", "Pendiente"];

export const autoFinalizeBookings = async ({ now = new Date() } = {}) => {
  const result = await Booking.collection.updateMany(
    {
      status: { $in: FINALIZABLES },
      endTime: { $lt: now },
      deletedAt: null,
      pendingAudit: null,
      ...combineMutationGuards(
        withoutActiveSlotMutation(now),
        withoutActiveManagementLinkRequest(now),
        withoutActiveNotificationDeliveryFence(now),
      ),
    },
    {
      $set: { status: "Finalizado", updatedAt: now },
      $inc: { notificationRevision: 1, reminderRevision: 1 },
    },
  );
  return result.modifiedCount || 0;
};
