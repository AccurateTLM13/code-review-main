# U3 — Owner validation script (~10 minutes, two repositories)

**Gate this decides:** "You can install and run a standard audit on two of your own non-sensitive projects, understand and act on the report, and repeat it reliably."
**Privacy reminder:** pick non-sensitive repos, or use `--models local` (Ollama) so nothing leaves the machine.

## Setup (once, ~2 min)

```powershell
cd E:\code\code-review-main
npm link                      # or: npm i -g .
code-audit --version          # expect: code-audit v0.2.3 (or newer)
```

## Per repository (~4 min each)

Run inside each of your two chosen repositories:

```powershell
# 1. standard audit with your preferred model profile
code-audit scan . --depth standard --models local
#    (or --models openrouter for a cloud audit of non-sensitive code)

# 2. open the report
code-audit last               # prints the summary + report paths
start .code-audit\reports     # or open the newest report.md directly
```

## What to check while reading (~2 min each)

1. **Can you tell defects from noise?** The executive summary separates **confirmed-defect claims** (with an evidence-verified count) from **maintenance observations** (duplication/refactoring/debt). Do the top priorities look like the things you would actually fix first?
2. **Is every claim checkable?** Top priorities contain only findings whose verbatim snippet matched the cited code. Unverified leads are in _Needs investigation_ and excluded from the priorities.
3. **Does the report say what it did NOT see?** The _Coverage & limitations_ section lists skipped binaries/oversized files/unsupported extensions and any walk truncation.
4. **If a model phase failed**, the report opens with a ⚠️ **PARTIAL AUDIT** banner naming the failed phase — you should never wonder whether the run was complete.

## Verdict form (fill in and paste back to the agent)

```
Repo 1: <name / one-line description>
  Ran with:      <profile used>
  Findings:      <N> (M defect / K maintenance — from the executive summary)
  Top priority:  <one line — what the report says to fix first>
  Actionable?    3 findings judged: <actionable / not actionable> ×3
  Understandable without help: <yes / no — what was unclear>
  Would run again: <yes / no>

Repo 2: <same fields>

Overall verdict: <PASS / FAIL — the gate is: understand and act on the report, repeat reliably>
Anything to fix before public beta: <list or "none">
```

**PASS criteria** (from the master roadmap M3 gate): both audits ran, you understood the report without author help, and you can name concrete findings you would act on. FAIL feedback is data — every confusion or false lead gets a disposition in the M3 pilot log.
