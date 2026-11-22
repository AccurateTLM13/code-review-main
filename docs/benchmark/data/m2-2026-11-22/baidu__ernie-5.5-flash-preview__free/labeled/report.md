# Code Audit Report

| | |
|---|---|
| **Repository** | E:\code\code-review-main\examples\vulnerable-app |
| **Branch / commit** | main @ 6d01630 |
| **Date** | 2026-11-22T22:42:49.724Z |
| **Mode** | deep audit · full scan |
| **Focus** | all |
| **Models** | bench-b (baidu/ernie-5.5-flash-preview:free, native) |
| **Codebase** | 9 source files · 1,552 LOC · javascript, python, typescript |
| **Findings** | 52 (5 critical / 9 high / 24 medium / 12 low / 2 info) |

## Executive summary

The audit produced **52 findings**, prioritized below. The highest-priority items:

- 🔴 CRITICAL — **AWS access key ID committed** (index.js:8-8, confidence 95%)
- 🔴 CRITICAL — **GitHub personal access token committed** (server/auth.py:5-5, confidence 95%)
- 🔴 CRITICAL — **SQL injection through string concatenation in findPayments** (src/payment.ts:9-13, confidence 90%)
- 🔴 CRITICAL — **eval() of caller-supplied input in run_user_script** (server/auth.py:7-9, confidence 90%)
- 🔴 CRITICAL — **OS command injection via unsanitized query param in exec()** (index.js:11-17, confidence 85%)

1 finding(s) could not be fully verified against file contents and are marked accordingly — treat them as leads, not confirmed defects.

## Priority backlog

