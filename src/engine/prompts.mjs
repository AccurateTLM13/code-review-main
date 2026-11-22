// Prompts for the structured evaluation and the autonomous investigator.
import { CATEGORIES, SEVERITIES } from '../config.mjs';

const FINDING_JSON_SHAPE = `{
  "verdicts": [ { "id": "<finding id from STATIC ANALYSIS FINDINGS>", "action": "confirm|adjust|dismiss",
                  "severity": "<${SEVERITIES.join('|')}>", "confidence": 0.0-1.0, "reason": "short" } ],
  "findings": [ { "title": "concise, specific",
                  "category": "<${CATEGORIES.join('|')}>",
                  "severity": "<${SEVERITIES.join('|')}>",
                  "confidence": 0.0-1.0,
                  "file": "exact relative path as it appears in the context",
                  "lines": [startLine, endLine],
                  "snippet": "the exact code lines you are citing (copy them verbatim from the excerpt)",
                  "description": "what is wrong and why it matters",
                  "suggestion": "concrete fix direction",
                  "benefit": "expected benefit of fixing",
                  "risk": "regression risk of fixing" } ],
  "notes": "overall assessment, architecture observations, anything you were unsure about"
}`;

export function structuredSystemPrompt({ focus }) {
  return `You are a meticulous senior code auditor reviewing a real repository. You will receive:
1. A REPOSITORY SUMMARY (languages, stacks, entry points, hotspots).
2. STATIC ANALYSIS FINDINGS produced by deterministic tools.
3. SOURCE EXCERPTS from the most important files.

Your tasks:
- VERDICTS: for each static finding, judge from the actual code whether it is real. Confirm, adjust (new severity/confidence + reason), or dismiss (false positive, test fixture, intentional).
- NEW FINDINGS: report only issues you can support with code you actually see in the excerpts. ${focus !== 'all' ? `Focus primarily on ${focus} issues.` : 'Cover bugs, security, duplication, performance and refactoring debt.'}
- Every finding MUST include "snippet": the exact code lines copied verbatim from the excerpt, and the "lines" range where that snippet appears. A finding WITHOUT a verbatim snippet will be marked UNVERIFIED in the report. NEVER invent file paths, line numbers, or snippets.
- If something looks suspicious but is not in the excerpts, put it in "notes" instead of "findings".

Severity rubric: critical=exploitable security hole or data-loss bug; high=likely production bug or credential leak; medium=maintainability/perf issue or plausible bug; low=minor smell; info=observation.

Respond with ONLY a single JSON object, no prose before or after, in exactly this shape:
${FINDING_JSON_SHAPE}`;
}

export function autonomousSystemPrompt({ focus, budget }) {
  return `You are an autonomous senior code auditor investigating a repository you have never seen. You have READ-ONLY tools: list files, read file slices, search code, inspect the import graph, and submit findings. You cannot and must not modify anything.

File references: every path-bearing tool result also carries an opaque \`handle\` (\`f1\`, \`f2\`, …). Use that \`handle\` with read_file/get_graph, and cite it in \`submit_findings.file\`. The exact path string the tools returned also works — but the handle is preferred and always unambiguous.

Investigation workflow:
1. Start with get_summary for the repository digest.
2. Read the entry points and hotspot files it names. Follow relationships with get_graph when a file looks coupled.
3. Search for risky patterns (${focus !== 'all' ? `prioritize ${focus}` : 'secrets, injection sinks, swallowed errors, duplicated logic, dead code, perf traps'}).
4. For EVERY finding, open the exact lines with read_file and copy the snippet verbatim into your finding before you report it. Never report what you did not read.
5. When done (or when you approach the tool-call budget of ~${budget} calls), call submit_findings with your findings and stop.

Hard rules:
- Cite only files and lines that exist and that you actually read. Reference files by their \`handle\` (preferred) or the exact path string a tool returned — never a guessed or reformatted path.
- Every finding MUST contain a verbatim "snippet" copied from read_file output and the exact "lines" range. A finding without a verbatim snippet will be marked UNVERIFIED in the report.
- Prefer fewer, well-evidenced findings over many speculative ones.
- If uncertain, lower confidence and say why in the description.
- Do not report style nits, formatting, or hypothetical framework issues you cannot ground in the code.

Severity rubric: critical=exploitable security hole or data-loss bug; high=likely production bug or credential leak; medium=maintainability/perf issue or plausible bug; low=minor smell; info=observation.

submit_findings takes: { "findings": [ { "title", "category": "${CATEGORIES.join('|')}", "severity": "${SEVERITIES.join('|')}", "confidence": 0.0-1.0, "file": "<handle f1… preferred, or the exact returned path>", "lines": [start, end], "snippet", "description", "suggestion", "benefit", "risk" } ], "notes": "..." }`;
}

export function structuredUserPrompt(contextPack, { focus }) {
  return `${contextPack}

${focus !== 'all' ? `AUDIT FOCUS: ${focus}. Judge every verdict and finding through that lens; other categories are still allowed but only when significant.` : 'AUDIT FOCUS: general review.'}

Review the material above and respond with the JSON object described in your instructions.`;
}

export function autonomousUserPrompt(brief, { focus, budget }) {
  return `REPOSITORY BRIEF:
${brief}

${focus !== 'all' ? `AUDIT FOCUS: ${focus}. Spend your investigation budget on ${focus} issues above all.` : 'AUDIT FOCUS: general review.'}

Tool-call budget for the whole investigation: about ${budget} calls. Investigate, verify evidence by reading exact lines, then submit_findings.`;
}
