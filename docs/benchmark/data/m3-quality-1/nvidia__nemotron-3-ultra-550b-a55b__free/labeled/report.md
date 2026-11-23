# Code Audit Report

| | |
|---|---|
| **Repository** | E:\code\code-review-main\examples\vulnerable-app |
| **Branch / commit** | main @ 8678d71 |
| **Date** | 2026-11-23T02:13:36.104Z |
| **Mode** | deep audit · full scan |
| **Focus** | all |
| **Models** | bench-a (nvidia/nemotron-3-ultra-550b-a55b:free, native) |
| **Codebase** | 9 source files · 1,552 LOC · javascript, python, typescript |
| **Findings** | 49 (8 critical / 6 high / 22 medium / 11 low / 2 info) |
| **Kind** | **26** confirmed-defect claim(s) (26 evidence-verified) · 23 maintenance observation(s) |

## Executive summary

The audit produced **49 finding(s)**: 26 confirmed-defect claim(s) (26 evidence-verified) and 23 maintenance observation(s) (duplication, refactoring, debt). Highest-priority verified items:

- 🔴 CRITICAL — **Arbitrary Code Execution via eval() in run_user_script()** (server/auth.py:7-10, confidence 95%)
- 🔴 CRITICAL — **Arbitrary Code Execution via eval() in unsafeJsonParse()** (src/payment.ts:15-18, confidence 95%)
- 🔴 CRITICAL — **Command Injection via User-Controlled Input in exec()** (index.js:11-17, confidence 95%)
- 🔴 CRITICAL — **Hardcoded admin secret 'hunter2' in /admin endpoint** (index.js:42-42, confidence 95%)
- 🔴 CRITICAL — **unsafeJsonParse uses eval with unsafe cast** (src/payment.ts:14-18, confidence 95%)

1 unverified finding(s) are **excluded from these priorities** — see _Needs investigation_; treat them as leads, not confirmed defects.

1 finding(s) could not be verified against file contents and are marked accordingly — they never appear in the priority lists above.

## Priority backlog

| # | Priority | Severity | Confidence | Category | Effort | Location | Issue |
|---|---|---|---|---|---|---|---|
| 1 | 9.5 | 🔴 CRITICAL | 95% | security | moderate | `server/auth.py:7-10` | Arbitrary Code Execution via eval() in run_user_script() |
| 2 | 9.5 | 🔴 CRITICAL | 95% | security | moderate | `src/payment.ts:15-18` | Arbitrary Code Execution via eval() in unsafeJsonParse() |
| 3 | 9.0 | 🔴 CRITICAL | 95% | security | moderate | `index.js:11-17` | Command Injection via User-Controlled Input in exec() |
| 4 | 8.6 | 🔴 CRITICAL | 95% | security | moderate | `index.js:42-42` | Hardcoded admin secret 'hunter2' in /admin endpoint |
| 5 | 8.6 | 🔴 CRITICAL | 95% | security | moderate | `src/payment.ts:14-18` | unsafeJsonParse uses eval with unsafe cast |
| 6 | 8.6 | 🔴 CRITICAL | 95% | security | moderate | `src/payment.ts:8-13` | findPayments constructs SQL via string concatenation — SQL injection |
| 7 | 8.6 | 🔴 CRITICAL | 95% | security | trivial | `server/auth.py:5-5` | GitHub personal access token committed |
| 8 | 7.3 | 🔴 CRITICAL | 81% | security | trivial | `index.js:8-8` | AWS access key ID committed |
| 9 | 6.3 | 🟠 HIGH | 95% | bug | moderate | `src/legacy-monolith.js:7-18` | Dead code in all 60 legacy-monolith handlers — if (!data) branch never executes |
| 10 | 6.3 | 🟠 HIGH | 95% | security | moderate | `index.js:39-50` | Hardcoded Secret (Admin Key) and Debugger in Production Code |
| 11 | 6.3 | 🟠 HIGH | 90% | security | moderate | `index.js:13-13` | child_process call with interpolated/concatenated command |
| 12 | 6.3 | 🟠 HIGH | 90% | security | moderate | `src/payment.ts:11-11` | SQL query built via string concatenation/interpolation |
| 13 | 4.8 | 🟠 HIGH | 77% | security | trivial | `.env` | .env file present and tracked by git |
| 14 | 3.8 | 🟡 MEDIUM | 95% | duplication | moderate | `src/utils.js:2-31` | Duplicated renderInvoice Function Across src/utils.js and src/helpers.js |
| 15 | 3.6 | 🟡 MEDIUM | 95% | bug | moderate | `index.js:44-44` | Implicit global variable 'document' assigned in /admin endpoint |
| 16 | 3.6 | 🟡 MEDIUM | 95% | bug | moderate | `server/auth.py:20-24` | save_config in auth.py leaks file handle on write error |
| 17 | 3.6 | 🟡 MEDIUM | 95% | bug | moderate | `server/auth.py:12-17` | load_config returns None on any exception, masking failures |
| 18 | 3.6 | 🟡 MEDIUM | 95% | debt | moderate | `package.json:1-19` | No lockfile committed |
| 19 | 3.6 | 🟡 MEDIUM | 95% | bug | moderate | `index.js:13-16` | Swallowed Error in exec() Callback |
| 20 | 3.6 | 🟡 MEDIUM | 95% | performance | moderate | `index.js:18-29` | Sequential Awaits in Loop Causing Performance Degradation |
| 21 | 3.6 | 🟡 MEDIUM | 90% | debt | moderate | `index.js:10-10` | 1 FIXME marker in index.js |
| 22 | 3.6 | 🟡 MEDIUM | 90% | debt | moderate | `server/auth.py:27-27` | 1 FIXME marker in auth.py |
| 23 | 3.6 | 🟡 MEDIUM | 90% | duplication | moderate | `src/helpers.js:2-29` | 28-line block duplicated between helpers.js and utils.js |
| 24 | 3.6 | 🟡 MEDIUM | 90% | refactoring | large | `src/legacy-monolith.js:1-60` | Oversized file: legacy-monolith.js is 1,330 lines |
| 25 | 3.6 | 🟡 MEDIUM | 90% | bug | trivial | `index.js:35-35` | Empty or comment-only catch block swallows errors |
| 26 | 3.6 | 🟡 MEDIUM | 90% | security | moderate | `index.js:46-46` | Raw HTML injection sink (innerHTML / dangerouslySetInnerHTML) |
| 27 | 3.6 | 🟡 MEDIUM | 90% | performance | moderate | `index.js:21-21` | Sequential await inside a loop |
| 28 | 3.6 | 🟡 MEDIUM | 90% | bug | trivial | `server/auth.py:16-16` | except block that passes silently |
| 29 | 3.6 | 🟡 MEDIUM | 90% | debt | trivial | `package.json` | Dependency hygiene issues in package.json (3) |
| 30 | 3.6 | 🟡 MEDIUM | 90% | debt | trivial | `package.json` | No lockfile committed next to package.json |
| 31 | 3.6 | 🟡 MEDIUM | 90% | refactoring | large | `src/lib/a.js` | Import cycle (2 modules): a.js → b.js → a.js |
| 32 | 3.4 | 🟡 MEDIUM | 95% | bug | moderate | `index.js:30-38` | loadRows swallows all errors and returns empty array |
| 33 | 3.4 | 🟡 MEDIUM | 95% | debt | moderate | `package.json:10-17` | Dependency hygiene: 'latest', '*', and duplicate lodash |
| 34 | 3.4 | 🟡 MEDIUM | 95% | refactoring | moderate | `src/lib/a.js:2-4` | Import cycle between src/lib/a.js and src/lib/b.js |
| 35 | 3.2 | 🟡 MEDIUM | 80% | bug | moderate | `server/auth.py:26-29` | Missing Idempotency Key in Payment Charge Function |
| 36 | 2.3 | 🟠 HIGH | 35% | duplication | moderate | `src/legacy-monolith.js:1-1330` | Extreme code duplication — 60 nearly identical handler functions |
| 37 | 1.8 | 🔵 LOW | 95% | debt | moderate | `src/orphan.js:1-9` | Orphan module src/orphan.js exports unused legacyTax function |
| 38 | 1.8 | 🔵 LOW | 90% | debt | moderate | `src/legacy-monolith.js:25-1130` | 6 TODO markers in legacy-monolith.js |
| 39 | 1.8 | 🔵 LOW | 90% | debt | moderate | `server/auth.py:4-4` | 1 TODO marker in auth.py |
| 40 | 1.8 | 🔵 LOW | 90% | debt | moderate | `src/payment.ts:10-10` | 1 TODO marker in payment.ts |
| 41 | 1.8 | 🔵 LOW | 90% | bug | trivial | `index.js:43-43` | `debugger` statement left in code |
| 42 | 1.8 | 🔵 LOW | 90% | security | trivial | `index.js:48-48` | Insecure http:// endpoint in source |
| 43 | 1.8 | 🔵 LOW | 90% | performance | trivial | `index.js:32-32` | JSON.parse(JSON.stringify(...)) used as deep clone |
| 44 | 1.8 | 🔵 LOW | 90% | bug | trivial | `server/auth.py:16-16` | Bare `except:` catches everything (including KeyboardInterrupt/SystemExit) |
| 45 | 1.8 | 🔵 LOW | 90% | security | trivial | `server/auth.py:29-29` | Insecure http:// endpoint in source |
| 46 | 1.7 | 🔵 LOW | 95% | debt | moderate | `index.js:24-26` | Multiple debug console.log statements left in production code path |
| 47 | 1.6 | 🔵 LOW | 81% | refactoring | large | `src/legacy-monolith.js:1-80` | Deep nesting (≈7 levels) in legacy-monolith.js |
| 48 | 0.9 | ⚪ INFO | 90% | debt | moderate | `src/orphan.js:3-3` | 1 XXX marker in orphan.js |
| 49 | 0.8 | ⚪ INFO | 81% | refactoring | large | `src/helpers.js` | 4 source files have no incoming imports |


