import crypto from "node:crypto";
import Booking from "../models/Booking.js";
import ManagementLinkRequest from "../models/ManagementLinkRequest.js";
import NotificationOutbox from "../models/NotificationOutbox.js";
import { issueManagementToken } from "./managementTokenService.js";
import {
  buildBookingNotificationIntents,
  reconcileNotificationIntents,
} from "./notificationOutboxService.js";
import {
  managementLinkRequestLookupHashes,
  protectManagementLinkRequest,
  unprotectManagementLinkRequest,
} from "./notificationPayloadCrypto.js";
import {
  combineMutationGuards,
  withoutActiveManagementLinkRequest,
  withoutActiveNotificationDeliveryFence,
  withoutActiveSlotMutation,
} from "./bookingMutationFenceService.js";

const REQUEST_TTL_MS = 60 * 60 * 1000;
const IDEMPOTENCY_BUCKET_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 5 * 60 * 1000;
const LEASE_MS = 30_000;
const MAX_ATTEMPTS = 3;

class BookingMutationBusyError extends Error {
  constructor() {
    super("Booking mutation fence is busy.");
    this.code = "BOOKING_MUTATION_BUSY";
  }
}

const requestKeyFor = ({ bookingCodeLookup, emailLookup, now }) => crypto
  .createHash("sha256")
  .update(`${bookingCodeLookup}:${emailLookup}:${Math.floor(now.getTime() / IDEMPOTENCY_BUCKET_MS)}`)
  .digest("hex");

