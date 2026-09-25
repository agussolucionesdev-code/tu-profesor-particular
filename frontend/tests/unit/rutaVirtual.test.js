import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BOOKING_FUNNEL_EVENT_NAMES as EVENTOS } from "../../src/utils/bookingFunnel.js";
import { rutaVirtual } from "../../src/utils/rutaVirtual.js";

/* El embudo del kiosco se mide como páginas virtuales (ver src/utils/rutaVirtual.js). */

test("cada paso es una página, el primero es /reservar", () => {
  assert.equal(rutaVirtual({ name: EVENTOS.STAGE_ADVANCE, fromStage: 1, toStage: 2 }), "/reservar/paso-2");
  assert.equal(rutaVirtual({ name: EVENTOS.STAGE_ADVANCE, fromStage: 3, toStage: 4 }), "/reservar/paso-4");
  assert.equal(rutaVirtual({ name: EVENTOS.STAGE_BACK, fromStage: 2, toStage: 1 }), "/reservar");
});

test("la reserva hecha es su propia página", () => {
  assert.equal(rutaVirtual({ name: EVENTOS.COMPLETION, stage: 5 }), "/reservar/confirmada");
});

test("lo que no cambia de paso no cuenta como página", () => {
  assert.equal(rutaVirtual({ name: EVENTOS.START, stage: 1 }), null);
  assert.equal(rutaVirtual({ name: EVENTOS.VALIDATION_ERROR, stage: 2, reason: "x" }), null);
  assert.equal(rutaVirtual({ name: EVENTOS.ABANDONMENT, stage: 3 }), null);
  assert.equal(rutaVirtual(undefined), null);
});

test("la app mide con el componente que escucha al embudo", () => {
  const app = readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /<AnaliticaDeTurnos \/>/);
  assert.doesNotMatch(app, /<Analytics \/>/, "el <Analytics /> suelto contaría dos veces");
});
