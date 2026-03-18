import { estimateCost } from "../core/pricing";
import type { BenchmarkCaseResult } from "../core/types";
import type { GenerationSettings } from "./shared";
import { emptyCost, emptyUsage, getProviderForModel, persistRawResponse } from "./shared";

type MistralUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type MistralChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: MistralUsage;
};

export async function runMistralBenchmarkCase(params: {
  model: "mistral-small-latest" | "mistral-large-latest";
  prompt: string;
  caseId: string;
  outputDir: string;
  settings: GenerationSettings;
}): Promise<BenchmarkCaseResult> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  const provider = getProviderForModel(params.model);

  if (!apiKey) {
    return {
      status: "skipped",
      model: params.model,
      provider,
      error: "MISTRAL_API_KEY is not configured in the current environment.",
      latencyMs: null,
      usage: emptyUsage(),
      cost: emptyCost(),
      rawResponsePath: null,
    };
  }

  const startedAt = Date.now();

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: [{ role: "user", content: params.prompt }],
        temperature: params.settings.temperature,
        max_tokens: params.settings.maxOutputTokens,
      }),
    });

    const rawText = await response.text();
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        status: "error",
        model: params.model,
        provider,
        error: `Mistral HTTP ${response.status}: ${rawText}`,
        latencyMs,
        usage: emptyUsage(),
        cost: emptyCost(),
        rawResponsePath: await persistRawResponse(params.outputDir, params.caseId, params.model, {
          status: response.status,
          body: rawText,
        }),
      };
    }

    const parsed = JSON.parse(rawText) as MistralChatResponse;
    const outputText = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    const usage = {
      inputTokens: parsed.usage?.prompt_tokens ?? null,
      outputTokens: parsed.usage?.completion_tokens ?? null,
      totalTokens: parsed.usage?.total_tokens ?? null,
    };
    const rawResponsePath = await persistRawResponse(params.outputDir, params.caseId, params.model, parsed);

    return {
      status: "ok",
      model: params.model,
      provider,
      outputText,
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
