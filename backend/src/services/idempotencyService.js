import crypto from "node:crypto";

const RESPONSE_ENCRYPTION_ALGORITHM = "aes-256-gcm";

const encryptionKey = () => {
  const secret = process.env.IDEMPOTENCY_RESPONSE_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required to protect idempotency responses.");

  return crypto.createHash("sha256").update(secret).digest();
};

export const fingerprintRequest = (payload) =>
  crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

export const encryptIdempotencyResponse = (response) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    RESPONSE_ENCRYPTION_ALGORITHM,
    encryptionKey(),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(response), "utf8"),
    cipher.final(),
  ]);

  return {
    responseCiphertext: ciphertext.toString("base64url"),
    responseIv: iv.toString("base64url"),
    responseAuthTag: cipher.getAuthTag().toString("base64url"),
  };
};

export const decryptIdempotencyResponse = ({
  responseCiphertext,
  responseIv,
  responseAuthTag,
}) => {
  const decipher = crypto.createDecipheriv(
    RESPONSE_ENCRYPTION_ALGORITHM,
    encryptionKey(),
    Buffer.from(responseIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(responseAuthTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(responseCiphertext, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8"));
};
