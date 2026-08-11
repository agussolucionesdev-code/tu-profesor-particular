import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* Precio de las reservas self-service.
 *
 * `createBooking` público nunca asignaba `price`, así que TODA reserva hecha desde
 * el sitio quedaba en 0. El KPI "Ingresos del mes" suma el `price` de los turnos
 * Finalizado, así que sumaba únicamente lo que el profesor había cargado a mano:
 * el número era estructuralmente incompleto y no había forma de darse cuenta
 * mirándolo.
 *
 * El precio se calcula EN EL SERVIDOR con `booking.pricePerHour` × duración. El
 * cliente no lo manda: `price` no está en createBookingSchema, y no tiene que
 * estar. Si lo mandara, cualquiera podría reservar por cero.
 *
 * Además se guarda la TARIFA con la que se cotizó. Sin eso, reprogramar quedaba
 * mal de las dos maneras posibles: recalcular con la tarifa actual le cambia el
 * precio a alguien porque el profesor subió los valores después, y no recalcular
 * deja una clase de 1 h extendida a 2 h con el precio de 1 h.
 */

let mongoServer;
let app;
let Booking;
let AppSettings;

const CLAVE_PRECIO = "booking.pricePerHour";

/* La API recibe una etiqueta de reloj de pared con formato "dd/MM/yyyy HH:mm" y
   la interpreta en Buenos Aires, no un objeto Date. */
const etiqueta = (d) => [
  String(d.getDate()).padStart(2, "0"),
  String(d.getMonth() + 1).padStart(2, "0"),
  d.getFullYear(),
].join("/") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

/* Miercoles a las 10, y NO "ahora + 48 h": un desplazamiento relativo cae en
   domingo o fuera del horario segun el dia en que corra el test, y la reserva
   se rechaza con 400. Es exactamente la trampa que hace fallar los tests de
   reserva los sabados. Un dia fijo de la semana no depende de cuando se corra. */
const miercolesA = (hora, minuto = 0) => {
  const d = new Date();
  const faltan = (3 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + faltan);
  d.setHours(hora, minuto, 0, 0);
  return d;
};

const fijarTarifa = async (valor) => {
  await AppSettings.findOneAndUpdate(
    { key: CLAVE_PRECIO },
    { key: CLAVE_PRECIO, value: valor },
    { upsert: true },
  );
};

/* Se reserva por la API pública, igual que desde el sitio: el punto es
   justamente que el precio salga sin que el cliente lo mande. */
const reservar = async (overrides = {}) => {
  const slot = overrides.timeSlot ?? miercolesA(10);
  const res = await request(app)
    .post("/api/bookings/reserve")
    .send({
      studentName: "Alumna De Prueba",
      responsibleName: "Mayor de edad / Responsable",
      responsibleRelationship: "self",
      phone: "1133365937",
      email: "familia@example.com",
      educationLevel: "Secundaria",
      yearGrade: "3er año",
      subject: "Matemática",
      academicSituation: "Objetivo: preparar el examen",
      duration: 1,
      ...overrides,
      timeSlot: etiqueta(slot),
    });
  return res;
};

const guardado = async (bookingCode) =>
  Booking.findOne({ bookingCode }).lean();

