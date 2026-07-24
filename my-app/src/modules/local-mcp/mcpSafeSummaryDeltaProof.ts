import type { McpProductionReadonlySummaryToolNameV1 } from "./mcpProductionReadonlySummaryExecutor";

export type McpSafeSummaryProofIdentityRoleV8 = "A" | "B";

export type McpSafeSummarySnapshotV8 = Readonly<Record<
  McpSafeSummaryProofIdentityRoleV8,
  Readonly<Record<McpProductionReadonlySummaryToolNameV1, Readonly<Record<string, unknown>>>>
>>;

export type McpSafeSummaryDeltaProofFailureV8 =
  | "BASELINE_UNAVAILABLE"
  | "BASELINE_SATURATED"
  | "BASELINE_DRIFT";

export type McpSafeSummaryDeltaProofResultV8 = Readonly<
  | {
      accepted: true;
      exactIdentityCount: 2;
      exactQueryKindCount: 4;
      version: 1;
    }
  | {
      accepted: false;
      reason: McpSafeSummaryDeltaProofFailureV8;
      exactIdentityCount: 2;
      exactQueryKindCount: 4;
      version: 1;
    }
>;

const MAX_SAFE_COUNT = 100;
const TOOLS = Object.freeze([
  "twoweeks.application_package.summarize",
  "twoweeks.evidence_graph.summarize",
  "twoweeks.resume_variant_plan.summarize",
  "twoweeks.review_cockpit.summarize",
] as const satisfies readonly McpProductionReadonlySummaryToolNameV1[]);

const COUNT_KEYS = Object.freeze({
  "twoweeks.application_package.summarize": Object.freeze([
    "packages",
    "artifacts",
    "provenanceLinks",
    "reviewItems",
    "warnings",
    "blockers",
  ]),
  "twoweeks.evidence_graph.summarize": Object.freeze([
    "sourceDocuments",
    "candidateFacts",
    "approvedFacts",
    "pendingFacts",
    "rejectedFacts",
    "restrictedEvidence",
    "archivedEvidence",
    "provenanceLinks",
    "evidenceMatches",
    "allowedClaims",
    "missingEvidence",
    "riskFlags",
    "staleSources",
    "warnings",
    "blockers",
  ]),
  "twoweeks.resume_variant_plan.summarize": Object.freeze([
    "plans",
    "planItems",
    "claimBackedItems",
    "missingInputItems",
    "reviewNeededItems",
    "acceptedItems",
    "rejectedItems",
    "blockedItems",
    "warnings",
    "blockers",
    "restrictedFactBlockers",
    "excludedFactBlockers",
    "artifactTextBlockers",
    "allowedClaims",
    "sourceFacts",
    "evidenceMatches",
    "demands",
    "riskFlags",
  ]),
  "twoweeks.review_cockpit.summarize": Object.freeze([
    "reviewContexts",
    "reviewRuns",
    "reviewArtifacts",
    "applicationPackages",
    "pendingReviews",
    "approvedReviews",
    "blockedReviews",
    "failedRuns",
    "blockedRuns",
    "blockedArtifacts",
    "blockedPackages",
    "missingReviewItems",
    "approvalNeeded",
    "staleInputs",
    "overLimitCollections",
  ]),
} satisfies Record<McpProductionReadonlySummaryToolNameV1, readonly string[]>);

const EVIDENCE_DELTA = Object.freeze({
  sourceDocuments: 1,
  candidateFacts: 1,
  approvedFacts: 1,
} satisfies Readonly<Record<string, number>>);

const RESUME_DELTA = Object.freeze({
  plans: 1,
  planItems: 1,
  claimBackedItems: 1,
  missingInputItems: 0,
  reviewNeededItems: 1,
  acceptedItems: 0,
  rejectedItems: 0,
  blockedItems: 0,
  warnings: 0,
  blockers: 0,
  restrictedFactBlockers: 0,
  excludedFactBlockers: 0,
  artifactTextBlockers: 0,
  allowedClaims: 1,
  sourceFacts: 1,
  evidenceMatches: 0,
  demands: 0,
  riskFlags: 0,
} satisfies Readonly<Record<string, number>>);

const REVIEW_DELTA = Object.freeze({
  reviewArtifacts: 1,
  pendingReviews: 1,
  approvalNeeded: 1,
} satisfies Readonly<Record<string, number>>);

export function validateMcpSafeSummaryBaselineV8(
  baseline: McpSafeSummarySnapshotV8 | undefined,
): McpSafeSummaryDeltaProofResultV8 {
  if (!baseline) return failure("BASELINE_UNAVAILABLE");
  for (const role of ["A", "B"] as const) {
    if (!isPlainRecord(baseline[role])) return failure("BASELINE_UNAVAILABLE");
    for (const toolName of TOOLS) {
      const counts = readCounts(baseline[role][toolName], toolName);
      if (!counts) return failure("BASELINE_UNAVAILABLE");
      if (Object.values(counts).some((count) => count >= MAX_SAFE_COUNT)) {
        return failure("BASELINE_SATURATED");
      }
    }
  }
  return success();
}

