// Token-window duplication detector (jscpd-style, zero dependencies).
// Normalized sliding windows are hashed; adjacent matching windows merge into
// blocks. Detects cross-file and same-file copy-paste.
import { makeFinding } from './index.mjs';

function normalizeLine(l) {
  return l.replace(/\s+/g, ' ').trim();
}

function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export function findDuplicateBlocks(fileStore, { windowSize = 8, minBlockLines = 6, maxFilePairs = 25 } = {}) {
  // 1. build normalized line tables for reviewable text files
  const tables = [];
  for (const entry of fileStore.all) {
    if (entry.size > 800_000) continue;
    const lines = fileStore.lines(entry.rel);
    if (!lines) continue;
    const norm = lines.map(normalizeLine);
    const nonEmpty = norm.filter((l) => l.length > 0).length;
    if (nonEmpty < 20) continue;
    const avgLen = lines.reduce((n, l) => n + l.length, 0) / Math.max(1, lines.length);
    if (avgLen > 250) continue; // minified/generated file
    tables.push({ rel: entry.rel, norm, lineCount: lines.length });
  }

  // 2. hash sliding windows
  const windows = new Map(); // hash -> [{rel, line}]  (line = 1-based window start)
  const W = windowSize;
  for (const t of tables) {
    if (t.norm.length < W + 2) continue;
    for (let i = 0; i + W <= t.norm.length; i++) {
      let blank = false;
      for (let k = 0; k < W; k++) if (!t.norm[i + k]) { blank = true; break; }
      if (blank) continue;
      const h = djb2(t.norm.slice(i, i + W).join('\u0001'));
      if (!windows.has(h)) windows.set(h, []);
      windows.get(h).push({ rel: t.rel, line: i + 1 });
    }
  }

  // 3. pairwise match points (skip overly common windows = boilerplate)
  const pairs = [];
  for (const occ of windows.values()) {
    if (occ.length < 2 || occ.length > 12) continue;
    for (let i = 0; i < occ.length; i++) {
      for (let j = i + 1; j < occ.length; j++) {
        const a = occ[i], b = occ[j];
        if (a.rel === b.rel && Math.abs(a.line - b.line) <= W + 2) continue; // self-overlap
        pairs.push([a, b]);
      }
    }
  }

  // 4. merge overlapping/adjacent match points into blocks
  pairs.sort((p, q) => p[0].rel.localeCompare(q[0].rel) || p[0].line - q[0].line || p[1].rel.localeCompare(q[1].rel) || p[1].line - q[1].line);
  const blocks = [];
  const lastForPair = new Map();
  for (const [a, b] of pairs) {
    const key = a.rel + '\u0000' + b.rel;
    const prev = lastForPair.get(key);
    // extend while the next window overlaps or is adjacent to the block so far,
    // advancing in lockstep on both sides
    if (prev && a.line <= prev.aEnd + 1 && b.line <= prev.bEnd + 1 && a.line >= prev.aStart && b.line >= prev.bStart) {
      prev.aEnd = Math.max(prev.aEnd, a.line + W - 1);
      prev.bEnd = Math.max(prev.bEnd, b.line + W - 1);
    } else {
      const blk = { aFile: a.rel, aStart: a.line, aEnd: a.line + W - 1, bFile: b.rel, bStart: b.line, bEnd: b.line + W - 1 };
      blocks.push(blk);
      lastForPair.set(key, blk);
    }
  }

  // 5. keep meaningful blocks, canonical orientation, dedupe reverse pairs
  const kept = [];
  const seenPair = new Set();
  for (const b of blocks) {
    const dupLen = b.aEnd - b.aStart + 1;
    const floor = b.aFile === b.bFile ? Math.max(minBlockLines, 15) : Math.max(minBlockLines, 12);
    if (dupLen < floor) continue;
    const [f1, f2] = [b.aFile, b.bFile].sort();
    const pk = `${f1}|${Math.min(b.aStart, b.bStart)}|${f2}|${Math.max(b.aStart, b.bStart)}`;
    if (seenPair.has(pk)) continue;
    seenPair.add(pk);
    if (b.aFile === b.bFile && b.aStart > b.bStart) { // orient same-file blocks
      [b.aStart, b.bStart] = [b.bStart, b.aStart];
      [b.aEnd, b.bEnd] = [b.bEnd, b.aEnd];
    }
    kept.push(b);
  }
  kept.sort((x, y) => y.count - x.count);
  return kept.slice(0, maxFilePairs * 2);
}

export function runDuplication(ctx) {
  const minLines = ctx.config.checks.minDuplicationLines ?? 6;
  // Whole-repo comparison so cross-file context is preserved; findings are
  // scoped afterward to blocks touching at least one changed file.
  const blocks = findDuplicateBlocks(ctx.fileStore, { minBlockLines: minLines });
  const check = { id: 'duplication', category: 'duplication', effort: 'moderate' };
  const findings = [];

  const scopeActive = ctx.changedSet != null;
  const scoped = scopeActive
    ? blocks.filter((b) => ctx.changedSet.has(b.aFile) || ctx.changedSet.has(b.bFile))
    : blocks;

  for (const b of scoped.slice(0, 25)) {
    const sameFile = b.aFile === b.bFile;
    const dupLines = b.aEnd - b.aStart + 1;
    const severity = dupLines >= 50 ? 'high' : dupLines >= 20 ? 'medium' : 'low';
    const linesA = ctx.fileStore.lines(b.aFile);
    const snippet = linesA ? linesA.slice(b.aStart - 1, Math.min(b.aEnd, b.aStart + 3) - 1 + 1).join('\n') : null;
    findings.push(makeFinding(check, {
      file: b.aFile, lines: [b.aStart, b.aEnd], severity, confidence: 0.9,
      title: sameFile
        ? `${dupLines}-line block duplicated within ${b.aFile.split('/').pop()}`
        : `${dupLines}-line block duplicated between ${b.aFile.split('/').pop()} and ${b.bFile.split('/').pop()}`,
      snippet: snippet && snippet.length ? snippet.slice(0, 400) : null,
      description: `Copy-paste: lines ${b.aStart}–${b.aEnd} of ${b.aFile} repeat at lines ${b.bStart}–${b.bEnd}${sameFile ? ' of the same file' : ` of ${b.bFile}`}. Duplicated logic drifts apart silently and doubles every future fix.`,
      suggestion: 'Extract the shared block into one named function/module and call it from both locations. Keep behavior identical; rely on existing tests.',
      benefit: 'Single point of change; halves maintenance surface for this logic.',
      risk: sameFile ? 'Low-moderate — the two copies may have subtle differences; diff them before merging.' : 'Low-moderate — check both call sites for context-dependent differences.',
      tags: ['copy-paste'], areas: ['duplication', 'refactoring'],
      occurrences: [
        { file: b.aFile, lines: [b.aStart, b.aEnd] },
        { file: b.bFile, lines: [b.bStart, b.bEnd] },
      ],
    }));
  }
  return findings;
}
