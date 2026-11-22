// M2 benchmark analyzer — dev-only, NOT part of `npm test`.
//
//   node test/benchmark-analyze.mjs --run <name>
//
// Reads every archived report under docs/benchmark/data/<run>/ and computes,
// per model × corpus:
//   - citation correctness (share of findings marked verified/adjusted — the
//     strict evidence validator only grants those when the verbatim snippet
//     matches the cited location in the real file)
//   - precision on P0/P1 (critical/high): mechanical TP/FP against the truth
//     table for the labeled corpus (same file, line range ±5, same category);
//     for real repos the list is exported for rubric adjudication and
//     precision is reported as pending, with a borderline list for U2
//   - recall of planted defects (labeled corpus): matched truth rows / 27,
//     with the missed list
//   - runtime, token usage, findings counts, verification mix, instability
//     across the two standard repetitions
// Writes docs/benchmark/data/<run>/METRICS.md (+ borderline.md when real-repo
// findings exist). A leak sweep runs over all read artifacts first — zero
// matches required before anything is committed.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DATA_ROOT = path.join(ROOT, 'docs', 'benchmark', 'data');
const TRUTH_PATH = path.join(ROOT, 'docs', 'benchmark', 'vulnerable-corpus-truth.md');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}
const RUN = arg('run');
if (!RUN || /[^\w.-]/.test(RUN)) { console.error('benchmark-analyze: --run <name> required'); process.exit(2); }
const RUN_DIR = path.join(DATA_ROOT, RUN);
if (!fs.existsSync(RUN_DIR)) { console.error(`benchmark-analyze: run dir not found: ${RUN_DIR}`); process.exit(2); }

// --- leak sweep FIRST: nothing is committed unless this is clean ---
const PLANTED_TOKENS = [
  'AKIAJ4RFQKZCXMPL3WAQ',
  'ghp_16C7e42F292c6912E7710c838347Ae178B4a',
  'sk_live_51H8xQz2eZvKYlo2C9PqR7sT3wY5uJ9aKcD4fG6hB8nM0',
  'S3cretP4ss',
  'hunter2',
];
let leaks = 0;
async function sweep(dir) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await sweep(p); continue; }
    const text = await fsp.readFile(p, 'utf8').catch(() => null);
    if (text == null) continue;
    for (const tok of PLANTED_TOKENS) if (text.includes(tok)) { console.error(`LEAK: ${tok} in ${path.relative(RUN_DIR, p)}`); leaks++; }
    if (/OPENROUTER_API_KEY\s*=\s*\S/.test(text)) { console.error(`LEAK: key assignment in ${path.relative(RUN_DIR, p)}`); leaks++; }
  }
}
await sweep(RUN_DIR);

// --- truth table ---
function parseTruth() {
  const rows = [];
  for (const line of fs.readFileSync(TRUTH_PATH, 'utf8').split(/\r?\n/)) {
    if (!/^\| V-/.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim());
    // | id | file | lines | category | severity | defect |
    const [, id, file, lines, category, severity] = cells;
    const m = lines.replace(/[–—]/g, '-').match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    rows.push({ id, file, lines: [Number(m[1]), Number(m[2] ?? m[1])], category, severity });
  }
  return rows;
}
const TRUTH = parseTruth();
const TRUTH_RECALL_DENOM = TRUTH.length;

// --- mechanical matching (plan M2.6) ---
// Loose match: same file, line ranges overlapping within ±5, same category.
// Claims are then assigned closest-first so two nearby truth rows (e.g. the
// PAT at line 5 and the eval sink at line 9) each get their own finding
// instead of the first match double-claiming.
function looseMatch(finding, row) {
  if (!finding.file || finding.file !== row.file) return false;
  if (finding.category !== row.category) return false;
  const [fs_, fe] = finding.lines ?? [0, 0];
  const [ts, te] = row.lines;
  return fs_ <= te + 5 && fe >= ts - 5;
}
function lineGap(finding, row) {
  const [fs_, fe] = finding.lines ?? [0, 0];
  const [ts, te] = row.lines;
  return Math.max(0, ts - fe, fs_ - te);
}

function severityRank(s) { return { critical: 4, high: 3, medium: 2, low: 1, info: 0 }[s] ?? 0; }
const isP01 = (s) => s === 'critical' || s === 'high';

