import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const api = readSource("../../src/api/bookingApi.js");
const dataHook = readSource("../../src/hooks/useBookingsData.js");
const editHook = readSource("../../src/hooks/useBookingEditModal.js");
const modal = readSource("../../src/components/admin/BookingEditModal.jsx");

test("attendance uses the dedicated authenticated PATCH endpoint", () => {
  assert.match(api, /export const updateBookingAttendance/);
  assert.match(api, /apiClient\.patch\(`\/api\/bookings\/\$\{id\}\/attendance`/);
  assert.match(dataHook, /updateBookingAttendance/);
  assert.match(dataHook, /response\.data\.data/);
});

test("booking edit modal exposes the exact attendance statuses", () => {
  for (const status of [
    "Sin registrar",
    "Presente",
    "Ausente",
    "Cancelación tardía",
    "No-show",
    "Recuperatorio",
  ]) {
    assert.match(modal, new RegExp(`value="${status}"`));
  }

  assert.match(modal, /<label[^>]*htmlFor="edit-attendance-status"/);
  assert.match(modal, /id="edit-attendance-status"/);
  assert.match(modal, /id="edit-attendance-notes"/);
  assert.match(modal, /attendance-badge/);
});

test("attendance mutation reports honest accessible pending, error and success state", () => {
  assert.match(editHook, /attendanceSaving/);
  assert.match(editHook, /attendanceFeedback/);
  assert.match(editHook, /await updateBookingAttendance/);
  assert.match(modal, /aria-busy=\{attendanceSaving\}/);
  assert.match(modal, /disabled=\{attendanceSaving\}/);
  assert.match(modal, /role="status"/);
  assert.match(modal, /aria-live="polite"/);
});

test("saving attendance preserves an unsaved booking status selection", () => {
  assert.match(editHook, /setSelectedBooking\(\(current\)\s*=>/);
  assert.match(editHook, /status:\s*current\?\.status\s*\?\?\s*updatedBooking\.status/);
});
