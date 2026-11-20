// Run state: last-audit file manifest (for --changed), report output dirs.
// Written only inside <repo>/.code-audit/ — application code is never touched.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { sha256File } from '../util/files.mjs';

export function auditDir(root) { return path.join(root, '.code-audit'); }
export function statePath(root) { return path.join(auditDir(root), 'state.json'); }
export function reportsDir(root, config) {
  const rel = config?.reports?.dir ?? '.code-audit/reports';
  return path.isAbsolute(rel) ? rel : path.join(root, ...rel.split(/[\\/]/));
}

const STATE_VERSION = 1;

export async function readState(root) {
  try {
    const data = JSON.parse(await fsp.readFile(statePath(root), 'utf8'));
    if (data.version !== STATE_VERSION) return null;
    return data;
  } catch { return null; }
}

export async function writeState(root, repo) {
  const files = {};
  for (const entry of repo.fileStore.all) {
    const hash = await sha256File(path.join(root, entry.rel));
    if (hash) files[entry.rel] = { h: hash.slice(0, 16), s: entry.size };
  }
  const data = {
    version: STATE_VERSION,
    updatedAt: new Date().toISOString(),
    root,
    totalSourceFiles: repo.totalSourceFiles,
    files,
  };
  await fsp.mkdir(auditDir(root), { recursive: true });
  await fsp.writeFile(statePath(root), JSON.stringify(data), 'utf8');
  return data;
}

/**
 * Files changed since the last audit (state manifest), optionally intersected
 * with git status. Deleted files are detected by comparing old-state keys to
 * the current walk. Returns { changed, deleted, basis }.
 */
export async function computeChangedSet(root, repo, { useGit = true, logger } = {}) {
  const state = await readState(root);
  const changed = new Set();
  const deleted = [];

  if (state?.files) {
    const currentRels = new Set(repo.fileStore.all.map((e) => e.rel));
    for (const rel of Object.keys(state.files)) {
      if (!currentRels.has(rel)) deleted.push(rel);
    }
    for (const entry of repo.fileStore.all) {
      const prev = state.files[entry.rel];
      if (!prev || prev.s !== entry.size) { changed.add(entry.rel); continue; }
      const hash = (await sha256File(path.join(root, entry.rel)))?.slice(0, 16);
      if (hash !== prev.h) changed.add(entry.rel);
    }
    return { changed, deleted, basis: 'manifest' };
  }

  if (useGit) {
    try {
      const { gitChangedFiles } = await import('../util/git.mjs');
      const res = gitChangedFiles(root);
      if (res) {
        for (const rel of res.changed) if (repo.fileStore.has(rel)) changed.add(rel);
        return { changed, deleted: res.deleted.filter((rel) => !repo.fileStore.has(rel)), basis: 'git' };
      }
    } catch { /* fall through */ }
  }

  return { changed, deleted, basis: null };
}

export async function createRunDir(root, config) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(reportsDir(root, config), stamp);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

export function findLatestRun(root, config) {
  const base = reportsDir(root, config);
  let entries = [];
  try { entries = fs.readdirSync(base).filter((d) => /^\d{4}-\d{2}-\d{2}T/.test(d)).sort(); } catch { return null; }
  if (!entries.length) return null;
  return path.join(base, entries[entries.length - 1]);
}