### 🎯 Quick wins (high priority, small effort)

- 🔴 CRITICAL **Arbitrary Code Execution via eval() in run_user_script()** — `server/auth.py:7-10`
- 🔴 CRITICAL **Arbitrary Code Execution via eval() in unsafeJsonParse()** — `src/payment.ts:15-18`
- 🔴 CRITICAL **Command Injection via User-Controlled Input in exec()** — `index.js:11-17`
- 🔴 CRITICAL **Hardcoded admin secret 'hunter2' in /admin endpoint** — `index.js:42-42`
- 🔴 CRITICAL **unsafeJsonParse uses eval with unsafe cast** — `src/payment.ts:14-18`
- 🔴 CRITICAL **findPayments constructs SQL via string concatenation — SQL injection** — `src/payment.ts:8-13`
- 🔴 CRITICAL **GitHub personal access token committed** — `server/auth.py:5-5`
- 🔴 CRITICAL **AWS access key ID committed** — `index.js:8-8`
- 🟠 HIGH **Dead code in all 60 legacy-monolith handlers — if (!data) branch never executes** — `src/legacy-monolith.js:7-18`
- 🟠 HIGH **Hardcoded Secret (Admin Key) and Debugger in Production Code** — `index.js:39-50`

### 🔍 Needs investigation (evidence could not be verified)

These are leads, not confirmed defects — the cited code could not be located exactly. Verify manually before acting.

- 🟠 HIGH **Extreme code duplication — 60 nearly identical handler functions** — `src/legacy-monolith.js:1-1330` (confidence 35%)

## Security (15)

### 🔴 CRITICAL Arbitrary Code Execution via eval() in run_user_script()

**Priority 9.5 · confidence 95% · effort moderate · source deterministic**

> `server/auth.py:7-10`

Python eval/exec turn strings into running code — a direct injection sink when any part of the input is user-influenced.

1 occurrence in server/auth.py:9

---
(agent:bench-a) The `run_user_script` function passes user-controlled input directly to `eval()`, allowing arbitrary Python code execution. This is a critical remote code execution vulnerability if this function is exposed to untrusted input.

```
def run_user_script(user_input):
    # executes whatever the caller passes — classic eval sink
    return eval(user_input)
```

**Fix:** Replace with explicit parsing (ast.literal_eval for data), or validate input strictly and document why dynamic execution is required.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🔴 CRITICAL Arbitrary Code Execution via eval() in unsafeJsonParse()

**Priority 9.5 · confidence 95% · effort moderate · source deterministic**

> `src/payment.ts:15-18`

Dynamic code execution is an injection sink: any attacker-controlled string that reaches here becomes arbitrary code execution.

1 occurrence in src/payment.ts:17

