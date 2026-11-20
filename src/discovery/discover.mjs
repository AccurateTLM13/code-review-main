// Repository discovery: orchestrate language stats, stacks, entry points,
// hotspots, and the import graph into a single RepoModel.
import path from 'node:path';
import { walkTree, FileStore, SOURCE_EXTS } from '../util/files.mjs';
import { languageStats } from './languages.mjs';
import { detectStacks } from './frameworks.mjs';
import { buildImportGraph } from './imports.mjs';

const ENTRY_HINTS = /^(index|main|app|server|cli|__main__|manage|wsgi|asgi)\.[a-z]+$/i;

function findEntryPoints(fileStore, pkgManifests) {
  const entryPoints = [];
  for (const m of pkgManifests) {
    if (!/(^|\/)package\.json$/.test(m.file)) continue;
    const pkg = m.raw ?? {};
    for (const key of ['main', 'module', 'browser']) {
      if (typeof pkg[key] === 'string') entryPoints.push({ file: pkg[key].replace(/^\.\//, ''), evidence: `package.json "${key}"` });
    }
    const bin = pkg.bin;
    if (typeof bin === 'string') entryPoints.push({ file: bin.replace(/^\.\//, ''), evidence: 'package.json "bin"' });
    if (bin && typeof bin === 'object') {
      for (const v of Object.values(bin)) entryPoints.push({ file: String(v).replace(/^\.\//, ''), evidence: 'package.json "bin"' });
    }
    const start = pkg.scripts?.start;
    if (typeof start === 'string') {
      const m2 = start.match(/(?:node|tsx|ts-node|nodemon)\s+(?:--[^\s]+\s+)*([\w./@-]+\.(?:js|ts|mjs|cjs))/);
      if (m2) entryPoints.push({ file: m2[1], evidence: `npm start → ${start}` });
    }
  }
  // Convention-based entries that actually exist
  for (const e of fileStore.sourceFiles) {
    const base = e.rel.split('/').pop();
    if (ENTRY_HINTS.test(base) && !e.rel.includes('test')) {
      entryPoints.push({ file: e.rel, evidence: 'conventional entry file name' });
    }
  }
  const seen = new Set();
  return entryPoints.filter((ep) => {
    if (seen.has(ep.file)) return false;
    seen.add(ep.file);
    return fileStore.has(ep.file) || fileStore.sourceFiles.some((f) => f.rel === ep.file);
  }).slice(0, 12);
}

function findHotspots(fileStore, graph, changedSet) {
  // Rank candidate files for model attention: import hubs, size, recent change.
  const scored = [];
  for (const entry of fileStore.sourceFiles) {
    const lines = fileStore.lines(entry.rel);
    const loc = lines ? lines.length : 0;
    if (loc < 30) continue;
    const importers = graph.dependents?.[entry.rel]?.length ?? 0;
    const changed = changedSet?.has(entry.rel) ? 1 : 0;
    let score = Math.min(loc / 50, 20) + importers * 3 + changed * 25;
    if (/^(index|main|server|app)\.[a-z]+$/i.test(entry.rel.split('/').pop() ?? '')) score += 6;
    scored.push({ rel: entry.rel, loc, importers, changed, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 12);
}

/**
 * Full discovery pass.
 * @param {string} root absolute target path
 * @param {object} opts { extraIgnores, changedSet (Set of rel paths or null), logger }
 */
export async function discoverRepo(root, { extraIgnores = [], changedSet = null, logger } = {}) {
  logger?.phase('Repository discovery');
  const walk = await walkTree(root, { extraIgnores });
  const fileStore = new FileStore(root, walk.files);
  if (walk.truncated) {
    logger?.warn(`File walk truncated at ${walk.files.length} files (limit). Results may be incomplete.`);
  }
  logger?.info(`${walk.files.length} files (${walk.dirCount} dirs, ${walk.ignoredCount} ignored)`);

  const { languages, totalLoc, totalSourceFiles } = languageStats(walk.files, (rel) => fileStore.lines(rel));
  logger?.info(`Languages: ${languages.slice(0, 4).map((l) => `${l.language}(${l.files})`).join(', ') || 'none detected'} — ${totalLoc.toLocaleString()} LOC`);

  const { stacks, manifests } = detectStacks(new Map(walk.files.map((f) => [f.rel, f])), (rel) => fileStore.content(rel), logger);
  logger?.info(`Stacks: ${stacks.slice(0, 6).map((s) => s.name).join(', ') || 'none detected'}`);

  const graph = buildImportGraph(fileStore);
  if (graph.hubs.length) {
    logger?.info(`Import graph: ${graph.edges} edges; top hub ${graph.hubs[0].file} (${graph.hubs[0].importers} importers)`);
  }

  const entryPoints = findEntryPoints(fileStore, manifests);
  const hotspots = findHotspots(fileStore, graph, changedSet);

  const manifestFiles = manifests.map((m) => m.file);
  const docs = walk.files
    .filter((f) => /^(readme|contributing|license|changelog|security|architecture|code_of_conduct)(\.[a-z0-9]+)?$/i.test(f.rel.split('/').pop() ?? ''))
    .map((f) => f.rel)
    .slice(0, 8);

  return {
    root,
    walk,
    fileStore,
    languages,
    totalLoc,
    totalSourceFiles,
    stacks,
    manifests,
    manifestFiles,
    entryPoints,
    docs,
    hotspots,
    graph,
    changedSet: changedSet ? [...changedSet] : null,
  };
}

/** Compact, model-friendly digest of the repo (used in prompts and get_summary). */
export function repoDigest(repo, { maxFiles = 40 } = {}) {
  const parts = [];
  const langs = repo.languages.slice(0, 5).map((l) => `${l.language}: ${l.files} files, ${l.loc.toLocaleString()} LOC`);
  parts.push(`ROOT: ${path.basename(repo.root)}`);
  parts.push(`TOTAL: ${repo.totalSourceFiles} source files, ${repo.totalLoc.toLocaleString()} LOC`);
  parts.push(`LANGUAGES (top): ${langs.join(' | ') || 'none'}`);
  parts.push(`STACKS: ${repo.stacks.slice(0, 10).map((s) => s.name).join(', ') || 'none detected'}`);
  if (repo.entryPoints.length) parts.push(`ENTRY POINTS: ${repo.entryPoints.map((e) => e.file).join(', ')}`);
  if (repo.docs.length) parts.push(`DOCS: ${repo.docs.join(', ')}`);
  if (repo.manifestFiles.length) parts.push(`MANIFESTS: ${repo.manifestFiles.slice(0, 10).join(', ')}`);
  if (repo.graph.hubs.length) {
    parts.push(`IMPORT HUBS: ${repo.graph.hubs.slice(0, 5).map((h) => `${h.file} (${h.importers} importers)`).join(' | ')}`);
  }
  if (repo.graph.cycles.length) {
    parts.push(`IMPORT CYCLES: ${repo.graph.cycles.map((c) => c.join(' → ')).join(' ; ')}`);
  }
  if (repo.hotspots.length) {
    parts.push(`LARGEST/HOTTEST FILES: ${repo.hotspots.slice(0, 8).map((h) => `${h.rel} (${h.loc} lines)`).join(' | ')}`);
  }
  if (repo.changedSet?.length) {
    const list = repo.changedSet.slice(0, maxFiles).map((f) => f);
    parts.push(`RECENTLY CHANGED FILES (${repo.changedSet.length}): ${list.join(', ')}${repo.changedSet.length > maxFiles ? ` … (+${repo.changedSet.length - maxFiles})` : ''}`);
  }
  parts.push(`ALL SOURCE FILES (first ${maxFiles}): ${repo.fileStore.sourceFiles.slice(0, maxFiles).map((f) => f.rel).join(', ')}${repo.fileStore.sourceFiles.length > maxFiles ? ` … (+${repo.fileStore.sourceFiles.length - maxFiles})` : ''}`);
  return parts.join('\n');
}
