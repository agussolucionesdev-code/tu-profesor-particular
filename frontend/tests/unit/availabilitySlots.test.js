import assert from "node:assert/strict";
import test from "node:test";
import {
  getBusinessDateKey,
  selectSlotsForDate,
} from "../../src/utils/availabilitySlots.js";

const selectedDay = new Date("2026-07-13T00:00:00-03:00");

test("uses backend slots when the response includes the authoritative slots field", () => {
  const slots = selectSlotsForDate({
    selectedDate: selectedDay,
    backendSlots: [
      {
        timeSlot: "2026-07-13T13:00:00.000Z",
        endTime: "2026-07-13T14:00:00.000Z",
        duration: 1,
      },
    ],
    fallbackSlots: [
      { timeObj: new Date("2026-07-13T10:00:00-03:00"), isOccupied: false },
    ],
  });

  assert.equal(slots.length, 1);
  assert.equal(slots[0].source, "backend");
  assert.equal(slots[0].isOccupied, false);
  assert.equal(slots[0].timeObj.toISOString(), "2026-07-13T13:00:00.000Z");
});

test("retains the explicit legacy fallback only when slots are absent", () => {
  const fallbackSlots = [
    { timeObj: new Date("2026-07-13T10:00:00-03:00"), isOccupied: false },
  ];

  assert.equal(
    selectSlotsForDate({
      selectedDate: selectedDay,
      backendSlots: undefined,
      fallbackSlots,
    }),
    fallbackSlots,
  );
});

test("does not substitute hardcoded hours when the authoritative response has no slots", () => {
  assert.deepEqual(
    selectSlotsForDate({
      selectedDate: selectedDay,
      backendSlots: [],
      fallbackSlots: [
        { timeObj: new Date("2026-07-13T10:00:00-03:00"), isOccupied: false },
      ],
    }),
    [],
  );
});

test("groups slots by the configured Buenos Aires business date", () => {
  assert.equal(
    getBusinessDateKey(new Date("2026-07-14T02:30:00.000Z")),
    "2026-07-13",
  );
});
