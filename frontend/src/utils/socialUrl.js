const GENERIC_SOCIAL_HOSTS = ["facebook.com", "instagram.com", "linkedin.com"];

const isKnownSocialHost = (hostname) =>
  GENERIC_SOCIAL_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );

export const isConfiguredSocialUrl = (href) => {
  if (typeof href !== "string" || href.trim() === "") return false;

  try {
    const url = new URL(href);

    if (url.protocol !== "https:" && url.protocol !== "http:") return false;

    if (isKnownSocialHost(url.hostname.toLowerCase()) && url.pathname === "/") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};
