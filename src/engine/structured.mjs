// Structured audit pass: deterministic findings + context pack go to the model,
// which returns verdicts and evidence-backed new findings.
import { structuredSystemPrompt, structuredUserPrompt } from './prompts.mjs';
import { extractJson } from './parse.mjs';
import { SEVERITIES, CATEGORIES } from '../config.mjs';
import { assertNoRegisteredSecret } from '../util/redact.mjs';

export function normalizeSeverity(s) {
  const v = String(s ?? '').toLowerCase().trim();
  if (!v) return null;
  if (/^crit/i.test(v)) return 'critical';
  const hit = SEVERITIES.find((sev) => sev.startsWith(v) || v.startsWith(sev));
  return hit ?? null;
}

export function normalizeCategory(c) {
  const v = String(c ?? '').toLowerCase().trim().replace(/[_\s]/g, '');
  if (!v) return null;
  const map = { vuln: 'security', vulnerability: 'security', defect: 'bug', error: 'bug', correctness: 'bug',
    copy: 'duplication', dry: 'duplication', perf: 'performance', speed: 'performance',
    refactor: 'refactoring', maintain: 'refactoring', architecture: 'refactoring', techdebt: 'debt' };
  if (map[v]) return map[v];
  const hit = CATEGORIES.find((cat) => cat.startsWith(v) || v.startsWith(cat));
  return hit ?? null;
}

function clamp01(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null;
}

/**
 * Run the structured evaluation with one profile.
 * @returns { verdicts, findingDrafts, notes, run: {profile, model, ms, usage, ok, error?} }
 */
