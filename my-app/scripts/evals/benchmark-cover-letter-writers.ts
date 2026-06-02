import { existsSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import * as dotenv from "dotenv";

import type { CoverLetterScore } from "../../convex/lib/proposals/coverLetterEvaluation";
import { resolveProposalOutputLanguage } from "../../convex/lib/proposals/proposalOutput";
import {
  PREMIUM_COVER_LETTER_WRITER_MODELS,
  attemptPremiumCoverLetterGeneration,
  generatePremiumCoverLetterBodyPartsWithOpenAI,
  type PremiumCoverLetterAttemptResult,
  type PremiumCoverLetterFailureTrace,
  type PremiumCoverLetterWriterModel,
} from "../../convex/lib/proposals/premiumCoverLetter";
import {
  evaluateCoverLetterTextWithOpenAI,
  resolveCoverLetterEvalModel,
} from "./evaluate-cover-letter";
import {
  coverLetterBenchmarkCases,
  type CoverLetterBenchmarkCase,
} from "./cases/cover-letter/cases";

type CliOptions = {
  caseIds: string[] | null;
  writerModels: PremiumCoverLetterWriterModel[];
  evaluatorModel: string;
};

type BenchmarkGenerationFailureStatus =
  | "generation_failed"
  | "evaluation_failed";

export type CoverLetterBenchmarkSuccessRecord = {
  status: "ok";
  caseId: string;
  preset: CoverLetterBenchmarkCase["preset"];
  writerModel: PremiumCoverLetterWriterModel;
  outputLanguage: "English" | "French";
  expectedContextClass: CoverLetterBenchmarkCase["expectedContextClass"];
  generation: PremiumCoverLetterAttemptResult;
  evaluation: CoverLetterScore;
  notes?: string;
  realismTag?: string;
};

export type CoverLetterBenchmarkFailureRecord = {
  status: BenchmarkGenerationFailureStatus;
  caseId: string;
  preset: CoverLetterBenchmarkCase["preset"];
  writerModel: PremiumCoverLetterWriterModel;
  outputLanguage: "English" | "French";
  expectedContextClass: CoverLetterBenchmarkCase["expectedContextClass"];
  error: string;
  generation?: PremiumCoverLetterAttemptResult;
  debug?: PremiumCoverLetterFailureTrace;
  notes?: string;
  realismTag?: string;
};

export type CoverLetterBenchmarkRecord =
  | CoverLetterBenchmarkSuccessRecord
  | CoverLetterBenchmarkFailureRecord;

export type CoverLetterBenchmarkAggregate = {
  writerModel: PremiumCoverLetterWriterModel;
  totalRuns: number;
  completedRuns: number;
  averageGlobalScore: number | null;
  premiumReadyCount: number;
  rankMatchesTextPassCount: number;
  hardFailReasons: Array<{ reason: string; count: number }>;
};

type GenerateBenchmarkLetter = (args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: PremiumCoverLetterWriterModel;
  apiKey: string;
  onFailure?: (failure: PremiumCoverLetterFailureTrace) => void;
}) => Promise<PremiumCoverLetterAttemptResult | null>;

type EvaluateBenchmarkLetter = (args: {
  letter: string;
  apiKey: string;
  model: string;
}) => Promise<CoverLetterScore>;

const DEFAULT_WRITERS = [
  "gpt-5.5",
] satisfies readonly PremiumCoverLetterWriterModel[];

export function resolveDefaultCoverLetterBenchmarkWriterModels(): PremiumCoverLetterWriterModel[] {
  return [...DEFAULT_WRITERS];
}

