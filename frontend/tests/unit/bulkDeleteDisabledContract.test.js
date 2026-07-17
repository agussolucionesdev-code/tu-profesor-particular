import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const source = (relativePath) => readFileSync(
  fileURLToPath(new URL(`../../src/${relativePath}`, import.meta.url)),
  "utf8",
);

test("admin UI exposes only audited per-booking deletion", () => {
  const api = source("api/bookingApi.js");
  const hook = source("hooks/useBookingsData.js");
  const view = source("components/admin/views/BookingsView.jsx");

  assert.doesNotMatch(api, /bookings\/all|deleteAllBookings/);
  assert.doesNotMatch(hook, /deleteAllBookings|apiDeleteAllBookings/);
  assert.doesNotMatch(view, /onDeleteAll|Limpiar base de prueba|Eliminar todo/);
  assert.match(view, /onDeleteBooking\(confirmDelete\.id\)/);
});
