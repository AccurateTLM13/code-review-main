// code-audit CLI. Zero-dependency argument parsing; all heavy lifting in src/.
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createLogger, colors } from './util/log.mjs';
import { loadConfig, probeProfile, expandModelSelection, DEPTHS, FOCUS_AREAS, SEVERITIES, PROVIDERS } from './config.mjs';
import { runScan } from './engine/runner.mjs';
import { findLatestRun, reportsDir } from './report/state.mjs';

const VERSION = '0.2.2';
const HERE = path.dirname(fileURLToPath(import.meta.url));

function usage() {
  return `
${colors.bold}code-audit${colors.reset} v${VERSION} — model-agnostic, read-only code audit agent

${colors.cyan}Usage:${colors.reset}
  code-audit scan [path] [options]      Audit a repository (default: current dir)
  code-audit models [profile]           List configured model profiles and probe them
  code-audit last [path]                Show the latest audit report summary
  code-audit init [path]                Write an example code-audit.config.json
  code-audit help                       Show this help

${colors.cyan}Scan options:${colors.reset}
  --focus <area>      security | bugs | duplication | performance | refactoring | debt | all
                      (default: all)
  --depth <level>     quick (deterministic only, free & fast)
                      standard (checks + model evaluation — default)
                      deep (standard + autonomous model investigation)
  --models <list>     comma-separated profiles: local, openrouter, deep, mock, multi…
                      (default: from config, initial: local)
  --model <id>        override the model id of the selected profile
  --changed           audit only files changed since the last audit (state manifest,
                      falls back to git status for the first run)
  --output <dir>      write reports to this directory instead of .code-audit/reports/
  --fail-on <sev>     exit code 1 if any finding is this severity or higher (CI gate)
  --timeout <min>     overall wall-clock budget (default 15; fractions allowed)
  --max-steps <n>     cap for the autonomous investigation (default: profile)
  --no-state          do not update the last-audit manifest
  --quiet, --verbose, --no-color

${colors.cyan}Examples:${colors.reset}
  code-audit scan .
  code-audit scan . --focus refactoring
  code-audit scan . --depth deep
  code-audit scan . --models local,openrouter
  code-audit scan . --changed
  code-audit scan . --models mock --depth deep        # offline demo of the full pipeline

The audit is strictly ${colors.bold}read-only${colors.reset}: application code is never modified.
Reports land in .code-audit/reports/<timestamp>/ (markdown + json).
`;
}

// ---------- argument parsing ----------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const name = eq === -1 ? a.slice(2) : a.slice(2, eq);
      const value = eq === -1 ? null : a.slice(eq + 1);
      const needsValue = ['focus', 'depth', 'models', 'model', 'output', 'fail-on', 'timeout', 'max-steps', 'config'].includes(name);
      if (value != null) flags[name] = value;
      else if (needsValue && i + 1 < argv.length) flags[name] = argv[++i];
      else flags[name] = true;
    } else if (a === '-h' || a === '-?') flags.help = true;
    else if (a === '-v') flags.version = true;
    else positional.push(a);
  }
  return { positional, flags };
}

function resolveTarget(p) {
  const abs = path.resolve(p ?? '.');
  if (!fs.existsSync(abs)) throw new Error(`Path does not exist: ${abs}`);
  const st = fs.statSync(abs);
  if (!st.isDirectory()) throw new Error(`Not a directory: ${abs} (scan a repository root)`);
  return abs;
}

// ---------- commands ----------

async function cmdScan(flags, logger) {
  const target = resolveTarget(flags.positional?.[0] ?? '.');
  if (flags.color === false || flags['no-color']) process.env.CODE_AUDIT_NO_COLOR = '1';
  if (flags.config) process.env.CODE_AUDIT_CONFIG = path.resolve(flags.config);

  const focus = flags.focus ?? 'all';
  if (!FOCUS_AREAS.includes(focus)) throw new Error(`Unknown focus "${focus}". Choose one of: ${FOCUS_AREAS.join(', ')}`);
  const depth = flags.depth ?? 'standard';
  if (!DEPTHS.includes(depth)) throw new Error(`Unknown depth "${depth}". Choose one of: ${DEPTHS.join(', ')}`);

  const result = await runScan(target, {
    focus, depth,
    models: flags.models ?? null,
    modelOverride: flags.model ?? null,
    changed: Boolean(flags.changed),
    output: flags.output ?? null,
    failOn: flags['fail-on'] ?? null,
    timeout: Number(flags.timeout ?? 15) || 15,
    maxSteps: flags['max-steps'] ? Number(flags['max-steps']) : undefined,
    noState: Boolean(flags['no-state']),
    quiet: flags.quiet,
  }, logger);
  return result.exitCode;
}

