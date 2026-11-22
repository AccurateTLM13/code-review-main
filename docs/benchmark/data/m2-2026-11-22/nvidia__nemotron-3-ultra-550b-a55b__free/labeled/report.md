# Code Audit Report

| | |
|---|---|
| **Repository** | E:\code\code-review-main\examples\vulnerable-app |
| **Branch / commit** | main @ 6d01630 |
| **Date** | 2026-11-22T22:29:27.739Z |
| **Mode** | deep audit · full scan |
| **Focus** | all |
| **Models** | bench-a (nvidia/nemotron-3-ultra-550b-a55b:free, native) |
| **Codebase** | 9 source files · 1,552 LOC · javascript, python, typescript |
| **Findings** | 51 (6 critical / 9 high / 21 medium / 13 low / 2 info) |

## Executive summary

The audit produced **51 findings**, prioritized below. The highest-priority items:

- 🔴 CRITICAL — **Arbitrary Code Execution via eval in unsafeJsonParse (TypeScript)** (src/payment.ts:15-18, confidence 95%)
- 🔴 CRITICAL — **Arbitrary Code Execution via eval in run_user_script (Python)** (server/auth.py:7-9, confidence 95%)
- 🔴 CRITICAL — **Command Injection in previewFile endpoint** (index.js:11-17, confidence 95%)
- 🔴 CRITICAL — **SQL Injection in findPayments (TypeScript)** (src/payment.ts:8-13, confidence 95%)
- 🔴 CRITICAL — **AWS access key ID committed** (index.js:8-8, confidence 81%)

11 finding(s) could not be fully verified against file contents and are marked accordingly — treat them as leads, not confirmed defects.

## Priority backlog

