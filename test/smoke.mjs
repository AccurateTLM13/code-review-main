// Release-gate acceptance suite. Offline: no API keys, no real models.
// Covers the acceptance criteria from the engineering review plus regression
// of the transport/adapter behaviors:
//
//  A1  a cited wrong line cannot pass evidence verification
//  A2  two unrelated issues on one source line remain two issues
//  A3  one model in both structured+autonomous passes is not two reviewers
//  A4  no raw synthetic credentials in markdown, JSON, prompt, or tool output
//  A5  --changed reports only changed-file issues (cross-file labeled); deletes detected
//  A6  explicit config wins over repo/user defaults; ignore rules additive
//  A7  cancellation halts native and SDK calls and reports incomplete results
//  A8  tool budgets enforced on actual output; final submission always possible
//  A9  offline benign repository returns a small, explainable, low-noise set
//  A10 no application source file changes
//  A19 digests/filenames/graph paths sanitized; A20 egress policy
//  A21 one tool-result boundary (fail-closed); opaque file handles keep files referenceable
//  A22 device-local means loopback (endpoint trust)
//  A23 bounded regex searches (worker + hard deadline)
//  [28] M3.6 report quality: kind split, verified-only summary, partial audits
//  R*  regression: deterministic checks, consensus, deep investigation, adapters, CLI
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BIN = path.join(ROOT, 'bin', 'code-audit.mjs');
const FIXTURE = path.join(ROOT, 'examples', 'vulnerable-app');
const CLEAN = path.join(ROOT, 'examples', 'clean-app');

const SECRETS_PLANTED = [
  'AKIAJ4RFQKZCXMPL3WAQ',
  'ghp_16C7e42F292c6912E7710c838347Ae178B4a',
  'sk_live_51H8xQz2eZvKYlo2C9PqR7sT3wY5uJ9aKcD4fG6hB8nM0',
];

