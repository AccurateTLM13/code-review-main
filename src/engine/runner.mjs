// The hybrid audit runner: deterministic checks always; structured model
// evaluation at standard depth; autonomous investigation at deep depth.
// Read-only: the only writes are inside .code-audit/ (reports + state).
//
// Hardening contracts implemented here:
//   - one run-level AbortController enforces the wall-clock budget across every
//     model call (native and SDK adapters both honor it)
//   - --changed scopes finding GENERATION to changed files; cross-file context
//     is preserved but labeled; deletions are detected and reported
//   - all findings pass through the secret redactor before reports are written
//   - model dismissals never erase analyzer evidence (grouped, kept visible)
import path from 'node:path';
import { loadConfig, expandModelSelection, resolveProfile, modelFingerprint, CATEGORIES, SEVERITIES } from '../config.mjs';
import { discoverRepo } from '../discovery/discover.mjs';
import { runChecks } from '../checks/index.mjs';
import { preflightRegisterSecrets } from '../checks/secrets.mjs';
import { createAdapter } from '../models/adapters.mjs';
import { createRedactor, redactFindings, redactDeep, assertNoRegisteredSecret } from '../util/redact.mjs';
import { validateEgressPolicy, policyForProfile, egressLabel, isRemoteEgress } from '../util/model-access.mjs';
import { buildContextPack } from './context.mjs';
import { runStructuredEvaluation, applyVerdicts } from './structured.mjs';
import { runAutonomousInvestigation } from './autonomous.mjs';
import { validateDrafts, mergeFindings } from '../evidence/validate.mjs';
import { scoreFindings, buildBacklog, severityCounts, categoryCounts, verificationStats, kindStats } from '../report/score.mjs';
import { renderMarkdown } from '../report/markdown.mjs';
import { buildJsonReport } from '../report/json.mjs';
import { createRunDir, writeState, computeChangedSet } from '../report/state.mjs';
import { isGitRepo, gitInfo } from '../util/git.mjs';
import { BINARY_EXTS, MAX_TEXT_BYTES, EXT_LANG, SOURCE_EXTS } from '../util/files.mjs';

const VERSION = '0.2.3';

