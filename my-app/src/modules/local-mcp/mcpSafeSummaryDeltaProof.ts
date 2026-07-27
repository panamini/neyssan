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

export type McpSafeSummaryPostSeedDeltaDiagnosticV8 = Readonly<{
  kind: "mcp_safe_summary_post_seed_delta_diagnostic";
  step: "POST_SEED_DELTA";
  check:
    | "SNAPSHOT_SHAPE"
    | "UNEXPECTED_CHANGE"
    | "DERIVED_METADATA"
    | "COUNT_SHAPE"
    | "COUNT_DELTA"
    | "SAFE_FLAGS";
  role?: McpSafeSummaryProofIdentityRoleV8;
  toolName?: McpProductionReadonlySummaryToolNameV1;
  countKey?: string;
  expected?: number;
  actual?: number;
  safeForLogging: true;
  version: 1;
}>;

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
      diagnostic?: McpSafeSummaryPostSeedDeltaDiagnosticV8;
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
  provenanceLinks: 2,
  allowedClaims: 1,
} satisfies Readonly<Record<string, number>>);

const APPLICATION_PACKAGE_DELTA = Object.freeze({
  packages: 1,
} satisfies Readonly<Record<string, number>>);

const APPLICATION_PACKAGE_EXACT_POST = Object.freeze({
  artifacts: 2,
  provenanceLinks: 2,
  reviewItems: 1,
  warnings: 0,
  blockers: 0,
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
  applicationPackages: 1,
  pendingReviews: 2,
  missingReviewItems: 1,
  approvalNeeded: 3,
} satisfies Readonly<Record<string, number>>);

const DERIVED_METADATA = Object.freeze({
  "twoweeks.application_package.summarize": Object.freeze({
    topLevel: Object.freeze(["status", "safeCategories", "updatedAt", "missingDataReason"]),
    reference: Object.freeze(["status", "count", "updatedAt"]),
    referenceKey: "packageRef",
  }),
  "twoweeks.evidence_graph.summarize": Object.freeze({
    topLevel: Object.freeze(["status", "safeCategories", "updatedAt", "missingDataReason"]),
    reference: Object.freeze(["status", "count", "updatedAt"]),
    referenceKey: "evidenceGraphRef",
  }),
  "twoweeks.resume_variant_plan.summarize": Object.freeze({
    topLevel: Object.freeze(["status", "safeCategories", "updatedAt", "missingDataReason"]),
    reference: Object.freeze(["status", "count", "updatedAt"]),
    referenceKey: "resumeVariantPlanRef",
  }),
  "twoweeks.review_cockpit.summarize": Object.freeze({
    topLevel: Object.freeze(["status", "safeCategories", "safeFlags", "updatedAt", "missingDataReason"]),
    reference: Object.freeze(["status", "count", "updatedAt"]),
    referenceKey: "reviewCockpitRef",
  }),
} satisfies Readonly<Record<
  McpProductionReadonlySummaryToolNameV1,
  Readonly<{
    topLevel: readonly string[];
    reference: readonly string[];
    referenceKey: string;
  }>
>>);

const POSITIVE_DELTAS = Object.freeze({
  "twoweeks.application_package.summarize": APPLICATION_PACKAGE_DELTA,
  "twoweeks.evidence_graph.summarize": EVIDENCE_DELTA,
  "twoweeks.resume_variant_plan.summarize": RESUME_DELTA,
  "twoweeks.review_cockpit.summarize": REVIEW_DELTA,
} satisfies Readonly<Record<
  McpProductionReadonlySummaryToolNameV1,
  Readonly<Record<string, number>>
>>);

