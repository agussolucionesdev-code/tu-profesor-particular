import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { getDbConnectionMeta } from "./config/db.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import blockedDatesRoutes from "./routes/blockedDatesRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { getRuntimeSchedulerHealth } from "./services/runtimeScheduler.js";
import { globalApiLimiter } from "./middleware/rateLimiters.js";
import { requestContextMiddleware } from "./middleware/requestContext.js";
import { getNotificationEncryptionHealth } from "./services/notificationPayloadCrypto.js";
import { getEmailDeliveryHealth } from "./config/mailer.js";

if (process.env.NODE_ENV !== "test") {
  dotenv.config();
}

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const MAX_JSON_BODY_SIZE = "50kb";

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/$/, "");
const isLoopbackOrigin = (origin) => {
  try {
    const { protocol, hostname } = new URL(origin);

    return (
      /^https?:$/.test(protocol) &&
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)
    );
  } catch {
    return false;
  }
};
const parseTrustProxy = (value) => {
  if (value === undefined || value === null || value === "") {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }

  if (value === "true") return true;
  if (value === "false") return false;

  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? value : numericValue;
};
const getDbHealth = () => {
  const stateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  const readyState = mongoose.connection.readyState;

  return {
    readyState,
    state: stateMap[readyState] || "unknown",
    isConnected: readyState === 1,
  };
};
const configuredOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const defaultDevOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:4174",
  "http://127.0.0.1:4174",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const allowedOrigins = [
  ...new Set([...configuredOrigins, ...(isProduction ? [] : defaultDevOrigins)]),
];
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
const isDevelopmentLoopback = !isProduction;

if (trustProxy !== false) {
  app.set("trust proxy", trustProxy);
}

app.disable("x-powered-by");

app.use(requestContextMiddleware);
app.use(
  helmet({
    referrerPolicy: { policy: "no-referrer" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          ...configuredOrigins,
          ...(isProduction ? [] : defaultDevOrigins),
        ].filter(Boolean),
      },
    },
    strictTransportSecurity: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin);

      if (
        !origin ||
        allowedOrigins.includes(normalizedOrigin) ||
        (isDevelopmentLoopback && isLoopbackOrigin(origin))
      ) {
        return callback(null, true);
      }
      const corsError = new Error("Origin not allowed by CORS");
      corsError.statusCode = 403;
      corsError.expose = true;
      return callback(corsError);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "X-Booking-Manage-Token",
      "Idempotency-Key",
    ],
    maxAge: 60 * 60 * 12,
  }),
);
app.use(express.json({ limit: MAX_JSON_BODY_SIZE, strict: true }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// PERF: To prevent Render free-tier cold starts (30-60 s), configure an
// external uptime monitor (e.g. UptimeRobot — https://uptimerobot.com) to
// ping GET /health every 14 minutes. This keeps the dyno warm at zero cost.
app.get("/health", (req, res) => {
  const dbHealth = getDbHealth();
  const dbMeta = getDbConnectionMeta();
  const notificationEncryption = getNotificationEncryptionHealth();

  // Always return 200 so Render's health check passes even while DB is
  // still connecting. DB health is visible in the response body.
  res.status(200).json({
    status: dbHealth.isConnected ? "success" : "starting",
    message: "Agustin Sosa Pro-API is operational",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    database: {
      ...dbHealth,
      driver: dbMeta.driver,
      persistent: dbMeta.persistent,
      mode: dbMeta.mode,
      source: dbMeta.source,
      target: dbMeta.target,
    },
    notifications: notificationEncryption,
  });
});

app.get("/live", (req, res) => {
  res.status(200).json({
    status: "success",
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

app.get("/ready", (req, res) => {
  const database = getDbHealth();
  const notifications = getNotificationEncryptionHealth();
  const email = getEmailDeliveryHealth();
  const workers = getRuntimeSchedulerHealth();
  const ready = database.isConnected && notifications.configured && email.configured &&
    (!workers.required || workers.registrationsComplete);
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    database,
    notifications,
    email,
    workers,
  });
});

// Infrastructure probes must never consume or be rejected by the public API
// budget. The limiter protects application routes only.
app.use(globalApiLimiter);
app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/blocked-dates", blockedDatesRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "The requested resource was not found on this server.",
    requestId: req.requestId,
  });
});

// El cuarto parámetro es lo que hace que Express registre esto como manejador
// de errores: detecta la aridad de la función. No se usa, pero no se puede
// borrar — de ahí el guion bajo.
app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const expose = err.expose ?? statusCode < 500;
  const requestId = req.requestId || "unknown-request";
  const payload = {
    success: false,
    message: expose ? err.message || "Request failed." : "Internal Server Error",
    requestId,
  };

  console.error(`[SYSTEM ERROR] [${requestId}]`, err);

  if (process.env.NODE_ENV === "development") {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
});

export default app;
