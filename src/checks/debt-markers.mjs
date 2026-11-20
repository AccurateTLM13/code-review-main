// Debt markers: TODO / FIXME / HACK / XXX / BUG with grouping per file+marker.
import { makeFinding, snippetAround, forEachSourceFile } from './index.mjs';

const MARKER_RE = /\b(TODO|FIXME|HACK|XXX|BUG)\b[:#(\s]?/;

const META = {
  FIXME: { severity: 'medium', conf: 0.85, note: 'Signals known broken/unfinished behavior — high-value to resolve.' },
  BUG: { severity: 'medium', conf: 0.85, note: 'Author explicitly marked a bug.' },
  HACK: { severity: 'low', conf: 0.8, note: 'A workaround the author did not consider clean.' },
  TODO: { severity: 'low', conf: 0.8, note: 'Deferred work; batch these into planned refactors.' },
  XXX: { severity: 'info', conf: 0.7, note: 'Attention marker.' },
};

export function runDebtMarkers(ctx) {
  const findings = [];
  const check = { id: 'debt-markers', category: 'debt', effort: 'moderate' };
  const perFile = new Map();

  forEachSourceFile(ctx, (entry, content, lines) => {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(MARKER_RE);
      if (!m) continue;
      const marker = m[1].toUpperCase();
      if (/\/\/\s*$/.test(lines[i])) continue;
      const key = `${entry.rel}::${marker}`;
      if (!perFile.has(key)) perFile.set(key, { entry, marker, occurrences: [] });
      const g = perFile.get(key);
      if (g.occurrences.length < 12) g.occurrences.push({ line: i + 1, text: lines[i].trim().slice(0, 160) });
    }
    return null;
  });

  const groups = [...perFile.values()].sort((a, b) => {
    const rank = (m) => ({ FIXME: 0, BUG: 0, HACK: 1, TODO: 2, XXX: 3 }[m] ?? 4);
    return rank(a.marker) - rank(b.marker) || b.occurrences.length - a.occurrences.length;
  });

  for (const g of groups.slice(0, 60)) {
    const meta = META[g.marker] ?? { severity: 'info', conf: 0.6, note: '' };
    findings.push(makeFinding(check, {
      file: g.entry.rel,
      lines: [g.occurrences[0].line, g.occurrences[g.occurrences.length - 1].line],
      severity: meta.severity, confidence: meta.conf,
      title: `${g.occurrences.length} ${g.marker} marker${g.occurrences.length > 1 ? 's' : ''} in ${g.entry.rel.split('/').pop()}`,
      snippet: snippetAround(ctx.fileStore.lines(g.entry.rel), g.occurrences[0].line, g.occurrences[0].line),
      description: `${meta.note}\nOccurrences: ${g.occurrences.slice(0, 6).map((o) => `L${o.line}: ${o.text}`).join(' | ')}${g.occurrences.length > 6 ? ' …' : ''}`,
      suggestion: g.marker === 'FIXME' || g.marker === 'BUG'
        ? 'Treat as a defect backlog: reproduce, fix, and add a regression test before closing the marker.'
        : 'Schedule cleanup; convert vague notes into tracked issues with owners.',
      benefit: 'Reduces hidden known-issue risk and makes deferred work visible.',
      risk: 'Minimal — resolving markers is behavior-preserving when paired with tests.',
      tags: [g.marker.toLowerCase()], areas: ['debt'],
      occurrences: g.occurrences.map((o) => ({ file: g.entry.rel, lines: [o.line, o.line] })),
    }));
  }
  return findings;
}