| # | Priority | Severity | Confidence | Category | Effort | Location | Issue |
|---|---|---|---|---|---|---|---|
| 1 | 9.5 | 🔴 CRITICAL | 95% | security | moderate | `src/payment.ts:15-18` | Arbitrary Code Execution via eval in unsafeJsonParse (TypeScript) |
| 2 | 9.5 | 🔴 CRITICAL | 95% | security | moderate | `server/auth.py:7-9` | Arbitrary Code Execution via eval in run_user_script (Python) |
| 3 | 9.0 | 🔴 CRITICAL | 95% | security | moderate | `index.js:11-17` | Command Injection in previewFile endpoint |
| 4 | 9.0 | 🔴 CRITICAL | 95% | security | moderate | `src/payment.ts:8-13` | SQL Injection in findPayments (TypeScript) |
| 5 | 7.3 | 🔴 CRITICAL | 81% | security | trivial | `index.js:8-8` | AWS access key ID committed |
| 6 | 7.3 | 🔴 CRITICAL | 81% | security | trivial | `server/auth.py:5-5` | GitHub personal access token committed |
| 7 | 6.7 | 🟠 HIGH | 95% | bug | moderate | `index.js:31-38` | Swallowed Exception in loadRows |
| 8 | 6.7 | 🟠 HIGH | 95% | bug | moderate | `server/auth.py:12-17` | Bare Except Clause Swallowing All Exceptions (Python) |
| 9 | 6.3 | 🟠 HIGH | 95% | security | moderate | `index.js:39-50` | Cross-Site Scripting (XSS) in /admin endpoint |
| 10 | 6.3 | 🟠 HIGH | 90% | security | moderate | `index.js:13-13` | child_process call with interpolated/concatenated command |
| 11 | 6.3 | 🟠 HIGH | 90% | security | moderate | `src/payment.ts:11-11` | SQL query built via string concatenation/interpolation |
| 12 | 6.3 | 🟠 HIGH | 90% | security | moderate | `index.js:8-8` | Hardcoded AWS Key and GitHub Token in Source Code |
| 13 | 6.0 | 🟠 HIGH | 95% | bug | moderate | `index.js:44-44` | Undeclared variable assignment creates global |
| 14 | 4.8 | 🟠 HIGH | 77% | security | trivial | `.env` | .env file present and tracked by git |
| 15 | 3.8 | 🟡 MEDIUM | 95% | duplication | moderate | `src/utils.js:2-31` | Duplicated renderInvoice Function in utils.js and helpers.js |
| 16 | 3.6 | 🟡 MEDIUM | 95% | bug | moderate | `server/auth.py:20-23` | File handle leak in save_config |
| 17 | 3.6 | 🟡 MEDIUM | 95% | security | moderate | `package.json:13-13` | Deprecated and vulnerable dependency left-pad |
| 18 | 3.6 | 🟡 MEDIUM | 95% | bug | moderate | `src/lib/a.js:1-9` | Import Cycle Between src/lib/a.js and src/lib/b.js |
| 19 | 3.6 | 🟡 MEDIUM | 95% | performance | moderate | `index.js:18-29` | Sequential Awaits in Loop (Performance Anti-Pattern) |
| 20 | 3.6 | 🟡 MEDIUM | 90% | debt | moderate | `index.js:10-10` | 1 FIXME marker in index.js |
| 21 | 3.6 | 🟡 MEDIUM | 90% | debt | moderate | `server/auth.py:27-27` | 1 FIXME marker in auth.py |
| 22 | 3.6 | 🟡 MEDIUM | 90% | duplication | moderate | `src/helpers.js:2-29` | 28-line block duplicated between helpers.js and utils.js |
| 23 | 3.6 | 🟡 MEDIUM | 90% | refactoring | large | `src/legacy-monolith.js:1-60` | Oversized file: legacy-monolith.js is 1,330 lines |
| 24 | 3.6 | 🟡 MEDIUM | 90% | bug | trivial | `index.js:35-35` | Empty or comment-only catch block swallows errors |
| 25 | 3.6 | 🟡 MEDIUM | 90% | security | moderate | `index.js:46-46` | Raw HTML injection sink (innerHTML / dangerouslySetInnerHTML) |
| 26 | 3.6 | 🟡 MEDIUM | 90% | performance | moderate | `index.js:21-21` | Sequential await inside a loop |
| 27 | 3.6 | 🟡 MEDIUM | 90% | bug | trivial | `server/auth.py:16-16` | except block that passes silently |
| 28 | 3.6 | 🟡 MEDIUM | 90% | security | moderate | `server/auth.py:9-9` | eval()/exec() executes dynamic code |
| 29 | 3.6 | 🟡 MEDIUM | 90% | security | moderate | `src/payment.ts:17-17` | eval() executes dynamic code |
| 30 | 3.6 | 🟡 MEDIUM | 90% | debt | trivial | `package.json` | Dependency hygiene issues in package.json (3) |
| 31 | 3.6 | 🟡 MEDIUM | 90% | debt | trivial | `package.json` | No lockfile committed next to package.json |
| 32 | 3.4 | 🟡 MEDIUM | 95% | bug | moderate | `src/legacy-monolith.js:8-10` | Dead code branch in legacy-monolith handlers |
| 33 | 3.2 | 🟡 MEDIUM | 81% | refactoring | large | `src/lib/a.js` | Import cycle (2 modules): a.js → b.js → a.js |
| 34 | 3.2 | 🟡 MEDIUM | 80% | bug | moderate | `server/auth.py:26-29` | Missing Idempotency Key in charge Function (Python) |
| 35 | 2.3 | 🟠 HIGH | 35% | duplication | moderate | `src/legacy-monolith.js:1-1330` | Massive code duplication in legacy-monolith.js |
| 36 | 1.9 | 🔵 LOW | 95% | debt | moderate | `src/orphan.js:1-8` | Dead Code: Orphan Module src/orphan.js |
| 37 | 1.9 | 🔵 LOW | 95% | debt | moderate | `index.js:42-43` | Debugger Statement Left in Production Code |
| 38 | 1.8 | 🔵 LOW | 90% | debt | moderate | `src/legacy-monolith.js:25-1130` | 6 TODO markers in legacy-monolith.js |
| 39 | 1.8 | 🔵 LOW | 90% | debt | moderate | `server/auth.py:4-4` | 1 TODO marker in auth.py |
| 40 | 1.8 | 🔵 LOW | 90% | debt | moderate | `src/payment.ts:10-10` | 1 TODO marker in payment.ts |
| 41 | 1.8 | 🔵 LOW | 90% | bug | trivial | `index.js:43-43` | `debugger` statement left in code |
| 42 | 1.8 | 🔵 LOW | 90% | security | trivial | `index.js:48-48` | Insecure http:// endpoint in source |
| 43 | 1.8 | 🔵 LOW | 90% | performance | trivial | `index.js:32-32` | JSON.parse(JSON.stringify(...)) used as deep clone |
| 44 | 1.8 | 🔵 LOW | 90% | bug | trivial | `server/auth.py:16-16` | Bare `except:` catches everything (including KeyboardInterrupt/SystemExit) |
| 45 | 1.8 | 🔵 LOW | 90% | security | trivial | `server/auth.py:29-29` | Insecure http:// endpoint in source |
| 46 | 1.7 | 🔵 LOW | 95% | refactoring | moderate | `index.js:24-26` | Debug console.log statements in production code |
| 47 | 1.4 | 🔵 LOW | 80% | performance | moderate | `src/utils.js:33-37` | Inefficient summarizeInvoices recomputes renderInvoice |
| 48 | 1.3 | 🟡 MEDIUM | 35% | security | moderate | `package.json:11-13` | Unpinned dependencies (express latest, lodash *) |
| 49 | 1.2 | 🔵 LOW | 60% | refactoring | large | `src/legacy-monolith.js:1-80` | Deep nesting (≈7 levels) in legacy-monolith.js |
| 50 | 0.9 | ⚪ INFO | 90% | debt | moderate | `src/orphan.js:3-3` | 1 XXX marker in orphan.js |
| 51 | 0.7 | ⚪ INFO | 72% | refactoring | large | `src/helpers.js` | 4 source files have no incoming imports |


