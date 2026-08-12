import test from "node:test";
import assert from "node:assert/strict";
import { getSafeManagementUrl } from "../../src/utils/managementUrl.js";

test("accepts an absolute https management URL", () => {
  assert.equal(
    getSafeManagementUrl("https://turnos.tuprofesorparticular.com.ar/m#token=abc"),
    "https://turnos.tuprofesorparticular.com.ar/m#token=abc",
  );
});

test("resolves a relative management URL against the current origin", () => {
  assert.equal(
    getSafeManagementUrl("/m#token=abc", "https://turnos.example.com"),
    "https://turnos.example.com/m#token=abc",
  );
});

test("rejects malformed comma-concatenated origins", () => {
  assert.equal(
    getSafeManagementUrl(
      "https://turnos.example.com,https://www.example.com/m#token=abc",
    ),
    null,
  );
});

test("rejects script URLs and embedded credentials", () => {
  assert.equal(getSafeManagementUrl("javascript:alert(1)"), null);
  assert.equal(getSafeManagementUrl("https://user:secret@example.com/m"), null);
});
