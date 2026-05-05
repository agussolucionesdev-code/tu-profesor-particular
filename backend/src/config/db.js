import mongoose from "mongoose";
import {
  startLocalMongod,
  stopLocalMongod,
  getLocalMongodUri,
} from "./localMongod.js";

let memoryServer = null;
let connectionEventsRegistered = false;
let dbConnectionMeta = {
  driver: "mongoose",
  mode: "mongo",
  source: "uninitialized",
  persistent: false,
  target: "unknown",
};

mongoose.set("strictQuery", true);

const normalizeEnv = () =>
  String(process.env.NODE_ENV || "development")
    .trim()
    .toLowerCase();

const isProduction = () => normalizeEnv() === "production";

const parseBoolean = (value) =>
  ["1", "true", "yes", "y", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );

const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getMemoryLaunchTimeout = () =>
  parsePositiveNumber(process.env.MONGO_MEMORY_LAUNCH_TIMEOUT_MS, 30000);

const getConnectionOptions = () => ({
  autoIndex: !isProduction(),
  maxPoolSize: parsePositiveNumber(process.env.MONGO_MAX_POOL_SIZE, 10),
  minPoolSize: parsePositiveNumber(process.env.MONGO_MIN_POOL_SIZE, 0),
  serverSelectionTimeoutMS: parsePositiveNumber(
    process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    5000,
  ),
});

const getMongoUriKind = (uri) => {
  if (uri.startsWith("mongodb+srv://")) return "mongodb+srv";
  if (uri.startsWith("mongodb://")) return "mongodb";
  return "unknown";
};

const getMongoUriHost = (uri) => {
  try {
    return new URL(uri).hostname || "unknown-host";
  } catch {
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, "");
    return withoutProtocol.split(/[/?]/)[0]?.replace(/.*@/, "") || "unknown-host";
  }
};

const buildConnectionHint = (error, target) => {
  const message = String(error?.message || "");

  if (/querySrv/i.test(message)) {
    return [
      message,
      `DNS SRV lookup failed for ${target.host}.`,
      "Your local network or DNS may be blocking MongoDB Atlas SRV records.",
      "Use MONGO_DIRECT_URI with a non-SRV Atlas URI, or enable MONGO_FALLBACK_TO_MEMORY=true for development.",
    ].join(" ");
  }

  return message;
};

const setDbConnectionMeta = (partial) => {
  dbConnectionMeta = {
    ...dbConnectionMeta,
    ...partial,
  };
};

const shouldUseMemoryDb = () =>
  parseBoolean(process.env.USE_MEMORY_DB) ||
  (normalizeEnv() === "test" && !process.env.MONGO_URI && !process.env.MONGO_DIRECT_URI);

const shouldFallbackToMemoryDb = () =>
  !isProduction() && parseBoolean(process.env.MONGO_FALLBACK_TO_MEMORY);

const canRecoverWithMemoryFallback = () => !shouldUseMemoryDb() && shouldFallbackToMemoryDb();

const logDatabaseConnectionFailure = (source, message) => {
  if (canRecoverWithMemoryFallback()) {
    console.warn(`DATABASE WARNING (${source}): ${message}`);
    return;
  }

  console.error(`DATABASE ERROR (${source}): ${message}`);
};

const registerConnectionEvents = () => {
  if (connectionEventsRegistered) return;

  connectionEventsRegistered = true;

  mongoose.connection.on("connected", () => {
    console.log("DATABASE: MongoDB connection established.");
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("DATABASE: MongoDB disconnected.");
  });

  mongoose.connection.on("error", (error) => {
    if (canRecoverWithMemoryFallback()) {
      console.warn(`DATABASE CONNECTION WARNING: ${error.message}`);
      return;
    }

    console.error(`DATABASE CONNECTION ERROR: ${error.message}`);
  });
};

const createMemoryMongoUri = async () => {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  memoryServer =
    memoryServer ||
    (await MongoMemoryServer.create({
      instance: {
        launchTimeout: getMemoryLaunchTimeout(),
      },
    }));

  setDbConnectionMeta({
    mode: "memory",
    source: "mongodb-memory-server",
    persistent: false,
    target: "localhost-memory",
  });

  return memoryServer.getUri();
};

