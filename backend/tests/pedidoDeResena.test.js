import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* ══════════════════════════════════════════════════════════════════════════
   A QUIÉN PEDIRLE UNA RESEÑA.

   La sección "Lo que se puede verificar" del sitio institucional dice que
   todavía no hay testimonios y que cuando alguien autorice uno va a estar ahí.
   Esto es la mitad que hace que esa frase no quede en promesa.

   Lo que protegen estos tests, en orden de gravedad:

   1. QUE UN "NO" SE RESPETE PARA SIEMPRE. Quien dijo que no desaparece de la
      lista y no vuelve ni pidiéndolo explícitamente. Es la única regla de acá
      que, si falla, molesta a una persona real.
   2. Que se cuenten clases DADAS y no reservas. Alguien que reservó cinco veces
      y no vino a ninguna no tiene nada sobre qué opinar.
   3. Que a un menor no se le mande el mensaje a él, sino a su responsable.
   4. Que el estado se pueda mover y quede registrado, para no pedir dos veces.
══════════════════════════════════════════════════════════════════════════ */

let app;
let mongoServer;
let Booking;
let Student;
let User;
let listarCandidatosAResena;
let registrarPedidoDeResena;

const ADMIN = { username: "profe@test.com", password: "Secreta123" };

const alumno = (overrides = {}) => ({
  displayName: "Juan Pérez",
  normalizedName: "juan perez",
  studentType: "adult",
  responsible: {
    name: "Juan Pérez",
    normalizedName: "juan perez",
    relationship: "self",
  },
  contact: { email: "juan@example.com", phone: "+54 9 11 2222-3333", phoneDigits: "541122223333" },
  identityKeys: ["juan perez"],
  source: "booking",
  ...overrides,
});

const claseDe = (studentId, overrides = {}) => ({
  studentId,
  studentName: "Juan Pérez",
  responsibleName: "Juan Pérez",
  responsibleRelationship: "self",
  tutorName: "Agustin",
  phone: "+54 9 11 2222-3333",
  email: "juan@example.com",
  educationLevel: "Secundaria",
  yearGrade: "3er año",
  subject: "Matemática",
  timeSlot: new Date("2026-03-10T13:00:00.000Z"),
  endTime: new Date("2026-03-10T14:00:00.000Z"),
  duration: 1,
  status: "Confirmado",
  attendanceStatus: "Presente",
  ...overrides,
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-para-pedidos-de-resena";
  process.env.NODE_ENV = "test";

  ({ default: app } = await import("../src/app.js"));
  ({ default: Booking } = await import("../src/models/Booking.js"));
  ({ default: Student } = await import("../src/models/Student.js"));
  ({ default: User } = await import("../src/models/User.js"));
  ({ listarCandidatosAResena, registrarPedidoDeResena } = await import(
    "../src/services/pedidosDeResenaService.js"
  ));

  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    Booking.deleteMany({}),
    Student.deleteMany({}),
    User.deleteMany({}),
  ]);
});

const conClases = async (cantidad, { overridesAlumno = {}, overridesClase = {} } = {}) => {
  const creado = await Student.create(alumno(overridesAlumno));
  await Booking.insertMany(
    Array.from({ length: cantidad }, (_, i) => claseDe(creado._id, {
      timeSlot: new Date(`2026-03-${String(10 + i).padStart(2, "0")}T13:00:00.000Z`),
      endTime: new Date(`2026-03-${String(10 + i).padStart(2, "0")}T14:00:00.000Z`),
      ...overridesClase,
    })),
  );
  return creado;
};

describe("quién entra en la lista", () => {
  it("un alumno con dos clases dadas es candidato", async () => {
    /* Dos y no tres: alguien que vino dos veces ya tomó la decisión que importa,
       que es volver. El umbral está justificado en el servicio. */
    await conClases(2);

    const { candidatos, minimoClases } = await listarCandidatosAResena();

    expect(minimoClases).toBe(2);
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].clasesDadas).toBe(2);
  });

  it("con una sola clase todavía no", async () => {
    await conClases(1);

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos).toHaveLength(0);
  });

  it("cuenta clases DADAS, no reservas hechas", async () => {
    /* El error que haría inútil toda la pantalla: alguien que reservó cinco veces
       y no vino a ninguna aparecería primero en la lista, y no tiene absolutamente
       nada sobre qué opinar. */
    await conClases(5, { overridesClase: { attendanceStatus: "Ausente" } });

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos).toHaveLength(0);
  });

  it("no cuenta las clases borradas", async () => {
    await conClases(3, { overridesClase: { deletedAt: new Date() } });

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos).toHaveLength(0);
  });

  it("no propone alumnos dados de baja ni borrados", async () => {
    /* Alguien inactivo o borrado, o se fue, o pidió que lo saquen. En los dos
       casos escribirle está mal. */
    await conClases(4, { overridesAlumno: { active: false } });
    await conClases(4, {
      overridesAlumno: {
        displayName: "Ana Gómez",
        normalizedName: "ana gomez",
        identityKeys: ["ana gomez"],
        deletedAt: new Date(),
      },
    });

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos).toHaveLength(0);
  });

  it("el umbral se puede bajar o subir", async () => {
    await conClases(2);

    expect((await listarCandidatosAResena({ minimoClases: 5 })).candidatos).toHaveLength(0);
    expect((await listarCandidatosAResena({ minimoClases: 1 })).candidatos).toHaveLength(1);
  });
});

