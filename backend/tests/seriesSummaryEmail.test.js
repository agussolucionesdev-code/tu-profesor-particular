import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* Un solo email para toda la serie.
 *
 * Una serie de 8 clases son 8 reservas —decisión de producto, como Google
 * Calendar— y cada una encolaba su propia confirmación. Ocho correos que llegan
 * juntos, con los mismos datos y códigos distintos, se leen como un error del
 * sistema aunque cada uno sea correcto.
 *
 * Ahora las reservas de una serie NO encolan confirmación individual, y el wizard
 * pide un resumen al terminar el bucle: un correo con las 8 fechas y los 8 códigos.
 *
 * LO QUE NO SE SUPRIME: el recordatorio de 24 h de cada clase. Es el sentido de
 * tener 8 reservas independientes —te avisa antes de cada una— y suprimirlo
 * convertiría la serie en una sola clase con siete fantasmas.
 */

let mongoServer;
let app;
let Booking;
let NotificationOutbox;
let enviados;

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

/* Miércoles fijo: un desplazamiento relativo cae en domingo o fuera de horario
   según el día en que corra el test. */
const miercolesA = (hora, semanas = 0) => {
  const d = new Date();
  const faltan = (3 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + faltan + semanas * 7);
  d.setHours(hora, 0, 0, 0);
  return d;
};

const reservar = (extra = {}) => {
  const { semana = 0, ...resto } = extra;
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
      timeSlot: etiqueta(miercolesA(10, semana)),
    });
};

/* desdeSemana permite crear DOS series que no se pisen entre si: sin eso, la
   segunda choca entera con la primera y queda vacia. */
const crearSerie = async (semanas, desdeSemana = 0) => {
  const seriesId = crypto.randomUUID();
  const hechas = [];
  for (let i = 0; i < semanas; i += 1) {
    const res = await reservar({
      semana: desdeSemana + i,
      seriesId,
      seriesIndex: i + 1,
      seriesTotal: semanas,
    });
    if (res.status === 201) hechas.push(res.body.data);
  }
  return { seriesId, hechas };
};

const tokenPara = async (bookingCode) => {
  const r = await request(app)
    .post("/api/bookings/portal/session")
    .send({ bookingCode });
  expect(r.status).toBe(200);
  return r.body.data.managementToken;
};

const pedirResumen = ({ seriesId, token }) => {
  const req = request(app).post("/api/bookings/series/summary").send({ seriesId });
  return token ? req.set("X-Booking-Manage-Token", token) : req;
};

/* Los intents no quedan en la reserva: la reconciliacion los mueve al outbox de
   notificaciones. Mirar booking.notificationIntents despues de crear devuelve
   [] y hacia que el test pareciera detectar una supresion que no existia. */
const notificacionesDe = async (bookingCode) => {
  const filas = await NotificationOutbox.find({ bookingCode }).lean();
  return filas.map((f) => f.type);
};

