/**
 * parsing_shared/providers.ts
 *
 * Provider orchestration: wrap configured adapters with consistent timeout,
 * AbortSignal forwarding, bounded-await semantics and telemetry.
 *
 * Responsibilities:
 * - Create a canonical LLM caller (createLLMCaller) used by parsing engine.
 * - Attempt configured provider adapter first (unless forced to OpenAI),
 *   and fall back to OpenAI adapter once per invocation if adapter path fails.
 * - Race adapter calls vs an effective timeout. On timeout, abort underlying
 *   request (if supported) and still await its settlement for a bounded period
 *   to avoid leaving dangling fetches.
 *
 * Notes:
 * - Uses the existing adapter factory in my-app/config/llmAdapters.ts so provider
 *   SDK/fetch shape handling remains centralized in adapters.
 * - Emits telemetry via recordTelemetry to help triage provider call outcomes.
 */
 
import { getLLMAdapter, ILLMAdapter, ILLMConfigMinimal } from "../../../config/llmAdapters";
import { llmConfig as globalLLMConfig } from "../../../config/llmConfig";
import { recordTelemetry } from "../../../config/llmTelemetry";
 
/* Public types */
 
export interface LLMCallOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  allowProviderFallback?: boolean; // override to disable fallback to OpenAI
  // future: provider hints (model, forceGpt), telemetry context, etc.
  [key: string]: unknown;
}
 
export interface LLMResult {
  text: string;
  fallbackUsed?: boolean;
}
 
export interface LLMCaller {
  (prompt: string, schema?: unknown, opts?: LLMCallOptions): Promise<LLMResult>;
}
 
/* Internal helpers */
 
function nowMs(): number {
  return Date.now();
}
 
/**
 * safeRecordTelemetry - swallow errors from telemetry sinks to keep parsing robust
 */
function safeRecordTelemetry(event: string, payload?: Record<string, unknown>) {
  try { recordTelemetry(event, payload); } catch {}
}
 
/**
 * callAdapterWithTimeout
 *
 * Calls an adapter.call(...) and races it against a timeout. On timeout or error,
 * attempts to abort the adapter via AbortController where possible and awaits the
 * adapter promise for a short bounded period before returning/throwing.
 *
 * Returns: { result?: string|object, durationMs: number, success: boolean }
 */
async function callAdapterWithTimeout(adapter: ILLMAdapter, prompt: string, schema: unknown, timeoutMs: number, opts?: LLMCallOptions) {
  const start = nowMs();
  const effectiveTimeout = Math.min(timeoutMs || 30000, 30000);
  const controller = new AbortController();
  // If caller provided a signal, forward aborts
  if (opts?.signal) {
    try {
      // When external signal aborts, also abort our internal controller
      opts.signal.addEventListener("abort", () => {
        try { controller.abort(); } catch {}
        safeRecordTelemetry("adapter.signal_aborted", { forwarded: true });
      }, { once: true });
    } catch {}
  }
 
  // Start adapter call (adapters accept opts.signal)
  const adapterPromise = adapter.call(prompt, schema, { signal: controller.signal });
 
  try {
    const res = await Promise.race([
      adapterPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("adapter timeout")), effectiveTimeout))
    ]);
    const duration = nowMs() - start;
    return { result: res, durationMs: duration, success: true };
  } catch (err: any) {
    // On timeout or adapter error: try to abort underlying request and await bounded settlement
    try { controller.abort(); } catch {}
    // Bound waits for settlement to avoid dangling fetches (2s)
    try { await Promise.race([adapterPromise.catch(() => {}), new Promise((r) => setTimeout(r, 2000))]); } catch {}
    const duration = nowMs() - start;
    return { result: err, durationMs: duration, success: false };
  }
}
 
/**
 * normalizeResultToString
 *
 * Adapters may return string or object. Convert to string for callers (repair/parse)
 */
function normalizeResultToString(res: unknown): string {
  if (typeof res === "string") return res;
  try { return JSON.stringify(res); } catch { return String(res); }
}
 
/* Public factory */
 
/**
 * createLLMCaller
 *
 * Returns a function usable by parsing engine to call the LLM with stable semantics.
 *
 * Behavior:
 * - Uses process/global llmConfig by default (imported as globalLLMConfig).
 * - Honors an option `allowProviderFallback` (default true) to allow switching to OpenAI when adapter fails.
 * - On provider attempt emits telemetry: adapter.call_plan, adapter.provider_attempt, adapter.provider_latency, adapter.provider_result.
 */
