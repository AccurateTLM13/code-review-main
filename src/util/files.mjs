// Filesystem utilities: gitignore-aware walking, language classification,
// content caching, and hashing. Read-only by design — nothing here writes.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------- language classification ----------

export const EXT_LANG = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
  '.py': 'python', '.pyi': 'python',
  '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php', '.java': 'java',
  '.kt': 'kotlin', '.kts': 'kotlin', '.swift': 'swift', '.cs': 'csharp', '.scala': 'scala',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp', '.hh': 'cpp',
  '.sh': 'shell', '.bash': 'shell', '.lua': 'lua', '.sql': 'sql', '.dart': 'dart',
  '.vue': 'vue', '.svelte': 'svelte',
  '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.proto': 'protobuf', '.tf': 'terraform', '.yml': 'yaml', '.yaml': 'yaml',
  '.toml': 'toml', '.json': 'json', '.md': 'markdown',
};

// Extensions treated as reviewable source (checked for code issues).
export const SOURCE_EXTS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts',
  '.py', '.pyi', '.go', '.rs', '.rb', '.php', '.java', '.kt', '.kts',
  '.swift', '.cs', '.scala', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hh',
  '.sh', '.bash', '.lua', '.sql', '.dart', '.vue', '.svelte', '.proto', '.tf',
]);

export const CONFIG_EXTS = new Set(['.json', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.env']);
export const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.icns', '.pdf', '.zip', '.gz',
  '.tgz', '.bz2', '.xz', '.7z', '.rar', '.tar', '.exe', '.dll', '.so', '.dylib', '.a', '.o',
  '.obj', '.class', '.jar', '.war', '.pyc', '.pyo', '.wasm', '.woff', '.woff2', '.ttf', '.otf',
  '.eot', '.mp3', '.mp4', '.avi', '.mov', '.flv', '.wmv', '.webm', '.db', '.sqlite', '.bin',
  '.dat', '.pak', '.node', '.apk', '.ipa', '.dmg', '.msi', '.psd', '.ai', '.sketch',
]);

export const MAX_TEXT_BYTES = 1_500_000; // skip reading files larger than this as text

// ---------- ignore rules ----------

export const DEFAULT_DIR_IGNORES = [
  '.git', '.svn', '.hg', '.tox', '.idea', '.vscode', '.vs', '.gradle', '.claude', '.cursor',
  '.next', '.nuxt', '.output', '.svelte-kit', '.turbo', '.cache', '.parcel-cache', '.venv',
  'venv', 'virtualenv', '.direnv', '.devcontainer', '__pycache__', '.mypy_cache', '.pytest_cache',
  '.ruff_cache', '.hypothesis', 'node_modules', 'bower_components', 'vendor', 'target',
  'coverage', '.nyc_output', 'Pods', 'DerivedData', 'cmake-build-debug', 'cmake-build-release',
  'build', 'dist', 'out', '.terraform', '.yarn', '.pnpm-store', 'site-packages', '.angular',
];
export const DEFAULT_FILE_IGNORES = [
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'poetry.lock',
  'Pipfile.lock', 'Cargo.lock', 'go.sum', 'composer.lock', 'Gemfile.lock', 'packages.lock.json',
  '*.min.js', '*.min.css', '*.min.mjs', '*.map', '*.snap', '*.pb.go', '*_pb2.py', '*_pb2_grpc.py',
  '*.g.dart', '*.freezed.dart', '*.generated.*', '*.lock',
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Convert a gitignore-style glob to a RegExp matching full relative paths. */
export function globToRegex(pattern) {
  let p = pattern;
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const anchored = p.includes('/');
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '*') {
      if (p[i + 1] === '*') {
        while (p[i + 1] === '*') i++;
        if (p[i + 1] === '/') { re += '(?:.*/)?'; i++; }
        else re += '.*';
      } else re += '[^/]*';
    } else if (ch === '?') {
      re += '[^/]';
    } else if (ch === '[') {
      let j = i + 1;
      if (p[j] === '!' || p[j] === '^') j++;
      if (p[j] === ']') j++;
      while (j < p.length && p[j] !== ']') j++;
      re += p.slice(i, j + 1);
      i = j;
    } else {
      re += escapeRegex(ch);
    }
  }
  const prefix = anchored ? '' : '(?:.*/)?';
  return { regex: new RegExp(`^(?:${prefix}${re})$`), dirOnly };
}

/** Compile ignore rules (gitignore + plain globs + negations) into a matcher. */
export function createIgnoreMatcher(patterns, { defaults = true } = {}) {
  const all = [];
  if (defaults) {
    all.push(...DEFAULT_DIR_IGNORES.map((p) => ({ pattern: p, base: '' })));
    all.push(...DEFAULT_FILE_IGNORES.map((p) => ({ pattern: p, base: '' })));
  }
  all.push(...patterns);
  const compiled = all.map(({ pattern, base = '' }) => {
    const neg = pattern.startsWith('!');
    const p = neg ? pattern.slice(1) : pattern;
    const { regex, dirOnly } = globToRegex(p);
    return { neg, base, regex, dirOnly };
  });
  return function ignored(relPath, isDir) {
    let result = false;
    for (const r of compiled) {
      let effective = relPath;
      if (r.base) {
        if (relPath === r.base || relPath.startsWith(r.base + '/')) {
          effective = relPath === r.base ? '' : relPath.slice(r.base.length + 1);
        } else continue;
      }
      const hit = r.regex.test(effective) || (r.dirOnly && r.regex.test(effective + '/'));
      if (hit) result = !r.neg;
    }
    return result;
  };
}

