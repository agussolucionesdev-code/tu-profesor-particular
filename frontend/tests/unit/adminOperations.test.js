import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ariaSortValue,
  createSingleFlight,
  replaceBookingWithCanonical,
  runBulkOperation,
} from "../../src/utils/adminOperations.js";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const canonicalBooking = (overrides = {}) => ({
  _id: "booking-1",
  bookingCode: "ABC123",
  studentName: "Ada Lovelace",
  status: "Confirmado",
  timeSlot: "2026-07-14T14:30:00.000Z",
  endTime: "2026-07-14T15:30:00.000Z",
  duration: 1,
  version: 4,
  ...overrides,
});

test("single flight reuses the active request and allows a later refresh", async () => {
  const singleFlight = createSingleFlight();
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const task = () => {
    calls += 1;
    return pending;
  };

  const first = singleFlight.run(task);
  const second = singleFlight.run(task);

  assert.equal(first, second);
  assert.equal(calls, 1);
  release("ok");
  assert.equal(await first, "ok");

  assert.equal(await singleFlight.run(async () => "next"), "next");
  assert.equal(calls, 1);
});

test("bulk operations report every result and retain failed identifiers", async () => {
  const result = await runBulkOperation(["a", "b", "c"], async (id) => {
    if (id === "b") throw new Error("conflict");
    if (id === "c") return { ok: false, error: "not allowed" };
    return { ok: true };
  });

  assert.deepEqual(result.succeededIds, ["a"]);
  assert.deepEqual(result.failedIds, ["b", "c"]);
  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[1].error, "conflict");
  assert.equal(result.results[2].error, "not allowed");
});

test("sortable headers expose the active direction only", () => {
  assert.equal(ariaSortValue("status", "status", "asc"), "ascending");
  assert.equal(ariaSortValue("status", "status", "desc"), "descending");
  assert.equal(ariaSortValue("studentName", "status", "asc"), "none");
});

test("booking updates replace stale local data with the canonical backend booking", () => {
  const previous = [
    {
      _id: "booking-1",
      status: "Pendiente",
      endTime: "2026-07-14T14:00:00.000Z",
      version: 3,
      localOnly: "must disappear",
    },
    { _id: "booking-2", status: "Confirmado" },
  ];
  const canonical = canonicalBooking({
    endTime: "2026-07-14T15:30:00.000Z",
    auditRevision: "audit-4",
  });

  const next = replaceBookingWithCanonical(previous, "booking-1", canonical);

  assert.deepEqual(next[0], canonical);
  assert.equal("localOnly" in next[0], false);
  assert.equal(next[1], previous[1]);
  assert.notEqual(next, previous);
});

test("canonical booking replacement preserves the immutable id only when omitted", () => {
  const previous = [{ _id: "booking-1", status: "Pendiente" }];
  const canonicalWithoutId = canonicalBooking({ version: 2 });
  delete canonicalWithoutId._id;

  assert.deepEqual(
    replaceBookingWithCanonical(previous, "booking-1", canonicalWithoutId),
    [canonicalBooking({ version: 2 })],
  );

  assert.throws(
    () =>
      replaceBookingWithCanonical(previous, "booking-1", {
        ...canonicalBooking({ _id: "another-booking" }),
      }),
    /identificador/i,
  );
  assert.throws(
    () => replaceBookingWithCanonical(previous, "booking-1", null),
    /reserva canónica/i,
  );
  assert.deepEqual(previous, [{ _id: "booking-1", status: "Pendiente" }]);
});

test("canonical booking validation rejects empty, nested and partial DTOs", () => {
  const previous = [{ _id: "booking-1", status: "Pendiente" }];
  const invalidResponses = [
    {},
    { data: canonicalBooking() },
    canonicalBooking({ endTime: undefined }),
    canonicalBooking({ bookingCode: "" }),
    canonicalBooking({ studentName: 42 }),
    canonicalBooking({ status: null }),
    canonicalBooking({ timeSlot: "not-a-date" }),
    canonicalBooking({ endTime: {} }),
    canonicalBooking({ duration: 0 }),
    canonicalBooking({ duration: 0.25 }),
    canonicalBooking({ duration: 11 }),
    canonicalBooking({ duration: 60 }),
    canonicalBooking({ duration: "60" }),
    canonicalBooking({ status: "Aprobado" }),
    canonicalBooking({ status: "confirmado" }),
    canonicalBooking({
      endTime: "2026-07-14T14:30:00.000Z",
    }),
    canonicalBooking({
      endTime: "2026-07-14T14:00:00.000Z",
    }),
    canonicalBooking({ _id: null }),
    canonicalBooking({ _id: undefined }),
  ];

  for (const candidate of invalidResponses) {
    assert.throws(
      () => replaceBookingWithCanonical(previous, "booking-1", candidate),
      /reserva canónica/i,
    );
  }

  assert.deepEqual(previous, [{ _id: "booking-1", status: "Pendiente" }]);
});

