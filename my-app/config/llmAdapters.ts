import { recordTelemetry } from "./llmTelemetry";
 
export interface ILLMAdapter {
  call(prompt: string, schema?: unknown, opts?: { signal?: AbortSignal }): Promise<string | object>;
}
 
export interface ILLMConfigMinimal {
  provider: string;
  model: string;
  openaiKey?: string | null;
  openaiModel?: string | null;
  mistralKey?: string | null;
  mistralModel?: string | null;
  // Optional flag to force using GPT-5 Nano only (skip Mistral)
  forceGpt5NanoOnly?: boolean;
}

/**
 * Minimal OpenAI Responses adapter (best-effort).
 * - Honors llmConfig.openaiKey or process.env.OPENAI_API_KEY
 * - Honors an effective model selected by DEV_LLM_MODEL -> openaiModel -> model
 * - Returns either raw string (text) or an object (json) which the caller will stringify
 */
function createOpenAIAdapter(config: ILLMConfigMinimal): ILLMAdapter {
  async function call(prompt: string, schema?: unknown, opts?: { signal?: AbortSignal }) {
    const key = (config.openaiKey && config.openaiKey.trim()) ?? (process.env.OPENAI_API_KEY?.trim() ?? null);
    const effectiveModel = process.env.DEV_LLM_MODEL ?? config.openaiModel ?? config.model ?? "gpt-4o-mini";

    // Instrumentation: log when an adapter call starts and attach a one-time abort listener if a signal is present.
    try {
      console.info("[adapter] call start", { provider: "openai", attemptedModel: effectiveModel, hasSignal: !!opts?.signal });
    } catch {}
    if (opts?.signal) {
      try {
        // Use once: true so the listener removes itself after firing; best-effort only.
        opts.signal.addEventListener(
          "abort",
          () => {
            try {
              console.info("[adapter] call aborted", { provider: "openai", attemptedModel: effectiveModel, ts: Date.now() });
            } catch {}
            try {
              recordTelemetry("adapter.signal_aborted", { provider: "openai", attemptedModel: effectiveModel });
            } catch {}
          },
          { once: true }
        );
      } catch {}
    }

    // If no key, return deterministic mock so tests stay stable.
    if (!key) {
      // Telemetry: adapter returned mock due to missing API key
      try { recordTelemetry("adapter.mock", { reason: "no_api_key" }); } catch {}
      if (prompt.includes("METADATA_EXTRACTION_PROMPT") || prompt.includes("Extract the following contact information")) {
        return {
          name: "John Doe",
          email: "john.doe@example.com",
          phone: "+11234567890",
          linkedinUrl: "https://linkedin.com/in/johndoe"
        };
      }
      return {
        sections: [
          {
            title: "Professional Experience",
            content: "Senior Developer at ABC Inc. (2020-2023)...",
            fieldKey: "experience",
            confidence: 0.98
          }
        ]
      };
    }

    // Best-effort: request a JSON-shaped response when schema is provided.
    const promptWithForceJson = schema ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON (no markdown, no surrounding explanation).` : prompt;

    // First attempt: use official OpenAI SDK if available (dynamic import).
    try {
      // Dynamic import so tests/environments without SDK don't crash.
      const openaiModule: any = await import("openai").catch(() => null);
      const OpenAI = openaiModule?.default ?? openaiModule?.OpenAI ?? null;
      if (OpenAI) {
        try {
          // Telemetry: SDK available and will be attempted
          try { recordTelemetry("adapter.sdk_attempt", { model: effectiveModel }); } catch {}
          const client = new OpenAI({ apiKey: key });
          const req: any = {
            model: effectiveModel,
            input: promptWithForceJson
          };
          if (schema) {
            req.text = {
              format: {
                type: "json_schema",
                // Top-level name and schema for strict SDK/Responses compatibility
                name: "response",
                schema: schema,
                json_schema: {
                  name: "response",
                  schema: schema
                }
              }
            };
          }
       
          const resp = await client.responses.create(req);
          const j: any = resp;
 
          // Telemetry: record SDK response summary
          try { recordTelemetry("adapter.sdk_response", { keys: Object.keys(j || {}) }); } catch {}
 
          // Try common shapes (SDK shapes are similar to fetch responses)
          if (Array.isArray(j.choices) && j.choices[0]?.message?.content) return j.choices[0].message.content;
          if (j.full_response && Array.isArray(j.full_response.choices) && j.full_response.choices[0]?.message?.content) return j.full_response.choices[0].message.content;
 
          const outputs = j.output || j.outputs || j.output?.[0]?.content || j.outputs?.[0]?.content;
          if (Array.isArray(outputs)) {
            for (const item of outputs) {
              if (item && typeof item === "object") {
                if (item.json) return item.json;
                if (item.text) return item.text;
                if (typeof item.content === "string") return item.content;
                if (item.type === "output_text" && item.text) return item.text;
              }
            }
          }
 
          if (j?.output?.[0]?.content?.[0]) {
            const c = j.output[0].content[0];
            if (c.json) return c.json;
            if (c.text) return c.text;
            if (c.output_text) return c.output_text;
            if (c.content && typeof c.content === "string") return c.content;
          }
 
          // Try fenced JSON in stringified SDK response
          try {
            const asString = JSON.stringify(j);
            const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(asString);
            if (fence && fence[1]) return fence[1].trim();
          } catch {
            // ignore
          }
 
          // Last resort: return SDK response object
          return j;
        } catch (sdkCallErr: any) {
          // Telemetry: SDK call failed
          try { recordTelemetry("adapter.sdk_error", { message: String(sdkCallErr?.message ?? sdkCallErr) }); } catch {}
          console.warn("[createOpenAIAdapter] SDK call failed, falling back to fetch path:", sdkCallErr?.message ?? String(sdkCallErr));
          // Fall through to fetch-based path below
        }
      }
    } catch (sdkImportErr: any) {
      // Couldn't import SDK; fall back to fetch-based implementation.
      try { recordTelemetry("adapter.sdk_import_failed", { message: String(sdkImportErr?.message ?? sdkImportErr) }); } catch {}
      console.warn("[createOpenAIAdapter] Could not import OpenAI SDK, using fetch fallback:", sdkImportErr?.message ?? String(sdkImportErr));
    }

    // Fallback: use fetch to call the Responses endpoint (keeps prior behavior for environments without SDK)
    const body: any = {
      model: effectiveModel,
      input: promptWithForceJson
    };
    
    if (schema) {
      body.text = {
        format: {
          type: "json_schema",
          // include top-level name & schema for strict validation compatibility
          name: "response",
          schema: schema,
          json_schema: {
            name: "response",
            schema: schema
          }
        }
      };
    }
    
    // Normalize/guard: ensure text.format and nested json_schema contain required fields (covers SDK vs fetch shapes)
    if (body.text?.format?.type === "json_schema") {
      // Ensure the nested json_schema references the provided schema; do not synthesize defaults.
      if (!body.text.format.json_schema) body.text.format.json_schema = { name: body.text.format.name ?? "response", schema: body.text.format.schema };
      if (!body.text.format.json_schema.name) body.text.format.json_schema.name = body.text.format.name ?? "response";
      if (!body.text.format.name) body.text.format.name = body.text.format.json_schema.name ?? "response";
      if (!body.text.format.schema) {
        try { recordTelemetry("adapter.request_shape_invalid", { provider: "openai", reason: "missing_top_level_schema" }); } catch {}
        throw new Error("[createOpenAIAdapter] FATAL: Attempted to send request with text.format but without top-level schema.");
      }
    }

    // Primary request with runtime model-fallback and fallback tracing telemetry.
    const fallbackModel = "gpt-4o-mini";

    // Safety check: Do not send text.format unless a top-level schema is present.
    if (body.text?.format && !body.text.format.schema) {
      try { recordTelemetry("adapter.request_shape_invalid", { provider: "openai", reason: "missing_top_level_schema" }); } catch {}
      throw new Error("[createOpenAIAdapter] FATAL: Attempted to send request with text.format but without top-level schema.");
    }

    let res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(body),
      signal: opts?.signal
    });
    
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      // If provider reports model_not_found, retry once with a known-working fallback model and emit telemetry.
      if (res.status === 400 && /model_not_found/i.test(txt)) {
        try { recordTelemetry("adapter.fallback_trace", { requestedModel: effectiveModel, provider: "openai", attemptIndex: 1, attemptedModel: effectiveModel, outcome: "model_not_found", status: res.status }); } catch {}
        try { console.warn("[createOpenAIAdapter] model not found for", effectiveModel, "- retrying with", fallbackModel); } catch {}
        try {
          body.model = fallbackModel;
          res = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`
            },
            body: JSON.stringify(body),
            signal: opts?.signal
          });
          try { recordTelemetry("adapter.fallback_trace", { requestedModel: effectiveModel, provider: "openai", attemptIndex: 2, attemptedModel: fallbackModel, outcome: res.ok ? "ok" : "error", status: res.status }); } catch {}
        } catch (retryErr: any) {
          try { recordTelemetry("adapter.fallback_trace", { requestedModel: effectiveModel, provider: "openai", attemptIndex: 2, attemptedModel: fallbackModel, outcome: "retry_failed", error: String(retryErr) }); } catch {}
          try { console.warn("[createOpenAIAdapter] retry fetch failed:", String(retryErr)); } catch {}
        }
        if (!res.ok) {
          const text2 = await res.text().catch(() => "");
          throw new Error(`OpenAI adapter error after fallback: ${res.status} ${res.statusText} ${text2}`);
        }
      } else {
        throw new Error(`OpenAI adapter error: ${res.status} ${res.statusText} ${txt}`);
      }
    }

    const j = await res.json();
 
    // Telemetry: record fetch response summary
    try { recordTelemetry("adapter.fetch_response", { keys: Object.keys(j || {}) }); } catch {}
 
    // Try common shapes (chat-like, responses API, fenced json)
    // 1) choices[0].message.content (chat completion style)
    if (Array.isArray(j.choices) && j.choices[0]?.message?.content) {
      return j.choices[0].message.content;
    }

    // 2) full_response.{choices} chat-style (other providers or wrappers)
    if (j.full_response && Array.isArray(j.full_response.choices) && j.full_response.choices[0]?.message?.content) {
      return j.full_response.choices[0].message.content;
    }

    // 3) Responses API 'output' array where each item has 'content' array
    const outputs = j.output || j.outputs || j.output?.[0]?.content || j.outputs?.[0]?.content;
    if (Array.isArray(outputs)) {
      for (const item of outputs) {
        if (item && typeof item === "object") {
          if (item.json) return item.json;
          if (item.text) return item.text;
          if (typeof item.content === "string") return item.content;
          if (item.type === "output_text" && item.text) return item.text;
        }
      }
    }

    // 4) responses typical location j.output[0].content[0]
    if (j?.output?.[0]?.content?.[0]) {
      const c = j.output[0].content[0];
      if (c.json) return c.json;
      if (c.text) return c.text;
      if (c.output_text) return c.output_text;
      if (c.content && typeof c.content === "string") return c.content;
    }

    // 5) If the payload contains a string with fenced JSON, extract it
    try {
      const asString = JSON.stringify(j);
      const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(asString);
      if (fence && fence[1]) return fence[1].trim();
    } catch {
      // ignore
    }

    // 6) Last resort: return the raw response object for callers to handle
    return j;
  }

  return { call };
}

