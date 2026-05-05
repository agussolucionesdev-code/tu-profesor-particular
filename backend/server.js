import "dotenv/config";
import cron from "node-cron";
import app from "./src/app.js";
import connectDB, { disconnectDB } from "./src/config/db.js";
import { ensureConfiguredAdmin } from "./src/config/adminSeed.js";
import { processReminders } from "./src/services/reminderService.js";

const PORT = Number(process.env.PORT || 3000);
const REQUEST_TIMEOUT_MS = Number(process.env.SERVER_REQUEST_TIMEOUT_MS || 15000);
const HEADERS_TIMEOUT_MS = Number(process.env.SERVER_HEADERS_TIMEOUT_MS || 20000);
const KEEP_ALIVE_TIMEOUT_MS = Number(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS || 5000);

let server = null;
let shuttingDown = false;

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
    await closeServer();
    await disconnectDB();
    process.exit(exitCode);
  } catch (error) {
    console.error(`SERVER: graceful shutdown failed: ${error.message}`);
    process.exit(1);
  }
};

const launch = async () => {
  try {
    await connectDB();
    await ensureConfiguredAdmin();

    // Daily reminder: runs at 09:00 AM local time.
    // Finds confirmed bookings with email that start 20–28 hours from now
    // and sends a "tu clase es mañana" notification.
    cron.schedule("0 9 * * *", async () => {
      console.log("CRON: running daily reminder check...");
      try {
        await processReminders();
      } catch (err) {
        console.error("CRON: reminder job error:", err.message);
      }
    });
    console.log("CRON: daily reminder scheduled for 09:00 AM.");

    server = app.listen(PORT, () => {
      logServerBanner();
    });

    server.requestTimeout = REQUEST_TIMEOUT_MS;
    server.headersTimeout = Math.max(HEADERS_TIMEOUT_MS, REQUEST_TIMEOUT_MS + 1000);
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  } catch (error) {
    console.error("CRITICAL ERROR during launch:", error.message);
    process.exit(1);
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
