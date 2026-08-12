const BACKEND_ORIGIN = "https://tu-profesor-particular-backend.onrender.com";
const ALLOWED_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);
const REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "idempotency-key",
  "if-match",
  "x-booking-manage-token",
  "x-request-id",
];
const RESPONSE_HEADERS = [
  "content-type",
  "retry-after",
  "x-request-id",
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
];

const firstValue = (value) => (Array.isArray(value) ? value[0] : value);

const normalizeProxyPath = (value) => {
  const path = String(firstValue(value) || "").replace(/^\/+|\/+$/gu, "");

  if (!path || path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }

  return path;
};

const copyQuery = (query, target) => {
  for (const [key, rawValue] of Object.entries(query || {})) {
    if (key === "__proxy_path" || rawValue === undefined) continue;

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) target.searchParams.append(key, String(value));
  }
};

const requestHeaders = (req) => {
  const headers = new Headers();

  for (const name of REQUEST_HEADERS) {
    const value = req.headers?.[name];
    if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
  }

  // Vercel genera este encabezado y no depende del Origin enviado por el
  // navegador. Mantenerlo permite que el rate limit del backend distinga a
  // cada visitante aunque todos entren a través de esta función.
  const clientIp = req.headers?.["x-vercel-forwarded-for"];
  if (clientIp) headers.set("x-forwarded-for", firstValue(clientIp));

  return headers;
};

const requestBody = (req) => {
  if (["GET", "HEAD"].includes(req.method)) return undefined;
  if (req.body === undefined || req.body === null) return undefined;
  return typeof req.body === "string" ? req.body : JSON.stringify(req.body);
};

const applyResponseHeaders = (upstream, res) => {
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  res.setHeader("Cache-Control", "no-store");
};

export default async function previewProxy(req, res) {
  const method = String(req.method || "GET").toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    res.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  if (method === "OPTIONS") return res.status(204).end();

  const proxyPath = normalizeProxyPath(req.query?.__proxy_path);
  if (!proxyPath || proxyPath === "preview-proxy") {
    return res.status(404).json({ success: false, message: "Resource not found." });
  }

  const target = new URL(`/api/${proxyPath}`, BACKEND_ORIGIN);
  copyQuery(req.query, target);

  try {
    const upstream = await fetch(target, {
      method,
      headers: requestHeaders(req),
      body: requestBody(req),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });

    applyResponseHeaders(upstream, res);
    const payload = method === "HEAD" ? "" : await upstream.text();
    return res.status(upstream.status).send(payload);
  } catch {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      success: false,
      message: "No pudimos comunicarnos con el servicio de turnos. Intentá nuevamente.",
    });
  }
}