export function validateMcpSafeSummaryBaselineV8(
  baseline: McpSafeSummarySnapshotV8 | undefined,
): McpSafeSummaryDeltaProofResultV8 {
  if (!baseline) return failure("BASELINE_UNAVAILABLE");
  for (const role of ["A", "B"] as const) {
    if (!isPlainRecord(baseline[role])) return failure("BASELINE_UNAVAILABLE");
    for (const toolName of TOOLS) {
      const counts = readCounts(baseline[role][toolName], toolName);
      if (!counts) return failure("BASELINE_UNAVAILABLE");
      if (
        toolName === "twoweeks.review_cockpit.summarize" &&
        !hasExactReviewSafeFlags(baseline[role][toolName], counts)
      ) {
        return failure("BASELINE_DRIFT");
      }
      if (Object.values(counts).some((count) => count >= MAX_SAFE_COUNT) ||
        (role === "A" && hasInsufficientHeadroom(counts, POSITIVE_DELTAS[toolName]))) {
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
  const baselineShapeDiagnostic = findSnapshotShapeDiagnostic(baseline);
  if (baselineShapeDiagnostic) {
    return failure("BASELINE_UNAVAILABLE", baselineShapeDiagnostic);
  }
  if (!postSeed) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({ check: "SNAPSHOT_SHAPE" }));
  }
  const postSeedShapeDiagnostic = findSnapshotShapeDiagnostic(postSeed);
  if (postSeedShapeDiagnostic) {
    return failure("BASELINE_DRIFT", postSeedShapeDiagnostic);
  }
  for (const toolName of TOOLS) {
    if (!structurallyEqual(baseline.B[toolName], postSeed.B[toolName])) {
      return failure("BASELINE_DRIFT", deltaDiagnostic({
        check: "UNEXPECTED_CHANGE",
        role: "B",
        toolName,
      }));
    }
  }
  const applicationPackageBaselineSummary = baseline.A["twoweeks.application_package.summarize"];
  const applicationPackagePostSummary = postSeed.A["twoweeks.application_package.summarize"];
  const applicationPackageBaseline = readCounts(
    applicationPackageBaselineSummary,
    "twoweeks.application_package.summarize",
  );
  const applicationPackagePost = readCounts(
    applicationPackagePostSummary,
    "twoweeks.application_package.summarize",
  );
  if (!matchesOutsideDerivedMetadata(
    "twoweeks.application_package.summarize",
    applicationPackageBaselineSummary,
    applicationPackagePostSummary,
  )) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "DERIVED_METADATA",
      role: "A",
      toolName: "twoweeks.application_package.summarize",
    }));
  }
  if (!applicationPackageBaseline || !applicationPackagePost) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "COUNT_SHAPE",
      role: "A",
      toolName: "twoweeks.application_package.summarize",
    }));
  }
  const applicationPackageCountDiagnostic = findCountDeltaDiagnostic(
    "twoweeks.application_package.summarize",
    applicationPackageBaseline,
    applicationPackagePost,
    APPLICATION_PACKAGE_DELTA,
    APPLICATION_PACKAGE_EXACT_POST,
  );
  if (applicationPackageCountDiagnostic) {
    return failure("BASELINE_DRIFT", applicationPackageCountDiagnostic);
  }
  if (!hasExpectedApplicationPackagePostState(
    applicationPackagePostSummary,
    applicationPackagePost.packages,
  )) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "DERIVED_METADATA",
      role: "A",
      toolName: "twoweeks.application_package.summarize",
    }));
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
  if (!matchesOutsideDerivedMetadata(
    "twoweeks.evidence_graph.summarize",
    evidenceBaselineSummary,
    evidencePostSummary,
  )) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "DERIVED_METADATA",
      role: "A",
      toolName: "twoweeks.evidence_graph.summarize",
    }));
  }
  if (!evidenceBaseline || !evidencePost) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "COUNT_SHAPE",
      role: "A",
      toolName: "twoweeks.evidence_graph.summarize",
    }));
  }
  const evidenceStalenessDiagnostic = findEvidenceStalenessDiagnostic(
    evidenceBaseline,
    evidencePost,
  );
  if (evidenceStalenessDiagnostic) {
    return failure("BASELINE_DRIFT", evidenceStalenessDiagnostic);
  }
  const evidenceCountDiagnostic = findCountDeltaDiagnostic(
    "twoweeks.evidence_graph.summarize",
    evidenceBaseline,
    evidencePost,
    EVIDENCE_DELTA,
    {
      staleSources: evidencePost.staleSources,
      warnings: evidencePost.warnings,
    },
  );
  if (evidenceCountDiagnostic) {
    return failure("BASELINE_DRIFT", evidenceCountDiagnostic);
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
  if (!matchesOutsideDerivedMetadata(
    "twoweeks.resume_variant_plan.summarize",
    resumeBaselineSummary,
    resumePostSummary,
  )) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "DERIVED_METADATA",
      role: "A",
      toolName: "twoweeks.resume_variant_plan.summarize",
    }));
  }
  if (!resumeBaseline || !resumePost) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "COUNT_SHAPE",
      role: "A",
      toolName: "twoweeks.resume_variant_plan.summarize",
    }));
  }
  const resumeCountDiagnostic = findCountDeltaDiagnostic(
    "twoweeks.resume_variant_plan.summarize",
    resumeBaseline,
    resumePost,
    RESUME_DELTA,
  );
  if (resumeCountDiagnostic) {
    return failure("BASELINE_DRIFT", resumeCountDiagnostic);
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
  if (!reviewBaseline || !reviewPost) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "COUNT_SHAPE",
      role: "A",
      toolName: "twoweeks.review_cockpit.summarize",
    }));
  }
  if (
    !hasExactReviewSafeFlags(reviewBaselineSummary, reviewBaseline) ||
    !hasExactReviewSafeFlags(reviewPostSummary, reviewPost)
  ) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "SAFE_FLAGS",
      role: "A",
      toolName: "twoweeks.review_cockpit.summarize",
    }));
  }
  if (!matchesOutsideDerivedMetadata(
    "twoweeks.review_cockpit.summarize",
    reviewBaselineSummary,
    reviewPostSummary,
  )) {
    return failure("BASELINE_DRIFT", deltaDiagnostic({
      check: "DERIVED_METADATA",
      role: "A",
      toolName: "twoweeks.review_cockpit.summarize",
    }));
  }
  const reviewCountDiagnostic = findCountDeltaDiagnostic(
    "twoweeks.review_cockpit.summarize",
    reviewBaseline,
    reviewPost,
    REVIEW_DELTA,
    { staleInputs: 0 },
  );
  if (reviewCountDiagnostic) {
    return failure("BASELINE_DRIFT", reviewCountDiagnostic);
  }

  return success();
}

