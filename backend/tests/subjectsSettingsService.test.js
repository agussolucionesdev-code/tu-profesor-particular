import { describe, expect, it } from "vitest";

import {
  SUBJECT_LEVELS,
  SubjectsSettingsValidationError,
  normalizeSubjectLabel,
  parseSubjectsSettingsPayload,
} from "../src/services/subjectsSettingsService.js";

const customPayload = (primarySubjects) => ({
  mode: "custom",
  levels: SUBJECT_LEVELS.map((level) => ({
    level,
    subjects: level === "Primaria" ? primarySubjects : [],
  })),
});

describe("subjects settings Unicode safety", () => {
  it("runs on a runtime that supports the required default-ignorable property", () => {
    expect(() => new RegExp("[\\p{Default_Ignorable_Code_Point}]", "u")).not.toThrow();
  });

  it.each([
    ["variation selector", "Matemática\uFE0F"],
    ["combining grapheme joiner", "Mate\u034Fmática"],
    ["lone high surrogate", "Matemática\uD800"],
  ])("rejects %s after NFKC", (_name, label) => {
    expect(normalizeSubjectLabel(label)).toBeNull();
    expect(() => parseSubjectsSettingsPayload(customPayload([label])))
      .toThrow(SubjectsSettingsValidationError);
  });

  it.each([
    ["Matemática", "Matemática\uFE0F"],
    ["Matemática", "Mate\u034Fmática"],
  ])("rejects visually duplicate labels containing default-ignorables", (visible, disguised) => {
    expect(() => parseSubjectsSettingsPayload(customPayload([visible, disguised])))
      .toThrow(SubjectsSettingsValidationError);
  });

  it("preserves a legitimate non-default-ignorable combining accent", () => {
    const label = "q\u0301";
    expect(normalizeSubjectLabel(label)).toBe(label.normalize("NFKC"));
    expect(parseSubjectsSettingsPayload(customPayload([label])).canonical.levels[0].subjects)
      .toEqual([label.normalize("NFKC")]);
  });
});
