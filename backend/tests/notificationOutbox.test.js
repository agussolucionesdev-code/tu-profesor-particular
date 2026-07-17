import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import bcrypt from "bcryptjs";

let app;
let mongoServer;
let Booking;
let NotificationOutbox;
let User;
let AuditEvent;
let AppSettings;
let enqueueBookingNotifications;
let buildBookingNotificationIntents;
let reconcileNotificationIntents;
let processNotificationOutbox;
let setNotificationProviderForTests;
let createNotificationOutboxRunner;
let classifyProviderOutcome;
let buildBookingEmailHtml;
let buildBookingEmailText;
let refreshEmailDeliveryHealth;
let resetEmailDeliveryHealthForTests;
let setEmailTransporterForTests;
let reconcileRetrySagas;
let autoFinalizeBookings;
let buildPendingBookingAudit;
let reconcilePendingBookingAudits;
let setAuditWriterForTests;
let renewSlotMutationLock;
let SLOT_MUTATION_LOCK_MS;

const emailKey = () => crypto.randomBytes(32).toString("base64url");

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
    subject: "MatemÃ¡tica",
    timeSlot: start,
    endTime: new Date(start.getTime() + 60 * 60 * 1000),
    duration: 1,
    status: "Confirmado",
    ...overrides,
  };
};

const createAdminToken = async () => {
  await User.create({
    username: "notifications-admin@example.com",
    password: await bcrypt.hash("super-secret", 10),
    role: "admin",
  });
  const response = await request(app).post("/api/auth/login").send({
    username: "notifications-admin@example.com",
    password: "super-secret",
  });
  return response.body.token;
};

beforeAll(async () => {
  process.env.JWT_SECRET = "notification-tests-jwt";
  process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = `v1:${emailKey()}`;
  process.env.NOTIFICATION_OUTBOX_ACTIVE_KEY_VERSION = "v1";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.EMAIL_USER = "mailer@example.com";
  process.env.EMAIL_PASS = "test-app-password";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = (await import("../src/app.js")).default;
  Booking = (await import("../src/models/Booking.js")).default;
  NotificationOutbox = (await import("../src/models/NotificationOutbox.js")).default;
  User = (await import("../src/models/User.js")).default;
  AuditEvent = (await import("../src/models/AuditEvent.js")).default;
  AppSettings = (await import("../src/models/AppSettings.js")).default;
  ({
    enqueueBookingNotifications,
    buildBookingNotificationIntents,
    reconcileNotificationIntents,
    processNotificationOutbox,
    setNotificationProviderForTests,
    createNotificationOutboxRunner,
    classifyProviderOutcome,
  } = await import("../src/services/notificationOutboxService.js"));
  ({
    refreshEmailDeliveryHealth,
    resetEmailDeliveryHealthForTests,
    setEmailTransporterForTests,
    buildBookingEmailHtml,
    buildBookingEmailText,
  } = await import("../src/config/mailer.js"));
  ({ reconcileRetrySagas } = await import("../src/controllers/notificationController.js"));
  ({ renewSlotMutationLock } = await import("../src/controllers/bookingController.js"));
  ({ SLOT_MUTATION_LOCK_MS } = await import("../src/config/bookingMutationLease.js"));
  ({ autoFinalizeBookings } = await import("../src/services/bookingLifecycleService.js"));
  ({
    buildPendingBookingAudit,
    reconcilePendingBookingAudits,
    setAuditWriterForTests,
  } = await import("../src/services/auditService.js"));
  setEmailTransporterForTests({
    verify: vi.fn().mockResolvedValue(true),
    sendMail: vi.fn(),
  });
  await refreshEmailDeliveryHealth({ force: true, timeoutMs: 100 });
  await NotificationOutbox.syncIndexes();
}, 90_000);