export function validateMcpSafeSummaryPostSeedDeltasV8(
  baseline: McpSafeSummarySnapshotV8,
  postSeed: McpSafeSummarySnapshotV8 | undefined,
): McpSafeSummaryDeltaProofResultV8 {
  if (!isValidSnapshot(baseline)) return failure("BASELINE_UNAVAILABLE");
  if (!postSeed || !isValidSnapshot(postSeed)) return failure("BASELINE_DRIFT");
  for (const toolName of TOOLS) {
    if (!structurallyEqual(baseline.B[toolName], postSeed.B[toolName])) {
      return failure("BASELINE_DRIFT");
    }
  }
  if (!structurallyEqual(
    baseline.A["twoweeks.application_package.summarize"],
    postSeed.A["twoweeks.application_package.summarize"],
  )) {
    return failure("BASELINE_DRIFT");
  }

  const evidenceBaselineSummary = baseline.A["twoweeks.evidence_graph.summarize"];
  const evidencePostSummary = postSeed.A["twoweeks.evidence_graph.summarize"];
  const evidenceBaseline = readCounts(
    evidenceBaselineSummary,
    "twoweeks.evidence_graph.summarize",
  );
  const evidencePost = readCounts(
    evidencePostSummary,
    "twoweeks.evidence_graph.summarize",
  );
  if (
    !matchesOutsideSafeCounts(evidenceBaselineSummary, evidencePostSummary) ||
    !evidenceBaseline ||
    !evidencePost ||
    !matchesDelta(evidenceBaseline, evidencePost, EVIDENCE_DELTA)
  ) {
    return failure("BASELINE_DRIFT");
  }

  const resumeBaselineSummary = baseline.A["twoweeks.resume_variant_plan.summarize"];
  const resumePostSummary = postSeed.A["twoweeks.resume_variant_plan.summarize"];
  const resumeBaseline = readCounts(
    resumeBaselineSummary,
    "twoweeks.resume_variant_plan.summarize",
  );
  const resumePost = readCounts(
    resumePostSummary,
    "twoweeks.resume_variant_plan.summarize",
  );
  if (
    !matchesOutsideSafeCounts(resumeBaselineSummary, resumePostSummary) ||
    !resumeBaseline ||
    !resumePost ||
    resumePost.plans !== resumeBaseline.plans + 1 ||
    !matchesDelta(resumeBaseline, resumePost, RESUME_DELTA)
  ) {
    return failure("BASELINE_DRIFT");
  }

  const reviewBaselineSummary = baseline.A["twoweeks.review_cockpit.summarize"];
  const reviewPostSummary = postSeed.A["twoweeks.review_cockpit.summarize"];
  const reviewBaseline = readCounts(
    reviewBaselineSummary,
    "twoweeks.review_cockpit.summarize",
  );
  const reviewPost = readCounts(
    reviewPostSummary,
    "twoweeks.review_cockpit.summarize",
  );
  if (
    !matchesOutsideSafeCounts(reviewBaselineSummary, reviewPostSummary) ||
    !reviewBaseline ||
    !reviewPost ||
    !matchesDelta(reviewBaseline, reviewPost, REVIEW_DELTA, { staleInputs: 0 })
  ) {
    return failure("BASELINE_DRIFT");
  }

  return success();
}

function readCounts(
  summary: Readonly<Record<string, unknown>>,
  toolName: McpProductionReadonlySummaryToolNameV1,
): Readonly<Record<string, number>> | undefined {
  const value = summary.safeCounts;
  if (!isPlainRecord(value)) return undefined;
  const expectedKeys = [...COUNT_KEYS[toolName], "version"].sort();
  const actualKeys = Object.keys(value).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    value.version !== 1
  ) {
    return undefined;
  }
  const counts: Record<string, number> = {};
  for (const key of COUNT_KEYS[toolName]) {
    const count = value[key];
    if (!Number.isSafeInteger(count) || Number(count) < 0 || Number(count) > MAX_SAFE_COUNT) {
      return undefined;
    }
    counts[key] = Number(count);
  }
  return Object.freeze(counts);
}

function matchesDelta(
  baseline: Readonly<Record<string, number>>,
  postSeed: Readonly<Record<string, number>>,
  delta: Readonly<Record<string, number>>,
  exactPost: Readonly<Record<string, number>> = {},
): boolean {
  const keys = Object.keys(baseline);
  return (
    keys.length === Object.keys(postSeed).length &&
    keys.every((key) => {
      const expected = exactPost[key] ?? baseline[key] + (delta[key] ?? 0);
      return postSeed[key] === expected;
    })
  );
}

function matchesOutsideSafeCounts(
  baseline: Readonly<Record<string, unknown>>,
  postSeed: Readonly<Record<string, unknown>>,
): boolean {
  const baselineKeys = Object.keys(baseline).filter((key) => key !== "safeCounts").sort();
  const postSeedKeys = Object.keys(postSeed).filter((key) => key !== "safeCounts").sort();
  return baselineKeys.length === postSeedKeys.length &&
    baselineKeys.every(
      (key, index) =>
        key === postSeedKeys[index] &&
        structurallyEqual(baseline[key], postSeed[key]),
    );
}

function isValidSnapshot(value: unknown): value is McpSafeSummarySnapshotV8 {
  if (!isPlainRecord(value) || !isPlainRecord(value.A) || !isPlainRecord(value.B)) return false;
  for (const role of ["A", "B"] as const) {
    for (const toolName of TOOLS) {
      const counts = readCounts(value[role][toolName], toolName);
      if (!counts || Object.values(counts).some((count) => count >= MAX_SAFE_COUNT)) return false;
    }
  }
  return true;
}

function success(): McpSafeSummaryDeltaProofResultV8 {
  return Object.freeze({
    accepted: true,
    exactIdentityCount: 2,
    exactQueryKindCount: 4,
    version: 1,
  });
}

function failure(
  reason: McpSafeSummaryDeltaProofFailureV8,
): McpSafeSummaryDeltaProofResultV8 {
  return Object.freeze({
    accepted: false,
    reason,
    exactIdentityCount: 2,
    exactQueryKindCount: 4,
    version: 1,
  });
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]));
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        structurallyEqual(left[key], right[key]),
    );
}
