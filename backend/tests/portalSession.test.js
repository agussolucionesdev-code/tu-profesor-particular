import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* Acceso al portal con código + dato de contacto.

   El código sigue identificando la reserva, pero una copia del comprobante ya
   no alcanza para abrir el historial. También debe coincidir el email o teléfono
   cargado. Todos los fallos comparten respuesta para evitar enumeración. */

let mongoServer;
let app;
let Booking;

const futureStart = (hours = 48) => new Date(Date.now() + hours * 60 * 60 * 1000);

const bookingInput = (overrides = {}) => {
  const start = overrides.timeSlot ?? futureStart();
  return {
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
  };
};

const crear = async (overrides = {}) => Booking.create(bookingInput(overrides));

beforeAll(async () => {
  process.env.JWT_SECRET = "portal-session-tests";
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

describe("acceso al portal con el código de reserva", () => {
  it("entrega un token de gestión utilizable cuando el código existe", async () => {
    const booking = await crear();

    const res = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: booking.bookingCode, contact: booking.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.managementToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // El token sirve de verdad contra el endpoint de gestión ya existente.
    const conToken = await request(app)
      .get("/api/bookings/manage")
      .set("X-Booking-Manage-Token", res.body.data.managementToken);

    expect(conToken.status).toBe(200);
    expect(conToken.body.data.bookingCode).toBe(booking.bookingCode);
  });

  it("acepta el código en minúsculas y con espacios alrededor", async () => {
    const booking = await crear();

    const res = await request(app)
      .post("/api/bookings/portal/session")
      .send({
        bookingCode: `  ${booking.bookingCode.toLowerCase()}  `,
        contact: " FAMILIA@EXAMPLE.COM ",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.managementToken).toBeTruthy();
  });

  it("responde igual para un código inexistente que para uno con formato inválido", async () => {
    const inexistente = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: "ZZZZZZ", contact: "familia@example.com" });

    const malFormado = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: "no-es-un-codigo", contact: "familia@example.com" });

    expect(inexistente.status).toBe(401);
    expect(malFormado.status).toBe(401);
    // Mismo cuerpo: no se puede distinguir "no existe" de "no es válido".
    expect(inexistente.body.message).toBe(malFormado.body.message);
    expect(JSON.stringify(inexistente.body)).not.toMatch(/ZZZZZZ/);
  });

  it("rechaza la entrada si falta el dato de contacto", async () => {
    const booking = await crear();

    const res = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: booking.bookingCode });

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(booking.email);
  });

  it("rechaza un contacto incorrecto con la misma respuesta genérica", async () => {
    const booking = await crear();

    const emailIncorrecto = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: booking.bookingCode, contact: "otra@example.com" });
    const codigoIncorrecto = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: "ZZZZZZ", contact: booking.email });

    expect(emailIncorrecto.status).toBe(401);
    expect(emailIncorrecto.body.message).toBe(codigoIncorrecto.body.message);
  });

  it("acepta el teléfono con espacios y signos", async () => {
    const booking = await crear({ phone: "+54 9 11 3336-5937" });

    const res = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: booking.bookingCode, contact: "+54 (9) 11 3336 5937" });

    expect(res.status).toBe(200);
  });

  /* Cancelado SÍ entra: el portal es el historial, y quien canceló su único
     turno tiene que poder consultarlo igual. La ventana no queda abierta para
     siempre porque el token expira 30 días después del fin del turno. */
  it("deja entrar con una reserva cancelada, para poder ver el historial", async () => {
    const booking = await crear({ status: "Cancelado" });

    const res = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: booking.bookingCode, contact: booking.email });

    expect(res.status).toBe(200);
  });

  /* Borrada por el administrador es otra cosa: ahí no hay nada que mostrar. */
  it("no da acceso a una reserva eliminada", async () => {
    const booking = await crear();
    booking.deletedAt = new Date();
    await booking.save();

    const res = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: booking.bookingCode, contact: booking.email });

    expect(res.status).toBe(401);
  });

  it("nunca devuelve datos personales junto con el token", async () => {
    const booking = await crear();

    const res = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: booking.bookingCode, contact: booking.email });

    const cuerpo = JSON.stringify(res.body);
    expect(cuerpo).not.toMatch(/Alumna De Prueba/);
    expect(cuerpo).not.toMatch(/familia@example\.com/);
    expect(cuerpo).not.toMatch(/1133365937/);
    expect(cuerpo).not.toMatch(/Escuela Modelo/);
  });
});

