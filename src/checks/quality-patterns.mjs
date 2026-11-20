// Risky code patterns: swallowed errors, eval/exec, injection-prone calls,
// perf smells. Regex-level heuristics with calibrated confidence — the model
// pass later confirms or dismisses each hit with real code context.
import { makeFinding, forEachSourceFile } from './index.mjs';

const JS_TS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.vue', '.svelte']);
const PY = new Set(['.py', '.pyi']);

function lineOfIndex(content, idx) {
  return content.slice(0, idx).split('\n').length;
}

/**
 * Each rule: { id, exts, re (global), sev, conf, cat, title, why, fix, benefit, risk, effort, tags, areas, filter(match, content, lines)? }
 */
const RULES = [
  {
    id: 'swallowed-catch', exts: JS_TS, cat: 'bug', sev: 'medium', conf: 0.7, effort: 'trivial', areas: ['bug'],
    re: /catch\s*(?:\([^)]*\))?\s*\{\s*(?:\}|\/\/[^\n]*\n\s*\}|\/\*[\s\S]*?\*\/\s*\})/g,
    title: 'Empty or comment-only catch block swallows errors',
    why: 'An error is caught and discarded. Failures become silent data corruption or missing side effects that surface far from the cause.',
    fix: 'Handle the error, rethrow with context, or at minimum log it with enough detail to debug. If the exception truly cannot occur, assert that explicitly.',
  },
  {
    id: 'swallowed-except', exts: PY, cat: 'bug', sev: 'medium', conf: 0.65, effort: 'trivial', areas: ['bug'],
    re: /except[^:\n]*:\s*(?:pass|\.\.\.|continue)/g,
    title: 'except block that passes silently',
    why: 'An exception is caught and ignored. This hides real failures and makes debugging painful.',
    fix: 'Narrow the exception type, log or re-raise, and handle what can actually be handled.',
  },
  {
    id: 'bare-except', exts: PY, cat: 'bug', sev: 'low', conf: 0.6, effort: 'trivial', areas: ['bug'],
    re: /^\s*except\s*:/gm,
    title: 'Bare `except:` catches everything (including KeyboardInterrupt/SystemExit)',
    why: 'Bare excepts make programs unkillable and mask unrelated bugs.',
    fix: 'Catch the narrowest exception you can actually handle.',
  },
  {
    id: 'eval-usage', exts: JS_TS, cat: 'security', sev: 'medium', conf: 0.55, effort: 'moderate', areas: ['security'],
    re: /\beval\s*\(/g,
    title: 'eval() executes dynamic code',
    why: 'Dynamic code execution is an injection sink: any attacker-controlled string that reaches here becomes arbitrary code execution.',
    fix: 'Replace with explicit parsing/logic. If input must be trusted, validate strictly and document why eval is required.',
  },
  {
    id: 'py-eval-exec', exts: PY, cat: 'security', sev: 'medium', conf: 0.6, effort: 'moderate', areas: ['security'],
    re: /\beval\s*\(|(?<![\w.])exec\s*\(/g,
    title: 'eval()/exec() executes dynamic code',
    why: 'Python eval/exec turn strings into running code — a direct injection sink when any part of the input is user-influenced.',
    fix: 'Replace with explicit parsing (ast.literal_eval for data), or validate input strictly and document why dynamic execution is required.',
  },
  {
    id: 'debugger-stmt', exts: JS_TS, cat: 'bug', sev: 'low', conf: 0.9, effort: 'trivial', areas: ['bug'],
    re: /\bdebugger\s*[;\n]/g,
    title: '`debugger` statement left in code',
    why: 'Halts execution in any browser that has DevTools open; also signals leftover debugging.',
    fix: 'Remove the statement; use breakpoints in the devtools instead.',
  },
  {
    id: 'shell-injection', exts: JS_TS, cat: 'security', sev: 'high', conf: 0.5, effort: 'moderate', areas: ['security'],
    re: /\b(?:exec(?:Sync)?|spawn(?:Sync)?)\s*\(\s*(?!"[^"]*"\s*[,)])[`'"][^`'"]*(?:`|\$\{|' \+|\" \+)/g,
    title: 'child_process call with interpolated/concatenated command',
    why: 'Building shell commands from variables allows command injection when any part of the string is user-influenced.',
    fix: 'Use execFile/spawn with an argument array so values are never interpreted by a shell; validate or allow-list any dynamic parts.',
  },
  {
    id: 'sql-concat', exts: new Set([...JS_TS, ...PY]), cat: 'security', sev: 'high', conf: 0.45, effort: 'moderate', areas: ['security'],
    re: /(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)[^\n;]{0,120}(?:\s*\+\s*\w|\$\{[^}]*\}|%s|['"]\s*\+)/gi,
    title: 'SQL query built via string concatenation/interpolation',
    why: 'Concatenated SQL is the classic injection vector — query structure is data-dependent.',
    fix: 'Use parameterized queries / prepared statements with bound parameters.',
  },
  {
    id: 'xss-innerhtml', exts: new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte']), cat: 'security', sev: 'medium', conf: 0.5, effort: 'moderate', areas: ['security'],
    re: /\.innerHTML\s*=|dangerouslySetInnerHTML/g,
    title: 'Raw HTML injection sink (innerHTML / dangerouslySetInnerHTML)',
    why: 'Assigning HTML strings can inject scripts when the content includes any user-derived data.',
    fix: 'Prefer textContent or framework escaping. If HTML must be trusted, sanitize it explicitly and document the trust boundary.',
  },
  {
    id: 'insecure-http', exts: new Set([...JS_TS, ...PY, ...new Set(['.go', '.rb', '.php'])]), cat: 'security', sev: 'low', conf: 0.5, effort: 'trivial', areas: ['security'],
    re: /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)/g,
    title: 'Insecure http:// endpoint in source',
    why: 'Plain HTTP endpoints leak data in transit and enable MITM; also commonly a leftover dev URL.',
    fix: 'Switch to https://, or to a localhost/dev URL, and load production endpoints from configuration.',
  },
  {
    id: 'await-in-loop', exts: JS_TS, cat: 'performance', sev: 'medium', conf: 0.5, effort: 'moderate', areas: ['performance'],
    re: /for\s*(?:await\s*)?\([^)]*\)\s*\{[\s\S]{0,200}?\bawait\s/g,
    title: 'Sequential await inside a loop',
    why: 'Round-trips executed one at a time — latency adds up linearly with loop size.',
    fix: 'Batch independent work with Promise.all / a bounded concurrency pool. Only keep sequential awaits when iteration N depends on N-1.',
  },
  {
    id: 'sync-io-loop', exts: JS_TS, cat: 'performance', sev: 'low', conf: 0.45, effort: 'moderate', areas: ['performance'],
    re: /for\s*\([^)]*\)\s*\{[\s\S]{0,200}?\b(?:readFileSync|writeFileSync|appendFileSync|execSync)\s*\(/g,
    title: 'Synchronous file/exec I/O inside a loop',
    why: 'Blocks the Node.js event loop for the duration of each iteration; throughput collapses under load.',
    fix: 'Use fs.promises / async APIs, or batch the operation outside the loop.',
  },
  {
    id: 'json-clone', exts: JS_TS, cat: 'performance', sev: 'low', conf: 0.6, effort: 'trivial', areas: ['performance'],
    re: /JSON\.parse\(\s*JSON\.stringify\(/g,
    title: 'JSON.parse(JSON.stringify(...)) used as deep clone',
    why: 'Slow, throws on Dates/Maps/Sets/undefined, loses prototypes. Fine for tiny JSON-safe objects, costly in hot paths.',
    fix: 'Use structuredClone() (Node ≥17, browsers ≥2022) or a purpose-built clone for the shape involved.',
  },
  {
    id: 'document-write', exts: new Set(['.js', '.html']), cat: 'security', sev: 'low', conf: 0.45, effort: 'trivial', areas: ['security'],
    re: /\bdocument\.write\s*\(/g,
    title: 'document.write usage',
    why: 'Synchronous document injection; blocks parsing and is an XSS sink for dynamic strings.',
    fix: 'Build DOM nodes with createElement/textContent instead.',
  },
];

export function runQualityPatterns(ctx) {
  const perRuleFileCap = 8;
  const check = { id: 'quality', category: 'bug', effort: 'moderate' };

  return forEachSourceFile(ctx, (entry, content, lines) => {
    const out = [];
    for (const rule of RULES) {
      if (!rule.exts.has(entry.ext)) continue;
      if (/(^|\/)(tests?|__tests__|fixtures?)(\/|$)/i.test(entry.rel) && rule.id !== 'swallowed-catch') continue;
      const matches = [...content.matchAll(rule.re)];
      if (!matches.length) continue;
      const filtered = matches.filter((m) => !rule.filter || rule.filter(m, content, lines));
      if (!filtered.length) continue;
      const shown = filtered.slice(0, perRuleFileCap);
      const first = shown[0];
      const lineNo = lineOfIndex(content, first.index ?? 0);
      const sev = rule.sev === 'high' && filtered.length >= 3 ? 'high' : rule.sev;
      out.push(makeFinding(check, {
        category: rule.cat, file: entry.rel, lines: [lineNo, lineNo], severity: sev,
        confidence: rule.conf * (filtered.length >= 2 ? 1 : 0.9),
        title: rule.title,
        snippet: lines[Math.min(lineNo - 1, lines.length - 1)] ?? null,
        description: `${rule.why}\n\n${filtered.length} occurrence${filtered.length > 1 ? 's' : ''} in ${entry.rel}:${shown.map((m) => lineOfIndex(content, m.index ?? 0)).join(', ')}`,
        suggestion: rule.fix,
        benefit: 'Directly removes a recurring defect/injection/perf class at this site.',
        risk: 'Low — change is local; verify with existing tests.',
        effort: rule.effort, tags: [rule.id], areas: rule.areas,
      }));
    }
    return out;
  });
}