// --- walk the run dir ---
const modelDirs = (await fsp.readdir(RUN_DIR, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && e.name !== 'changed-sanity');
const results = [];
for (const md of modelDirs) {
  const model = md.name.replaceAll('__', '/');
  for (const cd of await fsp.readdir(path.join(RUN_DIR, md.name), { withFileTypes: true })) {
    if (!cd.isDirectory()) continue;
    const corpus = cd.name;
    const dir = path.join(RUN_DIR, md.name, corpus);
    const reports = (await fsp.readdir(dir)).filter((f) => f.endsWith('.report.json')).sort();
    const repResults = [];
    for (const rf of reports) {
      let json = null;
      try { json = JSON.parse(await fsp.readFile(path.join(dir, rf), 'utf8')); } catch { /* malformed — recorded below */ }
      repResults.push({ file: rf, json });
    }
    results.push({ model, corpus, dir, reports: repResults });
  }
}

// --- per model/corpus metrics ---
const table = [];
const realRepoFindings = [];
const missedByModel = {};
for (const r of results) {
  const model = r.model;
  const okReps = r.reports.filter((x) => x.json);
  const failedReps = r.reports.filter((x) => !x.json);
  const findingsByRep = okReps.map((x) => ({ file: x.file, findings: x.json.findings ?? [] }));
  const allFindings = findingsByRep.flatMap((x) => x.findings);
  const verified = allFindings.filter((f) => f.verification?.status === 'verified').length;
  const adjusted = allFindings.filter((f) => f.verification?.status === 'adjusted').length;
  const unverified = allFindings.filter((f) => f.verification?.status === 'unverified').length;
  const p01 = allFindings.filter((f) => isP01(f.severity) && !f.dismissed);
  const runtimeMs = okReps.map((x) => x.json.meta?.durationMs ?? null);
  const tokens = okReps.flatMap((x) => (x.json.runs ?? []).map((run) => (run.usage?.inputTokens ?? 0) + (run.usage?.outputTokens ?? 0))).reduce((a, b) => a + b, 0);

  let matchedRows = new Set();
  let tp = 0, fp = 0;
  if (r.corpus === 'labeled') {
    const active = allFindings.filter((f) => !f.dismissed);
    const claims = [];
    for (const f of active) {
      for (const row of TRUTH) {
        if (looseMatch(f, row)) claims.push({ f, row, gap: lineGap(f, row) });
      }
    }
    claims.sort((a, b) => a.gap - b.gap);
    const usedFindings = new Set();
    for (const c of claims) {
      if (matchedRows.has(c.row.id) || usedFindings.has(c.f)) continue;
      matchedRows.add(c.row.id);
      usedFindings.add(c.f);
      tp++;
    }
    fp = active.length - usedFindings.size;
    missedByModel[model] = TRUTH.filter((row) => !matchedRows.has(row.id)).map((row) => row.id);
  } else if (r.corpus === 'clean') {
    tp = 0; fp = allFindings.filter((f) => !f.dismissed).length; // every finding on the zero-defect corpus is an FP
  } else {
    // real repo: exported for rubric adjudication (M2.6)
    for (const f of allFindings) {
      realRepoFindings.push({
        model, corpus: r.corpus, file: f.file, lines: f.lines ?? null,
        severity: f.severity, category: f.category, confidence: f.confidence,
        verified: f.verification?.status ?? null, title: f.title, dismissed: Boolean(f.dismissed),
      });
    }
  }

  // instability: overlap of file+line+category sets between the two standard reps
  const stdReps = findingsByRep.filter((x) => x.file.startsWith('standard'));
  let instability = null;
  if (stdReps.length === 2) {
    const key = (f) => `${f.file}|${f.lines?.join('-') ?? ''}|${f.category}|${f.title.slice(0, 60)}`;
    const a = new Set(stdReps[0].findings.filter((f) => !f.dismissed).map(key));
    const b = stdReps[1].findings.filter((f) => !f.dismissed).map(key);
    const inter = b.filter((k) => a.has(k)).length;
    instability = { rep1: a.size, rep2: b.size, identical: inter, jaccard: a.size + b.size ? +(inter / (a.size + b.size - inter)).toFixed(2) : 1 };
  }

  table.push({
    model,
    corpus: r.corpus,
    reps: r.reports.length, failedReps: failedReps.length,
    findings: allFindings.length,
    verified, adjusted, unverified,
    citationCorrectPct: allFindings.length ? Math.round(((verified + adjusted) / allFindings.length) * 100) : null,
    p01Count: p01.length,
    tp, fp,
    precisionP01: (r.corpus === 'real-repo' ? 'pending-adjudication' : (tp + fp ? Math.round((tp / (tp + fp)) * 100) + '%' : 'n/a (no P0/P1 findings)')),
    recallRows: r.corpus === 'labeled' ? matchedRows.size : null,
    runtimeMsMin: runtimeMs.length ? Math.round(Math.min(...runtimeMs.filter(Number.isFinite))) : null,
    runtimeMsMax: runtimeMs.length ? Math.round(Math.max(...runtimeMs.filter(Number.isFinite))) : null,
    tokens,
    instability,
  });
}

// --- METRICS.md ---
const env = JSON.parse(await fsp.readFile(path.join(RUN_DIR, 'environment.json'), 'utf8').catch(() => '{}'));
const idx = JSON.parse(await fsp.readFile(path.join(RUN_DIR, 'index.json'), 'utf8').catch(() => '{}'));
const md = [];
md.push(`# METRICS — benchmark run \`${RUN}\``);
md.push('');
md.push(`- Generated: ${new Date().toISOString()}`);
md.push(`- Models: ${env.models?.join(', ') ?? '?'}`);
md.push(`- CLI: v${env.cliVersion ?? '?'} · Node ${env.node ?? '?'} · git ${env.gitSha ?? '?'}`);
md.push(`- Runs recorded: ${idx.entries?.length ?? '?'} · leak sweep: ${leaks ? `**${leaks} LEAK(S) — DO NOT COMMIT**` : 'clean'}`);
md.push('');
md.push(`| model | corpus | reps | failed | findings | verified | adjusted | unverified | citation % | P0/P1 | TP | FP | precision (P0/P1) | recall rows | runtime ms (min–max) | tokens | instability |`);
md.push(`|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
for (const t of table) {
  md.push(`| ${t.model} | ${t.corpus} | ${t.reps} | ${t.failedReps} | ${t.findings} | ${t.verified} | ${t.adjusted} | ${t.unverified} | ${t.citationCorrectPct ?? '—'} | ${t.p01Count} | ${t.tp} | ${t.fp} | ${t.precisionP01} | ${t.recallRows ?? '—'} | ${t.runtimeMsMin ?? '—'}–${t.runtimeMsMax ?? '—'} | ${t.tokens} | ${t.instability ? `${t.instability.identical}/${t.instability.rep1}` : '—'} |`);
}
md.push('');
md.push('**Mechanical TP rule (labeled corpus):** same file, line range overlapping ±5, same category — per `docs/benchmark/vulnerable-corpus-truth.md`. Human adjudication may reclassify; deviations are recorded in REPORT.md.');
md.push('');
for (const [model, missed] of Object.entries(missedByModel)) {
  md.push(`**Missed planted rows (${model}):** ${missed.length ? missed.join(', ') : 'none'} (recall ${TRUTH_RECALL_DENOM - missed.length}/${TRUTH_RECALL_DENOM} = ${Math.round(((TRUTH_RECALL_DENOM - missed.length) / TRUTH_RECALL_DENOM) * 100)}%)`);
  md.push('');
}
md.push('**Failure modes recorded:** see `index.json` entries (exit codes, stderr tails, 429 throttling flags). Failures are data, not surprises.');
md.push('');
const metricsPath = path.join(RUN_DIR, 'METRICS.md');
await fsp.writeFile(metricsPath, md.join('\n'), 'utf8');

// --- borderline list for real repos (U2 input) ---
if (realRepoFindings.length) {
  const bl = [];
  bl.push(`# Borderline findings — run \`${RUN}\``);
  bl.push('');
  bl.push('Real-repository findings for manual adjudication (rubric: correct? already known/documented? actionable? severity fair?). One row per finding; mark ✓/✗/borderline.');
  bl.push('');
  bl.push('| model | file | lines | severity | category | verified | title | verdict (✓/✗/~) | note |');
  bl.push('|---|---|---|---|---|---|---|---|---|');
  for (const f of realRepoFindings) {
    bl.push(`| ${f.model} | ${f.file} | ${f.lines ? `${f.lines[0]}-${f.lines[1]}` : '—'} | ${f.severity} | ${f.category} | ${f.verified ?? '—'} | ${f.title.replaceAll('|', '\\|')} |  |  |`);
  }
  await fsp.writeFile(path.join(RUN_DIR, 'borderline.md'), bl.join('\n'), 'utf8');
}

console.log(`Analyzed ${table.length} model/corpus groups → ${path.relative(ROOT, metricsPath)}${realRepoFindings.length ? ` (+borderline.md, ${realRepoFindings.length} real-repo findings)` : ''}`);
console.log(leaks ? `${leaks} LEAK(S) — do NOT commit` : 'Leak sweep clean.');
process.exit(leaks ? 1 : 0);
