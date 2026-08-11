import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/* Formulario de contacto del sitio institucional.

   /contacto era 100% enlaces salientes: WhatsApp, email, mapa. Quien no quiere
   abrir WhatsApp —o está en una computadora ajena, o simplemente no quiere dar
   su teléfono todavía— no tenía forma de dejar sus datos. Y los radios de
   "¿sobre qué querés escribir?" eran decorativos: solo cambiaban el texto del
   enlace.

   Este endpoint recibe el mensaje y lo reenvía por email. Lo que fijan estos
   tests es sobre todo lo que NO tiene que hacer: no guardar nada en la base
   —para eso hay una reserva—, no filtrar el mensaje del visitante en un lugar
   donde pueda ejecutarse, y no convertirse en un relay de spam. */

let mongoServer;
let app;
let enviados;

const mensajeValido = (overrides = {}) => ({
  name: "Familia De Prueba",
  email: "familia@example.com",
  subject: "clases",
  message: "Hola, quería consultar por clases de Matemática para 3er año.",
  ...overrides,
});

const enviar = (body) => request(app).post("/api/contact").send(body);

beforeAll(async () => {
  process.env.JWT_SECRET = "contact-tests";
  process.env.NOTIFICATION_OUTBOX_ENCRYPTION_KEYS = `v1:${crypto.randomBytes(32).toString("base64url")}`;
  process.env.NOTIFICATION_OUTBOX_ACTIVE_KEY_VERSION = "v1";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.CONTACT_RATE_LIMIT_MAX = "1000";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  /* Se intercepta el envío en lugar de mandar correo de verdad. El objetivo no
     es probar nodemailer sino QUÉ se le pasa: a quién va, con qué asunto y con
     el mensaje del visitante escapado. */
  enviados = [];
  vi.doMock("../src/config/mailer.js", async (importOriginal) => {
    const original = await importOriginal();
    return {
      ...original,
      sendContactMessage: async (payload) => {
        enviados.push(payload);
        return { accepted: true };
      },
    };
  });

  app = (await import("../src/app.js")).default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
  vi.doUnmock("../src/config/mailer.js");
});

beforeEach(() => {
  enviados.length = 0;
});

