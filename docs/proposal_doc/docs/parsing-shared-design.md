# [`my-app/convex/lib/parsing_shared/index.ts`](my-app/convex/lib/parsing_shared/index.ts:1) — Parsing Shared Library Design and API

Purpose
Consolidate the parsing logic used by the `refine` Convex action and the background worker into a single, resilient library. The library exposes a single, well-typed entrypoint and internal modules for orchestration, LLM provider handling, repair utilities, heuristics, and validation.

Why
- Single source of truth for parsing behavior (avoid divergence).
- Easier testing and iteration (unit + integration tests in one place).
- Consistent telemetry and abort/timeout handling.
- Easier incremental migration: refactor consumers to call the shared API.

Location
- Intended package root: [`my-app/convex/lib/parsing_shared/index.ts`](my-app/convex/lib/parsing_shared/index.ts:1)
- Supporting modules:
  - [`my-app/convex/lib/parsing_shared/api.ts`](my-app/convex/lib/parsing_shared/api.ts:1)
  - [`my-app/convex/lib/parsing_shared/engine.ts`](my-app/convex/lib/parsing_shared/engine.ts:1)
  - [`my-app/convex/lib/parsing_shared/providers.ts`](my-app/convex/lib/parsing_shared/providers.ts:1)
  - [`my-app/convex/lib/parsing_shared/repair.ts`](my-app/convex/lib/parsing_shared/repair.ts:1)
  - [`my-app/convex/lib/parsing_shared/heuristics.ts`](my-app/convex/lib/parsing_shared/heuristics.ts:1)
  - [`my-app/convex/lib/parsing_shared/validation.ts`](my-app/convex/lib/parsing_shared/validation.ts:1)
  - [`my-app/convex/lib/parsing_shared/utils.ts`](my-app/convex/lib/parsing_shared/utils.ts:1)

Public API (concept)
- parseCV(options: ParseOptions): Promise<ParseResult>

Example TypeScript signatures (public)
```typescript
// file: my-app/convex/lib/parsing_shared/api.ts
export interface ParseOptions {
  rawText: string;
  timeoutMs?: number; // overall budget per parse operation
  providerConfig?: {
    forceGpt?: boolean;
    allowFallback?: boolean;
  };
  telemetryContext?: { jobId?: string; source?: 'refine' | 'worker' | 'test' };
}

export interface Section {
  title: string;
  content: string;
  fieldKey: string;
  confidence: number;
}

export interface ParseResult {
  sections: Section[];
  metadata: { name?: string|null; email?: string|null; phone?: string|null; linkedinUrl?: string|null; telemetry?: any };
  method: 'llm' | 'heuristic';
  warnings: string[];
  telemetry?: { providerUsed?: string|null; attempts?: number; fallbackUsed?: boolean; totalDurationMs?: number };
}

export function parseCV(options: ParseOptions): Promise<ParseResult>;
```

High-level component responsibilities
- index.ts
  - Export parseCV and light helpers that consumers use.
- engine.ts
  - Coordinate parse attempts: attemptLLMParse, repair loops, validation, heuristics fallback.
  - Expose deterministic behaviour and telemetry hooks.
- providers.ts
  - Encapsulate provider selection, adapter delegation, timeout/AbortSignal handling, and bounded-await-after-abort.
  - Reuse existing [`my-app/config/llmAdapters.ts`](my-app/config/llmAdapters.ts:1) but wrap it with standardized timeouts and telemetry.
- repair.ts
  - Contain `repairJSON` (current robust implementation) and any additional repair strategies.
- heuristics.ts
  - Contain `parseWithEnhancedHeuristics` and utilities used in fallback mode.
- validation.ts
  - `validateLLMOutput` and helpers to score/accept outputs.
- utils.ts
  - `detectLanguageIsFrench`, `sanitizeProviderResponse`, `extractLanguages`, `extractContactBlock`.

