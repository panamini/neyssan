import { readFileSync } from "node:fs";

import {
  STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS,
  STRUCTURED_MATCH_REVIEW_LABELS,
  STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES,
  buildStructuredMatchReviewReadout,
  type StructuredMatchReviewCase,
} from "../../convex/lib/jobs/structuredMatchReview";

function usage(): never {
  throw new Error(
    [
      "Usage: npx tsx scripts/evals/summarize-structured-match-review.ts <reviews.json|reviews.jsonl> [--json]",
      "",
      "Input may be either a JSON array, { \"cases\": [...] }, or newline-delimited JSON review cases.",
    ].join("\n"),
  );
}

function parseReviewCases(path: string): StructuredMatchReviewCase[] {
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as StructuredMatchReviewCase[];
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { cases?: unknown }).cases)
    ) {
      return (parsed as { cases: StructuredMatchReviewCase[] }).cases;
    }
    throw new Error("JSON input must be an array or an object with a cases array.");
  } catch (error) {
    if (error instanceof SyntaxError) {
      return raw
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as StructuredMatchReviewCase);
    }
    throw error;
  }
}

function formatCountMap<T extends string>(entries: Record<T, number>): string[] {
  return Object.entries(entries)
    .map(([key, value]) => `- ${key}: ${value}`)
    .sort();
}

function formatMarkdown(readout: ReturnType<typeof buildStructuredMatchReviewReadout>): string {
  const sections = [
    "# Structured Match Internal Beta Readout",
    "",
    `Reviewed cases: ${readout.reviewedCaseCount}`,
    `Rollout gate: ${readout.rolloutGate.status}`,
    "",
    "## Coverage",
    ...formatCountMap(readout.coverageByCategory),
    "",
    "## Label Counts",
    ...formatCountMap(readout.labelCounts).filter((line) => !line.endsWith(": 0")),
    "",
    "## Extraction Verdict Counts",
    "### Summary",
    ...formatCountMap(readout.extractionVerdictCounts.summary).filter(
      (line) => !line.endsWith(": 0"),
    ),
    "### Requirements",
    ...formatCountMap(readout.extractionVerdictCounts.requirements).filter(
      (line) => !line.endsWith(": 0"),
    ),
    "### Keywords",
    ...formatCountMap(readout.extractionVerdictCounts.keywords).filter(
      (line) => !line.endsWith(": 0"),
    ),
    "",
    "## Rollout Gate Reasons",
    ...(readout.rolloutGate.reasons.length > 0
      ? readout.rolloutGate.reasons.map((reason) => `- ${reason}`)
      : ["- none"]),
    "",
    "## Recommended Next Actions",
    ...(readout.recommendedNextActions.length > 0
      ? readout.recommendedNextActions.map((action) => `- ${action}`)
      : ["- none"]),
    "",
    "## Example Buckets",
    ...Object.entries(readout.examples).flatMap(([kind, examples]) => [
      `### ${kind}`,
      ...(examples.length > 0
        ? examples.map(
            (example) =>
              `- ${example.caseId} (${example.category}, ${example.structuredTier ?? "null"} ${example.structuredScore ?? "null"}): ${example.labels.join(", ")}${example.note ? ` - ${example.note}` : ""}`,
          )
        : ["- none"]),
      "",
    ]),
  ];

  return sections.join("\n");
}

function validateLiteralSet(
  values: readonly string[],
  allowed: readonly string[],
  fieldName: string,
  caseId: string,
) {
  const invalid = values.filter((value) => !allowed.includes(value));
  if (invalid.length > 0) {
    throw new Error(`${caseId} has invalid ${fieldName}: ${invalid.join(", ")}`);
  }
}

function validateReviewCases(cases: StructuredMatchReviewCase[]) {
  for (const reviewCase of cases) {
    if (!reviewCase.caseId) {
      throw new Error("Every review case must include caseId.");
    }
    if (!reviewCase.appGitCommitSha) {
      throw new Error(
        `${reviewCase.caseId} is invalid for rollout decisions: missing appGitCommitSha.`,
      );
    }
    if (!reviewCase.structuredScorerVersion) {
      throw new Error(
        `${reviewCase.caseId} is invalid for rollout decisions: missing structuredScorerVersion.`,
      );
    }
    if (!reviewCase.extractionModel) {
      throw new Error(
        `${reviewCase.caseId} is invalid for rollout decisions: missing extractionModel.`,
      );
    }
    if (!reviewCase.extractionPromptVersion) {
      throw new Error(
        `${reviewCase.caseId} is invalid for rollout decisions: missing extractionPromptVersion.`,
      );
    }
    if (typeof reviewCase.reviewedAt !== "number") {
      throw new Error(
        `${reviewCase.caseId} is invalid for rollout decisions: missing reviewedAt.`,
      );
    }
    validateLiteralSet(
      [reviewCase.category],
      STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES,
      "category",
      reviewCase.caseId,
    );
    validateLiteralSet(
      reviewCase.labels,
      STRUCTURED_MATCH_REVIEW_LABELS,
      "labels",
      reviewCase.caseId,
    );
    for (const [fieldName, verdict] of [
      ["extractionSummaryVerdict", reviewCase.extractionSummaryVerdict],
      ["extractionRequirementsVerdict", reviewCase.extractionRequirementsVerdict],
      ["extractionKeywordsVerdict", reviewCase.extractionKeywordsVerdict],
    ] as const) {
      if (verdict === undefined) {
        continue;
      }
      validateLiteralSet(
        [verdict],
        STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS,
        fieldName,
        reviewCase.caseId,
      );
    }
  }
}

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const jsonOutput = args.includes("--json");

if (!inputPath) {
  usage();
}

const reviewCases = parseReviewCases(inputPath);
validateReviewCases(reviewCases);
const readout = buildStructuredMatchReviewReadout(reviewCases);

console.log(jsonOutput ? JSON.stringify(readout, null, 2) : formatMarkdown(readout));