### 🎯 Quick wins (high priority, small effort)

- 🔴 CRITICAL **Arbitrary Code Execution via eval in unsafeJsonParse (TypeScript)** — `src/payment.ts:15-18`
- 🔴 CRITICAL **Arbitrary Code Execution via eval in run_user_script (Python)** — `server/auth.py:7-9`
- 🔴 CRITICAL **Command Injection in previewFile endpoint** — `index.js:11-17`
- 🔴 CRITICAL **SQL Injection in findPayments (TypeScript)** — `src/payment.ts:8-13`
- 🔴 CRITICAL **AWS access key ID committed** — `index.js:8-8`
- 🔴 CRITICAL **GitHub personal access token committed** — `server/auth.py:5-5`
- 🟠 HIGH **Swallowed Exception in loadRows** — `index.js:31-38`
- 🟠 HIGH **Bare Except Clause Swallowing All Exceptions (Python)** — `server/auth.py:12-17`
- 🟠 HIGH **Cross-Site Scripting (XSS) in /admin endpoint** — `index.js:39-50`
- 🟠 HIGH **child_process call with interpolated/concatenated command** — `index.js:13-13`

### 🔍 Needs investigation (evidence could not be verified)

These are leads, not confirmed defects — the cited code could not be located exactly. Verify manually before acting.

- 🟠 HIGH **Massive code duplication in legacy-monolith.js** — `src/legacy-monolith.js:1-1330` (confidence 35%)
- 🟡 MEDIUM **Unpinned dependencies (express latest, lodash *)** — `package.json:11-13` (confidence 35%)

## Security (18)

### 🔴 CRITICAL Arbitrary Code Execution via eval in unsafeJsonParse (TypeScript)

**Priority 9.5 · confidence 95% · effort moderate · source agent:bench-a**

> `src/payment.ts:15-18`

The function uses `eval()` on untrusted input, allowing arbitrary JavaScript code execution. An attacker controlling `text` can execute any code in the Node.js process context.

```
function unsafeJsonParse(text: string): PaymentRow[] {
  // trusts any input shape at runtime
  return eval('(' + text + ')') as PaymentRow[];
}
```

**Fix:** Replace with `JSON.parse(text)` and validate the resulting structure against a schema (e.g., using zod or io-ts).

**Benefit:** Eliminates arbitrary code execution vector.

**Regression risk:** Full server compromise.

---

### 🔴 CRITICAL Arbitrary Code Execution via eval in run_user_script (Python)

**Priority 9.5 · confidence 95% · effort moderate · source agent:bench-a**

> `server/auth.py:7-9`

The function directly evaluates user-supplied input as Python code. This is a textbook code injection vulnerability allowing full server compromise.

```
def run_user_script(user_input):
    # executes whatever the caller passes — classic eval sink
    return eval(user_input)
```

**Fix:** Remove this function entirely or restrict to a safe sandboxed expression evaluator (e.g., `ast.literal_eval` for literals only).

