// Configuration: profiles for model adapters, check tuning, precedence.
//   defaults  <  ~/.code-audit/config.json  <  <repo>/code-audit.config.json  <  env vars / CLI flags
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { toPosix } from './util/files.mjs';

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
export const CATEGORIES = ['security', 'bug', 'duplication', 'performance', 'refactoring', 'debt'];
export const FOCUS_AREAS = [...CATEGORIES, 'all'];
export const DEPTHS = ['quick', 'standard', 'deep'];

// Built-in profiles (mirroring the profile table in the README):
//   local       — Ollama on this machine, zero API cost
//   openrouter  — free/cloud models via OpenRouter
//   deep        — a capable model for architecture-level reasoning
//   multi       — convenience alias that runs local + openrouter together
//   mock        — offline scripted model for testing/demo without any server
export const DEFAULT_PROFILES = {
  local: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5-coder',
    adapter: 'auto',            // ai-sdk if installed, else native HTTP
    contextChars: 48000,         // keep prompts small for local context windows
    maxTokens: 4096,
    temperature: 0.2,
    maxSteps: 24,
  },
  openrouter: {
    provider: 'openrouter',
    model: 'qwen/qwen3-coder:free',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    contextChars: 160000,
    maxTokens: 8192,
    temperature: 0.2,
    maxSteps: 28,
  },
  deep: {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.5',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    contextChars: 240000,
    maxTokens: 8192,
    temperature: 0.2,
    maxSteps: 32,
  },
  mock: { provider: 'mock', adapter: 'mock', contextChars: 48000, maxTokens: 2048, maxSteps: 8 },
};

export const DEFAULT_MULTI = { local: ['local', 'openrouter'], deep: ['deep'] };

// Provider metadata: default base URLs and where API keys come from.
export const PROVIDERS = {
  ollama: {
    label: 'Ollama (local)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    hostEnv: 'OLLAMA_HOST',   // e.g. http://192.168.1.5:11434
    probe: async (cfg) => {
      const base = cfg.baseUrl.replace(/\/v1\/?$/, '');
      const tags = await fetchJson(`${base}/api/tags`);
      return { ok: tags != null, models: tags ? tags.models?.map((m) => m.name) ?? [] : [] };
    },
  },
  openrouter: {
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  'openai-compatible': {
    label: 'OpenAI-compatible endpoint (requires baseUrl in profile)',
  },
  anthropic: { label: 'Anthropic (via Vercel AI SDK)', apiKeyEnv: 'ANTHROPIC_API_KEY' },
  google: { label: 'Google AI (via Vercel AI SDK)', apiKeyEnv: 'GOOGLE_GENERATIVE_AI_API_KEY' },
  mock: { label: 'Built-in scripted mock (offline)' },
};

export const DEFAULT_CONFIG = {
  defaultModels: ['local'],
  failOn: null,
  ignore: [],
  checks: {
    minDuplicationLines: 6,
    maxFileLoc: 800,
    bigFileLoc: 400,
    giantFileLoc: 2000,
    maxFindingsPerCheck: 40,
    redactSecrets: true,
    // Files that look like credential containers (.env, credentials.json,
    // *.pem, …) are denied to models by default. Redaction heuristics cannot
    // guarantee zero leaks, so entire files of this shape stay local.
    // Opt in ONLY for private, local-model runs.
    allowSecretFileReads: false,
    // Separate, explicit acknowledgment required to expose secret-shaped
    // files to REMOTE endpoints. Enforced before any model request is sent.
    allowSecretFileReadsRemote: false,
  },
  reports: { dir: '.code-audit/reports' },
};

async function fetchJson(url, { timeoutMs = 2500, headers = {} } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal, headers });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; } finally { clearTimeout(t); }
}

// ---------- config file loading ----------

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

export function configPaths(target) {
  // Load order defines precedence: earlier files are the base, later files win.
  //   defaults  <  user (~)  <  repository config  <  EXPLICIT config  <  CLI flags
  const candidates = [];
  candidates.push({ path: path.join(os.homedir(), '.code-audit', 'config.json'), layer: 'user', required: false });
  candidates.push({ path: path.join(target, 'code-audit.config.json'), layer: 'repository', required: false });
  candidates.push({ path: path.join(target, '.code-audit', 'config.json'), layer: 'repository', required: false });
  if (process.env.CODE_AUDIT_CONFIG) {
    candidates.push({ path: process.env.CODE_AUDIT_CONFIG, layer: 'explicit', required: true });
  }
  return candidates;
}

/**
 * Load and merge configuration. Returns { config, sources } where sources
 * lists which files actually contributed, in precedence order.
 */
export function loadConfig(target) {
  const sources = [];
  const merged = structuredClone(DEFAULT_CONFIG);
  merged.profiles = structuredClone(DEFAULT_PROFILES);

  for (const { path: p, layer, required } of configPaths(target)) {
    if (!fs.existsSync(p)) {
      if (required) throw new Error(`Explicit config file not found: ${p}`);
      continue;
    }
    const data = readJsonSafe(p);
    if (data == null) throw new Error(`Config file is not valid JSON: ${p}`);
    sources.push(`${layer}: ${toPosix(path.relative(target, p)) || p}`);
    for (const [name, prof] of Object.entries(data.profiles ?? {})) {
      merged.profiles[name] = { ...(merged.profiles[name] ?? {}), ...prof };
    }
    if (data.defaultModels) merged.defaultModels = data.defaultModels;
    if (data.failOn !== undefined) merged.failOn = data.failOn;
    if (Array.isArray(data.ignore)) merged.ignore.push(...data.ignore); // additive across layers
    if (data.checks) merged.checks = { ...merged.checks, ...data.checks };
    if (data.reports) merged.reports = { ...merged.reports, ...data.reports };
  }
  return { config: merged, sources };
}

