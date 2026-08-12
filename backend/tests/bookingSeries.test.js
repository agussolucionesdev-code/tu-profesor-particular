import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* Clases recurrentes: una serie semanal.
 *
 * Hasta ahora, para 8 clases semanales había que completar el wizard 8 veces y se
 * recibían 8 códigos sin ninguna relación entre sí.
 *
 * DECISIÓN DE PRODUCTO (de Agustín): 8 reservas, un código cada una, como hace
 * Google Calendar. Cada clase se cancela y se reprograma sola. Lo único que se
 * agrega es un `seriesId` que las agrupa para poder mostrarlas juntas y decir
 * "clase 3 de 8".
 *
 * Eso hace que el backend NO necesite un endpoint nuevo de creación masiva: cada
 * clase se crea por el mismo `POST /api/bookings/reserve` que ya está probado, con
 * su propia clave de idempotencia. No se toca el camino crítico —locks, claim de
 * slots, notificaciones— que es el que mueve la plata.
 *
 * Lo que sí hay que fijar es que el seriesId sea un dato inofensivo: agrupa, no
 * autoriza. Si diera acceso a algo, un cliente podría inventarse el seriesId de
 * otra persona y ver sus turnos.
 */

let mongoServer;
let app;
let Booking;

const etiqueta = (d) =>
  [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("/") +
  " " +
  String(d.getHours()).padStart(2, "0") +
  ":" +
  String(d.getMinutes()).padStart(2, "0");

/* Miércoles fijo y no un desplazamiento relativo: "ahora + N días" cae en domingo
   o fuera de horario según el día en que corra el test. Es la trampa que hace
   fallar los tests de reserva los sábados. */
const miercolesA = (hora, semanasAdelante = 0) => {
  const d = new Date();
  const faltan = (3 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + faltan + semanasAdelante * 7);
  d.setHours(hora, 0, 0, 0);
  return d;
};

const nuevaSerie = () => crypto.randomUUID();

const reservar = async (overrides = {}) => {
  const { semana = 0, hora = 10, ...resto } = overrides;
  return request(app)
    .post("/api/bookings/reserve")
    .set("Idempotency-Key", crypto.randomUUID())
    .send({
      studentName: "Alumna De Prueba",
      responsibleName: "Mayor de edad / Responsable",
      responsibleRelationship: "self",
      phone: "1133365937",
      email: "familia@example.com",
      educationLevel: "Secundaria",
      yearGrade: "3er año",
      subject: "Matemática",
      academicSituation: "Objetivo: sostener el año",
      duration: 1,
      ...resto,
      timeSlot: etiqueta(miercolesA(hora, semana)),
    });
};

/* Lo que hace el wizard: una llamada por semana, cada una con su clave de
   idempotencia, todas con el mismo seriesId. */
const reservarSerie = async (semanas, extra = {}) => {
  const seriesId = nuevaSerie();
  const resultados = [];
  for (let i = 0; i < semanas; i += 1) {
    const res = await reservar({
      ...extra,
      semana: i,
      seriesId,
      seriesIndex: i + 1,
      seriesTotal: semanas,
    });
    resultados.push(res);
  }
  return { seriesId, resultados };
};

beforeAll(async () => {
  process.env.JWT_SECRET = "booking-series-tests";
  process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = `v1:${crypto.randomBytes(32).toString("base64url")}`;
  process.env.NOTIFICATION_OUTBOX_ACTIVE_KEY_VERSION = "v1";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.PUBLIC_MUTATION_RATE_LIMIT_MAX = "1000";
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

describe("crear una serie semanal", () => {
  it("crea una reserva por semana, cada una con su propio código", async () => {
    const { resultados } = await reservarSerie(4);

    expect(resultados.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    const codigos = resultados.map((r) => r.body.data.bookingCode);
    expect(new Set(codigos).size).toBe(4);
  });

  it("las agrupa con el mismo seriesId", async () => {
    const { seriesId } = await reservarSerie(4);

    const dela = await Booking.find({ seriesId }).lean();
    expect(dela).toHaveLength(4);
  });

  it("guarda la posición de cada clase en la serie", async () => {
    // Es lo que permite decir "clase 3 de 8" en el email y en el portal, en lugar
    // de mandar cuatro comprobantes que parecen repetidos.
    const { seriesId } = await reservarSerie(4);

    const dela = await Booking.find({ seriesId }).sort({ timeSlot: 1 }).lean();
    expect(dela.map((b) => b.seriesIndex)).toEqual([1, 2, 3, 4]);
    expect(dela.every((b) => b.seriesTotal === 4)).toBe(true);
  });

  it("las clases caen a la misma hora, una semana después de la otra", async () => {
    const { seriesId } = await reservarSerie(3);

    const dela = await Booking.find({ seriesId }).sort({ timeSlot: 1 }).lean();
    const dias = dela.map((b) => new Date(b.timeSlot));
    expect(dias[0].getDay()).toBe(dias[1].getDay());
    const unaSemana = 7 * 24 * 60 * 60 * 1000;
    expect(dias[1] - dias[0]).toBe(unaSemana);
    expect(dias[2] - dias[1]).toBe(unaSemana);
  });

  it("una reserva suelta no queda con seriesId", async () => {
    // La gran mayoría de las reservas son de una sola clase y no tienen que
    // arrastrar campos de serie vacíos con valores raros.
    const res = await reservar();

    const b = await Booking.findOne({ bookingCode: res.body.data.bookingCode }).lean();
    expect(b.seriesId).toBe(null);
    expect(b.seriesIndex).toBe(null);
  });
});

describe("cada clase se gestiona sola", () => {
  const tokenPara = async (bookingCode) => {
    const r = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode, contact: "familia@example.com" });
    expect(r.status).toBe(200);
    return r.body.data.managementToken;
  };

  it("cancelar una NO cancela el resto de la serie", async () => {
    /* Es la razón de ser de la decisión de 8 códigos: si te agarra un examen la
       semana que viene, cancelás esa clase y las otras siete siguen en pie. */
    const { seriesId, resultados } = await reservarSerie(4);
    const code = resultados[1].body.data.bookingCode;
    const token = await tokenPara(code);

    const res = await request(app)
      .post("/api/bookings/cancel")
      .set("X-Booking-Manage-Token", token)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ bookingCode: code });

    expect(res.status).toBe(200);
    const dela = await Booking.find({ seriesId }).lean();
    const cancelados = dela.filter((b) => b.status === "Cancelado");
    expect(cancelados).toHaveLength(1);
    expect(cancelados[0].bookingCode).toBe(code);
  });

  it("el token de una clase no sirve para otra de la misma serie", async () => {
    /* El seriesId agrupa, NO autoriza. Si diera acceso, alguien podría inventarse
       el seriesId de otra persona y tocar sus turnos. Cada clase sigue protegida
       por su propio token, igual que cualquier reserva suelta. */
    const { resultados } = await reservarSerie(2);
    const token = await tokenPara(resultados[0].body.data.bookingCode);

    const res = await request(app)
      .post("/api/bookings/cancel")
      .set("X-Booking-Manage-Token", token)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ bookingCode: resultados[1].body.data.bookingCode });

    expect(res.status).toBe(403);
  });

  it("reprogramar una no mueve las demás", async () => {
    const { seriesId, resultados } = await reservarSerie(3);
    const code = resultados[0].body.data.bookingCode;
    const antes = await Booking.find({ seriesId }).sort({ timeSlot: 1 }).lean();
    const token = await tokenPara(code);

    await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", token)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        bookingCode: code,
        newTimeSlot: etiqueta(miercolesA(15, 0)),
        newDuration: 1,
      });

    const despues = await Booking.find({ seriesId }).lean();
    const sinTocar = despues.filter((b) => b.bookingCode !== code);
    for (const b of sinTocar) {
      const original = antes.find((a) => a.bookingCode === b.bookingCode);
      expect(new Date(b.timeSlot).getTime()).toBe(
        new Date(original.timeSlot).getTime(),
      );
    }
  });
});

