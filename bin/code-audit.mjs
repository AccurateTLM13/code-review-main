#!/usr/bin/env node
// code-audit — model-agnostic, read-only code audit agent.
// Entry point: resolves the CLI, prints a friendly error if dependencies are missing.
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '..', 'src', 'cli.mjs');

if (!existsSync(cli)) {
  console.error('code-audit: cannot find src/cli.mjs next to bin/. Installation looks broken.');
  process.exit(2);
}

try {
  await import(pathToFileURL(cli).href);
} catch (err) {
  const msg = err?.message ?? String(err);
  if (/Cannot find (module|package)/.test(msg) && /node_modules/.test(msg)) {
    console.error('code-audit: dependencies are missing or incomplete.');
    console.error('  Run:  npm install');
    console.error('  (The CLI also works with no dependencies using its built-in model client.)');
    process.exit(2);
  }
  console.error('code-audit: failed to start:', msg);
  process.exit(2);
}
