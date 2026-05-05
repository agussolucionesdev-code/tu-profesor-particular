import "dotenv/config";
import cron from "node-cron";
import app from "./src/app.js";
import connectDB, { disconnectDB } from "./src/config/db.js";
import { ensureConfiguredAdmin } from "./src/config/adminSeed.js";
import { processReminders } from "./src/services/reminderService.js";
import Booking from "./src/models/Booking.js";

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
  // Start listening immediately so Render's health check can reach /health
  // while we attempt the database connection in the background.
  server = app.listen(PORT, () => {
    logServerBanner();
  });
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = Math.max(HEADERS_TIMEOUT_MS, REQUEST_TIMEOUT_MS + 1000);
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;

  try {
    await connectWithRetry(5, 5000);
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

    // Hourly: auto-finalize confirmed bookings whose end time has passed
    cron.schedule("0 * * * *", async () => {
      try {
        const now = new Date();
        const result = await Booking.updateMany(
          { status: "Confirmado", endTime: { $lt: now } },
          { $set: { status: "Finalizado" } },
        );
        if (result.modifiedCount > 0) {
          console.log(`CRON: auto-finalized ${result.modifiedCount} booking(s).`);
        }
      } catch (err) {
        console.error("CRON: auto-finalize job error:", err.message);
      }
    });
    console.log("CRON: auto-finalize scheduled every hour.");
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
