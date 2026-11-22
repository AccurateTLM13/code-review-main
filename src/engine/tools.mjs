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
//
// A21: ONE serialization boundary for every model-facing tool result. Every
// return — payload AND error objects — passes through emit(), which
// deep-redacts the payload and then fail-closed asserts that no registered
// secret literal survives serialization; a surviving literal aborts the tool
// call (the adapter surfaces the error to the model) and nothing reaches the
// wire. The error names a blocked secret only by its safe placeholder hash.
//
// A21 (referenceability): files stay fully referenceable after path redaction.
// Every path-bearing result carries an opaque `handle` (f1, f2, …), and
// read_file / get_graph / submit_findings accept a handle, the raw relative
// path, OR the exact redacted path a tool returned. A file whose name contains
// a registered secret is therefore still findable, readable and citable — the
// model just never sees the raw name.
//
// A23: regex searches compile and run inside a bounded worker with a host-side
// hard deadline (util/regex-worker.mjs) — a catastrophic pattern returns a
// budget error instead of hanging the process. Model-authored GLOB filters
// compile to RegExp too, so they are canary-checked with the same mechanism
// before use on the main thread.
import path from 'node:path';
import { repoDigest } from '../discovery/discover.mjs';
import { normalizeSeverity, normalizeCategory } from './structured.mjs';
import { createModelPolicy } from '../util/model-access.mjs';
import { redactDeep, assertNoRegisteredSecret } from '../util/redact.mjs';
import { runBoundedRegexSearch, MAX_REGEX_FILES } from '../util/regex-worker.mjs';

const READ_LINE_CAP = 400;
const READ_CHAR_CAP = 20_000;
const GRAPH_LIST_CAP = 40;
// Hard deadline for ONE regex search call. Worst case (canary + full scan
// timeout) stays far under the 2 s acceptance bound for a single tool call.
const REGEX_TOOL_DEADLINE_MS = 1200;
const GLOB_BUDGET_MESSAGE = 'glob filter exceeded its time budget; simplify the pattern (or drop the glob)';
const HANDLE_RE = /^f\d+$/;

/**
 * A21: the single serialization gate shared by every tool return.
 * Deep-redacts the payload, then fail-closed: a registered literal that
 * survived (e.g. hidden in an object KEY, which value-redaction cannot touch)
 * throws BEFORE anything reaches the model adapter. Exported for the
 * acceptance suite ([24]) so the boundary itself is testable.
 */
export function emitToolResult({ name, payload, redactor }) {
  const safe = redactDeep(payload ?? {}, redactor);
  assertNoRegisteredSecret(JSON.stringify(safe) ?? 'null', redactor, `tool result: ${name}`);
  return safe;
}

