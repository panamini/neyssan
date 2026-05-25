import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

import { runMistralBenchmarkCase } from "../../benchmarks/proposal-generation/adapters/mistral";
import { runOpenAIBenchmarkCase } from "../../benchmarks/proposal-generation/adapters/openai";
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_TEMPERATURE,
  getProviderForModel,
} from "../../benchmarks/proposal-generation/adapters/shared";
import { buildBenchmarkPrompt } from "../../benchmarks/proposal-generation/core/buildPrompt";
import { estimateCost } from "../../benchmarks/proposal-generation/core/pricing";
import { writeRunArtifacts, type RunManifest, type RunCaseRecord } from "../../benchmarks/proposal-generation/core/exporters";
import { benchmarkDatasetSchema, benchmarkModelSchema, type BenchmarkCase, type BenchmarkDataset, type BenchmarkModel, type BenchmarkSuccessResult, type UsageMetrics } from "../../benchmarks/proposal-generation/core/types";
import {
  analyzeProposalDraft,
  detectNoContextCandidateClaimLeak,
  detectUnsupportedCoreClaimLeak,
} from "../../convex/lib/proposals/proposalEnforcement";
import type { ProposalPlannerResult } from "../../convex/lib/proposals/proposalPlanner";
import { repairProposalDraftWithConstrainedPass } from "../../convex/generateProposalMutation";

type CliOptions = {
  datasetPath: string;
  models: BenchmarkModel[];
  limit: number | null;
  fixtures: string[] | null;
  dry: boolean;
  scoreWithHarness: boolean;
  resultsPath: string | null;
  qualityOutputDir: string | null;
};

const DEFAULT_DATASET_PATH = "benchmarks/proposal-generation/dataset/proposal-benchmark.dataset.json";
const DEFAULT_MODELS: BenchmarkModel[] = [
  "mistral-small-latest",
  "mistral-large-latest",
  "gpt-5-nano",
  "gpt-4o-mini",
];

function isMistralModel(model: BenchmarkModel): model is Extract<BenchmarkModel, `mistral-${string}`> {
  return (
    model === "mistral-small-latest" ||
    model === "mistral-medium-latest" ||
    model === "mistral-large-latest"
  );
}

