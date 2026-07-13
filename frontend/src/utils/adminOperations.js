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
