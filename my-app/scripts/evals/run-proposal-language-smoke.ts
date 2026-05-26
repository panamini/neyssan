import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import * as dotenv from "dotenv";

import { runMistralBenchmarkCase } from "../../benchmarks/proposal-generation/adapters/mistral";
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_TEMPERATURE,
} from "../../benchmarks/proposal-generation/adapters/shared";
import { analyzeBenchmarkOutputQuality } from "../../benchmarks/proposal-generation/core/outputQualityGates";
import {
  benchmarkDatasetSchema,
  type BenchmarkCase,
  type BenchmarkDataset,
} from "../../benchmarks/proposal-generation/core/types";
import { buildInlineMistralPrompt } from "../../convex/generateProposalMutation";
import type { EffectiveProposalTone } from "../../convex/lib/proposals/effectiveTone";
import {
  attemptPremiumCoverLetterGeneration,
  generatePremiumCoverLetterBodyPartsWithOpenAI,
  type PremiumCoverLetterWriterModel,
  type PremiumCoverLetterFailureTrace,
} from "../../convex/lib/proposals/premiumCoverLetter";
import {
  buildProposalOutputLanguageInstruction,
  getCoverLetterClosingInstruction,
  getCoverLetterSalutationInstruction,
  type ProposalOutputLanguage,
} from "../../convex/lib/proposals/proposalOutput";

type SmokeEngine = "mistral-inline" | "premium-openai";

type CliOptions = {
  caseId: string;
  datasetPath: string;
  outputDir: string;
  engines: SmokeEngine[];
};

type SmokeResult = {
  engine: SmokeEngine;
  language: ProposalOutputLanguage;
  status: "ok" | "error" | "skipped";
  latencyMs: number | null;
  rawResponsePath: string | null;
  excerpt: string | null;
  qualityFailures: ReturnType<typeof analyzeBenchmarkOutputQuality>;
  error?: string;
};

const DEFAULT_DATASET_PATH =
  "benchmarks/proposal-generation/dataset/proposal-benchmark.dataset.json";