async function cmdModels(flags, logger) {
  const target = resolveTarget(flags.positional?.[0] ?? '.');
  const { config, sources } = loadConfig(target);
  const requested = flags.positional?.[1]; // "code-audit models local"
  const names = requested ? expandModelSelection(requested, config) : Object.keys(config.profiles);

  logger.out(`${colors.bold}Model profiles${colors.reset} (config: ${sources.length ? sources.join(' → ') : 'defaults'})`);
  logger.out('');
  for (const name of names) {
    const prof = config.profiles[name];
    const meta = PROVIDERS[prof.provider ?? 'openai-compatible'] ?? { label: prof.provider };
    logger.out(`${colors.cyan}${name}${colors.reset} — ${meta.label}`);
    logger.out(`    model:       ${prof.model ?? `${colors.dim}(set in config)${colors.reset}`}`);
    if (prof.baseUrl ?? meta.defaultBaseUrl) logger.out(`    endpoint:    ${prof.baseUrl ?? meta.defaultBaseUrl}`);
    if (prof.apiKeyEnv ?? meta.apiKeyEnv) {
      const envName = prof.apiKeyEnv ?? meta.apiKeyEnv;
      const mark = process.env[envName] ? `${colors.green}✓ set${colors.reset}` : `${colors.yellow}✗ not set${colors.reset}`;
      logger.out(`    api key env: ${envName} ${mark}`);
    }
    logger.out(`    budgets:     context ~${(prof.contextChars ?? 160000).toLocaleString()} chars, ${prof.maxTokens ?? 4096} max tokens, ${prof.maxSteps ?? 24} agent steps`);
  }
  logger.out('');
  logger.out(`${colors.dim}Probing endpoints…${colors.reset}`);
  for (const name of names) {
    const r = await probeProfile(name, config);
    const mark = r.ok ? `${colors.green}● reachable${colors.reset}` : `${colors.red}○ unavailable${colors.reset}`;
    logger.out(`  ${mark}${colors.reset} ${name}: ${r.detail}`);
    if (r.models?.length) logger.out(`      models: ${r.models.slice(0, 8).join(', ')}${r.models.length > 8 ? ` … (+${r.models.length - 8})` : ''}`);
  }
  logger.out('');
  logger.out(`${colors.dim}Edit code-audit.config.json (or run "code-audit init") to change profiles.${colors.reset}`);
  return 0;
}

async function cmdInit(flags, logger) {
  const target = resolveTarget(flags.positional?.[0] ?? '.');
  const dest = path.join(target, 'code-audit.config.json');
  if (fs.existsSync(dest)) {
    logger.warn(`Config already exists: ${dest}`);
    return 0;
  }
  const examplePath = path.join(HERE, '..', 'code-audit.config.example.json');
  let content;
  try { content = await fsp.readFile(examplePath, 'utf8'); } catch {
    content = JSON.stringify({ profiles: {}, defaultModels: ['local'] }, null, 2);
  }
  await fsp.writeFile(dest, content, 'utf8');
  logger.ok(`Wrote ${dest}`);
  logger.out(`${colors.dim}Profiles merge over built-in defaults (local/openrouter/deep/mock).${colors.reset}`);
  return 0;
}

async function cmdLast(flags, logger) {
  const target = resolveTarget(flags.positional?.[0] ?? '.');
  const { config } = loadConfig(target);
  const dir = findLatestRun(target, config);
  if (!dir) {
    logger.warn('No previous report found. Run "code-audit scan" first.');
    return 0;
  }
  const jsonPath = path.join(dir, 'report.json');
  let report;
  try { report = JSON.parse(await fsp.readFile(jsonPath, 'utf8')); } catch {
    logger.error(`Report unreadable: ${jsonPath}`);
    return 2;
  }
  const s = report.stats.bySeverity;
  logger.out(`${colors.bold}Latest audit${colors.reset} — ${report.meta.timestamp} · depth ${report.meta.depth} · focus ${report.meta.focus}`);
  logger.out(`  Findings: ${report.findings.length} (${s.critical} critical / ${s.high} high / ${s.medium} medium / ${s.low} low / ${s.info} info)`);
  for (const f of report.findings.slice(0, 8)) {
    logger.out(`   ${f.priority.toFixed(1).padStart(5)}  ${SEV_MARK[f.severity] ?? ''}${f.severity.toUpperCase().padEnd(8)}${colors.reset} ${f.title}`);
    logger.out(`         ${colors.dim}${f.file ?? ''}${f.lines ? `:${f.lines[0]}-${f.lines[1]}` : ''}${colors.reset}`);
  }
  logger.out('');
  logger.out(`  Markdown: ${path.join(dir, 'report.md')}`);
  logger.out(`  JSON:     ${jsonPath}`);
  return 0;
}

const SEV_MARK = { critical: colors.red, high: colors.red, medium: colors.yellow, low: colors.cyan, info: colors.dim };

// ---------- main ----------

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0] ?? 'help';
  const rest = { positional: positional.slice(1), flags: { ...flags, positional: positional.slice(1) } };

  if (flags.version || command === '--version') { console.log(`code-audit v${VERSION}`); return 0; }
  if (flags.help || command === 'help') { console.log(usage()); return 0; }

  if (flags['no-color'] || flags.color === false) process.env.CODE_AUDIT_NO_COLOR = '1';
  const logger = createLogger({ verbose: Boolean(flags.verbose), quiet: Boolean(flags.quiet) });

  switch (command) {
    case 'scan': return await cmdScan(rest.flags, logger);
    case 'models': return await cmdModels(rest, logger);
    case 'init': return await cmdInit(rest, logger);
    case 'last': return await cmdLast(rest, logger);
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(usage());
      return 2;
  }
}

main()
  .then((code) => {
    process.exitCode = code ?? 0;
    // Let the event loop drain naturally (sockets, timers). If something
    // unexpected keeps it alive, force-exit after a grace period.
    const t = setTimeout(() => process.exit(code ?? 0), 4000);
    if (typeof t.unref === 'function') t.unref();
  })
  .catch((err) => {
    const msg = err?.message ?? String(err);
    console.error(`${colors.red}✗${colors.reset} ${msg}`);
    if (process.env.CODE_AUDIT_DEBUG) console.error(err?.stack ?? err);
    process.exitCode = 2;
    const t = setTimeout(() => process.exit(2), 4000);
    if (typeof t.unref === 'function') t.unref();
  });
