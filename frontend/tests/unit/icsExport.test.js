import assert from "node:assert/strict";
import test from "node:test";
import { buildBookingIcsEvent, buildIcsContent } from "../../src/utils/icsExport.js";

/* El .ics que se descarga al reservar.

   Dos cosas estaban mal y las dos se notan recién cuando el archivo ya está en
   el calendario del alumno:

   1. No llevaba LOCATION. Quien reservaba Presencial abría el evento el día de
      la clase y no tenía la dirección: el celular no le ofrecía "cómo llegar".
   2. El SUMMARY decía "Clase con {studentName}". Está escrito desde la vereda
      del profesor —es su agenda—, pero el mismo builder alimenta el botón
      "Agregar al calendario" del comprobante. El alumno veía su propio nombre
      como si fuera con otra persona.

   El mismo módulo sirve a dos audiencias, así que ahora hay que decir cuál. */

const linea = (ics, campo) =>
  ics.split("\r\n").find((l) => l.startsWith(`${campo}:`))?.slice(campo.length + 1);

const turnoBase = (overrides = {}) => ({
  bookingCode: "ABC234",
  studentName: "Alumna De Prueba",
  subject: "Matemática",
  educationLevel: "Secundaria - 3er año",
  timeSlot: "2026-08-10T15:00:00.000Z",
  endTime: "2026-08-10T16:00:00.000Z",
  duration: 1,
  ...overrides,
});

test("incluye la dirección como LOCATION cuando la clase es presencial", () => {
  const ics = buildBookingIcsEvent(
    turnoBase({ modality: "presencial", location: "Jujuy 414, Temperley" }),
  );

  assert.equal(linea(ics, "LOCATION"), "Jujuy 414\\, Temperley");
});

test("no pone dirección en una clase online", () => {
  // Sería confuso: el alumno no tiene que ir a ningún lado.
  const ics = buildBookingIcsEvent(
    turnoBase({ modality: "online", location: "Jujuy 414, Temperley" }),
  );

  assert.equal(linea(ics, "LOCATION"), undefined);
});

test("marca la clase online como videollamada en la descripción", () => {
  const ics = buildBookingIcsEvent(turnoBase({ modality: "online" }));

  assert.match(ics, /Modalidad: Online/);
});

test("omite LOCATION si es presencial pero nadie pasó la dirección", () => {
  // Mejor sin el campo que con un "undefined" escrito en el calendario.
  const ics = buildBookingIcsEvent(turnoBase({ modality: "presencial" }));

  assert.equal(linea(ics, "LOCATION"), undefined);
});

test("escapa las comas de la dirección, que si no rompen el formato", () => {
  const ics = buildBookingIcsEvent(
    turnoBase({ modality: "presencial", location: "Jujuy 414, Temperley, Buenos Aires" }),
  );

  assert.equal(linea(ics, "LOCATION"), "Jujuy 414\\, Temperley\\, Buenos Aires");
});

test("para el profesor, el título nombra al alumno", () => {
  const ics = buildBookingIcsEvent(turnoBase(), { audience: "teacher" });

  assert.match(linea(ics, "SUMMARY"), /Alumna De Prueba/);
});

test("para el alumno, el título nombra la materia y al profesor", () => {
  const ics = buildBookingIcsEvent(turnoBase(), { audience: "student" });
  const summary = linea(ics, "SUMMARY");

  assert.match(summary, /Matemática/);
  assert.ok(!summary.includes("Alumna De Prueba"), "el alumno no debe verse a sí mismo como invitado");
});

test("la audiencia por defecto es el profesor, que es quien ya usaba el módulo", () => {
  // La agenda del panel llama sin opciones. Cambiar el default en silencio le
  // habría dado vuelta los títulos de toda su agenda.
  assert.equal(
    linea(buildBookingIcsEvent(turnoBase()), "SUMMARY"),
    linea(buildBookingIcsEvent(turnoBase(), { audience: "teacher" }), "SUMMARY"),
  );
});

test("lleva el código de reserva en la descripción para poder gestionarlo", () => {
  const ics = buildBookingIcsEvent(turnoBase(), { audience: "student" });

  assert.match(ics, /ABC234/);
});

test("un calendario con varios turnos mantiene un solo encabezado", () => {
  const ics = buildIcsContent([turnoBase(), turnoBase({ bookingCode: "XYZ789" })]);

  assert.equal(ics.match(/BEGIN:VCALENDAR/g).length, 1);
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
});

test("propaga la audiencia a todos los eventos del calendario", () => {
  const ics = buildIcsContent([turnoBase(), turnoBase({ bookingCode: "XYZ789" })], {
    audience: "student",
  });

  assert.ok(!ics.includes("Clase con Alumna De Prueba"));
});

/* ── Dos bugs que estaban desde antes y aparecieron al leer la salida real ──
   No se ven revisando el código: aparecen cuando uno abre el archivo generado.
   Los encontré interceptando el Blob del botón "Agregar al calendario". */

const BARRA = String.fromCharCode(92); // Un backslash, sin pelearme con escapes.

test("los saltos de línea de la descripción son un escape iCalendar válido", () => {
  // El bug: se unían los campos con el escape correcto (barra + n) y DESPUÉS se
  // pasaba todo por icsEscape, que duplica las barras. Salía barra-barra-n, que
  // iCalendar lee como una barra literal seguida de la letra n. En el calendario
  // del alumno la descripción quedaba en un solo renglón, con los separadores a
  // la vista en lugar de cortar.
  const ics = buildBookingIcsEvent(turnoBase());
  const description = linea(ics, "DESCRIPTION");

  assert.ok(
    !description.includes(`${BARRA}${BARRA}n`),
    `no debe llevar barra doble: ${description}`,
  );
  assert.ok(description.includes(`${BARRA}n`), "debe llevar el escape de salto de línea");
  // Alumno, Materia, Nivel y Código: turnoBase no trae modalidad ni notas.
  assert.equal(description.split(`${BARRA}n`).length, 4);
});

test("sigue escapando una barra que venga dentro de un dato", () => {
  // El arreglo no puede ser "dejar de escapar barras": si el objetivo que
  // escribe el alumno tiene una, hay que escaparla igual o el archivo se rompe.
  const ics = buildBookingIcsEvent(
    turnoBase({ academicSituation: `Tema: a${BARRA}b` }),
  );

  assert.ok(linea(ics, "DESCRIPTION").includes(`a${BARRA}${BARRA}b`));
});

test("fija el instante en UTC y no una hora flotante", () => {
  // Sin sufijo Z la hora es "flotante": significa 14:00 en la zona del
  // dispositivo, cualquiera sea. Y como toIcsDate usaba getHours() —la hora
  // local de QUIEN descarga—, el archivo salía distinto según desde dónde se
  // apretara el botón. Con UTC el instante es uno solo.
  const ics = buildBookingIcsEvent(turnoBase());

  assert.equal(linea(ics, "DTSTART"), "20260810T150000Z");
  assert.equal(linea(ics, "DTEND"), "20260810T160000Z");
});

test("calcula el final por duración cuando no viene endTime", () => {
  const ics = buildBookingIcsEvent(
    turnoBase({ endTime: undefined, duration: 1.5 }),
  );

  assert.equal(linea(ics, "DTEND"), "20260810T163000Z");
});