**Benefit:** Eliminates remote code execution.

**Regression risk:** Full server compromise.

---

### 🔴 CRITICAL Command Injection in previewFile endpoint

**Priority 9.0 · confidence 95% · effort moderate · source agent:bench-a**

> `index.js:11-17`

User-supplied `req.query.name` is directly concatenated into a shell command passed to `exec()` without any validation or sanitization. An attacker can inject arbitrary commands via shell metacharacters (e.g., `name=legit.png; rm -rf /`).

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

**Fix:** Use `execFile` with an argument array instead of shell string concatenation, or validate/sanitize the filename against a strict allowlist.

**Benefit:** Eliminates remote code execution vulnerability.

**Regression risk:** Full server compromise if exploited.

> ⚠️ Evidence adjusted: cited 11-16 does not contain the snippet — actual lines are 11-17; citation corrected

---

### 🔴 CRITICAL SQL Injection in findPayments (TypeScript)

**Priority 9.0 · confidence 95% · effort moderate · source agent:bench-a**

> `src/payment.ts:8-13`

The `customerId` parameter is directly interpolated into a SQL query string without parameterization, enabling SQL injection. An attacker could supply `1; DROP TABLE payments; --` to destroy data or extract unauthorized records.

> Validation: cited 9-12 does not contain the snippet — actual lines are 8-13; citation corrected

```
function findPayments(customerId: string, db: { query: (sql: string) => PaymentRow[] }): PaymentRow[] {
  // TODO: parameterize — customerId flows straight into the SQL string
  const sql = 'SELECT * FROM payments WHERE customer_id = ' + customerId;
  return db.query(sql);
}
```

**Fix:** Use parameterized queries / prepared statements (e.g., `db.query('SELECT * FROM payments WHERE customer_id = ?', [customerId])`).

**Benefit:** Prevents SQL injection attacks.

**Regression risk:** Data breach, data loss, or database compromise.

> ⚠️ Evidence adjusted: cited 9-12 does not contain the snippet — actual lines are 8-13; citation corrected

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

### 🔴 CRITICAL GitHub personal access token committed

**Priority 7.3 · confidence 81% · effort trivial · source deterministic**

> `server/auth.py:5-5`

Matched pattern `github-pat` in server/auth.py:5. This looks like a real credential (value redacted in this report). Rotate the secret and move it to an environment variable or secret manager.

```
API_TOKEN = "[REDACTED github-token #3543c50b]"
```

**Fix:** Remove the literal, rotate the credential, load from process env / secret store, and scrub git history if committed.

**Benefit:** Eliminates a directly exploitable credential leak.

**Regression risk:** Low — mechanical replacement plus key rotation; verify dependent services after rotation.

Model verdicts: dismiss (model:bench-a)

> ⚠️ A model suggested dismissing this finding (openrouter|openrouter.ai/api|nvidia/nemotron-3-ultra-550b-a55b:free). Critical/high/security findings are never auto-removed — the analyzer evidence and the verdict history are both kept for your judgment.

---

### 🟠 HIGH Cross-Site Scripting (XSS) in /admin endpoint

**Priority 6.3 · confidence 95% · effort moderate · source agent:bench-a**

> `index.js:39-50`

The `key` value (user-controlled via `req.body.admin_key`) is directly embedded into a `<script>` block via `JSON.stringify`. While `JSON.stringify` escapes for JavaScript string contexts, the surrounding HTML/JS template construction is fragile and the `document = req.body.html` line suggests a template injection vector. Additionally, the hardcoded password `hunter2` is a credential issue.

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

**Fix:** Use a proper template engine with auto-escaping (e.g., EJS, Handlebars). Remove hardcoded credentials; use secure authentication with hashed passwords.

**Benefit:** Prevents XSS and credential exposure.

**Regression risk:** Session hijacking, credential theft, admin panel takeover.

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

### 🟠 HIGH Hardcoded AWS Key and GitHub Token in Source Code

**Priority 6.3 · confidence 90% · effort moderate · source agent:bench-a**

> `index.js:8-8`

Source code contains placeholder secrets (AWS key in index.js, GitHub token in server/auth.py). Even if redacted, this pattern indicates secrets are committed to version control. In a real deployment, these would be live credentials.

```
const AWS_KEY = '[REDACTED aws-key #54c83e8f]';
```

