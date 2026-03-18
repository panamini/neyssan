import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import type {
  BenchmarkCase,
  BenchmarkCaseResult,
  BenchmarkModel,
  CostEstimate,
  ReviewScoreKey,
  UsageMetrics,
} from "./types";

export type RunCaseRecord = {
  benchmarkCase: BenchmarkCase;
  prompt: string;
  results: Record<BenchmarkModel, BenchmarkCaseResult>;
};

export type RunManifest = {
  runId: string;
  createdAt: string;
  datasetPath: string;
  models: BenchmarkModel[];
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
  };
  notes: string[];
  records: RunCaseRecord[];
};

function formatNullableNumber(value: number | null, digits = 4): string {
  return value == null ? "" : value.toFixed(digits);
}

function formatUsage(usage: UsageMetrics): string {
  return [
    `input=${usage.inputTokens ?? "n/a"}`,
    `output=${usage.outputTokens ?? "n/a"}`,
    `total=${usage.totalTokens ?? "n/a"}`,
  ].join(", ");
}

function formatCost(cost: CostEstimate): string {
  return cost.totalCostUsd == null ? "n/a" : `$${cost.totalCostUsd.toFixed(6)}`;
}

function escapeCsv(value: string | number | null | undefined): string {
  const stringValue = value == null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

function buildReviewTable(): string {
  const scoreKeys: ReviewScoreKey[] = [
    "writing_quality",
    "honesty",
    "grounding",
    "relevance",
    "format_adherence",
  ];

  return [
    "| Model | Writing (1-5) | Honesty (1-5) | Grounding (1-5) | Relevance (1-5) | Format (1-5) | Preferred | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...scoreKeys.map(() => "").slice(0, 0),
  ].join("\n");
}

export async function writeRunArtifacts(baseDir: string, manifest: RunManifest): Promise<{
  jsonPath: string;
  csvPath: string;
  markdownPath: string;
}> {
  await mkdir(baseDir, { recursive: true });

  const jsonPath = path.join(baseDir, "results.json");
  const csvPath = path.join(baseDir, "results.csv");
  const markdownPath = path.join(baseDir, "review.md");

  await writeFile(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const csvLines = [
    [
      "run_id",
      "case_id",
      "case_label",
      "model",
      "provider",
      "status",
      "latency_ms",
      "input_tokens",
      "output_tokens",
      "total_tokens",
      "estimated_cost_usd",
      "raw_response_path",
      "error",
    ].join(","),
  ];

  for (const record of manifest.records) {
    for (const [model, result] of Object.entries(record.results) as Array<[BenchmarkModel, BenchmarkCaseResult]>) {
      csvLines.push(
        [
          escapeCsv(manifest.runId),
          escapeCsv(record.benchmarkCase.id),
          escapeCsv(record.benchmarkCase.label),
          escapeCsv(model),
          escapeCsv(result.provider),
          escapeCsv(result.status),
          escapeCsv(result.latencyMs),
          escapeCsv(result.usage.inputTokens),
          escapeCsv(result.usage.outputTokens),
          escapeCsv(result.usage.totalTokens),
          escapeCsv(result.cost.totalCostUsd),
          escapeCsv(result.rawResponsePath),
          escapeCsv("error" in result ? result.error : ""),
        ].join(",")
      );
    }
  }

  await writeFile(csvPath, `${csvLines.join("\n")}\n`, "utf8");

  const markdownLines: string[] = [];
  markdownLines.push("# Proposal Benchmark Review");
  markdownLines.push("");
  markdownLines.push(`- Run ID: \`${manifest.runId}\``);
  markdownLines.push(`- Created at: ${manifest.createdAt}`);
  markdownLines.push(`- Dataset: \`${manifest.datasetPath}\``);
  markdownLines.push(`- Models: ${manifest.models.map((model) => `\`${model}\``).join(", ")}`);
  markdownLines.push(
    `- Generation config: temperature=${manifest.generationConfig.temperature}, maxOutputTokens=${manifest.generationConfig.maxOutputTokens}`
  );
  markdownLines.push("");
  markdownLines.push("## Review Instructions");
  markdownLines.push("");
  markdownLines.push("- Score each model for writing quality, honesty, grounding, relevance, and format adherence.");
  markdownLines.push("- Use the case's expected grounding and forbidden claims as the review baseline.");
  markdownLines.push("- Mark `Preferred` with one model name, `tie`, or `none`.");
  markdownLines.push("");

  for (const record of manifest.records) {
    markdownLines.push(`## ${record.benchmarkCase.id}: ${record.benchmarkCase.label}`);
    markdownLines.push("");
    markdownLines.push(`- Job title: ${record.benchmarkCase.jobTitle}`);
    markdownLines.push(`- Proposal type: \`${record.benchmarkCase.proposalType}\``);
    markdownLines.push(
      `- Controls: formality=\`${record.benchmarkCase.formalityLevel}\`, creativity=\`${record.benchmarkCase.creativity}\`, personalizationMode=\`${record.benchmarkCase.personalizationMode}\`, richness=\`${record.benchmarkCase.personalizationRichness}\``
    );
    if (record.benchmarkCase.expectedGrounding.length > 0) {
      markdownLines.push(`- Expected grounding: ${record.benchmarkCase.expectedGrounding.join("; ")}`);
    }
    if (record.benchmarkCase.forbiddenClaims.length > 0) {
      markdownLines.push(`- Forbidden claims: ${record.benchmarkCase.forbiddenClaims.join("; ")}`);
    }
    markdownLines.push("");
    markdownLines.push("### Reviewer Scores");
    markdownLines.push("");
    markdownLines.push(buildReviewTable());
    markdownLines.push("");

    for (const model of manifest.models) {
      const result = record.results[model];
      markdownLines.push(`### ${model}`);
      markdownLines.push("");
      markdownLines.push(
        `- Status: \`${result.status}\``
      );
      markdownLines.push(
        `- Latency: ${result.latencyMs == null ? "n/a" : `${result.latencyMs} ms`}`
      );
      markdownLines.push(`- Usage: ${formatUsage(result.usage)}`);
      markdownLines.push(`- Estimated cost: ${formatCost(result.cost)}`);
      if (result.rawResponsePath) {
        markdownLines.push(`- Raw response: \`${result.rawResponsePath}\``);
      }
      if ("error" in result) {
        markdownLines.push(`- Error: ${result.error}`);
      } else {
        markdownLines.push("");
        markdownLines.push("```text");
        markdownLines.push(result.outputText.trim() || "[empty output]");
        markdownLines.push("```");
      }
      markdownLines.push("");
    }
  }

  await writeFile(markdownPath, `${markdownLines.join("\n")}\n`, "utf8");

  return { jsonPath, csvPath, markdownPath };
}
