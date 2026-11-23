# Code Audit Report

| | |
|---|---|
| **Repository** | E:\code\code-review-main\examples\vulnerable-app |
| **Branch / commit** | main @ 8678d71 |
| **Date** | 2026-11-23T02:28:02.628Z |
| **Mode** | deep audit · full scan |
| **Focus** | all |
| **Models** | bench-b (baidu/ernie-5.5-flash-preview:free, native) |
| **Codebase** | 9 source files · 1,552 LOC · javascript, python, typescript |
| **Findings** | 29 (2 critical / 3 high / 13 medium / 9 low / 2 info) |
| **Kind** | **14** confirmed-defect claim(s) (14 evidence-verified) · 15 maintenance observation(s) |

> ⚠️ **PARTIAL AUDIT** — one or more model phases failed or the run was cut short, so model review coverage is incomplete. Treat the finding set as a floor, not a full review.
>
> - model phase "structured" (profile "bench-b") failed: model returned an empty response — try a stronger model, a smaller "contextChars" in the profile, or lower "maxTokens"
> - model phase "autonomous" (profile "bench-b") failed: Endpoint 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"baidu/ernie-5.5-flash-preview:free is temporarily rate-limited upstream. Please retry shortly, or add your own provider key to use your own limits: https://openrouter.ai/workspaces/default/byok","provider_name":"Baidu","is_b

## Executive summary

The audit produced **29 finding(s)**: 14 confirmed-defect claim(s) (14 evidence-verified) and 15 maintenance observation(s) (duplication, refactoring, debt). Highest-priority verified items:

- 🔴 CRITICAL — **AWS access key ID committed** (index.js:8-8, confidence 95%)
- 🔴 CRITICAL — **GitHub personal access token committed** (server/auth.py:5-5, confidence 95%)
- 🟠 HIGH — **.env file present and tracked by git** (.env, confidence 90%)
- 🟡 MEDIUM — **28-line block duplicated between helpers.js and utils.js** (src/helpers.js:2-29, confidence 90%)
- 🟡 MEDIUM — **1 FIXME marker in index.js** (index.js:10-10, confidence 85%)


## Priority backlog

