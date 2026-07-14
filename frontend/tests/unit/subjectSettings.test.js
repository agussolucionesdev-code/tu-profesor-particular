import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SUBJECT_LEVELS,
  SubjectsValidationError,
  classifySubjectsSaveError,
  createSubjectEntry,
  moveSubjectEntry,
  normalizeSubjectLabel,
  parseAdminSubjectsResponse,
  parsePublicSubjectsByLevel,
  removeSubjectEntry,
  serializeSubjectsDraft,
  subjectDraftSnapshot,
  updateSubjectEntry,
} from "../../src/utils/subjectSettings.js";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const customResponse = (overrides = {}) => ({
  success: true,
  data: {
    revision: 4,
    mode: "custom",
    levels: SUBJECT_LEVELS.map((level, index) => ({
      level,
      subjects: index === 0 ? [" Matemática   Inicial "] : [],
    })),
    ...overrides,
  },
  requestId: "subjects-test",
});

test("parses the exact revisioned admin contract into stable client entries", () => {
  let nextId = 0;
  const parsed = parseAdminSubjectsResponse(
    customResponse(),
    () => `entry-${nextId += 1}`,
  );

  assert.equal(parsed.revision, 4);
  assert.equal(parsed.mode, "custom");
  assert.deepEqual(parsed.levels.map(({ level }) => level), SUBJECT_LEVELS);
  assert.deepEqual(parsed.levels[0].subjects, [
    { id: "entry-1", label: "Matemática Inicial" },
  ]);
});

test("accepts the canonical empty default and rejects malformed admin responses", () => {
  const parsed = parseAdminSubjectsResponse({
    success: true,
    data: {
      revision: 0,
      mode: "default",
      levels: SUBJECT_LEVELS.map((level) => ({ level, subjects: [] })),
    },
  });
  assert.equal(parsed.mode, "default");

  const malformed = [
    null,
    { success: false, data: parsed },
    customResponse({ revision: -1 }),
    customResponse({ mode: "other" }),
    customResponse({ levels: customResponse().data.levels.slice(0, 4) }),
    customResponse({ levels: customResponse().data.levels.map((entry, index) =>
      index === 0 ? { ...entry, subjects: "Matemática" } : entry) }),
    customResponse({ levels: customResponse().data.levels.map((entry, index) =>
      index === 0 ? { ...entry, extra: true } : entry) }),
  ];
  malformed.forEach((body) => assert.throws(
    () => parseAdminSubjectsResponse(body),
    SubjectsValidationError,
  ));
});

test("normalizes labels and rejects duplicates, caps and empty custom catalogs", () => {
  const draft = parseAdminSubjectsResponse(customResponse());
  const primary = draft.levels[0];
  let changed = updateSubjectEntry(
    draft,
    primary.level,
    primary.subjects[0].id,
    "  MATEMÁTICA\u00a0INICIAL  ",
  );
  changed = createSubjectEntry(changed, primary.level, () => "duplicate");
  changed = updateSubjectEntry(changed, primary.level, "duplicate", "matemática inicial");
  assert.throws(() => serializeSubjectsDraft(changed), /repetida/i);

  const emptyCustom = {
    revision: 0,
    mode: "custom",
    levels: SUBJECT_LEVELS.map((level) => ({ level, subjects: [] })),
  };
  assert.throws(() => serializeSubjectsDraft(emptyCustom), /entre 1 y 300/i);

  const tooMany = {
    ...emptyCustom,
    levels: emptyCustom.levels.map((entry, index) => index === 0
      ? {
          ...entry,
          subjects: Array.from({ length: 81 }, (_, subject) => ({
            id: `subject-${subject}`,
            label: `Materia ${subject}`,
          })),
        }
      : entry),
  };
  assert.throws(() => serializeSubjectsDraft(tooMany), /hasta 80/i);

  const tooLong = parseAdminSubjectsResponse(customResponse());
  const first = tooLong.levels[0].subjects[0];
  assert.throws(
    () => serializeSubjectsDraft(updateSubjectEntry(
      tooLong,
      tooLong.levels[0].level,
      first.id,
      "M".repeat(81),
    )),
    /hasta 80/i,
  );
});

test("rejects controls, surrogates and default-ignorable Unicode after NFKC", () => {
  const unsafeLabels = [
    "Mate\u0000mática",
    "Mate\u200Bmática",
    "Matemática\u202E",
    "Matemática\uFE0F",
    "Mate\u034Fmática",
    "Mate\uD800mática",
  ];
  const publicBase = Object.fromEntries(SUBJECT_LEVELS.map((level) => [level, []]));

  for (const label of unsafeLabels) {
    assert.equal(normalizeSubjectLabel(label), null);
    assert.throws(
      () => parseAdminSubjectsResponse(customResponse({
        levels: customResponse().data.levels.map((entry, index) =>
          index === 0 ? { ...entry, subjects: [label] } : entry),
      })),
      SubjectsValidationError,
    );
    assert.equal(parsePublicSubjectsByLevel({ ...publicBase, Primaria: [label] }), null);
  }
});

test("detects duplicate pairs only after NFKC, whitespace and case normalization", () => {
  const duplicatePairs = [
    ["Ａlgebra", "algebra"],
    ["① Tema", "1 tema"],
    [" Matemática\u00a0Inicial ", "matemática inicial"],
  ];
  for (const subjects of duplicatePairs) {
    assert.throws(
      () => parseAdminSubjectsResponse(customResponse({
        levels: customResponse().data.levels.map((entry, index) =>
          index === 0 ? { ...entry, subjects } : entry),
      })),
      /repetida/i,
    );
  }
});