export function createToolkit(repo, { budgets, redactor = null, logger, policy = null }) {
  const store = repo.fileStore;
  const state = {
    submitted: null, toolCalls: 0, readBytes: 0,
    // A21 opaque file handles: rel -> 'f1','f2',… (allocated lazily by any
    // tool that returns paths) plus the reverse maps for resolution.
    handles: new Map(),       // real rel -> handle
    byHandle: new Map(),      // handle -> real rel
    byRedacted: new Map(),    // redacted path -> real rel (built eagerly)
  };
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

  // A21: ANY redacted path shown by any surface (list_files, get_summary
  // digest, get_graph lists, search results) stays citable: build the
  // redacted→real map up front. Registration (preflight) always runs before
  // the toolkit is created, so this sees the full registry.
  if (redactor?.size) {
    for (const e of store.all) {
      const shown = redactor.redact(e.rel);
      if (shown !== e.rel) state.byRedacted.set(shown, e.rel);
    }
  }

  const emit = (name, payload) => emitToolResult({ name, payload, redactor });

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

  /** Allocate (or return) the opaque handle for a file. */
  const handleFor = (rel) => {
    let h = state.handles.get(rel);
    if (!h) {
      h = `f${state.handles.size + 1}`;
      state.handles.set(rel, h);
      state.byHandle.set(h, rel);
    }
    return h;
  };

  /**
   * Resolve a model-supplied file reference to a real store rel.
   * Accepts, in order: an opaque handle (preferred), the raw relative path,
   * or the exact redacted path any tool returned. Applies the relative-path
   * jail to path-shaped inputs. Policy checks stay with the CALLING route:
   * content routes (read_file/get_graph) enforce the file-exposure policy;
   * submit_findings resolves citations without a policy gate.
   */
  const resolveRef = (rawRef) => {
    const ref = String(rawRef ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (!ref) return { error: 'Provide the file handle (preferred) or a relative path as returned by the tools.' };
    if (HANDLE_RE.test(ref)) {
      const rel = state.byHandle.get(ref);
      if (!rel) return { error: `Unknown file handle "${ref}". Use list_files/search_code to get current handles.` };
      return { rel };
    }
    if (ref.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(ref)) {
      return { error: 'Use a relative path (as returned by the tools), not an absolute one.' };
    }
    const norm = path.posix.normalize(ref);
    if (norm.startsWith('..')) return { error: 'Path escapes the repository.' };
    if (store.has(norm)) return { rel: norm };
    const viaRedacted = state.byRedacted.get(norm);
    if (viaRedacted) return { rel: viaRedacted };
    return { error: `File not in the scanned set: "${norm}". Use list_files/search_code to find valid relative paths or handles.` };
  };

  /** Content-route gate: resolve, then apply the A18 file-exposure policy. */
  const resolveForContent = (rawRef) => {
    const t = resolveRef(rawRef);
    if (t.error) return t;
    const exposure = access.canExposeFile(t.rel);
    if (!exposure.ok) return { error: exposure.reason };
    return t;
  };

  /** A23: canary-check a model-supplied glob (it compiles to a RegExp). */
  const checkedGlob = async (glob) => {
    let re;
    try { re = globToRegexLoose(String(glob)); } catch { return { error: 'Invalid glob filter.' }; }
    const probe = await runBoundedRegexSearch({ source: re.source, flags: re.flags, files: [], deadlineMs: 300 });
    if (probe.error) {
      return { error: probe.errorKind === 'budget' ? GLOB_BUDGET_MESSAGE : probe.error };
    }
    return { re };
  };

  const tools = [
    {
      name: 'get_summary',
      description: 'Repository digest: languages, stacks, entry points, import hubs, cycles, hotspots, recently changed files, and the first ~60 source file paths.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        const g = guard('get_summary');
        if (g) return emit('get_summary', g);
        // A19/A21: the digest lists file paths — emitted through the boundary
        return emit('get_summary', { summary: repoDigest(repo, { maxFiles: 60 }) });
      },
    },
    {
      name: 'list_files',
      description: 'List files (relative paths + opaque handles + sizes). Optional dir prefix, glob filter (e.g. "src/**/*.ts"), limit (default 120). Reference files by `handle`.',
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
        if (g) return emit('list_files', g);
        let globRe = null;
        if (args.glob) {
          const cg = await checkedGlob(args.glob);
          if (cg.error) return emit('list_files', cg);
          globRe = cg.re;
        }
        const limit = Math.min(Math.max(1, Math.floor(args.limit ?? 120)), 300);
        let entries = store.all;
        if (args.dir) {
          const dir = String(args.dir).replace(/\\/g, '/').replace(/\/+$/, '');
          entries = entries.filter((e) => e.rel === dir || e.rel.startsWith(dir + '/'));
        }
        if (globRe) entries = entries.filter((e) => globRe.test(e.rel));
        const slice = entries.slice(0, limit).map((e) => ({ path: e.rel, handle: handleFor(e.rel), bytes: e.size }));
        return emit('list_files', { files: slice, total: entries.length, truncated: entries.length > limit });
      },
    },
    {
      name: 'read_file',
      description: `Read a bounded slice of one file with line numbers (max ${READ_LINE_CAP} lines / ${Math.round(READ_CHAR_CAP / 1000)}k chars per call). Pass the file's \`handle\` (preferred) or a relative path exactly as returned by list_files/get_summary/search_code.`,
      parameters: {
        type: 'object',
        properties: {
          handle: { type: 'string', description: 'Opaque file handle (f1, f2, …) from list_files/search_code output — preferred' },
          path: { type: 'string', description: 'Relative file path (exactly as returned by the tools)' },
          start: { type: 'number', description: 'First line (default 1)' },
          end: { type: 'number', description: 'Last line (default start + 399; hard-capped)' },
        },
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const t = resolveForContent(args.handle ?? args.path);
        if (t.error) return emit('read_file', t);
        const lines = store.lines(t.rel);
        if (!lines) return emit('read_file', { error: 'File is binary or unreadable.' });
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
        if (g) return emit('read_file', g);
        return emit('read_file', {
          path: t.rel, // raw rel — emit() redacts it before it crosses
          handle: handleFor(t.rel),
          ofLines: lines.length,
          lines: rows.length ? rows : [{ line: start, text: '(empty range)' }],
          truncatedByChars: truncatedChars || undefined,
        });
      },
    },
    {
      name: 'search_code',
      description: 'Search all text files for a substring (default) or regex (isRegex=true). Returns path, handle, line + the matching line. Optional glob filter, maxResults (default 40).',
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
        if (query.length < 2) return emit('search_code', { error: 'Query too short.' });
        if (query.length > 200) return emit('search_code', { error: 'Query too long (max 200 chars).' });
        const maxResults = Math.min(Math.max(1, Math.floor(args.maxResults ?? 40)), 100);
        // A18: search applies the same file-exposure policy as read_file —
        // secret-shaped files are excluded BEFORE any content matching, so
        // unrecognized credential formats cannot leak through search either.
        let files = store.all;
        if (args.glob) {
          const cg = await checkedGlob(args.glob);
          if (cg.error) return emit('search_code', cg);
          files = files.filter((e) => cg.re.test(e.rel));
        }
        files = files.filter((e) => access.canExposeFile(e.rel).ok);

        let matches;
        let coverage;
        let cost = 0;
        if (args.isRegex) {
          // A23: model-authored regex runs in a bounded worker — a
          // catastrophic pattern returns a budget error, never a hang.
          const targets = files.slice(0, MAX_REGEX_FILES)
            .map((e) => ({ rel: e.rel, lines: store.lines(e.rel) }))
            .filter((f) => f.lines);
          const res = await runBoundedRegexSearch({
            source: query, flags: 'i', files: targets, deadlineMs: REGEX_TOOL_DEADLINE_MS, maxResults,
          });
          if (res.error) return emit('search_code', { error: res.error });
          coverage = res.coverage;
          matches = (res.matches ?? []).map((m) => ({ path: m.rel, line: m.line, text: redact(m.text).trim().slice(0, 240) }));
        } else {
          const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          matches = [];
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
        }
        if (args.isRegex) cost = matches.reduce((n, m) => n + m.text.length + 20, 0);
        const g = guard('search_code', cost);
        if (g) return emit('search_code', g);
        const payload = { matches: matches.map((m) => ({ ...m, handle: handleFor(m.path) })), truncated: matches.length >= maxResults };
        if (coverage) payload.coverage = coverage;
        return emit('search_code', payload);
      },
    },
    {
      name: 'get_graph',
      description: 'Import relationships for one file (pass its handle or path): what it imports and which files import it (bounded to 40 entries per side).',
      parameters: {
        type: 'object',
        properties: {
          handle: { type: 'string', description: 'Opaque file handle (f1, f2, …) — preferred' },
          path: { type: 'string', description: 'Relative file path (exactly as returned by the tools)' },
        },
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        // A15: get_graph honors the same budget guard as every non-terminal tool
        const g = guard('get_graph');
        if (g) return emit('get_graph', g);
        const t = resolveForContent(args.handle ?? args.path);
        if (t.error) return emit('get_graph', t);
        if (!repo.graph?.enabled) return emit('get_graph', { error: 'Import graph not available for this repository.' });
        const allImports = repo.graph.imports?.[t.rel] ?? [];
        const allDependents = repo.graph.dependents?.[t.rel] ?? [];
        return emit('get_graph', {
          path: t.rel, // raw — emit() redacts
          handle: handleFor(t.rel),
          imports: allImports.slice(0, GRAPH_LIST_CAP),
          dependents: allDependents.slice(0, GRAPH_LIST_CAP),
          truncated: allImports.length > GRAPH_LIST_CAP || allDependents.length > GRAPH_LIST_CAP || undefined,
        });
      },
    },
    {
      name: 'submit_findings',
      description: 'Submit your final findings and end the investigation. Each finding must cite a file you actually read — pass its `handle` (preferred) or the exact path as returned — with exact lines and a verbatim snippet copied from read_file output. Findings without a snippet will be marked unverified.',
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
                file: { type: 'string', description: 'The file handle (f1, …) you read, or the exact path as returned' },
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
        if (g) return emit('submit_findings', g);
        const drafts = [];
        for (const f of Array.isArray(args.findings) ? args.findings : []) {
          if (!f || typeof f !== 'object' || !f.title || !f.file) continue;
          // A21: `file` may be a handle, a raw rel, or the redacted path the
          // model saw. Resolve to the real rel for evidence checking; the
          // draft carries the redacted form for every output surface.
          const rawFile = String(f.file).replace(/\\/g, '/').replace(/^\.\//, '');
          const target = resolveRef(rawFile);
          const resolvedRel = target.rel ?? null;
          drafts.push({
            checkId: 'agent',
            source: `agent:${budgets.profileName ?? 'model'}`,
            title: String(f.title).slice(0, 140),
            category: normalizeCategory(f.category) ?? 'bug',
            severity: normalizeSeverity(f.severity) ?? 'medium',
            confidence: Number.isFinite(Number(f.confidence)) ? Math.max(0, Math.min(1, Number(f.confidence))) : 0.4,
            file: resolvedRel ? redact(resolvedRel) : rawFile,
            _resolvedRel: resolvedRel ?? undefined,
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
        return emit('submit_findings', { received: true, accepted: drafts.length, hint: drafts.length ? undefined : 'No valid findings — each needs at least title and file.' });
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
