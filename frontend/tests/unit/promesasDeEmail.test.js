import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

const sinComentarios = (fuente) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const fuentes = {
  "kioskWizard.js": leer("../../src/constants/kioskWizard.js"),
  "BookingKiosk.jsx": leer("../../src/components/BookingKiosk.jsx"),
  "BookingSuccessModal.jsx": leer("../../src/components/booking/BookingSuccessModal.jsx"),
  "BookingStepsShowcase.jsx": leer("../../src/components/home/BookingStepsShowcase.jsx"),
};

/* MIENTRAS EL CORREO NO ESTÉ CONFIGURADO, EL SITIO NO LO PROMETE.
 *
 * Verificado contra el servidor de producción el 2026-09-22, sin tocar secretos,
 * en `GET /ready`:
 *
 *   email: { configured: false, userConfigured: false, passwordConfigured: false,
 *            status: "unconfigured" }
 *
 * Faltan EMAIL_USER y EMAIL_PASS en Render. Hasta que estén, el servidor no puede
 * mandar un solo correo: ni el comprobante, ni el recordatorio, ni el enlace de la
 * videollamada. El sitio sí los prometía en cuatro lugares, y una promesa que el
 * sistema no puede cumplir es peor que no prometer nada: quien reserva una clase
 * online se queda esperando un enlace que nunca llega.
 *
 * CÓMO SE REVIERTE ESTO, que es el día que Agustín cargue las dos variables:
 *
 *   1. `curl https://tu-profesor-particular-backend.onrender.com/ready` tiene que
 *      decir `email.configured: true`.
 *   2. Se vuelven a poner las promesas de correo en los cuatro textos.
 *   3. Se borra este archivo.
 *
 * El aviso del paso 5 («Comprobante enviado a …») NO está acá y no hace falta
 * tocarlo: lo muestra sólo cuando el servidor confirma que el correo salió.
 */

const PROMESAS = [
  /enlace por email/i,
  /enlace de la videollamada por email/i,
  /te llegan? la confirmación/i,
  /si el correo tarda/i,
  /comprobante por (mail|email|correo)/i,
];

test("ningún texto del recorrido de reserva promete un correo", () => {
  for (const [archivo, fuente] of Object.entries(fuentes)) {
    for (const promesa of PROMESAS) {
      assert.doesNotMatch(
        sinComentarios(fuente),
        promesa,
        `${archivo} promete un correo que el servidor hoy no puede mandar: ${promesa}`,
      );
    }
  }
});

test("el campo de email sigue explicando para qué se pide", () => {
  /* Quitar la promesa no puede dejar el campo mudo: un dato que se pide sin decir
     para qué es el que la gente no completa. */
  assert.match(fuentes["BookingKiosk.jsx"], /kiosk-ayuda-email/);
  assert.match(fuentes["BookingKiosk.jsx"], /segundo contacto/);
});

test("ningún rincón del sitio promete un correo, tampoco fuera de src/", () => {
  /* ESTE TEST EXISTE PORQUE EL DE ARRIBA MIRABA CUATRO ARCHIVOS.
   *
   * Se llamaba «ningún texto del recorrido de reserva promete un correo» y
   * revisaba los cuatro lugares donde se había encontrado la promesa. La meta
   * descripción de `index.html` —lo que Google muestra debajo del enlace y lo
   * que aparece al compartir el sitio por WhatsApp— seguía diciendo «recibí el
   * comprobante por mail», con el correo sin configurar en producción.
   *
   * Un test que afirma una regla general y revisa casos puntuales da por
   * cerrado un problema abierto. Este barre todo `src/` y el `index.html`. */
  const raiz = new URL("../../src/", import.meta.url);
  const archivos = readdirSync(raiz, { recursive: true, encoding: "utf8" })
    .filter((r) => /\.(jsx?|html)$/.test(r))
    .map((r) => ["src/" + r.replace(/\\/g, "/"), sinComentarios(readFileSync(new URL(r, raiz), "utf8"))]);
  archivos.push(["index.html", leer("../../index.html").replace(/<!--[\s\S]*?-->/g, "")]);

  const hallazgos = [];
  for (const [archivo, fuente] of archivos) {
    for (const promesa of PROMESAS) {
      if (promesa.test(fuente)) hallazgos.push(`${archivo} → ${promesa}`);
    }
  }
  assert.deepEqual(hallazgos, [], `promesas de correo que siguen publicadas:\n  ${hallazgos.join("\n  ")}`);
});
