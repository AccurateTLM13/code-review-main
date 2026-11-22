// Bounded regex execution (A23).
//
// A model-authored pattern is compiled and run inside a worker thread with a
// HOST-side hard deadline: when the budget expires the host terminates the
// worker, so catastrophic backtracking can neither hang the process nor defeat
// the run-level timeout. Before the real scan, a canary job tests the pattern
// against synthetic worst-case strings under its own 100 ms budget — obvious
// pathologies are rejected before any repository data is touched.
//
// Design (decision D3): zero dependencies — `worker_threads` + `terminate()`
// is a true wall-clock bound, unlike a main-thread deadline that a hanging
// synchronous regex would simply never reach. RE2-style engines were rejected
// to keep the package dependency-free.
//
// The wrapper NEVER throws for pattern problems: it resolves with
// { error } for budget/compile issues, or { matches, coverage, elapsedMs }.
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WORKER_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'regex-worker.impl.mjs');

/** Canary budget: worst-case strings must resolve within this window. */
export const CANARY_BUDGET_MS = 100;
/** Default hard deadline for the whole call (canary + scan). */
export const DEFAULT_REGEX_DEADLINE_MS = 500;
/** Payload caps handed to the worker (files / serialized bytes). */
export const MAX_REGEX_FILES = 4000;
export const MAX_REGEX_BYTES = 8 * 1024 * 1024;

export const REGEX_BUDGET_MESSAGE = 'regex exceeded its time budget; simplify the pattern or use a plain substring search';

/** Synthetic worst cases for the canary (nested-quantifier bait). */
function canaryStrings() {
  return ['a'.repeat(48), 'a'.repeat(48) + 'b', 'ab'.repeat(24) + 'x'];
}

/** Rejection marker for the host-side deadline timer (caught in the wrapper). */
function budgetError() {
  const e = new Error(REGEX_BUDGET_MESSAGE);
  e.code = 'REGEX_BUDGET';
  return e;
}

/** Run one job on the worker; reject with code REGEX_BUDGET on timeout. */
function runWorkerJob(worker, job, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(budgetError());
    }, Math.max(1, timeoutMs));
    const onMessage = (m) => {
      if (m && m.id === job.id && !settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(m);
      }
    };
    const onError = (e) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    const onExit = (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(new Error(`regex worker exited unexpectedly (code ${code})`));
      }
    };
    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    };
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);
    worker.postMessage(job);
  });
}

/**
 * Run a regex scan under a hard wall-clock budget.
 *
 * @param {object} params
 * @param {string} params.source - the regex pattern (model-authored)
 * @param {string} [params.flags] - regex flags (default 'i')
 * @param {Array<{rel: string, lines: string[]}>} params.files - scan targets
 * @param {number} [params.deadlineMs] - whole-call budget (default 500)
 * @param {number} [params.maxResults] - stop collecting after this many
 * @returns {Promise<{matches?: Array<{rel, line, text}>, coverage?: 'full'|'partial',
 *                     error?: string, elapsedMs?: number}>}
 */
export async function runBoundedRegexSearch({
  source,
  flags = 'i',
  files = [],
  deadlineMs = DEFAULT_REGEX_DEADLINE_MS,
  maxResults = 100,
}) {
  const started = Date.now();
  let coverage = 'full';
  let worker = null;
  const err = (error, errorKind) => ({ error, errorKind, coverage, elapsedMs: Date.now() - started });
  try {
    worker = new Worker(WORKER_FILE);
    worker.on('error', () => { /* safety net: per-job listeners handle real errors */ });

    // --- canary: reject obvious pathologies before touching repo data ---
    const canary = await runWorkerJob(
      worker,
      { id: 1, kind: 'canary', source, flags, canaries: canaryStrings() },
      Math.min(CANARY_BUDGET_MS, deadlineMs),
    );
    if (canary.error) return err(canary.error, 'compile');

    // --- payload caps: scan a prefix, report coverage honestly ---
    let bytes = 0;
    const capped = [];
    for (const f of files) {
      if (capped.length >= MAX_REGEX_FILES) { coverage = 'partial'; break; }
      let n = 0;
      for (const l of f.lines) n += l.length + 1;
      if (bytes + n > MAX_REGEX_BYTES) { coverage = 'partial'; break; }
      capped.push(f);
      bytes += n;
    }

    const remaining = deadlineMs - (Date.now() - started);
    if (remaining <= 50) return err(REGEX_BUDGET_MESSAGE, 'budget');

    const scan = await runWorkerJob(
      worker,
      { id: 2, kind: 'scan', source, flags, files: capped, maxResults },
      remaining,
    );
    if (scan.error) return err(scan.error, 'scan');
    return {
      matches: Array.isArray(scan.matches) ? scan.matches : [],
      coverage,
      elapsedMs: Date.now() - started,
    };
  } catch (e) {
    if (e?.code === 'REGEX_BUDGET') return err(REGEX_BUDGET_MESSAGE, 'budget');
    return err(`Regex search unavailable: ${e?.message ?? e}`, 'infra');
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
}
