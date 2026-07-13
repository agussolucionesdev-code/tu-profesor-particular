import assert from "node:assert/strict";
import test from "node:test";
import {
  createIdempotencyKey,
  withIdempotencyKey,
} from "../../src/utils/idempotencyKey.js";

test("creates a non-empty idempotency key for an operation", () => {
  const key = createIdempotencyKey();

  assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("preserves management headers while adding Idempotency-Key", () => {
  const config = withIdempotencyKey("same-attempt-key", {
    headers: { "X-Booking-Manage-Token": "management-token" },
  });

  assert.deepEqual(config, {
    headers: {
      "X-Booking-Manage-Token": "management-token",
      "Idempotency-Key": "same-attempt-key",
    },
  });
});

