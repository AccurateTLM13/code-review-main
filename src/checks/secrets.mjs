// Hardcoded secret / credential detection with entropy checks and test-fixture
// awareness. Deterministic, read-only.
//
// Redaction contract: every confirmed credential literal is registered in
// ctx.redactor and NEVER copied anywhere in raw form — snippets built here are
// already redacted, and the runner redacts all other findings, model prompts,
// and tool results against the same registry.
import { makeFinding, snippetAround, scopedSourceFiles, inScope } from './index.mjs';

const KEY_PATTERNS = [
  { id: 'aws-key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/, severity: 'critical', title: 'AWS access key ID committed', conf: 0.95, kind: 'aws-key' },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/, severity: 'critical', title: 'Private key material in source', conf: 0.97, kind: 'private-key' },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_\-]{35}\b/, severity: 'high', title: 'Google API key committed', conf: 0.85, kind: 'google-key' },
  { id: 'slack-token', re: /\bxox[baprs]-[0-9A-Za-z]{10,}\b/, severity: 'high', title: 'Slack token committed', conf: 0.9, kind: 'slack-token' },
  { id: 'github-pat', re: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/, severity: 'critical', title: 'GitHub personal access token committed', conf: 0.95, kind: 'github-token' },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{15,}\.[A-Za-z0-9_\-]{10,}\b/, severity: 'high', title: 'JWT token literal in source', conf: 0.8, kind: 'jwt' },
  { id: 'basic-auth-url', re: /https?:\/\/[^\s:@/]+:[^\s:@/]{6,}@/, severity: 'high', title: 'Credentials embedded in URL', conf: 0.85, kind: 'url-credential' },
];

