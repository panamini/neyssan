import { mkdir, readFile } from "node:fs/promises";
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
import { writeRunArtifacts, type RunManifest, type RunCaseRecord } from "../../benchmarks/proposal-generation/core/exporters";
import { benchmarkDatasetSchema, benchmarkModelSchema, type BenchmarkDataset, type BenchmarkModel } from "../../benchmarks/proposal-generation/core/types";

type CliOptions = {
  datasetPath: string;
  models: BenchmarkModel[];
  limit: number | null;
};

const DEFAULT_DATASET_PATH = "benchmarks/proposal-generation/dataset/proposal-benchmark.dataset.json";
const DEFAULT_MODELS: BenchmarkModel[] = [
  "mistral-small-latest",
  "mistral-large-latest",
  "gpt-5-nano",
  "gpt-4o-mini",
];

function isMistralModel(model: BenchmarkModel): model is "mistral-small-latest" | "mistral-large-latest" {
  return model === "mistral-small-latest" || model === "mistral-large-latest";
}

function isOpenAIModel(model: BenchmarkModel): model is "gpt-5-nano" | "gpt-4o-mini" {
  return model === "gpt-5-nano" || model === "gpt-4o-mini";
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    datasetPath: DEFAULT_DATASET_PATH,
    models: DEFAULT_MODELS,
    limit: null,
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
      "  npx tsx scripts/evals/run-proposal-model-benchmark.ts [--dataset=PATH] [--models=a,b] [--limit=N]",
      "",
      "Examples:",
      "  npx tsx scripts/evals/run-proposal-model-benchmark.ts",
      "  npx tsx scripts/evals/run-proposal-model-benchmark.ts --limit=2",
      "  npx tsx scripts/evals/run-proposal-model-benchmark.ts --models=mistral-small-latest,gpt-4o-mini",
    ].join("\n")
  );
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

async function main(): Promise<void> {
  const workdir = process.cwd();
  const loadedEnvFiles = loadBenchmarkEnv(workdir);
  const options = parseArgs(process.argv.slice(2));
  const dataset = await loadDataset(workdir, options.datasetPath);
  const cases = options.limit == null ? dataset.cases : dataset.cases.slice(0, options.limit);

  const runId = getRunId();
  const outputDir = path.resolve(workdir, "benchmarks/proposal-generation/results", runId);
  await mkdir(outputDir, { recursive: true });

  const notes: string[] = [];
  if (loadedEnvFiles.length > 0) {
    notes.push(`Loaded env files: ${loadedEnvFiles.join(", ")}`);
  }
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
