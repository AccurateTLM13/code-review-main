// Optional ast-grep integration: if the `ast-grep`/`sg` binary is available,
// run our structural rule pack for higher-precision pattern findings.
// Without the binary, the quality-patterns regex rules cover the same ground
// at lower confidence. Detection order: PATH -> local node_modules/.bin.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFinding } from './index.mjs';

const RULES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'rules', 'ast-grep');

function findAstGrepBinary(root) {
  const local = path.join(root, 'node_modules', '.bin');
  const bare = ['ast-grep', 'sg'];
  const localPaths = [path.join(local, 'ast-grep'), path.join(local, 'sg')];

  // 1. bare executables on PATH: no shell, no args-array warning
  for (const name of bare) {
    try {
      const res = spawnSync(name, ['--version'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
      if (!res.error && res.status === 0 && /ast-grep|sg\s/i.test(res.stdout ?? '')) return name;
    } catch { /* keep trying */ }
  }
  // 2. local installs (may be .cmd/.exe under node_modules/.bin): single command string
  for (const p of localPaths) {
    for (const cand of [`${p}.cmd`, p, `${p}.exe`]) {
      try {
        const res = spawnSync(`"${cand}" --version`, { encoding: 'utf8', timeout: 8000, windowsHide: true, shell: true });
        if (!res.error && res.status === 0 && /ast-grep|sg\s/i.test(res.stdout ?? '')) return cand;
      } catch { /* keep trying */ }
    }
  }
  return null;
}

function runAstGrepScan(binary, root, rulesDir, logger) {
  const isPath = binary.includes(path.sep) || binary.includes('/');
  const cmd = isPath
    ? `"${binary}" scan --rules "${rulesDir}" --json --no-ignore .`
    : null;
  const res = isPath
    ? spawnSync(cmd, { cwd: root, encoding: 'utf8', timeout: 120_000, windowsHide: true, maxBuffer: 32 * 1024 * 1024, shell: true })
    : spawnSync(binary, ['scan', '--rules', rulesDir, '--json', '--no-ignore', '.'], { cwd: root, encoding: 'utf8', timeout: 120_000, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  if (res.error || res.status !== 0) {
    logger?.debug(`ast-grep scan failed: ${res.error?.message ?? String(res.stderr ?? '').slice(0, 200)}`);
    return null;
  }
  try {
    const text = (res.stdout ?? '').trim();
    if (!text.startsWith('[') && !text.startsWith('{')) return null;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.matches ?? null;
  } catch { return null; }
}

export function tryAstGrep(ctx) {
  const { logger } = ctx;
  const binary = findAstGrepBinary(ctx.root);
  if (!binary) {
    logger?.debug('ast-grep binary not found — using built-in regex patterns instead.');
    return [];
  }
  if (!fs.existsSync(RULES_DIR)) {
    logger?.debug('ast-grep rule pack missing — skipping.');
    return [];
  }
  logger?.info(`Using ast-grep (${binary.includes(path.sep) ? 'local' : 'PATH'}) for structural rules.`);
  const matches = runAstGrepBinarySafe(binary, ctx.root, RULES_DIR, logger);
  if (!matches) return [];

  const findings = [];
  const check = { id: 'ast-grep', category: 'bug', effort: 'trivial' };
  const perRuleCap = 12;
  const byRule = new Map();
  for (const m of matches) {
    const ruleId = m.ruleId ?? m.rule_id ?? 'unknown';
    const file = String(m.file ?? '').replace(/\\/g, '/');
    const start = m.range?.start?.line ?? m.start?.line;
    const end = m.range?.end?.line ?? m.end?.line;
    if (!file || !start) continue;
    if (!byRule.has(ruleId)) byRule.set(ruleId, []);
    if (byRule.get(ruleId).length < perRuleCap) byRule.get(ruleId).push({ file, start, end: end ?? start, text: m.lines ?? m.text ?? '' });
  }

  const NOTES = {
    'no-swallowed-catch': { title: 'Structural match: empty catch block', sev: 'medium', conf: 0.85, cat: 'bug' },
    'no-eval': { title: 'Structural match: eval() call', sev: 'medium', conf: 0.7, cat: 'security' },
    'no-debugger': { title: 'Structural match: debugger statement', sev: 'low', conf: 0.95, cat: 'bug' },
    'no-http-url': { title: 'Structural match: insecure http:// URL', sev: 'low', conf: 0.6, cat: 'security' },
    'no-python-bare-except': { title: 'Structural match: bare except:', sev: 'low', conf: 0.8, cat: 'bug' },
    'no-python-eval': { title: 'Structural match: eval()/exec() call', sev: 'medium', conf: 0.7, cat: 'security' },
  };

  for (const [ruleId, hits] of byRule) {
    const meta = NOTES[ruleId] ?? { title: `ast-grep rule ${ruleId}`, sev: 'info', conf: 0.6, cat: 'debt' };
    const scopeActive = ctx.changedSet != null;
    const scopedHits = scopeActive ? hits.filter((h) => ctx.changedSet.has(h.file)) : hits;
    if (!scopedHits.length) continue;
    const first = scopedHits[0];
    findings.push(makeFinding(check, {
      category: meta.cat, file: first.file, lines: [first.start, first.end],
      severity: meta.sev, confidence: meta.conf,
      title: `${meta.title} (${scopedHits.length} match${scopedHits.length > 1 ? 'es' : ''})`,
      snippet: (first.text || '').split('\n').slice(0, 8).join('\n') || null,
      description: `ast-grep rule \`${ruleId}\` matched ${scopedHits.length} location(s):\n${scopedHits.map((h) => `- ${h.file}:${h.start}`).join('\n')}`,
      suggestion: 'Review each match; these are structural (AST-level) and higher-precision than regex heuristics.',
      benefit: 'Removes a concrete defect class with local, verifiable edits.',
      risk: 'Low — matches are syntactically exact.',
      tags: [ruleId], areas: [meta.cat],
      occurrences: scopedHits.map((h) => ({ file: h.file, lines: [h.start, h.end] })),
    }));
  }
  return findings;
}

function runAstGrepBinarySafe(binary, root, rulesDir, logger) {
  try {
    return runAstGrepScan(binary, root, rulesDir, logger);
  } catch (err) {
    logger?.debug(`ast-grep error: ${err.message}`);
    return null;
  }
}
