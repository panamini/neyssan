// hybridParser.ts - Final implementation with all enhancements
import { isPotentialHeader } from "./enhancedParser";
import { extractMetadataHeuristically } from "./metadataExtractor";
import { validateLLMOutput } from "./llmValidator";
import { SECTION_EXTRACTION_PROMPT, METADATA_EXTRACTION_PROMPT } from "./llmPrompts";
import { llmConfig } from "../../../config/llmConfig";
import { recordTelemetry } from "../../../config/llmTelemetry";
import { extractLanguages, extractContactBlock } from "../../utils/parseHelpers";
/* Dynamic adapter import (resolved at runtime) to avoid static type/bundler resolution */
import { repairJSON } from "../parsing_shared/repair";
import { detectLanguageIsFrench, sanitizeProviderResponse } from "../parsing_shared/utils";
import { createLLMCaller } from "../parsing_shared/providers";
import { mapSectionsToCV, buildSectionsFromLayout } from "./cvMapper";
import type { ICVObject } from "./cvMapper";
import { requestNER, isNEREnabled } from "../parsing_shared/nerClient";
import type { NEREntity } from "../parsing_shared/nerClient";
import { injectSkillEntities } from "./skillUtils";
import {
  mapCanonicalFamilyToParserFieldKey,
  resolveCanonicalHeadingFamily,
} from "./headingResolver";

// pipeline-note: orchestrates LLM + heuristic parsing before canonicalize.ts.
// Section splitting or metadata fusion tweaks belong here (with helpers) so the
// downstream canonicalizer stays declarative.