export async function runStructuredEvaluation({ adapter, profile, contextPack, focus, signal = null, redactor = null }) {
  const system = structuredSystemPrompt({ focus });
  const prompt = structuredUserPrompt(contextPack.text, { focus });
  // A19: final model-request boundary — refuse to send anything carrying a
  // registered literal, regardless of how it was assembled.
  assertNoRegisteredSecret(system + prompt, redactor, 'structured prompt');
  const t0 = Date.now();

  let response;
  try {
    response = await adapter.complete({
      system,
      prompt,
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      signal,
    });
  } catch (err) {
    return {
      verdicts: [], findingDrafts: [], notes: '',
      run: { profile: profile.name, model: profile.model, phase: 'structured', ms: Date.now() - t0, usage: null, ok: false, error: err.message, adapter: adapter.kind },
    };
  }

  const parsed = extractJson(response.text);
  if (!parsed.ok || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    const empty = !response.text || !response.text.trim();
    const reason = empty
      ? 'model returned an empty response — try a stronger model, a smaller "contextChars" in the profile, or lower "maxTokens"'
      : `Model returned unparseable JSON: ${String(parsed.raw ?? parsed.error).slice(0, 200)}`;
    return {
      verdicts: [], findingDrafts: [], notes: '',
      run: {
        profile: profile.name, model: profile.model, phase: 'structured', ms: Date.now() - t0,
        usage: response.usage, adapter: adapter.kind, ok: false, error: reason,
      },
    };
  }

  const data = parsed.data;
  const verdicts = [];
  for (const v of data.verdicts ?? []) {
    if (!v || typeof v.id !== 'string') continue;
    const action = ['confirm', 'adjust', 'dismiss'].find((a) => a === String(v.action).toLowerCase()) ?? 'confirm';
    verdicts.push({
      id: v.id, action,
      severity: normalizeSeverity(v.severity) ?? null,
      confidence: clamp01(v.confidence),
      reason: String(v.reason ?? '').slice(0, 300),
      by: `model:${profile.name}`,
    });
  }

  const findingDrafts = [];
  for (const f of data.findings ?? []) {
    if (!f || typeof f !== 'object' || !f.title) continue;
    const category = normalizeCategory(f.category) ?? 'bug';
    const severity = normalizeSeverity(f.severity) ?? 'low';
    if (severity === 'info' && category === 'debt' && !f.description) continue;
    findingDrafts.push({
      checkId: `model:${profile.name}`,
      source: `model:${profile.name}`,
      title: String(f.title).slice(0, 140),
      category, severity,
      confidence: clamp01(f.confidence) ?? 0.4,
      file: f.file ? String(f.file).replace(/\\/g, '/').replace(/^\.\//, '') : null,
      lines: Array.isArray(f.lines) && f.lines.length === 2
        ? [Math.round(Number(f.lines[0]) || 1), Math.round(Number(f.lines[1]) || Number(f.lines[0]) || 1)]
        : Array.isArray(f.lines) && f.lines.length ? [Math.round(Number(f.lines[0]) || 1), Math.round(Number(f.lines[0]) || 1)] : null,
      snippet: f.snippet ? String(f.snippet).slice(0, 1200) : null,
      description: String(f.description ?? '').slice(0, 900),
      suggestion: f.suggestion ? String(f.suggestion).slice(0, 500) : null,
      benefit: f.benefit ? String(f.benefit).slice(0, 300) : null,
      risk: f.risk ? String(f.risk).slice(0, 300) : null,
      notes: String(f.description ?? '').slice(0, 60),
    });
  }

  return {
    verdicts,
    findingDrafts,
    notes: String(data.notes ?? '').slice(0, 1200),
    run: {
      profile: profile.name, model: profile.model, phase: 'structured', ms: Date.now() - t0,
      usage: response.usage, adapter: adapter.kind, ok: true,
    },
  };
}

/**
 * Apply model verdicts to deterministic findings (in place).
 *
 * Dismissal policy (A16) — order-independent, reviewer-fingerprint based:
 *   - verdict history is ALWAYS kept on the finding
 *   - if distinct reviewers disagree (one dismisses, another keeps) the
 *     finding becomes "contested" — it is never hidden by vote order
 *   - a reviewer who both dismisses and keeps counts as self-contradictory
 *     → contested
 *   - unanimous dismiss on critical/high/security → contested (never removed)
 *   - unanimous dismiss on anything else → moved to the visible
 *     "model-dismissed" group with the reason recorded
 *
 * Dismissal never erases analyzer evidence.
 */
export function applyVerdicts(findings, allVerdicts, logger, { fingerprints = null } = {}) {
  const byId = new Map(findings.map((f) => [f.id, f]));
  const reviewerOf = (by) => {
    const profile = String(by ?? '').replace(/^(?:model|agent):/, '');
    return fingerprints && fingerprints.has(profile) ? fingerprints.get(profile) : profile;
  };

  // pass 1: record history, collect votes per reviewer, apply confirm/adjust
  const votes = new Map(); // finding id -> Map(reviewer -> { dismiss: n, keep: n })
  let applied = 0, adjusted = 0;

  for (const v of allVerdicts) {
    const f = byId.get(v.id);
    if (!f) continue;
    applied++;
    f.modelVerdicts = f.modelVerdicts ?? [];
    f.modelVerdicts.push({ by: v.by, action: v.action, reason: v.reason });

    const reviewer = reviewerOf(v.by);
    const per = votes.get(f.id) ?? new Map();
    const cur = per.get(reviewer) ?? { dismiss: 0, keep: 0 };
    if (v.action === 'dismiss') cur.dismiss++;
    else cur.keep++;
    per.set(reviewer, cur);
    votes.set(f.id, per);

    if (v.action === 'adjust') {
      adjusted++;
      if (v.severity) f.severity = v.severity;
      if (v.confidence != null) f.confidence = Math.min(f.confidence, v.confidence);
      f.verdictNote = v.reason;
    } else if (v.action === 'confirm' && v.confidence != null) {
      f.confidence = Math.max(f.confidence, v.confidence * 0.9);
    }
  }

  // pass 2: final, order-independent state per finding
  let dismissed = 0, contested = 0;
  for (const f of findings) {
    const per = votes.get(f.id);
    if (!per) continue;
    const dismissers = [], keepers = [], selfContradicting = [];
    for (const [reviewer, v] of per) {
      if (v.dismiss > 0 && v.keep > 0) selfContradicting.push(reviewer);
      else if (v.dismiss > 0) dismissers.push(reviewer);
      else keepers.push(reviewer);
    }
    const protectedFinding = ['critical', 'high'].includes(f.severity) || f.category === 'security';

    if (dismissers.length > 0 && keepers.length > 0) {
      // distinct reviewers disagree → visible dispute, never hidden
      f.contested = true;
      f.contestedBy = dismissers;
      f.disagreement = { dismiss: dismissers, keep: keepers };
      f.confidence = Math.max(0.05, f.confidence * 0.85);
      contested++;
    } else if (selfContradicting.length > 0) {
      f.contested = true;
      f.contestedBy = selfContradicting;
      f.confidence = Math.max(0.05, f.confidence * 0.85);
      contested++;
    } else if (dismissers.length > 0) {
      if (protectedFinding) {
        // Keep the finding; record the contest. Never auto-erase.
        f.contested = true;
        f.contestedBy = dismissers;
        f.confidence = Math.max(0.05, f.confidence * (dismissers.length >= 2 ? 0.6 : 0.85));
        contested++;
      } else {
        f.dismissed = true;
        f.dismissedBy = dismissers.join(', ');
        const firstDismiss = (f.modelVerdicts ?? []).find((x) => x.action === 'dismiss');
        f.dismissReason = firstDismiss?.reason ?? '';
        dismissed++;
      }
    }
  }

  logger?.debug(`Verdicts applied: ${applied} (${dismissed} dismissed, ${contested} contested, ${adjusted} adjusted)`);
  return { applied, dismissed, contested, adjusted };
}
