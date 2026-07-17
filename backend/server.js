import "dotenv/config";
import app from "./src/app.js";
import connectDB, { disconnectDB } from "./src/config/db.js";
import { ensureConfiguredAdmin } from "./src/config/adminSeed.js";
import { createReminderRunner, processReminders } from "./src/services/reminderService.js";
import {
  createNotificationOutboxRunner,
  processNotificationOutbox,
} from "./src/services/notificationOutboxService.js";
import { assertNotificationEncryptionConfigured } from "./src/services/notificationPayloadCrypto.js";
import {
  createManagementLinkRequestRunner,
  processBlindManagementLinkRequests,
} from "./src/services/managementLinkRequestService.js";
import { refreshEmailDeliveryHealth } from "./src/config/mailer.js";
import { autoFinalizeBookings } from "./src/services/bookingLifecycleService.js";
import {
  createStudentLinkReconciler,
  processPendingStudentLinks,
} from "./src/services/studentLinkWorker.js";
import {
  createRuntimeScheduler,
  registerPendingAuditReconciliationJob,
  stopRuntimeScheduler,
} from "./src/services/runtimeScheduler.js";
import { reconcilePendingBookingAudits } from "./src/services/auditService.js";
import {
  createRetrySagaRunner,
  reconcileRetrySagas,
} from "./src/controllers/notificationController.js";

const PORT = Number(process.env.PORT || 3000);
const REQUEST_TIMEOUT_MS = Number(process.env.SERVER_REQUEST_TIMEOUT_MS || 15000);
const HEADERS_TIMEOUT_MS = Number(process.env.SERVER_HEADERS_TIMEOUT_MS || 20000);
const KEEP_ALIVE_TIMEOUT_MS = Number(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS || 5000);

let server = null;
let shuttingDown = false;
let notificationOutboxRunner = null;
let managementLinkRequestRunner = null;
const runtimeScheduler = createRuntimeScheduler({ trackReadiness: true });

const logServerBanner = () => {
  console.log("==================================================");
  console.log("AGUSTIN SOSA API - PRO SYSTEM ONLINE");
  console.log(`PORT: ${PORT}`);
  console.log(`HEALTH: http://localhost:${PORT}/health`);
  console.log("==================================================");
};

const closeServer = () =>
  new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.warn(`SERVER: shutdown requested by ${signal}`);

  try {
    const drained = await stopRuntimeScheduler({
      scheduler: runtimeScheduler,
      timeoutMs: 25_000,
    });
    if (!drained) console.warn("WORKER: notification outbox drain timed out; persisted delivery phase will govern recovery.");
    await closeServer();
    await disconnectDB();
    process.exit(exitCode);
  } catch (error) {
    console.error(`SERVER: graceful shutdown failed: ${error.message}`);
    process.exit(1);
  }
};

const connectWithRetry = async (maxAttempts = 5, delayMs = 5000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await connectDB();
      return;
    } catch (error) {
      const isLast = attempt === maxAttempts;
      console.error(
        `DATABASE: connection attempt ${attempt}/${maxAttempts} failed: ${error.message}`,
      );
      if (isLast) throw error;
      console.log(`DATABASE: retrying in ${delayMs / 1000}s…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
};

const launch = async () => {
  assertNotificationEncryptionConfigured();
  // Start listening immediately so Render's health check can reach /health
  // while we attempt the database connection in the background.
  server = app.listen(PORT, () => {
    logServerBanner();
  });
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = Math.max(HEADERS_TIMEOUT_MS, REQUEST_TIMEOUT_MS + 1000);
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;

  const probeEmailDelivery = async () => {
    const health = await refreshEmailDeliveryHealth({ force: true });
    if (!health.configured) {
      console.warn(`EMAIL: SMTP verification is ${health.status}.`);
    }
    return health;
  };
  runtimeScheduler.register({
    name: "SMTP delivery health",
    expression: "*/5 * * * *",
    task: probeEmailDelivery,
    runInitially: true,
  });

  try {
    await connectWithRetry(5, 5000);
    await ensureConfiguredAdmin();

    const reconcileStudentLinks = createStudentLinkReconciler({ processor: async () => {
      try {
        const result = await processPendingStudentLinks();
        if (result.processed) console.log("WORKER: Student links reconciled", result);
        return result;
      } catch (error) {
        console.error("WORKER: Student link reconciliation error:", error.message);
        return { processed: 0, failed: 1 };
      }
    } });
    runtimeScheduler.register({
      name: "Student link reconciliation",
      expression: "* * * * *",
      task: reconcileStudentLinks,
      runInitially: true,
    });

    registerPendingAuditReconciliationJob({
      scheduler: runtimeScheduler,
      reconcile: reconcilePendingBookingAudits,
    });

    // Durable delivery runs frequently; reminder intents themselves are scheduled
    // for exactly 24 hours before each class and survive process restarts.
    notificationOutboxRunner = createNotificationOutboxRunner({
      processor: processNotificationOutbox,
    });
    runtimeScheduler.register({
      name: "notification outbox",
      expression: "* * * * *",
      task: notificationOutboxRunner,
      options: { timezone: "America/Argentina/Buenos_Aires" },
      runInitially: true,
    });

    managementLinkRequestRunner = createManagementLinkRequestRunner({
      processor: processBlindManagementLinkRequests,
    });
    runtimeScheduler.register({
      name: "blind management-link requests",
      expression: "* * * * *",
      task: managementLinkRequestRunner,
      runInitially: true,
    });

    const runReminders = createReminderRunner({ processor: processReminders });
    runtimeScheduler.register({
      name: "reminder intent reconciliation",
      expression: "0 */6 * * *",
      task: async () => {
      console.log("CRON: reconciling durable reminder intents...");
        await runReminders();
      },
      options: { timezone: "America/Argentina/Buenos_Aires" },
      runInitially: true,
    });

    const retrySagaRunner = createRetrySagaRunner({ processor: reconcileRetrySagas });
    runtimeScheduler.register({
      name: "notification retry saga reconciliation",
      expression: "* * * * *",
      task: retrySagaRunner,
      runInitially: true,
    });

    // Hourly: auto-finalize confirmed bookings whose end time has passed
    runtimeScheduler.register({
      name: "booking auto-finalize",
      expression: "0 * * * *",
      task: async () => {
      try {
        const now = new Date();
        const finalized = await autoFinalizeBookings({ now });
        if (finalized > 0) {
          console.log(`CRON: auto-finalized ${finalized} booking(s).`);
        }
      } catch (err) {
        console.error("CRON: auto-finalize job error:", err.message);
      }
      },
    });
    runtimeScheduler.startInitialRuns().catch((error) => {
      console.error(`RUNTIME: initial jobs failed: ${error.message}`);
    });
  } catch (error) {
    // DB connection exhausted all retries. The server stays alive so Render
    // keeps it running — a misconfigured MONGO_URI or a paused Atlas cluster
    // shouldn't take the whole service down. Fix the env var and redeploy.
    console.error("DATABASE: all connection attempts failed:", error.message);
    console.error("SERVER: continuing without database — API will return 503 on data routes.");
  }
};

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
  shutdown("uncaughtException", 1);
});

launch();