const makeTarget = ({ uri, mode, source, persistent }) => ({
  uri,
  mode,
  source,
  persistent,
  kind: getMongoUriKind(uri),
  host: getMongoUriHost(uri),
});

const getMongoTargets = async () => {
  if (shouldUseMemoryDb()) {
    return [
      makeTarget({
        uri: await createMemoryMongoUri(),
        mode: "memory",
        source: "mongodb-memory-server",
        persistent: false,
      }),
    ];
  }

  const targets = [];
  const primaryUri = process.env.MONGO_URI?.trim();
  const directUri = process.env.MONGO_DIRECT_URI?.trim();

  if (primaryUri) {
    targets.push(
      makeTarget({
        uri: primaryUri,
        mode: "mongo",
        source: "MONGO_URI",
        persistent: true,
      }),
    );
  }

  if (directUri && directUri !== primaryUri) {
    targets.push(
      makeTarget({
        uri: directUri,
        mode: "mongo",
        source: "MONGO_DIRECT_URI",
        persistent: true,
      }),
    );
  }

  if (targets.length > 0) return targets;

  if (isProduction()) {
    throw new Error("MONGO_URI is required in production.");
  }

  // Try local mongod (persistent embedded process) as fallback
  const localStarted = await startLocalMongod();

  if (localStarted) {
    return [
      makeTarget({
        uri: getLocalMongodUri(),
        mode: "mongo",
        source: "local-mongod",
        persistent: true,
      }),
    ];
  }

  // Last resort: standard local MongoDB (if installed separately)
  return [
    makeTarget({
      uri: "mongodb://127.0.0.1:27017/tu-profesor-turnos",
      mode: "mongo",
      source: "local-default",
      persistent: true,
    }),
  ];
};

const connectMongoTarget = async (target) => {
  setDbConnectionMeta({
    mode: target.mode,
    source: target.source,
    persistent: target.persistent,
    target: target.host,
  });

  console.log(
    `DATABASE: connecting via ${target.source} (${target.kind}, ${target.host}).`,
  );

  const conn = await mongoose.connect(target.uri, getConnectionOptions());

  const persistenceLabel = target.persistent ? "PERSISTENT ✓" : "VOLATILE — data resets on restart ⚠";
  console.log("==================================================");
  console.log(`DATABASE: connected via ${target.source}`);
  console.log(`DATABASE: host       → ${conn.connection.host}`);
  console.log(`DATABASE: name       → ${conn.connection.name}`);
  console.log(`DATABASE: storage    → ${persistenceLabel}`);
  console.log("==================================================");

  return conn.connection;
};

const connectMemoryFallback = async (reason) => {
  console.warn(
    "DATABASE: Falling back to in-memory MongoDB for development. Data will reset when the server stops.",
  );

  if (reason) {
    console.warn(`DATABASE: fallback reason: ${reason}`);
  }

  await mongoose.disconnect().catch(() => {});
  return connectMongoTarget(
    makeTarget({
      uri: await createMemoryMongoUri(),
      mode: "memory",
      source: "mongodb-memory-server",
      persistent: false,
    }),
  );
};

const connectDB = async () => {
  registerConnectionEvents();

  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return mongoose.connection;
  }

  const targets = await getMongoTargets();
  let lastError = null;

  for (const target of targets) {
    try {
      return await connectMongoTarget(target);
    } catch (error) {
      lastError = error;
      logDatabaseConnectionFailure(
        target.source,
        buildConnectionHint(error, target),
      );

      await mongoose.disconnect().catch(() => {});
    }
  }

  // Try persistent local mongod before falling back to volatile memory
  if (!isProduction()) {
    console.warn("DATABASE: all configured targets failed — trying local embedded mongod...");
    const localStarted = await startLocalMongod();

    if (localStarted) {
      return connectMongoTarget(
        makeTarget({
          uri: getLocalMongodUri(),
          mode: "mongo",
          source: "local-mongod-fallback",
          persistent: true,
        }),
      );
    }
  }

  if (canRecoverWithMemoryFallback()) {
    return connectMemoryFallback(lastError?.message);
  }

  throw lastError || new Error("Unable to connect to MongoDB.");
};

export const disconnectDB = async () => {
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }

  await stopLocalMongod();
};

export const getDbConnectionMeta = () => ({
  ...dbConnectionMeta,
});

export default connectDB;
