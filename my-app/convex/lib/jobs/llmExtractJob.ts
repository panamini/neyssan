import { llmConfig } from "../../../config/llmConfig";
import {
  classifyJobExtractionPayload,
  NORMALIZED_JOB_EXTRACTION_SCHEMA_PROMPT,
  type JobExtractionConfidence,
  type JobExtractionValidationStatus,
  type NormalizedJobExtraction,
} from "./jobExtractionSchema";
import { normalizeRawJobTextForHash } from "./normalizeJobExtraction";

export const PROMPT_VERSION = "p9_v1";

const MISTRAL_CHAT_COMPLETIONS_URL = "https://api.mistral.ai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 4000;
const MAX_SAFE_CHARS = 12000;
const JOB_EXTRACTION_MAX_TOKENS = 1400;
const JOB_EXTRACTION_TEMPERATURE = 0.1;

const REQUIREMENT_HEAVY_LINE_RE =
  /\b(about the role|what you(?:'|’)ll do|what you will do|your responsibilities|qualifications?|requirements?|responsibilities?|skills?|experience|license|certification|language|schedule|shift|onsite|standing|customer[- ]facing|retail|required|must|preferred)\b/i;

export type JobExtractionRequestBody = {
  model: string;
  temperature: number;
  max_tokens: number;
  response_format: { type: "json_object" };
  messages: Array<{ role: "system" | "user"; content: string }>;
};

export type JobExtractionMetadata = {
  rawOutput: unknown;
  llmNormalizedOutput: NormalizedJobExtraction | null;
  normalizedOutput: NormalizedJobExtraction;
  validationStatus: JobExtractionValidationStatus;
  fallbackUsed: boolean;
  model: string;
  promptVersion: typeof PROMPT_VERSION;
  latencyMs: number;
  modelConfidence: JobExtractionConfidence | null;
  finalConfidence: JobExtractionConfidence | null;
};

type ExtractJobStructuredOptions = {
  fallback?: () => NormalizedJobExtraction;
  apiKey?: string | null;
  model?: string;
  fetchImpl?: typeof fetch;
};

const FALLBACK_EXTRACTION: NormalizedJobExtraction = {
  summary_short: "",
  role_title_normalized: "",
  requirements: [],
  keywords_canonical: [],
  licenses_or_certifications: [],
  schedule_constraints: [],
  environment: {
    customer_facing: null,
    retail: null,
    physical_standing: null,
    onsite: null,
  },
  confidence: "low",
};

function compactWhitespace(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function elapsedMs(startMs: number): number {
  return Math.max(0, Math.round(nowMs() - startMs));
}

export function isJobLlmExtractionShadowEnabled(
  rawValue: string | undefined =
    process.env.JOB_LLM_EXTRACTION_SHADOW ??
    process.env.ENABLE_JOB_LLM_EXTRACTION_SHADOW,
): boolean {
  const normalized = compactWhitespace(rawValue ?? "").toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

export function resolveJobExtractionModel(config: {
  mistralModel?: string | null;
  model?: string | null;
} = llmConfig): string {
  return (
    process.env.JOB_EXTRACTION_MISTRAL_MODEL ??
    process.env.MISTRAL_MODEL ??
    config.mistralModel ??
    config.model ??
    "mistral-small-latest"
  );
}

export function prepareJobTextForPrompt(jobText: string): string {
  const normalized = compactWhitespace(jobText);
  if (normalized.length <= MAX_SAFE_CHARS) {
    return normalized;
  }

  const opening = normalized.slice(0, 3000);
  const requirementHeavyLines = String(jobText ?? "")
    .split(/\n+/)
    .map((line) => compactWhitespace(line))
    .filter((line) => line && REQUIREMENT_HEAVY_LINE_RE.test(line))
    .join("\n");

  return compactWhitespace([opening, requirementHeavyLines].filter(Boolean).join("\n")).slice(
    0,
    MAX_SAFE_CHARS,
  );
}

export function buildJobExtractionRequestBody(
  jobText: string,
  model: string,
): JobExtractionRequestBody {
  return {
    model,
    temperature: JOB_EXTRACTION_TEMPERATURE,
    max_tokens: JOB_EXTRACTION_MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a structured job extraction engine.",
          "",
          "Return ONLY valid JSON matching the schema.",
          "",
          "STRICT RULES:",
          "- No explanations",
          "- No markdown",
          "- No extra fields",
          "",
          "EXCLUDE:",
          "- location",
          "- salary",
          "- benefits",
          "- company marketing",
          "- boilerplate text",
          "",
          "NORMALIZE:",
          "- convert sentences into short canonical requirements",
          "- deduplicate aggressively",
          "- prefer noun phrases",
          "- output only meaningful requirements",
          "",
          "LANGUAGE:",
          "- Preserve the original language of the job post.",
          "- Do not translate.",
          "- All extracted fields should remain in the same language as the source job post whenever possible.",
          "",
          "If unsure, omit the field.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "Extract structured job data from the following raw job post.",
          "",
          "Return ONLY valid JSON matching the required schema.",
          "",
          "Schema:",
          NORMALIZED_JOB_EXTRACTION_SCHEMA_PROMPT,
          "",
          "Job post:",
          prepareJobTextForPrompt(jobText),
        ].join("\n"),
      },
    ],
  };
}

function getMessageText(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item) {
          return String((item as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("\n");
  }

  return "";
}

function extractMistralMessageContent(payload: unknown): unknown {
  const response = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = response?.choices?.[0]?.message?.content;
  const text = getMessageText(content);
  return text || content || payload;
}

function getFallbackExtraction(options: ExtractJobStructuredOptions): NormalizedJobExtraction {
  return options.fallback?.() ?? FALLBACK_EXTRACTION;
}

function fallbackResult(args: {
  rawOutput: unknown;
  validationStatus: JobExtractionValidationStatus;
  fallback: NormalizedJobExtraction;
  model: string;
  startMs: number;
}): JobExtractionMetadata {
  return {
    rawOutput: args.rawOutput,
    llmNormalizedOutput: null,
    normalizedOutput: args.fallback,
    validationStatus: args.validationStatus,
    fallbackUsed: true,
    model: args.model,
    promptVersion: PROMPT_VERSION,
    latencyMs: elapsedMs(args.startMs),
    modelConfidence: null,
    finalConfidence: args.fallback.confidence,
  };
}

export function isCompleteJsonObjectText(rawOutput: unknown): boolean {
  if (typeof rawOutput !== "string") {
    return true;
  }

  return rawOutput.trim().endsWith("}");
}

export async function hashNormalizedJobText(jobText: string): Promise<string> {
  const normalized = normalizeRawJobTextForHash(jobText);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function extractJobStructuredWithMetadata(
  jobText: string,
  options: ExtractJobStructuredOptions = {},
): Promise<JobExtractionMetadata> {
  const startMs = nowMs();
  const model = options.model ?? resolveJobExtractionModel();
  const apiKey = compactWhitespace(options.apiKey ?? llmConfig.mistralKey ?? process.env.MISTRAL_API_KEY ?? "");
  const fallback = getFallbackExtraction(options);

  if (!apiKey) {
    return fallbackResult({
      rawOutput: null,
      validationStatus: "invalid_json",
      fallback,
      model,
      startMs,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await (options.fetchImpl ?? fetch)(MISTRAL_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildJobExtractionRequestBody(jobText, model)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return fallbackResult({
        rawOutput: errorText || `${response.status} ${response.statusText}`,
        validationStatus: "invalid_json",
        fallback,
        model,
        startMs,
      });
    }

    const json = await response.json();
    const rawOutput = extractMistralMessageContent(json);
    if (!isCompleteJsonObjectText(rawOutput)) {
      return fallbackResult({
        rawOutput,
        validationStatus: "invalid_json",
        fallback,
        model,
        startMs,
      });
    }

    const classification = classifyJobExtractionPayload(rawOutput);

    if (classification.validationStatus !== "valid" || !classification.normalizedOutput) {
      const fallbackMetadata = fallbackResult({
        rawOutput,
        validationStatus: classification.validationStatus,
        fallback,
        model,
        startMs,
      });
      return {
        ...fallbackMetadata,
        modelConfidence: classification.modelConfidence ?? null,
        finalConfidence: classification.finalConfidence ?? fallbackMetadata.finalConfidence,
      };
    }

    return {
      rawOutput,
      llmNormalizedOutput: classification.normalizedOutput,
      normalizedOutput: classification.normalizedOutput,
      validationStatus: "valid",
      fallbackUsed: false,
      model,
      promptVersion: PROMPT_VERSION,
      latencyMs: elapsedMs(startMs),
      modelConfidence: classification.modelConfidence ?? null,
      finalConfidence:
        classification.finalConfidence ?? classification.normalizedOutput.confidence,
    };
  } catch (error) {
    return fallbackResult({
      rawOutput: error instanceof Error ? error.message : String(error),
      validationStatus: "invalid_json",
      fallback,
      model,
      startMs,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractJobStructured(
  jobText: string,
): Promise<NormalizedJobExtraction> {
  return (await extractJobStructuredWithMetadata(jobText)).normalizedOutput;
}
