import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyScheduleSaveError,
  parseLegacyBlockedDatesResponse,
  parseAdminScheduleResponse,
  validateScheduleDraft,
  serializeScheduleDraft,
} from "../../src/utils/availabilitySchedule.js";

test("classifies only exact revision codes as destructive conflicts", () => {
  assert.equal(classifyScheduleSaveError({ response: { status: 409, data: { code: "SCHEDULE_REVISION_CONFLICT" } } }).kind, "revision");
  assert.equal(classifyScheduleSaveError({ response: { status: 428, data: { code: "SCHEDULE_REVISION_REQUIRED" } } }).kind, "revision");
  assert.equal(classifyScheduleSaveError({ response: { status: 409, data: { code: "SLOT_DURATION_CHANGE_BLOCKED", message: "Hay reservas activas." } } }).kind, "retryable");
  assert.equal(classifyScheduleSaveError({ response: { status: 409, data: { code: "SCHEDULE_CHANGE_BUSY" } } }).kind, "retryable");
  assert.equal(classifyScheduleSaveError({ response: { status: 409, data: { code: "UNKNOWN" } } }).kind, "error");
});

test("accepts only private authenticated legacy full-day block records", () => {
  const parsed = parseLegacyBlockedDatesResponse({
    success: true,
    data: [{ date: "2026-08-01", reason: "Viaje" }],
  });
  assert.deepEqual(parsed, [{ date: "2026-08-01", reason: "Viaje" }]);
  assert.throws(() => parseLegacyBlockedDatesResponse({ data: [{ date: "bad", reason: "x" }] }));
  assert.throws(() => parseLegacyBlockedDatesResponse({ success: true, data: [{ date: "2026-08-01", reason: { private: true } }] }));
});

const interval = (start, end) => ({ start, end });

const validSchedule = () => ({
  revision: 4,
  openingHour: 7,
  closingHour: 22,
  advanceNoticeMinutes: 90,
  slotDurationMinutes: 30,
  timeZone: "America/Argentina/Buenos_Aires",
  activeWeekdays: [1, 2, 3, 4, 5, 6],
  availabilityPolicy: {
    source: "policy",
    weeklyAvailability: Object.fromEntries(
      Array.from({ length: 7 }, (_, day) => [String(day), {
        enabled: day !== 0,
        intervals: day === 0 ? [] : [interval("08:00", "12:00"), interval("14:00", "20:00")],
        excludedIntervals: day === 0 ? [] : [interval("10:00", "10:30")],
      }]),
    ),
    bufferBeforeMinutes: 30,
    bufferAfterMinutes: 30,
    minimumNoticeMinutes: 90,
    maximumAdvanceDays: 120,
    holidays: ["2026-07-20"],
    dateExceptions: [{
      date: "2026-07-21",
      closed: false,
      mode: "override",
      intervals: [interval("09:00", "13:00")],
      excludedIntervals: [interval("11:00", "11:30")],
    }],
    blockedIntervals: [{
      date: "2026-07-22",
      start: "16:00",
      end: "17:00",
      reason: "Reunión privada",
    }],
  },
});

test("accepts the exact aggregate admin schedule DTO without sharing server references", () => {
  const response = { success: true, data: validSchedule() };
  const parsed = parseAdminScheduleResponse(response);

  assert.equal(parsed.revision, 4);
  assert.equal(parsed.availabilityPolicy.weeklyAvailability["1"].intervals.length, 2);
  assert.equal(parsed.availabilityPolicy.blockedIntervals[0].reason, "Reunión privada");
  parsed.availabilityPolicy.holidays.push("2026-08-17");
  assert.deepEqual(response.data.availabilityPolicy.holidays, ["2026-07-20"]);
});

test("rejects malformed aggregate responses before they can enter component state", () => {
  const malformed = [
    null,
    {},
    { success: true, data: { ...validSchedule(), revision: -1 } },
    { success: true, data: { ...validSchedule(), timeZone: "UTC" } },
    { success: true, data: { ...validSchedule(), activeWeekdays: [1] } },
    { success: true, data: { ...validSchedule(), advanceNoticeMinutes: 30 } },
    { success: true, data: {
      ...validSchedule(),
      availabilityPolicy: {
        ...validSchedule().availabilityPolicy,
        weeklyAvailability: { "1": validSchedule().availabilityPolicy.weeklyAvailability["1"] },
      },
    } },
    { success: true, data: {
      ...validSchedule(),
      availabilityPolicy: {
        ...validSchedule().availabilityPolicy,
        blockedIntervals: [{ date: "bad-date", start: "10:00", end: "11:00", reason: "" }],
      },
    } },
  ];

  for (const response of malformed) {
    assert.throws(() => parseAdminScheduleResponse(response), /configuración horaria/i);
  }
});

test("matches backend interval, grid, buffer, exception and horizon validation", () => {
  const overlapping = validSchedule();
  overlapping.availabilityPolicy.weeklyAvailability["1"].intervals = [
    interval("08:00", "12:00"),
    interval("11:30", "13:00"),
  ];
  assert.equal(validateScheduleDraft(overlapping).valid, false);

  const offGrid = validSchedule();
  offGrid.availabilityPolicy.weeklyAvailability["1"].intervals = [interval("08:10", "12:00")];
  assert.equal(validateScheduleDraft(offGrid).valid, false);

  const invalidBuffer = validSchedule();
  invalidBuffer.availabilityPolicy.bufferBeforeMinutes = 15;
  assert.equal(validateScheduleDraft(invalidBuffer).valid, false);

  const duplicateException = validSchedule();
  duplicateException.availabilityPolicy.dateExceptions.push({
    ...duplicateException.availabilityPolicy.dateExceptions[0],
  });
  assert.equal(validateScheduleDraft(duplicateException).valid, false);

  const invalidHorizon = validSchedule();
  invalidHorizon.availabilityPolicy.maximumAdvanceDays = 731;
  assert.equal(validateScheduleDraft(invalidHorizon).valid, false);
});

test("serializes one complete schedule and derives duplicated legacy fields consistently", () => {
  const draft = validSchedule();
  draft.activeWeekdays = [0];
  draft.advanceNoticeMinutes = 0;
  draft.availabilityPolicy.holidays.push("2026-07-20");

  const serialized = serializeScheduleDraft(draft);

  assert.deepEqual(serialized.activeWeekdays, [1, 2, 3, 4, 5, 6]);
  assert.equal(serialized.advanceNoticeMinutes, 90);
  assert.deepEqual(serialized.availabilityPolicy.holidays, ["2026-07-20"]);
  assert.equal("revision" in serialized, false);
  assert.equal("source" in serialized.availabilityPolicy, false);
});
