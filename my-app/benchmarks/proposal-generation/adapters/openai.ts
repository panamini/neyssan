import { estimateCost } from "../core/pricing";
import type { BenchmarkCaseResult } from "../core/types";
import type { GenerationSettings } from "./shared";
import { emptyCost, emptyUsage, getProviderForModel, persistRawResponse } from "./shared";

type OpenAIResponsesUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

type OpenAIResponsesOutputText = {
  type?: string;
  text?: string;
};

type OpenAIResponsesResponse = {
  output_text?: string;
  output?: Array<{
    content?: OpenAIResponsesOutputText[];
  }>;
  usage?: OpenAIResponsesUsage;
};

function extractOutputText(payload: OpenAIResponsesResponse): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const parts = payload.output?.flatMap((entry) => entry.content ?? []) ?? [];
  const text = parts
    .filter((part) => part.type === "output_text" || typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  return text;
}

export async function runOpenAIBenchmarkCase(params: {
  model: "gpt-5-nano" | "gpt-4o-mini";
  prompt: string;
  caseId: string;
  outputDir: string;
  settings: GenerationSettings;
}): Promise<BenchmarkCaseResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const provider = getProviderForModel(params.model);

  if (!apiKey) {
    return {
      status: "skipped",
      model: params.model,
      provider,
      error: "OPENAI_API_KEY is not configured in the current environment.",
      latencyMs: null,
      usage: emptyUsage(),
      cost: emptyCost(),
      rawResponsePath: null,
    };
  }

  const startedAt = Date.now();

  try {
    const requestBody: Record<string, unknown> = {
      model: params.model,
      input: params.prompt,
      max_output_tokens: params.settings.maxOutputTokens,
    };

    // GPT-5 nano rejects temperature on the Responses API; keep the other
    // benchmarked OpenAI model behavior unchanged.
    if (params.model !== "gpt-5-nano") {
      requestBody.temperature = params.settings.temperature;
    }
    // Keep GPT-5 nano from spending the full output budget on hidden reasoning.
    // This is benchmark-only behavior to obtain usable text for side-by-side review.
    if (params.model === "gpt-5-nano") {
      requestBody.reasoning = { effort: "minimal" };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await response.text();
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        status: "error",
        model: params.model,
        provider,
        error: `OpenAI HTTP ${response.status}: ${rawText}`,
        latencyMs,
        usage: emptyUsage(),
        cost: emptyCost(),
        rawResponsePath: await persistRawResponse(params.outputDir, params.caseId, params.model, {
          status: response.status,
          body: rawText,
        }),
      };
    }

    const parsed = JSON.parse(rawText) as OpenAIResponsesResponse;
    const usage = {
      inputTokens: parsed.usage?.input_tokens ?? null,
      outputTokens: parsed.usage?.output_tokens ?? null,
      totalTokens: parsed.usage?.total_tokens ?? null,
    };
    const rawResponsePath = await persistRawResponse(params.outputDir, params.caseId, params.model, parsed);

    return {
      status: "ok",
      model: params.model,
      provider,
      outputText: extractOutputText(parsed),
      latencyMs,
      usage,
      cost: estimateCost(params.model, usage),
      rawResponsePath,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      status: "error",
      model: params.model,
      provider,
      error: error instanceof Error ? error.message : String(error),
      latencyMs,
      usage: emptyUsage(),
      cost: emptyCost(),
      rawResponsePath: null,
    };
  }
}
