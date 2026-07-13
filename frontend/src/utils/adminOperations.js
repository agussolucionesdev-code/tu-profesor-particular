export const createSingleFlight = () => {
  let activeRequest = null;

  return {
    run(task) {
      if (activeRequest) return activeRequest;

      try {
        activeRequest = Promise.resolve(task());
      } catch (error) {
        activeRequest = Promise.reject(error);
      }
      activeRequest = activeRequest.finally(() => {
        activeRequest = null;
      });

      return activeRequest;
    },
  };
};

const operationError = (result) => {
  if (result === false) return "No se pudo completar la acción.";
  if (result?.ok === false) {
    return result.error || result.message || "No se pudo completar la acción.";
  }
  return "";
};

export const runBulkOperation = async (ids, operation) => {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const result = await operation(id);
        const error = operationError(result);
        return error ? { id, ok: false, error } : { id, ok: true };
      } catch (error) {
        return {
          id,
          ok: false,
          error: error?.message || "No se pudo completar la acción.",
        };
      }
    }),
  );

  return {
    results,
    succeededIds: results.filter((result) => result.ok).map(({ id }) => id),
    failedIds: results.filter((result) => !result.ok).map(({ id }) => id),
  };
};

export const ariaSortValue = (activeKey, columnKey, direction) => {
  if (activeKey !== columnKey) return "none";
  return direction === "asc" ? "ascending" : "descending";
};

const invalidCanonicalBooking = (detail) =>
  new TypeError(`La reserva canónica no es válida: ${detail}.`);

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const CANONICAL_BOOKING_STATUSES = new Set([
  "Pendiente",
  "Confirmado",
  "Finalizado",
  "Cancelado",
]);

const dateValueTimestamp = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" && value.trim().length > 0) {
    return Date.parse(value);
  }
  return Number.NaN;
};

export const normalizeCanonicalBooking = (id, canonicalBooking) => {
  if (!isNonEmptyString(id)) {
    throw invalidCanonicalBooking("el identificador solicitado es inválido");
  }

  if (
    !canonicalBooking ||
    typeof canonicalBooking !== "object" ||
    Array.isArray(canonicalBooking)
  ) {
    throw invalidCanonicalBooking("la respuesta no contiene un objeto");
  }

  const hasIdentifier = Object.prototype.hasOwnProperty.call(
    canonicalBooking,
    "_id",
  );
  if (hasIdentifier && !isNonEmptyString(canonicalBooking._id)) {
    throw invalidCanonicalBooking("el identificador es inválido");
  }
  if (hasIdentifier && canonicalBooking._id !== id) {
    throw invalidCanonicalBooking("el identificador no coincide");
  }

  for (const field of ["bookingCode", "studentName"]) {
    if (!isNonEmptyString(canonicalBooking[field])) {
      throw invalidCanonicalBooking(`el campo ${field} es inválido`);
    }
  }

  if (!CANONICAL_BOOKING_STATUSES.has(canonicalBooking.status)) {
    throw invalidCanonicalBooking("el estado es inválido");
  }

  const startTimestamp = dateValueTimestamp(canonicalBooking.timeSlot);
  const endTimestamp = dateValueTimestamp(canonicalBooking.endTime);
  if (Number.isNaN(startTimestamp)) {
    throw invalidCanonicalBooking("el campo timeSlot no es una fecha válida");
  }
  if (Number.isNaN(endTimestamp)) {
    throw invalidCanonicalBooking("el campo endTime no es una fecha válida");
  }
  if (endTimestamp <= startTimestamp) {
    throw invalidCanonicalBooking("endTime debe ser posterior a timeSlot");
  }

  if (
    typeof canonicalBooking.duration !== "number" ||
    !Number.isFinite(canonicalBooking.duration) ||
    canonicalBooking.duration < 0.5 ||
    canonicalBooking.duration > 10
  ) {
    throw invalidCanonicalBooking("la duración es inválida");
  }

  return hasIdentifier ? canonicalBooking : { ...canonicalBooking, _id: id };
};

export const replaceBookingWithCanonical = (
  bookings,
  id,
  canonicalBooking,
) => {
  const normalizedBooking = normalizeCanonicalBooking(id, canonicalBooking);

  return bookings.map((booking) =>
    booking._id === id ? normalizedBooking : booking,
  );
};
