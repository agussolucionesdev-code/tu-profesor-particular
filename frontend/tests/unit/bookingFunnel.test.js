import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKING_FUNNEL_EVENT_NAMES,
  createBookingFunnelTracker,
} from "../../src/utils/bookingFunnel.js";

test("emits the complete anonymous funnel lifecycle with stage timing", () => {
  const events = [];
  let now = 1_000;
  const tracker = createBookingFunnelTracker({
    emit: (event) => events.push(event),
    now: () => now,
  });

  tracker.start(1);
  now = 2_250;
  tracker.stageChange(1, 2);
  now = 2_750;
  tracker.validationError(2, "objective_missing");
  now = 3_000;
  tracker.stageChange(2, 1);
  now = 4_000;
  tracker.stageChange(1, 2);
  now = 5_500;
  tracker.stageChange(2, 3);
  now = 8_000;
  tracker.complete(3);

  assert.deepEqual(
    events.map(({ name }) => name),
    [
      BOOKING_FUNNEL_EVENT_NAMES.START,
      BOOKING_FUNNEL_EVENT_NAMES.STAGE_ADVANCE,
      BOOKING_FUNNEL_EVENT_NAMES.VALIDATION_ERROR,
      BOOKING_FUNNEL_EVENT_NAMES.STAGE_BACK,
      BOOKING_FUNNEL_EVENT_NAMES.STAGE_ADVANCE,
      BOOKING_FUNNEL_EVENT_NAMES.STAGE_ADVANCE,
      BOOKING_FUNNEL_EVENT_NAMES.COMPLETION,
    ],
  );
  assert.equal(events[1].stageDurationMs, 1_250);
  assert.equal(events.at(-1).totalDurationMs, 7_000);
});

test("never includes personal or academic values in funnel payloads", () => {
  const events = [];
  const tracker = createBookingFunnelTracker({
    emit: (event) => events.push(event),
    now: () => 1_000,
  });

  tracker.start(1);
  tracker.validationError(1, "student_name_invalid", {
    studentName: "Dato privado",
    email: "private@example.com",
    phone: "+5491112345678",
    subject: "Materia privada",
  });
  tracker.abandon(1);

  const serialized = JSON.stringify(events);
  assert.doesNotMatch(serialized, /Dato privado|private@example\.com|5491112345678|Materia privada/);
  for (const event of events) {
    assert.deepEqual(
      Object.keys(event).sort(),
      Object.keys(event).filter((key) => [
        "name",
        "stage",
        "fromStage",
        "toStage",
        "reason",
        "stageDurationMs",
        "totalDurationMs",
      ].includes(key)).sort(),
    );
  }
});

test("emits abandonment only before completion", () => {
  const events = [];
  const tracker = createBookingFunnelTracker({
    emit: (event) => events.push(event),
    now: () => 2_000,
  });

  tracker.start(1);
  tracker.complete(3);
  tracker.abandon(3);

  assert.equal(
    events.filter(({ name }) => name === BOOKING_FUNNEL_EVENT_NAMES.ABANDONMENT).length,
    0,
  );
});
