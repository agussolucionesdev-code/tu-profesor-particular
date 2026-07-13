import assert from "node:assert/strict";
import test from "node:test";
import {
  createCalendarRange,
  parseCalendarSchedule,
} from "../../src/utils/calendarSchedule.js";

test("derives the visible calendar range from persisted schedule settings", () => {
  const schedule = parseCalendarSchedule({
    "schedule.openingHour": 9,
    "schedule.closingHour": 18,
  });

  assert.deepEqual(schedule, { openingHour: 9, closingHour: 18 });
  assert.deepEqual(createCalendarRange(schedule).hours, [9, 10, 11, 12, 13, 14, 15, 16, 17]);
});

test("keeps the calendar non-bookable when schedule settings are missing or invalid", () => {
  assert.equal(parseCalendarSchedule({}), null);
  assert.equal(parseCalendarSchedule(null), null);
  assert.equal(parseCalendarSchedule({
    "schedule.openingHour": 18,
    "schedule.closingHour": 9,
  }), null);
  assert.equal(createCalendarRange(null), null);
});
