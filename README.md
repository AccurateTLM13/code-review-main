# code-audit

> **Note on synthetic credentials in this repository:** every credential-like string in `examples/`, `test/`, and `src/` fixtures (AWS-style, GitHub PAT-style, Stripe-style tokens) is **synthetic and planted on purpose** — they are the labeled corpus for the secret-redaction acceptance suite (A4, A11, A12, A18, A19). GitHub's secret scanning flags them; all alerts are expected false positives. The tokens have never been valid.

**A standalone, model-agnostic Code Audit Agent.** Point it at any local repository; it runs deterministic checks, optionally brings in an AI model to evaluate and investigate, and writes a prioritized, evidence-verified backlog as Markdown + JSON.

```
code-audit scan .
code-audit scan . --focus refactoring
code-audit scan . --depth deep
code-audit scan . --models local,openrouter
code-audit scan . --changed
```

Works from the terminal, VS Code, OpenCode, Antigravity, or any CI runner — it is a plain CLI that never modifies your application code.

---

## Design principles

1. **Read-only.** The audit never writes to your source tree. The only files it creates live in `.code-audit/` (reports + a state manifest). The autonomous agent gets read/search/list tools only — there is no write or execute tool anywhere in its toolkit.
2. **Model-agnostic.** Local (Ollama), free cloud (OpenRouter), paid models, or several at once — behind one profile system. When the Vercel AI SDK is installed it is used automatically; without it, a built-in zero-dependency OpenAI-compatible HTTP client takes over.
3. **Evidence-first — strictly.** A model claim counts as *verified* only when a verbatim snippet matches line-wise inside the cited range. A snippet found elsewhere corrects the citation (status *adjusted*). A file + line range without a snippet is **not** verification. Unverifiable findings are kept, flagged, down-weighted, and quarantined into a "Needs investigation" backlog group — never silently trusted, never silently dropped.
4. **No unilateral or order-dependent dismissal.** Verdicts are reconciled per reviewer fingerprint: a dismiss from one model and a confirm from another → *contested* (visible, never hidden, regardless of arrival order); unanimous dismiss on critical/high/security → *contested*; anything else moves to a visible "model-dismissed" group. Analyzer evidence and full verdict history are always kept.
5. **Secrets never leave the process.** An **unconditional preflight** registers credential-like literals across ALL model-readable files (source, JSON/YAML configs, `.env`) before every audit — independent of `--focus`. Registered literals are replaced with non-reversible, hash-identified placeholders (`[REDACTED aws-key #54c83e8f]`) in every surface: findings, model prompts, tool results, model notes, run metadata, and console output. Credential-shaped **files** (`.env`, `credentials.json`, `*.pem`, `id_rsa*`, …) are denied to models by default (`checks.allowSecretFileReads` opts in, private/local only) and never excerpted. Report serialization is validated **fail-closed**: if a registered literal survives into the report, it is not written and the run fails.
6. **Consensus means independent models.** Findings merge only on precise overlapping spans *plus* textual issue overlap. The `consensus` badge requires two **different actual models** — reviewer identity is a fingerprint of provider + endpoint + model id, so two profile aliases of one model (or one model in both structured and autonomous phases) never count as independent confirmation.
7. **Hybrid by design.** A predictable, cheap structured scan by default; a deeper autonomous investigation when you ask for it. Hard budgets (steps, tool calls, bytes, wall clock) keep every run bounded, and cancellation is enforced across both the native and SDK adapters.
8. **Delta audits are real deltas.** `--changed` scopes finding *generation* to changed files (not just the report metadata). Cross-file context (e.g. a duplication block touching a changed file) is preserved but explicitly labeled `cross-file`; deleted files are detected and reported.

## What it does

| Phase | Depth | What happens |
|---|---|---|
| **Repository discovery** | all | languages, LOC, frameworks/stacks, entry points, import graph (hubs, cycles, orphans), hotspots, manifests |
| **Deterministic checks** | all | secrets & entropy, copy-paste duplication (token-window hashing), size/nesting hotspots, risky patterns (injection sinks, swallowed errors, perf traps), dependency hygiene, debt markers, import-graph signals, optional ast-grep rule pack |
| **Structured model pass** | standard, deep | the deterministic findings + hotspot excerpts go to the model, which returns verdicts (confirm/adjust/dismiss) and new evidence-backed findings |
| **Autonomous investigation** | deep | the model drives a jailed read-only toolkit (`list_files`, `read_file`, `search_code`, `get_graph`, `get_summary`) and submits findings itself |
| **Evidence validation** | standard, deep | cited files/lines/snippets verified against disk; line numbers auto-corrected; unverifiable findings down-weighted and flagged |
| **Merge, consensus & scoring** | all | findings from all passes deduplicated; two+ models agreeing → consensus boost; priority = severity × confidence × focus × consensus |
| **Reports** | all | `.code-audit/reports/<timestamp>/report.md` (executive summary, priority backlog table, per-category detail with snippets, fix/benefit/risk) + `report.json` (schemaVersion 1, CI-friendly) |