| # | Priority | Severity | Confidence | Category | Effort | Location | Issue |
|---|---|---|---|---|---|---|---|
| 1 | 9.5 | 🔴 CRITICAL | 95% | security | trivial | `index.js:8-8` | AWS access key ID committed |
| 2 | 9.5 | 🔴 CRITICAL | 95% | security | trivial | `server/auth.py:5-5` | GitHub personal access token committed |
| 3 | 6.3 | 🟠 HIGH | 90% | security | trivial | `.env` | .env file present and tracked by git |
| 4 | 3.6 | 🟡 MEDIUM | 90% | duplication | moderate | `src/helpers.js:2-29` | 28-line block duplicated between helpers.js and utils.js |
| 5 | 3.4 | 🟡 MEDIUM | 85% | debt | moderate | `index.js:10-10` | 1 FIXME marker in index.js |
| 6 | 3.4 | 🟡 MEDIUM | 85% | debt | moderate | `server/auth.py:27-27` | 1 FIXME marker in auth.py |
| 7 | 3.4 | 🟡 MEDIUM | 85% | refactoring | large | `src/legacy-monolith.js:1-60` | Oversized file: legacy-monolith.js is 1,330 lines |
| 8 | 3.2 | 🟡 MEDIUM | 80% | debt | trivial | `package.json` | Dependency hygiene issues in package.json (3) |
| 9 | 3.1 | 🟠 HIGH | 45% | security | moderate | `index.js:13-13` | child_process call with interpolated/concatenated command |
| 10 | 3.0 | 🟡 MEDIUM | 75% | debt | trivial | `package.json` | No lockfile committed next to package.json |
| 11 | 2.8 | 🟠 HIGH | 41% | security | moderate | `src/payment.ts:11-11` | SQL query built via string concatenation/interpolation |
| 12 | 2.8 | 🟡 MEDIUM | 70% | refactoring | large | `src/lib/a.js` | Import cycle (2 modules): a.js → b.js → a.js |
| 13 | 2.5 | 🟡 MEDIUM | 63% | bug | trivial | `index.js:35-35` | Empty or comment-only catch block swallows errors |
| 14 | 2.3 | 🟡 MEDIUM | 59% | bug | trivial | `server/auth.py:16-16` | except block that passes silently |
| 15 | 2.2 | 🟡 MEDIUM | 54% | security | moderate | `server/auth.py:9-9` | eval()/exec() executes dynamic code |
| 16 | 2.0 | 🟡 MEDIUM | 50% | security | moderate | `src/payment.ts:17-17` | eval() executes dynamic code |
| 17 | 1.8 | 🟡 MEDIUM | 45% | security | moderate | `index.js:46-46` | Raw HTML injection sink (innerHTML / dangerouslySetInnerHTML) |
| 18 | 1.8 | 🟡 MEDIUM | 45% | performance | moderate | `index.js:21-21` | Sequential await inside a loop |
| 19 | 1.6 | 🔵 LOW | 81% | bug | trivial | `index.js:43-43` | `debugger` statement left in code |
| 20 | 1.6 | 🔵 LOW | 80% | debt | moderate | `src/legacy-monolith.js:25-1130` | 6 TODO markers in legacy-monolith.js |
| 21 | 1.6 | 🔵 LOW | 80% | debt | moderate | `server/auth.py:4-4` | 1 TODO marker in auth.py |
| 22 | 1.6 | 🔵 LOW | 80% | debt | moderate | `src/payment.ts:10-10` | 1 TODO marker in payment.ts |
| 23 | 1.2 | 🔵 LOW | 60% | refactoring | large | `src/legacy-monolith.js:1-80` | Deep nesting (≈7 levels) in legacy-monolith.js |
| 24 | 1.1 | 🔵 LOW | 54% | performance | trivial | `index.js:32-32` | JSON.parse(JSON.stringify(...)) used as deep clone |
| 25 | 1.1 | 🔵 LOW | 54% | bug | trivial | `server/auth.py:16-16` | Bare `except:` catches everything (including KeyboardInterrupt/SystemExit) |
| 26 | 0.9 | 🔵 LOW | 45% | security | trivial | `index.js:48-48` | Insecure http:// endpoint in source |
| 27 | 0.9 | 🔵 LOW | 45% | security | trivial | `server/auth.py:29-29` | Insecure http:// endpoint in source |
| 28 | 0.7 | ⚪ INFO | 70% | debt | moderate | `src/orphan.js:3-3` | 1 XXX marker in orphan.js |
| 29 | 0.5 | ⚪ INFO | 50% | refactoring | large | `src/helpers.js` | 4 source files have no incoming imports |


### 🎯 Quick wins (high priority, small effort)

- 🔴 CRITICAL **AWS access key ID committed** — `index.js:8-8`
- 🔴 CRITICAL **GitHub personal access token committed** — `server/auth.py:5-5`
- 🟠 HIGH **.env file present and tracked by git** — `.env`
- 🟡 MEDIUM **28-line block duplicated between helpers.js and utils.js** — `src/helpers.js:2-29`
- 🟡 MEDIUM **1 FIXME marker in index.js** — `index.js:10-10`
- 🟡 MEDIUM **1 FIXME marker in auth.py** — `server/auth.py:27-27`
- 🟡 MEDIUM **Dependency hygiene issues in package.json (3)** — `package.json`
- 🟠 HIGH **child_process call with interpolated/concatenated command** — `index.js:13-13`
- 🟡 MEDIUM **No lockfile committed next to package.json** — `package.json`
- 🟠 HIGH **SQL query built via string concatenation/interpolation** — `src/payment.ts:11-11`

## Security (10)

### 🔴 CRITICAL AWS access key ID committed

**Priority 9.5 · confidence 95% · effort trivial · source deterministic**

> `index.js:8-8`

Matched pattern `aws-key` in index.js:8. This looks like a real credential (value redacted in this report). Rotate the secret and move it to an environment variable or secret manager.

```
const AWS_KEY = '[REDACTED aws-key #54c83e8f]';
```

**Fix:** Remove the literal, rotate the credential, load from process env / secret store, and scrub git history if committed.

**Benefit:** Eliminates a directly exploitable credential leak.

**Regression risk:** Low — mechanical replacement plus key rotation; verify dependent services after rotation.

---

### 🔴 CRITICAL GitHub personal access token committed

**Priority 9.5 · confidence 95% · effort trivial · source deterministic**

> `server/auth.py:5-5`

Matched pattern `github-pat` in server/auth.py:5. This looks like a real credential (value redacted in this report). Rotate the secret and move it to an environment variable or secret manager.

