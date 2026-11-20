// Secret redaction: credential-like literals matched by the preflight secret
// scan are registered here and replaced with non-reversible, hash-identified
// placeholders in every downstream surface: findings, reports, model prompts,
// and agent tool results. Raw values never leave the process.
//
// Placeholder shape: [REDACTED <kind> #<sha256-8>] — a non-reversible
// fingerprint that correlates findings without disclosing any prefix/suffix
// of the value (a 4-char head/tail would leak key material).
//
// A11/A12 hardening:
//   - preflight registration is unconditional and covers ALL walked text
//     files (source, configs, .env), not just source extensions
//   - the final report object is deep-sanitized (notes, runs, verdicts…),
//     not only finding fields
//   - serialization is validated fail-closed: a registered literal surviving
//     into report output aborts the run

import crypto from 'node:crypto';

const MIN_LITERAL = 8;

export function createRedactor({ enabled = true } = {}) {
  const map = new Map(); // raw literal -> placeholder

  function add(raw, kind = 'secret') {
    const value = String(raw ?? '').trim();
    if (!enabled || value.length < MIN_LITERAL) return null;
    if (!map.has(value)) {
      const safeKind = String(kind).replace(/[^a-z0-9-]/gi, '') || 'secret';
      const id = crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);
      map.set(value, `[REDACTED ${safeKind} #${id}]`);
    }
    return map.get(value);
  }

  function redact(text) {
    if (!enabled || text == null || map.size === 0) return text;
    let out = text;
    for (const [raw, placeholder] of map) {
      if (out.includes(raw)) out = out.split(raw).join(placeholder);
    }
    return out;
  }

  return {
    enabled,
    add,
    redact,
    get size() { return map.size; },
    placeholderCount: () => map.size,
    // For fail-closed validation: confirm no registered literal survives.
    // Returns the raw literal (internal use only — never print it).
    leaksInto(text) {
      if (text == null) return null;
      for (const raw of map.keys()) if (String(text).includes(raw)) return raw;
      return null;
    },
    // Safe description of a leak for error messages: the placeholder hash,
    // never any part of the original value.
    leakPlaceholderInto(text) {
      if (text == null) return null;
      for (const [raw, placeholder] of map) {
        if (String(text).includes(raw)) return placeholder;
      }
      return null;
    },
  };
}

/**
 * A19 final model-request boundary: refuses to let a registered secret cross
 * into a model-bound payload. Throws BEFORE any request is sent. The error
 * deliberately contains NO literal material — only the placeholder hash.
 */
export function assertNoRegisteredSecret(text, redactor, label = 'model payload') {
  const placeholder = redactor?.leakPlaceholderInto?.(text);
  if (placeholder) {
    throw new Error(
      `model-boundary check failed on ${label}: a registered secret (${placeholder}) would be sent to the model. ` +
      'Aborting before any request. This is an internal redaction bug — please report it.',
    );
  }
}

/** Redact every user-visible text field of a finding (in place). */
export function redactFinding(f, redactor) {
  if (!redactor?.size) return f;
  // ids embed the cited path — they are model-visible in the findings block
  if (typeof f.id === 'string') f.id = redactor.redact(f.id);
  if (typeof f.title === 'string') f.title = redactor.redact(f.title);
  if (typeof f.file === 'string') f.file = redactor.redact(f.file);
  if (typeof f.description === 'string') f.description = redactor.redact(f.description);
  if (typeof f.snippet === 'string') f.snippet = redactor.redact(f.snippet);
  if (typeof f.suggestion === 'string') f.suggestion = redactor.redact(f.suggestion);
  if (typeof f.benefit === 'string') f.benefit = redactor.redact(f.benefit);
  if (typeof f.risk === 'string') f.risk = redactor.redact(f.risk);
  if (f.verification && typeof f.verification.note === 'string') {
    f.verification.note = redactor.redact(f.verification.note);
  }
  for (const occ of f.occurrences ?? []) {
    if (typeof occ.file === 'string') occ.file = redactor.redact(occ.file);
    if (typeof occ.snippet === 'string') occ.snippet = redactor.redact(occ.snippet);
    if (typeof occ.text === 'string') occ.text = redactor.redact(occ.text);
  }
  if (typeof f.dismissReason === 'string') f.dismissReason = redactor.redact(f.dismissReason);
  if (typeof f.verdictNote === 'string') f.verdictNote = redactor.redact(f.verdictNote);
  if (Array.isArray(f.modelVerdicts)) {
    for (const v of f.modelVerdicts) {
      if (typeof v.reason === 'string') v.reason = redactor.redact(v.reason);
    }
  }
  return f;
}

/** Redact a list of findings (in place). */
export function redactFindings(findings, redactor) {
  for (const f of findings) redactFinding(f, redactor);
  return findings;
}

/**
 * Deep-sanitize a report-bound structure: every string in plain objects and
 * arrays (including notes, run metadata/errors, tool notes, verdict history)
 * passes through the redactor. Walks only plain data — never class instances.
 */
export function redactDeep(value, redactor) {
  if (!redactor?.size) return value;
  if (typeof value === 'string') return redactor.redact(value);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, redactor));
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v, redactor);
    return out;
  }
  return value;
}

/**
 * Files that are denied to models by default (A11): known secret containers.
 * Content is redacted where possible, but redaction heuristics cannot
 * guarantee zero leaks, so entire files of this shape are withheld from model
 * access unless `checks.allowSecretFileReads` is explicitly enabled.
 */
const SECRET_FILE_RE = /(^|\/)(\.env[^/]*|credentials?\.(json|ya?ml|toml|ini|cfg)|secrets?\.(json|ya?ml|toml|ini|cfg)|tokens?\.(json|ya?ml|toml|ini|cfg)|id_rsa[^/]*|\.netrc|\.npmrc|\.htpasswd|[^/]*\.(pem|p12|pfx|kdbx|key))$/i;

export function isSecretFileRel(rel) {
  return SECRET_FILE_RE.test(String(rel ?? ''));
}