Exit codes: `0` clean · `1` findings at/above `--fail-on` severity (CI gate) · `2` runtime error, missing config, cancellation, or all model profiles failed. Fractional `--timeout` minutes are allowed (e.g. `--timeout 0.05` for tests).

## Quick start

```bash
npm install            # optional — the CLI also runs without dependencies
node bin/code-audit.mjs scan . --depth quick     # free, instant, no model

# with your local Ollama model:
node bin/code-audit.mjs scan . --models local --model qwen2.5-coder

# fully offline demo of the whole pipeline (scripted model):
node bin/code-audit.mjs scan examples/vulnerable-app --models mock --depth deep
```

Install as a real command: `npm link` (or `npm i -g .`), then use `code-audit` directly.

## Depths & modes

```
--depth quick      deterministic checks only. No model, no API cost, seconds.
--depth standard  checks + one structured model pass per profile. (default)
--depth deep      standard + an autonomous investigation with the first profile.
```

This is the hybrid architecture: everyday audits stay predictable and cheap; `--depth deep` turns on the investigator for complex codebases. The agent's investigation is bounded by the profile's `maxSteps`, a tool-call cap, a read-byte budget, and the run-level `--timeout`.

## Model profiles

Profiles are defined in `code-audit.config.json` (repo root) or `~/.code-audit/config.json`, and merge over built-in defaults. Run `code-audit init` to scaffold one, `code-audit models` to list and probe them.

| Profile | Provider | Purpose |
|---|---|---|
| `local` | Ollama (`http://localhost:11434/v1`) | private, zero-API-cost audits |
| `openrouter` | OpenRouter (`OPENROUTER_API_KEY`) | broad free/cloud model selection |
| `deep` | OpenRouter, capable model | architecture-level reasoning |
| `multi` | `--models local,openrouter` | cross-check important findings (consensus) |
| `mock` | built-in scripted adapter | offline testing/demo, no server needed |

```jsonc
// code-audit.config.json
{
  "defaultModels": ["local"],
  "profiles": {
    "local": { "provider": "ollama", "model": "qwen2.5-coder", "contextChars": 48000 },
    "openrouter": { "provider": "openrouter", "model": "qwen/qwen3-coder:free", "apiKeyEnv": "OPENROUTER_API_KEY" },
    "lmstudio": { "provider": "openai-compatible", "baseUrl": "http://localhost:1234/v1", "model": "qwen2.5-coder-7b" }
  }
}
```

Any OpenAI-compatible endpoint works. `anthropic`/`google` use their dedicated Vercel AI SDK adapters (`npm install @ai-sdk/anthropic` / `@ai-sdk/google`). Set `"adapter": "native"` on any profile to bypass the SDK and use the built-in HTTP client.

**API keys:** put `OPENROUTER_API_KEY` (or `OLLAMA_HOST`, `CODE_AUDIT_CONFIG`) in a `.env` file in the repository root — the CLI loads it automatically on every run (see `.env.example`; `.env` is git-ignored). Keys loaded this way never appear in reports, prompts, or tool output.

**Small local models:** keep prompts short (`contextChars`), prefer `--depth standard` with a narrow `--focus`, and expect the evidence validator to flag weak citations — that is by design.

## Commands

```
code-audit scan [path]   audit a repository (default: current dir)
  --focus <area>          security|bugs|duplication|performance|refactoring|debt|all
  --depth <level>          quick|standard|deep
  --models <list>          profile names, comma-separated
  --model <id>             override the selected profile's model id
  --changed                only files changed since the last audit (state manifest;
                           falls back to git status on the first run)
  --output <dir>           custom report directory
  --fail-on <sev>           CI gate: exit 1 when findings at/above this severity
  --timeout <min>          wall-clock budget (default 15)
  --max-steps <n>           autonomous step cap
  --no-state               don't update the last-audit manifest
  --quiet | --verbose | --no-color

code-audit models [p]     list profiles, probe endpoints, show installed Ollama models
code-audit last [path]    summarize the most recent report
code-audit init [path]    write an example code-audit.config.json
```

