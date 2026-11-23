# METRICS — benchmark run `m3-quality-1`

- Generated: 2026-11-23T02:33:16.826Z
- Models: nvidia/nemotron-3-ultra-550b-a55b:free, baidu/ernie-5.5-flash-preview:free
- CLI: v0.2.3 · Node v24.16.0 · git 3d06e0979cf83d18512595e7765193d45b7932f2
- Runs recorded: 18 · leak sweep: clean

| model | corpus | reps | failed | findings | verified | adjusted | unverified | citation % | P0/P1 | TP(all) | FP(all) | precision (P0/P1) | recall rows | runtime ms (min–max) | tokens | instability |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nvidia/nemotron-3-ultra-550b-a55b/free | clean | 3 | 0 | 2 | 1 | 0 | 1 | 50 | 0 | 0 | 2 | n/a (no P0/P1 findings) | — | 4286–49290 | 37599 | 0/0 |
| nvidia/nemotron-3-ultra-550b-a55b/free | labeled | 3 | 0 | 123 | 102 | 18 | 3 | 98 | 25 | 25 | 98 | 40% (10/25) | 25 | 76922–280928 | 179399 | 29/37 |
| nvidia/nemotron-3-ultra-550b-a55b/free | express | 3 | 0 | 73 | 62 | 6 | 5 | 93 | 0 | 0 | 0 | pending-adjudication | — | 117520–207141 | 185460 | 20/26 |
| baidu/ernie-5.5-flash-preview/free | clean | 3 | 0 | 0 | 0 | 0 | 0 | — | 0 | 0 | 0 | n/a (no P0/P1 findings) | — | 2683–13702 | 2761 | 0/0 |
| baidu/ernie-5.5-flash-preview/free | labeled | 3 | 0 | 87 | 87 | 0 | 0 | 100 | 15 | 18 | 69 | 33% (5/15) | 18 | 72199–115827 | 88674 | 29/29 |
| baidu/ernie-5.5-flash-preview/free | express | 3 | 0 | 77 | 62 | 15 | 0 | 100 | 0 | 0 | 0 | pending-adjudication | — | 62546–115615 | 197706 | 14/29 |

TP(all)/FP(all) are mechanical over every non-dismissed finding vs the planted truth table; **precision (P0/P1)** is the master-gate metric: mechanical TP share over the P0/P1 denominator (human adjudication may reclassify — see REPORT.md).

**Mechanical TP rule (labeled corpus):** same file, line range overlapping ±5, same category — per `docs/benchmark/vulnerable-corpus-truth.md`. Human adjudication may reclassify; deviations are recorded in REPORT.md.

**Missed planted rows (nvidia/nemotron-3-ultra-550b-a55b/free):** V-09, V-20 (recall 25/27 = 93%)

**Missed planted rows (baidu/ernie-5.5-flash-preview/free):** V-03, V-05, V-09, V-13, V-17, V-18, V-20, V-24, V-27 (recall 18/27 = 67%)

**Failure modes recorded:** see `index.json` entries (exit codes, stderr tails, 429 throttling flags). Failures are data, not surprises.
