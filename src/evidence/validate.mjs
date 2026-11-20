// Evidence validation: every model-produced finding is checked against the
// actual repository. The policy is deliberately strict:
//   - a citation is "verified" ONLY if a verbatim snippet matches line-wise
//     inside the cited range;
//   - a snippet found elsewhere yields "adjusted" with the real lines;
//   - a file + line range WITHOUT a snippet is NOT verification ("a plausible
//     line number alone cannot prove a claim") — it stays unverified;
//   - unverifiable findings are kept, flagged, and down-weighted — never
//     silently trusted, never silently dropped.
// Merging requires issue identity (precise span + textual overlap), not just
// file/category/location, and consensus requires two DISTINCT model profiles.
import { makeFinding } from '../checks/index.mjs';

const WS = /\s+/g;

function norm(s) {
  return String(s ?? '').replace(/\r/g, '').replace(WS, ' ').trim();
}

/** Non-empty normalized lines of a claimed snippet (after `tx`). */
function snippetLines(snippet, tx = (l) => l) {
  return String(snippet ?? '')
    .split(/\r?\n/)
    .map((l) => norm(tx(l)))
    .filter((l) => l.length > 0);
}

/**
 * Locate a snippet relative to a cited range.
 * `transform` maps each source line before comparison (used to compare in
 * "redacted space", so a model citing the redacted prompt verbatim still
 * verifies against the raw source).
 * @returns {{status:'in-place'} | {status:'moved', lines:[number,number]} | {status:'missing'}}
 *   in-place: the snippet's COMPLETE span lies inside the cited range — a
 *             multiline match that starts inside but ends past citedEnd is
 *             NOT in-place (A14)
 *   moved:   the snippet exists in the file, but not within the cited range;
 *            lines holds the true source span (blank lines included in
 *            positions, skipped for content)
 *   missing: the snippet does not exist in the file at all
 */
export function locateSnippet(lines, snippet, { cited = [1, 1], transform = null } = {}) {
  const tx = transform ?? ((l) => l);
  const want = snippetLines(snippet, tx);
  if (!want.length) return { status: 'missing' };
  const citedStart = Math.max(1, Math.floor(Number(cited[0]) || 1));
  const citedEnd = Math.max(citedStart, Math.floor(Number(cited[1]) || citedStart));

  /** Try to match at a 1-based start; returns {ok, endLine} on success. */
  const matchAt = (startLine) => {
    let li = startLine - 1, wi = 0;
    while (li < lines.length && wi < want.length) {
      const src = norm(tx(lines[li]));
      if (!src) { li++; continue; } // blank source lines are skippable
      if (src !== want[wi]) return null;
      li++; wi++;
    }
    if (wi !== want.length) return null;
    // li is now the 0-based index AFTER the last matched line → true 1-based end
    return { endLine: li };
  };

  // exact span inside the cited range
  for (let s = citedStart; s <= citedEnd; s++) {
    const hit = matchAt(s);
    if (hit && hit.endLine <= citedEnd) return { status: 'in-place' };
  }
  // located elsewhere (or spilling out of the cited range) → adjusted
  for (let i = 0; i < lines.length; i++) {
    const hit = matchAt(i + 1);
    if (hit) return { status: 'moved', lines: [i + 1, hit.endLine] };
  }
  return { status: 'missing' };
}