```
API_TOKEN = "[REDACTED github-token #3543c50b]"
```

**Fix:** Remove the literal, rotate the credential, load from process env / secret store, and scrub git history if committed.

**Benefit:** Eliminates a directly exploitable credential leak.

**Regression risk:** Low — mechanical replacement plus key rotation; verify dependent services after rotation.

---

### 🟠 HIGH .env file present and tracked by git

**Priority 6.3 · confidence 90% · effort trivial · source deterministic**

> `.env`

.env exists and is committed. Environment files frequently contain secrets and are easy to leak via zip archives, Docker contexts, or accidental commits. Contents are redacted from all reports and prompts.

**Fix:** Keep only .env.example in the repository; load real values from the environment. If tracked, remove it from the index and add .env to .gitignore.

**Benefit:** Removes a common accidental leak vector.

**Regression risk:** Low — ensure local deployments still find their configuration.

---

### 🟠 HIGH child_process call with interpolated/concatenated command

**Priority 3.1 · confidence 45% · effort moderate · source deterministic**

> `index.js:13-13`

Building shell commands from variables allows command injection when any part of the string is user-influenced.

1 occurrence in index.js:13

```
exec('convert ' + name + ' preview.png', (err) => {
```

**Fix:** Use execFile/spawn with an argument array so values are never interpreted by a shell; validate or allow-list any dynamic parts.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🟠 HIGH SQL query built via string concatenation/interpolation

**Priority 2.8 · confidence 41% · effort moderate · source deterministic**

> `src/payment.ts:11-11`

Concatenated SQL is the classic injection vector — query structure is data-dependent.

1 occurrence in src/payment.ts:11

```
const sql = 'SELECT * FROM payments WHERE customer_id = ' + customerId;
```

**Fix:** Use parameterized queries / prepared statements with bound parameters.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🟡 MEDIUM eval()/exec() executes dynamic code

**Priority 2.2 · confidence 54% · effort moderate · source deterministic**

> `server/auth.py:9-9`

Python eval/exec turn strings into running code — a direct injection sink when any part of the input is user-influenced.

1 occurrence in server/auth.py:9

```
return eval(user_input)
```

**Fix:** Replace with explicit parsing (ast.literal_eval for data), or validate input strictly and document why dynamic execution is required.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🟡 MEDIUM eval() executes dynamic code

**Priority 2.0 · confidence 50% · effort moderate · source deterministic**

> `src/payment.ts:17-17`

Dynamic code execution is an injection sink: any attacker-controlled string that reaches here becomes arbitrary code execution.

1 occurrence in src/payment.ts:17

```
return eval('(' + text + ')') as PaymentRow[];
```

**Fix:** Replace with explicit parsing/logic. If input must be trusted, validate strictly and document why eval is required.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🟡 MEDIUM Raw HTML injection sink (innerHTML / dangerouslySetInnerHTML)

**Priority 1.8 · confidence 45% · effort moderate · source deterministic**

> `index.js:46-46`

Assigning HTML strings can inject scripts when the content includes any user-derived data.

1 occurrence in index.js:46

```
res.end('<div id="out"></div><script>document.getElementById("out").innerHTML = ' + JSON.stringify(key) + ';</script>');
```

**Fix:** Prefer textContent or framework escaping. If HTML must be trusted, sanitize it explicitly and document the trust boundary.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🔵 LOW Insecure http:// endpoint in source

**Priority 0.9 · confidence 45% · effort trivial · source deterministic**

> `index.js:48-48`

Plain HTTP endpoints leak data in transit and enable MITM; also commonly a leftover dev URL.

1 occurrence in index.js:48

```
res.status(403).send('http://status.internal-site.example/403');
```

**Fix:** Switch to https://, or to a localhost/dev URL, and load production endpoints from configuration.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🔵 LOW Insecure http:// endpoint in source

**Priority 0.9 · confidence 45% · effort trivial · source deterministic**

> `server/auth.py:29-29`

Plain HTTP endpoints leak data in transit and enable MITM; also commonly a leftover dev URL.

1 occurrence in server/auth.py:29

```
return requests.post("http://payments-legacy.internal/charge", json={"amount": amount})
```

**Fix:** Switch to https://, or to a localhost/dev URL, and load production endpoints from configuration.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

## Duplication (1)

