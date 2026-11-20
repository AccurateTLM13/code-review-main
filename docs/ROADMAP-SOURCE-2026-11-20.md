# Code Audit Agent — Master Product & Release Roadmap

**Status baseline:** November 20, 2026  
**Repository version inspected:** `code-audit@0.2.2` from `code-review-main(4).zip`  
**Release strategy:** Personal/local use first → public open-source CLI beta → stable CLI release. A hosted SaaS product is a separate future decision.  
**Roadmap status:** Proposed plan, not a claim that uncompleted features have shipped.

## 1. Destination: what “finished” means

**Product statement:** A standalone, model-agnostic, evidence-first code-audit CLI that can inspect a local repository, measure structural/quality risks, ask one or more AI models to investigate, and return an actionable, prioritized backlog **without changing application source code**.

The intended everyday workflow:

1. Run `code-audit scan <repo>` with `--depth quick|standard|deep`, optional `--focus`, `--models`, and `--changed`.
2. Inspect the coverage summary, verified evidence, severity, expected benefit, effort, uncertainty, and suggested validation for each finding.
3. Review a Markdown report, or use versioned JSON in scripts/CI/other agents.
4. Choose which recommendations to implement in a separate coding tool. The auditor does **not** silently rewrite the target repository.

**A successful product is not the one that generates the most warnings. It is the one whose findings are correct, relevant, reproducible, and worth acting on.**

### Three distinct end states

| Release target | For whom | What users can do | Release threshold |
|---|---|---|---|
| **Personal-ready / local alpha** | You and trusted testers on your machines | Audit personal repositories with local models and controlled cloud opt-in on non-sensitive code | Security boundaries A21–A23 fixed; baseline tests green; first real-model trials produce actionable results; installs and reports work on your primary environment |
| **Public CLI beta** | Other developers downloading an npm package / GitHub release | Install, configure providers, audit a repository, understand limitations, report bugs | Personal-ready + cross-platform packaging, onboarding, privacy and security docs, public CI, tested clean installation, basic benchmark published |
| **Stable public CLI (1.0)** | General developer audience | Rely on documented CLI/JSON contracts, reproducible results, predictable failure handling, supportable upgrades | Beta feedback addressed, quality thresholds met, no known release-blocking vulnerabilities, documented compatibility and maintenance policy |

**Not in the current release scope:** Hosted SaaS, repository upload service, user accounts, billing, enterprise multi-tenancy, unattended source-code modification, or a web dashboard.

## 2. What exists today (verified artifact vs. unverified behaviors)

### Present in the latest uploaded repository

- Standalone Node.js ESM CLI (`scan`, `models`, `last`, `init`); `quick`, `standard`, and `deep` audit depths.
- Repository discovery, framework/language detection, imports/graph, deterministic checks, and optional ast-grep integration.
- Model profile abstraction for local/OpenAI-compatible gateways and AI SDK-backed adapters; structured review plus autonomous read-only tools.
- Evidence matching, verdict reconciliation, reviewer fingerprints, prioritized reports, JSON schema version 1, changed-file state manifests, timeout/tool budgets.
- Preflight secret detection, protected-file policy, sanitization, and egress policy added through A1–A20.
- `npm test` offline acceptance suite with A1–A20 and mock transports. Latest independent review reports **175/175 checks passing**. This is **not** a real-model quality result.
- MIT `LICENSE`, `package-lock.json`, and GitHub Actions CI on Ubuntu with Node 20 and 24.

### Confirmed gaps at this baseline

- **A21:** Model-facing tool results can expose a registered token embedded in a filename (`read_file`, `search_code`).
- **A22:** `.local`/non-loopback endpoints can be incorrectly treated as device-local for a sensitive-file-access exception.
- **A23:** Model-generated regex search can hang the Node process and defeat time budgets.
- No A21–A23 acceptance tests in the uploaded build.
- No verified live-model benchmark or manually adjudicated real-repository usefulness study.
- Native MCP server is explicitly postponed in README; CLI is the supported interface.
- No verified Windows/macOS CI matrix or fresh-package consumer installation validation; existing CI is Ubuntu-only.
- No `SECURITY.md`/`CONTRIBUTING.md` in the uploaded top-level project, and no consolidated roadmap before this document.

Do not mark a milestone complete solely because an implementing agent reports success. Require an independent reproduction and a durable test.

## 3. Milestone plan

### M0 — Foundation and offline regression suite | **COMPLETE, subject to remaining defects**

**Output:** Working standalone audit prototype and automated offline tests.  
**Evidence:** Existing CLI, model abstraction, deterministic checks, report pipeline, A1–A20 suite, MIT license, Linux CI.  
**Remaining action:** Preserve current tests; avoid a rewrite.

### M1 — Close security and reliability escape paths | **NEXT / RELEASE BLOCKER**

Deliver **A21–A23** as focused fixes (suggested patch version: `0.2.3`):

