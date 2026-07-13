import { existsSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import * as dotenv from "dotenv";

import {
  llmConfig,
  resolveOpenAIProposalReasoningEffort,
} from "../../config/llmConfig";
import type { CoverLetterScore } from "../../convex/lib/proposals/coverLetterEvaluation";
import {
  analyzeCompanyValues,
  type CompanyValuesPack,
} from "../../convex/lib/proposals/companyValues";
import { buildProposalGenerationControlsBlock } from "../../convex/lib/proposals/generationControls";
import {
  PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
  PREMIUM_COVER_LETTER_MISTRAL_SYSTEM_PROMPT,
  PREMIUM_COVER_LETTER_WRITER_MODELS,
  PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
  attemptPremiumCoverLetterGeneration,
  generatePremiumCoverLetterBodyPartsWithMistral,
  generatePremiumCoverLetterBodyPartsWithExactOpenAIModel,
  generatePremiumCoverLetterBodyPartsWithOpenAI,
  isCoverLetterPremiumPromptV2Enabled,
  isCoverLetterQualityRepairV1Enabled,
  resolvePremiumCoverLetterWriterModel,
  buildPremiumCoverLetterOpenAIRequestForExactModel,
  type PremiumCoverLetterAttemptResult,
  type PremiumCoverLetterFailureTrace,
  type PremiumCoverLetterQualityShadowResult,
  type PremiumCoverLetterWriter,
  type PremiumCoverLetterWriterModel,
  type PremiumCoverLetterProviderResponseMetadata,
} from "../../convex/lib/proposals/premiumCoverLetter";
import {
  resolveProposalOutputLanguage,
  type ProposalOutputLanguage,
} from "../../convex/lib/proposals/proposalOutput";
import {
  isProposalGenerationQualityLiveMode,
  resolveProposalGenerationQualityMode,
  type ProposalGenerationQualityMode,
} from "../../convex/lib/proposals/proposalQualityMode";
import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import {
  prepareCoverLetterEvalArtifact,
  type CoverLetterEvalArtifact,
  type CoverLetterEvalConfigVersions,
  type CoverLetterEvalFrozenConfig,
} from "./cover-letter-eval-artifact";
import {
  CoverLetterEvalBudgetError,
  createCoverLetterEvalBudget,
  type CoverLetterEvalBudget,
  type CoverLetterEvalBudgetOptions,
} from "./cover-letter-eval-budget";
import {
  buildCoverLetterEvalFailureAttemptMetadata,
  buildCoverLetterEvalFailureReceipt,
  writeCoverLetterEvalFailureReceipt,
  type CoverLetterEvalFailureAttemptMetadata,
} from "./cover-letter-eval-failure-receipt";
import {
  evaluateCoverLetterTextWithOpenAI,
  resolveCoverLetterEvalModel,
} from "./evaluate-cover-letter";
import {
  COVER_LETTER_BLIND_REVIEW_COHORT_ID,
  coverLetterBenchmarkCases,
  coverLetterBlindReviewCases,
  type CoverLetterBenchmarkCase,
} from "./cases/cover-letter/cases";
import {
  buildCoverLetterBlindReviewArtifacts,
  writeCoverLetterBlindReviewArtifacts,
} from "./cover-letter-blind-review";
import {
  buildCoverLetterEvalRunManifestEntry,
  calculateCoverLetterEvalConservativeCallCeiling,
  resolveCoverLetterEvalInstalledSdkVersions,
  writeCoverLetterEvalRunManifest,
  type CoverLetterEvalPricedWriterModel,
  type CoverLetterEvalRunManifest,
  type CoverLetterEvalRunManifestEntry,
} from "./cover-letter-eval-run-manifest";
import {
  RECORDED_COVER_LETTER_REPLAY_FIXTURES,
  type RecordedCoverLetterReplayFixture,
} from "./fixtures/cover-letter/recorded-writer-responses";

export type CoverLetterBenchmarkCliOptions = {
  caseIds: string[] | null;
  writerModels: CoverLetterBenchmarkWriterModel[];
  evaluatorModel: string;
  evaluationMode: "llm" | "human_review_only";
  live: boolean;
  outputDirectory: string | null;
  runId: string | null;
  sourceRef: string | null;
  maxCalls: number | null;
  maxRepairs: number | null;
  maxUsd: number | null;
  declaredMaxUsdPerCall: number | null;
};

type MistralCoverLetterBenchmarkWriterModel =
  | "mistral-medium-latest"
  | "mistral-large-latest"
  | "mistral-small-latest";

export const COVER_LETTER_EVAL_ONLY_OPENAI_WRITER_MODELS = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
] as const;
type CoverLetterEvalOnlyOpenAIWriterModel =
  (typeof COVER_LETTER_EVAL_ONLY_OPENAI_WRITER_MODELS)[number];

type CoverLetterBenchmarkWriterModel =
  | PremiumCoverLetterWriterModel
  | CoverLetterEvalOnlyOpenAIWriterModel
  | MistralCoverLetterBenchmarkWriterModel;

export const QUALITY_EVAL_2B_WRITER_MODELS = [
  "gpt-5.5",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "mistral-medium-latest",
] as const satisfies readonly CoverLetterEvalPricedWriterModel[];

type BenchmarkGenerationFailureStatus =
  | "generation_failed"
  | "finalization_failed"
  | "evaluation_failed";

type ManualReviewVerdict = "unreviewed" | "pass" | "fail";

export type CoverLetterBenchmarkManualReview = {
  humanTone: ManualReviewVerdict;
  noMetaProse: ManualReviewVerdict;
  persuasiveEmployerFacingArgument: ManualReviewVerdict;
  notFactualInventory: ManualReviewVerdict;
  specificity: ManualReviewVerdict;
  grounding: ManualReviewVerdict;
  economy: ManualReviewVerdict;
  commerciallyAcceptable: ManualReviewVerdict;
  reviewerNotes: string;
};

export type CoverLetterBenchmarkDiagnostics = {
  provider: "openai" | "mistral";
  contextClass: PremiumCoverLetterAttemptResult["contextClass"] | null;
  expectedContextClass: CoverLetterBenchmarkCase["expectedContextClass"];
  validationResult:
    | "premium_validation_passed"
    | "premium_generation_failed"
    | "premium_finalization_failed"
    | "premium_evaluation_failed";
  telemetry: {
    attemptedPath: "premium path saved" | "premium generation failed";
    premium_path_saved: boolean;
    premium_validation_passed: boolean;
    premium_quality_shadow_passed: boolean | null;
  };
  qualityShadow: PremiumCoverLetterQualityShadowResult | null;
  failureStage: string | null;
  failureReason: string | null;
  failureIssues: string[];
};

export type CoverLetterBenchmarkSuccessRecord = {
  status: "ok";
  caseId: string;
  preset: CoverLetterBenchmarkCase["preset"];
  writerModel: CoverLetterBenchmarkWriterModel;
  outputLanguage: ProposalOutputLanguage;
  expectedContextClass: CoverLetterBenchmarkCase["expectedContextClass"];
  generation: PremiumCoverLetterAttemptResult;
  artifact: CoverLetterEvalArtifact;
  evaluation: CoverLetterScore;
  diagnostics: CoverLetterBenchmarkDiagnostics;
  manualReview: CoverLetterBenchmarkManualReview;
  letter: string;
  runManifest?: CoverLetterEvalRunManifestEntry;
  notes?: string;
  realismTag?: string;
};

export type CoverLetterHumanReviewRecord = {
  status: "human_review_pending";
  caseId: string;
  preset: CoverLetterBenchmarkCase["preset"];
  writerModel: CoverLetterBenchmarkWriterModel;
  outputLanguage: ProposalOutputLanguage;
  expectedContextClass: CoverLetterBenchmarkCase["expectedContextClass"];
  generation: PremiumCoverLetterAttemptResult;
  artifact: CoverLetterEvalArtifact;
  diagnostics: CoverLetterBenchmarkDiagnostics;
  manualReview: CoverLetterBenchmarkManualReview;
  letter: string;
  runManifest?: CoverLetterEvalRunManifestEntry;
  notes?: string;
  realismTag?: string;
};

export type CoverLetterBenchmarkFailureRecord = {
  status: BenchmarkGenerationFailureStatus;
  caseId: string;
  preset: CoverLetterBenchmarkCase["preset"];
  writerModel: CoverLetterBenchmarkWriterModel;
  outputLanguage: ProposalOutputLanguage;
  expectedContextClass: CoverLetterBenchmarkCase["expectedContextClass"];
  error: string;
  generation?: PremiumCoverLetterAttemptResult;
  artifact?: CoverLetterEvalArtifact;
  debug?: PremiumCoverLetterFailureTrace;
  diagnostics: CoverLetterBenchmarkDiagnostics;
  manualReview: CoverLetterBenchmarkManualReview;
  letter?: string;
  attemptMetadata?: CoverLetterEvalFailureAttemptMetadata;
  notes?: string;
  realismTag?: string;
};

export type CoverLetterBenchmarkRecord =
  | CoverLetterBenchmarkSuccessRecord
  | CoverLetterBenchmarkFailureRecord;

export type CoverLetterHumanReviewResult =
  | CoverLetterHumanReviewRecord
  | CoverLetterBenchmarkFailureRecord;

export type CoverLetterBenchmarkAggregate = {
  writerModel: CoverLetterBenchmarkWriterModel;
  totalRuns: number;
  completedRuns: number;
  averageGlobalScore: number | null;
  premiumReadyCount: number;
  rankMatchesTextPassCount: number;
  qualityShadowPassCount: number;
  hardFailReasons: Array<{ reason: string; count: number }>;
};

type GenerateBenchmarkLetter = (args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterBenchmarkWriterModel;
  apiKey: string;
  mistralApiKey?: string;
  productionInputs?: CoverLetterBenchmarkProductionInputs;
  writerOverride?: PremiumCoverLetterWriter;
  budget?: CoverLetterEvalBudget;
  signal?: AbortSignal;
  onFailure?: (failure: PremiumCoverLetterFailureTrace) => void;
  onProviderResponseMetadata?: (
    metadata: PremiumCoverLetterProviderResponseMetadata,
  ) => void;
  onWriterPrompt?: (prompt: string) => void;
}) => Promise<PremiumCoverLetterAttemptResult | null>;