beforeEach(async () => {
  await Promise.all([
    Booking.deleteMany({}),
    NotificationOutbox.deleteMany({}),
    User.deleteMany({}),
    AuditEvent.deleteMany({}),
    AppSettings.deleteMany({ key: "migration.notificationRecipientHash.v1" }),
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

describe("NotificationOutbox durable delivery", () => {
  it("revalidates SMTP health before every lease when a slow batch crosses the health TTL", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const transporter = {
        verify: vi.fn()
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error("smtp became unavailable")),
        sendMail: vi.fn(),
      };
      setEmailTransporterForTests(transporter);
      resetEmailDeliveryHealthForTests();

      const first = await Booking.create(bookingInput({ email: "first@example.com" }));
      const second = await Booking.create(bookingInput({
        email: "second@example.com",
        timeSlot: new Date(Date.now() + 72 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 73 * 60 * 60 * 1000),
      }));
      await enqueueBookingNotifications({ booking: first, type: "booking_confirmation", includeOwner: false });
      await enqueueBookingNotifications({ booking: second, type: "booking_confirmation", includeOwner: false });

      let sends = 0;
      const resetProvider = setNotificationProviderForTests(async () => {
        sends += 1;
        if (sends === 1) vi.setSystemTime(new Date(Date.now() + 11 * 60 * 1000));
        return { sent: true, messageId: `slow-${sends}@example.com` };
      });
      try {
        const summary = await processNotificationOutbox({
          workerId: "ttl-crossing",
          limit: 2,
          leaseMs: 20 * 60 * 1000,
        });
        expect(summary.sent).toBe(1);
      } finally {
        resetProvider();
      }

      expect(transporter.verify).toHaveBeenCalledTimes(2);
      const records = await NotificationOutbox.find({}).sort({ createdAt: 1 }).lean();
      expect(records.map(({ status, attempts }) => ({ status, attempts }))).toEqual([
        { status: "sent", attempts: 1 },
        { status: "queued", attempts: 0 },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers create and update audits committed with their booking mutation idempotently", async () => {
    const actorId = new mongoose.Types.ObjectId();
    const req = {
      user: { id: actorId, role: "admin", username: "audit-admin@example.com" },
      requestId: "crash-window-audit",
    };

    const created = new Booking(bookingInput({ subject: "Algebra" }));
    const createOperationId = crypto.randomUUID();
    const createIntent = buildBookingNotificationIntents({
      booking: created,
      type: "booking_confirmation",
      includeOwner: false,
      auditCommitOperationId: createOperationId,
    });
    created.pendingAudit = buildPendingBookingAudit({
      req,
      action: "booking.created",
      before: {},
      after: created,
      operationId: createOperationId,
    });
    created.notificationIntents = createIntent;
    await created.save();
    const durableCreate = await Booking.findById(created._id)
      .select("+pendingAudit +notificationIntents +managementTokenHash")
      .lean();
    const serializedAudit = JSON.stringify(durableCreate.pendingAudit);
    expect(Buffer.byteLength(serializedAudit, "utf8")).toBeLessThanOrEqual(64 * 1024);
    expect(serializedAudit).not.toMatch(
      /managementToken|notificationIntents|payloadCiphertext|payloadAuthTag|encryptionKeyVersion/i,
    );
    expect(durableCreate.pendingAudit).toMatchObject({
      operationId: createOperationId,
      action: "booking.created",
      before: {},
      meta: { requestId: "crash-window-audit", entityType: "Booking" },
    });

    const beforeUpdate = created.toObject();
    const updateOperationId = crypto.randomUUID();
    const afterUpdate = { ...beforeUpdate, subject: "Geometria" };
    const pendingUpdate = buildPendingBookingAudit({
      req: { ...req, requestId: "crash-window-update" },
      action: "booking.updated",
      before: beforeUpdate,
      after: afterUpdate,
      operationId: updateOperationId,
    });

    expect((await reconcilePendingBookingAudits()).committed).toBe(1);
    await Booking.collection.updateOne(
      { _id: created._id },
      { $set: { subject: "Geometria", pendingAudit: pendingUpdate } },
    );
    expect((await reconcilePendingBookingAudits()).committed).toBe(1);
    expect((await reconcilePendingBookingAudits()).committed).toBe(0);

    expect(await AuditEvent.countDocuments({ entityId: created._id })).toBe(2);
    const recovered = await Booking.findById(created._id).select("+pendingAudit +notificationIntents").lean();
    expect(recovered.pendingAudit).toBeUndefined();

    await reconcileNotificationIntents({ bookingId: created._id });
    expect(await NotificationOutbox.countDocuments({ booking: created._id })).toBe(1);
  });

  it("keeps the recoverable audit and gated intents intact when recovery auditing fails", async () => {
    const booking = new Booking(bookingInput());
    const operationId = crypto.randomUUID();
    const req = {
      user: { id: new mongoose.Types.ObjectId(), role: "admin", username: "audit-admin@example.com" },
      requestId: "audit-recovery-failure",
    };
    booking.pendingAudit = buildPendingBookingAudit({
      req,
      action: "booking.created",
      before: {},
      after: booking,
      operationId,
    });
    booking.notificationIntents = buildBookingNotificationIntents({
      booking,
      type: "booking_confirmation",
      includeOwner: false,
      auditCommitOperationId: operationId,
    });
    await booking.save();

    const resetWriter = setAuditWriterForTests(async () => { throw new Error("audit down"); });
    try {
      const result = await reconcilePendingBookingAudits();
      expect(result).toMatchObject({ committed: 0, failed: 1 });
    } finally {
      resetWriter();
    }
    await reconcileNotificationIntents({ bookingId: booking._id });
    expect(await AuditEvent.countDocuments()).toBe(0);
    expect(await NotificationOutbox.countDocuments()).toBe(0);
    expect(await Booking.exists({ _id: booking._id, pendingAudit: { $exists: true } })).toBeTruthy();
  });

  it("coalesces startup SMTP verification and does not lease queued mail while health is unknown", async () => {
    let releaseVerification;
    const verificationGate = new Promise((resolve) => { releaseVerification = resolve; });
    const transporter = {
      verify: vi.fn(() => verificationGate),
      sendMail: vi.fn().mockResolvedValue({ messageId: "startup-health@example.com" }),
    };
    setEmailTransporterForTests(transporter);
    resetEmailDeliveryHealthForTests();

    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      includeOwner: false,
    });

    const firstRun = processNotificationOutbox({ workerId: "startup-health-a", limit: 1 });
    const restartedRun = processNotificationOutbox({ workerId: "startup-health-b", limit: 1 });
    await vi.waitFor(() => expect(transporter.verify).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
      status: "queued",
      attempts: 0,
    });
    expect(transporter.sendMail).not.toHaveBeenCalled();

    releaseVerification(true);
    const summaries = await Promise.all([firstRun, restartedRun]);
    expect(summaries.reduce((total, summary) => total + summary.sent, 0)).toBe(1);
    expect(transporter.sendMail).toHaveBeenCalledOnce();
    expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
      status: "sent",
      attempts: 1,
    });
  });

  it("preserves a queued confirmation and its revision across private admin edits", async () => {
    const booking = await Booking.create(bookingInput({
      notificationRevision: 4,
      reminderRevision: 7,
    }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      includeOwner: false,
    });
    const queued = await NotificationOutbox.findOne({ type: "booking_confirmation" }).lean();
    const token = await createAdminToken();

    await request(app)
      .put(`/api/bookings/${booking._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        notes: "Seguimiento interno",
        studentEvolution: "Avance privado",
        emotionalState: "Con confianza",
        price: 18000,
      })
      .expect(200);

    await request(app)
      .patch(`/api/bookings/${booking._id}/attendance`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendanceStatus: "Presente", attendanceNotes: "Llegó a horario" })
      .expect(200);

    const current = await Booking.findById(booking._id).lean();
    expect(current).toMatchObject({ notificationRevision: 4, reminderRevision: 7 });
    expect(await NotificationOutbox.findById(queued._id).lean()).toMatchObject({
      status: "queued",
      bookingRevision: 4,
    });
    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    try {
      await processNotificationOutbox({ workerId: "private-edit", limit: 1 });
    } finally {
      restore();
    }
    expect(provider).toHaveBeenCalledOnce();
  });

  it("replaces a queued confirmation with current client-visible content", async () => {
    const booking = await Booking.create(bookingInput({
      notificationRevision: 2,
      reminderRevision: 3,
    }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      includeOwner: false,
    });
    const original = await NotificationOutbox.findOne({ type: "booking_confirmation" }).lean();
    const token = await createAdminToken();

    await request(app)
      .put(`/api/bookings/${booking._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Física" })
      .expect(200);

    const current = await Booking.findById(booking._id).lean();
    expect(current).toMatchObject({
      notificationRevision: 3,
      reminderRevision: 4,
      subject: "Física",
    });
    expect(await NotificationOutbox.findById(original._id).lean()).toMatchObject({ status: "superseded" });
    expect(await NotificationOutbox.countDocuments({
      booking: booking._id,
      type: "booking_confirmation",
      bookingRevision: 3,
      status: "queued",
    })).toBe(1);

    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    try {
      await processNotificationOutbox({ workerId: "content-replacement", limit: 1 });
    } finally {
      restore();
    }
    expect(provider).toHaveBeenCalledWith(expect.objectContaining({
      recipient: "familia@example.com",
      type: "booking_confirmation",
      booking: expect.objectContaining({ subject: "Física", notificationRevision: 3 }),
    }));
  });

  it("uses an honest pending-update replacement for client-visible edits", async () => {
    const booking = await Booking.create(bookingInput({ status: "Pendiente" }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      includeOwner: false,
    });
    const original = await NotificationOutbox.findOne({ type: "booking_received_pending" }).lean();
    const token = await createAdminToken();

    await request(app)
      .put(`/api/bookings/${booking._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ academicSituation: "Ahora necesita reforzar fracciones" })
      .expect(200);

    const current = await Booking.findById(booking._id).lean();
    expect(current.notificationRevision).toBe(1);
    expect(await NotificationOutbox.findById(original._id).lean()).toMatchObject({ status: "superseded" });
    expect(await NotificationOutbox.findOne({
      booking: booking._id,
      type: "booking_pending_updated",
      bookingRevision: 1,
    }).lean()).toMatchObject({ status: "queued" });
  });

  it("keeps a durable reminder current across management-token rotation", async () => {
    const now = new Date();
    const slot = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const booking = await Booking.create(bookingInput({
      timeSlot: slot,
      endTime: new Date(slot.getTime() + 60 * 60 * 1000),
      notificationRevision: 0,
      reminderRevision: 0,
    }));
    await enqueueBookingNotifications({ booking, type: "booking_reminder", includeOwner: false, now });
    await Booking.collection.updateOne(
      { _id: booking._id },
      { $inc: { notificationRevision: 1 }, $set: { managementTokenRevokedAt: new Date() } },
    );
    const rotated = await Booking.findById(booking._id).lean();
    await enqueueBookingNotifications({ booking: rotated, type: "booking_reminder", includeOwner: false, now });

    expect(rotated.reminderRevision).toBe(0);
    expect(await NotificationOutbox.countDocuments({ booking: booking._id, type: "booking_reminder" })).toBe(1);
    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    try {
      await processNotificationOutbox({ workerId: "rotation-safe-reminder", limit: 1, now });
    } finally {
      restore();
    }
    expect(provider).toHaveBeenCalledOnce();
  });

  it("creates a new reminder revision for content edits without resurrecting a sent artifact", async () => {
    const booking = await Booking.create(bookingInput({ reminderRevision: 0 }));
    await enqueueBookingNotifications({ booking, type: "booking_reminder", includeOwner: false });
    const sent = await NotificationOutbox.findOne({ booking: booking._id });
    await NotificationOutbox.collection.updateOne(
      { _id: sent._id },
      { $set: { status: "sent", sentAt: new Date(), nextAttemptAt: null } },
    );

    const token = await createAdminToken();
    await request(app)
      .put(`/api/bookings/${booking._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Física" })
      .expect(200);

    const current = await Booking.findById(booking._id).lean();
    expect(current.reminderRevision).toBe(1);
    expect(await NotificationOutbox.findById(sent._id).lean()).toMatchObject({ status: "sent" });
    expect(await NotificationOutbox.countDocuments({ booking: booking._id, type: "booking_reminder" })).toBe(2);
    expect(await NotificationOutbox.countDocuments({ booking: booking._id, type: "booking_reminder", status: "queued" })).toBe(1);
  });

  it("rejects a stale reminder snapshot after a concurrent reschedule", async () => {
    const booking = await Booking.create(bookingInput({ reminderRevision: 3 }));
    const stale = booking.toObject();
    const moved = new Date(booking.timeSlot.getTime() + 60 * 60 * 1000);
    await Booking.collection.updateOne(
      { _id: booking._id },
      {
        $set: { timeSlot: moved, endTime: new Date(moved.getTime() + 60 * 60 * 1000) },
        $inc: { reminderRevision: 1, notificationRevision: 1, scheduleRevision: 1 },
      },
    );

    expect(await enqueueBookingNotifications({
      booking: stale,
      type: "booking_reminder",
      includeOwner: false,
    })).toEqual([]);
    expect(await NotificationOutbox.countDocuments({ booking: booking._id })).toBe(0);
    expect((await Booking.findById(booking._id).select("+notificationIntents").lean()).notificationIntents)
      .toHaveLength(0);
  });

  it("orders reminder supersession by reminder revision rather than wall-clock occurrence", async () => {
    const booking = await Booking.create(bookingInput({ reminderRevision: 2 }));
    const newer = buildBookingNotificationIntents({
      booking,
      type: "booking_reminder",
      eventKey: "revision-2",
      includeOwner: false,
      now: new Date("2026-01-01T00:00:00.000Z"),
    })[0];
    const stale = buildBookingNotificationIntents({
      booking: { ...booking.toObject(), reminderRevision: 1 },
      type: "booking_reminder",
      eventKey: "revision-1",
      includeOwner: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    })[0];
    const legacy = buildBookingNotificationIntents({
      booking: { ...booking.toObject(), reminderRevision: 0 },
      type: "booking_reminder",
      eventKey: "legacy-without-reminder-revision",
      includeOwner: false,
      now: new Date("2025-12-31T00:00:00.000Z"),
    })[0];
    delete legacy.reminderRevision;
    await NotificationOutbox.collection.insertOne({
      ...legacy,
      booking: booking._id,
      bookingCode: booking.bookingCode,
      status: "queued",
      eventOccurredAt: legacy.occurredAt,
      attempts: 0,
      nextAttemptAt: legacy.scheduledFor,
    });
    await Booking.collection.updateOne(
      { _id: booking._id },
      { $push: { notificationIntents: { $each: [newer, stale] } } },
    );
    await reconcileNotificationIntents({ bookingId: booking._id });

    expect(await NotificationOutbox.findOne({ reminderRevision: 2 }).lean())
      .toMatchObject({ status: "queued" });
    expect(await NotificationOutbox.findOne({ reminderRevision: 1 }).lean())
      .toMatchObject({ status: "superseded" });
    expect(await NotificationOutbox.collection.findOne({ dedupeKey: legacy.dedupeKey }))
      .toMatchObject({ status: "superseded" });
  });

  it("does not mutate Booking.updatedAt during durable intent bookkeeping", async () => {
    const booking = await Booking.create(bookingInput({ reminderRevision: 0 }));
    const before = booking.updatedAt.getTime();
    await enqueueBookingNotifications({ booking, type: "booking_reminder", includeOwner: false });
    const after = await Booking.findById(booking._id).select("+notificationIntents").lean();
    expect(new Date(after.updatedAt).getTime()).toBe(before);
    expect(after.notificationIntents).toHaveLength(0);

    const compensation = await Booking.updateOne(
      { _id: booking._id, updatedAt: booking.updatedAt },
      { $set: { subject: "Compensado" } },
    );
    expect(compensation.modifiedCount).toBe(1);
  });

  it("auto-finalizes only bookings without active shared mutation fences", async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    const [free, slotLocked, requestLocked, deliveryLocked] = await Booking.create([
      bookingInput({ timeSlot: new Date(past.getTime() - 60_000), endTime: past }),
      bookingInput({ timeSlot: new Date(past.getTime() - 60_000), endTime: past, slotMutationLock: "slot", slotMutationLockExpiresAt: future }),
      bookingInput({ timeSlot: new Date(past.getTime() - 60_000), endTime: past, managementLinkRequestLock: "request", managementLinkRequestLockExpiresAt: future }),
      bookingInput({
        timeSlot: new Date(past.getTime() - 60_000),
        endTime: past,
        notificationDeliveryFence: {
          outboxId: new mongoose.Types.ObjectId(), revision: 0, owner: "provider", expiresAt: future,
        },
      }),
    ]);
    expect(await autoFinalizeBookings({ now: new Date() })).toBe(1);
    expect((await Booking.findById(free._id).lean()).status).toBe("Finalizado");
    for (const booking of [slotLocked, requestLocked, deliveryLocked]) {
      expect((await Booking.findById(booking._id).lean()).status).toBe("Confirmado");
    }

    await Booking.collection.updateMany(
      { _id: { $in: [slotLocked._id, requestLocked._id, deliveryLocked._id] } },
      {
        $unset: {
          slotMutationLock: "",
          slotMutationLockExpiresAt: "",
          managementLinkRequestLock: "",
          managementLinkRequestLockExpiresAt: "",
          notificationDeliveryFence: "",
        },
      },
    );
    expect(await autoFinalizeBookings({ now: new Date() })).toBe(3);
  });

  it("does not auto-finalize soft-deleted bookings or bookings awaiting durable audit reconciliation", async () => {
    const past = new Date(Date.now() - 60_000);
    const deletedAt = new Date(Date.now() - 30_000);
    const [deleted, awaitingAudit] = await Booking.create([
      bookingInput({ timeSlot: new Date(past.getTime() - 60_000), endTime: past, deletedAt }),
      bookingInput({ timeSlot: new Date(past.getTime() - 60_000), endTime: past }),
    ]);
    const operationId = crypto.randomUUID();
    const pendingAudit = buildPendingBookingAudit({
      req: {
        user: { id: new mongoose.Types.ObjectId(), role: "admin", username: "audit-admin" },
        requestId: "auto-finalize-pending-audit",
      },
      action: "booking.updated",
      before: awaitingAudit,
      after: awaitingAudit,
      operationId,
    });
    await Booking.collection.updateOne(
      { _id: awaitingAudit._id },
      { $set: { pendingAudit } },
    );

    expect(await autoFinalizeBookings({ now: new Date() })).toBe(0);

    const unchangedDeleted = await Booking.findById(deleted._id).lean();
    const unchangedAwaitingAudit = await Booking.findById(awaitingAudit._id)
      .select("+pendingAudit")
      .lean();
    expect(unchangedDeleted).toMatchObject({ status: "Confirmado", deletedAt });
    expect(unchangedAwaitingAudit.status).toBe("Confirmado");
    expect(unchangedAwaitingAudit.pendingAudit).toMatchObject({ operationId });
  });

  it("uses the database clock when deciding whether shared mutation fences expired", async () => {
    const databaseNow = new Date();
    const endTime = new Date(databaseNow.getTime() - 60_000);
    const activeUntil = new Date(databaseNow.getTime() + 60_000);
    const appClockSkewedAhead = new Date(databaseNow.getTime() + 24 * 60 * 60 * 1000);
    const guarded = await Booking.create(bookingInput({
      timeSlot: new Date(endTime.getTime() - 60_000),
      endTime,
      slotMutationLock: "active-on-database-clock",
      slotMutationLockExpiresAt: activeUntil,
    }));

    expect(await autoFinalizeBookings({ now: appClockSkewedAhead })).toBe(0);
    expect((await Booking.findById(guarded._id).lean()).status).toBe("Confirmado");
  });

  it("uses the database clock to calculate renewed slot-mutation lease expiry", async () => {
    const realNow = Date.now();
    const lock = crypto.randomUUID();
    const booking = await Booking.create(bookingInput({
      slotMutationLock: lock,
      slotMutationLockExpiresAt: new Date(realNow + SLOT_MUTATION_LOCK_MS),
    }));

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(realNow + 24 * 60 * 60 * 1000));
      const descriptor = { booking, lock };
      await renewSlotMutationLock(descriptor);

      const renewed = await Booking.findById(booking._id)
        .select("+slotMutationLockExpiresAt")
        .lean();
      expect(new Date(renewed.slotMutationLockExpiresAt).getTime())
        .toBeLessThan(realNow + (2 * SLOT_MUTATION_LOCK_MS));
      expect(new Date(descriptor.expiresAt).getTime())
        .toBe(new Date(renewed.slotMutationLockExpiresAt).getTime());
    } finally {
      vi.useRealTimers();
    }
  });
  it("enqueues encrypted deterministic intents idempotently without plaintext PII", async () => {
    const booking = await Booking.create(bookingInput());
    const managementUrl = `https://frontend.example.com/m#token=${"x".repeat(43)}`;
    const managementTokenHash = crypto.createHash("sha256").update("x".repeat(43)).digest("hex");

    await Promise.all(Array.from({ length: 10 }, () => enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      managementUrl,
      eventKey: "created-v1",
      includeOwner: false,
    })));
    expect((await NotificationOutbox.findOne({}).select("+managementTokenFingerprint").lean())
      .managementTokenFingerprint).toBe(managementTokenHash);

    const records = await NotificationOutbox.find({})
      .select("+payloadCiphertext +encryptionKeyVersion")
      .lean();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: "queued",
      type: "booking_confirmation",
      channel: "email",
      bookingCode: booking.bookingCode,
      recipientMasked: "f*****a@example.com",
      attempts: 0,
      maxAttempts: 5,
      templateVersion: 1,
      encryptionKeyVersion: "v1",
    });
    const serialized = JSON.stringify(records[0]);
    expect(serialized).not.toContain("familia@example.com");
    expect(serialized).not.toContain(managementUrl);
    expect(serialized).not.toContain("Alumno Seguro");
  });

  it("marks sent only after provider success and stores the provider id", async () => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      eventKey: "success-v1",
      includeOwner: false,
    });
    const provider = vi.fn().mockResolvedValue({ sent: true, messageId: "<provider-123@example.net>" });
    const restore = setNotificationProviderForTests(provider);
    try {
      const summary = await processNotificationOutbox({ workerId: "worker-success", limit: 5 });
      expect(summary).toMatchObject({ processed: 1, sent: 1, failed: 0, dead: 0 });
    } finally {
      restore();
    }
    const record = await NotificationOutbox.findOne({}).lean();
    expect(record).toMatchObject({
      status: "sent",
      attempts: 1,
      providerMessageId: "provider-123@example.net",
    });
    expect(record.sentAt).toBeInstanceOf(Date);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("backs off failures, sanitizes errors and dead-letters at max attempts", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_cancelled",
      eventKey: "failure-v1",
      includeOwner: false,
      maxAttempts: 2,
    });
    const smtpRejection = new Error("SMTP\nsecret-token=abc");
    smtpRejection.code = "EENVELOPE";
    smtpRejection.command = "RCPT TO";
    smtpRejection.responseCode = 450;
    const provider = vi.fn().mockRejectedValue(smtpRejection);
    const restore = setNotificationProviderForTests(provider);
    try {
      const first = await processNotificationOutbox({ workerId: "worker-fail-1", limit: 1 });
      expect(first).toMatchObject({ processed: 1, failed: 1, dead: 0 });
      let record = await NotificationOutbox.findOne({}).lean();
      expect(record.status).toBe("failed");
      expect(record).toMatchObject({
        errorCategory: "provider",
        lastError: "El proveedor no confirmó la entrega.",
      });
      expect(record.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

      await NotificationOutbox.updateOne({}, { $set: { nextAttemptAt: new Date(0) } });
      const second = await processNotificationOutbox({ workerId: "worker-fail-2", limit: 1 });
      expect(second).toMatchObject({ processed: 1, failed: 0, dead: 1 });
      record = await NotificationOutbox.findOne({}).lean();
      expect(record).toMatchObject({ status: "dead", attempts: 2 });
      expect(record.nextAttemptAt).toBeNull();
    } finally {
      restore();
    }
  });

  it.each([
    ["ETIMEDOUT", "CONN", "failed"],
    ["ECONNECTION", "CONN", "failed"],
    ["ESOCKET", "CONN", "failed"],
    ["ECONNRESET", "CONN", "failed"],
    ["EMESSAGE", "DATA", "delivery_unknown"],
  ])("classifies Nodemailer failure %s/%s at the SMTP stage boundary", async (code, command, expectedStatus) => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      eventKey: `ambiguous-${code}-${command}`,
      includeOwner: false,
    });
    const smtpError = new Error(`native Nodemailer ${code}`);
    smtpError.code = code;
    smtpError.command = command;
    const provider = vi.fn().mockRejectedValue(smtpError);
    const restore = setNotificationProviderForTests(provider);
    try {
      const summary = await processNotificationOutbox({ workerId: `worker-${code}`, limit: 1 });
      expect(summary).toMatchObject({
        processed: 1,
        failed: expectedStatus === "failed" ? 1 : 0,
        dead: 0,
        deliveryUnknown: expectedStatus === "delivery_unknown" ? 1 : 0,
      });
    } finally {
      restore();
    }
    expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
      status: expectedStatus,
      attempts: 1,
      failureDisposition: expectedStatus === "failed" ? "retryable" : "ambiguous",
    });
  });

  it("normalizes RFC Message-ID and uses a deterministic safe fallback for invalid provider values", async () => {
    const firstBooking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking: firstBooking,
      type: "booking_confirmation",
      eventKey: "message-id-rfc",
      includeOwner: false,
    });
    let provider = vi.fn().mockResolvedValue({
      sent: true,
      messageId: "\r\n<safe.id+tag@example.org>\u0000",
    });
    let restore = setNotificationProviderForTests(provider);
    try {
      await processNotificationOutbox({ workerId: "message-id-rfc", limit: 1 });
    } finally {
      restore();
    }
    expect(await NotificationOutbox.findOne({ booking: firstBooking._id }).lean()).toMatchObject({
      providerMessageId: "safe.id+tag@example.org",
    });

    const secondBooking = await Booking.create(bookingInput({ email: "second@example.com" }));
    await enqueueBookingNotifications({
      booking: secondBooking,
      type: "booking_confirmation",
      eventKey: "message-id-fallback",
      includeOwner: false,
    });
    const pending = await NotificationOutbox.findOne({ booking: secondBooking._id })
      .select("+dedupeKey")
      .lean();
    provider = vi.fn().mockResolvedValue({ sent: true, messageId: "<not-an-address>" });
    restore = setNotificationProviderForTests(provider);
    try {
      await processNotificationOutbox({ workerId: "message-id-fallback", limit: 1 });
    } finally {
      restore();
    }
    expect(await NotificationOutbox.findById(pending._id).lean()).toMatchObject({
      providerMessageId: `${pending.dedupeKey}@outbox.tuprofesorparticular.com.ar`,
    });
  });

  it("quarantines expired leases and prevents concurrent double delivery", async () => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_rescheduled",
      eventKey: "lease-v1",
      includeOwner: false,
    });
    await NotificationOutbox.updateOne({}, {
      $set: {
        status: "processing",
        leaseOwner: "crashed-worker",
        leaseExpiresAt: new Date(Date.now() - 1000),
      },
    });
    const provider = vi.fn().mockResolvedValue({ sent: true, messageId: "must-not-send" });
    const restore = setNotificationProviderForTests(provider);
    try {
      const [first, second] = await Promise.all([
        processNotificationOutbox({ workerId: "recovery-a", limit: 1 }),
        processNotificationOutbox({ workerId: "recovery-b", limit: 1 }),
      ]);
      expect(first.processed + second.processed).toBe(0);
    } finally {
      restore();
    }
    expect(provider).not.toHaveBeenCalled();
    expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
      status: "delivery_unknown",
    });
  });

  it("fails closed without a valid keyring and rejects tampered ciphertext", async () => {
    const booking = await Booking.create(bookingInput());
    const previousKeys = process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS;
    delete process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS;
    try {
      await expect(enqueueBookingNotifications({
        booking,
        type: "booking_confirmation",
        eventKey: "missing-key-v1",
        includeOwner: false,
      })).rejects.toThrow(/keyring/i);
    } finally {
      process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = previousKeys;
    }
    expect(await NotificationOutbox.countDocuments({})).toBe(0);

    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      eventKey: "tamper-v1",
      includeOwner: false,
    });
    const stored = await NotificationOutbox.findOne({}).select("+payloadCiphertext").lean();
    const replacement = stored.payloadCiphertext.startsWith("A") ? "B" : "A";
    await NotificationOutbox.collection.updateOne(
      { _id: stored._id },
      { $set: { payloadCiphertext: replacement + stored.payloadCiphertext.slice(1) } },
    );
    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    try {
      const summary = await processNotificationOutbox({ workerId: "tamper-worker", limit: 1 });
      expect(summary).toMatchObject({ processed: 1, sent: 0, failed: 1 });
    } finally {
      restore();
    }
    expect(provider).not.toHaveBeenCalled();
    expect(await NotificationOutbox.findById(stored._id).lean()).toMatchObject({
      status: "failed",
      errorCategory: "security",
      lastError: "El contenido protegido no pudo validarse.",
    });
  });

  it("reports readiness as unavailable when notification encryption is not configured", async () => {
    await request(app)
      .get("/ready")
      .expect(200)
      .expect(({ body }) => expect(body.notifications.configured).toBe(true));
    const previousKeys = process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS;
    delete process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS;
    try {
      await request(app)
        .get("/ready")
        .expect(503)
        .expect(({ body }) => {
          expect(body.status).toBe("not_ready");
          expect(body.notifications).toEqual({ configured: false, activeVersion: null });
        });
    } finally {
      process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = previousKeys;
    }
  });

  it("reports readiness as unavailable when mail delivery configuration is missing", async () => {
    const previousUser = process.env.EMAIL_USER;
    const previousPass = process.env.EMAIL_PASS;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    try {
      await request(app)
        .get("/ready")
        .expect(503)
        .expect(({ body }) => {
          expect(body.status).toBe("not_ready");
          expect(body.email).toEqual({
            configured: false,
            userConfigured: false,
            passwordConfigured: false,
            transporterConfigured: false,
            verified: false,
            status: "unconfigured",
            checkedAt: null,
            expiresAt: null,
          });
        });
    } finally {
      process.env.EMAIL_USER = previousUser;
      process.env.EMAIL_PASS = previousPass;
    }

    await request(app)
      .get("/ready")
      .expect(200)
      .expect(({ body }) => expect(body.email).toEqual({
        configured: true,
        userConfigured: true,
        passwordConfigured: true,
        transporterConfigured: true,
        verified: true,
        status: "healthy",
        checkedAt: expect.any(String),
        expiresAt: expect.any(String),
      }));
  });

  it("uses cached SMTP verification for readiness and fails closed on failure, timeout or stale state", async () => {
    const healthy = { verify: vi.fn().mockResolvedValue(true), sendMail: vi.fn() };
    setEmailTransporterForTests(healthy);
    resetEmailDeliveryHealthForTests();
    await refreshEmailDeliveryHealth({ force: true, timeoutMs: 50, ttlMs: 1000 });
    await request(app).get("/ready").expect(200);
    await request(app).get("/ready").expect(200);
    expect(healthy.verify).toHaveBeenCalledTimes(1);

    const rejected = new Error("535 credentials secret-password");
    rejected.code = "EAUTH";
    const unhealthy = { verify: vi.fn().mockRejectedValue(rejected), sendMail: vi.fn() };
    setEmailTransporterForTests(unhealthy);
    resetEmailDeliveryHealthForTests();
    await refreshEmailDeliveryHealth({ force: true, timeoutMs: 50, ttlMs: 1000 });
    await request(app).get("/ready").expect(503).expect(({ body }) => {
      expect(body.email.status).toBe("unhealthy");
      expect(JSON.stringify(body.email)).not.toContain("secret-password");
    });

    const hanging = { verify: vi.fn(() => new Promise(() => {})), sendMail: vi.fn() };
    setEmailTransporterForTests(hanging);
    resetEmailDeliveryHealthForTests();
    await refreshEmailDeliveryHealth({ force: true, timeoutMs: 5, ttlMs: 1000 });
    await request(app).get("/ready").expect(503).expect(({ body }) => {
      expect(body.email.status).toBe("timeout");
    });

    setEmailTransporterForTests(healthy);
    resetEmailDeliveryHealthForTests();
    await refreshEmailDeliveryHealth({ force: true, timeoutMs: 50, ttlMs: 1 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await request(app).get("/ready").expect(503).expect(({ body }) => {
      expect(body.email.status).toBe("stale");
    });

    resetEmailDeliveryHealthForTests();
    setEmailTransporterForTests(healthy);
    await refreshEmailDeliveryHealth({ force: true, timeoutMs: 50 });
  });

  it("quarantines an ambiguous timeout and ignores a late provider success", async () => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      eventKey: "ambiguous-timeout",
      includeOwner: false,
    });
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const provider = vi.fn(async (payload) => {
      expect(payload.correlationKey).toMatch(/^[a-f0-9]{64}$/u);
      expect(payload).not.toHaveProperty("idempotencyKey");
      await gate;
      return { sent: true, messageId: "late-provider-success" };
    });
    const restore = setNotificationProviderForTests(provider);
    try {
      const summary = await processNotificationOutbox({
        workerId: "ambiguous-worker",
        limit: 1,
        leaseMs: 100,
        providerTimeoutMs: 25,
      });
      expect(summary).toMatchObject({ processed: 1, deliveryUnknown: 1, sent: 0, failed: 0 });
      expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
        status: "delivery_unknown",
        attempts: 1,
        providerMessageId: null,
        errorCategory: "provider",
      });
      release();
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
        status: "delivery_unknown",
        providerMessageId: null,
      });
      const token = await createAdminToken();
      const record = await NotificationOutbox.findOne({}).lean();
      await request(app)
        .get(`/api/notifications/${record._id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => expect(body.data.retryable).toBe(false));
      await processNotificationOutbox({ workerId: "must-not-retry", limit: 1 });
      expect(provider).toHaveBeenCalledTimes(1);
    } finally {
      release?.();
      restore();
    }
  });

  it("retains the delivery fence after an ambiguous timeout until its bounded expiry", async () => {
    const token = await createAdminToken();
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      eventKey: "ambiguous-timeout-fence",
      includeOwner: false,
    });
    let releaseSend;
    let signalSend;
    const sendGate = new Promise((resolve) => { releaseSend = resolve; });
    const sendReached = new Promise((resolve) => { signalSend = resolve; });
    const restore = setNotificationProviderForTests(async () => ({
      send: async () => {
        signalSend();
        await sendGate;
        return { sent: true, messageId: "late-fenced@example.net" };
      },
    }), { stage: "preflight" });
    try {
      const worker = processNotificationOutbox({
        workerId: "ambiguous-fence-owner",
        limit: 1,
        leaseMs: 100,
        providerTimeoutMs: 25,
      });
      await sendReached;
      await expect(worker).resolves.toMatchObject({ deliveryUnknown: 1, sent: 0 });

      const fenced = await Booking.findById(booking._id)
        .select("+notificationDeliveryFence")
        .lean();
      expect(fenced.notificationDeliveryFence).toMatchObject({
        owner: "ambiguous-fence-owner",
      });
      expect(fenced.notificationDeliveryFence.expiresAt.getTime()).toBeGreaterThan(Date.now());

      await request(app)
        .put(`/api/bookings/${booking._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "Cancelado" })
        .expect(409);

      releaseSend();
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
        status: "delivery_unknown",
        providerMessageId: null,
      });
      expect((await Booking.findById(booking._id)
        .select("+notificationDeliveryFence")
        .lean()).notificationDeliveryFence).toMatchObject({ owner: "ambiguous-fence-owner" });

      await Booking.collection.updateOne(
        { _id: booking._id },
        { $set: { "notificationDeliveryFence.expiresAt": new Date(0) } },
      );
      await request(app)
        .put(`/api/bookings/${booking._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "Cancelado" })
        .expect(200);
    } finally {
      releaseSend?.();
      restore();
    }
  });

  it("renews a per-record lease during a slow provider call", async () => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      eventKey: "heartbeat",
      includeOwner: false,
    });
    let release;
    let entered;
    const gate = new Promise((resolve) => { release = resolve; });
    const providerEntered = new Promise((resolve) => { entered = resolve; });
    const provider = vi.fn(async () => {
      entered();
      await gate;
      return { sent: true, messageId: "heartbeat-success" };
    });
    const restore = setNotificationProviderForTests(provider);
    try {
      const first = processNotificationOutbox({
        workerId: "heartbeat-a",
        limit: 1,
        leaseMs: 90,
        providerTimeoutMs: 1000,
      });
      await providerEntered;
      await new Promise((resolve) => setTimeout(resolve, 180));
      const second = await processNotificationOutbox({
        workerId: "heartbeat-b",
        limit: 1,
        leaseMs: 90,
        providerTimeoutMs: 1000,
      });
      expect(second.processed).toBe(0);
      expect(provider).toHaveBeenCalledTimes(1);
      release();
      await first;
    } finally {
      release?.();
      restore();
    }
    expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
      status: "sent",
      attempts: 1,
    });
  });

  it("quarantines a crashed in-flight delivery instead of sending it twice", async () => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      eventKey: "crash-boundary",
      includeOwner: false,
    });
    await NotificationOutbox.updateOne({}, {
      $set: {
        status: "processing",
        attempts: 1,
        leaseOwner: "crashed-after-provider-acceptance",
        leaseExpiresAt: new Date(0),
      },
    });
    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    try {
      const result = await processNotificationOutbox({ workerId: "replacement", limit: 1 });
      expect(result.processed).toBe(0);
    } finally {
      restore();
    }
    expect(provider).not.toHaveBeenCalled();
    expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
      status: "delivery_unknown",
      attempts: 1,
    });
  });

  it("supersedes overdue or finalized reminders before provider delivery", async () => {
    const now = new Date();
    const overdue = await Booking.create(bookingInput({
      timeSlot: new Date(now.getTime() + 10 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 11 * 60 * 60 * 1000),
    }));
    const finalized = await Booking.create(bookingInput({
      email: "other@example.com",
      status: "Finalizado",
      timeSlot: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 25 * 60 * 60 * 1000),
    }));
    await enqueueBookingNotifications({ booking: overdue, type: "booking_reminder", includeOwner: false });
    await enqueueBookingNotifications({ booking: finalized, type: "booking_reminder", includeOwner: false });
    await NotificationOutbox.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    try {
      const result = await processNotificationOutbox({ workerId: "reminder-validity", limit: 5 });
      expect(result).toMatchObject({ processed: 1, sent: 0, superseded: 2 });
    } finally {
      restore();
    }
    expect(provider).not.toHaveBeenCalled();
    expect(await NotificationOutbox.countDocuments({ status: "superseded" })).toBe(2);
  });

  it("coordinates retry with terminal payload purge and never queues an empty payload", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_cancelled",
      eventKey: "retry-purge-race",
      includeOwner: false,
    });
    const item = await NotificationOutbox.findOneAndUpdate({}, {
      $set: {
        status: "dead",
        attempts: 1,
        errorCategory: "provider",
        failureDisposition: "retryable",
        lastError: "El proveedor no confirmÃ³ la entrega.",
        payloadPurgeAt: new Date(0),
      },
    }, { new: true });
    const token = await createAdminToken();
    const [, retryResponse] = await Promise.all([
      processNotificationOutbox({ workerId: "purger", limit: 1 }),
      request(app)
        .post(`/api/notifications/${item._id}/retry`)
        .set("Authorization", `Bearer ${token}`),
    ]);
    expect([200, 409]).toContain(retryResponse.status);
    const stored = await NotificationOutbox.findById(item._id)
      .select("+payloadCiphertext +payloadPurgeAt +payloadPurgedAt")
      .lean();
    if (stored.status === "queued") {
      expect(stored.payloadCiphertext).toBeTruthy();
      expect(stored.payloadPurgeAt).toBeFalsy();
      expect(stored.payloadPurgedAt).toBeFalsy();
    } else {
      expect(stored.status).toBe("dead");
      expect(stored.payloadPurgedAt).toBeInstanceOf(Date);
    }
  });

  it("coalesces overlapping local runner calls into single-flight", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const processor = vi.fn(async () => {
      await gate;
      return { processed: 0 };
    });
    const run = createNotificationOutboxRunner({ processor });
    const first = run();
    const second = run();
    expect(processor).toHaveBeenCalledTimes(1);
    release();
    await expect(first).resolves.toEqual({ processed: 0 });
    await expect(second).resolves.toEqual({ processed: 0 });
  });

  it("protects admin list/detail DTOs and audits explicit retry", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_cancelled",
      eventKey: "admin-v1",
      includeOwner: false,
      maxAttempts: 1,
    });
    const item = await NotificationOutbox.findOneAndUpdate({}, {
      $set: {
        status: "dead",
        attempts: 1,
        errorCategory: "provider",
        failureDisposition: "retryable",
        lastError: "El proveedor no confirmÃ³ la entrega.",
      },
    }, { new: true });

    await request(app).get("/api/notifications").expect(401);
    const token = await createAdminToken();
    const list = await request(app)
      .get("/api/notifications?page=1&limit=20&status=dead&type=booking_cancelled")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body.data.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(list.body.data.items[0]).toMatchObject({
      id: String(item._id),
      status: "dead",
      type: "booking_cancelled",
      channel: "email",
      booking: { id: String(booking._id), bookingCode: booking.bookingCode },
      recipient: { masked: "f*****a@example.com" },
      attempts: 1,
      maxAttempts: 1,
      lastError: {
        category: "provider",
        message: "El proveedor no confirmÃ³ la entrega.",
      },
      retryable: true,
    });
    expect(JSON.stringify(list.body)).not.toMatch(/familia@example\.com|payload|Cipher|recipientHash|leaseOwner/i);

    await request(app)
      .post(`/api/notifications/${item._id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.data.retryable).toBe(false));
    expect(await NotificationOutbox.findById(item._id).lean()).toMatchObject({
      status: "queued",
      attempts: 0,
      lastError: "",
      errorCategory: "",
    });
    expect(await AuditEvent.countDocuments({
      action: "notification.retry.committed",
      entityId: item._id,
    })).toBe(1);

    await request(app)
      .post(`/api/notifications/${item._id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("NOTIFICATION_NOT_RETRYABLE"));
  });

  it("never offers or accepts a retry after the booking lifecycle or notification TTL expires", async () => {
    const booking = await Booking.create(bookingInput({ status: "Finalizado" }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      eventKey: "terminal-retry",
      includeOwner: false,
    });
    const item = await NotificationOutbox.findOneAndUpdate({}, {
      $set: {
        status: "dead",
        attempts: 1,
        errorCategory: "provider",
        failureDisposition: "retryable",
        lastError: "El proveedor no confirmÃ³ la entrega.",
      },
    }, { new: true });
    const token = await createAdminToken();
    await request(app)
      .get(`/api/notifications/${item._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.retryable).toBe(false);
        expect(new Date(body.data.expiresAt).toISOString()).toBe(booking.timeSlot.toISOString());
      });
    await request(app)
      .post(`/api/notifications/${item._id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("NOTIFICATION_NOT_RETRYABLE"));

    await Booking.updateOne({ _id: booking._id }, { $set: { status: "Cancelado" } });
    await NotificationOutbox.collection.updateOne(
      { _id: item._id },
      { $set: { type: "booking_cancelled", expiresAt: new Date(0) } },
    );
    await request(app)
      .get(`/api/notifications/${item._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.data.retryable).toBe(false));
  });

  it("recovers notification intents committed inside Booking after a process crash", async () => {
    const booking = await Booking.create(bookingInput());
    const intents = buildBookingNotificationIntents({
      booking,
      type: "booking_confirmation",
      eventKey: "atomic-booking-write",
      includeOwner: false,
    });
    await Booking.updateOne(
      { _id: booking._id },
      { $set: { notificationIntents: intents } },
    );
    expect(await NotificationOutbox.countDocuments({})).toBe(0);

    await reconcileNotificationIntents({ bookingId: booking._id });

    expect(await NotificationOutbox.countDocuments({
      booking: booking._id,
      type: "booking_confirmation",
    })).toBe(1);
    const recovered = await Booking.findById(booking._id)
      .select("+notificationIntents")
      .lean();
    expect(recovered.notificationIntents).toEqual([]);
  });

  it("quarantines an exhausted expired lease without calling the provider", async () => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      eventKey: "exhausted-lease",
      includeOwner: false,
      maxAttempts: 1,
    });
    await NotificationOutbox.updateOne({}, {
      $set: {
        status: "processing",
        attempts: 1,
        leaseOwner: "dead-worker",
        leaseExpiresAt: new Date(0),
      },
    });
    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    try {
      const result = await processNotificationOutbox({ workerId: "replacement", limit: 1 });
      expect(result.processed).toBe(0);
    } finally {
      restore();
    }
    expect(provider).not.toHaveBeenCalled();
    expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
      status: "delivery_unknown",
      attempts: 1,
      errorCategory: "provider",
    });
  });

  it("keeps retry state unchanged when the mandatory audit cannot be persisted", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_cancelled",
      eventKey: "audit-before-retry",
      includeOwner: false,
      maxAttempts: 1,
    });
    const item = await NotificationOutbox.findOneAndUpdate({}, {
      $set: {
        status: "dead",
        attempts: 1,
        errorCategory: "provider",
        failureDisposition: "retryable",
        lastError: "El proveedor no confirmÃ³ la entrega.",
      },
    }, { new: true });
    const token = await createAdminToken();
    const saveSpy = vi.spyOn(AuditEvent.prototype, "save")
      .mockRejectedValueOnce(new Error("audit unavailable"));
    try {
      await request(app)
        .post(`/api/notifications/${item._id}/retry`)
        .set("Authorization", `Bearer ${token}`)
        .expect(500);
    } finally {
      saveSpy.mockRestore();
    }
    expect(await NotificationOutbox.findById(item._id).lean()).toMatchObject({
      status: "dead",
      attempts: 1,
      errorCategory: "provider",
    });
  });

  it("keeps a failed retry saga operation immutable until its terminal audit is archived", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_cancelled",
      eventKey: "retry-final-cas",
      includeOwner: false,
      maxAttempts: 1,
    });
    const item = await NotificationOutbox.findOneAndUpdate({}, { $set: {
      status: "dead", attempts: 1, errorCategory: "provider",
      failureDisposition: "retryable", lastError: "Proveedor no disponible.",
    } }, { new: true });
    const token = await createAdminToken();
    const original = NotificationOutbox.findOneAndUpdate.bind(NotificationOutbox);
    const spy = vi.spyOn(NotificationOutbox, "findOneAndUpdate")
      .mockImplementation((filter, update, options) => {
        if (update?.$set?.status === "queued") throw new Error("final CAS unavailable");
        return original(filter, update, options);
      });
    try {
      await request(app)
        .post(`/api/notifications/${item._id}/retry`)
        .set("Authorization", `Bearer ${token}`)
        .expect(500);
    } finally {
      spy.mockRestore();
    }
    const failedSaga = await NotificationOutbox.findById(item._id)
      .select("+retryOperationId +retryOperationState")
      .lean();
    expect(failedSaga).toMatchObject({ status: "dead", retryOperationState: "failed" });
    expect(failedSaga.retryOperationId).toMatch(/^[0-9a-f-]{36}$/u);

    const failedOperationId = failedSaga.retryOperationId;
    const auditSpy = vi.spyOn(AuditEvent.prototype, "save")
      .mockRejectedValue(new Error("terminal audit unavailable"));
    try {
      await request(app)
        .post(`/api/notifications/${item._id}/retry`)
        .set("Authorization", `Bearer ${token}`)
        .expect(409);
    } finally {
      auditSpy.mockRestore();
    }
    const stillFailed = await NotificationOutbox.findById(item._id)
      .select("+retryOperationId +retryOperationState")
      .lean();
    expect(stillFailed.retryOperationState).toBe("failed");
    expect(stillFailed.retryOperationId).toBe(failedOperationId);

    await request(app)
      .post(`/api/notifications/${item._id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(await AuditEvent.countDocuments({
      entityId: item._id,
      action: "notification.retry.failed",
    })).toBeGreaterThanOrEqual(1);
  });

  it("retries a failed terminal audit after restart without starving later sagas", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    const actorId = new mongoose.Types.ObjectId();
    const documents = Array.from({ length: 3 }, (_, index) => {
      const intent = buildBookingNotificationIntents({
        booking,
        type: "booking_cancelled",
        eventKey: `failed-terminal-${index}`,
        includeOwner: false,
      })[0];
      return {
        booking: booking._id,
        bookingCode: booking.bookingCode,
        status: "dead",
        type: intent.type,
        channel: intent.channel,
        recipientKind: intent.recipientKind,
        recipientMasked: intent.recipientMasked,
        templateVersion: intent.templateVersion,
        eventId: intent.eventId,
        eventOccurredAt: intent.occurredAt,
        dedupeKey: intent.dedupeKey,
        payloadCiphertext: intent.payloadCiphertext,
        payloadIv: intent.payloadIv,
        payloadAuthTag: intent.payloadAuthTag,
        encryptionKeyVersion: intent.encryptionKeyVersion,
        attempts: 5,
        maxAttempts: 5,
        nextAttemptAt: null,
        expiresAt: intent.expiresAt,
        failureDisposition: "retryable",
        retryOperationId: crypto.randomUUID(),
        retryOperationState: "failed",
        retryRequestedAt: new Date(Date.now() - 10 * 60 * 1000),
        retryActorId: actorId,
        retryActorRole: "admin",
        retryActorUsername: "recovery@example.com",
        retryRequestId: `failed-terminal-${index}`,
      };
    });
    await NotificationOutbox.collection.insertMany(documents);

    const saveSpy = vi.spyOn(AuditEvent.prototype, "save")
      .mockRejectedValueOnce(new Error("audit fails once"));
    try {
      await expect(reconcileRetrySagas()).resolves.toBeUndefined();
    } finally {
      saveSpy.mockRestore();
    }
    expect(await NotificationOutbox.countDocuments({ retryOperationState: "archived" })).toBe(2);
    expect(await NotificationOutbox.countDocuments({ retryOperationState: "failed" })).toBe(1);

    await reconcileRetrySagas();
    expect(await NotificationOutbox.countDocuments({ retryOperationState: "archived" })).toBe(3);
    expect(await AuditEvent.countDocuments({ action: "notification.retry.failed" })).toBe(3);
  });

  it("reconciles stale requested and committed retry saga audit states", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    await enqueueBookingNotifications({
      booking, type: "booking_cancelled", eventKey: "stale-retry-saga", includeOwner: false, maxAttempts: 1,
    });
    const item = await NotificationOutbox.findOneAndUpdate({}, { $set: {
      status: "dead", attempts: 1, errorCategory: "provider", failureDisposition: "retryable",
    } }, { new: true });
    const token = await createAdminToken();
    const admin = await User.findOne({ username: "notifications-admin@example.com" }).lean();
    const operationId = crypto.randomUUID();
    await NotificationOutbox.collection.updateOne({ _id: item._id }, { $set: {
      retryOperationId: operationId,
      retryOperationState: "requested",
      retryRequestedAt: new Date(Date.now() - 10 * 60 * 1000),
      retryActorId: admin._id,
      retryActorRole: "admin",
      retryActorUsername: admin.username,
      retryRequestId: "stale-request",
    } });
    await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`).expect(200);
    expect(await NotificationOutbox.findById(item._id).select("+retryOperationState").lean())
      .toMatchObject({ retryOperationState: "archived", status: "dead" });
    expect(await AuditEvent.countDocuments({ action: "notification.retry.failed", operationId })).toBe(1);

    const committedOperationId = crypto.randomUUID();
    await NotificationOutbox.collection.updateOne({ _id: item._id }, { $set: {
      status: "queued",
      retryOperationId: committedOperationId,
      retryOperationState: "committed",
      retryActorId: admin._id,
      retryActorRole: "admin",
      retryActorUsername: admin.username,
      retryRequestId: "committed-request",
    } });
    await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`).expect(200);
    expect(await AuditEvent.countDocuments({
      action: "notification.retry.committed", operationId: committedOperationId,
    })).toBe(1);
  });

  it("quarantines accepted delivery when the final sent write loses its CAS", async () => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({ booking, type: "booking_confirmation", includeOwner: false });
    const restoreProvider = setNotificationProviderForTests(vi.fn().mockResolvedValue({
      sent: true,
      messageId: "accepted@example.net",
    }));
    const original = NotificationOutbox.collection.updateOne.bind(NotificationOutbox.collection);
    const updateSpy = vi.spyOn(NotificationOutbox.collection, "updateOne")
      .mockImplementation((filter, update, options) => {
        if (update?.$set?.status === "sent") return Promise.resolve({ modifiedCount: 0 });
        return original(filter, update, options);
      });
    try {
      const summary = await processNotificationOutbox({ workerId: "accepted-cas", limit: 1 });
      expect(summary).toMatchObject({ sent: 0, deliveryUnknown: 1 });
    } finally {
      updateSpy.mockRestore();
      restoreProvider();
    }
    expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({
      status: "delivery_unknown",
      failureDisposition: "ambiguous",
      nextAttemptAt: null,
    });
  });

  it("uses SMTP command stage before socket code", () => {
    for (const command of ["CONN", "EHLO", "AUTH", "MAIL FROM", "RCPT TO", "STARTTLS"]) {
      expect(classifyProviderOutcome({ code: "ETIMEDOUT", command })).toBe("retryable");
    }
    expect(classifyProviderOutcome({ code: "ETIMEDOUT", command: "DATA" })).toBe("delivery_unknown");
    expect(classifyProviderOutcome({ code: "ETIMEDOUT" })).toBe("delivery_unknown");
  });

  it("classifies explicit SMTP responses before transport ambiguity", () => {
    for (const command of ["CONN", "AUTH", "RCPT TO", "DATA", "DOT", "POST-DATA"]) {
      expect(classifyProviderOutcome({ code: "ETIMEDOUT", command, responseCode: 421 })).toBe("retryable");
      expect(classifyProviderOutcome({ code: "ECONNRESET", command, responseCode: 550 })).toBe("terminal");
    }
    expect(classifyProviderOutcome({ code: "ETIMEDOUT", command: "DATA" })).toBe("delivery_unknown");
    expect(classifyProviderOutcome({ code: "ECONNRESET", command: "DOT" })).toBe("delivery_unknown");
  });

  it("keeps preflight failures before provider_started and safely retries configuration", async () => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({ booking, type: "booking_confirmation", includeOwner: false });
    const configurationError = Object.assign(new Error("Email delivery is not configured."), {
      code: "EMAIL_CONFIGURATION_ERROR",
    });
    const restore = setNotificationProviderForTests(
      vi.fn().mockRejectedValue(configurationError),
      { stage: "preflight" },
    );
    try {
      const summary = await processNotificationOutbox({ workerId: "preflight-config", limit: 1 });
      expect(summary).toMatchObject({ failed: 1, deliveryUnknown: 0 });
    } finally {
      restore();
    }
    const stored = await NotificationOutbox.findOne({})
      .select("+deliveryPhase +payloadCiphertext")
      .lean();
    expect(stored).toMatchObject({
      status: "failed",
      failureDisposition: "configuration",
      errorCategory: "configuration",
    });
    expect(stored.deliveryPhase).toBeUndefined();
    expect(stored.payloadCiphertext).toBeTruthy();
  });

  it("lets cancellation commit before the delivery fence and never sends the stale payload", async () => {
    const token = await createAdminToken();
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      includeOwner: false,
      eventKey: "cancel-before-fence",
    });
    let releasePreflight;
    let signalPreflight;
    const preflightGate = new Promise((resolve) => { releasePreflight = resolve; });
    const preflightReached = new Promise((resolve) => { signalPreflight = resolve; });
    const send = vi.fn().mockResolvedValue({ sent: true, messageId: "stale@example.net" });
    const restore = setNotificationProviderForTests(async () => {
      signalPreflight();
      await preflightGate;
      return { send };
    }, { stage: "preflight" });
    try {
      const worker = processNotificationOutbox({ workerId: "cancel-before-fence", limit: 1 });
      await preflightReached;
      await request(app)
        .put(`/api/bookings/${booking._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "Cancelado" })
        .expect(200);
      releasePreflight();
      expect(await worker).toMatchObject({ sent: 0 });
    } finally {
      releasePreflight?.();
      restore();
    }
    expect(send).not.toHaveBeenCalled();
    expect(await NotificationOutbox.countDocuments({
      booking: booking._id,
      type: "booking_confirmation",
      status: "superseded",
    })).toBe(1);
  });

  it("blocks cancellation at provider boundary, releases the fence, and allows bounded retry", async () => {
    const token = await createAdminToken();
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      includeOwner: false,
      eventKey: "fence-before-cancel",
    });
    let releaseSend;
    let signalSend;
    const sendGate = new Promise((resolve) => { releaseSend = resolve; });
    const sendReached = new Promise((resolve) => { signalSend = resolve; });
    const restore = setNotificationProviderForTests(async () => ({
      send: async () => {
        signalSend();
        await sendGate;
        return { sent: true, messageId: "fenced@example.net" };
      },
    }), { stage: "preflight" });
    try {
      const worker = processNotificationOutbox({ workerId: "fence-before-cancel", limit: 1 });
      await sendReached;
      await request(app)
        .put(`/api/bookings/${booking._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "Cancelado" })
        .expect(409);
      releaseSend();
      expect(await worker).toMatchObject({ sent: 1 });
      await request(app)
        .put(`/api/bookings/${booking._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "Cancelado" })
        .expect(200);
    } finally {
      releaseSend?.();
      restore();
    }
    const current = await Booking.findById(booking._id)
      .select("+notificationDeliveryFence")
      .lean();
    expect(current.status).toBe("Cancelado");
    expect(current.notificationDeliveryFence).toBeUndefined();
  });

  it("purges forensic delivery-unknown payloads after bounded retention", async () => {
    const booking = await Booking.create(bookingInput());
    await enqueueBookingNotifications({ booking, type: "booking_confirmation", includeOwner: false });
    await NotificationOutbox.collection.updateOne({}, {
      $set: {
        status: "delivery_unknown",
        failureDisposition: "ambiguous",
        payloadPurgeAt: new Date(0),
        recipientHash: crypto.createHash("sha256").update(booking.email).digest("hex"),
      },
    });
    await processNotificationOutbox({ limit: 1 });
    const stored = await NotificationOutbox.findOne({})
      .select("+payloadCiphertext +payloadPurgedAt")
      .lean();
    expect(stored.payloadCiphertext).toBeUndefined();
    expect(stored.recipientHash).toBeUndefined();
    expect(stored.recipientMasked).toBe("***");
    expect(stored.payloadPurgedAt).toBeInstanceOf(Date);
  });

  it("migrates legacy recipient hashes out of deferred booking intents", async () => {
    const booking = await Booking.create(bookingInput());
    const intent = buildBookingNotificationIntents({
      booking,
      type: "booking_confirmation",
      includeOwner: false,
      auditCommitOperationId: "not-yet-committed",
    })[0];
    await Booking.collection.updateOne(
      { _id: booking._id },
      { $push: { notificationIntents: { ...intent, recipientHash: "a".repeat(64) } } },
    );

    await processNotificationOutbox({ limit: 1 });

    const raw = await Booking.collection.findOne({ _id: booking._id });
    expect(raw.notificationIntents).toHaveLength(1);
    expect(raw.notificationIntents[0]).not.toHaveProperty("recipientHash");
  });

  it("requeues a pre-provider crash but quarantines a post-submission crash", async () => {
    const first = await Booking.create(bookingInput({ email: "first@example.com" }));
    const second = await Booking.create(bookingInput({ email: "second@example.com" }));
    await enqueueBookingNotifications({ booking: first, type: "booking_confirmation", includeOwner: false });
    await enqueueBookingNotifications({ booking: second, type: "booking_confirmation", includeOwner: false });
    const records = await NotificationOutbox.find({}).sort({ createdAt: 1 });
    await NotificationOutbox.collection.updateOne({ _id: records[0]._id }, {
      $set: { status: "processing", attempts: 1, deliveryPhase: "leased", leaseOwner: "old-a", leaseExpiresAt: new Date(0) },
    });
    await NotificationOutbox.collection.updateOne({ _id: records[1]._id }, {
      $set: { status: "processing", attempts: 1, deliveryPhase: "provider_started", leaseOwner: "old-b", leaseExpiresAt: new Date(0) },
    });
    const provider = vi.fn().mockResolvedValue({ sent: true, messageId: "recovered@example.net" });
    const restore = setNotificationProviderForTests(provider);
    try {
      await processNotificationOutbox({ workerId: "recovery", limit: 5 });
    } finally {
      restore();
    }
    expect(await NotificationOutbox.findById(records[0]._id).lean()).toMatchObject({ status: "sent", attempts: 1 });
    expect(await NotificationOutbox.findById(records[1]._id).lean()).toMatchObject({
      status: "delivery_unknown",
      failureDisposition: "ambiguous",
    });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("supersedes and never sends a token-bearing notification after token rotation", async () => {
    const token = "x".repeat(43);
    const booking = await Booking.create(bookingInput({
      managementTokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_confirmation",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
    });
    await Booking.collection.updateOne({ _id: booking._id }, {
      $set: { managementTokenHash: crypto.createHash("sha256").update("y".repeat(43)).digest("hex") },
    });
    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    try {
      await processNotificationOutbox({ workerId: "rotated-token", limit: 1 });
    } finally {
      restore();
    }
    expect(provider).not.toHaveBeenCalled();
    expect(await NotificationOutbox.findOne({ booking: booking._id }).lean())
      .toMatchObject({ status: "superseded", errorCategory: "superseded" });
  });

  it("keeps an ambiguously delivered management link valid and never sends it twice", async () => {
    const token = "m".repeat(43);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const booking = await Booking.create(bookingInput({
      managementTokenHash: tokenHash,
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "management_link_requested",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
      eventKey: "requested-link-timeout",
    });
    const provider = vi.fn().mockRejectedValue(Object.assign(new Error("socket lost after DATA"), {
      code: "ETIMEDOUT",
      command: "DATA",
    }));
    const restore = setNotificationProviderForTests(provider);
    try {
      expect(await processNotificationOutbox({ workerId: "link-timeout", limit: 1 }))
        .toMatchObject({ deliveryUnknown: 1 });
      await processNotificationOutbox({ workerId: "link-second-pass", limit: 1 });
    } finally {
      restore();
    }
    expect(provider).toHaveBeenCalledTimes(1);
    expect(await NotificationOutbox.findOne({ type: "management_link_requested" }).lean())
      .toMatchObject({ status: "delivery_unknown", failureDisposition: "ambiguous" });
    expect((await Booking.findById(booking._id).select("+managementTokenHash").lean()).managementTokenHash)
      .toBe(tokenHash);
  });

  it("supersedes a stale requested-link payload without provider or configuration retry", async () => {
    const token = "s".repeat(43);
    const booking = await Booking.create(bookingInput({
      managementTokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "management_link_requested",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
    });
    await Booking.collection.updateOne(
      { _id: booking._id },
      { $set: { managementTokenHash: crypto.createHash("sha256").update("n".repeat(43)).digest("hex") } },
    );
    const provider = vi.fn().mockResolvedValue({ sent: true });
    const restore = setNotificationProviderForTests(provider);
    try {
      expect(await processNotificationOutbox({ workerId: "stale-requested", limit: 1 }))
        .toMatchObject({ superseded: 1, failed: 0, dead: 0 });
    } finally {
      restore();
    }
    expect(provider).not.toHaveBeenCalled();
    expect(await NotificationOutbox.findOne({ booking: booking._id }).lean())
      .toMatchObject({ status: "superseded", errorCategory: "superseded" });
  });

  it("reports a stale requested-link dead letter as non-retryable to admin", async () => {
    const token = "a".repeat(43);
    const booking = await Booking.create(bookingInput({
      managementTokenHash: crypto.createHash("sha256").update("b".repeat(43)).digest("hex"),
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "management_link_requested",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
      maxAttempts: 1,
    });
    const record = await NotificationOutbox.findOne({ booking: booking._id });
    await NotificationOutbox.collection.updateOne(
      { _id: record._id },
      { $set: { status: "dead", attempts: 1, failureDisposition: "configuration", nextAttemptAt: null } },
    );
    const adminToken = await createAdminToken();
    const response = await request(app)
      .get(`/api/notifications/${record._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(response.body.data.retryable).toBe(false);
  });

  it("rebuilds reminder content from the current booking even when the slot returns to its original value", async () => {
    const now = new Date();
    const originalSlot = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const booking = await Booking.create(bookingInput({
      subject: "Matemática",
      school: "Escuela original",
      academicSituation: "Tema original",
      duration: 1,
      timeSlot: originalSlot,
      endTime: new Date(originalSlot.getTime() + 60 * 60 * 1000),
    }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_reminder",
      includeOwner: false,
      now,
    });
    const temporarySlot = new Date(originalSlot.getTime() + 60 * 60 * 1000);
    await Booking.collection.updateOne({ _id: booking._id }, {
      $set: {
        timeSlot: temporarySlot,
        endTime: new Date(temporarySlot.getTime() + 90 * 60 * 1000),
        subject: "Física",
        school: "Instituto actual",
        academicSituation: "Preparar recuperatorio",
        duration: 1.5,
      },
    });
    await Booking.collection.updateOne({ _id: booking._id }, {
      $set: {
        timeSlot: originalSlot,
        endTime: new Date(originalSlot.getTime() + 90 * 60 * 1000),
      },
    });
    const provider = vi.fn().mockResolvedValue({ sent: true, messageId: "fresh@example.net" });
    const restore = setNotificationProviderForTests(provider);
    try {
      await processNotificationOutbox({ workerId: "fresh-reminder", limit: 1, now });
    } finally {
      restore();
    }
    expect(provider).toHaveBeenCalledWith(expect.objectContaining({
      booking: expect.objectContaining({
        subject: "Física",
        school: "Instituto actual",
        academicSituation: "Preparar recuperatorio",
        duration: 1.5,
      }),
    }));
  });

  it("uses reminder generation so moving away and back never resurrects a sent reminder", async () => {
    const booking = await Booking.create(bookingInput({ scheduleRevision: 0, reminderRevision: 0 }));
    await enqueueBookingNotifications({
      booking,
      type: "booking_reminder",
      includeOwner: false,
      now: new Date(),
    });
    const first = await NotificationOutbox.findOne({ booking: booking._id });
    await NotificationOutbox.updateOne({ _id: first._id }, { $set: { status: "sent", sentAt: new Date() } });
    await Booking.collection.updateOne(
      { _id: booking._id },
      { $set: { scheduleRevision: 2, reminderRevision: 2 } },
    );
    const regenerated = await Booking.findById(booking._id).lean();
    await enqueueBookingNotifications({
      booking: regenerated,
      type: "booking_reminder",
      includeOwner: false,
      now: new Date(),
    });
    expect(await NotificationOutbox.countDocuments({ booking: booking._id })).toBe(2);
    expect(await NotificationOutbox.findById(first._id).lean()).toMatchObject({ status: "sent" });
    expect(await NotificationOutbox.countDocuments({ booking: booking._id, status: "queued" })).toBe(1);
  });

  it("uses honest pending-update notification type and copy", async () => {
    const booking = await Booking.create(bookingInput({ status: "Pendiente" }));
    const intents = buildBookingNotificationIntents({
      booking,
      type: "booking_rescheduled",
      previousTimeSlot: new Date(Date.now() + 24 * 60 * 60 * 1000),
      includeOwner: false,
    });
    expect(intents).toHaveLength(1);
    expect(intents[0].type).toBe("booking_pending_updated");
    const html = buildBookingEmailHtml({ booking, event: "pending_updated" });
    expect(html).toContain("pendiente");
    expect(html).not.toContain("quedó reservada");
  });

  it("does not claim a reminder is tomorrow for the 18-to-24-hour delivery window", () => {
    const booking = bookingInput();
    const html = buildBookingEmailHtml({ booking, event: "reminder" });
    const text = buildBookingEmailText({ booking, event: "reminder" });
    expect(html.toLowerCase()).not.toContain("mañana");
    expect(text.toLowerCase()).not.toContain("mañana");
    expect(`${html}\n${text}`.toLowerCase()).toContain("próxima clase");
  });

  it("uses honest pending copy and a stable portal CTA when no access link exists", async () => {
    const booking = await Booking.create(bookingInput({ status: "Pendiente" }));
    await enqueueBookingNotifications({ booking, type: "booking_confirmation", includeOwner: false });
    expect(await NotificationOutbox.findOne({}).lean()).toMatchObject({ type: "booking_received_pending" });
    const html = buildBookingEmailHtml({ booking: { ...booking.toObject(), portalUrl: "https://example.com/portal" }, event: "pending" });
    const reminderText = buildBookingEmailText({ booking: { ...booking.toObject(), portalUrl: "https://example.com/portal" }, event: "reminder" });
    expect(html).toContain("pendiente de confirmación");
    expect(html).not.toContain("Todo listo. Tu clase quedó reservada");
    expect(reminderText).toContain("https://example.com/portal");
    expect(reminderText).not.toContain("enlace seguro de este correo");
  });

  it("drains the active runner during graceful shutdown coordination", async () => {
    let release;
    const run = createNotificationOutboxRunner({
      processor: () => new Promise((resolve) => { release = resolve; }),
    });
    const active = run();
    const draining = run.waitForIdle({ timeoutMs: 1000 });
    release({ processed: 0 });
    await expect(draining).resolves.toBe(true);
    await active;
  });

  it("materializes audited intents only after the exact audit commit exists", async () => {
    const booking = await Booking.create(bookingInput());
    const operationId = crypto.randomUUID();
    const intents = buildBookingNotificationIntents({
      booking,
      type: "booking_confirmation",
      includeOwner: false,
      auditCommitOperationId: operationId,
    });
    await Booking.updateOne(
      { _id: booking._id },
      { $push: { notificationIntents: { $each: intents } } },
    );
    await reconcileNotificationIntents({ bookingId: booking._id });
    expect(await NotificationOutbox.countDocuments({})).toBe(0);
    expect((await Booking.findById(booking._id).select("+notificationIntents")).notificationIntents).toHaveLength(1);

    await AuditEvent.create({
      actor: { id: new mongoose.Types.ObjectId(), role: "admin", username: "audit@example.com" },
      action: "booking.updated",
      entityType: "Booking",
      entityId: booking._id,
      requestId: "audit-gate",
      operationId,
      before: {},
      after: { status: "Confirmado" },
    });
    await reconcileNotificationIntents({ bookingId: booking._id });
    expect(await NotificationOutbox.countDocuments({})).toBe(1);
    expect((await Booking.findById(booking._id).select("+notificationIntents")).notificationIntents).toHaveLength(0);
  });

  it("materializes and delivers creation intents only after the draft activation CAS", async () => {
    const makeDraft = async (email) => {
      const draft = new Booking(bookingInput({ email, creationState: "claiming" }));
      draft.notificationIntents = buildBookingNotificationIntents({
        booking: draft,
        type: "booking_confirmation",
        includeOwner: false,
      });
      await draft.save();
      return draft;
    };
    const abandoned = await makeDraft("abandoned@example.com");
    const activated = await makeDraft("activated@example.com");
    const provider = vi.fn().mockResolvedValue({ sent: true, messageId: "activation@example.com" });
    const restore = setNotificationProviderForTests(provider);
    try {
      await reconcileNotificationIntents();
      await processNotificationOutbox({ workerId: "creation-claiming", limit: 10 });
      expect(await NotificationOutbox.countDocuments({})).toBe(0);
      expect(provider).not.toHaveBeenCalled();

      await Booking.collection.updateOne(
        { _id: abandoned._id, creationState: "claiming" },
        { $set: { creationState: "abandoned" } },
      );
      await reconcileNotificationIntents();
      await processNotificationOutbox({ workerId: "creation-abandoned", limit: 10 });
      expect(await NotificationOutbox.countDocuments({})).toBe(0);
      expect(provider).not.toHaveBeenCalled();
      expect((await Booking.findById(abandoned._id)
        .select("+notificationIntents +creationState")).notificationIntents).toHaveLength(0);

      const activation = await Booking.collection.updateOne(
        { _id: activated._id, creationState: "claiming" },
        { $set: { creationState: "active" } },
      );
      expect(activation.modifiedCount).toBe(1);
      await reconcileNotificationIntents();
      expect(await NotificationOutbox.countDocuments({ booking: activated._id })).toBe(1);
      await processNotificationOutbox({ workerId: "creation-active", limit: 10 });
      expect(provider).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it("preserves an unrelated pending management-link intent across later booking events", async () => {
    const token = "m".repeat(43);
    const booking = await Booking.create(bookingInput({
      managementTokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      managementTokenExpiresAt: new Date(Date.now() + 86_400_000),
    }));
    const management = buildBookingNotificationIntents({
      booking,
      type: "management_link_requested",
      managementUrl: `https://frontend.example/m#token=${token}`,
      includeOwner: false,
    });
    const cancellation = buildBookingNotificationIntents({
      booking: { ...booking.toObject(), status: "Cancelado" },
      type: "booking_cancelled",
      includeOwner: false,
    });
    await Booking.updateOne(
      { _id: booking._id },
      { $push: { notificationIntents: { $each: management } } },
    );
    // This is the crash/restart boundary: reconciliation did not run before a
    // later mutation appended its own event.
    await Booking.updateOne(
      { _id: booking._id },
      { $set: { status: "Cancelado" }, $push: { notificationIntents: { $each: cancellation } } },
    );
    await reconcileNotificationIntents({ bookingId: booking._id });
    expect(await NotificationOutbox.countDocuments({ type: "management_link_requested" })).toBe(1);
    expect(await NotificationOutbox.countDocuments({ type: "booking_cancelled" })).toBe(1);
  });

  it("supersedes lifecycle and reminder revisions independently when counters diverge", async () => {
    const booking = await Booking.create(bookingInput({
      notificationRevision: 7,
      reminderRevision: 11,
    }));
    const lifecycleOld = buildBookingNotificationIntents({
      booking,
      type: "booking_confirmation",
      eventKey: "old-lifecycle",
      includeOwner: false,
    })[0];
    lifecycleOld.bookingRevision = 6;
    const lifecycleCurrent = buildBookingNotificationIntents({
      booking,
      type: "booking_confirmation",
      eventKey: "mixed-event",
      includeOwner: false,
    })[0];
    lifecycleCurrent.bookingRevision = 7;
    const reminderOld = buildBookingNotificationIntents({
      booking: { ...booking.toObject(), notificationRevision: 7, reminderRevision: 10 },
      type: "booking_reminder",
      eventKey: "mixed-event",
      includeOwner: false,
    })[0];
    const reminderCurrent = buildBookingNotificationIntents({
      booking: { ...booking.toObject(), notificationRevision: 6, reminderRevision: 11 },
      type: "booking_reminder",
      eventKey: "current-reminder",
      includeOwner: false,
    })[0];

    await Booking.updateOne(
      { _id: booking._id },
      {
        $push: {
          notificationIntents: {
            $each: [lifecycleOld, lifecycleCurrent, reminderOld, reminderCurrent],
          },
        },
      },
    );
    await reconcileNotificationIntents({ bookingId: booking._id });

    const queued = await NotificationOutbox.find({ booking: booking._id, status: "queued" })
      .sort({ type: 1 })
      .lean();
    expect(queued).toHaveLength(2);
    expect(queued.find(({ type }) => type === "booking_confirmation")).toMatchObject({
      bookingRevision: 7,
    });
    expect(queued.find(({ type }) => type === "booking_reminder")).toMatchObject({
      reminderRevision: 11,
      bookingRevision: 6,
    });
    expect(await NotificationOutbox.countDocuments({
      booking: booking._id,
      status: "superseded",
    })).toBe(2);
  });

  it("drains more than 250 retry sagas without committed records starving requested ones", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    const actorId = new mongoose.Types.ObjectId();
    const docs = Array.from({ length: 270 }, (_, index) => {
      const intent = buildBookingNotificationIntents({
        booking,
        type: "booking_cancelled",
        eventKey: `retry-saga-${index}`,
        includeOwner: false,
      })[0];
      return {
        booking: booking._id,
        bookingCode: booking.bookingCode,
        status: "dead",
        type: intent.type,
        channel: intent.channel,
        recipientKind: intent.recipientKind,
        recipientMasked: intent.recipientMasked,
        templateVersion: intent.templateVersion,
        eventId: intent.eventId,
        eventOccurredAt: intent.occurredAt,
        dedupeKey: intent.dedupeKey,
        payloadCiphertext: intent.payloadCiphertext,
        payloadIv: intent.payloadIv,
        payloadAuthTag: intent.payloadAuthTag,
        encryptionKeyVersion: intent.encryptionKeyVersion,
        attempts: 5,
        maxAttempts: 5,
        nextAttemptAt: null,
        expiresAt: intent.expiresAt,
        failureDisposition: "retryable",
        retryOperationId: crypto.randomUUID(),
        retryOperationState: index < 255 ? "committed" : "requested",
        retryRequestedAt: new Date(Date.now() - 10 * 60 * 1000),
        retryActorId: actorId,
        retryActorRole: "admin",
        retryActorUsername: "recovery@example.com",
        retryRequestId: `recovery-${index}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
    await NotificationOutbox.collection.insertMany(docs);
    await reconcileRetrySagas();
    expect(await NotificationOutbox.countDocuments({ retryOperationState: "archived" })).toBe(270);
    expect(await AuditEvent.countDocuments({ action: "notification.retry.committed" })).toBe(255);
    expect(await AuditEvent.countDocuments({ action: "notification.retry.failed" })).toBe(15);
  }, 30_000);

  it("allows configuration dead-letter retry only after a fresh healthy SMTP verification", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    await enqueueBookingNotifications({ booking, type: "booking_cancelled", includeOwner: false, maxAttempts: 1 });
    const item = await NotificationOutbox.findOneAndUpdate({}, { $set: {
      status: "dead",
      attempts: 1,
      errorCategory: "configuration",
      failureDisposition: "configuration",
    } }, { new: true });
    const token = await createAdminToken();
    setEmailTransporterForTests({ verify: vi.fn().mockRejectedValue(new Error("smtp down")), sendMail: vi.fn() });
    resetEmailDeliveryHealthForTests();
    await request(app)
      .post(`/api/notifications/${item._id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);
    expect((await NotificationOutbox.findById(item._id)).status).toBe("dead");

    setEmailTransporterForTests({ verify: vi.fn().mockResolvedValue(true), sendMail: vi.fn() });
    resetEmailDeliveryHealthForTests();
    await request(app)
      .post(`/api/notifications/${item._id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect((await NotificationOutbox.findById(item._id)).status).toBe("queued");
  });

  it("keeps repeated readiness and liveness probes outside the API rate-limit budget", async () => {
    const probes = await Promise.all(Array.from({ length: 25 }, () => request(app).get("/live")));
    expect(probes.every((response) => response.status === 200)).toBe(true);
    const ready = await Promise.all(Array.from({ length: 25 }, () => request(app).get("/ready")));
    expect(ready.every((response) => response.status === 200)).toBe(true);
  });

  it("clamps a stale notification page to the canonical last page", async () => {
    const booking = await Booking.create(bookingInput({ status: "Cancelado" }));
    const intents = Array.from({ length: 21 }, (_, index) => buildBookingNotificationIntents({
      booking,
      type: "booking_cancelled",
      eventKey: `page-${index}`,
      includeOwner: false,
    })[0]);
    await Booking.updateOne(
      { _id: booking._id },
      { $push: { notificationIntents: { $each: intents } } },
    );
    await reconcileNotificationIntents({ bookingId: booking._id });
    const token = await createAdminToken();
    await request(app)
      .get("/api/notifications?page=2&limit=20")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.data.pagination.page).toBe(2));
    const keep = await NotificationOutbox.findOne({}).sort({ createdAt: 1 }).lean();
    await NotificationOutbox.deleteMany({ _id: { $ne: keep._id } });
    await request(app)
      .get("/api/notifications?page=2&limit=20")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.pagination).toMatchObject({ page: 1, total: 1, totalPages: 1 });
        expect(body.data.items).toHaveLength(1);
      });
  });
});


