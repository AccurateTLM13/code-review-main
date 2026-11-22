# METRICS — benchmark run `m2-2026-11-22`

- Generated: 2026-11-22T22:49:08.723Z
- Models: nvidia/nemotron-3-ultra-550b-a55b:free, baidu/ernie-5.5-flash-preview:free
- CLI: v0.2.3 · Node v24.16.0 · git 6d0163018348170b106bb59dbbe6a803d06bf42b
- Runs recorded: 18 · leak sweep: clean

| model | corpus | reps | failed | findings | verified | adjusted | unverified | citation % | P0/P1 | TP(all) | FP(all) | precision (P0/P1) | recall rows | runtime ms (min–max) | tokens | instability |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nvidia/nemotron-3-ultra-550b-a55b/free | clean | 3 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 2 | n/a (no P0/P1 findings) | — | 4438–35686 | 41031 | 0/0 |
| nvidia/nemotron-3-ultra-550b-a55b/free | labeled | 3 | 0 | 125 | 104 | 19 | 2 | 98 | 30 | 24 | 101 | 37% (11/30) | 24 | 105110–229790 | 186556 | 29/36 |
| nvidia/nemotron-3-ultra-550b-a55b/free | express | 3 | 0 | 79 | 65 | 7 | 7 | 91 | 0 | 0 | 0 | pending-adjudication | — | 80544–171177 | 1478155 | 14/22 |
| baidu/ernie-5.5-flash-preview/free | clean | 3 | 0 | 3 | 2 | 1 | 0 | 100 | 1 | 0 | 3 | n/a (no P0/P1 findings) | — | 2297–17072 | 16910 | 0/0 |
| baidu/ernie-5.5-flash-preview/free | labeled | 3 | 0 | 110 | 109 | 0 | 1 | 99 | 24 | 20 | 90 | 42% (10/24) | 20 | 66682–119456 | 207506 | 29/29 |
| baidu/ernie-5.5-flash-preview/free | express | 3 | 0 | 60 | 60 | 0 | 0 | 100 | 0 | 0 | 0 | pending-adjudication | — | 54662–109363 | 1404783 | 20/20 |

TP(all)/FP(all) are mechanical over every non-dismissed finding vs the planted truth table; **precision (P0/P1)** is the master-gate metric: mechanical TP share over the P0/P1 denominator (human adjudication may reclassify — see REPORT.md).

**Mechanical TP rule (labeled corpus):** same file, line range overlapping ±5, same category — per `docs/benchmark/vulnerable-corpus-truth.md`. Human adjudication may reclassify; deviations are recorded in REPORT.md.

**Missed planted rows (nvidia/nemotron-3-ultra-550b-a55b/free):** V-03, V-20, V-27 (recall 24/27 = 89%)

**Missed planted rows (baidu/ernie-5.5-flash-preview/free):** V-03, V-05, V-09, V-13, V-18, V-20, V-24 (recall 20/27 = 74%)

**Failure modes recorded:** see `index.json` entries (exit codes, stderr tails, 429 throttling flags). Failures are data, not surprises.