---
(agent:bench-a) The `unsafeJsonParse` function uses `eval()` to parse JSON, which executes arbitrary JavaScript code in the input string. Combined with the unsafe type assertion `as PaymentRow[]`, this is a critical RCE vulnerability if untrusted input reaches this function.

```
function unsafeJsonParse(text: string): PaymentRow[] {
  // trusts any input shape at runtime
  return eval('(' + text + ')') as PaymentRow[];
}
```

**Fix:** Replace with explicit parsing/logic. If input must be trusted, validate strictly and document why eval is required.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🔴 CRITICAL Command Injection via User-Controlled Input in exec()

**Priority 9.0 · confidence 95% · effort moderate · source agent:bench-a**

> `index.js:11-17`

User-supplied `req.query.name` is directly concatenated into a shell command without any validation or sanitization. An attacker can inject arbitrary commands via shell metacharacters (e.g., `name=legit.png; rm -rf /`).

> Validation: cited 11-16 does not contain the snippet — actual lines are 11-17; citation corrected

```
function previewFile(req, res) {
  const name = req.query.name;
  exec('convert ' + name + ' preview.png', (err) => {
    if (err) { }
    res.send('done');
  });
}
```

**Fix:** Use `execFile` with an argument array instead of string concatenation, or validate/sanitize the filename against a strict allowlist.

**Benefit:** Eliminates arbitrary command execution vulnerability.

**Regression risk:** Full server compromise if exploited.

> ⚠️ Evidence adjusted: cited 11-16 does not contain the snippet — actual lines are 11-17; citation corrected

---

### 🔴 CRITICAL Hardcoded admin secret 'hunter2' in /admin endpoint

**Priority 8.6 · confidence 95% · effort moderate · source model:bench-a**

> `index.js:42-42`

The /admin endpoint compares the user-supplied admin_key against the hardcoded string 'hunter2'. This is a trivial backdoor password.

> Validation: cited 41-41 does not contain the snippet — actual lines are 42-42; citation corrected

```
if (key === 'hunter2') {
```

**Fix:** Remove the hardcoded secret. Use proper authentication (e.g., JWT, session, or at minimum an environment variable with a strong random value).

**Benefit:** Eliminates a trivial authentication bypass.

**Regression risk:** Low — the endpoint appears to be a test fixture; replacing with env var is straightforward.

> ⚠️ Evidence adjusted: cited 41-41 does not contain the snippet — actual lines are 42-42; citation corrected

---

### 🔴 CRITICAL unsafeJsonParse uses eval with unsafe cast

**Priority 8.6 · confidence 95% · effort moderate · source model:bench-a**

> `src/payment.ts:14-18`

The function passes arbitrary user-controlled string to `eval`, enabling arbitrary code execution. The TypeScript cast `as PaymentRow[]` provides no runtime safety.

> Validation: cited 14-17 does not contain the snippet — actual lines are 14-18; citation corrected

```
function unsafeJsonParse(text: string): PaymentRow[] {
  // trusts any input shape at runtime
  return eval('(' + text + ')') as PaymentRow[];
}
```

**Fix:** Replace with `JSON.parse(text)` and validate the resulting structure with a schema validator (e.g., zod, io-ts) or manual checks.

**Benefit:** Eliminates arbitrary code execution vulnerability.

**Regression risk:** Low — JSON.parse is a drop-in replacement for valid JSON input.

> ⚠️ Evidence adjusted: cited 14-17 does not contain the snippet — actual lines are 14-18; citation corrected

---

### 🔴 CRITICAL findPayments constructs SQL via string concatenation — SQL injection

**Priority 8.6 · confidence 95% · effort moderate · source model:bench-a**

> `src/payment.ts:8-13`

The `customerId` parameter is directly concatenated into the SQL string without sanitization or parameterization, allowing SQL injection.

> Validation: cited 8-11 does not contain the snippet — actual lines are 8-13; citation corrected

---
(agent:bench-a) The `customerId` parameter is directly concatenated into the SQL query string without parameterization. An attacker can inject arbitrary SQL (e.g., `customerId = '1; DROP TABLE payments;--'`).

> Validation: cited 9-12 does not contain the snippet — actual lines are 8-13; citation corrected

```
function findPayments(customerId: string, db: { query: (sql: string) => PaymentRow[] }): PaymentRow[] {
  // TODO: parameterize — customerId flows straight into the SQL string
  const sql = 'SELECT * FROM payments WHERE customer_id = ' + customerId;
  return db.query(sql);
}
```

**Fix:** Use parameterized queries: `db.query('SELECT * FROM payments WHERE customer_id = ?', [customerId])` or the equivalent for the underlying database driver.

**Benefit:** Eliminates SQL injection vulnerability.

**Regression risk:** Low — requires DB driver support for parameters; standard practice.

> ⚠️ Evidence adjusted: cited 8-11 does not contain the snippet — actual lines are 8-13; citation corrected

---

### 🔴 CRITICAL GitHub personal access token committed

**Priority 8.6 · confidence 95% · effort trivial · source deterministic**

> `server/auth.py:5-5`

Matched pattern `github-pat` in server/auth.py:5. This looks like a real credential (value redacted in this report). Rotate the secret and move it to an environment variable or secret manager.

---
(agent:bench-a) A GitHub token (redacted in the fixture but representing a real credential pattern) is hardcoded in source code. This would be committed to version control and exposed to anyone with repo access.

```
API_TOKEN = "[REDACTED github-token #3543c50b]"
```

**Fix:** Remove the literal, rotate the credential, load from process env / secret store, and scrub git history if committed.

**Benefit:** Eliminates a directly exploitable credential leak.

**Regression risk:** Low — mechanical replacement plus key rotation; verify dependent services after rotation.

Model verdicts: dismiss (model:bench-a)

> ⚠️ A model suggested dismissing this finding (openrouter|openrouter.ai/api|nvidia/nemotron-3-ultra-550b-a55b:free). Critical/high/security findings are never auto-removed — the analyzer evidence and the verdict history are both kept for your judgment.

---

### 🔴 CRITICAL AWS access key ID committed

**Priority 7.3 · confidence 81% · effort trivial · source deterministic**

> `index.js:8-8`

Matched pattern `aws-key` in index.js:8. This looks like a real credential (value redacted in this report). Rotate the secret and move it to an environment variable or secret manager.

```
const AWS_KEY = '[REDACTED aws-key #54c83e8f]';
```

**Fix:** Remove the literal, rotate the credential, load from process env / secret store, and scrub git history if committed.

