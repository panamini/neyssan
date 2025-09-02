# LLM Selection Architecture (CURRENT — includes GPT‑4)

Legend:
- [CONFIG] = centralized config
- (Adapter) = runtime adapter instance
- -->  = synchronous call / decision
- -x-> = fallback path
- [TELEMETRY] = emitted telemetry keys (examples)

--------------------------------------------------------------------------------
ASCII Diagram: End-to-end selection, call, and fallback (CURRENT)
--------------------------------------------------------------------------------

[CONFIG]
[`my-app/config/llmConfig.ts:12`](my-app/config/llmConfig.ts:12)
  | provider, model, forceGpt5NanoOnly
  v
[getLLMAdapter / callPreferredProvider]
[`my-app/config/llmAdapters.ts:503`](my-app/config/llmAdapters.ts:503)
  |
  |-- Check: forceGpt5NanoOnly?
  |     |
  |     |-- YES -------------------------------------------------------------.
  |     |                                                                      \
  |     |  Use only OpenAI (gpt-5-nano)                                        \
  |     |  - Emit: adapter.call_plan { mode: "gpt-only", chosenModel }          \
  |     |  - Emit: adapter.delegate_attempt / adapter.provider_attempt         \
  |     v                                                                      v
  |   (OpenAIAdapter)  <----------------------------------------------- (caller)
  |   createOpenAIAdapter(config)                                              |
  |   - SDK attempt (dynamic import)                                           |
  |     -> [TELEMETRY] adapter.sdk_attempt                                     |
  |   - Fetch fallback to /v1/responses                                        |
  |     -> [TELEMETRY] adapter.fetch_response                                  |
  |   - On model_not_found -> emit adapter.fallback_trace, retry once          |
  |     -> [TELEMETRY] adapter.fallback_trace                                  |
  |                                                                             |
  |-- NO ---------------------------------------------------------------------'
        |
        |-- Preferred provider per llmConfig.provider or defaults
        |     |
        |     |-- If provider === "mistral"  -------------------------------.
        |     |                                                                \
        |     v                                                                 \
        |   (MistralAdapter) createMistralAdapter(config)                       \
        |   - POST https://api.mistral.ai/v1/chat/completions                    \
        |   - retries on 429 (exp backoff + jitter)                             \
        |     -> [TELEMETRY] adapter.mistral_retry                              \
        |   - on success -> normalize outputs (output[], generations[], text)   \
        |     -> [TELEMETRY] adapter.mistral_response                            \
        |   - on error (after retries) -> emit adapter.mistral_error &          \
        |     adapter.fallback_trace -> FALLBACK to OpenAI                       \
        |     -> [TELEMETRY] adapter.fallback_trace                              |
        v                                                                      v
    (OpenAIAdapter) <---------------------------------------------------------'
      (fallback or configured)

Legacy/Out-of-band path:
  - (GPT4Adapter) `my-app/convex/langchain/models/gpt4_adapter.ts:1`
  - Instantiated in: [`my-app/convex/generateProposalMutation.ts:1`](my-app/convex/generateProposalMutation.ts:1), [`my-app/convex/langchain/index.ts:1`](my-app/convex/langchain/index.ts:1)
  - This path bypasses llmConfig and creates a direct GPT‑4 dependency.

--------------------------------------------------------------------------------
CALL FLOW (detailed sequence / telemetry)
--------------------------------------------------------------------------------

Caller (e.g., `hybridParser` / `ProposalService`) --> getLLMAdapter/callPreferredProvider
  -> emit: adapter.call_plan { requestedModel, forceGpt5NanoOnly }
  -> emit: adapter.delegate_attempt { provider, requestedModel }

Path A: Mistral (preferred)
  (MistralAdapter) attempt #1
    - emit: adapter.mistral_attempt
    - on 429 -> emit: adapter.mistral_retry (with attempt index, status)
    - on persistent failure -> emit: adapter.mistral_error
    - on final failure -> emit: adapter.fallback_trace { requestedModel, provider: "mistral", outcome:"error" }
    - then: FALLBACK -> OpenAIAdapter (emit provider_attempt/provider_result entries)

Path B: OpenAI
  (OpenAIAdapter) SDK path:
    - emit: adapter.sdk_attempt { model }
    - on success: adapter.sdk_response
  (OpenAIAdapter) Fetch path:
    - call /v1/responses (body.model = effectiveModel)
    - emit: adapter.fetch_response { keys }
    - on 400 && model_not_found -> emit: adapter.fallback_trace { requestedModel, attemptedModel, attemptIndex }
      -> retry once with fallbackModel (e.g., "gpt-4o-mini") and emit provider_result/outcome
    - final result -> emit: adapter.provider_result { provider:"openai", success:true/false }

