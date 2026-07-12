import crypto from "node:crypto";

const TOKEN_BYTES = 32;
const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const MANAGEMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const getFrontendUrl = () =>
  String(process.env.FRONTEND_URL || "https://tu-profesor-particular.com").replace(
    /\/$/,
    "",
  );

export const generateManagementToken = () =>
  crypto.randomBytes(TOKEN_BYTES).toString("base64url");

export const hashManagementToken = (token) => {
  if (!MANAGEMENT_TOKEN_PATTERN.test(String(token || ""))) {
    return null;
  }

  return crypto.createHash("sha256").update(token).digest("hex");
};

export const getManagementTokenExpiry = (endTime) =>
  new Date(new Date(endTime).getTime() + TOKEN_LIFETIME_MS);

export const buildManagementUrl = (token) => {
  if (!MANAGEMENT_TOKEN_PATTERN.test(String(token || ""))) {
    return null;
  }

  return `${getFrontendUrl()}/m#token=${token}`;
};

export const issueManagementToken = (booking) => {
  const managementToken = generateManagementToken();
  booking.managementTokenHash = hashManagementToken(managementToken);
  booking.managementTokenExpiresAt = getManagementTokenExpiry(booking.endTime);
  booking.managementTokenRevokedAt = null;

  return {
    managementToken,
    managementUrl: buildManagementUrl(managementToken),
  };
};
