// Read-only investigation toolkit handed to the autonomous model.
// Every tool is jailed to the walked file set, size-bounded, and budget-capped.
// There is deliberately no write/execute tool anywhere in this file.
//
// Budget contract (enforced on ACTUAL output, not estimates):
//   - read_file never returns more than 400 lines / ~20 KB, and charges the
//     real serialized size against the read budget
//   - submit_findings is exempt from the tool-call cap so the model can always
//     finish gracefully when the budget is exhausted
//   - every text surface passes through the secret redactor
import path from 'node:path';
import { repoDigest } from '../discovery/discover.mjs';
import { normalizeSeverity, normalizeCategory } from './structured.mjs';
import { createModelPolicy } from '../util/model-access.mjs';

const READ_LINE_CAP = 400;
const READ_CHAR_CAP = 20_000;
const GRAPH_LIST_CAP = 40;

export function createToolkit(repo, { budgets, redactor = null, logger, policy = null }) {
  const store = repo.fileStore;
  const state = { submitted: null, toolCalls: 0, readBytes: 0 };
  const budget = {
    maxToolCalls: budgets.maxToolCalls ?? 80,
    maxReadBytes: budgets.maxReadBytes ?? 4_000_000,
    deadline: budgets.deadline ?? Number.POSITIVE_INFINITY,
    ...budgets,
  };
  // A18: one file-exposure policy on every content-bearing route.
  // Default when none is supplied: credential-shaped files are denied.
  const access = policy ?? createModelPolicy({ allowSecretFiles: false });
  const redact = (text) => (redactor ? redactor.redact(text) : text);

  const guard = (name, costBytes = 0) => {
    if (Date.now() > budget.deadline) return { error: 'Time budget exhausted. Call submit_findings with what you have.' };
    // The terminal tool is always allowed, even past the call budget.
    if (name !== 'submit_findings') {
      state.toolCalls++;
      if (state.toolCalls > budget.maxToolCalls) {
        return { error: `Tool-call budget (${budget.maxToolCalls}) exhausted. Call submit_findings now with your findings so far.` };
      }
    }
    state.readBytes += costBytes;
    if (state.readBytes > budget.maxReadBytes) {
      return { error: 'Read budget exhausted. Call submit_findings with what you have.' };
    }
    logger?.debug(`tool → ${name}${costBytes ? ` (${costBytes} chars)` : ''}`);
    return null;
  };

  const jail = (p) => {
    const rel = String(p ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (rel.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(rel)) return { error: 'Use a relative path (as returned by the tools), not an absolute one.' };
    const norm = path.posix.normalize(rel);
    if (norm.startsWith('..')) return { error: 'Path escapes the repository.' };
    if (!store.has(norm)) {
      return { error: `File not in the scanned set: "${norm}". Use list_files/search_code to find valid relative paths.` };
    }
    // A18: default-deny known secret-shaped files on every content route.
    // Redaction is defense in depth; the filename policy is the gate.
    const exposure = access.canExposeFile(norm);
    if (!exposure.ok) return { error: exposure.reason };
    return { rel: norm };
  };

  const tools = [
    {
      name: 'get_summary',
      description: 'Repository digest: languages, stacks, entry points, import hubs, cycles, hotspots, recently changed files, and the first ~60 source file paths.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        const g = guard('get_summary');
        if (g) return g;
        // A19: the digest lists file paths — sanitize the whole response
        return { summary: redact(repoDigest(repo, { maxFiles: 60 })) };
      },
    },
    {
      name: 'list_files',
      description: 'List files (relative paths + sizes). Optional dir prefix, glob filter (e.g. "src/**/*.ts"), limit (default 120).',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Optional directory prefix, e.g. "src/"' },
          glob: { type: 'string', description: 'Optional glob, e.g. "**/*.py"' },
          limit: { type: 'number', description: 'Max entries (default 120)' },
        },
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const g = guard('list_files');
        if (g) return g;
        const limit = Math.min(Math.max(1, Math.floor(args.limit ?? 120)), 300);
        let entries = store.all;
        if (args.dir) {
          const dir = String(args.dir).replace(/\\/g, '/').replace(/\/+$/, '');
          entries = entries.filter((e) => e.rel === dir || e.rel.startsWith(dir + '/'));
        }
        if (args.glob) {
          const re = globToRegexLoose(String(args.glob));
          entries = entries.filter((e) => re.test(e.rel));
        }
        const slice = entries.slice(0, limit).map((e) => ({ path: redact(e.rel), bytes: e.size }));
        return { files: slice, total: entries.length, truncated: entries.length > limit };
      },
    },
    {
      name: 'read_file',
      description: `Read a bounded slice of one file with line numbers (max ${READ_LINE_CAP} lines / ${Math.round(READ_CHAR_CAP / 1000)}k chars per call). Paths must come from list_files/get_summary/search_code output.`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
          start: { type: 'number', description: 'First line (default 1)' },
          end: { type: 'number', description: 'Last line (default start + 399; hard-capped)' },
        },
        required: ['path'],
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const j = jail(args.path);
        if (j.error) return j;
        const lines = store.lines(j.rel);
        if (!lines) return { error: 'File is binary or unreadable.' };
        const start = Math.max(1, Math.floor(args.start ?? 1));
        // Hard cap: never more than READ_LINE_CAP lines from the requested start.
        const end = Math.min(
          lines.length,
          Math.floor(args.end ?? start + READ_LINE_CAP - 1),
          start + READ_LINE_CAP - 1,
        );
        const rows = lines.slice(start - 1, end).map((text, i) => ({ line: start + i, text: redact(text).slice(0, 400) }));
        // Charge the ACTUAL serialized size, then enforce the output cap.
        let cost = rows.reduce((n, r) => n + r.text.length + 10, 0);
        let truncatedChars = false;
        if (cost > READ_CHAR_CAP) {
          const kept = [];
          let used = 0;
          for (const r of rows) {
            if (used + r.text.length + 10 > READ_CHAR_CAP) { truncatedChars = true; break; }
            kept.push(r); used += r.text.length + 10;
          }
          rows.length = kept.length; // `rows` already starts with these items in order
          cost = used;
        }
        const g = guard('read_file', cost);
        if (g) return g;
        return {
          path: j.rel, ofLines: lines.length,
          lines: rows.length ? rows : [{ line: start, text: '(empty range)' }],
          truncatedByChars: truncatedChars || undefined,
        };
      },
    },
    {
      name: 'search_code',
      description: 'Search all text files for a substring (default) or regex (isRegex=true). Returns path:line + the matching line. Optional glob filter, maxResults (default 40).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text or regex pattern' },
          isRegex: { type: 'boolean', description: 'Treat query as regex (default false)' },
          glob: { type: 'string', description: 'Optional glob, e.g. "**/*.go"' },
          maxResults: { type: 'number', description: 'Max matches (default 40)' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const query = String(args.query ?? '');
        if (query.length < 2) return { error: 'Query too short.' };
        if (query.length > 200) return { error: 'Query too long (max 200 chars).' };
        let re;
        if (args.isRegex) {
          try { re = new RegExp(query, 'i'); } catch (e) { return { error: `Invalid regex: ${e.message}` }; }
        } else {
          re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        }
        const maxResults = Math.min(Math.max(1, Math.floor(args.maxResults ?? 40)), 100);
        // A18: search applies the same file-exposure policy as read_file —
        // secret-shaped files are excluded BEFORE any content matching, so
        // unrecognized credential formats cannot leak through search either.
        const files = (args.glob
          ? store.all.filter((e) => globToRegexLoose(String(args.glob)).test(e.rel))
          : store.all
        ).filter((e) => access.canExposeFile(e.rel).ok);
        const matches = [];
        let cost = 0;
        outer: for (const entry of files.slice(0, 8000)) {
          const lines = store.lines(entry.rel);
          if (!lines) continue;
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              const text = redact(lines[i]).trim().slice(0, 240);
              matches.push({ path: entry.rel, line: i + 1, text });
              cost += text.length + 20;
              if (matches.length >= maxResults) break outer;
            }
          }
        }
        const g = guard('search_code', cost);
        if (g) return g;
        return { matches, truncated: matches.length >= maxResults };
      },
    },
    {
      name: 'get_graph',
      description: 'Import relationships for one file: what it imports and which files import it (bounded to 40 entries per side).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative file path' } },
        required: ['path'],
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        // A15: get_graph honors the same budget guard as every non-terminal tool
        const g = guard('get_graph');
        if (g) return g;
        const j = jail(args.path);
        if (j.error) return j;
        if (!repo.graph?.enabled) return { error: 'Import graph not available for this repository.' };
        const allImports = repo.graph.imports?.[j.rel] ?? [];
        const allDependents = repo.graph.dependents?.[j.rel] ?? [];
        return {
          path: redact(j.rel),
          imports: allImports.slice(0, GRAPH_LIST_CAP).map(redact),
          dependents: allDependents.slice(0, GRAPH_LIST_CAP).map(redact),
          truncated: allImports.length > GRAPH_LIST_CAP || allDependents.length > GRAPH_LIST_CAP || undefined,
        };
      },
    },
    {
      name: 'submit_findings',
      description: 'Submit your final findings and end the investigation. Each finding must cite a real file you read, with exact lines and a verbatim snippet copied from read_file output. Findings without a snippet will be marked unverified.',
      terminal: true,
      parameters: {
        type: 'object',
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                category: { type: 'string', description: 'security|bug|duplication|performance|refactoring|debt' },
                severity: { type: 'string', description: 'critical|high|medium|low|info' },
                confidence: { type: 'number' },
                file: { type: 'string' },
                lines: { type: 'array', items: { type: 'number' } },
                snippet: { type: 'string' },
                description: { type: 'string' },
                suggestion: { type: 'string' },
                benefit: { type: 'string' },
                risk: { type: 'string' },
              },
              required: ['title', 'file'],
            },
          },
          notes: { type: 'string', description: 'Overall assessment / caveats' },
        },
        required: ['findings'],
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const g = guard('submit_findings');
        if (g) return g;
        const drafts = [];
        for (const f of Array.isArray(args.findings) ? args.findings : []) {
          if (!f || typeof f !== 'object' || !f.title || !f.file) continue;
          drafts.push({
            checkId: 'agent',
            source: `agent:${budgets.profileName ?? 'model'}`,
            title: String(f.title).slice(0, 140),
            category: normalizeCategory(f.category) ?? 'bug',
            severity: normalizeSeverity(f.severity) ?? 'medium',
            confidence: Number.isFinite(Number(f.confidence)) ? Math.max(0, Math.min(1, Number(f.confidence))) : 0.4,
            file: String(f.file).replace(/\\/g, '/').replace(/^\.\//, ''),
            lines: Array.isArray(f.lines) && f.lines.length >= 2
              ? [Math.round(Number(f.lines[0]) || 1), Math.round(Number(f.lines[1]) || Number(f.lines[0]) || 1)]
              : Array.isArray(f.lines) && f.lines.length ? [Math.round(Number(f.lines[0]) || 1), Math.round(Number(f.lines[0]) || 1)] : null,
            snippet: f.snippet ? redact(String(f.snippet)).slice(0, 1200) : null,
            description: redact(String(f.description ?? '')).slice(0, 900),
            suggestion: f.suggestion ? String(f.suggestion).slice(0, 500) : null,
            benefit: f.benefit ? String(f.benefit).slice(0, 300) : null,
            risk: f.risk ? String(f.risk).slice(0, 300) : null,
          });
        }
        state.submitted = { drafts, notes: String(args.notes ?? '').slice(0, 1500) };
        return { received: true, accepted: drafts.length, hint: drafts.length ? undefined : 'No valid findings — each needs at least title and file.' };
      },
    },
  ];

  return { tools, state };
}

function globToRegexLoose(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') { while (glob[i + 1] === '*') i++; if (glob[i + 1] === '/') { re += '[\\s\\S]*'; i++; } else re += '[\\s\\S]*'; }
      else re += '[^/]*';
    } else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(re, 'i');
}
