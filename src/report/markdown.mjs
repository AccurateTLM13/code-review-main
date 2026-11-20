// Markdown report renderer: executive summary, prioritized backlog,
// per-category findings with evidence, verification notes, and method.
import { severityCounts, categoryCounts, verificationStats } from './score.mjs';

const SEV_BADGE = {
  critical: '🔴 CRITICAL', high: '🟠 HIGH', medium: '🟡 MEDIUM', low: '🔵 LOW', info: '⚪ INFO',
};
const SEV_PLAIN = {
  critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', info: 'INFO',
};

function fmtime(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function loc(f) {
  if (!f.file) return '—';
  return f.lines ? `${f.file}:${f.lines[0]}-${f.lines[1]}` : f.file;
}

function redactionNote(report) {
  if (report.meta?.redaction === 'off') {
    return 'redaction disabled by configuration (checks.redactSecrets=false) — reports may contain credential literals; intended only for private local runs';
  }
  return 'credential-like literals matched by the secret scan are replaced with type-preserving placeholders in this report and in all model prompts';
}

function noEmoji(env) { return env === false; }

function esc(s) { return String(s ?? '').replace(/\|/g, '\\|'); }

export function renderMarkdown(report, { emoji = true } = {}) {
  const { meta, repo: repoIntel, findings, backlog, stats, runs, checksExecuted, notes, toolNotes } = report;
  const badge = (sev) => (emoji ? SEV_BADGE[sev] : SEV_PLAIN[sev]);
  const L = [];

  L.push(`# Code Audit Report`);
  L.push('');
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| **Repository** | ${meta.target} |`);
  if (meta.git?.branch) L.push(`| **Branch / commit** | ${meta.git.branch}${meta.git.commit ? ` @ ${meta.git.commit}` : ''} |`);
  L.push(`| **Date** | ${meta.timestamp} |`);
  L.push(`| **Mode** | ${meta.depth} audit${meta.changed ? (meta.changedBasis === 'full-fallback' ? ' · changed-files requested, no baseline — FULL SCAN fallback' : ` · changed files only (${meta.changedFiles?.length ?? 0} changed${meta.deletedFiles?.length ? `, ${meta.deletedFiles.length} deleted` : ''})`) : ' · full scan'} |`);
  L.push(`| **Focus** | ${meta.focus} |`);
  L.push(`| **Models** | ${meta.models.length ? meta.models.map((m) => `${m.profile} (${m.model ?? '?'}${m.adapter ? `, ${m.adapter}` : ''})`).join(', ') : 'none (deterministic only)'} |`);
  L.push(`| **Codebase** | ${repoIntel.totalSourceFiles} source files · ${repoIntel.totalLoc.toLocaleString()} LOC · ${repoIntel.languages.slice(0, 3).map((l) => l.language).join(', ') || 'n/a'} |`);
  L.push(`| **Findings** | ${findings.length} (${stats.bySeverity.critical} critical / ${stats.bySeverity.high} high / ${stats.bySeverity.medium} medium / ${stats.bySeverity.low} low / ${stats.bySeverity.info} info) |`);
  L.push('');

  // Executive summary
  L.push(`## Executive summary`);
  L.push('');
  if (findings.length === 0) {
    L.push(`No findings matched the selected focus at this depth. This is not a security certification — run \`--depth deep\` for an autonomous investigation pass.`);
  } else {
    const top = findings.slice(0, 5);
    L.push(`The audit produced **${findings.length} findings**, prioritized below. The highest-priority items:`);
    L.push('');
    for (const f of top) {
      L.push(`- ${badge(f.severity)} — **${esc(f.title)}** (${loc(f)}, confidence ${Math.round(f.confidence * 100)}%)`);
    }
    L.push('');
    if (stats.consensusCount > 0) {
      L.push(`${stats.consensusCount} finding(s) were independently confirmed by more than one model — highest confidence.`);
    }
    const unv = stats.verification.unverified + stats.verification.adjusted;
    if (unv > 0) {
      L.push(`${unv} finding(s) could not be fully verified against file contents and are marked accordingly — treat them as leads, not confirmed defects.`);
    }
  }
  L.push('');

  // Backlog table
  L.push(`## Priority backlog`);
  L.push('');
  L.push(`| # | Priority | Severity | Confidence | Category | Effort | Location | Issue |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  findings.forEach((f, i) => {
    const cross = f.scope === 'cross-file' ? ' ×' : '';
    L.push(`| ${i + 1} | ${f.priority.toFixed(1)} | ${badge(f.severity)} | ${Math.round(f.confidence * 100)}% | ${f.category} | ${f.effort} | \`${esc(loc(f))}\` | ${esc(f.title)}${f.consensus ? ' ✦' : ''}${cross} |`);
  });
  L.push('');
  if (findings.some((f) => f.consensus)) L.push(`✦ = cross-confirmed by multiple models (consensus).`);
  if (findings.some((f) => f.scope === 'cross-file')) L.push(`× = cross-file context: this issue lives in a file you did NOT change in this delta.`);
  L.push('');

  // Quick wins
  if (backlog.quickWins.length) {
    L.push(`### 🎯 Quick wins (high priority, small effort)`);
    L.push('');
    for (const f of backlog.quickWins.slice(0, 10)) {
      L.push(`- ${badge(f.severity)} **${esc(f.title)}** — \`${esc(loc(f))}\``);
    }
    L.push('');
  }

  // Unverified leads worth investigating
  if (backlog.investigate.length) {
    L.push(`### 🔍 Needs investigation (evidence could not be verified)`);
    L.push('');
    L.push(`These are leads, not confirmed defects — the cited code could not be located exactly. Verify manually before acting.`);
    L.push('');
    for (const f of backlog.investigate) {
      L.push(`- ${badge(f.severity)} **${esc(f.title)}** — \`${esc(loc(f))}\` (confidence ${Math.round(f.confidence * 100)}%)`);
    }
    L.push('');
  }

  // Model-dismissed findings: kept visible, never silently dropped
  if (backlog.dismissed?.length) {
    L.push(`### 🗑️ Model-dismissed findings (kept for review — analyzer evidence preserved)`);
    L.push('');
    for (const f of backlog.dismissed) {
      const reasons = (f.modelVerdicts ?? []).filter((v) => v.action === 'dismiss').map((v) => `${v.by}: ${v.reason}`).join('; ');
      L.push(`- ${badge(f.severity)} **${esc(f.title)}** — \`${esc(loc(f))}\``);
      if (reasons) L.push(`  - dismissal: ${esc(reasons)}`);
    }
    L.push('');
  }

  // Findings by category
  const byCategory = new Map();
  for (const f of findings) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category).push(f);
  }
  for (const [cat, list] of byCategory) {
    L.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${list.length})`);
    L.push('');
    for (const f of list) {
      L.push(`### ${badge(f.severity)} ${esc(f.title)}`);
      L.push('');
      L.push(`**Priority ${f.priority.toFixed(1)} · confidence ${Math.round(f.confidence * 100)}% · effort ${f.effort} · source ${f.source}${f.consensus ? ' (consensus)' : ''}**`);
      L.push('');
      if (f.file) {
        L.push(`> \`${esc(loc(f))}\``);
        L.push('');
      }
      if (f.description) {
        L.push(String(f.description).trim());
        L.push('');
      }
      if (f.snippet) {
        L.push('```');
        L.push(String(f.snippet).trim());
        L.push('```');
        L.push('');
      }
      if (f.occurrences?.length > 2) {
        L.push(`All occurrences: ${f.occurrences.slice(0, 10).map((o) => `\`${esc(o.file)}:${o.lines ? `${o.lines[0]}-${o.lines[1]}` : ''}\``).join(' · ')}`);
        L.push('');
      }
      if (f.suggestion) { L.push(`**Fix:** ${f.suggestion}`); L.push(''); }
      if (f.benefit) { L.push(`**Benefit:** ${f.benefit}`); L.push(''); }
      if (f.risk) { L.push(`**Regression risk:** ${f.risk}`); L.push(''); }
      if (f.verification?.status && f.verification.status !== 'verified') {
        L.push(`> ⚠️ Evidence ${f.verification.status}: ${f.verification.note ?? ''}`);
        L.push('');
      }
      if (f.modelVerdicts?.length) {
        L.push(`Model verdicts: ${f.modelVerdicts.map((v) => `${v.action} (${v.by})`).join('; ')}`);
        L.push('');
      }
      if (f.contested) {
        L.push(`> ⚠️ A model suggested dismissing this finding (${f.contestedBy.join(', ')}). Critical/high/security findings are never auto-removed — the analyzer evidence and the verdict history are both kept for your judgment.`);
        L.push('');
      }
      L.push('---');
      L.push('');
    }
  }

  // Verification summary
  L.push(`## Verification & method`);
  L.push('');
  L.push(`- Evidence validation: **${stats.verification.verified}** verified (verbatim snippet located inside the cited range), **${stats.verification.adjusted}** adjusted (citation corrected to the snippet's real lines), **${stats.verification.unverified}** unverified (kept, flagged, down-weighted), **${stats.verification.dropped}** dropped before reporting.`);
  L.push(`- Verdict policy: model dismissals move findings to a visible "model-dismissed" group; critical/high/security findings are never auto-removed. This run: ${stats.verdicts.dismissed ?? 0} dismissed, ${stats.verdicts.contested ?? 0} contested.`);
  if (meta.changed) {
    L.push(`- Delta scope: findings are limited to the ${meta.changedFiles?.length ?? 0} changed file(s)${meta.deletedFiles?.length ? `; ${meta.deletedFiles.length} deleted file(s) detected` : ''}; issues in unchanged files are preserved only as labeled cross-file context.`);
  }
  if (redactionNote(report)) L.push(`- Secret handling: ${redactionNote(report)}`);
  L.push(`- Deterministic checks executed: ${checksExecuted.map((c) => `${c.id} (${c.count}${c.error ? ', error' : ''})`).join(', ') || 'none'}.`);
  if (toolNotes?.length) L.push(`- Tool notes: ${toolNotes.join(' ')}`);
  L.push(`- Model runs:`);
  if (!runs.length) {
    L.push(`  - none (deterministic-only audit)`);
  } else {
    for (const r of runs) {
      const usage = r.usage?.inputTokens != null ? ` · ${r.usage.inputTokens}/${r.usage.outputTokens} tokens` : '';
      L.push(`  - ${r.profile} (${r.model ?? '?'}) · ${r.phase} · ${r.adapter ?? ''} · ${fmtime(r.ms)}${usage} — ${r.ok ? 'ok' : `failed: ${r.error}`}${r.finishReason ? ` · finished: ${r.finishReason}` : ''}`);
    }
  }
  if (notes.length) {
    L.push('');
    L.push(`### Model notes`);
    L.push('');
    for (const n of notes) {
      L.push(`> ${n.profile}: ${String(n.text).replace(/\n+/g, ' ')}`);
      L.push('');
    }
  }
  L.push('');
  L.push(`---`);
  L.push(`Generated by \`code-audit\` v${meta.version} — read-only audit; no application files were modified. Exit-code policy: ${meta.failOn ? `fails CI on severity ≥ ${meta.failOn}` : 'report-only (use --fail-on for CI gates)'}.`);
  return L.join('\n');
}
