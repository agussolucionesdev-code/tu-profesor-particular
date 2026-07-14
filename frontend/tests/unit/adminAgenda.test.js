import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADMIN_AGENDA_TIME_ZONE,
  buildAdminCreatePayload,
  buildAdminUpdatePayload,
  bookingScheduleChanged,
  businessDateKey,
  createAgendaRange,
  durationOptionsForSlotMinutes,
  parseAdminAvailabilityResponse,
  requiresAuthoritativeSlot,
} from "../../src/utils/adminAgenda.js";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const fullForm = {
  responsibleName: "Ada Lovelace",
  responsibleRelationship: "self",
  responsibleRelationshipOther: "",
  studentName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+54 9 11 5555 1212",
  school: "Instituto Analítico",
  educationLevel: "Secundario",
  yearGrade: "5.º año",
  subject: "Matemática",
  academicSituation: "Preparar el examen final",
  timeSlot: "2026-07-14T13:00:00.000Z",
  duration: "1.5",
  status: "Confirmado",
  price: "18000",
  notes: "Traer guía 4",
  studentEvolution: "No corresponde en el alta",
  emotionalState: "No corresponde en el alta",
  studentId: "must-never-leave-the-browser",
};

test("uses Buenos Aires as the only agenda business timezone", () => {
  assert.equal(ADMIN_AGENDA_TIME_ZONE, "America/Argentina/Buenos_Aires");
  assert.equal(
    businessDateKey(new Date("2026-07-14T02:30:00.000Z")),
    "2026-07-13",
  );
});

test("creates explicit day and Monday-to-Sunday week ranges from business date keys", () => {
  assert.deepEqual(createAgendaRange("2026-07-15", "day"), {
    fromDateKey: "2026-07-15",
    toDateKey: "2026-07-16",
  });
  assert.deepEqual(createAgendaRange("2026-07-15", "week"), {
    fromDateKey: "2026-07-13",
    toDateKey: "2026-07-20",
  });
});

test("derives every valid duration from the configured schedule grid up to ten hours", () => {
  assert.deepEqual(
    durationOptionsForSlotMinutes(45).slice(0, 4),
    [0.75, 1.5, 2.25, 3],
  );
  assert.equal(durationOptionsForSlotMinutes(45).at(-1), 9.75);
  assert.equal(durationOptionsForSlotMinutes(30).at(-1), 10);
  assert.equal(durationOptionsForSlotMinutes(5)[0], 0.5);
  assert.equal(Number.isSafeInteger(durationOptionsForSlotMinutes(5)[1] * 60), true);
  assert.throws(() => durationOptionsForSlotMinutes(0), /duración/i);
});

test("requires authoritative slots only for creation or an actual schedule change", () => {
  const original = { timeSlot: fullForm.timeSlot, duration: 1.5 };
  assert.equal(bookingScheduleChanged(fullForm, original), false);
  assert.equal(bookingScheduleChanged({ ...fullForm, notes: "Otra" }, original), false);
  assert.equal(bookingScheduleChanged({ ...fullForm, duration: 2.25 }, original), true);
  assert.equal(requiresAuthoritativeSlot({ mode: "create", scheduleDirty: false }), true);
  assert.equal(requiresAuthoritativeSlot({ mode: "edit", scheduleDirty: false }), false);
  assert.equal(requiresAuthoritativeSlot({ mode: "edit", scheduleDirty: true }), true);
});

test("accepts only the authoritative admin availability contract", () => {
  const parsed = parseAdminAvailabilityResponse({
    success: true,
    data: {
      timeZone: ADMIN_AGENDA_TIME_ZONE,
      range: {
        from: "2026-07-13T03:00:00.000Z",
        to: "2026-07-20T03:00:00.000Z",
        duration: 1,
      },
      slots: [
        {
          timeSlot: "2026-07-14T13:00:00.000Z",
          endTime: "2026-07-14T14:00:00.000Z",
          duration: 1,
        },
      ],
      excludedBookingId: null,
      schedule: {
        slotDurationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 15,
      },
    },
  });

  assert.equal(parsed.timeZone, ADMIN_AGENDA_TIME_ZONE);
  assert.equal(parsed.slots.length, 1);
  assert.throws(
    () => parseAdminAvailabilityResponse({ success: true, data: { ...parsed, timeZone: "UTC" } }),
    /disponibilidad/i,
  );
  assert.throws(
    () => parseAdminAvailabilityResponse({ success: true, data: { ...parsed, slots: undefined } }),
    /disponibilidad/i,
  );
});

