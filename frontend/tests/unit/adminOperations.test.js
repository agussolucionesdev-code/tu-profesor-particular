import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ariaSortValue,
  createSingleFlight,
  runBulkOperation,
} from "../../src/utils/adminOperations.js";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("single flight reuses the active request and allows a later refresh", async () => {
  const singleFlight = createSingleFlight();
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const task = () => {
    calls += 1;
    return pending;
  };

  const first = singleFlight.run(task);
  const second = singleFlight.run(task);

  assert.equal(first, second);
  assert.equal(calls, 1);
  release("ok");
  assert.equal(await first, "ok");

  assert.equal(await singleFlight.run(async () => "next"), "next");
  assert.equal(calls, 1);
});

test("bulk operations report every result and retain failed identifiers", async () => {
  const result = await runBulkOperation(["a", "b", "c"], async (id) => {
    if (id === "b") throw new Error("conflict");
    if (id === "c") return { ok: false, error: "not allowed" };
    return { ok: true };
  });

  assert.deepEqual(result.succeededIds, ["a"]);
  assert.deepEqual(result.failedIds, ["b", "c"]);
  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[1].error, "conflict");
  assert.equal(result.results[2].error, "not allowed");
});

test("sortable headers expose the active direction only", () => {
  assert.equal(ariaSortValue("status", "status", "asc"), "ascending");
  assert.equal(ariaSortValue("status", "status", "desc"), "descending");
  assert.equal(ariaSortValue("studentName", "status", "asc"), "none");
});

test("admin UI exposes safe refresh and native keyboard sort controls", () => {
  const panel = readSource("../../src/components/AdminPanel.jsx");
  const bookingsView = readSource(
    "../../src/components/admin/views/BookingsView.jsx",
  );
  const dataHook = readSource("../../src/hooks/useBookingsData.js");

  assert.match(panel, />\s*Recargar\s*</);
  assert.match(panel, /pauseAutoRefresh/);
  assert.match(dataHook, /setInterval/);
  assert.match(dataHook, /createSingleFlight/);
  assert.match(bookingsView, /<button[^>]*className="sortable-header-btn"/);
  assert.match(bookingsView, /role="status"/);
  assert.match(bookingsView, /failedIds/);
});