export const enqueueBlindManagementLinkRequest = async ({ bookingCode, email, now = new Date() }) => {
  const lookups = managementLinkRequestLookupHashes({ bookingCode, email });
  const requestKey = requestKeyFor({ ...lookups, now });
  const protectedPayload = protectManagementLinkRequest({ bookingCode, email }, requestKey);
  await ManagementLinkRequest.collection.updateOne(
    { requestKey },
    {
      $setOnInsert: {
        requestKey,
        ...protectedPayload,
        status: "queued",
        attempts: 0,
        nextAttemptAt: now,
        expiresAt: new Date(now.getTime() + REQUEST_TTL_MS),
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  return requestKey;
};

const leaseNext = ({ workerId, now, leaseMs }) => ManagementLinkRequest.findOneAndUpdate(
  {
    status: "queued",
    nextAttemptAt: { $lte: now },
    expiresAt: { $gt: now },
    attempts: { $lt: MAX_ATTEMPTS },
  },
  {
    $set: {
      status: "processing",
      leaseOwner: workerId,
      leaseExpiresAt: new Date(now.getTime() + leaseMs),
    },
    $inc: { attempts: 1 },
  },
  { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } },
).select("+bookingCodeLookup +emailLookup +payloadCiphertext +payloadIv +payloadAuthTag +encryptionKeyVersion +leaseOwner");

const finish = (record, workerId, status, now) => ManagementLinkRequest.collection.updateOne(
  { _id: record._id, status: "processing", leaseOwner: workerId },
  {
    $set: { status, completedAt: now, updatedAt: now, nextAttemptAt: null },
    $unset: {
      leaseOwner: "",
      leaseExpiresAt: "",
      payloadCiphertext: "",
      payloadIv: "",
      payloadAuthTag: "",
      encryptionKeyVersion: "",
    },
  },
);

const releaseBookingRequestLock = (bookingId, lock) => Booking.collection.updateOne(
  { _id: bookingId, managementLinkRequestLock: lock },
  { $unset: { managementLinkRequestLock: "", managementLinkRequestLockExpiresAt: "" } },
);

const startRequestHeartbeat = ({ bookingId, lock, record, workerId, leaseMs = LEASE_MS }) => {
  let stopped = false;
  let pending = Promise.resolve();
  const intervalMs = Math.max(10, Math.floor(leaseMs / 3));
  const renew = () => {
    if (stopped) return;
    const heartbeatAt = new Date();
    const expiresAt = new Date(heartbeatAt.getTime() + leaseMs);
    pending = pending.then(async () => {
      await Promise.all([
        Booking.collection.updateOne(
          { _id: bookingId, managementLinkRequestLock: lock },
          { $set: { managementLinkRequestLockExpiresAt: expiresAt } },
        ),
        ManagementLinkRequest.collection.updateOne(
          { _id: record._id, status: "processing", leaseOwner: workerId },
          { $set: { leaseExpiresAt: expiresAt, updatedAt: heartbeatAt } },
        ),
      ]);
    }).catch(() => {});
  };
  const timer = setInterval(renew, intervalMs);
  timer.unref?.();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await pending;
  };
};

const supersedeOldTokenOutbox = async ({ bookingId, fingerprint, now, tokenInactive = false }) => {
  if (!fingerprint) return;
  await NotificationOutbox.collection.updateMany(
    {
      booking: bookingId,
      managementTokenFingerprint: fingerprint,
      $or: [
        { status: { $in: ["queued", "failed", "dead"] } },
        { status: "processing", deliveryPhase: "leased" },
        ...(tokenInactive ? [{ status: "delivery_unknown" }] : []),
      ],
    },
    {
      $set: {
        status: "superseded",
        errorCategory: "superseded",
        failureDisposition: "terminal",
        lastError: "La notificación quedó obsoleta por un cambio posterior.",
        nextAttemptAt: null,
        payloadPurgedAt: now,
        updatedAt: now,
      },
      $unset: {
        leaseOwner: "",
        leaseExpiresAt: "",
        deliveryPhase: "",
        payloadCiphertext: "",
        payloadIv: "",
        payloadAuthTag: "",
        encryptionKeyVersion: "",
        recipientHash: "",
      },
    },
  );
};

export const reconcilePendingManagementTokenSupersessions = async ({
  bookingId,
  limit = 100,
  now = new Date(),
} = {}) => {
  const bookings = await Booking.find({
    ...(bookingId ? { _id: bookingId } : {}),
    managementTokenSupersessionPending: { $ne: null },
  })
    .select("+managementTokenSupersessionPending")
    .sort({ _id: 1 })
    .limit(Math.max(1, Math.min(500, Number(limit) || 100)))
    .lean();
  let reconciled = 0;
  for (const booking of bookings) {
    const pending = booking.managementTokenSupersessionPending;
    if (!pending?.fingerprint) continue;
    await supersedeOldTokenOutbox({
      bookingId: booking._id,
      fingerprint: pending.fingerprint,
      now,
      tokenInactive: Boolean(pending.tokenInactive || pending.tokenExpired),
    });
    const cleared = await Booking.collection.updateOne(
      {
        _id: booking._id,
        "managementTokenSupersessionPending.fingerprint": pending.fingerprint,
        "managementTokenSupersessionPending.requestKey": pending.requestKey,
      },
      { $unset: { managementTokenSupersessionPending: "" } },
    );
    reconciled += cleared.modifiedCount || 0;
  }
  return { reconciled };
};

const resolveOne = async ({ record, workerId, now, leaseMs = LEASE_MS }) => {
  const payload = unprotectManagementLinkRequest(record);
  const expectedLookups = managementLinkRequestLookupHashes(payload, record.encryptionKeyVersion);
  if (
    expectedLookups.bookingCodeLookup !== record.bookingCodeLookup ||
    expectedLookups.emailLookup !== record.emailLookup
  ) throw new Error("Management-link request lookup authentication failed.");

  const booking = await Booking.findOne({
    bookingCode: payload.bookingCode,
    email: payload.email,
    deletedAt: null,
    status: { $in: ["Confirmado", "Pendiente"] },
  }).select("+managementTokenHash +managementLinkLastSentAt +managementLinkRequestLock +managementLinkRequestLockExpiresAt +managementTokenDeliveryLock +managementTokenDeliveryLockFingerprint +managementTokenDeliveryLockExpiresAt +notificationDeliveryFence +managementTokenSupersessionPending +notificationIntents");
  if (!booking) return "discarded";

  const lock = crypto.randomUUID();
  const locked = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      updatedAt: booking.updatedAt,
      ...combineMutationGuards(
        { $or: [
          { managementLinkLastSentAt: null },
          { managementLinkLastSentAt: { $exists: false } },
          { managementLinkLastSentAt: { $lte: new Date(now.getTime() - COOLDOWN_MS) } },
        ] },
        withoutActiveManagementLinkRequest(now),
        withoutActiveSlotMutation(now),
        withoutActiveNotificationDeliveryFence(now),
        { $or: [
          { managementTokenSupersessionPending: null },
          { managementTokenSupersessionPending: { $exists: false } },
        ] },
      ),
    },
    {
      $set: {
        managementLinkRequestLock: lock,
        managementLinkRequestLockExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
    },
    { new: true },
  ).select("+managementTokenHash +managementLinkLastSentAt +managementLinkRequestLock +managementLinkRequestLockExpiresAt +managementTokenDeliveryLock +managementTokenDeliveryLockFingerprint +managementTokenDeliveryLockExpiresAt +notificationDeliveryFence +managementTokenSupersessionPending +notificationIntents");
  if (!locked) {
    const stillEligible = await Booking.exists({
      _id: booking._id,
      bookingCode: payload.bookingCode,
      email: payload.email,
      deletedAt: null,
      status: { $in: ["Confirmado", "Pendiente"] },
      $or: [
        { managementLinkLastSentAt: null },
        { managementLinkLastSentAt: { $exists: false } },
        { managementLinkLastSentAt: { $lte: new Date(now.getTime() - COOLDOWN_MS) } },
      ],
    });
    if (stillEligible) throw new BookingMutationBusyError();
    return "discarded";
  }

  const oldFingerprint = locked.managementTokenHash || null;
  const stopHeartbeat = startRequestHeartbeat({
    bookingId: locked._id,
    lock,
    record,
    workerId,
    leaseMs,
  });
  try {
    let oldTokenInactive = false;
    if (oldFingerprint) {
      oldTokenInactive = Boolean(locked.managementTokenRevokedAt) ||
        !locked.managementTokenExpiresAt || new Date(locked.managementTokenExpiresAt) <= now;
      const ambiguous = await NotificationOutbox.exists({
        booking: locked._id,
        managementTokenFingerprint: oldFingerprint,
        $or: [
          ...(!oldTokenInactive ? [{ status: "delivery_unknown" }] : []),
          {
            status: "processing",
            deliveryPhase: { $in: ["provider_started", "provider_accepted"] },
          },
        ],
      });
      if (ambiguous) return "discarded";
    }

    const { managementUrl } = issueManagementToken(locked);
    const previousNotificationRevision = Number(locked.notificationRevision || 0);
    locked.notificationRevision = previousNotificationRevision + 1;
    const intents = buildBookingNotificationIntents({
      booking: locked,
      type: "management_link_requested",
      eventKey: record.requestKey,
      managementUrl,
      includeOwner: false,
      now,
    });
    const persisted = await Booking.collection.updateOne(
      {
        _id: locked._id,
        managementLinkRequestLock: lock,
        managementLinkRequestLockExpiresAt: { $gt: new Date() },
        notificationRevision: previousNotificationRevision,
        scheduleRevision: Number(locked.scheduleRevision || 0),
        timeSlot: locked.timeSlot,
        bookingCode: payload.bookingCode,
        email: payload.email,
        deletedAt: null,
        status: { $in: ["Confirmado", "Pendiente"] },
        ...(oldFingerprint
          ? { managementTokenHash: oldFingerprint }
          : { $or: [{ managementTokenHash: null }, { managementTokenHash: { $exists: false } }] }),
      },
      [
        {
          $set: {
            managementTokenHash: locked.managementTokenHash,
            managementTokenExpiresAt: locked.managementTokenExpiresAt,
            managementTokenRevokedAt: null,
            managementLinkLastSentAt: now,
            notificationRevision: {
              $add: [{ $ifNull: ["$notificationRevision", 0] }, 1],
            },
            managementTokenSupersessionPending: oldFingerprint ? {
              fingerprint: oldFingerprint,
              tokenExpired: !locked.managementTokenExpiresAt || new Date(locked.managementTokenExpiresAt) <= now,
              tokenInactive: oldTokenInactive,
              requestKey: record.requestKey,
              createdAt: now,
            } : null,
            notificationIntents: {
              $concatArrays: [
                oldFingerprint
                  ? {
                    $filter: {
                      input: { $ifNull: ["$notificationIntents", []] },
                      as: "intent",
                      cond: { $ne: ["$$intent.managementTokenFingerprint", oldFingerprint] },
                    },
                  }
                  : { $ifNull: ["$notificationIntents", []] },
                intents,
              ],
            },
          },
        },
        {
          $set: {
            managementTokenDeliveryLock: {
              $cond: [
                { $eq: ["$managementTokenDeliveryLockFingerprint", oldFingerprint] },
                "$$REMOVE",
                "$managementTokenDeliveryLock",
              ],
            },
            managementTokenDeliveryLockOutbox: {
              $cond: [
                { $eq: ["$managementTokenDeliveryLockFingerprint", oldFingerprint] },
                "$$REMOVE",
                "$managementTokenDeliveryLockOutbox",
              ],
            },
            managementTokenDeliveryLockExpiresAt: {
              $cond: [
                { $eq: ["$managementTokenDeliveryLockFingerprint", oldFingerprint] },
                "$$REMOVE",
                "$managementTokenDeliveryLockExpiresAt",
              ],
            },
            managementTokenDeliveryLockFingerprint: {
              $cond: [
                { $eq: ["$managementTokenDeliveryLockFingerprint", oldFingerprint] },
                "$$REMOVE",
                "$managementTokenDeliveryLockFingerprint",
              ],
            },
          },
        },
        { $unset: ["managementLinkRequestLock", "managementLinkRequestLockExpiresAt"] },
      ],
    );
    if (persisted.modifiedCount !== 1) return "discarded";
    await reconcileNotificationIntents({ bookingId: locked._id });
    if (oldFingerprint) {
      await reconcilePendingManagementTokenSupersessions({
        bookingId: locked._id,
        now: new Date(),
      }).catch(() => {});
    }
    return "completed";
  } finally {
    await stopHeartbeat();
    await releaseBookingRequestLock(locked._id, lock).catch(() => {});
  }
};

