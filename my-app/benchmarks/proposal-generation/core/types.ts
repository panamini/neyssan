import { z } from "zod";

export const benchmarkModelSchema = z.enum([
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "gpt-5-nano",
  "gpt-4o-mini",
]);

export type BenchmarkModel = z.infer<typeof benchmarkModelSchema>;

export const proposalTypeSchema = z.enum([
  "cover_letter",
  "application_message",
  "freelance_proposal",
]);

export const formalitySchema = z.enum(["informal", "neutral", "formal"]);

export const creativitySchema = z.enum(["low", "medium", "high"]);

export const personalizationModeSchema = z.enum(["default", "explicit_only"]);

export const personalizationRichnessSchema = z.enum([
  "none",
  "minimal",
  "sparse",
  "rich",
]);

export const candidateContextSchema = z.object({
  name: z.string().optional(),
  summary: z.string().optional(),
  desiredPosition: z.string().optional(),
  topSkills: z.array(z.string()).optional(),
  recentExperience: z
    .array(
      z.object({
        company: z.string().optional(),
        position: z.string().optional(),
        highlights: z.array(z.string()).optional(),
      })
    )
    .optional(),
  standoutAchievements: z.array(z.string()).optional(),
});

export type CandidateContext = z.infer<typeof candidateContextSchema>;

export const benchmarkCaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  jobTitle: z.string().min(2),
  jobDescription: z.string().min(10),
  proposalType: proposalTypeSchema,
  formalityLevel: formalitySchema,
  creativity: creativitySchema,
  personalizationMode: personalizationModeSchema.default("default"),
  personalizationRichness: personalizationRichnessSchema.default("rich"),
  candidateContext: candidateContextSchema.nullable(),
  expectedGrounding: z.array(z.string()).default([]),
  forbiddenClaims: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type BenchmarkCase = z.infer<typeof benchmarkCaseSchema>;

export const benchmarkDatasetSchema = z.object({
  version: z.literal(1),
  description: z.string().min(1),
  cases: z.array(benchmarkCaseSchema).min(1),
});

export type BenchmarkDataset = z.infer<typeof benchmarkDatasetSchema>;

export type UsageMetrics = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type CostEstimate = {
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  totalCostUsd: number | null;
};

export type BenchmarkSuccessResult = {
  status: "ok";
  model: BenchmarkModel;
  provider: "mistral" | "openai";
  outputText: string;
  latencyMs: number;
  usage: UsageMetrics;
  cost: CostEstimate;
  rawResponsePath: string;
};

export type BenchmarkFailureResult = {
  status: "error" | "skipped";
  model: BenchmarkModel;
  provider: "mistral" | "openai";
  error: string;
  latencyMs: number | null;
  usage: UsageMetrics;
  cost: CostEstimate;
  rawResponsePath: string | null;
};

export type BenchmarkCaseResult = BenchmarkSuccessResult | BenchmarkFailureResult;

export type ReviewScoreKey =
  | "writing_quality"
  | "honesty"
  | "grounding"
  | "relevance"
  | "format_adherence";

export const defaultUsageMetrics = (): UsageMetrics => ({
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
});

export const defaultCostEstimate = (): CostEstimate => ({
  inputCostUsd: null,
  outputCostUsd: null,
  totalCostUsd: null,
});