**Fix:** Move all secrets to environment variables or a secret manager (e.g., AWS Secrets Manager, HashiCorp Vault). Add `.env` to `.gitignore`.

**Benefit:** Prevents credential leakage via source control.

**Regression risk:** Cloud account compromise, unauthorized API access.

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

### 🟡 MEDIUM Deprecated and vulnerable dependency left-pad

**Priority 3.6 · confidence 95% · effort moderate · source model:bench-a**

> `package.json:13-13`

left-pad is a deprecated package infamous for the 2016 npm incident. It poses supply-chain risk and should be replaced with native String.prototype.padStart.

```
"left-pad": "1.0.0"
```

**Fix:** Remove left-pad and use 'str.padStart()' instead.

**Benefit:** Eliminates a known supply-chain risk and reduces dependencies.

**Regression risk:** Low; trivial replacement.

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

### 🟡 MEDIUM eval()/exec() executes dynamic code

**Priority 3.6 · confidence 90% · effort moderate · source deterministic**

> `server/auth.py:9-9`

Python eval/exec turn strings into running code — a direct injection sink when any part of the input is user-influenced.

1 occurrence in server/auth.py:9

```
return eval(user_input)
```

**Fix:** Replace with explicit parsing (ast.literal_eval for data), or validate input strictly and document why dynamic execution is required.

**Benefit:** Directly removes a recurring defect/injection/perf class at this site.

**Regression risk:** Low — change is local; verify with existing tests.

Model verdicts: confirm (model:bench-a)

---

### 🟡 MEDIUM eval() executes dynamic code

**Priority 3.6 · confidence 90% · effort moderate · source deterministic**

> `src/payment.ts:17-17`

Dynamic code execution is an injection sink: any attacker-controlled string that reaches here becomes arbitrary code execution.

1 occurrence in src/payment.ts:17

```
return eval('(' + text + ')') as PaymentRow[];
```

**Fix:** Replace with explicit parsing/logic. If input must be trusted, validate strictly and document why eval is required.

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

### 🟡 MEDIUM Unpinned dependencies (express latest, lodash *)

**Priority 1.3 · confidence 35% · effort moderate · source model:bench-a**

> `package.json:11-13`

Using 'latest' and '*' prevents reproducible builds and may pull in breaking changes or malicious updates automatically.

> Validation: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

```
"express": "latest",
    "lodash": "*"
```

**Fix:** Pin exact versions (e.g., "express": "4.18.2", "lodash": "4.17.21").

**Benefit:** Ensures reproducible, predictable builds.

**Regression risk:** Low; version pinning is standard practice.

> ⚠️ Evidence unverified: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

---

## Bug (11)

### 🟠 HIGH Swallowed Exception in loadRows

**Priority 6.7 · confidence 95% · effort moderate · source agent:bench-a**

> `index.js:31-38`

The `catch` block is completely empty — all exceptions are silently ignored and an empty array is returned. This masks database failures, connection issues, or programming errors, making debugging impossible and causing silent data loss.

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

**Fix:** Log the error and either re-throw or return a meaningful error response. At minimum: `console.error('loadRows failed', e); throw e;`

**Benefit:** Visibility into failures; prevents silent data corruption.

**Regression risk:** Silent failures, data loss, impossible debugging.

---

### 🟠 HIGH Bare Except Clause Swallowing All Exceptions (Python)

**Priority 6.7 · confidence 95% · effort moderate · source agent:bench-a**

> `server/auth.py:12-17`

A bare `except:` catches all exceptions including `KeyboardInterrupt`, `SystemExit`, and `MemoryError`, then silently returns `None`. This hides file permission errors, missing files, disk errors, and even critical interpreter signals.

```
def load_config(path):
    try:
        with open(path) as fh:
            return fh.read()
    except:
        pass
```

**Fix:** Catch specific exceptions: `except (OSError, IOError):` or `except Exception:` at minimum, and log the error.

**Benefit:** Proper error handling; avoids masking critical errors.

**Regression risk:** Silent failures, masked bugs, inability to shut down cleanly.

---

### 🟠 HIGH Undeclared variable assignment creates global

**Priority 6.0 · confidence 95% · effort moderate · source model:bench-a**

> `index.js:44-44`