test("whitelists a complete admin create payload and drops internal fields", () => {
  const payload = buildAdminCreatePayload(fullForm);

  assert.equal(payload.duration, 1.5);
  assert.equal(payload.price, 18000);
  assert.equal(payload.email, "ada@example.com");
  assert.equal("studentId" in payload, false);
  assert.equal("studentEvolution" in payload, false);
  assert.equal("emotionalState" in payload, false);
});

test("never sends identity, contact or responsible fields from an edit", () => {
  const payload = buildAdminUpdatePayload(fullForm);

  assert.deepEqual(Object.keys(payload).sort(), [
    "academicSituation",
    "duration",
    "educationLevel",
    "emotionalState",
    "notes",
    "price",
    "school",
    "status",
    "studentEvolution",
    "subject",
    "timeSlot",
    "yearGrade",
  ]);
  for (const forbidden of [
    "studentId",
    "studentName",
    "responsibleName",
    "responsibleRelationship",
    "responsibleRelationshipOther",
    "email",
    "phone",
  ]) {
    assert.equal(forbidden in payload, false);
  }
});

test("sends only changed edit fields so terminal bookings can update notes without rescheduling", () => {
  const original = {
    ...fullForm,
    duration: 1.5,
    price: 18000,
    status: "Finalizado",
    notes: "Anterior",
  };
  const payload = buildAdminUpdatePayload(
    { ...fullForm, status: "Finalizado", notes: "Seguimiento final" },
    original,
  );

  assert.deepEqual(payload, { notes: "Seguimiento final" });
});

test("unifies navigation under one Agenda view with an explicit Día/Semana switch", () => {
  const panel = readSource("../../src/components/AdminPanel.jsx");
  const agenda = readSource("../../src/components/admin/views/AgendaView.jsx");

  assert.doesNotMatch(panel, /CalendarView/);
  assert.doesNotMatch(panel, /id:\s*["']calendar["']/);
  assert.match(agenda, />\s*Día\s*</);
  assert.match(agenda, />\s*Semana\s*</);
  assert.match(agenda, /aria-pressed=/);
  assert.doesNotMatch(agenda, /window\.innerWidth/);
});

test("uses authenticated authoritative slots and idempotent admin creation", () => {
  const api = readSource("../../src/api/bookingApi.js");

  assert.match(api, /\/api\/bookings\/admin\/availability/);
  assert.match(api, /export const createAdminBooking/);
  assert.match(api, /Idempotency-Key|withIdempotencyKey/);
});

test("keeps the operational modal accessible and reports errors without alert()", () => {
  const modal = readSource("../../src/components/admin/AdminBookingModal.jsx");

  assert.match(modal, /useFocusTrap/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-busy=/);
  assert.match(modal, /role="alert"/);
  assert.match(modal, /aria-live=/);
  assert.doesNotMatch(modal, /\balert\s*\(/);
  assert.match(modal, /scheduleDirty/);
  assert.match(modal, /requiresVerifiedSlot/);
  assert.match(modal, /error\?\.response\?\.status === 409/);
});

test("keeps bookings visible on availability failure and opens creation on the active date", () => {
  const agenda = readSource("../../src/components/admin/views/AgendaView.jsx");

  assert.match(agenda, /initialDateKey:\s*anchorDateKey/);
  assert.match(agenda, /onRefreshBookings/);
  assert.match(agenda, /agenda-days-grid/);
  assert.doesNotMatch(agenda, /duration:\s*1[,\n]/);
});
