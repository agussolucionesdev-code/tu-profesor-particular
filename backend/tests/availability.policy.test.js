import { describe, expect, it } from "vitest";
import {
  normalizeAvailabilityPolicy,
  resolveDateAvailabilityIntervals,
} from "../src/services/availabilityPolicy.js";

const legacy = {
  openingHour: 7,
  closingHour: 22,
  advanceNoticeMinutes: 60,
  slotDurationMinutes: 30,
  activeWeekdays: [1, 2, 3, 4, 5, 6],
};

const interval = (start, end) => ({ start, end });

const policyValue = (overrides = {}) => ({
  weeklyAvailability: Object.fromEntries(
    Array.from({ length: 7 }, (_, weekday) => [
      String(weekday),
      {
        enabled: weekday >= 1 && weekday <= 5,
        intervals: weekday >= 1 && weekday <= 5 ? [interval("09:00", "18:00")] : [],
        excludedIntervals: weekday >= 1 && weekday <= 5
          ? [interval("13:00", "14:00")]
          : [],
      },
    ]),
  ),
  bufferBeforeMinutes: 30,
  bufferAfterMinutes: 30,
  minimumNoticeMinutes: 120,
  maximumAdvanceDays: 60,
  holidays: [],
  dateExceptions: [],
  blockedIntervals: [],
  ...overrides,
});

describe("availability policy", () => {
  it("derives a backward-compatible policy from legacy schedule settings", () => {
    const policy = normalizeAvailabilityPolicy(null, legacy);

    expect(policy.source).toBe("legacy");
    expect(policy.weeklyAvailability[0]).toEqual({
      enabled: false,
      intervals: [],
      excludedIntervals: [],
    });
    expect(policy.weeklyAvailability[1].intervals).toEqual([
      interval("07:00", "22:00"),
    ]);
    expect(policy.minimumNoticeMinutes).toBe(60);
    expect(policy.bufferBeforeMinutes).toBe(0);
    expect(policy.bufferAfterMinutes).toBe(0);
  });

  it("rejects invalid, crossing and overlapping intervals", () => {
    expect(() => normalizeAvailabilityPolicy(policyValue({
      weeklyAvailability: {
        ...policyValue().weeklyAvailability,
        1: { enabled: true, intervals: [interval("18:00", "09:00")], excludedIntervals: [] },
      },
    }), legacy)).toThrow(/interval/i);

    expect(() => normalizeAvailabilityPolicy(policyValue({
      weeklyAvailability: {
        ...policyValue().weeklyAvailability,
        1: {
          enabled: true,
          intervals: [interval("09:00", "12:00"), interval("11:30", "14:00")],
          excludedIntervals: [],
        },
      },
    }), legacy)).toThrow(/superponen/i);

    expect(() => normalizeAvailabilityPolicy(policyValue({ bufferBeforeMinutes: 15 }), legacy))
      .toThrow(/múltiplo/i);

    expect(() => normalizeAvailabilityPolicy(policyValue({
      weeklyAvailability: {
        ...policyValue().weeklyAvailability,
        1: {
          enabled: true,
          intervals: [interval("09:15", "12:00")],
          excludedIntervals: [],
        },
      },
    }), legacy)).toThrow(/grilla/i);
  });

  it("subtracts weekly breaks and date-specific partial blocks", () => {
    const policy = normalizeAvailabilityPolicy(policyValue({
      blockedIntervals: [{ date: "2026-07-13", start: "16:00", end: "17:00", reason: "Reunión" }],
    }), legacy);

    expect(resolveDateAvailabilityIntervals("2026-07-13", policy)).toEqual([
      interval("09:00", "13:00"),
      interval("14:00", "16:00"),
      interval("17:00", "18:00"),
    ]);
  });

  it("supports holidays plus closed, override and additive date exceptions", () => {
    const policy = normalizeAvailabilityPolicy(policyValue({
      holidays: ["2026-07-13"],
      dateExceptions: [
        { date: "2026-07-14", closed: true, mode: "override", intervals: [], excludedIntervals: [] },
        { date: "2026-07-15", closed: false, mode: "override", intervals: [interval("10:00", "12:00")], excludedIntervals: [] },
        { date: "2026-07-18", closed: false, mode: "add", intervals: [interval("10:00", "12:00")], excludedIntervals: [] },
      ],
    }), legacy);

    expect(resolveDateAvailabilityIntervals("2026-07-13", policy)).toEqual([]);
    expect(resolveDateAvailabilityIntervals("2026-07-14", policy)).toEqual([]);
    expect(resolveDateAvailabilityIntervals("2026-07-15", policy)).toEqual([
      interval("10:00", "12:00"),
    ]);
    expect(resolveDateAvailabilityIntervals("2026-07-18", policy)).toEqual([
      interval("10:00", "12:00"),
    ]);
  });
});
