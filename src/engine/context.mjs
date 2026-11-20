// Context pack: budget-aware assembly of repository intelligence, deterministic
// findings, and hotspot source excerpts for the structured model pass.
import { repoDigest } from '../discovery/discover.mjs';
import { isSecretFileRel } from '../util/redact.mjs';

const HEADER = (f) => `# --- ${f} ---`;

function summarizeFindings(findings, redact, max = 70) {
  if (!findings.length) return 'STATIC ANALYSIS FINDINGS: none produced.';
  const lines = findings.slice(0, max).map((f) => {
    const loc = f.file ? `${f.file}:${f.lines ? `${f.lines[0]}-${f.lines[1]}` : ''}` : 'repository';
    return `- [${f.severity.toUpperCase()}] ${f.id} — ${loc} — ${redact(f.title)}`;
  });
  return ['STATIC ANALYSIS FINDINGS (evaluate each; ids for verdicts):', ...lines,
    ...(findings.length > max ? [`… (+${findings.length - max} more, judge only from what you see)`] : [])].join('\n');
}

/**
 * Build the structured-eval context pack. Excerpt bodies pass through the
 * secret redactor so credential-like literals never reach a model endpoint.
 * @returns { text, included: [{file, from, to, ofLines}], skipped: n, chars }
 */
export function buildContextPack(repo, findings, { budgetChars, changedSet = null, redactor = null }) {
  const redact = (t) => (redactor ? redactor.redact(t) : t);
  const sections = [];
  const included = [];
  let skipped = 0;

  const digest = redact(repoDigest(repo, { maxFiles: 60 }));
  sections.push(digest);
  const summaryCost = digest.length;

  const findingsBlock = summarizeFindings(findings, redact);
  sections.push(findingsBlock);

  let remaining = Math.max(4000, budgetChars - digest.length - findingsBlock.length - 600);
  const excerptCap = Math.max(3000, Math.floor(remaining / 8));

  // Priority: changed files first (delta audits focus there), then hotspots,
  // then files touched by deterministic findings. Credential-like files are
  // never excerpted (A11): redaction heuristics cannot guarantee zero leaks.
  const priority = new Map();
  if (changedSet) for (const rel of changedSet) priority.set(rel, 1000);
  for (const h of repo.hotspots) priority.set(h.rel, h.score);
  for (const f of findings) {
    if (f.file && !priority.has(f.file)) priority.set(f.file, 10);
  }

  const ordered = [...priority.entries()]
    .filter(([rel]) => !isSecretFileRel(rel))
    .sort((a, b) => b[1] - a[1])
    .map(([rel]) => rel);
  const source = [];
  for (const rel of ordered) {
    if (remaining < 1500) break;
    const lines = repo.fileStore.lines(rel);
    if (!lines || lines.length < 5) continue;
    const wanted = Math.min(lines.length, Math.floor(excerptCap / 30) * 30 || 120);
    const slice = lines.slice(0, wanted).map(redact);
    // A19: headers carry the filename — sanitize them like the body
    const body = redact(HEADER(rel)) + ` (lines 1-${slice.length} of ${lines.length})\n` + slice.join('\n');
    if (body.length > remaining) {
      const fit = Math.max(20, Math.floor((remaining - 120) / 40));
      const part = lines.slice(0, fit).map(redact).join('\n');
      source.push(`${redact(HEADER(rel))} (lines 1-${fit} of ${lines.length}) [TRUNCATED]\n${part}`);
      remaining -= part.length + 120;
      skipped += lines.length - fit;
    } else {
      source.push(body);
      remaining -= body.length;
      included.push({ file: rel, from: 1, to: slice.length, ofLines: lines.length });
    }
  }

  const text = [
    '=== REPOSITORY SUMMARY ===', sections[0],
    '', '=== ', sections[1], '',
    '=== SOURCE EXCERPTS (relative paths are exact) ===',
    source.join('\n\n') || '(no excerpts fit the budget)',
    '', 'Respond now with the JSON object.',
  ].join('\n');

  return { text, included, skipped, chars: text.length, summaryChars: summaryCost };
}
