import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import type { BenchmarkModel, BenchmarkCaseResult, CostEstimate, UsageMetrics } from "../core/types";

export const DEFAULT_TEMPERATURE = 0.2;
export const DEFAULT_MAX_OUTPUT_TOKENS = 500;

export type GenerationSettings = {
  temperature: number;
  maxOutputTokens: number;
};

export function getProviderForModel(model: BenchmarkModel): "mistral" | "openai" {
  if (model === "mistral-small-latest" || model === "mistral-large-latest") {
    return "mistral";
  }
  return "openai";
}

export async function persistRawResponse(
  outputDir: string,
  caseId: string,
  model: BenchmarkModel,
  payload: unknown
): Promise<string> {
  const rawDir = path.join(outputDir, "raw");
  await mkdir(rawDir, { recursive: true });
  const filePath = path.join(rawDir, `${caseId}__${model}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

export function buildSkippedResult(
  model: BenchmarkModel,
  provider: "mistral" | "openai",
  error: string
): BenchmarkCaseResult {
  return {
    status: "skipped",
    model,
    provider,
    error,
    latencyMs: null,
    usage: emptyUsage(),
    cost: emptyCost(),
    rawResponsePath: null,
  };
}

export function emptyUsage(): UsageMetrics {
  return {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
  };
}

export function emptyCost(): CostEstimate {
  return {
    inputCostUsd: null,
    outputCostUsd: null,
    totalCostUsd: null,
  };
}
