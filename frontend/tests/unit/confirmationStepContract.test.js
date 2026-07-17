import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Invariante: el CTA final de reserva no puede dispararse sin disponibilidad
// verificada. En el kiosco eso vive en `isReadyToSubmit`, que gatea el botón
// "Confirmar reserva".
const kioskSource = readFileSync(
  new URL("../../src/components/BookingKiosk.jsx", import.meta.url),
  "utf8",
);

test("gates the final booking CTA on verified availability", () => {
  const readyDefinition = kioskSource.match(
    /const isReadyToSubmit =([\s\S]*?);/,
  )?.[1];

  assert.ok(readyDefinition, "BookingKiosk debe definir isReadyToSubmit");
  assert.match(readyDefinition, /availabilityStatus === "ready"/);
  assert.match(readyDefinition, /isSelectedTimeVerified/);

  // El botón de confirmar queda deshabilitado si no hay disponibilidad lista.
  assert.match(
    kioskSource,
    /kiosk-confirm[\s\S]*?disabled=\{loading \|\| !isReadyToSubmit\}/,
  );
});