### CI usage

```yaml
# .github/workflows/audit.yml
- run: npm ci && npm link .
- run: code-audit scan . --depth quick --fail-on high
  # or with a model: code-audit scan . --models mock ... (mock works in CI without secrets)
```

`report.json` (`schemaVersion: 1`) is stable and machine-readable for agents and CI.

## Reports

```
.code-audit/
  state.json                # file hashes from the last audit (powers --changed)
  reports/<timestamp>/
    report.md                # human-readable, prioritized
    report.json              # machine-readable
```

`report.md` contains: executive summary → priority backlog table (priority, severity, confidence, category, effort, location) → quick wins → per-category finding cards with code snippets, suggested fix, expected benefit, and regression risk → **Coverage & limitations** (what was and was not inspected) → verification & method (which checks ran, which models, tool call counts, token usage).

The **Investigate further** backlog group lists high-severity findings whose evidence could not be verified — leads, not confirmed defects.

### Reading the report

- **Defects vs maintenance.** Every finding is classified: `defect` (security/bug — a correctness or exploitable-flaw claim) or `maintenance` (duplication/performance/refactoring/debt — quality work). The executive summary leads with the confirmed-defect count (and how many are evidence-verified) so a handful of real defects is never drowned by a mass of observations.
- **High-confidence summary is verified-only.** The "Top priorities" list (console + report) contains only findings whose verbatim snippet matched the cited code. Unverified leads are counted, kept visible in _Needs investigation_, and never presented as confirmed defects.
- **Duplicates are consolidated.** When the deterministic checks and a model report the same defect at the same location, they merge into one finding (sources preserved). Unrelated same-line issues stay separate.
- **Partial audits say so.** If a model phase fails or the run is cut short, the report opens with a ⚠️ **PARTIAL AUDIT** banner naming the failed phases (`meta.partialReasons` in JSON) — the finding set is a floor, not a full review.
- **Coverage is stated, not claimed.** The _Coverage & limitations_ section reports walked/scanned/skipped-binary/skipped-oversized/unsupported-extension counts and walk truncation — the audit never claims it saw everything.

## Supported environments & key handling

- **Tested:** Windows 11 (primary dev environment), Ubuntu CI (Node 20 & 24). `engines: node >=18.17`. The offline acceptance suite passes identically on a fresh Windows clone (verified in M3.1).
- **API keys** come from a local `.env` file in the working directory (auto-loaded by the CLI; `.env` is git-ignored — see `.env.example`). Keys are read into memory only: never written to config files, reports, state, or logs. Cloud use remains opt-in per profile (see _Security & cloud-model policy_).

## The `--changed` workflow

```
code-audit scan . --depth standard      # first run — records .code-audit/state.json
# ...work on your code...
code-audit scan . --depth standard --changed   # audits only files changed since the last run
```

- Findings are scoped to changed files; cross-file context is preserved but labeled, and deleted files are reported.
- No baseline (first run on a repo with no state, no git) → a full scan runs instead and records the baseline (never silently empty).
- On a git repository the manifest and git status agree; the delta test on a real repository (baseline → modify → delta → delete → no-change → 0) is part of the validated workflow.

## Using with agents & editors

- **Terminal / VS Code:** run the CLI; reports land in the repo.
- **OpenCode / Antigravity / other coding agents:** run `code-audit scan .` as a shell command and point the agent at `.code-audit/reports/<ts>/report.json` — the JSON is designed to be consumed directly by agents as a task backlog.
- **MCP server**: not in v1. The adapter/runner split is deliberately arranged so an MCP wrapper (tools: `audit_repository`, `get_latest_report`) can be added without touching the engine.

## Architecture

```
bin/code-audit.mjs
src/
  cli.mjs                  command parsing, models/init/last
  config.mjs               profiles, providers, config precedence
  discovery/               languages · stacks · import graph · repo model
  checks/                  deterministic finding engine + individual checks
  models/adapters.mjs      AiSdkAdapter | NativeAdapter | MockAdapter
  engine/
    runner.mjs             hybrid orchestration (checks → model passes → reports)
    context.mjs            budget-aware context packs
    structured.mjs         findings+context → model verdicts & new findings
    autonomous.mjs         model-driven investigation loop
    tools.mjs              jailed read-only toolkit + budget guards
    prompts.mjs, parse.mjs
  evidence/validate.mjs   snippet/range verification, dedupe, consensus
  report/                  scoring · markdown · json · state manifests
rules/ast-grep/            optional structural rule pack (auto-detected)
test/                      smoke suite, mock server, fixture generator
examples/vulnerable-app/  deliberately flawed fixture repository
```