describe("historial de turnos del titular", () => {
  it("devuelve todos los turnos que comparten el email, ordenados del más próximo al más lejano", async () => {
    const base = await crear({ timeSlot: futureStart(72) });
    await crear({ timeSlot: futureStart(24), subject: "Física" });
    await crear({ timeSlot: futureStart(120), subject: "Química" });
    // Otra familia: no debe aparecer.
    await crear({ email: "otra@example.com", studentName: "Ajeno Ajeno" });

    const sesion = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: base.bookingCode, contact: base.email });

    const historial = await request(app)
      .get("/api/bookings/portal/history")
      .set("X-Booking-Manage-Token", sesion.body.data.managementToken);

    expect(historial.status).toBe(200);
    expect(historial.body.data.bookings).toHaveLength(3);

    const materias = historial.body.data.bookings.map((b) => b.subject);
    expect(materias).toEqual(["Física", "Matemática", "Química"]);
    expect(JSON.stringify(historial.body)).not.toMatch(/Ajeno Ajeno/);
  });

  it("incluye los turnos pasados y los cancelados, marcados como tales", async () => {
    const activo = await crear({ timeSlot: futureStart(48) });
    await crear({ timeSlot: futureStart(-48), subject: "Física" });
    await crear({ timeSlot: futureStart(96), subject: "Química", status: "Cancelado" });

    const sesion = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: activo.bookingCode, contact: activo.email });

    const historial = await request(app)
      .get("/api/bookings/portal/history")
      .set("X-Booking-Manage-Token", sesion.body.data.managementToken);

    expect(historial.status).toBe(200);
    const porMateria = Object.fromEntries(
      historial.body.data.bookings.map((b) => [b.subject, b]),
    );
    expect(porMateria["Física"].isPast).toBe(true);
    expect(porMateria["Matemática"].isPast).toBe(false);
    expect(porMateria["Química"].status).toBe("Cancelado");
  });

  it("no mezcla reservas sin email de personas distintas", async () => {
    const propia = await crear({ email: "", phone: "1111111111" });
    await crear({
      email: "",
      phone: "1122222222",
      studentName: "Persona Ajena",
      subject: "Física",
    });

    const sesion = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: propia.bookingCode, contact: propia.phone });
    const historial = await request(app)
      .get("/api/bookings/portal/history")
      .set("X-Booking-Manage-Token", sesion.body.data.managementToken);

    expect(historial.status).toBe(200);
    expect(historial.body.data.bookings).toHaveLength(1);
    expect(JSON.stringify(historial.body)).not.toContain("Persona Ajena");
  });

  it("no devuelve reservas borradas aunque compartan identidad", async () => {
    const activa = await crear();
    const borrada = await crear({ subject: "Física" });
    borrada.deletedAt = new Date();
    await borrada.save();

    const sesion = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode: activa.bookingCode, contact: activa.email });
    const historial = await request(app)
      .get("/api/bookings/portal/history")
      .set("X-Booking-Manage-Token", sesion.body.data.managementToken);

    expect(historial.status).toBe(200);
    expect(historial.body.data.bookings.map((b) => b.bookingCode)).toEqual([
      activa.bookingCode,
    ]);
  });

  it("rechaza el historial sin token", async () => {
    await crear();
    const res = await request(app).get("/api/bookings/portal/history");
    expect(res.status).toBe(401);
  });

  it("rechaza el historial con un token que no corresponde a ninguna reserva", async () => {
    await crear();
    const falso = crypto.randomBytes(32).toString("base64url");
    const res = await request(app)
      .get("/api/bookings/portal/history")
      .set("X-Booking-Manage-Token", falso);
    expect(res.status).toBe(401);
  });
});