The variable 'document' is assigned without declaration (const/let/var). In non-strict mode this creates a global variable; in strict mode it throws a ReferenceError. This is a runtime bug.

> Validation: cited 46-46 does not contain the snippet — actual lines are 44-44; citation corrected

```
document = req.body.html;  // placeholder for the real template below
```

**Fix:** Declare the variable with 'const document = req.body.html;' or remove if unused.

**Benefit:** Prevents accidental global pollution and potential runtime errors.

**Regression risk:** Low; single line change.

> ⚠️ Evidence adjusted: cited 46-46 does not contain the snippet — actual lines are 44-44; citation corrected

---

### 🟡 MEDIUM File handle leak in save_config

**Priority 3.6 · confidence 95% · effort moderate · source model:bench-a**

> `server/auth.py:20-23`

If fh.write() raises an exception, the file handle is not closed. Should use a context manager (with open(...)).

---
(agent:bench-a) If `fh.write(data)` raises an exception (e.g., disk full, permission denied), `fh.close()` is never called, leaking the file descriptor. The `with` statement (context manager) guarantees cleanup.

```
def save_config(path, data):
    fh = open(path, "w")
    fh.write(data)
    fh.close()
```

**Fix:** Rewrite using 'with open(path, "w") as fh: fh.write(data)'.

**Benefit:** Guarantees file closure even on error.

**Regression risk:** Low; straightforward fix.

---

### 🟡 MEDIUM Import Cycle Between src/lib/a.js and src/lib/b.js

**Priority 3.6 · confidence 95% · effort moderate · source agent:bench-a**

> `src/lib/a.js:1-9`

Circular dependency: `a.js` requires `b.js` (line 2), and `b.js` requires `a.js` (line 2 of b.js). This can cause initialization order bugs, partial exports, and makes testing and bundling difficult.

> Validation: cited 1-8 does not contain the snippet — actual lines are 1-9; citation corrected

```
// Fixture: half of an import cycle (a.js ↔ b.js).
const { shared } = require('./b.js');

function validate(config) {
  if (!config || typeof config !== 'object') {
    return { ok: false, reason: 'invalid config' };
  }
  return { ok: true, via: 'a', shared: shared() };
}
```

**Fix:** Extract shared functionality into a third module (e.g., `src/lib/shared.js`) that both `a.js` and `b.js` depend on, breaking the cycle.

**Benefit:** Stable module initialization, easier testing, better bundler support.

**Regression risk:** Runtime errors on require order changes; flaky tests.

> ⚠️ Evidence adjusted: cited 1-8 does not contain the snippet — actual lines are 1-9; citation corrected

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

### 🟡 MEDIUM Dead code branch in legacy-monolith handlers

**Priority 3.4 · confidence 95% · effort moderate · source model:bench-a**

> `src/legacy-monolith.js:8-10`

The variable 'data' is assigned a truthy object (either cached or newly created). The subsequent 'if (!data)' branch can never execute, making the nested logic dead code. This indicates a logic error.

> Validation: cited 10-25 does not contain the snippet — actual lines are 8-10; citation corrected

```
const data = ROUTES[cacheKey] || { id, mode, stamped: Date.now() };
  ROUTES[cacheKey] = data;
  if (!data) {
```

**Fix:** Remove the dead branch or fix the condition to match intended caching behavior.

**Benefit:** Eliminates confusing dead code and potential future bugs.

**Regression risk:** Low; the branch is never executed.

> ⚠️ Evidence adjusted: cited 10-25 does not contain the snippet — actual lines are 8-10; citation corrected

---

### 🟡 MEDIUM Missing Idempotency Key in charge Function (Python)

**Priority 3.2 · confidence 80% · effort moderate · source agent:bench-a**

> `server/auth.py:26-29`

The `charge` function sends a payment request without an idempotency key. If the client retries (network timeout, 5xx response), the payment will be processed multiple times, causing double-charges.

```
def charge(amount):
    # FIXME: no idempotency key — double charges on retry
    import requests
    return requests.post("http://payments-legacy.internal/charge", json={"amount": amount})
```

**Fix:** Generate and pass an idempotency key (e.g., UUID) in the request headers/body. Store the key with the transaction to deduplicate retries.

**Benefit:** Prevents duplicate charges on retry.

**Regression risk:** Financial loss, customer disputes, regulatory issues.

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

