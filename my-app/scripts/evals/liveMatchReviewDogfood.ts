import { readFileSync, writeFileSync } from "node:fs";

import { ConvexHttpClient } from "convex/browser";

import { api } from "../../convex/_generated/api";
import { summarizeLiveMatchReviewRecords, type LiveMatchReviewRecord } from "../../convex/lib/jobs/liveMatchReviewExport";
import {
  buildStructuredMatchIdentity,
  isLikelyJwt,
  loadEnvFiles,
  readLocalBackendConfig,
} from "./liveMatchReviewEnv";

export type LiveMatchReviewDogfoodOptions = {
  limit: number;
  outPath: string;
  labeledPath: string | null;
  summaryOnly: boolean;
};

export type LiveMatchReviewSummary = ReturnType<
  typeof summarizeLiveMatchReviewRecords
>;

export type LiveMatchReviewDogfoodRunResult =
  | {
      kind: "export";
      outPath: string;
      recordCount: number;
      nextSteps: string[];
    }
  | {
      kind: "summary";
      labeledPath: string;
      summary: LiveMatchReviewSummary;
    };

function readArgValue(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

export function parseDogfoodArgs(argv: string[]): LiveMatchReviewDogfoodOptions {
  const limit = Number(readArgValue(argv, "--limit") ?? 50);
  const outPath = readArgValue(argv, "--out") ?? "/tmp/match-review-live.json";
  const labeledPath = readArgValue(argv, "--labeled");
  const summaryOnly = argv.includes("--summary-only");

  return {
    limit: Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 50,
    outPath,
    labeledPath,
    summaryOnly,
  };
}

export function formatLiveReviewSummary(summary: LiveMatchReviewSummary): string {
  return Object.entries(summary)
    .map(([key, value]) => `${key}: ${value === null ? "null" : value}`)
    .join("\n");
}

export function buildLiveReviewNextSteps(labeledPath: string): string[] {
  return [
    `Label records in ${labeledPath} using human_label and failure_types.`,
    `Track sparse same-family harshness with reviewer_notes containing sparse_same_family.`,
    `Summarize afterward with: rtk ./node_modules/.bin/tsx scripts/evals/run-live-match-review-dogfood.ts --summary-only --labeled ${labeledPath}`,
  ];
}

function resolveClient(): {
  client: ConvexHttpClient;
} {
  loadEnvFiles(process.cwd());

  const shellConvexUrl =
    process.env.CONVEX_URL ??
    process.env.VITE_CONVEX_URL ??
    process.env.NEXT_PUBLIC_CONVEX_URL;
  const structuredIdentity = buildStructuredMatchIdentity();
  const localBackendConfig = readLocalBackendConfig();
  const jwtAuthToken = process.env.CONVEX_AUTH_TOKEN ?? process.env.CONVEX_KEY;
  const useJwtPath =
    !localBackendConfig && isLikelyJwt(jwtAuthToken) && Boolean(shellConvexUrl);

  if (!localBackendConfig && !useJwtPath) {
    throw new Error(
      [
        "Missing Convex export environment.",
        "Expected either a local Convex backend state under ~/.convex/convex-backend-state, or a valid CONVEX_AUTH_TOKEN JWT plus CONVEX_URL/VITE_CONVEX_URL/NEXT_PUBLIC_CONVEX_URL.",
        "The script still loads my-app/.env and my-app/.env.local automatically before checking those fallbacks.",
      ].join("\n"),
    );
  }

  const client = localBackendConfig
    ? new ConvexHttpClient(localBackendConfig.url)
    : new ConvexHttpClient(shellConvexUrl!);

  if (localBackendConfig) {
    client.setAdminAuth(localBackendConfig.adminKey, structuredIdentity);
  } else {
    client.setAuth(jwtAuthToken!);
  }

  return { client };
}

export async function exportLiveMatchReviewRecords(args: {
  limit: number;
}): Promise<LiveMatchReviewRecord[]> {
  const { client } = resolveClient();
  return (await client.query(
    (api as any).jobsPublic.exportLiveMatchReviewRecordsForUser,
    {
      limit: Number.isFinite(args.limit) ? args.limit : 50,
    },
  )) as LiveMatchReviewRecord[];
}

export function readLiveMatchReviewRecordsFromFile(
  inputPath: string,
): LiveMatchReviewRecord[] {
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

export async function runLiveMatchReviewDogfood(
  argv: string[] = process.argv.slice(2),
): Promise<LiveMatchReviewDogfoodRunResult> {
  const options = parseDogfoodArgs(argv);

  if (options.summaryOnly) {
    if (!options.labeledPath) {
      throw new Error(
        "--summary-only requires --labeled to point at a labeled review file.",
      );
    }

    const records = readLiveMatchReviewRecordsFromFile(options.labeledPath);
    const summary = summarizeLiveMatchReviewRecords(records);
    return {
      kind: "summary",
      labeledPath: options.labeledPath,
      summary,
    };
  }

  const records = await exportLiveMatchReviewRecords({
    limit: options.limit,
  });
  writeFileSync(options.outPath, `${JSON.stringify(records, null, 2)}\n`);

  return {
    kind: "export",
    outPath: options.outPath,
    recordCount: records.length,
    nextSteps: buildLiveReviewNextSteps(
      options.labeledPath ?? "/tmp/match-review-live-labeled.json",
    ),
  };
}
