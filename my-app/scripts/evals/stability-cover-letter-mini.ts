import { existsSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import * as dotenv from "dotenv";

import type {
  CoverLetterBenchmarkRecord,
  CoverLetterBenchmarkSuccessRecord,
} from "./benchmark-cover-letter-writers";
import {
  benchmarkCoverLetterCase,
  resolveRequestedCoverLetterBenchmarkCases,
} from "./benchmark-cover-letter-writers";
import { resolveCoverLetterEvalModel } from "./evaluate-cover-letter";
import type { PremiumCoverLetterWriterModel } from "../../convex/lib/proposals/premiumCoverLetter";

type CliOptions = {
  caseIds: string[] | null;
  runs: number;
  writerModel: PremiumCoverLetterWriterModel;
  evaluatorModel: string;
};

type StabilityRunRecord = {
  caseId: string;
  runIndex: number;
  record: CoverLetterBenchmarkRecord;
};

export type CaseStabilitySummary = {
  caseId: string;
  totalRuns: number;
  completedRuns: number;
  premiumReadyCount: number;
  rankMatchesTextCount: number;
  averageGlobalScore: number | null;
  globalScoreRange: [number, number] | null;
  averagePersuasion: number | null;
  persuasionRange: [number, number] | null;
  averageSubstance: number | null;
  substanceRange: [number, number] | null;
  weaknessThemes: Array<{ theme: string; count: number }>;
  mainWeaknesses: string[];
};

const DEFAULT_CASE_IDS = [
  "ops-admin",
  "adjacent-warehouse",
  "weak-direct-checklist-risk",
] as const;
const DEFAULT_RUNS = 5;
const DEFAULT_WRITER_MODEL: PremiumCoverLetterWriterModel = "gpt-5-mini";

function printHelp(): void {
  console.log(
    [
      "Premium cover-letter mini stability runner",
      "",
      "Usage:",
      "  npx tsx scripts/evals/stability-cover-letter-mini.ts [--cases=id1,id2] [--runs=5] [--writer=gpt-5-mini] [--evaluator=gpt-5-mini]",
      "",
      "Examples:",
      "  npx tsx scripts/evals/stability-cover-letter-mini.ts",
      "  npx tsx scripts/evals/stability-cover-letter-mini.ts --runs=3",
      "  npx tsx scripts/evals/stability-cover-letter-mini.ts --cases=ops-admin,weak-direct-checklist-risk --runs=5",
    ].join("\n"),
  );
}

function parseCsvList(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    caseIds: [...DEFAULT_CASE_IDS],
    runs: DEFAULT_RUNS,
    writerModel: DEFAULT_WRITER_MODEL,
    evaluatorModel: resolveCoverLetterEvalModel(DEFAULT_WRITER_MODEL),
  };

  for (const arg of argv) {
    if (arg.startsWith("--cases=")) {
      options.caseIds = parseCsvList(arg.slice("--cases=".length));
    } else if (arg.startsWith("--runs=")) {
      const parsed = Number.parseInt(arg.slice("--runs=".length), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --runs value: ${arg}`);
      }
      options.runs = parsed;
    } else if (arg.startsWith("--writer=")) {
      const writerModel = arg.slice("--writer=".length).trim();
      if (writerModel !== "gpt-5-mini" && writerModel !== "gpt-5.4") {
        throw new Error(`Unsupported --writer value: ${writerModel}`);
      }
      options.writerModel = writerModel;
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

function round(value: number): number {
  return Number(value.toFixed(2));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function range(values: number[]): [number, number] | null {
  if (values.length === 0) return null;
  return [Math.min(...values), Math.max(...values)];
}

export function classifyWeaknessTheme(mainWeakness: string): string {
  const normalized = mainWeakness.toLowerCase();

  if (
    /\b(?:scale|scope|timeframe|volume|context|metric|metrics|quantified|quantify|impact|detail|details)\b/.test(
      normalized,
    )
  ) {
    return "thin_proof_texture";
  }

  if (
    /\b(?:generic|vague|summary|checklist|ability|abilities|responsibilities|role-specific|analogy)\b/.test(
      normalized,
    )
  ) {
    return "generic_value_move";
  }

  if (
    /\b(?:transfer|adjacent|implementation|direct experience|project management)\b/.test(
      normalized,
    )
  ) {
    return "transfer_bridge_softness";
  }

  if (/\b(?:repeat|repetition|repetitive)\b/.test(normalized)) {
    return "repetition";
  }

  return "other";
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function summarizeCaseStability(
  runRecords: StabilityRunRecord[],
): CaseStabilitySummary[] {
  const caseIds = Array.from(new Set(runRecords.map((item) => item.caseId)));

  return caseIds.map((caseId) => {
    const caseRuns = runRecords.filter((item) => item.caseId === caseId);
    const successes = caseRuns
      .map((item) => item.record)
      .filter(
        (record): record is CoverLetterBenchmarkSuccessRecord =>
          record.status === "ok",
      );

    const globalScores = successes.map((record) => record.evaluation.globalScore);
    const persuasionScores = successes.map(
      (record) => record.evaluation.score.persuasion,
    );
    const substanceScores = successes.map(
      (record) => record.evaluation.score.substance,
    );

    const themeCounts = new Map<string, number>();
    const mainWeaknesses = successes.map((record) => record.evaluation.mainWeakness);
    for (const weakness of mainWeaknesses) {
      const theme = classifyWeaknessTheme(weakness);
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }

    return {
      caseId,
      totalRuns: caseRuns.length,
      completedRuns: successes.length,
      premiumReadyCount: successes.filter(
        (record) => record.evaluation.gating.premiumReady,
      ).length,
      rankMatchesTextCount: successes.filter(
        (record) => record.evaluation.rankMatchesText,
      ).length,
      averageGlobalScore: average(globalScores),
      globalScoreRange: range(globalScores),
      averagePersuasion: average(persuasionScores),
      persuasionRange: range(persuasionScores),
      averageSubstance: average(substanceScores),
      substanceRange: range(substanceScores),
      weaknessThemes: Array.from(themeCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([theme, count]) => ({ theme, count })),
      mainWeaknesses: uniqueStrings(mainWeaknesses),
    };
  });
}

function printSummary(summaries: CaseStabilitySummary[]): void {
  console.log("");
  console.log("=== Stability Summary ===");
  for (const summary of summaries) {
    console.log("");
    console.log(`Case: ${summary.caseId}`);
    console.log(
      `runs=${summary.totalRuns} completed=${summary.completedRuns} premiumReady=${summary.premiumReadyCount} rankMatchesText=${summary.rankMatchesTextCount}`,
    );
    console.log(
      `globalScore avg=${summary.averageGlobalScore ?? "n/a"} range=${
        summary.globalScoreRange
          ? `${summary.globalScoreRange[0]}-${summary.globalScoreRange[1]}`
          : "n/a"
      }`,
    );
    console.log(
      `persuasion avg=${summary.averagePersuasion ?? "n/a"} range=${
        summary.persuasionRange
          ? `${summary.persuasionRange[0]}-${summary.persuasionRange[1]}`
          : "n/a"
      }`,
    );
    console.log(
      `substance avg=${summary.averageSubstance ?? "n/a"} range=${
        summary.substanceRange
          ? `${summary.substanceRange[0]}-${summary.substanceRange[1]}`
          : "n/a"
      }`,
    );
    console.log(
      `weaknessThemes=${
        summary.weaknessThemes.length > 0
          ? summary.weaknessThemes
              .map((item) => `${item.theme} (${item.count})`)
              .join(", ")
          : "none"
      }`,
    );
    for (const weakness of summary.mainWeaknesses) {
      console.log(`mainWeakness: ${weakness}`);
    }
  }
}

async function main(): Promise<void> {
  loadEnv(process.cwd());
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in the current environment.");
  }

  const benchmarkCases = resolveRequestedCoverLetterBenchmarkCases(options.caseIds);
  const effectiveEvaluatorModel = resolveCoverLetterEvalModel(
    options.evaluatorModel,
  );

  console.error(
    `[cover-letter-stability] writer=${options.writerModel} evaluator=${effectiveEvaluatorModel} runs=${options.runs} cases=${benchmarkCases
      .map((item) => item.id)
      .join(",")}`,
  );

  const runRecords: StabilityRunRecord[] = [];
  for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
    console.log("");
    console.log(`=== Run ${runIndex} ===`);
    for (const benchmarkCase of benchmarkCases) {
      const record = await benchmarkCoverLetterCase({
        benchmarkCase,
        writerModel: options.writerModel,
        evaluatorModel: effectiveEvaluatorModel,
        apiKey,
      });
      runRecords.push({
        caseId: benchmarkCase.id,
        runIndex,
        record,
      });
      const statusLine =
        record.status === "ok"
          ? [
              `status=ok`,
              `globalScore=${record.evaluation.globalScore}`,
              `premiumReady=${record.evaluation.gating.premiumReady}`,
              `rankMatchesText=${record.evaluation.rankMatchesText}`,
              `persuasion=${record.evaluation.score.persuasion}`,
              `substance=${record.evaluation.score.substance}`,
            ].join(" | ")
          : `status=${record.status} | error=${record.error}`;
      console.log(`${benchmarkCase.id}: ${statusLine}`);
    }
  }

  const summaries = summarizeCaseStability(runRecords);
  printSummary(summaries);
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  void main().catch((error) => {
    console.error(
      "Cover letter mini stability run failed:",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exit(1);
  });
}
