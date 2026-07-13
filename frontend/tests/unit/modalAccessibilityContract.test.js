import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const successModal = readSource(
  "../../src/components/booking/BookingSuccessModal.jsx",
);
const rescheduleModal = readSource(
  "../../src/components/portal/RescheduleModal.jsx",
);
const cancelModal = readSource("../../src/components/portal/CancelModal.jsx");
const focusTrap = readSource("../../src/hooks/useFocusTrap.js");

test("all management dialogs reuse the shared focus trap", () => {
  for (const source of [successModal, rescheduleModal, cancelModal]) {
    assert.match(source, /import\s+\{\s*useFocusTrap\s*\}/);
    assert.match(source, /useFocusTrap\(/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-labelledby=/);
  }

  assert.match(focusTrap, /triggerRef\.current\s*=\s*document\.activeElement/);
  assert.match(focusTrap, /triggerRef\.current\.focus\(\)/);
  assert.match(focusTrap, /e\.shiftKey/);
  assert.match(focusTrap, /last\.focus\(\)/);
  assert.match(focusTrap, /first\.focus\(\)/);
});

test("dialog overlays never hide their accessible dialog descendants", () => {
  for (const source of [successModal, rescheduleModal, cancelModal]) {
    assert.doesNotMatch(source, /className="[^"]*-overlay"[^>]*aria-hidden=/);
  }
});

test("destructive dialogs block dismissal while their mutation is pending", () => {
  for (const source of [rescheduleModal, cancelModal]) {
    assert.match(source, /isSubmitting/);
    assert.match(source, /e\.key === "Escape"\s*&&\s*!isSubmitting/);
    assert.match(source, /aria-busy=\{isSubmitting\}/);
    assert.match(source, /disabled=\{isSubmitting/);
  }
});

test("dialogs associate explanatory and live feedback with their accessible name", () => {
  assert.match(successModal, /aria-describedby="booking-success-feedback"/);
  assert.match(successModal, /id="booking-success-feedback"/);
  assert.match(rescheduleModal, /aria-describedby="reschedule-feedback"/);
  assert.match(rescheduleModal, /id="reschedule-feedback"/);
  assert.match(cancelModal, /aria-describedby="cancel-description"/);
  assert.match(cancelModal, /id="cancel-description"/);
});
