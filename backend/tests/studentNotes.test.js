import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* Notas del alumno para el profesor.

   El endpoint estaba escrito y funcionando, y `StudentNotesPanel.jsx` también,
   pero el componente nunca se montó en ninguna pantalla. Al ir a cablearlo
   aparecieron dos cosas que lo habrían hecho fallar el 100% de las veces:

   1. La ruta exige el token de gestión —`managementBookingForCode` compara el
      código del token contra el de la URL— y el wrapper del frontend no lo
      mandaba. Siempre 401.
   2. `studentNotes` no estaba en el DTO que devuelve el portal, así que la
      pantalla nunca podía mostrar lo que ya estaba guardado: se abría vacía y
      la primera vez que alguien tocara "Guardar" borraría su propia nota.

   Estos tests fijan las dos mitades del contrato: qué autorización hace falta
   para escribir, y que lo escrito vuelva a salir por el portal. */

let mongoServer;
let app;
let Booking;

const futureStart = (hours = 48) => new Date(Date.now() + hours * 60 * 60 * 1000);

const crear = async (overrides = {}) => {
  const start = overrides.timeSlot ?? futureStart();
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
    status: "Confirmado",
    ...overrides,
  });
};

/* El token se pide igual que lo pide el portal: con el código de reserva. */
const tokenPara = async (bookingCode) => {
  const res = await request(app)
    .post("/api/bookings/portal/session")
    .send({ bookingCode });
  expect(res.status).toBe(200);
  return res.body.data.managementToken;
};

const guardarNotas = (code, studentNotes, token) => {
  const req = request(app).put(`/api/bookings/${code}/notes`).send({ studentNotes });
  return token ? req.set("X-Booking-Manage-Token", token) : req;
};

beforeAll(async () => {
  process.env.JWT_SECRET = "student-notes-tests";
  process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = `v1:${crypto.randomBytes(32).toString("base64url")}`;
  process.env.NOTIFICATION_OUTBOX_ACTIVE_KEY_VERSION = "v1";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.PORTAL_SESSION_RATE_LIMIT_MAX = "1000";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = (await import("../src/app.js")).default;
  Booking = (await import("../src/models/Booking.js")).default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

beforeEach(async () => {
  await Booking.deleteMany({});
});

describe("guardar notas", () => {
  it("guarda la nota cuando el token corresponde al turno", async () => {
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);

    const res = await guardarNotas(
      booking.bookingCode,
      "Vengo flojo con trigonometría, sobre todo identidades.",
      token,
    );

    expect(res.status).toBe(200);
    const guardado = await Booking.findById(booking._id).lean();
    expect(guardado.studentNotes).toBe(
      "Vengo flojo con trigonometría, sobre todo identidades.",
    );
  });

  it("rechaza sin token", async () => {
    // Esto es lo que hacía el wrapper del frontend. Por eso el panel nunca
    // habría funcionado si se montaba tal como estaba escrito.
    const booking = await crear();

    const res = await guardarNotas(booking.bookingCode, "Sin token", null);

    expect(res.status).toBe(401);
  });

  it("rechaza el token de OTRO turno de la misma persona", async () => {
    /* El token está atado a un turno, no a la cuenta. El portal pide uno nuevo
       por turno justamente por esto.
       403 y no 401 a propósito: el token es válido —está autenticado—, lo que
       no tiene es permiso sobre ESTE turno. */
    const unoBooking = await crear();
    const otro = await crear({ timeSlot: futureStart(72) });
    const tokenDelPrimero = await tokenPara(unoBooking.bookingCode);

    const res = await guardarNotas(otro.bookingCode, "Cruzado", tokenDelPrimero);

    expect(res.status).toBe(403);
  });

  it("recorta los espacios de los extremos", async () => {
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);

    await guardarNotas(booking.bookingCode, "   con espacios   ", token);

    const guardado = await Booking.findById(booking._id).lean();
    expect(guardado.studentNotes).toBe("con espacios");
  });

  it("acepta una nota vacía para poder borrar lo escrito", async () => {
    // Si no, quien se arrepiente de lo que puso no tiene forma de sacarlo.
    const booking = await crear({ studentNotes: "algo viejo" });
    const token = await tokenPara(booking.bookingCode);

    const res = await guardarNotas(booking.bookingCode, "", token);

    expect(res.status).toBe(200);
    const guardado = await Booking.findById(booking._id).lean();
    expect(guardado.studentNotes).toBe("");
  });

  it("rechaza más de 500 caracteres", async () => {
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);

    const res = await guardarNotas(booking.bookingCode, "x".repeat(501), token);

    expect(res.status).toBe(400);
  });

  it("acepta exactamente 500 caracteres", async () => {
    // El contador del panel muestra 500 como máximo alcanzable: el límite tiene
    // que ser inclusivo o el borde miente.
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);

    const res = await guardarNotas(booking.bookingCode, "x".repeat(500), token);

    expect(res.status).toBe(200);
  });

  it("no permite escribir notas en un turno cancelado", async () => {
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);
    await Booking.findByIdAndUpdate(booking._id, { status: "Cancelado" });

    const res = await guardarNotas(booking.bookingCode, "Tarde", token);

    expect(res.status).toBe(400);
  });

  it("no permite escribir notas en un turno que ya pasó", async () => {
    const pasado = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const booking = await crear({
      timeSlot: pasado,
      endTime: new Date(pasado.getTime() + 60 * 60 * 1000),
    });
    const token = await tokenPara(booking.bookingCode);

    const res = await guardarNotas(booking.bookingCode, "Tarde", token);

    expect(res.status).toBe(400);
  });
});

describe("leer las notas desde el portal", () => {
  it("devuelve studentNotes en el historial", async () => {
    // Sin esto el panel se abre vacío aunque haya una nota guardada, y el
    // primer "Guardar" la borra sin que nadie se dé cuenta.
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);
    await guardarNotas(booking.bookingCode, "Traigo la guía del colegio.", token);

    const res = await request(app)
      .get("/api/bookings/portal/history")
      .set("X-Booking-Manage-Token", token);

    expect(res.status).toBe(200);
    const turno = res.body.data.bookings.find(
      (b) => b.bookingCode === booking.bookingCode,
    );
    expect(turno.studentNotes).toBe("Traigo la guía del colegio.");
  });

  it("devuelve las notas de cada turno por separado", async () => {
    const primero = await crear();
    const segundo = await crear({ timeSlot: futureStart(72) });
    const tokenPrimero = await tokenPara(primero.bookingCode);
    const tokenSegundo = await tokenPara(segundo.bookingCode);
    await guardarNotas(primero.bookingCode, "Nota del primero", tokenPrimero);
    await guardarNotas(segundo.bookingCode, "Nota del segundo", tokenSegundo);

    const res = await request(app)
      .get("/api/bookings/portal/history")
      .set("X-Booking-Manage-Token", tokenPrimero);

    const porCodigo = Object.fromEntries(
      res.body.data.bookings.map((b) => [b.bookingCode, b.studentNotes]),
    );
    expect(porCodigo[primero.bookingCode]).toBe("Nota del primero");
    expect(porCodigo[segundo.bookingCode]).toBe("Nota del segundo");
  });

  it("devuelve el turno sin notas sin romperse", async () => {
    const booking = await crear();
    const token = await tokenPara(booking.bookingCode);

    const res = await request(app)
      .get("/api/bookings/portal/history")
      .set("X-Booking-Manage-Token", token);

    expect(res.status).toBe(200);
    const turno = res.body.data.bookings[0];
    expect(turno.studentNotes ?? "").toBe("");
  });
});
