export const BOOKING_FUNNEL_EVENT_NAMES = Object.freeze({
  START: "booking_funnel_start",
  STAGE_ADVANCE: "booking_stage_advance",
  STAGE_BACK: "booking_stage_back",
  VALIDATION_ERROR: "booking_validation_error",
  COMPLETION: "booking_completion",
  ABANDONMENT: "booking_abandonment",
});

const elapsed = (from, to) => Math.max(0, Math.round(to - from));

const safeReason = (reason) => {
  const normalized = String(reason ?? "validation_error")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 64);
  return normalized || "validation_error";
};

export const emitBookingFunnelEvent = (event) => {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(
      new CustomEvent("booking:funnel", { detail: { ...event } }),
    );
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: "booking_funnel", ...event });
    }
  } catch {
    // Analytics must never interrupt a booking.
  }
};

export const createBookingFunnelTracker = ({
  emit = emitBookingFunnelEvent,
  now = () => Date.now(),
} = {}) => {
  let startedAt = null;
  let stageStartedAt = null;
  let completed = false;
  let abandoned = false;

  const ensureStarted = (stage) => {
    if (startedAt !== null) return;
    const timestamp = now();
    startedAt = timestamp;
    stageStartedAt = timestamp;
    emit({ name: BOOKING_FUNNEL_EVENT_NAMES.START, stage });
  };

  return {
    start(stage = 1) {
      ensureStarted(stage);
    },
    stageChange(fromStage, toStage) {
      ensureStarted(fromStage);
      if (completed || abandoned || fromStage === toStage) return;
      const timestamp = now();
      emit({
        name:
          toStage > fromStage
            ? BOOKING_FUNNEL_EVENT_NAMES.STAGE_ADVANCE
            : BOOKING_FUNNEL_EVENT_NAMES.STAGE_BACK,
        stage: toStage,
        fromStage,
        toStage,
        stageDurationMs: elapsed(stageStartedAt, timestamp),
      });
      stageStartedAt = timestamp;
    },
    validationError(stage, reason) {
      ensureStarted(stage);
      if (completed || abandoned) return;
      emit({
        name: BOOKING_FUNNEL_EVENT_NAMES.VALIDATION_ERROR,
        stage,
        reason: safeReason(reason),
      });
    },
    complete(stage) {
      ensureStarted(stage);
      if (completed || abandoned) return;
      const timestamp = now();
      completed = true;
      emit({
        name: BOOKING_FUNNEL_EVENT_NAMES.COMPLETION,
        stage,
        stageDurationMs: elapsed(stageStartedAt, timestamp),
        totalDurationMs: elapsed(startedAt, timestamp),
      });
    },
    abandon(stage) {
      if (startedAt === null || completed || abandoned) return;
      const timestamp = now();
      abandoned = true;
      emit({
        name: BOOKING_FUNNEL_EVENT_NAMES.ABANDONMENT,
        stage,
        stageDurationMs: elapsed(stageStartedAt, timestamp),
        totalDurationMs: elapsed(startedAt, timestamp),
      });
    },
  };
};