| # | Priority | Severity | Confidence | Category | Effort | Location | Issue |
|---|---|---|---|---|---|---|---|
| 1 | 9.5 | 🔴 CRITICAL | 95% | security | trivial | `index.js:8-8` | AWS access key ID committed |
| 2 | 9.5 | 🔴 CRITICAL | 95% | security | trivial | `server/auth.py:5-5` | GitHub personal access token committed |
| 3 | 9.0 | 🔴 CRITICAL | 90% | security | moderate | `src/payment.ts:9-13` | SQL injection through string concatenation in findPayments |
| 4 | 9.0 | 🔴 CRITICAL | 90% | security | moderate | `server/auth.py:7-9` | eval() of caller-supplied input in run_user_script |
| 5 | 8.5 | 🔴 CRITICAL | 85% | security | moderate | `index.js:11-17` | OS command injection via unsanitized query param in exec() |
| 6 | 6.3 | 🟠 HIGH | 90% | security | trivial | `.env` | .env file present and tracked by git |
| 7 | 6.3 | 🟠 HIGH | 90% | security | moderate | `src/payment.ts:15-18` | eval()-based JSON parsing in unsafeJsonParse |
| 8 | 6.3 | 🟠 HIGH | 90% | security | moderate | `index.js:8-8` | Hardcoded AWS access key in source |
| 9 | 6.3 | 🟠 HIGH | 90% | security | moderate | `server/auth.py:4-5` | Hardcoded API token in server/auth.py |
| 10 | 6.3 | 🟠 HIGH | 90% | security | moderate | `index.js:40-43` | Hardcoded admin password compared with === in /admin handler |
| 11 | 5.6 | 🟠 HIGH | 80% | security | moderate | `index.js:44-46` | Reflected XSS / script-context injection in /admin response |
| 12 | 5.6 | 🟠 HIGH | 80% | bug | moderate | `index.js:40-41` | /admin reads req.body without any body-parsing middleware registered |
| 13 | 3.8 | 🟡 MEDIUM | 95% | duplication | moderate | `src/helpers.js:2-29` | 28-line block duplicated between helpers.js and utils.js |
| 14 | 3.8 | 🟡 MEDIUM | 95% | bug | moderate | `src/legacy-monolith.js:8-23` | Unreachable branch in all 60 legacy handlers (`if (!data)` after data is always assigned) |
| 15 | 3.6 | 🟡 MEDIUM | 90% | bug | moderate | `index.js:31-38` | Empty catch silently swallows store failures in loadRows |
| 16 | 3.6 | 🟡 MEDIUM | 90% | bug | moderate | `server/auth.py:12-17` | Bare except swallows all errors and returns None in load_config |
| 17 | 3.6 | 🟡 MEDIUM | 90% | bug | moderate | `server/auth.py:20-23` | save_config leaks the file handle if write() raises |
| 18 | 3.6 | 🟡 MEDIUM | 90% | debt | moderate | `package.json:10-17` | Unpinned and duplicated dependencies in package.json |
| 19 | 3.4 | 🟡 MEDIUM | 85% | debt | moderate | `index.js:10-10` | 1 FIXME marker in index.js |
| 20 | 3.4 | 🟡 MEDIUM | 85% | debt | moderate | `server/auth.py:27-27` | 1 FIXME marker in auth.py |
| 21 | 3.4 | 🟡 MEDIUM | 85% | refactoring | large | `src/legacy-monolith.js:1-60` | Oversized file: legacy-monolith.js is 1,330 lines |
| 22 | 3.4 | 🟡 MEDIUM | 85% | performance | moderate | `index.js:19-29` | Sequential awaits in a loop plus unguarded async route handler |
| 23 | 3.4 | 🟡 MEDIUM | 85% | performance | moderate | `src/legacy-monolith.js:4-10` | Unbounded ROUTES cache keyed by user input in legacy-monolith |
| 24 | 3.4 | 🟡 MEDIUM | 85% | security | moderate | `server/auth.py:26-29` | Payment charge over plaintext HTTP with no idempotency key |
| 25 | 3.2 | 🟡 MEDIUM | 80% | debt | trivial | `package.json` | Dependency hygiene issues in package.json (3) |
| 26 | 3.2 | 🟡 MEDIUM | 80% | bug | moderate | `src/lib/a.js:1-2` | Circular require between src/lib/a.js and src/lib/b.js |
| 27 | 3.2 | 🟡 MEDIUM | 80% | security | moderate | `.gitignore:1-3` | .gitignore does not exclude .env despite the repo containing one |
| 28 | 3.1 | 🟠 HIGH | 45% | security | moderate | `index.js:13-13` | child_process call with interpolated/concatenated command |
| 29 | 3.0 | 🟡 MEDIUM | 75% | debt | trivial | `package.json` | No lockfile committed next to package.json |
| 30 | 2.8 | 🟠 HIGH | 41% | security | moderate | `src/payment.ts:11-11` | SQL query built via string concatenation/interpolation |
| 31 | 2.8 | 🟡 MEDIUM | 70% | refactoring | large | `src/lib/a.js` | Import cycle (2 modules): a.js → b.js → a.js |
| 32 | 2.5 | 🟡 MEDIUM | 63% | bug | trivial | `index.js:35-35` | Empty or comment-only catch block swallows errors |
| 33 | 2.3 | 🟡 MEDIUM | 59% | bug | trivial | `server/auth.py:16-16` | except block that passes silently |
| 34 | 2.2 | 🟡 MEDIUM | 54% | security | moderate | `server/auth.py:9-9` | eval()/exec() executes dynamic code |
| 35 | 2.0 | 🟡 MEDIUM | 50% | security | moderate | `src/payment.ts:17-17` | eval() executes dynamic code |
| 36 | 1.8 | 🟡 MEDIUM | 45% | security | moderate | `index.js:46-46` | Raw HTML injection sink (innerHTML / dangerouslySetInnerHTML) |
| 37 | 1.8 | 🟡 MEDIUM | 45% | performance | moderate | `index.js:21-21` | Sequential await inside a loop |
| 38 | 1.8 | 🔵 LOW | 90% | bug | moderate | `index.js:43-43` | Leftover debugger statement in the /admin request path |
| 39 | 1.8 | 🔵 LOW | 90% | performance | moderate | `index.js:32-32` | Pointless JSON.parse(JSON.stringify(...)) deep-clone of a single field |
| 40 | 1.7 | 🔵 LOW | 85% | debt | moderate | `src/orphan.js:1-6` | Orphan module src/orphan.js with an outdated hardcoded tax rate |
| 41 | 1.6 | 🔵 LOW | 81% | bug | trivial | `index.js:43-43` | `debugger` statement left in code |
| 42 | 1.6 | 🔵 LOW | 80% | debt | moderate | `src/legacy-monolith.js:25-1130` | 6 TODO markers in legacy-monolith.js |
| 43 | 1.6 | 🔵 LOW | 80% | debt | moderate | `server/auth.py:4-4` | 1 TODO marker in auth.py |
| 44 | 1.6 | 🔵 LOW | 80% | debt | moderate | `src/payment.ts:10-10` | 1 TODO marker in payment.ts |
| 45 | 1.3 | 🟡 MEDIUM | 32% | debt | moderate | `src/legacy-monolith.js:1330-1330` | legacy-monolith.js is dead code: 1330 lines, zero importers |
| 46 | 1.2 | 🔵 LOW | 60% | refactoring | large | `src/legacy-monolith.js:1-80` | Deep nesting (≈7 levels) in legacy-monolith.js |
| 47 | 1.1 | 🔵 LOW | 54% | performance | trivial | `index.js:32-32` | JSON.parse(JSON.stringify(...)) used as deep clone |
| 48 | 1.1 | 🔵 LOW | 54% | bug | trivial | `server/auth.py:16-16` | Bare `except:` catches everything (including KeyboardInterrupt/SystemExit) |
| 49 | 0.9 | 🔵 LOW | 45% | security | trivial | `index.js:48-48` | Insecure http:// endpoint in source |
| 50 | 0.9 | 🔵 LOW | 45% | security | trivial | `server/auth.py:29-29` | Insecure http:// endpoint in source |
| 51 | 0.7 | ⚪ INFO | 70% | debt | moderate | `src/orphan.js:3-3` | 1 XXX marker in orphan.js |
| 52 | 0.5 | ⚪ INFO | 50% | refactoring | large | `src/helpers.js` | 4 source files have no incoming imports |


### 🎯 Quick wins (high priority, small effort)

