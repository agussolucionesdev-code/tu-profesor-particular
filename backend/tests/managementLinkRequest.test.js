import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

let mongoServer;
let app;
let Booking;
let ManagementLinkRequest;
let NotificationOutbox;
let enqueueBlindManagementLinkRequest;
let processBlindManagementLinkRequests;
let reconcilePendingManagementTokenSupersessions;
let enqueueBookingNotifications;
let processNotificationOutbox;
let setNotificationProviderForTests;
let buildBookingNotificationIntents;
let refreshEmailDeliveryHealth;
let setEmailTransporterForTests;

const bookingInput = (overrides = {}) => {
  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return {
    studentName: "Alumno Seguro",
    responsibleName: "Responsable Seguro",
    responsibleRelationship: "self",
    tutorName: "Agustin",
    phone: "1122334455",
    email: "familia@example.com",
    school: "Escuela",
    educationLevel: "Secundaria",
    yearGrade: "3",
    subject: "Matemática",
    timeSlot: start,
    endTime: new Date(start.getTime() + 60 * 60 * 1000),
    duration: 1,
    status: "Confirmado",
    bookingCode: `B${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    ...overrides,
  };
};

beforeAll(async () => {
  process.env.JWT_SECRET = "blind-request-tests";
  process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = `v1:${crypto.randomBytes(32).toString("base64url")}`;
  process.env.NOTIFICATION_OUTBOX_ACTIVE_KEY_VERSION = "v1";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.EMAIL_USER = "mailer@example.com";
  process.env.EMAIL_PASS = "test-app-password";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = (await import("../src/app.js")).default;
  Booking = (await import("../src/models/Booking.js")).default;
  ManagementLinkRequest = (await import("../src/models/ManagementLinkRequest.js")).default;
  NotificationOutbox = (await import("../src/models/NotificationOutbox.js")).default;
  ({
    enqueueBlindManagementLinkRequest,
    processBlindManagementLinkRequests,
    reconcilePendingManagementTokenSupersessions,
  } = await import("../src/services/managementLinkRequestService.js"));
  ({
    enqueueBookingNotifications,
    processNotificationOutbox,
    setNotificationProviderForTests,
    buildBookingNotificationIntents,
  } = await import("../src/services/notificationOutboxService.js"));
  ({ refreshEmailDeliveryHealth, setEmailTransporterForTests } = await import("../src/config/mailer.js"));
}, 90_000);

beforeEach(async () => {
  await Promise.all([
    Booking.deleteMany({}),
    ManagementLinkRequest.deleteMany({}),
    NotificationOutbox.deleteMany({}),
  ]);
  setEmailTransporterForTests({
    verify: vi.fn().mockResolvedValue(true),
    sendMail: vi.fn(),
  });
  await refreshEmailDeliveryHealth({ force: true, timeoutMs: 100 });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("blind management-link requests", () => {
  it("declares partial operational indexes for token intents and retry sagas", async () => {
    const { OPERATIONAL_INDEXES } = await import("../src/config/operationalIndexes.js");
    expect(OPERATIONAL_INDEXES.bookings).toContainEqual(expect.objectContaining({
      key: { "notificationIntents.managementTokenFingerprint": 1 },
      partialFilterExpression: {
        "notificationIntents.managementTokenFingerprint": { $type: "string" },
      },
    }));
    expect(OPERATIONAL_INDEXES.notificationOutboxes).toContainEqual(expect.objectContaining({
      key: { retryOperationState: 1, _id: 1 },
      partialFilterExpression: {
        retryOperationState: { $in: ["requested", "committed", "failed"] },
      },
    }));
    expect(OPERATIONAL_INDEXES.managementLinkRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { requestKey: 1 }, unique: true }),
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    ]));
  });

  it("does no Booking lookup in the public path and stores no plaintext PII", async () => {
    const known = await Booking.create(bookingInput({ bookingCode: "ABC234" }));
    const findSpy = vi.spyOn(Booking, "findOne");
    const responses = await Promise.all([
      request(app).post("/api/bookings/manage/request-link")
        .send({ bookingCode: known.bookingCode, email: known.email }),
      request(app).post("/api/bookings/manage/request-link")
        .send({ bookingCode: "ZZZ999", email: "unknown@example.com" }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([202, 202]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(findSpy).not.toHaveBeenCalled();
    findSpy.mockRestore();
    const raw = await mongoose.connection.collection("managementlinkrequests").find({}).toArray();
    expect(raw).toHaveLength(2);
    expect(JSON.stringify(raw)).not.toContain("familia@example.com");
    expect(JSON.stringify(raw)).not.toContain("unknown@example.com");
    expect(JSON.stringify(raw)).not.toContain("ABC234");
    expect(raw.every((entry) => /^[a-f0-9]{64}$/u.test(entry.emailLookup))).toBe(true);
  });

  it("deduplicates twenty concurrent submissions and resolves auth/cooldown in the worker", async () => {
    const booking = await Booking.create(bookingInput({ bookingCode: "ABC234" }));
    await Promise.all(Array.from({ length: 20 }, () => enqueueBlindManagementLinkRequest({
      bookingCode: booking.bookingCode,
      email: booking.email,
    })));
    expect(await ManagementLinkRequest.countDocuments()).toBe(1);
    expect(await processBlindManagementLinkRequests({ workerId: "blind-20" }))
      .toMatchObject({ completed: 1 });
    const current = await Booking.findById(booking._id).select("+managementTokenHash").lean();
    expect(current.managementTokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(await NotificationOutbox.countDocuments({ type: "management_link_requested" })).toBe(1);

    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });
    await processBlindManagementLinkRequests({ workerId: "cooldown" });
    expect(await NotificationOutbox.countDocuments({ type: "management_link_requested" })).toBe(1);
  });

  it("lets an in-flight provider delivery win and blocks token rotation", async () => {
    const token = "x".repeat(43);
    const fingerprint = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      bookingCode: "ABC234",
      managementTokenHash: fingerprint,
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
    });
    let release;
    const providerStarted = new Promise((resolve) => { release = resolve; });
    let entered;
    const enteredProvider = new Promise((resolve) => { entered = resolve; });
    const restore = setNotificationProviderForTests(async () => {
      entered();
      await providerStarted;
      return { sent: true };
    });
    const delivery = processNotificationOutbox({ workerId: "delivery-wins", limit: 1 });
    await enteredProvider;
    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });
    expect(await processBlindManagementLinkRequests({ workerId: "rotation-loses" }))
      .toMatchObject({ failed: 1, discarded: 0 });
    expect((await Booking.findById(booking._id).select("+managementTokenHash").lean()).managementTokenHash)
      .toBe(fingerprint);
    release();
    await delivery;
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(await processBlindManagementLinkRequests({ workerId: "rotation-retries" }))
      .toMatchObject({ completed: 1 });
    restore();
  });

  it("allows rotation after an ambiguous management token has expired", async () => {
    const token = "e".repeat(43);
    const fingerprint = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      bookingCode: "ABC234",
      managementTokenHash: fingerprint,
      managementTokenExpiresAt: new Date(Date.now() - 1_000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "management_link_requested",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
      eventKey: "expired-ambiguous-token",
    });
    await NotificationOutbox.updateOne({}, {
      $set: { status: "delivery_unknown", failureDisposition: "ambiguous", nextAttemptAt: null },
    });

    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });
    expect(await processBlindManagementLinkRequests({ workerId: "expired-unknown" }))
      .toMatchObject({ completed: 1 });
    expect(await NotificationOutbox.countDocuments({
      managementTokenFingerprint: fingerprint,
      status: "superseded",
    })).toBe(1);
    expect((await Booking.findById(booking._id).select("+managementTokenHash").lean()).managementTokenHash)
      .not.toBe(fingerprint);
  });

  it("allows immediate reissue after explicit revocation and purges the old unknown delivery", async () => {
    const token = "r".repeat(43);
    const fingerprint = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      bookingCode: "REV234",
      managementTokenHash: fingerprint,
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
      managementTokenRevokedAt: new Date(),
      reminderRevision: 7,
    }));
    await enqueueBookingNotifications({
      booking,
      type: "management_link_requested",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
      eventKey: "revoked-ambiguous-token",
    });
    await NotificationOutbox.updateOne({}, {
      $set: { status: "delivery_unknown", failureDisposition: "ambiguous", nextAttemptAt: null },
    });

    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });
    expect(await processBlindManagementLinkRequests({ workerId: "revoked-unknown" }))
      .toMatchObject({ completed: 1, discarded: 0 });
    const old = await NotificationOutbox.findOne({ managementTokenFingerprint: fingerprint })
      .select("+payloadCiphertext +payloadIv +payloadAuthTag")
      .lean();
    expect(old).toMatchObject({ status: "superseded" });
    expect(old.payloadCiphertext).toBeUndefined();
    const current = await Booking.findById(booking._id).select("+managementTokenHash").lean();
    expect(current.managementTokenHash).not.toBe(fingerprint);
    expect(current.managementTokenRevokedAt).toBeNull();
    expect(current.reminderRevision).toBe(7);
  });

  it("lets rotation win before provider acquisition and supersedes every old token artifact", async () => {
    const token = "y".repeat(43);
    const fingerprint = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      bookingCode: "ABC234",
      managementTokenHash: fingerprint,
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    const oldIntents = [];
    for (const type of ["booking_confirmation", "booking_reminder"]) {
      const rows = await enqueueBookingNotifications({
        booking,
        type,
        managementUrl: `https://frontend.example/m#token=${token}`,
        includeOwner: false,
        eventKey: `old-${type}`,
      });
      oldIntents.push(...rows);
    }
    await NotificationOutbox.collection.updateOne(
      { _id: oldIntents[1]._id },
      { $set: { status: "dead", failureDisposition: "retryable", attempts: 5 } },
    );
    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });
    expect(await processBlindManagementLinkRequests({ workerId: "rotation-wins" }))
      .toMatchObject({ completed: 1 });
    expect(await NotificationOutbox.countDocuments({
      managementTokenFingerprint: fingerprint,
      status: "superseded",
    })).toBe(2);
    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    await processNotificationOutbox({ workerId: "post-rotation", limit: 10 });
    restore();
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith(expect.objectContaining({ type: "management_link_requested" }));
  });

  it("atomically preserves fifty concurrent booking intents while rotating the token", async () => {
    const token = "z".repeat(43);
    const fingerprint = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      bookingCode: "ABC234",
      managementTokenHash: fingerprint,
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    const concurrent = Array.from({ length: 50 }, (_, index) => buildBookingNotificationIntents({
      booking,
      type: "booking_confirmation",
      eventKey: `concurrent-booking-mutation-${index}`,
      includeOwner: false,
    })[0]);
    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });

    const originalUpdateOne = Booking.collection.updateOne.bind(Booking.collection);
    let injected = false;
    const updateSpy = vi.spyOn(Booking.collection, "updateOne").mockImplementation(async (filter, update, options) => {
      if (!injected && Array.isArray(update)) {
        injected = true;
        await Booking.updateOne(
          { _id: booking._id },
          { $push: { notificationIntents: { $each: concurrent } } },
        );
      }
      return originalUpdateOne(filter, update, options);
    });
    try {
      expect(await processBlindManagementLinkRequests({ workerId: "atomic-rotation" }))
        .toMatchObject({ completed: 1 });
    } finally {
      updateSpy.mockRestore();
    }

    expect(injected).toBe(true);
    expect(await NotificationOutbox.countDocuments({
      dedupeKey: { $in: concurrent.map((intent) => intent.dedupeKey) },
    })).toBe(50);
  });

  it("purges every stale dead payload and supersedes a leased preflight record", async () => {
    const token = "w".repeat(43);
    const fingerprint = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      bookingCode: "ABC234",
      managementTokenHash: fingerprint,
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    const dispositions = ["terminal", "security", "ambiguous", "configuration"];
    const documents = dispositions.map((failureDisposition, index) => {
      const intent = buildBookingNotificationIntents({
        booking,
        type: "booking_confirmation",
        eventKey: `dead-old-token-${index}`,
        managementUrl: `https://frontend.example/m#token=${token}`,
        includeOwner: false,
      })[0];
      return {
        ...intent,
        booking: booking._id,
        bookingCode: booking.bookingCode,
        status: "dead",
        eventOccurredAt: intent.occurredAt,
        nextAttemptAt: null,
        attempts: 5,
        failureDisposition,
        recipientHash: "b".repeat(64),
      };
    });
    const leasedIntent = buildBookingNotificationIntents({
      booking,
      type: "booking_confirmation",
      eventKey: "leased-old-token",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
    })[0];
    documents.push({
      ...leasedIntent,
      booking: booking._id,
      bookingCode: booking.bookingCode,
      status: "processing",
      eventOccurredAt: leasedIntent.occurredAt,
      deliveryPhase: "leased",
      leaseOwner: "preflight-worker",
      leaseExpiresAt: new Date(Date.now() + 30_000),
      attempts: 1,
      recipientHash: "b".repeat(64),
    });
    await NotificationOutbox.collection.insertMany(documents);
    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });
    expect(await processBlindManagementLinkRequests({ workerId: "rotation-wins-preflight" }))
      .toMatchObject({ completed: 1 });

    const stale = await NotificationOutbox.find({ managementTokenFingerprint: fingerprint })
      .select("+payloadCiphertext +payloadIv +payloadAuthTag +encryptionKeyVersion +deliveryPhase")
      .lean();
    expect(stale).toHaveLength(5);
    expect(stale.every((record) => record.status === "superseded")).toBe(true);
    expect(stale.every((record) => !record.payloadCiphertext && !record.payloadIv && !record.payloadAuthTag)).toBe(true);
    const staleRaw = await NotificationOutbox.collection.find({
      managementTokenFingerprint: fingerprint,
    }).toArray();
    expect(staleRaw.every((record) => !("recipientHash" in record))).toBe(true);
  });

  it("rotation wins an actual leased-preflight race and the worker never sends", async () => {
    const token = "v".repeat(43);
    const fingerprint = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      bookingCode: "ABC234",
      managementTokenHash: fingerprint,
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
    });
    let entered;
    let release;
    const preflightEntered = new Promise((resolve) => { entered = resolve; });
    const barrier = new Promise((resolve) => { release = resolve; });
    const send = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(async () => {
      entered();
      await barrier;
      return { send };
    }, { stage: "preflight" });
    const delivery = processNotificationOutbox({ workerId: "paused-preflight", limit: 1 });
    await preflightEntered;
    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });
    expect(await processBlindManagementLinkRequests({ workerId: "rotation-race-winner" }))
      .toMatchObject({ completed: 1 });
    release();
    await delivery;
    restore();

    expect(send).not.toHaveBeenCalled();
    expect(await NotificationOutbox.countDocuments({
      managementTokenFingerprint: fingerprint,
      status: "superseded",
    })).toBe(1);
  });

  it("does not destroy old-token artifacts when the final token CAS loses", async () => {
    const token = "q".repeat(43);
    const fingerprint = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      bookingCode: "ABC234",
      managementTokenHash: fingerprint,
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
      eventKey: "final-cas-loses",
    });
    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });
    const original = Booking.collection.updateOne.bind(Booking.collection);
    const spy = vi.spyOn(Booking.collection, "updateOne").mockImplementation((filter, update, options) => {
      if (Array.isArray(update)) return Promise.resolve({ acknowledged: true, matchedCount: 0, modifiedCount: 0 });
      return original(filter, update, options);
    });
    try {
      expect(await processBlindManagementLinkRequests({ workerId: "final-cas-loses" }))
        .toMatchObject({ discarded: 1 });
    } finally {
      spy.mockRestore();
    }
    expect((await Booking.findById(booking._id).select("+managementTokenHash").lean()).managementTokenHash)
      .toBe(fingerprint);
    expect(await NotificationOutbox.findOne({ booking: booking._id }).lean())
      .toMatchObject({ status: "queued" });
  });

  it("persists cleanup intent after token commit and retries supersession idempotently", async () => {
    const token = "r".repeat(43);
    const fingerprint = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      bookingCode: "ABC234",
      managementTokenHash: fingerprint,
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
      eventKey: "cleanup-retry",
    });
    await enqueueBlindManagementLinkRequest({ bookingCode: booking.bookingCode, email: booking.email });
    const original = NotificationOutbox.collection.updateMany.bind(NotificationOutbox.collection);
    let failedOnce = false;
    const spy = vi.spyOn(NotificationOutbox.collection, "updateMany")
      .mockImplementation((filter, update, options) => {
        if (!failedOnce && filter?.managementTokenFingerprint === fingerprint) {
          failedOnce = true;
          return Promise.reject(new Error("simulated cleanup outage"));
        }
        return original(filter, update, options);
      });
    try {
      expect(await processBlindManagementLinkRequests({ workerId: "cleanup-retry" }))
        .toMatchObject({ completed: 1 });
    } finally {
      spy.mockRestore();
    }
    const committed = await Booking.findById(booking._id)
      .select("+managementTokenHash +managementTokenSupersessionPending")
      .lean();
    expect(committed.managementTokenHash).not.toBe(fingerprint);
    expect(committed.managementTokenSupersessionPending).toMatchObject({ fingerprint });
    expect(await NotificationOutbox.findOne({ managementTokenFingerprint: fingerprint }).lean())
      .toMatchObject({ status: "queued" });

    expect(await reconcilePendingManagementTokenSupersessions({ bookingId: booking._id }))
      .toMatchObject({ reconciled: 1 });
    expect(await reconcilePendingManagementTokenSupersessions({ bookingId: booking._id }))
      .toMatchObject({ reconciled: 0 });
    expect(await NotificationOutbox.findOne({ managementTokenFingerprint: fingerprint }).lean())
      .toMatchObject({ status: "superseded" });
  });
});
