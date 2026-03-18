import type { BenchmarkModel, CostEstimate, UsageMetrics } from "./types";

type ModelPricing = {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  pricingLabel: string;
};

const PRICING_BY_MODEL: Record<BenchmarkModel, ModelPricing> = {
  "mistral-small-latest": {
    inputPerMillionUsd: 0.1,
    outputPerMillionUsd: 0.3,
    pricingLabel: "Mistral Small family pricing checked on 2026-03-12",
  },
  "mistral-large-latest": {
    inputPerMillionUsd: 0.5,
    outputPerMillionUsd: 1.5,
    pricingLabel: "Mistral Large family pricing checked on 2026-03-12",
  },
  "gpt-5-nano": {
    inputPerMillionUsd: 0.05,
    outputPerMillionUsd: 0.4,
    pricingLabel: "OpenAI GPT-5 nano pricing checked on 2026-03-12",
  },
  "gpt-4o-mini": {
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
    pricingLabel: "OpenAI GPT-4o mini pricing checked on 2026-03-12",
  },
};

export function getPricingLabel(model: BenchmarkModel): string {
  return PRICING_BY_MODEL[model].pricingLabel;
}

export function estimateCost(model: BenchmarkModel, usage: UsageMetrics): CostEstimate {
  const pricing = PRICING_BY_MODEL[model];
  if (usage.inputTokens == null || usage.outputTokens == null) {
    return {
      inputCostUsd: null,
      outputCostUsd: null,
      totalCostUsd: null,
    };
  }

  const inputCostUsd = (usage.inputTokens / 1_000_000) * pricing.inputPerMillionUsd;
  const outputCostUsd = (usage.outputTokens / 1_000_000) * pricing.outputPerMillionUsd;

  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}
