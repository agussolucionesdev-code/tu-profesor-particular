import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bookingFormSource = readFileSync(
  new URL("../../src/components/BookingForm.jsx", import.meta.url),
  "utf8",
);

const confirmationCall = bookingFormSource.match(
  /<ConfirmationStep(?<props>[\s\S]*?)\/>/,
)?.groups?.props;

test("passes verified availability state to the final booking CTA", () => {
  assert.ok(confirmationCall, "BookingForm must render ConfirmationStep");
  assert.match(confirmationCall, /\bisConfirmationReady=/);
  assert.match(confirmationCall, /\bavailabilityStatus=/);
});