Provider & Timeout patterns (reused best-practices)
- Always call adapters with an AbortSignal.
- Run Promise.race([providerPromise, timeout]) and:
  - On timeout, call controller.abort(); then await providerPromise settling bounded (e.g., Promise.race([providerPromise.catch(()=>{}), delay(2000)])).
- Cap provider call effective timeout at library-level (e.g., 30s).
- Use separate short timeouts for repairJSON (2s default), bounded repair (5s) used inside parse attempts.

Telemetry hooks (integrated)
- Adapter call plan: record requestedModel, forceGpt flag
- adapter.provider_attempt / adapter.provider_latency / adapter.provider_result
- adapter.delegate_attempt / adapter.delegate_response
- adapter.signal_aborted on controller.abort event (already instrumented in adapters)
- repairJSON events: repair_invoked, repair_outcome (success/fail)

Migration roadmap (phased, low-risk)
1) Scaffold library (this repo)
   - Create `my-app/convex/lib/parsing_shared/` with files listed above and README.
   - Implement API types and a minimal index.ts that throws NotImplemented (safe to land).
2) Extract pure utilities
   - Move `repairJSON`, `sanitizeProviderResponse`, and `detectLanguageIsFrench` into shared `repair.ts` and `utils.ts`.
   - Update tests to import from parsing_shared.
   - Leave `hybridParser.ts` importing shared utilities (keep orchestration unchanged yet).
3) Implement providers wrapper
   - Add `callProviderWithTimeout(prompt, options)` that wraps adapters and callLLMWithTimeout semantics.
   - Ensure adapter-signal instrumentation is preserved and telemetry emitted.
4) Implement engine orchestrator
   - Migrate `attemptLLMParse` and outer parse orchestration into `engine.ts`.
   - Add comprehensive unit tests for the engine, particularly repair+retry behavior and timeouts.
5) Swap consumers
   - Refactor `my-app/convex/llm.ts` to call `parsing_shared.parseCV`.
   - Refactor `my-app/worker/llmWorker.ts` similarly.
   - Keep old path as fallback / feature-flag rollback for a short period.
6) End-to-end testing
   - Add integration tests and run staged jobs on staging environment, watch telemetry and adapter.signal_aborted.
7) Cleanup
   - Remove `my-app/convex/lib/parsing/` once both consumers are migrated and tests pass.

Developer notes and examples
- Consumer usage (example)
```ts
import { parseCV } from "../../convex/lib/parsing_shared";

const res = await parseCV({ rawText: someCvText, timeoutMs: 30000, providerConfig: { allowFallback: true } });
```

- Providers implementation note:
  - Reuse [`my-app/config/llmAdapters.ts`](my-app/config/llmAdapters.ts:1) by importing `getLLMAdapter` inside `providers.ts`.
  - Wrap adapter.call with AbortController and bounded await pattern.

Testing approach
- Unit tests for each module (repair, validation, heuristics).
- Engine-level unit tests that mock provider responses (success, human-readable, slow/timeout, malformed).
- Integration tests that run the full parse with real keys in an isolated staging environment.
- Canary rollout: enable parsing_shared for a small subset of refine jobs, monitor metrics and logs.

Rollout considerations
- Keep the `hybridParser.ts` implementation intact during migration and progressively switch consumers.
- Add feature flag (env var) to toggle use of `parsing_shared` to allow quick rollback.
- Use telemetry to compare outputs between old and new implementations during the canary window.

References (files touched during Phase 1)
- `my-app/convex/lib/parsing/hybridParser.ts` (current orchestrator)
- `my-app/config/llmAdapters.ts` (adapters; instrumentation added)
- `docs/proposal_doc/docs/Phase2-Implementation.md` (high-level plan)

Next immediate tasks I can perform
1) Scaffold the directory and add `index.md`/README inside `my-app/convex/lib/parsing_shared/` describing the module surface.
2) Extract and move `repairJSON` + tests into `parsing_shared/repair.ts` and update imports.
3) Implement `providers.ts` wrapper and unit tests for timeout/abort behavior.

Tell me which of these immediate tasks to execute next and I will perform the repository changes.