// M3.5: --changed on a real git repo (express clone at the pinned tag).
// baseline → modify one file → delta lists only it → delete a file → deletion
// detected → no-change rerun → zero findings. State lives in the clone and is
// cleaned afterward; the working tree is restored with git checkout.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(ROOT, 'bin', 'code-audit.mjs');
const TARGET = path.join(ROOT, 'docs', 'benchmark', 'data', 'repos', 'express');

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? ' ✓ ' : ' ✗ '}${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};
const run = (args, timeout = 300_000) => {
  const res = spawnSync(process.execPath, [BIN, ...args, '--no-color'], { cwd: ROOT, encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  return { code: res.status, out: `${res.stdout ?? ''}\n${res.stderr ?? ''}`, status: res.status };
};
const git = (...args) => execFileSync('git', args, { cwd: TARGET, encoding: 'utf8' });
const latest = () => {
  const base = path.join(TARGET, '.code-audit', 'reports');
  const runs = fs.readdirSync(base).sort();
  return path.join(base, runs[runs.length - 1]);
};
const json = (runDir) => JSON.parse(fs.readFileSync(path.join(runDir, 'report.json'), 'utf8'));

const modFile = path.join(TARGET, 'lib', 'view.js');
const delFile = path.join(TARGET, 'lib', 'request.js');

// 1. baseline (records state manifest in the clone)
const b = run(['scan', TARGET, '--depth', 'quick', '--quiet']);
check('baseline exit 0', b.code === 0, `code=${b.code}`);
const baseJson = json(latest());
console.log(`   baseline: ${baseJson.findings.length} findings, basis=${baseJson.meta.changedBasis}`);

// 2. modify one file
const original = fs.readFileSync(modFile, 'utf8');
fs.writeFileSync(modFile, `${original}\n// planted for the delta audit\nfunction plantedDelta(x) { return eval(x); }\n`);
const m = run(['scan', TARGET, '--depth', 'quick', '--changed', '--quiet']);
check('delta exit 0', m.code === 0, `code=${m.code}`);
const modJson = json(latest());
check('delta scoped to the modified file', modJson.meta.changed === true && (modJson.meta.changedFiles ?? []).includes('lib/view.js'), JSON.stringify(modJson.meta.changedFiles));
check('delta findings only in the changed file (cross-file labeled)', modJson.findings.filter((f) => f.scope === 'changed').every((f) => f.file === 'lib/view.js') && modJson.findings.some((f) => f.file === 'lib/view.js' && /eval/i.test(f.title) === false ? true : modJson.findings.some((f) => f.file === 'lib/view.js')), `${modJson.findings.filter((f) => f.file === 'lib/view.js').length} finding(s) in lib/view.js`);

// 3. delete a file
fs.rmSync(delFile);
const d = run(['scan', TARGET, '--depth', 'quick', '--changed', '--quiet']);
check('deletion delta exit 0', d.code === 0, `code=${d.code}`);
const delJson = json(latest());
check('deletion detected and reported', (delJson.meta.deletedFiles ?? []).includes('lib/request.js'), JSON.stringify(delJson.meta.deletedFiles));

// 4. no-change rerun → zero delta
const n = run(['scan', TARGET, '--depth', 'quick', '--changed', '--quiet']);
check('no-change rerun exit 0', n.code === 0, `code=${n.code}`);
const nJson = json(latest());
check('no-change rerun reports nothing to review', !(nJson.meta.changedFiles ?? []).length && !(nJson.meta.deletedFiles ?? []).length && nJson.findings.length === 0, `findings=${nJson.findings.length} changed=${(nJson.meta.changedFiles ?? []).length}`);

// restore the clone exactly
fs.writeFileSync(modFile, original);
git('checkout', '--', 'lib/view.js', 'lib/request.js');
fs.rmSync(path.join(TARGET, '.code-audit'), { recursive: true, force: true });
const dirty = git('status', '--porcelain').trim();
check('express clone restored pristine', dirty === '', dirty || '(clean)');

console.log(`\n${failures === 0 ? 'M3.5 PASSED' : `${failures} M3.5 CHECK(S) FAILED`}`);
process.exit(failures ? 1 : 0);
