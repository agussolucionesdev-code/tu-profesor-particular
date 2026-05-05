import jwt from "jsonwebtoken";

const DEV_SECRET = "development-only-change-me";
const JWT_ISSUER = process.env.JWT_ISSUER || "tu-profesor-particular-backend";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "tu-profesor-particular-admin";

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "test") {
    return "test-only-secret-do-not-use-in-production";
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(
      "⚠️  ADVERTENCIA: JWT_SECRET no está configurado. En desarrollo esto puede funcionar, pero en PRODUCCIÓN es OBLIGATORIO configurar JWT_SECRET en las variables de entorno.",
    );
    if (process.env.ALLOW_INSECURE_DEV_FALLBACK === "true") {
      console.warn(
        "⚠️  Usando secreto de desarrollo INSEGURO. Esto SOLO debe usarse para desarrollo local, NUNCA en producción.",
      );
      return DEV_SECRET;
    }
    throw new Error(
      "JWT_SECRET es obligatorio. Para desarrollo local, configurá ALLOW_INSECURE_DEV_FALLBACK=true (solo para testing). Para producción, configurá JWT_SECRET con un valor seguro de al menos 32 caracteres.",
    );
  }

  throw new Error(
    "JWT_SECRET es obligatorio en producción. Configurá esta variable de entorno con un valor seguro de al menos 32 caracteres. Ejemplo: openssl rand -hex 32",
  );
};

export const signAdminToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      role: "admin",
    },
    getJwtSecret(),
    {
      algorithm: "HS256",
      audience: JWT_AUDIENCE,
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      issuer: JWT_ISSUER,
    },
  );

export const verifyAdminToken = (token) =>
  jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
