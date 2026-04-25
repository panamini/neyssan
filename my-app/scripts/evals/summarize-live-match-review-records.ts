import { readFileSync } from "node:fs";

import {
  summarizeLiveMatchReviewRecords,
  type LiveMatchReviewRecord,
} from "../../convex/lib/jobs/liveMatchReviewExport";

function usage(): never {
  throw new Error(
    [
      "Usage: tsx scripts/evals/summarize-live-match-review-records.ts <live-review-labeled.json> [--json]",
      "",
      "Input must be a JSON array of LiveMatchReviewRecord objects.",
      "Track sparse same-family harshness with failure_types including too_harsh and reviewer_notes containing sparse_same_family.",
    ].join("\n"),
  );
}

function parseRecords(inputPath: string): LiveMatchReviewRecord[] {
  const raw = readFileSync(inputPath, "utf8").trim();
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Input JSON must be an array of live match review records.");
  }

  return parsed as LiveMatchReviewRecord[];
}

function formatSummary(summary: ReturnType<typeof summarizeLiveMatchReviewRecords>): string {
  return Object.entries(summary)
    .map(([key, value]) => `${key}: ${value === null ? "null" : value}`)
    .join("\n");
}

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const jsonOutput = args.includes("--json");

if (!inputPath || args.includes("--help")) {
  usage();
}

const records = parseRecords(inputPath);
const summary = summarizeLiveMatchReviewRecords(records);

console.log(jsonOutput ? JSON.stringify(summary, null, 2) : formatSummary(summary));