export async function runScan(targetAbs, opts, logger) {
  const t0 = Date.now();
  const focus = opts.focus ?? 'all';
  const depth = opts.depth ?? 'standard';
  const failOn = opts.failOn ?? null;

  if (failOn && !SEVERITIES.includes(failOn)) {
    throw new Error(`--fail-on must be one of: ${SEVERITIES.join(', ')}`);
  }

  // --- config & profiles ---
  const { config, sources } = loadConfig(targetAbs);
  if (opts.extraIgnore?.length) config.ignore.push(...opts.extraIgnore);
  const profileNames = expandModelSelection(opts.models ?? config.defaultModels.join(','), config);
  if (opts.modelOverride && profileNames.length > 1) {
    throw new Error('--model can only override a single profile (got several via --models).');
  }
  const profiles = profileNames.map((n) => resolveProfile(n, config, { modelOverride: opts.modelOverride ?? null }));
  const useModels = depth !== 'quick' && profiles.length > 0;

  // A20: validate the secret-file egress policy BEFORE any model work — no
  // request is attempted while an override targets a remote/unknown endpoint
  // without explicit acknowledgment. Locality comes from the endpoint, never
  // from the profile name.
  const egress = validateEgressPolicy(profiles, config);
  if (useModels && !opts.quiet) {
    for (const p of profiles) {
      logger.debug(`profile "${p.name}" egress: ${egressLabel(p)}${isRemoteEgress(p) ? '' : ''}`);
    }
    if (egress.overrideEnabled && egress.remoteAcknowledged) {
      logger.warn('checks.allowSecretFileReads + allowSecretFileReadsRemote are enabled: secret-shaped files WILL be readable and sent to remote models. This is an explicit, high-risk acknowledgment.');
    }
  }
  if (depth === 'quick' && profiles.length && !opts.quiet) {
    logger.info('Depth "quick": running deterministic checks only (no model calls).');
  }
  if (!useModels && depth !== 'quick') {
    logger.warn('No model profiles available — falling back to deterministic-only audit.');
  }

  // --- run-level deadline (fractional minutes allowed) ---
  const timeoutMin = Number(opts.timeout ?? 15) > 0 ? Number(opts.timeout ?? 15) : 15;
  const deadline = Date.now() + timeoutMin * 60_000;
  const runAbort = new AbortController();
  const deadlineTimer = setTimeout(() => runAbort.abort(), timeoutMin * 60_000);
  const signal = runAbort.signal;

  // --- discovery ---
  const git = isGitRepo(targetAbs);
  const gitMeta = git ? gitInfo(targetAbs) : null;
  let changedSet = null;
  let deletedFiles = [];
  let changedBasis = null;
  const repo = await discoverRepo(targetAbs, { extraIgnores: config.ignore, logger });
  if (opts.changed) {
    const res = await computeChangedSet(targetAbs, repo, { useGit: git, logger });
    if (res.basis == null) {
      // A13: no trustworthy baseline (no state manifest, no git). A delta audit
      // against nothing would silently return an empty report — run a FULL
      // audit instead and record the baseline for the next --changed run.
      changedSet = null;
      changedBasis = 'full-fallback';
      logger.warn('No baseline available for --changed (no previous audit state, no git) — running a FULL audit and recording the baseline for next time.');
    } else {
      changedSet = res.changed;
      deletedFiles = res.deleted ?? [];
      changedBasis = res.basis;
      // Deleted-file NAMES are logged further down (after the redactor exists)
      // so paths carrying registered literals are redacted before output (A21).
      if (!changedSet.size && !deletedFiles.length) {
        logger.ok('No files changed since the last audit — nothing to review.');
      } else {
        logger.info(`Scoped audit to ${changedSet.size} changed file(s)${deletedFiles.length ? `, ${deletedFiles.length} deleted` : ''} (${res.basis}).`);
      }
    }
  }
  if (changedSet) repo.changedSet = [...changedSet];
  const scopeActive = changedSet != null;

  // --- deterministic checks (secret redaction registry runs first) ---
  logger.phase('Deterministic checks');
  const redactor = createRedactor({ enabled: config.checks.redactSecrets !== false });
  const checkCtx = {
    root: targetAbs,
    repo,
    fileStore: repo.fileStore,
    config,
    logger,
    redactor,
    git: git ? (await import('../util/git.mjs')) : null,
    changedSet,
  };
  // A11: unconditional preflight — register credential-like literals across ALL
  // model-readable text files (source + configs + .env), regardless of --focus,
  // so every downstream surface (prompts, tool results, reports) is sanitized.
  const preflightCount = preflightRegisterSecrets(checkCtx);
  if (preflightCount && !opts.quiet) {
    logger.debug(`Secret preflight registered ${preflightCount} literal(s) for redaction`);
  }
  // A21 (replay finding): deleted-file names can embed registered literals —
  // redact them like every other path-bearing surface before they hit stderr.
  if (deletedFiles.length && !opts.quiet) {
    logger.info(`Deleted since last audit: ${deletedFiles.slice(0, 10).map((f) => redactor.redact(f)).join(', ')}${deletedFiles.length > 10 ? ` … (+${deletedFiles.length - 10})` : ''}`);
  }
  const focusList = focus === 'all' ? CATEGORIES : [focus];
  const { findings: detFindings, executed: checksExecuted, toolNotes } = await runChecks(checkCtx, focusList);
  redactFindings(detFindings, redactor); // defense in depth: snippets/descriptions are already redacted
  logger.ok(`${detFindings.length} deterministic finding(s)${scopeActive ? ` (scoped to changed files)` : ''}`);

  // A17: reviewer identity = fingerprint of the actual model (provider +
  // endpoint + model id), so two profile aliases of one model never count as
  // independent reviewers for consensus or verdict voting.
  const fingerprints = new Map(profiles.map((p) => [p.name, modelFingerprint(p)]));

  // --- model phases ---
  const runs = [];
  const notes = [];
  let allVerdicts = [];
  let drafts = [];
  let validationStats = { verified: 0, adjusted: 0, unverified: 0, dropped: 0 };
  let autonomousToolLog = [];

  if (useModels) {
    logger.phase('Model passes');
    const structuredBudget = (p) => Math.min(p.contextChars ?? 160000, 260000);

    for (const profile of profiles) {
      if (Date.now() > deadline || signal.aborted) { logger.warn('Time budget reached — skipping remaining model profiles.'); break; }
      const phaseT0 = Date.now();
      logger.info(`Structured evaluation with "${profile.name}" (${profile.model ?? '?'})…`);
      let adapter;
      try {
        adapter = await createAdapter(profile);
      } catch (e) {
        runs.push({ profile: profile.name, model: profile.model, phase: 'adapter', adapter: '?', ms: Date.now() - phaseT0, usage: null, ok: false, error: e.message });
        logger.warn(`Profile "${profile.name}" unavailable: ${e.message}`);
        continue;
      }
      const pack = buildContextPack(repo, detFindings, { budgetChars: structuredBudget(profile), changedSet, redactor });
      logger.debug(`Context pack: ${(pack.chars / 1000).toFixed(0)}k chars, ${pack.included.length} files excerpted${pack.skipped ? `, ${pack.skipped} lines skipped` : ''}`);

      const result = await runStructuredEvaluation({ adapter, profile, contextPack: pack, focus, signal, redactor });
      if (result.run.error) result.run.error = redactor.redact(result.run.error);
      runs.push(result.run);
      if (result.run.ok) {
        logger.ok(`"${profile.name}": ${result.findingDrafts.length} finding(s), ${result.verdicts.length} verdict(s)`);
        if (result.notes) notes.push({ profile: profile.name, text: result.notes });
      } else {
        logger.warn(`"${profile.name}" structured pass failed: ${result.run.error}`);
        if (signal.aborted) break;
      }
      allVerdicts.push(...result.verdicts);
      drafts.push(...result.findingDrafts);
    }

    // deep: autonomous investigation with the primary (first) profile
    if (depth === 'deep' && profiles.length && Date.now() <= deadline && !signal.aborted) {
      const profile = profiles[0];
      logger.info(`Autonomous investigation with "${profile.name}" (max ${profile.maxSteps} steps)…`);
      let adapter = null;
      try { adapter = await createAdapter(profile); } catch (e) {
        runs.push({ profile: profile.name, model: profile.model, phase: 'autonomous', adapter: '?', ms: 0, usage: null, ok: false, error: e.message });
        logger.warn(`Profile "${profile.name}" unavailable for autonomous pass: ${e.message}`);
      }
      if (adapter) {
        const result = await runAutonomousInvestigation({
          adapter, profile, repo, focus, signal, logger, redactor,
          policy: policyForProfile(profile, config, egress),
          budget: {
            maxSteps: opts.maxSteps ?? profile.maxSteps ?? 24,
            maxToolCalls: Math.min((opts.maxSteps ?? profile.maxSteps ?? 24) * 3, 70),
            maxReadBytes: 4_000_000,
            deadline,
          },
        });
        runs.push(result.run);
        autonomousToolLog = result.toolLog;
        if (result.run.error) result.run.error = redactor.redact(result.run.error);
        if (result.run.ok) {
          logger.ok(`Investigation: ${result.findingDrafts.length} finding(s) via ${result.run.steps} step(s), finished="${result.run.finishReason}"`);
          if (result.notes) notes.push({ profile: `${profile.name} (autonomous)`, text: result.notes });
        } else {
          logger.warn(`Autonomous pass failed: ${result.run.error}`);
        }
        drafts.push(...result.findingDrafts);
      }
    }
  }
  clearTimeout(deadlineTimer);

  // --- verdicts, validation, merge, score ---
  const verdictStats = applyVerdicts(detFindings, allVerdicts, logger, { fingerprints });
  const validated = validateDrafts(drafts, { repo, logger, redactor });
  validationStats = validated.stats;

  const merged = mergeFindings([...detFindings, ...validated.findings], { fingerprints });
  redactFindings(merged, redactor); // model drafts may echo source text; redact before any report surface

  // Scope labeling under --changed: findings touching changed files are primary;
  // anything else is preserved but explicitly labeled as cross-file context.
  for (const f of merged) {
    if (!scopeActive) { f.scope = 'full'; continue; }
    const files = [f.file, ...(f.occurrences ?? []).map((o) => o.file)].filter(Boolean);
    f.scope = files.some((rel) => changedSet.has(rel)) ? 'changed' : 'cross-file';
  }

  const findings = scoreFindings(merged, { focus, scopeActive });
  const backlog = buildBacklog(findings);

  const stats = {
    bySeverity: severityCounts(findings),
    byCategory: categoryCounts(findings),
    kinds: kindStats(findings),
    verification: { ...validationStats, ...verificationStats(findings) },
    verdicts: verdictStats,
    consensusCount: findings.filter((f) => f.consensus).length,
    deterministic: detFindings.filter((f) => !f.dismissed).length,
    modelSourced: findings.filter((f) => f.source.startsWith('model:') || f.source.startsWith('agent:') || f.source === 'consensus').length,
    crossFile: findings.filter((f) => f.scope === 'cross-file').length,
  };

  // --- M3.6(d): failed model phases make this a PARTIAL audit, said loudly ---
  const failedRuns = runs.filter((r) => !r.ok);
  const partial = failedRuns.length > 0 || signal.aborted;
  const partialReasons = [
    ...failedRuns.map((r) => `model phase "${r.phase}" (profile "${r.profile}") failed: ${r.error ?? 'unknown error'}`),
    ...(signal.aborted ? ['run hit the wall-clock budget or was aborted — model review did not complete'] : []),
  ];

  // --- report ---
  const runDir = opts.output ? path.resolve(opts.output) : await createRunDir(targetAbs, config);
  // M3.3 coverage honesty: computed at report time, after every pass has
  // materialized what it read — states what was and was NOT inspected.
  const coverage = computeCoverage(repo);
  const report = {
    meta: {
      version: VERSION,
      timestamp: new Date().toISOString(),
      target: targetAbs,
      git: gitMeta,
      depth, focus,
      changed: Boolean(opts.changed),
      changedBasis,
      changedFiles: changedSet ? [...changedSet].slice(0, 100) : null,
      deletedFiles: deletedFiles.length ? deletedFiles.slice(0, 100) : [],
      models: profiles.map((p) => ({ profile: p.name, model: p.model, provider: p.provider, adapter: p.adapter, egress: egressLabel(p) })),
      failOn,
      durationMs: Date.now() - t0,
      exitCode: 0,
      configSources: sources,
      redaction: redactor.enabled ? 'on' : 'off',
      coverage,
      partial,
      partialReasons,
    },
    // serializable + sanitized repo view (paths can carry registered literals —
    // entry points, hotspots, docs and graph paths all pass through redaction)
    repo: null,
    stats, runs, checksExecuted, toolNotes, notes,
    findings, backlog,
  };
  report.repo = redactDeep({
    totalSourceFiles: repo.totalSourceFiles,
    totalLoc: repo.totalLoc,
    languages: repo.languages,
    stacks: repo.stacks,
    entryPoints: repo.entryPoints,
    docs: repo.docs,
    manifestFiles: repo.manifestFiles?.slice(0, 20),
    hotspots: repo.hotspots,
    graph: repo.graph.enabled ? { hubs: repo.graph.hubs, cycles: repo.graph.cycles, orphanCount: repo.graph.orphans.length } : null,
  }, redactor);

  // A12: sanitize EVERY report-bound surface, not only findings — model notes,
  // run metadata/errors, tool notes, verdict history, benefit/risk text.
  for (const n of notes) n.text = redactor.redact(String(n.text ?? ''));
  const sanitizedToolNotes = toolNotes.map((t) => redactor.redact(String(t)));
  report.meta = redactDeep(report.meta, redactor);
  report.stats = redactDeep(report.stats, redactor);
  report.runs = redactDeep(runs, redactor);
  report.checksExecuted = redactDeep(checksExecuted, redactor);
  report.toolNotes = sanitizedToolNotes;
  report.notes = redactDeep(notes, redactor);
  report.findings = redactDeep(findings, redactor);
  report.backlog = redactDeep(backlog, redactor);

  const fs = await import('node:fs/promises');
  await fs.mkdir(runDir, { recursive: true });
  const mdPath = path.join(runDir, 'report.md');
  const jsonPath = path.join(runDir, 'report.json');
  const mdText = renderMarkdown(report, { emoji: true });
  const jsonText = buildJsonReport(report);

  // A12 fail-closed validation: if a REGISTERED literal somehow survives every
  // sanitization layer into report output, refuse to write the report at all.
  // The error identifies the secret by its safe placeholder hash only.
  const leakPlaceholder = redactor.leakPlaceholderInto(mdText) ?? redactor.leakPlaceholderInto(jsonText);
  if (leakPlaceholder) {
    throw new Error(
      `fail-closed: a registered secret (${leakPlaceholder}) survived redaction into the report. ` +
      'Report NOT written. This is an internal redaction bug — please report it with the repository contents redacted.',
    );
  }
  await fs.writeFile(mdPath, mdText, 'utf8');
  await fs.writeFile(jsonPath, jsonText, 'utf8');

  // --- state for future --changed runs ---
  if (!opts.noState) {
    try { await writeState(targetAbs, repo); } catch (e) { logger.warn(`Could not write audit state: ${e.message}`); }
  }

  // --- console summary ---
  // A21 (replay finding): the printed report paths embed the target directory
  // name, which can carry a registered literal — redact the DISPLAY copies
  // (the writes above already happened at the real paths).
  printSummary(logger, report, {
    mdPath: redactor.redact(mdPath),
    jsonPath: redactor.redact(jsonPath),
    autonomousToolLog, scopeActive, deletedFiles, signal,
  });

  // --- exit code ---
  let exitCode = 0;
  if (failOn) {
    const threshold = SEVERITIES.indexOf(failOn);
    const triggered = findings.some((f) => !f.dismissed && f.scope !== 'cross-file' && SEVERITIES.indexOf(f.severity) <= threshold && f.priority >= 1.5);
    if (triggered) exitCode = 1;
  }
  const modelRunsRequested = runs.length;
  if (useModels && modelRunsRequested && runs.every((r) => !r.ok)) {
    logger.error('All requested model profiles failed — audit is incomplete.');
    exitCode = 2;
  }
  report.meta.exitCode = exitCode;
  await fs.writeFile(jsonPath, buildJsonReport(report), 'utf8');
  return { exitCode, report, runDir, mdPath, jsonPath };
}