export function createLLMCaller(config?: ILLMConfigMinimal): LLMCaller {
  const effectiveConfig = (config as ILLMConfigMinimal) ?? (globalLLMConfig as unknown as ILLMConfigMinimal);
 
  // Prepare an OpenAI-config override used for fallback calls when adapter fails
  const openaiFallbackConfig: ILLMConfigMinimal = {
    ...effectiveConfig,
    provider: "openai"
  };
 
  return async function call(prompt: string, schema?: unknown, opts?: LLMCallOptions): Promise<LLMResult> {
    const timeoutMs = opts?.timeoutMs ?? 15000;
    const allowProviderFallback = opts?.allowProviderFallback ?? true;
 
    // Emit high level call plan
    safeRecordTelemetry("adapter.call_plan", {
      requestedModel: effectiveConfig.model,
      configuredProvider: effectiveConfig.provider,
      allowProviderFallback
    });
 
    const forceGpt = !!(effectiveConfig.forceGpt5NanoOnly);
    // If forced GPT-only, call OpenAI adapter directly and skip configured provider
    if (forceGpt) {
      safeRecordTelemetry("adapter.provider_attempt", { provider: "openai", attemptedModel: effectiveConfig.openaiModel ?? effectiveConfig.model });
      const openaiAdapter = getLLMAdapter(openaiFallbackConfig);
      const { result, durationMs, success } = await callAdapterWithTimeout(openaiAdapter, prompt, schema, timeoutMs, opts);
      safeRecordTelemetry("adapter.provider_latency", { provider: "openai", attemptedModel: effectiveConfig.openaiModel ?? effectiveConfig.model, durationMs });
      safeRecordTelemetry("adapter.provider_result", { provider: "openai", attemptedModel: effectiveConfig.openaiModel ?? effectiveConfig.model, outcome: success ? "ok" : "error" });
      if (success) return { text: normalizeResultToString(result), fallbackUsed: false };
      throw new Error(String(result ?? "openai adapter failed"));
    }
 
    // Try configured adapter first (if not openai or even if openai it's fine)
    const requestedModel = effectiveConfig.model;
    const providerName = String(effectiveConfig.provider ?? "openai");
 
    safeRecordTelemetry("adapter.provider_attempt", { provider: providerName, attemptedModel: requestedModel });
 
    try {
      const adapter = getLLMAdapter(effectiveConfig);
      const maybe = await callAdapterWithTimeout(adapter, prompt, schema, timeoutMs, opts);
      safeRecordTelemetry("adapter.provider_latency", { provider: providerName, attemptedModel: requestedModel, durationMs: maybe.durationMs });
      if (maybe.success) {
        safeRecordTelemetry("adapter.provider_result", { provider: providerName, attemptedModel: requestedModel, outcome: "ok" });
        return { text: normalizeResultToString(maybe.result), fallbackUsed: false };
      } else {
        safeRecordTelemetry("adapter.provider_result", { provider: providerName, attemptedModel: requestedModel, outcome: "error", error: String(maybe.result) });
        // fallthrough to fallback
      }
    } catch (err: any) {
      safeRecordTelemetry("adapter.provider_result", { provider: providerName, attemptedModel: requestedModel, outcome: "error", error: String(err?.message ?? err) });
      // continue to fallback
    }
 
    // If provider fallback disabled, throw the last error
    if (!allowProviderFallback) {
      throw new Error("Provider adapter failed and fallback disabled");
    }
 
    // Fallback to OpenAI adapter (single fallback attempt)
    safeRecordTelemetry("adapter.fallback_trace", { requestedModel, provider: providerName, fallbackTo: "openai", attemptIndex: 2, outcome: "attempt_fallback" });
    safeRecordTelemetry("adapter.provider_attempt", { provider: "openai", attemptedModel: effectiveConfig.openaiModel ?? effectiveConfig.model });
    try {
      const openaiAdapter = getLLMAdapter(openaiFallbackConfig);
      const fallback = await callAdapterWithTimeout(openaiAdapter, prompt, schema, timeoutMs, opts);
      safeRecordTelemetry("adapter.provider_latency", { provider: "openai", attemptedModel: effectiveConfig.openaiModel ?? effectiveConfig.model, durationMs: fallback.durationMs });
      if (fallback.success) {
        safeRecordTelemetry("adapter.provider_result", { provider: "openai", attemptedModel: effectiveConfig.openaiModel ?? effectiveConfig.model, outcome: "ok", fallbackFrom: providerName });
        return { text: normalizeResultToString(fallback.result), fallbackUsed: true };
      } else {
        safeRecordTelemetry("adapter.provider_result", { provider: "openai", attemptedModel: effectiveConfig.openaiModel ?? effectiveConfig.model, outcome: "error", error: String(fallback.result), fallbackFrom: providerName });
        throw new Error(String(fallback.result ?? "openai fallback failed"));
      }
    } catch (err: any) {
      safeRecordTelemetry("adapter.provider_result", { provider: "openai", attemptedModel: effectiveConfig.openaiModel ?? effectiveConfig.model, outcome: "error", error: String(err?.message ?? err) });
      throw err;
    }
  };
}