// Dependency hygiene: unpinned versions, dev/prod duplication, loose ranges.
import fs from 'node:fs';
import path from 'node:path';
import { makeFinding, inScope } from './index.mjs';

function analyzePackageJson(rel, raw) {
  const issues = [];
  for (const [name, spec] of Object.entries(raw.dependencies ?? {})) {
    if (spec === '*' || spec === 'latest' || spec === 'next') {
      issues.push({ name, spec, note: 'production dependency pinned to "*" / "latest" — builds are non-reproducible' });
    }
  }
  for (const name of Object.keys(raw.dependencies ?? {})) {
    if (raw.devDependencies && name in raw.devDependencies) {
      issues.push({ name, spec: `${raw.dependencies[name]} / ${raw.devDependencies[name]}`, note: 'same package in dependencies and devDependencies' });
    }
  }
  return issues;
}

export function runDependencyHygiene(ctx) {
  const findings = [];
  const check = { id: 'deps', category: 'debt', effort: 'trivial' };

  for (const m of ctx.repo.manifests ?? []) {
    if (!inScope(ctx, m.file)) continue; // under --changed: only changed manifests
    const issues = [];
    if (/(^|\/)package\.json$/.test(m.file) && m.raw) issues.push(...analyzePackageJson(m.file, m.raw));
    if (/requirements[a-z0-9_.-]*\.txt$/.test(m.file)) {
      const text = ctx.fileStore.content(m.file) ?? '';
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#') || t.startsWith('-')) continue;
        if (/^[A-Za-z0-9_.\-]+$/.test(t)) {
          issues.push({ name: t, spec: '(unpinned)', note: `requirement "${t}" has no version constraint — every deploy can pull a different release` });
        }
      }
    }
    if (!issues.length) continue;
    findings.push(makeFinding(check, {
      file: m.file, lines: null, severity: issues.length >= 3 ? 'medium' : 'low', confidence: 0.8,
      title: `Dependency hygiene issues in ${m.file.split('/').pop()} (${issues.length})`,
      description: issues.slice(0, 8).map((i) => `- **${i.name}** \`${i.spec}\`: ${i.note}`).join('\n'),
      suggestion: 'Pin exact versions (lockfiles for npm/cargo; `==` pins or constraints.txt for pip) and audit ranges deliberately when upgrading.',
      benefit: 'Reproducible builds and no surprise breaking upgrades.',
      risk: 'Low — pinning alone changes no runtime behavior.',
      tags: ['deps'], areas: ['debt', 'security'],
    }));
  }

  // Missing lockfile next to a package.json (checked on disk: lockfiles are
  // intentionally excluded from the walked set)
  const hasPkgJson = (ctx.repo.manifestFiles ?? []).some((f) => /(^|\/)package\.json$/.test(f));
  if (hasPkgJson) {
    const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'];
    const hasLock = lockfiles.some((lf) => fs.existsSync(path.join(ctx.root, lf)) || fs.existsSync(path.join(ctx.root, 'src', lf)));
    if (!hasLock) {
      const pkgRel = (ctx.repo.manifestFiles ?? []).find((f) => /(^|\/)package\.json$/.test(f));
      if (!inScope(ctx, pkgRel ?? '')) return findings;
      findings.push(makeFinding(check, {
        file: pkgRel ?? null, lines: null, severity: 'medium', confidence: 0.75,
        title: 'No lockfile committed next to package.json',
        description: 'Without a lockfile, every `npm install` resolves fresh versions — CI, teammates, and production can drift apart silently.',
        suggestion: 'Commit the lockfile matching your package manager (npm/yarn/pnpm) and install with `npm ci` in CI.',
        benefit: 'Identical dependency trees everywhere; fewer "works on my machine" failures.',
        risk: 'None — adding a lockfile is additive.',
        tags: ['lockfile'], areas: ['debt', 'security'],
      }));
    }
  }
  return findings;
}
