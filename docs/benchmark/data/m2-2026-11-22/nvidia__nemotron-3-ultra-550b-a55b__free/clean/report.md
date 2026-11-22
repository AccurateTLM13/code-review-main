# Code Audit Report

| | |
|---|---|
| **Repository** | E:\code\code-review-main\examples\clean-app |
| **Branch / commit** | main @ 6d01630 |
| **Date** | 2026-11-22T22:20:53.447Z |
| **Mode** | deep audit · full scan |
| **Focus** | all |
| **Models** | bench-a (nvidia/nemotron-3-ultra-550b-a55b:free, native) |
| **Codebase** | 3 source files · 35 LOC · javascript, python |
| **Findings** | 2 (0 critical / 0 high / 0 medium / 2 low / 0 info) |

## Executive summary

The audit produced **2 findings**, prioritized below. The highest-priority items:

- 🔵 LOW — **Unused production dependency: express** (package.json:14-16, confidence 33%)
- 🔵 LOW — **Test script configured but no test files exist** (package.json:10-13, confidence 32%)

2 finding(s) could not be fully verified against file contents and are marked accordingly — treat them as leads, not confirmed defects.

## Priority backlog

| # | Priority | Severity | Confidence | Category | Effort | Location | Issue |
|---|---|---|---|---|---|---|---|
| 1 | 0.7 | 🔵 LOW | 33% | debt | moderate | `package.json:14-16` | Unused production dependency: express |
| 2 | 0.6 | 🔵 LOW | 32% | debt | moderate | `package.json:10-13` | Test script configured but no test files exist |


### 🔍 Needs investigation (evidence could not be verified)

These are leads, not confirmed defects — the cited code could not be located exactly. Verify manually before acting.

- 🔵 LOW **Unused production dependency: express** — `package.json:14-16` (confidence 33%)
- 🔵 LOW **Test script configured but no test files exist** — `package.json:10-13` (confidence 32%)

## Debt (2)

### 🔵 LOW Unused production dependency: express

**Priority 0.7 · confidence 33% · effort moderate · source agent:bench-a**

> `package.json:14-16`

The package.json declares express 4.18.2 as a production dependency, but no source file imports or uses it. This adds unnecessary install size, potential security surface, and maintenance burden.

> Validation: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

```
"dependencies": {
    "express": "4.18.2"
  }
```

**Fix:** Remove express from dependencies unless it's intended for future use. If needed later, add it when actually used.

**Benefit:** Smaller node_modules, reduced attack surface, cleaner dependency graph.

**Regression risk:** None — the code runs without it.

> ⚠️ Evidence unverified: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

---

### 🔵 LOW Test script configured but no test files exist

**Priority 0.6 · confidence 32% · effort moderate · source agent:bench-a**

> `package.json:10-13`

The package.json defines a test script using Node's built-in test runner (`node --test`), but the repository contains no test files (no *.test.js, *.spec.js, or test/ directory). Running `npm test` will execute but find zero tests.

> Validation: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

```
"scripts": {
    "start": "node src/greet.js",
    "test": "node --test"
  }
```

**Fix:** Either add test files matching Node's test runner conventions (e.g., `src/**/*.test.js`) or remove/update the test script to avoid false confidence.

**Benefit:** Avoids misleading CI passes; encourages actual test coverage.

**Regression risk:** Low — currently a false signal, not a functional bug.

> ⚠️ Evidence unverified: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

---


## Coverage & limitations

- Walked **4** file(s); deterministic analysis covered **3** source file(s), 4 text file(s) in total.
- Standing limitations: static pattern analysis only (no code execution); secret detection is heuristic; the audit does not claim full semantic coverage of the codebase.
## Verification & method

- Evidence validation: **0** verified (verbatim snippet located inside the cited range), **0** adjusted (citation corrected to the snippet's real lines), **2** unverified (kept, flagged, down-weighted), **0** dropped before reporting.
- Verdict policy: model dismissals move findings to a visible "model-dismissed" group; critical/high/security findings are never auto-removed. This run: 0 dismissed, 0 contested.
- Secret handling: credential-like literals matched by the secret scan are replaced with type-preserving placeholders in this report and in all model prompts
- Deterministic checks executed: secrets (0), debt-markers (0), duplication (0), size (0), quality (0), deps (0), graph (0), ast-grep (0).
- Model runs:
  - bench-a (nvidia/nemotron-3-ultra-550b-a55b:free) · structured · native · 2.5s · 752/181 tokens — ok
  - bench-a (nvidia/nemotron-3-ultra-550b-a55b:free) · autonomous · native · 32.7s · 36265/1921 tokens — ok · finished: submitted

### Model notes

> bench-a: No source excerpts were provided for the three files (lib/util.py, src/calc.js, src/greet.js). Without code content, no findings can be verified or created. Static analysis produced no findings. Recommend providing file contents for a meaningful audit.

> bench-a (autonomous): This repository is explicitly described as a "clean fixture" with "no planted issues" — a deliberately minimal, benign codebase used to verify low noise floor in auditing tools. The two findings above are genuine but very minor maintenance/debt observations (unused dependency, missing test files), consistent with a fixture that prioritizes simplicity over completeness. No security, bug, performance, or duplication issues were found in the source code itself.


---
Generated by `code-audit` v0.2.3 — read-only audit; no application files were modified. Exit-code policy: report-only (use --fail-on for CI gates).