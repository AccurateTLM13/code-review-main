// Model adapters. One internal interface, three implementations:
//
//   AiSdkAdapter   — preferred path. Vercel AI SDK (`ai` + provider packages),
//                    handles the tool loop itself (tools with execute + stopWhen).
//   NativeAdapter  — zero-dependency OpenAI-compatible HTTP client (Node fetch).
//                    Manual tool loop. Works with Ollama, OpenRouter, LM Studio,
//                    any /v1/chat/completions endpoint, even without npm install.
//   MockAdapter    — scripted offline model for tests and demos.
//
// Interface:
//   complete({ system, prompt, temperature?, maxTokens?, signal? })
//       -> { text, usage }
//   investigate({ system, prompt, tools, maxSteps, temperature?, maxTokens?, signal? })
//       -> { text, finishReason, steps, toolLog, usage }
//
// tools: [{ name, description, parameters (JSON Schema), execute(args), terminal? }]
// A tool marked terminal:true (submit_findings) stops the investigation loop.

const REQUEST_TIMEOUT_MS = 300_000;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function combinedSignal(parent, timeoutMs = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener('abort', onAbort, { once: true });
  }
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  ctrl.signal.addEventListener('abort', () => clearTimeout(t), { once: true });
  return { signal: ctrl.signal, cleanup: () => clearTimeout(t) };
}

function errName(e) {
  return e?.name ?? e?.constructor?.name ?? 'Error';
}

function isAbort(e) {
  return errName(e) === 'AbortError' || /aborted|timeout/i.test(e?.message ?? '');
}

