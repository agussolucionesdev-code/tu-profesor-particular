import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

let app;
let mongoServer;
let Booking;
let BookingSlot;
let Student;
let StudentMigrationRun;
let StudentMigrationDryRunObservation;
let User;
let linkBookingToStudent;
let migrateStudents;
let rollbackStudentMigration;
let normalizeIdentityText;
let processPendingStudentLinks;
let createStudentLinkReconciler;
let buildStudentIdentity;

const bookingSnapshot = (overrides = {}) => ({
  studentName: "Juan Pérez",
  responsibleName: "María Pérez",
  responsibleRelationship: "madre",
  responsibleRelationshipOther: "",
  tutorName: "Agustin",
  phone: "+54 9 11 2222-3333",
  email: "familia@example.com",
  school: "Escuela Normal",
  educationLevel: "Secundaria",
  yearGrade: "3er año",
  subject: "Matemática",
  academicSituation: "Reforzar ecuaciones",
  timeSlot: new Date("2030-06-10T13:00:00.000Z"),
  endTime: new Date("2030-06-10T14:00:00.000Z"),
  duration: 1,
  status: "Confirmado",
  ...overrides,
});

const nextMondayAt = (hour) => {
  const date = new Date();
  const daysUntil = (1 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntil);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const formatForApi = (date) => [
  String(date.getDate()).padStart(2, "0"),
  String(date.getMonth() + 1).padStart(2, "0"),
  date.getFullYear(),
].join("/") + ` ${String(date.getHours()).padStart(2, "0")}:00`;

const publicBookingPayload = () => ({
  ...bookingSnapshot(),
  timeSlot: formatForApi(nextMondayAt(10)),
});

const createAdminAndLogin = async () => {
  await User.create({
    username: "admin@example.com",
    password: await bcrypt.hash("super-secret", 10),
  });
  const response = await request(app).post("/api/auth/login").send({
    username: "admin@example.com",
    password: "super-secret",
  });
  return response.body.token;
};

beforeAll(async () => {
  process.env.JWT_SECRET = "student-test-secret";
  process.env.RATE_LIMIT_MAX = "1000";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = (await import("../src/app.js")).default;
  Booking = (await import("../src/models/Booking.js")).default;
  BookingSlot = (await import("../src/models/BookingSlot.js")).default;
  Student = (await import("../src/models/Student.js")).default;
  StudentMigrationRun = (await import("../src/models/StudentMigrationRun.js")).default;
  StudentMigrationDryRunObservation = (
    await import("../src/models/StudentMigrationDryRunObservation.js")
  ).default;
  User = (await import("../src/models/User.js")).default;
  ({ buildStudentIdentity, linkBookingToStudent, normalizeIdentityText } = await import(
    "../src/services/studentIdentityService.js"
  ));
  ({ createStudentLinkReconciler, processPendingStudentLinks } = await import(
    "../src/services/studentLinkWorker.js"
  ));
  ({ migrateStudents, rollbackStudentMigration } = await import(
    "../src/services/studentMigrationService.js"
  ));

  await Student.syncIndexes();
}, 120_000);

beforeEach(async () => {
  await Promise.all([
    Booking.deleteMany({}),
    BookingSlot.deleteMany({}),
    Student.deleteMany({}),
    StudentMigrationRun.deleteMany({}),
    StudentMigrationDryRunObservation.deleteMany({}),
    User.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("student identity foundation", () => {
  it("normalizes accents, case and repeated whitespace", () => {
    expect(normalizeIdentityText("  MARÍA   Pérez ")).toBe("maria perez");
  });

  it("never serializes conservative identity keys or migration internals accidentally", async () => {
    const student = await Student.create({
      displayName: "Privado Interno",
      studentType: "adult",
      contact: { email: "private@example.com" },
      responsible: { name: "Privado Interno", relationship: "self" },
      identityKeys: ["secret-identity-hash"],
      source: "migration",
      migrationMetadata: {
        createdByRunId: "private-run",
        algorithmVersion: "student-identity-v1",
      },
    });

    for (const serialized of [student.toJSON(), student.toObject(), JSON.parse(JSON.stringify(student))]) {
      expect(serialized).not.toHaveProperty("identityKeys");
      expect(serialized).not.toHaveProperty("migrationMetadata");
      expect(serialized).not.toHaveProperty("normalizedName");
      expect(serialized.contact).not.toHaveProperty("phoneDigits");
      expect(serialized.responsible).not.toHaveProperty("normalizedName");
    }
  });

  it("keeps siblings with a shared family contact as separate students", async () => {
    const juan = await Booking.create(bookingSnapshot());
    const ana = await Booking.create(bookingSnapshot({
      studentName: "Ana Pérez",
      timeSlot: new Date("2030-06-11T13:00:00.000Z"),
      endTime: new Date("2030-06-11T14:00:00.000Z"),
    }));

    const first = await linkBookingToStudent(juan);
    const second = await linkBookingToStudent(ana);

    expect(first.status).toBe("linked");
    expect(second.status).toBe("linked");
    expect(String(first.student._id)).not.toBe(String(second.student._id));
    expect(await Student.countDocuments()).toBe(2);
  });

  it("links an accent/case variant of the same minor idempotently", async () => {
    const original = await Booking.create(bookingSnapshot());
    const variant = await Booking.create(bookingSnapshot({
      studentName: " JUAN  PEREZ ",
      responsibleName: "MARIA PEREZ",
      email: "FAMILIA@example.com",
      timeSlot: new Date("2030-06-12T13:00:00.000Z"),
      endTime: new Date("2030-06-12T14:00:00.000Z"),
    }));

    const first = await linkBookingToStudent(original);
    const second = await linkBookingToStudent(variant);
    const rerun = await linkBookingToStudent(variant);

    expect(String(second.student._id)).toBe(String(first.student._id));
    expect(String(rerun.student._id)).toBe(String(first.student._id));
    expect(await Student.countDocuments()).toBe(1);
  });

  it("learns an anchored contact/key and alias so later contact rotation stays on one Student", async () => {
    const firstBooking = await Booking.create(bookingSnapshot());
    const first = await linkBookingToStudent(firstBooking);
    const emailRotated = await Booking.create(bookingSnapshot({
      email: "nuevo@example.com",
      timeSlot: new Date("2030-06-14T13:00:00.000Z"),
      endTime: new Date("2030-06-14T14:00:00.000Z"),
    }));
    await linkBookingToStudent(emailRotated);
    const phoneRotated = await Booking.create(bookingSnapshot({
      email: "nuevo@example.com",
      phone: "+54 9 11 9999-8888",
      timeSlot: new Date("2030-06-15T13:00:00.000Z"),
      endTime: new Date("2030-06-15T14:00:00.000Z"),
    }));
    const third = await linkBookingToStudent(phoneRotated);

    expect(String(third.student._id)).toBe(String(first.student._id));
    expect(await Student.countDocuments()).toBe(1);
    const learned = await Student.findById(first.student._id).lean();
    expect(learned.contactAliases.some(({ email }) => email === "nuevo@example.com")).toBe(true);
    expect(learned.aliases.some(({ sourceBookingId }) => String(sourceBookingId) === String(emailRotated._id))).toBe(true);
  });

  it("marks a near-name typo as review when guardian and contact anchor match", async () => {
    await linkBookingToStudent(await Booking.create(bookingSnapshot()));
    const typo = await Booking.create(bookingSnapshot({
      studentName: "Juna Pérez",
      timeSlot: new Date("2030-06-16T13:00:00.000Z"),
      endTime: new Date("2030-06-16T14:00:00.000Z"),
    }));
    const result = await linkBookingToStudent(typo);
    const stored = await Booking.findById(typo._id).lean();

    expect(result.needsReview).toBe(true);
    expect(stored.studentLink.status).toBe("review");
    expect(await Student.countDocuments()).toBe(2);
  });

  it("does not merge an adult and a minor that share contact and name", async () => {
    const adult = await Booking.create(bookingSnapshot({
      responsibleRelationship: "self",
      responsibleName: "Juan Pérez",
    }));
    const minor = await Booking.create(bookingSnapshot({
      timeSlot: new Date("2030-06-13T13:00:00.000Z"),
      endTime: new Date("2030-06-13T14:00:00.000Z"),
    }));

    const adultLink = await linkBookingToStudent(adult);
    const minorLink = await linkBookingToStudent(minor);

    expect(String(adultLink.student._id)).not.toBe(String(minorLink.student._id));
  });

  it("keeps Booking identity fields as immutable historical snapshots when linking", async () => {
    const booking = await Booking.create(bookingSnapshot());
    const before = booking.toObject();

    await linkBookingToStudent(booking);
    const stored = await Booking.findById(booking._id).lean();

    for (const field of [
      "studentName", "responsibleName", "responsibleRelationship", "email",
      "phone", "school", "educationLevel", "yearGrade", "subject",
      "academicSituation",
    ]) {
      expect(stored[field]).toEqual(before[field]);
    }
    expect(stored.studentId).toBeTruthy();
    expect(stored.studentLink.status).toBe("linked");
  });

  it("persists a durable pending link without putting Student work on the booking response path", async () => {
    const originalCreate = Student.create;
    let studentCreateCalled = false;
    Student.create = async () => {
      studentCreateCalled = true;
      await new Promise(() => {});
    };
    const response = await request(app)
      .post("/api/bookings/reserve")
      .send(publicBookingPayload())
      .expect(201);
    const stored = await Booking.findOne({ bookingCode: response.body.data.bookingCode }).lean();

    Student.create = originalCreate;
    expect(studentCreateCalled).toBe(false);
    expect(stored.studentId).toBeNull();
    expect(stored.studentLink.status).toBe("pending");
    expect(response.body.data).not.toHaveProperty("studentId");
  });

  it("retries a timed-out durable pending link after a worker restart", async () => {
    const response = await request(app)
      .post("/api/bookings/reserve")
      .send(publicBookingPayload())
      .expect(201);
    const booking = await Booking.findOne({ bookingCode: response.body.data.bookingCode });

    const timedOut = await processPendingStudentLinks({
      limit: 1,
      jobTimeoutMs: 20,
      linker: () => new Promise(() => {}),
      retryDelayMs: 0,
    });
    expect(timedOut.failed).toBe(1);
    expect(await BookingSlot.countDocuments({ booking: booking._id })).toBeGreaterThan(0);

    const restarted = await processPendingStudentLinks({ limit: 1, retryDelayMs: 0 });
    expect(restarted.linked).toBe(1);
    const stored = await Booking.findById(booking._id).lean();
    expect(stored.studentId).toBeTruthy();
    expect(stored.studentLink.status).toBe("linked");
  });

  it("runs Student reconciliation single-flight across overlapping cron ticks", async () => {
    let executions = 0;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const reconcile = createStudentLinkReconciler({
      processor: async () => {
        executions += 1;
        await gate;
        return { processed: 0 };
      },
    });

    const first = reconcile();
    const second = reconcile();
    await Promise.resolve();
    expect(executions).toBe(1);
    release();
    await Promise.all([first, second]);
  });

  it("does not claim or link a pending booking after it enters trash", async () => {
    const trashed = await Booking.create(bookingSnapshot({
      deletedAt: new Date(),
      studentLink: {
        status: "pending",
        source: "repair",
        algorithmVersion: "student-identity-v1",
        lastAttemptAt: new Date(),
        nextAttemptAt: new Date(),
      },
    }));
    const result = await processPendingStudentLinks({ limit: 5, retryDelayMs: 0 });

    expect(result.processed).toBe(0);
    expect(await Student.countDocuments()).toBe(0);
    expect((await Booking.findById(trashed._id).lean()).studentId).toBeNull();
  });

  it("migrates in dry-run by default, applies idempotently, and rolls back only its run", async () => {
    const priorStudent = await Student.create({
      displayName: "Estudiante previo",
      studentType: "adult",
      contact: { email: "previo@example.com", phone: "", phoneDigits: "" },
      responsible: { name: "Estudiante previo", relationship: "self" },
      identityKeys: ["adult|estudiante previo|email:previo@example.com"],
      source: "admin",
    });
    await Booking.create(bookingSnapshot());

    const dryRun = await migrateStudents({ runId: "student-run-dry" });
    expect(dryRun.mode).toBe("dry-run");
    expect(await Booking.countDocuments({ studentId: { $ne: null } })).toBe(0);
    expect(await Student.countDocuments()).toBe(1);

    const applied = await migrateStudents({ runId: "student-run-apply", apply: true, batchSize: 1 });
    const rerun = await migrateStudents({ runId: "student-run-apply", apply: true, batchSize: 1 });
    expect(applied.counts.linked).toBe(1);
    expect(rerun.counts.linked).toBe(1);
    expect(await Student.countDocuments()).toBe(2);

    // Provenance on Booking/Student must make rollback exact even if a process
    // died before persisting its in-memory run arrays.
    await StudentMigrationRun.updateOne(
      { runId: "student-run-apply" },
      { $set: { createdStudentIds: [], linkedBookingIds: [] } },
    );

    const rollback = await rollbackStudentMigration({ runId: "student-run-apply" });
    expect(rollback.status).toBe("rolled-back");
    expect(await Booking.countDocuments({ studentId: { $ne: null } })).toBe(0);
    expect(await Student.findById(priorStudent._id)).toBeTruthy();
    expect(await Student.countDocuments()).toBe(1);
  });

  it("reconstructs apply checkpoint and processed counts after a crash after the durable link", async () => {
    const booking = await Booking.create(bookingSnapshot());
    await StudentMigrationRun.create({
      runId: "apply-crash-run",
      algorithmVersion: "student-identity-v1",
      mode: "apply",
      status: "running",
    });
    await linkBookingToStudent(booking, { source: "migration", runId: "apply-crash-run" });

    const resumed = await migrateStudents({ runId: "apply-crash-run", apply: true });
    expect(resumed.counts.processed).toBe(1);
    expect(resumed.counts.linked).toBe(1);
    expect(resumed.checkpoint.processed).toBe(1);
    expect(String(resumed.checkpoint.lastBookingId)).toBe(String(booking._id));
  });

  it("reattaches a run-owned orphan after create-before-link crash without double counting", async () => {
    const booking = await Booking.create(bookingSnapshot());
    const identity = buildStudentIdentity(booking);
    await Student.create({
      displayName: booking.studentName,
      normalizedName: identity.normalizedName,
      studentType: identity.studentType,
      responsible: {
        name: booking.responsibleName,
        normalizedName: identity.responsibleNormalizedName,
        relationship: booking.responsibleRelationship,
      },
      contact: {
        email: identity.email,
        phone: booking.phone,
        phoneDigits: identity.phoneDigits,
      },
      academic: { subjects: [booking.subject] },
      identityKeys: identity.identityKeys,
      source: "migration",
      migrationMetadata: {
        createdByRunId: "orphan-crash-run",
        algorithmVersion: "student-identity-v1",
        sourceBookingId: booking._id,
      },
    });
    await StudentMigrationRun.create({
      runId: "orphan-crash-run",
      algorithmVersion: "student-identity-v1",
      mode: "apply",
      status: "running",
    });

    const resumed = await migrateStudents({ runId: "orphan-crash-run", apply: true });
    expect(resumed.counts.created).toBe(1);
    expect(resumed.counts.reused).toBe(0);
    expect(resumed.counts.linked).toBe(1);
    expect(resumed.counts.created + resumed.counts.reused).toBe(resumed.counts.linked);
    expect((await Booking.findById(booking._id).lean()).studentId).toBeTruthy();
  });

  it("does not mutate a reused preexisting Student during apply or rollback", async () => {
    const anchorBooking = await Booking.create(bookingSnapshot());
    const anchor = await linkBookingToStudent(anchorBooking);
    const before = await Student.findById(anchor.student._id).lean();
    await Booking.create(bookingSnapshot({
      subject: "Física",
      timeSlot: new Date("2030-06-17T13:00:00.000Z"),
      endTime: new Date("2030-06-17T14:00:00.000Z"),
    }));

    await migrateStudents({ runId: "reuse-no-mutation", apply: true });
    await rollbackStudentMigration({ runId: "reuse-no-mutation" });
    const after = await Student.findById(anchor.student._id).lean();
    expect(after).toEqual(before);
  });

  it("reports cumulative rollback counts exactly after a crash halfway through", async () => {
    await Booking.create(bookingSnapshot());
    await Booking.create(bookingSnapshot({
      studentName: "Ana Pérez",
      timeSlot: new Date("2030-06-18T13:00:00.000Z"),
      endTime: new Date("2030-06-18T14:00:00.000Z"),
    }));
    await migrateStudents({ runId: "rollback-crash", apply: true });
    const run = await StudentMigrationRun.findOne({ runId: "rollback-crash" }).lean();
    const firstBookingId = run.linkedBookingIds[0];
    const firstStudentId = run.createdStudentIds[0];
    await Booking.updateOne({ _id: firstBookingId }, { $unset: { studentId: "", studentLink: "" } });
    await Student.deleteOne({ _id: firstStudentId });

    const resumed = await rollbackStudentMigration({ runId: "rollback-crash" });
    expect(resumed.counts.rolledBackLinks).toBe(2);
    expect(resumed.counts.rolledBackStudents).toBe(2);
    expect(await Booking.countDocuments({ studentId: { $ne: null } })).toBe(0);
    expect(await Student.countDocuments()).toBe(0);
  });

  it("reconstructs dry-run identity decisions and exact counts across a restart", async () => {
    const first = await Booking.create(bookingSnapshot());
    const second = await Booking.create(bookingSnapshot({
      phone: "",
      timeSlot: new Date("2030-06-11T13:00:00.000Z"),
      endTime: new Date("2030-06-11T14:00:00.000Z"),
    }));
    await StudentMigrationRun.create({
      runId: "dry-crash-run",
      algorithmVersion: "student-identity-v1",
      mode: "dry-run",
      status: "running",
    });
    const identity = buildStudentIdentity(first);
    await StudentMigrationDryRunObservation.create({
      runId: "dry-crash-run",
      bookingId: first._id,
      identityHashes: identity.identityKeys.slice().sort(),
      decision: "would-create",
      hasReviewCandidates: false,
    });

    const resumed = await migrateStudents({ runId: "dry-crash-run" });
    expect(resumed.counts.processed).toBe(2);
    expect(resumed.counts.wouldCreate).toBe(1);
    expect(resumed.counts.wouldLink).toBe(1);
    expect(String(resumed.checkpoint.lastBookingId)).toBe(String(second._id));
  });

  it("excludes trashed bookings and links them only after restoration queues pending work", async () => {
    const trashed = await Booking.create(bookingSnapshot({ deletedAt: new Date() }));
    const migrated = await migrateStudents({ runId: "trash-scope", apply: true });
    expect(migrated.counts.processed).toBe(0);
    expect(await Student.countDocuments()).toBe(0);

    await Booking.updateOne({ _id: trashed._id }, {
      $set: {
        deletedAt: null,
        studentLink: {
          status: "pending",
          source: "repair",
          algorithmVersion: "student-identity-v1",
          lastAttemptAt: new Date(),
          nextAttemptAt: new Date(),
          candidateIds: [],
          errorCode: "",
          attempts: 0,
        },
      },
    });
    const reconciled = await processPendingStudentLinks({ limit: 1 });
    expect(reconciled.linked).toBe(1);
    expect((await Booking.findById(trashed._id).lean()).studentId).toBeTruthy();
  });

  it("protects paginated/search admin APIs and excludes soft-deleted students by default", async () => {
    const active = await Student.create({
      displayName: "Juan Pérez",
      studentType: "minor",
      normalizedName: "juan perez",
      contact: { email: "familia@example.com", phone: "+54 11 2222 3333", phoneDigits: "541122223333" },
      responsible: { name: "María Pérez", normalizedName: "maria perez", relationship: "madre" },
      identityKeys: ["minor|juan perez|maria perez|madre|email:familia@example.com"],
      source: "booking",
    });
    await Student.create({
      displayName: "Oculto",
      studentType: "adult",
      normalizedName: "oculto",
      contact: { email: "oculto@example.com", phone: "", phoneDigits: "" },
      responsible: { name: "Oculto", normalizedName: "oculto", relationship: "self" },
      identityKeys: ["adult|oculto|email:oculto@example.com"],
      source: "admin",
      active: false,
      deletedAt: new Date(),
    });
    await Booking.create(bookingSnapshot({ studentId: active._id }));

    await request(app).get("/api/students").expect(401);
    const token = await createAdminAndLogin();
    const list = await request(app)
      .get("/api/students?scope=active&page=1&limit=1&search=juan")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].displayName).toBe("Juan Pérez");
    expect(list.body.data[0].metrics.bookingsCount).toBe(1);
    expect(list.body.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });

    const detail = await request(app)
      .get(`/api/students/${active._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(detail.body.data.student.id).toBe(String(active._id));
    expect(detail.body.data.recentBookings[0]).not.toHaveProperty("notes");
    expect(detail.body.data.recentBookings[0]).not.toHaveProperty("studentEvolution");
  });
});
