// Import-graph signals: hub modules, cycles, orphan files.
import { makeFinding } from './index.mjs';

export function runGraphSignals(ctx) {
  const graph = ctx.repo.graph;
  const findings = [];
  if (!graph?.enabled) return findings;

  const check = { id: 'graph', category: 'refactoring', effort: 'large' };
  const scopeActive = ctx.changedSet != null;
  const inScopeRel = (rel) => !scopeActive || ctx.changedSet.has(rel);

  for (const hub of graph.hubs.slice(0, 5)) {
    if (hub.importers < 6) continue;
    if (!inScopeRel(hub.file)) continue;
    findings.push(makeFinding(check, {
      file: hub.file, lines: null, severity: 'info', confidence: 0.7,
      title: `Central hub module: ${hub.file.split('/').pop()} imported by ${hub.importers} files`,
      description: `${hub.file} is imported by ${hub.importers} other files. High-fan-in modules are stability-critical: every change ripples widely, and any regression in them has a large blast radius.`,
      suggestion: 'Treat as a public API: keep its surface small and stable, add explicit tests, and split unrelated responsibilities into separate modules when convenient.',
      benefit: 'Contained blast radius and safer parallel development.',
      risk: 'None — informational today; informs future refactoring order.',
      tags: ['hub'], areas: ['refactoring'],
    }));
  }

  for (const cycle of graph.cycles.slice(0, 3)) {
    if (scopeActive && !cycle.some((rel) => ctx.changedSet.has(rel))) continue;
    findings.push(makeFinding(check, {
      file: cycle[0], lines: null, severity: 'medium', confidence: 0.7,
      title: `Import cycle (${cycle.length} modules): ${cycle.map((c) => c.split('/').pop()).join(' → ')} → ${cycle[0].split('/').pop()}`,
      description: `Circular import chain: ${cycle.join(' → ')} → ${cycle[0]}. Cycles cause initialization-order bugs (undefined imports at runtime), prevent clean layering, and make the modules impossible to test in isolation.`,
      suggestion: 'Break the cycle by extracting the shared piece into a third module, or invert one dependency via dependency injection / event callbacks.',
      benefit: 'Deterministic module initialization and clean layering.',
      risk: 'Moderate — moving code between modules can shift initialization order; run the full test suite after.',
      tags: ['cycle'], areas: ['refactoring', 'bug'],
      occurrences: cycle.map((f) => ({ file: f, lines: null })),
    }));
  }

  const orphanList = scopeActive ? graph.orphans.filter((o) => ctx.changedSet.has(o.file)) : graph.orphans;
  if (orphanList.length >= 3) {
    findings.push(makeFinding(check, {
      file: orphanList[0].file, lines: null, severity: 'info', confidence: 0.5,
      title: `${orphanList.length} source files have no incoming imports`,
      description: `Possibly dead code (heuristic — scripts, dynamically-loaded files, and plugin modules are false positives):\n${orphanList.map((o) => `- ${o.file}`).join('\n')}`,
      suggestion: 'Verify usage (dynamic imports, string-based loaders, external callers) before deleting; then remove or archive.',
      benefit: 'Less code to maintain and review.',
      risk: 'Low if deletion is verified; keep an eye on string-based dynamic requires.',
      tags: ['orphan'], areas: ['refactoring'],
      occurrences: orphanList.map((o) => ({ file: o.file, lines: null })),
    }));
  }
  return findings;
}