describe("envío válido", () => {
  it("acepta un mensaje completo", async () => {
    const res = await enviar(mensajeValido());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("no responde con los datos que le mandaron", async () => {
    /* Devolver el cuerpo recibido convierte el endpoint en un espejo: alguien
       puede mandar HTML y usar la respuesta para probar payloads. No hace falta
       para nada. */
    const res = await enviar(mensajeValido());

    expect(JSON.stringify(res.body)).not.toContain("familia@example.com");
    expect(JSON.stringify(res.body)).not.toContain("Matemática para 3er año");
  });

  it("no guarda nada en la base de datos", async () => {
    // Un mensaje de contacto no es una reserva. Guardarlo crearía una segunda
    // pila de datos personales que nadie mira y que habría que borrar después.
    const antes = await mongoose.connection.db.listCollections().toArray();
    await enviar(mensajeValido());
    const despues = await mongoose.connection.db.listCollections().toArray();

    expect(despues.length).toBe(antes.length);
  });
});

describe("validación", () => {
  it("rechaza sin nombre", async () => {
    const res = await enviar(mensajeValido({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("rechaza un email que no es email", async () => {
    const res = await enviar(mensajeValido({ email: "no-es-un-email" }));
    expect(res.status).toBe(400);
  });

  it("rechaza un mensaje vacío o de una palabra", async () => {
    // Si alguien se toma el trabajo de escribir, que diga algo. Un "hola" suelto
    // no deja al profesor con nada que responder.
    for (const message of ["", "   ", "hola"]) {
      const res = await enviar(mensajeValido({ message }));
      expect(res.status, `message=${JSON.stringify(message)}`).toBe(400);
    }
  });

  it("rechaza un mensaje larguísimo", async () => {
    const res = await enviar(mensajeValido({ message: "x".repeat(5001) }));
    expect(res.status).toBe(400);
  });

  it("rechaza un asunto que no está en la lista", async () => {
    // Los radios del formulario ofrecen opciones cerradas; aceptar texto libre
    // acá dejaría meter cualquier cosa en el asunto del email.
    const res = await enviar(mensajeValido({ subject: "cualquier cosa" }));
    expect(res.status).toBe(400);
  });

  it("rechaza campos de más", async () => {
    // Schema estricto: si el formulario cambia y manda algo nuevo, mejor que
    // falle acá que que llegue un campo sin validar al email.
    const res = await enviar(mensajeValido({ telefonoOculto: "123" }));
    expect(res.status).toBe(400);
  });

  it("acepta un teléfono opcional bien formado", async () => {
    const res = await enviar(mensajeValido({ phone: "+54 9 11 3336-5937" }));
    expect(res.status).toBe(200);
  });
});

describe("lo que llega al email del profesor", () => {
  it("va al mail del profesor y no a donde diga el visitante", async () => {
    await enviar(mensajeValido());

    expect(enviados).toHaveLength(1);
    // El destinatario lo decide el servidor. Si lo decidiera el cuerpo del
    // pedido, esto sería un relay de spam abierto.
    expect(enviados[0].to).toBeUndefined();
  });

  it("lleva el nombre, el email y el mensaje", async () => {
    await enviar(mensajeValido());

    const { name, email, message } = enviados[0];
    expect(name).toBe("Familia De Prueba");
    expect(email).toBe("familia@example.com");
    expect(message).toContain("Matemática");
  });

  it("recorta los espacios de los extremos", async () => {
    await enviar(mensajeValido({ name: "  Con Espacios  " }));

    expect(enviados[0].name).toBe("Con Espacios");
  });

  it("no deja que el nombre inyecte encabezados de correo", async () => {
    /* Un salto de línea en un campo que termina en el asunto permite cerrar ese
       encabezado y abrir otro: un Bcc, por ejemplo, y el servidor manda correo a
       terceros. Lo que hay que eliminar son los CARACTERES de control, no las
       palabras: sin CR ni LF, un "Bcc:" suelto es texto común dentro del asunto y
       ningún cliente de correo lo interpreta.
       Filtrar la palabra sería teatro —y rompería nombres legítimos que la
       contengan por casualidad—. */
    const res = await enviar(
      mensajeValido({ name: "Fulano\r\nBcc: otro@example.com" }),
    );

    expect(res.status).toBe(200);
    expect(enviados[0].name).not.toMatch(/[\r\n\t]/);
  });

  it("tampoco por el asunto: no se acepta texto libre ahí", async () => {
    // La otra mitad de la defensa. El asunto del email se arma con una etiqueta
    // de un catálogo cerrado, así que no hay nada que inyectar por ese lado.
    const res = await enviar(
      mensajeValido({ subject: "clases\r\nBcc: otro@example.com" }),
    );

    expect(res.status).toBe(400);
  });

  it("limpia los saltos del email también", async () => {
    const res = await enviar(
      mensajeValido({ email: "familia@example.com\r\nBcc: otro@example.com" }),
    );

    // Tras limpiar los saltos ya no es una dirección válida, así que se rechaza.
    expect(res.status).toBe(400);
  });

  it("conserva los saltos DENTRO del mensaje, que ahí no hacen daño", async () => {
    /* El cuerpo del mail no es un encabezado: los saltos son parte de lo que la
       persona escribió y sacarlos convertiría tres párrafos en un bloque. */
    await enviar(
      mensajeValido({ message: "Primer párrafo.\n\nSegundo párrafo con más." }),
    );

    expect(enviados[0].message).toContain("\n");
  });
});

describe("no ser un relay de spam", () => {
  it("rechaza si viene lleno el campo trampa", async () => {
    /* Un campo oculto que una persona nunca ve y que los bots completan porque
       rellenan todo lo que encuentran. Es la protección más barata que existe y
       no le pide nada al visitante: ni un captcha, ni resolver acertijos. */
    const res = await enviar(mensajeValido({ website: "http://spam.example" }));

    expect(res.status).toBe(400);
    expect(enviados).toHaveLength(0);
  });

  it("acepta el campo trampa vacío, que es como lo manda el formulario", async () => {
    const res = await enviar(mensajeValido({ website: "" }));

    expect(res.status).toBe(200);
  });

  it("no revela al bot que lo detectó por la trampa", async () => {
    // Si el mensaje dice "campo oculto", el próximo intento lo deja vacío.
    const res = await enviar(mensajeValido({ website: "http://spam.example" }));

    expect(res.body.message ?? "").not.toMatch(/oculto|trampa|honeypot|bot/i);
  });
});

describe("CORS del sitio institucional", () => {
  it("acepta el pedido desde tuprofesorparticular.com.ar sin configurar nada", async () => {
    /* El sitio institucional es un origen distinto al de la app de turnos, y su
       origen está en el código y no en una variable de entorno a propósito: si
       dependiera de CORS_ORIGIN en Render, el formulario quedaría roto en
       producción hasta que alguien se acuerde de actualizarla, y el síntoma
       sería un error de CORS en la consola de un visitante. */
    const res = await enviar(mensajeValido()).set(
      "Origin",
      "https://tuprofesorparticular.com.ar",
    );

    expect(res.status).toBe(200);
  });

  it("acepta también el subdominio de turnos", async () => {
    const res = await enviar(mensajeValido()).set(
      "Origin",
      "https://turnos.tuprofesorparticular.com.ar",
    );

    expect(res.status).toBe(200);
  });

  it("sigue rechazando un origen ajeno", async () => {
    const res = await enviar(mensajeValido()).set(
      "Origin",
      "https://sitio-ajeno.example",
    );

    expect(res.status).toBe(403);
  });
});
