// Fail-safe matrix (M3.4) + coverage-honesty fixtures (M3.3).
// Table-driven: each scenario asserts a bounded exit, an honest report, and
// no hang/crash. Dev-time matrix, wired into `npm test` (after smoke.mjs).
// Runs fully offline; the only network touch is a guaranteed-refused port.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BIN = path.join(ROOT, 'bin', 'code-audit.mjs');

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? ' ✓ ' : ' ✗ '}${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

function runCli(args, { timeout = 240_000 } = {}) {
  const res = spawnSync(process.execPath, [BIN, ...args, '--no-color'], {
    cwd: ROOT, encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  const timedOut = res.status === null || res.error?.code === 'ETIMEDOUT';
  return { code: res.status, timedOut, out: `${res.stdout ?? ''}\n${res.stderr ?? ''}` };
}

function readReport(dir) {
  const base = path.join(dir, '.code-audit', 'reports');
  const runs = fs.readdirSync(base).sort();
  const run = path.join(base, runs[runs.length - 1]);
  return {
    json: JSON.parse(fs.readFileSync(path.join(run, 'report.json'), 'utf8')),
    md: fs.readFileSync(path.join(run, 'report.md'), 'utf8'),
  };
}

async function tempRepo(prefix) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  return dir;
}

// ---------------------------------------------------------- [F1] empty repo
console.log('\n[F1] empty repository → bounded, honest, zero-findings report');
{
  const dir = await tempRepo('ca-f1-');
  const r = runCli(['scan', dir, '--depth', 'quick']);
  check('F1: exit 0', r.code === 0 && !r.timedOut, `code=${r.code} timedOut=${r.timedOut}`);
  const { json } = readReport(dir);
  check('F1: zero findings', json.findings.length === 0);
  check('F1: coverage reports the empty walk', json.meta.coverage && json.meta.coverage.walkedFiles === 0);
  await fsp.rm(dir, { recursive: true, force: true });
}

// ------------------------------------------------------ [F2] binaries only
console.log('\n[F2] repository of only binary files → skipped, honest coverage');
{
  const dir = await tempRepo('ca-f2-');
  await fsp.writeFile(path.join(dir, 'img.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]));
  await fsp.writeFile(path.join(dir, 'blob.dat'), Buffer.from([0x00, 0x01, 0x02, 0xff]));
  const r = runCli(['scan', dir, '--depth', 'quick']);
  check('F2: exit 0', r.code === 0 && !r.timedOut, `code=${r.code}`);
  const { json, md } = readReport(dir);
  check('F2: zero findings on binary-only repo', json.findings.length === 0);
  check('F2: coverage counts skipped binaries', json.meta.coverage.skippedBinary === 2, JSON.stringify(json.meta.coverage));
  check('F2: markdown states the skips', md.includes('Skipped as binary'));
  await fsp.rm(dir, { recursive: true, force: true });
}

// ------------------------- [F3] oversized + binary + unsupported + one real file
console.log('\n[F3] oversized/binary/unsupported files → counts shown, never claims full coverage');
{
  const dir = await tempRepo('ca-f3-');
  const big = `// oversized text file (beyond the ${'1.5'} MB text cap)\n${Array.from({ length: 40_000 }, (_, i) => `const pad${i} = '${'x'.repeat(32)}';`).join('\n')}\n`;
  await fsp.writeFile(path.join(dir, 'oversize.js'), big); // ~1.6 MB text
  await fsp.writeFile(path.join(dir, 'asset.bin'), Buffer.from([0x00, 0xde, 0xad, 0xbe, 0xef, 0x00]));
  await fsp.writeFile(path.join(dir, 'data.xyz'), 'not a supported language\n');
  await fsp.writeFile(path.join(dir, 'real.js'), '// planted issue\neval(userInput);\nmodule.exports = {};\n');
  const r = runCli(['scan', dir, '--depth', 'quick']);
  check('F3: exit 0', r.code === 0 && !r.timedOut, `code=${r.code}`);
  const { json, md } = readReport(dir);
  const c = json.meta.coverage;
  check('F3: oversized file counted, not silently dropped', c.skippedLarge === 1, JSON.stringify(c));
  check('F3: binary counted', c.skippedBinary === 1);
  check('F3: unsupported extension counted with its name', (c.unsupportedLanguages ?? []).some((u) => u.ext === '.xyz' && u.files === 1), JSON.stringify(c.unsupportedLanguages));
  check('F3: the real file was still scanned', c.sourceFilesScanned >= 1 && json.findings.some((f) => f.file === 'real.js'));
  check('F3: markdown carries the Coverage & limitations section', md.includes('## Coverage & limitations') && md.includes('Skipped as oversized') && md.includes('not analyzed'));
  check('F3: markdown never claims full coverage', !md.includes('full coverage confirmed'));
  await fsp.rm(dir, { recursive: true, force: true });
}

// ----------------------------- [F4] repo over the walk cap (12k+ files)
console.log('\n[F4] 12,010-file repository → truncated walk declared honestly, bounded runtime');
{
  const dir = await tempRepo('ca-f4-');
  const bulk = path.join(dir, 'bulk');
  await fsp.mkdir(bulk, { recursive: true });
  for (let i = 0; i < 12_010; i++) {
    await fsp.writeFile(path.join(bulk, `m${String(i).padStart(5, '0')}.js`), `// unique module ${i}\nmodule.exports = ${i};\n`);
  }
  const t0 = Date.now();
  const r = runCli(['scan', dir, '--depth', 'quick'], { timeout: 300_000 });
  const wall = Date.now() - t0;
  check('F4: completes within the harness timeout', !r.timedOut && r.code === 0, `code=${r.code} wall=${(wall / 1000).toFixed(1)}s`);
  const { json, md } = readReport(dir);
  check('F4: walk truncation recorded', json.meta.coverage.walkTruncated === true, JSON.stringify(json.meta.coverage));
  check('F4: markdown warns about truncation', md.includes('truncated at the file cap'));
  check('F4: walked exactly the cap', json.meta.coverage.walkedFiles === 12_000, String(json.meta.coverage.walkedFiles));
  await fsp.rm(dir, { recursive: true, force: true });
}

// ------------------------------------------------- [F5] symlink/junction loop
console.log('\n[F5] directory-loop junction → bounded walk, no hang');
{
  const dir = await tempRepo('ca-f5-');
  await fsp.writeFile(path.join(dir, 'app.js'), 'const x = 1;\nmodule.exports = { x };\n');
  try {
    await fsp.symlink(dir, path.join(dir, 'loop'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (e) {
    console.log(` ✗ (setup) symlink unavailable on this host — skipping F5 (${e.message.split('\n')[0]})`);
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    failures += 0;
    console.log('skipped');
  }
  if (fs.existsSync(path.join(dir, 'loop'))) {
    const r = runCli(['scan', dir, '--depth', 'quick'], { timeout: 120_000 });
    check('F5: no hang, bounded exit', !r.timedOut && r.code === 0, `code=${r.code} timedOut=${r.timedOut}`);
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// --------------------------------------- [F6] inaccessible subdirectory (win32)
console.log('\n[F6] inaccessible subdirectory → skipped where the OS forbids, no crash');
{
  const dir = await tempRepo('ca-f6-');
  await fsp.writeFile(path.join(dir, 'app.js'), 'const x = 1;\nmodule.exports = { x };\n');
  const locked = path.join(dir, 'locked');
  await fsp.mkdir(locked);
  await fsp.writeFile(path.join(locked, 'secret.js'), 'const k = 1;\n');
  let aclApplied = false;
  if (process.platform === 'win32') {
    const deny = spawnSync('icacls', [locked, '/deny', '*S-1-1-0:(OI)(CI)F'], { encoding: 'utf8' });
    aclApplied = deny.status === 0;
  }
  if (!aclApplied) {
    console.log(' ✗ (setup) ACL deny not applied — skipping F6 on this host');
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    console.log('skipped');
  } else {
    const r = runCli(['scan', dir, '--depth', 'quick'], { timeout: 120_000 });
    check('F6: no hang, bounded exit', !r.timedOut && r.code === 0, `code=${r.code} timedOut=${r.timedOut}`);
    const { json } = readReport(dir);
    check('F6: accessible files still audited', json.meta.coverage.sourceFilesScanned >= 1);
    // cleanup: remove the deny ACE, then delete
    spawnSync('icacls', [locked, '/remove:d', '*S-1-1-0'], { encoding: 'utf8' });
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------- [F7] endpoint offline (refused port)
console.log('\n[F7] offline model endpoint → bounded exit 2, honest failed-run report');
{
  const dir = await tempRepo('ca-f7-');
  await fsp.writeFile(path.join(dir, 'app.js'), 'function f(a) { return a + 1; }\nmodule.exports = { f };\n');
  const cfg = path.join(os.tmpdir(), `ca-f7-${Date.now()}.json`);
  await fsp.writeFile(cfg, JSON.stringify({
    profiles: { dead: { provider: 'openai-compatible', baseUrl: 'http://127.0.0.1:9/v1', model: 'x', adapter: 'native' } },
    defaultModels: ['dead'],
  }));
  const r = runCli(['scan', dir, '--depth', 'standard', '--config', cfg, '--quiet'], { timeout: 120_000 });
  check('F7: exit 2 (all model runs failed), no hang', r.code === 2 && !r.timedOut, `code=${r.code} timedOut=${r.timedOut}`);
  const { json, md } = readReport(dir);
  check('F7: run recorded as failed with an error', json.runs.length === 1 && json.runs[0].ok === false && Boolean(json.runs[0].error));
  check('F7: deterministic checks still produced their findings', Array.isArray(json.findings));
  check('F7: markdown states the failure', md.includes('failed:'));
  check('F7: partial audit flagged with reasons (M3.6d)', json.meta.partial === true && (json.meta.partialReasons ?? []).some((x) => x.includes('model phase')), JSON.stringify(json.meta.partial));
  check('F7: markdown carries the partial banner', md.includes('PARTIAL AUDIT'));
  await fsp.rm(cfg, { force: true });
  await fsp.rm(dir, { recursive: true, force: true });
}

// ------------------------------------------- [F8] unsupported-language repo
console.log('\n[F8] unsupported-language repository → clear "nothing analyzable" result');
{
  const dir = await tempRepo('ca-f8-');
  await fsp.writeFile(path.join(dir, 'a.xyz'), 'definitely not a supported language\n');
  await fsp.writeFile(path.join(dir, 'b.xyz'), 'more unknown content\n');
  const r = runCli(['scan', dir, '--depth', 'quick']);
  check('F8: exit 0', r.code === 0 && !r.timedOut, `code=${r.code}`);
  const { json, md } = readReport(dir);
  check('F8: zero findings, honestly reported', json.findings.length === 0);
  check('F8: coverage names the unanalyzed extension', (json.meta.coverage.unsupportedLanguages ?? []).some((u) => u.ext === '.xyz' && u.files === 2));
  check('F8: markdown says the extensions were not analyzed', md.includes('not analyzed'));
  await fsp.rm(dir, { recursive: true, force: true });
}

console.log(`\n${failures === 0 ? 'ALL FAIL-SAFE CHECKS PASSED' : `${failures} FAIL-SAFE CHECK(S) FAILED`} (skipped scenarios excluded)`);
process.exit(failures === 0 ? 0 : 1);