describe("el orden de la lista", () => {
  it("primero el que más clases hizo", async () => {
    /* Quien hizo doce clases tiene doce veces más para contar que quien hizo dos.
       Su reseña vale más aunque la última haya sido hace meses. */
    await conClases(2);
    await conClases(6, {
      overridesAlumno: {
        displayName: "Ana Gómez",
        normalizedName: "ana gomez",
        identityKeys: ["ana gomez"],
        contact: { email: "ana@example.com", phone: "+54 9 11 4444-5555", phoneDigits: "541144445555" },
      },
    });

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos.map((c) => c.displayName)).toEqual(["Ana Gómez", "Juan Pérez"]);
  });

  it("a igual cantidad de clases, primero el más reciente", async () => {
    /* Con dos clases cada uno, conviene escribirle al que viste la semana pasada
       y no al de hace un año. */
    await conClases(2);
    const ana = await Student.create(alumno({
      displayName: "Ana Gómez",
      normalizedName: "ana gomez",
      identityKeys: ["ana gomez"],
    }));
    await Booking.insertMany([
      claseDe(ana._id, {
        timeSlot: new Date("2026-08-01T13:00:00.000Z"),
        endTime: new Date("2026-08-01T14:00:00.000Z"),
      }),
      claseDe(ana._id, {
        timeSlot: new Date("2026-08-08T13:00:00.000Z"),
        endTime: new Date("2026-08-08T14:00:00.000Z"),
      }),
    ]);

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos[0].displayName).toBe("Ana Gómez");
  });
});

describe("a quién le llega el mensaje", () => {
  it("si el alumno es menor, el contacto es el responsable", async () => {
    /* Mandarle un pedido de reseña a un chico de segundo año es, además de
       inútil, incómodo. La decisión sale del mismo lugar que la del wizard: quien
       LEE es quien recibe. */
    await conClases(3, {
      overridesAlumno: {
        displayName: "Tomás Álvarez",
        normalizedName: "tomas alvarez",
        identityKeys: ["tomas alvarez"],
        studentType: "minor",
        responsible: {
          name: "Carolina Álvarez",
          normalizedName: "carolina alvarez",
          relationship: "madre",
        },
      },
    });

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos[0].contactoNombre).toBe("Carolina Álvarez");
    expect(candidatos[0].esResponsable).toBe(true);
    expect(candidatos[0].vinculo).toBe("madre");
  });

  it("si es adulto, el contacto es el alumno", async () => {
    await conClases(3);

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos[0].contactoNombre).toBe("Juan Pérez");
    expect(candidatos[0].esResponsable).toBe(false);
  });

  it("viaja el teléfono en dígitos, que es lo que necesita el enlace de WhatsApp", async () => {
    await conClases(2);

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos[0].telefonoDigits).toBe("541122223333");
  });
});

