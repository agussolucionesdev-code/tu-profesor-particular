import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* El contrato HTTP del panel de horarios por modalidad.
 *
 * Los tests de `modalityAvailability.test.js` prueban el CÁLCULO. Estos prueban el
 * CAMINO: que el valor que el profesor escribe en la pantalla llegue a la base, vuelva
 * al recargar, y efectivamente cambie los horarios que se le ofrecen a un alumno.
 *
 * Es la mitad que falla en silencio. Un cálculo roto se ve enseguida; un DTO al que le
 * falta una clave deja la pantalla andando —muestra los campos, deja tipear, dice
 * "guardado"— y el valor no llega nunca. Ya pasó una vez en este mismo cambio: el
 * `.select()` de disponibilidad no traía `modality` y todo el buffer de traslado era
 * código muerto que parecía funcionar.
 *
 * Y hay un segundo riesgo, propio de este endpoint: el PUT reemplaza la configuración
 * ENTERA. Un panel viejo que no conoce estas claves las borraría la primera vez que el
 * profesor toque cualquier otra cosa del horario, y el borrado se vería semanas después
 * como presenciales entrando a las 7 de la mañana.
 */

let mongoServer;
let app;
let User;
let AppSettings;
let Booking;

const TZ = "America/Argentina/Buenos_Aires";
const RUTA = "/api/settings/admin/schedule";

const login = async () => {
  await User.create({
    username: "admin@example.com",
    password: await bcrypt.hash("super-secret", 10),
  });
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin@example.com", password: "super-secret" });
  return res.body.token;
};

const leer = async (token) => {
  const res = await request(app).get(RUTA).set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.data;
};

const guardar = async (token, cambios, revision) => {
  const actual = await leer(token);
  const schedule = { ...actual, ...cambios };
  delete schedule.revision;
  return request(app)
    .put(RUTA)
    .set("Authorization", `Bearer ${token}`)
    .set("If-Match", `"${revision ?? actual.revision}"`)
    .send({ schedule });
};

const horaBA = (fecha) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(fecha));

const horariosOfrecidos = async (modality, duracion = 1) => {
  const from = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
  const res = await request(app)
    .get("/api/bookings/availability")
    .query({ duration: duracion, from, to, modality });
  expect(res.status).toBe(200);
  // Los horarios vienen en `slots`; `data` son las reservas existentes.
  return [...new Set((res.body.slots ?? []).map((s) => horaBA(s.timeSlot)))].sort();
};

beforeAll(async () => {
  process.env.JWT_SECRET = "modality-panel-tests";
  process.env.RATE_LIMIT_MAX = "1000";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = (await import("../src/app.js")).default;
  User = (await import("../src/models/User.js")).default;
  AppSettings = (await import("../src/models/AppSettings.js")).default;
  Booking = (await import("../src/models/Booking.js")).default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    AppSettings.deleteMany({}),
    Booking.deleteMany({}),
  ]);
});

describe("el panel lee la configuración por modalidad", () => {
  it("expone las dos claves nuevas", async () => {
    /* Sin esto el panel no puede ni mostrar el estado actual: renderizaría campos
       vacíos y el profesor creería que nunca configuró nada. */
    const data = await leer(await login());

    expect(data).toHaveProperty("modalityWindows");
    expect(data).toHaveProperty("modalityChangeBufferMinutes");
  });

  it("arranca sin recortes y con el traslado por defecto", async () => {
    const data = await leer(await login());

    // null = las dos modalidades usan el horario general. Es la decisión de Agustín.
    expect(data.modalityWindows).toBe(null);
    expect(data.modalityChangeBufferMinutes).toBe(45);
  });
});