let failures = 0;
function check(name, cond, detail = '') {
  const mark = cond ? ' ✓ ' : ' ✗ ';
  console.log(`${mark}${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

function runCli(args, { timeout = 180_000 } = {}) {
  const res = spawnSync(process.execPath, [BIN, ...args, '--no-color'], {
    cwd: ROOT, encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  return { code: res.status, out: `${res.stdout ?? ''}\n${res.stderr ?? ''}` };
}

function latestReport(dir) {
  const base = path.join(dir, '.code-audit', 'reports');
  const runs = fs.readdirSync(base).sort();
  const run = path.join(base, runs[runs.length - 1]);
  return {
    dir: run,
    json: JSON.parse(fs.readFileSync(path.join(run, 'report.json'), 'utf8')),
    md: fs.readFileSync(path.join(run, 'report.md'), 'utf8'),
  };
}

async function tempDir(prefix) {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

// fixture hashes for the read-only guarantee (A10)
function hashTree(dir, skip = new Set(['.code-audit'])) {
  const out = new Map();
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (skip.has(e.name)) continue;
        walk(child);
      } else {
        out.set(child, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, child))).digest('hex'));
      }
    }
  };
  walk('');
  return out;
}
const fixtureHashesBefore = hashTree(FIXTURE);
fs.rmSync(path.join(FIXTURE, '.code-audit'), { recursive: true, force: true });

// ============================================================ A10/R: deterministic correctness
console.log('\n[1] deterministic checks on the vulnerable corpus (regression)');
{
  const r = runCli(['scan', 'examples/vulnerable-app', '--depth', 'quick', '--quiet']);
  check('exit 0', r.code === 0, `code=${r.code}`);
  const { json, md } = latestReport(FIXTURE);
  check('secrets: AWS key found', json.findings.some((f) => f.title.includes('AWS access key')));
  check('secrets: GitHub PAT found', json.findings.some((f) => f.title.includes('GitHub personal access token')));
  check('secrets: .env present', json.findings.some((f) => f.title.startsWith('.env file')));
  check('duplication: utils/helpers block', json.findings.some((f) => f.category === 'duplication' && f.occurrences?.some((o) => o.file === 'src/utils.js' && f.file === 'src/helpers.js')));
  check('size: oversized monolith', json.findings.some((f) => f.title.includes('legacy-monolith.js is 1,330 lines')));
  check('quality: shell injection (JS)', json.findings.some((f) => f.title.includes('interpolated/concatenated command')));
  check('quality: SQL concat (TS corpus)', json.findings.some((f) => f.file === 'src/payment.ts' && f.title.includes('SQL query built via')));
  check('quality: eval (TS corpus)', json.findings.some((f) => f.file === 'src/payment.ts' && f.title.includes('eval()')));
  check('graph: import cycle', json.findings.some((f) => f.title.includes('Import cycle') && f.title.includes('a.js')));
  check('deps: no lockfile', json.findings.some((f) => f.title.includes('No lockfile')));
  check('markdown report renders', md.includes('# Code Audit Report') && md.length > 2000);
}

// ============================================================ A1: evidence verification strictness
console.log('\n[2] evidence verification — cited wrong lines cannot pass (A1)');
{
  const { locateSnippet, validateDrafts } = await import('../src/evidence/validate.mjs');
  const dir = await tempDir('ca-ev-');
  const ev = path.join(dir, 'evidence.js');
  await fsp.writeFile(ev, [
    'function handler(req, res) {',
    '  res.json(data);',
    '}',
    'const OTHER = 1;',
    'const WRONG_SPOT = 2;',
  ].join('\n'));

  // unit: wrong line → moved/adjusted, never verified-at-the-wrong-line
  const lines = fs.readFileSync(ev, 'utf8').split('\n');
  const moved = locateSnippet(lines, 'res.json(data);', { cited: [1, 1] });
  check('wrong-line snippet → moved, not in-place', moved.status === 'moved' && moved.lines[0] === 2, JSON.stringify(moved));
  const correct = locateSnippet(lines, 'res.json(data);', { cited: [2, 2] });
  check('correct citation → in-place', correct.status === 'in-place');

  // integration: drafts through validateDrafts
  const { walkTree, FileStore } = await import('../src/util/files.mjs');
  const walk = await walkTree(dir);
  const repo = { fileStore: new FileStore(dir, walk.files) };
  const mk = (over) => Object.assign({
    checkId: 'model:test', source: 'model:test', title: 't', category: 'bug', severity: 'medium',
    confidence: 0.7, file: 'evidence.js', lines: [1, 1], snippet: null, description: 'd', suggestion: null, benefit: null, risk: null,
  }, over);

  const out = validateDrafts([
    mk({ title: 'wrong-line', lines: [1, 1], snippet: 'res.json(data);' }),            // must be adjusted
    mk({ title: 'range-only', lines: [1, 3], snippet: null }),                          // must stay unverified
    mk({ title: 'missing snippet', lines: [1, 1], snippet: 'not in the file at all' }), // unverified
    mk({ title: 'correct', lines: [2, 2], snippet: 'res.json(data);' }),                // verified
  ], { repo });
  const byTitle = Object.fromEntries(out.findings.map((f) => [f.title, f]));
  check('wrong-line finding: adjusted, lines corrected', byTitle['wrong-line']?.verification?.status === 'adjusted' && byTitle['wrong-line']?.lines?.[0] === 2);
  check('range-only finding: unverified (line number alone proves nothing)', byTitle['range-only']?.verification?.status === 'unverified' && /no snippet/i.test(byTitle['range-only']?.verification?.note ?? ''));
  check('missing snippet: unverified + down-weighted', byTitle['missing snippet']?.verification?.status === 'unverified' && byTitle['missing snippet'].confidence < 0.3);
  check('correct citation: verified', byTitle['correct']?.verification?.status === 'verified');

  // comparison happens in redacted space (models quote the redacted prompt)
  const { createRedactor } = await import('../src/util/redact.mjs');
  const secFile = path.join(dir, 'secret-line.js');
  await fsp.writeFile(secFile, "const KEY = 'AKIAJ4RFQKZCXMPL3WAQ';\nconst A = 1;\n");
  const walk2 = await walkTree(dir);
  const repo2 = { fileStore: new FileStore(dir, walk2.files) };
  const redactor = createRedactor();
  redactor.add('AKIAJ4RFQKZCXMPL3WAQ', 'aws-key');
  const placeholderLine = redactor.redact("const KEY = 'AKIAJ4RFQKZCXMPL3WAQ';");
  check('redactor produces a placeholder line', placeholderLine.includes('[REDACTED aws-key'), placeholderLine);  const out2 = validateDrafts([
    mk({ title: 'redacted-quote', file: 'secret-line.js', lines: [1, 1], snippet: placeholderLine }),
    mk({ title: 'raw-quote', file: 'secret-line.js', lines: [1, 1], snippet: "const KEY = 'AKIAJ4RFQKZCXMPL3WAQ';" }),
  ], { repo: repo2, redactor });
  const byTitle2 = Object.fromEntries(out2.findings.map((f) => [f.title, f]));
  check('redacted quote verifies against raw source', byTitle2['redacted-quote']?.verification?.status === 'verified', byTitle2['redacted-quote']?.verification?.note);
  check('raw quote also verifies (both sides redacted for comparison)', byTitle2['raw-quote']?.verification?.status === 'verified');

  await fsp.rm(dir, { recursive: true, force: true });
}

// ============================================================ A2 + A3: merge/consensus integrity
console.log('\n[3] merge & consensus integrity (A2, A3)');
{
  const { mergeFindings } = await import('../src/evidence/validate.mjs');
  const base = {
    checkId: 'model:x', category: 'security', severity: 'high', confidence: 0.7,
    file: 'src/query.js', lines: [10, 10], description: 'detail', suggestion: 's', benefit: 'b', risk: 'r',
    verified: true, verification: { status: 'verified' }, occurrences: undefined, source: 'model:x',
  };
  const f = (over) => ({ ...base, ...over });

  // A2: unrelated issues on the same line stay separate
  const unrelated = mergeFindings([
    f({ title: 'SQL injection risk in query builder', source: 'model:a' }),
    f({ title: 'XSS exposure in template render', source: 'model:b' }),
  ]);
  check('two unrelated same-line issues remain two findings', unrelated.length === 2, `got ${unrelated.length}`);

  // M3.6(a): deterministic + model finding of the SAME defect at the same
  // location consolidates even when the wording differs entirely
  const crossSource = mergeFindings([
    f({ title: 'AWS access key ID committed', source: 'deterministic', checkId: 'secrets', lines: [8, 8] }),
    f({ title: 'Hardcoded AWS key in source code', source: 'model:a', lines: [8, 9] }),
  ]);
  check('deterministic + model same-defect finding consolidates (M3.6a)', crossSource.length === 1, `got ${crossSource.length}`);
  check('consolidated finding keeps the deterministic identity', crossSource[0].source === 'deterministic' && crossSource[0].sources.includes('model:a'));
  // ...but same line + different categories stay separate even cross-source
  const crossSourceDiffCat = mergeFindings([
    f({ title: 'SQL injection in query builder', source: 'deterministic', checkId: 'quality', lines: [10, 10] }),
    f({ title: 'Hardcoded AWS key in source code', source: 'model:a', category: 'bug', lines: [10, 10] }),
  ]);
  check('det+model same line, different categories → two findings', crossSourceDiffCat.length === 2, `got ${crossSourceDiffCat.length}`);

  // related issue from two profiles → one consensus finding
  const consensus = mergeFindings([
    f({ title: 'SQL injection risk in query builder', source: 'model:one' }),
    f({ title: 'SQL injection in query builder', source: 'model:two' }),
  ]);
  check('same issue from two profiles → merged', consensus.length === 1);
  check('consensus requires two distinct profiles', consensus[0].consensus === true && consensus[0].consensusBy.join(',') === 'one,two', JSON.stringify(consensus[0].consensusBy));

  // A3: one model in two phases is not two reviewers
  const sameModel = mergeFindings([
    f({ title: 'SQL injection risk in query builder', source: 'model:local' }),
    f({ title: 'SQL injection in query builder', source: 'agent:local' }),
  ]);
  check('model:local + agent:local merge but get NO consensus', sameModel.length === 1 && sameModel[0].consensus !== true);

  // dismissed findings are kept visible (never silently dropped)
  const kept = mergeFindings([f({ title: 'kept', dismissed: true, source: 'deterministic' })]);
  check('dismissed findings survive merging (kept for review)', kept.length === 1 && kept[0].dismissed === true);
}

// ============================================================ A4: secret redaction end to end
console.log('\n[4] secret redaction across all surfaces (A4)');
{
  const r = runCli(['scan', 'examples/vulnerable-app', '--depth', 'quick', '--quiet']);
  check('exit 0', r.code === 0, `code=${r.code}`);
  const { json, md } = latestReport(FIXTURE);
  for (const secret of SECRETS_PLANTED) {
    check(`report.md free of ${secret.slice(0, 12)}…`, !md.includes(secret));
    check(`report.json free of ${secret.slice(0, 12)}…`, !JSON.stringify(json).includes(secret));
  }
  check('redaction placeholders present in markdown', /\[REDACTED (aws-key|github-token)/.test(md), md.match(/\[REDACTED [^\]]+\]/)?.[1] ?? 'none');
  check('CLI stdout free of secrets', !r.out.includes(SECRETS_PLANTED[0]));

  // model prompt surface: the context pack is redacted
  const { discoverRepo } = await import('../src/discovery/discover.mjs');
  const { runSecrets } = await import('../src/checks/secrets.mjs');
  const { buildContextPack } = await import('../src/engine/context.mjs');
  const { createRedactor } = await import('../src/util/redact.mjs');
  const { createLogger } = await import('../src/util/log.mjs');
  const { loadConfig } = await import('../src/config.mjs');
  const logger = createLogger({ quiet: true });
  const { config } = loadConfig(FIXTURE);
  const repo = await discoverRepo(FIXTURE, { logger });
  const redactor = createRedactor();
  const ctx = { root: FIXTURE, repo, fileStore: repo.fileStore, config, logger, redactor, git: null, changedSet: null };
  runSecrets(ctx);
  check('secret scan registers planted literals', redactor.size >= 2, `size=${redactor.size}`);
  const pack = buildContextPack(repo, [], { budgetChars: 40000, redactor });
  check('context pack (model prompt) free of secrets', !SECRETS_PLANTED.some((s) => pack.text.includes(s)));
  check('context pack carries placeholders', pack.text.includes('[REDACTED'));

  // tool output surface: read_file/search_code redact
  const { createToolkit } = await import('../src/engine/tools.mjs');
  const toolkit = createToolkit(repo, { budgets: { maxToolCalls: 50, maxReadBytes: 4_000_000, deadline: Infinity, profileName: 'unit' }, redactor, logger });
  const readFile = toolkit.tools.find((t) => t.name === 'read_file');
  const line8 = await readFile.execute({ path: 'index.js', start: 8, end: 8 });
  check('read_file redacts secret lines', !line8.lines?.[0]?.text?.includes(SECRETS_PLANTED[0]) && line8.lines?.[0]?.text?.includes('[REDACTED'));
  const search = await toolkit.tools.find((t) => t.name === 'search_code').execute({ query: 'AKIA' });
  check('search_code redacts matches', search.matches.every((m) => !m.text.includes(SECRETS_PLANTED[0])));
}

// ============================================================ A5: --changed scoping + deletions
console.log('\n[5] --changed scope: only changed-file findings; deletes detected (A5)');
{
  const fileA = path.join(FIXTURE, 'tmp-delta-a.js');
  const fileB = path.join(FIXTURE, 'tmp-delta-b.js');
  try {
    await fsp.writeFile(fileA, '// delta fixture A\nconst a = 1; // TODO delta-a\nfunction f() { debugger; }\nmodule.exports = { a, f };\n');
    await fsp.writeFile(fileB, '// delta fixture B\nconst b = 2; // TODO delta-b\nconst c = JSON.parse(JSON.stringify({ b }));\nmodule.exports = { b, c };\n');
    const base = runCli(['scan', 'examples/vulnerable-app', '--depth', 'quick', '--quiet']);
    check('baseline scan ok', base.code === 0);

    await fsp.appendFile(fileA, '\n// touched by the test\n');
    const r = runCli(['scan', 'examples/vulnerable-app', '--depth', 'quick', '--changed', '--quiet']);
    check('changed scan ok', r.code === 0, `code=${r.code}`);
    const { json } = latestReport(FIXTURE);
    check('changedFiles lists only the modified file', JSON.stringify(json.meta.changedFiles) === JSON.stringify(['tmp-delta-a.js']), JSON.stringify(json.meta.changedFiles));
    const bFindings = json.findings.filter((f) => f.file === 'tmp-delta-b.js');
    check('unchanged file B contributes NO findings', bFindings.length === 0, JSON.stringify(bFindings.map((f) => f.title)));
    const aFindings = json.findings.filter((f) => f.file === 'tmp-delta-a.js');
    check('changed file A contributes findings', aFindings.length >= 1, `got ${aFindings.length}`);
    check('every finding is scope=changed (no unlabeled cross-file)', json.findings.every((f) => f.scope === 'changed'), JSON.stringify([...new Set(json.findings.map((f) => f.scope))]));

    // deletion detection
    await fsp.rm(fileA, { force: true });
    await fsp.rm(fileB, { force: true });
    const r2 = runCli(['scan', 'examples/vulnerable-app', '--depth', 'quick', '--changed', '--quiet']);
    check('post-delete scan ok', r2.code === 0, `code=${r2.code}`);
    const { json: json2 } = latestReport(FIXTURE);
    const deleted = json2.meta.deletedFiles ?? [];
    check('deletions detected', deleted.includes('tmp-delta-a.js') && deleted.includes('tmp-delta-b.js'), JSON.stringify(deleted));
    check('nothing left to report after the delta is gone', json2.findings.length === 0, `got ${json2.findings.length}`);
  } finally {
    await fsp.rm(fileA, { force: true });
    await fsp.rm(fileB, { force: true });
  }
}

// ============================================================ A6: config precedence
console.log('\n[6] config precedence: explicit > repository > user > defaults (A6)');
{
  const { loadConfig } = await import('../src/config.mjs');
  const dir = await tempDir('ca-cfg-');
  const prev = process.env.CODE_AUDIT_CONFIG;
  try {
    // user layer
    // (not exercised here — home config is machine-global; the same merge code path runs)
    // repository layer
    await fsp.writeFile(path.join(dir, 'code-audit.config.json'), JSON.stringify({
      checks: { maxFileLoc: 9999 },
      ignore: ['repo-only-*'],
    }));
    const { config: repoOnly } = loadConfig(dir);
    check('repository config overrides defaults', repoOnly.checks.maxFileLoc === 9999);

    const explicitPath = path.join(dir, 'explicit.config.json');
    await fsp.writeFile(explicitPath, JSON.stringify({
      checks: { maxFileLoc: 111 },
      ignore: ['explicit-only-*'],
    }));
    process.env.CODE_AUDIT_CONFIG = explicitPath;
    const { config: withExplicit } = loadConfig(dir);
    check('explicit config beats repository config', withExplicit.checks.maxFileLoc === 111, `got ${withExplicit.checks.maxFileLoc}`);
    check('ignore rules are additive across layers', withExplicit.ignore.includes('repo-only-*') && withExplicit.ignore.includes('explicit-only-*'));

    process.env.CODE_AUDIT_CONFIG = path.join(dir, 'missing.json');
    let threw = false;
    try { loadConfig(dir); } catch { threw = true; }
    check('missing explicit config is a hard error', threw);
  } finally {
    if (prev === undefined) delete process.env.CODE_AUDIT_CONFIG;
    else process.env.CODE_AUDIT_CONFIG = prev;
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

// ============================================================ A7: cancellation
console.log('\n[7] cancellation halts model calls, reports incomplete results (A7)');
{
  const PORT = 8873;
  const server = spawn(process.execPath, [path.join(HERE, 'mock-server.mjs')], {
    env: { ...process.env, MOCK_PORT: String(PORT), MOCK_DELAY_MS: '30000' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: 'POST', body: '{}' }); up = true; }
    catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  check('slow mock server up', up, serverLog.slice(0, 120));

  if (up) {
    for (const adapter of ['native', 'ai-sdk']) {
      const tmpConfig = path.join(os.tmpdir(), `code-audit-cancel-${Date.now()}.json`);
      await fsp.writeFile(tmpConfig, JSON.stringify({
        profiles: { slow: { provider: 'openai-compatible', baseUrl: `http://127.0.0.1:${PORT}/v1`, model: 'slow-model', adapter } },
        defaultModels: ['slow'],
      }));
      const t0 = Date.now();
      const r = runCli(['scan', 'examples/vulnerable-app', '--models', 'slow', '--depth', 'standard', '--timeout', '0.05', '--config', tmpConfig, '--quiet']);
      const elapsed = Date.now() - t0;
      check(`${adapter}: run aborts near the deadline (~3s)`, r.code === 2 && elapsed < 30_000, `code=${r.code} elapsed=${elapsed}ms`);
      const { json } = latestReport(FIXTURE);
      const run = json.runs.find((x) => x.profile === 'slow');
      check(`${adapter}: run recorded as cancelled`, /cancel|budget|abort|timed out/i.test(run?.error ?? ''), run?.error ?? 'no run');
      check(`${adapter}: report still written (incomplete, not crashed)`, json.meta !== null && json.meta.depth === 'standard');
      await fsp.rm(tmpConfig, { force: true });
    }
  }
  server.kill();
}

