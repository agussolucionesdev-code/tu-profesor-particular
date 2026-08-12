export const DEFAULT_PUBLIC_FRONTEND_URL =
  "https://turnos.tuprofesorparticular.com.ar";

const normalizeCandidate = (value) => {
  const candidate = String(value || "").trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;

    return parsed.origin;
  } catch {
    return null;
  }
};

export const getPublicFrontendUrl = (
  rawValue = process.env.FRONTEND_URL,
  fallback = DEFAULT_PUBLIC_FRONTEND_URL,
) => {
  // CORS accepts a comma-separated allow-list, but public links need exactly
  // one origin. Pick the first valid entry instead of embedding the full list.
  for (const candidate of String(rawValue || "").split(",")) {
    const normalized = normalizeCandidate(candidate);
    if (normalized) return normalized;
  }

  return normalizeCandidate(fallback) || DEFAULT_PUBLIC_FRONTEND_URL;
};
