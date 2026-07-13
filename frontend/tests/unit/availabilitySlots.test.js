import assert from "node:assert/strict";
import test from "node:test";
import {
  availabilityRequestParams,
  getBusinessDateKey,
  isSelectedTimeAvailable,
  isVerifiedAvailabilitySelection,
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

test("allows confirmation only for a selected time verified by a ready response", () => {
  const selectedTime = new Date("2026-07-13T13:00:00.000Z");
  const backendSlots = [{ timeSlot: "2026-07-13T13:00:00.000Z" }];

  assert.equal(isVerifiedAvailabilitySelection({
    availabilityStatus: "ready",
    selectedTime,
    backendSlots,
  }), true);
  assert.equal(isVerifiedAvailabilitySelection({
    availabilityStatus: "loading",
    selectedTime,
    backendSlots,
  }), false);
  assert.equal(isVerifiedAvailabilitySelection({
    availabilityStatus: "error",
    selectedTime,
    backendSlots,
  }), false);
});

test("does not invent legacy slots when the authoritative slots field is absent", () => {
  const fallbackSlots = [
    { timeObj: new Date("2026-07-13T10:00:00-03:00"), isOccupied: false },
  ];

  assert.deepEqual(
    selectSlotsForDate({
      selectedDate: selectedDay,
      backendSlots: undefined,
      fallbackSlots,
    }),
    [],
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

test("includes the selected class duration in an availability query", () => {
  assert.deepEqual(availabilityRequestParams(1.5), { duration: 1.5 });
  assert.deepEqual(availabilityRequestParams("2"), { duration: 2 });
});

test("keeps the legacy request shape until the learner selects a duration", () => {
  assert.equal(availabilityRequestParams(""), undefined);
  assert.equal(availabilityRequestParams(undefined), undefined);
});

test("clears a selected time unless authoritative duration-aware slots contain it", () => {
  const selectedTime = new Date("2026-07-13T13:30:00.000Z");
  const slotsForLongerClass = [
    { timeSlot: "2026-07-13T13:00:00.000Z" },
    { timeSlot: "2026-07-13T14:00:00.000Z" },
  ];

  assert.equal(
    isSelectedTimeAvailable({ selectedTime, backendSlots: slotsForLongerClass }),
    false,
  );
  assert.equal(
    isSelectedTimeAvailable({
      selectedTime: new Date("2026-07-13T14:00:00.000Z"),
      backendSlots: slotsForLongerClass,
    }),
    true,
  );
  assert.equal(
    isSelectedTimeAvailable({ selectedTime, backendSlots: undefined }),
    false,
  );
});
