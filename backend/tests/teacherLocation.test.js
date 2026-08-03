import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* La dirección del espacio de Temperley, expuesta al público.

   Estaba en ADMIN_ONLY_KEYS, así que `GET /api/settings` no la devolvía. El
   resultado: quien elegía "Presencial" reservaba sin ver nunca DÓNDE es la
   clase dentro de la app. Solo se enteraba por el email, y el .ics que
   descargaba no llevaba ubicación.

   No es una divulgación nueva: la dirección ya está publicada en
   tuprofesorparticular.com.ar (web/src/data/site.js) y ahora también en el
   JSON-LD de LocalBusiness que lee Google. Ocultarla en la app de reservas
   —el único lugar donde alguien necesita saberla para llegar— era la
   asimetría, no la exposición.

   Lo que estos tests fijan: que las dos claves de ubicación viajan en el
   endpoint público CON un valor usable, y que nada más de lo que sigue siendo
   privado se filtró en la misma movida. Esa segunda mitad es la que importa:
   mover una clave de lista es fácil de hacer de más. */

let mongoServer;
let app;
let AppSettings;

const CLAVE_DIRECCION = "teacher.address";
const CLAVE_MAPA = "teacher.mapsUrl";

const publicas = async () => {
  const res = await request(app).get("/api/settings");
  expect(res.status).toBe(200);
  return res.body.data ?? {};
};

beforeAll(async () => {
  process.env.JWT_SECRET = "teacher-location-tests";
  process.env.RATE_LIMIT_MAX = "1000";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = (await import("../src/app.js")).default;
  AppSettings = (await import("../src/models/AppSettings.js")).default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

beforeEach(async () => {
  await AppSettings.deleteMany({});
});

describe("ubicación del profesor en los ajustes públicos", () => {
  it("devuelve la dirección sin autenticación", async () => {
    const data = await publicas();
    expect(data).toHaveProperty(CLAVE_DIRECCION);
    expect(typeof data[CLAVE_DIRECCION]).toBe("string");
    expect(data[CLAVE_DIRECCION].length).toBeGreaterThan(0);
  });

  it("devuelve el enlace al mapa sin autenticación", async () => {
    const data = await publicas();
    expect(data).toHaveProperty(CLAVE_MAPA);
    expect(data[CLAVE_MAPA]).toMatch(/^https?:\/\//);
  });

  it("cae en el default cuando no hay nada guardado en la base", async () => {
    // Una instalación nueva no tiene el documento. Si el endpoint devolviera
    // undefined, el paso 2 del kiosco mostraría un hueco en lugar de la
    // dirección, que es exactamente el bug que veníamos a arreglar.
    const data = await publicas();
    expect(data[CLAVE_DIRECCION]).toContain("Temperley");
  });

  it("prefiere el valor guardado por el profesor antes que el default", async () => {
    await AppSettings.create({
      key: CLAVE_DIRECCION,
      value: "Avenida Siempre Viva 742, Temperley",
    });

    const data = await publicas();
    expect(data[CLAVE_DIRECCION]).toBe("Avenida Siempre Viva 742, Temperley");
  });
});

describe("lo que NO se filtró al mover las claves", () => {
  it("no expone la política de confirmación manual", async () => {
    // Es una decisión operativa del profesor. Si se conociera, alguien podría
    // inferir si su reserva va a quedar Pendiente antes de mandarla.
    await AppSettings.create({
      key: "booking.requireManualConfirmation",
      value: true,
    });

    const data = await publicas();
    expect(data).not.toHaveProperty("booking.requireManualConfirmation");
  });

  it("no expone el estado de sincronización con Sheets", async () => {
    await AppSettings.create({ key: "sheets.syncStatus", value: { ok: false } });

    const data = await publicas();
    expect(data).not.toHaveProperty("sheets.syncStatus");
  });

  it("no expone la última corrida del cron de recordatorios", async () => {
    // Delata la ventana en que el servidor trabaja. No le sirve a nadie de
    // afuera y es información de infraestructura.
    await AppSettings.create({
      key: "cron.lastReminderRun",
      value: new Date().toISOString(),
    });

    const data = await publicas();
    expect(data).not.toHaveProperty("cron.lastReminderRun");
  });

  it("devuelve exactamente el conjunto de claves esperado y nada más", async () => {
    // La red de seguridad de verdad: si alguien agrega una clave a la lista
    // pública sin pensarlo, este test falla y obliga a justificarlo acá.
    const data = await publicas();
    const claves = Object.keys(data).sort();

    expect(claves).toEqual(
      [
        "booking.pricePerHour",
        "booking.subjectsByLevel",
        "schedule.advanceNoticeMinutes",
        "schedule.maximumAdvanceDays",
        "schedule.slotDurationMinutes",
        "schedule.timeZone",
        CLAVE_DIRECCION,
        CLAVE_MAPA,
      ].sort(),
    );
  });
});