function isOpenAIModel(model: BenchmarkModel): model is "gpt-5-nano" | "gpt-4o-mini" {
  return model === "gpt-5-nano" || model === "gpt-4o-mini";
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    datasetPath: DEFAULT_DATASET_PATH,
    models: DEFAULT_MODELS,
    limit: null,
    fixtures: null,
    dry: false,
    scoreWithHarness: false,
    resultsPath: null,
    qualityOutputDir: null,
  };

  for (const arg of argv) {
    if (arg.startsWith("--dataset=")) {
      options.datasetPath = arg.slice("--dataset=".length);
    } else if (arg.startsWith("--models=")) {
      const requested = arg
        .slice("--models=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      options.models = requested.map((item) => benchmarkModelSchema.parse(item));
    } else if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.slice("--limit=".length), 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --limit value: ${arg}`);
      }
      options.limit = value;
    } else if (arg.startsWith("--fixtures=")) {
      const requested = arg
        .slice("--fixtures=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (requested.length === 0) {
        throw new Error(`Invalid --fixtures value: ${arg}`);
      }
      options.fixtures = requested;
    } else if (arg === "--dry") {
      options.dry = true;
    } else if (arg === "--score-with-harness") {
      options.scoreWithHarness = true;
    } else if (arg.startsWith("--results=")) {
      options.resultsPath = arg.slice("--results=".length);
    } else if (arg.startsWith("--quality-output-dir=")) {
      options.qualityOutputDir = arg.slice("--quality-output-dir=".length);
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
      "Proposal model benchmark runner",
      "",
      "Usage:",
      "  npx tsx scripts/evals/run-proposal-model-benchmark.ts [--dataset=PATH] [--models=a,b] [--limit=N] [--fixtures=id1,id2]",
      "  npx tsx scripts/evals/run-proposal-model-benchmark.ts --dry --score-with-harness [--results=PATH]",
      "",
      "Examples:",
      "  PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts",
      "  npx tsx scripts/evals/run-proposal-model-benchmark.ts --dry --score-with-harness",
      "  npx tsx scripts/evals/run-proposal-model-benchmark.ts --limit=2",
      "  PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts --score-with-harness --models=mistral-medium-latest,mistral-large-latest --limit=2",
      "  PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts --score-with-harness --models=mistral-medium-latest,mistral-large-latest --fixtures=freelance-weak-seo,employment-no-context-generalist",
      "  npx tsx scripts/evals/run-proposal-model-benchmark.ts --models=mistral-small-latest,gpt-4o-mini",
    ].join("\n")
  );
}

function selectBenchmarkCases(
  dataset: BenchmarkDataset,
  options: Pick<CliOptions, "fixtures" | "limit">,
): BenchmarkDataset["cases"] {
  let cases = dataset.cases;

  if (options.fixtures) {
    const fixtureSet = new Set(options.fixtures);
    cases = cases.filter((benchmarkCase) => fixtureSet.has(benchmarkCase.id));
    const foundIds = new Set(cases.map((benchmarkCase) => benchmarkCase.id));
    const missingIds = options.fixtures.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new Error(`Unknown fixture id(s): ${missingIds.join(", ")}`);
    }
  }

  return options.limit == null ? cases : cases.slice(0, options.limit);
}

async function loadDataset(workdir: string, datasetPath: string): Promise<BenchmarkDataset> {
  const absolutePath = path.resolve(workdir, datasetPath);
  const raw = await readFile(absolutePath, "utf8");
  return benchmarkDatasetSchema.parse(JSON.parse(raw));
}

function getRunId(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function loadBenchmarkEnv(workdir: string): string[] {
  const loadedFiles: string[] = [];
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
    loadedFiles.push(envFile.filePath);
  }

  return loadedFiles;
}

function outputFormatForBenchmarkCase(
  benchmarkCase: BenchmarkCase,
): "cover_letter" | "application_message" | "freelance_proposal" {
  if (benchmarkCase.proposalType === "application_message") return "application_message";
  if (benchmarkCase.proposalType === "freelance_proposal") return "freelance_proposal";
  return "cover_letter";
}

function candidateFactsForBenchmarkCase(benchmarkCase: BenchmarkCase): string[] {
  const context = benchmarkCase.candidateContext;
  if (!context) return [];
  return [
    context.summary,
    context.desiredPosition,
    ...(context.topSkills ?? []),
    ...(context.standoutAchievements ?? []),
    ...(context.recentExperience ?? []).flatMap((experience) => [
      experience.position,
      experience.company,
      ...(experience.highlights ?? []),
    ]),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());
}

function plannerResultForBenchmarkCase(benchmarkCase: BenchmarkCase): ProposalPlannerResult {
  const allowedFacts = candidateFactsForBenchmarkCase(benchmarkCase);
  const noContext = !benchmarkCase.candidateContext;
  const weakTechnicalSeo =
    /\b(?:technical\s+seo|indexing|schema|crawl|internal[-\s]linking)\b/i.test(
      `${benchmarkCase.jobTitle} ${benchmarkCase.jobDescription}`,
    ) &&
    /\b(?:front[-\s]?end|landing pages?|conversion(?: optimization)?)\b/i.test(
      allowedFacts.join(" "),
    );
  return {
    context_mode: noContext
      ? "none"
      : benchmarkCase.personalizationRichness === "minimal"
        ? "minimal"
        : benchmarkCase.personalizationRichness === "sparse"
          ? "sparse"
          : "rich",
    domain_gap: noContext ? "distant" : weakTechnicalSeo ? "adjacent" : "direct",
    credential_status: weakTechnicalSeo ? "unsupported" : "exact_required",
    transfer_mode: noContext
      ? "no_operational_analogy"
      : weakTechnicalSeo
        ? "abstract_only"
        : "literal",
    output_language: "en",
    allowed_concrete_facts: allowedFacts,
    allowed_transfer_themes: [],
    disallowed_claims: benchmarkCase.forbiddenClaims,
    identity_hard_stops: [],
    proof_strategy: noContext
      ? "none"
      : weakTechnicalSeo
        ? "abstract_only"
        : "concrete_supported",
    opening_strategy: "direct_fast",
  };
}

function addUsage(left: UsageMetrics, right: UsageMetrics): UsageMetrics {
  const add = (a: number | null, b: number | null) =>
    a == null && b == null ? null : (a ?? 0) + (b ?? 0);
  return {
    inputTokens: add(left.inputTokens, right.inputTokens),
    outputTokens: add(left.outputTokens, right.outputTokens),
    totalTokens: add(left.totalTokens, right.totalTokens),
  };
}

async function callMistralRepairPrompt(args: {
  model: Extract<BenchmarkModel, `mistral-${string}`>;
  prompt: string;
  usage: { value: UsageMetrics };
}): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) throw new Error("MISTRAL_API_KEY is not configured.");
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: "user", content: args.prompt }],
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
    }),
  });
  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Mistral repair HTTP ${response.status}: ${rawText}`);
  }
  const parsed = JSON.parse(rawText) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  args.usage.value = {
    inputTokens: parsed.usage?.prompt_tokens ?? null,
    outputTokens: parsed.usage?.completion_tokens ?? null,
    totalTokens: parsed.usage?.total_tokens ?? null,
  };
  return parsed.choices?.[0]?.message?.content?.trim() ?? "";
}

