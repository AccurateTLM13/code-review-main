# Code Audit — Canonical Roadmap & Gate Tracker

**Maintained here:** this file is the single source of truth for milestone status.
**Execution detail:** [`docs/EXECUTION_PLAN.md`](docs/EXECUTION_PLAN.md) — the full autonomous playbook (tasks, pre-made decisions, commands, references, checkpoints).
**Source directive:** [`docs/ROADMAP-SOURCE-2026-11-20.md`](docs/ROADMAP-SOURCE-2026-11-20.md) — the master product & release roadmap this tracker implements.

**Status conventions:** a gate is only marked PASS with specific evidence (test/commit/release links). "Do not mark a milestone complete solely because an implementing agent reports success."

---

## Milestone status

| Milestone | Meaning | Status | Evidence |
|---|---|---|---|
| **M0** — Foundation & offline suite | working prototype + A1–A20 acceptance suite | **COMPLETE** | v0.2.2 @ `e2105baf`, 175/175 offline checks, Ubuntu CI green (Node 20/24) |
| **M1** — A21–A23 security/reliability blockers | tool-result boundary + handles; loopback-only trust; bounded regex | **COMPLETE** | `v0.2.3` — 224/224 offline checks; failing-before proof on a pre-fix worktree (`e2105baf`); independent adversarial replay: 0 reproductions, 1 same-class adjacency finding fixed; [`docs/phase-reports/M1.md`](docs/phase-reports/M1.md) |
| **M2** — First real-model benchmark | 2 distinct OpenRouter free-tier models × 3 corpora | **PLANNED** (plan §3; key arrives via `.env`) | — |
| **M3** — Personal-ready | clean Windows install, fail-safe matrix, coverage honesty, pilots | **PLANNED** (plan §4; user validates at U3) | — |
| **M4** — Public CLI beta | tarball-validated package, cross-platform CI, community docs | **PLANNED** (plan §5; user publishes at U4) | — |
| **M5** — Stable v1.0 | compatibility/maintenance policy, final sweeps, external reproducer | **PLANNED** (plan §6; U5) | — |

## Gate table

| Gate | Status | Blocking next target? | Evidence |
|---|---|---|---|
| A1–A20 offline acceptance | **PASS** (175/175, v0.2.2 independent rerun) | must remain green | `npm test`; CI run `44759501879` |
| A21 tool-result boundary (read_file/search_code path fields) | **PASS** (v0.2.3: one `emit()` gate + opaque handles; 15/15 pre-fix reproduction checks now pass; replay: not reproduced, hostile-adapter end-to-end clean) | No — closed | [`docs/phase-reports/M1.md`](docs/phase-reports/M1.md) §1–§5; suite [24] |
| A22 endpoint trust (`.local`/docker/0.0.0.0 treated local) | **PASS** (v0.2.3: loopback-only trust; 7/7 pre-fix reproduction checks now pass; replay: not reproduced) | No — closed | [`docs/phase-reports/M1.md`](docs/phase-reports/M1.md) §1–§5; suite [25] |
| A23 regex hard deadline (model-authored regex hangs process) | **PASS** (v0.2.3: worker + canary + hard terminate deadline; pre-fix hang confirmed via 5 s watchdog, post-fix budget error in ~0.1–0.2 s; replay: not reproduced) | No — closed | [`docs/phase-reports/M1.md`](docs/phase-reports/M1.md) §1–§5; suite [26] |
| Live-model reliability | **NOT TESTED** | Yes — M2 | harness + pins + ground truth ready (`docs/benchmark/`); first live call awaits the `.env` key (U2-pre) |
| Windows personal installation | **PASS** (clean checkout + `npm ci` + 224/224 suite + scan + `npm link` on Windows 11, `e13fe53`) | No — verified early | [`docs/phase-reports/M3.md`](docs/phase-reports/M3.md) §M3.1 |
| Cross-platform public package | **NOT VERIFIED** | Yes — M4 | — |
| Native MCP integration | **NOT BUILT** | No — optional backlog (plan §7) | — |
| Public CLI v1.0 | **NOT RELEASED** | M5 | — |

## User checkpoints

| ID | When | Status |
|---|---|---|
| U1 — benchmark models, publish policy, pilot policy | 2026-11-20 | ✅ answered (2 free OpenRouter models; tarball validation + user publishes; OSS pilots + gate validation) |
| U2 — M2 sign-off (+ `OPENROUTER_API_KEY` into `.env` if not yet) | end of M2 | pending |
| U3 — two own-repo validations (~10 min) | end of M3 | pending |
| U4 — `npm publish` | end of M4 | pending |
| U5 — external developer reproduction | end of M5 | pending |

## Decision log

Pre-made decisions D1–D9 (A21–A23 designs, model sourcing, `.env` keys, publish policy, commit conventions, hardening discipline): see `docs/EXECUTION_PLAN.md` §10.

## Immediate next action

M1 is complete (`v0.2.3`). Per the master roadmap's assignment: **proceed to the M2 benchmark plan** — two distinct OpenRouter free-tier models × three corpora (clean / labeled / real OSS repos), with the key arriving via `.env` (checkpoint U2 at the first live call). Non-dependent M2 tasks (ground truth, repo pins, harness) can run before the key arrives. Full task breakdown: `docs/EXECUTION_PLAN.md` §3.
