// Git integration: repo detection, status-based changed-file listing.
// Everything degrades gracefully when the target is not a git repository.
import { spawnSync } from 'node:child_process';

function git(args, cwd, timeoutMs = 8000) {
  const res = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) return null;
  return res.stdout ?? '';
}

export function isGitRepo(root) {
  const out = git(['rev-parse', '--is-inside-work-tree'], root, 4000);
  return out != null && out.trim() === 'true';
}

export function gitInfo(root) {
  const branch = git(['branch', '--show-current'], root)?.trim() || null;
  const commit = git(['rev-parse', '--short', 'HEAD'], root)?.trim() || null;
  return { branch, commit };
}

/**
 * Files that git considers changed/untracked (relative, posix paths).
 * Deletions are reported separately. Returns null if not a repo or git fails.
 */
export function gitChangedFiles(root) {
  const out = git(['--no-optional-locks', 'status', '--porcelain', '-z', '-uall', '--no-renames'], root, 15000);
  if (out == null) return null;
  const changed = [];
  const deleted = [];
  const records = out.split('\0');
  for (const rec of records) {
    if (!rec) continue;
    const status = rec.slice(0, 2);
    const filePath = rec.slice(3);
    if (!filePath) continue;
    const rel = filePath.replace(/\\/g, '/');
    if (status[0] === 'D' || status[1] === 'D') { deleted.push(rel); continue; }
    if (status[0] === 'R') continue; // renames: old path irrelevant, new path appears as added
    changed.push(rel);
  }
  return { changed: [...new Set(changed)], deleted: [...new Set(deleted)] };
}

/** True if git says this file is committed (tracked) in HEAD or the index. */
export function isTracked(root, relPath) {
  return git(['ls-files', '--error-unmatch', relPath], root, 4000) != null;
}