const DEFAULT_CASE_ID = "employment-strong-frontend";
const DEFAULT_OUTPUT_DIR = "/private/tmp/proposal-language-smoke";
const MISTRAL_MODEL = "mistral-medium-latest" as const;
const PREMIUM_OPENAI_MODEL = "gpt-5.5" satisfies PremiumCoverLetterWriterModel;
const LANGUAGES: ProposalOutputLanguage[] = [
  "English",
  "French",
  "German",
  "Russian",
  "Arabic",
  "Polish",
];

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEngines(value: string): SmokeEngine[] {
  const requested = parseCsvList(value);
  const supported: SmokeEngine[] = ["mistral-inline", "premium-openai"];
  const invalid = requested.filter(
    (item) => !supported.includes(item as SmokeEngine),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported smoke engine(s): ${invalid.join(", ")}. Supported engines: ${supported.join(", ")}`,
    );
  }
  return requested as SmokeEngine[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    caseId: DEFAULT_CASE_ID,
    datasetPath: DEFAULT_DATASET_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    engines: ["mistral-inline", "premium-openai"],
  };

  for (const arg of argv) {
    if (arg.startsWith("--case=")) {
      options.caseId = arg.slice("--case=".length);
    } else if (arg.startsWith("--dataset=")) {
      options.datasetPath = arg.slice("--dataset=".length);
    } else if (arg.startsWith("--output-dir=")) {
      options.outputDir = arg.slice("--output-dir=".length);
    } else if (arg.startsWith("--engines=")) {
      options.engines = parseEngines(arg.slice("--engines=".length));
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(
    [
      "Proposal language smoke",
      "",
      "Usage:",
      "  PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-language-smoke.ts [--case=id] [--engines=mistral-inline,premium-openai] [--output-dir=PATH]",
      "",
      "The smoke runs English, French, German, Russian, Arabic, and Polish through the requested engines.",
      "It fails the process when any completed non-English output leaks English fallback copy or any output invents unsupported numeric/duration claims.",
    ].join("\n"),
  );
}

function loadEnv(workdir: string): string[] {
  const loaded: string[] = [];
  for (const envFile of [
    { filePath: path.resolve(workdir, ".env"), override: false },
    { filePath: path.resolve(workdir, ".env.local"), override: true },
  ]) {
    if (!existsSync(envFile.filePath)) continue;
    dotenv.config({ path: envFile.filePath, override: envFile.override });
    loaded.push(envFile.filePath);
  }
  return loaded;
}

async function loadDataset(workdir: string, datasetPath: string): Promise<BenchmarkDataset> {
  const raw = await readFile(path.resolve(workdir, datasetPath), "utf8");
  return benchmarkDatasetSchema.parse(JSON.parse(raw));
}

function findCase(dataset: BenchmarkDataset, caseId: string): BenchmarkCase {
  const benchmarkCase = dataset.cases.find((entry) => entry.id === caseId);
  if (!benchmarkCase) {
    throw new Error(`Missing benchmark case: ${caseId}`);
  }
  return benchmarkCase;
}

function buildCandidateContextBlock(context: BenchmarkCase["candidateContext"]): string {
  if (!context) {
    return [
      "No candidate background is available for this request.",
      "Do not claim or imply any profession, tools, projects, employers, industries, years of experience, or accomplishments that are not provided.",
    ].join(" ");
  }

  const lines: string[] = ["Candidate background for personalization:"];
  if (context.name) lines.push(`- Name: ${compactWhitespace(context.name)}`);
  if (context.summary) lines.push(`- Professional summary: ${compactWhitespace(context.summary)}`);
  if (context.desiredPosition) lines.push(`- Target role / headline: ${compactWhitespace(context.desiredPosition)}`);
  if (context.topSkills?.length) lines.push(`- Core skills: ${context.topSkills.map(compactWhitespace).join(", ")}`);
  if (context.recentExperience?.length) {
    lines.push("- Recent experience:");
    for (const entry of context.recentExperience) {
      const role = [
        entry.position,
        entry.company ? `at ${entry.company}` : "",
      ]
        .filter(Boolean)
        .map(compactWhitespace)
        .join(" ");
      const highlights = entry.highlights?.length
        ? `: ${entry.highlights.map(compactWhitespace).join("; ")}`
        : "";
      lines.push(`  - ${role || "Relevant role"}${highlights}`);
    }
  }
  if (context.standoutAchievements?.length) {
    lines.push(`- Standout achievements: ${context.standoutAchievements.map(compactWhitespace).join("; ")}`);
  }
  lines.push("Use this background only to tailor tone and relevance.");
  lines.push("Do not invent employers, achievements, years, or technical experience.");
  return lines.join("\n");
}

function summarizeText(text: string): string {
  return compactWhitespace(text).slice(0, 360);
}

function qualityFailuresFor(args: {
  benchmarkCase: BenchmarkCase;
  outputText: string;
  language: ProposalOutputLanguage;
}) {
  return analyzeBenchmarkOutputQuality({
    benchmarkCase: args.benchmarkCase,
    outputText: args.outputText,
    expectedLanguage: args.language,
  });
}

async function runMistralInlineSmoke(args: {
  benchmarkCase: BenchmarkCase;
  language: ProposalOutputLanguage;
  outputDir: string;
}): Promise<SmokeResult> {
  const outputLanguagePrompt = [
    buildProposalOutputLanguageInstruction(args.language),
    getCoverLetterSalutationInstruction(args.language),
    getCoverLetterClosingInstruction(args.language),
  ].join(" ");
  const prompt = buildInlineMistralPrompt(
    {
      jobTitle: args.benchmarkCase.jobTitle,
      jobDescription: args.benchmarkCase.jobDescription,
      proposalType: "cover_letter",
      voicePreset: null,
      formalityLevel: args.benchmarkCase.formalityLevel,
      creativity: args.benchmarkCase.creativity,
    } as unknown as Parameters<typeof buildInlineMistralPrompt>[0],
    {
      formalityLevel: args.benchmarkCase.formalityLevel,
      creativity: args.benchmarkCase.creativity,
    } as EffectiveProposalTone,
    "",
    "cover_letter",
    args.language,
    buildCandidateContextBlock(args.benchmarkCase.candidateContext),
    args.benchmarkCase.personalizationRichness,
    "",
    "",
    "",
  );

  const result = await runMistralBenchmarkCase({
    model: MISTRAL_MODEL,
    prompt: `${prompt}\n\n${outputLanguagePrompt}`,
    caseId: `${args.benchmarkCase.id}__${args.language.toLowerCase()}__mistral-inline`,
    outputDir: args.outputDir,
    settings: {
      temperature: DEFAULT_TEMPERATURE,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    },
  });
  const outputText = result.status === "ok" ? result.outputText : "";
  return {
    engine: "mistral-inline",
    language: args.language,
    status: result.status,
    latencyMs: result.latencyMs,
    rawResponsePath: result.rawResponsePath,
    excerpt: outputText ? summarizeText(outputText) : null,
    qualityFailures: outputText
      ? qualityFailuresFor({
          benchmarkCase: args.benchmarkCase,
          outputText,
          language: args.language,
        })
      : [],
    error: "error" in result ? result.error : undefined,
  };
}

async function runPremiumOpenAISmoke(args: {
  benchmarkCase: BenchmarkCase;
  language: ProposalOutputLanguage;
  outputDir: string;
}): Promise<SmokeResult> {
  const startedAt = Date.now();
  const rawResponsePath = path.join(
    args.outputDir,
    "raw",
    `${args.benchmarkCase.id}__${args.language.toLowerCase()}__premium-openai__${PREMIUM_OPENAI_MODEL}.json`,
  );
  try {
    const failures: PremiumCoverLetterFailureTrace[] = [];
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: args.benchmarkCase.candidateContext,
      voicePreset: "expert",
      outputLanguage: args.language,
      jobTitle: args.benchmarkCase.jobTitle,
      jobDescription: args.benchmarkCase.jobDescription,
      candidateName: args.benchmarkCase.candidateContext?.name,
      writerProvider: "openai",
      writerModel: PREMIUM_OPENAI_MODEL,
      onFailure: (failure) => failures.push(failure),
      writer: ({ prompt, signal }) =>
        generatePremiumCoverLetterBodyPartsWithOpenAI({
          apiKey: process.env.OPENAI_API_KEY ?? "",
          prompt,
          writerModel: PREMIUM_OPENAI_MODEL,
          signal,
        }),
    });
    await mkdir(path.dirname(rawResponsePath), { recursive: true });
    await writeFile(
      rawResponsePath,
      `${JSON.stringify({ language: args.language, model: PREMIUM_OPENAI_MODEL, result, failures }, null, 2)}\n`,
      "utf8",
    );
    const outputText = result?.content ?? "";
    return {
      engine: "premium-openai",
      language: args.language,
      status: result ? "ok" : "skipped",
      latencyMs: Date.now() - startedAt,
      rawResponsePath,
      excerpt: outputText ? summarizeText(outputText) : null,
      qualityFailures: outputText
        ? qualityFailuresFor({
            benchmarkCase: args.benchmarkCase,
            outputText,
            language: args.language,
          })
        : [],
      error: result
        ? undefined
        : `Premium OpenAI generation returned null: ${failures
            .map((failure) => [
              failure.stage,
              failure.reason,
              failure.eligibilityReason,
              ...(failure.issues ?? []),
            ].filter(Boolean).join("/"))
            .join(", ")}`,
    };
  } catch (error) {
    return {
      engine: "premium-openai",
      language: args.language,
      status: "error",
      latencyMs: Date.now() - startedAt,
      rawResponsePath: null,
      excerpt: null,
      qualityFailures: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const workdir = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const loadedEnvFiles = loadEnv(workdir);

  if (process.env.PROPOSAL_BENCHMARK_LIVE !== "1") {
    throw new Error(
      "Proposal language smoke requires explicit opt-in: PROPOSAL_BENCHMARK_LIVE=1.",
    );
  }

  const dataset = await loadDataset(workdir, options.datasetPath);
  const benchmarkCase = findCase(dataset, options.caseId);
  await mkdir(path.join(options.outputDir, "raw"), { recursive: true });

  const results: SmokeResult[] = [];
  for (const language of LANGUAGES) {
    if (options.engines.includes("mistral-inline")) {
      results.push(
        await runMistralInlineSmoke({
          benchmarkCase,
          language,
          outputDir: options.outputDir,
        }),
      );
    }
    if (options.engines.includes("premium-openai")) {
      results.push(
        await runPremiumOpenAISmoke({
          benchmarkCase,
          language,
          outputDir: options.outputDir,
        }),
      );
    }
  }

  const summary = {
    caseId: options.caseId,
    outputDir: options.outputDir,
    engines: options.engines,
    languages: LANGUAGES,
    loadedEnvFiles,
    results,
  };
  const summaryPath = path.join(options.outputDir, "summary.json");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));

  const failedResults = results.filter(
    (result) => result.status !== "ok" || result.qualityFailures.length > 0,
  );
  if (failedResults.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(
    "Proposal language smoke failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exit(1);
});