- [ ] **A21: One last boundary for every model-facing tool result.** Sanitize complete structured payloads (filenames, nested objects, errors, graph metadata) before returning to model adapters; confirm a file remains referenceable after path redaction, preferably through an opaque handle. Fail closed if a registered literal survives.
- [ ] **A22: Device-local means loopback.** Treat `.local`, Docker host aliases, LAN addresses, `0.0.0.0`, arbitrary hostnames, and uncertain endpoints as remote/untrusted for sensitive-file override. Explicitly acknowledge non-loopback access. Control redirects/DNS behavior where applicable.
- [ ] **A23: Bounded regex searches.** Use a safe regex engine or isolated worker/process with a hard deadline; alternatively disable model-authored regex until safe. Test catastrophic backtracking using an external watchdog.
- [ ] Add A21–A23 to `npm test` and CI; independently replay the exact failing reproductions.
- [ ] Confirm source files are unchanged after audits, secret-leak tests are clean, cancellation remains bounded, and previous A1–A20 checks still pass.

**Gate M1:** 0 known A21–A23 reproductions; `npm test` exits 0; no source-tree modifications except explicitly documented `.code-audit` output; no known unmitigated P1 access/egress issue. **This does not guarantee arbitrary secrets are detected.**

### M2 — Prove the reviewer is actually useful | **FIRST REAL-MODEL BENCHMARK**

Select **at least two live, genuinely distinct models** (one local and one cloud on non-sensitive code is useful, but both may be local). Keep all parameters fixed and record exact provider/model/version, prompt limits, and costs.

Benchmark against:

- [ ] **Clean reference repository:** no intentionally planted defects; quantify noise.
- [ ] **Labeled vulnerable corpus:** known JS/TS/Python defects; evaluate detection and evidence correctness.
- [ ] **Real non-sensitive repository:** enough actual history/architecture to judge refactoring recommendations. Exclude production secrets, credentials, proprietary or regulated code.

For each model, test `standard` and `deep` where feasible; repeat runs enough to expose instability. Save raw JSON reports, adjudication notes, environment, model identifiers, token usage/cost, elapsed time, and coverage/skipped-file counts.

**Proposed benchmark thresholds (initial engineering targets, not established product performance):**

| Measure | Proposed gate |
|---|---|
| Citation correctness | 100% of findings marked verified/adjusted have matching full snippets at stated locations |
| P0/P1 finding precision | ≥85% accepted by manual review on evaluation corpus; report denominator |
| Recall of planted major defects | ≥80% in the labeled corpus; report missed cases |
| Sensitive literal leakage in seeded cases | 0 across prompts, tools, reports, and logs |
| Unauthorized application-source modifications | 0 |
| Run-time/cost | Recorded and bounded; publish representative results instead of making an arbitrary speed claim |
| User usefulness | Findings ranked by impact, with concrete next actions and nontrivial rejected/noisy recommendations documented |

**Gate M2:** At least two real-model results assessed by a human, meaningful recommendations on a real repo, failures characterized and triaged, benchmark data reproducible. **If precision is poor, improve analysis—not the UI.**

### M3 — Personal-ready release | **TARGET: usable on your own projects**

- [ ] `npm install`/`npm link` works from a clean checkout on your Windows 11 environment; avoid reliance on vendor-bundled `node_modules`.
- [ ] First-run setup: `code-audit init`, `models`, help/error messages, endpoint probing and troubleshooting are comprehensible.
- [ ] Sensible provider defaults: local model path supported; cloud execution requires a clear privacy warning and deliberate configuration.
- [ ] Fail-safe behavior for offline endpoints, malformed model output, cancellation, empty repos, massive repositories, ignored files, unsupported languages, symlinks, and inaccessible directories.
- [ ] Audit result explicitly states coverage and what it could **not** inspect; do not overclaim complete coverage.
- [ ] `--changed` baseline and deletion cases tested on a real repository.
- [ ] Markdown/JSON reports useful for prioritizing a real refactor; AI advice consistently separated from deterministic evidence.
- [ ] Small set of real-repo pilot runs, with each false positive or incorrect location recorded and dispositioned.
- [ ] Document tested Node versions, supported OS, provider setup, and report locations.

**Gate M3:** You can install and run a standard audit on two of your own non-sensitive projects, understand and act on the report, and repeat it reliably. Personal-ready does **not** mean it is safe to send private repositories to a cloud model automatically.

### M4 — Public open-source CLI beta | **DISTINCT FROM HOSTING A SERVICE**

- [ ] Test **clean consumer installation** from an npm tarball (`npm pack`), not only a developer checkout; confirm `bin` entry and included rules/docs function.
- [ ] Extend CI to **Windows, macOS, and Linux** with a supported Node matrix; include smoke install/test/package verification.
- [ ] Add `SECURITY.md` (disclosure contact/process, supported versions, cloud-model privacy limits), `CONTRIBUTING.md`, issue templates and reproducible bug-report instructions.
- [ ] Make data-handling policy unambiguous: what leaves the machine, what stays local, known heuristic limitations, whether any telemetry exists (default should be none), and how to delete generated reports/state.
- [ ] Dependency and release hygiene: audit dependencies; use lockfile; pin GitHub Actions to appropriate immutable references or documented policy; review scripts; check published file contents; implement version/release notes.
- [ ] Publish documented benchmark methodology and representative quality numbers; do not call the tool a security scanner certification.
- [ ] Public documentation: quick start for Ollama and OpenRouter, first audit, report guide, limitations, examples, and CI integration.
- [ ] Beta feedback loop: collect reproducible false positives, performance problems, provider incompatibilities, and error-handling failures. Fix high-impact issues rather than adding categories.

