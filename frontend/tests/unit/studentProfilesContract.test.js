import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const api = readSource("../../src/api/bookingApi.js");
const panel = readSource("../../src/components/AdminPanel.jsx");
const view = readSource("../../src/components/admin/views/StudentsView.jsx");
const detail = readSource("../../src/components/admin/views/StudentDetailView.jsx");

test("student profiles use authenticated list and detail endpoints", () => {
  assert.match(api, /export const fetchStudents/);
  assert.match(api, /apiClient\.get\("\/api\/students"/);
  assert.match(api, /export const fetchStudentById/);
  assert.match(api, /apiClient\.get\(`\/api\/students\/\$\{encodeURIComponent\(id\)\}`/);
  assert.match(panel, /<StudentsView[\s\S]*authConfig=\{authConfig\}/);
});

test("students list is server-backed, paginated and restricted to active profiles", () => {
  assert.match(view, /fetchStudents/);
  assert.match(view, /scope:\s*"active"/);
  assert.match(view, /page:\s*requestedPage/);
  assert.match(view, /limit:\s*PAGE_SIZE/);
  assert.match(view, /aria-label="Paginación de alumnos"/);
  assert.match(view, /aria-busy=\{loading\}/);
});

test("feature-unavailable fallback is explicit and never silently merged", () => {
  assert.match(view, /isStudentFeatureUnavailable/);
  assert.match(view, /Perfil pendiente de migración/);
  assert.match(view, /Los perfiles reales todavía no están disponibles/);
  assert.doesNotMatch(view, /\[\.\.\.legacyStudents,\s*\.\.\.apiStudents\]/);
});

test("student detail is fetched by immutable student id and omits private booking fields", () => {
  assert.match(view, /fetchStudentById\(student\.id,\s*authConfig,\s*controller\.signal\)/);
  assert.match(detail, /recentBookings/);
  assert.doesNotMatch(detail, /studentEvolution/);
  assert.doesNotMatch(detail, /emotionalState/);
  assert.doesNotMatch(detail, /b\.notes/);
});

test("loading and failure states are accessible and retryable", () => {
  assert.match(view, /role="status"/);
  assert.match(view, /role="alert"/);
  assert.match(view, /Reintentar/);
  assert.match(view, /detailTriggerIdRef/);
  assert.match(view, /\.focus\(\)/);
});

test("detail focus enters the view and returns through a stable student id", () => {
  assert.match(detail, /backButtonRef/);
  assert.match(detail, /backButtonRef\.current\?\.focus\(\)/);
  assert.match(view, /detailTriggerIdRef/);
  assert.match(view, /data-student-trigger=\{studentKey\}/);
  assert.match(view, /element\.dataset\.studentTrigger === triggerId/);
  assert.doesNotMatch(view, /detailTriggerRef\.current\?\.focus/);
});

test("legacy fallback preserves academics, derives last booking and reports future activity", () => {
  assert.match(view, /buildStudentKey\(booking\) === student\.key/);
  assert.match(view, /lastBooking:/);
  assert.match(view, /student\.nextBooking \? "active" : "inactive"/);
  assert.match(detail, /school: legacyStudent\.school/);
  assert.match(detail, /educationLevel: legacyStudent\.educationLevel/);
  assert.match(detail, /yearGrade: legacyStudent\.yearGrade/);
});

test("adult self profiles use a human label instead of exposing the stored enum", () => {
  assert.match(detail, /studentType === "adult"/);
  assert.match(detail, /responsible\?\.relationship === "self"/);
  assert.match(detail, /Alumno mayor de edad/);
  assert.match(view, /profileResponsibleSummary/);
});

test("a stale student detail response cannot overwrite the current profile", () => {
  assert.match(view, /detailRequestSequence/);
  assert.match(view, /detailAbortController/);
  assert.match(view, /const sequence = \+\+detailRequestSequence\.current/);
  assert.match(view, /if \(sequence !== detailRequestSequence\.current\) return/);
  assert.match(view, /detailAbortController\.current\?\.abort\(\)/);
  assert.match(view, /controller\.signal/);
  assert.match(view, /setStudentDetail\(null\)/);
  assert.match(api, /fetchStudentById = \(id, authConfig, signal\)/);
});
