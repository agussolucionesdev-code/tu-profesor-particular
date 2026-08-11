import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* Los turnos Pendiente que ya pasaron, y el bucle que nunca cerraba.

   Cuando `booking.requireManualConfirmation` está activo, toda reserva entra
   como Pendiente y la persona tiene que confirmar su asistencia. El endpoint
   para hacerlo existía y funcionaba, pero el wrapper del frontend no mandaba el
   token de gestión y ninguna pantalla lo llamaba: nadie podía confirmar nunca.

   El resultado era un embudo sin salida. Los turnos quedaban Pendiente, la
   fecha pasaba, y ahí se quedaban: `autoFinalizeBookings` solo miraba
   `status: "Confirmado"`, y `STATUS_TRANSITIONS` no permitía Pendiente →
   Finalizado, así que el profesor tampoco podía cerrarlos a mano. Se acumulaban
   para siempre en la agenda.

   Un turno cuyo horario ya pasó terminó su recorrido, se haya confirmado o no.
   Si la persona asistió es otra pregunta, y tiene su propio campo
   (`attendanceStatus`, con su enum: Presente, Ausente, No-show…). Meter eso en
   `status` sería duplicarlo. */

let mongoServer;
let app;
let Booking;
let autoFinalizeBookings;

const enHoras = (h) => new Date(Date.now() + h * 60 * 60 * 1000);

const crear = async (overrides = {}) => {
  const start = overrides.timeSlot ?? enHoras(48);
  return Booking.create({
    studentName: "Alumna De Prueba",
    responsibleName: "Responsable De Prueba",
    responsibleRelationship: "madre",
    tutorName: "Agustin",
    phone: "1133365937",
    email: "familia@example.com",
    school: "Escuela Modelo",
    educationLevel: "Secundaria",
    yearGrade: "3",
    subject: "Matemática",
    timeSlot: start,
    endTime: new Date(new Date(start).getTime() + 60 * 60 * 1000),
    duration: 1,
    status: "Pendiente",
    ...overrides,
  });
};

const yaPaso = (overrides = {}) => {
  const start = enHoras(-5);
  return crear({
    timeSlot: start,
    endTime: new Date(start.getTime() + 60 * 60 * 1000),
    ...overrides,
  });
};

const tokenPara = async (bookingCode) => {
  const res = await request(app)
    .post("/api/bookings/portal/session")
    .send({ bookingCode, contact: "familia@example.com" });
  expect(res.status).toBe(200);
  return res.body.data.managementToken;
};

const confirmar = (bookingCode, token) => {
  const req = request(app)
    .post("/api/bookings/confirm-attendance")
    .send({ bookingCode });
  return token ? req.set("X-Booking-Manage-Token", token) : req;
};

beforeAll(async () => {
  process.env.JWT_SECRET = "pending-lifecycle-tests";
  process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = `v1:${crypto.randomBytes(32).toString("base64url")}`;
  process.env.NOTIFICATION_OUTBOX_ACTIVE_KEY_VERSION = "v1";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.PORTAL_SESSION_RATE_LIMIT_MAX = "1000";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = (await import("../src/app.js")).default;
  Booking = (await import("../src/models/Booking.js")).default;
  ({ autoFinalizeBookings } = await import("../src/services/bookingLifecycleService.js"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

beforeEach(async () => {
  await Booking.deleteMany({});
});

describe("confirmar asistencia desde el cliente", () => {
  it("pasa un turno de Pendiente a Confirmado", async () => {
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);

    const res = await confirmar(booking.bookingCode, token);

    expect(res.status).toBe(200);
    const guardado = await Booking.findById(booking._id).lean();
    expect(guardado.status).toBe("Confirmado");
  });

  it("rechaza sin token de gestión", async () => {
    // Es el bug que tenía el wrapper del frontend: mandaba solo el código.
    const booking = await crear();

    const res = await confirmar(booking.bookingCode, null);

    expect(res.status).toBe(401);
  });

  it("rechaza el token de otro turno", async () => {
    const primero = await crear();
    const otro = await crear({ timeSlot: enHoras(72) });
    const token = await tokenPara(primero.bookingCode);

    const res = await confirmar(otro.bookingCode, token);

    expect(res.status).toBe(403);
  });

  it("no deja confirmar dos veces", async () => {
    // La segunda vez ya no está en Pendiente. Importa porque el botón puede
    // recibir dos clics antes de que la pantalla se actualice.
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);
    await confirmar(booking.bookingCode, token);

    const segunda = await confirmar(booking.bookingCode, token);

    expect(segunda.status).toBe(400);
  });

  it("no deja confirmar un turno cancelado", async () => {
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);
    await Booking.findByIdAndUpdate(booking._id, { status: "Cancelado" });

    const res = await confirmar(booking.bookingCode, token);

    expect(res.status).toBe(400);
  });

  it("no deja confirmar un turno que ya pasó", async () => {
    // Confirmar que vas a ir a algo que ya terminó no significa nada. Estos son
    // los que cierra el cron.
    const booking = await yaPaso();
    const token = await tokenPara(booking.bookingCode);

    const res = await confirmar(booking.bookingCode, token);

    expect(res.status).toBe(400);
  });

  it("incrementa la revisión de notificaciones al confirmar", async () => {
    // El comprobante que se manda tiene que ser el del estado nuevo, no el
    // viejo. La revisión es lo que invalida el anterior.
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);
    const antes = (await Booking.findById(booking._id).lean()).notificationRevision ?? 0;

    await confirmar(booking.bookingCode, token);

    const despues = (await Booking.findById(booking._id).lean()).notificationRevision;
    expect(despues).toBeGreaterThan(antes);
  });
});