describe("una semana ocupada no arruina la serie entera", () => {
  it("las demás semanas se reservan igual", async () => {
    /* Best-effort a propósito. Si una semana está tomada, cancelar las otras
       siete sería absurdo: se reserva lo que se puede y se le dice exactamente
       qué semana quedó afuera. La alternativa —todo o nada— hace que un solo
       horario ocupado tire abajo el mes entero. */
    const bloqueada = await reservar({ semana: 2, email: "otra@example.com" });
    expect(bloqueada.status).toBe(201);

    const { seriesId, resultados } = await reservarSerie(4);

    const estados = resultados.map((r) => r.status);
    expect(estados.filter((s) => s === 201)).toHaveLength(3);
    expect(estados.filter((s) => s !== 201)).toHaveLength(1);
    expect(await Booking.countDocuments({ seriesId })).toBe(3);
  });

  it("la que falla dice que el horario estaba ocupado", async () => {
    await reservar({ semana: 1, email: "otra@example.com" });

    const { resultados } = await reservarSerie(3);

    const fallida = resultados.find((r) => r.status !== 201);
    expect(fallida.body.success).toBe(false);
    expect(String(fallida.body.message)).toMatch(/ocupad|disponib/i);
  });
});

describe("el seriesId no es una llave", () => {
  it("no se puede pedir el historial de una serie con solo el seriesId", async () => {
    // No existe ningún endpoint que acepte un seriesId como credencial, y este
    // test está para que no aparezca uno por descuido.
    const { seriesId } = await reservarSerie(2);

    const res = await request(app).get(`/api/bookings/series/${seriesId}`);

    expect([401, 403, 404]).toContain(res.status);
  });

  it("un seriesId inventado no rompe nada al reservar", async () => {
    const res = await reservar({ seriesId: "no-es-un-uuid", seriesIndex: 1, seriesTotal: 1 });

    // O se rechaza por formato, o se guarda sin consecuencias: lo que no puede
    // pasar es un 500.
    expect([201, 400]).toContain(res.status);
  });
});