### 🟡 MEDIUM 28-line block duplicated between helpers.js and utils.js

**Priority 3.6 · confidence 90% · effort moderate · source deterministic**

> `src/helpers.js:2-29`

Copy-paste: lines 2–29 of src/helpers.js repeat at lines 2–29 of src/utils.js. Duplicated logic drifts apart silently and doubles every future fix.

```
function renderInvoice(invoice) {
  const header = 'INVOICE ' + invoice.id;
  const lines = [];
  lines.push('Customer: ' + invoice.customer.name);
```

**Fix:** Extract the shared block into one named function/module and call it from both locations. Keep behavior identical; rely on existing tests.

**Benefit:** Single point of change; halves maintenance surface for this logic.

**Regression risk:** Low-moderate — check both call sites for context-dependent differences.

---

## Debt (8)

### 🟡 MEDIUM 1 FIXME marker in index.js

**Priority 3.4 · confidence 85% · effort moderate · source deterministic**

> `index.js:10-10`

Signals known broken/unfinished behavior — high-value to resolve.
Occurrences: L10: // FIXME: user-supplied filename is passed straight into a shell

```
// FIXME: user-supplied filename is passed straight into a shell
```

**Fix:** Treat as a defect backlog: reproduce, fix, and add a regression test before closing the marker.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

---

### 🟡 MEDIUM 1 FIXME marker in auth.py

**Priority 3.4 · confidence 85% · effort moderate · source deterministic**

> `server/auth.py:27-27`

Signals known broken/unfinished behavior — high-value to resolve.
Occurrences: L27: # FIXME: no idempotency key — double charges on retry

```
# FIXME: no idempotency key — double charges on retry
```

**Fix:** Treat as a defect backlog: reproduce, fix, and add a regression test before closing the marker.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

---

### 🟡 MEDIUM Dependency hygiene issues in package.json (3)

**Priority 3.2 · confidence 80% · effort trivial · source deterministic**

> `package.json`

- **express** `latest`: production dependency pinned to "*" / "latest" — builds are non-reproducible
- **lodash** `*`: production dependency pinned to "*" / "latest" — builds are non-reproducible
- **lodash** `* / 4.17.21`: same package in dependencies and devDependencies

**Fix:** Pin exact versions (lockfiles for npm/cargo; `==` pins or constraints.txt for pip) and audit ranges deliberately when upgrading.

**Benefit:** Reproducible builds and no surprise breaking upgrades.

**Regression risk:** Low — pinning alone changes no runtime behavior.

---

### 🟡 MEDIUM No lockfile committed next to package.json

**Priority 3.0 · confidence 75% · effort trivial · source deterministic**

> `package.json`

Without a lockfile, every `npm install` resolves fresh versions — CI, teammates, and production can drift apart silently.

**Fix:** Commit the lockfile matching your package manager (npm/yarn/pnpm) and install with `npm ci` in CI.

**Benefit:** Identical dependency trees everywhere; fewer "works on my machine" failures.

**Regression risk:** None — adding a lockfile is additive.

---

### 🔵 LOW 6 TODO markers in legacy-monolith.js

**Priority 1.6 · confidence 80% · effort moderate · source deterministic**

> `src/legacy-monolith.js:25-1130`

Deferred work; batch these into planned refactors.
Occurrences: L25: // TODO: handler0 still needs rate limiting | L246: // TODO: handler10 still needs rate limiting | L467: // TODO: handler20 still needs rate limiting | L688: // TODO: handler30 still needs rate limiting | L909: // TODO: handler40 still needs rate limiting | L1130: // TODO: handler50 still needs rate limiting

```
// TODO: handler0 still needs rate limiting
```

All occurrences: `src/legacy-monolith.js:25-25` · `src/legacy-monolith.js:246-246` · `src/legacy-monolith.js:467-467` · `src/legacy-monolith.js:688-688` · `src/legacy-monolith.js:909-909` · `src/legacy-monolith.js:1130-1130`

**Fix:** Schedule cleanup; convert vague notes into tracked issues with owners.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

---

### 🔵 LOW 1 TODO marker in auth.py

**Priority 1.6 · confidence 80% · effort moderate · source deterministic**

> `server/auth.py:4-4`

Deferred work; batch these into planned refactors.
Occurrences: L4: # TODO: move config to the environment loader

```
# TODO: move config to the environment loader
```

