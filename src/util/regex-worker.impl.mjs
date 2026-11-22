// Worker-side of bounded regex execution (A23). Pure compute: compiles the
// pattern, optionally runs the canary, scans file lines, and posts ONE reply.
// Every deadline is enforced host-side — if the worker hangs inside a
// catastrophic `re.test()`, the host's terminate() is what bounds it, so this
// file must never be trusted to time itself.
import { parentPort } from 'node:worker_threads';

parentPort.on('message', (job) => {
  const reply = (payload) => parentPort.postMessage({ id: job.id, ...payload });
  try {
    let re;
    try {
      re = new RegExp(job.source, job.flags ?? 'i');
    } catch (e) {
      reply({ error: `Invalid regex: ${e.message}` });
      return;
    }

    if (job.kind === 'canary') {
      // The whole point: these tests may hang catastrophically. The host
      // terminates the worker when its canary budget expires; completing all
      // of them means the pattern is safe to try against real data.
      for (const s of job.canaries ?? []) re.test(s);
      reply({ ok: true });
      return;
    }

    // scan job: linear walk of the files the host chose (already capped)
    const matches = [];
    const max = Math.max(1, Math.floor(job.maxResults ?? 100));
    const files = Array.isArray(job.files) ? job.files : [];
    outer: for (const f of files) {
      const lines = Array.isArray(f?.lines) ? f.lines : [];
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          matches.push({ rel: f.rel, line: i + 1, text: lines[i] });
          if (matches.length >= max) break outer;
        }
      }
    }
    reply({ ok: true, matches });
  } catch (e) {
    reply({ error: `Regex scan failed: ${e?.message ?? e}` });
  }
});