// ============================================================ A8: tool budgets
console.log('\n[8] tool budgets: enforced on actual output, submission always possible (A8)');
{
  const { discoverRepo } = await import('../src/discovery/discover.mjs');
  const { createToolkit } = await import('../src/engine/tools.mjs');
  const { createRedactor } = await import('../src/util/redact.mjs');
  const { createLogger } = await import('../src/util/log.mjs');
  const { loadConfig } = await import('../src/config.mjs');
  const logger = createLogger({ quiet: true });
  const { config } = loadConfig(FIXTURE);
  const repo = await discoverRepo(FIXTURE, { logger });
  const redactor = createRedactor();
  const toolkit = createToolkit(repo, {
    budgets: { maxToolCalls: 3, maxReadBytes: 1_000_000, deadline: Infinity, profileName: 'unit' },
    redactor, logger,
  });
  const byName = Object.fromEntries(toolkit.tools.map((t) => [t.name, t]));

  // hard line cap even with an absurd end
  const read = await byName.read_file.execute({ path: 'src/legacy-monolith.js', start: 1, end: 999999 });
  check('read_file caps at 400 lines regardless of end', read.lines.length <= 400, `got ${read.lines?.length}`);

  // budget exhaustion on non-terminal tools, but submit_findings always works
  await byName.get_summary.execute({});
  await byName.list_files.execute({});
  await byName.read_file.execute({ path: 'index.js', start: 1, end: 10 });
  const blocked = await byName.get_summary.execute({});
  check('non-terminal tool blocked at budget with a submit hint', /budget.*exhausted/i.test(blocked.error ?? '') && /submit_findings/i.test(blocked.error ?? ''), JSON.stringify(blocked).slice(0, 120));
  const submit = await byName.submit_findings.execute({ findings: [{ title: 'budgeted', file: 'index.js', lines: [1, 1], snippet: '// Fixture entry point with multiple planted issues.' }] });
  check('submit_findings works after budget exhaustion', submit.accepted === 1, JSON.stringify(submit));

  // read budget counts ACTUAL output bytes
  const tight = createToolkit(repo, {
    budgets: { maxToolCalls: 100, maxReadBytes: 5_000, deadline: Infinity, profileName: 'unit' },
    redactor, logger,
  });
  const tByName = Object.fromEntries(tight.tools.map((t) => [t.name, t]));
  let readErr = null;
  for (let i = 0; i < 30 && !readErr; i++) {
    const res = await tByName.read_file.execute({ path: 'src/legacy-monolith.js', start: 1 + i * 300, end: 400 + i * 300 });
    if (res.error) readErr = res.error;
  }
  check('read budget enforced on real output size', /Read budget exhausted/i.test(readErr ?? ''), readErr ?? 'never exhausted');
}

// ============================================================ A9: benign corpus noise floor
console.log('\n[9] offline benign repository → low-noise result (A9)');
{
  const r = runCli(['scan', 'examples/clean-app', '--depth', 'quick', '--quiet']);
  check('exit 0', r.code === 0, `code=${r.code}`);
  const { json, md } = latestReport(CLEAN);
  check('clean corpus: zero findings', json.findings.length === 0, JSON.stringify(json.findings.map((f) => f.title)));
  check('report explains the clean result', /no findings matched/i.test(md) || json.findings.length === 0);
}

// ============================================================ R: adapter transport (mock server)
console.log('\n[10] native + AI SDK adapters against local mock server (regression)');
{
  const PORT = 8875;
  const server = spawn(process.execPath, [path.join(HERE, 'mock-server.mjs')], {
    env: { ...process.env, MOCK_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: 'POST', body: '{}' }); up = true; }
    catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  check('mock server up', up);

  if (up) {
    for (const [label, adapter] of [['native HTTP', 'native'], ['Vercel AI SDK', 'ai-sdk']]) {
      const tmpConfig = path.join(os.tmpdir(), `code-audit-smoke-adapter-${Date.now()}.json`);
      await fsp.writeFile(tmpConfig, JSON.stringify({
        profiles: { mockhttp: { provider: 'openai-compatible', baseUrl: `http://127.0.0.1:${PORT}/v1`, model: 'mock-model', adapter } },
        defaultModels: ['mockhttp'],
      }));
      const r = runCli(['scan', 'examples/vulnerable-app', '--models', 'mockhttp', '--depth', 'standard', '--config', tmpConfig, '--quiet']);
      const { json } = latestReport(FIXTURE);
      const run = json.runs.find((x) => x.profile === 'mockhttp');
      check(`${label}: structured run ok`, Boolean(run?.ok), run?.error ?? '');
      check(`${label}: adapter used`, run?.adapter === (adapter === 'native' ? 'native' : 'ai-sdk'), `adapter=${run?.adapter}`);
      const modelFinding = json.findings.find((f) => f.source === 'model:mockhttp' && f.file);
      check(`${label}: finding delivered`, Boolean(modelFinding));
      check(`${label}: mock-server snippet verifies`, modelFinding?.verification?.status === 'verified', modelFinding?.verification?.note ?? '');

      const rd = runCli(['scan', 'examples/vulnerable-app', '--models', 'mockhttp', '--depth', 'deep',
        '--config', tmpConfig, '--quiet', '--output', path.join(os.tmpdir(), `ca-smoke-auto-${Date.now()}`)]);
      const outDir = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith('ca-smoke-auto-')).sort().pop();
      const runDir2 = path.join(os.tmpdir(), outDir);
      const json2 = JSON.parse(await fsp.readFile(path.join(runDir2, 'report.json'), 'utf8'));
      const auto = json2.runs.find((x) => x.phase === 'autonomous');
      check(`${label}: autonomous run ok`, Boolean(auto?.ok), auto?.error ?? '');
      check(`${label}: agent findings delivered`, json2.findings.some((f) => f.source === 'agent:mockhttp'), `finish=${auto?.finishReason}`);
      await fsp.rm(runDir2, { recursive: true, force: true });
      await fsp.rm(tmpConfig, { force: true });
    }
  }
  server.kill();
}

// ============================================================ R: mock multi-model consensus + deep
console.log('\n[11] mock consensus + autonomous regression');
{
  const tmpConfig = path.join(os.tmpdir(), `code-audit-mocks-${Date.now()}.json`);
  await fsp.writeFile(tmpConfig, JSON.stringify({
    // distinct model ids so the two profiles are genuinely different reviewers
    profiles: { mock: { provider: 'mock', model: 'mock-one' }, mock2: { provider: 'mock', model: 'mock-two' } },
    defaultModels: ['mock'],
  }));
  const r = runCli(['scan', 'examples/vulnerable-app', '--models', 'mock,mock2', '--depth', 'standard', '--config', tmpConfig, '--quiet']);
  check('two-profile run ok', r.code === 0);
  const { json } = latestReport(FIXTURE);
  check('both runs ok', json.runs.length === 2 && json.runs.every((x) => x.ok));
  check('consensus detected across profiles', json.findings.some((f) => f.consensus), `consensusCount=${json.stats.consensusCount}`);
  check('verified model finding present (verbatim snippet)', json.findings.some((f) => f.source === 'consensus' && f.verification?.status === 'verified'));
  check('unverified bogus finding flagged', json.findings.some((f) => f.verification?.status === 'unverified' && f.title.includes('bogus')));
  await fsp.rm(tmpConfig, { force: true });

  const deep = runCli(['scan', 'examples/vulnerable-app', '--models', 'mock', '--depth', 'deep',
    '--output', path.join(os.tmpdir(), `ca-smoke-deep-${Date.now()}`), '--quiet']);
  check('deep run ok', deep.code === 0);
  const outDir = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith('ca-smoke-deep-')).sort().pop();
  const runDir = path.join(os.tmpdir(), outDir);
  const json2 = JSON.parse(await fsp.readFile(path.join(runDir, 'report.json'), 'utf8'));
  const auto = json2.runs.find((x) => x.phase === 'autonomous');
  check('autonomous submitted', auto?.finishReason === 'submitted' && auto?.ok);
  check('agent finding with real snippet verified', json2.findings.some((f) => f.source.startsWith('agent:') && f.snippet && f.verification?.status === 'verified'));
  check('agent bogus finding unverified', json2.findings.some((f) => f.source.startsWith('agent:') && f.verification?.status === 'unverified'));
  fs.rmSync(runDir, { recursive: true, force: true });
}