// JSON-native LLM caller with optional schema support.
// Tries to use the OpenAI Responses API (if OPENAI_API_KEY is present), requesting a JSON response.
// Falls back to a safe mock when running in environments without an API key (e.g., unit tests).
async function callLLM(prompt: string, schema?: unknown, skipAdapters?: boolean, opts?: { signal?: AbortSignal }): Promise<string> {
  // Short, consistent preview so logs are readable
  const preview = (typeof prompt === "string" && prompt.length > 100) ? prompt.substring(0, 100) + "..." : prompt;
  console.log("[callLLM] prompt preview:", preview, " schemaPresent:", !!schema, " skipAdapters:", !!skipAdapters, " hasSignal:", !!opts?.signal);

  // If an adapter factory is available, prefer delegating to it (this allows tests to mock adapters).
  // When skipAdapters is true we bypass adapter delegation and call the internal OpenAI/fetch path directly.
  if (!skipAdapters) {
    try {
      // Dynamically import the adapters module at runtime so TypeScript/build doesn't require its types
      // to be present during static analysis. When running in tests or environments without adapters,
      // this will gracefully fall back to the internal caller.
      const adaptersPath = "../../../config/" + "llmAdapters";
      const adaptersMod = await import(adaptersPath).catch(() => null);
      const getLLMAdapterFn = adaptersMod?.getLLMAdapter;
      if (typeof getLLMAdapterFn === "function") {
        // Telemetry: record that we attempted to delegate to an adapter
        try {
          const requestedModel = (llmConfig as any)?.model ?? (llmConfig as any)?.openaiModel ?? null;
          try { recordTelemetry("adapter.delegate_attempt", { provider: llmConfig.provider ?? "unknown", requestedModel }); } catch {}
        } catch {}
        const adapter = getLLMAdapterFn(llmConfig as any);
        if (adapter && typeof adapter.call === "function") {
          try {
            const adapterResult = await adapter.call(prompt, schema, opts);
            try { recordTelemetry("adapter.delegate_response", { provider: llmConfig.provider ?? "unknown", requestedModel: (llmConfig as any)?.model ?? null, success: true }); } catch {}
            return typeof adapterResult === "string" ? adapterResult : JSON.stringify(adapterResult);
          } catch (adapterCallErr: any) {
            try { recordTelemetry("adapter.delegate_response", { provider: llmConfig.provider ?? "unknown", requestedModel: (llmConfig as any)?.model ?? null, success: false, error: String(adapterCallErr) }); } catch {}
            // fall through to internal caller
          }
        }
      }
    } catch (adapterErr: any) {
      try { recordTelemetry("adapter.delegate_response", { provider: (llmConfig as any)?.provider ?? "unknown", requestedModel: (llmConfig as any)?.model ?? null, success: false, error: String(adapterErr) }); } catch {}
      console.warn("[callLLM] adapter delegation failed, falling back to internal caller:", adapterErr?.message ?? String(adapterErr));
    }
  }

  // TEST hook: allow tests to force a malformed/human-readable LLM response
  if (process.env.TEST_MALFORMED === "1") {
    console.log("[callLLM] TEST_MALFORMED active - returning human-readable stub");
    return "## Profile\nJohn Doe\n- Senior developer\n\n(This is intentionally human-readable and not JSON for tests)";
  }

  // Prefer trimmed API key; handle empty/whitespace values robustly
  const rawKey = process.env.OPENAI_API_KEY ?? llmConfig.openaiKey;
  const apiKey = rawKey?.trim();
  console.log("[callLLM] OPENAI_API_KEY present:", !!apiKey);

  // If we don't have an API key, return a deterministic mock (keeps unit tests stable).
  if (!apiKey) {
    console.log("[callLLM] No API key - returning deterministic mock response");
    if (prompt.includes("METADATA_EXTRACTION_PROMPT") || prompt.includes("Extract the following contact information")) {
      return JSON.stringify({
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+11234567890",
        linkedinUrl: "https://linkedin.com/in/johndoe"
      });
    }
    return JSON.stringify({
      sections: [
        {
          title: "Professional Experience",
          content: "Senior Developer at ABC Inc. (2020-2023)...",
          fieldKey: "experience",
          confidence: 0.98
        }
      ]
    });
  }

  // When an API key is available, call the Responses/chat endpoint and adapt to common provider shapes.
  try {
    // Best-effort: attach a strict instruction when we want JSON back
    const promptWithForceJson = schema ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON (no markdown, no surrounding explanation).` : prompt;

    // Build a generic request body for the OpenAI Responses endpoint.
    const body: any = {
      model: llmConfig.openaiModel ?? process.env.LLM_MODEL ?? "gpt-5o-mini",
      input: promptWithForceJson
    };

    // Heuristic: treat parsing prompts as "wanting JSON" so primary parse attempts request structured JSON.
    // This reduces reliance on a separate repair step and improves first-pass success rate.
    const parsingMarkers = [
      "You are an expert CV parsing engine",
      "METADATA_EXTRACTION_PROMPT",
      "SECTION_EXTRACTION_PROMPT",
      "Extract the following contact information",
      "INSTRUCTIONS (FR)"
    ];
    const wantsJson = Boolean(schema) || parsingMarkers.some((m) => typeof m === "string" && prompt.includes(m));

    // Only attach a text.format when the caller provided an explicit schema.
    // Heuristic "wantsJson" alone should not cause us to send an empty generic schema
    // because OpenAI Responses rejects unnamed/empty object schemas. If the caller did
    // provide a schema, send a strict json_schema shape compatible with SDK & fetch.
    if (wantsJson && schema) {
      body.text = {
        format: {
          type: "json_schema",
          name: "response",
          schema: schema,
          json_schema: {
            name: "response",
            schema: schema
          }
        }
      };
    }

    // Normalize/guard: ensure text.format and nested json_schema contain required fields.
    if (body.text?.format?.type === "json_schema") {
      body.text.format.json_schema = body.text.format.json_schema ?? { name: "response", schema: { type: "object", additionalProperties: false } };
      if (!body.text.format.json_schema.name) body.text.format.json_schema.name = "response";
      if (!body.text.format.name) body.text.format.name = body.text.format.json_schema.name ?? "response";
      if (!body.text.format.schema) body.text.format.schema = body.text.format.json_schema.schema ?? { type: "object", additionalProperties: false };
    }

    // One-off debug: log a redacted view of outgoing text.format and emit lightweight telemetry.
    try {
      if (body.text?.format) {
        const safeFormat: any = { ...(body.text.format ?? {}) };
        if (safeFormat.schema && typeof safeFormat.schema === "object") safeFormat.schema = "[REDACTED_SCHEMA]";
        if (safeFormat.json_schema && safeFormat.json_schema.schema && typeof safeFormat.json_schema.schema === "object")
          safeFormat.json_schema = { ...safeFormat.json_schema, schema: "[REDACTED_SCHEMA]" };
        console.log("[callLLM][DEBUG] outgoing text.format:", JSON.stringify(safeFormat));
      } else {
        // Avoid printing an empty object when no format was attached — makes logs clearer.
        console.log("[callLLM][DEBUG] outgoing text.format: <none attached>");
      }
    } catch (e: any) {
      console.warn("[callLLM][DEBUG] unable to stringify outgoing format:", String(e));
    }
    try { recordTelemetry("adapter.request_shape", { provider: "openai", model: body.model, hasTopLevelSchema: !!body.text?.format?.schema, hasNestedSchema: !!body.text?.format?.json_schema?.schema }); } catch {}

    console.log("[callLLM] Sending request to provider with model:", body.model, "response_format:", !!body.response_format);

    // Safety check: Do not send text.format unless a top-level schema is present.
    // This prevents predictable API 400s and lets us catch malformed shapes before sending.
    if (body.text?.format && !body.text.format.schema) {
      const errorMsg = "[callLLM] FATAL: Attempted to send request with text.format but without top-level schema.";
      console.error(errorMsg);
      try { recordTelemetry("adapter.request_shape_invalid", { reason: "missing_top_level_schema" }); } catch {}
      throw new Error(errorMsg);
    }

    // Primary request with a runtime model-fallback for unknown models.
    const fallbackModel = "gpt-4o-mini";
    let res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: opts?.signal
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      // If provider reports model not found, retry once with a known-working fallback model.
      if (res.status === 400 && /model_not_found/i.test(txt)) {
        try {
          console.warn("[callLLM] model not found for", body.model, "- retrying with", fallbackModel);
        } catch {}
        try {
          body.model = fallbackModel;
          res = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify(body),
            signal: opts?.signal
          });
        } catch (retryErr: any) {
          // preserve original error handling below
          try { console.warn("[callLLM] retry fetch failed:", String(retryErr)); } catch {}
        }
      } else {
        // not a model error: restore body and let the error handling below take place
        const errMsg = `LLM API error: ${res.status} ${res.statusText} ${txt}`;
        console.warn("[callLLM]", errMsg);
        throw new Error(errMsg);
      }
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const errMsg = `LLM API error: ${res.status} ${res.statusText} ${txt}`;
      console.warn("[callLLM]", errMsg);
      throw new Error(errMsg);
    }

    const j = await res.json();
    // Debug: log a small snapshot of response shape for diagnosis
    try {
      console.log("[callLLM] provider response keys:", Object.keys(j));
    } catch (e) {
      /* ignore */
    }

    // Handle common shapes in order of likelihood.

    // 1) Chat/Completion style: choices[0].message.content
    if (Array.isArray(j.choices) && j.choices[0]?.message?.content) {
      const content = j.choices[0].message.content;
      console.log("[callLLM] detected choices[0].message.content (chat style)");
      return String(content);
    }

    // 2) Convex / Mistral-like full_response shape under 'full_response' or 'full_response.choices'
    if (j.full_response && Array.isArray(j.full_response.choices) && j.full_response.choices[0]?.message?.content) {
      console.log("[callLLM] detected full_response.choices chat-style");
      return String(j.full_response.choices[0].message.content);
    }

    // 3) Responses API 'output' array where each item has 'content' array
    const outputs = j.output || j.outputs || j.output?.[0]?.content || j.outputs?.[0]?.content;
    if (Array.isArray(outputs)) {
      for (const item of outputs) {
        // item may be { type: 'output_text', text: '...' } or { json: {...} }
        if (item && typeof item === "object") {
          if (item.json) {
            console.log("[callLLM] found json in output item");
            return JSON.stringify(item.json);
          }
          if (item.text) {
            console.log("[callLLM] found text in output item");
            return String(item.text);
          }
          // Some providers put the text in 'content' or 'output_text'
          if (item.content && typeof item.content === "string") {
            return String(item.content);
          }
          if (item.type === "output_text" && item.text) {
            return String(item.text);
          }
        }
      }
    }

    // 4) Try Responses API conventional location j.output[0].content[0]
    if (j?.output?.[0]?.content?.[0]) {
      const c = j.output[0].content[0];
      if (c.json) {
        console.log("[callLLM] found j.output[0].content[0].json");
        return JSON.stringify(c.json);
      }
      if (c.text) {
        console.log("[callLLM] found j.output[0].content[0].text");
        return String(c.text);
      }
    }

    // 5) As a helpful fallback: if the provider returned a string anywhere, try to find fenced JSON inside it.
    const asString = JSON.stringify(j);
    const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(asString);
    if (fenceMatch && fenceMatch[1]) {
      console.log("[callLLM] extracted fenced JSON from provider response");
      return fenceMatch[1].trim();
    }

    // 6) Last resort: return the full response stringified so caller can attempt repair
    console.warn("[callLLM] could not extract a clear JSON/text payload - returning full response string for repair");
    return JSON.stringify(j);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[callLLM] failed:", msg);
    throw new Error(`callLLM failed: ${msg}`);
  }
}

interface ExtractedMetadata {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

interface ParseResult {
  sections: Array<{
    title: string;
    content: string;
    fieldKey: string;
    confidence: number;
  }>;
  metadata: ExtractedMetadata;
  method: 'llm' | 'heuristic';
  warnings: string[];
  // Optional telemetry produced during LLM parsing/repair that helps triage failures.
  telemetry?: {
    providerUsed?: string | null;
    sanitizedForRepair?: boolean;
    repairReturnedProviderShape?: boolean;
  };
  // Optional mapped canonical CV object (present when caller requests mapping)
  cv?: ICVObject | null;
}

export async function parseCV(rawText: string, options?: { returnMappedCV?: boolean; mapperStrip?: boolean }): Promise<ParseResult> {
  const warnings: string[] = [];
  let fallbackReason = '';

  // --- Helper: NER enrichment (layout + entities fuse) ---
  async function enrichWithNER(
    base: { sections: Array<{ title: string; content: string; fieldKey: string; confidence: number }>; metadata: ExtractedMetadata }
  ): Promise<{
    sections: Array<{ title: string; content: string; fieldKey: string; confidence: number }>;
    metadata: ExtractedMetadata;
    nerPayload: { entities: NEREntity[]; layout?: { blocks: any[] } } | null;
  }> {
    let sections = base.sections;
    let metadata = base.metadata;
    let nerPayload: { entities: NEREntity[]; layout?: { blocks: any[] } } | null = null;

    try {
      if (isNEREnabled()) {
        const ner = await requestNER(rawText, { layout: true, timeoutMs: 2500, retry: 1 });
        if (ner) {
          const filtered = filterNEREntities(ner.entities || []);
          nerPayload = { entities: filtered, ...(ner.layout ? { layout: ner.layout } : {}) } as any;

          // Rebuild sections from layout blocks when present for deterministic Summary/Experience/Education
          const blocks = ner.layout?.blocks ?? [];
          if (Array.isArray(blocks) && blocks.length > 0) {
            try {
              const rebuilt = buildSectionsFromLayout(rawText, blocks).map((s) => ({
                title: s.title,
                content: s.content,
                fieldKey: s.fieldKey,
                confidence: typeof (s as any).confidence === "number" ? (s as any).confidence : 0.85,
              }));
              if (rebuilt.length > 0) sections = rebuilt;
            } catch {
              // ignore layout rebuild failure
            }
          }

          // Inject skills (HARD_SKILL/SOFT_SKILL) into a Skills section
          sections = await injectSkillEntities(sections, filtered);

          // Fill missing metadata from NER when available
          const nerMeta = pickNERMetadata(filtered);
          metadata = {
            name: metadata.name ?? nerMeta.name ?? null,
            email: metadata.email ?? nerMeta.email ?? null,
            phone: metadata.phone ?? nerMeta.phone ?? null,
            linkedinUrl: metadata.linkedinUrl ?? null,
          };
        }
      }
    } catch {
      // best-effort; keep optional
    }

    return { sections, metadata, nerPayload };
  }

  // --- Helper: prune noisy HARD_SKILL tokens and normalize labels ---
  function filterNEREntities(entities: NEREntity[]): NEREntity[] {
    const STOP = new Set(
      [
        "email","phone","mobile","biodata","curriculum","vitae","work","board","code","country","state","city","ltd","usa","uk","india","manager","duration","company","role","reports","policy","system","team","sales","data","issues","skills","academic","research"
      ].map((s) => s.toLowerCase())
    );
    const seen = new Set<string>();
    const out: NEREntity[] = [];
    for (const e of entities) {
      if (!e || typeof e.text !== "string" || typeof e.label !== "string") continue;
      const label = String(e.label).toUpperCase();
      const text = e.text.trim();
      if (!text) continue;
      if (label === "HARD_SKILL" || label === "HARD_SKILLS" || label === "SKILL" || label === "SKILL_HARD") {
        const low = text.toLowerCase();
        if (text.length < 2 || text.length > 64) continue;
        if (!/[A-Za-z0-9]/.test(text)) continue;
        if (STOP.has(low)) continue;
        // Drop obvious section/header words
        if (/^(curriculum|biodata|profile|summary|work|experience|education|phone|email|mobile)$/i.test(text)) continue;
      }
      // Deduplicate by label+text span key (case-insensitive text)
      const key = `${label}::${text.toLowerCase()}::${e.start}|${e.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...e, label });
    }
    return out;
  }

  function pickNERMetadata(entities: NEREntity[]): { name?: string; email?: string; phone?: string; desiredPosition?: string; location?: string } {
    const meta: { name?: string; email?: string; phone?: string; desiredPosition?: string; location?: string } = {};
    const by = (lab: string) => entities.filter((e) => String(e.label).toUpperCase() === lab).sort((a,b)=>a.start-b.start);
    const firstText = (lab: string) => {
      const arr = by(lab);
      return arr.length ? arr[0].text.trim() : undefined;
    };
    meta.name = firstText("NAME") || firstText("PER");
    meta.email = firstText("EMAIL");
    meta.phone = firstText("PHONE");
    meta.desiredPosition = firstText("ROLE");
    const loc = firstText("GPE") || firstText("LOC") || firstText("ADDRESS");
    if (loc) meta.location = loc;
    return meta;
  }

  try {
    // dynamic import of post-processor helpers
    const { parseLLMSections, parseLLMMetadata } = await import("./llmPostProcessor");

/**
 * Choose and call the preferred provider for parsing:
 * - If llmConfig.forceGpt5NanoOnly is true -> call OpenAI only (gpt-5-nano expected)
 * - Otherwise attempt provider adapter (usually Mistral when configured); on adapter failure
 *   fall back to OpenAI (gpt-5-nano).
 *
 * Emits lightweight telemetry traces so we can observe requestedModel -> attemptedModel -> outcome.
 */
const defaultLLMCaller = createLLMCaller();
const openaiOnlyLLMCaller = createLLMCaller({ ...(llmConfig as any), provider: "openai" });

/**
 * callPreferredProvider (delegates to parsing_shared createLLMCaller)
 *
 * This wrapper centralizes the previous provider orchestration by using the
 * shared LLM caller factory. It preserves the previous semantic of returning
 * { text, fallbackUsed } so callers (attemptLLMParse) keep the same behavior.
 */
async function callPreferredProvider(
  promptWithText: string,
  _rawText: string,
  timeoutMs: number,
  options?: { allowProviderFallback?: boolean },
  schema?: unknown
): Promise<{ text: string; fallbackUsed: boolean }> {
  const allowProviderFallback = options?.allowProviderFallback ?? true;
  // When callers explicitly request skipping provider fallback, pass that through.
  const callerOpts = { timeoutMs, allowProviderFallback };
  // Use OpenAI-only caller when the caller intends to skip adapters (compat path).
  // Older code used 'skipAdapters' boolean; callers that need OpenAI-only should pass allowProviderFallback=false
  const caller = allowProviderFallback ? defaultLLMCaller : openaiOnlyLLMCaller;
  const res = await caller(promptWithText, schema, callerOpts as any);
  return { text: res.text, fallbackUsed: !!res.fallbackUsed };
}
    // Helper: attempt to get and parse LLM output with repair + retry loop
    // Minimal JSON Schemas used to request structured responses from Responses API/SDK when available.
    // OpenAI Responses API requires top-level schemas to explicitly set additionalProperties: false
    // and — in practice — expects that 'required' arrays include every property listed under 'properties'
    // for nested objects (otherwise the API rejects the schema as "invalid_json_schema").
    const SECTION_RESPONSE_SCHEMA = {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
              fieldKey: { type: "string" },
              confidence: { type: "number" },
              // Optional source span for highlighting in UI
              sourceSpan: {
                type: "object",
                properties: {
                  start: { type: "number" },
                  end: { type: "number" }
                },
                required: ["start", "end"],
                additionalProperties: false
              }
            },
            // Ensure all declared properties are also listed in 'required' to satisfy Responses API validation.
            required: ["title", "content", "fieldKey", "confidence"],
            additionalProperties: false
          }
        }
      },
      required: ["sections"],
      additionalProperties: false
    };
    const METADATA_RESPONSE_SCHEMA = {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        linkedinUrl: { type: "string" },
        // AI-first extensions (optional but allowed by schema)
        desiredPosition: { type: "string" },
        phoneRaw: { type: "string" },
        phoneE164: { type: "string" },
        addressBlock: { type: "string" },          // multiline address as-is
        addressNormalized: { type: "string" },     // e.g., "Los Angeles, CA 90291, United States"
        // Optional per-slot confidences (0..1)
        confidences: {
          type: "object",
          properties: {
            name: { type: "number" },
            email: { type: "number" },
            phone: { type: "number" },
            desiredPosition: { type: "number" },
            addressNormalized: { type: "number" }
          },
          additionalProperties: false
        },
        // Optional per-slot spans for rawText mapping
        spans: {
          type: "object",
          properties: {
            name: {
              type: "object",
              properties: { start: { type: "number" }, end: { type: "number" } },
              required: ["start", "end"],
              additionalProperties: false
            },
            email: {
              type: "object",
              properties: { start: { type: "number" }, end: { type: "number" } },
              required: ["start", "end"],
              additionalProperties: false
            },
            phone: {
              type: "object",
              properties: { start: { type: "number" }, end: { type: "number" } },
              required: ["start", "end"],
              additionalProperties: false
            },
            desiredPosition: {
              type: "object",
              properties: { start: { type: "number" }, end: { type: "number" } },
              required: ["start", "end"],
              additionalProperties: false
            },
            addressBlock: {
              type: "object",
              properties: { start: { type: "number" }, end: { type: "number" } },
              required: ["start", "end"],
              additionalProperties: false
            }
          },
          additionalProperties: false
        }
      },
      // Keep original required for backwards compatibility; extensions are optional
      required: ["name", "email", "phone", "linkedinUrl"],
      additionalProperties: false
    };


    async function attemptLLMParse(
      promptTemplate: string,
      parserFn: (text: string) => any,
      validateOutput: ((parsed: any) => { isValid: boolean; confidence?: number; issues?: string[] }) | null,
      timeoutMs: number,
      schema?: unknown
    ): Promise<any> {
      const attempts = 2;
      let lastErr: Error | null = null;
      let providerSwitched = false; // budget: allow only one provider switch (adapter -> openai) per parse invocation
      for (let attempt = 1; attempt <= attempts; attempt++) {
        // Telemetry flags for this parse attempt (best-effort)
        let sanitizedForRepairFlag = false;
        const repairReturnedProviderShapeFlag = false;
        try {
          const promptWithText = promptTemplate.replace('{{cvText}}', rawText);
          // Primary parse attempt using the generic LLM caller with timeout.
          let raw: string | null = null;
          try {
            const { text, fallbackUsed } = await callPreferredProvider(promptWithText, rawText, timeoutMs, { allowProviderFallback: !providerSwitched }, schema);
            raw = text;
            if (fallbackUsed) providerSwitched = true;
          } catch (callErr: any) {
            lastErr = callErr;
            continue; // try again
          }

          // Try to parse using the provided parser
          let parsed = null;
          try {
            parsed = parserFn(raw);
          } catch {
            parsed = null;
          }

          // If parsed and we have a validator, run it
          if (parsed && validateOutput) {
            const v = validateOutput(parsed);
            if (v.isValid && (v.confidence ?? 1) > 0.45) {
              try {
                if (parsed && typeof parsed === "object") (parsed).telemetry = { providerUsed: null, sanitizedForRepair: false, repairReturnedProviderShape: false };
              } catch {}
              return parsed;
            }
            // otherwise fallthrough to repair step
          } else if (parsed && !validateOutput) {
            try {
              if (parsed && typeof parsed === "object") (parsed).telemetry = { providerUsed: null, sanitizedForRepair: false, repairReturnedProviderShape: false };
            } catch {}
            return parsed;
          }

          // Attempt repair of the raw text using an LLM prompt specialized for fixing JSON.
          // Before attempting repair, run a lightweight sanitizer to strip common provider metadata
          // wrappers (e.g. id/object/model/usage output) so the repair LLM sees the most-likely payload.
          // If an OpenAI key is available, prefer calling OpenAI Responses for the repair step
          // because it tends to be more robust at JSON extraction/repair. Fall back to callLLM.
          try {
            const sanitizedPayload = sanitizeProviderResponse(raw);
            sanitizedForRepairFlag = sanitizedPayload !== raw;

            // Quick-reject: if sanitized payload is clearly not JSON-like, skip expensive repair attempts
            if (!sanitizedPayload || typeof sanitizedPayload !== "string" || sanitizedPayload.trim().length < 20 || (!/[{\[]/.test(sanitizedPayload) && !/(sections|profile|experience|skills|contact|metadata)/i.test(sanitizedPayload))) {
              lastErr = new Error("Sanitized payload not repairable");
              continue;
            }

            const strongRepairCaller = hasOpenAIKey() ? (p: string) => callOpenAIResponsesForRepair(p, rawText) : callLLM;
            // Use a bounded repair timeout to avoid long blocking loops; reduce to 5s for this call.
            const repaired = await repairJSON(sanitizedPayload, 5000, strongRepairCaller);
            if (!repaired) {
              lastErr = new Error("repairJSON returned null");
              continue;
            }

            try {
              let reparsed = parserFn(repaired);
              if (reparsed) {
                // Post-parse normalization: if the repair LLM returned a provider-shaped object
                // (contains id/object/model/usage/etc.) but not the canonical 'sections' array,
                // attempt to find and extract the first nested payload that looks like our target.
                try {
                  if (typeof reparsed === "object" && !Array.isArray(reparsed) && !reparsed.sections) {
                    // 1) Breadth-first search for nested object that contains sections/profile/experience/skills/contact/metadata
                    const queue: any[] = [reparsed];
                    let found: any = null;
                    const seen = new Set<any>();
                    while (queue.length && !found) {
                      const node = queue.shift();
                      if (!node || typeof node !== "object") continue;
                      if (seen.has(node)) continue;
                      seen.add(node);
                      if (Array.isArray((node).sections) || (node.profile || node.experience || node.skills || node.contact || node.metadata)) {
                        found = node;
                        break;
                      }
                      for (const k of Object.keys(node)) {
                        try {
                          const child = (node)[k];
                          if (child && typeof child === "object") queue.push(child);
                        } catch {}
                      }
                    }
                    if (found) reparsed = found;

                    // 2) If still no nested object, scan string-valued properties for fenced JSON or raw JSON
                    if (!reparsed.sections) {
                      const scanQueue: any[] = [reparsed];
                      const visited = new Set<any>();
                      let extracted: any = null;
                      while (scanQueue.length && !extracted) {
                        const node = scanQueue.shift();
                        if (!node || typeof node !== "object" || visited.has(node)) continue;
                        visited.add(node);
                        for (const k of Object.keys(node)) {
                          try {
                            const val = (node)[k];
                            if (typeof val === "string") {
                              const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(val);
                              if (fenced && fenced[1]) {
                                const tryObj = (() => { try { return JSON.parse(fenced[1]); } catch { return null; } })();
                                if (tryObj && typeof tryObj === "object") { extracted = tryObj; break; }
                              }
                              // try direct parse if looks like JSON
                              const trimmed = val.trim();
                              if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
                                try {
                                  const tryObj = JSON.parse(trimmed);
                                  if (tryObj && typeof tryObj === "object") { extracted = tryObj; break; }
                                } catch {}
                              }
                            } else if (typeof val === "object" && val !== null) {
                              scanQueue.push(val);
                            }
                          } catch {}
                        }
                      }
                      if (extracted) reparsed = extracted;
                    }
                  }
                } catch (normErr: any) {
                  // normalization best-effort; if it fails, continue with original reparsed
                }

                if (validateOutput) {
                  const v2 = validateOutput(reparsed);
                  if (v2.isValid && (v2.confidence ?? 1) > 0.45) return reparsed;
                } else {
                  return reparsed;
                }
              }
            } catch {
              // reparsed failed; continue to next attempt
            }
          } catch (repairErr: any) {
            lastErr = repairErr;
          }

          // Mark this attempt as failed and continue retrying if attempts remain
          lastErr = new Error(`Attempt ${attempt} failed to produce valid parsed output`);
        } catch (callErr: any) {
          lastErr = callErr;
        }
      }
      // Exhausted attempts
      throw lastErr ?? new Error("Unknown LLM parsing failure");
    }

    // Perform section extraction with validation
    // Choose language-aware prompts when French is detected to improve instruction following.
    const sectionPrompt = detectLanguageIsFrench(rawText)
      ? SECTION_EXTRACTION_PROMPT + "\n\nINSTRUCTIONS (FR): Répondez uniquement en JSON valide (aucune explication). Si le CV est en français, répondez en français."
      : SECTION_EXTRACTION_PROMPT;
    const sectionTimeout = detectLanguageIsFrench(rawText) ? 30000 : 15000; // increased timeouts: French=30s, default=15s
    const parsedSections = await attemptLLMParse(
      sectionPrompt,
      parseLLMSections,
      (p: any) => validateLLMOutput(p, rawText),
      sectionTimeout,
      SECTION_RESPONSE_SCHEMA
    );

    // Perform metadata extraction (lighter validation) using same language-aware strategy
    const metadataPrompt = detectLanguageIsFrench(rawText)
      ? METADATA_EXTRACTION_PROMPT + "\n\nINSTRUCTIONS (FR): Répondez uniquement en JSON valide (aucune explication). Si le CV est en français, répondez en français."
      : METADATA_EXTRACTION_PROMPT;
    const metadataTimeout = detectLanguageIsFrench(rawText) ? 15000 : 7000; // increased metadata timeout: French=15s, default=7s
    const parsedMetadata = await attemptLLMParse(
      metadataPrompt,
      parseLLMMetadata,
      null, // no heavy validator; parser returns final shape or null
      metadataTimeout,
      METADATA_RESPONSE_SCHEMA
    );

    // Debug: surface what we received from the LLM adapters/parsers
    try {
      console.log("[parseCV] parsedSections present:", !!parsedSections, "sections.length:", parsedSections?.sections?.length ?? 0);
      console.log("[parseCV] parsedMetadata present:", !!parsedMetadata, "metadata keys:", parsedMetadata ? Object.keys(parsedMetadata) : []);
    } catch {
      // ignore logging errors
    }

    // Final validation pass for sections
    const validation = validateLLMOutput(parsedSections, rawText);
    if (validation.isValid && validation.confidence > 0.7) {
      const sectionsAdjusted = parsedSections.sections.map((s: { title: string; content: string; fieldKey: string; confidence: number; }) => ({
        ...s,
        confidence: s.confidence * validation.confidence // Adjust confidence based on overall validation
      }));

      // Enrich with NER (layout + entities + metadata fill) and optionally map
      const enriched = await enrichWithNER({ sections: sectionsAdjusted, metadata: parsedMetadata });
      const result: ParseResult = {
        sections: enriched.sections,
        metadata: enriched.metadata,
        method: 'llm',
        warnings: validation.issues
      };
      if (options?.returnMappedCV) {
        try {
          const mapped = await mapSectionsToCV(result.sections, result.metadata, { stripLinkOnly: options?.mapperStrip });
          result.cv = enriched.nerPayload ? { ...(mapped as any), _ner: enriched.nerPayload } : mapped;
          try { recordTelemetry("mapper.mapped", { method: "llm", sections: result.sections.length }); } catch {}
        } catch (mapErr: any) {
          try { recordTelemetry("mapper.failed", { error: String(mapErr) }); } catch {}
        }
      }
      return result;
    } else {
      // Lenient acceptance: if the LLM produced structured sections we accept them even when strict validation fails.
      // This improves robustness when providers return correct JSON but fuzzy matching lowers coverage.
      if (parsedSections && Array.isArray(parsedSections.sections) && parsedSections.sections.length > 0) {
        const warn = [`LLM validation failed strict checks: ${validation.issues.join(', ')}`];
        warnings.push(...validation.issues, ...warn);
        const sectionsAdjusted = parsedSections.sections.map((s: { title: string; content: string; fieldKey: string; confidence: number; }) => ({
          ...s,
          confidence: Math.max(0.4, (s.confidence ?? 0.5) * (validation.confidence || 0.5)) // accept but degrade confidence
        }));
        const enriched = await enrichWithNER({ sections: sectionsAdjusted, metadata: parsedMetadata });
        const result: ParseResult = {
          sections: enriched.sections,
          metadata: enriched.metadata,
          method: 'llm',
          warnings
        };
        if (options?.returnMappedCV) {
          try {
            const mapped = await mapSectionsToCV(result.sections, result.metadata, { stripLinkOnly: options?.mapperStrip });
            result.cv = enriched.nerPayload ? { ...(mapped as any), _ner: enriched.nerPayload } : mapped;
            try { recordTelemetry("mapper.mapped", { method: "llm_lenient", sections: result.sections.length }); } catch {}
          } catch (mapErr: any) {
            try { recordTelemetry("mapper.failed", { error: String(mapErr) }); } catch {}
          }
        }
        return result;
      }
      fallbackReason = `LLM validation failed: ${validation.issues.join(', ')}`;
      warnings.push(...validation.issues);
      // If validation fails here we will fall through to heuristics below
    }
  } catch (error: any) {
    fallbackReason = `LLM error: ${error.message}`;
    warnings.push(fallbackReason);
  }

  // Fallback to enhanced heuristics
  console.warn(`Falling back to heuristics: ${fallbackReason}`);

  const heuristicSections = parseWithEnhancedHeuristics(rawText);
  const heuristicMetadata = extractMetadataHeuristically(rawText);

  const enriched = await enrichWithNER({ sections: heuristicSections, metadata: heuristicMetadata });
  const result: ParseResult = {
    sections: enriched.sections,
    metadata: enriched.metadata,
    method: 'heuristic',
    warnings
  };
  if (options?.returnMappedCV) {
    try {
      const mapped = await mapSectionsToCV(result.sections, result.metadata, { stripLinkOnly: options?.mapperStrip });
      result.cv = enriched.nerPayload ? { ...(mapped as any), _ner: enriched.nerPayload } : mapped;
      try { recordTelemetry("mapper.mapped", { method: "heuristic", sections: result.sections.length }); } catch {}
    } catch (mapErr: any) {
      try { recordTelemetry("mapper.failed", { error: String(mapErr) }); } catch {}
    }
  }
  return result;
}