async function applyBenchmarkConstrainedRepairIfNeeded(args: {
  benchmarkCase: BenchmarkCase;
  model: Extract<BenchmarkModel, `mistral-${string}`>;
  result: BenchmarkSuccessResult;
  outputDir: string;
}): Promise<BenchmarkSuccessResult> {
  const plan = plannerResultForBenchmarkCase(args.benchmarkCase);
  const format = outputFormatForBenchmarkCase(args.benchmarkCase);
  const common = {
    content: args.result.outputText,
    plan,
    format,
    outputLanguage: "English" as const,
    candidateName: args.benchmarkCase.candidateContext?.name,
    jobTitle: args.benchmarkCase.jobTitle,
    jobDescription: args.benchmarkCase.jobDescription,
  };
  if (
    !detectNoContextCandidateClaimLeak(common) &&
    !detectUnsupportedCoreClaimLeak(common)
  ) {
    return args.result;
  }

  const repairUsage = { value: { inputTokens: null, outputTokens: null, totalTokens: null } as UsageMetrics };
  const startedAt = Date.now();
  const analysis = analyzeProposalDraft(common);
  const repairedOutputText = await repairProposalDraftWithConstrainedPass({
    mistralKey: process.env.MISTRAL_API_KEY ?? "benchmark",
    modelType: args.model,
    ...common,
    flaggedSentences: analysis.flaggedSentences,
    repairDraftText: (prompt) =>
      callMistralRepairPrompt({
        model: args.model,
        prompt,
        usage: repairUsage,
      }),
  });
  const repairLatencyMs = Date.now() - startedAt;
  const usage = addUsage(args.result.usage, repairUsage.value);
  const cost = estimateCost(args.model, usage);
  const repairPath = path.join(
    args.outputDir,
    "raw",
    `${args.benchmarkCase.id}__${args.model}__constrained-repair.json`,
  );
  await writeFile(
    repairPath,
    JSON.stringify(
      {
        originalOutputText: args.result.outputText,
        repairedOutputText,
        repairUsage: repairUsage.value,
        repairLatencyMs,
      },
      null,
      2,
    ),
    "utf8",
  );
  return {
    ...args.result,
    outputText: repairedOutputText,
    latencyMs: args.result.latencyMs + repairLatencyMs,
    usage,
    cost,
  };
}

