/**
 * localMongod.js — manages an embedded mongod process for persistent local storage.
 *
 * Uses the mongod binary bundled by mongodb-memory-server (already in node_modules cache)
 * and starts it with wiredTiger + a fixed dbPath so data survives server restarts.
 *
 * Only runs in non-production environments and only when USE_LOCAL_MONGOD=true or
 * when called explicitly by db.js as a fallback target.
 */

import { spawn } from "child_process";
import { createRequire } from "module";
import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export const LOCAL_MONGOD_PORT = parseInt(
  process.env.LOCAL_MONGOD_PORT || "27099",
  10,
);

const DATA_DIR = path.resolve(__dirname, "../../.mongodb-local");
const LOG_PATH = path.join(DATA_DIR, "mongod.log");
const LOCK_PATH = path.join(DATA_DIR, "mongod.lock");
const STARTUP_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 300;

let mongodProcess = null;
let startPromise = null;

const isPortOpen = (port, host = "127.0.0.1") =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket
      .once("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .once("timeout", () => {
        socket.destroy();
        resolve(false);
      })
      .once("error", () => {
        socket.destroy();
        resolve(false);
      })
      .connect(port, host);
  });

const waitForPort = (port, timeoutMs) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const poll = async () => {
      if (await isPortOpen(port)) {
        resolve();
        return;
      }

      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for port ${port} to open.`));
        return;
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
  });

const scoreMongoVersion = (filename) => {
  // Prefer MongoDB 6.x (stable, AVX2-free) over 7.x, 8.x on older CPUs.
  // Returns a numeric score — lower is better.
  const match = filename.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return 999;
  const major = parseInt(match[1], 10);
  // 6.x gets score 0, 7.x gets 1, 5.x gets 2, others get 10 + major
  if (major === 6) return 0;
  if (major === 7) return 1;
  if (major === 5) return 2;
  return 10 + major;
};

const findMongodBinary = () => {
  // Build candidate cache directories (searched in order)
  const homedir = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    // User-level cache (where older versions land on Windows)
    path.join(homedir, ".cache/mongodb-binaries"),
    // npm project-level cache
    path.join(process.cwd(), "node_modules/.cache/mongodb-memory-server"),
    path.join(__dirname, "../../node_modules/.cache/mongodb-memory-server"),
  ];

  // Also resolve via require
  try {
    const corePkg = require.resolve("mongodb-memory-server-core/package.json");
    const nodeModulesDir = path.dirname(path.dirname(corePkg));
    candidates.push(path.join(nodeModulesDir, ".cache/mongodb-memory-server"));
  } catch {
    // ignore
  }

  const allExes = [];

  for (const cacheDir of candidates) {
    if (!fs.existsSync(cacheDir)) continue;

    try {
      const files = fs.readdirSync(cacheDir);
      const exes = files.filter(
        (f) =>
          /^mongod/i.test(f) &&
          !f.endsWith(".mdmp") &&
          (f.endsWith(".exe") || !f.includes(".")),
      );
      for (const f of exes) {
        allExes.push({ full: path.join(cacheDir, f), name: f });
      }
    } catch {
      // ignore
    }
  }

  if (allExes.length === 0) return null;

  // Sort: prefer lower-version binaries (safer on older CPUs)
  allExes.sort((a, b) => scoreMongoVersion(a.name) - scoreMongoVersion(b.name));

  return allExes[0].full;
};

const removeStaleLock = () => {
  if (!fs.existsSync(LOCK_PATH)) return;

  try {
    // We own and manage this mongod process, so it's always safe to remove
    // the lock file on startup — if the process were actually running, the
    // port check above would have caught it and returned early.
    fs.unlinkSync(LOCK_PATH);
    console.log("LOCAL MONGOD: removed stale lock file.");
  } catch {
    // ignore — mongod will handle a missing lock gracefully
  }
};

export const getLocalMongodUri = (dbName = "tu-profesor-turnos") =>
  `mongodb://127.0.0.1:${LOCAL_MONGOD_PORT}/${dbName}`;

/**
 * Starts the embedded mongod. Safe to call multiple times — returns the same
 * promise if a start is already in progress, and resolves immediately if the
 * process is already running.
 */
export const startLocalMongod = () => {
  if (startPromise) return startPromise;

  startPromise = (async () => {
    // If port is already open, mongod may already be running (e.g. from a prior
    // process that didn't clean up). Accept it as a valid target.
    if (await isPortOpen(LOCAL_MONGOD_PORT)) {
      console.log(
        `LOCAL MONGOD: port ${LOCAL_MONGOD_PORT} already open — using existing process.`,
      );
      return true;
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    removeStaleLock();

    const binary = findMongodBinary();

    if (!binary) {
      console.warn(
        "LOCAL MONGOD: binary not found in node_modules cache. Skipping local mongod.",
      );
      startPromise = null;
      return false;
    }

    console.log("LOCAL MONGOD: starting persistent mongod...");
    console.log(`LOCAL MONGOD: binary → ${path.basename(binary)}`);
    console.log(`LOCAL MONGOD: data   → ${DATA_DIR}`);
    console.log(`LOCAL MONGOD: port   → ${LOCAL_MONGOD_PORT}`);

    const args = [
      "--dbpath",
      DATA_DIR,
      "--port",
      String(LOCAL_MONGOD_PORT),
      "--storageEngine",
      "wiredTiger",
      "--bind_ip",
      "127.0.0.1",
      "--logpath",
      LOG_PATH,
      "--logappend",
    ];

    mongodProcess = spawn(binary, args, {
      detached: false,
      stdio: "ignore",
      windowsHide: true,
    });

    mongodProcess.on("error", (err) => {
      console.error("LOCAL MONGOD: process error:", err.message);
    });

    mongodProcess.on("exit", (code, signal) => {
      if (code !== null && code !== 0) {
        console.warn(`LOCAL MONGOD: exited with code ${code} (signal: ${signal}).`);
      }
      mongodProcess = null;
      startPromise = null;
    });

    try {
      await waitForPort(LOCAL_MONGOD_PORT, STARTUP_TIMEOUT_MS);
      console.log(
        `LOCAL MONGOD: ready — persistent storage at ${DATA_DIR}`,
      );
      return true;
    } catch (err) {
      console.error("LOCAL MONGOD: failed to start within timeout:", err.message);

      if (mongodProcess) {
        mongodProcess.kill();
        mongodProcess = null;
      }

      startPromise = null;
      return false;
    }
  })();

  return startPromise;
};

export const stopLocalMongod = async () => {
  if (mongodProcess) {
    console.log("LOCAL MONGOD: stopping...");
    mongodProcess.kill("SIGTERM");
    mongodProcess = null;
  }

  startPromise = null;
};