function printSummary(logger, report, extra) {  const c = logger.colors;
  const s = report.stats.bySeverity;
  const parts = [
    s.critical ? `${c.red}${s.critical} critical${c.reset}` : null,
    s.high ? `${c.red}${s.high} high${c.reset}` : null,
    s.medium ? `${c.yellow}${s.medium} medium${c.reset}` : null,
    s.low ? `${c.blue}${s.low} low${c.reset}` : null,
    s.info ? `${c.dim}${s.info} info${c.reset}` : null,
  ].filter(Boolean);
  logger.out('');
  logger.phase('Audit complete');
  const kinds = report.stats.kinds ?? { defect: 0, defectVerified: 0, maintenance: 0 };
  logger.out(`  Findings: ${report.findings.length ? String(report.findings.length) : '0'}${parts.length ? ` (${parts.join(', ')})` : ' (none)'}`);
  if (kinds.defect || kinds.maintenance) {
    logger.out(`  Kind:     ${kinds.defect} defect(s) (${kinds.defectVerified} evidence-verified) · ${kinds.maintenance} maintenance observation(s)`);
  }
  if (extra.partial) {
    logger.warn('PARTIAL AUDIT — one or more model phases failed or the run was cut short; findings may be incomplete. Reasons in report (meta.partialReasons).');
  }
  if (extra.scopeActive) {
    logger.out(`  Scope:    ${report.meta.changedFiles?.length ?? 0} changed file(s)${report.meta.deletedFiles.length ? `, ${report.meta.deletedFiles.length} deleted` : ''} — findings limited to the delta; cross-file context labeled`);
    if (report.stats.crossFile) logger.out(`            ${report.stats.crossFile} cross-file context finding(s)`);
  } else if (report.meta.changed) {
    logger.out(`  Scope:    full scan (${report.meta.changedBasis ?? 'no baseline'} — no delta baseline existed yet; one was recorded for next time)`);
  }
  if (report.runs.length) {
    const okRuns = report.runs.filter((r) => r.ok).length;
    logger.out(`  Models:   ${report.meta.models.map((m) => m.profile).join(', ')} — ${okRuns}/${report.runs.length} pass(es) ok`);
  }
  if (report.stats.verdicts.dismissed || report.stats.verdicts.contested) {
    logger.out(`  Verdicts: ${report.stats.verdicts.dismissed} dismissed (kept for review), ${report.stats.verdicts.contested} contested`);
  }
  if (extra.autonomousToolLog?.length) {
    const calls = extra.autonomousToolLog.length;
    logger.out(`  Agent:    ${calls} tool call(s), deepest evidence chain verified`);
  }
  logger.out(`  Verified: ${report.stats.verification.verified} verified, ${report.stats.verification.unverified} unverified (flagged in report)`);
  if (extra.signal?.aborted) {
    logger.warn('Run hit the wall-clock budget — results are partial. Increase --timeout for a complete audit.');
  }
  if (report.findings.length) {
    const summaryEligible = report.findings.filter((f) => f.verification?.status !== 'unverified');
    const excluded = report.findings.length - summaryEligible.length;
    logger.out('');
    logger.out(`  ${c.bold}Top priorities${c.reset}${excluded ? `${c.dim} (verified findings only — ${excluded} unverified excluded)${c.reset}` : ''}`);
    for (const f of summaryEligible.slice(0, 6)) {
      const sev = SEV_COLOR[f.severity] ?? '';
      logger.out(`   ${c.dim}${f.priority.toFixed(1).padStart(5)}${c.reset} ${sev}${SEV_LABEL[f.severity]}${c.reset}${f.scope === 'cross-file' ? `${c.dim}×${c.reset}` : ' '} ${f.title}`);
      logger.out(`         ${c.dim}${f.file ?? ''}${f.lines ? `:${f.lines[0]}-${f.lines[1]}` : ''}${f.scope === 'cross-file' ? ' (cross-file)' : ''}${c.reset}`);
    }
  }
  logger.out('');
  logger.out(`  ${c.bold}Report:${c.reset} ${extra.mdPath}`);
  logger.out(`  ${c.bold}JSON:  ${c.reset}${extra.jsonPath}`);
}