function hasExactReviewSafeFlags(
  summary: Readonly<Record<string, unknown>>,
  counts: Readonly<Record<string, number>>,
): boolean {
  return structurallyEqual(summary.safeFlags, {
    approvalNeeded: counts.approvalNeeded > 0,
    staleData: counts.staleInputs > 0,
    overLimit: counts.overLimitCollections > 0,
    version: 1,
  });
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

function findCountDeltaDiagnostic(
  toolName: McpProductionReadonlySummaryToolNameV1,
  baseline: Readonly<Record<string, number>>,
  postSeed: Readonly<Record<string, number>>,
  delta: Readonly<Record<string, number>>,
  exactPost: Readonly<Record<string, number>> = {},
): McpSafeSummaryPostSeedDeltaDiagnosticV8 | undefined {
  const keys = Object.keys(baseline);
  if (keys.length !== Object.keys(postSeed).length) {
    return deltaDiagnostic({ check: "COUNT_SHAPE", role: "A", toolName });
  }
  for (const key of keys) {
    const expected = exactPost[key] ?? baseline[key] + (delta[key] ?? 0);
    const actual = postSeed[key];
    if (actual !== expected) {
      return deltaDiagnostic({
        check: "COUNT_DELTA",
        role: "A",
        toolName,
        countKey: key,
        expected,
        actual,
      });
    }
  }
  return undefined;
}

function findEvidenceStalenessDiagnostic(
  baseline: Readonly<Record<string, number>>,
  postSeed: Readonly<Record<string, number>>,
): McpSafeSummaryPostSeedDeltaDiagnosticV8 | undefined {
  if (postSeed.staleSources < baseline.staleSources) {
    return deltaDiagnostic({
      check: "COUNT_DELTA",
      role: "A",
      toolName: "twoweeks.evidence_graph.summarize",
      countKey: "staleSources",
      expected: baseline.staleSources,
      actual: postSeed.staleSources,
    });
  }
  const maximumStaleSources = postSeed.sourceDocuments + postSeed.candidateFacts;
  if (postSeed.staleSources > maximumStaleSources) {
    return deltaDiagnostic({
      check: "COUNT_DELTA",
      role: "A",
      toolName: "twoweeks.evidence_graph.summarize",
      countKey: "staleSources",
      expected: maximumStaleSources,
      actual: postSeed.staleSources,
    });
  }
  const staleSourceDelta = postSeed.staleSources - baseline.staleSources;
  const expectedWarnings = baseline.warnings + staleSourceDelta;
  if (postSeed.warnings !== expectedWarnings) {
    return deltaDiagnostic({
      check: "COUNT_DELTA",
      role: "A",
      toolName: "twoweeks.evidence_graph.summarize",
      countKey: "warnings",
      expected: expectedWarnings,
      actual: postSeed.warnings,
    });
  }
  return undefined;
}

function hasExpectedApplicationPackagePostState(
  summary: Readonly<Record<string, unknown>>,
  expectedPackageCount: number,
): boolean {
  const packageRef = summary.packageRef;
  const safeCategories = summary.safeCategories;
  return summary.status === "available" &&
    !Object.prototype.hasOwnProperty.call(summary, "missingDataReason") &&
    isPlainRecord(packageRef) &&
    packageRef.status === "available" &&
    packageRef.count === expectedPackageCount &&
    isPlainRecord(safeCategories) &&
    structurallyEqual(safeCategories, {
      packageStatus: "needs_review",
      resumeVariantArtifactStatus: "draft",
      coverLetterArtifactStatus: "needs_review",
      version: 1,
    });
}

function hasInsufficientHeadroom(
  counts: Readonly<Record<string, number>>,
  positiveDelta: Readonly<Record<string, number>>,
): boolean {
  return Object.entries(positiveDelta).some(([key, delta]) =>
    delta > 0 && counts[key] + delta >= MAX_SAFE_COUNT,
  );
}

function matchesOutsideDerivedMetadata(
  toolName: McpProductionReadonlySummaryToolNameV1,
  baseline: Readonly<Record<string, unknown>>,
  postSeed: Readonly<Record<string, unknown>>,
): boolean {
  const normalizedBaseline = normalizeForPostSeedComparison(toolName, baseline);
  const normalizedPostSeed = normalizeForPostSeedComparison(toolName, postSeed);
  return structurallyEqual(normalizedBaseline, normalizedPostSeed);
}

function normalizeForPostSeedComparison(
  toolName: McpProductionReadonlySummaryToolNameV1,
  summary: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const metadata = DERIVED_METADATA[toolName as keyof typeof DERIVED_METADATA];
  const normalized = Object.fromEntries(
    Object.entries(summary).filter(([key]) => key !== "safeCounts"),
  );
  if (!metadata) return normalized;

  for (const key of metadata.topLevel) delete normalized[key];
  const reference = normalized[metadata.referenceKey];
  if (isPlainRecord(reference)) {
    const invariantReference = Object.fromEntries(
      Object.entries(reference).filter(([key]) => !metadata.reference.includes(key)),
    );
    if (Object.keys(invariantReference).length === 0) {
      delete normalized[metadata.referenceKey];
    } else {
      normalized[metadata.referenceKey] = invariantReference;
    }
  }
  return normalized;
}

function findSnapshotShapeDiagnostic(
  value: unknown,
): McpSafeSummaryPostSeedDeltaDiagnosticV8 | undefined {
  if (!isPlainRecord(value) || !isPlainRecord(value.A) || !isPlainRecord(value.B)) {
    return deltaDiagnostic({ check: "SNAPSHOT_SHAPE" });
  }
  for (const role of ["A", "B"] as const) {
    const summaries = value[role];
    if (!isPlainRecord(summaries)) {
      return deltaDiagnostic({ check: "SNAPSHOT_SHAPE" });
    }
    for (const toolName of TOOLS) {
      const summary = summaries[toolName];
      if (!isPlainRecord(summary)) {
        return deltaDiagnostic({ check: "SNAPSHOT_SHAPE", role, toolName });
      }
      const counts = readCounts(summary, toolName);
      if (!counts || Object.values(counts).some((count) => count >= MAX_SAFE_COUNT)) {
        return deltaDiagnostic({ check: "COUNT_SHAPE", role, toolName });
      }
    }
  }
  return undefined;
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
  diagnostic?: McpSafeSummaryPostSeedDeltaDiagnosticV8,
): McpSafeSummaryDeltaProofResultV8 {
  return Object.freeze({
    accepted: false,
    reason,
    ...(diagnostic ? { diagnostic } : {}),
    exactIdentityCount: 2,
    exactQueryKindCount: 4,
    version: 1,
  });
}

function deltaDiagnostic(
  input: Omit<
    McpSafeSummaryPostSeedDeltaDiagnosticV8,
    "kind" | "step" | "safeForLogging" | "version"
  >,
): McpSafeSummaryPostSeedDeltaDiagnosticV8 {
  return Object.freeze({
    kind: "mcp_safe_summary_post_seed_delta_diagnostic",
    step: "POST_SEED_DELTA",
    ...input,
    safeForLogging: true,
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
