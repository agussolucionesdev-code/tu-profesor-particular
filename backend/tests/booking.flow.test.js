import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import {
  getDefaultAvailabilityRange,
  parseDateTimeInput,
} from "../src/utils/bookingRules.js";
import {
  BookingSlotConflictError,
  claimBookingSlots,
  getBookingSlotStarts,
} from "../src/services/bookingSlotService.js";

const sendManagementLinkEmailMock = vi.hoisted(() => vi.fn());
const sendReminderNotificationMock = vi.hoisted(() => vi.fn());
vi.mock("../src/config/mailer.js", async () => {
  const actual = await vi.importActual("../src/config/mailer.js");
  return {
    ...actual,
    sendManagementLinkEmail: sendManagementLinkEmailMock,
    sendReminderNotification: sendReminderNotificationMock,
  };
});

let app;
let mongoServer;
let Booking;
let BookingSlot;
let IdempotencyKey;
let User;
let AppSettings;
let BlockedDate;
let AuditEvent;
let requestManagementLink;
let processReminders;
let ensureOperationalIndexes;
let setAuditWriterForTests;
let writeAuditDocument;
let AUDIT_WRITE_TIMEOUT_MS;
let SLOT_MUTATION_LOCK_MS;

const getMemoryLaunchTimeout = () =>
  Number(process.env.MONGO_MEMORY_LAUNCH_TIMEOUT_MS || 90000);