## Testing — the release gate

```bash
npm test                          # offline acceptance suite (~2 min, no API keys)
node test/mock-server.mjs         # OpenAI-compatible mock endpoint for adapter testing
```

`npm test` is the release gate; it must stay fully green. It covers the acceptance criteria plus transport regression:

| Gate | Proof |
|---|---|
| Wrong-line citations cannot pass verification | cited line ≠ snippet location → *adjusted* with corrected lines, never *verified* |
| Range-only claims are not verification | file+lines without a verbatim snippet → *unverified* |
| Unrelated issues on one line stay separate | "SQL injection" + "XSS exposure" at the same line → two findings |
| One model in two phases ≠ two reviewers | `model:local` + `agent:local` merge without consensus; two profiles get consensus |
| No credential literals in output | planted AWS/GitHub/Stripe values absent from report.md, report.json, prompts, tool results; placeholders present |
| `--changed` is a real delta | unchanged files contribute zero findings; cross-file findings labeled; deletions detected |
| Explicit config wins | defaults < user < repo < `--config`/`CODE_AUDIT_CONFIG`; ignores additive; missing explicit config is an error |
| Cancellation works | `--timeout 0.05` against a slow mock endpoint halts native *and* SDK calls, writes an incomplete report, exits 2 |
| Tool budgets enforced | `read_file` caps at 400 lines on real output bytes; `submit_findings` always allowed after budget exhaustion |
| Benign repo noise floor | `examples/clean-app` (JS + TS + Python) → zero findings |
| Read-only guarantee | SHA-256 of every fixture file identical before and after the whole suite |
| **A11** preflight & boundaries | `--focus refactoring` prompts still redacted; literals registered across js/json/yaml/env; `.env`/`credentials.json` denied to models by default (opt-in honored); no leakage in any tool output |
| **A12** all-surface sanitizer + fail-closed | a mock model echoing registered literals into notes → placeholders in md/json/stdout/stderr; every string-bearing report field sanitized; deep-sanitize unit covers notes/runs/verdicts/benefit/risk |
| **A13** delta reliability | first `--changed` without state/git → full-scan fallback (`changedBasis: full-fallback`) finding the same issues; repeated → 0 after no changes; deletion-only delta still represented |
| **A14** multiline citations | a snippet spilling past `citedEnd` is *moved/adjusted* with true span, never *verified*; blank-line positions preserved |
| **A15** budgets on every tool | `get_graph` and all non-terminal tools blocked at zero budget; `submit_findings` always allowed |
| **A16** verdict reconciliation | dismiss→confirm and confirm→dismiss both end *contested* (order-independent); single dismiss on medium → visible group; critical/security never auto-dismissed; self-contradictory reviewer → contested |
| **A17** model identity | two profile aliases of one model → merged but **no** consensus; two different models → consensus |
| **A18** one access policy | `search_code` (literal/regex/glob), `read_file`, and context excerpts all deny secret-shaped files — an *unrecognized* credential format in `credentials.json` cannot be retrieved by any route; ordinary files remain searchable (positive control) |
| **A19** metadata & boundary | a token embedded in a **filename** is absent from digests, `list_files`, `get_graph`, context packs, reports, and CLI output; the model-request boundary aborts leaking payloads with errors containing no secret material |
| **A20** enforced egress | `allowSecretFileReads` + cloud/unknown profile → rejected with exit 2 **before** discovery or any request; verified-local permitted; explicit `allowSecretFileReadsRemote` acknowledgment required for remote |
| **A21** one tool-result boundary | every model-facing tool result (payloads **and** errors) passes one `emit()` gate — deep-redaction then a fail-closed assertion; a surviving registered literal aborts the call with an error containing no secret material. Files stay referenceable after path redaction via opaque handles (`f1`, `f2`, …) accepted by `read_file`/`get_graph`/`submit_findings` alongside raw or redacted paths; a mock deep scan produces a **verified** finding on a file whose name contains a secret |
| **A22** loopback-only trust | "device-local" for the sensitive-file override means loopback only — `*.local`, `*.localhost`, `host.docker.internal`, `0.0.0.0`, LAN IPs and unparseable endpoints are remote and require the explicit remote acknowledgment (exit 2 before any request) |
| **A23** bounded regex | model-authored regex runs in a worker thread under a host-side hard deadline with a worst-case canary; catastrophic patterns (`(a+)+$`, `(a|aa)+c`) return a budget error in ~0.1 s instead of hanging the process; glob filters (also model-authored RegExp) are canary-checked the same way; a follow-up normal call succeeds |