type EvaluateBenchmarkLetter = (args: {
  letter: string;
  apiKey: string;
  model: string;
}) => Promise<CoverLetterScore>;

export type CoverLetterBenchmarkProductionInputs = Readonly<{
  outputLanguage: ProposalOutputLanguage;
  generationControlsBlock: string;
  companyValuesPack: CompanyValuesPack | null;
  proposalGenerationQualityMode: ProposalGenerationQualityMode;
  hasCandidateContext: boolean;
}>;

export type CoverLetterReplayResult = Readonly<{
  fixtureId: string;
  sourceCaseId: string;
  writerProvider: "openai" | "mistral";
  writerModel: string;
  writerCallCount: number;
  artifact: CoverLetterEvalArtifact;
}>;

const COVER_LETTER_EVAL_CONFIG_VERSIONS = {
  generationControls: "proposal_generation_controls_v1",
  companyValues: "company_values_pack_v1",
  writerSchema: "premium_writer_output_v1:premium_cover_letter_body_parts",
  cancellation: "production_provider_specific_abort_v1",
  finalizer: "premium_persistence_finalizer_v1",
} as const satisfies CoverLetterEvalConfigVersions;

const COVER_LETTER_EVAL_PROVIDER_MAX_RETRIES = 0;
const COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS = 2_048;

const MISTRAL_COVER_LETTER_BENCHMARK_WRITER_MODELS = [
  "mistral-medium-latest",
  "mistral-large-latest",
  "mistral-small-latest",
] as const satisfies readonly MistralCoverLetterBenchmarkWriterModel[];

const COVER_LETTER_BENCHMARK_WRITER_MODELS = [
  ...PREMIUM_COVER_LETTER_WRITER_MODELS,
  ...COVER_LETTER_EVAL_ONLY_OPENAI_WRITER_MODELS,
  ...MISTRAL_COVER_LETTER_BENCHMARK_WRITER_MODELS,
] as const satisfies readonly CoverLetterBenchmarkWriterModel[];

export function resolveDefaultCoverLetterBenchmarkWriterModels(): CoverLetterBenchmarkWriterModel[] {
  const dotenvAwareProductionModel =
    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL?.trim() ||
    process.env.OPENAI_PROPOSAL_MODEL?.trim() ||
    llmConfig.proposalModels?.openaiWriterModel;
  return [resolvePremiumCoverLetterWriterModel(dotenvAwareProductionModel)];
}

function printHelp(): void {
  console.log(
    [
      "Premium cover-letter writer benchmark",
      "",
      "Usage:",
      "  npx tsx scripts/evals/benchmark-cover-letter-writers.ts",
      "  COVER_LETTER_EVAL_LIVE=1 npx tsx scripts/evals/benchmark-cover-letter-writers.ts --live --max-calls=N --max-repairs=N --max-usd=N --max-usd-per-call=N [--cases=id1,id2] [--writers=gpt-5.5] [--evaluator=MODEL]",
      `  COVER_LETTER_EVAL_LIVE=1 npx tsx scripts/evals/benchmark-cover-letter-writers.ts --live --human-review-only --output-dir=PATH --run-id=ID --source-ref=SHA --max-calls=24 --max-repairs=0 --max-usd=N --max-usd-per-call=N --writers=${QUALITY_EVAL_2B_WRITER_MODELS.join(",")}`,
      "",
      "Examples:",
      "  npx tsx scripts/evals/benchmark-cover-letter-writers.ts",
      "  # Default: replay committed synthetic writer responses; zero provider calls.",
      "  COVER_LETTER_EVAL_LIVE=1 npx tsx scripts/evals/benchmark-cover-letter-writers.ts --live --max-calls=4 --max-repairs=0 --max-usd=0.4 --max-usd-per-call=0.1 --cases=security-hyatt --writers=gpt-5.5",
      `  # Live writer requests disable SDK retries and cap output at ${COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS} tokens. --max-usd-per-call must be a conservative worst-case reservation, not observed billing.`,
      "",
      `Available cases: ${coverLetterBenchmarkCases.map((item) => item.id).join(", ")}`,
      `Human-review cases: ${coverLetterBlindReviewCases.map((item) => item.id).join(", ")}`,
    ].join("\n"),
  );
}

function parseCsvList(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWriterModels(
  rawValue: string,
): CoverLetterBenchmarkWriterModel[] {
  const requested = parseCsvList(rawValue);
  if (requested.length === 0) {
    throw new Error("Provide at least one writer model with --writers.");
  }

  const duplicates = requested.filter(
    (item, index) => requested.indexOf(item) !== index,
  );
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate premium writer model(s): ${[...new Set(duplicates)].join(", ")}.`,
    );
  }
  const invalid = requested.filter(
    (item) =>
      !PREMIUM_COVER_LETTER_WRITER_MODELS.includes(
        item as PremiumCoverLetterWriterModel,
      ) &&
      !COVER_LETTER_EVAL_ONLY_OPENAI_WRITER_MODELS.includes(
        item as CoverLetterEvalOnlyOpenAIWriterModel,
      ) &&
      !MISTRAL_COVER_LETTER_BENCHMARK_WRITER_MODELS.includes(
        item as MistralCoverLetterBenchmarkWriterModel,
      ),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported premium writer model(s): ${invalid.join(", ")}. Supported models: ${COVER_LETTER_BENCHMARK_WRITER_MODELS.join(", ")}`,
    );
  }

  return requested as CoverLetterBenchmarkWriterModel[];
}

function hasExactQualityEval2BWriterSet(
  writerModels: readonly CoverLetterBenchmarkWriterModel[],
): boolean {
  return (
    writerModels.length === QUALITY_EVAL_2B_WRITER_MODELS.length &&
    QUALITY_EVAL_2B_WRITER_MODELS.every((writerModel) =>
      writerModels.includes(writerModel),
    )
  );
}

function parseNumericOption(args: { name: string; rawValue: string }): number {
  const value = Number(args.rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`${args.name} must be a finite number.`);
  }
  return value;
}

