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
