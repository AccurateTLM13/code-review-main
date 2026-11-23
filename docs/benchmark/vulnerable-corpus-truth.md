# Benchmark — Labeled vulnerable corpus: ground truth

**Corpus:** [`examples/vulnerable-app`](../../examples/vulnerable-app) · **Prepared:** 2026-11-22 (M2.2)
**Method:** every row was written by **reading the fixture content**, not by running the tool, and not from tool output. All credential-like strings are synthetic and planted on purpose (see the repository note in `README.md`).

Adjudication rule (M2.6): a model finding is a **TP** for a row when it cites the same file, its line range overlaps the row's range by ±5 lines, and the category matches the row's category. Findings matching no row are FPs; truth rows never matched by any finding are **missed planted defects** (recall denominator).

## Ground truth rows

| id | file | lines | category | expected severity | planted defect |
|---|---|---|---|---|---|
| V-01 | index.js | 8 | security | critical | AWS access key literal (`AKIA…`) hardcoded in source |
| V-02 | index.js | 12–14 | security | critical | command injection: user-supplied `req.query.name` concatenated into `exec()` |
| V-03 | index.js | 14–15 | bug | medium | `exec` callback swallows the error (`if (err) { }`) |
| V-04 | index.js | 21–27 | performance | medium | sequential `await` inside a loop over rows (serialized requests) |
| V-05 | index.js | 24–26 | debt | low | debug `console.log` markers left in a route |
| V-06 | index.js | 33–36 | bug | medium | empty catch block swallows store failures |
| V-07 | index.js | 34 | bug | high | `require('./store')` references a module that does not exist; failure masked by the try/catch (returns `[]` silently) |
| V-08 | index.js | 42 | security | high | hardcoded admin password comparison (`'hunter2'`) |
| V-09 | index.js | 43 | debt | low | `debugger;` statement left in shipped code |
| V-10 | index.js | 44–46 | security | high | XSS: user-controlled `admin_key` interpolated into an inline `<script>` + `innerHTML` sink |
| V-11 | index.js | 40–50 | bug | high | `app.post('/admin', (req, res) => { … }` is never closed with `);` — syntax error |
| V-12 | .env | 1–2 | security | critical | committed `.env` with live-shaped Stripe key and a DB URL containing a password |
| V-13 | src/utils.js | 2–32 | duplication | medium | `renderInvoice` block copy-pasted verbatim into `src/helpers.js` (same lines there) |
| V-14 | src/payment.ts | 10–12 | security | critical | SQL query built by string concatenation with user input (`TODO: parameterize`) |
| V-15 | src/payment.ts | 15–18 | security | critical | `eval('(' + text + ')')` on untrusted input, plus an assertion-eliding `as PaymentRow[]` cast |
| V-16 | src/legacy-monolith.js | 1–1330 | refactoring | high | 60 near-identical copy-pasted handlers in one 1330-line module (size hotspot + massive duplication) |
| V-17 | src/legacy-monolith.js | 8–9 | bug | high | module-level `ROUTES` cache written on every request, never evicted — unbounded memory growth |
| V-18 | src/legacy-monolith.js | 10 | bug | low | `if (!data)` is dead: `data` is always truthy after `ROUTES[k] \|\| {…}` |
| V-19 | src/orphan.js | 1–8 | debt | low | orphan module — nothing imports it (dead code) |
| V-20 | src/lib/a.js | 2 | debt | medium | import cycle `a.js ↔ b.js` (see also src/lib/b.js:2) |
| V-21 | server/auth.py | 9 | security | critical | `eval(user_input)` — arbitrary code execution sink |
| V-22 | server/auth.py | 13–17 | bug | medium | bare `except:` swallows every error (config load fails silently) |
| V-23 | server/auth.py | 21–23 | bug | medium | file handle never closed; not opened as a context manager (leaks on error) |
| V-24 | server/auth.py | 26–29 | bug | high | payment `charge` without an idempotency key — double charges on retry (`FIXME`) |
| V-25 | server/auth.py | 29 | security | medium | payment endpoint called over plain HTTP |
| V-26 | server/auth.py | 5 | security | critical | hardcoded GitHub PAT literal |
| V-27 | package.json | 10–17 | debt | medium | unpinned deps (`express: "latest"`, `lodash: "*"`), duplicate lodash pin in devDependencies, deprecated `left-pad`; no lockfile in the fixture |

**Denominators:** 27 planted rows — security 10, bug 9, debt 5, duplication 1, performance 1, refactoring 1.

Notes for adjudication:
- V-11 (missing `);`) is verifiable by parsing, not by reading intent — a finding may cite it as "unclosed function call / syntax error" with category bug.
- V-13's counterpart rows live in `src/helpers.js` 2–32; a TP citing **either** file with the duplication category satisfies the row (the pair counts once for recall).
- V-20 likewise: citing either cycle half satisfies the row.
- Findings that flag the synthetic secrets as secrets (V-01/V-12/V-26) remain TPs even though the report shows them redacted — the tool is *expected* to detect-then-redact.
- V-08 (`hunter2`) is quoted verbatim in finding snippets by design: the 7-char low-entropy password is below the redaction registry (MIN_LITERAL 8, credential-shaped formats only), and an audit citing the hardcoded-password line is correct behavior, not leakage. The benchmark leak sweep therefore does not include it (only credential-format tokens + the DB-URL password are swept).
- Anything on `.gitignore` content, `logs/`, or fixture commentary lines is expected noise (FP) unless it maps to a row.

---

# Benchmark — Clean reference corpus

**Corpus:** [`examples/clean-app`](../../examples/clean-app) · **Expected findings: 0** (zero-defect reference).

Contents: `package.json` (pinned deps, lockfile present, `"type": "module"`), `src/greet.js`, `src/calc.js`, `lib/util.py`. The corpus deliberately contains no planted defect; every deterministic or model finding on it is a **false positive** by definition and counts against precision/noise. `package-lock.json` exists here (so the "no lockfile" check must stay silent).

**Correction (2026-11-22, found by the benchmark itself):** the fixture was NOT initially zero-defect — `src/*.js` used ESM syntax while `package.json` lacked `"type": "module"`, so `npm start` would crash. Ernie 5.5 flagged exactly this at high severity during run `m2-2026-11-22` (correctly). The fixture was repaired by adding `"type": "module"`; the clean-corpus expectation of zero findings is well-founded again. The unused `express` dependency remains (an `info`-level observation, below the P0/P1 gate) and is accepted noise.
