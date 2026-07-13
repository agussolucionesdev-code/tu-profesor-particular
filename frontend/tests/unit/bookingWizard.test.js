import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKING_INITIAL_FORM_DATA,
  WIZARD_STEPS,
  isAcademicDraftComplete,
  toBookingApiAcademicSituation,
  updateBookingDraft,
} from "../../src/constants/bookingWizard.js";

test("exposes exactly three user-facing booking stages", () => {
  assert.deepEqual(
    WIZARD_STEPS.map(({ id, label }) => ({ id, label })),
    [
      { id: 1, label: "Tus datos" },
      { id: 2, label: "Necesidad académica" },
      { id: 3, label: "Tu turno" },
    ],
  );
});

test("requires an objective while keeping institution and comments optional", () => {
  const completeDraft = {
    educationLevel: "Secundaria",
    yearGrade: "3er año",
    subject: "Matemática",
    objective: "Preparar el examen de funciones",
    school: "",
    academicSituation: "",
  };

  assert.equal(isAcademicDraftComplete(completeDraft), true);
  assert.equal(
    isAcademicDraftComplete({ ...completeDraft, objective: "" }),
    false,
  );
});

test("preserves prior values while editing a later stage", () => {
  const draft = {
    ...BOOKING_INITIAL_FORM_DATA,
    studentName: "Alumno Prueba",
    phone: "+54 9 11-2222-3333",
    subject: "Física",
    objective: "Resolver cinemática",
  };
  const timeSlot = new Date("2026-08-10T15:00:00-03:00");

  const updated = updateBookingDraft(draft, { timeSlot, duration: 1 });

  assert.equal(updated.studentName, draft.studentName);
  assert.equal(updated.phone, draft.phone);
  assert.equal(updated.subject, draft.subject);
  assert.equal(updated.objective, draft.objective);
  assert.equal(updated.timeSlot, timeSlot);
  assert.equal(updated.duration, 1);
});

test("maps objective and optional comments into the legacy backend field", () => {
  assert.equal(
    toBookingApiAcademicSituation({
      objective: "Preparar el final",
      academicSituation: "Le cuesta geometría.",
    }),
    "Objetivo: Preparar el final\nComentarios: Le cuesta geometría.",
  );
  assert.equal(
    toBookingApiAcademicSituation({
      objective: "Preparar el final",
      academicSituation: "",
    }),
    "Objetivo: Preparar el final",
  );
});