- 🔴 CRITICAL **AWS access key ID committed** — `index.js:8-8`
- 🔴 CRITICAL **GitHub personal access token committed** — `server/auth.py:5-5`
- 🔴 CRITICAL **SQL injection through string concatenation in findPayments** — `src/payment.ts:9-13`
- 🔴 CRITICAL **eval() of caller-supplied input in run_user_script** — `server/auth.py:7-9`
- 🔴 CRITICAL **OS command injection via unsanitized query param in exec()** — `index.js:11-17`
- 🟠 HIGH **.env file present and tracked by git** — `.env`
- 🟠 HIGH **eval()-based JSON parsing in unsafeJsonParse** — `src/payment.ts:15-18`
- 🟠 HIGH **Hardcoded AWS access key in source** — `index.js:8-8`
- 🟠 HIGH **Hardcoded API token in server/auth.py** — `server/auth.py:4-5`
- 🟠 HIGH **Hardcoded admin password compared with === in /admin handler** — `index.js:40-43`

### 🔍 Needs investigation (evidence could not be verified)

These are leads, not confirmed defects — the cited code could not be located exactly. Verify manually before acting.

- 🟡 MEDIUM **legacy-monolith.js is dead code: 1330 lines, zero importers** — `src/legacy-monolith.js:1330-1330` (confidence 32%)

## Security (20)

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

### 🔴 CRITICAL SQL injection through string concatenation in findPayments

**Priority 9.0 · confidence 90% · effort moderate · source agent:bench-b**

> `src/payment.ts:9-13`

`customerId` is concatenated directly into a SQL statement with no quoting or escaping. A value such as `0 OR 1=1` dumps the whole payments table, and `0; DROP TABLE payments--` or a UNION-based payload allows data destruction and exfiltration of arbitrary tables. The TypeScript type `string` gives no protection because the value is untrusted at runtime. The code's own TODO acknowledges the defect.

```
function findPayments(customerId: string, db: { query: (sql: string) => PaymentRow[] }): PaymentRow[] {
  // TODO: parameterize — customerId flows straight into the SQL string
  const sql = 'SELECT * FROM payments WHERE customer_id = ' + customerId;
  return db.query(sql);
}
```

**Fix:** Use a parameterized/prepared statement and pass the value separately: db.query('SELECT * FROM payments WHERE customer_id = ?', [customerId]). If the db interface cannot bind parameters, change the interface so it can, and validate customerId against an expected identifier format as defense in depth.

**Benefit:** Closes a full read/write SQL injection path into the payments database.

**Regression risk:** Low: requires the db adapter to expose a parameterized query method; the declared `db` type in the signature must be widened accordingly.

---

### 🔴 CRITICAL eval() of caller-supplied input in run_user_script

**Priority 9.0 · confidence 90% · effort moderate · source agent:bench-b**

> `server/auth.py:7-9`

eval() executes arbitrary Python in the process context. Any caller that can influence `user_input` gains the ability to import os/subprocess, read files, and exfiltrate the API_TOKEN defined at line 5 of this same module. Even with no caller in this repository, the function is an exported, ready-made RCE gadget whose parameter is literally named `user_input`.

```
def run_user_script(user_input):
    # executes whatever the caller passes — classic eval sink
    return eval(user_input)
```

**Fix:** Remove the function. If dynamic evaluation of a narrow expression language is genuinely required, parse with ast.literal_eval for data-only input, or use a sandboxed evaluator with an explicit node allowlist — never builtin eval.

**Benefit:** Removes an arbitrary-code-execution sink from the codebase.

**Regression risk:** Low if the function has no callers (none found in this repo); any external caller passing live Python will break, which is the intended outcome.

---

### 🔴 CRITICAL OS command injection via unsanitized query param in exec()

**Priority 8.5 · confidence 85% · effort moderate · source agent:bench-b**

> `index.js:11-17`