const formatForApi = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hour}:${minutes}`;
};

const tomorrowAt = (hour, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const nextWeekdayAt = (weekday, hour = 0, minute = 0) => {
  const date = new Date();
  const daysUntil = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntil);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const dateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const businessClock = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
};

const businessDateAndClock = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
};

const validBookingPayload = (overrides = {}) => ({
  responsibleName: "Maria Perez",
  responsibleRelationship: "madre",
  responsibleRelationshipOther: "",
  studentName: "Juan Perez",
  tutorName: "Agustin",
  email: "familia@example.com",
  phone: "+54 9 11-2222-3333",
  school: "Escuela Normal",
  educationLevel: "Secundaria",
  yearGrade: "3er ano",
  subject: "Matematica",
  academicSituation: "Necesita reforzar ecuaciones.",
  timeSlot: formatForApi(tomorrowAt(10)),
  duration: 1,
  ...overrides,
});

const createAdminAndLogin = async () => {
  await User.create({
    username: "admin@example.com",
    password: await bcrypt.hash("super-secret", 10),
  });

  const login = await request(app).post("/api/auth/login").send({
    username: "admin@example.com",
    password: "super-secret",
  });

  return login.body.token;
};

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.PUBLIC_MUTATION_RATE_LIMIT_MAX = "1000";
  process.env.FRONTEND_URL = "https://frontend.example.com";
  mongoServer = await MongoMemoryServer.create({
    instance: {
      launchTimeout: getMemoryLaunchTimeout(),
    },
  });
  await mongoose.connect(mongoServer.getUri());

  app = (await import("../src/app.js")).default;
  Booking = (await import("../src/models/Booking.js")).default;
  BookingSlot = (await import("../src/models/BookingSlot.js")).default;
  IdempotencyKey = (await import("../src/models/IdempotencyKey.js")).default;
  User = (await import("../src/models/User.js")).default;
  AppSettings = (await import("../src/models/AppSettings.js")).default;
  BlockedDate = (await import("../src/models/BlockedDate.js")).default;
  AuditEvent = (await import("../src/models/AuditEvent.js")).default;
  processReminders = (await import("../src/services/reminderService.js")).processReminders;
  ensureOperationalIndexes = (
    await import("../src/config/operationalIndexes.js")
  ).ensureOperationalIndexes;
  ({
    setAuditWriterForTests,
    writeAuditDocument,
    AUDIT_WRITE_TIMEOUT_MS,
  } = await import("../src/services/auditService.js"));
  ({ SLOT_MUTATION_LOCK_MS } = await import("../src/config/bookingMutationLease.js"));
  requestManagementLink = (
    await import("../src/controllers/bookingController.js")
  ).requestManagementLink;

  await Promise.all([
    BookingSlot.syncIndexes(),
    IdempotencyKey.syncIndexes(),
  ]);
}, Math.max(30000, getMemoryLaunchTimeout() + 15000));

beforeEach(async () => {
  sendManagementLinkEmailMock.mockReset().mockResolvedValue(true);
  sendReminderNotificationMock.mockReset().mockResolvedValue({
    sent: true,
    recipient: "familia@example.com",
  });
  await Booking.deleteMany({});
  await BookingSlot.deleteMany({});
  await IdempotencyKey.deleteMany({});
  await User.deleteMany({});
  await AppSettings.deleteMany({});
  await BlockedDate.deleteMany({});
  await AuditEvent.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("booking flows", () => {
  it("forwards the original failure when requesting a management link", async () => {
    const originalError = new Error("booking lookup failed");
    const findOneSpy = vi.spyOn(Booking, "findOne").mockReturnValueOnce({
      select: () => ({
        exec: () => Promise.reject(originalError),
      }),
    });
    const next = vi.fn();
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    try {
      await requestManagementLink(
        {
          body: { bookingCode: "ABC234", email: "familia@example.com" },
          requestId: "test-request-id",
        },
        res,
        next,
      );

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(originalError);
      expect(res.status).not.toHaveBeenCalled();
    } finally {
      findOneSpy.mockRestore();
    }
  });

  it("interprets public date labels and default ranges in Buenos Aires time", () => {
    const parsed = parseDateTimeInput("19/07/2026 00:00");
    expect(businessDateAndClock(parsed)).toMatchObject({
      year: 2026,
      month: 7,
      day: 19,
      hour: 0,
      minute: 0,
    });

    const defaults = getDefaultAvailabilityRange();
    expect(businessDateAndClock(defaults.from)).toMatchObject({ hour: 0, minute: 0 });
    expect(businessDateAndClock(defaults.to)).toMatchObject({ hour: 23, minute: 59 });
  });

  it("does not generate public availability slots on Sundays", async () => {
    const sunday = nextWeekdayAt(0);
    const endOfSunday = new Date(sunday);
    endOfSunday.setHours(23, 59, 0, 0);

    const availability = await request(app)
      .get("/api/bookings/availability")
      .query({
        from: formatForApi(sunday),
        to: formatForApi(endOfSunday),
      })
      .expect(200);

    expect(availability.body.schedule.timeZone).toBe("America/Argentina/Buenos_Aires");
    expect(availability.body.slots).toEqual([]);
  });

  it("rejects creating a booking on Sunday by default", async () => {
    const sunday = nextWeekdayAt(0, 10);

    const response = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(sunday) }))
      .expect(400);

    expect(response.body.message).toBe("Ese día no está disponible para reservas.");
    expect(await Booking.countDocuments()).toBe(0);
  });

  it("rejects creating a booking on a weekday disabled in persisted settings", async () => {
    const tuesday = nextWeekdayAt(2, 10);
    await AppSettings.create({
      key: "schedule.activeWeekdays",
      value: [1, 3, 4, 5, 6],
    });

    const response = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tuesday) }))
      .expect(400);

    expect(response.body.message).toBe("Ese día no está disponible para reservas.");
    expect(await Booking.countDocuments()).toBe(0);
  });

  it("rejects management rescheduling to Sunday by default", async () => {
    const source = nextWeekdayAt(1, 10);
    const sunday = nextWeekdayAt(0, 10);
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(source) }))
      .expect(201);

    const response = await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", created.body.data.managementToken)
      .send({
        bookingCode: created.body.data.bookingCode,
        newTimeSlot: formatForApi(sunday),
        newDuration: 1,
      })
      .expect(400);

    expect(response.body.message).toBe("Ese día no está disponible para reservas.");
    const persisted = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    expect(persisted.timeSlot).toEqual(parseDateTimeInput(formatForApi(source)));
  });

  it("rejects an admin update that moves a booking to Sunday by default", async () => {
    const source = nextWeekdayAt(1, 10);
    const sunday = nextWeekdayAt(0, 10);
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(source) }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();

    const response = await request(app)
      .put(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ timeSlot: formatForApi(sunday) })
      .expect(400);

    expect(response.body.message).toBe("Ese día no está disponible para reservas.");
    const persisted = await Booking.findById(stored._id).lean();
    expect(persisted.timeSlot).toEqual(parseDateTimeInput(formatForApi(source)));
  });

  it("rejects creating a booking on an administratively blocked date", async () => {
    const monday = nextWeekdayAt(1, 10);
    await BlockedDate.create({ date: dateKey(monday), reason: "Feriado" });

    const response = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(monday) }))
      .expect(400);

    expect(response.body.message).toBe("Ese día no está disponible para reservas.");
  });

  it("rejects creating a booking outside persisted schedule hours", async () => {
    const monday = nextWeekdayAt(1, 10);
    await AppSettings.create([
      { key: "schedule.openingHour", value: 12 },
      { key: "schedule.closingHour", value: 18 },
    ]);

    const response = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(monday) }))
      .expect(400);

    expect(response.body.message).toContain("12:00 a 18:00");
  });

  it("rejects mutation timestamps containing seconds", async () => {
    const mondayAtTen = parseDateTimeInput(formatForApi(nextWeekdayAt(1, 10)));
    mondayAtTen.setUTCSeconds(30);

    const response = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: mondayAtTen.toISOString() }))
      .expect(400);

    expect(response.body.message).toBe(
      "Los turnos deben comenzar en intervalos de 30 minutos.",
    );
    expect(await Booking.countDocuments()).toBe(0);
  });

  it("aligns mutations to 45-minute slots measured from persisted opening time", async () => {
    await AppSettings.create([
      { key: "schedule.openingHour", value: 8 },
      { key: "schedule.closingHour", value: 18 },
      { key: "schedule.slotDurationMinutes", value: 45 },
    ]);
    const mondayAtTen = nextWeekdayAt(1, 10);
    const mondayAtTenFifteen = nextWeekdayAt(1, 10, 15);

    const misaligned = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({
        timeSlot: formatForApi(mondayAtTen),
        duration: 0.75,
      }))
      .expect(400);
    const aligned = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({
        studentName: "Alumno alineado",
        timeSlot: formatForApi(mondayAtTenFifteen),
        duration: 0.75,
      }))
      .expect(201);

    expect(misaligned.body.message).toBe(
      "Los turnos deben comenzar en intervalos de 45 minutos.",
    );
    expect(aligned.body.success).toBe(true);
  });

  it("cannot bypass slot concurrency with a 30-second timestamp offset", async () => {
    const exactStart = parseDateTimeInput(formatForApi(nextWeekdayAt(1, 10)));
    const offsetStart = new Date(exactStart.getTime() + 30 * 1000);

    const attempts = await Promise.all([
      request(app)
        .post("/api/bookings/reserve")
        .send(validBookingPayload({ timeSlot: exactStart.toISOString() })),
      request(app)
        .post("/api/bookings/reserve")
        .send(validBookingPayload({
          studentName: "Alumno con offset",
          email: "offset@example.com",
          timeSlot: offsetStart.toISOString(),
        })),
    ]);

    expect(attempts.filter((response) => response.status === 201)).toHaveLength(1);
    expect(attempts.filter((response) => response.status === 400)).toHaveLength(1);
    expect(await Booking.countDocuments()).toBe(1);
    expect(await BookingSlot.countDocuments()).toBe(2);
  });

  it("applies persisted advance notice equally to availability and mutation", async () => {
    const monday = nextWeekdayAt(1, 10);
    const endOfMonday = new Date(monday);
    endOfMonday.setHours(18, 0, 0, 0);
    await AppSettings.create({
      key: "schedule.advanceNoticeMinutes",
      value: 30 * 24 * 60,
    });

    const availability = await request(app)
      .get("/api/bookings/availability")
      .query({
        from: formatForApi(monday),
        to: formatForApi(endOfMonday),
        duration: 1,
      })
      .expect(200);
    const mutation = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(monday) }))
      .expect(400);

    expect(availability.body.slots).toEqual([]);
    expect(mutation.body.message).toContain("43200 minutos de anticipación");
  });

  it("rejects management rescheduling to an administratively blocked date", async () => {
    const source = nextWeekdayAt(1, 10);
    const target = nextWeekdayAt(2, 10);
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(source) }))
      .expect(201);
    await BlockedDate.create({ date: dateKey(target), reason: "Feriado" });

    const response = await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", created.body.data.managementToken)
      .send({
        bookingCode: created.body.data.bookingCode,
        newTimeSlot: formatForApi(target),
        newDuration: 1,
      })
      .expect(400);

    expect(response.body.message).toBe("Ese día no está disponible para reservas.");
  });

  it("rejects management rescheduling outside persisted schedule hours", async () => {
    const source = nextWeekdayAt(1, 10);
    const target = nextWeekdayAt(2, 10);
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(source) }))
      .expect(201);
    await AppSettings.create([
      { key: "schedule.openingHour", value: 12 },
      { key: "schedule.closingHour", value: 18 },
    ]);

    const response = await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", created.body.data.managementToken)
      .send({
        bookingCode: created.body.data.bookingCode,
        newTimeSlot: formatForApi(target),
        newDuration: 1,
      })
      .expect(400);

    expect(response.body.message).toContain("12:00 a 18:00");
  });

  it("rejects an admin update to an administratively blocked date", async () => {
    const source = nextWeekdayAt(1, 10);
    const target = nextWeekdayAt(2, 10);
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(source) }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await BlockedDate.create({ date: dateKey(target), reason: "Feriado" });

    const response = await request(app)
      .put(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ timeSlot: formatForApi(target) })
      .expect(400);

    expect(response.body.message).toBe("Ese día no está disponible para reservas.");
  });

  it("rejects an admin update outside persisted schedule hours", async () => {
    const source = nextWeekdayAt(1, 10);
    const target = nextWeekdayAt(2, 10);
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(source) }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await AppSettings.create([
      { key: "schedule.openingHour", value: 12 },
      { key: "schedule.closingHour", value: 18 },
    ]);

    const response = await request(app)
      .put(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ timeSlot: formatForApi(target) })
      .expect(400);

    expect(response.body.message).toContain("12:00 a 18:00");
  });

  it("does not generate slots for an administratively blocked date", async () => {
    const monday = nextWeekdayAt(1);
    const endOfMonday = new Date(monday);
    endOfMonday.setHours(23, 59, 0, 0);
    await BlockedDate.create({ date: dateKey(monday), reason: "Feriado" });

    const availability = await request(app)
      .get("/api/bookings/availability")
      .query({
        from: formatForApi(monday),
        to: formatForApi(endOfMonday),
      })
      .expect(200);

    expect(availability.body.slots).toEqual([]);
  });

  it("uses persisted closing time and requested duration to calculate slots", async () => {
    const monday = nextWeekdayAt(1);
    const endOfMonday = new Date(monday);
    endOfMonday.setHours(23, 59, 0, 0);
    await AppSettings.create([
      { key: "schedule.openingHour", value: 10 },
      { key: "schedule.closingHour", value: 12 },
      { key: "schedule.slotDurationMinutes", value: 30 },
    ]);

    const availability = await request(app)
      .get("/api/bookings/availability")
      .query({
        from: formatForApi(monday),
        to: formatForApi(endOfMonday),
        duration: 1,
      })
      .expect(200);

    expect(availability.body.slots).toHaveLength(3);
    expect(availability.body.slots.map((slot) => businessClock(new Date(slot.timeSlot)).hour))
      .toEqual([10, 10, 11]);
    expect(availability.body.slots.map((slot) => businessClock(new Date(slot.timeSlot)).minute))
      .toEqual([0, 30, 0]);
  });

  it("excludes only the valid management token's booking from availability", async () => {
    const monday = nextWeekdayAt(1, 10);
    const endOfMonday = new Date(monday);
    endOfMonday.setHours(12, 0, 0, 0);
    await AppSettings.create([
      { key: "schedule.openingHour", value: 10 },
      { key: "schedule.closingHour", value: 12 },
      { key: "schedule.slotDurationMinutes", value: 30 },
    ]);

    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(monday), duration: 1 }))
      .expect(201);
    const { managementToken } = created.body.data;
    const query = {
      from: formatForApi(monday),
      to: formatForApi(endOfMonday),
      duration: 1,
      // Public callers must never be able to select an arbitrary booking to
      // hide. This legacy-looking parameter is intentionally ignored.
      excludeBookingId: "000000000000000000000000",
    };

    const publicAvailability = await request(app)
      .get("/api/bookings/availability")
      .query(query)
      .expect(200);
    const invalidAvailability = await request(app)
      .get("/api/bookings/availability")
      .set("X-Booking-Manage-Token", "a".repeat(43))
      .query(query)
      .expect(200);
    const managedAvailability = await request(app)
      .get("/api/bookings/availability")
      .set("X-Booking-Manage-Token", managementToken)
      .query(query)
      .expect(200);

    expect(publicAvailability.body.data).toHaveLength(1);
    expect(invalidAvailability.body.data).toHaveLength(1);
    expect(managedAvailability.body.data).toEqual([]);
    expect(publicAvailability.body.slots.map((slot) => businessClock(new Date(slot.timeSlot))))
      .toEqual([{ hour: 11, minute: 0 }]);
    expect(invalidAvailability.body.slots).toEqual(publicAvailability.body.slots);
    expect(managedAvailability.body.slots.map((slot) => businessClock(new Date(slot.timeSlot))))
      .toEqual([
        { hour: 10, minute: 0 },
        { hour: 10, minute: 30 },
        { hour: 11, minute: 0 },
      ]);
  });

  it("creates a booking and exposes only calendar blocks publicly", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);

    expect(created.body.data.bookingCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(created.body.data.managementToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.body.data.managementUrl).toBe(
      `https://frontend.example.com/m#token=${created.body.data.managementToken}`,
    );
    expect(created.body.data).not.toHaveProperty("email");
    expect(created.body.data).not.toHaveProperty("responsibleRelationship");

    const storedByDefault = await Booking.findOne({
      bookingCode: created.body.data.bookingCode,
    }).lean();
    expect(storedByDefault).not.toHaveProperty("managementTokenHash");
    const stored = await Booking.findOne({
      bookingCode: created.body.data.bookingCode,
    })
      .select("+managementTokenHash")
      .lean();
    expect(stored).not.toHaveProperty("managementToken");
    expect(stored.managementTokenHash).toBe(
      crypto
        .createHash("sha256")
        .update(created.body.data.managementToken)
        .digest("hex"),
    );
    expect(new Date(stored.managementTokenExpiresAt).getTime()).toBe(
      new Date(stored.endTime).getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    const availability = await request(app)
      .get("/api/bookings/availability")
      .expect(200);

    expect(availability.body.data).toHaveLength(1);
    expect(availability.body.data[0]).toHaveProperty("timeSlot");
    expect(availability.body.data[0]).not.toHaveProperty("studentName");
    expect(availability.body.data[0]).not.toHaveProperty("email");
    expect(availability.body.data[0]).not.toHaveProperty("phone");
  });

  it("never discloses booking data from the public short-code endpoint", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);

    const bookingCode = created.body.data.bookingCode;

    const byCode = await request(app)
      .get(`/api/bookings/${bookingCode}`)
      .expect(410);
    const missingCode = await request(app)
      .get("/api/bookings/ABC234")
      .expect(410);

    expect(byCode.body).toEqual(missingCode.body);
    expect(byCode.body).not.toHaveProperty("data");
    expect(JSON.stringify(byCode.body)).not.toContain(bookingCode);
    expect(JSON.stringify(byCode.body)).not.toContain("familia@example.com");
  });

  it("allows loopback dev origins and blocks unknown origins with 403", async () => {
    const allowedPreflight = await request(app)
      .options("/api/bookings/reserve")
      .set("Origin", "http://localhost:4173")
      .set("Access-Control-Request-Method", "POST")
      .set(
        "Access-Control-Request-Headers",
        "content-type,x-booking-manage-token",
      )
      .expect(204);

    expect(allowedPreflight.headers["access-control-allow-origin"]).toBe(
      "http://localhost:4173",
    );
    expect(allowedPreflight.headers["access-control-allow-headers"]).toContain(
      "X-Booking-Manage-Token",
    );

    const deniedPreflight = await request(app)
      .options("/api/bookings/reserve")
      .set("Origin", "http://evil.example.com")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type")
      .expect(403);

    expect(deniedPreflight.body.success).toBe(false);
    expect(deniedPreflight.body.message).toBe("Origin not allowed by CORS");
  });

  it("rejects invalid public booking requests and overlapping turns", async () => {
    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ email: "", phone: "" }))
      .expect(400);

    await request(app)
      .post("/api/bookings/reserve")
      .send(
        validBookingPayload({
          responsibleRelationship: "otro",
          responsibleRelationshipOther: "",
        }),
      )
      .expect(400);

    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);

    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ studentName: "Pedro Perez" }))
      .expect(400);
  });

  it("allows adjacent bookings right after an occupied block ends", async () => {
    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(15)), duration: 3 }))
      .expect(201);

    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({
        studentName: "Lucia Perez",
        email: "lucia@example.com",
        timeSlot: formatForApi(tomorrowAt(18)),
        duration: 1,
      }))
      .expect(201);

    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({
        studentName: "Martin Perez",
        email: "martin@example.com",
        timeSlot: formatForApi(tomorrowAt(17, 30)),
        duration: 1,
      }))
      .expect(400);
  });

  it("protects admin routes with a bearer token", async () => {
    await request(app).get("/api/bookings").expect(401);

    const token = await createAdminAndLogin();
    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);

    const adminList = await request(app)
      .get("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(adminList.body.data).toHaveLength(1);
    expect(adminList.body.data[0].email).toBe("familia@example.com");
  });

  it("keeps the legacy unpaginated admin list while validating explicit pagination", async () => {
    const token = await createAdminAndLogin();
    const bookingTimes = [9, 10, 11, 12].map((hour) => nextWeekdayAt(1, hour));
    const createdBookings = [];

    for (const [index, timeSlot] of bookingTimes.entries()) {
      const created = await request(app)
        .post("/api/bookings/reserve")
        .send(validBookingPayload({
          studentName: `Alumno listado ${index}`,
          email: `listado-${index}@example.com`,
          timeSlot: formatForApi(timeSlot),
        }))
        .expect(201);
      createdBookings.push(created.body.data);
    }

    const deletedBooking = await Booking.findOne({
      bookingCode: createdBookings[3].bookingCode,
    }).lean();
    await request(app)
      .delete(`/api/bookings/${deletedBooking._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const legacyList = await request(app)
      .get("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(legacyList.body.data).toHaveLength(3);
    expect(legacyList.body).not.toHaveProperty("page");
    expect(legacyList.body).not.toHaveProperty("totalPages");
    expect(legacyList.body.data.map(({ bookingCode }) => bookingCode)).not.toContain(
      deletedBooking.bookingCode,
    );

    const paginatedList = await request(app)
      .get("/api/bookings?page=2&limit=2")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(paginatedList.body).toMatchObject({
      count: 1,
      total: 3,
      page: 2,
      totalPages: 2,
    });
    expect(paginatedList.body.data).toHaveLength(1);

    const trashList = await request(app)
      .get("/api/bookings?scope=trash")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(trashList.body.data).toHaveLength(1);
    expect(trashList.body.data[0].bookingCode).toBe(deletedBooking.bookingCode);
    expect(JSON.stringify({ legacyList: legacyList.body, trashList: trashList.body }))
      .not.toMatch(/managementTokenHash|slotMutationLock/i);

    await request(app)
      .get("/api/bookings?page=invalid&limit=2")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    await request(app)
      .get("/api/bookings?page=1&limit=0")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    await request(app)
      .get("/api/bookings?page=1&limit=201")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });

  it("rejects an unsafe admin pagination offset before querying bookings", async () => {
    const token = await createAdminAndLogin();
    const findSpy = vi.spyOn(Booking, "find");

    try {
      await request(app)
        .get(`/api/bookings?page=${Number.MAX_SAFE_INTEGER}&limit=200`)
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect(findSpy).not.toHaveBeenCalled();
    } finally {
      findSpy.mockRestore();
    }
  });

  it("rejects oversized availability ranges and invalid admin ids", async () => {
    const farFuture = tomorrowAt(8);
    farFuture.setDate(farFuture.getDate() + 180);

    await request(app)
      .get("/api/bookings/availability")
      .query({
        from: formatForApi(tomorrowAt(8)),
        to: formatForApi(farFuture),
      })
      .expect(400);

    const token = await createAdminAndLogin();
    await request(app)
      .put("/api/bookings/not-a-valid-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "Confirmado" })
      .expect(400);
  });

  it("lets a client reschedule and cancel with the booking code", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);

    const bookingCode = created.body.data.bookingCode;
    const managementToken = created.body.data.managementToken;
    const newDate = tomorrowAt(12);

    const rescheduled = await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", managementToken)
      .send({
        bookingCode,
        newTimeSlot: formatForApi(newDate),
        newDuration: 1.5,
      })
      .expect(200);

    expect(rescheduled.body.data.duration).toBe(1.5);
    expect(await BookingSlot.countDocuments()).toBe(3);

    const cancelled = await request(app)
      .post("/api/bookings/cancel")
      .set("X-Booking-Manage-Token", managementToken)
      .send({ bookingCode })
      .expect(200);

    expect(cancelled.body.data.status).toBe("Cancelado");
    expect(await BookingSlot.countDocuments()).toBe(0);

    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ studentName: "Nuevo alumno" }))
      .expect(201);
  });

  it("keeps the original slot claim when concurrent reschedules collide", async () => {
    const first = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(10)) }))
      .expect(201);
    const second = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({
        studentName: "Lucia Perez",
        email: "lucia@example.com",
        timeSlot: formatForApi(tomorrowAt(14)),
      }))
      .expect(201);
    const target = formatForApi(tomorrowAt(12));

    const attempts = await Promise.all([
      request(app)
        .post("/api/bookings/reschedule")
        .set("X-Booking-Manage-Token", first.body.data.managementToken)
        .send({ bookingCode: first.body.data.bookingCode, newTimeSlot: target, newDuration: 1 }),
      request(app)
        .post("/api/bookings/reschedule")
        .set("X-Booking-Manage-Token", second.body.data.managementToken)
        .send({ bookingCode: second.body.data.bookingCode, newTimeSlot: target, newDuration: 1 }),
    ]);

    expect(attempts.filter((response) => response.status === 200)).toHaveLength(1);
    expect(attempts.filter((response) => response.status === 409)).toHaveLength(1);
    expect(await BookingSlot.countDocuments()).toBe(4);
  });

  it("serializes concurrent reschedules of the same booking", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(10)) }))
      .expect(201);
    const targets = [formatForApi(tomorrowAt(12)), formatForApi(tomorrowAt(14))];

    const attempts = await Promise.all(
      targets.map((newTimeSlot) =>
        request(app)
          .post("/api/bookings/reschedule")
          .set("X-Booking-Manage-Token", created.body.data.managementToken)
          .send({
            bookingCode: created.body.data.bookingCode,
            newTimeSlot,
            newDuration: 1,
          }),
      ),
    );

    expect(attempts.filter((response) => response.status === 200)).toHaveLength(1);
    expect(attempts.filter((response) => response.status === 409)).toHaveLength(1);

    const persisted = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    const slotStarts = await BookingSlot.find({ booking: persisted._id }).lean();
    expect(slotStarts).toHaveLength(2);
    expect(slotStarts.every((slot) => new Date(slot.slotStart) >= new Date(persisted.timeSlot))).toBe(true);
  });

  it("keeps slots in sync for admin reschedule, cancellation, delete and reset", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(10)) }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();

    await request(app)
      .put(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ timeSlot: formatForApi(tomorrowAt(12)) })
      .expect(200);
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(2);

    await request(app)
      .put(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "Cancelado" })
      .expect(200);
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(0);

    const deletable = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ studentName: "Alumno para eliminar", timeSlot: formatForApi(tomorrowAt(14)) }))
      .expect(201);
    const deletableStored = await Booking.findOne({ bookingCode: deletable.body.data.bookingCode }).lean();
    await request(app)
      .delete(`/api/bookings/${deletableStored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(await BookingSlot.countDocuments({ booking: deletableStored._id })).toBe(0);

    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ studentName: "Alumno para reiniciar", timeSlot: formatForApi(tomorrowAt(16)) }))
      .expect(201);
    await request(app)
      .delete("/api/bookings/all")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(await BookingSlot.countDocuments()).toBe(0);
  }, 15000);

  it("releases claimed slots and the mutation lock when an admin update fails", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(10)) }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    const beforeSlots = await BookingSlot.find({ booking: stored._id })
      .sort({ slotStart: 1 })
      .lean();
    const persistenceError = new Error("booking update failed");
    const originalFindOneAndUpdate = Booking.findOneAndUpdate;
    const updateSpy = vi
      .spyOn(Booking, "findOneAndUpdate")
      .mockImplementation(function failOwnedBookingUpdate(filter, update, options) {
        if (update?.$set?.timeSlot) return Promise.reject(persistenceError);
        return originalFindOneAndUpdate.call(this, filter, update, options);
      });

    try {
      await request(app)
        .put(`/api/bookings/${stored._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ timeSlot: formatForApi(tomorrowAt(12)) })
        .expect(500);

      const afterSlots = await BookingSlot.find({ booking: stored._id })
        .sort({ slotStart: 1 })
        .lean();
      const afterBooking = await Booking.findById(stored._id)
        .select("+slotMutationLock +slotMutationLockExpiresAt")
        .lean();
      expect(afterSlots.map((slot) => slot.slotStart)).toEqual(
        beforeSlots.map((slot) => slot.slotStart),
      );
      expect(afterBooking).not.toHaveProperty("slotMutationLock");
      expect(afterBooking.slotMutationLockExpiresAt).toBeUndefined();
    } finally {
      updateSpy.mockRestore();
    }
  });

  it("releases the mutation lock when an admin soft-delete write fails", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(10)) }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    const originalFindOneAndUpdate = Booking.findOneAndUpdate;
    const deleteSpy = vi
      .spyOn(Booking, "findOneAndUpdate")
      .mockImplementation(function failSoftDelete(filter, update, options) {
        if (update?.$set?.deletedAt) return Promise.reject(new Error("booking delete failed"));
        return originalFindOneAndUpdate.call(this, filter, update, options);
      });

    try {
      await request(app)
        .delete(`/api/bookings/${stored._id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(500);

      const afterBooking = await Booking.findById(stored._id)
        .select("+slotMutationLock +slotMutationLockExpiresAt")
        .lean();
      expect(afterBooking).not.toHaveProperty("slotMutationLock");
      expect(afterBooking.slotMutationLockExpiresAt).toBeUndefined();
    } finally {
      deleteSpy.mockRestore();
    }
  });

  it("atomically reserves slot blocks so concurrent bookings cannot overlap", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        request(app)
          .post("/api/bookings/reserve")
          .set("Idempotency-Key", `concurrent-reservation-${index}`)
          .send(validBookingPayload({ studentName: `Alumno ${index}` })),
      ),
    );

    expect(attempts.filter((response) => response.status === 201)).toHaveLength(1);
    expect(attempts.filter((response) => response.status === 409)).toHaveLength(19);
    expect(await Booking.countDocuments()).toBe(1);
    expect(await BookingSlot.countDocuments()).toBe(2);
  });

  it("compensates partial slot claims when a later block is already occupied", async () => {
    const slotStarts = getBookingSlotStarts({
      startTime: tomorrowAt(18),
      endTime: tomorrowAt(19),
      slotDurationMinutes: 30,
    });
    await BookingSlot.create({
      booking: new mongoose.Types.ObjectId(),
      slotStart: slotStarts[1],
      slotDurationMinutes: 30,
    });

    await expect(
      claimBookingSlots({
        bookingId: new mongoose.Types.ObjectId(),
        slotStarts,
        slotDurationMinutes: 30,
      }),
    ).rejects.toBeInstanceOf(BookingSlotConflictError);

    expect(await BookingSlot.countDocuments()).toBe(1);
    expect(await BookingSlot.exists({ slotStart: slotStarts[0] })).toBeNull();
  });

  it("replays a completed response for the same idempotency key without duplicating the booking", async () => {
    const idempotencyKey = "retry-safe-reservation-key";
    const payload = validBookingPayload();

    const first = await request(app)
      .post("/api/bookings/reserve")
      .set("Idempotency-Key", idempotencyKey)
      .send(payload)
      .expect(201);
    const replay = await request(app)
      .post("/api/bookings/reserve")
      .set("Idempotency-Key", idempotencyKey)
      .send(payload)
      .expect(201);

    expect(replay.body).toEqual(first.body);
    expect(await Booking.countDocuments()).toBe(1);
    expect(await IdempotencyKey.countDocuments()).toBe(1);

    await request(app)
      .post("/api/bookings/reserve")
      .set("Idempotency-Key", idempotencyKey)
      .send(validBookingPayload({ studentName: "Otro alumno" }))
      .expect(409);
  });

  it("requires Idempotency-Key when strict enforcement is enabled", async () => {
    process.env.REQUIRE_IDEMPOTENCY_KEY = "true";
    try {
      await request(app)
        .post("/api/bookings/reserve")
        .send(validBookingPayload())
        .expect(400);
    } finally {
      delete process.env.REQUIRE_IDEMPOTENCY_KEY;
    }
  });

  it("requires Idempotency-Key for rescheduling when strict enforcement is enabled", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    process.env.REQUIRE_IDEMPOTENCY_KEY = "true";
    try {
      await request(app)
        .post("/api/bookings/reschedule")
        .set("X-Booking-Manage-Token", created.body.data.managementToken)
        .send({
          bookingCode: created.body.data.bookingCode,
          newTimeSlot: formatForApi(tomorrowAt(12)),
          newDuration: 1,
        })
        .expect(400);
    } finally {
      delete process.env.REQUIRE_IDEMPOTENCY_KEY;
    }
  });

  it("replays a completed reschedule for the same idempotency key", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(10)) }))
      .expect(201);
    const idempotencyKey = "retry-safe-reschedule-key";
    const payload = {
      bookingCode: created.body.data.bookingCode,
      newTimeSlot: formatForApi(tomorrowAt(12)),
      newDuration: 1,
    };

    const first = await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", created.body.data.managementToken)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload)
      .expect(200);
    const replay = await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", created.body.data.managementToken)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload)
      .expect(200);

    expect(replay.body).toEqual(first.body);
    expect(await BookingSlot.countDocuments()).toBe(2);
  });

  it.each(["Cancelado", "Finalizado"])(
    "rejects every public mutation when a booking is %s",
    async (status) => {
      const created = await request(app)
        .post("/api/bookings/reserve")
        .send(validBookingPayload())
        .expect(201);
      const bookingCode = created.body.data.bookingCode;
      const managementToken = created.body.data.managementToken;
      await Booking.updateOne({ bookingCode }, { $set: { status } });

      await request(app)
        .post("/api/bookings/reschedule")
        .set("X-Booking-Manage-Token", managementToken)
        .send({
          bookingCode,
          newTimeSlot: formatForApi(tomorrowAt(12)),
          newDuration: 1,
        })
        .expect(400);
      await request(app)
        .post("/api/bookings/cancel")
        .set("X-Booking-Manage-Token", managementToken)
        .send({ bookingCode })
        .expect(400);
      await request(app)
        .post("/api/bookings/confirm-attendance")
        .set("X-Booking-Manage-Token", managementToken)
        .send({ bookingCode })
        .expect(400);
      await request(app)
        .put(`/api/bookings/${bookingCode}/notes`)
        .set("X-Booking-Manage-Token", managementToken)
        .send({ studentNotes: "No debe persistirse" })
        .expect(400);

      const persisted = await Booking.findOne({ bookingCode }).lean();
      expect(persisted.status).toBe(status);
      expect(persisted.studentNotes).toBe("");
    },
  );

  it("rejects every public mutation after an active booking has expired", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const bookingCode = created.body.data.bookingCode;
    const managementToken = created.body.data.managementToken;
    const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const pastEnd = new Date(Date.now() - 60 * 60 * 1000);
    await Booking.updateOne(
      { bookingCode },
      {
        $set: {
          status: "Pendiente",
          timeSlot: pastStart,
          endTime: pastEnd,
        },
      },
    );

    await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", managementToken)
      .send({
        bookingCode,
        newTimeSlot: formatForApi(tomorrowAt(12)),
        newDuration: 1,
      })
      .expect(400);
    await request(app)
      .post("/api/bookings/cancel")
      .set("X-Booking-Manage-Token", managementToken)
      .send({ bookingCode })
      .expect(400);
    await request(app)
      .post("/api/bookings/confirm-attendance")
      .set("X-Booking-Manage-Token", managementToken)
      .send({ bookingCode })
      .expect(400);
    await request(app)
      .put(`/api/bookings/${bookingCode}/notes`)
      .set("X-Booking-Manage-Token", managementToken)
      .send({ studentNotes: "No debe persistirse" })
      .expect(400);

    const persisted = await Booking.findOne({ bookingCode }).lean();
    expect(persisted.status).toBe("Pendiente");
    expect(persisted.studentNotes).toBe("");
  });

  it("returns the same 202 response for every management-link request and only rotates on a match", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const bookingCode = created.body.data.bookingCode;
    const initial = await Booking.findOne({ bookingCode })
      .select("+managementTokenHash +managementLinkLastSentAt")
      .lean();

    const wrongEmail = await request(app)
      .post("/api/bookings/manage/request-link")
      .send({ bookingCode, email: "wrong@example.com" })
      .expect(202);
    const afterWrongEmail = await Booking.findOne({ bookingCode })
      .select("+managementTokenHash +managementLinkLastSentAt")
      .lean();
    expect(afterWrongEmail.managementTokenHash).toBe(initial.managementTokenHash);
    expect(sendManagementLinkEmailMock).not.toHaveBeenCalled();

    const missingBooking = await request(app)
      .post("/api/bookings/manage/request-link")
      .send({ bookingCode: "ABC234", email: "familia@example.com" })
      .expect(202);
    expect(missingBooking.body).toEqual(wrongEmail.body);

    const matched = await request(app)
      .post("/api/bookings/manage/request-link")
      .send({ bookingCode, email: "familia@example.com" })
      .expect(202);
    const afterMatch = await Booking.findOne({ bookingCode })
      .select("+managementTokenHash +managementLinkLastSentAt")
      .lean();
    expect(matched.body).toEqual(wrongEmail.body);
    expect(afterMatch.managementTokenHash).not.toBe(initial.managementTokenHash);
    expect(afterMatch.managementTokenRevokedAt).toBeNull();
    expect(sendManagementLinkEmailMock).toHaveBeenCalledTimes(1);
    const sentUrl = sendManagementLinkEmailMock.mock.calls[0][0].managementUrl;
    expect(sentUrl).toMatch(
      /^https:\/\/frontend\.example\.com\/m#token=[A-Za-z0-9_-]{43}$/,
    );

    await request(app)
      .post("/api/bookings/manage/request-link")
      .send({ bookingCode, email: "familia@example.com" })
      .expect(202);
    const afterCooldown = await Booking.findOne({ bookingCode })
      .select("+managementTokenHash +managementLinkLastSentAt")
      .lean();
    expect(afterCooldown.managementTokenHash).toBe(afterMatch.managementTokenHash);
    expect(sendManagementLinkEmailMock).toHaveBeenCalledTimes(1);
  });

  it("restores the previous token when management-link email delivery fails", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const bookingCode = created.body.data.bookingCode;
    const initial = await Booking.findOne({ bookingCode })
      .select("+managementTokenHash +managementLinkLastSentAt")
      .lean();
    sendManagementLinkEmailMock.mockResolvedValueOnce(false);

    await request(app)
      .post("/api/bookings/manage/request-link")
      .send({ bookingCode, email: "familia@example.com" })
      .expect(202);

    const afterFailure = await Booking.findOne({ bookingCode })
      .select("+managementTokenHash +managementLinkLastSentAt")
      .lean();
    expect(afterFailure.managementTokenHash).toBe(initial.managementTokenHash);
    expect(afterFailure.managementTokenExpiresAt).toEqual(
      initial.managementTokenExpiresAt,
    );
  });

  it("provisions a management token for a matching legacy booking", async () => {
    const start = tomorrowAt(16);
    const legacy = await Booking.create({
      ...validBookingPayload(),
      timeSlot: start,
      endTime: new Date(start.getTime() + 60 * 60 * 1000),
      status: "Confirmado",
    });
    const before = await Booking.findById(legacy._id)
      .select("+managementTokenHash")
      .lean();
    expect(before.managementTokenHash).toBeUndefined();

    await request(app)
      .post("/api/bookings/manage/request-link")
      .send({
        bookingCode: legacy.bookingCode,
        email: "familia@example.com",
      })
      .expect(202);

    const after = await Booking.findById(legacy._id)
      .select("+managementTokenHash")
      .lean();
    expect(after.managementTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sendManagementLinkEmailMock).toHaveBeenCalledTimes(1);
  });

  it("authorizes management reads without exposing private or token fields", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const { bookingCode, managementToken } = created.body.data;
    await Booking.updateOne(
      { bookingCode },
      {
        $set: {
          notes: "Nota privada",
          studentEvolution: "Evolución privada",
          emotionalState: "Estado privado",
        },
      },
    );

    const managed = await request(app)
      .get("/api/bookings/manage")
      .set("X-Booking-Manage-Token", managementToken)
      .expect(200);

    expect(managed.body.data.bookingCode).toBe(bookingCode);
    expect(managed.body.data.email).toBe("familia@example.com");
    for (const field of [
      "notes",
      "studentEvolution",
      "emotionalState",
      "notesHistory",
      "managementTokenHash",
      "managementTokenExpiresAt",
      "managementTokenRevokedAt",
      "price",
      "_id",
    ]) {
      expect(managed.body.data).not.toHaveProperty(field);
    }
  });

  it("uniformly rejects invalid, expired, and revoked management tokens", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const { bookingCode, managementToken } = created.body.data;

    const invalid = await request(app)
      .get("/api/bookings/manage")
      .set("X-Booking-Manage-Token", "a".repeat(64))
      .expect(401);

    await Booking.updateOne(
      { bookingCode },
      { $set: { managementTokenExpiresAt: new Date(Date.now() - 1000) } },
    );
    const expired = await request(app)
      .get("/api/bookings/manage")
      .set("X-Booking-Manage-Token", managementToken)
      .expect(401);
    expect(expired.body.message).toBe(invalid.body.message);

    await Booking.updateOne(
      { bookingCode },
      {
        $set: {
          managementTokenExpiresAt: new Date(Date.now() + 60_000),
          managementTokenRevokedAt: null,
        },
      },
    );
    await request(app)
      .post("/api/bookings/manage/revoke")
      .set("X-Booking-Manage-Token", managementToken)
      .expect(204);
    const revoked = await request(app)
      .get("/api/bookings/manage")
      .set("X-Booking-Manage-Token", managementToken)
      .expect(401);
    expect(revoked.body.message).toBe(invalid.body.message);
  });

  it("requires the management token for mutations and prevents cross-booking use", async () => {
    const first = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const second = await request(app)
      .post("/api/bookings/reserve")
      .send(
        validBookingPayload({
          studentName: "Lucia Perez",
          email: "lucia@example.com",
          timeSlot: formatForApi(tomorrowAt(14)),
        }),
      )
      .expect(201);

    await request(app)
      .post("/api/bookings/cancel")
      .send({ bookingCode: first.body.data.bookingCode })
      .expect(401);
    await request(app)
      .post("/api/bookings/cancel")
      .set("X-Booking-Manage-Token", first.body.data.managementToken)
      .send({ bookingCode: second.body.data.bookingCode })
      .expect(403);

    const persisted = await Booking.find({}).lean();
    expect(persisted.every((booking) => booking.status !== "Cancelado")).toBe(true);
  });

  it("retries transient slot cleanup failures for every booking lifecycle mutation", async () => {
    const token = await createAdminAndLogin();
    const failNextCleanup = () =>
      vi.spyOn(BookingSlot, "deleteMany").mockRejectedValueOnce(
        new Error("transient slot cleanup failure"),
      );

    const cancellable = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(8)) }))
      .expect(201);
    let cleanupSpy = failNextCleanup();
    await request(app)
      .post("/api/bookings/cancel")
      .set("X-Booking-Manage-Token", cancellable.body.data.managementToken)
      .send({ bookingCode: cancellable.body.data.bookingCode })
      .expect(200);
    cleanupSpy.mockRestore();
    expect(await BookingSlot.countDocuments()).toBe(0);

    const reschedulable = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(10)) }))
      .expect(201);
    cleanupSpy = failNextCleanup();
    await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", reschedulable.body.data.managementToken)
      .send({
        bookingCode: reschedulable.body.data.bookingCode,
        newTimeSlot: formatForApi(tomorrowAt(12)),
        newDuration: 1,
      })
      .expect(200);
    cleanupSpy.mockRestore();
    const rescheduledBooking = await Booking.findOne({
      bookingCode: reschedulable.body.data.bookingCode,
    }).lean();
    expect(await BookingSlot.countDocuments({ booking: rescheduledBooking._id })).toBe(2);

    const adminEditable = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(14)) }))
      .expect(201);
    const adminEditableBooking = await Booking.findOne({
      bookingCode: adminEditable.body.data.bookingCode,
    }).lean();
    cleanupSpy = failNextCleanup();
    await request(app)
      .put(`/api/bookings/${adminEditableBooking._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ timeSlot: formatForApi(tomorrowAt(16)) })
      .expect(200);
    cleanupSpy.mockRestore();
    expect(await BookingSlot.countDocuments({ booking: adminEditableBooking._id })).toBe(2);

    const deletable = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(18)) }))
      .expect(201);
    const deletableBooking = await Booking.findOne({
      bookingCode: deletable.body.data.bookingCode,
    }).lean();
    cleanupSpy = failNextCleanup();
    await request(app)
      .delete(`/api/bookings/${deletableBooking._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    cleanupSpy.mockRestore();
    expect(await BookingSlot.countDocuments({ booking: deletableBooking._id })).toBe(0);
  }, 20000);

  it("self-heals a phantom slot after cleanup retries are exhausted", async () => {
    const targetTime = formatForApi(tomorrowAt(10));
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: targetTime }))
      .expect(201);
    const stored = await Booking.findOne({
      bookingCode: created.body.data.bookingCode,
    }).lean();
    const cleanupSpy = vi
      .spyOn(BookingSlot, "deleteMany")
      .mockRejectedValue(new Error("persistent slot cleanup failure"));

    try {
      await request(app)
        .post("/api/bookings/cancel")
        .set("X-Booking-Manage-Token", created.body.data.managementToken)
        .send({ bookingCode: created.body.data.bookingCode })
        .expect(200);
    } finally {
      cleanupSpy.mockRestore();
    }

    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(2);

    const replacement = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ studentName: "Alumno reemplazo", timeSlot: targetTime }))
      .expect(201);
    const replacementBooking = await Booking.findOne({
      bookingCode: replacement.body.data.bookingCode,
    }).lean();

    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(0);
    expect(await BookingSlot.countDocuments({ booking: replacementBooking._id })).toBe(2);
  });

  it("never reconciles an in-flight slot owned by an active mutation lock", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: formatForApi(tomorrowAt(10)) }))
      .expect(201);
    const owner = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    const inFlightSlotStart = tomorrowAt(12);
    await Booking.updateOne(
      { _id: owner._id },
      {
        $set: {
          slotMutationLock: "active-test-lock",
          slotMutationLockExpiresAt: new Date(Date.now() + 30_000),
        },
      },
    );
    const inFlightSlot = await BookingSlot.create({
      booking: owner._id,
      slotStart: inFlightSlotStart,
      slotDurationMinutes: 30,
    });

    await expect(
      claimBookingSlots({
        bookingId: new mongoose.Types.ObjectId(),
        slotStarts: [inFlightSlotStart],
        slotDurationMinutes: 30,
      }),
    ).rejects.toBeInstanceOf(BookingSlotConflictError);

    expect(await BookingSlot.exists({ _id: inFlightSlot._id })).not.toBeNull();
  });

  it("reconciles stale slots left by a soft delete with failed cleanup", async () => {
    const token = await createAdminAndLogin();
    const targetTime = formatForApi(tomorrowAt(10));
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: targetTime }))
      .expect(201);
    const stored = await Booking.findOne({
      bookingCode: created.body.data.bookingCode,
    }).lean();
    await BookingSlot.collection.updateMany(
      { booking: stored._id },
      { $set: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } },
    );
    const cleanupSpy = vi
      .spyOn(BookingSlot, "deleteMany")
      .mockRejectedValue(new Error("persistent delete cleanup failure"));

    try {
      await request(app)
        .delete(`/api/bookings/${stored._id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    } finally {
      cleanupSpy.mockRestore();
    }

    expect((await Booking.findById(stored._id)).deletedAt).toBeInstanceOf(Date);
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(2);

    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ studentName: "Alumno tras borrado", timeSlot: targetTime }))
      .expect(201);

    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(0);
  }, 15000);

  it("serializes client cancellation against an in-flight reschedule", async () => {
    const sourceTime = formatForApi(tomorrowAt(10));
    const targetTime = tomorrowAt(12);
    const targetInstant = parseDateTimeInput(formatForApi(targetTime));
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: sourceTime }))
      .expect(201);
    const stored = await Booking.findOne({
      bookingCode: created.body.data.bookingCode,
    }).lean();

    const originalFindOneAndUpdate = Booking.findOneAndUpdate;
    let resumeReschedule;
    let signalReschedulePaused;
    let intercepted = false;
    const reschedulePaused = new Promise((resolve) => {
      signalReschedulePaused = resolve;
    });
    const rescheduleGate = new Promise((resolve) => {
      resumeReschedule = resolve;
    });
    const updateSpy = vi
      .spyOn(Booking, "findOneAndUpdate")
      .mockImplementation(function updateWithPausedReschedule(filter, update, options) {
        const isTargetReschedule =
          !intercepted &&
          String(filter?._id) === String(stored._id) &&
          new Date(update?.$set?.timeSlot).getTime() === targetInstant.getTime() &&
          update?.$set?.status === "Confirmado";
        if (!isTargetReschedule) {
          return originalFindOneAndUpdate.call(this, filter, update, options);
        }

        intercepted = true;
        signalReschedulePaused();
        return rescheduleGate.then(() =>
          originalFindOneAndUpdate.call(this, filter, update, options));
      });

    const reschedulePromise = request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", created.body.data.managementToken)
      .send({
        bookingCode: created.body.data.bookingCode,
        newTimeSlot: formatForApi(targetTime),
        newDuration: 1,
      })
      .then((response) => response);

    let cancellation;
    let replacement;
    let rescheduled;
    try {
      await reschedulePaused;
      cancellation = await request(app)
        .post("/api/bookings/cancel")
        .set("X-Booking-Manage-Token", created.body.data.managementToken)
        .send({ bookingCode: created.body.data.bookingCode });
      replacement = await request(app)
        .post("/api/bookings/reserve")
        .send(validBookingPayload({
          studentName: "Alumno concurrente",
          email: "concurrente@example.com",
          timeSlot: formatForApi(targetTime),
        }));
    } finally {
      resumeReschedule();
      rescheduled = await reschedulePromise;
      updateSpy.mockRestore();
    }

    expect(cancellation.status).toBe(409);
    expect(replacement.status).toBe(409);
    expect(rescheduled.status).toBe(200);
    expect(await Booking.countDocuments({
      status: { $nin: ["Cancelado", "Finalizado"] },
      timeSlot: targetInstant,
    })).toBe(1);
  }, 15000);

  it("serializes attendance confirmation against cancellation and replacement", async () => {
    const targetTime = formatForApi(tomorrowAt(10));
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot: targetTime }))
      .expect(201);
    const stored = await Booking.findOne({
      bookingCode: created.body.data.bookingCode,
    }).lean();
    await Booking.updateOne({ _id: stored._id }, { $set: { status: "Pendiente" } });

    const originalFindOneAndUpdate = Booking.findOneAndUpdate;
    let resumeConfirmation;
    let signalConfirmationPaused;
    let intercepted = false;
    const confirmationPaused = new Promise((resolve) => {
      signalConfirmationPaused = resolve;
    });
    const confirmationGate = new Promise((resolve) => {
      resumeConfirmation = resolve;
    });
    const updateSpy = vi
      .spyOn(Booking, "findOneAndUpdate")
      .mockImplementation(function updateWithPausedConfirmation(filter, update, options) {
        const isConfirmation =
          !intercepted &&
          String(filter?._id) === String(stored._id) &&
          update?.$set?.status === "Confirmado" &&
          update?.$set?.timeSlot === undefined;
        if (!isConfirmation) {
          return originalFindOneAndUpdate.call(this, filter, update, options);
        }

        intercepted = true;
        signalConfirmationPaused();
        return confirmationGate.then(() =>
          originalFindOneAndUpdate.call(this, filter, update, options));
      });

    const confirmationPromise = request(app)
      .post("/api/bookings/confirm-attendance")
      .set("X-Booking-Manage-Token", created.body.data.managementToken)
      .send({ bookingCode: created.body.data.bookingCode })
      .then((response) => response);

    let cancellation;
    let replacement;
    let confirmation;
    try {
      await confirmationPaused;
      cancellation = await request(app)
        .post("/api/bookings/cancel")
        .set("X-Booking-Manage-Token", created.body.data.managementToken)
        .send({ bookingCode: created.body.data.bookingCode });
      replacement = await request(app)
        .post("/api/bookings/reserve")
        .send(validBookingPayload({
          studentName: "Alumno tras confirmacion concurrente",
          email: "confirmacion.concurrente@example.com",
          timeSlot: targetTime,
        }));
    } finally {
      resumeConfirmation();
      confirmation = await confirmationPromise;
      updateSpy.mockRestore();
    }

    expect(cancellation.status).toBe(409);
    expect(replacement.status).toBe(400);
    expect(confirmation.status).toBe(200);
    expect(await Booking.countDocuments({
      status: { $nin: ["Cancelado", "Finalizado"] },
      timeSlot: parseDateTimeInput(targetTime),
    })).toBe(1);
  }, 15000);

  it("soft-deletes an admin booking, releases its slots and writes a sanitized audit event", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();

    await request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Request-Id", "delete-audit-request")
      .expect(200);

    const deleted = await Booking.findById(stored._id).lean();
    expect(deleted).not.toBeNull();
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(String(deleted.deletedBy)).toBeTruthy();
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(0);

    const audit = await AuditEvent.findOne({ entityId: stored._id, action: "booking.deleted" }).lean();
    expect(audit).toMatchObject({
      entityType: "Booking",
      requestId: "delete-audit-request",
      actor: { role: "admin", username: "admin@example.com" },
    });
    expect(String(audit.actor.id)).toBe(String(deleted.deletedBy));
    expect(audit.before.bookingCode).toBe(stored.bookingCode);
    expect(audit.after.deletedAt).toBeTruthy();
    expect(JSON.stringify(audit)).not.toMatch(/managementToken|slotMutationLock/i);
  });

  it("excludes deleted bookings from operations and exposes them only through scope=trash", async () => {
    const token = await createAdminAndLogin();
    const timeSlot = formatForApi(tomorrowAt(10));
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();

    await request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const activeList = await request(app)
      .get("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(activeList.body.data).toHaveLength(0);

    const trashList = await request(app)
      .get("/api/bookings?scope=trash")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(trashList.body.data).toHaveLength(1);
    expect(trashList.body.data[0]._id).toBe(String(stored._id));

    const stats = await request(app)
      .get("/api/bookings/stats")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(stats.body.data.stats.total).toBe(0);

    await request(app)
      .put(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "No debe mutarse" })
      .expect(404);

    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({
        studentName: "Reemplazo activo",
        email: "reemplazo@example.com",
        timeSlot,
      }))
      .expect(201);

    const reminderTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await Booking.updateMany({ deletedAt: null }, { $set: { status: "Pendiente" } });
    await Booking.updateOne(
      { _id: stored._id },
      { $set: { status: "Confirmado", timeSlot: reminderTime, endTime: new Date(reminderTime.getTime() + 3600000) } },
    );
    await processReminders();
    expect(sendReminderNotificationMock).not.toHaveBeenCalled();
  });

  it("restores a trashed booking only after revalidating and reclaiming its slots", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .post(`/api/bookings/${stored._id}/restore`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Request-Id", "restore-audit-request")
      .expect(200);

    const restored = await Booking.findById(stored._id).lean();
    expect(restored.deletedAt).toBeNull();
    expect(restored.deletedBy).toBeNull();
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(2);
    expect(await AuditEvent.exists({
      entityId: stored._id,
      action: "booking.restored",
      requestId: "restore-audit-request",
    })).toBeTruthy();
  });

  it("returns 409 and keeps a booking trashed when its original slot is occupied", async () => {
    const token = await createAdminAndLogin();
    const timeSlot = formatForApi(tomorrowAt(10));
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({
        studentName: "Ocupa el horario",
        email: "ocupa@example.com",
        timeSlot,
      }))
      .expect(201);

    await request(app)
      .post(`/api/bookings/${stored._id}/restore`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);

    const stillDeleted = await Booking.findById(stored._id).lean();
    expect(stillDeleted.deletedAt).toBeInstanceOf(Date);
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(0);
  });

  it("compensates a soft delete when its audit event cannot be persisted", async () => {
    const token = await createAdminAndLogin();
    const timeSlot = formatForApi(tomorrowAt(10));
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    const resetWriter = setAuditWriterForTests(async () => {
      throw new Error("audit unavailable");
    });

    try {
      await request(app)
        .delete(`/api/bookings/${stored._id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(500);
    } finally {
      resetWriter();
    }

    const unchanged = await Booking.findById(stored._id)
      .select("+slotMutationLock +slotMutationLockExpiresAt")
      .lean();
    expect(unchanged.deletedAt).toBeNull();
    expect(unchanged.deletedBy).toBeNull();
    expect(unchanged.slotMutationLock).toBeUndefined();
    expect(unchanged.slotMutationLockExpiresAt).toBeUndefined();
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(2);
    expect(await AuditEvent.countDocuments()).toBe(0);

    const replacement = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({
        studentName: "No duplica sin auditoria",
        email: "sin-auditoria@example.com",
        timeSlot,
      }));
    expect(replacement.status).not.toBe(201);
  });

  it("keeps delete ownership locked until its audit event commits", async () => {
    const token = await createAdminAndLogin();
    const timeSlot = formatForApi(tomorrowAt(10));
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    let resumeAudit;
    let signalAuditPaused;
    const auditPaused = new Promise((resolve) => { signalAuditPaused = resolve; });
    const auditGate = new Promise((resolve) => { resumeAudit = resolve; });
    const resetWriter = setAuditWriterForTests(({ document, timeoutMS }) => {
      if (document.action !== "booking.deleted") return writeAuditDocument({ document, timeoutMS });
      signalAuditPaused();
      return auditGate.then(() => writeAuditDocument({ document, timeoutMS }));
    });

    const deletionPromise = request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .then((response) => response);

    let replacement;
    let deletion;
    try {
      await auditPaused;
      replacement = await request(app)
        .post("/api/bookings/reserve")
        .send(validBookingPayload({
          studentName: "Intento durante auditoria",
          email: "durante-auditoria@example.com",
          timeSlot,
        }));
    } finally {
      resumeAudit();
      deletion = await deletionPromise;
      resetWriter();
    }

    expect(replacement.status).toBe(409);
    expect(deletion.status).toBe(200);
    await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({
        studentName: "Reemplazo tras auditoria",
        email: "tras-auditoria@example.com",
        timeSlot,
      }))
      .expect(201);
    expect(await Booking.countDocuments({ deletedAt: null, timeSlot: parseDateTimeInput(timeSlot) })).toBe(1);
  }, 15000);

  it("compensates a restore when its audit event cannot be persisted", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const resetWriter = setAuditWriterForTests(async () => {
      throw new Error("audit unavailable");
    });

    try {
      await request(app)
        .post(`/api/bookings/${stored._id}/restore`)
        .set("Authorization", `Bearer ${token}`)
        .expect(500);
    } finally {
      resetWriter();
    }

    const stillDeleted = await Booking.findById(stored._id)
      .select("+slotMutationLock +slotMutationLockExpiresAt")
      .lean();
    expect(stillDeleted.deletedAt).toBeInstanceOf(Date);
    expect(stillDeleted.slotMutationLock).toBeUndefined();
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(0);
    expect(await AuditEvent.countDocuments({ action: "booking.restored" })).toBe(0);
  });

  it("keeps restore ownership locked until its audit event commits", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    let resumeAudit;
    let signalAuditPaused;
    const auditPaused = new Promise((resolve) => { signalAuditPaused = resolve; });
    const auditGate = new Promise((resolve) => { resumeAudit = resolve; });
    const resetWriter = setAuditWriterForTests(({ document, timeoutMS }) => {
      if (document.action !== "booking.restored") return writeAuditDocument({ document, timeoutMS });
      signalAuditPaused();
      return auditGate.then(() => writeAuditDocument({ document, timeoutMS }));
    });

    const restorePromise = request(app)
      .post(`/api/bookings/${stored._id}/restore`)
      .set("Authorization", `Bearer ${token}`)
      .then((response) => response);

    let concurrentDelete;
    let restored;
    try {
      await auditPaused;
      concurrentDelete = await request(app)
        .delete(`/api/bookings/${stored._id}`)
        .set("Authorization", `Bearer ${token}`);
    } finally {
      resumeAudit();
      restored = await restorePromise;
      resetWriter();
    }

    expect(concurrentDelete.status).toBe(409);
    expect(restored.status).toBe(200);
    const finalBooking = await Booking.findById(stored._id)
      .select("+slotMutationLock +slotMutationLockExpiresAt")
      .lean();
    expect(finalBooking.deletedAt).toBeNull();
    expect(finalBooking.slotMutationLock).toBeUndefined();
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(2);
  }, 15000);

  it("provisions the soft-delete and audit indexes idempotently without dropping indexes", async () => {
    await ensureOperationalIndexes(mongoose.connection);
    await ensureOperationalIndexes(mongoose.connection);

    const bookingIndexNames = (await Booking.collection.indexes()).map((index) => index.name);
    const auditIndexNames = (await AuditEvent.collection.indexes()).map((index) => index.name);
    expect(bookingIndexNames).toEqual(expect.arrayContaining([
      "deletedAt_1",
      "deletedAt_1_timeSlot_-1",
    ]));
    expect(auditIndexNames).toEqual(expect.arrayContaining([
      "entityId_1",
      "entityType_1_entityId_1_createdAt_-1",
      "action_1_createdAt_-1",
    ]));
  });

  it("times out delete auditing before its lease and blocks replacement, delete and restore races", async () => {
    expect(AUDIT_WRITE_TIMEOUT_MS).toBeLessThan(SLOT_MUTATION_LOCK_MS);
    const token = await createAdminAndLogin();
    const timeSlot = formatForApi(tomorrowAt(10));
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload({ timeSlot }))
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    let signalAuditStarted;
    const auditStarted = new Promise((resolve) => { signalAuditStarted = resolve; });
    const resetWriter = setAuditWriterForTests(({ timeoutMS }) => {
      signalAuditStarted(timeoutMS);
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error("bounded audit timeout")), timeoutMS);
      });
    });

    const deletionPromise = request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .then((response) => response);

    let deletion;
    try {
      const timeoutMS = await auditStarted;
      const locked = await Booking.findById(stored._id)
        .select("+slotMutationLock +slotMutationLockExpiresAt")
        .lean();
      expect(new Date(locked.slotMutationLockExpiresAt).getTime() - Date.now()).toBeGreaterThan(timeoutMS);

      const [replacement, concurrentDelete, concurrentRestore] = await Promise.all([
        request(app)
          .post("/api/bookings/reserve")
          .send(validBookingPayload({
            studentName: "No entra durante timeout",
            email: "timeout-delete@example.com",
            timeSlot,
          })),
        request(app)
          .delete(`/api/bookings/${stored._id}`)
          .set("Authorization", `Bearer ${token}`),
        request(app)
          .post(`/api/bookings/${stored._id}/restore`)
          .set("Authorization", `Bearer ${token}`),
      ]);
      expect(replacement.status).toBe(409);
      expect(concurrentDelete.status).toBe(409);
      expect(concurrentRestore.status).toBe(409);
      deletion = await deletionPromise;
    } finally {
      resetWriter();
    }

    expect(deletion.status).toBe(500);
    const finalBooking = await Booking.findById(stored._id)
      .select("+slotMutationLock +slotMutationLockExpiresAt")
      .lean();
    expect(finalBooking.deletedAt).toBeNull();
    expect(finalBooking.slotMutationLock).toBeUndefined();
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(2);
    expect(await AuditEvent.countDocuments()).toBe(0);
    expect(await Booking.countDocuments({ deletedAt: null, timeSlot: parseDateTimeInput(timeSlot) })).toBe(1);
  }, 15000);

  it("times out restore auditing before its lease without allowing a concurrent delete", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    let signalAuditStarted;
    const auditStarted = new Promise((resolve) => { signalAuditStarted = resolve; });
    const resetWriter = setAuditWriterForTests(({ document, timeoutMS }) => {
      if (document.action !== "booking.restored") return writeAuditDocument({ document, timeoutMS });
      signalAuditStarted(timeoutMS);
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error("bounded audit timeout")), timeoutMS);
      });
    });

    const restorePromise = request(app)
      .post(`/api/bookings/${stored._id}/restore`)
      .set("Authorization", `Bearer ${token}`)
      .then((response) => response);
    let restore;
    try {
      const timeoutMS = await auditStarted;
      const locked = await Booking.findById(stored._id)
        .select("+slotMutationLock +slotMutationLockExpiresAt")
        .lean();
      expect(new Date(locked.slotMutationLockExpiresAt).getTime() - Date.now()).toBeGreaterThan(timeoutMS);
      const concurrentDelete = await request(app)
        .delete(`/api/bookings/${stored._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(concurrentDelete.status).toBe(409);
      restore = await restorePromise;
    } finally {
      resetWriter();
    }

    expect(restore.status).toBe(500);
    const finalBooking = await Booking.findById(stored._id)
      .select("+slotMutationLock +slotMutationLockExpiresAt")
      .lean();
    expect(finalBooking.deletedAt).toBeInstanceOf(Date);
    expect(finalBooking.slotMutationLock).toBeUndefined();
    expect(await BookingSlot.countDocuments({ booking: stored._id })).toBe(0);
    expect(await AuditEvent.countDocuments({ action: "booking.restored" })).toBe(0);
  }, 15000);

  it("persists explicit audit timestamps so the audit index returns deterministic chronology", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await request(app)
      .post(`/api/bookings/${stored._id}/restore`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const auditIndexes = await AuditEvent.collection.indexes();
    expect(auditIndexes.some((index) =>
      index.name === "entityType_1_entityId_1_createdAt_-1")).toBe(true);
    const events = await AuditEvent.find({ entityId: stored._id })
      .sort({ createdAt: -1 })
      .lean();
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.createdAt instanceof Date)).toBe(true);
    expect(events.map((event) => event.action)).toEqual([
      "booking.restored",
      "booking.deleted",
    ]);
    expect(events[0].createdAt.getTime()).toBeGreaterThan(events[1].createdAt.getTime());
  });

  it("never reactivates a delete compensation after the locked document changed", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    const resetWriter = setAuditWriterForTests(async ({ document }) => {
      await Booking.collection.updateOne(
        { _id: document.entityId },
        { $set: { updatedAt: new Date(Date.now() + 1_000) } },
      );
      throw new Error("audit failed after authoritative change");
    });

    try {
      await request(app)
        .delete(`/api/bookings/${stored._id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(500);
    } finally {
      resetWriter();
    }

    const finalBooking = await Booking.findById(stored._id).lean();
    expect(finalBooking.deletedAt).toBeInstanceOf(Date);
    expect(await AuditEvent.countDocuments()).toBe(0);
  });

  it("reports modifiedCount zero and never reactivates after the server lease expired", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const resetWriter = setAuditWriterForTests(async ({ document }) => {
      await Booking.collection.updateOne(
        { _id: document.entityId },
        { $set: { slotMutationLockExpiresAt: new Date(Date.now() - 1_000) } },
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error("audit failed after lease expiry");
    });

    try {
      await request(app)
        .delete(`/api/bookings/${stored._id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(500);
    } finally {
      resetWriter();
    }

    const finalBooking = await Booking.findById(stored._id).lean();
    expect(finalBooking.deletedAt).toBeInstanceOf(Date);
    expect(errorSpy).toHaveBeenCalledWith(
      "[audit-compensation]",
      expect.stringContaining("booking_delete_audit_compensation_lost_lease"),
    );
    errorSpy.mockRestore();
    expect(await AuditEvent.countDocuments()).toBe(0);
  });

  it("requires admin authentication to record attendance", async () => {
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();

    await request(app)
      .patch(`/api/bookings/${stored._id}/attendance`)
      .send({ attendanceStatus: "Presente" })
      .expect(401);

    expect((await Booking.findById(stored._id).lean()).attendanceStatus).toBe("Sin registrar");
  });

  it("strictly validates attendance status and rejects extra payload fields", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();

    await request(app)
      .patch(`/api/bookings/${stored._id}/attendance`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendanceStatus: "Llegó tarde" })
      .expect(400);

    await request(app)
      .patch(`/api/bookings/${stored._id}/attendance`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendanceStatus: "Presente", status: "Finalizado" })
      .expect(400);

    expect(await AuditEvent.countDocuments({ action: "booking.attendance.updated" })).toBe(0);
  });

  it("treats legacy bookings without attendance fields as unregistered", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await Booking.collection.updateOne(
      { _id: stored._id },
      { $unset: { attendanceStatus: "", attendanceRecordedAt: "", attendanceNotes: "", attendanceUpdatedBy: "" } },
    );

    const response = await request(app)
      .patch(`/api/bookings/${stored._id}/attendance`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendanceStatus: "Recuperatorio" })
      .expect(200);

    expect(response.body.data.attendanceStatus).toBe("Recuperatorio");
    const audit = await AuditEvent.findOne({
      entityId: stored._id,
      action: "booking.attendance.updated",
    }).lean();
    expect(audit.before.attendanceStatus).toBe("Sin registrar");
    expect(audit.after.attendanceStatus).toBe("Recuperatorio");
  });

  it("rejects attendance changes for soft-deleted bookings", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();
    await request(app)
      .delete(`/api/bookings/${stored._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .patch(`/api/bookings/${stored._id}/attendance`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendanceStatus: "Ausente" })
      .expect(404);

    expect(await AuditEvent.countDocuments({ action: "booking.attendance.updated" })).toBe(0);
  });

  it("records sanitized attendance before and after values with the admin actor", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();

    const response = await request(app)
      .patch(`/api/bookings/${stored._id}/attendance`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Request-Id", "attendance-audit-request")
      .send({ attendanceStatus: "Cancelación tardía", attendanceNotes: "Avisó 20 minutos antes." })
      .expect(200);

    expect(response.body.data).toMatchObject({
      attendanceStatus: "Cancelación tardía",
      attendanceNotes: "Avisó 20 minutos antes.",
    });
    expect(response.body.data.attendanceRecordedAt).toBeTruthy();
    const audit = await AuditEvent.findOne({ entityId: stored._id, action: "booking.attendance.updated" }).lean();
    expect(audit).toMatchObject({
      requestId: "attendance-audit-request",
      actor: { role: "admin", username: "admin@example.com" },
      before: { attendanceStatus: "Sin registrar" },
      after: {
        attendanceStatus: "Cancelación tardía",
        attendanceNotes: "Avisó 20 minutos antes.",
      },
    });
    expect(JSON.stringify(audit)).not.toMatch(/managementToken|slotMutationLock/i);
  });

  it("allows only one concurrent attendance update and audit event", async () => {
    const token = await createAdminAndLogin();
    const created = await request(app)
      .post("/api/bookings/reserve")
      .send(validBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: created.body.data.bookingCode }).lean();

    const [first, second] = await Promise.all([
      request(app)
        .patch(`/api/bookings/${stored._id}/attendance`)
        .set("Authorization", `Bearer ${token}`)
        .send({ attendanceStatus: "Presente" }),
      request(app)
        .patch(`/api/bookings/${stored._id}/attendance`)
        .set("Authorization", `Bearer ${token}`)
        .send({ attendanceStatus: "No-show" }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await AuditEvent.countDocuments({
      entityId: stored._id,
      action: "booking.attendance.updated",
    })).toBe(1);
  });
});