### 🟡 MEDIUM Duplicated renderInvoice Function in utils.js and helpers.js

**Priority 3.8 · confidence 95% · effort moderate · source agent:bench-a**

> `src/utils.js:2-31`

The `renderInvoice` function is copy-pasted identically in both `src/utils.js` and `src/helpers.js` (39 lines each). `helpers.js` even re-exports it. This creates maintenance burden and divergence risk.

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

**Fix:** Keep the implementation in one place (e.g., `utils.js`) and import it in `helpers.js`: `const { renderInvoice } = require('./utils');`

**Benefit:** Single source of truth; eliminates divergence risk.

**Regression risk:** Bug fixes applied to only one copy; inconsistent behavior.

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

### 🟠 HIGH Massive code duplication in legacy-monolith.js

**Priority 2.3 · confidence 35% · effort moderate · source model:bench-a**

> `src/legacy-monolith.js:1-1330`

The file contains 60 nearly identical handler functions (handler0 through handler59), each ~20 lines. This is extreme copy-paste duplication, making maintenance impossible and inflating file size.

> Validation: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

---
(agent:bench-a) The file contains 60 handler functions (`handler0` through `handler59`) that are nearly identical, differing only in the numeric suffix and cache key prefix. This is extreme copy-paste duplication (~1300 lines). Any bug fix or feature change must be applied 60 times.

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
// ... repeated 60 times with only numeric suffixes changing
```

**Fix:** Refactor into a single factory function that generates handlers with parameterized cache key prefix and default mode.

**Benefit:** Reduces file size by ~90%, eliminates duplication, simplifies future changes.

**Regression risk:** Medium; requires careful refactoring and testing of all routes.

> ⚠️ Evidence unverified: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

---

## Performance (4)

### 🟡 MEDIUM Sequential Awaits in Loop (Performance Anti-Pattern)

**Priority 3.6 · confidence 95% · effort moderate · source agent:bench-a**

> `index.js:18-29`

The `/render` endpoint processes each row sequentially with `await renderInvoice(row)` inside a `for...of` loop. If `renderInvoice` is async (e.g., does I/O), this serializes work that could be parallelized, increasing latency linearly with row count.

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

**Fix:** Use `Promise.all(rows.map(row => renderInvoice(row)))` for parallel execution, or `Promise.allSettled` if partial failures are acceptable.

**Benefit:** Reduces endpoint latency from O(n) sequential to O(1) parallel (bounded by concurrency).

**Regression risk:** Unnecessary latency under load; potential timeout on large batches.

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

### 🔵 LOW Inefficient summarizeInvoices recomputes renderInvoice

**Priority 1.4 · confidence 80% · effort moderate · source model:bench-a**

> `src/utils.js:33-37`

summarizeInvoices calls renderInvoice for each invoice, which recomputes line items, taxes, etc., only to extract the total. This duplicates work.

> Validation: cited 38-40 does not contain the snippet — actual lines are 33-37; citation corrected

```
function summarizeInvoices(invoices) {
  const total = invoices.reduce((acc, inv) => acc + renderInvoice(inv).total, 0);
  return { count: invoices.length, total };
}
```

**Fix:** Compute totals directly from invoice data without full rendering, or memoize renderInvoice.

**Benefit:** Reduces CPU usage for invoice summaries.

**Regression risk:** Low; internal logic change.

> ⚠️ Evidence adjusted: cited 38-40 does not contain the snippet — actual lines are 33-37; citation corrected

---

## Debt (10)

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

### 🔵 LOW Dead Code: Orphan Module src/orphan.js

**Priority 1.9 · confidence 95% · effort moderate · source agent:bench-a**

> `src/orphan.js:1-8`

The module `src/orphan.js` exports `legacyTax` but is not imported by any other file in the codebase (confirmed by import graph: 0 importers). The comment indicates it's legacy code kept "just in case."

```
// Fixture: orphan module — nothing imports it.
function legacyTax(amount) {
  // XXX: pre-2019 tax table, kept "just in case"
  if (amount < 0) throw new Error('negative amount');
  return Math.round(amount * 1.22 * 100) / 100;
}