previewFile interpolates the raw `req.query.name` value into a string passed to child_process.exec, which runs through /bin/sh. Any shell metacharacters (; | && $() ` ) in the `name` query parameter execute as arbitrary commands with the privileges of the Node process. The exec error is also discarded (empty `if (err) { }`), so exploitation is silent. Confidence is 0.85 rather than higher only because `previewFile` is defined but never mounted on an `app.get`/`app.post` route in this file — the moment it is wired up (which the FIXME on line 10 implies is intended) the hole is remotely exploitable.

```
function previewFile(req, res) {
  const name = req.query.name;
  exec('convert ' + name + ' preview.png', (err) => {
    if (err) { }
    res.send('done');
  });
}
```

**Fix:** Use execFile/spawn with an argument array so no shell is involved: execFile('convert', [name, 'preview.png'], cb). Additionally validate `name` against a strict allowlist pattern (e.g. /^[A-Za-z0-9._-]+$/), reject path separators, and surface the exec error to the caller instead of swallowing it.

**Benefit:** Eliminates a remote code execution primitive and makes conversion failures observable.

**Regression risk:** Low: execFile has the same callback signature; callers that relied on shell features (globs, pipes) in `name` would need rework.

---

### 🟠 HIGH .env file present and tracked by git

**Priority 6.3 · confidence 90% · effort trivial · source deterministic**

> `.env`

.env exists and is committed. Environment files frequently contain secrets and are easy to leak via zip archives, Docker contexts, or accidental commits. Contents are redacted from all reports and prompts.

**Fix:** Keep only .env.example in the repository; load real values from the environment. If tracked, remove it from the index and add .env to .gitignore.

**Benefit:** Removes a common accidental leak vector.

**Regression risk:** Low — ensure local deployments still find their configuration.

---

### 🟠 HIGH eval()-based JSON parsing in unsafeJsonParse

**Priority 6.3 · confidence 90% · effort moderate · source agent:bench-b**

> `src/payment.ts:15-18`

Using eval to parse JSON means any JavaScript expression in `text` is executed rather than parsed — `{"a":1}` is the benign case, but a payload using property accessors, constructor chains, or a plain IIFE runs attacker code. The `as PaymentRow[]` cast then silences the compiler even though nothing about the runtime shape has been validated, so downstream code consuming `.amountCents` etc. can receive arbitrary objects.

```
function unsafeJsonParse(text: string): PaymentRow[] {
  // trusts any input shape at runtime
  return eval('(' + text + ')') as PaymentRow[];
}
```

**Fix:** Replace with JSON.parse and validate the result at runtime (zod/joi/io-ts or a hand-written type guard) before returning it as PaymentRow[]. Reserve type assertions for cases where a guard has actually run.

**Benefit:** Turns a code-execution sink into a data parse, and restores meaningful type safety at the boundary.

**Regression risk:** Low: JSON.parse rejects some inputs eval accepted (trailing commas, single quotes, undefined), so any caller relying on non-standard JSON will now get a parse error — which is correct behavior.

---

### 🟠 HIGH Hardcoded AWS access key in source

**Priority 6.3 · confidence 90% · effort moderate · source agent:bench-b**

> `index.js:8-8`

A long-lived AWS credential is committed as a module-level literal. Anyone with repository read access (including forks, CI logs, or a leaked clone) obtains the key, and it is trivially recoverable from git history even after removal. The constant is also unused in this file, so it provides zero functionality while carrying full credential-leak risk.

```
const AWS_KEY = '[REDACTED aws-key #54c83e8f]';
```

**Fix:** Delete the literal, load the credential from the environment or an instance/IRSA role at runtime, and rotate the exposed key immediately — deletion alone does not remediate a key that has been committed. Add a secret-scanning pre-commit/CI check.

**Benefit:** Prevents cloud-account compromise via a leaked long-lived credential.

**Regression risk:** Low: the variable has no readers in the codebase, so removal is behavior-neutral. Rotation must be coordinated with whoever owns the AWS account.

---

### 🟠 HIGH Hardcoded API token in server/auth.py

**Priority 6.3 · confidence 90% · effort moderate · source agent:bench-b**

> `server/auth.py:4-5`

A credential is embedded as a module-level string literal in an authentication module. It is readable by anyone with repo access and persists in git history after removal. The adjacent TODO shows the author already knew it belonged in the environment loader.

```
# TODO: move config to the environment loader
API_TOKEN = "[REDACTED github-token #3543c50b]"
```

**Fix:** Read the value via os.environ (e.g. API_TOKEN = os.environ["API_TOKEN"]) and fail fast at startup if it is missing; the `os` module is already imported on line 2. Rotate the exposed token and purge it from history.

**Benefit:** Keeps credentials out of the repository and lets different environments use different tokens.

**Regression risk:** Low: requires the deployment environment to define API_TOKEN before start; a missing variable will now raise instead of silently using a default.

---

### 🟠 HIGH Hardcoded admin password compared with === in /admin handler

**Priority 6.3 · confidence 90% · effort moderate · source agent:bench-b**

> `index.js:40-43`

The administrative authorization secret is a plaintext literal in the request handler. It cannot be rotated without a code change and deploy, it is visible to anyone who can read the source, and it is shared across all environments and all operators. There is no rate limiting, no audit logging, and no per-user identity — a single leaked string grants full admin access.

```
app.post('/admin', (req, res) => {
  const key = req.body.admin_key;
  if (key === 'hunter2') {
    debugger;
```

**Fix:** Move the credential to a per-environment secret store, compare it in constant time (crypto.timingSafeEqual over buffers of equal length), and prefer a real authentication mechanism (signed session, SSO/OIDC) with rate limiting and audit logging on the admin route.

**Benefit:** Makes admin access rotatable, attributable, and resistant to timing and brute-force attacks.

**Regression risk:** Medium: replacing the shared-secret check with real auth changes the client contract for existing admin callers and needs coordination.

---

### 🟠 HIGH Reflected XSS / script-context injection in /admin response

**Priority 5.6 · confidence 80% · effort moderate · source agent:bench-b**

> `index.js:44-46`

The handler builds an HTML document by string concatenation and injects a value into an inline <script> block. JSON.stringify does not make a value safe for HTML script context: a payload containing `</script>` (or `<!--`/`<script` sequences) terminates the script element and lets the injected markup execute, and the same string is then assigned to innerHTML, which is an XSS sink by construction. Line 44 additionally assigns to the bare, undeclared identifier `document`, which in non-strict CommonJS creates/overwrites a global — it does not template anything, so the comment's intent is unmet and any server-side code reading `document` is corrupted.

```
document = req.body.html;  // placeholder for the real template below
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<div id="out"></div><script>document.getElementById("out").innerHTML = ' + JSON.stringify(key) + ';</script>');
```

**Fix:** Render with a real template engine that applies context-aware auto-escaping, set an explicit Content-Type and a restrictive Content-Security-Policy, and send untrusted values as JSON via res.json rather than splicing them into markup. Remove the `document = req.body.html` line or declare it locally if a value is genuinely needed.

**Benefit:** Removes the script-context injection path and the accidental global assignment.

**Regression risk:** Low: the response body format changes, so any client parsing the inline script would need updating.

---

### 🟡 MEDIUM Payment charge over plaintext HTTP with no idempotency key

**Priority 3.4 · confidence 85% · effort moderate · source agent:bench-b**

> `server/auth.py:26-29`

Two issues on the same call. The endpoint is plain http://, so the amount and any response metadata travel unencrypted and are trivially modifiable by anyone on the network path — for a payments call this means an attacker can alter the charged amount. And with no idempotency key, any client retry after an ambiguous timeout (a very common occurrence with POST) creates a second charge, which is precisely the double-billing failure the FIXME describes. The response status is also returned unchecked, so a 4xx/5xx body is indistinguishable from success to the caller.

```
def charge(amount):
    # FIXME: no idempotency key — double charges on retry
    import requests
    return requests.post("http://payments-legacy.internal/charge", json={"amount": amount})
```

**Fix:** Switch to https:// with certificate verification enabled, generate a unique idempotency key per logical charge (e.g. uuid4 stored alongside the order) and send it in the request, and call raise_for_status() or check status_code before treating the call as successful.

**Benefit:** Protects charge amounts in transit and makes retries safe, eliminating double billing.

**Regression risk:** Medium: the legacy endpoint must actually support TLS and accept an idempotency key header; both require server-side coordination.

---

### 🟡 MEDIUM .gitignore does not exclude .env despite the repo containing one

**Priority 3.2 · confidence 80% · effort moderate · source agent:bench-b**

> `.gitignore:1-3`

The .gitignore contains only `logs/`. A .env file exists at the repository root (listed by list_files, 132 bytes; its contents are blocked from read by tool policy, so I cannot confirm which secrets it holds). Because .env is not ignored, any `git add .` stages it and its secrets are published to the remote and preserved in history. This compounds the hardcoded credentials already found in index.js:8 and server/auth.py:5, which suggests .env is the intended destination for those values.

```
# Fixture app for testing code-audit — deliberately ignores best practice
logs/
```

**Fix:** Add `.env`, `.env.*`, and `!.env.example` to .gitignore, commit a sanitized .env.example documenting required keys, and if .env has already been committed, rotate every value in it and purge it from history (git filter-repo / BFG).

**Benefit:** Prevents local environment secrets from being committed in the first place.

**Regression risk:** Low: developers who relied on .env being tracked will need to adopt .env.example; rotation is required if the file was already committed.

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

## Bug (11)

### 🟠 HIGH /admin reads req.body without any body-parsing middleware registered

**Priority 5.6 · confidence 80% · effort moderate · source agent:bench-b**

> `index.js:40-41`

The app never calls app.use(express.json()) or any other body parser — a search for `express.json` across the repository returns no matches, and index.js only constructs `express()` on line 7 before defining routes. In Express 4/5 `req.body` is therefore undefined on a POST, so `req.body.admin_key` throws `TypeError: Cannot read properties of undefined`. Every request to /admin crashes the handler rather than evaluating the credential check, and with no error-handling middleware the request hangs or surfaces an unrecoverable rejection.

```
app.post('/admin', (req, res) => {
  const key = req.body.admin_key;
```

**Fix:** Register `app.use(express.json({ limit: '100kb' }))` before the route definitions, and guard the access defensively (`const key = req.body?.admin_key`) plus add a centralized error-handling middleware so malformed payloads return 400 instead of crashing.

**Benefit:** Makes the admin route actually functional and prevents unhandled exceptions from malformed requests.

**Regression risk:** Low: adding a body parser changes req.body from undefined to an object for all POST routes; a size limit should be set to avoid unbounded JSON parsing.

---

### 🟡 MEDIUM Unreachable branch in all 60 legacy handlers (`if (!data)` after data is always assigned)

**Priority 3.8 · confidence 95% · effort moderate · source agent:bench-b**

> `src/legacy-monolith.js:8-23`

`data` is assigned on line 8 from `ROUTES[cacheKey] || {...}` — the fallback guarantees a truthy object, and line 9 then stores it. The `if (!data)` guard on line 10 can therefore never be true, making the entire nested/else-if response block (lines 10-21, repeated identically in all 60 handlers) dead code. Roughly 12 of every 22 lines in this 1330-line file are unreachable, which is why the file is hard to reason about: the real behavior is just `res.json(data)` on line 22.

```
const data = ROUTES[cacheKey] || { id, mode, stamped: Date.now() };
  ROUTES[cacheKey] = data;
  if (!data) {
      const nested = { ...data, id, mode };
```

**Fix:** Delete the dead branch and collapse each handler to its effective three lines. Better, replace all 60 near-identical handlers with one factory: `const makeHandler = (ns) => (req, res) => { ... }` and register them in a loop.

**Benefit:** Removes ~700 lines of unreachable code and reduces 60 copies of the same logic to one, making the actual response contract obvious.

**Regression risk:** Low: the removed branch is provably unreachable, so behavior is unchanged; any external caller relying on the `{}` responses would already not be receiving them.

---

### 🟡 MEDIUM Empty catch silently swallows store failures in loadRows

**Priority 3.6 · confidence 90% · effort moderate · source agent:bench-b**

> `index.js:31-38`

The catch block is empty, so any failure — a missing ./store module, a connection error, a malformed record — is indistinguishable from "this customer has no rows". The /render route then responds 200 'ok' having rendered nothing. This converts hard failures into silent data-loss-shaped successes and makes production incidents undiagnosable. The `require('./store')` inside the try also means a typo in the module path is permanently masked.

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

**Fix:** Log or rethrow: catch (e) { logger.error({ err: e, customer }, 'loadRows failed'); throw e; } and let the route return a 5xx. Move the require to the top of the file so module-resolution errors surface at boot rather than per-request.

**Benefit:** Failures become visible and alertable instead of looking like empty result sets.

**Regression risk:** Low: callers that relied on the empty-array fallback will now receive errors; that is the desired behavior but may change client-visible status codes.

---

### 🟡 MEDIUM Bare except swallows all errors and returns None in load_config

**Priority 3.6 · confidence 90% · effort moderate · source agent:bench-b**

> `server/auth.py:12-17`

A bare `except:` catches everything including KeyboardInterrupt, SystemExit, and MemoryError, then `pass` discards the exception object entirely. On any failure the function falls off the end and implicitly returns None, so callers cannot distinguish "file was empty" from "file missing", "permission denied", or "path is a directory" — and a Ctrl-C during the read is silently absorbed. This is the classic shape of a config loader that appears to work while returning nothing.

```
def load_config(path):
    try:
        with open(path) as fh:
            return fh.read()
    except:
        pass
```

**Fix:** Catch only the expected exceptions and handle them explicitly: `except FileNotFoundError: raise` / `except OSError as exc: logger.error(...); raise`, or return an Optional with a logged reason. Never use a bare except.

**Benefit:** Configuration failures surface immediately with a diagnosable cause instead of propagating None into unrelated code.

**Regression risk:** Low: callers that relied on the None fallback must handle the raised exception; that is the point of the change.

---

### 🟡 MEDIUM save_config leaks the file handle if write() raises

**Priority 3.6 · confidence 90% · effort moderate · source agent:bench-b**

> `server/auth.py:20-23`

The file is opened, written, and closed manually with no try/finally or context manager. If fh.write raises (disk full, quota exceeded, encoding error), fh.close() is never reached and the descriptor leaks until the GC finalizes it — under repeated failures this exhausts the process file-descriptor limit. Because the open with mode "w" truncates immediately, a failure mid-write also leaves the config file partially written and unrecoverable.

```
def save_config(path, data):
    fh = open(path, "w")
    fh.write(data)
    fh.close()
```

**Fix:** Use a context manager, and write atomically: `with open(path, 'w') as fh: fh.write(data)` — better, write to a temporary file in the same directory and os.replace() it over the target so readers never observe a truncated config.

**Benefit:** Guarantees descriptor release on all paths and prevents a failed save from corrupting the existing configuration.

**Regression risk:** Low: os.replace changes inode semantics slightly (watchers keyed on the old inode see a swap), which is generally desirable for config files.

---

### 🟡 MEDIUM Circular require between src/lib/a.js and src/lib/b.js

**Priority 3.2 · confidence 80% · effort moderate · source agent:bench-b**

> `src/lib/a.js:1-2`

a.js destructures `shared` from b.js at module load, while b.js (line 2) destructures `validate` from a.js. Whichever module is required first, the second one receives a partially-populated exports object: if a.js loads first, b.js's `validate` binding is captured before a.js reaches its module.exports on line 11, so `checkOnce()` in b.js throws "validate is not a function". The destructuring pattern makes this load-order-dependent and fragile — it happens to work today only because index.js requires a.js first and never calls checkOnce.

```
// Fixture: half of an import cycle (a.js ↔ b.js).
const { shared } = require('./b.js');
```

**Fix:** Break the cycle: move `shared()` into a third module (e.g. src/lib/shared.js) that both a.js and b.js require, or have b.js require a.js lazily inside checkOnce(). Prefer passing validate in as an argument over a back-require.

**Benefit:** Removes load-order-dependent runtime failures and makes the dependency graph acyclic.

**Regression risk:** Low: extracting shared() adds one small module; call sites for shared/checkOnce keep the same signatures.

---

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

### 🔵 LOW Leftover debugger statement in the /admin request path

**Priority 1.8 · confidence 90% · effort moderate · source agent:bench-b**

> `index.js:43-43`

A `debugger;` statement sits inside the production /admin handler, immediately after the credential check succeeds. Node honors this via V8 inspector semantics: when the process is started with --inspect (common in containerized debugging or an APM that enables the inspector) and a debugger attaches, execution pauses here on every successful admin login, holding the event loop and the request open indefinitely. Even without an inspector attached it is dead weight left in shipped code.

```
debugger;
```

**Fix:** Remove the statement, and add a lint rule (eslint no-debugger: error) plus a build step that fails on `debugger`/console.log leftovers so they cannot reappear.

**Benefit:** Eliminates a potential request-hang vector and prevents recurrence via CI.

**Regression risk:** None.

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

## Duplication (1)

### 🟡 MEDIUM 28-line block duplicated between helpers.js and utils.js

**Priority 3.8 · confidence 95% · effort moderate · source deterministic**

> `src/helpers.js:2-29`

Copy-paste: lines 2–29 of src/helpers.js repeat at lines 2–29 of src/utils.js. Duplicated logic drifts apart silently and doubles every future fix.

---
(agent:bench-b) src/helpers.js lines 2-32 are a byte-for-byte copy of src/utils.js lines 2-32 (the only difference is line 30, where utils.js uses a template literal and helpers.js uses string concatenation — the copy has already drifted). Two independent implementations of invoice total/tax computation mean a fix to the tax or rounding logic lands in one file only, producing invoices that disagree depending on which module a caller imported. helpers.js currently has zero importers, so it is a trap for the next developer rather than an active defect.

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

## Debt (11)

### 🟡 MEDIUM Unpinned and duplicated dependencies in package.json

**Priority 3.6 · confidence 90% · effort moderate · source agent:bench-b**

> `package.json:10-17`

`express: "latest"` and `lodash: "*"` are floating ranges: a fresh npm install can pull an arbitrarily newer major version, so builds are not reproducible and a breaking or compromised upstream release lands with no code change. lodash is declared twice — as `"*"` in dependencies and pinned to 4.17.21 in devDependencies — which is contradictory metadata; npm resolves lodash once for the tree, so the pin is misleading and the effective version is whatever satisfies `*`. left-pad at 1.0.0 is an unused micro-package that only adds supply-chain surface.

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

**Fix:** Pin exact versions for every dependency (express, lodash), keep a committed lockfile, remove the duplicate lodash devDependency entry, and drop left-pad if it is unused. Add npm audit / Dependabot to catch upstream advisories deliberately rather than by accident.

**Benefit:** Reproducible builds and a smaller, intentional dependency surface.

**Regression risk:** Low: pinning may surface previously unseen breaking changes on the next deliberate upgrade, which is the intended tradeoff.

---

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

### 🔵 LOW Orphan module src/orphan.js with an outdated hardcoded tax rate

**Priority 1.7 · confidence 85% · effort moderate · source agent:bench-b**

> `src/orphan.js:1-6`

Nothing in the repository imports this module, and its own comment marks the 1.22 multiplier as a pre-2019 tax table retained "just in case". A stale, unused tax calculation is a correctness hazard: if anyone does wire it up, invoices will be computed with a superseded rate, and its rounding (Math.round on a value already scaled by 100) also differs from the toFixed-based rounding used in src/utils.js, so the two would disagree by cents.

```
// Fixture: orphan module — nothing imports it.
function legacyTax(amount) {
  // XXX: pre-2019 tax table, kept "just in case"
  if (amount < 0) throw new Error('negative amount');
  return Math.round(amount * 1.22 * 100) / 100;
}
```

**Fix:** Delete the file; recover it from git history if the historical rate is ever needed for audits. If it must stay, move it to a clearly named test/fixture directory so it is not mistaken for production tax logic.

**Benefit:** Removes a misleading source of tax calculations that could produce incorrect invoices if reused.

**Regression risk:** Low: no importers in this repository.

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

### 🟡 MEDIUM legacy-monolith.js is dead code: 1330 lines, zero importers

**Priority 1.3 · confidence 32% · effort moderate · source agent:bench-b**

> `src/legacy-monolith.js:1330-1330`

This 1330-line module (86% of the repository's 1552 LOC) exports 60 handlers and is imported by nothing — the import graph reports 0 importers, and index.js requires only ./src/utils and ./src/lib/a. It is never loaded at runtime, so its unbounded ROUTES cache and dead branches are latent rather than active, but it dominates every search, review, and static-analysis run and will be treated as live code by the next reader.

> Validation: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

```
module.exports = { handler0, handler1, handler2, handler3, handler4, handler5, handler6, handler7, handler8, handler9, handler10, handler11, handler12, handler13, handler14, handler15, handler16, handler17, handler18, handler19, handler20, handler21, handler22, handler23, handler24, handler25, handler26, handler27, handler28, handler29, handler30, handler31, handler32, handler33, handle
```

**Fix:** Delete the file if it is genuinely retired (git history preserves it), or move it under a clearly-marked attic/ directory excluded from lint and coverage. If any handler is still needed, extract just that one into a properly named module and wire it into the router.

**Benefit:** Removes 1330 lines of misleading, unmaintained code from the review surface and shrinks the apparent codebase by 86%.

**Regression risk:** Low: nothing in the repository imports it; verify no out-of-repo or dynamic require references the path before deleting.

> ⚠️ Evidence unverified: snippet not present at the cited location (or anywhere in the file) — cited range kept, confidence heavily reduced

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

## Performance (5)

### 🟡 MEDIUM Sequential awaits in a loop plus unguarded async route handler

**Priority 3.4 · confidence 85% · effort moderate · source agent:bench-b**

> `index.js:19-29`

Two problems in one handler. First, each invoice is awaited one at a time, so total latency grows linearly with row count even though renderInvoice calls are independent — an N-row customer takes N times the per-item cost. Second, the async callback has no try/catch and Express does not handle rejected promises from async handlers, so any throw from loadRows or renderInvoice becomes an unhandled promise rejection: the client never receives a response and, depending on Node version and process settings, can terminate the worker. The three 'debug marker' console.log calls per row are leftover instrumentation that also floods stdout on every request.

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

**Fix:** Batch the independent work: `await Promise.all(rows.map(renderInvoice))` (or a concurrency-limited map if renderInvoice is heavy), wrap the body in try/catch that logs and returns a 5xx, and delete the debug marker logs.

**Benefit:** Cuts response time from O(N) to roughly O(1) in the number of rows and guarantees failed requests terminate with a proper error response.

**Regression risk:** Low: Promise.all rejects on the first failure, so if partial rendering must be preserved use Promise.allSettled instead.

---

### 🟡 MEDIUM Unbounded ROUTES cache keyed by user input in legacy-monolith

**Priority 3.4 · confidence 85% · effort moderate · source agent:bench-b**

> `src/legacy-monolith.js:4-10`

Every one of the 60 handlers in this file writes a new entry into the module-level `ROUTES` object on every request, keyed by the concatenation of user-controlled `req.params.id` and `req.query.mode`. There is no eviction, TTL, or size cap, so an attacker iterating `id`/`mode` grows the process heap without bound until the Node worker OOMs — a memory-exhaustion DoS reachable by any client that can hit these routes. The cache also never expires, so `stamped` entries are stale forever.

```
function handler0(req, res) {
  const id = req.params.id;
  const mode = req.query.mode || 'standard0';
  const cacheKey = 'k0:' + id + ':' + mode;
  const data = ROUTES[cacheKey] || { id, mode, stamped: Date.now() };
  ROUTES[cacheKey] = data;
  if (!data) {
```

**Fix:** Replace the plain object with a bounded LRU cache (e.g. lru-cache with max/TTL), or drop the cache entirely if these handlers are stateless. At minimum validate `id`/`mode` against an allowlist before using them as cache keys.

**Benefit:** Bounds memory usage and removes a trivial remote DoS vector.

**Regression risk:** Low: an LRU is a drop-in for the get/set usage here; eviction may cause recomputation, which is the intended tradeoff.

---

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

### 🔵 LOW Pointless JSON.parse(JSON.stringify(...)) deep-clone of a single field

**Priority 1.8 · confidence 90% · effort moderate · source agent:bench-b**

> `index.js:32-32`

This round-trips a one-property object through JSON serialization on every /render request purely to clone it. It allocates a string and a new object for no benefit, silently drops any non-JSON-serializable value (undefined, functions, BigInt throws outright, Date becomes a string), and obscures the fact that `data` is just `{ customer }`.

```
const data = JSON.parse(JSON.stringify({ customer }));
```

**Fix:** Write `const data = { customer };` — or use structuredClone if a genuine deep copy of a rich object is ever needed.

**Benefit:** Removes per-request serialization cost and the surprising type coercions.

**Regression risk:** None; behavior is identical for JSON-safe inputs.

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

- Evidence validation: **51** verified (verbatim snippet located inside the cited range), **0** adjusted (citation corrected to the snippet's real lines), **1** unverified (kept, flagged, down-weighted), **0** dropped before reporting.
- Verdict policy: model dismissals move findings to a visible "model-dismissed" group; critical/high/security findings are never auto-removed. This run: 0 dismissed, 0 contested.
- Secret handling: credential-like literals matched by the secret scan are replaced with type-preserving placeholders in this report and in all model prompts
- Deterministic checks executed: secrets (3), debt-markers (6), duplication (1), size (2), quality (13), deps (2), graph (2), ast-grep (0).
- Model runs:
  - bench-b (baidu/ernie-5.5-flash-preview:free) · structured · native · 1m 7s · 13174/16384 tokens — failed: Model returned unparseable JSON: {
  "verdicts": [
    {
      "id": "secrets@index.js:8-8:ZiMBNMUUgL",
      "action": "adjust",
      "severity": "high",
      "confidence": 0.95,
      "reason": "AWS key literal is present at inde
  - bench-b (baidu/ernie-5.5-flash-preview:free) · autonomous · native · 52.2s · 108452/10380 tokens — ok · finished: submitted

### Model notes

> bench-b (autonomous): Scope: all 9 source files read in full (index.js, src/utils.js, src/helpers.js, src/lib/a.js, src/lib/b.js, src/orphan.js, src/payment.ts, server/auth.py, package.json) plus .gitignore; src/legacy-monolith.js sampled at lines 1-142 and 1240-1330 with a repo-wide search confirming the handler pattern repeats uniformly through handler59 and that the file contains no eval/exec/secret/innerHTML occurrences. Highest-priority remediation order: (1) the three injection sinks — exec() in index.js:13, eval() in server/auth.py:9, and SQL concatenation in src/payment.ts:11; (2) the three committed credentials — index.js:8, index.js:42, server/auth.py:5 — all of which require rotation, not just deletion, since they are already in the source; (3) the /admin route, which is simultaneously unreachable-by-crash (no body parser) and unsafe-by-design (script-context string building). Caveats on confidence: previewFile (index.js:11-17) is defined but never mounted on a route, so the command injection is latent rather than currently reachable — I scored it critical on the sink but noted the caveat. The .env finding cites .gitignore only; tool policy blocked reading .env, so I cannot confirm its contents. src/legacy-monolith.js has zero importers, so its unbounded ROUTES cache and dead branches are latent; I still reported them because the file is 86% of the repo's LOC and will be treated as live by reviewers and tooling. src/payment.ts is TypeScript with no tsconfig or build step in package.js


---
Generated by `code-audit` v0.2.3 — read-only audit; no application files were modified. Exit-code policy: report-only (use --fail-on for CI gates).