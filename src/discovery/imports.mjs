// Heuristic import graph: extract and resolve internal imports per language,
// then derive hubs, orphans, and cycles. No full parser — deliberately
// conservative and cheap.
import path from 'node:path';
import { EXT_LANG } from '../util/files.mjs';

const JS_EXT_CANDIDATES = ['', '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.json'];

function extractJsImports(text) {
  const specs = [];
  const patterns = [
  /import\s+[^'";]*?from\s*['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+[^'";]*?from\s*['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) specs.push(m[1]);
  return specs;
}

function extractPyImports(text) {
  const specs = [];
  for (const m of text.matchAll(/^\s*from\s+([\w.]+)\s+import\b/gm)) specs.push({ dotted: m[1], fromImport: true });
  for (const m of text.matchAll(/^\s*import\s+([\w.]+)/gm)) specs.push({ dotted: m[1], fromImport: false });
  return specs;
}

function extractGoImports(text) {
  const specs = [];
  const blockRe = /import\s*(?:\(([\s\S]*?)\)|"([^"]+)")/g;
  for (const m of text.matchAll(blockRe)) {
    if (m[2]) specs.push(m[2]);
    else for (const q of m[1].matchAll(/"([^"]+)"/g)) specs.push(q[1]);
  }
  return specs;
}

export function buildImportGraph(fileStore, { maxFiles = 4000 } = {}) {
  const sourceFiles = fileStore.sourceFiles;
  if (sourceFiles.length < 3 || sourceFiles.length > maxFiles) {
    return { enabled: false, reason: sourceFiles.length < 3 ? 'too few source files' : 'repository too large for heuristic graph', edges: 0, imports: {}, dependents: {}, hubs: [], orphans: [], cycles: [] };
  }

  // Go module prefix (if any)
  let goModule = null;
  for (const e of sourceFiles) {
    if (e.ext === '.go') {
      const modEntry = fileStore.has('go.mod') ? fileStore.get('go.mod') : null;
      if (modEntry) {
        const t = fileStore.content('go.mod');
        goModule = t?.match(/^module\s+(\S+)/m)?.[1] ?? null;
      }
      break;
    }
  }

  const imports = new Map();   // rel -> Set<rel>
  const dependents = new Map(); // rel -> Set<rel>
  const langsSeen = new Set();

  for (const entry of sourceFiles) {
    const content = fileStore.content(entry.rel);
    if (content == null) continue;
    const lang = EXT_LANG[entry.ext];
    langsSeen.add(lang);
    let specs = [];
    try {
      if (lang === 'javascript' || lang === 'typescript' || lang === 'vue' || lang === 'svelte') {
        specs = extractJsImports(content).map((s) => ({ raw: s }));
      } else if (lang === 'python') {
        specs = extractPyImports(content);
      } else if (lang === 'go') {
        specs = extractGoImports(content).map((s) => ({ raw: s }));
      } else continue;
    } catch { continue; }

    const targets = new Set();
    for (const spec of specs) {
      let resolved = null;
      if (lang === 'javascript' || lang === 'typescript' || lang === 'vue' || lang === 'svelte') {
        resolved = resolveJsSpec(entry.rel, spec.raw, fileStore);
      } else if (lang === 'python') {
        resolved = resolvePySpec(entry.rel, spec, fileStore);
      } else if (lang === 'go' && goModule) {
        resolved = resolveGoSpec(entry.rel, spec.raw, goModule, fileStore);
      }
      if (resolved && resolved !== entry.rel) targets.add(resolved);
    }
    if (targets.size) {
      imports.set(entry.rel, targets);
      for (const t of targets) {
        if (!dependents.has(t)) dependents.set(t, new Set());
        dependents.get(t).add(entry.rel);
      }
    }
  }

  const sourceSet = new Set(sourceFiles.map((e) => e.rel));

  // Hubs: highest in-degree
  const hubs = [...dependents.entries()]
    .map(([rel, deps]) => ({ file: rel, importers: deps.size }))
    .filter((h) => h.importers >= 4)
    .sort((a, b) => b.importers - a.importers)
    .slice(0, 10);

  // Orphans: no importers, not entry-ish names
  const orphans = sourceFiles
    .filter((e) => {
      if (dependents.has(e.rel)) return false;
      const base = e.rel.split('/').pop() ?? '';
      if (/^(index|main|app|server|cli|__init__|setup|conftest|mod|lib|types|constants)\b/i.test(base)) return false;
      return /(^|\/)(src|lib|app|pkg|internal|modules|packages)\//.test(e.rel) || !e.rel.includes('/');
    })
    .slice(0, 10)
    .map((e) => ({ file: e.rel }));

  const cycles = findCycles(imports, { maxCycles: 4, maxNodes: 2500 });

  return {
    enabled: true,
    edges: [...imports.values()].reduce((n, s) => n + s.size, 0),
    imports: Object.fromEntries([...imports.entries()].map(([k, v]) => [k, [...v]])),
    dependents: Object.fromEntries([...dependents.entries()].map(([k, v]) => [k, [...v]])),
    hubs, orphans, cycles,
    languages: [...langsSeen],
  };
}

function resolveJsSpec(fromRel, spec, fileStore) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null; // external package
  const dir = fromRel.includes('/') ? fromRel.slice(0, fromRel.lastIndexOf('/')) : '';
  const norm = path.posix.normalize(dir ? `${dir}/${spec}` : spec).replace(/\/+$/, '');
  for (const ext of JS_EXT_CANDIDATES) {
    if (fileStore.has(norm + ext)) return norm + ext;
  }
  for (const ext of JS_EXT_CANDIDATES.slice(0, 7)) {
    if (fileStore.has(`${norm}/index${ext}`)) return `${norm}/index${ext}`;
  }
  return null;
}