// ---------- profile resolution ----------

/** Expand a comma-separated --models value into concrete profile names. */
export function expandModelSelection(names, config) {
  const out = [];
  for (const raw of String(names).split(',')) {
    const name = raw.trim();
    if (!name) continue;
    if (name === 'multi' && !config.profiles.multi) {
      out.push(...(DEFAULT_MULTI.local ?? ['local', 'openrouter']));
    } else {
      out.push(name);
    }
  }
  const unknown = out.filter((n) => !config.profiles[n]);
  if (unknown.length) {
    throw new Error(`Unknown model profile(s): ${unknown.join(', ')}. Available: ${Object.keys(config.profiles).join(', ')}`);
  }
  return [...new Set(out)];
}

/**
 * Resolve a profile into everything an adapter needs: endpoint, key, budgets.
 * Throws a descriptive error when a required API key is missing.
 */
export function resolveProfile(name, config, { modelOverride = null } = {}) {
  const prof = config.profiles[name];
  if (!prof) throw new Error(`Unknown profile: ${name}`);
  const provider = prof.provider ?? 'openai-compatible';
  const meta = PROVIDERS[provider];
  if (!meta) throw new Error(`Profile "${name}": unknown provider "${provider}"`);

  let baseUrl = prof.baseUrl ?? meta.defaultBaseUrl;
  if (!baseUrl && provider === 'ollama') baseUrl = 'http://localhost:11434/v1';
  if (provider === 'ollama' && process.env.OLLAMA_HOST) {
    const host = process.env.OLLAMA_HOST.replace(/\/+$/, '');
    baseUrl = host.endsWith('/v1') ? host : `${host}/v1`;
  }
  if (!baseUrl && provider === 'openai-compatible') {
    throw new Error(`Profile "${name}": provider "openai-compatible" requires "baseUrl" in its config`);
  }
  if (baseUrl && !baseUrl.endsWith('/v1') && provider !== 'anthropic' && provider !== 'google') {
    baseUrl = baseUrl.replace(/\/+$/, '');
  }

  const keyEnv = prof.apiKeyEnv ?? meta.apiKeyEnv;
  let apiKey = prof.apiKey ?? null;
  if (!apiKey && keyEnv) apiKey = process.env[keyEnv] ?? null;
  if (!apiKey && keyEnv && provider !== 'ollama' && provider !== 'mock') {
    // Key-gated providers fail lazily with a clear message at call time.
    apiKey = null;
  }

  return {
    name,
    provider,
    label: meta.label,
    model: modelOverride ?? prof.model ?? null,
    baseUrl: baseUrl ?? null,
    apiKey,
    apiKeyEnv: keyEnv ?? null,
    adapter: prof.adapter ?? 'auto',
    contextChars: prof.contextChars ?? 160000,
    maxTokens: prof.maxTokens ?? 4096,
    temperature: prof.temperature ?? 0.2,
    maxSteps: prof.maxSteps ?? 24,
    raw: prof,
  };
}

/**
 * Stable identity of the actual model behind a profile (A17): two profiles
 * pointing at the same provider, endpoint, and model are the same reviewer.
 * Used for independent-model consensus and verdict vote counting.
 */
export function modelFingerprint(profile) {
  const provider = String(profile?.provider ?? '').toLowerCase();
  const model = String(profile?.model ?? '').toLowerCase();
  let endpoint = String(profile?.baseUrl ?? '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  endpoint = endpoint.replace(/\/v\d$/, ''); // http://x/v1 ≡ http://x
  return `${provider}|${endpoint}|${model}`;
}

export async function probeProfile(name, config) {
  const prof = config.profiles[name];
  if (!prof) return { name, ok: false, error: 'unknown profile' };
  const provider = prof.provider ?? 'openai-compatible';
  try {
    const resolved = resolveProfile(name, config);
    if (provider === 'mock') return { name, ok: true, detail: 'offline scripted adapter', models: [] };
    if (provider === 'ollama') {
      const r = await PROVIDERS.ollama.probe(resolved);
      return {
        name, ok: r.ok,
        detail: r.ok ? `Ollama reachable — ${r.models.length} model(s) installed` : 'Ollama not reachable',
        models: r.models,
      };
    }
    if (resolved.apiKeyEnv && !resolved.apiKey) {
      return { name, ok: false, detail: `set ${resolved.apiKeyEnv} to use this profile` };
    }
    const auth = resolved.apiKey ? { Authorization: `Bearer ${resolved.apiKey}` } : {};
    const models = await fetchJson(`${resolved.baseUrl.replace(/\/+$/, '')}/models`, { headers: auth });
    return {
      name, ok: models != null,
      detail: models != null ? 'endpoint reachable' : 'endpoint unreachable or unauthorized',
      models: (models?.data ?? []).map((m) => m.id).slice(0, 50),
    };
  } catch (err) {
    return { name, ok: false, detail: err.message };
  }
}