function hashLite(d) {
  const s = `${d.title}|${d.file}|${d.lines?.join('-') ?? ''}|${d.source}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Validate drafts (model output) into findings.
 * @returns { findings, stats: {verified, adjusted, unverified, dropped} }
 */
export function validateDrafts(drafts, { repo, logger, redactor = null }) {
  const store = repo.fileStore;
  const findings = [];
  const stats = { verified: 0, adjusted: 0, unverified: 0, dropped: 0 };
  // Compare evidence in "redacted space": a model quoting the redacted prompt
  // verbatim still verifies against the raw source line.
  const tx = redactor ? (l) => redactor.redact(l) : null;

  for (const d of drafts) {
    const fileOk = d.file && store.has(d.file);
    let verified = false;
    let status = 'unverified';
    let note = null;
    let lines = d.lines;

    if (!d.file) {
      // Repo-level claims (no file) survive only when meaningful
      if (d.severity === 'critical' || (d.severity === 'high' && d.confidence >= 0.7)) {
        note = 'no file referenced — kept for review, cannot be auto-verified';
        d.confidence = (d.confidence ?? 0.4) * 0.6;
        stats.unverified++;
      } else {
        stats.dropped++;
        continue;
      }
    } else if (!fileOk) {
      if (d.confidence >= 0.5) {
        note = `file "${d.file}" not found in scanned set — possible model invention`;
        d.confidence = (d.confidence ?? 0.4) * 0.25;
        stats.unverified++;
      } else {
        stats.dropped++;
        continue;
      }
    } else {
      const linesArr = store.lines(d.file);
      if (!linesArr) { stats.dropped++; continue; }
      const maxLine = linesArr.length;
      if (lines && (lines[0] > maxLine || lines[1] > maxLine || lines[0] < 1 || lines[1] < lines[0])) {
        lines = null; // bogus range — the snippet search below decides the truth
      }

      if (d.snippet) {
        const located = locateSnippet(linesArr, d.snippet, { cited: lines ?? [1, 1], transform: tx });
        if (located.status === 'in-place') {
          verified = true;
          status = 'verified';
          stats.verified++;
        } else if (located.status === 'moved') {
          verified = true;
          status = 'adjusted';
          note = `cited ${lines ? `${lines[0]}-${lines[1]}` : 'range'} does not contain the snippet — actual lines are ${located.lines[0]}-${located.lines[1]}; citation corrected`;
          lines = located.lines;
          stats.adjusted++;
        } else if (lines && lines[0] <= maxLine && lines[1] <= maxLine) {
          note = 'snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced';
          d.confidence = (d.confidence ?? 0.4) * 0.35;
          stats.unverified++;
        } else {
          note = 'snippet not present in the cited file — cannot confirm';
          d.confidence = (d.confidence ?? 0.4) * 0.3;
          stats.unverified++;
        }
      } else if (lines && lines[0] <= maxLine && lines[1] <= maxLine) {
        // A plausible line number alone cannot prove a claim.
        note = 'no snippet provided — a file and line range alone cannot verify a claim';
        d.confidence = (d.confidence ?? 0.4) * 0.6;
        stats.unverified++;
      } else {
        note = 'no usable evidence (no snippet, no valid line range)';
        d.confidence = (d.confidence ?? 0.4) * 0.5;
        lines = null;
        stats.unverified++;
      }
      if (verified && lines) d.snippet = d.snippet ?? linesArr.slice(lines[0] - 1, Math.min(lines[1], lines[0] + 9)).join('\n');
    }

    const f = makeFinding({ id: `${d.checkId}:${hashLite(d)}`, category: d.category, effort: 'moderate', areas: [d.category] }, {
      id: `${d.checkId}:${hashLite(d)}`,
      file: d.file,
      lines,
      severity: d.severity,
      confidence: Math.max(0.05, Math.min(0.95, d.confidence ?? 0.4)),
      title: d.title,
      snippet: d.snippet ?? null,
      description: d.description + (note ? `\n\n> Validation: ${note}` : ''),
      suggestion: d.suggestion ?? null,
      benefit: d.benefit ?? null,
      risk: d.risk ?? null,
      source: d.source,
    });
    f.source = d.source;
    f.verified = verified;
    f.verification = { status, note: note ?? 'validated against file contents' };
    findings.push(f);
  }

  logger?.debug(`Evidence validation: ${stats.verified} verified, ${stats.adjusted} adjusted, ${stats.unverified} unverified, ${stats.dropped} dropped`);
  return { findings, stats };
}

// ---------------------------------------------------------------------------
// Dedupe / merge / consensus
// ---------------------------------------------------------------------------

const SEV_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

const isModelSource = (s) => typeof s === 'string' && (s.startsWith('model:') || s.startsWith('agent:') || s === 'consensus');

/** The underlying profile behind a source tag: "model:local" and
 *  "agent:local" are the SAME reviewer (one model in two phases). */
const profileOf = (s) => String(s ?? '').replace(/^(?:model|agent):/, '');

/** Do two line ranges point at the same code, closely enough to merge? */
function sameLocation(a, b) {
  if (!a || !b) return false;
  const inter = Math.min(a[1], b[1]) - Math.max(a[0], b[0]) + 1;
  if (inter <= 0) return false;
  const la = a[1] - a[0] + 1, lb = b[1] - b[0] + 1;
  const shorter = Math.min(la, lb), longer = Math.max(la, lb);
  if (longer / shorter > 4) return false;         // a 60-line range is not the same issue as a 12-line one
  return inter / shorter >= 0.5;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'not', 'are', 'was',
  'can', 'may', 'your', 'you', 'has', 'have', 'its', 'when', 'line', 'lines', 'code',
  'file', 'use', 'using', 'via', 'should', 'could', 'will', 'all', 'any', 'but', 'new',
]);

function tokens(s) {
  return new Set(
    String(s ?? '')
      .toLowerCase()
      .split(/[^a-z0-9#_.]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Textual overlap between two issue descriptions (containment-style). */
function issueOverlap(a, b) {
  const ta = tokens(`${a.title} ${String(a.description ?? '').slice(0, 120)}`);
  const tb = tokens(`${b.title} ${String(b.description ?? '').slice(0, 120)}`);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

/** Rangeless findings merge only within the same check and near-identical titles. */
function sameIssueTitle(a, b) {
  const ta = a.title.toLowerCase(), tb = b.title.toLowerCase();
  return ta.includes(tb) || tb.includes(ta);
}

function mergeInto(target, incoming) {
  const a = target, b = incoming;
  if (SEV_ORDER[b.severity] > SEV_ORDER[a.severity]) {
    a.severity = b.severity;
    a.title = b.title;
    a.snippet = b.snippet ?? a.snippet;
    a.lines = b.lines ?? a.lines;
  }
  a.confidence = Math.max(a.confidence, b.confidence);
  a.sources = [...new Set([...(a.sources ?? [a.source]), b.source])];
  if (b.description && !a.description.includes(b.description.slice(0, 80))) {
    a.description += `\n\n---\n(${b.source}) ${b.description}`;
  }
  if (b.suggestion && !a.suggestion) a.suggestion = b.suggestion;
  if (b.benefit && !a.benefit) a.benefit = b.benefit;
  if (b.risk && !a.risk) a.risk = b.risk;
  a.occurrences = [...(a.occurrences ?? []), ...(b.occurrences ?? [])].slice(0, 12);
  // A model re-raising a dismissed finding un-dismisses it.
  if (a.dismissed && isModelSource(b.source)) {
    a.dismissed = false;
    a.unDismissedBy = b.source;
  }
  if (b.modelVerdicts?.length) a.modelVerdicts = [...(a.modelVerdicts ?? []), ...b.modelVerdicts];
  return a;
}

/** Same issue? Requires same file + category + precise overlapping span AND
 *  enough textual overlap. Location alone never merges two different claims
 *  ("SQL injection" and "XSS exposure" on one line stay two findings). */
function sameIssue(m, f) {
  if (!(m.file && m.file === f.file && m.category === f.category)) return false;
  if (!m.lines || !f.lines) {
    return !isModelSource(m.source) && !isModelSource(f.source)
      && m.checkId === f.checkId && sameIssueTitle(m, f);
  }
  const overlap = issueOverlap(m, f);
  const contained = sameIssueTitle(m, f);
  if (!(overlap >= 0.34 || contained)) return false;
  return sameLocation(m.lines, f.lines);
}

/**
 * Merge findings from all passes. Dismissed findings are KEPT (grouped in the
 * backlog as model-dismissed, never silently dropped). Consensus is only
 * granted when two or more DISTINCT MODELS agree: reviewer identity is a
 * fingerprint of provider + endpoint + model, so two profile aliases of the
 * same model never count as independent confirmation (A17).
 */
export function mergeFindings(allFindings, { fingerprints = null } = {}) {
  const merged = [];
  for (const f of allFindings) {
    const dup = merged.find((m) => sameIssue(m, f));
    if (dup) mergeInto(dup, f);
    else merged.push({ ...f, sources: [f.source] });
  }
  for (const m of merged) {
    const reviewerId = (src) => {
      const profile = profileOf(src);
      if (!profile) return '';
      return fingerprints && fingerprints.has(profile) ? fingerprints.get(profile) : profile;
    };
    const reviewers = new Set(
      (m.sources ?? [])
        .filter(isModelSource)
        .map(reviewerId)
        .filter((id) => id.length > 0),
    );
    if (reviewers.size >= 2) {
      m.consensus = true;
      m.consensusBy = [...reviewers];
      m.confidence = Math.min(0.95, m.confidence + 0.15);
      m.source = 'consensus';
    } else {
      m.source = (m.sources ?? [])[0] ?? m.source;
    }
  }
  return merged;
}

/** Used by verdict application: distinct-profile counting. */
export { profileOf as sourceProfile };
