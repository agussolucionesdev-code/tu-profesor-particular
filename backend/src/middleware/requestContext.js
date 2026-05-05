import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const requestContextStorage = new AsyncLocalStorage();

const normalizeRequestId = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  return normalized.slice(0, 100);
};

export const requestContextMiddleware = (req, res, next) => {
  const requestId = normalizeRequestId(req.headers["x-request-id"]) || randomUUID();
  const context = {
    requestId,
    method: req.method,
    path: req.originalUrl,
  };

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  requestContextStorage.run(context, () => next());
};

export const getRequestContext = () => requestContextStorage.getStore() || {};

export const getRequestId = () => getRequestContext().requestId || "unknown-request";