export const processBlindManagementLinkRequests = async ({
  workerId = crypto.randomUUID(),
  limit = 50,
  now = new Date(),
  leaseMs = LEASE_MS,
} = {}) => {
  await reconcilePendingManagementTokenSupersessions({ now });
  await ManagementLinkRequest.collection.updateMany(
    { status: "processing", leaseExpiresAt: { $lte: now }, expiresAt: { $gt: now } },
    {
      $set: { status: "queued", nextAttemptAt: now, updatedAt: now },
      $unset: { leaseOwner: "", leaseExpiresAt: "" },
    },
  );
  const summary = { processed: 0, completed: 0, discarded: 0, failed: 0 };
  for (let index = 0; index < Math.max(1, Math.min(100, Number(limit) || 50)); index += 1) {
    const record = await leaseNext({ workerId, now: new Date(), leaseMs });
    if (!record) break;
    summary.processed += 1;
    try {
      const status = await resolveOne({ record, workerId, now: new Date(), leaseMs });
      await finish(record, workerId, status, new Date());
      summary[status] += 1;
    } catch (error) {
      const failedAt = new Date();
      if (record.attempts >= MAX_ATTEMPTS && error?.code !== "BOOKING_MUTATION_BUSY") {
        await finish(record, workerId, "discarded", failedAt);
        summary.discarded += 1;
      } else {
        await ManagementLinkRequest.collection.updateOne(
          { _id: record._id, status: "processing", leaseOwner: workerId },
          {
            $set: {
              status: "queued",
              nextAttemptAt: new Date(failedAt.getTime() + (
                error?.code === "BOOKING_MUTATION_BUSY" ? 100 : 60_000
              )),
              updatedAt: failedAt,
            },
            ...(error?.code === "BOOKING_MUTATION_BUSY" ? { $inc: { attempts: -1 } } : {}),
            $unset: { leaseOwner: "", leaseExpiresAt: "" },
          },
        );
        summary.failed += 1;
      }
    }
  }
  return summary;
};

export const createManagementLinkRequestRunner = ({ processor = processBlindManagementLinkRequests } = {}) => {
  let active = null;
  const run = () => {
    if (active) return active;
    active = Promise.resolve(processor()).finally(() => { active = null; });
    return active;
  };
  run.waitForIdle = async ({ timeoutMs = 25_000 } = {}) => {
    if (!active) return true;
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), Math.max(1, timeoutMs));
      timer.unref?.();
    });
    const completed = await Promise.race([active.then(() => true, () => true), timeout]);
    clearTimeout(timer);
    return completed;
  };
  return run;
};