`examples/vulnerable-app` (JS/TS/Python, planted issues) and `examples/clean-app` (no planted issues) form the labeled regression corpus. Mock models exercise pipeline correctness; the local mock endpoint exercises both transport adapters (native HTTP and the Vercel AI SDK). Real-model accuracy trials come after this gate stays green on a non-sensitive repository.

## Security & cloud-model policy

Auditing a repository with a **cloud model means sending code to a third party**. The tool mitigates this in layers, and every layer is gated by acceptance tests:

1. **Unconditional secret preflight** — registered literals (named key formats, entropy-checked assignments, JSON/YAML/env values) are redacted from all model-bound and report surfaces, regardless of focus.
2. **One cross-tool file-access policy (A18)** — `read_file`, `search_code` (literal/regex/glob), context excerpts, and every content-bearing route apply the same default-deny decision for credential-shaped files (`.env`, `credentials.*`, `*.pem`, `id_rsa*`, …). Redaction is defense in depth; the filename policy is the gate, so *unrecognized* credential formats cannot leak through search either.
3. **All-surfaces sanitization + model-request boundary (A19)** — digests, filenames, excerpt headers, graph paths, finding ids, model notes, and run metadata all pass through the redactor, and a final boundary check refuses to send any payload carrying a registered literal (aborting before the request, with error messages that contain no secret material — only placeholder hashes).
4. **Enforced egress policy (A20)** — `checks.allowSecretFileReads` is honored only for verified-local endpoints (locality is derived from the endpoint, never the profile name). A remote/unknown profile with the override enabled is rejected **before any model request is attempted**; remote use additionally requires the explicit `checks.allowSecretFileReadsRemote` acknowledgment. The CLI reports each profile's egress (`local`/`remote`) in the run summary and JSON.
5. **One tool-result boundary (A21)** — every model-facing tool result passes a single serialization gate: deep-redaction plus a fail-closed assertion that no registered literal survives serialization (a survivor aborts the tool call; the error names the secret only by its safe placeholder hash). Opaque file handles keep files **referenceable after path redaction**: a file whose name contains a registered secret stays findable, readable and citable — the model just never sees the raw name. The same redaction covers CLI stdout: summary report paths and `code-audit last` output are shown through the registry, so a registered literal in a target *directory* name never echoes to the terminal.
6. **Loopback-only endpoint trust (A22)** — "device-local" means loopback (`localhost`, `127.0.0.0/8`, `::1`). mDNS names (`*.local`), `*.localhost` aliases, Docker host aliases (`host.docker.internal`), `0.0.0.0`, LAN addresses and unparseable endpoints are treated as **remote** for the sensitive-file override: the explicit remote acknowledgment is required for them.
7. **Bounded regex execution (A23)** — model-authored regex never compiles-and-runs unchecked on the main thread: it runs in a worker thread under a host-side hard deadline with a worst-case canary, so a catastrophic pattern returns a budget error instead of hanging the process and defeating all timeouts. Glob filters (which also compile to RegExp) are canary-checked with the same mechanism.
8. **Fail-closed output validation** — the rendered report is scanned for registered literals before it is written; a survivor aborts the run instead of leaking.

**Heuristics can miss unknown credential formats.** For sensitive or regulated codebases, keep audits local (`--models local`, Ollama/LM Studio) or treat cloud-model auditing as opt-in per repository. `checks.redactSecrets: false` exists for private local runs where you want unredacted report snippets.

## Config precedence

```
defaults  <  ~/.code-audit/config.json  <  <repo>/code-audit.config.json  <  --config / CODE_AUDIT_CONFIG  <  CLI flags
```

`ignore` patterns are additive across all layers; `profiles`/`checks` deep-merge with later layers winning. A missing explicit config file is a hard error.

## Roadmap (post-v1)

- MCP server for Antigravity/OpenCode/VS Code clients
- Automatic refactoring *proposals* with diffs (still approval-gated; v1 never edits code)
- Web dashboard over `report.json`
- More deterministic checks via community rule packs

## License

MIT