export function parseCoverLetterBenchmarkCliOptions(
  argv: string[],
  liveEnvValue: string | undefined = process.env.COVER_LETTER_EVAL_LIVE,
): CoverLetterBenchmarkCliOptions {
  const options: CoverLetterBenchmarkCliOptions = {
    caseIds: null,
    writerModels: resolveDefaultCoverLetterBenchmarkWriterModels(),
    evaluatorModel: resolveCoverLetterEvalModel(),
    evaluationMode: "llm",
    live: liveEnvValue?.trim() === "1",
    outputDirectory: null,
    runId: null,
    sourceRef: null,
    maxCalls: null,
    maxRepairs: null,
    maxUsd: null,
    declaredMaxUsdPerCall: null,
  };
  let writerModelsExplicitlyRequested = false;

  for (const arg of argv) {
    if (arg.startsWith("--cases=")) {
      options.caseIds = parseCsvList(arg.slice("--cases=".length));
    } else if (arg.startsWith("--writers=")) {
      options.writerModels = parseWriterModels(arg.slice("--writers=".length));
      writerModelsExplicitlyRequested = true;
    } else if (arg.startsWith("--evaluator=")) {
      options.evaluatorModel =
        arg.slice("--evaluator=".length).trim() ||
        resolveCoverLetterEvalModel();
    } else if (arg === "--human-review-only") {
      options.evaluationMode = "human_review_only";
    } else if (arg.startsWith("--output-dir=")) {
      options.outputDirectory =
        arg.slice("--output-dir=".length).trim() || null;
    } else if (arg.startsWith("--run-id=")) {
      options.runId = arg.slice("--run-id=".length).trim() || null;
    } else if (arg.startsWith("--source-ref=")) {
      options.sourceRef = arg.slice("--source-ref=".length).trim() || null;
    } else if (arg.startsWith("--max-calls=")) {
      options.maxCalls = parseNumericOption({
        name: "--max-calls",
        rawValue: arg.slice("--max-calls=".length),
      });
    } else if (arg.startsWith("--max-repairs=")) {
      options.maxRepairs = parseNumericOption({
        name: "--max-repairs",
        rawValue: arg.slice("--max-repairs=".length),
      });
    } else if (arg.startsWith("--max-usd=")) {
      options.maxUsd = parseNumericOption({
        name: "--max-usd",
        rawValue: arg.slice("--max-usd=".length),
      });
    } else if (arg.startsWith("--max-usd-per-call=")) {
      options.declaredMaxUsdPerCall = parseNumericOption({
        name: "--max-usd-per-call",
        rawValue: arg.slice("--max-usd-per-call=".length),
      });
    } else if (arg === "--live") {
      options.live = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  if (
    options.evaluationMode === "human_review_only" &&
    options.caseIds !== null
  ) {
    throw new Error(
      "Human-review-only execution does not support --cases; the complete blind-review cohort is required.",
    );
  }
  if (options.evaluationMode === "human_review_only") {
    if (!writerModelsExplicitlyRequested) {
      options.writerModels = [...QUALITY_EVAL_2B_WRITER_MODELS];
    } else if (!hasExactQualityEval2BWriterSet(options.writerModels)) {
      throw new Error(
        `Human-review-only execution requires the exact writer set: ${QUALITY_EVAL_2B_WRITER_MODELS.join(", ")}.`,
      );
    } else {
      options.writerModels = [...QUALITY_EVAL_2B_WRITER_MODELS];
    }
  }

  return options;
}

function loadEnv(workdir: string): void {
  const envFiles = [
    { filePath: path.resolve(workdir, ".env"), override: false },
    { filePath: path.resolve(workdir, ".env.local"), override: true },
  ];

  for (const envFile of envFiles) {
    if (!existsSync(envFile.filePath)) continue;
    dotenv.config({
      path: envFile.filePath,
      override: envFile.override,
    });
  }
}

export function resolveRequestedCoverLetterBenchmarkCases(
  requestedIds: string[] | null,
  availableCases: CoverLetterBenchmarkCase[] = coverLetterBenchmarkCases,
): CoverLetterBenchmarkCase[] {
  if (!requestedIds || requestedIds.length === 0) {
    return [...availableCases];
  }

  const caseMap = new Map(availableCases.map((item) => [item.id, item]));
  const missing = requestedIds.filter((id) => !caseMap.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Unknown cover-letter benchmark case ids: ${missing.join(", ")}. Available cases: ${availableCases
        .map((item) => item.id)
        .join(", ")}`,
    );
  }

  return requestedIds.map((id) => caseMap.get(id)!);
}

function formatPremiumCoverLetterFailure(
  failure: PremiumCoverLetterFailureTrace | null,
): string {
  if (!failure) {
    return "Premium cover-letter generation returned null for this benchmark run.";
  }

  const details = [
    failure.reason,
    failure.eligibilityReason,
    ...(failure.issues ?? []),
  ].filter(Boolean);

  return `Premium cover-letter generation failed at ${failure.stage}: ${details.join(", ")}.`;
}

function isMistralBenchmarkWriterModel(
  writerModel: CoverLetterBenchmarkWriterModel,
): writerModel is MistralCoverLetterBenchmarkWriterModel {
  return MISTRAL_COVER_LETTER_BENCHMARK_WRITER_MODELS.includes(
    writerModel as MistralCoverLetterBenchmarkWriterModel,
  );
}

function isCoverLetterEvalOnlyOpenAIWriterModel(
  writerModel: CoverLetterBenchmarkWriterModel,
): writerModel is CoverLetterEvalOnlyOpenAIWriterModel {
  return COVER_LETTER_EVAL_ONLY_OPENAI_WRITER_MODELS.includes(
    writerModel as CoverLetterEvalOnlyOpenAIWriterModel,
  );
}

function isQualityEval2BWriterModel(
  writerModel: CoverLetterBenchmarkWriterModel,
): writerModel is CoverLetterEvalPricedWriterModel {
  return QUALITY_EVAL_2B_WRITER_MODELS.includes(
    writerModel as CoverLetterEvalPricedWriterModel,
  );
}

export function coverLetterBenchmarkRequiresOpenAIKey(args: {
  evaluationMode: CoverLetterBenchmarkCliOptions["evaluationMode"];
  writerModels: readonly CoverLetterBenchmarkWriterModel[];
}): boolean {
  return (
    args.evaluationMode === "llm" ||
    args.writerModels.some(
      (writerModel) => !isMistralBenchmarkWriterModel(writerModel),
    )
  );
}

function resolveBenchmarkWriterProvider(
  writerModel: CoverLetterBenchmarkWriterModel,
): CoverLetterBenchmarkDiagnostics["provider"] {
  return isMistralBenchmarkWriterModel(writerModel) ? "mistral" : "openai";
}

export function resolveCoverLetterBenchmarkAttemptSignal(
  provider: CoverLetterBenchmarkDiagnostics["provider"],
  signal?: AbortSignal,
): AbortSignal | undefined {
  return provider === "mistral" ? signal : undefined;
}

export function resolveCoverLetterBenchmarkProviderSignal(args: {
  provider: CoverLetterBenchmarkDiagnostics["provider"];
  configuredSignal?: AbortSignal;
  callbackSignal?: AbortSignal;
}): AbortSignal | undefined {
  return args.provider === "openai"
    ? args.configuredSignal
    : args.callbackSignal;
}

function createEmptyManualReview(): CoverLetterBenchmarkManualReview {
  return {
    humanTone: "unreviewed",
    noMetaProse: "unreviewed",
    persuasiveEmployerFacingArgument: "unreviewed",
    notFactualInventory: "unreviewed",
    specificity: "unreviewed",
    grounding: "unreviewed",
    economy: "unreviewed",
    commerciallyAcceptable: "unreviewed",
    reviewerNotes: "",
  };
}

function getGenerationQualityShadow(
  generation: PremiumCoverLetterAttemptResult | null | undefined,
): PremiumCoverLetterQualityShadowResult | null {
  return generation?.qualityShadow ?? null;
}

function buildBenchmarkDiagnostics(args: {
  writerModel: CoverLetterBenchmarkWriterModel;
  expectedContextClass: CoverLetterBenchmarkCase["expectedContextClass"];
  generation?: PremiumCoverLetterAttemptResult | null;
  failureTrace?: PremiumCoverLetterFailureTrace | null;
  failureStage?: string | null;
  failureReason?: string | null;
  failureIssues?: string[];
  validationResult: CoverLetterBenchmarkDiagnostics["validationResult"];
}): CoverLetterBenchmarkDiagnostics {
  const qualityShadow = getGenerationQualityShadow(args.generation);
  const premiumSaved =
    args.validationResult === "premium_validation_passed" ||
    args.validationResult === "premium_evaluation_failed";

  return {
    provider: resolveBenchmarkWriterProvider(args.writerModel),
    contextClass: args.generation?.contextClass ?? null,
    expectedContextClass: args.expectedContextClass,
    validationResult: args.validationResult,
    telemetry: {
      attemptedPath: premiumSaved
        ? "premium path saved"
        : "premium generation failed",
      premium_path_saved: premiumSaved,
      premium_validation_passed: premiumSaved,
      premium_quality_shadow_passed: qualityShadow?.passed ?? null,
    },
    qualityShadow,
    failureStage: args.failureStage ?? args.failureTrace?.stage ?? null,
    failureReason: args.failureReason ?? args.failureTrace?.reason ?? null,
    failureIssues: args.failureIssues ?? args.failureTrace?.issues ?? [],
  };
}

export function resolveCoverLetterBenchmarkProductionInputs(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  outputLanguage?: ProposalOutputLanguage;
}): CoverLetterBenchmarkProductionInputs {
  const proposalGenerationQualityMode = resolveProposalGenerationQualityMode();
  return {
    outputLanguage:
      args.outputLanguage ??
      args.benchmarkCase.reviewMetadata?.requestedOutputLanguage ??
      resolveProposalOutputLanguage(args.benchmarkCase.jobDescription),
    generationControlsBlock: buildProposalGenerationControlsBlock({}),
    companyValuesPack: isProposalGenerationQualityLiveMode(
      proposalGenerationQualityMode,
    )
      ? analyzeCompanyValues(args.benchmarkCase.jobDescription)
      : null,
    proposalGenerationQualityMode,
    hasCandidateContext: args.benchmarkCase.personalizationContext !== null,
  };
}

async function buildCoverLetterEvalFrozenConfig(args: {
  writerModel: CoverLetterBenchmarkWriterModel;
  benchmarkCase: CoverLetterBenchmarkCase;
  productionInputs: CoverLetterBenchmarkProductionInputs;
}): Promise<CoverLetterEvalFrozenConfig> {
  const provider = resolveBenchmarkWriterProvider(args.writerModel);
  return {
    provider,
    model: args.writerModel,
    outputLanguage: args.productionInputs.outputLanguage,
    preset: args.benchmarkCase.preset,
    proposalQualityMode: args.productionInputs.proposalGenerationQualityMode,
    hasCandidateContext: args.productionInputs.hasCandidateContext,
    providerMaxRetries: COVER_LETTER_EVAL_PROVIDER_MAX_RETRIES,
    writerMaxOutputTokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
    promptV2: provider === "mistral" && isCoverLetterPremiumPromptV2Enabled(),
    qualityRepair: isCoverLetterQualityRepairV1Enabled(),
    reasoningEffort: resolveOpenAIProposalReasoningEffort(),
    generationControlsHash: await buildStableHash({
      namespace: "cover-letter-eval-config",
      type: "generation-controls",
      version: 1,
      value: args.productionInputs.generationControlsBlock,
    }),
    companyValuesHash: await buildStableHash({
      namespace: "cover-letter-eval-config",
      type: "company-values",
      version: 1,
      value: args.productionInputs.companyValuesPack,
    }),
    writerSchemaHash: await buildStableHash({
      namespace: "cover-letter-eval-config",
      type: "writer-schema",
      version: 2,
      value: {
        writerOutput: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
        bodyPartsRepair: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
      },
    }),
  };
}

export async function generatePremiumCoverLetterBenchmarkLetter(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterBenchmarkWriterModel;
  apiKey: string;
  mistralApiKey?: string;
  productionInputs?: CoverLetterBenchmarkProductionInputs;
  writerOverride?: PremiumCoverLetterWriter;
  budget?: CoverLetterEvalBudget;
  signal?: AbortSignal;
  onFailure?: (failure: PremiumCoverLetterFailureTrace) => void;
  onProviderResponseMetadata?: (
    metadata: PremiumCoverLetterProviderResponseMetadata,
  ) => void;
  onWriterPrompt?: (prompt: string) => void;
}): Promise<PremiumCoverLetterAttemptResult | null> {
  const writerProvider = isMistralBenchmarkWriterModel(args.writerModel)
    ? "mistral"
    : "openai";
  const productionInputs =
    args.productionInputs ??
    resolveCoverLetterBenchmarkProductionInputs({
      benchmarkCase: args.benchmarkCase,
    });
  if (!args.writerOverride && !args.budget) {
    throw new Error(
      "Live cover-letter writer execution requires an explicit evaluation budget.",
    );
  }
  const writerAttemptBudget = args.budget?.beginWriterAttempt();
  const attemptSignal = resolveCoverLetterBenchmarkAttemptSignal(
    writerProvider,
    args.signal,
  );

  return attemptPremiumCoverLetterGeneration({
    personalizationContext: args.benchmarkCase.personalizationContext,
    voicePreset: args.benchmarkCase.preset,
    outputLanguage: productionInputs.outputLanguage,
    jobTitle: args.benchmarkCase.jobTitle,
    jobDescription: args.benchmarkCase.jobDescription,
    candidateName: args.benchmarkCase.personalizationContext.name,
    generationControlsBlock: productionInputs.generationControlsBlock,
    companyValuesPack: productionInputs.companyValuesPack ?? undefined,
    onFailure: args.onFailure,
    writerProvider,
    writerModel: args.writerModel,
    signal: attemptSignal,
    writer: async ({ prompt, schema, signal: callbackSignal }) => {
      args.onWriterPrompt?.(prompt);
      const providerSignal = resolveCoverLetterBenchmarkProviderSignal({
        provider: writerProvider,
        configuredSignal: args.signal,
        callbackSignal,
      });
      if (args.writerOverride) {
        return args.writerOverride({
          prompt,
          schema,
          signal: providerSignal,
        });
      }

      const invokeProvider = async () => {
        if (isMistralBenchmarkWriterModel(args.writerModel)) {
          if (!args.mistralApiKey) {
            throw new Error(
              "MISTRAL_API_KEY is required for Mistral cover-letter benchmark writers.",
            );
          }
          return generatePremiumCoverLetterBodyPartsWithMistral({
            apiKey: args.mistralApiKey,
            prompt,
            writerModel: args.writerModel,
            signal: providerSignal,
            maxRetries: COVER_LETTER_EVAL_PROVIDER_MAX_RETRIES,
            maxOutputTokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
            onResponseMetadata: args.onProviderResponseMetadata,
          });
        }

        const openAIArgs = {
          apiKey: args.apiKey,
          prompt,
          writerModel: args.writerModel,
          schema,
          signal: providerSignal,
          maxRetries: COVER_LETTER_EVAL_PROVIDER_MAX_RETRIES,
          maxOutputTokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
          onResponseMetadata: args.onProviderResponseMetadata,
        } as const;
        return isCoverLetterEvalOnlyOpenAIWriterModel(args.writerModel)
          ? generatePremiumCoverLetterBodyPartsWithExactOpenAIModel(openAIArgs)
          : generatePremiumCoverLetterBodyPartsWithOpenAI({
              ...openAIArgs,
              writerModel: args.writerModel,
            });
      };

      if (writerAttemptBudget) {
        return writerAttemptBudget.runProviderCall(invokeProvider);
      }
      return invokeProvider();
    },
  });
}

function resolveRecordedWriterSchemaId(
  schema: Record<string, unknown>,
): "premium_writer_output_v1" | "premium_cover_letter_body_parts" | null {
  if (schema === PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA) {
    return "premium_writer_output_v1";
  }
  if (schema === PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA) {
    return "premium_cover_letter_body_parts";
  }
  return null;
}

function assertReplayFixtureMatchesFrozenProductionConfig(args: {
  fixture: RecordedCoverLetterReplayFixture;
  productionInputs: CoverLetterBenchmarkProductionInputs;
}): void {
  const expected = args.fixture.frozenConfig;
  const actualPromptV2 =
    args.fixture.writerProvider === "mistral" &&
    isCoverLetterPremiumPromptV2Enabled();
  const actualQualityRepair = isCoverLetterQualityRepairV1Enabled();
  const actualReasoningEffort = resolveOpenAIProposalReasoningEffort();
  const mismatches = [
    args.productionInputs.outputLanguage === expected.outputLanguage
      ? null
      : "outputLanguage",
    args.productionInputs.generationControlsBlock ===
    expected.generationControlsBlock
      ? null
      : "generationControlsBlock",
    isDeepStrictEqual(
      args.productionInputs.companyValuesPack ?? null,
      expected.companyValuesPack,
    )
      ? null
      : "companyValuesPack",
    args.productionInputs.proposalGenerationQualityMode ===
    expected.proposalGenerationQualityMode
      ? null
      : "proposalGenerationQualityMode",
    args.productionInputs.hasCandidateContext === expected.hasCandidateContext
      ? null
      : "hasCandidateContext",
    COVER_LETTER_EVAL_PROVIDER_MAX_RETRIES === expected.providerMaxRetries
      ? null
      : "providerMaxRetries",
    COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS ===
    expected.writerMaxOutputTokens
      ? null
      : "writerMaxOutputTokens",
    actualPromptV2 === expected.premiumPromptV2Enabled
      ? null
      : "premiumPromptV2Enabled",
    actualQualityRepair === expected.qualityRepairV1Enabled
      ? null
      : "qualityRepairV1Enabled",
    actualReasoningEffort === expected.openAIWriterReasoningEffort
      ? null
      : "openAIWriterReasoningEffort",
    COVER_LETTER_EVAL_CONFIG_VERSIONS.writerSchema ===
    expected.writerSchemaVersion
      ? null
      : "writerSchemaVersion",
  ].filter((value): value is string => Boolean(value));

  if (mismatches.length > 0) {
    throw new Error(
      `Recorded cover-letter replay fixture ${args.fixture.id} has configuration drift: ${mismatches.join(", ")}.`,
    );
  }
}

export async function replayRecordedCoverLetterFixture(
  fixture: RecordedCoverLetterReplayFixture,
): Promise<CoverLetterReplayResult> {
  const benchmarkCase = coverLetterBenchmarkCases.find(
    (item) => item.id === fixture.sourceCaseId,
  );
  if (!benchmarkCase) {
    throw new Error(
      `Recorded cover-letter replay fixture ${fixture.id} references unknown case ${fixture.sourceCaseId}.`,
    );
  }
  if (
    !COVER_LETTER_BENCHMARK_WRITER_MODELS.includes(
      fixture.writerModel as CoverLetterBenchmarkWriterModel,
    )
  ) {
    throw new Error(
      `Recorded cover-letter replay fixture ${fixture.id} uses unsupported writer ${fixture.writerModel}.`,
    );
  }
  const writerModel = fixture.writerModel as CoverLetterBenchmarkWriterModel;
  if (resolveBenchmarkWriterProvider(writerModel) !== fixture.writerProvider) {
    throw new Error(
      `Recorded cover-letter replay fixture ${fixture.id} has a provider/model mismatch.`,
    );
  }

  const productionInputs = resolveCoverLetterBenchmarkProductionInputs({
    benchmarkCase,
  });
  assertReplayFixtureMatchesFrozenProductionConfig({
    fixture,
    productionInputs,
  });

  let writerCallCount = 0;
  const writerOverride: PremiumCoverLetterWriter = async ({
    prompt,
    schema,
  }) => {
    const recorded = fixture.responses[writerCallCount];
    if (!recorded) {
      throw new Error(
        `Recorded cover-letter replay fixture ${fixture.id} has no response for writer call ${writerCallCount + 1}.`,
      );
    }
    const actualSchemaId = resolveRecordedWriterSchemaId(schema);
    if (actualSchemaId !== recorded.schemaId) {
      throw new Error(
        `Recorded cover-letter replay fixture ${fixture.id} expected schema ${recorded.schemaId} but received ${actualSchemaId ?? "unknown"}.`,
      );
    }
    const actualPromptHash = await buildStableHash({
      namespace: "cover-letter-eval-writer-prompt",
      type: "production-writer-prompt",
      version: 1,
      prompt,
    });
    if (actualPromptHash !== recorded.expectedWriterPromptHash) {
      throw new Error(
        `Recorded cover-letter replay fixture ${fixture.id} writer prompt drift on call ${writerCallCount + 1}: expected ${recorded.expectedWriterPromptHash}, received ${actualPromptHash}.`,
      );
    }
    writerCallCount += 1;
    return structuredClone(recorded.payload);
  };

  let failureTrace: PremiumCoverLetterFailureTrace | null = null;
  const generation = await generatePremiumCoverLetterBenchmarkLetter({
    benchmarkCase,
    writerModel,
    apiKey: "replay-does-not-use-provider-credentials",
    productionInputs,
    writerOverride,
    budget: createCoverLetterEvalBudget({
      explicitLiveProviderOptIn: false,
      maxCalls: 1,
      maxRepairs: 0,
      maxUsd: 1,
      declaredMaxUsdPerCall: 1,
    }),
    onFailure: (failure) => {
      failureTrace = failure;
    },
  });
  if (!generation) {
    throw new Error(
      `Recorded cover-letter replay fixture ${fixture.id} failed generation: ${formatPremiumCoverLetterFailure(failureTrace)}.`,
    );
  }
  if (writerCallCount !== fixture.responses.length) {
    throw new Error(
      `Recorded cover-letter replay fixture ${fixture.id} consumed ${writerCallCount}/${fixture.responses.length} responses.`,
    );
  }

  const prepared = await prepareCoverLetterEvalArtifact({
    caseId: benchmarkCase.id,
    payload: generation,
    outputLanguage: productionInputs.outputLanguage,
    candidateName: benchmarkCase.personalizationContext.name,
    voicePreset: benchmarkCase.preset,
    hasCandidateContext: productionInputs.hasCandidateContext,
    configVersions: COVER_LETTER_EVAL_CONFIG_VERSIONS,
    frozenConfig: await buildCoverLetterEvalFrozenConfig({
      writerModel,
      benchmarkCase,
      productionInputs,
    }),
  });
  if (!prepared.finalizedPayload) {
    throw new Error(
      `Recorded cover-letter replay fixture ${fixture.id} was rejected by production finalization (${prepared.artifact.diagnostics.finalization.errorClass}).`,
    );
  }
  if (prepared.artifact.artifactHash !== fixture.expectedArtifactHash) {
    throw new Error(
      `Recorded cover-letter replay fixture ${fixture.id} changed artifact hash: expected ${fixture.expectedArtifactHash}, received ${prepared.artifact.artifactHash}.`,
    );
  }
  if (prepared.artifact.provenanceHash !== fixture.expectedProvenanceHash) {
    throw new Error(
      `Recorded cover-letter replay fixture ${fixture.id} changed provenance hash: expected ${fixture.expectedProvenanceHash}, received ${prepared.artifact.provenanceHash ?? "null"}.`,
    );
  }

  return {
    fixtureId: fixture.id,
    sourceCaseId: fixture.sourceCaseId,
    writerProvider: fixture.writerProvider,
    writerModel: fixture.writerModel,
    writerCallCount,
    artifact: prepared.artifact,
  };
}

export async function replayRecordedCoverLetterFixtures(): Promise<
  CoverLetterReplayResult[]
> {
  const results: CoverLetterReplayResult[] = [];
  for (const fixture of RECORDED_COVER_LETTER_REPLAY_FIXTURES) {
    results.push(await replayRecordedCoverLetterFixture(fixture));
  }
  return results;
}

type PrepareCoverLetterBenchmarkCaseArgs = {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterBenchmarkWriterModel;
  apiKey: string;
  mistralApiKey?: string;
  productionInputs?: CoverLetterBenchmarkProductionInputs;
  budget?: CoverLetterEvalBudget;
  signal?: AbortSignal;
  generateLetter?: GenerateBenchmarkLetter;
};

type PreparedCoverLetterBenchmarkCase = {
  status: "prepared";
  outputLanguage: ProposalOutputLanguage;
  generation: PremiumCoverLetterAttemptResult;
  artifact: CoverLetterEvalArtifact;
  diagnostics: CoverLetterBenchmarkDiagnostics;
  runManifest?: CoverLetterEvalRunManifestEntry;
};

async function buildBenchmarkRunManifestEntry(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterBenchmarkWriterModel;
  generation: PremiumCoverLetterAttemptResult;
  artifact: CoverLetterEvalArtifact;
  providerResponseMetadata: PremiumCoverLetterProviderResponseMetadata | null;
}): Promise<CoverLetterEvalRunManifestEntry | undefined> {
  if (!isQualityEval2BWriterModel(args.writerModel)) return undefined;
  const provider = resolveBenchmarkWriterProvider(args.writerModel);
  return buildCoverLetterEvalRunManifestEntry({
    caseId: args.benchmarkCase.id,
    provider,
    requestedModel: args.writerModel,
    returnedModel: args.providerResponseMetadata?.returnedModel ?? null,
    prompt: args.generation.prompt,
    reasoningEffort:
      provider === "openai" ? resolveOpenAIProposalReasoningEffort() : null,
    writerMaxOutputTokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
    providerMaxRetries: COVER_LETTER_EVAL_PROVIDER_MAX_RETRIES,
    tokenUsage: args.providerResponseMetadata?.tokenUsage ?? null,
    sdkVersions: await resolveCoverLetterEvalInstalledSdkVersions(),
    artifactHash: args.artifact.artifactHash,
    provenanceHash: args.artifact.provenanceHash,
  });
}

async function buildBenchmarkFailureAttemptMetadata(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterBenchmarkWriterModel;
  prompt: string | null;
  artifact: CoverLetterEvalArtifact | null;
  providerResponseMetadata: PremiumCoverLetterProviderResponseMetadata | null;
}): Promise<CoverLetterEvalFailureAttemptMetadata | undefined> {
  if (
    !isQualityEval2BWriterModel(args.writerModel) ||
    (args.prompt === null && args.providerResponseMetadata === null)
  ) {
    return undefined;
  }
  const provider = resolveBenchmarkWriterProvider(args.writerModel);
  try {
    return await buildCoverLetterEvalFailureAttemptMetadata({
      caseId: args.benchmarkCase.id,
      provider,
      requestedModel: args.writerModel,
      returnedModel: args.providerResponseMetadata?.returnedModel ?? null,
      prompt: args.prompt,
      reasoningEffort:
        provider === "openai" ? resolveOpenAIProposalReasoningEffort() : null,
      writerMaxOutputTokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
      providerMaxRetries: COVER_LETTER_EVAL_PROVIDER_MAX_RETRIES,
      tokenUsage: args.providerResponseMetadata?.tokenUsage ?? null,
      sdkVersions: await resolveCoverLetterEvalInstalledSdkVersions(),
      artifactHash: args.artifact?.artifactHash ?? null,
      provenanceHash: args.artifact?.provenanceHash ?? null,
    });
  } catch {
    return undefined;
  }
}

async function prepareCoverLetterBenchmarkCase(
  args: PrepareCoverLetterBenchmarkCaseArgs,
): Promise<
  PreparedCoverLetterBenchmarkCase | CoverLetterBenchmarkFailureRecord
> {
  const productionInputs =
    args.productionInputs ??
    resolveCoverLetterBenchmarkProductionInputs({
      benchmarkCase: args.benchmarkCase,
    });
  const outputLanguage = productionInputs.outputLanguage;
  let failureTrace: PremiumCoverLetterFailureTrace | null = null;
  let providerResponseMetadata: PremiumCoverLetterProviderResponseMetadata | null =
    null;
  let writerPrompt: string | null = null;
  const generateLetter =
    args.generateLetter ?? generatePremiumCoverLetterBenchmarkLetter;

  try {
    const generation = await generateLetter({
      benchmarkCase: args.benchmarkCase,
      writerModel: args.writerModel,
      apiKey: args.apiKey,
      mistralApiKey: args.mistralApiKey,
      productionInputs,
      budget: args.budget,
      signal: args.signal,
      onFailure: (failure) => {
        failureTrace = failure;
      },
      onProviderResponseMetadata: (metadata) => {
        providerResponseMetadata = metadata;
      },
      onWriterPrompt: (prompt) => {
        writerPrompt = prompt;
      },
    });
    if (!generation) {
      const attemptMetadata = await buildBenchmarkFailureAttemptMetadata({
        benchmarkCase: args.benchmarkCase,
        writerModel: args.writerModel,
        prompt: writerPrompt,
        artifact: null,
        providerResponseMetadata,
      });
      return {
        status: "generation_failed",
        caseId: args.benchmarkCase.id,
        preset: args.benchmarkCase.preset,
        writerModel: args.writerModel,
        outputLanguage,
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        error: formatPremiumCoverLetterFailure(failureTrace),
        ...(failureTrace ? { debug: failureTrace } : {}),
        diagnostics: buildBenchmarkDiagnostics({
          writerModel: args.writerModel,
          expectedContextClass: args.benchmarkCase.expectedContextClass,
          generation: null,
          failureTrace,
          validationResult: "premium_generation_failed",
        }),
        manualReview: createEmptyManualReview(),
        ...(attemptMetadata ? { attemptMetadata } : {}),
        notes: args.benchmarkCase.notes,
        realismTag: args.benchmarkCase.realismTag,
      };
    }

    const preparedArtifact = await prepareCoverLetterEvalArtifact({
      caseId: args.benchmarkCase.id,
      payload: generation,
      outputLanguage,
      candidateName: args.benchmarkCase.personalizationContext.name,
      voicePreset: args.benchmarkCase.preset,
      hasCandidateContext: productionInputs.hasCandidateContext,
      configVersions: COVER_LETTER_EVAL_CONFIG_VERSIONS,
      frozenConfig: await buildCoverLetterEvalFrozenConfig({
        writerModel: args.writerModel,
        benchmarkCase: args.benchmarkCase,
        productionInputs,
      }),
    });
    if (!preparedArtifact.finalizedPayload) {
      const finalization = preparedArtifact.artifact.diagnostics.finalization;
      const attemptMetadata = await buildBenchmarkFailureAttemptMetadata({
        benchmarkCase: args.benchmarkCase,
        writerModel: args.writerModel,
        prompt: generation.prompt,
        artifact: preparedArtifact.artifact,
        providerResponseMetadata,
      });
      return {
        status: "finalization_failed",
        caseId: args.benchmarkCase.id,
        preset: args.benchmarkCase.preset,
        writerModel: args.writerModel,
        outputLanguage,
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        generation,
        artifact: preparedArtifact.artifact,
        error: `Production cover-letter finalization rejected the generated artifact (${finalization.errorClass}).`,
        diagnostics: buildBenchmarkDiagnostics({
          writerModel: args.writerModel,
          expectedContextClass: args.benchmarkCase.expectedContextClass,
          generation,
          validationResult: "premium_finalization_failed",
          failureStage: finalization.failureStage ?? "finalization",
          failureReason: finalization.errorClass,
        }),
        manualReview: createEmptyManualReview(),
        ...(attemptMetadata ? { attemptMetadata } : {}),
        notes: args.benchmarkCase.notes,
        realismTag: args.benchmarkCase.realismTag,
      };
    }
    const finalizedGeneration: PremiumCoverLetterAttemptResult = {
      ...generation,
      ...preparedArtifact.finalizedPayload,
    };
    const runManifest = await buildBenchmarkRunManifestEntry({
      benchmarkCase: args.benchmarkCase,
      writerModel: args.writerModel,
      generation,
      artifact: preparedArtifact.artifact,
      providerResponseMetadata,
    });
    return {
      status: "prepared",
      outputLanguage,
      generation: finalizedGeneration,
      artifact: preparedArtifact.artifact,
      diagnostics: buildBenchmarkDiagnostics({
        writerModel: args.writerModel,
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        generation: finalizedGeneration,
        validationResult: "premium_validation_passed",
      }),
      ...(runManifest ? { runManifest } : {}),
    };
  } catch (error) {
    if (error instanceof CoverLetterEvalBudgetError) {
      throw error;
    }
    const attemptMetadata = await buildBenchmarkFailureAttemptMetadata({
      benchmarkCase: args.benchmarkCase,
      writerModel: args.writerModel,
      prompt: writerPrompt,
      artifact: null,
      providerResponseMetadata,
    });
    return {
      status: "generation_failed",
      caseId: args.benchmarkCase.id,
      preset: args.benchmarkCase.preset,
      writerModel: args.writerModel,
      outputLanguage,
      expectedContextClass: args.benchmarkCase.expectedContextClass,
      error: error instanceof Error ? error.message : String(error),
      ...(failureTrace ? { debug: failureTrace } : {}),
      diagnostics: buildBenchmarkDiagnostics({
        writerModel: args.writerModel,
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        generation: null,
        failureTrace,
        validationResult: "premium_generation_failed",
      }),
      manualReview: createEmptyManualReview(),
      ...(attemptMetadata ? { attemptMetadata } : {}),
      notes: args.benchmarkCase.notes,
      realismTag: args.benchmarkCase.realismTag,
    };
  }
}

export async function benchmarkCoverLetterCase(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterBenchmarkWriterModel;
  evaluatorModel: string;
  apiKey: string;
  mistralApiKey?: string;
  productionInputs?: CoverLetterBenchmarkProductionInputs;
  budget?: CoverLetterEvalBudget;
  signal?: AbortSignal;
  generateLetter?: GenerateBenchmarkLetter;
  evaluateLetter?: EvaluateBenchmarkLetter;
}): Promise<CoverLetterBenchmarkRecord> {
  if ((!args.generateLetter || !args.evaluateLetter) && !args.budget) {
    throw new Error(
      "Default live cover-letter writer and evaluator callbacks require an explicit evaluation budget.",
    );
  }
  const prepared = await prepareCoverLetterBenchmarkCase(args);
  if (prepared.status !== "prepared") {
    return prepared;
  }
  const evaluateLetter =
    args.evaluateLetter ??
    (async ({ letter, apiKey, model }) =>
      evaluateCoverLetterTextWithOpenAI({
        letter,
        apiKey,
        model,
      }));

  try {
    const evaluateFinalizedArtifact = () =>
      evaluateLetter({
        letter: prepared.generation.content,
        apiKey: args.apiKey,
        model: args.evaluatorModel,
      });
    const evaluation = args.budget
      ? await args.budget
          .beginWriterAttempt()
          .runProviderCall(evaluateFinalizedArtifact)
      : await evaluateFinalizedArtifact();
    return {
      status: "ok",
      caseId: args.benchmarkCase.id,
      preset: args.benchmarkCase.preset,
      writerModel: args.writerModel,
      outputLanguage: prepared.outputLanguage,
      expectedContextClass: args.benchmarkCase.expectedContextClass,
      generation: prepared.generation,
      artifact: prepared.artifact,
      evaluation,
      diagnostics: prepared.diagnostics,
      manualReview: createEmptyManualReview(),
      letter: prepared.generation.content,
      ...(prepared.runManifest ? { runManifest: prepared.runManifest } : {}),
      notes: args.benchmarkCase.notes,
      realismTag: args.benchmarkCase.realismTag,
    };
  } catch (error) {
    if (error instanceof CoverLetterEvalBudgetError) {
      throw error;
    }
    return {
      status: "evaluation_failed",
      caseId: args.benchmarkCase.id,
      preset: args.benchmarkCase.preset,
      writerModel: args.writerModel,
      outputLanguage: prepared.outputLanguage,
      expectedContextClass: args.benchmarkCase.expectedContextClass,
      generation: prepared.generation,
      artifact: prepared.artifact,
      error: error instanceof Error ? error.message : String(error),
      diagnostics: buildBenchmarkDiagnostics({
        writerModel: args.writerModel,
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        generation: prepared.generation,
        validationResult: "premium_evaluation_failed",
      }),
      manualReview: createEmptyManualReview(),
      letter: prepared.generation.content,
      notes: args.benchmarkCase.notes,
      realismTag: args.benchmarkCase.realismTag,
    };
  }
}

export async function benchmarkCoverLetterCaseForHumanReview(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterBenchmarkWriterModel;
  apiKey: string;
  mistralApiKey?: string;
  productionInputs?: CoverLetterBenchmarkProductionInputs;
  budget?: CoverLetterEvalBudget;
  signal?: AbortSignal;
  generateLetter?: GenerateBenchmarkLetter;
  evaluateLetter?: EvaluateBenchmarkLetter;
}): Promise<CoverLetterHumanReviewResult> {
  if (!args.generateLetter && !args.budget) {
    throw new Error(
      "The default live cover-letter writer callback requires an explicit evaluation budget.",
    );
  }
  const prepared = await prepareCoverLetterBenchmarkCase(args);
  if (prepared.status !== "prepared") {
    return prepared;
  }
  return {
    status: "human_review_pending",
    caseId: args.benchmarkCase.id,
    preset: args.benchmarkCase.preset,
    writerModel: args.writerModel,
    outputLanguage: prepared.outputLanguage,
    expectedContextClass: args.benchmarkCase.expectedContextClass,
    generation: prepared.generation,
    artifact: prepared.artifact,
    diagnostics: prepared.diagnostics,
    manualReview: createEmptyManualReview(),
    letter: prepared.generation.content,
    ...(prepared.runManifest ? { runManifest: prepared.runManifest } : {}),
    notes: args.benchmarkCase.notes,
    realismTag: args.benchmarkCase.realismTag,
  };
}

export function aggregateCoverLetterBenchmarkRecords(
  records: CoverLetterBenchmarkRecord[],
  writerModels: CoverLetterBenchmarkWriterModel[],
): CoverLetterBenchmarkAggregate[] {
  return writerModels.map((writerModel) => {
    const writerRecords = records.filter(
      (record) => record.writerModel === writerModel,
    );
    const completed = writerRecords.filter(
      (record): record is CoverLetterBenchmarkSuccessRecord =>
        record.status === "ok",
    );
    const averageGlobalScore =
      completed.length > 0
        ? Number(
            (
              completed.reduce(
                (sum, record) => sum + record.evaluation.globalScore,
                0,
              ) / completed.length
            ).toFixed(2),
          )
        : null;

    const hardFailReasonCounts = new Map<string, number>();
    for (const record of completed) {
      for (const reason of record.evaluation.gating.hardFailReasons) {
        hardFailReasonCounts.set(
          reason,
          (hardFailReasonCounts.get(reason) ?? 0) + 1,
        );
      }
    }

    return {
      writerModel,
      totalRuns: writerRecords.length,
      completedRuns: completed.length,
      averageGlobalScore,
      premiumReadyCount: completed.filter(
        (record) => record.evaluation.gating.premiumReady,
      ).length,
      rankMatchesTextPassCount: completed.filter(
        (record) => record.evaluation.rankMatchesText,
      ).length,
      qualityShadowPassCount: completed.filter(
        (record) =>
          record.diagnostics.telemetry.premium_quality_shadow_passed === true,
      ).length,
      hardFailReasons: Array.from(hardFailReasonCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([reason, count]) => ({ reason, count })),
    };
  });
}

function formatScoreSummary(score: CoverLetterScore["score"]): string {
  return [
    `relevance=${score.relevance}`,
    `credibility=${score.credibility}`,
    `persuasion=${score.persuasion}`,
    `structure=${score.structure}`,
    `substance=${score.substance}`,
    `tone=${score.tone}`,
    `grounding=${score.grounding}`,
  ].join(" ");
}

function printRecord(record: CoverLetterBenchmarkRecord): void {
  console.log(
    [
      `writer=${record.writerModel}`,
      `status=${record.status}`,
      `preset=${record.preset}`,
      `expectedContextClass=${record.expectedContextClass}`,
      `outputLanguage=${record.outputLanguage}`,
      `provider=${record.diagnostics.provider}`,
      `validationResult=${record.diagnostics.validationResult}`,
      `premium_path_saved=${record.diagnostics.telemetry.premium_path_saved}`,
      `premium_validation_passed=${record.diagnostics.telemetry.premium_validation_passed}`,
      `premium_quality_shadow_passed=${record.diagnostics.telemetry.premium_quality_shadow_passed ?? "n/a"}`,
      ...(record.notes ? [`notes=${record.notes}`] : []),
      ...(record.realismTag ? [`realismTag=${record.realismTag}`] : []),
    ].join(" | "),
  );

  if (record.status !== "ok") {
    console.log(`error=${record.error}`);
    console.log(`diagnostics=${JSON.stringify(record.diagnostics)}`);
    if (record.debug) {
      console.log(`debug=${JSON.stringify(record.debug)}`);
    }
    if (record.letter) {
      console.log("generatedLetter:");
      console.log(record.letter);
    }
    console.log("manualReview:");
    console.log(JSON.stringify(record.manualReview, null, 2));
    return;
  }

  console.log(
    [
      `contextClass=${record.generation.contextClass}`,
      `mode=${record.generation.mode}`,
      `globalScore=${record.evaluation.globalScore}`,
      `premiumReady=${record.evaluation.gating.premiumReady}`,
      `rankMatchesText=${record.evaluation.rankMatchesText}`,
    ].join(" | "),
  );
  console.log(`scoreSummary=${formatScoreSummary(record.evaluation.score)}`);
  console.log(
    `hardFailReasons=${
      record.evaluation.gating.hardFailReasons.length > 0
        ? record.evaluation.gating.hardFailReasons.join(", ")
        : "none"
    }`,
  );
  console.log("diagnostics:");
  console.log(JSON.stringify(record.diagnostics, null, 2));
  console.log("evaluation:");
  console.log(JSON.stringify(record.evaluation, null, 2));
  console.log("manualReview:");
  console.log(JSON.stringify(record.manualReview, null, 2));
  console.log("generatedLetter:");
  console.log(record.letter);
}

function printBenchmarkReport(args: {
  cases: CoverLetterBenchmarkCase[];
  records: CoverLetterBenchmarkRecord[];
  writerModels: CoverLetterBenchmarkWriterModel[];
}): void {
  for (const benchmarkCase of args.cases) {
    console.log("");
    console.log(
      `=== Case ${benchmarkCase.id} (${benchmarkCase.preset}, expected=${benchmarkCase.expectedContextClass}) ===`,
    );
    console.log(`Job title: ${benchmarkCase.jobTitle}`);
    if (benchmarkCase.notes) {
      console.log(`Notes: ${benchmarkCase.notes}`);
    }

    const caseRecords = args.records.filter(
      (record) => record.caseId === benchmarkCase.id,
    );
    for (const writerModel of args.writerModels) {
      console.log("");
      console.log(`--- ${writerModel} ---`);
      const record = caseRecords.find(
        (item) => item.writerModel === writerModel,
      );
      if (!record) {
        console.log("status=missing");
        continue;
      }
      printRecord(record);
    }
  }

  console.log("");
  console.log("=== Aggregate Summary ===");
  for (const aggregate of aggregateCoverLetterBenchmarkRecords(
    args.records,
    args.writerModels,
  )) {
    console.log(
      [
        `writer=${aggregate.writerModel}`,
        `completedRuns=${aggregate.completedRuns}/${aggregate.totalRuns}`,
        `averageGlobalScore=${aggregate.averageGlobalScore ?? "n/a"}`,
        `premiumReady=${aggregate.premiumReadyCount}`,
        `rankMatchesText=${aggregate.rankMatchesTextPassCount}`,
        `qualityShadowPass=${aggregate.qualityShadowPassCount}`,
        `hardFailReasons=${
          aggregate.hardFailReasons.length > 0
            ? aggregate.hardFailReasons
                .map((item) => `${item.reason} (${item.count})`)
                .join(", ")
            : "none"
        }`,
      ].join(" | "),
    );
  }
}

export function createCoverLetterEvalLiveBudget(
  options: CoverLetterBenchmarkCliOptions,
): CoverLetterEvalBudget {
  if (!options.live) {
    throw new Error(
      "Live cover-letter evaluation requires --live or COVER_LETTER_EVAL_LIVE=1.",
    );
  }
  const required = {
    maxCalls: options.maxCalls,
    maxRepairs: options.maxRepairs,
    maxUsd: options.maxUsd,
    declaredMaxUsdPerCall: options.declaredMaxUsdPerCall,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Live cover-letter evaluation requires explicit budgets: ${missing.join(", ")}.`,
    );
  }

  return createCoverLetterEvalBudget({
    explicitLiveProviderOptIn: true,
    maxCalls: required.maxCalls!,
    maxRepairs: required.maxRepairs!,
    maxUsd: required.maxUsd!,
    declaredMaxUsdPerCall: required.declaredMaxUsdPerCall!,
  } satisfies CoverLetterEvalBudgetOptions);
}

export function calculateCoverLetterBenchmarkMinimumProviderCalls(args: {
  caseCount: number;
  writerCount: number;
  evaluationMode: CoverLetterBenchmarkCliOptions["evaluationMode"];
}): number {
  const providerCallsPerRun =
    args.evaluationMode === "human_review_only" ? 1 : 2;
  return args.caseCount * args.writerCount * providerCallsPerRun;
}

export type CoverLetterHumanReviewPlanItem = Readonly<{
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterBenchmarkWriterModel;
}>;

export function buildCoverLetterHumanReviewPlan(args: {
  cases: readonly CoverLetterBenchmarkCase[];
  writerModels: readonly CoverLetterBenchmarkWriterModel[];
}): CoverLetterHumanReviewPlanItem[] {
  return args.cases.flatMap((benchmarkCase) =>
    args.writerModels.map((writerModel) => ({
      benchmarkCase,
      writerModel,
    })),
  );
}

type HumanReviewCohortResult = Readonly<{
  status: string;
  caseId?: string;
  writerModel?: string;
  error?: string;
}>;

export async function runCoverLetterHumanReviewCohort<
  Result extends HumanReviewCohortResult,
>(args: {
  plan: readonly CoverLetterHumanReviewPlanItem[];
  generateRecord: (item: CoverLetterHumanReviewPlanItem) => Promise<Result>;
  onFailure?: (args: {
    completedRecords: readonly Extract<
      Result,
      { status: "human_review_pending" }
    >[];
    failure: Exclude<Result, { status: "human_review_pending" }>;
  }) => void | Promise<void>;
}): Promise<Array<Extract<Result, { status: "human_review_pending" }>>> {
  const records: Array<Extract<Result, { status: "human_review_pending" }>> =
    [];
  for (const item of args.plan) {
    const result = await args.generateRecord(item);
    if (result.status !== "human_review_pending") {
      const failureMessage = `Human-review cohort generation failed at ${result.caseId ?? item.benchmarkCase.id}/${result.writerModel ?? item.writerModel}: ${result.error ?? result.status}`;
      try {
        await args.onFailure?.({
          completedRecords: records,
          failure: result as Exclude<
            Result,
            { status: "human_review_pending" }
          >,
        });
      } catch (receiptError) {
        throw new Error(
          `${failureMessage}. Failure-receipt handling also failed.`,
          { cause: receiptError },
        );
      }
      throw new Error(failureMessage);
    }
    records.push(result as Extract<Result, { status: "human_review_pending" }>);
  }
  return records;
}

export type CoverLetterBenchmarkOfflineCostPreflight = Readonly<{
  version: "cover_letter_eval_cost_preflight_v1";
  plannedProviderCalls: number;
  providerMaxRetries: 0;
  maxRepairs: 0;
  writerMaxOutputTokens: number;
  declaredMaxUsdPerCall: number;
  minimumSafeReservationUsd: number;
  targetReservationUsd: 2.5;
  targetReservationProven: boolean;
  worstCase: Readonly<{
    caseId: string;
    writerModel: CoverLetterEvalPricedWriterModel;
    serializedInputByteUpperBound: number;
    conservativeCallCeilingUsd: number;
  }>;
  entries: readonly Readonly<{
    caseId: string;
    writerModel: CoverLetterEvalPricedWriterModel;
    serializedInputByteUpperBound: number;
    conservativeCallCeilingUsd: number;
  }>[];
}>;

function roundBudgetUsd(value: number): number {
  return Number(value.toFixed(12));
}

async function captureSerializedBenchmarkWriterInput(
  item: CoverLetterHumanReviewPlanItem & {
    writerModel: CoverLetterEvalPricedWriterModel;
  },
): Promise<string> {
  const captureStop = Object.freeze({ type: "offline_prompt_capture" });
  let captured:
    | Readonly<{ prompt: string; schema: Record<string, unknown> }>
    | undefined;
  try {
    await generatePremiumCoverLetterBenchmarkLetter({
      benchmarkCase: item.benchmarkCase,
      writerModel: item.writerModel,
      apiKey: "offline-preflight-does-not-use-provider-credentials",
      mistralApiKey: "offline-preflight-does-not-use-provider-credentials",
      writerOverride: async ({ prompt, schema }) => {
        captured = { prompt, schema };
        throw captureStop;
      },
    });
  } catch (error) {
    if (error !== captureStop) throw error;
  }
  if (!captured) {
    throw new Error(
      `Offline cost preflight could not capture ${item.benchmarkCase.id}/${item.writerModel}.`,
    );
  }

  if (item.writerModel === "mistral-medium-latest") {
    return JSON.stringify({
      model: item.writerModel,
      messages: [
        {
          role: "system",
          content: PREMIUM_COVER_LETTER_MISTRAL_SYSTEM_PROMPT,
        },
        { role: "user", content: captured.prompt },
      ],
      temperature: 0.2,
      max_tokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
    });
  }
  return JSON.stringify(
    buildPremiumCoverLetterOpenAIRequestForExactModel({
      prompt: captured.prompt,
      writerModel: item.writerModel,
      schema: captured.schema,
      maxOutputTokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
    }),
  );
}

export async function buildCoverLetterBenchmarkOfflineCostPreflight(args: {
  cases: readonly CoverLetterBenchmarkCase[];
  writerModels: readonly CoverLetterEvalPricedWriterModel[];
}): Promise<CoverLetterBenchmarkOfflineCostPreflight> {
  const plan = buildCoverLetterHumanReviewPlan(args) as Array<
    CoverLetterHumanReviewPlanItem & {
      writerModel: CoverLetterEvalPricedWriterModel;
    }
  >;
  const entries = [] as Array<
    CoverLetterBenchmarkOfflineCostPreflight["entries"][number]
  >;
  for (const item of plan) {
    const serializedInput = await captureSerializedBenchmarkWriterInput(item);
    const serializedInputByteUpperBound = Buffer.byteLength(
      serializedInput,
      "utf8",
    );
    entries.push({
      caseId: item.benchmarkCase.id,
      writerModel: item.writerModel,
      serializedInputByteUpperBound,
      conservativeCallCeilingUsd:
        calculateCoverLetterEvalConservativeCallCeiling({
          writerModel: item.writerModel,
          serializedInputByteUpperBound,
          writerMaxOutputTokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
        }),
    });
  }
  const worstCase = entries.reduce((worst, entry) =>
    entry.conservativeCallCeilingUsd > worst.conservativeCallCeilingUsd
      ? entry
      : worst,
  );
  const minimumSafeReservationUsd = roundBudgetUsd(
    worstCase.conservativeCallCeilingUsd * entries.length,
  );
  return {
    version: "cover_letter_eval_cost_preflight_v1",
    plannedProviderCalls: entries.length,
    providerMaxRetries: COVER_LETTER_EVAL_PROVIDER_MAX_RETRIES,
    maxRepairs: 0,
    writerMaxOutputTokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
    declaredMaxUsdPerCall: worstCase.conservativeCallCeilingUsd,
    minimumSafeReservationUsd,
    targetReservationUsd: 2.5,
    targetReservationProven: minimumSafeReservationUsd <= 2.5,
    worstCase,
    entries,
  };
}

export function assertQualityEval2BBudgetContract(args: {
  options: CoverLetterBenchmarkCliOptions;
  preflight: CoverLetterBenchmarkOfflineCostPreflight;
}): void {
  if (args.options.maxCalls !== args.preflight.plannedProviderCalls) {
    throw new Error(
      `Human-review-only execution requires maxCalls=${args.preflight.plannedProviderCalls}.`,
    );
  }
  if (args.options.maxRepairs !== 0) {
    throw new Error(
      "Human-review-only execution requires maxRepairs=0 to hard-disable model-assisted repair calls.",
    );
  }
  if (
    args.options.declaredMaxUsdPerCall! < args.preflight.declaredMaxUsdPerCall
  ) {
    throw new Error(
      `Human-review-only declaredMaxUsdPerCall=${args.options.declaredMaxUsdPerCall} is below the conservative offline ceiling of ${args.preflight.declaredMaxUsdPerCall} USD.`,
    );
  }
  if (args.options.maxUsd! < args.preflight.minimumSafeReservationUsd) {
    throw new Error(
      `Human-review-only maxUsd=${args.options.maxUsd} is below the minimum safe reservation of ${args.preflight.minimumSafeReservationUsd} USD under the current single-ceiling semantics.`,
    );
  }
}

function assertLiveBudgetCoversNoRepairPlan(args: {
  options: CoverLetterBenchmarkCliOptions;
  caseCount: number;
  writerCount: number;
}): void {
  const minimumProviderCalls =
    calculateCoverLetterBenchmarkMinimumProviderCalls({
      caseCount: args.caseCount,
      writerCount: args.writerCount,
      evaluationMode: args.options.evaluationMode,
    });
  const maxCalls = args.options.maxCalls!;
  const maxUsd = args.options.maxUsd!;
  const declaredMaxUsdPerCall = args.options.declaredMaxUsdPerCall!;
  if (maxCalls < minimumProviderCalls) {
    throw new Error(
      `Live budget maxCalls=${maxCalls} cannot cover the no-repair plan of ${minimumProviderCalls} provider calls.`,
    );
  }
  const minimumReservedUsd = Number(
    (minimumProviderCalls * declaredMaxUsdPerCall).toFixed(12),
  );
  if (maxUsd < minimumReservedUsd) {
    throw new Error(
      `Live budget maxUsd=${maxUsd} cannot cover the no-repair reservation of ${minimumReservedUsd} USD.`,
    );
  }
}

function printReplayReport(results: CoverLetterReplayResult[]): void {
  console.log("cover-letter replay contract: PASS");
  for (const result of results) {
    console.log(
      JSON.stringify({
        fixtureId: result.fixtureId,
        sourceCaseId: result.sourceCaseId,
        writerProvider: result.writerProvider,
        writerModel: result.writerModel,
        writerCallCount: result.writerCallCount,
        decision: result.artifact.decision,
        artifactHash: result.artifact.artifactHash,
        provenanceHash: result.artifact.provenanceHash,
        provenanceStatus: result.artifact.provenance?.status ?? null,
        provenanceOrigin: result.artifact.provenance?.origin ?? null,
        diagnosticClasses: {
          finalization: result.artifact.diagnostics.finalization.errorClass,
          qualityShadow:
            result.artifact.diagnostics.qualityShadow?.issueClasses ?? [],
          qualityRepair:
            result.artifact.diagnostics.qualityRepair?.outcome ?? null,
        },
        contractVersions: result.artifact.contractVersions,
        configVersions: result.artifact.configVersions,
      }),
    );
  }
}

async function main(): Promise<void> {
  loadEnv(process.cwd());
  const options = parseCoverLetterBenchmarkCliOptions(process.argv.slice(2));
  if (!options.live) {
    if (options.evaluationMode === "human_review_only") {
      throw new Error(
        "Human-review-only cover-letter generation requires --live and explicit budgets.",
      );
    }
    printReplayReport(await replayRecordedCoverLetterFixtures());
    return;
  }

  const benchmarkCases = resolveRequestedCoverLetterBenchmarkCases(
    options.caseIds,
    options.evaluationMode === "human_review_only"
      ? coverLetterBlindReviewCases
      : coverLetterBenchmarkCases,
  );
  const humanReviewPlan =
    options.evaluationMode === "human_review_only"
      ? buildCoverLetterHumanReviewPlan({
          cases: benchmarkCases,
          writerModels: options.writerModels,
        })
      : null;
  const offlineCostPreflight = humanReviewPlan
    ? await buildCoverLetterBenchmarkOfflineCostPreflight({
        cases: benchmarkCases,
        writerModels:
          options.writerModels as CoverLetterEvalPricedWriterModel[],
      })
    : null;
  if (offlineCostPreflight) {
    assertQualityEval2BBudgetContract({
      options,
      preflight: offlineCostPreflight,
    });
    console.error(
      `[cover-letter-benchmark] offlineCostPreflight=${JSON.stringify(offlineCostPreflight)}`,
    );
  }
  const budget = createCoverLetterEvalLiveBudget(options);
  assertLiveBudgetCoversNoRepairPlan({
    options,
    caseCount: benchmarkCases.length,
    writerCount: options.writerModels.length,
  });

  const configuredOpenAIApiKey = process.env.OPENAI_API_KEY?.trim();
  const needsOpenAIApiKey = coverLetterBenchmarkRequiresOpenAIKey(options);
  if (needsOpenAIApiKey && !configuredOpenAIApiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured in the current environment.",
    );
  }
  const apiKey = configuredOpenAIApiKey ?? "";
  const mistralApiKey = process.env.MISTRAL_API_KEY?.trim();
  if (
    options.writerModels.some(isMistralBenchmarkWriterModel) &&
    !mistralApiKey
  ) {
    throw new Error(
      "MISTRAL_API_KEY is not configured in the current environment.",
    );
  }

  const effectiveEvaluatorModel = resolveCoverLetterEvalModel(
    options.evaluatorModel,
  );
  console.error(
    `[cover-letter-benchmark] writers=${options.writerModels.join(",")} evaluationMode=${options.evaluationMode} evaluator=${options.evaluationMode === "llm" ? effectiveEvaluatorModel : "none"} cases=${benchmarkCases
      .map((item) => item.id)
      .join(",")}`,
  );

  if (options.evaluationMode === "human_review_only") {
    const outputDirectory = options.outputDirectory;
    const runId = options.runId;
    const sourceRef = options.sourceRef;
    if (!outputDirectory || !runId || !sourceRef) {
      throw new Error(
        "Human-review-only execution requires --output-dir, --run-id, and --source-ref.",
      );
    }
    const records = await runCoverLetterHumanReviewCohort({
      plan: humanReviewPlan!,
      generateRecord: ({ benchmarkCase, writerModel }) =>
        benchmarkCoverLetterCaseForHumanReview({
          benchmarkCase,
          writerModel,
          apiKey,
          mistralApiKey,
          budget,
        }),
      onFailure: async ({ completedRecords, failure }) => {
        if (!isQualityEval2BWriterModel(failure.writerModel)) {
          throw new Error(
            `Human-review failure receipt does not support writer ${failure.writerModel}.`,
          );
        }
        const finalization = failure.artifact?.diagnostics.finalization;
        const failureReceipt = buildCoverLetterEvalFailureReceipt({
          cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
          runId,
          sourceRef,
          plannedProviderCalls: humanReviewPlan!.length,
          completedCalls: completedRecords.flatMap((record) =>
            record.runManifest ? [record.runManifest] : [],
          ),
          failure: {
            caseId: failure.caseId,
            provider: resolveBenchmarkWriterProvider(failure.writerModel),
            requestedModel: failure.writerModel,
            status: failure.status,
            failureStage:
              finalization?.failureStage ?? failure.diagnostics.failureStage,
            failureReason:
              finalization && finalization.errorClass !== "none"
                ? finalization.errorClass
                : failure.diagnostics.failureReason,
            failureIssues: failure.diagnostics.failureIssues,
            finalizationDiagnostics: finalization ?? null,
            artifactHash: failure.artifact?.artifactHash ?? null,
            provenanceHash: failure.artifact?.provenanceHash ?? null,
            attemptMetadata: failure.attemptMetadata ?? null,
          },
          budget: budget.snapshot(),
        });
        const failureReceiptPath = await writeCoverLetterEvalFailureReceipt({
          outputDirectory,
          receipt: failureReceipt,
        });
        console.error(
          `[cover-letter-benchmark] failureReceiptPath=${failureReceiptPath}`,
        );
      },
    });
    const artifacts = await buildCoverLetterBlindReviewArtifacts({
      cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
      runId,
      sourceRef,
      cases: benchmarkCases,
      records,
    });
    const runManifestEntries = records.map((record) => record.runManifest);
    if (
      runManifestEntries.some(
        (entry): entry is undefined => entry === undefined,
      )
    ) {
      throw new Error(
        "Human-review cohort is missing required evaluation run-manifest metadata.",
      );
    }
    const runManifest: CoverLetterEvalRunManifest = {
      version: "cover_letter_eval_run_manifest_v1",
      cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
      runId,
      sourceRef,
      plannedProviderCalls: humanReviewPlan!.length,
      providerMaxRetries: COVER_LETTER_EVAL_PROVIDER_MAX_RETRIES,
      maxRepairs: 0,
      writerMaxOutputTokens: COVER_LETTER_EVAL_WRITER_MAX_OUTPUT_TOKENS,
      entries: runManifestEntries,
    };
    const written = await writeCoverLetterBlindReviewArtifacts({
      outputDirectory,
      ...artifacts,
    });
    const runManifestPath = await writeCoverLetterEvalRunManifest({
      outputDirectory,
      manifest: runManifest,
    });
    console.log("cover-letter blind human-review pack: READY");
    console.log(JSON.stringify({ ...written, runManifestPath }));
    console.error(
      `[cover-letter-benchmark] budget=${JSON.stringify(budget.snapshot())}`,
    );
    return;
  }

  const records: CoverLetterBenchmarkRecord[] = [];
  for (const benchmarkCase of benchmarkCases) {
    for (const writerModel of options.writerModels) {
      records.push(
        await benchmarkCoverLetterCase({
          benchmarkCase,
          writerModel,
          evaluatorModel: effectiveEvaluatorModel,
          apiKey,
          mistralApiKey,
          budget,
        }),
      );
    }
  }

  printBenchmarkReport({
    cases: benchmarkCases,
    records,
    writerModels: options.writerModels,
  });
  console.error(
    `[cover-letter-benchmark] budget=${JSON.stringify(budget.snapshot())}`,
  );
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  void main().catch((error) => {
    console.error(
      "Cover letter benchmark failed:",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exit(1);
  });
}
