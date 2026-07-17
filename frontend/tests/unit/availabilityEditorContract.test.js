import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("admin availability uses one authenticated revisioned aggregate editor", () => {
  const api = readSource("../../src/api/bookingApi.js");
  const panel = readSource("../../src/components/AdminPanel.jsx");
  const editor = readSource("../../src/components/admin/views/AvailabilitySettingsView.jsx");
  const scheduleModel = readSource("../../src/utils/availabilitySchedule.js");
  const generic = readSource("../../src/components/admin/views/ScheduleSettingsView.jsx");

  assert.match(api, /fetchAdminSchedule = \(authConfig\)/);
  assert.match(api, /\/api\/settings\/admin\/schedule/);
  assert.match(api, /If-Match/);
  assert.match(panel, /AvailabilitySettingsView/);
  assert.doesNotMatch(panel, /<BlockedDatesView/);
  assert.doesNotMatch(generic, /schedule\.openingHour|schedule\.slotDurationMinutes/);

  assert.match(editor, /parseAdminScheduleResponse/);
  assert.match(editor, /serializeScheduleDraft/);
  assert.match(editor, /classifyScheduleSaveError/);
  assert.match(scheduleModel, /SCHEDULE_REVISION_CONFLICT/);
  assert.match(scheduleModel, /SCHEDULE_REVISION_REQUIRED/);
  assert.match(scheduleModel, /SLOT_DURATION_CHANGE_BLOCKED/);
  assert.match(scheduleModel, /SCHEDULE_CHANGE_BUSY/);
  assert.match(editor, /Recargar configuración/);
  assert.match(editor, /aria-live="polite"/);
  assert.match(editor, /aria-busy=/);
  assert.match(editor, /<fieldset/);
  assert.match(editor, /type="time"/);
  assert.match(editor, /type="date"/);
  assert.match(editor, /Motivo privado/);
  assert.match(editor, /Bloqueos anteriores/);
  assert.match(editor, /fetchBlockedDates\(authConfig\)/);
  assert.match(editor, /removeBlockedDate/);
  assert.match(editor, /Las nuevas excepciones se crean arriba/);
  assert.doesNotMatch(editor, /addBlockedDate/);
});

test("management-link E2E fixture matches the sanitized public availability contract", () => {
  const fixture = readSource("../e2e/management-link.spec.js");

  assert.match(fixture, /success:\s*true/);
  assert.match(fixture, /slotDurationMinutes:\s*30/);
  assert.match(fixture, /minimumNoticeMinutes:\s*0/);
  assert.match(fixture, /maximumAdvanceDays:/);
  assert.match(fixture, /range:\s*\{/);
  assert.match(fixture, /count:/);
  assert.match(fixture, /requestId:/);
  assert.doesNotMatch(fixture, /availabilityPolicy|reason:/);
});

test("public slot selection obeys the backend range instead of a hardcoded horizon", () => {
  const hook = readSource("../../src/hooks/useBookingAvailability.jsx");
  const kiosk = readSource("../../src/components/BookingKiosk.jsx");
  const reschedule = readSource("../../src/components/portal/RescheduleModal.jsx");

  // El hook deriva todo de la respuesta del backend, sin horizonte inventado.
  assert.match(hook, /parsePublicAvailabilityResponse/);
  assert.match(hook, /availabilityMaxDate/);
  assert.match(hook, /upcomingSlotsByDay/);

  // El kiosco ofrece turnos a partir de upcomingSlotsByDay (del backend),
  // nunca de un horizonte hardcodeado.
  assert.match(kiosk, /upcomingSlotsByDay/);
  assert.doesNotMatch(kiosk, /90 días|90 dias/);

  assert.match(reschedule, /parsePublicAvailabilityResponse/);
  assert.match(reschedule, /minDate=\{availabilityMinDate/);
  assert.match(reschedule, /maxDate=\{availabilityMaxDate\}/);
});