**Fix:** Schedule cleanup; convert vague notes into tracked issues with owners.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

---

### 🔵 LOW 1 TODO marker in payment.ts

**Priority 1.6 · confidence 80% · effort moderate · source deterministic**

> `src/payment.ts:10-10`

Deferred work; batch these into planned refactors.
Occurrences: L10: // TODO: parameterize — customerId flows straight into the SQL string

```
// TODO: parameterize — customerId flows straight into the SQL string
```

**Fix:** Schedule cleanup; convert vague notes into tracked issues with owners.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

---

### ⚪ INFO 1 XXX marker in orphan.js

**Priority 0.7 · confidence 70% · effort moderate · source deterministic**

> `src/orphan.js:3-3`

Attention marker.
Occurrences: L3: // XXX: pre-2019 tax table, kept "just in case"

```
// XXX: pre-2019 tax table, kept "just in case"
```

**Fix:** Schedule cleanup; convert vague notes into tracked issues with owners.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

---

## Refactoring (4)

### 🟡 MEDIUM Oversized file: legacy-monolith.js is 1,330 lines

**Priority 3.4 · confidence 85% · effort large · source deterministic**

> `src/legacy-monolith.js:1-60`

src/legacy-monolith.js has 1,330 lines — beyond the 800-line guideline. Candidates: mixed responsibilities, dead code, or several features in one module.

```
// Fixture: deliberately oversized legacy module (400+ lines).
const ROUTES = {};

function handler0(req, res) {
  const id = req.params.id;
  const mode = req.query.mode || 'standard0';
  const cacheKey = 'k0:' + id + ':' + mode;
  const data = ROUTES[cacheKey] || { id, mode, stamped: Date.now() };
  ROUTES[cacheKey] = data;
  if (!data) {
      const nested = { ...data, id, mode };
      if (nested && nested.id) {
```

**Fix:** Identify distinct responsibilities via section comments/imports, extract the most self-contained part first.

**Benefit:** Faster reviews and safer edits.

**Regression risk:** Low if extracted pieces keep their tests.

---

### 🟡 MEDIUM Import cycle (2 modules): a.js → b.js → a.js

**Priority 2.8 · confidence 70% · effort large · source deterministic**

> `src/lib/a.js`

Circular import chain: src/lib/a.js → src/lib/b.js → src/lib/a.js. Cycles cause initialization-order bugs (undefined imports at runtime), prevent clean layering, and make the modules impossible to test in isolation.

**Fix:** Break the cycle by extracting the shared piece into a third module, or invert one dependency via dependency injection / event callbacks.

**Benefit:** Deterministic module initialization and clean layering.

**Regression risk:** Moderate — moving code between modules can shift initialization order; run the full test suite after.

---

### 🔵 LOW Deep nesting (≈7 levels) in legacy-monolith.js

**Priority 1.2 · confidence 60% · effort large · source deterministic**

> `src/legacy-monolith.js:1-80`

This file reaches roughly 7 levels of indentation — a readability and cyclomatic-complexity smell. Deeply nested code hides edge cases and is hard to test.

```
// Fixture: deliberately oversized legacy module (400+ lines).
const ROUTES = {};

function handler0(req, res) {
  const id = req.params.id;
  const mode = req.query.mode || 'standard0';
  const cacheKey = 'k0:' + id + ':' + mode;
  const data = ROUTES[cacheKey] || { id, mode, stamped: Date.now() };
  ROUTES[cacheKey] = data;
  if (!data) {
```

**Fix:** Apply guard clauses / early returns, extract inner loops into functions, or invert conditions.

**Benefit:** Flatter control flow is easier to reason about and unit-test.

**Regression risk:** Low — logic-preserving transforms.

---

### ⚪ INFO 4 source files have no incoming imports

**Priority 0.5 · confidence 50% · effort large · source deterministic**

> `src/helpers.js`

Possibly dead code (heuristic — scripts, dynamically-loaded files, and plugin modules are false positives):
- src/helpers.js
- src/legacy-monolith.js
- src/orphan.js
- src/payment.ts

All occurrences: `src/helpers.js:` · `src/legacy-monolith.js:` · `src/orphan.js:` · `src/payment.ts:`

**Fix:** Verify usage (dynamic imports, string-based loaders, external callers) before deleting; then remove or archive.

**Benefit:** Less code to maintain and review.

