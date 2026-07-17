import Booking from "../models/Booking.js";
import {
  combineMutationGuards,
  withoutActiveManagementLinkRequest,
  withoutActiveNotificationDeliveryFence,
  withoutActiveSlotMutation,
} from "./bookingMutationFenceService.js";

export const autoFinalizeBookings = async ({ now = new Date() } = {}) => {
  const result = await Booking.collection.updateMany(
    {
      status: "Confirmado",
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
