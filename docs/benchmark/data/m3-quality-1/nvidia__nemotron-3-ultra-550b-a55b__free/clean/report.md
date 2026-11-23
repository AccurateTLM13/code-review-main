# Code Audit Report

| | |
|---|---|
| **Repository** | E:\code\code-review-main\examples\clean-app |
| **Branch / commit** | main @ aaed581 |
| **Date** | 2026-11-23T02:05:40.284Z |
| **Mode** | deep audit · full scan |
| **Focus** | all |
| **Models** | bench-a (nvidia/nemotron-3-ultra-550b-a55b:free, native) |
| **Codebase** | 3 source files · 35 LOC · javascript, python |
| **Findings** | 2 (0 critical / 0 high / 0 medium / 1 low / 1 info) |
| **Kind** | **0** confirmed-defect claim(s) (0 evidence-verified) · 2 maintenance observation(s) |

## Executive summary

The audit produced **2 finding(s)**: 0 confirmed-defect claim(s) (0 evidence-verified) and 2 maintenance observation(s) (duplication, refactoring, debt). Highest-priority verified items:

- ⚪ INFO — **Codebase is clean with no security issues, bugs, or significant maintainability concerns** (lib/util.py:1-10, confidence 95%)

1 unverified finding(s) are **excluded from these priorities** — see _Needs investigation_; treat them as leads, not confirmed defects.

1 finding(s) could not be verified against file contents and are marked accordingly — they never appear in the priority lists above.

## Priority backlog

| # | Priority | Severity | Confidence | Category | Effort | Location | Issue |
|---|---|---|---|---|---|---|---|
| 1 | 0.9 | ⚪ INFO | 95% | refactoring | moderate | `lib/util.py:1-10` | Codebase is clean with no security issues, bugs, or significant maintainability concerns |
| 2 | 0.6 | 🔵 LOW | 32% | debt | moderate | `package.json:15-17` | Unused express dependency declared in package.json |


### 🔍 Needs investigation (evidence could not be verified)

These are leads, not confirmed defects — the cited code could not be located exactly. Verify manually before acting.

- 🔵 LOW **Unused express dependency declared in package.json** — `package.json:15-17` (confidence 32%)

## Refactoring (1)

### ⚪ INFO Codebase is clean with no security issues, bugs, or significant maintainability concerns

**Priority 0.9 · confidence 95% · effort moderate · source agent:bench-a**

> `lib/util.py:1-10`

All three source files (lib/util.py, src/calc.js, src/greet.js) are well-written, have proper input validation, clear error messages, and no detectable security vulnerabilities, bugs, or code smells. The Python utility validates types and value ranges. The JavaScript modules use ES modules correctly, validate inputs, and handle edge cases gracefully (e.g., empty name returns 'Hello, stranger').

```
"""Clean fixture: small, boring, no planted issues."""


def apply_discount(total, percent):
    if not isinstance(total, (int, float)) or not isinstance(percent, (int, float)):
        raise TypeError("apply_discount expects numbers")
    if percent < 0 or percent > 100:
        raise ValueError("percent must be within 0..100")
    return total * (100 - percent) / 100
```

**Fix:** No changes needed. This codebase serves as a good example of clean, defensive coding practices.

**Benefit:** Confirms the repository meets its stated purpose as a clean fixture with low noise floor for auditing tools.

**Regression risk:** None - this is a positive observation.

---

## Debt (1)

### 🔵 LOW Unused express dependency declared in package.json

**Priority 0.6 · confidence 32% · effort moderate · source agent:bench-a**

> `package.json:15-17`

The package.json declares express 4.18.2 as a runtime dependency, but a search of all JavaScript files reveals no import or require statements for express. The dependency appears to be unused.

> Validation: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

```
"dependencies": {
    "express": "4.18.2"
  }
```

**Fix:** Remove the express dependency from package.json if it's not needed, or add the actual express usage code if it was intended.

**Benefit:** Reduces install size, attack surface, and maintenance burden. Avoids confusion for developers.

**Regression risk:** Low - this is a minor maintenance smell. If express was intended to be used, removing it would break the app. Verify intent before removing.

> ⚠️ Evidence unverified: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

---


## Coverage & limitations

- Walked **4** file(s); deterministic analysis covered **3** source file(s), 4 text file(s) in total.
- Standing limitations: static pattern analysis only (no code execution); secret detection is heuristic; the audit does not claim full semantic coverage of the codebase.
## Verification & method

- Evidence validation: **1** verified (verbatim snippet located inside the cited range), **0** adjusted (citation corrected to the snippet's real lines), **1** unverified (kept, flagged, down-weighted), **0** dropped before reporting.
- Verdict policy: model dismissals move findings to a visible "model-dismissed" group; critical/high/security findings are never auto-removed. This run: 0 dismissed, 0 contested.
- Secret handling: credential-like literals matched by the secret scan are replaced with type-preserving placeholders in this report and in all model prompts
- Deterministic checks executed: secrets (0), debt-markers (0), duplication (0), size (0), quality (0), deps (0), graph (0), ast-grep (0).
- Model runs:
  - bench-a (nvidia/nemotron-3-ultra-550b-a55b:free) · structured · native · 3.3s · 752/229 tokens — ok
  - bench-a (nvidia/nemotron-3-ultra-550b-a55b:free) · autonomous · native · 45.5s · 32778/1926 tokens — ok · finished: submitted

### Model notes

> bench-a: No source excerpts were provided for review (budget limitation). Repository contains 3 files: lib/util.py (Python), src/calc.js and src/greet.js (JavaScript). No static analysis findings were produced. Unable to perform code-level audit without file contents.

> bench-a (autonomous): The repository contains 3 source files (1 Python, 2 JavaScript) totaling ~35 LOC as described. All code is clean, well-structured, and follows defensive programming practices with proper input validation. The only finding is a minor maintenance debt: express 4.18.2 is declared as a dependency in package.json but is never imported or used in any JavaScript file. This appears to be a deliberately clean fixture repository with no planted issues.


---
Generated by `code-audit` v0.2.3 — read-only audit; no application files were modified. Exit-code policy: report-only (use --fail-on for CI gates).