**Regression risk:** Low if deletion is verified; keep an eye on string-based dynamic requires.

---

## Bug (4)

### 🟡 MEDIUM Empty or comment-only catch block swallows errors

**Priority 2.5 · confidence 63% · effort trivial · source deterministic**

> `index.js:35-35`

An error is caught and discarded. Failures become silent data corruption or missing side effects that surface far from the cause.

1 occurrence in index.js:35

```
} catch (e) {
```

**Fix:** Handle the error, rethrow with context, or at minimum log it with enough detail to debug. If the exception truly cannot occur, assert that explicitly.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🟡 MEDIUM except block that passes silently

**Priority 2.3 · confidence 59% · effort trivial · source deterministic**

> `server/auth.py:16-16`

An exception is caught and ignored. This hides real failures and makes debugging painful.

1 occurrence in server/auth.py:16

```
except:
```

**Fix:** Narrow the exception type, log or re-raise, and handle what can actually be handled.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🔵 LOW `debugger` statement left in code

**Priority 1.6 · confidence 81% · effort trivial · source deterministic**

> `index.js:43-43`

Halts execution in any browser that has DevTools open; also signals leftover debugging.

1 occurrence in index.js:43

```
debugger;
```

**Fix:** Remove the statement; use breakpoints in the devtools instead.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🔵 LOW Bare `except:` catches everything (including KeyboardInterrupt/SystemExit)

**Priority 1.1 · confidence 54% · effort trivial · source deterministic**

> `server/auth.py:16-16`

Bare excepts make programs unkillable and mask unrelated bugs.

1 occurrence in server/auth.py:16

```
except:
```

**Fix:** Catch the narrowest exception you can actually handle.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

## Performance (2)

### 🟡 MEDIUM Sequential await inside a loop

**Priority 1.8 · confidence 45% · effort moderate · source deterministic**

> `index.js:21-21`

Round-trips executed one at a time — latency adds up linearly with loop size.

1 occurrence in index.js:21

```
for (const row of rows) {
```

**Fix:** Batch independent work with Promise.all / a bounded concurrency pool. Only keep sequential awaits when iteration N depends on N-1.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---

### 🔵 LOW JSON.parse(JSON.stringify(...)) used as deep clone

**Priority 1.1 · confidence 54% · effort trivial · source deterministic**

> `index.js:32-32`

Slow, throws on Dates/Maps/Sets/undefined, loses prototypes. Fine for tiny JSON-safe objects, costly in hot paths.

1 occurrence in index.js:32

```
const data = JSON.parse(JSON.stringify({ customer }));
```

**Fix:** Use structuredClone() (Node ≥17, browsers ≥2022) or a purpose-built clone for the shape involved.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

---


## Coverage & limitations

- Walked **12** file(s); deterministic analysis covered **9** source file(s), 12 text file(s) in total.
- Standing limitations: static pattern analysis only (no code execution); secret detection is heuristic; the audit does not claim full semantic coverage of the codebase.
## Verification & method

- Evidence validation: **29** verified (verbatim snippet located inside the cited range), **0** adjusted (citation corrected to the snippet's real lines), **0** unverified (kept, flagged, down-weighted), **0** dropped before reporting.
- Verdict policy: model dismissals move findings to a visible "model-dismissed" group; critical/high/security findings are never auto-removed. This run: 0 dismissed, 0 contested.
- Secret handling: credential-like literals matched by the secret scan are replaced with type-preserving placeholders in this report and in all model prompts
- Deterministic checks executed: secrets (3), debt-markers (6), duplication (1), size (2), quality (13), deps (2), graph (2), ast-grep (0).
- Model runs:
  - bench-b (baidu/ernie-5.5-flash-preview:free) · structured · native · 1m 21s · 13174/16384 tokens — failed: model returned an empty response — try a stronger model, a smaller "contextChars" in the profile, or lower "maxTokens"
  - bench-b (baidu/ernie-5.5-flash-preview:free) · autonomous · native · 34.5s — failed: Endpoint 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"baidu/ernie-5.5-flash-preview:free is temporarily rate-limited upstream. Please retry shortly, or add your own provider key to use your own limits: https://openrouter.ai/workspaces/default/byok","provider_name":"Baidu","is_b · finished: error

---
Generated by `code-audit` v0.2.3 — read-only audit; no application files were modified. Exit-code policy: report-only (use --fail-on for CI gates).