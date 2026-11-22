// M2 benchmark harness — dev-only, NOT part of `npm test`.
//
// Runs the audit CLI across {model × corpus × depth} with repetitions and
// saves every raw report plus an environment record for reproducibility:
//
//   node test/benchmark-run.mjs --run <name> --models <idA,idB> [--corpora clean,labeled,express]
//   node test/benchmark-run.mjs --run <name> --changed-express   # baseline → touch → delta sanity
//
// Matrix (default): 2 models × 3 corpora × (standard ×2 + deep ×1) = 18 runs,
// each `--timeout 20`. Profiles bench-a/bench-b are generated into a temp
// config (adapter: native, temperature 0.2, maxSteps 28) — no key is ever
// written to disk; the CLI loads it itself from .env (git-ignored).
// Every failure mode (throttle/429, malformed output, empty response, crash)
// is recorded in the run index — failures are data, not surprises.
//
// Raw outputs: docs/benchmark/data/<run>/<model>/<corpus>/<depth>-r<n>.report.json
//              docs/benchmark/data/<run>/<model>/<corpus>/<depth>-r<n>.stderr.txt
//              docs/benchmark/data/<run>/environment.json
//              docs/benchmark/data/<run>/index.json
//              docs/benchmark/data/<run>/model-selection.json
//
// A leak sweep runs before the process exits: every saved file must contain
// none of the corpus-planted tokens nor the API-key env name (see
// docs/benchmark/vulnerable-corpus-truth.md).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BIN = path.join(ROOT, 'bin', 'code-audit.mjs');

const CORPORA = {
  clean: path.join(ROOT, 'examples', 'clean-app'),
  labeled: path.join(ROOT, 'examples', 'vulnerable-app'),
  express: path.join(ROOT, 'docs', 'benchmark', 'data', 'repos', 'express'),
};

