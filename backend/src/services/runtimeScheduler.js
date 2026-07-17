import cron from "node-cron";

const readiness = {
  required: false,
  registrationsComplete: false,
  registeredJobs: 0,
};

export const getRuntimeSchedulerHealth = () => ({ ...readiness });

export const registerPendingAuditReconciliationJob = ({ scheduler, reconcile }) =>
  scheduler.register({
    name: "pending booking audit reconciliation",
    expression: "* * * * *",
    task: reconcile,
    runInitially: true,
  });

export const createRuntimeScheduler = ({
  schedule = cron.schedule,
  logger = console,
  trackReadiness = false,
} = {}) => {
  const handles = [];
  const active = new Set();
  const initialTasks = [];
  let stopped = false;
  if (trackReadiness) {
    readiness.required = true;
    readiness.registrationsComplete = false;
    readiness.registeredJobs = 0;
  }
  const register = ({ name, expression, task, options, runInitially = false }) => {
    const safeTask = () => {
      if (stopped) return Promise.resolve();
      const execution = (async () => {
        try {
          await task();
        } catch (error) {
          logger.error(`RUNTIME: ${name} failed: ${error.message}`);
        }
      })();
      active.add(execution);
      execution.finally(() => active.delete(execution));
      return execution;
    };
    // Registration and eager execution are deliberately separate phases.
    // Otherwise a slow SMTP probe can prevent every later cron from existing.
    handles.push(schedule(expression, safeTask, options));
    if (runInitially) initialTasks.push(safeTask);
    if (trackReadiness) readiness.registeredJobs = handles.length;
    logger.log(`RUNTIME: ${name} scheduled (${expression}).`);
    return safeTask;
  };
  const markRegistrationsComplete = () => {
    if (trackReadiness) readiness.registrationsComplete = true;
  };
  const startInitialRuns = () => {
    markRegistrationsComplete();
    return Promise.allSettled(initialTasks.map((task) => task()));
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const handle of handles) {
      try {
        handle?.stop?.();
      } catch (error) {
        logger.error(`RUNTIME: cron stop failed: ${error.message}`);
      }
    }
  };
  const waitForIdle = async ({ timeoutMs = 25_000 } = {}) => {
    if (!active.size) return true;
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), Math.max(1, timeoutMs));
      timer.unref?.();
    });
    const drained = Promise.allSettled([...active]).then(() => true);
    const completed = await Promise.race([drained, timeout]);
    clearTimeout(timer);
    return completed;
  };
  return {
    handles,
    register,
    markRegistrationsComplete,
    startInitialRuns,
    stop,
    waitForIdle,
  };
};

export const stopRuntimeScheduler = async ({
  scheduler,
  handles = [],
  outboxRunner,
  runners = [],
  timeoutMs = 25_000,
} = {}) => {
  if (scheduler) {
    scheduler.stop();
  } else {
    for (const handle of handles) {
      try {
        handle?.stop?.();
      } catch (error) {
        console.error(`RUNTIME: cron stop failed: ${error.message}`);
      }
    }
  }
  const drainable = [scheduler, outboxRunner, ...runners].filter((runner) => runner?.waitForIdle);
  if (!drainable.length) return true;
  const results = await Promise.all(drainable.map((runner) => runner.waitForIdle({ timeoutMs })));
  return results.every(Boolean);
};
