const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Creates an opaque, cryptographically random key for one mutation attempt.
 * Callers retain the value to safely retry the very same operation.
 */
export const createIdempotencyKey = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Este navegador no puede generar una clave de operación segura.");
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const key = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

  if (!UUID_V4_PATTERN.test(key)) {
    throw new Error("No se pudo generar una clave de operación segura.");
  }

  return key;
};

export const withIdempotencyKey = (idempotencyKey, config = {}) => ({
  ...config,
  headers: {
    ...config.headers,
    "Idempotency-Key": idempotencyKey,
  },
});