describe("el panel guarda y el valor vuelve", () => {
  it("recorta presencial y lo devuelve al recargar", async () => {
    const token = await login();
    const guardado = await guardar(token, {
      modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } },
    });

    expect(guardado.status).toBe(200);
    expect(guardado.body.data.modalityWindows).toEqual({
      presencial: { openingHour: 9, closingHour: 21 },
    });
    // Y sobrevive a una lectura nueva, que es lo que ve el profesor al volver.
    expect((await leer(token)).modalityWindows).toEqual({
      presencial: { openingHour: 9, closingHour: 21 },
    });
  });

  it("cambia el traslado", async () => {
    const token = await login();
    const guardado = await guardar(token, { modalityChangeBufferMinutes: 90 });

    expect(guardado.status).toBe(200);
    expect((await leer(token)).modalityChangeBufferMinutes).toBe(90);
  });

  it("volver a null borra el recorte", async () => {
    const token = await login();
    await guardar(token, {
      modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } },
    });

    expect((await guardar(token, { modalityWindows: null })).status).toBe(200);
    expect((await leer(token)).modalityWindows).toBe(null);
  });
});

describe("un panel viejo no puede borrar la configuración", () => {
  it("guardar sin mandar las claves conserva lo que había", async () => {
    /* El riesgo concreto de este endpoint: reemplaza TODO lo que recibe. Un cliente que
       no conoce estas claves las omite, y sin el fallback a lo guardado el recorte
       desaparecería la primera vez que el profesor cambie la hora de cierre general. */
    const token = await login();
    await guardar(token, {
      modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } },
      modalityChangeBufferMinutes: 30,
    });

    const actual = await leer(token);
    const viejo = { ...actual };
    delete viejo.revision;
    delete viejo.modalityWindows;
    delete viejo.modalityChangeBufferMinutes;

    const res = await request(app)
      .put(RUTA)
      .set("Authorization", `Bearer ${token}`)
      .set("If-Match", `"${actual.revision}"`)
      .send({ schedule: { ...viejo, closingHour: 21 } });

    expect(res.status).toBe(200);
    expect(res.body.data.modalityWindows).toEqual({
      presencial: { openingHour: 9, closingHour: 21 },
    });
    expect(res.body.data.modalityChangeBufferMinutes).toBe(30);
  });
});

describe("los errores de carga se rechazan con un mensaje útil", () => {
  const rechaza = async (cambios, patron) => {
    const res = await guardar(await login(), cambios);
    expect(res.status).toBe(400);
    expect(res.body.message ?? "").toMatch(patron);
  };

  it("un cierre anterior a la apertura", async () => {
    await rechaza(
      { modalityWindows: { presencial: { openingHour: 21, closingHour: 9 } } },
      /posterior a la apertura/i,
    );
  });

  it("una modalidad que no existe", async () => {
    /* Una modalidad mal escrita no haría nada y no se notaría hasta que alguien reserve
       a una hora que el profesor creía cerrada. Mejor un 400 ahora. */
    await rechaza(
      { modalityWindows: { presencia: { openingHour: 9, closingHour: 21 } } },
      /no es una modalidad válida/i,
    );
  });

  it("una hora fuera del reloj", async () => {
    await rechaza(
      { modalityWindows: { online: { openingHour: 9, closingHour: 30 } } },
      /entre 1 y 24/,
    );
  });

  it("un traslado imposible", async () => {
    await rechaza({ modalityChangeBufferMinutes: 600 }, /entre 0 y 240/);
  });
});

describe("lo guardado cambia lo que se le ofrece al alumno", () => {
  it("recortar presencial saca sus primeras horas del calendario público", async () => {
    /* El test que cierra el círculo. Todo lo de arriba puede pasar y la función igual no
       servir de nada si el valor guardado no llega al cálculo de disponibilidad. */
    const token = await login();

    const antes = await horariosOfrecidos("presencial");
    expect(antes).toContain("07:00");
    expect(antes).toContain("08:00");

    await guardar(token, {
      modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } },
    });

    const despues = await horariosOfrecidos("presencial");
    expect(despues).not.toContain("07:00");
    expect(despues).not.toContain("08:00");
    expect(despues).toContain("09:00");

    // Y online no se tocó: configurar una modalidad no puede afectar a la otra.
    expect(await horariosOfrecidos("online")).toContain("07:00");
  });
});