const ASSIGN_RE = /\b(?:api[_-]?key|apikey|secret|secret[_-]?key|access[_-]?token|auth[_-]?token|token|passwd|password|pwd|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*["'`]([^"'`]{12,200})["'`]/gi;

// config-file formats (JSON / YAML-style) — the model can read these too
const JSON_ASSIGN_RE = /["']?(api[_-]?key|apikey|secret|secret[_-]?key|access[_-]?token|auth[_-]?token|token|passwd|password|pwd|client[_-]?secret|private[_-]?key)["']?\s*:\s*["']([^"'\s]{12,200})["']/gi;
const YAML_ASSIGN_RE = /^[ \t]*(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|token)[ \t]*:[ \t]*["']?([^\s"']{12,200})["']?[ \t]*$/gim;
const ENV_SECRET_KEY_RE = /(?:key|secret|token|passwd|password|pwd|credential|cert|private)/i;

const FAKE_HINTS = [
  'changeme', 'change-me', 'xxx', 'placeholder', 'example', 'your_api_key', 'yourkeyhere',
  'dummy', 'todo', 'fixme', 'test', 'sample', '<', '${', '%s', '****', 'redacted', 'notarealkey',
  'sk-or-v1-0000', 'insert', 'paste', 'replace', 'secret_here', 'xxx-xxx', 'example2',
];

function shannonEntropy(s) {
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function isTestishPath(rel) {
  return /(^|\/)(tests?|__tests__|mocks?|fixtures?|examples?|samples?|testdata)(\/|$)/i.test(rel)
    || /\.(test|spec|mock|example|sample)\.[a-z]+$/i.test(rel)
    || /(^|\/)\.env\.example$/.test(rel)
    || /\.example\./.test(rel);
}

// globalized copies for matchAll use in the preflight
const KEY_PATTERNS_G = KEY_PATTERNS.map((p) => ({
  kind: p.kind,
  re: new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : `${p.re.flags}g`),
}));

/**
 * A11 preflight: unconditional secret registration over EVERY walked text
 * file (source, JSON/YAML configs, .env) — independent of --focus, because
 * the redaction registry protects model-bound surfaces even when the secrets
 * check itself is not in the selected focus. Runs before every audit.
 * @returns {number} count of registered literals
 */
export function preflightRegisterSecrets(ctx) {
  const redactor = ctx.redactor;
  if (!redactor?.enabled) return 0;
  let registered = 0;
  const add = (raw, kind) => {
    if (raw && redactor.add(raw, kind)) registered++;
  };

  for (const entry of ctx.fileStore.all) {
    const content = ctx.fileStore.content(entry.rel);
    if (!content) continue;
    const isEnvish = /(^|\/)\.env(\.|$)/.test(entry.rel) && !/example|sample|template/i.test(entry.rel);

    // named credential patterns (AWS keys, PATs, JWTs…) in any file type
    for (const pat of KEY_PATTERNS_G) {
      for (const m of content.matchAll(pat.re)) add(m[0], pat.kind);
    }
    // source-style assignments
    for (const m of content.matchAll(ASSIGN_RE)) add(m[1], 'credential');
    // JSON-style config values
    for (const m of content.matchAll(JSON_ASSIGN_RE)) add(m[2], 'credential');
    // YAML-style config values
    for (const m of content.matchAll(YAML_ASSIGN_RE)) add(m[1], 'credential');
    // env-style lines: every value in a real .env, or any secret-ish key elsewhere
    for (const line of content.split(/\r?\n/)) {
      const eq = line.match(/^\s*([\w.-]+)\s*=\s*(.*)$/);
      if (!eq) continue;
      const value = eq[2].trim().replace(/^["']|["']$/g, '');
      if (value.length < 12 || value.includes('${')) continue;
      if (isEnvish || ENV_SECRET_KEY_RE.test(eq[1])) add(value, 'env-value');
    }
  }
  return registered;
}

export function runSecrets(ctx) {
  const findings = [];
  const check = { id: 'secrets', category: 'security', effort: 'trivial' };
  const redactor = ctx.redactor;
  const register = (raw, kind) => { if (raw) redactor?.add(raw, kind); };
  const redactLine = (line) => (redactor ? redactor.redact(line) : line);

  for (const entry of scopedSourceFiles(ctx)) {
    const content = ctx.fileStore.content(entry.rel);
    if (!content) continue;
    const lines = ctx.fileStore.lines(entry.rel);
    const testish = isTestishPath(entry.rel);

    // named key patterns (per line)
    for (const pat of KEY_PATTERNS) {
      let count = 0;
      for (let i = 0; i < lines.length && count < 5; i++) {
        const m = lines[i].match(pat.re);
        if (!m) continue;
        count++;
        register(m[0], pat.kind);
        const fake = FAKE_HINTS.some((h) => m[0].toLowerCase().includes(h));
        if (testish || fake) continue;
        findings.push(makeFinding(check, {
          file: entry.rel, lines: [i + 1, i + 1], severity: pat.severity, confidence: pat.conf,
          title: pat.title,
          snippet: redactLine(lines[i]),
          description: `Matched pattern \`${pat.id}\` in ${entry.rel}:${i + 1}. This looks like a real credential (value redacted in this report). Rotate the secret and move it to an environment variable or secret manager.`,
          suggestion: 'Remove the literal, rotate the credential, load from process env / secret store, and scrub git history if committed.',
          benefit: 'Eliminates a directly exploitable credential leak.',
          risk: 'Low — mechanical replacement plus key rotation; verify dependent services after rotation.',
          tags: [pat.id], areas: ['security'],
        }));
      }
    }

    // generic high-entropy assignments
    for (const m of content.matchAll(ASSIGN_RE)) {
      const value = m[1];
      const lower = value.toLowerCase();
      if (FAKE_HINTS.some((h) => lower.includes(h))) continue;
      const entropy = shannonEntropy(value);
      const looksSecret = entropy > 3.5 && value.length >= 16 && /(?=.*[A-Za-z])(?=.*[0-9_-])/.test(value);
      if (!looksSecret) continue;
      register(value, 'credential');
      const lineNo = content.slice(0, m.index).split('\n').length;
      if (testish) continue;
      const sev = entropy > 4.2 ? 'high' : 'medium';
      findings.push(makeFinding(check, {
        file: entry.rel, lines: [lineNo, lineNo], severity: sev,
        confidence: Math.min(0.85, 0.5 + (entropy - 3.5) / 10),
        title: `Possible hardcoded secret assigned to "${(m[0].match(/\b([a-zA-Z_-]+)\b\s*[:=]/) ?? [])[1] ?? 'variable'}"`,
        snippet: redactLine(lines[lineNo - 1] ?? ''),
        description: `High-entropy value (entropy ${entropy.toFixed(1)}) assigned near ${entry.rel}:${lineNo}. Could be a real API key or token. Value redacted in this report.`,
        suggestion: 'Confirm whether this is a real credential. If so, rotate it and inject via environment variable.',
        benefit: 'Prevents accidental credential leaks in source control or builds.',
        risk: 'Low — if this is generated test data, mark it clearly as such.',
        tags: ['entropy'], areas: ['security'],
      }));
    }
  }

  // .env committed to the tree (and git-tracked, when git is available)
  const envFiles = ctx.fileStore.all.filter((e) => /(^|\/)\.env(\.|$)/.test(e.rel) && !/example|sample|template/i.test(e.rel));
  for (const env of envFiles.slice(0, 5)) {
    if (!inScope(ctx, env.rel)) continue;
    // Register .env values for redaction even though .env is not a "source"
    // file — nothing inside it should ever reach a prompt or a report.
    const envContent = ctx.fileStore.content(env.rel);
    for (const line of envContent?.split(/\r?\n/) ?? []) {
      const eq = line.match(/^\s*[\w.-]+\s*=\s*(.*)$/);
      if (eq && eq[1].trim().length >= 12 && !eq[1].includes('${')) register(eq[1].trim().replace(/^["']|["']$/g, ''), 'env-value');
    }
    const tracked = ctx.git?.isTracked ? ctx.git.isTracked(ctx.root, env.rel) : null;
    findings.push(makeFinding(check, {
      file: env.rel, lines: null,
      severity: tracked ? 'high' : 'medium', confidence: tracked ? 0.9 : 0.6,
      title: `.env file present${tracked ? ' and tracked by git' : ' in repository'}`,
      description: `${env.rel} exists${tracked ? ' and is committed' : ''}. Environment files frequently contain secrets and are easy to leak via zip archives, Docker contexts, or accidental commits. Contents are redacted from all reports and prompts.`,
      suggestion: 'Keep only .env.example in the repository; load real values from the environment. If tracked, remove it from the index and add .env to .gitignore.',
      benefit: 'Removes a common accidental leak vector.',
      risk: 'Low — ensure local deployments still find their configuration.',
      tags: ['env-file'], areas: ['security'],
    }));
  }

  return findings;
}
