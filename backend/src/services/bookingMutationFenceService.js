const inactiveLease = (field, expiresField) => ({
  $or: [
    { [field]: null },
    { [field]: { $exists: false } },
    {
      $expr: {
        $lte: [{ $ifNull: [`$${expiresField}`, new Date(0)] }, "$$NOW"],
      },
    },
  ],
});

export const withoutActiveNotificationDeliveryFence = () => ({
  $or: [
    { notificationDeliveryFence: null },
    { notificationDeliveryFence: { $exists: false } },
    {
      $expr: {
        $lte: [
          { $ifNull: ["$notificationDeliveryFence.expiresAt", new Date(0)] },
          "$$NOW",
        ],
      },
    },
  ],
});

export const withoutActiveSlotMutation = () =>
  inactiveLease("slotMutationLock", "slotMutationLockExpiresAt");

export const withoutActiveManagementLinkRequest = () =>
  inactiveLease("managementLinkRequestLock", "managementLinkRequestLockExpiresAt");

export const combineMutationGuards = (...guards) => ({
  $and: guards.filter(Boolean),
});