function printHelp(): void {
  console.log(
    [
      "Premium cover-letter writer benchmark",
      "",
      "Usage:",
      "  npx tsx scripts/evals/benchmark-cover-letter-writers.ts [--cases=id1,id2] [--writers=gpt-5.5] [--evaluator=MODEL]",
      "",
      "Examples:",
      "  npx tsx scripts/evals/benchmark-cover-letter-writers.ts",
      "  npx tsx scripts/evals/benchmark-cover-letter-writers.ts --cases=security-hyatt,adjacent-warehouse",
      "  npx tsx scripts/evals/benchmark-cover-letter-writers.ts --writers=gpt-5.5 --evaluator=gpt-5-mini",
      "  npx tsx scripts/evals/benchmark-cover-letter-writers.ts --writers=gpt-5.5,gpt-5.4,gpt-5-mini --evaluator=gpt-5-mini",
      "",
      `Available cases: ${coverLetterBenchmarkCases.map((item) => item.id).join(", ")}`,
    ].join("\n"),
  );
}

function parseCsvList(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWriterModels(rawValue: string): PremiumCoverLetterWriterModel[] {
  const requested = parseCsvList(rawValue);
  if (requested.length === 0) {
    throw new Error("Provide at least one writer model with --writers.");
  }

  const unique = Array.from(new Set(requested));
  const invalid = unique.filter(
    (item) =>
      !PREMIUM_COVER_LETTER_WRITER_MODELS.includes(
        item as PremiumCoverLetterWriterModel,
      ),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported premium writer model(s): ${invalid.join(", ")}. Supported models: ${PREMIUM_COVER_LETTER_WRITER_MODELS.join(", ")}`,
    );
  }

  return unique as PremiumCoverLetterWriterModel[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    caseIds: null,
    writerModels: [...DEFAULT_WRITERS],
    evaluatorModel: resolveCoverLetterEvalModel(),
  };

  for (const arg of argv) {
    if (arg.startsWith("--cases=")) {
      options.caseIds = parseCsvList(arg.slice("--cases=".length));
    } else if (arg.startsWith("--writers=")) {
      options.writerModels = parseWriterModels(arg.slice("--writers=".length));
    } else if (arg.startsWith("--evaluator=")) {
      options.evaluatorModel =
        arg.slice("--evaluator=".length).trim() ||
        resolveCoverLetterEvalModel();
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
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

export async function generatePremiumCoverLetterBenchmarkLetter(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: PremiumCoverLetterWriterModel;
  apiKey: string;
  onFailure?: (failure: PremiumCoverLetterFailureTrace) => void;
}): Promise<PremiumCoverLetterAttemptResult | null> {
  return attemptPremiumCoverLetterGeneration({
    personalizationContext: args.benchmarkCase.personalizationContext,
    voicePreset: args.benchmarkCase.preset,
    outputLanguage: resolveProposalOutputLanguage(
      args.benchmarkCase.jobDescription,
    ),
    jobTitle: args.benchmarkCase.jobTitle,
    jobDescription: args.benchmarkCase.jobDescription,
    candidateName: args.benchmarkCase.personalizationContext.name,
    onFailure: args.onFailure,
    writer: async ({ prompt }) =>
      generatePremiumCoverLetterBodyPartsWithOpenAI({
        apiKey: args.apiKey,
        prompt,
        writerModel: args.writerModel,
      }),
  });
}

export async function benchmarkCoverLetterCase(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: PremiumCoverLetterWriterModel;
  evaluatorModel: string;
  apiKey: string;
  generateLetter?: GenerateBenchmarkLetter;
  evaluateLetter?: EvaluateBenchmarkLetter;
}): Promise<CoverLetterBenchmarkRecord> {
  const outputLanguage = resolveProposalOutputLanguage(
    args.benchmarkCase.jobDescription,
  );
  let failureTrace: PremiumCoverLetterFailureTrace | null = null;
  const generateLetter =
    args.generateLetter ?? generatePremiumCoverLetterBenchmarkLetter;
  const evaluateLetter =
    args.evaluateLetter ??
    (async ({ letter, apiKey, model }) =>
      evaluateCoverLetterTextWithOpenAI({
        letter,
        apiKey,
        model,
      }));

  try {
    const generation = await generateLetter({
      benchmarkCase: args.benchmarkCase,
      writerModel: args.writerModel,
      apiKey: args.apiKey,
      onFailure: (failure) => {
        failureTrace = failure;
      },
    });
    if (!generation) {
      return {
        status: "generation_failed",
        caseId: args.benchmarkCase.id,
        preset: args.benchmarkCase.preset,
        writerModel: args.writerModel,
        outputLanguage,
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        error: formatPremiumCoverLetterFailure(failureTrace),
        ...(failureTrace ? { debug: failureTrace } : {}),
        notes: args.benchmarkCase.notes,
        realismTag: args.benchmarkCase.realismTag,
      };
    }

    try {
      const evaluation = await evaluateLetter({
        letter: generation.content,
        apiKey: args.apiKey,
        model: args.evaluatorModel,
      });
      return {
        status: "ok",
        caseId: args.benchmarkCase.id,
        preset: args.benchmarkCase.preset,
        writerModel: args.writerModel,
        outputLanguage,
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        generation,
        evaluation,
        notes: args.benchmarkCase.notes,
        realismTag: args.benchmarkCase.realismTag,
      };
    } catch (error) {
      return {
        status: "evaluation_failed",
        caseId: args.benchmarkCase.id,
        preset: args.benchmarkCase.preset,
        writerModel: args.writerModel,
        outputLanguage,
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        generation,
        error: error instanceof Error ? error.message : String(error),
        notes: args.benchmarkCase.notes,
        realismTag: args.benchmarkCase.realismTag,
      };
    }
  } catch (error) {
    return {
      status: "generation_failed",
      caseId: args.benchmarkCase.id,
      preset: args.benchmarkCase.preset,
      writerModel: args.writerModel,
      outputLanguage,
      expectedContextClass: args.benchmarkCase.expectedContextClass,
      error: error instanceof Error ? error.message : String(error),
      ...(failureTrace ? { debug: failureTrace } : {}),
      notes: args.benchmarkCase.notes,
      realismTag: args.benchmarkCase.realismTag,
    };
  }
}

export function aggregateCoverLetterBenchmarkRecords(
  records: CoverLetterBenchmarkRecord[],
  writerModels: PremiumCoverLetterWriterModel[],
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
      ...(record.notes ? [`notes=${record.notes}`] : []),
      ...(record.realismTag ? [`realismTag=${record.realismTag}`] : []),
    ].join(" | "),
  );

  if (record.status !== "ok") {
    console.log(`error=${record.error}`);
    if (record.debug) {
      console.log(`debug=${JSON.stringify(record.debug)}`);
    }
    if (record.generation) {
      console.log("generatedLetter:");
      console.log(record.generation.content);
    }
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
  console.log("evaluation:");
  console.log(JSON.stringify(record.evaluation, null, 2));
  console.log("generatedLetter:");
  console.log(record.generation.content);
}

function printBenchmarkReport(args: {
  cases: CoverLetterBenchmarkCase[];
  records: CoverLetterBenchmarkRecord[];
  writerModels: PremiumCoverLetterWriterModel[];
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

async function main(): Promise<void> {
  loadEnv(process.cwd());
  const options = parseArgs(process.argv.slice(2));
  const benchmarkCases = resolveRequestedCoverLetterBenchmarkCases(
    options.caseIds,
  );
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in the current environment.");
  }

  const effectiveEvaluatorModel = resolveCoverLetterEvalModel(
    options.evaluatorModel,
  );
  console.error(
    `[cover-letter-benchmark] writers=${options.writerModels.join(",")} evaluator=${effectiveEvaluatorModel} cases=${benchmarkCases
      .map((item) => item.id)
      .join(",")}`,
  );

  const records: CoverLetterBenchmarkRecord[] = [];
  for (const benchmarkCase of benchmarkCases) {
    for (const writerModel of options.writerModels) {
      records.push(
        await benchmarkCoverLetterCase({
          benchmarkCase,
          writerModel,
          evaluatorModel: effectiveEvaluatorModel,
          apiKey,
        }),
      );
    }
  }

  printBenchmarkReport({
    cases: benchmarkCases,
    records,
    writerModels: options.writerModels,
  });
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