test("serializes custom order, strips client ids and supports default mode", () => {
  const draft = parseAdminSubjectsResponse(customResponse());
  const primary = draft.levels[0];
  let changed = createSubjectEntry(draft, primary.level, () => "second");
  changed = updateSubjectEntry(changed, primary.level, "second", "Lengua");
  changed = moveSubjectEntry(changed, primary.level, "second", -1);

  assert.deepEqual(serializeSubjectsDraft(changed), {
    mode: "custom",
    levels: SUBJECT_LEVELS.map((level, index) => ({
      level,
      subjects: index === 0 ? ["Lengua", "Matemática Inicial"] : [],
    })),
  });
  assert.deepEqual(
    serializeSubjectsDraft({ ...changed, mode: "default" }),
    { mode: "default" },
  );
});

test("add, update, remove and reorder are immutable and snapshots ignore client ids", () => {
  const original = parseAdminSubjectsResponse(customResponse());
  const primary = original.levels[0];
  let changed = createSubjectEntry(original, primary.level, () => "new-entry");
  changed = updateSubjectEntry(changed, primary.level, "new-entry", "Lengua");
  changed = moveSubjectEntry(changed, primary.level, "new-entry", -1);

  assert.deepEqual(original.levels[0].subjects.map(({ label }) => label), ["Matemática Inicial"]);
  assert.deepEqual(changed.levels[0].subjects.map(({ label }) => label), ["Lengua", "Matemática Inicial"]);
  assert.deepEqual(
    subjectDraftSnapshot(changed),
    subjectDraftSnapshot({
      ...changed,
      levels: changed.levels.map((entry) => ({
        ...entry,
        subjects: entry.subjects.map((subject) => ({ ...subject, id: `other-${subject.id}` })),
      })),
    }),
  );
  assert.equal(removeSubjectEntry(changed, primary.level, "new-entry").levels[0].subjects.length, 1);
  assert.deepEqual(subjectDraftSnapshot({ ...changed, mode: "default" }), { mode: "default" });
});

test("strictly parses public overrides and otherwise falls back to embedded suggestions", () => {
  const valid = Object.fromEntries(SUBJECT_LEVELS.map((level, index) => [
    level,
    index === 0 ? [" Matemática   Inicial "] : [],
  ]));
  assert.deepEqual(parsePublicSubjectsByLevel(valid), {
    ...valid,
    Primaria: ["Matemática Inicial"],
  });
  assert.equal(parsePublicSubjectsByLevel(null), null);
  assert.equal(parsePublicSubjectsByLevel({ Primaria: ["Matemática"] }), null);
  assert.equal(parsePublicSubjectsByLevel({ ...valid, Primaria: "Matemática" }), null);
  assert.equal(parsePublicSubjectsByLevel({ ...valid, Primaria: ["", "Matemática"] }), null);
});

test("classifies only the two exact subject revision codes as destructive conflicts", () => {
  for (const code of ["SUBJECTS_REVISION_REQUIRED", "SUBJECTS_REVISION_CONFLICT"]) {
    assert.equal(classifySubjectsSaveError({ response: { data: { code } } }).kind, "revision");
  }
  assert.equal(classifySubjectsSaveError({ response: { status: 409, data: {} } }).kind, "error");
  assert.equal(classifySubjectsSaveError({
    response: { data: { code: "SCHEDULE_REVISION_CONFLICT" } },
  }).kind, "error");
});

test("wires an accessible revisioned visual editor without raw JSON", () => {
  const api = readSource("../../src/api/bookingApi.js");
  const settings = readSource("../../src/components/admin/views/ScheduleSettingsView.jsx");
  const editor = readSource("../../src/components/admin/views/SubjectSettingsEditor.jsx");
  const model = readSource("../../src/utils/subjectSettings.js");
  const booking = readSource("../../src/components/BookingForm.jsx");

  assert.match(api, /fetchAdminSubjects/);
  assert.match(api, /\/api\/settings\/admin\/subjects/);
  assert.match(api, /If-Match/);
  assert.match(api, /`"\$\{revision\}"`/);
  assert.match(settings, /SubjectSettingsEditor/);
  assert.doesNotMatch(settings, /Materias por nivel \(JSON\)|booking\.subjectsByLevel/);
  assert.match(editor, /<fieldset/);
  assert.match(editor, /<ol/);
  assert.match(editor, /Subir/);
  assert.match(editor, /Bajar/);
  assert.match(editor, /Eliminar/);
  assert.match(editor, /Agregar materia/);
  assert.match(editor, /aria-live="polite"/);
  assert.match(editor, /subjects-row-error/);
  assert.match(editor, /aria-invalid=/);
  assert.match(editor, /aria-describedby=/);
  assert.match(editor, /focusById\(validationError\.fieldId\)/);
  assert.match(editor, /Recargar y descartar mis cambios/);
  assert.match(model, /SUBJECTS_REVISION_CONFLICT/);
  assert.match(model, /SUBJECTS_REVISION_REQUIRED/);
  assert.match(booking, /parsePublicSubjectsByLevel/);
  assert.match(booking, /setSubjectsByLevelOverride\(parsedSubjects\)/);
});
