// Prioritization: severity × confidence × focus × consensus, plus effort
// estimates and backlog grouping (quick wins, planned, investigate).

const SEV_WEIGHT = { critical: 10, high: 7, medium: 4, low: 2, info: 1 };
const EFFORT_ESTIMATE = {
  secrets: 'trivial', 'debt-markers': 'moderate', duplication: 'moderate', size: 'large',
  quality: 'moderate', deps: 'trivial', graph: 'large', 'ast-grep': 'trivial',
};

function effortFor(f) {
  if (f.effort && f.effort !== 'moderate') return f.effort;
  if (EFFORT_ESTIMATE[f.checkId]) return EFFORT_ESTIMATE[f.checkId];
  // Model-suggested fixes are usually local edits
  if (f.occurrences && f.occurrences.length > 4) return 'large';
  return 'moderate';
}

const DEFECT_CATEGORIES = new Set(['security', 'bug']);

/**
 * M3.6(b): every reported finding is classified as a `defect` (security/bug —
 * a correctness or exploitable-flaw claim) or a `maintenance` observation
 * (duplication/performance/refactoring/debt — quality work). The report keeps
 * the two apart in its summaries so a handful of defects is never drowned by
 * a mass of observations.
 */
export function kindOf(f) {
  return DEFECT_CATEGORIES.has(f.category) ? 'defect' : 'maintenance';
}

export function scoreFindings(findings, { focus = 'all', scopeActive = false } = {}) {
  for (const f of findings) {
    f.kind = kindOf(f);
    const sev = SEV_WEIGHT[f.severity] ?? 1;
    let score = sev * f.confidence;
    if (focus !== 'all') {
      const focusHit = f.areas?.includes(focus) || f.category === focus;
      score *= focusHit ? 1.25 : 0.85;
    }
    if (f.consensus) score *= 1.15;
    if (f.checkId.startsWith('model:') || f.checkId === 'agent') score *= 0.95; // slight deterministic edge
    if (f.verification?.status === 'adjusted') score *= 0.95;
    if (f.contested) score *= 0.9;
    if (scopeActive && f.scope === 'cross-file') score *= 0.8; // context, not the delta being audited
    f.priority = Math.round(score * 100) / 100;
    f.effort = effortFor(f);
  }
  findings.sort((a, b) => b.priority - a.priority);
  return findings;
}

/**
 * Build the actionable backlog: quick wins first, planned work next,
 * unverified-but-severe items flagged for investigation, and model-dismissed
 * findings kept visible for review (never silently dropped).
 */
export function buildBacklog(findings) {
  const quickWins = [];
  const planned = [];
  const investigate = [];
  const dismissed = [];

  for (const f of findings) {
    if (f.dismissed) { dismissed.push(f); continue; }
    const unverifiedSevere = f.verification?.status === 'unverified' && SEV_WEIGHT[f.severity] >= 2;
    if (unverifiedSevere) { investigate.push(f); continue; }
    if ((f.effort === 'trivial' || f.effort === 'moderate') && f.priority >= 2.0) quickWins.push(f);
    else planned.push(f);
  }
  return { quickWins, planned, investigate, dismissed };
}

export function severityCounts(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
}

export function categoryCounts(findings) {
  const counts = {};
  for (const f of findings) counts[f.category] = (counts[f.category] ?? 0) + 1;
  return counts;
}

export function verificationStats(findings) {
  const stats = { verified: 0, adjusted: 0, unverified: 0 };
  for (const f of findings) {
    const s = f.verification?.status ?? 'verified';
    if (stats[s] != null) stats[s]++;
  }
  return stats;
}

/** M3.6(b): defect/maintenance split used by every summary surface. */
export function kindStats(findings) {
  const stats = { defect: 0, defectVerified: 0, maintenance: 0 };
  for (const f of findings) {
    if (f.dismissed) continue;
    if (f.kind === 'defect') {
      stats.defect++;
      if (f.verified) stats.defectVerified++;
    } else stats.maintenance++;
  }
  return stats;
}

/** M3.6(c): the high-confidence summary set — evidence-verified findings only. */
export function summaryEligible(findings) {
  return findings.filter((f) => !f.dismissed && f.verification?.status !== 'unverified');
}
