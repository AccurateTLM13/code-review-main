# M3.6 — Pilot audits & recommendation quality (round 2 engine)

**Material:** round-2 benchmark run `m3-quality-1` (engine @ `3d06e09` — consolidation, kind split, verified-only summary, partial labeling), express clone @ `4.19.2`.
**Pilots:** nemotron-3-ultra `--depth deep` (complete pipeline) · ernie-5.5 `--depth standard` ×2 (its deep run failed — output-budget exhaustion + 429 — and the report correctly carries the **PARTIAL AUDIT** banner; the pilot uses its standard runs and says so).

**The practical question:** *would the owner rather read this audit than investigate the codebase themselves?*

**Answer: yes for defect triage, with caveats on routing-semantics depth.** Each audit yields a short verified worklist (below) that a maintainer could start on immediately; what they do not replace is behavioral verification of subtle routing claims.

---

## Pilot 1 — nemotron deep (27 findings: 3 defect claims, 23 maintenance)

Executive summary: **3 defect claims, all evidence-verified; 23 maintenance observations.** One model phase failed mid-run and the report opens with the PARTIAL AUDIT banner (working as designed). Unverified items are excluded from priorities.

| disposition | count | detail |
|---|---|---|
| actionable | 6 | `sendfile`/`sendFile` duplication (adjusted, confirmed by inspection); no-lockfile (trivial); `res.send` legacy argument permutations; trust-proxy string back-compat (confirmed in round 1); TODO marker; 20-line in-file duplication |
| redundant | 3 | oversized-file/locking observations repeat per report structure (grouped, not merged across categories — A2 semantics preserved) |
| speculative | 2 | router `matchLayer` error-as-result behavior; hardcoded sync-iteration limit — precisely located but behaviorally unproven → same class the owner dispositioned **~** at U2 |
| incorrect | 1 | `http://` in a JSDoc example (`response.js:82`) — **the owner's U2 finding; fixed at the check level this round** (comment-aware matching, regression-tested) |
| unverified (excluded from priorities) | 2 | test-file size aggregation; utils deprecations-internal-use |
| correct maintenance bulk | 13 | oversized files, deep nesting (×6), large files (×3), hub module |

## Pilot 2 — ernie standard (35 findings: 8 defect claims — all evidence-verified — 21 maintenance, partial=false)

| disposition | count | detail |
|---|---|---|
| actionable | 8 | **`res.sendfile` skips the path validation `res.sendFile` enforces** (verified by inspection: `sendFile` throws on falsy/non-string/non-absolute paths at `response.js:427-443`; `sendfile` performs none before `send()` at `:516`) — the strongest finding of either pilot; `res.jsonp` callback reflection (real, documented-express behavior, low is fair); `res.clearCookie` path-default gotcha (real); `app.use`/`router.use` duplicated mount-path block (verified); `send`/`json`/`jsonp` legacy argument shuffle duplication (×3 plausible-verified); deprecated sendfile divergence |
| redundant | 4 | option-matrix duplication in tests (×2), urlencoded matrices, response.js responsibilities |
| speculative | 3 | `mergeParams` mutation/numeric-index (owner already marked the sibling claim **~**); `use()` non-function first-arg handling; `res.download` `Object.create(opts)` prototype-clone subtlety — all precisely located, none behaviorally proven |
| incorrect | 1 | same `response.js:82` JSDoc false positive (deterministic; fixed at check level) |
| correct maintenance bulk | 19 | oversized files, deep nesting, large files, hub, TODO |

## The consolidated worklist (what a maintainer would actually act on)

1. **`res.sendfile` → deprecate toward removal or port `sendFile`'s validation into it** — the deprecated path skips falsy/string/absolute-root validation entirely (`response.js:502-516` vs `:427-443`). Security-relevant API divergence. *(ernie, verified by inspection)*
2. **`sendfile`/`sendFile` wrapper duplication + path-encoding divergence** — consolidate the two wrappers. *(both models, spot-checked)*
3. **`res.clearCookie` path-default gotcha** — document or allow attribute passthrough. *(ernie)*
4. **`matchLayer` error-as-result behavior** — write a behavioral repro before treating as a bug. *(nemotron — speculative)*
5. **trust-proxy back-compat string keying** — low-priority fragility cleanup. *(both rounds)*
6. Maintenance: no lockfile; oversized `response.js` (1,179 lines) and five >800-line test files; duplicated legacy argument-shuffle blocks.

## Engine changes shipped from the pilot findings (focused, regression-tested)

- **Comment-aware quality matching** — matches starting on comment-only lines (`//`, `/*`, JSDoc `*`, `#`, `<!--`) are documentation, not active code; the demonstrated `http://`-in-JSDoc false positive is gone, with a positive control proving active-code URLs still flag. (Regression: smoke [29].)
- Everything else was already in this round's engine: kind split, verified-only priorities, partial-audit banner (exercised live by the failed ernie deep run), cross-source consolidation.

## What would make the audits *more* worth reading than self-investigation

1. **Prove the speculative router claims or drop them** — per the U2 disposition, they need failing repros; until then they are flagged, not asserted.
2. **Volume control on maintenance observations** — six "deep nesting" findings for six test files could summarize as one grouped observation; left as-is to avoid over-merging (A2 semantics), noted as follow-up.
3. **The "all-clear as a finding" quirk** — agents occasionally submit an info-level "no issues found" finding instead of using `notes` (seen in both engines' deep runs). Harmless at `info` severity, never P0/P1; recorded here rather than patched to avoid mid-stream prompt churn.