export class ModelCallError extends Error {
  constructor(message, { status = null, profile = null, cause = null } = {}) {
    super(message);
    this.name = 'ModelCallError';
    this.status = status;
    this.profile = profile;
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Native OpenAI-compatible adapter
// ---------------------------------------------------------------------------

export class NativeAdapter {
  constructor(profile) {
    this.profile = profile;
    this.kind = 'native';
  }

  baseUrl() {
    let base = this.profile.baseUrl ?? '';
    if (!/\/v\d\/?$/.test(base) && !base.endsWith('/v1')) base = base.replace(/\/+$/, '') + '/v1';
    return base.replace(/\/+$/, '');
  }

  headers() {
    const h = { 'content-type': 'application/json' };
    if (this.profile.apiKey) h.authorization = `Bearer ${this.profile.apiKey}`;
    if (this.profile.provider === 'openrouter') {
      h['HTTP-Referer'] = 'https://github.com/local/code-audit';
      h['X-Title'] = 'code-audit';
    }
    return h;
  }

  async post(body, { signal } = {}) {
    // `signal` is the run-level abort (deadline/user cancel); combinedSignal
    // layers the per-request timeout on top of it.
    const { signal: sig, cleanup } = combinedSignal(signal);
    let url = `${this.baseUrl()}/chat/completions`;
    const init = { method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal: sig };
    let lastErr = null;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, init);
          if (res.ok) {
            const json = await res.json().catch(() => null);
            if (!json) throw new ModelCallError('Endpoint returned non-JSON response', { profile: this.profile.name });
            return json;
          }
          const text = await res.text().catch(() => '');
          if (!RETRYABLE_STATUS.has(res.status) || attempt === 2) {
            throw new ModelCallError(
              `Endpoint ${res.status}: ${text.slice(0, 300) || res.statusText}`,
              { status: res.status, profile: this.profile.name },
            );
          }
          lastErr = new ModelCallError(`Endpoint ${res.status}, retrying…`, { status: res.status, profile: this.profile.name });
        } catch (e) {
          if (e instanceof ModelCallError && !RETRYABLE_STATUS.has(e.status)) throw e;
          if (isAbort(e)) {
            if (signal?.aborted) {
              throw new ModelCallError('run cancelled — wall-clock budget exhausted or aborted by user', { profile: this.profile.name, cancelled: true });
            }
            throw new ModelCallError(`model request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, { profile: this.profile.name });
          }
          lastErr = e;
        }
        await sleep(1000 * (attempt + 1));
      }
      throw lastErr ?? new ModelCallError('Model request failed', { profile: this.profile.name });
    } finally {
      cleanup();
    }
  }

  toWireMessages(messages) {
    return messages.map((m) => {
      if (m.role === 'assistant' && m.toolCalls) {
        return {
          role: 'assistant',
          content: m.content ?? '',
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args ?? {}) },
          })),
        };
      }
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      }
      return { role: m.role, content: m.content };
    });
  }

  async complete({ system, prompt, temperature, maxTokens, signal }) {
    const body = {
      model: this.profile.model,
      messages: this.toWireMessages([{ role: 'system', content: system }, { role: 'user', content: prompt }]),
      temperature: temperature ?? this.profile.temperature,
      max_tokens: maxTokens ?? this.profile.maxTokens,
      stream: false,
    };
    const data = await this.post(body, { signal });
    const msg = data.choices?.[0]?.message ?? {};
    return {
      text: msg.content ?? '',
      usage: { inputTokens: data.usage?.prompt_tokens ?? null, outputTokens: data.usage?.completion_tokens ?? null },
    };
  }

  async investigate({ system, prompt, tools, maxSteps, temperature, maxTokens, signal }) {
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ];
    const wireTools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    const toolLog = [];
    let usage = { inputTokens: 0, outputTokens: 0 };
    let finishReason = 'steps-exhausted';
    let text = '';
    let step = 0;

    if (signal?.aborted) {
      return { text: '', finishReason: 'aborted', steps: 0, toolLog, usage, };
    }

    loop: for (; step < maxSteps; step++) {
      const body = {
        model: this.profile.model,
        messages: this.toWireMessages(messages),
        temperature: temperature ?? this.profile.temperature,
        max_tokens: maxTokens ?? this.profile.maxTokens,
        stream: false,
      };
      if (tools.length) {
        body.tools = wireTools;
        body.tool_choice = 'auto';
      }
      const data = await this.post(body, { signal });
      usage.inputTokens += data.usage?.prompt_tokens ?? 0;
      usage.outputTokens += data.usage?.completion_tokens ?? 0;
      const msg = data.choices?.[0]?.message ?? {};
      const toolCalls = (msg.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function?.name,
        args: parseLooseJson(tc.function?.arguments),
      }));

      if (!toolCalls.length) {
        text = msg.content ?? '';
        finishReason = 'done';
        break;
      }

      messages.push({ role: 'assistant', content: msg.content ?? '', toolCalls });
      let terminalCalled = false;
      for (const tc of toolCalls) {
        const tool = tools.find((t) => t.name === tc.name);
        const t0 = Date.now();
        let result, ok = true;
        if (!tool) {
          result = { error: `Unknown tool "${tc.name}". Available: ${tools.map((t) => t.name).join(', ')}` };
          ok = false;
        } else {
          try {
            result = await tool.execute(tc.args ?? {});
            if (tool.terminal) terminalCalled = true;
          } catch (e) {
            result = { error: `Tool execution failed: ${e.message}` };
            ok = false;
          }
        }
        toolLog.push({ step: step + 1, name: tc.name, ok, ms: Date.now() - t0, summary: summarizeToolResult(result) });
        messages.push({ role: 'tool', toolCallId: tc.id, content: stringifyBounded(result, 9000) });
      }
      if (terminalCalled) {
        finishReason = 'submitted';
        break loop;
      }
    }

    return { text, finishReason, steps: step, toolLog, usage };
  }
}

function parseLooseJson(s) {
  if (s == null) return {};
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return { _raw: String(s) }; }
}

function stringifyBounded(v, max) {
  let s;
  try { s = typeof v === 'string' ? v : JSON.stringify(v, null, 1); } catch { s = String(v); }
  if (s == null) s = 'null';
  return s.length > max ? `${s.slice(0, max)}\n…[truncated]` : s;
}

function summarizeToolResult(result) {
  const s = stringifyBounded(result, 200);
  return s.replace(/\s+/g, ' ').slice(0, 160);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Vercel AI SDK adapter
// ---------------------------------------------------------------------------

const SDK_PROVIDER_PKGS = {
  anthropic: { pkg: '@ai-sdk/anthropic', factory: 'createAnthropic' },
  google: { pkg: '@ai-sdk/google', factory: 'createGoogleGenerativeAI' },
};

export class AiSdkAdapter {
  constructor(profile, ai, model) {
    this.profile = profile;
    this.kind = 'ai-sdk';
    this.ai = ai;
    this.model = model;
  }

  static async create(profile) {
    let ai;
    try { ai = await import('ai'); } catch {
      throw new ModelCallError('Vercel AI SDK ("ai" package) is not installed. Run `npm install` or set the profile adapter to "native".', { profile: profile.name });
    }
    if (!profile.model) throw new ModelCallError(`Profile "${profile.name}" has no model id configured.`, { profile: profile.name });
    let model;
    if (profile.provider === 'anthropic' || profile.provider === 'google') {
      const spec = SDK_PROVIDER_PKGS[profile.provider];
      let mod;
      try { mod = await import(spec.pkg); } catch {
        throw new ModelCallError(`Dedicated adapter ${spec.pkg} is not installed. Run: npm install ${spec.pkg} — or switch this profile to an OpenAI-compatible endpoint.`, { profile: profile.name });
      }
      const provider = mod[spec.factory]({ apiKey: profile.apiKey ?? undefined });
      model = provider(profile.model);
    } else {
      let mod;
      try { mod = await import('@ai-sdk/openai-compatible'); } catch {
        throw new ModelCallError('Package "@ai-sdk/openai-compatible" is not installed. Run `npm install` or set the profile adapter to "native".', { profile: profile.name });
      }
      const provider = mod.createOpenAICompatible({
        name: profile.provider,
        baseURL: profile.baseUrl ?? undefined,
        apiKey: profile.apiKey ?? undefined,
        headers: profile.provider === 'openrouter'
          ? { 'HTTP-Referer': 'https://github.com/local/code-audit', 'X-Title': 'code-audit' }
          : undefined,
      });
      const factory = provider.chatModel ?? provider;
      model = factory.call(provider, profile.model);
    }
    return new AiSdkAdapter(profile, ai, model);
  }

  async complete({ system, prompt, temperature, maxTokens, signal }) {
    const { signal: sig, cleanup } = combinedSignal(signal);
    try {
      const result = await this.ai.generateText({
        model: this.model,
        system,
        prompt,
        temperature: temperature ?? this.profile.temperature,
        maxOutputTokens: maxTokens ?? this.profile.maxTokens,
        abortSignal: sig,
      });
      return {
        text: result.text ?? '',
        usage: { inputTokens: result.usage?.inputTokens ?? null, outputTokens: result.usage?.outputTokens ?? null },
      };
    } catch (e) {
      throw wrapSdkError(e, this.profile, signal);
    } finally {
      cleanup();
    }
  }

  async investigate({ system, prompt, tools, maxSteps, temperature, maxTokens, signal }) {
    let submitted = false;
    const { tool } = this.ai;
    const jsonSchema = this.ai.jsonSchema ?? ((s) => s);
    const sdkTools = Object.fromEntries(tools.map((t) => [t.name, tool({
      description: t.description,
      inputSchema: jsonSchema(t.parameters),
      execute: async (input) => {
        if (t.terminal) submitted = true;
        return t.execute(input ?? {});
      },
    })]));

    const attempts = [];
    if (typeof this.ai.isStepCount === 'function') attempts.push(this.ai.isStepCount(maxSteps));
    if (typeof this.ai.stepCountIs === 'function') attempts.push(this.ai.stepCountIs(maxSteps));
    const custom = ({ steps }) => submitted || (steps?.length ?? 0) >= maxSteps;
    attempts.unshift(custom);

    let result = null;
    let lastErr = null;
    const { signal: sig, cleanup } = combinedSignal(signal);
    try {
      for (const stopWhen of attempts) {
        try {
          result = await this.ai.generateText({
            model: this.model,
            system,
            prompt,
            tools: sdkTools,
            toolChoice: 'auto',
            stopWhen,
            temperature: temperature ?? this.profile.temperature,
            maxOutputTokens: maxTokens ?? this.profile.maxTokens,
            abortSignal: sig,
          });
          break;
        } catch (e) {
          lastErr = wrapSdkError(e, this.profile, signal);
          if (isAbort(e) || (e instanceof Error && !/stopWhen/i.test(e.message ?? ''))) throw lastErr;
          result = null;
        }
      }
    } finally {
      cleanup();
    }
    if (!result) throw lastErr ?? new ModelCallError('AI SDK generation failed', { profile: this.profile.name });

    const toolLog = [];
    for (const step of result.steps ?? []) {
      for (const call of step.toolCalls ?? []) {
        const matching = (step.toolResults ?? []).find((r) => r.toolCallId === call.toolCallId);
        toolLog.push({
          step: (step.stepNumber ?? toolLog.length) + 1,
          name: call.toolName,
          ok: matching?.output != null || true,
          ms: null,
          summary: summarizeToolResult(matching?.output ?? {}),
          args: call.input,
        });
      }
    }
    const finishReason = submitted ? 'submitted' : (result.finishReason === 'stop' ? 'done' : String(result.finishReason ?? 'done'));
    return {
      text: result.text ?? '',
      finishReason,
      steps: result.steps?.length ?? 0,
      toolLog,
      usage: {
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
      },
    };
  }
}

function wrapSdkError(e, profile, runSignal) {
  if (e instanceof ModelCallError) return e;
  if (isAbort(e)) {
    if (runSignal?.aborted) {
      return new ModelCallError('run cancelled — wall-clock budget exhausted or aborted by user', { profile: profile.name, cancelled: true });
    }
    return new ModelCallError(`model request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, { profile: profile.name });
  }
  const msg = e?.message ?? String(e);
  return new ModelCallError(`AI SDK call failed: ${msg}`, { profile: profile.name });
}

// ---------------------------------------------------------------------------
// Mock adapter (offline, scripted)
// ---------------------------------------------------------------------------

export class MockAdapter {
  constructor(profile) {
    this.profile = profile;
    this.kind = 'mock';
    this._call = 0;
  }

  async complete({ prompt }) {
    this._call++;
    // Extract a REAL excerpt line so one draft carries a verbatim, verifiable
    // snippet; another draft deliberately cites a bogus file; a third omits
    // the snippet entirely (range-only → must stay unverified).
    const excerpt = extractFirstExcerpt(prompt);
    const fileInPack = excerpt?.file ?? extractFirstPath(prompt) ?? 'src/index.js';
    const verbatimLine = excerpt?.firstLine ?? null;
    const findingId = prompt.match(/^- \[[A-Z]+\] (.+?) — /m)?.[1] ?? null; // ids may contain redaction placeholders
    const text = JSON.stringify({
      verdicts: findingId ? [{ id: findingId, action: 'confirm', severity: 'medium', confidence: 0.8, reason: 'Mock model: consistent with the code excerpt shown.' }] : [],
      findings: [
        {
          title: 'Mock finding: error handling should be centralized',
          category: 'refactoring', severity: 'low', confidence: 0.6,
          file: fileInPack, lines: [1, 3], snippet: verbatimLine,
          description: 'Mock model response with a verbatim snippet copied from the context pack excerpt, so it can pass strict evidence verification.',
          suggestion: 'Introduce a shared error-handling helper.',
          benefit: 'Consistent failure behavior.',
          risk: 'Low.',
        },
        {
          title: 'Mock finding with bogus evidence (should be flagged unverified)',
          category: 'bug', severity: 'high', confidence: 0.7,
          file: 'no/such/file/anywhere.js', lines: [10, 20], snippet: 'this snippet does not exist anywhere',
          description: 'This finding intentionally references a nonexistent file so the evidence validator demonstrably flags it.',
          suggestion: 'Verify evidence before acting.',
          benefit: 'Trustworthy reports.',
          risk: 'None.',
        },
        {
          title: 'Mock finding without a snippet (range-only must stay unverified)',
          category: 'debt', severity: 'low', confidence: 0.5,
          file: fileInPack, lines: [1, 2], snippet: null,
          description: 'Cites a real file and plausible range but provides no verbatim snippet — under the strict policy this cannot be verified.',
          suggestion: 'Always include the exact code lines.',
          benefit: 'Honest confidence reporting.',
          risk: 'None.',
        },
      ],
      notes: process.env.CODE_AUDIT_MOCK_POISON_NOTES
        // test seam (A12): simulates a model echoing a raw registered literal
        // into its notes — the final all-surface sanitizer must catch it.
        ? String(process.env.CODE_AUDIT_MOCK_POISON_NOTES)
        : 'Mock profile: scripted output for offline testing of the audit pipeline.',
    }, null, 2);
    return { text: ` \`\`\`json\n${text}\n\`\`\` `, usage: { inputTokens: 100, outputTokens: 60 } };
  }

  async investigate({ tools }) {
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    const toolLog = [];
    const call = async (name, args) => {
      const t = byName[name];
      const t0 = Date.now();
      const result = await t.execute(args ?? {});
      toolLog.push({ step: toolLog.length + 1, name, ok: true, ms: Date.now() - t0, summary: summarizeToolResult(result) });
      return result;
    };
    try { await call('get_summary', {}); } catch { /* tolerate */ }
    let submit = null;
    try { submit = tools.find((t) => t.terminal); } catch { /* */ }
    let evidenceFile = 'src/index.js';
    let evidenceLines = null;
    let snippet = null;
    try {
      const files = await call('list_files', {});
      const sourceFile = (files.files ?? []).find((f) => /\.(js|ts|py|go|rs|java|rb|php)$/.test(f.path)) ?? (files.files ?? [])[0];
      if (sourceFile?.path) evidenceFile = sourceFile.path;
    } catch { /* */ }
    try {
      const read = await call('read_file', { path: evidenceFile, start: 1, end: 8 });
      const lines = (read?.lines ?? []);
      if (lines.length) {
        evidenceLines = [lines[0].line, lines[lines.length - 1].line];
        snippet = lines.map((l) => l.text).join('\n');
      }
    } catch { /* */ }
    if (submit) {
      await submit.execute({
        findings: [{
          title: 'Mock investigation finding: input validation gap',
          category: 'security', severity: 'medium', confidence: 0.65,
          file: evidenceFile, lines: evidenceLines ?? [1, 8], snippet,
          description: 'Scripted autonomous-mode finding: cites lines that were actually read via read_file, so it passes evidence validation. One bogus finding is included too.',
          suggestion: 'Validate and normalize all external input at this boundary.',
          benefit: 'Closes an injection/robustness gap.',
          risk: 'Low.',
        }, {
          title: 'Mock finding with fabricated location (unverified by design)',
          category: 'bug', severity: 'low', confidence: 0.5,
          file: 'made/up/path.js', lines: [5, 9], snippet: 'definitely not in the repository',
          description: 'Should appear in the report marked unverified.',
        }],
        notes: 'Mock autonomous investigation finished.',
      });
      toolLog.push({ step: toolLog.length + 1, name: submit.name, ok: true, ms: 0, summary: 'submitted 2 findings' });
    }
    return {
      text: 'Mock investigation complete.',
      finishReason: 'submitted',
      steps: toolLog.length,
      toolLog,
      usage: { inputTokens: 500, outputTokens: 80 },
    };
  }
}

function extractFirstPath(text) {
  const m = text.match(/^# --- (.+?) /m) ?? text.match(/(?:^|\n)\s*`?([\w./\\-]+\.(?:js|ts|tsx|py|go|rs|java|rb|php|cs))`?/);
  return m ? m[1].replace(/\\/g, '/') : null;
}

/** Pull the first excerpt header + its first non-empty code line from a
 *  context pack, so mock drafts can carry verbatim, verifiable snippets. */
function extractFirstExcerpt(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  let header = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^# --- (.+?) --- /);
    if (m) {
      header = m[1].replace(/\\/g, '/');
      for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
        const t = lines[j].trim();
        if (t && !t.startsWith('#') && !t.startsWith('===')) {
          return { file: header, firstLine: t };
        }
      }
      return { file: header, firstLine: null };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createAdapter(profile) {
  if (profile.adapter === 'mock' || profile.provider === 'mock') return new MockAdapter(profile);
  if (profile.adapter === 'native') return new NativeAdapter(profile);
  if (profile.adapter === 'ai-sdk') return AiSdkAdapter.create(profile);
  // 'auto': prefer the Vercel AI SDK when installed, else native HTTP.
  try {
    return await AiSdkAdapter.create(profile);
  } catch (e) {
    if (e instanceof ModelCallError && /not installed/.test(e.message)) {
      return new NativeAdapter(profile); // graceful degradation, zero deps
    }
    throw e;
  }
}
