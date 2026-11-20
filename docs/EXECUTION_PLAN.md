# Code Audit — Autonomous Execution Plan

**Companion to:** [`ROADMAP.md`](../ROADMAP.md) (canonical status/gates) ·
**Source directive:** `docs/ROADMAP-SOURCE-2026-11-20.md` (verbatim master roadmap)
**Prepared:** 2026-11-20 · **Baseline:** `code-audit@0.2.2`, `main @ e2105baf`, A1–A20 green (175/175), Ubuntu CI green (Node 20/24)
**Purpose:** every task needed to carry the project from v0.2.2 through M1–M5, laid out so an executing agent can run the whole program **without further prompting**, pausing only at the registered user checkpoints (§8) or genuine emergencies.

---

## 0. Operating contract

### 0.1 What "done" means for a task

Every task in this plan completes with **all six** (the master roadmap §5 requirements):

1. **Code or content change** — smallest coherent diff, conventional commit message.
2. **Failing-before / passing-after reproduction** — for defect fixes, the new negative test must be demonstrated failing against the pre-fix build (a temporary worktree at the pre-fix commit is fine), then passing after.
3. **Acceptance test added** to `test/smoke.mjs` (or a dedicated `test/*.mjs` wired into `npm test`) that stays green forever.
4. **Independent replay** — a fresh subagent that receives only the reproduction instructions (never the fix notes) confirms the defect reproduces pre-fix and is gone post-fix.
5. **Documentation changed** — README / ROADMAP / phase report as applicable.
6. **Release decision recorded** — version bump (semver), tag, and the gate row in `ROADMAP.md` updated with evidence links.

### 0.2 Autonomy rules

- **AUTO** tasks: execute without asking. Includes: code, tests, docs, commits, pushes, GitHub releases via `gh`, CI configuration, OSS repo cloning at pinned commits, local Ollama usage, benchmark runs on OpenRouter **free-tier** models only, `.env` scaffolding.
- **USER CHECKPOINTS (§8)**: the only planned stops. At a checkpoint, prepare everything so the user's step takes ≤10 minutes, then continue other non-dependent work while awaiting their response.
- **ESCALATE IMMEDIATELY** (interruption is allowed): any new P1-class data-exposure escape; any operation that would cost money (paid models, subscriptions — free tier only); destructive git operations (force-push, history rewrite on `main`); a CI failure whose cause can't be reproduced locally within one working session; discovery that a committed artifact contains real credential material.
- **Never:** modify audited application source outside this repository; publish to npm (deferred to U4); run paid API calls; disable secret-scanning push protection without re-enabling it in the same session.

### 0.3 Working conventions

- Work on `main` in `E:\code\code-review-main`. One commit per task; `npm test` must be green **before every push**; CI must stay green on every push.
- Version policy: patch bumps for security/reliability fixes (`0.2.3` for M1), minor for features, tagged `git tag -a vX.Y.Z` + `gh release create` with notes at each milestone.
- Milestone evidence lives in `docs/phase-reports/M<N>.md`; benchmark raw data in `docs/benchmark/data/…` (see §9).
- Known environment quirks (all hit before, all solved): PowerShell aliases `curl`→`Invoke-WebRequest` (use `curl.exe`); pipes into `bash` mangle LF→CRLF (download then run); em-dashes/long quoted strings can trip the portable shell scanner (write message files, use `-F`); git needs `safe.directory` for `E:` (already set); GitHub push protection flags our synthetic corpus (owner-approved; use the unblock flow if a NEW synthetic format ever trips it); push protection can also match **empty or placeholder assignment lines** like `OPENROUTER_API_KEY=` — in example/doc files, describe keys in prose instead of writing `NAME=value` shapes; `Select-Object -First N` on a live CLI pipe can kill the writer mid-stream (redirect to file instead).

### 0.4 Verification oracle

The offline acceptance suite is the regression oracle: **`npm test` (~175 checks, fully offline)**. It must pass at every commit. Real-model quality is **not** claimed by it; that is M2's separate benchmark.

---

## 1. Environment, tools, references