**Benefit:** Eliminates a directly exploitable credential leak.

**Regression risk:** Low — mechanical replacement plus key rotation; verify dependent services after rotation.

Model verdicts: dismiss (model:bench-a)

> ⚠️ A model suggested dismissing this finding (openrouter|openrouter.ai/api|nvidia/nemotron-3-ultra-550b-a55b:free). Critical/high/security findings are never auto-removed — the analyzer evidence and the verdict history are both kept for your judgment.

---

### 🟠 HIGH Hardcoded Secret (Admin Key) and Debugger in Production Code

**Priority 6.3 · confidence 95% · effort moderate · source agent:bench-a**

> `index.js:39-50`

Multiple issues: (1) Hardcoded admin password 'hunter2' in source code. (2) `debugger;` statement left in production code — pauses execution if DevTools is attached. (3) XSS: user-controlled `key` is interpolated into HTML response via `JSON.stringify` but placed inside a `<script>` tag without proper context-aware escaping. (4) Internal URL `http://status.internal-site.example/403` leaked in 403 response.

> Validation: cited 40-46 does not contain the snippet — actual lines are 39-50; citation corrected

```
app.post('/admin', (req, res) => {
  const key = req.body.admin_key;
  if (key === 'hunter2') {
    debugger;
    document = req.body.html;  // placeholder for the real template below
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<div id="out"></div><script>document.getElementById("out").innerHTML = ' + JSON.stringify(key) + ';</script>');
  } else {
    res.status(403).send('http://status.internal-site.example/403');
  }
}
```

**Fix:** Store secrets in environment variables. Remove `debugger;`. Use a template engine with auto-escaping or set `Content-Type: application/json` and return JSON. Do not expose internal infrastructure URLs.

**Benefit:** Prevents credential leakage, XSS, and information disclosure.

**Regression risk:** Admin bypass, XSS attacks, internal topology exposure.

> ⚠️ Evidence adjusted: cited 40-46 does not contain the snippet — actual lines are 39-50; citation corrected

---

### 🟠 HIGH child_process call with interpolated/concatenated command

**Priority 6.3 · confidence 90% · effort moderate · source deterministic**

> `index.js:13-13`

Building shell commands from variables allows command injection when any part of the string is user-influenced.

1 occurrence in index.js:13

```
exec('convert ' + name + ' preview.png', (err) => {
```

**Fix:** Use execFile/spawn with an argument array so values are never interpreted by a shell; validate or allow-list any dynamic parts.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🟠 HIGH SQL query built via string concatenation/interpolation

**Priority 6.3 · confidence 90% · effort moderate · source deterministic**

> `src/payment.ts:11-11`

Concatenated SQL is the classic injection vector — query structure is data-dependent.

1 occurrence in src/payment.ts:11

```
const sql = 'SELECT * FROM payments WHERE customer_id = ' + customerId;
```

**Fix:** Use parameterized queries / prepared statements with bound parameters.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🟠 HIGH .env file present and tracked by git

**Priority 4.8 · confidence 77% · effort trivial · source deterministic**

> `.env`

.env exists and is committed. Environment files frequently contain secrets and are easy to leak via zip archives, Docker contexts, or accidental commits. Contents are redacted from all reports and prompts.

**Fix:** Keep only .env.example in the repository; load real values from the environment. If tracked, remove it from the index and add .env to .gitignore.

**Benefit:** Removes a common accidental leak vector.

**Regression risk:** Low — ensure local deployments still find their configuration.

Model verdicts: dismiss (model:bench-a)

> ⚠️ A model suggested dismissing this finding (openrouter|openrouter.ai/api|nvidia/nemotron-3-ultra-550b-a55b:free). Critical/high/security findings are never auto-removed — the analyzer evidence and the verdict history are both kept for your judgment.

---

### 🟡 MEDIUM Raw HTML injection sink (innerHTML / dangerouslySetInnerHTML)

**Priority 3.6 · confidence 90% · effort moderate · source deterministic**

> `index.js:46-46`

Assigning HTML strings can inject scripts when the content includes any user-derived data.

1 occurrence in index.js:46

```
res.end('<div id="out"></div><script>document.getElementById("out").innerHTML = ' + JSON.stringify(key) + ';</script>');
```

**Fix:** Prefer textContent or framework escaping. If HTML must be trusted, sanitize it explicitly and document the trust boundary.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🔵 LOW Insecure http:// endpoint in source

**Priority 1.8 · confidence 90% · effort trivial · source deterministic**

> `index.js:48-48`

Plain HTTP endpoints leak data in transit and enable MITM; also commonly a leftover dev URL.

1 occurrence in index.js:48

```
res.status(403).send('http://status.internal-site.example/403');
```

**Fix:** Switch to https://, or to a localhost/dev URL, and load production endpoints from configuration.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🔵 LOW Insecure http:// endpoint in source

**Priority 1.8 · confidence 90% · effort trivial · source deterministic**

> `server/auth.py:29-29`

Plain HTTP endpoints leak data in transit and enable MITM; also commonly a leftover dev URL.

1 occurrence in server/auth.py:29

```
return requests.post("http://payments-legacy.internal/charge", json={"amount": amount})
```

**Fix:** Switch to https://, or to a localhost/dev URL, and load production endpoints from configuration.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

## Bug (11)

### 🟠 HIGH Dead code in all 60 legacy-monolith handlers — if (!data) branch never executes

**Priority 6.3 · confidence 95% · effort moderate · source model:bench-a**

> `src/legacy-monolith.js:7-18`

Every handler assigns `data = ROUTES[cacheKey] || {...}` which always yields a truthy object, then checks `if (!data)`. The condition is never true, so the entire nested block (lines 9-17) is dead code. The else branch (line 18) always runs.

```
const data = ROUTES[cacheKey] || { id, mode, stamped: Date.now() };
  ROUTES[cacheKey] = data;
  if (!data) {
```

**Fix:** Remove the dead if (!data) block and keep only the else branch, or fix the logic if the intent was to check cache miss before assignment.

**Benefit:** Eliminates 60× ~10 lines of dead code; clarifies control flow; avoids future maintenance confusion.

**Regression risk:** Low — the dead code is provably unreachable. Removing it cannot change behavior.

---

### 🟡 MEDIUM Implicit global variable 'document' assigned in /admin endpoint

**Priority 3.6 · confidence 95% · effort moderate · source model:bench-a**

> `index.js:44-44`

