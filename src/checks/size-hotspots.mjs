// Size & complexity hotspots: oversized files, deep nesting, hub modules.
import { makeFinding, forEachSourceFile } from './index.mjs';

function maxIndent(lines) {
  let max = 0;
  for (const l of lines) {
    if (!l.trim()) continue;
    let ind = 0;
    for (const ch of l) {
      if (ch === ' ') ind++;
      else if (ch === '\t') ind += 4;
      else break;
    }
    if (ind / 2 > max) max = ind / 2;
  }
  return Math.round(max);
}

export function runSizeHotspots(ctx) {
  const check = { id: 'size', category: 'refactoring', effort: 'large' };
  const cfg = ctx.config.checks;

  return forEachSourceFile(ctx, (entry, content, lines) => {
    const loc = lines.length;
    const out = [];
    if (loc >= (cfg.giantFileLoc ?? 2000)) {
      out.push(makeFinding(check, {
        file: entry.rel, lines: [1, Math.min(60, loc)], severity: 'high', confidence: 0.9,
        title: `Giant file: ${entry.rel.split('/').pop()} is ${loc.toLocaleString()} lines`,
        snippet: lines.slice(0, 12).join('\n'),
        description: `${entry.rel} has ${loc.toLocaleString()} lines. Files this large concentrate bugs, block code review quality, and usually mix several responsibilities.`,
        suggestion: 'Split along responsibility boundaries (parsing, domain logic, I/O). Do it incrementally: extract one cohesive module at a time, tests green between steps.',
        benefit: 'Smaller reviewable units; lower change-conflict rate; clearer ownership.',
        risk: 'Moderate — a large refactor can introduce subtle regressions if done in one pass. Prefer many small, verified extractions.',
        tags: ['size'], areas: ['refactoring'],
      }));
    } else if (loc >= (cfg.maxFileLoc ?? 800)) {
      out.push(makeFinding(check, {
        file: entry.rel, lines: [1, Math.min(60, loc)], severity: 'medium', confidence: 0.85,
        title: `Oversized file: ${entry.rel.split('/').pop()} is ${loc.toLocaleString()} lines`,
        snippet: lines.slice(0, 12).join('\n'),
        description: `${entry.rel} has ${loc.toLocaleString()} lines — beyond the ${cfg.maxFileLoc ?? 800}-line guideline. Candidates: mixed responsibilities, dead code, or several features in one module.`,
        suggestion: 'Identify distinct responsibilities via section comments/imports, extract the most self-contained part first.',
        benefit: 'Faster reviews and safer edits.',
        risk: 'Low if extracted pieces keep their tests.',
        tags: ['size'], areas: ['refactoring'],
      }));
    } else if (loc >= (cfg.bigFileLoc ?? 400) && /(^|\/)(src|lib|app|internal|pkg)\//.test(entry.rel)) {
      out.push(makeFinding(check, {
        file: entry.rel, lines: [1, Math.min(40, loc)], severity: 'info', confidence: 0.7,
        title: `Large file worth watching: ${entry.rel.split('/').pop()} (${loc.toLocaleString()} lines)`,
        snippet: null,
        description: `${entry.rel} is getting large (${loc.toLocaleString()} lines) and sits in a primary source directory.`,
        suggestion: 'No action needed yet; revisit if it keeps growing or before adding major features.',
        benefit: 'Early awareness keeps files reviewable.',
        risk: 'None — informational.',
        tags: ['size'], areas: ['refactoring'],
      }));
    }

    const depth = maxIndent(lines);
    if (depth >= 7 && loc > 120) {
      out.push(makeFinding(check, {
        file: entry.rel, lines: [1, Math.min(80, loc)], severity: 'low', confidence: 0.6,
        title: `Deep nesting (≈${depth} levels) in ${entry.rel.split('/').pop()}`,
        snippet: lines.slice(0, 10).join('\n'),
        description: `This file reaches roughly ${depth} levels of indentation — a readability and cyclomatic-complexity smell. Deeply nested code hides edge cases and is hard to test.`,
        suggestion: 'Apply guard clauses / early returns, extract inner loops into functions, or invert conditions.',
        benefit: 'Flatter control flow is easier to reason about and unit-test.',
        risk: 'Low — logic-preserving transforms.',
        tags: ['complexity'], areas: ['refactoring', 'performance'],
      }));
    }
    return out;
  });
}