describe("el estado del pedido", () => {
  it("por defecto nadie tiene la reseña pedida", async () => {
    await conClases(2);

    const { candidatos } = await listarCandidatosAResena();

    expect(candidatos[0].reviewRequest.status).toBe("sin pedir");
  });

  it("a quien ya se le pidió sale de la lista, y vuelve sólo si se lo pide", async () => {
    /* Sin esto, a las tres semanas no se sabe a quién se le pidió y se termina
       insistiendo — la forma más rápida de que una reseña que iba a llegar no
       llegue. */
    const juan = await conClases(3);
    await registrarPedidoDeResena({ studentId: juan._id, status: "pedida" });

    expect((await listarCandidatosAResena()).candidatos).toHaveLength(0);
    expect(
      (await listarCandidatosAResena({ incluirPedidas: true })).candidatos,
    ).toHaveLength(1);
  });

  it("QUIEN DIJO QUE NO NO VUELVE A APARECER, ni pidiéndolo", async () => {
    /* La regla más importante del archivo. Un "no" que hay que repetir todos los
       meses no es un "no" respetado. `incluirPedidas` NO lo trae de vuelta. */
    const juan = await conClases(8);
    await registrarPedidoDeResena({ studentId: juan._id, status: "no quiere" });

    expect((await listarCandidatosAResena()).candidatos).toHaveLength(0);
    expect(
      (await listarCandidatosAResena({ incluirPedidas: true })).candidatos,
    ).toHaveLength(0);
    expect(
      (await listarCandidatosAResena({ minimoClases: 1, incluirPedidas: true })).candidatos,
    ).toHaveLength(0);
  });

  it("quien ya la dio y está publicada tampoco vuelve", async () => {
    const juan = await conClases(4);
    await registrarPedidoDeResena({ studentId: juan._id, status: "publicada" });

    expect(
      (await listarCandidatosAResena({ incluirPedidas: true })).candidatos,
    ).toHaveLength(0);
  });

  it("guarda cuándo se movió el estado", async () => {
    const juan = await conClases(2);
    const antes = Date.now();

    const actualizado = await registrarPedidoDeResena({ studentId: juan._id, status: "pedida" });

    expect(actualizado.reviewRequest.status).toBe("pedida");
    expect(new Date(actualizado.reviewRequest.updatedAt).getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("cambiar el estado sin mandar notas no borra las que había", async () => {
    /* Clave ausente significa "no la toco". Sin esto, tocar el estado desde un
       botón que no manda notas borraría el "me dijo que la escribe el finde". */
    const juan = await conClases(2);
    await registrarPedidoDeResena({
      studentId: juan._id,
      status: "pedida",
      notes: "Me dijo que la escribe el finde",
    });

    const actualizado = await registrarPedidoDeResena({ studentId: juan._id, status: "publicada" });

    expect(actualizado.reviewRequest.notes).toBe("Me dijo que la escribe el finde");
  });

  it("un estado inventado se rechaza", async () => {
    /* Un estado fuera de la lista dejaría a alguien afuera de los candidatos sin
       que nadie pueda saber por qué. */
    const juan = await conClases(2);

    await expect(
      registrarPedidoDeResena({ studentId: juan._id, status: "capaz" }),
    ).rejects.toThrow(/inválido/i);
  });

  it("sobre un alumno que no existe devuelve null, no explota", async () => {
    const resultado = await registrarPedidoDeResena({
      studentId: new mongoose.Types.ObjectId(),
      status: "pedida",
    });

    expect(resultado).toBeNull();
  });
});

describe("los endpoints", () => {
  const login = async () => {
    await User.create({
      username: ADMIN.username,
      password: await bcrypt.hash(ADMIN.password, 10),
    });
    const res = await request(app).post("/api/auth/login").send(ADMIN);
    return res.body?.data?.token || res.body?.token;
  };

  it("piden autenticación", async () => {
    /* Devuelve nombres, teléfonos y mails de alumnos. No puede quedar abierto. */
    const res = await request(app).get("/api/students/candidatos-resena");
    expect(res.status).toBe(401);
  });

  it("`/candidatos-resena` no se confunde con `/:id`", async () => {
    /* Express resuelve rutas por orden: con `/:id` declarado antes, esta llamada
       entraría a getStudentById con id="candidatos-resena" y devolvería un 400 de
       identificador inválido, que manda a buscar el problema al lugar equivocado. */
    const token = await login();
    await conClases(2);

    const res = await request(app)
      .get("/api/students/candidatos-resena")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.minimoClases).toBe(2);
  });

  it("el PATCH mueve el estado", async () => {
    const token = await login();
    const juan = await conClases(2);

    const res = await request(app)
      .patch(`/api/students/${juan._id}/pedido-resena`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "pedida" });

    expect(res.status).toBe(200);
    expect(res.body.data.reviewRequest.status).toBe("pedida");
  });

  it("el PATCH rechaza un estado inválido con un mensaje que se puede corregir", async () => {
    const token = await login();
    const juan = await conClases(2);

    const res = await request(app)
      .patch(`/api/students/${juan._id}/pedido-resena`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "capaz" });

    expect(res.status).toBe(400);
    // El mensaje va a la pantalla del profesor: tiene que decir qué poner.
    expect(res.body.message).toMatch(/sin pedir/);
    expect(res.body.message).toMatch(/no quiere/);
  });

  it("el PATCH sobre un id que no es un id devuelve 400", async () => {
    const token = await login();

    const res = await request(app)
      .patch("/api/students/no-soy-un-id/pedido-resena")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "pedida" });

    expect(res.status).toBe(400);
  });

  it("los datos de contacto no se cachean", async () => {
    const token = await login();
    await conClases(2);

    const res = await request(app)
      .get("/api/students/candidatos-resena")
      .set("Authorization", `Bearer ${token}`);

    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