const SEV_COLOR = { critical: c0('31;1'), high: c0('31'), medium: c0('33'), low: c0('36'), info: c0('2') };
const SEV_LABEL = { critical: 'CRIT ', high: 'HIGH ', medium: 'MED  ', low: 'LOW  ', info: 'INFO ' };
function c0(code) { return `\x1b[${code}m`; }

/**
 * M3.3: coverage honesty. Classifies every walked file by what the audit
 * actually did with it (classification uses extension + size; "seen" means
 * the content was materialized during the run). Never claims full coverage —
 * the report carries these counts verbatim.
 */
function computeCoverage(repo) {
  const files = repo.walk?.files ?? [];
  let sourceFilesScanned = 0, textFilesSeen = 0, skippedBinary = 0, skippedLarge = 0;
  const unsupported = new Map();
  for (const e of files) {
    if (BINARY_EXTS.has(e.ext)) { skippedBinary++; continue; }
    if (e.size > MAX_TEXT_BYTES) { skippedLarge++; continue; }
    if (e.ext && !EXT_LANG[e.ext]) {
      // an extension we have no language/analyzer pack for
      unsupported.set(e.ext, (unsupported.get(e.ext) ?? 0) + 1);
      continue;
    }
    // source- and text-classified files (incl. extensionless configs like
    // .env/.gitignore, which the deterministic checks do read)
    const materialized = repo.fileStore.lines(e.rel) != null;
    if (materialized) textFilesSeen++;
    if (SOURCE_EXTS.has(e.ext) && materialized) sourceFilesScanned++;
  }
  return {
    walkedFiles: files.length,
    sourceFilesScanned,
    textFilesSeen,
    skippedBinary,
    skippedLarge,
    maxTextBytes: MAX_TEXT_BYTES,
    walkTruncated: Boolean(repo.walk?.truncated),
    unsupportedLanguages: [...unsupported.entries()]
      .map(([ext, n]) => ({ ext, files: n }))
      .sort((a, b) => b.files - a.files)
      .slice(0, 12),
  };
}
