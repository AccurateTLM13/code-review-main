// Deterministic check engine: shared finding shape, registry, runner.
import crypto from 'node:crypto';
import { CATEGORIES, SEVERITIES } from '../config.mjs';

export function shortHash(...parts) {
  return crypto.createHash('sha1').update(parts.join('\u0000')).digest('base64url').slice(0, 10);
}

export function makeFinding(check, fields) {
  const file = fields.file ?? null;
  const lines = Array.isArray(fields.lines) ? [fields.lines[0] ?? 1, fields.lines[1] ?? fields.lines[0] ?? 1] : null;
  const f = {
    id: fields.id ?? `${check.id}@${file ?? 'repo'}:${lines ? `${lines[0]}-${lines[1]}` : 'x'}:${shortHash(check.id, file, lines?.join('-') ?? '', fields.title ?? '')}`,
    checkId: check.id,
    source: 'deterministic',
    category: fields.category ?? check.category ?? 'debt',
    severity: fields.severity ?? 'info',
    confidence: Math.max(0, Math.min(1, fields.confidence ?? check.confidence ?? 0.8)),
    title: fields.title,
    description: fields.description ?? '',
    file,
    lines,
    snippet: fields.snippet ?? null,
    occurrences: fields.occurrences ?? undefined,
    suggestion: fields.suggestion ?? null,
    benefit: fields.benefit ?? null,
    risk: fields.risk ?? null,
    effort: fields.effort ?? check.effort ?? 'moderate',
    verified: true,                 // deterministic findings are built from real code
    verification: { status: 'verified', note: 'constructed directly from file contents' },
    tags: fields.tags ?? [],
    areas: fields.areas ?? check.areas ?? [],
  };
  if (!CATEGORIES.includes(f.category)) f.category = 'debt';
  if (!SEVERITIES.includes(f.severity)) f.severity = 'info';
  return f;
}

/** Read a small snippet around a line range, for evidence. */
export function snippetAround(linesArr, start, end, maxChars = 400) {
  if (!linesArr) return null;
  const s = Math.max(0, Math.min(start, linesArr.length) - 1);
  const e = Math.min(end, linesArr.length);
  let text = linesArr.slice(s, e).join('\n');
  if (text.length > maxChars) text = text.slice(0, maxChars) + '…';
  return text.length ? text : null;
}

/** True when a file is in scope under --changed. An empty changed set means
 *  nothing is in scope (distinct from no scoping at all). */
export function inScope(ctx, rel) {
  return !ctx.changedSet || ctx.changedSet.has(rel);
}

// Check registry. Each check: { id, label, areas, run(ctx) }
import { runSecrets } from './secrets.mjs';
import { runDebtMarkers } from './debt-markers.mjs';
import { runDuplication } from './duplication.mjs';
import { runSizeHotspots } from './size-hotspots.mjs';
import { runQualityPatterns } from './quality-patterns.mjs';
import { runDependencyHygiene } from './dependencies.mjs';
import { runGraphSignals } from './graph-signals.mjs';
import { tryAstGrep } from './astgrep.mjs';

export const CHECKS = [
  { id: 'secrets', label: 'Hardcoded secrets & credentials', areas: ['security'], run: runSecrets },
  { id: 'debt-markers', label: 'TODO/FIXME/HACK debt markers', areas: ['debt', 'refactoring'], run: runDebtMarkers },
  { id: 'duplication', label: 'Copy-paste duplication', areas: ['duplication', 'refactoring'], run: runDuplication },
  { id: 'size', label: 'Oversized files & hotspots', areas: ['refactoring', 'performance'], run: runSizeHotspots },
  { id: 'quality', label: 'Risky code patterns', areas: ['security', 'bug', 'performance', 'refactoring'], run: runQualityPatterns },
  { id: 'deps', label: 'Dependency hygiene', areas: ['debt', 'security'], run: runDependencyHygiene },
  { id: 'graph', label: 'Import graph signals', areas: ['refactoring', 'bug'], run: runGraphSignals },
  { id: 'ast-grep', label: 'ast-grep structural rules', areas: ['security', 'bug', 'refactoring'], run: tryAstGrep, optional: true },
];

/**
 * Run all checks matching the selected focus areas.
 * @returns { findings: Finding[], executed: [{id,label,count,ms,error?}], toolNotes: [] }
 */
export async function runChecks(ctx, focus) {
  const areas = new Set(focus === 'all' || focus.includes('all') ? CATEGORIES : focus);
  const findings = [];
  const executed = [];
  const toolNotes = [];
  const maxPerCheck = ctx.config.checks.maxFindingsPerCheck ?? 40;

  for (const check of CHECKS) {
    const applies = check.areas.some((a) => areas.has(a));
    if (!applies) continue;
    const t0 = Date.now();
    try {
      const found = (await check.run(ctx)) ?? [];
      const capped = found.slice(0, maxPerCheck);
      if (found.length > capped.length) {
        toolNotes.push(`${check.id}: ${found.length} matches, reporting top ${capped.length} by severity.`);
      }
      findings.push(...capped);
      executed.push({ id: check.id, label: check.label, count: capped.length, ms: Date.now() - t0 });
      ctx.logger?.debug(`${check.id}: ${found.length} finding(s) in ${Date.now() - t0}ms`);
    } catch (err) {
      executed.push({ id: check.id, label: check.label, count: 0, ms: Date.now() - t0, error: err.message });
      ctx.logger?.warn(`check "${check.id}" failed: ${err.message}`);
    }
  }
  return { findings, executed, toolNotes };
}

// Shared helpers for checks

/**
 * Source files in scope for this run. Under `--changed`, per-file checks run
 * ONLY on changed files — an empty changed set means an empty scope (nothing
 * to audit), which is distinct from no scoping at all. Cross-file checks
 * (duplication, import graph) still see the whole repository and scope their
 * findings themselves, so intentional cross-file context is preserved.
 */
export function scopedSourceFiles(ctx) {
  const files = ctx.fileStore.sourceFiles;
  if (!ctx.changedSet) return files;              // scoping not active
  if (ctx.changedSet.size === 0) return [];       // active delta is empty
  return files.filter((e) => ctx.changedSet.has(e.rel));
}

export function forEachSourceFile(ctx, fn) {
  const out = [];
  for (const entry of scopedSourceFiles(ctx)) {
    const lines = ctx.fileStore.lines(entry.rel);
    const content = ctx.fileStore.content(entry.rel);
    if (lines == null || content == null) continue;
    const res = fn(entry, content, lines);
    if (res) out.push(...(Array.isArray(res) ? res : [res]));
  }
  return out;
}
