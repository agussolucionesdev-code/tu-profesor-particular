export const getSafeManagementUrl = (
  value,
  baseUrl = globalThis.location?.origin ||
    "https://turnos.tuprofesorparticular.com.ar",
) => {
  if (!value) return null;

  // A misconfigured allow-list can still be parsed by URL as a bizarre host
  // plus path. Reject list separators before parsing so it never becomes a
  // navigable-but-broken link.
  if (String(value).includes(",")) return null;

  try {
    const parsed = new URL(value, baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
};
