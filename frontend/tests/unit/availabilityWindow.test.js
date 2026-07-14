import assert from "node:assert/strict";
import test from "node:test";
import { parsePublicAvailabilityResponse } from "../../src/utils/availabilitySlots.js";

const response = () => ({
  success: true,
  data: [],
  blockedDates: ["2026-07-20"],
  slots: [{
    timeSlot: "2026-07-14T13:00:00.000Z",
    endTime: "2026-07-14T14:00:00.000Z",
    duration: 1,
  }],
  schedule: {
    timeZone: "America/Argentina/Buenos_Aires",
    slotDurationMinutes: 30,
    minimumNoticeMinutes: 60,
    maximumAdvanceDays: 45,
  },
  range: {
    from: "2026-07-13T03:00:00.000Z",
    to: "2026-10-11T02:59:59.999Z",
  },
});

test("derives a fail-closed public calendar window from backend range and horizon", () => {
  const parsed = parsePublicAvailabilityResponse(response(), new Date("2026-07-13T15:00:00.000Z"));

  assert.equal(parsed.schedule.maximumAdvanceDays, 45);
  assert.equal(parsed.maxDate.toISOString().slice(0, 10), "2026-08-27");
  assert.equal(parsed.rangeLabel, "los próximos 45 días");
  assert.deepEqual(parsed.blockedDates, ["2026-07-20"]);
});

test("caps navigation at the returned range when it is shorter than the configured horizon", () => {
  const value = response();
  value.schedule.maximumAdvanceDays = 120;
  value.range.to = "2026-08-01T02:59:59.999Z";
  const parsed = parsePublicAvailabilityResponse(value, new Date("2026-07-13T15:00:00.000Z"));

  assert.equal(parsed.maxDate.toISOString().slice(0, 10), "2026-07-31");
  assert.equal(parsed.rangeLabel, "el período habilitado hasta el 31/07/2026");
});

test("rejects malformed availability before exposing slots or private state", () => {
  for (const malformed of [
    {},
    { ...response(), slots: undefined },
    { ...response(), range: { from: "bad", to: "bad" } },
    { ...response(), schedule: { ...response().schedule, maximumAdvanceDays: 0 } },
    { ...response(), blockedDates: [{ date: "2026-07-20", reason: "private" }] },
    { ...response(), data: [{ studentName: "No debe exponerse" }] },
  ]) {
    assert.throws(
      () => parsePublicAvailabilityResponse(malformed),
      /disponibilidad/i,
    );
  }
});
