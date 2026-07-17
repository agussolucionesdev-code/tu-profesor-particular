import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeScheduler,
  registerPendingAuditReconciliationJob,
  stopRuntimeScheduler,
} from "../src/services/runtimeScheduler.js";

describe("runtime scheduler isolation", () => {
  it("registers durable pending-audit recovery for initial and periodic execution", async () => {
    const reconcile = vi.fn().mockResolvedValue({ scanned: 0 });
    const register = vi.fn();
    registerPendingAuditReconciliationJob({ scheduler: { register }, reconcile });
    expect(register).toHaveBeenCalledWith(expect.objectContaining({
      name: "pending booking audit reconciliation",
      expression: "* * * * *",
      task: reconcile,
      runInitially: true,
    }));
  });

  it("installs every cron even when each initial run fails", async () => {
    const handles = [];
    const schedule = vi.fn((_expression, callback) => {
      const handle = { stop: vi.fn(), callback };
      handles.push(handle);
      return handle;
    });
    const failing = vi.fn().mockRejectedValue(new Error("initial failure"));
    const scheduler = createRuntimeScheduler({ schedule, logger: { error: vi.fn(), log: vi.fn() } });
    await scheduler.register({ name: "a", expression: "* * * * *", task: failing, runInitially: true });
    await scheduler.register({ name: "b", expression: "*/5 * * * *", task: failing, runInitially: true });
    expect(schedule).toHaveBeenCalledTimes(2);
    await expect(handles[0].callback()).resolves.toBeUndefined();
  });

  it("registers every cron before launching non-blocking initial work", async () => {
    const events = [];
    let releaseSlow;
    const slow = vi.fn(() => new Promise((resolve) => {
      events.push("slow-started");
      releaseSlow = resolve;
    }));
    const fast = vi.fn(async () => { events.push("fast-started"); });
    const schedule = vi.fn((expression) => {
      events.push(`registered:${expression}`);
      return { stop: vi.fn() };
    });
    const scheduler = createRuntimeScheduler({ schedule, logger: { error: vi.fn(), log: vi.fn() } });
    await scheduler.register({ name: "smtp", expression: "smtp", task: slow, runInitially: true });
    await scheduler.register({ name: "outbox", expression: "outbox", task: fast, runInitially: true });

    const initial = scheduler.startInitialRuns();
    await vi.waitFor(() => expect(fast).toHaveBeenCalledOnce());
    expect(events.slice(0, 2)).toEqual(["registered:smtp", "registered:outbox"]);
    releaseSlow();
    await initial;
  });

  it("stops cron handles before waiting for active outbox work", async () => {
    const events = [];
    const handles = [{ stop: vi.fn(() => events.push("stopped")) }];
    const runner = { waitForIdle: vi.fn(async () => { events.push("drained"); return true; }) };
    await expect(stopRuntimeScheduler({ handles, outboxRunner: runner, timeoutMs: 1000 })).resolves.toBe(true);
    expect(events).toEqual(["stopped", "drained"]);
  });

  it("gates every registered job and drains all active promises after cron stops", async () => {
    const events = [];
    const handles = [];
    const schedule = vi.fn((_expression, callback) => {
      const handle = { stop: vi.fn(() => events.push("stopped")), callback };
      handles.push(handle);
      return handle;
    });
    const releases = [];
    const tasks = Array.from({ length: 7 }, (_, index) => vi.fn(() => new Promise((resolve) => {
      events.push(`started-${index}`);
      releases[index] = () => {
        events.push(`finished-${index}`);
        resolve();
      };
    })));
    const scheduler = createRuntimeScheduler({ schedule, logger: { error: vi.fn(), log: vi.fn() } });
    for (const [index, task] of tasks.entries()) {
      await scheduler.register({ name: `job-${index}`, expression: "* * * * *", task });
    }
    const running = handles.map((handle) => handle.callback());
    await vi.waitFor(() => expect(releases).toHaveLength(7));

    const stopping = stopRuntimeScheduler({ scheduler, timeoutMs: 1000 });
    await vi.waitFor(() => expect(handles.every((handle) => handle.stop.mock.calls.length === 1)).toBe(true));
    await Promise.all(handles.map((handle) => handle.callback()));
    expect(tasks.every((task) => task.mock.calls.length === 1)).toBe(true);
    releases.forEach((release) => release());

    await expect(stopping).resolves.toBe(true);
    await Promise.all(running);
    expect(events.slice(7, 14)).toEqual(Array(7).fill("stopped"));
  });
});