beforeAll(async () => {
  process.env.JWT_SECRET = "series-summary-tests";
  process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = `v1:${crypto.randomBytes(32).toString("base64url")}`;
  process.env.NOTIFICATION_OUTBOX_ACTIVE_KEY_VERSION = "v1";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.PUBLIC_MUTATION_RATE_LIMIT_MAX = "1000";
  process.env.PORTAL_SESSION_RATE_LIMIT_MAX = "1000";
  /* Se intercepta el envio: en tests no hay credenciales de correo y sendMail
     tira "Missing credentials". Lo que importa probar no es nodemailer sino QUE
     se llame y CON QUE datos. */
  enviados = [];
  vi.doMock("../src/config/mailer.js", async (importOriginal) => {
    const original = await importOriginal();
    return { ...original, sendSeriesSummary: async (p) => { enviados.push(p); return { accepted: true }; } };
  });

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = (await import("../src/app.js")).default;
  Booking = (await import("../src/models/Booking.js")).default;
  NotificationOutbox = (await import("../src/models/NotificationOutbox.js")).default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

beforeEach(async () => {
  await Booking.deleteMany({});
  await NotificationOutbox.deleteMany({});
  enviados.length = 0;
});

describe("qué se encola al crear una serie", () => {
  it("una reserva suelta sigue encolando su confirmación", async () => {
    // La mayoría de las reservas son de una clase y no cambian en nada.
    const res = await reservar();

    expect(await notificacionesDe(res.body.data.bookingCode)).toContain(
      "booking_confirmation",
    );
  });

  it("las de una serie NO encolan confirmación individual", async () => {
    const { hechas } = await crearSerie(3);

    for (const b of hechas) {
      expect(await notificacionesDe(b.bookingCode)).not.toContain("booking_confirmation");
    }
  });

  it("pero SÍ conservan su recordatorio de 24 h", async () => {
    /* Es lo que hace que ocho reservas independientes valgan la pena: te avisa
       antes de CADA clase. Sin esto la serie serían siete clases fantasma. */
    const { hechas } = await crearSerie(3);

    for (const b of hechas) {
      expect(await notificacionesDe(b.bookingCode)).toContain("booking_reminder");
    }
  });
});

describe("pedir el resumen", () => {
  it("responde 200 con el token de una clase de la serie", async () => {
    const { seriesId, hechas } = await crearSerie(3);
    const token = await tokenPara(hechas[0].bookingCode);

    const res = await pedirResumen({ seriesId, token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("informa cuántas clases entraron en el resumen", async () => {
    const { seriesId, hechas } = await crearSerie(4);
    const token = await tokenPara(hechas[0].bookingCode);

    const res = await pedirResumen({ seriesId, token });

    expect(res.body.data.clases).toBe(4);
  });

  it("sirve el token de CUALQUIER clase de la serie, no solo la primera", async () => {
    // El wizard tiene el token de la primera, pero si alguien pide el resumen
    // desde el portal va a estar mirando cualquiera de las ocho.
    const { seriesId, hechas } = await crearSerie(3);
    const token = await tokenPara(hechas[2].bookingCode);

    const res = await pedirResumen({ seriesId, token });

    expect(res.status).toBe(200);
  });

  it("rechaza sin token", async () => {
    const { seriesId } = await crearSerie(2);

    const res = await pedirResumen({ seriesId, token: null });

    expect(res.status).toBe(401);
  });

  it("rechaza el token de una reserva de OTRA serie", async () => {
    /* El seriesId agrupa y no autoriza: sin este chequeo, cualquiera con un token
       propio podría pedir el resumen —y el listado de fechas y códigos— de la
       serie de otra persona pasando su seriesId. */
    const ajena = await crearSerie(2);
    const propia = await crearSerie(2, 5);
    const token = await tokenPara(propia.hechas[0].bookingCode);

    const res = await pedirResumen({ seriesId: ajena.seriesId, token });

    expect(res.status).toBe(403);
  });

  it("rechaza el token de una reserva que no es de ninguna serie", async () => {
    const suelta = await reservar({ semana: 5 });
    const { seriesId } = await crearSerie(2);
    const token = await tokenPara(suelta.body.data.bookingCode);

    const res = await pedirResumen({ seriesId, token });

    expect(res.status).toBe(403);
  });

  it("rechaza un seriesId que no existe", async () => {
    const { hechas } = await crearSerie(2);
    const token = await tokenPara(hechas[0].bookingCode);

    const res = await pedirResumen({ seriesId: crypto.randomUUID(), token });

    expect(res.status).toBe(403);
  });

  it("rechaza un seriesId con formato inválido", async () => {
    const { hechas } = await crearSerie(2);
    const token = await tokenPara(hechas[0].bookingCode);

    const res = await pedirResumen({ seriesId: "no-es-un-uuid", token });

    expect(res.status).toBe(400);
  });
});

describe("qué incluye el resumen", () => {
  it("cuenta solo las clases que se pudieron reservar", async () => {
    /* Best-effort: si una semana estaba ocupada, el resumen tiene que listar las
       que existen y no las que se intentaron. Prometer 4 y mandar 3 es peor que
       decir 3. */
    await reservar({ semana: 1, email: "otra@example.com" });
    const { seriesId, hechas } = await crearSerie(4);
    const token = await tokenPara(hechas[0].bookingCode);

    const res = await pedirResumen({ seriesId, token });

    expect(hechas).toHaveLength(3);
    expect(res.body.data.clases).toBe(3);
  });

  it("no cuenta una clase cancelada después de reservarla", async () => {
    const { seriesId, hechas } = await crearSerie(3);
    const token = await tokenPara(hechas[1].bookingCode);
    await request(app)
      .post("/api/bookings/cancel")
      .set("X-Booking-Manage-Token", token)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ bookingCode: hechas[1].bookingCode });

    const tokenPrimera = await tokenPara(hechas[0].bookingCode);
    const res = await pedirResumen({ seriesId, token: tokenPrimera });

    expect(res.body.data.clases).toBe(2);
  });

  it("no devuelve los códigos en la respuesta", async () => {
    /* Los códigos van en el EMAIL, no en el cuerpo de la respuesta. El wizard ya
       los tiene de las reservas que hizo, y ponerlos acá los expondría a
       cualquier registro de red o telemetría sin ninguna necesidad. */
    const { seriesId, hechas } = await crearSerie(2);
    const token = await tokenPara(hechas[0].bookingCode);

    const res = await pedirResumen({ seriesId, token });

    const cuerpo = JSON.stringify(res.body);
    for (const b of hechas) {
      expect(cuerpo).not.toContain(b.bookingCode);
    }
  });
});