**Gate M4:** A new developer can install from the release package, run an offline quick scan, configure at least one documented model, and interpret a report without direct assistance. No known release-blocking safety/correctness issues; beta limitations explicit.

### M5 — Stable public CLI v1.0 | **END POINT FOR CURRENT PRODUCT**

- [ ] CLI arguments and report JSON schema have documented compatibility/versioning policy; changes handled predictably.
- [ ] Real-model benchmarks meet the agreed targets across representative repositories; publish known weak areas and model-dependent outcomes.
- [ ] Dependency and provider integrations tested against supported runtime matrix; automated release workflow and rollback/unpublish guidance documented.
- [ ] Observability: clear exit codes (0/1/2), bounded failure modes, diagnostic logging without exposing secrets, partial/incomplete reports clearly labeled.
- [ ] No unresolved P0/P1 release blockers; confirmed security findings from testing have fixes and regression coverage.
- [ ] Maintenance ownership defined: release cadence, bug triage, vulnerability response, compatibility windows.
- [ ] At least one external developer can reproduce getting-started and report interpretation without project-author help.

**Gate M5 / Definition of Done:** A downloadable standalone CLI that is safe by documented default behavior, reliably auditable, model-agnostic within verified provider contracts, and demonstrably capable of producing useful evidence-backed refactoring/quality findings. This is the **public-use end point** for the current scope.

## 4. Optional features: NOT blockers for personal use or public 1.0

**After M3, based on demand:**

- Antigravity/OpenCode/VS Code integration via an MCP server or thin CLI wrapper.
- PR comment integration / GitHub Actions convenience workflow for review results.
- Diff-based refactoring **proposals** and patch generation, approval gated.
- HTML/web report viewer, cross-run trends, triage status, project history.
- More language packs and analyzers driven by benchmark evidence.
- Multi-agent review orchestration when it measurably improves precision or coverage.

**Separate product decision:** A hosted/cloud service accepting repositories introduces auth, tenant isolation, network isolation, code-retention policy, legal/privacy terms, rate/cost controls, billing and operational incident response. None is required to release a local CLI.

## 5. Canonical release gates and progress tracking

The repository should maintain a single `docs/ROADMAP.md` or `ROADMAP.md` and track issues/PRs against milestone IDs. Each claimed gate requires: (1) code changes, (2) a failing-before/passing-after reproduction, (3) acceptance test added, (4) independent review for security/critical items, (5) documentation changed, and (6) a release decision.

| Gate | Status at baseline | Blocking next target? |
|---|---|---|
| A1–A20 offline acceptance | **PASS** in supplied v0.2.2 review (175/175) | Must remain green |
| A21 tool-result boundary | **FAIL / reproduced** | Yes, M1 |
| A22 endpoint trust | **FAIL / reproduced** | Yes, M1 |
| A23 regex hard deadline | **FAIL / reproduced** | Yes, M1 |
| Live-model reliability | **NOT TESTED** | Yes, M2 |
| Windows personal installation | **NOT VERIFIED** | Yes, M3 |
| Cross-platform public package | **NOT VERIFIED** | Yes, M4 |
| Native MCP integration | **NOT BUILT** | No; optional |
| Public CLI v1.0 | **NOT RELEASED** | M5 |

### Immediate next agent assignment

> Implement **only A21–A23** against the latest `code-audit@0.2.2` branch. First add negative tests reproducing the exact previous findings; patch centralized tool-result serialization and path handles, strict loopback endpoint trust, and bounded regex execution. Keep CLI/report contracts stable. Do not add dashboard, MCP, new audit categories, or automatic refactoring. Run all acceptance tests, run the independent reproductions, document risk/limitations, and return source diff + test results for review. After approval, begin the M2 benchmark plan.

## 6. Guiding decisions

- Standalone CLI **first**, integration adapters later.
- Hybrid deterministic + AI review, but deterministic tooling and evidence lead.
- Model-agnostic does **not** mean identical performance or unlimited model compatibility.
- Privacy by default, cloud model code sharing only with informed opt-in; never claim heuristic redaction is comprehensive protection.
- Reports first; source changes remain outside the auditor for v1.
- Solve measurable usefulness before optimizing interface polish.
- Do not run indefinite security-patch loops: maintain a threat model, centralize trust boundaries, and use targeted adversarial/negative tests to catch whole classes of escapes.

---

**Document owner:** Project maintainer.  
**Last baseline:** November 20, 2026, uploaded build `code-review-main(4).zip`.  
**Next update:** After independently verified A21–A23 fixes. Mark items complete only with specific test/evidence links.