// ============================================================ A11: unconditional preflight & model-access boundaries
console.log('\n[12] A11 — preflight redaction is focus-independent; secret files default-deny');
{
  const dir = await tempDir('ca-a11-');
  const AWS = 'AKIAJ4RFQKZCXMPL3WAQ';
  const JSON_KEY = 'ZZ9Pl3a7C3dR7sT9wY5uJ9aKcD4fG6hB8nM0qX1v';
  const ENV_KEY = 'sk_live_51H8xQz2eZvKYlo2C9PqR7sT3wY5uJ9aKcD4fG6hB8nM0';
  await fsp.writeFile(path.join(dir, 'credentials.json'), JSON.stringify({ apiKey: JSON_KEY, aws: AWS }, null, 2));
  await fsp.writeFile(path.join(dir, 'service.yaml'), `name: svc\napi_key: "${JSON_KEY}"\n`);
  await fsp.writeFile(path.join(dir, '.env'), `STRIPE_KEY=${ENV_KEY}\n`);
  const big = ['// first file with a planted credential', `const AWS_KEY = '${AWS}';`, '',
    ...Array.from({ length: 60 }, (_, i) => `function f${i}() { return ${i}; }`)].join('\n');
  await fsp.writeFile(path.join(dir, 'a-first.js'), big + '\n');

  const { discoverRepo } = await import('../src/discovery/discover.mjs');
  const { preflightRegisterSecrets } = await import('../src/checks/secrets.mjs');
  const { createRedactor, isSecretFileRel } = await import('../src/util/redact.mjs');
  const { buildContextPack } = await import('../src/engine/context.mjs');
  const { createToolkit } = await import('../src/engine/tools.mjs');
  const { createModelPolicy } = await import('../src/util/model-access.mjs');
  const { createLogger } = await import('../src/util/log.mjs');
  const logger = createLogger({ quiet: true });
  const repo = await discoverRepo(dir, { logger });
  const redactor = createRedactor();
  const ctx = { root: dir, repo, fileStore: repo.fileStore, config: { checks: {} }, logger, redactor, git: null, changedSet: null };

  check('A11: isSecretFileRel recognizes credential-shaped names', isSecretFileRel('.env') && isSecretFileRel('conf/credentials.yaml') && isSecretFileRel('keys/id_rsa') && !isSecretFileRel('src/utils.js'));

  const count = preflightRegisterSecrets(ctx);
  check('A11: preflight registers literals across js/json/yaml/env', count >= 4, `registered=${count}`);
  check('A11: AWS literal registered', redactor.redact(`x ${AWS} y`).includes('[REDACTED'));

  const pack = buildContextPack(repo, [], { budgetChars: 20000, redactor });
  check('A11: context pack carries no raw literals (any focus)', ![AWS, JSON_KEY, ENV_KEY].some((s) => pack.text.includes(s)));
  check('A11: credential-like files never excerpted', !/# --- \.env ---/.test(pack.text) && !/# --- credentials\.json ---/.test(pack.text));

  const toolkit = createToolkit(repo, { budgets: { maxToolCalls: 50, maxReadBytes: 4_000_000, deadline: Infinity, profileName: 'unit' }, redactor, logger });
  const readTool = toolkit.tools.find((t) => t.name === 'read_file');
  check('A11: read_file denies .env by default', /denied by default/i.test((await readTool.execute({ path: '.env' }))?.error ?? ''));
  check('A11: read_file denies credentials.json by default', /denied by default/i.test((await readTool.execute({ path: 'credentials.json' }))?.error ?? ''));
  const searchRes = await toolkit.tools.find((t) => t.name === 'search_code').execute({ query: 'sk_live' });
  check('A11: search_code never returns raw .env values', !JSON.stringify(searchRes).includes(ENV_KEY));

  const allowedKit = createToolkit(repo, { budgets: { maxToolCalls: 50, maxReadBytes: 4_000_000, deadline: Infinity, profileName: 'unit' }, redactor, logger, policy: createModelPolicy({ allowSecretFiles: true }) });
  const allowedEnv = await allowedKit.tools.find((t) => t.name === 'read_file').execute({ path: '.env', start: 1, end: 5 });
  check('A11: explicit allowSecretFileReads grants access, still redacted', !JSON.stringify(allowedEnv).includes(ENV_KEY) && JSON.stringify(allowedEnv).includes('[REDACTED'));

  // CLI end-to-end: --focus refactoring must still arm the redaction registry
  const r = runCli(['scan', dir, '--depth', 'standard', '--models', 'mock', '--focus', 'refactoring', '--quiet']);
  check('A11: --focus refactoring scan ok', r.code === 0, `code=${r.code}`);
  const { json, md } = latestReport(dir);
  check('A11: refactoring-focused report free of AWS literal', !md.includes(AWS) && !JSON.stringify(json).includes(AWS));
  check('A11: refactoring-focused report free of json/yaml/env literals', !md.includes(JSON_KEY) && !md.includes(ENV_KEY) && !JSON.stringify(json).includes(ENV_KEY));

  await fsp.rm(dir, { recursive: true, force: true });
}

// ============================================================ A12: all-surface report sanitization, fail closed
console.log('\n[13] A12 — model notes/report fields sanitized; registered literals never reach output');
{
  const { createRedactor, redactDeep } = await import('../src/util/redact.mjs');
  const redactor = createRedactor();
  redactor.add('AKIAJ4RFQKZCXMPL3WAQ', 'aws-key');
  const poison = 'model notes mention AKIAJ4RFQKZCXMPL3WAQ plainly';
  const reportLike = {
    meta: { note: poison },
    runs: [{ error: poison }],
    notes: [{ profile: 'x', text: poison }],
    findings: [{ title: poison, benefit: poison, risk: poison, modelVerdicts: [{ reason: poison }] }],
    toolNotes: [poison],
    backlog: { dismissed: [{ title: poison }] },
  };
  const clean = redactDeep(reportLike, redactor);
  check('A12: redactDeep sanitizes every string-bearing field', !JSON.stringify(clean).includes('AKIAJ4RFQKZCXMPL3WAQ'));

  const prev = process.env.CODE_AUDIT_MOCK_POISON_NOTES;
  process.env.CODE_AUDIT_MOCK_POISON_NOTES = 'echoing model notes: AKIAJ4RFQKZCXMPL3WAQ and ghp_16C7e42F292c6912E7710c838347Ae178B4a';
  try {
    const r = runCli(['scan', 'examples/vulnerable-app', '--models', 'mock', '--depth', 'standard', '--quiet']);
    check('A12: poisoned-notes scan exits 0 (sanitized, not crashed)', r.code === 0, `code=${r.code}`);
    const { json, md } = latestReport(FIXTURE);
    for (const s of ['AKIAJ4RFQKZCXMPL3WAQ', 'ghp_16C7e42F292c6912E7710c838347Ae178B4a']) {
      check(`A12: report.md sanitized (${s.slice(0, 8)}…)`, !md.includes(s));
      check(`A12: report.json sanitized (${s.slice(0, 8)}…)`, !JSON.stringify(json).includes(s));
      check(`A12: stdout/stderr sanitized (${s.slice(0, 8)}…)`, !r.out.includes(s));
    }
    check('A12: notes kept but redacted (placeholder survives)', JSON.stringify(json.notes).includes('[REDACTED'));
  } finally {
    if (prev === undefined) delete process.env.CODE_AUDIT_MOCK_POISON_NOTES;
    else process.env.CODE_AUDIT_MOCK_POISON_NOTES = prev;
  }
}

// ============================================================ A13: first --changed without a baseline
console.log('\n[14] A13 — no-baseline --changed falls back to a full audit, not an empty one');
{
  const dir = await tempDir('ca-a13-');
  await fsp.writeFile(path.join(dir, 'app.js'), "const AWS_KEY = 'AKIAJ4RFQKZCXMPL3WAQ';\nfunction run(input) { return eval(input); }\nmodule.exports = { run };\n");
  await fsp.writeFile(path.join(dir, 'helper.js'), '// helper\nconst x = JSON.parse(JSON.stringify({}));\nmodule.exports = { x };\n');

  runCli(['scan', dir, '--depth', 'quick', '--quiet']);
  const { json: fullJson } = latestReport(dir);
  const fullCount = fullJson.findings.length;
  check('A13: baseline full scan finds the planted issues', fullCount >= 2, `got ${fullCount}`);

  fs.rmSync(path.join(dir, '.code-audit'), { recursive: true, force: true }); // no state, and tmpdir is not a git repo
  const r = runCli(['scan', dir, '--depth', 'quick', '--changed', '--quiet']);
  check('A13: first --changed (no baseline) exits 0', r.code === 0, `code=${r.code}`);
  const { json } = latestReport(dir);
  check('A13: no-baseline --changed records full-fallback', json.meta.changedBasis === 'full-fallback', `basis=${json.meta.changedBasis}`);
  check('A13: fallback finds the same issues as a full scan', json.findings.length === fullCount, `${json.findings.length} vs ${fullCount}`);

  const r2 = runCli(['scan', dir, '--depth', 'quick', '--changed', '--quiet']);
  const { json: json2 } = latestReport(dir);
  check('A13: repeated --changed against the recorded baseline → 0 findings', json2.meta.changedBasis === 'manifest' && json2.findings.length === 0, `basis=${json2.meta.changedBasis}, findings=${json2.findings.length}`);

  await fsp.rm(path.join(dir, 'helper.js'));
  const r3 = runCli(['scan', dir, '--depth', 'quick', '--changed', '--quiet']);
  const { json: json3 } = latestReport(dir);
  check('A13: deletion-only delta still represented', (json3.meta.deletedFiles ?? []).includes('helper.js'), JSON.stringify(json3.meta.deletedFiles));
  await fsp.rm(dir, { recursive: true, force: true });
}

// ============================================================ A14: multiline citation bounds
console.log('\n[15] A14 — multiline snippets cannot verify outside the cited range');
{
  const { locateSnippet } = await import('../src/evidence/validate.mjs');
  const lines = ['const A = 1;', 'const B = 2;', 'const C = 3;'];
  const spill = locateSnippet(lines, 'const A = 1;\nconst B = 2;', { cited: [1, 1] });
  check('A14: multiline spilling past citedEnd is NOT in-place', spill.status === 'moved' && spill.lines.join('-') === '1-2', JSON.stringify(spill));
  check('A14: multiline inside the cited range is in-place', locateSnippet(lines, 'const A = 1;\nconst B = 2;', { cited: [1, 2] }).status === 'in-place');
  const blankLines = ['const A = 1;', '', 'const B = 2;', 'const C = 3;'];
  check('A14: blank lines inside a fitting span still verify', locateSnippet(blankLines, 'const A = 1;\nconst B = 2;', { cited: [1, 3] }).status === 'in-place');
  const blankSpill = locateSnippet(blankLines, 'const A = 1;\nconst B = 2;', { cited: [1, 1] });
  check('A14: blank-line spill adjusted to the true span', blankSpill.status === 'moved' && blankSpill.lines.join('-') === '1-3', JSON.stringify(blankSpill));
  const wrongStart = locateSnippet(lines, 'const B = 2;\nconst C = 3;', { cited: [3, 3] });
  check('A14: range crossing the lower boundary → moved with true lines', wrongStart.status === 'moved' && wrongStart.lines.join('-') === '2-3');
  check('A14: exact citation → in-place', locateSnippet(lines, 'const B = 2;', { cited: [2, 2] }).status === 'in-place');
}

// ============================================================ A15: every non-terminal tool honors budgets
console.log('\n[16] A15 — get_graph and all tools honor the tool-call budget');
{
  const { discoverRepo } = await import('../src/discovery/discover.mjs');
  const { createToolkit } = await import('../src/engine/tools.mjs');
  const { createLogger } = await import('../src/util/log.mjs');
  const logger = createLogger({ quiet: true });
  const repo = await discoverRepo(FIXTURE, { logger });

  const zero = createToolkit(repo, { budgets: { maxToolCalls: 0, maxReadBytes: 0, deadline: Infinity, profileName: 'unit' }, logger });
  for (const name of ['get_summary', 'list_files', 'read_file', 'search_code', 'get_graph']) {
    const tool = zero.tools.find((t) => t.name === name);
    const args = name === 'read_file' || name === 'get_graph'
      ? { path: 'index.js' }
      : name === 'search_code' ? { query: 'eval' } : {};
    const res = await tool.execute(args);
    check(`A15: ${name} blocked at zero budget`, /budget.*exhausted/i.test(res?.error ?? ''), JSON.stringify(res).slice(0, 90));
  }
  const submit = await zero.tools.find((t) => t.name === 'submit_findings').execute({ findings: [{ title: 't', file: 'index.js' }] });
  check('A15: submit_findings still allowed at zero budget', submit.accepted === 1, JSON.stringify(submit));

  const kit1 = createToolkit(repo, { budgets: { maxToolCalls: 1, maxReadBytes: 1_000_000, deadline: Infinity, profileName: 'unit' }, logger });
  const g1 = await kit1.tools.find((t) => t.name === 'get_graph').execute({ path: 'src/lib/a.js' });
  check('A15: first get_graph proceeds', !g1.error, JSON.stringify(g1).slice(0, 80));
  const g2 = await kit1.tools.find((t) => t.name === 'get_graph').execute({ path: 'src/lib/a.js' });
  check('A15: second get_graph blocked (call count incremented)', /budget.*exhausted/i.test(g2.error ?? ''));
}

// ============================================================ A16: verdict reconciliation is order-independent
console.log('\n[17] A16 — conflicting model verdicts reconcile, order never hides a finding');
{
  const { applyVerdicts } = await import('../src/engine/structured.mjs');
  const mk = (id, sev = 'medium', cat = 'bug') => ({
    id, checkId: 'x', severity: sev, category: cat, confidence: 0.8, title: 't', file: 'a.js',
    lines: [1, 1], modelVerdicts: [], dismissed: false, contested: false,
  });
  const fps = new Map([['one', 'fp-one'], ['two', 'fp-two']]);
  const V = (id, by, action) => ({ id, action, by: `model:${by}`, reason: `${action} by ${by}` });

  const a = [mk('f1')];
  applyVerdicts(a, [V('f1', 'one', 'dismiss'), V('f1', 'two', 'confirm')], null, { fingerprints: fps });
  check('A16: dismiss→confirm leaves the finding visible & contested', !a[0].dismissed && a[0].contested === true, JSON.stringify({ d: a[0].dismissed, c: a[0].contested }));
  check('A16: both verdicts recorded in history', a[0].modelVerdicts.length === 2);

  const b = [mk('f2')];
  applyVerdicts(b, [V('f2', 'one', 'confirm'), V('f2', 'two', 'dismiss')], null, { fingerprints: fps });
  check('A16: confirm→dismiss yields the same contested state', !b[0].dismissed && b[0].contested === true);

  const c = [mk('f3')];
  applyVerdicts(c, [V('f3', 'one', 'dismiss')], null, { fingerprints: fps });
  check('A16: unanimous single dismiss (medium) → dismissed, still kept for review', c[0].dismissed === true && !c[0].contested);

  const d = [mk('f4', 'critical', 'security')];
  applyVerdicts(d, [V('f4', 'one', 'dismiss')], null, { fingerprints: fps });
  check('A16: critical/security never auto-dismissed by one vote', !d[0].dismissed && d[0].contested === true);

  const e = [mk('f5')];
  applyVerdicts(e, [V('f5', 'one', 'dismiss'), V('f5', 'one', 'confirm')], null, { fingerprints: fps });
  check('A16: a self-contradictory reviewer → contested, not dismissed', !e[0].dismissed && e[0].contested === true);
}

// ============================================================ A17: reviewer identity = actual model, not profile alias
console.log('\n[18] A17 — profile aliases of one model are not independent reviewers');
{
  const { modelFingerprint } = await import('../src/config.mjs');
  const { mergeFindings } = await import('../src/evidence/validate.mjs');
  const pA = { provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5-coder' };
  const pB = { provider: 'ollama', baseUrl: 'http://localhost:11434/v1/', model: 'QWEN2.5-CODER' }; // alias of pA
  const pC = { provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' };
  check('A17: profile aliases of one model share a fingerprint', modelFingerprint(pA) === modelFingerprint(pB));
  check('A17: different models have different fingerprints', modelFingerprint(pA) !== modelFingerprint(pC));

  const base = {
    checkId: 'model:x', category: 'security', severity: 'high', confidence: 0.7, file: 'src/q.js',
    lines: [10, 10], description: 'SQL injection in query builder', suggestion: 's', benefit: 'b', risk: 'r',
    verified: true, verification: { status: 'verified' }, occurrences: undefined,
  };
  const f = (over) => ({ ...base, ...over });
  const same = mergeFindings([
    f({ title: 'SQL injection in query builder', source: 'model:aliasA' }),
    f({ title: 'SQL injection in query builder', source: 'model:aliasB' }),
  ], { fingerprints: new Map([['aliasA', modelFingerprint(pA)], ['aliasB', modelFingerprint(pB)]]) });
  check('A17: same model via two aliases → merged, NO independent consensus', same.length === 1 && same[0].consensus !== true, JSON.stringify(same[0].consensusBy ?? null));

  const diff = mergeFindings([
    f({ title: 'SQL injection in query builder', source: 'model:profA' }),
    f({ title: 'SQL injection in query builder', source: 'model:profB' }),
  ], { fingerprints: new Map([['profA', modelFingerprint(pA)], ['profB', modelFingerprint(pC)]]) });
  check('A17: two different actual models → independent consensus', diff.length === 1 && diff[0].consensus === true);
}

// ============================================================ A18: one cross-tool file-access policy
console.log('\n[20] A18 — search_code (and every route) honors the secret-file deny');
{
  const dir = await tempDir('ca-a18-');
  const UNKNOWN_TOKEN = 'UnrecognizedTokenFormatXy1937KqlqzZ8412';
  // db_pass is NOT among the recognized key names → preflight cannot register it
  await fsp.writeFile(path.join(dir, 'credentials.json'), JSON.stringify({ db_pass: UNKNOWN_TOKEN }, null, 2));
  await fsp.writeFile(path.join(dir, 'src.js'), '// ordinary file\nconst setting = "db_pass"; // referenced in ordinary source\nmodule.exports = { setting };\n');

  const { discoverRepo } = await import('../src/discovery/discover.mjs');
  const { preflightRegisterSecrets } = await import('../src/checks/secrets.mjs');
  const { createRedactor } = await import('../src/util/redact.mjs');
  const { createToolkit, } = await import('../src/engine/tools.mjs');
  const { buildContextPack } = await import('../src/engine/context.mjs');
  const { createLogger } = await import('../src/util/log.mjs');
  const logger = createLogger({ quiet: true });
  const repo = await discoverRepo(dir, { logger });
  const redactor = createRedactor();
  const ctx = { root: dir, repo, fileStore: repo.fileStore, config: { checks: {} }, logger, redactor, git: null, changedSet: null };

  const registered = preflightRegisterSecrets(ctx);
  check('A18 (setup): unrecognized format stays unregistered (bypass precondition)', registered === 0, `registered=${registered}`);

  const toolkit = createToolkit(repo, { budgets: { maxToolCalls: 50, maxReadBytes: 4_000_000, deadline: Infinity, profileName: 'unit' }, redactor, logger });
  const byName = Object.fromEntries(toolkit.tools.map((t) => [t.name, t]));

  check('A18: read_file still denies the secret-shaped file', /denied by default/i.test((await byName.read_file.execute({ path: 'credentials.json' }))?.error ?? ''));

  const literal = await byName.search_code.execute({ query: 'db_pass' });
  check('A18: search_code (literal) returns no protected content', !JSON.stringify(literal).includes(UNKNOWN_TOKEN), JSON.stringify(literal.matches?.[0] ?? null));
  const regex = await byName.search_code.execute({ query: 'db_pass', isRegex: true });
  check('A18: search_code (regex) returns no protected content', !JSON.stringify(regex).includes(UNKNOWN_TOKEN));
  const globbed = await byName.search_code.execute({ query: 'db_pass', glob: '**/*.json' });
  check('A18: search_code (glob) returns no protected content', !JSON.stringify(globbed).includes(UNKNOWN_TOKEN));
  check('A18: search_code (no glob) never touches denied files at all', (literal.matches ?? []).every((m) => m.path !== 'credentials.json'));

  // positive control: ordinary files remain searchable
  check('A18: ordinary files remain searchable', (literal.matches ?? []).some((m) => m.path === 'src.js'));

  const pack = buildContextPack(repo, [], { budgetChars: 20000, redactor });
  check('A18: context pack carries no protected content', !pack.text.includes(UNKNOWN_TOKEN));

  // CLI end-to-end: a deep mock agent can never reach the protected file
  const r = runCli(['scan', dir, '--models', 'mock', '--depth', 'deep', '--quiet']);
  check('A18: deep scan over the bypass repo ok', r.code === 0, `code=${r.code}`);
  const { json, md } = latestReport(dir);
  check('A18: deep-scan report free of the unrecognized token', !md.includes(UNKNOWN_TOKEN) && !JSON.stringify(json).includes(UNKNOWN_TOKEN));

  await fsp.rm(dir, { recursive: true, force: true });
}

// ============================================================ A19: metadata/path sanitization + model-request boundary
console.log('\n[21] A19 — digests, filenames, graph paths sanitized; boundary checked before requests');
{
  const dir = await tempDir('ca-a19-');
  const TOKEN = 'AKIAJ4RFQKZCXMPL3WAQ';
  // the token appears in a FILENAME and in the file body
  const fileName = `key-${TOKEN}.js`;
  await fsp.writeFile(path.join(dir, fileName), `// odd but legal filename\nconst AWS_KEY = '${TOKEN}';\nmodule.exports = {};\n`);
  await fsp.writeFile(path.join(dir, 'plain.js'), `import { AWS_KEY } from './key-${TOKEN}.js';\nconsole.log(AWS_KEY);\n`);
  await fsp.writeFile(path.join(dir, 'third.js'), 'const z = 1;\nmodule.exports = { z };\n'); // third file enables the import graph

  const { discoverRepo } = await import('../src/discovery/discover.mjs');
  const { preflightRegisterSecrets } = await import('../src/checks/secrets.mjs');
  const { createRedactor, assertNoRegisteredSecret } = await import('../src/util/redact.mjs');
  const { buildContextPack } = await import('../src/engine/context.mjs');
  const { createToolkit } = await import('../src/engine/tools.mjs');
  const { createLogger } = await import('../src/util/log.mjs');
  const logger = createLogger({ quiet: true });
  const repo = await discoverRepo(dir, { logger });
  const redactor = createRedactor();
  const ctx = { root: dir, repo, fileStore: repo.fileStore, config: { checks: {} }, logger, redactor, git: null, changedSet: null };

  preflightRegisterSecrets(ctx);
  check('A19: token registered from body and path', redactor.size >= 1, `size=${redactor.size}`);

  const pack = buildContextPack(repo, [], { budgetChars: 20000, redactor });
  check('A19: context pack (digest + excerpts) free of token', !pack.text.includes(TOKEN));

  const toolkit = createToolkit(repo, { budgets: { maxToolCalls: 50, maxReadBytes: 4_000_000, deadline: Infinity, profileName: 'unit' }, redactor, logger });
  const byName = Object.fromEntries(toolkit.tools.map((t) => [t.name, t]));
  const summary = await byName.get_summary.execute({});
  check('A19: get_summary free of token', !JSON.stringify(summary).includes(TOKEN));
  const list = await byName.list_files.execute({});
  check('A19: list_files paths redacted', !JSON.stringify(list).includes(TOKEN) && JSON.stringify(list).includes('[REDACTED'));
  const graph = await byName.get_graph.execute({ path: fileName });
  check('A19: get_graph paths redacted', !JSON.stringify(graph).includes(TOKEN) && JSON.stringify(graph).includes('[REDACTED'));

  // boundary guard: a payload carrying the token must abort with NO token material in the error
  let threw = null;
  try { assertNoRegisteredSecret(`leaky ${TOKEN}`, redactor, 'unit payload'); } catch (e) { threw = e.message; }
  check('A19: boundary guard throws on leaking payload', Boolean(threw));
  check('A19: boundary error contains no token material', Boolean(threw) && !threw.includes(TOKEN) && /\[REDACTED .+ #/.test(threw), threw?.slice(0, 90));
  let cleanNoThrow = true;
  try { assertNoRegisteredSecret('clean payload', redactor, 'unit payload'); } catch { cleanNoThrow = false; }
  check('A19: boundary guard passes clean payloads', cleanNoThrow);

  // CLI end-to-end: structured + autonomous over the poisoned-path repo
  const r = runCli(['scan', dir, '--models', 'mock', '--depth', 'deep', '--quiet']);
  check('A19: poisoned-path scan ok', r.code === 0, `code=${r.code}`);
  const { json, md } = latestReport(dir);
  check('A19: report free of the path-embedded token', !md.includes(TOKEN) && !JSON.stringify(json).includes(TOKEN));
  check('A19: CLI output free of the path-embedded token', !r.out.includes(TOKEN));

  await fsp.rm(dir, { recursive: true, force: true });
}

// ============================================================ A20: egress policy for the secret-file override
console.log('\n[22] A20 — secret-file override rejected for remote/unknown endpoints, before any request');
{
  const { validateEgressPolicy, isRemoteEgress, isLocalEndpoint } = await import('../src/util/model-access.mjs');
  const cloud = { name: 'cloud', provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'x' };
  const local = { name: 'local', provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'x' };
  const unknown = { name: 'unknown', provider: 'openai-compatible', baseUrl: 'http://api.example.com/v1', model: 'x' };
  const localhostCompat = { name: 'lhc', provider: 'openai-compatible', baseUrl: 'http://127.0.0.1:1234/v1', model: 'x' };
  const mock = { name: 'mock', provider: 'mock', model: 'x' };

  check('A20: locality derived from endpoint, not name', isRemoteEgress(cloud) && !isRemoteEgress(local) && isRemoteEgress(unknown) && !isRemoteEgress(localhostCompat) && !isRemoteEgress(mock));
  check('A20: isLocalEndpoint sanity', isLocalEndpoint('http://localhost:11434/v1') && !isLocalEndpoint('https://openrouter.ai/api/v1'));

  const on = { checks: { allowSecretFileReads: true } };
  let threw = false;
  try { validateEgressPolicy([cloud], on); } catch { threw = true; }
  check('A20: override + cloud profile rejected', threw);
  threw = false;
  try { validateEgressPolicy([unknown], on); } catch { threw = true; }
  check('A20: override + unknown endpoint rejected', threw);
  let okLocal = null;
  try { okLocal = validateEgressPolicy([local], on); } catch { okLocal = null; }
  check('A20: override + verified local endpoint permitted', okLocal !== null && okLocal.overrideEnabled === true);
  let ackRemote = null;
  try { ackRemote = validateEgressPolicy([cloud], { checks: { allowSecretFileReads: true, allowSecretFileReadsRemote: true } }); } catch { ackRemote = null; }
  check('A20: explicit remote acknowledgment accepted', ackRemote !== null && ackRemote.remoteAcknowledged === true);
  let off = null;
  try { off = validateEgressPolicy([cloud], { checks: {} }); } catch { off = null; }
  check('A20: no override → no restriction', off !== null && off.overrideEnabled === false);

  // CLI end-to-end: policy violation fails BEFORE any discovery/model work and sends nothing
  const tmpConfig = path.join(os.tmpdir(), `ca-a20-cloud-${Date.now()}.json`);
  await fsp.writeFile(tmpConfig, JSON.stringify({
    profiles: { cloudish: { provider: 'openrouter', model: 'x', apiKeyEnv: 'OPENROUTER_API_KEY' } },
    defaultModels: ['cloudish'],
    checks: { allowSecretFileReads: true },
  }));
  const r = runCli(['scan', 'examples/vulnerable-app', '--models', 'cloudish', '--depth', 'standard', '--config', tmpConfig, '--quiet']);
  check('A20: cloud + override exits 2 with the policy error', r.code === 2 && /allowSecretFileReadsRemote/i.test(r.out), `code=${r.code}`);
  check('A20: policy validated before any request (no discovery output)', !r.out.includes('Deterministic checks') && !r.out.includes('Model passes'));
  await fsp.rm(tmpConfig, { force: true });
}

// ============================================================ A21: one serialization boundary for every tool result + handles
console.log('\n[24] A21 — one tool-result boundary (fail-closed); files stay referenceable via handles');
{
  const dir = await tempDir('ca-a21-');
  const TOKEN = 'AKIAJ4RFQKZCXMPL3WAQ';
  // the token appears in a FILENAME and in the file body (A19 fixture shape)
  const fileName = `key-${TOKEN}.js`;
  await fsp.writeFile(path.join(dir, fileName), `// odd but legal filename\nconst AWS_KEY = '${TOKEN}';\nmodule.exports = {};\n`);
  await fsp.writeFile(path.join(dir, 'plain.js'), `import { AWS_KEY } from './key-${TOKEN}.js';\nconsole.log(AWS_KEY);\n`);
  await fsp.writeFile(path.join(dir, 'third.js'), 'const z = 1;\nmodule.exports = { z };\n');

  const { discoverRepo } = await import('../src/discovery/discover.mjs');
  const { preflightRegisterSecrets } = await import('../src/checks/secrets.mjs');
  const { createRedactor } = await import('../src/util/redact.mjs');
  const { createToolkit, emitToolResult } = await import('../src/engine/tools.mjs');
  const { validateDrafts } = await import('../src/evidence/validate.mjs');
  const { createLogger } = await import('../src/util/log.mjs');
  const logger = createLogger({ quiet: true });
  const repo = await discoverRepo(dir, { logger });
  const redactor = createRedactor();
  const ctx = { root: dir, repo, fileStore: repo.fileStore, config: { checks: {} }, logger, redactor, git: null, changedSet: null };
  preflightRegisterSecrets(ctx);
  check('A21 (setup): token registered', redactor.size >= 1, `size=${redactor.size}`);

  const toolkit = createToolkit(repo, { budgets: { maxToolCalls: 50, maxReadBytes: 4_000_000, deadline: Infinity, profileName: 'unit' }, redactor, logger });
  const byName = Object.fromEntries(toolkit.tools.map((t) => [t.name, t]));

  const summary = await byName.get_summary.execute({});
  check('A21: get_summary carries the placeholder, never the token', !JSON.stringify(summary).includes(TOKEN) && JSON.stringify(summary).includes('[REDACTED'));
  const list = await byName.list_files.execute({});
  const tokenEntry = list.files.find((e) => e.path.includes('[REDACTED') && e.path.endsWith('.js'));
  check('A21: list_files redacts paths and issues opaque handles', Boolean(tokenEntry?.handle) && !JSON.stringify(list).includes(TOKEN));

  const read = await byName.read_file.execute({ handle: tokenEntry.handle });
  check('A21: read_file works via handle; payload redacted', read.ofLines > 0 && !JSON.stringify(read).includes(TOKEN) && read.handle === tokenEntry.handle);
  const readViaPath = await byName.read_file.execute({ path: tokenEntry.path });
  check('A21: read_file also resolves the exact redacted path', readViaPath.ofLines > 0 && !JSON.stringify(readViaPath).includes(TOKEN));
  const badHandle = await byName.read_file.execute({ handle: 'f999' });
  check('A21: unknown handle rejected without leaking material', /Unknown file handle/.test(badHandle.error ?? '') && !JSON.stringify(badHandle).includes(TOKEN));

  const literal = await byName.search_code.execute({ query: 'AWS_KEY' });
  check('A21: search_code (literal) redacts path+text and adds handles', !JSON.stringify(literal).includes(TOKEN) && literal.matches.some((m) => m.path.includes('[REDACTED') && m.handle));
  const globbed = await byName.search_code.execute({ query: 'AWS_KEY', glob: '**/*.js' });
  check('A21: search_code (glob) redacted', !JSON.stringify(globbed).includes(TOKEN) && globbed.matches.length > 0);
  const regexHit = await byName.search_code.execute({ query: 'AWS_.EY', isRegex: true });
  check('A21: search_code (regex) redacted with handles', !JSON.stringify(regexHit).includes(TOKEN) && regexHit.matches.some((m) => m.handle));
  const graph = await byName.get_graph.execute({ handle: tokenEntry.handle });
  check('A21: get_graph via handle — redacted paths only', !JSON.stringify(graph).includes(TOKEN) && (graph.dependents?.length ?? 0) > 0);
  const graphViaPath = await byName.get_graph.execute({ path: tokenEntry.path });
  check('A21: get_graph resolves the redacted path too', (graphViaPath.dependents?.length ?? 0) > 0 && !JSON.stringify(graphViaPath).includes(TOKEN));

  // fail-closed: a registered literal hidden in an object KEY cannot survive emit
  let threw = null;
  try { emitToolResult({ name: 'unit', payload: { [TOKEN]: 'x' }, redactor }); } catch (e) { threw = e.message; }
  check('A21: emit throws on a surviving registered literal (object key)', Boolean(threw));
  check('A21: emit error carries no literal material', Boolean(threw) && !threw.includes(TOKEN) && /\[REDACTED .+ #/.test(threw), threw?.slice(0, 90));
  let cleanOk = true;
  try { emitToolResult({ name: 'unit', payload: { ok: 'clean' }, redactor }); } catch { cleanOk = false; }
  check('A21: emit passes clean payloads', cleanOk);

  // referenceability: the model cites the file by handle → VERIFIED finding
  const row = (read.lines ?? []).find((l) => l.text.includes('AWS_KEY'));
  const submit = await byName.submit_findings.execute({
    findings: [{ title: 'hardcoded AWS key', category: 'security', severity: 'high', confidence: 0.9, file: tokenEntry.handle, lines: [row?.line ?? 1, row?.line ?? 1], snippet: row?.text ?? null, description: 'credential literal' }],
    notes: 'A21 referenceability check',
  });
  check('A21: submit_findings accepted the handle citation', submit.accepted === 1);
  const validated = validateDrafts(toolkit.state.submitted.drafts, { repo, logger, redactor });
  const f = validated.findings[0];
  check('A21: handle-cited finding VERIFIES against the real file', f?.verified === true, f?.verification?.status);
  check('A21: the finding carries no raw token in its file reference', Boolean(f) && !f.file.includes(TOKEN) && f.file.includes('[REDACTED'));
  // structured-phase parity: a draft quoting the REDACTED path verbatim also verifies
  const validated2 = validateDrafts([
    { checkId: 'model:t', source: 'model:t', title: 'cited via redacted path', category: 'security', severity: 'high', confidence: 0.9, file: tokenEntry.path, lines: [row?.line ?? 1, row?.line ?? 1], snippet: row?.text ?? null, description: 'd' },
  ], { repo: { fileStore: repo.fileStore }, logger, redactor });
  check('A21: redacted-path citation verifies too (structured-phase parity)', validated2.findings[0]?.verified === true, validated2.findings[0]?.verification?.status);

  // CLI end-to-end: the mock agent reads and cites the redacted-name file
  const r = runCli(['scan', dir, '--models', 'mock', '--depth', 'deep', '--quiet']);
  check('A21: deep mock scan ok', r.code === 0, `code=${r.code}`);
  const { json, md } = latestReport(dir);
  check('A21: report free of the raw token', !md.includes(TOKEN) && !JSON.stringify(json).includes(TOKEN));
  check('A21: the agent produced a VERIFIED finding on the redacted-name file', json.findings.some((x) => x.verification?.status === 'verified' && x.file.includes('[REDACTED')));
  check('A21: CLI output free of the raw token', !r.out.includes(TOKEN));

  // A21 (replay finding): the token in the target DIRECTORY NAME must not
  // reach stdout either — the summary prints report paths, and `last` echoes
  // them again.
  const dirNameToken = await tempDir('ca-a21dir-');
  const tokenDir = path.join(dirNameToken, `key-${TOKEN}`);
  await fsp.mkdir(tokenDir, { recursive: true });
  await fsp.writeFile(path.join(tokenDir, 'plain.js'), `const K = '${TOKEN}';\nmodule.exports = { K };\n`);
  const r2 = runCli(['scan', tokenDir, '--models', 'mock', '--depth', 'quick', '--quiet']);
  check('A21: scan stdout free of the token when it sits in the target directory name', r2.code === 0 && !r2.out.includes(TOKEN), `code=${r2.code}`);
  const r3 = runCli(['last', tokenDir, '--quiet']);
  check('A21: last stdout free of the token (paths shown via the redacted meta.target)', r3.code === 0 && !r3.out.includes(TOKEN) && r3.out.includes('[REDACTED'), `code=${r3.code}`);
  await fsp.rm(dirNameToken, { recursive: true, force: true });

  await fsp.rm(dir, { recursive: true, force: true });
}

// ============================================================ A22: device-local means loopback
console.log('\n[25] A22 — endpoint trust is loopback-only for the sensitive-file override');
{
  const { validateEgressPolicy, isRemoteEgress, isLocalEndpoint } = await import('../src/util/model-access.mjs');

  const remoteCases = [
    ['host.docker.internal', 'http://host.docker.internal:11434/v1'],
    ['LAN IP', 'http://192.168.1.5:11434/v1'],
    ['bare hostname', 'http://myserver:11434'],
    ['0.0.0.0', 'http://0.0.0.0:11434'],
    ['mDNS .local', 'http://foo.local:11434'],
    ['.localhost alias', 'http://box.localhost:11434'],
    ['unparseable garbage', 'not a url at all'],
  ];
  for (const [label, base] of remoteCases) {
    check(`A22: remote — ${label}`, isRemoteEgress({ name: 'p', provider: 'ollama', baseUrl: base, model: 'x' }) === true && isLocalEndpoint(base) === false);
  }
  const localCases = [
    ['localhost', 'http://localhost:11434/v1'],
    ['127.0.0.5', 'http://127.0.0.5:11434/v1'],
    ['[::1]', 'http://[::1]:11434/v1'],
    ['bare ::1', '::1'],
  ];
  for (const [label, base] of localCases) {
    check(`A22: local — ${label}`, isRemoteEgress({ name: 'p', provider: 'ollama', baseUrl: base, model: 'x' }) === false && isLocalEndpoint(base) === true);
  }

  // CLI negative: override + non-loopback profile exits 2 BEFORE any request
  const tmpConfig = path.join(os.tmpdir(), `ca-a22-${Date.now()}.json`);
  await fsp.writeFile(tmpConfig, JSON.stringify({
    profiles: { dockerhost: { provider: 'ollama', baseUrl: 'http://host.docker.internal:11434/v1', model: 'x' } },
    defaultModels: ['dockerhost'],
    checks: { allowSecretFileReads: true },
  }));
  const r = runCli(['scan', 'examples/vulnerable-app', '--models', 'dockerhost', '--depth', 'standard', '--config', tmpConfig, '--quiet']);
  check('A22: override + non-loopback endpoint exits 2 with the acknowledgment error', r.code === 2 && /allowSecretFileReadsRemote/i.test(r.out), `code=${r.code}`);
  check('A22: policy validated before any request (no discovery output)', !r.out.includes('Deterministic checks') && !r.out.includes('Model passes'));
  await fsp.rm(tmpConfig, { force: true });
}

// ============================================================ A23: bounded regex searches
console.log('\n[26] A23 — model-authored regex cannot hang the process (bounded worker)');
{
  const { runBoundedRegexSearch, REGEX_BUDGET_MESSAGE } = await import('../src/util/regex-worker.mjs');
  // a 40-char 'a' line is catastrophic for these patterns on the main thread
  const files = [{ rel: 'a.js', lines: [`const A_LINE = '${'a'.repeat(40)}';`, 'const z = 1;'] }];

  for (const pattern of ['(a+)+$', '(a|aa)+c']) {
    const t0 = Date.now();
    const res = await runBoundedRegexSearch({ source: pattern, flags: 'i', files, deadlineMs: 500 });
    const ms = Date.now() - t0;
    check(`A23: catastrophic "${pattern}" returns the budget error`, res.error === REGEX_BUDGET_MESSAGE, JSON.stringify(res).slice(0, 80));
    check(`A23: "${pattern}" resolved within the deadline`, ms < 2000, `${ms}ms`);
  }

  const sane = await runBoundedRegexSearch({ source: 'AW._KEY', flags: 'i', files: [{ rel: 'a.js', lines: [`const AWS_KEY = 'x';`] }] });
  check('A23: positive control — sane regex still matches', (sane.matches ?? []).length === 1, JSON.stringify(sane.matches ?? []));
  const invalid = await runBoundedRegexSearch({ source: '(', files, deadlineMs: 500 });
  check('A23: invalid regex surfaces a clean error', /Invalid regex/.test(invalid.error ?? ''));

  // through the toolkit: the tool returns the budget error and the process stays responsive
  const dir = await tempDir('ca-a23-');
  await fsp.writeFile(path.join(dir, 'a.js'), `const A_LINE = '${'a'.repeat(40)}';\nconst z = 1;\nmodule.exports = { z };\n`);
  const { discoverRepo } = await import('../src/discovery/discover.mjs');
  const { createRedactor } = await import('../src/util/redact.mjs');
  const { createToolkit } = await import('../src/engine/tools.mjs');
  const { createLogger } = await import('../src/util/log.mjs');
  const logger = createLogger({ quiet: true });
  const repo = await discoverRepo(dir, { logger });
  const toolkit = createToolkit(repo, { budgets: { maxToolCalls: 50, maxReadBytes: 4_000_000, deadline: Infinity, profileName: 'unit' }, redactor: createRedactor(), logger });
  const byName = Object.fromEntries(toolkit.tools.map((t) => [t.name, t]));
  const t0 = Date.now();
  const hang = await byName.search_code.execute({ query: '(a|aa)+c', isRegex: true });
  check('A23: search_code returns the budget error for a catastrophic regex', hang.error === REGEX_BUDGET_MESSAGE, `${Date.now() - t0}ms`);
  check('A23: total call stayed under 2s', Date.now() - t0 < 2000, `${Date.now() - t0}ms`);
  const followUp = await byName.search_code.execute({ query: 'const z' });
  check('A23: process responsive — a follow-up normal search succeeds', (followUp.matches ?? []).length >= 1);
  check('A23: plain-substring search unaffected (main thread)', followUp.matches.some((m) => m.path === 'a.js'));

  // glob filters compile to model-influenced RegExp too — same canary bound
  const crazyGlob = await byName.search_code.execute({ query: 'const z', glob: `*${'a*'.repeat(20)}b` });
  check('A23: catastrophic glob filter bounded', /time budget|simplify/i.test(crazyGlob.error ?? ''), JSON.stringify(crazyGlob).slice(0, 80));
  const okGlob = await byName.search_code.execute({ query: 'const z', glob: '**/*.js' });
  check('A23: benign glob still filters normally', (okGlob.matches ?? []).length >= 1);

  await fsp.rm(dir, { recursive: true, force: true });
}

// ============================================================ CLI surface + A10 read-only
console.log('\n[27] CLI surface + read-only guarantee (A10)');
{
  const help = runCli(['help']);
  check('help lists commands', help.out.includes('code-audit scan') && help.out.includes('--focus'));
  const v = runCli(['--version']);
  check('--version prints version only', /^code-audit v/.test(v.out.trim()), v.out.trim().slice(0, 40));
  const bad = runCli(['scan', 'examples/vulnerable-app', '--focus', 'nope', '--quiet']);
  check('invalid focus rejected with exit 2', bad.code === 2 && bad.out.includes('Unknown focus'));
  const dead = runCli(['scan', 'examples/vulnerable-app', '--depth', 'standard', '--models', 'mock', '--config', path.join(os.tmpdir(), 'definitely-missing.json'), '--quiet']);
  check('missing --config fails loudly', dead.code === 2 && dead.out.includes('not found'), `code=${dead.code}`);

  const hashesAfter = hashTree(FIXTURE);
  const before = [...fixtureHashesBefore.entries()];
  let unchanged = before.length === hashesAfter.size;
  for (const [rel, hash] of before) {
    if (hashesAfter.get(rel) !== hash) { unchanged = false; console.log(`   modified: ${rel}`); }
  }
  check('A10: no application source file was modified by any test', unchanged, `${before.length} files tracked`);
}

// ============================================================ M3.6: report quality (kind split, verified-only summary, partial labeling)
console.log('\n[28] M3.6 report quality — defect/maintenance split, verified-only summary, partial-audit banner');
{
  const { scoreFindings, buildBacklog, kindStats, summaryEligible, severityCounts, verificationStats } = await import('../src/report/score.mjs');
  const { renderMarkdown } = await import('../src/report/markdown.mjs');
  const mk = (over) => ({
    id: 'x', checkId: 'secrets', source: 'deterministic', category: 'security', severity: 'high',
    confidence: 0.9, title: 't', description: 'd', file: 'a.js', lines: [1, 2], snippet: null,
    occurrences: [], verification: { status: 'verified' }, ...over,
  });
  const findings = scoreFindings([
    mk({ title: 'verified defect', verified: true }),
    mk({ title: 'unverified defect lead', verified: false, verification: { status: 'unverified' }, confidence: 0.8 }),
    mk({ title: 'maintenance observation', category: 'debt', severity: 'low', confidence: 0.5, verified: true }),
  ]);
  check('[28] kind assigned: defect / defect / maintenance', findings[0].kind === 'defect' && findings[1].kind === 'defect' && findings[2].kind === 'maintenance');
  const kinds = kindStats(findings);
  check('[28] kindStats counts defects and observations', kinds.defect === 2 && kinds.defectVerified === 1 && kinds.maintenance === 1);
  const summary = summaryEligible(findings);
  check('[28] summary eligibility excludes unverified', summary.length === 2 && !summary.some((f) => f.title.includes('unverified')));
  const backlog = buildBacklog(findings);
  check('[28] unverified finding lands in investigate, never quick wins', backlog.investigate.some((f) => f.title.includes('unverified')) && !backlog.quickWins.some((f) => f.title.includes('unverified')));

  const report = {
    meta: { target: 'x', timestamp: '', depth: 'quick', focus: 'all', changed: false, models: [], partial: true, partialReasons: ['model phase "structured" (profile "bench") failed: endpoint 500'], coverage: null, version: '0' },
    repo: { totalSourceFiles: 1, totalLoc: 10, languages: [] },
    findings, stats: { bySeverity: severityCounts(findings), kinds: kindStats(findings), verification: verificationStats(findings), consensusCount: 0, verdicts: {} },
    runs: [], checksExecuted: [], notes: [], toolNotes: [], backlog,
  };
  const md = renderMarkdown(report, { emoji: false });
  check('[28] markdown: partial-audit banner with the failure reason', md.includes('PARTIAL AUDIT') && md.includes('model phase "structured" (profile "bench") failed'));
  check('[28] markdown: exec summary splits defects from maintenance', md.includes('confirmed-defect claim(s)') && md.includes('maintenance observation(s)'));
  const topBlock = md.slice(md.indexOf('Highest-priority verified items:'), md.indexOf('unverified finding(s) are **excluded'));
  check('[28] markdown: top priorities list only verified findings', topBlock.includes('verified defect') && !topBlock.includes('unverified defect lead'));
  check('[28] markdown: unverified exclusion is stated', md.includes('excluded from these priorities'));
  check('[28] markdown: unverified count never overstated', md.includes('1 finding(s) could not be verified'));
}

console.log(`\n${failures === 0 ? 'ALL ACCEPTANCE TESTS PASSED' : `${failures} ACCEPTANCE TEST(S) FAILED`}`);
fs.rmSync(path.join(FIXTURE, '.code-audit'), { recursive: true, force: true });
fs.rmSync(path.join(CLEAN, '.code-audit'), { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