module.exports = { legacyTax };
```

**Fix:** Delete the file if truly unused. If kept for reference, move to an archive folder or document in a changelog.

**Benefit:** Reduces codebase surface area; avoids confusion.

**Regression risk:** None (dead code), but adds cognitive load.

---

### 🔵 LOW Debugger Statement Left in Production Code

**Priority 1.9 · confidence 95% · effort moderate · source agent:bench-a**

> `index.js:42-43`

A `debugger;` statement is present in the `/admin` route handler. In production, this will pause execution if a debugger is attached (e.g., Node inspector), causing request hangs.

```
if (key === 'hunter2') {
    debugger;
```

**Fix:** Remove the `debugger;` statement before deployment.

**Benefit:** Avoids accidental production pauses.

**Regression risk:** Request hangs if inspector connected.

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

**Priority 3.2 · confidence 81% · effort large · source deterministic**

> `src/lib/a.js`

Circular import chain: src/lib/a.js → src/lib/b.js → src/lib/a.js. Cycles cause initialization-order bugs (undefined imports at runtime), prevent clean layering, and make the modules impossible to test in isolation.

**Fix:** Break the cycle by extracting the shared piece into a third module, or invert one dependency via dependency injection / event callbacks.

**Benefit:** Deterministic module initialization and clean layering.

**Regression risk:** Moderate — moving code between modules can shift initialization order; run the full test suite after.

Model verdicts: confirm (model:bench-a)

---

### 🔵 LOW Debug console.log statements in production code

**Priority 1.7 · confidence 95% · effort moderate · source model:bench-a**

> `index.js:24-26`

Multiple debug log statements left in the request handler. These clutter logs and may leak internal information.

> Validation: cited 23-25 does not contain the snippet — actual lines are 24-26; citation corrected

```
console.log('debug marker 1');
    console.log('debug marker 2');
    console.log('debug marker 3');
```

**Fix:** Remove or guard with a debug flag / logging framework.

**Benefit:** Cleaner logs, reduced noise.

**Regression risk:** Trivial.

> ⚠️ Evidence adjusted: cited 23-25 does not contain the snippet — actual lines are 24-26; citation corrected

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

Model verdicts: adjust (model:bench-a)

---

### ⚪ INFO 4 source files have no incoming imports

**Priority 0.7 · confidence 72% · effort large · source deterministic**

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

- Evidence validation: **40** verified (verbatim snippet located inside the cited range), **9** adjusted (citation corrected to the snippet's real lines), **2** unverified (kept, flagged, down-weighted), **0** dropped before reporting.
- Verdict policy: model dismissals move findings to a visible "model-dismissed" group; critical/high/security findings are never auto-removed. This run: 0 dismissed, 3 contested.
- Secret handling: credential-like literals matched by the secret scan are replaced with type-preserving placeholders in this report and in all model prompts
- Deterministic checks executed: secrets (3), debt-markers (6), duplication (1), size (2), quality (13), deps (2), graph (2), ast-grep (0).
- Model runs:
  - bench-a (nvidia/nemotron-3-ultra-550b-a55b:free) · structured · native · 1m 42s · 13946/9988 tokens — ok
  - bench-a (nvidia/nemotron-3-ultra-550b-a55b:free) · autonomous · native · 2m 8s · 107120/5662 tokens — ok · finished: submitted

### Model notes

> bench-a: Overall, the repository is a deliberately flawed fixture designed to trigger static analysis findings. The most critical issues are the command injection in index.js (exec with user input), eval in auth.py and payment.ts, and SQL injection in payment.ts. The legacy-monolith.js is a massive duplication case that dwarfs the helpers/utils duplication. The .env secret finding could not be verified from the provided excerpts. The import cycle between a.js and b.js is confirmed but b.js content was not provided. The orphan.js module is truly unused. The package.json hygiene issues are real and should be fixed for any real project.

> bench-a (autonomous): The repository is a deliberately vulnerable fixture containing numerous planted security bugs, code quality issues, and anti-patterns across JavaScript, TypeScript, and Python. The most critical findings are command injection, SQL injection, and multiple eval()-based arbitrary code execution vectors. There is also severe code duplication (60 near-identical handlers in legacy-monolith.js, duplicated renderInvoice across two files), an import cycle, dead code, and several error-handling defects. All findings are grounded in verbatim code snippets from the actual files.


---
Generated by `code-audit` v0.2.3 — read-only audit; no application files were modified. Exit-code policy: report-only (use --fail-on for CI gates).