test("canonical booking validation accepts legitimate date representations", () => {
  const previous = [{ _id: "booking-1", status: "Pendiente" }];
  const canonical = canonicalBooking({
    timeSlot: new Date("2026-07-14T14:30:00.000Z"),
    endTime: new Date("2026-07-14T15:30:00.000Z"),
    duration: 0.5,
  });

  assert.deepEqual(
    replaceBookingWithCanonical(previous, "booking-1", canonical),
    [canonical],
  );
});

test("canonical booking validation accepts every backend status and duration boundary", () => {
  const previous = [{ _id: "booking-1", status: "Pendiente" }];
  const statuses = ["Pendiente", "Confirmado", "Finalizado", "Cancelado"];

  for (const status of statuses) {
    const canonical = canonicalBooking({ status, duration: 10 });
    assert.deepEqual(
      replaceBookingWithCanonical(previous, "booking-1", canonical),
      [canonical],
    );
  }
});

test("admin edit keeps an accessible error path and commits only after the request succeeds", () => {
  const dataHook = readSource("../../src/hooks/useBookingsData.js");
  const editHook = readSource("../../src/hooks/useBookingEditModal.js");
  const modal = readSource("../../src/components/admin/BookingEditModal.jsx");
  const quickStatusMutation = dataHook.slice(
    dataHook.indexOf("const handleQuickStatusChange"),
    dataHook.indexOf("const updateBookingFields"),
  );
  const fieldUpdateMutation = dataHook.slice(
    dataHook.indexOf("const updateBookingFields"),
    dataHook.indexOf("const updateBookingAttendance"),
  );
  const editFailurePath = editHook.slice(
    editHook.indexOf("const handleSave"),
    editHook.indexOf("const closeEditBooking"),
  );

  assert.match(dataHook, /const response = await updateBooking/);
  assert.match(dataHook, /replaceBookingWithCanonical/);
  assert.match(quickStatusMutation, /const response = await updateBooking/);
  assert.match(quickStatusMutation, /replaceBookingWithCanonical/);
  assert.ok(
    quickStatusMutation.indexOf("normalizeCanonicalBooking") <
      quickStatusMutation.indexOf("setBookings"),
  );
  assert.ok(
    fieldUpdateMutation.indexOf("normalizeCanonicalBooking") <
      fieldUpdateMutation.indexOf("setBookings"),
  );
  assert.match(editHook, /editSaving/);
  assert.match(editHook, /editFeedback/);
  assert.doesNotMatch(editHook, /\balert\s*\(/);
  assert.match(modal, /aria-busy=\{editSaving\}/);
  assert.match(modal, /role=\{editFeedback\.type === "error" \? "alert" : "status"\}/);
  assert.match(modal, /disabled=\{attendanceSaving \|\| editSaving\}/);
  assert.doesNotMatch(editFailurePath, /catch[\s\S]*setSelectedBooking/);
  assert.doesNotMatch(editFailurePath, /catch[\s\S]*setEditNotes/);
  assert.doesNotMatch(editFailurePath, /catch[\s\S]*setEditEvolution/);
  assert.doesNotMatch(editFailurePath, /catch[\s\S]*setEditEmotionalState/);
});

test("admin UI exposes safe refresh and native keyboard sort controls", () => {
  const panel = readSource("../../src/components/AdminPanel.jsx");
  const bookingsView = readSource(
    "../../src/components/admin/views/BookingsView.jsx",
  );
  const dataHook = readSource("../../src/hooks/useBookingsData.js");

  assert.match(panel, />\s*Recargar\s*</);
  assert.match(panel, /pauseAutoRefresh/);
  assert.match(dataHook, /setInterval/);
  assert.match(dataHook, /createSingleFlight/);
  assert.match(bookingsView, /<button[^>]*className="sortable-header-btn"/);
  assert.match(bookingsView, /role="status"/);
  assert.match(bookingsView, /failedIds/);
});