| Need | Tool / location |
|---|---|
| Runtime | Node 24.16 local (`node --version`), engines `>=18.17` |
| Repo | `E:\code\code-review-main`, remote `AccurateTLM13/code-review-main` (gh authenticated, `repo`+`workflow` scopes) |
| CI | `.github/workflows/ci.yml` — ubuntu, Node 20/24, `npm test` + read-only self-check |
| Cloud models | OpenRouter free tier; key via **`.env`** (auto-loaded by `src/cli.mjs`; `.env.example` scaffolded; `.env` git-ignored) |
| Local models | Ollama at `http://localhost:11434/v1` (probe via `/api/tags`) |
| GitHub web flows | browse (paired; drives the user's Chrome) — login-gated pages need the user's session |
| Package validation | `npm pack` → tarball install in a temp dir |
| Independent replay | fresh `subagent` per §0.1(4) |

**References (verified during v0.1–0.2 work unless noted):**

- Vercel AI SDK v7: <https://ai-sdk.dev/docs/ai-sdk-core/generating-text>, <https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling>, <https://ai-sdk.dev/providers/openai-compatible-providers> — `generateText`, `tool()` + `jsonSchema()`, `stopWhen`, `createOpenAICompatible(...).chatModel(id)`.
- OpenAI chat-completions wire format: <https://platform.openai.com/docs/api-reference/chat> (the native adapter implements this subset).
- Ollama OpenAI compatibility: <https://github.com/ollama/ollama/blob/main/docs/openai.md>.
- OpenRouter free-model discovery: <https://openrouter.ai/api/v1/models> (filter `pricing.prompt === "0"`; tool-support flag).
- Node `worker_threads` (A23): <https://nodejs.org/api/worker_threads.html> — `terminate()` gives a hard wall-clock bound. Background on safe-regex alternatives: RE2 (`github.com/uhop/regex-re2`) — rejected to stay zero-dependency; worker+deadline chosen.
- Node `.env` loading: <https://nodejs.org/api/process.html#processloadenvfilepath> (feature-detected in `src/cli.mjs`).
- GitHub push protection bypass (only if a NEW synthetic format trips it): <https://docs.github.com/code-security/secret-scanning/working-with-secret-scanning-and-push-protection/working-with-push-protection-from-the-command-line>.
- Release hygiene: <https://semver.org>, <https://keepachangelog.com>, `npm pack` docs <https://docs.npmjs.com/cli/commands/npm-pack>, GitHub security policies <https://docs.github.com/code-security/getting-started/securing-your-repository>.
- Internal evidence baseline: the three independent reviews (A1–A10, A11–A17, A18–A20 cycles) and the master roadmap's defect reproductions — all reproductions in this plan derive from them.

---

## 2. M1 — Close security & reliability escape paths · `v0.2.3` · **RELEASE BLOCKER — RUN FIRST**

> Directive: implement **only** A21–A23. No dashboard, no MCP, no new audit categories, no refactoring. Keep CLI/report contracts stable.

### M1.1 — A21: one boundary for every model-facing tool result `[AUTO]`

**Defect (reproduced against 0.2.2):** a registered token embedded in a *filename* reaches the model via unredacted `path` fields in `read_file` and `search_code` results (other routes were fixed in A19; these two were missed).

**Pre-made design:**
1. **Single serialization gate.** In `src/engine/tools.mjs`, wrap every tool's return value in one helper:
   `emit(name, payload)` → `payload = redactDeep(payload, redactor)` → `assertNoRegisteredSecret(JSON.stringify(payload), redactor, \`tool result: ${name}\`)` → return. Replace all per-field manual redaction inside tools with plain payloads passed through `emit` (redaction/limits still applied to file content while building the payload — e.g. line caps — but the boundary check is centralized and fail-closed).
2. **Opaque file handles.** The toolkit gains `state.handles = Map(rel → 'f1','f2',…)` allocated lazily by `list_files`/`get_summary` (and any tool that returns paths). Every returned path field is accompanied by `handle`. `read_file`/`get_graph` accept **`handle`** (preferred) or `path`. `submit_findings` accepts `file` as a handle or a raw rel; the toolkit resolves handles → real rels and stores **both** on the draft (`file` = redacted rel for output, `_resolvedRel` = real rel, internal-only). `runAutonomousInvestigation` returns the handle map; `validateDrafts` resolves `_resolvedRel` (falling back to `file`) for evidence checking. Model-visible surfaces carry only handles/redacted paths; evidence verification uses the real rel. This keeps redacted-name files **fully referenceable** — the master roadmap's preferred property.
3. Prompts (`src/engine/prompts.mjs`, autonomous section) updated: "files are referenced by `handle` (`f1`, …); cite `handle` in `submit_findings.file`".

**Acceptance A21 (new suite section `[24]`):** temp repo with a registered token in a filename (reuse the A19 fixture); assert `read_file`/`search_code` (literal+glob)/`get_graph`/`list_files`/`get_summary` payloads contain the placeholder and never the raw token; assert the model can still cite the file via handle → a `mock` deep scan produces a **verified** finding on that file; assert fail-closed: a synthetic payload containing a registered literal makes `emit` throw without literal material in the error.

### M1.2 — A22: device-local means loopback `[AUTO]`

**Defect:** `isLocalEndpoint` (src/util/model-access.mjs) trusts `.local`/`.localhost` suffixes, `host.docker.internal`, and `0.0.0.0` — none of which guarantee the traffic stays on this device (mDNS/LAN aliases resolve off-device; `0.0.0.0` binds all interfaces).

**Fix (pre-made):** trusted set = **loopback only** — `localhost`, `127.0.0.0/8` (test `hostname` starts with `127.`), `::1`, `[::1]`. Everything else — including `*.local`, `*.localhost`, `host.docker.internal`, `0.0.0.0`, LAN IPs, bare hostnames, unparseable URLs — is **remote** for the sensitive-file override (`allowSecretFileReads` ⇒ requires `allowSecretFileReadsRemote`). No behavior change for model calls themselves (only for the secret-file override trust decision); egress labels update accordingly (`meta.models[].egress`).

**Acceptance A22 (`[25]`):** `isRemoteEgress` returns true for `{host.docker.internal}`, `{192.168.1.5}`, `http://myserver:11434`, `http://0.0.0.0:11434`, `http://foo.local:11434`, and a garbage baseUrl; false only for `localhost` / `127.0.0.x` / `::1`. CLI negative: override enabled + `host.docker.internal` profile → exit 2 with the remote-acknowledgment message, before any request.

### M1.3 — A23: bounded regex searches `[AUTO]`

**Defect:** `search_code({isRegex:true})` compiles a model-authored `RegExp` on the main thread — catastrophic backtracking hangs the process and defeats all budgets/timeouts.

**Fix (pre-made):** `src/util/regex-worker.mjs` + host wrapper `runBoundedRegexSearch({source, flags, files, deadlineMs=500})` using `worker_threads`:
- The worker receives `{source, flags, files:[{rel, lines[]}]}` (payload cap: 4,000 files / ~8 MB — beyond that, scan a prefix and report `coverage: 'partial'` honestly in the result).
- **Canary first:** the worker tests the pattern against synthetic worst-cases (`'a'.repeat(48)`, `'a'.repeat(48)+'b'`, a 48-char mixed string) with a 100 ms budget; canary timeout → immediate rejection.
- Hard deadline on the whole call via `worker.terminate()`; timeout → `{ error: 'regex exceeded its time budget; simplify the pattern or use a plain substring search' }`.
- Non-regex searches stay on the main thread (no backtracking risk). The toolkit's tool-call/read budgets charge the same as before.

**Acceptance A23 (`[26]`):** pathological patterns (`(a+)+$`, `(a|aa)+c`) against a fixture containing `'a'.repeat(40)` lines — the call returns the budget error within the deadline, the process stays responsive (a follow-up normal tool call succeeds), total call < 2 s; positive control: a sane regex still returns matches; plain-substring search unaffected.

### M1.4 — Regression & self-check `[AUTO]`

- Append `[24]`–`[26]` to `test/smoke.mjs`; renumber the trailing CLI/read-only section.
- Failing-before proof: run the three new sections against the pre-fix commit (`git worktree add` at `e2105baf`) — all must FAIL there, PASS after.
- Confirm: A1–A20 all still green; read-only hash guarantee still green; cancellation tests still green.

### M1.5 — Independent replay `[AUTO — fresh subagent]`

Give a fresh subagent only the three reproductions from the master roadmap (A21 filename→read_file/search_code leak; A22 `.local` trusted; A23 regex hang) plus the post-fix tree. It confirms: no reproduction succeeds, and it adversarially probes **adjacent** routes (get_graph payload, list_files paths, submit_findings echo) for the same class of escape. Any new finding → fix within M1 (same class, same patch); a genuinely new *class* → ESCALATE per §0.2.

### M1.6 — Docs & release `[AUTO]`

- README: security layers section gains A21–A23 wording (tool-result boundary + handles; loopback-only trust; bounded regex).
- `ROADMAP.md`: gate rows A21/A22/A23 → **PASS** with evidence links.
- `docs/phase-reports/M1.md`: tasks, reproductions, replay results, residual risk ("redaction heuristics still cannot guarantee arbitrary-secret detection").
- Version `0.2.3`; commit; `npm test`; push; watch CI green; `git tag -a v0.2.3` + `gh release create v0.2.3` with notes.

**Gate M1 (must all hold):** zero A21–A23 reproductions; `npm test` exit 0; no source-tree modifications beyond documented `.code-audit` output; no unmitigated P1 access/egress issue.

---

## 3. M2 — Prove the reviewer is useful · first real-model benchmark `[AUTO up to U2]`

> Models: **two distinct OpenRouter free-tier models** (user decision U1). Key arrives via `.env` (scaffolded in this commit; the user drops it in — no key is ever committed). Budget: free tier only; if rate-limited, back off and retry with spacing (429s are normal on `:free` — retry up to 5× with 30–120 s jitter; record the throttling in the run log).

### M2.1 — Key & model selection `[AUTO once .env has the key]`

- Verify: `node bin/code-audit.mjs models` shows `openrouter ✓ set` and probes `/v1/models`.
- Selection rubric (recorded in the benchmark report): from <https://openrouter.ai/api/v1/models> filter `pricing.prompt === "0"`; require tool-calling support and context ≥ 32k; pick **two distinct families**, preferring coding-rated models. Defaults if available: `qwen/qwen3-coder:free` and `deepseek/deepseek-chat-v3.1:free` — otherwise the two highest-capability free coder models present. Profiles: `bench-a`, `bench-b` (`adapter: native`, generous `contextChars`, `maxSteps: 28`, temperature 0.2). If `.env` has no key when M2 starts, do every non-dependent M2 task (M2.2–M2.4) and pause at the first live call (checkpoint U2-pre: "drop the key in `.env`").

### M2.2 — Ground truth for the labeled corpus `[AUTO]`

Write `docs/benchmark/vulnerable-corpus-truth.md`: one row per planted defect in `examples/vulnerable-app` — {id, file, lines, category, expected-severity, note} — enumerated by reading the fixture **content** (not by running the tool). Also `docs/benchmark/clean-corpus.md` describing `examples/clean-app` as the zero-defect reference (expected findings: 0).

### M2.3 — Real non-sensitive repositories `[AUTO]`

Clone at pinned commits into `docs/benchmark/data/repos/` (git-ignored except the pin manifest): primary `expressjs/express` @ tag `v4.19.2`; secondary `jprichardson/node-fs-extra` @ a pinned recent tag. Record a `pins.json` (repo, url, commit) for reproducibility. No user code is involved.

### M2.4 — Benchmark harness `[AUTO]`

- `test/benchmark-run.mjs` (dev-only; not part of `npm test`): runs `scan` per {model × corpus × depth} with N repetitions (standard ×2, deep ×1 — record instability), saving `report.json` to `docs/benchmark/data/<run>/<model>/<corpus>/<depth>-r<n>.report.json`, plus `environment.json` (model ids/versions from `/v1/models`, timestamps, budgets).
- `test/benchmark-analyze.mjs`: computes per model/corpus — citation correctness (100% target for verified/adjusted), precision on P0/P1 (mechanical vs ground truth for the labeled corpus; rubric-adjudicated for the real repos), recall vs the truth table, runtime, token usage/cost (free → $0, still record tokens), coverage/skipped counts. Outputs `docs/benchmark/data/<run>/METRICS.md`.
- Leak sweep: before committing any artifact, grep every saved file for all corpus-planted tokens + the `.env` key name pattern — zero matches required.

### M2.5 — Execute the matrix `[AUTO]`

2 models × 3 corpora (clean / labeled / express) × (2×standard + 1×deep) = **18 runs**, sequential, each with `--timeout 20`. Also 1× `--changed` sanity on the express clone (touch one file → delta audit). Record every failure mode honestly (429 throttle, malformed JSON, empty responses) — failures are data, not surprises.

### M2.6 — Adjudication `[AUTO + human sign-off at U2]`

- Labeled corpus: TP = finding matches a truth row (same file/line ±5, same category); FP = otherwise. Missed-planted = truth rows never matched.
- Real repos: adjudicate every finding by reading the cited code (rubric in `METRICS.md`: correct? already known/documented? actionable? severity fair?). Borderline list → `docs/benchmark/borderline.md` for the user's U2 review.

### M2.7 — Targets & verdict `[AUTO → U2 sign-off]`

Apply the master roadmap's proposed thresholds (citation 100%; P0/P1 precision ≥85% *with denominator*; planted-defect recall ≥80% with missed list; 0 leakage; 0 source modifications; runtime/cost recorded; usefulness judgment). **If precision is poor, improve analysis (prompts/checks/patterns), not the UI.** Iterate within M2 (up to 3 improvement rounds) before reporting.

### M2.8 — Report & checkpoint U2

`docs/benchmark/REPORT.md`: methodology, environment, per-model tables, instability notes, triage of failures, limitations. Commit data (leak-swept). **Present to the user for adjudication sign-off** (their step: skim REPORT.md + borderline list, approve or direct changes). Development continues on non-dependent M3 tasks while awaiting.

---

## 4. M3 — Personal-ready release · usable on your own projects `[AUTO up to U3]`

### M3.1 — Clean-checkout install on Windows `[AUTO]`

Fresh `git clone` into `%TEMP%`, `npm ci`, `npm test`, `node bin/code-audit.mjs scan <fixture>`, `npm link` then `code-audit --version` from another directory. Record exact commands + outputs in the phase report.

### M3.2 — First-run UX pass `[AUTO]`

Exercise and fix copy/behavior for: `init` (scaffolds config, says what to edit next), `models` (probing, per-profile troubleshooting line when unreachable/key missing), `help` (quick start first), every error message produced during M3.4's failure matrix (must name the next action). Add acceptance checks for the three commands' core promises.

### M3.3 — Coverage honesty `[AUTO]`

Extend discovery/report: `meta.coverage` = {sourceFilesScanned, textFilesSeen, skippedBinary, skippedLarge (size), walkTruncated (bool), unsupportedLanguages: [lang counts]} and a Markdown "Coverage & limitations" section stating what was **not** inspected. Tests: fixture with a large binary + oversized file + >12k-file repo (generated) → report shows the counts and never claims full coverage.

### M3.4 — Fail-safe matrix `[AUTO]`

Table-driven tests (`test/failsafe.mjs`, wired into `npm test`): empty repo; repo of only binaries; inaccessible subdirectory (created with ACLs, skipped where the OS forbids); symlink loop (bounded walk, no hang); repo over file cap (truncation warning + coverage note); malformed model output (already covered — keep); endpoint offline mid-run; cancellation (already); unsupported-language repo (clear "nothing reviewable" report); git repo, `--changed`, zero changes (already). Each: bounded exit, honest report, exit code per contract, no hang, no crash.

### M3.5 — `--changed` on a real repo `[AUTO]`

On the express clone (real git): baseline audit → modify one file → delta audit lists only it → delete a file → deletion detected → no-change rerun → 0 findings. Record in the phase report.

### M3.6 — Pilot audits + report usefulness `[AUTO]`

Full `--depth deep` audit of the express clone with both benchmark models; read the Markdown report end-to-end; disposition every false positive or incorrect location in `docs/phase-reports/M3-pilot.md`.

### M3.7 — Personal-ready docs `[AUTO]`

README additions: tested Node versions + OS (Windows 11 local + CI matrix), provider setup for Ollama/OpenRouter, report/state locations, `.env` key handling, coverage/limitations statement, `--changed` workflow.

### M3.8 — Checkpoint U3 (user, ≤10 min)

`docs/m3-validation-script.md`: three commands to run on each of two own non-sensitive repos (`code-audit scan . --models <their profile>`, open the report, mark 3 findings actionable/not). The user's verdict decides the gate: "install and run on two of your own projects, understand and act on the report, repeat reliably."

**Gate M3:** clean-checkout works on Windows; failure matrix bounded and honest; pilots dispositioned; U3 approved. Not a cloud-safety claim — privacy posture unchanged (cloud is opt-in, informed).

---

## 5. M4 — Public open-source CLI beta `[AUTO up to U4]`

### M4.1 — Consumer package validation `[AUTO]`

`npm pack` → verify tarball contents against `files` field (bin, src, rules, README, example config) → install the tarball into a clean temp project (`npm i <tarball>`) → `npx code-audit --version`, `scan <fixture>` quick, `models` help → assert rules/ + docs present. Add `test/package-consumer.mjs` (dev-only is fine; document the manual steps if it can't run fully offline from the registry).

### M4.2 — Cross-platform CI `[AUTO]`

Extend `.github/workflows/ci.yml`: matrix {ubuntu, windows, macos} × {Node 20, 24}. Known watch-items: Windows spawn quirks (already handled via `windowsHide`/shell policy), localhost mock servers on CI runners (127.0.0.1 works), `npm ci` on each OS. Keep the workflow fast (<10 min/job); cache npm.

### M4.3 — Community & security docs `[AUTO]`

- `SECURITY.md`: supported versions, disclosure contact/process, supported-vulnerability window, **cloud-model privacy limits** (what leaves the machine, heuristic redaction is not comprehensive protection), secret-file policy.
- `CONTRIBUTING.md`: setup, acceptance-suite-is-the-gate rule, branch/commit conventions, how to add checks/rules, negative-test requirement for security fixes.
- `.github/ISSUE_TEMPLATE/bug_report.md` (+config): reproducible bug reports must include CLI version, OS, Node, profile (redacted), and `--quiet` output; `feature_request.md`.
- Data-handling statement (README §Security already strong — link it from SECURITY.md); confirm **no telemetry** exists (grep for fetch usage outside adapters), document `.code-audit` deletion for report/state removal.

### M4.4 — Dependency & release hygiene `[AUTO]`

`npm audit` (must be clean or each item dispositioned); pin Actions to full commit SHAs (policy noted in SECURITY.md); `CHANGELOG.md` (keepachangelog, seeded from the phase reports); release automation: `gh release create vX.Y.Z --generate-notes` with the tarball attached (GitHub Releases path — npm publish remains U4).

### M4.5 — Publish benchmark methodology + representative numbers `[AUTO]` (from M2/M3 data, marked as engineering targets with denominators).

### M4.6 — Public docs polish `[AUTO]`

README quick start for Ollama **and** OpenRouter; first audit walkthrough; report reading guide (priorities, consensus, verification statuses, dismissed group, cross-file labels, coverage section); CI integration example; limitations section. Verify every documented command runs as written.

### M4.7 — Beta feedback scaffolding `[AUTO]`

`gh` labels for bug/precision/provider/docs; a `docs/beta-notes.md` triage rubric (fix high-impact issues rather than adding categories); issue templates cross-linked.

### M4.8 — Checkpoint U4 (user, ~5 min)

Everything above is validated from the tarball; **the user runs `npm publish`** (their npm account) or instructs GitHub-Releases-only. Agent provides the exact command + final pre-publish checklist.

**Gate M4:** a new developer can install from the release package, run an offline quick scan, configure one documented model, and interpret a report unassisted; no release-blocking safety/correctness issues; beta limitations explicit.

---

## 6. M5 — Stable public CLI v1.0 `[AUTO up to U5]`

- **M5.1 Compatibility policy** (`docs/COMPATIBILITY.md`): semver for CLI flags/exit codes; `schemaVersion: 1` JSON contract with documented field-level stability (additive changes only within 1.x; a future 2 gets a migration note); deprecation windows.
- **M5.2 Benchmarks vs targets** across representative repos (re-run M2 harness on any improved engine; publish weak areas and model-dependent outcomes).
- **M5.3 Matrix & automation**: full CI matrix green; release automation + documented rollback/unpublish guidance.
- **M5.4 Observability audit**: exit codes 0/1/2 verified everywhere; bounded failures; diagnostic logging without secret material (grep the logger paths); partial-report labeling (aborted runs say so — already implemented in A7).
- **M5.5 Blocker sweep**: re-run the full acceptance suite + independent adversarial subagent pass over the security boundary (one final class-escape hunt); fix P0/P1 only.
- **M5.6 Maintenance policy** (`docs/MAINTENANCE.md`): release cadence, bug triage SLAs, vulnerability response, compatibility windows, ownership.
- **M5.7 Checkpoint U5 (user)**: one external developer (user-recruited) reproduces getting-started + report interpretation from docs alone, without author help. Provide the user a ready-to-share validation checklist.
- Version `1.0.0`; tag; release notes summarizing gates + evidence links.

**Gate M5 / Definition of Done:** standalone CLI, safe by documented default behavior, reliably auditable, model-agnostic within verified provider contracts, demonstrably producing useful evidence-backed findings. Public-use end point for the current scope.

---

## 7. Optional backlog — explicitly NOT scheduled

Per the master roadmap §4 — consider only after M3, on demand, none block 1.0: MCP server/thin wrappers; PR-comment/GitHub Actions review integration; approval-gated refactoring **proposals**; HTML report viewer/trends; more language packs (benchmark-evidence-driven); multi-agent orchestration (only if measurably better). A hosted SaaS remains a separate product decision.

## 8. User checkpoint register (the only planned interruptions)

| ID | When | User's step (target ≤10 min) | Status |
|---|---|---|---|
| U1 | done — 2026-11-20 | Models (2 free OpenRouter), publish (tarball, user publishes), pilots (OSS + gate validation) | ✅ answered |
| U2 | end of M2 | Drop `OPENROUTER_API_KEY` into `.env` (if not already); skim `docs/benchmark/REPORT.md` + borderline list, approve/redirect | pending |
| U3 | end of M3 | Run the 10-minute validation script on two own repos; verdict | pending |
| U4 | end of M4 | Run `npm publish` (or choose GitHub-Releases-only) | pending |
| U5 | end of M5 | Share the getting-started checklist with one external developer; confirm reproduction | pending |

**ESCALATE-immediately conditions** (outside checkpoints): §0.2 list — new P1 data-exposure escape; money; destructive git ops; unreproducible CI red; real credential material discovered in any artifact.

## 9. Evidence & artifact conventions

```
docs/
  phase-reports/M1.md …            # per milestone: tasks, proofs, replay results, gate checklist
  benchmark/
    vulnerable-corpus-truth.md     # labeled ground truth
    pins.json                      # OSS repo pins
    data/<run>/                    # raw report.json + environment.json (leak-swept before commit)
    METRICS.md, REPORT.md, borderline.md
ROADMAP.md                          # canonical gate table + status (root)
CHANGELOG.md                        # added in M4, seeded from phase reports
```

Every `npm test`-green commit is pushable; every milestone ends tagged + released with evidence links in `ROADMAP.md`.

## 10. Pre-made decision log

| # | Decision | Rationale |
|---|---|---|
| D1 | A21 fix = centralized `emit()` serializer + opaque handles | Master roadmap's preferred property: files stay referenceable after path redaction; one fail-closed boundary instead of N hand-redacted fields |
| D2 | A22 fix = loopback-only trust (no `.local`/docker alias/0.0.0.0) | "Device-local means loopback" — mDNS/LAN/docker-gateway aliases can leave the device |
| D3 | A23 fix = worker_threads + canary + hard terminate deadline (not RE2) | Stays zero-dependency; `terminate()` is a true wall-clock bound; canary rejects obvious pathologies before scanning |
| D4 | M2 models = two distinct OpenRouter free-tier families | U1 answer; zero cost; both may be cloud per roadmap; free-tier throttling recorded as data |
| D5 | Keys via `.env`, auto-loaded, git-ignored, `.env.example` scaffold | U1 answer ("I will add it safely there") |
| D6 | M3 pilots on pinned OSS repos; user validates own repos at U3 | U1 answer; reproducible, no proprietary code touched |
| D7 | npm publish deferred to U4; tarball validation is the M4 gate | U1 answer |
| D8 | Direct-to-main with per-task commits + milestone tags; suite green before every push | Single-maintainer velocity with CI as the gate; every claim still independently replayed via subagent |
| D9 | Security-patch discipline: fixes only with a new negative test; no open-ended hardening loops | Master roadmap §6: targeted adversarial tests catch classes, not endless patch cycles |