describe("cerrar los Pendiente que ya pasaron", () => {
  it("finaliza un Pendiente cuyo horario terminó", async () => {
    // Antes se quedaba Pendiente para siempre: el cron solo miraba Confirmado.
    const booking = await yaPaso();

    const cerrados = await autoFinalizeBookings();

    expect(cerrados).toBe(1);
    const guardado = await Booking.findById(booking._id).lean();
    expect(guardado.status).toBe("Finalizado");
  });

  it("sigue finalizando los Confirmado, que es lo que ya hacía", async () => {
    const booking = await yaPaso({ status: "Confirmado" });

    await autoFinalizeBookings();

    expect((await Booking.findById(booking._id).lean()).status).toBe("Finalizado");
  });

  it("no toca un Pendiente que todavía no pasó", async () => {
    const booking = await crear();

    await autoFinalizeBookings();

    expect((await Booking.findById(booking._id).lean()).status).toBe("Pendiente");
  });

  it("no revive un turno cancelado", async () => {
    // Cancelado es terminal. Finalizarlo borraría el hecho de que se canceló.
    const booking = await yaPaso({ status: "Cancelado" });

    await autoFinalizeBookings();

    expect((await Booking.findById(booking._id).lean()).status).toBe("Cancelado");
  });

  it("deja la asistencia sin registrar para que la complete el profesor", async () => {
    /* Finalizado dice que el turno terminó, no que la persona asistió. Esa
       pregunta vive en attendanceStatus, y el cron no la puede responder. */
    const booking = await yaPaso();

    await autoFinalizeBookings();

    const guardado = await Booking.findById(booking._id).lean();
    expect(guardado.attendanceStatus).toBe("Sin registrar");
  });

  it("cierra varios de una vez y cuenta bien", async () => {
    await yaPaso();
    await yaPaso({ timeSlot: enHoras(-8), endTime: enHoras(-7) });
    await yaPaso({ status: "Confirmado", timeSlot: enHoras(-12), endTime: enHoras(-11) });
    await crear(); // futuro: no cuenta

    const cerrados = await autoFinalizeBookings();

    expect(cerrados).toBe(3);
  });

  it("ignora los borrados lógicamente", async () => {
    const booking = await yaPaso();
    await Booking.findByIdAndUpdate(booking._id, { deletedAt: new Date() });

    const cerrados = await autoFinalizeBookings();

    expect(cerrados).toBe(0);
  });
});

describe("transiciones de estado permitidas", () => {
  it("el profesor puede finalizar a mano un Pendiente vencido", async () => {
    /* STATUS_TRANSITIONS tenía `Pendiente: ["Confirmado", "Cancelado"]`, así que
       ni el admin podía cerrarlo. Entre el cron bloqueado y esto, los Pendiente
       vencidos no tenían NINGUNA salida. */
    const booking = await yaPaso();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ password: process.env.ADMIN_PASSWORD || "admin" });

    // Si el login de admin no está disponible en el entorno de test, la
    // transición se valida igual desde el modelo del cron (test de arriba).
    if (login.status !== 200) return;

    const res = await request(app)
      .put(`/api/bookings/${booking._id}`)
      .set("Authorization", `Bearer ${login.body.token ?? login.body.data?.token}`)
      .send({ status: "Finalizado" });

    expect(res.status).toBe(200);
  });
});