/**
 * Mistral adapter (minimal/stub).
 * - Honors config.mistralKey or process.env.MISTRAL_API_KEY
 * - Returns deterministic mocks when no key is present to keep tests stable.
 * - When a key is present, attempts a best-effort fetch to a generic Mistral-style endpoint.
 *   The implementation intentionally remains lightweight; extend with official SDK if/when available.
 */
function createMistralAdapter(config: ILLMConfigMinimal): ILLMAdapter {
  async function call(prompt: string, schema?: unknown, opts?: { signal?: AbortSignal }) {
    const key = (config.mistralKey && config.mistralKey.trim()) ?? (process.env.MISTRAL_API_KEY?.trim() ?? null);
    const effectiveModel = process.env.DEV_LLM_MODEL ?? config.mistralModel ?? config.model ?? "mistral-small-latest";

    // Instrumentation: log when an adapter call starts and attach a one-time abort listener if a signal is present.
    try {
      console.info("[adapter] call start", { provider: "mistral", attemptedModel: effectiveModel, hasSignal: !!opts?.signal });
    } catch {}
    if (opts?.signal) {
      try {
        opts.signal.addEventListener(
          "abort",
          () => {
            try {
              console.info("[adapter] call aborted", { provider: "mistral", attemptedModel: effectiveModel, ts: Date.now() });
            } catch {}
            try {
              recordTelemetry("adapter.signal_aborted", { provider: "mistral", attemptedModel: effectiveModel });
            } catch {}
          },
          { once: true }
        );
      } catch {}
    }

    if (!key) {
      try { recordTelemetry("adapter.mistral_mock", { reason: "no_api_key" }); } catch {}
      // Deterministic mock for tests
      if (prompt.includes("METADATA_EXTRACTION_PROMPT") || prompt.includes("Extract the following contact information")) {
        return {
          name: "John Doe",
          email: "john.doe@example.com",
          phone: "+11234567890",
          linkedinUrl: "https://linkedin.com/in/johndoe"
        };
      }
      return {
        sections: [
          {
            title: "Professional Experience",
            content: "Senior Developer at ABC Inc. (2020-2023)...",
            fieldKey: "experience",
            confidence: 0.95
          }
        ]
      };
    }

    // First attempt: use Mistral SDK if available (dynamic import)
    try {
      // Use a runtime dynamic import wrapper to avoid build-time resolution by bundlers.
      // Prefer a runtime eval-style dynamic import invocation so TypeScript won't
      // attempt to statically resolve the optional 'mistral' package during tsc.
      let mistralModule: any = null;
      try {
        // new Function avoids TypeScript static analysis while still performing a real dynamic import at runtime.
        mistralModule = await new Function('return import("mistral")')().catch(() => null);
      } catch {
        mistralModule = null;
      }
      // Support several possible exports: default, Mistral, MistralClient
      const Mistral = mistralModule?.default ?? mistralModule?.Mistral ?? mistralModule?.MistralClient ?? null;
      if (Mistral) {
        try {
          try { recordTelemetry("adapter.mistral_sdk_attempt", { model: effectiveModel }); } catch {}
          // Instantiate the SDK client. Some SDKs export a class, others a factory.
          const client = typeof Mistral === "function" ? new Mistral({ apiKey: key }) : Mistral.create ? Mistral.create({ apiKey: key }) : new Mistral({ apiKey: key });
  
          // Prefer the documented "generate" entrypoint for the official Mistral SDK.
          // Fall back to other common entrypoints if present.
          let resp: any = null;
          if (typeof client.generate === "function") {
            resp = await client.generate({ model: effectiveModel, input: prompt, signal: opts?.signal });
          } else if (typeof client.chat === "function") {
            resp = await client.chat({ model: effectiveModel, input: prompt, signal: opts?.signal });
          } else if (typeof client.create === "function") {
            resp = await client.create({ model: effectiveModel, input: prompt, signal: opts?.signal });
          } else if (client.responses && typeof client.responses.create === "function") {
            resp = await client.responses.create({ model: effectiveModel, input: prompt, signal: opts?.signal });
          } else if (typeof client.predict === "function") {
            resp = await client.predict({ model: effectiveModel, input: prompt, signal: opts?.signal });
          } else {
            resp = await Promise.resolve(null);
          }
  
          // Normalize likely shapes from the official SDK:
          // - resp.output (array) with content entries
          // - resp.generations (array) with text fields
          // - resp.data/result wrappers
          const j: any = resp?.data ?? resp?.result ?? resp ?? {};
  
          try { recordTelemetry("adapter.mistral_sdk_response", { keys: Object.keys(j || {}) }); } catch {}
  
          // 1) Responses-style output[].content[] -> content may be array of parts
          if (Array.isArray(j.output)) {
            for (const out of j.output) {
              if (out && Array.isArray(out.content)) {
                for (const c of out.content) {
                  if (c?.json) return c.json;
                  if (c?.text) return c.text;
                  if (typeof c === "string") return c;
                }
              }
              if (out?.text) return out.text;
              if (out?.content && typeof out.content === "string") return out.content;
            }
          }
  
          // 2) generations[] -> text
          if (Array.isArray(j.generations)) {
            for (const g of j.generations) {
              if (g?.text) return g.text;
              if (g?.content && typeof g.content === "string") return g.content;
            }
          }
  
          // 3) top-level text fields
          if (typeof j.output_text === "string") return j.output_text;
          if (typeof j.text === "string") return j.text;
  
          // 4) If the SDK returned a simple string, return it
          if (typeof j === "string") return j;
  
          // 5) If it's an object, return it for callers to handle (repairJSON can run later)
          if (j && typeof j === "object") return j;
  
          // otherwise fallthrough to fetch fallback below
        } catch (sdkErr: any) {
          try { recordTelemetry("adapter.mistral_sdk_error", { message: String(sdkErr?.message ?? sdkErr) }); } catch {}
          console.warn("[createMistralAdapter] SDK call failed, falling back to fetch:", sdkErr?.message ?? String(sdkErr));
          // fallthrough to fetch
        }
      }
    } catch (sdkImportErr: any) {
      try { recordTelemetry("adapter.mistral_sdk_import_failed", { message: String(sdkImportErr?.message ?? sdkImportErr) }); } catch {}
      console.warn("[createMistralAdapter] Could not import Mistral SDK, using fetch fallback:", sdkImportErr?.message ?? String(sdkImportErr));
    }

    // Telemetry: attempt mistral fetch call (also emit a lightweight fallback trace)
    try { recordTelemetry("adapter.mistral_attempt", { model: effectiveModel }); } catch {}
    try { recordTelemetry("adapter.fallback_trace", { requestedModel: effectiveModel, provider: "mistral", attemptIndex: 1, attemptedModel: effectiveModel, outcome: "attempt_start" }); } catch {}
    
    // Best-effort fetch shape for Mistral-style API (this is intentionally generic).
    // Implement retries for 429 (service tier capacity) with exponential backoff + jitter.
    try {
      const body: any = {
        model: effectiveModel,
        messages: [{ role: "user", content: prompt }]
      };

      const maxRetries = 3;
      let attempt = 0;

      while (true) {
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`
          },
          body: JSON.stringify(body),
          signal: opts?.signal
        });

        // If successful, parse and return
        if (res.ok) {
          const j = await res.json();
          try { recordTelemetry("adapter.mistral_response", { keys: Object.keys(j || {}) }); } catch {}
          // Try common shapes: responses in output[].content[] or a top-level text
          const outputs = j.output || j.outputs || j.choices || null;
          if (Array.isArray(outputs)) {
            for (const item of outputs) {
              // item may be { content: [ { json: ... } ] } or { text } or simple string
              if (item && typeof item === "object") {
                // content array (common SDK shape)
                if (Array.isArray(item.content)) {
                  for (const c of item.content) {
                    if (c && typeof c === "object") {
                      if (c.json) return c.json;
                      if (c.text) return c.text;
                      if (typeof c === "string") return c;
                    } else if (typeof c === "string") {
                      return c;
                    }
                  }
                }
                if (item.json) return item.json;
                if (item.text) return item.text;
                if (typeof item.content === "string") return item.content;
              } else if (typeof item === "string") {
                return item;
              }
            }
          }
          // generations[] shape
          if (Array.isArray(j.generations)) {
            for (const g of j.generations) {
              if (g?.text) return g.text;
              if (g?.content && typeof g.content === "string") return g.content;
            }
          }
          // top-level text fields
          if (typeof j.output_text === "string") return j.output_text;
          if (typeof j.text === "string") return j.text;
          if (typeof j === "string") return j;
          // fallback: return the raw response object
          return j;
        }

        // Not ok: read body for telemetry and decision making
        const txt = await res.text().catch(() => "");
        // If 429 and we have retries remaining, wait and retry with exponential backoff + jitter
        if (res.status === 429 && attempt < maxRetries) {
          const baseDelayMs = 500; // base delay
          const delayMs = Math.round(baseDelayMs * Math.pow(2, attempt) + Math.random() * baseDelayMs);
          try { recordTelemetry("adapter.mistral_retry", { attempt, status: res.status, body: txt }); } catch {}
          try { recordTelemetry("adapter.fallback_trace", { requestedModel: effectiveModel, provider: "mistral", attemptIndex: attempt + 1, attemptedModel: effectiveModel, outcome: "retry_429", status: res.status }); } catch {}
          await new Promise((r) => setTimeout(r, delayMs));
          attempt++;
          continue;
        }

        // Otherwise record full response body for telemetry and throw
        const errMsg = `Mistral adapter error: ${res.status} ${res.statusText} ${txt}`;
        try { recordTelemetry("adapter.mistral_error", { message: errMsg, status: res.status, body: txt }); } catch {}
        throw new Error(errMsg);
      }
    } catch (err: any) {
      try { recordTelemetry("adapter.mistral_error", { message: String(err?.message ?? err) }); } catch {}
      // On error, surface the error up so caller can attempt repair/fallback.
      throw err;
    }
  }

  return { call };
}

/**
 * Generic fallback adapter for providers we don't have SDKs for.
 * It will attempt to use the provider key if present (not implemented), otherwise return deterministic mocks.
 */
function createGenericAdapter(config: ILLMConfigMinimal): ILLMAdapter {
  async function call(prompt: string, schema?: unknown, opts?: { signal?: AbortSignal }) {
    // Prefer openaiKey if present (generic layer delegates to OpenAI adapter for now)
    if (config.openaiKey || process.env.OPENAI_API_KEY) {
      // Delegate to OpenAI adapter for a generic provider config to keep behavior consistent.
      const openaiAdapter = createOpenAIAdapter(config);
      return openaiAdapter.call(prompt, schema, opts);
    }

    // No key: deterministic mock for tests
    if (prompt.includes("METADATA_EXTRACTION_PROMPT") || prompt.includes("Extract the following contact information")) {
      return {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+11234567890",
        linkedinUrl: "https://linkedin.com/in/johndoe"
      };
    }
    return {
      sections: [
        {
          title: "Professional Experience",
          content: "Senior Developer at ABC Inc. (2020-2023)...",
          fieldKey: "experience",
          confidence: 0.98
        }
      ]
    };
  }

  return { call };
}

/**
 * Factory to return the correct adapter for the configured provider.
 * Add new provider-specific adapters here (mistral, cohere, etc.)
 */
export function getLLMAdapter(config: ILLMConfigMinimal): ILLMAdapter {
  const provider = (config.provider ?? "openai").toLowerCase();

  // Honor an explicit flag to force GPT-5 Nano only: skip Mistral entirely and use OpenAI adapter.
  if (config.forceGpt5NanoOnly) {
    try { recordTelemetry("adapter.fallback_trace", { forceGpt5NanoOnly: true, chosenProvider: "openai", chosenModel: config.openaiModel ?? config.model }); } catch {}
    return createOpenAIAdapter(config);
  }

  if (provider === "openai") return createOpenAIAdapter(config);
  if (provider === "mistral") return createMistralAdapter(config);

  // Default: generic adapter (delegates to openai if key present)
  return createGenericAdapter(config);
}