beforeAll(async () => {
  process.env.JWT_SECRET = "booking-price-tests";
  process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = `v1:${crypto.randomBytes(32).toString("base64url")}`;
  process.env.NOTIFICATION_OUTBOX_ACTIVE_KEY_VERSION = "v1";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.PUBLIC_MUTATION_RATE_LIMIT_MAX = "1000";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = (await import("../src/app.js")).default;
  Booking = (await import("../src/models/Booking.js")).default;
  AppSettings = (await import("../src/models/AppSettings.js")).default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

beforeEach(async () => {
  await Booking.deleteMany({});
  await AppSettings.deleteMany({});
});

describe("precio al reservar desde el sitio", () => {
  it("calcula el precio con la tarifa por hora y la duración", async () => {
    await fijarTarifa(8000);

    const res = await reservar({ duration: 1 });

    expect(res.status).toBe(201);
    const b = await guardado(res.body.data.bookingCode);
    expect(b.price).toBe(8000);
  });

  it("multiplica por la duración", async () => {
    await fijarTarifa(8000);

    const res = await reservar({ duration: 2 });

    expect((await guardado(res.body.data.bookingCode)).price).toBe(16000);
  });

  it("maneja las medias horas sin dejar centavos raros", async () => {
    // 1,5 h a 8000 son 12000 justos. Con 7000 daría 10500, también entero.
    await fijarTarifa(7000);

    const res = await reservar({ duration: 1.5 });

    expect((await guardado(res.body.data.bookingCode)).price).toBe(10500);
  });

  it("redondea a peso entero", async () => {
    /* Una tarifa impar por media hora da centavos. En pesos argentinos nadie
       cobra centavos, y un `price` con decimales hace que el KPI de ingresos
       muestre números con coma. */
    await fijarTarifa(7333);

    const res = await reservar({ duration: 0.5 });

    const b = await guardado(res.body.data.bookingCode);
    expect(Number.isInteger(b.price)).toBe(true);
    expect(b.price).toBe(3667); // 3666,5 redondeado
  });

  it("guarda la tarifa con la que se cotizó", async () => {
    await fijarTarifa(8000);

    const res = await reservar({ duration: 1 });

    expect((await guardado(res.body.data.bookingCode)).pricePerHourAtBooking).toBe(8000);
  });

  it("deja el precio en cero si el profesor no configuró tarifa", async () => {
    // Sin tarifa no se inventa un número: cero significa "a acordar", que es lo
    // que pasaba siempre hasta ahora.
    const res = await reservar();

    expect(res.status).toBe(201);
    expect((await guardado(res.body.data.bookingCode)).price).toBe(0);
  });

  it("ignora una tarifa guardada que no es un número usable", async () => {
    await fijarTarifa("ocho mil");

    const res = await reservar();

    expect(res.status).toBe(201);
    expect((await guardado(res.body.data.bookingCode)).price).toBe(0);
  });

  it("ignora una tarifa negativa", async () => {
    await fijarTarifa(-500);

    const res = await reservar();

    expect((await guardado(res.body.data.bookingCode)).price).toBe(0);
  });
});

describe("el cliente no puede fijar su propio precio", () => {
  /* Estos dos tests los escribí primero esperando un 400, y pasaban —pero por el
     motivo equivocado: TODO daba 400 porque mi fecha caía fuera de horario—.
     createBookingSchema no es `.strict()`, así que un campo de más se DESCARTA en
     silencio en lugar de rechazarse.
     Lo cual está bien, y la propiedad correcta es más fuerte: no importa qué
     mande el cliente, el precio lo pone el servidor. Eso es lo que se afirma acá. */
  it("descarta el price que venga en el pedido y usa el del servidor", async () => {
    await fijarTarifa(8000);

    const res = await reservar({ price: 1 });

    expect(res.status).toBe(201);
    expect((await guardado(res.body.data.bookingCode)).price).toBe(8000);
  });

  it("descarta también un pricePerHourAtBooking del pedido", async () => {
    await fijarTarifa(8000);

    const res = await reservar({ pricePerHourAtBooking: 1 });

    expect(res.status).toBe(201);
    const b = await guardado(res.body.data.bookingCode);
    expect(b.pricePerHourAtBooking).toBe(8000);
    expect(b.price).toBe(8000);
  });

  it("un precio en cero no se puede forzar mandando duration cero", async () => {
    // La duración la valida el flujo de reserva; acá se fija que no haya un
    // camino trivial para reservar gratis.
    await fijarTarifa(8000);

    const res = await reservar({ duration: 0 });

    expect(res.status).toBe(400);
  });
});

describe("el precio queda congelado al momento de reservar", () => {
  it("no cambia si el profesor sube la tarifa después", async () => {
    /* Es la razón de guardar el precio en lugar de calcularlo al leer: quien
       reservó a 8000 pagó 8000, y un aumento posterior no puede reescribir lo
       que ya se acordó. Es el mismo motivo por el que una factura guarda el
       importe. */
    await fijarTarifa(8000);
    const res = await reservar({ duration: 1 });

    await fijarTarifa(12000);

    const b = await guardado(res.body.data.bookingCode);
    expect(b.price).toBe(8000);
    expect(b.pricePerHourAtBooking).toBe(8000);
  });
});

describe("reprogramar y el precio", () => {
  const tokenPara = async (bookingCode) => {
    const r = await request(app)
      .post("/api/bookings/portal/session")
      .send({ bookingCode });
    expect(r.status).toBe(200);
    return r.body.data.managementToken;
  };

  it("recalcula si cambia la duración, con la tarifa original", async () => {
    /* Reprogramar acepta newDuration, así que una clase de 1 h puede pasar a
       2 h. Sin recalcular, quedaría el precio de 1 h. Y recalculando con la
       tarifa ACTUAL, un aumento posterior le encarecería el turno a alguien que
       solo movió el horario: se usa la tarifa que se le cotizó. */
    await fijarTarifa(8000);
    const creada = await reservar({ duration: 1 });
    const code = creada.body.data.bookingCode;
    const token = await tokenPara(code);
    await fijarTarifa(12000);

    const res = await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", token)
      .send({
        bookingCode: code,
        newTimeSlot: etiqueta(miercolesA(15)),
        newDuration: 2,
      });

    expect(res.status).toBe(200);
    const b = await guardado(code);
    expect(b.pricePerHourAtBooking).toBe(8000);
    expect(b.price).toBe(16000); // 2 h a la tarifa original, no a 12000
  });

  it("no toca el precio si la duración no cambia", async () => {
    await fijarTarifa(8000);
    const creada = await reservar({ duration: 1 });
    const code = creada.body.data.bookingCode;
    const token = await tokenPara(code);

    await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", token)
      .send({ bookingCode: code, newTimeSlot: etiqueta(miercolesA(15)), newDuration: 1 });

    expect((await guardado(code)).price).toBe(8000);
  });

  it("un turno viejo sin tarifa guardada no se rompe al reprogramar", async () => {
    /* Las reservas que ya existen no tienen pricePerHourAtBooking. Reprogramar
       una de esas no puede fallar ni ponerle un precio inventado: se deja el que
       tenía. */
    await fijarTarifa(8000);
    const creada = await reservar({ duration: 1 });
    const code = creada.body.data.bookingCode;
    await Booking.findOneAndUpdate(
      { bookingCode: code },
      { $unset: { pricePerHourAtBooking: "" }, $set: { price: 5555 } },
    );
    const token = await tokenPara(code);

    const res = await request(app)
      .post("/api/bookings/reschedule")
      .set("X-Booking-Manage-Token", token)
      .send({ bookingCode: code, newTimeSlot: etiqueta(miercolesA(15)), newDuration: 2 });

    expect(res.status).toBe(200);
    expect((await guardado(code)).price).toBe(5555);
  });
});