function resolvePySpec(fromRel, spec, fileStore) {
  const { dotted, fromImport } = spec;
  const parts = dotted.split('.');
  let baseDir;
  if (dotted.startsWith('.')) {
    const relParts = dotted.split('.');
    const up = relParts.filter((p) => p === '').length - 1; // leading dots
    const dir = fromRel.includes('/') ? fromRel.slice(0, fromRel.lastIndexOf('/')) : '';
    baseDir = path.posix.normalize(up > 0 ? dir + '/..'.repeat(up) : dir || '.');
    const nameParts = relParts.filter((p) => p !== '' && p !== '.');
    const p = nameParts.length ? path.posix.join(baseDir, ...nameParts) : baseDir;
    if (fileStore.has(p + '.py')) return p + '.py';
    if (fileStore.has(path.posix.join(p, '__init__.py'))) return path.posix.join(p, '__init__.py');
    return null;
  }
  const p = path.posix.join(...parts);
  if (fileStore.has(p + '.py')) return p + '.py';
  if (fileStore.has(path.posix.join(p, '__init__.py'))) return path.posix.join(p, '__init__.py');
  // try relative to the importing file's package root heuristically (src/ layouts)
  if (fromRel.includes('/')) {
    const dir = fromRel.slice(0, fromRel.lastIndexOf('/'));
    const p2 = path.posix.join(dir, p);
    if (fileStore.has(p2 + '.py')) return p2 + '.py';
    if (fileStore.has(path.posix.join(p2, '__init__.py'))) return path.posix.join(p2, '__init__.py');
  }
  return null;
}

function resolveGoSpec(fromRel, spec, goModule, fileStore) {
  if (!spec.startsWith(goModule + '/')) return null;
  const pkgDir = spec.slice(goModule.length + 1);
  // map package dir to any .go file in it (approximation for hub analysis)
  const candidates = fileStore.all.filter((e) => e.ext === '.go' && e.rel.startsWith(pkgDir + '/'));
  if (candidates.length) return candidates[0].rel;
  return null;
}

/** Iterative DFS cycle detection with hard caps. */
export function findCycles(importsMap, { maxCycles = 4, maxNodes = 2500 } = {}) {
  const nodes = [...importsMap.keys()].slice(0, maxNodes);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(nodes.map((n) => [n, WHITE]));
  const cycles = [];
  const seenCycles = new Set();
  for (const start of nodes) {
    if (color.get(start) !== WHITE || cycles.length >= maxCycles) continue;
    const stack = [{ node: start, iter: importsMap.get(start)?.[Symbol.iterator]() ?? [][Symbol.iterator](), path: [start] }];
    color.set(start, GRAY);
    while (stack.length && cycles.length < maxCycles) {
      const top = stack[stack.length - 1];
      const next = top.iter.next();
      if (next.done) {
        color.set(top.node, BLACK);
        stack.pop();
        continue;
      }
      const nb = typeof next.value === 'string' ? next.value : next.value;
      const c = color.get(nb) ?? WHITE;
      if (nb === start) {
        pushCycle(cycles, [...top.path], seenCycles, maxCycles);
        continue;
      }
      if (c === GRAY) {
        // back-edge into an ancestor on the current DFS path: a real cycle
        const idx = top.path.indexOf(nb);
        if (idx >= 0) pushCycle(cycles, [...top.path.slice(idx)], seenCycles, maxCycles);
        continue;
      }
      if (c === WHITE && importsMap.has(nb) && stack.length < 200) {
        color.set(nb, GRAY);
        stack.push({ node: nb, iter: importsMap.get(nb)?.[Symbol.iterator]() ?? [][Symbol.iterator](), path: [...top.path, nb] });
      }
    }
    // Anything left gray on early exit is fine: caps prevent pathological cost.
  }
  return cycles;
}

function pushCycle(cycles, cycle, seen, maxCycles) {
  if (cycles.length >= maxCycles || cycle.length < 2) return;
  // canonical rotation for dedupe
  let minIdx = 0;
  for (let i = 1; i < cycle.length; i++) if (cycle[i] < cycle[minIdx]) minIdx = i;
  const key = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)].join('|');
  if (seen.has(key)) return;
  seen.add(key);
  cycles.push(cycle);
}