/** Parse a .gitignore file into rule objects scoped to the directory containing it. */
export function parseGitignore(text, base) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    out.push({ pattern: line, base });
  }
  return out;
}

// ---------- walking ----------

/**
 * Walk a repository tree, respecting .gitignore files found along the way
 * plus built-in defaults and user-provided extra patterns.
 */
export async function walkTree(root, { extraIgnores = [], maxFiles = 12000, maxDepth = 14 } = {}) {
  // Rules accumulate as we descend; defaults come first inside the matcher,
  // so user/gitignore rules (including negations) can override them.
  const rules = [...extraIgnores.map((p) => ({ pattern: p, base: '' }))];
  const files = [];
  let dirCount = 0, ignoredCount = 0, truncated = false;

  const stack = [{ rel: '', depth: 0 }];
  while (stack.length) {
    const { rel, depth } = stack.pop();
    const abs = rel ? path.join(root, rel) : root;
    let entries;
    try {
      entries = await fsp.readdir(abs, { withFileTypes: true });
    } catch { continue; }

    // Never descend into the audit tool's own output directory.
    const skipNames = depth === 0 ? new Set(['.code-audit']) : null;
    if (skipNames) entries = entries.filter((e) => !(e.isDirectory() && skipNames.has(e.name)));

    // Scoped .gitignore rules apply to this directory and below.
    try {
      const gi = await fsp.readFile(path.join(abs, '.gitignore'), 'utf8');
      rules.push(...parseGitignore(gi, rel));
    } catch { /* no .gitignore here */ }
    const matcher = createIgnoreMatcher(rules);

    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (matcher(childRel, true)) { ignoredCount++; continue; }
        dirCount++;
        if (depth < maxDepth) stack.push({ rel: childRel, depth: depth + 1 });
      } else if (entry.isFile()) {
        if (matcher(childRel, false)) { ignoredCount++; continue; }
        if (files.length >= maxFiles) { truncated = true; continue; }
        let size = 0;
        try { size = (await fsp.stat(path.join(root, childRel))).size; } catch { continue; }
        const ext = path.extname(entry.name).toLowerCase();
        files.push({ rel: childRel, ext, size });
      }
    }
  }
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return { files, dirCount, ignoredCount, truncated };
}

// ---------- content access ----------

export function isProbablyBinary(buf) {
  const n = Math.min(buf.length, 8192);
  let suspicious = 0;
  for (let i = 0; i < n; i++) {
    const b = buf[i];
    if (b === 0) return true;
    if (b < 9 && b !== 0x09 && b !== 0x0a && b !== 0x0d) suspicious++;
  }
  return n > 0 && suspicious / n > 0.05;
}

/**
 * Lazy, cached read access to walked files. Never writes. Keeps total cached
 * bytes bounded; oversized/binary files return null.
 */
export class FileStore {
  constructor(root, entries) {
    this.root = root;
    this.entries = new Map(entries.map((e) => [e.rel, e]));
    this._content = new Map();
    this._lines = new Map();
    this.cachedBytes = 0;
  }

  has(rel) { return this.entries.has(rel); }
  get(rel) { return this.entries.get(rel) ?? null; }
  get all() { return [...this.entries.values()]; }
  get sourceFiles() { return this.all.filter((e) => SOURCE_EXTS.has(e.ext)); }

  abs(rel) { return path.join(this.root, rel); }

  content(rel) {
    if (!this._content.has(rel)) {
      const entry = this.entries.get(rel);
      let content = null;
      if (entry && !BINARY_EXTS.has(entry.ext) && entry.size <= MAX_TEXT_BYTES) {
        try {
          const buf = fs.readFileSync(path.join(this.root, rel));
          if (!isProbablyBinary(buf)) content = buf.toString('utf8');
        } catch { content = null; }
        if (content != null) {
          this.cachedBytes += content.length;
          if (this.cachedBytes > 120_000_000) this._content.clear(), (this.cachedBytes = content.length);
        }
      }
      this._content.set(rel, content);
    }
    return this._content.get(rel);
  }

  lines(rel) {
    if (!this._lines.has(rel)) {
      const c = this.content(rel);
      this._lines.set(rel, c == null ? null : c.split(/\r?\n/));
    }
    return this._lines.get(rel);
  }

  /** Read a bounded slice with 1-based line numbers. Returns null if unreadable. */
  slice(rel, start = 1, end = Infinity) {
    const lines = this.lines(rel);
    if (!lines) return null;
    const s = Math.max(1, Math.floor(start));
    const e = Math.min(lines.length, Math.floor(end));
    if (e < s) return [];
    return lines.slice(s - 1, e).map((l, i) => ({ line: s + i, text: l }));
  }
}

export async function sha256File(absPath, maxBytes = MAX_TEXT_BYTES * 4) {
  const buf = await fsp.readFile(absPath).catch(() => null);
  if (buf == null) return null;
  const slice = buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf;
  return crypto.createHash('sha256').update(slice).digest('hex');
}

// ---------- misc ----------

export function toPosix(p) { return p.replace(/\\/g, '/'); }

export function truncateLines(text, max = 60) {
  const lines = text.split(/\r?\n/);
  if (lines.length <= max) return text;
  return lines.slice(0, max).join('\n') + `\n… (${lines.length - max} more lines)`;
}

export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
