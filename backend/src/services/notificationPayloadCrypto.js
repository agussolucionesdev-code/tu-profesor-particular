import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;

const parseKeyring = () => {
  const raw = String(process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS || "").trim();
  const activeVersion = String(
    process.env.NOTIFICATION_OUTBOX_ACTIVE_KEY_VERSION || "",
  ).trim();
  if (!raw || !VERSION_PATTERN.test(activeVersion)) {
    throw new Error("Notification outbox encryption keyring is not configured.");
  }
  const keys = new Map();
  for (const entry of raw.split(",")) {
    const separator = entry.indexOf(":");
    const version = entry.slice(0, separator).trim();
    const encoded = entry.slice(separator + 1).trim();
    if (separator < 1 || !VERSION_PATTERN.test(version) || keys.has(version)) {
      throw new Error("Notification outbox encryption keyring is invalid.");
    }
    let key;
    try {
      key = Buffer.from(encoded, "base64url");
    } catch {
      throw new Error("Notification outbox encryption keyring is invalid.");
    }
    if (key.length !== 32 || key.toString("base64url") !== encoded.replace(/=+$/u, "")) {
      throw new Error("Notification outbox encryption keys must contain exactly 32 bytes.");
    }
    keys.set(version, key);
  }
  if (!keys.has(activeVersion)) {
    throw new Error("Notification outbox active encryption key is missing.");
  }
  return { keys, activeVersion };
};

const aadFor = (version, dedupeKey) =>
  Buffer.from(`notification-outbox:${version}:${dedupeKey}`, "utf8");

const blindRequestAadFor = (version, requestKey) =>
  Buffer.from(`management-link-request:${version}:${requestKey}`, "utf8");

export const assertNotificationEncryptionConfigured = () => {
  const { activeVersion } = parseKeyring();
  return { configured: true, activeVersion };
};

export const getNotificationEncryptionHealth = () => {
  try {
    return assertNotificationEncryptionConfigured();
  } catch {
    return { configured: false, activeVersion: null };
  }
};

export const encryptNotificationPayload = (payload, dedupeKey) => {
  const { keys, activeVersion } = parseKeyring();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, keys.get(activeVersion), iv);
  cipher.setAAD(aadFor(activeVersion, dedupeKey));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return {
    payloadCiphertext: ciphertext.toString("base64url"),
    payloadIv: iv.toString("base64url"),
    payloadAuthTag: cipher.getAuthTag().toString("base64url"),
    encryptionKeyVersion: activeVersion,
  };
};

export const decryptNotificationPayload = (record) => {
  const { keys } = parseKeyring();
  const version = String(record.encryptionKeyVersion || "");
  const key = keys.get(version);
  if (!key) throw new Error("Notification payload encryption key is unavailable.");
  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(record.payloadIv, "base64url"),
    );
    decipher.setAAD(aadFor(version, record.dedupeKey));
    decipher.setAuthTag(Buffer.from(record.payloadAuthTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(record.payloadCiphertext, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new Error("Notification payload authentication failed.");
  }
};

export const protectManagementLinkRequest = (payload, requestKey) => {
  const { keys, activeVersion } = parseKeyring();
  const key = keys.get(activeVersion);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(blindRequestAadFor(activeVersion, requestKey));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const lookup = (value) => crypto
    .createHmac("sha256", key)
    .update(`management-link-lookup:${String(value)}`, "utf8")
    .digest("hex");
  return {
    bookingCodeLookup: lookup(payload.bookingCode),
    emailLookup: lookup(payload.email),
    payloadCiphertext: ciphertext.toString("base64url"),
    payloadIv: iv.toString("base64url"),
    payloadAuthTag: cipher.getAuthTag().toString("base64url"),
    encryptionKeyVersion: activeVersion,
  };
};

export const managementLinkRequestLookupHashes = ({ bookingCode, email }, keyVersion = null) => {
  const { keys, activeVersion } = parseKeyring();
  const key = keys.get(keyVersion || activeVersion);
  if (!key) throw new Error("Management-link lookup key is unavailable.");
  const lookup = (value) => crypto
    .createHmac("sha256", key)
    .update(`management-link-lookup:${String(value)}`, "utf8")
    .digest("hex");
  return {
    bookingCodeLookup: lookup(bookingCode),
    emailLookup: lookup(email),
  };
};

export const unprotectManagementLinkRequest = (record) => {
  const { keys } = parseKeyring();
  const version = String(record.encryptionKeyVersion || "");
  const key = keys.get(version);
  if (!key) throw new Error("Management-link request encryption key is unavailable.");
  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(record.payloadIv, "base64url"),
    );
    decipher.setAAD(blindRequestAadFor(version, record.requestKey));
    decipher.setAuthTag(Buffer.from(record.payloadAuthTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(record.payloadCiphertext, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new Error("Management-link request authentication failed.");
  }
};
