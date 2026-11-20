// Autonomous investigation: the model drives the read-only toolkit itself,
// under hard budgets, and submits evidence-backed findings.
import path from 'node:path';
import { autonomousSystemPrompt, autonomousUserPrompt } from './prompts.mjs';
import { createToolkit } from './tools.mjs';
import { assertNoRegisteredSecret } from '../util/redact.mjs';

/**
 * @returns { findingDrafts, notes, toolLog, run: {…, ok, error?, steps, finishReason, usage} }
 */
export async function runAutonomousInvestigation({ adapter, profile, repo, focus, budget, signal, logger, redactor = null, policy = null }) {
  const toolkit = createToolkit(repo, {
    budgets: {
      maxToolCalls: budget.maxToolCalls,
      maxReadBytes: budget.maxReadBytes,
      deadline: budget.deadline,
      profileName: profile.name,
      logger,
    },
    redactor,
    policy,
    logger,
  });

  const brief = redactor ? redactor.redact(summarizeBrief(repo, focus)) : summarizeBrief(repo, focus);
  const system = autonomousSystemPrompt({ focus, budget: budget.maxSteps });
  const prompt = autonomousUserPrompt(brief, { focus, budget: budget.maxToolCalls });
  // A19: final model-request boundary — nothing crosses with a registered literal.
  assertNoRegisteredSecret(system + prompt, redactor, 'autonomous brief');
  const t0 = Date.now();

  let result;
  try {
    result = await adapter.investigate({
      system,
      prompt,
      tools: toolkit.tools,
      maxSteps: budget.maxSteps,
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      signal,
    });
  } catch (err) {
    return {
      findingDrafts: toolkit.state.submitted?.drafts ?? [],
      notes: toolkit.state.submitted?.notes ?? '',
      toolLog: [],
      run: {
        profile: profile.name, model: profile.model, phase: 'autonomous', adapter: adapter.kind,
        ms: Date.now() - t0, steps: 0, finishReason: 'error', usage: null, ok: false, error: err.message,
      },
    };
  }

  const submitted = toolkit.state.submitted;
  return {
    findingDrafts: submitted?.drafts ?? [],
    notes: submitted?.notes ?? '',
    toolLog: result.toolLog ?? [],
    run: {
      profile: profile.name, model: profile.model, phase: 'autonomous', adapter: adapter.kind,
      ms: Date.now() - t0, steps: result.steps ?? 0, finishReason: result.finishReason,
      usage: result.usage, ok: true,
      note: submitted ? undefined : 'Investigation ended without calling submit_findings — budget or model stopped early.',
    },
  };
}

function summarizeBrief(repo, focus) {
  const lines = [];
  lines.push(`Repository: ${path.basename(repo.root)}`);
  lines.push(`Source files: ${repo.totalSourceFiles}, total LOC: ${repo.totalLoc}`);
  if (repo.languages.length) {
    lines.push(`Languages: ${repo.languages.slice(0, 4).map((l) => `${l.language} (${l.files} files, ${l.loc} LOC)`).join(', ')}`);
  }
  if (repo.stacks.length) lines.push(`Stacks: ${repo.stacks.map((s) => s.name).slice(0, 8).join(', ')}`);
  if (repo.entryPoints.length) lines.push(`Entry points: ${repo.entryPoints.map((e) => e.file).join(', ')}`);
  if (repo.hotspots.length) {
    lines.push(`Suggested starting points (hotspots): ${repo.hotspots.slice(0, 6).map((h) => `${h.rel} (${h.loc} lines, ${h.importers} importers)`).join(' | ')}`);
  }
  if (repo.graph.cycles.length) lines.push(`Known import cycles: ${repo.graph.cycles.map((c) => c.join('→')).join(' ; ')}`);
  if (repo.changedSet?.length) lines.push(`Recently changed: ${repo.changedSet.slice(0, 25).join(', ')}`);
  if (focus !== 'all') lines.push(`The audit focus for this run is: ${focus}.`);
  return lines.join('\n');
}
