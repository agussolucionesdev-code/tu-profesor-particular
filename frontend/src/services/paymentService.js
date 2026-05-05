/**
 * Payment service abstraction.
 *
 * Current implementation: manual (WhatsApp-based notification).
 * Future: Mercado Pago SDK integration.
 *
 * To integrate Mercado Pago:
 *   1. Change PAYMENT_METHOD to "mercadopago"
 *   2. Implement buildPaymentLink() with real preference ID from backend
 *   3. Update the backend to expose POST /api/payments/preference
 */

export const PAYMENT_METHOD = "manual"; // future: "mercadopago"

/**
 * Returns a Mercado Pago payment link for a booking.
 * Currently returns null — wires up gracefully when PAYMENT_METHOD is "mercadopago".
 *
 * @param {object} booking - The booking object
 * @returns {string|null} The payment URL or null if not yet integrated
 */
export const buildPaymentLink = (booking) => {
  if (PAYMENT_METHOD !== "mercadopago") {
    return null;
  }

  const externalRef = booking.bookingCode;
  const description = `Clase particular - ${booking.studentName} - ${booking.subject}`;
  const backUrl = typeof window !== "undefined" ? window.location.origin : "";

  return `https://www.mercadopago.com.ar/checkout/v1/redirect?external_reference=${externalRef}&description=${encodeURIComponent(description)}&back_url=${encodeURIComponent(backUrl)}`;
};

/**
 * Builds a WhatsApp message for manual payment coordination.
 *
 * @param {object} booking - The booking object
 * @returns {string} The pre-filled WhatsApp message
 */
export const buildWhatsAppPaymentMessage = (booking) => {
  const name = booking.studentName || "Alumno";
  const subject = booking.subject || "Clase";
  const amount = booking.price || 0;
  return `Hola ${name}, soy Agustín Sosa. Te escribo por el pago de la clase de ${subject}. El valor es $${amount}.`;
};