// Every credential-like string planted in the labeled corpus (synthetic).
const PLANTED_TOKENS = [
  'AKIAJ4RFQKZCXMPL3WAQ',
  'ghp_16C7e42F292c6912E7710c838347Ae178B4a',
  'sk_live_51H8xQz2eZvKYlo2C9PqR7sT3wY5uJ9aKcD4fG6hB8nM0',
  'S3cretP4ss',
  'hunter2',
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

function fail(msg) {
  console.error(`benchmark-run: ${msg}`);
  process.exit(2);
}

const RUN = arg('run');
if (!RUN || /[^\w.-]/.test(RUN)) fail('--run <name> required (word chars, dashes, dots only)');
const MODELS = (arg('models') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!hasFlag('changed-express') && MODELS.length !== 2) {
  fail('--models <idA,idB> required: two distinct OpenRouter free-tier model ids (M2.1 selection)');
}
const CORPORA_ARG = (arg('corpora') ?? 'clean,labeled,express').split(',').map((s) => s.trim());
for (const c of CORPORA_ARG) if (!CORPORA[c]) fail(`unknown corpus "${c}" (clean|labeled|express)`);

const DATA_DIR = path.join(ROOT, 'docs', 'benchmark', 'data', RUN);
const CLI_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const GIT_SHA = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() ?? 'unknown';

// --- generated temp config: bench-a/bench-b (native adapter, fixed budgets) ---
const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ca-bench-'));
const CONFIG_PATH = path.join(tmpDir, 'bench.config.json');
await fsp.writeFile(CONFIG_PATH, JSON.stringify({
  profiles: Object.fromEntries(MODELS.map((id, i) => [`bench-${String.fromCharCode(97 + i)}`, {
    provider: 'openrouter',
    adapter: 'native',
    model: id,
    apiKeyEnv: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 4096,
    contextChars: 200000,
    maxSteps: 28,
  }])),
  defaultModels: MODELS.map((_, i) => `bench-${String.fromCharCode(97 + i)}`),
}, null, 2));
const PROFILE_OF = Object.fromEntries(MODELS.map((id, i) => [`bench-${String.fromCharCode(97 + i)}`, id]));

// --- one scan invocation; failures are recorded, never swallowed ---
function runScan({ model, corpus, depth, rep, outDir, extraArgs = [], useState = false }) {
  const args = [
    'scan', CORPORA[corpus],
    '--models', model,
    '--depth', depth,
    '--timeout', '20',
    '--output', outDir,
    '--quiet',
    '--config', CONFIG_PATH,
    ...extraArgs,
  ];
  if (!useState) args.push('--no-state');
  const t0 = Date.now();
  const res = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 22 * 60_000, windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  return {
    model, corpus, depth, rep, args, wallMs: Date.now() - t0,
    exitCode: res.status,
    timedOut: res.status === null || res.error?.code === 'ETIMEDOUT',
    stdoutTail: (res.stdout ?? '').split(/\r?\n/).filter(Boolean).slice(-8).join('\n'),
    stderrTail: (res.stderr ?? '').split(/\r?\n/).filter(Boolean).slice(-12).join('\n'),
    throttled: /429|rate.?limit/i.test(res.stderr ?? ''),
  };
}

/** Move the CLI's report.json for this run into its archived name and attach a summary. */
async function archiveReport(entry, reportSrc, runDir) {
  const slug = `${entry.depth}-r${entry.rep}`;
  const stderrPath = path.join(runDir, `${slug}.stderr.txt`);
  await fsp.writeFile(stderrPath, `${entry.stderrTail}\n--- stdout tail ---\n${entry.stdoutTail}\n`, 'utf8');
  entry.stderrFile = path.relative(DATA_DIR, stderrPath);
  if (reportSrc && fs.existsSync(reportSrc)) {
    const reportPath = path.join(runDir, `${slug}.report.json`);
    await fsp.rename(reportSrc, reportPath);
    entry.reportFile = path.relative(DATA_DIR, reportPath);
    try {
      const json = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      entry.summary = {
        findings: json.findings?.length ?? null,
        bySeverity: json.stats?.bySeverity ?? null,
        verification: json.stats?.verification ?? null,
        durationMs: json.meta?.durationMs ?? null,
        exitCode: json.meta?.exitCode ?? null,
        usage: (json.runs ?? []).map((r) => ({ phase: r.phase, ok: r.ok, inputTokens: r.usage?.inputTokens ?? null, outputTokens: r.usage?.outputTokens ?? null })),
      };
    } catch { entry.summary = null; }
  } else {
    entry.reportFile = null;
  }
  return entry;
}

const index = { run: RUN, startedAt: new Date().toISOString(), gitSha: GIT_SHA, cliVersion: CLI_VERSION, entries: [] };
await fsp.mkdir(DATA_DIR, { recursive: true });

if (hasFlag('changed-express')) {
  // --- --changed sanity on the express clone: baseline (state) → touch → delta ---
  const outDir = path.join(DATA_DIR, 'changed-sanity');
  await fsp.mkdir(outDir, { recursive: true });
  const model = MODELS[0] ?? fail('changed-express needs the real profile (pass --models too)');
  console.log('▶ changed-sanity baseline (state recorded in the clone)');
  const baseline = runScan({ model, corpus: 'express', depth: 'quick', rep: 1, outDir, useState: true });
  index.entries.push({ ...baseline, reportFile: null, note: 'baseline quick scan (state manifest recorded in the clone)' });
  const touched = path.join(CORPORA.express, 'lib', 'application.js');
  fs.utimesSync(touched, new Date(), new Date()); // touch: mtime change only
  console.log('▶ changed-sanity delta (--changed after touching lib/application.js)');
  const delta = runScan({ model, corpus: 'express', depth: 'standard', rep: 1, outDir, extraArgs: ['--changed'], useState: true });
  delta.note = 'delta audit after touching lib/application.js';
  const cloneReports = path.join(CORPORA.express, '.code-audit', 'reports');
  const runs = fs.existsSync(cloneReports) ? fs.readdirSync(cloneReports).sort() : [];
  const src = runs.length ? path.join(cloneReports, runs[runs.length - 1], 'report.json') : null;
  index.entries.push(await archiveReport(delta, src, outDir));
  // Keep the pinned clone pristine for later runs.
  await fsp.rm(path.join(CORPORA.express, '.code-audit'), { recursive: true, force: true });
  console.log(`changed-sanity complete: baseline exit ${baseline.exitCode}, delta exit ${delta.exitCode} in ${(delta.wallMs / 1000).toFixed(1)}s`);
} else {
  for (const model of MODELS) {
    for (const corpus of CORPORA_ARG) {
      const runDir = path.join(DATA_DIR, model.replaceAll('/', '__'), corpus);
      await fsp.mkdir(runDir, { recursive: true });
      const plan = [['standard', 1], ['standard', 2], ['deep', 1]];
      for (const [depth, rep] of plan) {
        console.log(`▶ ${model} × ${corpus} × ${depth}#${rep}`);
        const entry = runScan({ model, corpus, depth, rep, outDir: runDir });
        const saved = await archiveReport(entry, path.join(runDir, 'report.json'), runDir);
        index.entries.push(saved);
        console.log(`   exit ${entry.exitCode} in ${(entry.wallMs / 1000).toFixed(1)}s${entry.throttled ? ' (429 throttle observed)' : ''}${saved.summary ? ` — ${saved.summary.findings} finding(s)` : ' — no report written'}`);
      }
    }
  }
}

index.finishedAt = new Date().toISOString();
await fsp.writeFile(path.join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2));
await fsp.writeFile(path.join(DATA_DIR, 'model-selection.json'), JSON.stringify({ models: MODELS, profiles: PROFILE_OF, generatedConfig: 'temp (removed after the run)' }, null, 2));
await fsp.writeFile(path.join(DATA_DIR, 'environment.json'), JSON.stringify({
  run: RUN,
  startedAt: index.startedAt,
  finishedAt: index.finishedAt,
  cliVersion: CLI_VERSION,
  node: process.version,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  gitSha: GIT_SHA,
  models: MODELS,
  modelProfiles: PROFILE_OF,
  budgets: { timeoutMin: 20, maxSteps: 28, temperature: 0.2, adapter: 'native', contextChars: 200000 },
  corporaPins: JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'benchmark', 'pins.json'), 'utf8')).repos,
}, null, 2));

// --- leak sweep: zero matches required over every saved artifact ---
let leaks = 0;
async function sweep(dir) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await sweep(p); continue; }
    const text = await fsp.readFile(p, 'utf8').catch(() => null);
    if (text == null) continue;
    for (const tok of PLANTED_TOKENS) {
      if (text.includes(tok)) { console.error(`LEAK: ${tok} found in ${path.relative(DATA_DIR, p)}`); leaks++; }
    }
    if (/OPENROUTER_API_KEY\s*=\s*\S/.test(text)) { console.error(`LEAK: API-key assignment in ${path.relative(DATA_DIR, p)}`); leaks++; }
  }
}
await sweep(DATA_DIR);

await fsp.rm(tmpDir, { recursive: true, force: true });
console.log(`\nDone: ${index.entries.length} run(s) → ${path.relative(ROOT, DATA_DIR)}${leaks ? `\n${leaks} LEAK(S) — do NOT commit; investigate first` : ' — leak sweep clean'}`);
process.exit(leaks ? 1 : 0);
