# Code Audit Report

| | |
|---|---|
| **Repository** | E:\code\code-review-main\examples\clean-app |
| **Branch / commit** | main @ 6d01630 |
| **Date** | 2026-11-22T22:37:57.937Z |
| **Mode** | deep audit · full scan |
| **Focus** | all |
| **Models** | bench-b (baidu/ernie-5.5-flash-preview:free, native) |
| **Codebase** | 3 source files · 35 LOC · javascript, python |
| **Findings** | 3 (0 critical / 1 high / 0 medium / 1 low / 1 info) |

## Executive summary

The audit produced **3 findings**, prioritized below. The highest-priority items:

- 🟠 HIGH — **ESM source files but package.json has no "type": "module" — npm start/test crash** (package.json:1-18, confidence 85%)
- 🔵 LOW — **Reported character count is off by one and ignores trimming** (src/greet.js:8-9, confidence 60%)
- ⚪ INFO — **Unused express dependency in a 3-file library with no HTTP code** (package.json:14-16, confidence 90%)

1 finding(s) could not be fully verified against file contents and are marked accordingly — treat them as leads, not confirmed defects.

## Priority backlog

| # | Priority | Severity | Confidence | Category | Effort | Location | Issue |
|---|---|---|---|---|---|---|---|
| 1 | 5.7 | 🟠 HIGH | 85% | bug | moderate | `package.json:1-18` | ESM source files but package.json has no "type": "module" — npm start/test crash |
| 2 | 1.2 | 🔵 LOW | 60% | bug | moderate | `src/greet.js:8-9` | Reported character count is off by one and ignores trimming |
| 3 | 0.9 | ⚪ INFO | 90% | debt | moderate | `package.json:14-16` | Unused express dependency in a 3-file library with no HTTP code |


### 🎯 Quick wins (high priority, small effort)

- 🟠 HIGH **ESM source files but package.json has no "type": "module" — npm start/test crash** — `package.json:1-18`

## Bug (2)

### 🟠 HIGH ESM source files but package.json has no "type": "module" — npm start/test crash

**Priority 5.7 · confidence 85% · effort moderate · source agent:bench-b**

> `package.json:1-18`

Both source files use ESM syntax (`import`/`export`), but package.json declares no `"type": "module"` and the files use the `.js` extension. Under Node >=18 (engines field), `.js` without `"type": "module"` is parsed as CommonJS, so `npm start` (`node src/greet.js`) fails at load time with `SyntaxError: Cannot use import statement outside a module`, and `npm test` (`node --test`) fails the same way for any test importing these modules. The package is therefore not runnable as configured. Confidence is high but not absolute because I could not execute the app in this read-only audit; the conclusion follows from the documented Node module-resolution rules plus the absence of any `type` field in the manifest I read (lines 3-18).

> Validation: cited 3-18 does not contain the snippet — actual lines are 1-18; citation corrected

```
// Clean corpus: a deliberately benign app. The offline acceptance test
// requires a small, explainable, low-noise finding set (ideally zero) here.
{
  "name": "clean-app",
  "version": "1.0.0",
  "private": true,
  "description": "Fixture with no planted issues — used to prove the auditor has low noise floor",
  "main": "src/greet.js",
  "engines": { "node": ">=18" },
  "scripts": {
    "start": "node src/greet.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "4.18.2"
  },
  "devDependencies": {}
}
```

**Benefit:** npm start / npm test work as declared; removes a hard startup failure.

**Regression risk:** Low: adding a `type` field would break any CommonJS consumer, but there are none in this repo (only 2 source files, no dependents of src/greet.js per the import graph).

> ⚠️ Evidence adjusted: cited 3-18 does not contain the snippet — actual lines are 1-18; citation corrected

---

### 🔵 LOW Reported character count is off by one and ignores trimming

**Priority 1.2 · confidence 60% · effort moderate · source agent:bench-b**

> `src/greet.js:8-9`

The reported character count is `name.length + 1` (via `add(name.length, 1)`), while the name actually rendered is `name.trim()`. For any input with surrounding whitespace the number is wrong twice over: e.g. `"  Bob  "` renders `Hello, Bob (8 chars)` although `Bob` is 3 characters. Even for clean input the count is always one greater than the visible name's length. This looks like an intentional-looking but incorrect `+1`; I flag it at lower confidence because it may be deliberate fixture behavior rather than an oversight.

```
const total = add(name.length, 1);
  return `Hello, ${name.trim()} (${total} chars)`;
```

**Benefit:** Reported character counts match the name actually shown to users.

**Regression risk:** Low: a one-line change to count the trimmed value; no callers depend on the numeric value (it is only interpolated into a string).

---

## Debt (1)

### ⚪ INFO Unused express dependency in a 3-file library with no HTTP code

**Priority 0.9 · confidence 90% · effort moderate · source agent:bench-b**

> `package.json:14-16`

`express` 4.18.2 is declared as the sole runtime dependency, but a repository-wide search for "express" matches only this manifest line — no source file imports it, and the import graph for src/greet.js shows only src/calc.js. The dependency is dead weight: it inflates install time and the dependency tree (and pins an older 4.x patch line that would otherwise need security updates) for no functional benefit. Reported as info-level since an unused dependency is a hygiene issue, not a defect.

```
"dependencies": {
    "express": "4.18.2"
  },
```

**Benefit:** Smaller, faster installs and a smaller supply-chain surface.

**Regression risk:** Low: removal is safe only if no out-of-repo script relies on the transitive availability of express; nothing in this repo does.

---


## Coverage & limitations

- Walked **4** file(s); deterministic analysis covered **3** source file(s), 4 text file(s) in total.
- Standing limitations: static pattern analysis only (no code execution); secret detection is heuristic; the audit does not claim full semantic coverage of the codebase.
## Verification & method

- Evidence validation: **2** verified (verbatim snippet located inside the cited range), **1** adjusted (citation corrected to the snippet's real lines), **0** unverified (kept, flagged, down-weighted), **0** dropped before reporting.
- Verdict policy: model dismissals move findings to a visible "model-dismissed" group; critical/high/security findings are never auto-removed. This run: 0 dismissed, 0 contested.
- Secret handling: credential-like literals matched by the secret scan are replaced with type-preserving placeholders in this report and in all model prompts
- Deterministic checks executed: secrets (0), debt-markers (0), duplication (0), size (0), quality (0), deps (0), graph (0), ast-grep (0).
- Model runs:
  - bench-b (baidu/ernie-5.5-flash-preview:free) · structured · native · 1.9s · 677/141 tokens — ok
  - bench-b (baidu/ernie-5.5-flash-preview:free) · autonomous · native · 14.7s · 12375/2076 tokens — ok · finished: submitted

### Model notes

> bench-b: No static analysis findings were provided, and no source excerpts were available for review. Based solely on the repository summary, the codebase is very small (3 files, 35 LOC) with JavaScript and Python components, but no concrete code-level issues can be confirmed without source content.

> bench-b (autonomous): Repository is a 3-file, 35-LOC fixture that self-describes as having no planted issues, and the code is indeed clean: lib/util.py validates types and range before computing, src/calc.js guards with Number.isFinite, src/greet.js guards falsy/non-string input. No secrets, injection sinks, swallowed errors, or duplicated logic found. The only substantive finding is the missing \"type\": \"module\" in package.json, which makes the declared start/test scripts fail under Node's module resolution; the other two are low/info hygiene items. I did not report the pinned express version as a vulnerability since I could not verify specific advisories against the code.


---
Generated by `code-audit` v0.2.3 — read-only audit; no application files were modified. Exit-code policy: report-only (use --fail-on for CI gates).