The assignment `document = req.body.html` lacks `var`, `let`, or `const`, creating an implicit global variable in non-strict mode. This pollutes the global scope and can cause unpredictable behavior.

```
document = req.body.html;  // placeholder for the real template below
```

**Fix:** Add `const` or `let` (or remove the line if it's truly a placeholder).

**Benefit:** Prevents global namespace pollution and potential conflicts.

**Regression risk:** Low — trivial fix.

---

### 🟡 MEDIUM save_config in auth.py leaks file handle on write error

**Priority 3.6 · confidence 95% · effort moderate · source model:bench-a**

> `server/auth.py:20-24`

If `fh.write(data)` raises an exception, `fh.close()` is never called, leaking the file descriptor. The function also lacks a `with` statement.

---
(agent:bench-a) If `fh.write(data)` raises an exception, `fh.close()` is never called, leaking a file descriptor. The `with` statement (context manager) ensures proper cleanup.

```
def save_config(path, data):
    fh = open(path, "w")
    fh.write(data)
    fh.close()
```

**Fix:** Use `with open(path, 'w') as fh: fh.write(data)` to ensure the file is closed even on error.

**Benefit:** Prevents file descriptor leaks; follows Python best practices.

**Regression risk:** Low — straightforward refactor.

---

### 🟡 MEDIUM load_config returns None on any exception, masking failures

**Priority 3.6 · confidence 95% · effort moderate · source model:bench-a**

> `server/auth.py:12-17`

The bare `except: pass` catches all exceptions (including KeyboardInterrupt) and implicitly returns `None`. Callers expecting a string may crash later with AttributeError.

---
(agent:bench-a) The bare `except:` catches all exceptions including `KeyboardInterrupt`, `SystemExit`, and `MemoryError`, then silently passes. This makes debugging impossible and can prevent graceful shutdown.

```
def load_config(path):
    try:
        with open(path) as fh:
            return fh.read()
    except:
        pass
```

**Fix:** Catch specific exceptions (e.g., FileNotFoundError, PermissionError) and either re-raise or return a sentinel value; log the error.

**Benefit:** Makes failure modes explicit; avoids silent None propagation.

**Regression risk:** Low — but callers must be audited for None handling.

---

### 🟡 MEDIUM Swallowed Error in exec() Callback

**Priority 3.6 · confidence 95% · effort moderate · source agent:bench-a**

> `index.js:13-16`

The `exec` callback catches errors but does nothing with them — not even logging. The response always sends 'done' regardless of success or failure, masking failures and making debugging impossible.

> Validation: cited 13-15 does not contain the snippet — actual lines are 13-16; citation corrected

```
exec('convert ' + name + ' preview.png', (err) => {
    if (err) { }
    res.send('done');
  });
```

**Fix:** Handle the error: log it, return a 5xx status, and avoid sending a success response on failure.

**Benefit:** Observability and correct error semantics.

**Regression risk:** Silent failures hide operational issues.

> ⚠️ Evidence adjusted: cited 13-15 does not contain the snippet — actual lines are 13-16; citation corrected

---

### 🟡 MEDIUM Empty or comment-only catch block swallows errors

**Priority 3.6 · confidence 90% · effort trivial · source deterministic**

> `index.js:35-35`

An error is caught and discarded. Failures become silent data corruption or missing side effects that surface far from the cause.

1 occurrence in index.js:35

```
} catch (e) {
```

**Fix:** Handle the error, rethrow with context, or at minimum log it with enough detail to debug. If the exception truly cannot occur, assert that explicitly.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🟡 MEDIUM except block that passes silently

**Priority 3.6 · confidence 90% · effort trivial · source deterministic**

> `server/auth.py:16-16`

An exception is caught and ignored. This hides real failures and makes debugging painful.

1 occurrence in server/auth.py:16

```
except:
```

**Fix:** Narrow the exception type, log or re-raise, and handle what can actually be handled.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🟡 MEDIUM loadRows swallows all errors and returns empty array

**Priority 3.4 · confidence 95% · effort moderate · source model:bench-a**

> `index.js:30-38`

The try/catch block catches any exception (including module not found, query errors, etc.) and silently returns an empty array. Callers cannot distinguish between 'no rows' and 'catastrophic failure'.

> Validation: cited 30-36 does not contain the snippet — actual lines are 30-38; citation corrected

---
(agent:bench-a) The try-catch block catches all exceptions and silently ignores them, returning an empty array. This masks database errors, connection issues, or schema problems, making the endpoint appear to succeed with no data.

```
function loadRows(customer) {
  const data = JSON.parse(JSON.stringify({ customer }));
  try {
    return require('./store').query(data);
  } catch (e) {
  }
  return [];
}
```

**Fix:** Either let the exception propagate (and handle at a higher level with proper error responses) or at minimum log the error and return a 500 response.

**Benefit:** Improves observability and error handling; prevents silent data loss.

**Regression risk:** Low — changing error behavior may affect callers; should be paired with proper error-handling middleware.

> ⚠️ Evidence adjusted: cited 30-36 does not contain the snippet — actual lines are 30-38; citation corrected

---

### 🟡 MEDIUM Missing Idempotency Key in Payment Charge Function

**Priority 3.2 · confidence 80% · effort moderate · source agent:bench-a**

> `server/auth.py:26-29`

The `charge` function sends a payment request without an idempotency key. If the client retries (due to timeout or network error), the payment may be processed twice.

```
def charge(amount):
    # FIXME: no idempotency key — double charges on retry
    import requests
    return requests.post("http://payments-legacy.internal/charge", json={"amount": amount})
```

**Fix:** Generate and pass an idempotency key (e.g., UUID) with each charge request. Store the key server-side to deduplicate.

**Benefit:** Prevents duplicate charges on retry.

**Regression risk:** Financial loss and customer trust issues.

---

### 🔵 LOW `debugger` statement left in code

**Priority 1.8 · confidence 90% · effort trivial · source deterministic**

> `index.js:43-43`

Halts execution in any browser that has DevTools open; also signals leftover debugging.

1 occurrence in index.js:43

```
debugger;
```

**Fix:** Remove the statement; use breakpoints in the devtools instead.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🔵 LOW Bare `except:` catches everything (including KeyboardInterrupt/SystemExit)

**Priority 1.8 · confidence 90% · effort trivial · source deterministic**

> `server/auth.py:16-16`

Bare excepts make programs unkillable and mask unrelated bugs.

1 occurrence in server/auth.py:16

```
except:
```

**Fix:** Catch the narrowest exception you can actually handle.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

## Duplication (3)

### 🟡 MEDIUM Duplicated renderInvoice Function Across src/utils.js and src/helpers.js

**Priority 3.8 · confidence 95% · effort moderate · source agent:bench-a**

> `src/utils.js:2-31`

The `renderInvoice` function (30 lines) is copy-pasted verbatim between `src/utils.js` and `src/helpers.js`. Any bug fix or feature change must be applied in both places. `src/helpers.js` even has a wrapper `reRender` that just calls the duplicated function.

```
function renderInvoice(invoice) {
  const header = 'INVOICE ' + invoice.id;
  const lines = [];
  lines.push('Customer: ' + invoice.customer.name);
  lines.push('Billing address: ' + invoice.customer.address);
  lines.push('Date: ' + new Date(invoice.date).toISOString());
  lines.push('Due date: ' + new Date(invoice.dueDate).toISOString());
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of invoice.items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const lineTotal = qty * price;
    subtotal += lineTotal;
    taxTotal += lineTotal * (item.taxRate ?? 0.19);
    lines.push(`${qty} x ${item.name} @ ${price.toFixed(2)} = ${lineTotal.toFixed(2)}`);
  }
  const shipping = Number(invoice.shipping) || 0;
  subtotal += shipping;
  const total = subtotal + taxTotal;
  lines.push(`Subtotal: ${subtotal.toFixed(2)}`);
  lines.push(`Tax: ${taxTotal.toFixed(2)}`);
  lines.push(`Shipping: ${shipping.toFixed(2)}`);
  lines.push(`TOTAL DUE: ${total.toFixed(2)}`);
  if (invoice.notes) {
    lines.push('Notes: ' + invoice.notes);
  }
  lines.push(`Payment terms: net ${invoice.terms ?? 30}`);
  lines.push('Please quote reference ' + header);
```

**Fix:** Keep the implementation in one module (e.g., `src/utils.js`) and re-export from the other, or have `src/helpers.js` import from `src/utils.js`.

**Benefit:** Single source of truth; eliminates drift risk.

**Regression risk:** Inconsistent behavior if one copy is updated and the other isn't.

---

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

Model verdicts: confirm (model:bench-a)

---

### 🟠 HIGH Extreme code duplication — 60 nearly identical handler functions

**Priority 2.3 · confidence 35% · effort moderate · source model:bench-a**

> `src/legacy-monolith.js:1-1330`

The file contains 60 handler functions (handler0 through handler59) that differ only in the numeric suffix used in the cache key prefix ('k0:', 'k1:', ...) and the default mode string ('standard0', 'standard1', ...). This is massive copy-paste duplication.

> Validation: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

---
(agent:bench-a) The file contains 60 handler functions (handler0 through handler59) that are identical except for a numeric suffix in the cache key prefix and default mode string. This is extreme copy-paste duplication — any bug fix or change must be applied 60 times.

> Validation: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

```
function handler0(req, res) {
  const id = req.params.id;
  const mode = req.query.mode || 'standard0';
  const cacheKey = 'k0:' + id + ':' + mode;
  const data = ROUTES[cacheKey] || { id, mode, stamped: Date.now() };
  ROUTES[cacheKey] = data;
  if (!data) {
      const nested = { ...data, id, mode };
      if (nested && nested.id) {
          if (nested.mode) {
              res.json(nested);
          } else {
              res.json({});
          }
      } else {
          res.json({});
      }
  } else {
    res.json(data);
  }
}
// ... repeated 59 more times with only the numeric suffix changing
```

**Fix:** Replace with a single factory function `createHandler(prefix, defaultMode)` that returns the handler closure. Export an array or map of handlers generated in a loop.

**Benefit:** Reduces file from 1,330 lines to ~50 lines; eliminates duplication; makes future changes trivial; fixes the dead-code bug in one place.

**Regression risk:** Medium — requires verifying that all 60 routes are wired correctly after refactor. Test coverage should be added first.

> ⚠️ Evidence unverified: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

---

## Debt (12)

### 🟡 MEDIUM No lockfile committed

**Priority 3.6 · confidence 95% · effort moderate · source model:bench-a**

> `package.json:1-19`

No package-lock.json or yarn.lock is present in the repository. This means dependency versions are not locked, leading to non-reproducible installs.

```
{
  "name": "vulnerable-app",
  "version": "1.0.0",
  "private": true,
  "description": "Deliberately flawed fixture app used to test code-audit",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "latest",
    "lodash": "*",
    "left-pad": "1.0.0"
  },
  "devDependencies": {
    "lodash": "4.17.21"
  }
}
```

**Fix:** Run `npm install` to generate package-lock.json and commit it.

**Benefit:** Reproducible builds across environments and CI.

**Regression risk:** None.

---

### 🟡 MEDIUM 1 FIXME marker in index.js

**Priority 3.6 · confidence 90% · effort moderate · source deterministic**

> `index.js:10-10`

Signals known broken/unfinished behavior — high-value to resolve.
Occurrences: L10: // FIXME: user-supplied filename is passed straight into a shell

```
// FIXME: user-supplied filename is passed straight into a shell
```

**Fix:** Treat as a defect backlog: reproduce, fix, and add a regression test before closing the marker.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

Model verdicts: confirm (model:bench-a)

---

### 🟡 MEDIUM 1 FIXME marker in auth.py

**Priority 3.6 · confidence 90% · effort moderate · source deterministic**

> `server/auth.py:27-27`

Signals known broken/unfinished behavior — high-value to resolve.
Occurrences: L27: # FIXME: no idempotency key — double charges on retry

```
# FIXME: no idempotency key — double charges on retry
```

**Fix:** Treat as a defect backlog: reproduce, fix, and add a regression test before closing the marker.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

Model verdicts: confirm (model:bench-a)

---

### 🟡 MEDIUM Dependency hygiene issues in package.json (3)

**Priority 3.6 · confidence 90% · effort trivial · source deterministic**

> `package.json`

- **express** `latest`: production dependency pinned to "*" / "latest" — builds are non-reproducible
- **lodash** `*`: production dependency pinned to "*" / "latest" — builds are non-reproducible
- **lodash** `* / 4.17.21`: same package in dependencies and devDependencies

**Fix:** Pin exact versions (lockfiles for npm/cargo; `==` pins or constraints.txt for pip) and audit ranges deliberately when upgrading.

**Benefit:** Reproducible builds and no surprise breaking upgrades.

**Regression risk:** Low — pinning alone changes no runtime behavior.

Model verdicts: confirm (model:bench-a)

---

### 🟡 MEDIUM No lockfile committed next to package.json

**Priority 3.6 · confidence 90% · effort trivial · source deterministic**

> `package.json`

Without a lockfile, every `npm install` resolves fresh versions — CI, teammates, and production can drift apart silently.

**Fix:** Commit the lockfile matching your package manager (npm/yarn/pnpm) and install with `npm ci` in CI.

**Benefit:** Identical dependency trees everywhere; fewer "works on my machine" failures.

**Regression risk:** None — adding a lockfile is additive.

Model verdicts: confirm (model:bench-a)

---

### 🟡 MEDIUM Dependency hygiene: 'latest', '*', and duplicate lodash

**Priority 3.4 · confidence 95% · effort moderate · source model:bench-a**

> `package.json:10-17`

Using 'latest' and '*' version ranges makes builds non-reproducible and can pull breaking changes. lodash appears in both dependencies and devDependencies with different version specs.

> Validation: cited 10-16 does not contain the snippet — actual lines are 10-17; citation corrected

```
"dependencies": {
    "express": "latest",
    "lodash": "*",
    "left-pad": "1.0.0"
  },
  "devDependencies": {
    "lodash": "4.17.21"
  }
```

**Fix:** Pin all dependencies to exact versions (or caret ranges). Remove duplicate lodash from devDependencies if not needed separately. Add a lockfile.

**Benefit:** Reproducible builds; security auditability; avoids surprise breakages.

**Regression risk:** Low — standard dependency management.

> ⚠️ Evidence adjusted: cited 10-16 does not contain the snippet — actual lines are 10-17; citation corrected

---

### 🔵 LOW Orphan module src/orphan.js exports unused legacyTax function

**Priority 1.8 · confidence 95% · effort moderate · source model:bench-a**

> `src/orphan.js:1-9`

The module is not imported anywhere (confirmed by summary and excerpts). It contains outdated tax logic (22% rate) marked with XXX.

---
(agent:bench-a) The `src/orphan.js` module exports `legacyTax` but is not imported by any other file in the codebase. The comment indicates it's legacy code kept "just in case." Dead code increases maintenance surface and can confuse developers.

```
// Fixture: orphan module — nothing imports it.
function legacyTax(amount) {
  // XXX: pre-2019 tax table, kept "just in case"
  if (amount < 0) throw new Error('negative amount');
  return Math.round(amount * 1.22 * 100) / 100;
}

module.exports = { legacyTax };
```

**Fix:** Delete the file if truly unused, or integrate into the active codebase with proper tests and configuration.

**Benefit:** Reduces codebase surface area; removes dead code.

**Regression risk:** Low — verify no dynamic requires or external references.

---

### 🔵 LOW 6 TODO markers in legacy-monolith.js

**Priority 1.8 · confidence 90% · effort moderate · source deterministic**

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

Model verdicts: confirm (model:bench-a)

---

### 🔵 LOW 1 TODO marker in auth.py

**Priority 1.8 · confidence 90% · effort moderate · source deterministic**

> `server/auth.py:4-4`

Deferred work; batch these into planned refactors.
Occurrences: L4: # TODO: move config to the environment loader

```
# TODO: move config to the environment loader
```

**Fix:** Schedule cleanup; convert vague notes into tracked issues with owners.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

Model verdicts: confirm (model:bench-a)

---

### 🔵 LOW 1 TODO marker in payment.ts

**Priority 1.8 · confidence 90% · effort moderate · source deterministic**

> `src/payment.ts:10-10`

Deferred work; batch these into planned refactors.
Occurrences: L10: // TODO: parameterize — customerId flows straight into the SQL string

```
// TODO: parameterize — customerId flows straight into the SQL string
```

**Fix:** Schedule cleanup; convert vague notes into tracked issues with owners.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

Model verdicts: confirm (model:bench-a)

---

### 🔵 LOW Multiple debug console.log statements left in production code path

**Priority 1.7 · confidence 95% · effort moderate · source model:bench-a**

> `index.js:24-26`

Three consecutive debug log statements inside the /render route handler. These are clearly leftovers from development.

> Validation: cited 23-25 does not contain the snippet — actual lines are 24-26; citation corrected

```
console.log('debug marker 1');
    console.log('debug marker 2');
    console.log('debug marker 3');
```

**Fix:** Remove the debug log lines.

**Benefit:** Reduces log noise and minor performance overhead.

**Regression risk:** None.

> ⚠️ Evidence adjusted: cited 23-25 does not contain the snippet — actual lines are 24-26; citation corrected

---

### ⚪ INFO 1 XXX marker in orphan.js

**Priority 0.9 · confidence 90% · effort moderate · source deterministic**

> `src/orphan.js:3-3`

Attention marker.
Occurrences: L3: // XXX: pre-2019 tax table, kept "just in case"

```
// XXX: pre-2019 tax table, kept "just in case"
```

**Fix:** Schedule cleanup; convert vague notes into tracked issues with owners.

**Benefit:** Reduces hidden known-issue risk and makes deferred work visible.

**Regression risk:** Minimal — resolving markers is behavior-preserving when paired with tests.

Model verdicts: confirm (model:bench-a)

---

## Performance (3)

### 🟡 MEDIUM Sequential Awaits in Loop Causing Performance Degradation

**Priority 3.6 · confidence 95% · effort moderate · source agent:bench-a**

> `index.js:18-29`

The `/render` endpoint awaits `renderInvoice` sequentially inside a for-loop. For N invoices, total latency is N × renderInvoice latency. This can be parallelized with `Promise.all`.

> Validation: cited 19-27 does not contain the snippet — actual lines are 18-29; citation corrected

```
app.get('/render', async (req, res) => {
  const rows = await loadRows(req.query.customer);
  for (const row of rows) {
    await renderInvoice(row);   // sequential awaits in a loop
    console.log('rendered', row.id);
    console.log('debug marker 1');
    console.log('debug marker 2');
    console.log('debug marker 3');
  }
  res.send('ok');
});
```

**Fix:** Replace the loop with `await Promise.all(rows.map(renderInvoice))` (or use a concurrency limiter if needed).

**Benefit:** Reduces endpoint latency from O(N) to O(1) wall-clock time.

**Regression risk:** Unbounded parallelism could exhaust resources; add a concurrency limit (e.g., p-limit).

> ⚠️ Evidence adjusted: cited 19-27 does not contain the snippet — actual lines are 18-29; citation corrected

---

### 🟡 MEDIUM Sequential await inside a loop

**Priority 3.6 · confidence 90% · effort moderate · source deterministic**

> `index.js:21-21`

Round-trips executed one at a time — latency adds up linearly with loop size.

1 occurrence in index.js:21

```
for (const row of rows) {
```

**Fix:** Batch independent work with Promise.all / a bounded concurrency pool. Only keep sequential awaits when iteration N depends on N-1.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🔵 LOW JSON.parse(JSON.stringify(...)) used as deep clone

**Priority 1.8 · confidence 90% · effort trivial · source deterministic**

> `index.js:32-32`

Slow, throws on Dates/Maps/Sets/undefined, loses prototypes. Fine for tiny JSON-safe objects, costly in hot paths.

1 occurrence in index.js:32

```
const data = JSON.parse(JSON.stringify({ customer }));
```

**Fix:** Use structuredClone() (Node ≥17, browsers ≥2022) or a purpose-built clone for the shape involved.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

## Refactoring (5)

### 🟡 MEDIUM Oversized file: legacy-monolith.js is 1,330 lines

**Priority 3.6 · confidence 90% · effort large · source deterministic**

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

Model verdicts: confirm (model:bench-a)

---

### 🟡 MEDIUM Import cycle (2 modules): a.js → b.js → a.js

**Priority 3.6 · confidence 90% · effort large · source deterministic**

> `src/lib/a.js`

Circular import chain: src/lib/a.js → src/lib/b.js → src/lib/a.js. Cycles cause initialization-order bugs (undefined imports at runtime), prevent clean layering, and make the modules impossible to test in isolation.

**Fix:** Break the cycle by extracting the shared piece into a third module, or invert one dependency via dependency injection / event callbacks.

**Benefit:** Deterministic module initialization and clean layering.

**Regression risk:** Moderate — moving code between modules can shift initialization order; run the full test suite after.

Model verdicts: confirm (model:bench-a)

---

### 🟡 MEDIUM Import cycle between src/lib/a.js and src/lib/b.js

**Priority 3.4 · confidence 95% · effort moderate · source model:bench-a**

> `src/lib/a.js:2-4`

a.js requires b.js, and the repository summary confirms b.js requires a.js, creating a circular dependency. This can cause initialization order issues and makes testing difficult.

> Validation: cited 1-3 does not contain the snippet — actual lines are 2-4; citation corrected

---
(agent:bench-a) `src/lib/a.js` imports `shared` from `b.js`, while `b.js` imports `validate` from `a.js`, creating a circular dependency. Node.js handles this by returning a partially initialized module, but it can cause subtle bugs if either module accesses the other's exports during initialization.

> Validation: cited 1-8 does not contain the snippet — actual lines are 1-11; citation corrected

```
const { shared } = require('./b.js');

function validate(config) {
```

**Fix:** Extract the shared dependency into a third module (e.g., src/lib/shared.js) that both a.js and b.js import, breaking the cycle.

**Benefit:** Eliminates circular dependency; improves modularity and testability.

**Regression risk:** Medium — requires changes to both files and verifying initialization order.

> ⚠️ Evidence adjusted: cited 1-3 does not contain the snippet — actual lines are 2-4; citation corrected

---

### 🔵 LOW Deep nesting (≈7 levels) in legacy-monolith.js

**Priority 1.6 · confidence 81% · effort large · source deterministic**

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

Model verdicts: confirm (model:bench-a)

---

### ⚪ INFO 4 source files have no incoming imports

**Priority 0.8 · confidence 81% · effort large · source deterministic**

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

Model verdicts: confirm (model:bench-a)

---


## Coverage & limitations

- Walked **12** file(s); deterministic analysis covered **9** source file(s), 12 text file(s) in total.
- Standing limitations: static pattern analysis only (no code execution); secret detection is heuristic; the audit does not claim full semantic coverage of the codebase.
## Verification & method

- Evidence validation: **37** verified (verbatim snippet located inside the cited range), **11** adjusted (citation corrected to the snippet's real lines), **1** unverified (kept, flagged, down-weighted), **0** dropped before reporting.
- Verdict policy: model dismissals move findings to a visible "model-dismissed" group; critical/high/security findings are never auto-removed. This run: 0 dismissed, 3 contested.
- Secret handling: credential-like literals matched by the secret scan are replaced with type-preserving placeholders in this report and in all model prompts
- Deterministic checks executed: secrets (3), debt-markers (6), duplication (1), size (2), quality (13), deps (2), graph (2), ast-grep (0).
- Model runs:
  - bench-a (nvidia/nemotron-3-ultra-550b-a55b:free) · structured · native · 2m 18s · 13946/8363 tokens — ok
  - bench-a (nvidia/nemotron-3-ultra-550b-a55b:free) · autonomous · native · 2m 22s · 107722/6058 tokens — ok · finished: submitted

### Model notes

> bench-a: The repository is a deliberately flawed fixture app designed to test code-audit tools. Most findings are planted issues. The two 'secrets' findings are false positives — the keys are redacted placeholders. The .env finding appears to be a false positive as no .env file exists in the provided sources. The most impactful real issues are: (1) command injection in index.js:13, (2) SQL injection in payment.ts:11, (3) eval() in auth.py:9 and payment.ts:17, (4) hardcoded admin password 'hunter2', (5) massive duplication and dead code in legacy-monolith.js, (6) missing lockfile and loose dependency versions. The import cycle in src/lib is a maintainability concern. Several Python functions have poor error handling (bare except, silent failures). The orphan module and debug logs are low-priority cleanup items.

> bench-a (autonomous): This repository appears to be a deliberately constructed fixture ("vulnerable-app") with numerous planted security vulnerabilities, code quality issues, and anti-patterns across JavaScript, TypeScript, and Python. The findings cover: critical RCE vectors (command injection, eval in Python and TypeScript, SQL injection), high-severity issues (hardcoded secrets, XSS, massive code duplication), medium-severity bugs (swallowed errors, performance anti-patterns, circular dependency, bare except, resource leaks), and low-severity debt (dead code). All findings are grounded in verbatim code snippets from the actual files.


---
Generated by `code-audit` v0.2.3 — read-only audit; no application files were modified. Exit-code policy: report-only (use --fail-on for CI gates).