/**
 * Shared frontend constants — single source of truth.
 * These values must stay in sync with the backend's bookingRules.js.
 */

export const ADULT_RELATIONSHIP_VALUE = "self";
export const RESPONSIBLE_RELATIONSHIP_OTHER_VALUE = "otro";

export const BOOKING_STATUS = {
  CONFIRMED: "Confirmado",
  PENDING: "Pendiente",
  CANCELLED: "Cancelado",
  FINALIZED: "Finalizado",
};
