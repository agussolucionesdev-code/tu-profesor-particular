import rateLimit from "express-rate-limit";

const parseLimit = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildRateLimitHandler =
  (message) =>
  (req, res) => {
    res.status(429).json({
      success: false,
      message,
      requestId: req.requestId,
    });
  };

const createLimiter = ({
  limit,
  windowMs = 15 * 60 * 1000,
  message,
  skip,
  skipSuccessfulRequests = false,
}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    skipSuccessfulRequests,
    handler: buildRateLimitHandler(message),
  });

export const globalApiLimiter = createLimiter({
  limit: parseLimit(process.env.RATE_LIMIT_MAX, 200),
  message: "Demasiadas solicitudes en poco tiempo. Intenta de nuevo en unos minutos.",
  skip: (req) => req.path === "/health",
});

export const authLimiter = createLimiter({
  limit: parseLimit(process.env.AUTH_RATE_LIMIT_MAX, 10),
  message: "Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo otra vez.",
  skipSuccessfulRequests: true,
});

export const publicLookupLimiter = createLimiter({
  limit: parseLimit(process.env.PUBLIC_LOOKUP_RATE_LIMIT_MAX, 40),
  message: "Hiciste demasiadas búsquedas seguidas. Espera un momento antes de volver a intentar.",
});

export const publicMutationLimiter = createLimiter({
  limit: parseLimit(process.env.PUBLIC_MUTATION_RATE_LIMIT_MAX, 30),
  message: "Superaste el límite temporal para gestionar turnos. Espera un momento e inténtalo de nuevo.",
});

/* Entrada al portal con código y dato de contacto.
   Este límite es más bajo que el resto a propósito: es el único punto donde se
   pueden probar credenciales públicas a ciegas. Ocho intentos por ventana dan
   margen para corregir errores humanos sin habilitar búsquedas automatizadas.
   `skipSuccessfulRequests` hace que entrar bien no gaste intentos. */
export const portalSessionLimiter = createLimiter({
  limit: parseLimit(process.env.PORTAL_SESSION_RATE_LIMIT_MAX, 8),
  message:
    "Demasiados intentos seguidos. Esperá unos minutos y volvé a probar.",
  skipSuccessfulRequests: true,
});

/* Formulario de contacto.
   Más bajo que el resto porque cada envío exitoso manda un email, y un email
   que sale del servidor y llega a una casilla real es la única cosa de esta API
   que un abuso puede convertir en un problema con Gmail. Cinco por ventana deja
   escribir, corregir y reenviar sin trabas; nadie manda cinco consultas
   distintas en minutos.
   Acá NO se usa skipSuccessfulRequests: el costo está justamente en el envío
   exitoso, así que los que cuentan son esos. */
export const contactLimiter = createLimiter({
  limit: parseLimit(process.env.CONTACT_RATE_LIMIT_MAX, 5),
  message:
    "Ya enviaste varias consultas seguidas. Esperá unos minutos o escribinos por WhatsApp.",
});
