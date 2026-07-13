import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const api = readSource("../../src/api/bookingApi.js");
const view = readSource("../../src/components/admin/views/BlockedDatesView.jsx");

test("blocked-date reasons are requested only with the current admin authorization", () => {
  assert.match(
    api,
    /export const fetchBlockedDates = \(authConfig\) =>\s*apiClient\.get\("\/api\/blocked-dates", authConfig\)/,
  );
  assert.match(view, /await fetchBlockedDates\(authConfig\)/);
});

test("blocked-date loading fails closed without stale private reasons", () => {
  const loadPath = view.slice(
    view.indexOf("const load"),
    view.indexOf("const getDatesInRange"),
  );

  assert.match(loadPath, /setBlockedDates\(\[\]\)[\s\S]*await fetchBlockedDates/);
  assert.match(loadPath, /catch \(err\)[\s\S]*setBlockedDates\(\[\]\)/);
  assert.match(loadPath, /err\?\.response\?\.status === 401/);
  assert.match(view, /role="alert"/);
});