async function callOpenAIResponsesForRepair(prompt: string, text: string, opts?: { signal?: AbortSignal }): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY ?? llmConfig.openaiKey ?? null;
  const promptWithText = prompt.replace('{{cvText}}', text);
  if (!apiKey) throw new Error("No OpenAI key available for strong repair");

  // Prefer SDK (dynamic import) for stricter response_format handling and better extraction guarantees.
  const modelForRepair = (llmConfig as any)?.openaiModel ?? process.env.OPENAI_MODEL ?? "gpt-5-nano";
  const fallbackModelRepair = "gpt-5-nano"; // keep gpt-5-nano as the stable repair model
  const startOverall = Date.now();

  // Build a strict response_format requesting JSON schema
  const responseFormat = {
    type: "json_schema",
    // include top-level name & strict schema that the Responses API expects
    name: "repair",
    // The schema must be strict for the OpenAI Responses API.
    // Keep a minimal schema object here for documentation, but avoid sending it
    // to the Responses API below (some environments reject object schemas that
    // are too generic). The repair step will prefer plain text SDK/fetch calls
    // without attaching a text.format to maximize compatibility.
    schema: { type: "object", additionalProperties: false },
    json_schema: {
      name: "repair",
      schema: { type: "object", additionalProperties: false }
    }
  };

  // Try SDK first (if available)
  try {
    const openaiModule: any = await import("openai").catch(() => null);
    const OpenAI = openaiModule?.default ?? openaiModule?.OpenAI ?? null;
    if (OpenAI) {
      try { recordTelemetry("adapter.sdk_attempt", { model: modelForRepair }); } catch {}
      const client = new OpenAI({ apiKey });
      // Build SDK request WITHOUT attaching text.format to avoid Responses API schema
      // validation failures during repair. We prefer a plain text response for repair
      // so our repairJSON routine can operate robustly on whatever the provider returns.
      const req: any = {
        model: modelForRepair,
        input: promptWithText
      };
      try {
        const resp: any = await client.responses.create(req);
        try { recordTelemetry("adapter.sdk_response", { keys: Object.keys(resp || {}) }); } catch {}
        // Normalize SDK shapes (mirror extraction logic)
        const j: any = resp;
        if (Array.isArray(j.choices) && j.choices[0]?.message?.content) return String(j.choices[0].message.content);
        if (j.full_response && Array.isArray(j.full_response.choices) && j.full_response.choices[0]?.message?.content) return String(j.full_response.choices[0].message.content);
        const outputs = j.output || j.outputs || j.output?.[0]?.content || j.outputs?.[0]?.content;
        if (Array.isArray(outputs)) {
          for (const item of outputs) {
            if (item && typeof item === "object") {
              if (item.json) return JSON.stringify(item.json);
              if (item.text) return String(item.text);
              if (typeof item.content === "string") return String(item.content);
              if (item.type === "output_text" && item.text) return String(item.text);
            }
          }
        }
        if (j?.output?.[0]?.content?.[0]) {
          const c = j.output[0].content[0];
          if (c.json) return JSON.stringify(c.json);
          if (c.text) return String(c.text);
          if (c.output_text) return String(c.output_text);
        }
        // Fallback: try fenced JSON from SDK response
        try {
          const asString = JSON.stringify(j);
          const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(asString);
          if (fence && fence[1]) return fence[1].trim();
        } catch { /* ignore */ }
        return JSON.stringify(j);
      } catch (sdkErr: any) {
        // If SDK reports model_not_found, attempt a single fallback model and retry once.
        const msg = String(sdkErr?.message ?? sdkErr);
        try { recordTelemetry("adapter.sdk_error", { message: msg }); } catch {}
        if (/model_not_found/i.test(msg)) {
          try { recordTelemetry("adapter.fallback_trace", { requestedModel: modelForRepair, provider: "openai-sdk", attemptedModel: fallbackModelRepair, attemptIndex: 2, outcome: "fallback_retriable" }); } catch {}
          try {
            const retryReq = { ...req, model: fallbackModelRepair };
            const retryResp: any = await client.responses.create(retryReq);
            try { recordTelemetry("adapter.sdk_response", { keys: Object.keys(retryResp || {}), retriedWith: fallbackModelRepair }); } catch {}
            const jr: any = retryResp;
            if (Array.isArray(jr.choices) && jr.choices[0]?.message?.content) return String(jr.choices[0].message.content);
            const outputs2 = jr.output || jr.outputs || jr.output?.[0]?.content || jr.outputs?.[0]?.content;
            if (Array.isArray(outputs2)) {
              for (const item of outputs2) {
                if (item && typeof item === "object") {
                  if (item.json) return JSON.stringify(item.json);
                  if (item.text) return String(item.text);
                  if (typeof item.content === "string") return String(item.content);
                  if (item.type === "output_text" && item.text) return String(item.text);
                }
              }
            }
            try {
              const asString = JSON.stringify(jr);
              const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(asString);
              if (fence && fence[1]) return fence[1].trim();
            } catch { /* ignore */ }
            return JSON.stringify(jr);
          } catch (retryErr: any) {
            try { recordTelemetry("adapter.sdk_error", { message: String(retryErr) }); } catch {}
            // fallthrough to fetch-based fallback
          }
        }
        // fallthrough to fetch path
      }
    }
  } catch (sdkImportErr: any) {
    try { recordTelemetry("adapter.sdk_import_failed", { message: String(sdkImportErr?.message ?? sdkImportErr) }); } catch {}
  }

  // Fallback to fetch-based implementation (respect Retry-After for 429)
  // Use a plain request body for fetch-based repair (do not attach text.format).
  // This avoids invalid_json_schema errors from Responses API when schema shapes are
  // too generic or missing explicit properties.
  const body: any = {
    model: modelForRepair,
    input: promptWithText
  };

  let res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: opts?.signal
  });

  // If rate-limited (429), respect Retry-After and retry once.
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    const delayMs = retryAfter ? Math.max(1000, parseInt(retryAfter, 10) * 1000) : 1000;
    try { recordTelemetry("adapter.retry_summary", { provider: "openai", attemptedModel: modelForRepair, reason: "rate_limited", retryAfterMs: delayMs }); } catch {}
    await new Promise((r) => setTimeout(r, delayMs));
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: opts?.signal
    });
  }

  if (!res.ok) {
    let bodyText = await res.text().catch(() => "");
    if (res.status === 400 && /model_not_found/i.test(bodyText)) {
      try { console.warn("[callOpenAIResponsesForRepair] model not found:", body.model, " -> falling back to", fallbackModelRepair); } catch {}
      try {
        body.model = fallbackModelRepair;
        res = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(body),
          signal: opts?.signal
        });
      } catch (retryErr: any) {
        try { console.warn("[callOpenAIResponsesForRepair] retry failed:", String(retryErr)); } catch {}
      }
      if (!res.ok) {
        bodyText = await res.text().catch(() => "");
        throw new Error(`OpenAI repair error: ${res.status} ${res.statusText} ${bodyText}`);
      }
    } else {
      throw new Error(`OpenAI repair error: ${res.status} ${res.statusText} ${bodyText}`);
    }
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI repair error: ${res.status} ${res.statusText} ${txt}`);
  }

  const duration = Date.now() - startOverall;
  try { recordTelemetry("adapter.provider_latency", { provider: "openai", attemptedModel: modelForRepair, durationMs: duration }); } catch {}

  const j = await res.json();

  // Normalize response shapes (json, text, fenced JSON, choices)
  if (Array.isArray(j.choices) && j.choices[0]?.message?.content) return String(j.choices[0].message.content);
  if (j.full_response && Array.isArray(j.full_response.choices) && j.full_response.choices[0]?.message?.content) return String(j.full_response.choices[0].message.content);

  const outputs = j.output || j.outputs || j.output?.[0]?.content || j.outputs?.[0]?.content;
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if (item && typeof item === "object") {
        if (item.json) return JSON.stringify(item.json);
        if (item.text) return String(item.text);
        if (typeof item.content === "string") return String(item.content);
        if (item.type === "output_text" && item.text) return String(item.text);
      }
    }
  }

  if (j?.output?.[0]?.content?.[0]) {
    const c = j.output[0].content[0];
    if (c.json) return JSON.stringify(c.json);
    if (c.text) return String(c.text);
    if (c.output_text) return String(c.output_text);
  }

  try {
    const asString = JSON.stringify(j);
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(asString);
    if (fence && fence[1]) return fence[1].trim();
  } catch {
    // ignore
  }

  return JSON.stringify(j);
}

function hasOpenAIKey(): boolean {
  const raw = process.env.OPENAI_API_KEY ?? llmConfig.openaiKey;
  return !!(raw && String(raw).trim().length > 0);
}

async function callLLMWithTimeout(prompt: string, text: string, timeoutMs: number, schema?: unknown, skipAdapters?: boolean): Promise<string> {
  const promptWithText = prompt.replace('{{cvText}}', text);
  const effectiveTimeout = Math.min(timeoutMs, 30000);

  // Use the shared LLM caller so provider logic is centralized.
  // When skipAdapters is true, create an OpenAI-only caller by forcing provider:"openai".
  const caller = skipAdapters
    ? createLLMCaller({ ...(llmConfig as any), provider: "openai" })
    : createLLMCaller();

  // Delegate to the shared caller and surface the text result.
  const res = await caller(promptWithText, schema, { timeoutMs: effectiveTimeout, allowProviderFallback: !skipAdapters } as any);
  return res.text;
}

export function determineHeuristicFieldKey(line: string): string {
  const trimmed = String(line ?? "").trim();
  const md = /^#{1,6}\s*(.+)/.exec(trimmed);
  const headerText = String(md?.[1] ?? trimmed)
    .replace(/[:\s]+$/g, "")
    .trim();
  if (!headerText) return "unknown";
  const canonicalFamily = resolveCanonicalHeadingFamily(headerText);
  if (!canonicalFamily) return "unknown";
  return mapCanonicalFamilyToParserFieldKey(canonicalFamily);
}

function parseWithEnhancedHeuristics(text: string): any[] {
  // Normalize common escaped newline sequences so tests that pass literal "\n" strings
  // are handled the same as real newlines.
  const normalizedText = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n');
  const lines = normalizedText.split('\n');
  const sections: any[] = [];
  let currentSection: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const context = {
      previousLine: i > 0 ? lines[i - 1] : "",
      nextLine: i < lines.length - 1 ? lines[i + 1] : "",
      lineIndex: i,
    };

    // Treat explicit Markdown headers as headers even if isPotentialHeader misses them.
    const looksLikeMarkdownHeader = /^\s*#{1,6}\s+/.test(line);
    if (isPotentialHeader(line, context) || looksLikeMarkdownHeader) {
      if (currentSection) {
        // Trim trailing whitespace from accumulated content
        currentSection.content = String(currentSection.content || "").trim();
        sections.push(currentSection);
      }

      currentSection = {
        title: String(line || "").trim(),
        content: "",
        fieldKey: determineHeuristicFieldKey(line),
        confidence: 0.7, // Base confidence for heuristic parsing
      };
    } else if (currentSection) {
      currentSection.content += line + "\n";
    }
  }

  if (currentSection) {
    currentSection.content = String(currentSection.content || "").trim();
    sections.push(currentSection);
  }

  return sections;
}