async function main(): Promise<void> {
  const workdir = process.cwd();
  const loadedEnvFiles = loadBenchmarkEnv(workdir);
  const options = parseArgs(process.argv.slice(2));

  if (options.dry) {
    if (!options.scoreWithHarness) {
      throw new Error("--dry currently requires --score-with-harness.");
    }
    const {
      loadSavedBenchmarkManifest,
      scoreBenchmarkManifest,
      writeProposalQualityBenchmarkArtifacts,
    } = await import("./proposal-quality-adapter");
    const sourceResultsPath = path.resolve(
      workdir,
      options.resultsPath ??
        "benchmarks/proposal-generation/results/2026-03-12T15-24-05-237Z/results.json",
    );
    const manifest = await loadSavedBenchmarkManifest({
      resultsPath: sourceResultsPath,
      workdir,
    });
    const { report, revealMap } = scoreBenchmarkManifest({
      manifest,
      sourceResultsPath,
      blind: true,
    });
    const artifacts = await writeProposalQualityBenchmarkArtifacts({
      report,
      revealMap,
      outputDir: options.qualityOutputDir ?? undefined,
    });
    console.log(`Dry proposal benchmark scoring completed: ${report.runId}`);
    console.log(`Quality report: ${artifacts.reportJsonPath}`);
    console.log(`Review: ${artifacts.markdownPath}`);
    console.log(`Reveal map: ${artifacts.revealMapPath}`);
    return;
  }

  if (process.env.PROPOSAL_BENCHMARK_LIVE !== "1") {
    throw new Error(
      "Live proposal benchmark requires explicit opt-in: PROPOSAL_BENCHMARK_LIVE=1.",
    );
  }

  const dataset = await loadDataset(workdir, options.datasetPath);
  const cases = selectBenchmarkCases(dataset, options);

  const runId = getRunId();
  const outputDir = path.resolve(workdir, "benchmarks/proposal-generation/results", runId);
  await mkdir(outputDir, { recursive: true });

  const notes: string[] = [];
  if (loadedEnvFiles.length > 0) {
    notes.push(`Loaded env files: ${loadedEnvFiles.join(", ")}`);
  }
  if (options.fixtures) {
    notes.push(`Filtered fixtures: ${options.fixtures.join(", ")}`);
  }
  notes.push("Benchmark-only post-generation constrained repair enabled for Mistral outputs that trip production safety detectors.");
  if (!process.env.MISTRAL_API_KEY) {
    notes.push("MISTRAL_API_KEY missing: Mistral models will be marked as skipped.");
  }
  if (!process.env.OPENAI_API_KEY) {
    notes.push("OPENAI_API_KEY missing: OpenAI models will be marked as skipped.");
  }

  const records: RunCaseRecord[] = [];

  for (const benchmarkCase of cases) {
    const prompt = buildBenchmarkPrompt(benchmarkCase);
    const results = {} as RunCaseRecord["results"];

    for (const model of options.models) {
      const provider = getProviderForModel(model);
      if (provider === "mistral" && isMistralModel(model)) {
        results[model] = await runMistralBenchmarkCase({
          model,
          prompt,
          caseId: benchmarkCase.id,
          outputDir,
          settings: {
            temperature: DEFAULT_TEMPERATURE,
            maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
          },
        });
        if (results[model].status === "ok") {
          results[model] = await applyBenchmarkConstrainedRepairIfNeeded({
            benchmarkCase,
            model,
            result: results[model],
            outputDir,
          });
        }
      } else if (provider === "openai" && isOpenAIModel(model)) {
        results[model] = await runOpenAIBenchmarkCase({
          model,
          prompt,
          caseId: benchmarkCase.id,
          outputDir,
          settings: {
            temperature: DEFAULT_TEMPERATURE,
            maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
          },
        });
      } else {
        throw new Error(`Unhandled model/provider combination: ${model}/${provider}`);
      }
    }

    records.push({
      benchmarkCase,
      prompt,
      results,
    });
  }

  const manifest: RunManifest = {
    runId,
    createdAt: new Date().toISOString(),
    datasetPath: path.resolve(workdir, options.datasetPath),
    models: options.models,
    generationConfig: {
      temperature: DEFAULT_TEMPERATURE,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    },
    notes,
    records,
  };

  const artifacts = await writeRunArtifacts(outputDir, manifest);
  if (options.scoreWithHarness) {
    const {
      scoreBenchmarkManifest,
      writeProposalQualityBenchmarkArtifacts,
    } = await import("./proposal-quality-adapter");
    const { report, revealMap } = scoreBenchmarkManifest({
      manifest,
      sourceResultsPath: artifacts.jsonPath,
      blind: true,
    });
    const qualityArtifacts = await writeProposalQualityBenchmarkArtifacts({
      report,
      revealMap,
      outputDir: options.qualityOutputDir ?? undefined,
    });
    console.log(`Quality report: ${qualityArtifacts.reportJsonPath}`);
    console.log(`Quality review: ${qualityArtifacts.markdownPath}`);
    console.log(`Quality reveal map: ${qualityArtifacts.revealMapPath}`);
  }

  console.log(`Benchmark run completed: ${runId}`);
  console.log(`Results directory: ${outputDir}`);
  console.log(`JSON: ${artifacts.jsonPath}`);
  console.log(`CSV: ${artifacts.csvPath}`);
  console.log(`Markdown review: ${artifacts.markdownPath}`);
  if (notes.length > 0) {
    console.log("Notes:");
    for (const note of notes) {
      console.log(`- ${note}`);
    }
  }
}

void main().catch((error) => {
  console.error("Benchmark run failed:", error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
