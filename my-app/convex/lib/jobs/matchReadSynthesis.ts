import { llmConfig } from "../../../config/llmConfig";
import type { MatchReadConfidence, MatchReadTier } from "./matchRead";

export type MatchReadSynthesisStatus = "pending" | "ready" | "error";

export type MatchReadSynthesisCache = {
  cacheKey: string;
  status: MatchReadSynthesisStatus;
  provider: "mistral";
  model: string;
  computedAt?: number;
  matched?: string[];
  missing?: string[];
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  error?: string;
};

export type MatchReadSynthesisRequest = {
  jobId: string;
  title: string;
  company: string;
  tier: MatchReadTier;
  confidence: MatchReadConfidence;
  matched: string[];
  missing: string[];
};

const MATCH_READ_SYNTHESIS_MAX_ITEMS = 6;
const MATCH_READ_SYNTHESIS_MAX_ITEM_LENGTH = 96;
const MATCH_READ_SYNTHESIS_MAX_OUTPUT_TOKENS = 220;
const DEFAULT_MATCH_READ_SYNTHESIS_MODEL = "ministral-3-3b-instruct-2512";

function compactWhitespace(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function clampSignalItems(values: string[], limit: number): string[] {
  return values
    .map((value) => compactWhitespace(value).slice(0, MATCH_READ_SYNTHESIS_MAX_ITEM_LENGTH))
    .filter(Boolean)
    .slice(0, limit);
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

function extractJsonObject(value: string): string | null {
  const trimmed = compactWhitespace(value);
  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return candidate.slice(start, end + 1);
}

function parseSynthesisJson(
  rawContent: string,
  fallbackMatched: string[],
  fallbackMissing: string[],
) {
  const jsonObject = extractJsonObject(rawContent);
  if (!jsonObject) {
    throw new Error("match_read_synthesis_invalid_json");
  }

  const parsed = JSON.parse(jsonObject) as {
    matched?: unknown;
    missing?: unknown;
  };

  const matched =
    fallbackMatched.length === 0
      ? []
      : Array.isArray(parsed.matched)
        ? clampSignalItems(
            parsed.matched.map((item) => String(item ?? "")),
            fallbackMatched.length,
          )
        : [];

  const missing =
    fallbackMissing.length === 0
      ? []
      : Array.isArray(parsed.missing)
        ? clampSignalItems(
            parsed.missing.map((item) => String(item ?? "")),
            fallbackMissing.length,
          )
        : [];

  return {
    matched: matched.length > 0 || fallbackMatched.length === 0 ? matched : fallbackMatched,
    missing: missing.length > 0 || fallbackMissing.length === 0 ? missing : fallbackMissing,
  };
}

export function resolveMatchReadSynthesisModel(): string {
  return (
    process.env.MISTRAL_MATCH_READ_MODEL ??
    llmConfig.mistralModel ??
    llmConfig.model ??
    process.env.MISTRAL_MODEL ??
    DEFAULT_MATCH_READ_SYNTHESIS_MODEL
  );
}

export function isMatchReadSynthesisEnabled(): boolean {
  return Boolean(
    (llmConfig.mistralKey ?? process.env.MISTRAL_API_KEY ?? "").trim(),
  );
}

export function createPendingMatchReadSynthesisCache(
  cacheKey: string,
): MatchReadSynthesisCache {
  return {
    cacheKey,
    status: "pending",
    provider: "mistral",
    model: resolveMatchReadSynthesisModel(),
  };
}

export function buildMatchReadSynthesisMetricMetadata(
  synthesis: Pick<
    MatchReadSynthesisCache,
    "provider" | "model" | "promptTokens" | "completionTokens" | "estimatedCostUsd"
  >,
) {
  return {
    provider: synthesis.provider,
    model: synthesis.model,
    promptTokens: synthesis.promptTokens,
    completionTokens: synthesis.completionTokens,
    estimatedCostUsd: synthesis.estimatedCostUsd,
  };
}

export async function synthesizeMatchReadWithMistral(
  args: MatchReadSynthesisRequest,
): Promise<MatchReadSynthesisCache> {
  const apiKey = (llmConfig.mistralKey ?? process.env.MISTRAL_API_KEY ?? "").trim();
  const model = resolveMatchReadSynthesisModel();

  if (!apiKey) {
    return {
      cacheKey: "",
      status: "error",
      provider: "mistral",
      model,
      error: "mistral_not_configured",
    };
  }

  const requestBody = {
    model,
    temperature: 0,
    max_tokens: MATCH_READ_SYNTHESIS_MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: "system",
        content: [
          "Rewrite job-match signals into plain, compact phrasing.",
          "Ground truth is fixed. Do not add skills, tools, seniority, or requirements not already present.",
          "Keep the same polarity: matched stays matched, missing stays missing.",
          "Return JSON only with shape {\"matched\": string[], \"missing\": string[]}.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          jobTitle: compactWhitespace(args.title),
          company: compactWhitespace(args.company),
          tier: args.tier,
          confidence: args.confidence,
          matched: clampSignalItems(args.matched, MATCH_READ_SYNTHESIS_MAX_ITEMS),
          missing: clampSignalItems(args.missing, MATCH_READ_SYNTHESIS_MAX_ITEMS),
        }),
      },
    ],
  };

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `match_read_synthesis_failed:${response.status}:${message || response.statusText}`,
    );
  }

  const json = await response.json();
  const rawContent = getMessageText(json?.choices?.[0]?.message?.content);
  const parsed = parseSynthesisJson(rawContent, args.matched, args.missing);

  return {
    cacheKey: "",
    status: "ready",
    provider: "mistral",
    model,
    computedAt: Date.now(),
    matched: parsed.matched,
    missing: parsed.missing,
    promptTokens:
      typeof json?.usage?.prompt_tokens === "number"
        ? json.usage.prompt_tokens
        : undefined,
    completionTokens:
      typeof json?.usage?.completion_tokens === "number"
        ? json.usage.completion_tokens
        : undefined,
  };
}
