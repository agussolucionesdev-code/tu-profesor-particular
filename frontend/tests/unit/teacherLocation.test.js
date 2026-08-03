import assert from "node:assert/strict";
import test from "node:test";
import {
  FALLBACK_TEACHER_LOCATION,
  parseTeacherLocation,
} from "../../src/constants/teacherLocation.js";

/* La ubicación llega del endpoint público de ajustes, pero el kiosco no puede
   quedar mudo si esa llamada falla: BookingKiosk la pide con un `.catch(() => {})`
   y seguir sin dirección era justamente el bug —quien elige Presencial reserva
   sin saber adónde ir—. Estos tests fijan que siempre haya algo usable y que
   nunca se renderice un `undefined`. */

test("el fallback trae una dirección y un mapa usables", () => {
  assert.ok(FALLBACK_TEACHER_LOCATION.address.includes("Temperley"));
  assert.match(FALLBACK_TEACHER_LOCATION.mapsUrl, /^https:\/\//);
});

test("lee las dos claves del endpoint público", () => {
  const location = parseTeacherLocation({
    "teacher.address": "Jujuy 414, Temperley",
    "teacher.mapsUrl": "https://maps.google.com/?q=Jujuy+414",
  });

  assert.equal(location.address, "Jujuy 414, Temperley");
  assert.equal(location.mapsUrl, "https://maps.google.com/?q=Jujuy+414");
});

test("cae en el fallback cuando el endpoint no responde", () => {
  // El `.catch(() => {})` del kiosco deja los ajustes en null. Sin fallback, el
  // paso 2 mostraría un hueco donde va la dirección.
  assert.deepEqual(parseTeacherLocation(null), FALLBACK_TEACHER_LOCATION);
  assert.deepEqual(parseTeacherLocation(undefined), FALLBACK_TEACHER_LOCATION);
  assert.deepEqual(parseTeacherLocation({}), FALLBACK_TEACHER_LOCATION);
});

test("ignora valores vacíos o en blanco en lugar de mostrarlos", () => {
  const location = parseTeacherLocation({
    "teacher.address": "   ",
    "teacher.mapsUrl": "",
  });

  assert.deepEqual(location, FALLBACK_TEACHER_LOCATION);
});

test("recorta los espacios alrededor del valor guardado", () => {
  const location = parseTeacherLocation({
    "teacher.address": "  Jujuy 414, Temperley  ",
  });

  assert.equal(location.address, "Jujuy 414, Temperley");
});

test("descarta un mapsUrl que no sea http(s)", () => {
  // El valor lo edita el profesor a mano desde el panel. Un `javascript:` acá
  // terminaría en un href, y ese href se renderiza en el comprobante.
  const location = parseTeacherLocation({
    "teacher.mapsUrl": "javascript:alert(1)",
  });

  assert.equal(location.mapsUrl, FALLBACK_TEACHER_LOCATION.mapsUrl);
});

test("acepta una dirección propia aunque el mapa venga mal", () => {
  // Los dos campos se evalúan por separado: que uno sea inválido no debe tirar
  // abajo el otro.
  const location = parseTeacherLocation({
    "teacher.address": "Avenida Siempre Viva 742, Temperley",
    "teacher.mapsUrl": "no-es-una-url",
  });

  assert.equal(location.address, "Avenida Siempre Viva 742, Temperley");
  assert.equal(location.mapsUrl, FALLBACK_TEACHER_LOCATION.mapsUrl);
});
