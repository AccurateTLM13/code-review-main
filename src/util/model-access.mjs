// Model-access and egress policy.
//
// A18: one file-exposure policy applied on EVERY route that can surface file
//      content to a model — read_file, search_code, context excerpts, graph
//      paths. Default-deny for secret-shaped filenames; text redaction stays
//      defense in depth, never the only gate.
// A20: "local-only" overrides are enforced, not suggested. Locality is
//      derived from the endpoint, never from a friendly profile name, and the
//      secret-file override is rejected for remote/unknown endpoints unless
//      separately acknowledged — before any model request is attempted.
import { isSecretFileRel } from './redact.mjs';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', 'host.docker.internal', 'localhost.localdomain']);

export function isLocalEndpoint(baseUrl) {
  if (!baseUrl) return false;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`);
    const host = url.hostname.toLowerCase();
    return LOCAL_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local');
  } catch {
    return false;
  }
}

/** Does this profile send data to a remote third party? Unknown endpoints are
 *  treated as remote (default-deny). */
export function isRemoteEgress(profile) {
  const provider = String(profile?.provider ?? '');
  if (provider === 'mock') return false; // no network egress at all
  if (['openai', 'openrouter', 'anthropic', 'google'].includes(provider)) return true;
  // ollama / openai-compatible: locality comes from the endpoint itself
  return !isLocalEndpoint(profile?.baseUrl);
}

export function egressLabel(profile) {
  return isRemoteEgress(profile) ? 'remote' : 'local';
}

/**
 * Validate the secret-file override against the egress policy of every
 * selected profile. Throws BEFORE any model request is attempted when the
 * override is enabled and a remote/unknown endpoint would receive data.
 * Error messages contain no literal material by design.
 */
export function validateEgressPolicy(profiles, config) {
  const checks = config?.checks ?? {};
  const overrideEnabled = checks.allowSecretFileReads === true;
  const remoteAcknowledged = checks.allowSecretFileReadsRemote === true;
  if (!overrideEnabled) return { overrideEnabled: false, remoteAcknowledged };
  for (const p of profiles) {
    if (isRemoteEgress(p) && !remoteAcknowledged) {
      throw new Error(
        `checks.allowSecretFileReads is enabled, but profile "${p.name}" targets a REMOTE endpoint ` +
        `(${p.provider} → ${p.baseUrl ?? 'cloud'}). Reading secret-shaped files and sending them to a third ` +
        'party must be acknowledged separately: set checks.allowSecretFileReadsRemote = true, or remove ' +
        'checks.allowSecretFileReads. No model request will be made until this policy conflict is resolved.',
      );
    }
  }
  return { overrideEnabled: true, remoteAcknowledged };
}

/**
 * The single file-exposure decision used by every content-bearing route.
 * canExposeFile(rel) → { ok, reason? }
 */
export function createModelPolicy({ allowSecretFiles = false, remoteAcknowledged = false, remote = false } = {}) {
  const canExposeFile = (rel) => {
    if (!isSecretFileRel(rel)) return { ok: true };
    if (!allowSecretFiles) {
      return { ok: false, reason: `Access to credential-like file "${rel}" is denied by default (checks.allowSecretFileReads in the repository config enables it for local-model runs; remote use additionally requires checks.allowSecretFileReadsRemote).` };
    }
    if (remote && !remoteAcknowledged) {
      return { ok: false, reason: 'Egress policy: this run sends data to a remote endpoint, so secret-shaped files stay denied. Set checks.allowSecretFileReadsRemote to acknowledge exposure.' };
    }
    return { ok: true };
  };
  return {
    allowSecretFiles,
    remoteAcknowledged,
    remote,
    canExposeFile,
    /** Filter helper: only files the model may see. */
    exposeableFiles: (files) => files.filter((e) => canExposeFile(e.rel).ok),
  };
}

/** Build the effective policy for a given profile and validated config. */
export function policyForProfile(profile, config, egress) {
  const allowSecretFiles = config?.checks?.allowSecretFileReads === true;
  return createModelPolicy({
    allowSecretFiles,
    remoteAcknowledged: egress?.remoteAcknowledged ?? false,
    remote: isRemoteEgress(profile),
  });
}
