# M2.1 — Model selection record (2026-11-22)

**Task:** pick two live, genuinely distinct models for the M2 benchmark (decision D4: two OpenRouter free-tier families, zero cost).

## Catalog state at selection time

The plan's defaults (`qwen/qwen3-coder:free`, `deepseek/deepseek-chat-v3.1:free`) were **no longer present** in the free tier on 2026-11-22 — the free catalog had churned in the two days since the plan was written. Fallback rubric (per `docs/EXECUTION_PLAN.md` M2.1): "the two highest-capability free coder models present" — with the catalog offering no coding-specific free models, the operative filter became: free (`pricing.prompt === "0"` **and** `pricing.completion === "0"`), context ≥ 32k, tool-calling support (`supported_parameters` includes `tools`), **distinct families**, highest capability, **proven health on the free tier**.

12 candidates passed the static filter. Health was measured with 1–3 tiny live `chat/completions` calls per candidate (free tier, $0):

| candidate | context | health probe | verdict |
|---|---|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1,000,000 | 200 OK (reasoner — emits reasoning tokens) | **selected — bench-a** |
| `baidu/ernie-5.5-flash-preview:free` | 1,024,000 | 3/3 200 OK | **selected — bench-b** |
| `inclusionai/ling-3.2-flash:free` | 1,048,576 | 0/3 — persistent upstream 429 | rejected (throttled) |
| `google/gemma-4-31b-it:free` | 262,144 | 0/3 429 | rejected (throttled) |
| `google/gemma-4-26b-a4b-it:free` | 262,144 | 0/3 429 | rejected (throttled) |
| `particle-ai/particle-1:free` | 1,048,576 | 1/3 200, 2× 429 | rejected (intermittent throttle) |
| `recursive/flint-v1.0:free` | 262,144 | 3/3 200 (finish=length at 16 tokens — heavy reasoner) | healthy but smaller ctx / unknown family strength — reserve |
| `liquid/lfm-3-1.7b:free` | 262,144 | 3/3 200 | healthy but 1.7B — below capability bar — reserve |
| `openrouter/free` | 200,000 | n/a | excluded — meta-router, not a fixed model |
| `baidu/ernie-5.5-flash-preview:free` duplicates, nvidia 3.5 variants | — | — | same family as picks — distinctness rule |

## Selected

- **bench-a: `nvidia/nemotron-3-ultra-550b-a55b:free`** — NVIDIA Nemotron 3 Ultra (550B MoE / A55B active), 1M context, tool-capable. Highest-capability free model present. Reasoning model (recorded: reasoning tokens count toward output budget; bench output budget raised to 16,384 after a truncation at 8,192 was observed).
- **bench-b: `baidu/ernie-5.5-flash-preview:free`** — Baidu Ernie 5.5 flash preview, 1M context, tool-capable. Healthiest distinct family (3/3 probes).

**Recorded key facts:** free-tier key (`limitRemaining: 1`, expires 2026-11-25); all `:free` calls cost $0 (`cost: 0` in usage); 429 upstream throttling is normal and recorded as data. Profile shape (identical for both): `provider: openrouter, adapter: native, temperature 0.2, maxTokens 16384, contextChars 200000, maxSteps 28`.

## Pre-matrix shakedowns (offline corpus, live model)

- nemotron-ultra × clean × standard → exit 0, 5.0 s, 0 findings (clean-corpus noise floor respected).
- particle-1 × clean × standard → exit 0, 0 findings (before its throttling worsened).
- ernie × labeled × **deep** → exit 0, 70.5 s: structured pass truncated its verdict JSON at the 8,192-token cap (recorded, led to the budget raise); **autonomous pass succeeded** — 28 steps, ~92k input tokens, 17 agent findings, all evidence-verified against the corpus. Tool loop confirmed working end-to-end with a live free model.