Telemetry short-circuit examples:
  - adapter.call_plan  -> describes chosen plan (mistral-first / openai-only / forceGpt5NanoOnly)
  - adapter.delegate_attempt -> records which provider attempted
  - adapter.delegate_response -> records provider response summary
  - adapter.fallback_trace -> records fallback decisions, attemptedModel/history

--------------------------------------------------------------------------------
FILES referencing GPT‑4 (search hits)
--------------------------------------------------------------------------------
- [`my-app/convex/generateProposalMutation.ts:1`](my-app/convex/generateProposalMutation.ts:1)
- [`my-app/convex/langchain/models/gpt4_adapter.ts:1`](my-app/convex/langchain/models/gpt4_adapter.ts:1)
- [`my-app/convex/langchain/index.ts:1`](my-app/convex/langchain/index.ts:1)
- [`my-app/convex/langchain/models/index.ts:1`](my-app/convex/langchain/models/index.ts:1)

(These files either import/instantiate GPT4Adapter or include GPT‑4 model defaults.)

--------------------------------------------------------------------------------
POST‑GPT‑4 REMOVAL: target selection flow (proposal)
--------------------------------------------------------------------------------

Design goals:
  - `llmConfig` remains the single source of truth ([`my-app/config/llmConfig.ts:12`](my-app/config/llmConfig.ts:12)).
  - `forceGpt5NanoOnly === true`  -> ONLY OpenAI with model = `gpt-5-nano` (no Mistral, no GPT‑4).
  - `forceGpt5NanoOnly === false` -> Normal flow: prefer Mistral per config, fallback to OpenAI.
  - Remove direct instantiation of `gpt4_adapter.ts` and replace usages with `getLLMAdapter`.
  - Preserve telemetry keys and fallback traces.

ASCII Diagram: POST‑GPT‑4 Removal
--------------------------------------------------------------------------------
[ llmConfig ] (`my-app/config/llmConfig.ts:12`)
     |
     v
[getLLMAdapter / callPreferredProvider] (`my-app/config/llmAdapters.ts:503`)
  |
  |-- if forceGpt5NanoOnly === true  ----------------------------.
  |                                                               \
  |   -> Use (OpenAIAdapter) with model = "gpt-5-nano"               \
  |   - emit adapter.call_plan { mode: "gpt-only", chosenModel }     \
  |   - NO calls to Mistral or any GPT‑4 adapter                     \
  |   - emit adapter.delegate_attempt / adapter.provider_result     \
  |                                                               v
  |-- else (normal) -----------------------------------------------' 
        |
        |-- if provider === "mistral" -> (MistralAdapter) (same behavior as current)
        |     - on error -> emit adapter.fallback_trace then fallback to OpenAI
        |
        `-- else -> (OpenAIAdapter) (same behavior as current; no GPT‑4 adapter path)

Telemetry & Guarantees after removal:
  - adapter.call_plan still describes the plan (mistral-first or gpt-only).
  - adapter.delegate_attempt / adapter.provider_result record provider-level attempts/results.
  - adapter.fallback_trace records every fallback decision (mistral->openai, model_not_found->fallbackModel).
  - No code path should instantiate `gpt4_adapter.ts` after removal — add runtime checks if desired:
      `console.log("GPT-4 removed; using llmConfig model:", llmConfig.openaiModel, "forceGpt5NanoOnly:", llmConfig.forceGpt5NanoOnly)`

--------------------------------------------------------------------------------
STEP-BY-STEP EXPLANATIONS
--------------------------------------------------------------------------------
1) Central config:
   - `llmConfig` (`my-app/config/llmConfig.ts:12`) is authoritative: provider, model, openaiModel, mistralModel, and forceGpt5NanoOnly.

2) Decision point (getLLMAdapter / callPreferredProvider):
   - Always emit `adapter.call_plan` describing the intended route.
   - If `forceGpt5NanoOnly` is true -> immediately choose OpenAI + `gpt-5-nano` and skip other providers.

3) Mistral path (preferred when configured and force flag is false):
   - Use `createMistralAdapter` POST `/v1/chat/completions` (retry 429 with backoff + jitter).
   - Emit `adapter.mistral_retry` on transient 429s.
   - On repeated failure -> emit `adapter.mistral_error` and `adapter.fallback_trace`, then fall back to OpenAI.

4) OpenAI path:
   - Prefer SDK if available (emit `adapter.sdk_attempt` / `adapter.sdk_response`).
   - Fallback to fetch `/v1/responses` if SDK missing (emit `adapter.fetch_response`).
   - On `model_not_found` -> emit `adapter.fallback_trace` and retry once with a safe `fallbackModel`.
   - Emit `adapter.provider_result` summarizing final outcome.

5) Telemetry:
   - Keep `adapter.fallback_trace`, `adapter.delegate_attempt`, `adapter.delegate_response`, `adapter.call_plan`.
   - Ensure every fallback and provider attempt is logged so traces can be reconstructed.

--------------------------------------------------------------------------------
END OF DIAGRAM
--------------------------------------------------------------------------------