import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

type McpEvidenceGraphSummaryStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required";

type McpEvidenceGraphSummaryMissingDataReasonV1 =
  | "evidence_graph_not_available"
  | "owner_onboarding_required";

type McpEvidenceGraphSummaryRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpEvidenceGraphSummaryStatusV1;
  category: "evidence_graph";
  count: number;
  updatedAt?: string;
  version: 1;
}>;

type McpEvidenceGraphSummaryResultV1 = Readonly<{
  kind: "mcp_evidence_graph_summary_result";
  allowed: true;
  status: McpEvidenceGraphSummaryStatusV1;
  evidenceGraphRef: McpEvidenceGraphSummaryRefV1;
  availability: {
    source: "convex_evidence_graph_summary";
    ownerState: "resolved" | "onboarding_required";
    version: 1;
  };
  safeCounts: {
    sourceDocuments: number;
    candidateFacts: number;
    approvedFacts: number;
    pendingFacts: number;
    rejectedFacts: number;
    restrictedEvidence: number;
    provenanceLinks: number;
    evidenceMatches: number;
    allowedClaims: number;
    missingEvidence: number;
    riskFlags: number;
    staleSources: number;
    warnings: number;
    blockers: number;
    version: 1;
  };
  safeCategories: {
    evidenceCoverage?: "complete" | "partial" | "missing" | "unknown";
    provenanceCoverage?: "complete" | "partial" | "missing" | "unknown";
    qualityStatus?: "ready_for_review" | "needs_review" | "blocked" | "unknown";
    blockerCategory?:
      | "missing_evidence"
      | "restricted_evidence"
      | "stale_sources"
      | "unsupported"
      | "none";
    nextReviewHint?:
      | "add_candidate_evidence"
      | "review_missing_evidence"
      | "review_restricted_evidence"
      | "refresh_stale_sources"
      | "ready_for_review";
    version: 1;
  };
  updatedAt?: string;
  missingDataReason?: McpEvidenceGraphSummaryMissingDataReasonV1;
  capabilities: {
    ownerResolution: "blocked" | "server_only";
    dataReads: "convex_evidence_graph_summary";
    dataWrites: "blocked";
    handlerExecution: "blocked";
    productionConnector: "blocked";
    networkAccess: "blocked";
    modelCalls: "blocked";
    writeActions: "blocked";
    rawDataProjection: "blocked";
    version: 1;
  };
  modelVisible: true;
  version: 1;
}>;

type IndexQueryBuilder = {
  eq: (field: string, value: unknown) => IndexQueryBuilder;
};

type DbReader = Readonly<{
  query: (tableName: string) => {
    withIndex: (
      indexName: string,
      buildQuery: (query: IndexQueryBuilder) => unknown,
    ) => {
      collect?: () => Promise<readonly Record<string, unknown>[]>;
      take?: (limit: number) => Promise<readonly Record<string, unknown>[]>;
      order?: (direction: "asc" | "desc") => {
        collect?: () => Promise<readonly Record<string, unknown>[]>;
        take?: (limit: number) => Promise<readonly Record<string, unknown>[]>;
      };
    };
  };
}>;

const MAX_SAFE_COUNT = 100;

const mcpEvidenceGraphSummaryStatusValidator = v.union(
  v.literal("available"),
  v.literal("no_data_available"),
  v.literal("onboarding_required"),
);

const mcpEvidenceGraphRefValidator = v.object({
  id: v.string(),
  label: v.string(),
  status: mcpEvidenceGraphSummaryStatusValidator,
  category: v.literal("evidence_graph"),
  count: v.number(),
  updatedAt: v.optional(v.string()),
  version: v.literal(1),
});

const mcpEvidenceGraphSummaryResultValidator = v.object({
  kind: v.literal("mcp_evidence_graph_summary_result"),
  allowed: v.literal(true),
  status: mcpEvidenceGraphSummaryStatusValidator,
  evidenceGraphRef: mcpEvidenceGraphRefValidator,
  availability: v.object({
    source: v.literal("convex_evidence_graph_summary"),
    ownerState: v.union(v.literal("resolved"), v.literal("onboarding_required")),
    version: v.literal(1),
  }),
  safeCounts: v.object({
    sourceDocuments: v.number(),
    candidateFacts: v.number(),
    approvedFacts: v.number(),
    pendingFacts: v.number(),
    rejectedFacts: v.number(),
    restrictedEvidence: v.number(),
    provenanceLinks: v.number(),
    evidenceMatches: v.number(),
    allowedClaims: v.number(),
    missingEvidence: v.number(),
    riskFlags: v.number(),
    staleSources: v.number(),
    warnings: v.number(),
    blockers: v.number(),
    version: v.literal(1),
  }),
  safeCategories: v.object({
    evidenceCoverage: v.optional(
      v.union(v.literal("complete"), v.literal("partial"), v.literal("missing"), v.literal("unknown")),
    ),
    provenanceCoverage: v.optional(
      v.union(v.literal("complete"), v.literal("partial"), v.literal("missing"), v.literal("unknown")),
    ),
    qualityStatus: v.optional(
      v.union(
        v.literal("ready_for_review"),
        v.literal("needs_review"),
        v.literal("blocked"),
        v.literal("unknown"),
      ),
    ),
    blockerCategory: v.optional(
      v.union(
        v.literal("missing_evidence"),
        v.literal("restricted_evidence"),
        v.literal("stale_sources"),
        v.literal("unsupported"),
        v.literal("none"),
      ),
    ),
    nextReviewHint: v.optional(
      v.union(
        v.literal("add_candidate_evidence"),
        v.literal("review_missing_evidence"),
        v.literal("review_restricted_evidence"),
        v.literal("refresh_stale_sources"),
        v.literal("ready_for_review"),
      ),
    ),
    version: v.literal(1),
  }),
  updatedAt: v.optional(v.string()),
  missingDataReason: v.optional(
    v.union(v.literal("evidence_graph_not_available"), v.literal("owner_onboarding_required")),
  ),
  capabilities: v.object({
    ownerResolution: v.union(v.literal("blocked"), v.literal("server_only")),
    dataReads: v.literal("convex_evidence_graph_summary"),
    dataWrites: v.literal("blocked"),
    handlerExecution: v.literal("blocked"),
    productionConnector: v.literal("blocked"),
    networkAccess: v.literal("blocked"),
    modelCalls: v.literal("blocked"),
    writeActions: v.literal("blocked"),
    rawDataProjection: v.literal("blocked"),
    version: v.literal(1),
  }),
  modelVisible: v.literal(true),
  version: v.literal(1),
});

export const internalSummarizeMcpEvidenceGraph = internalQuery({
  args: {
    twoweeksClerkId: v.string(),
    evidenceGraphRef: mcpEvidenceGraphRefValidator,
  },
  returns: mcpEvidenceGraphSummaryResultValidator,
  handler: async (ctx, args): Promise<McpEvidenceGraphSummaryResultV1> => {
    return await summarizeMcpEvidenceGraph(ctx.db, args);
  },
});

async function summarizeMcpEvidenceGraph(
  db: DbReader,
  args: Readonly<{
    twoweeksClerkId: string;
    evidenceGraphRef: McpEvidenceGraphSummaryRefV1;
  }>,
): Promise<McpEvidenceGraphSummaryResultV1> {
  const evidenceGraphRef = normalizeEvidenceGraphRef(args.evidenceGraphRef);
  if (evidenceGraphRef.status === "onboarding_required") {
    return buildUnavailableSummary(evidenceGraphRef, "owner_onboarding_required", "blocked");
  }
  if (evidenceGraphRef.status === "no_data_available") {
    return buildUnavailableSummary(evidenceGraphRef, "evidence_graph_not_available", "server_only");
  }

  const profile = await readPrimaryProfileForOwner(db, args.twoweeksClerkId);
  if (!profile) {
    return buildUnavailableSummary(
      { ...evidenceGraphRef, status: "onboarding_required", count: 0 },
      "owner_onboarding_required",
      "blocked",
    );
  }

  const ownerStorageRef = String(profile._id);
  const [sourceDocuments, candidateFacts, applicationPackages, evidenceRuns] = await Promise.all([
    queryByFields(db, "candidateSourceDocuments", "by_user_id", [
      { field: "userId", value: ownerStorageRef },
    ]),
    queryByFields(db, "candidateFacts", "by_user_id", [{ field: "userId", value: ownerStorageRef }]),
    queryByFields(db, "applicationPackages", "by_user_id", [
      { field: "userId", value: ownerStorageRef },
    ]),
    queryByFields(db, "applicationRuns", "by_user_operation", [
      { field: "userId", value: ownerStorageRef },
      { field: "operation", value: "build_evidence_graph" },
    ]),
  ]);

  const safeCounts = buildSafeCounts({
    sourceDocuments,
    candidateFacts,
    applicationPackages,
    evidenceRuns,
  });
  if (safeCounts.sourceDocuments + safeCounts.candidateFacts + safeCounts.provenanceLinks === 0) {
    return buildUnavailableSummary(
      { ...evidenceGraphRef, status: "no_data_available", count: 0 },
      "evidence_graph_not_available",
      "server_only",
    );
  }

  const latestUpdatedAt = maxUpdatedAt([
    ...sourceDocuments,
    ...candidateFacts,
    ...applicationPackages,
    ...evidenceRuns,
  ]);

  return {
    kind: "mcp_evidence_graph_summary_result",
    allowed: true,
    status: "available",
    evidenceGraphRef: {
      ...evidenceGraphRef,
      status: "available",
      count: clampSafeCount(safeCounts.sourceDocuments + safeCounts.candidateFacts),
      ...(latestUpdatedAt ? { updatedAt: latestUpdatedAt } : {}),
    },
    availability: {
      source: "convex_evidence_graph_summary",
      ownerState: "resolved",
      version: 1,
    },
    safeCounts,
    safeCategories: buildSafeCategories(safeCounts),
    ...(latestUpdatedAt ? { updatedAt: latestUpdatedAt } : {}),
    capabilities: buildCapabilities("server_only"),
    modelVisible: true,
    version: 1,
  };
}

async function readPrimaryProfileForOwner(
  db: DbReader,
  twoweeksClerkId: string,
): Promise<Record<string, unknown> | null> {
  const profiles = await queryByFields(db, "userProfiles", "by_clerk_id", [
    { field: "clerkId", value: twoweeksClerkId },
  ]);
  if (profiles.length === 0) return null;
  return [...profiles].sort(compareLatestProfile)[0] ?? null;
}

async function queryByFields(
  db: DbReader,
  tableName: string,
  indexName: string,
  constraints: readonly { field: string; value: unknown }[],
): Promise<readonly Record<string, unknown>[]> {
  const indexedQuery = db.query(tableName).withIndex(indexName, (query) => {
    let nextQuery = query;
    for (const constraint of constraints) {
      nextQuery = nextQuery.eq(constraint.field, constraint.value);
    }
    return nextQuery;
  });
  if (typeof indexedQuery.collect === "function") return await indexedQuery.collect();
  if (typeof indexedQuery.take === "function") return await indexedQuery.take(MAX_SAFE_COUNT);
  const orderedQuery = indexedQuery.order?.("desc");
  if (typeof orderedQuery?.collect === "function") return await orderedQuery.collect();
  if (typeof orderedQuery?.take === "function") return await orderedQuery.take(MAX_SAFE_COUNT);
  return [];
}

function buildUnavailableSummary(
  evidenceGraphRef: McpEvidenceGraphSummaryRefV1,
  missingDataReason: McpEvidenceGraphSummaryMissingDataReasonV1,
  ownerResolution: "blocked" | "server_only",
): McpEvidenceGraphSummaryResultV1 {
  return {
    kind: "mcp_evidence_graph_summary_result",
    allowed: true,
    status: evidenceGraphRef.status,
    evidenceGraphRef: { ...evidenceGraphRef, count: 0 },
    availability: {
      source: "convex_evidence_graph_summary",
      ownerState: evidenceGraphRef.status === "onboarding_required" ? "onboarding_required" : "resolved",
      version: 1,
    },
    safeCounts: zeroCounts(),
    safeCategories: { version: 1 },
    missingDataReason,
    capabilities: buildCapabilities(ownerResolution),
    modelVisible: true,
    version: 1,
  };
}

function buildSafeCounts(input: Readonly<{
  sourceDocuments: readonly Record<string, unknown>[];
  candidateFacts: readonly Record<string, unknown>[];
  applicationPackages: readonly Record<string, unknown>[];
  evidenceRuns: readonly Record<string, unknown>[];
}>): McpEvidenceGraphSummaryResultV1["safeCounts"] {
  const sourceDocuments = input.sourceDocuments;
  const candidateFacts = input.candidateFacts;
  const applicationPackages = input.applicationPackages;
  const evidenceRuns = input.evidenceRuns;
  const latestPackageTimestamp = maxFiniteTimestamp(applicationPackages);
  const safeSourceDocuments = sourceDocuments.filter(isUsableEvidenceRow);
  const safeCandidateFacts = candidateFacts.filter(isUsableEvidenceRow);
  const approvedFacts = candidateFacts.filter(isApprovedFact);
  const pendingFacts = candidateFacts.filter(isPendingFact);
  const rejectedFacts = candidateFacts.filter(isRejectedEvidenceRow);
  const restrictedEvidence = [...sourceDocuments, ...candidateFacts].filter(isRestrictedEvidenceRow);
  const provenance = summarizeProvenance(applicationPackages);
  const staleSources = latestPackageTimestamp > 0
    ? [...safeSourceDocuments, ...safeCandidateFacts].filter((row) => {
        const updatedAt = readFiniteTimestamp(row.updatedAt) || readFiniteTimestamp(row.createdAt);
        return updatedAt > 0 && updatedAt < latestPackageTimestamp;
      }).length
    : 0;
  const blockedRuns = evidenceRuns.filter((row) => row.status === "blocked").length;
  const blockedPackages = applicationPackages.filter((row) => row.status === "blocked").length;
  const blockers = clampSafeCount(blockedRuns + blockedPackages + (provenance.missingEvidence > 0 ? 1 : 0));
  const warnings = clampSafeCount(pendingFacts.length + staleSources + provenance.riskFlags);

  return {
    sourceDocuments: clampSafeCount(safeSourceDocuments.length),
    candidateFacts: clampSafeCount(safeCandidateFacts.length),
    approvedFacts: clampSafeCount(approvedFacts.length),
    pendingFacts: clampSafeCount(pendingFacts.length),
    rejectedFacts: clampSafeCount(rejectedFacts.length),
    restrictedEvidence: clampSafeCount(restrictedEvidence.length),
    provenanceLinks: provenance.provenanceLinks,
    evidenceMatches: provenance.evidenceMatches,
    allowedClaims: provenance.allowedClaims,
    missingEvidence: provenance.missingEvidence,
    riskFlags: provenance.riskFlags,
    staleSources: clampSafeCount(staleSources),
    warnings,
    blockers,
    version: 1,
  };
}

function summarizeProvenance(
  applicationPackages: readonly Record<string, unknown>[],
): Pick<
  McpEvidenceGraphSummaryResultV1["safeCounts"],
  "provenanceLinks" | "evidenceMatches" | "allowedClaims" | "missingEvidence" | "riskFlags"
> {
  const sourceFactLinks = sumStringArrayCounts(applicationPackages, "sourceFactIds");
  const allowedClaims = sumStringArrayCounts(applicationPackages, "allowedClaimIds");
  const evidenceMatches = sumStringArrayCounts(applicationPackages, "evidenceMatchIds");
  const demands = sumStringArrayCounts(applicationPackages, "demandIds");
  const riskFlags = sumStringArrayCounts(applicationPackages, "riskFlagIds");
  return {
    provenanceLinks: clampSafeCount(sourceFactLinks + allowedClaims + evidenceMatches + demands + riskFlags),
    evidenceMatches: clampSafeCount(evidenceMatches),
    allowedClaims: clampSafeCount(allowedClaims),
    missingEvidence: clampSafeCount(Math.max(0, demands - evidenceMatches)),
    riskFlags: clampSafeCount(riskFlags),
  };
}

function buildSafeCategories(
  counts: McpEvidenceGraphSummaryResultV1["safeCounts"],
): McpEvidenceGraphSummaryResultV1["safeCategories"] {
  const evidenceCoverage = readEvidenceCoverage(counts);
  const provenanceCoverage = readProvenanceCoverage(counts);
  const qualityStatus = readQualityStatus(counts, evidenceCoverage);
  return {
    evidenceCoverage,
    provenanceCoverage,
    qualityStatus,
    blockerCategory: readBlockerCategory(counts),
    nextReviewHint: readNextReviewHint(counts, qualityStatus),
    version: 1,
  };
}

function readEvidenceCoverage(
  counts: McpEvidenceGraphSummaryResultV1["safeCounts"],
): NonNullable<McpEvidenceGraphSummaryResultV1["safeCategories"]["evidenceCoverage"]> {
  const usableEvidenceCount = counts.sourceDocuments + counts.candidateFacts;
  if (usableEvidenceCount === 0) return "missing";
  if (counts.approvedFacts > 0 && counts.missingEvidence === 0) return "complete";
  return "partial";
}

function readProvenanceCoverage(
  counts: McpEvidenceGraphSummaryResultV1["safeCounts"],
): NonNullable<McpEvidenceGraphSummaryResultV1["safeCategories"]["provenanceCoverage"]> {
  if (counts.provenanceLinks > 0) {
    return counts.missingEvidence === 0 ? "complete" : "partial";
  }
  return counts.sourceDocuments + counts.candidateFacts > 0 ? "partial" : "missing";
}

function readQualityStatus(
  counts: McpEvidenceGraphSummaryResultV1["safeCounts"],
  evidenceCoverage: NonNullable<McpEvidenceGraphSummaryResultV1["safeCategories"]["evidenceCoverage"]>,
): NonNullable<McpEvidenceGraphSummaryResultV1["safeCategories"]["qualityStatus"]> {
  if (counts.blockers > 0) return "blocked";
  if (counts.warnings > 0 || counts.restrictedEvidence > 0) return "needs_review";
  if (evidenceCoverage === "complete") return "ready_for_review";
  return "unknown";
}

function readBlockerCategory(
  counts: McpEvidenceGraphSummaryResultV1["safeCounts"],
): NonNullable<McpEvidenceGraphSummaryResultV1["safeCategories"]["blockerCategory"]> {
  if (counts.missingEvidence > 0) return "missing_evidence";
  if (counts.restrictedEvidence > 0) return "restricted_evidence";
  if (counts.staleSources > 0) return "stale_sources";
  if (counts.blockers > 0 || counts.riskFlags > 0) return "unsupported";
  return "none";
}

function readNextReviewHint(
  counts: McpEvidenceGraphSummaryResultV1["safeCounts"],
  qualityStatus: NonNullable<McpEvidenceGraphSummaryResultV1["safeCategories"]["qualityStatus"]>,
): NonNullable<McpEvidenceGraphSummaryResultV1["safeCategories"]["nextReviewHint"]> {
  if (counts.sourceDocuments + counts.candidateFacts === 0) return "add_candidate_evidence";
  if (counts.missingEvidence > 0) return "review_missing_evidence";
  if (counts.restrictedEvidence > 0) return "review_restricted_evidence";
  if (counts.staleSources > 0) return "refresh_stale_sources";
  if (qualityStatus === "ready_for_review") return "ready_for_review";
  return "review_missing_evidence";
}

function buildCapabilities(
  ownerResolution: McpEvidenceGraphSummaryResultV1["capabilities"]["ownerResolution"],
): McpEvidenceGraphSummaryResultV1["capabilities"] {
  return {
    ownerResolution,
    dataReads: "convex_evidence_graph_summary",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    rawDataProjection: "blocked",
    version: 1,
  };
}

function zeroCounts(): McpEvidenceGraphSummaryResultV1["safeCounts"] {
  return {
    sourceDocuments: 0,
    candidateFacts: 0,
    approvedFacts: 0,
    pendingFacts: 0,
    rejectedFacts: 0,
    restrictedEvidence: 0,
    provenanceLinks: 0,
    evidenceMatches: 0,
    allowedClaims: 0,
    missingEvidence: 0,
    riskFlags: 0,
    staleSources: 0,
    warnings: 0,
    blockers: 0,
    version: 1,
  };
}

function normalizeEvidenceGraphRef(
  evidenceGraphRef: McpEvidenceGraphSummaryRefV1,
): McpEvidenceGraphSummaryRefV1 {
  return {
    id: "mcp-safe-ref:evidence-graph:profile",
    label: "Candidate evidence availability",
    status: evidenceGraphRef.status,
    category: "evidence_graph",
    count: clampSafeCount(evidenceGraphRef.count),
    ...(isIsoTimestamp(evidenceGraphRef.updatedAt) ? { updatedAt: evidenceGraphRef.updatedAt } : {}),
    version: 1,
  };
}

function isUsableEvidenceRow(row: Record<string, unknown>): boolean {
  return row.visibility === "use_in_applications" && !isRejectedEvidenceRow(row);
}

function isApprovedFact(row: Record<string, unknown>): boolean {
  return row.visibility === "use_in_applications" && row.reviewState === "approved";
}

function isPendingFact(row: Record<string, unknown>): boolean {
  return (
    row.visibility === "use_in_applications" &&
    (row.reviewState === "pending" || row.reviewState === "needs_review")
  );
}

function isRejectedEvidenceRow(row: Record<string, unknown>): boolean {
  return row.reviewState === "rejected" || row.reviewState === "archived";
}

function isRestrictedEvidenceRow(row: Record<string, unknown>): boolean {
  return row.visibility === "private" || row.visibility === "never_use";
}

function sumStringArrayCounts(
  rows: readonly Record<string, unknown>[],
  key: string,
): number {
  return rows.reduce((sum, row) => sum + countStringArray(row[key]), 0);
}

function countStringArray(value: unknown): number {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim().length > 0).length
    : 0;
}

function maxUpdatedAt(rows: readonly Record<string, unknown>[]): string | undefined {
  const timestamp = maxFiniteTimestamp(rows);
  return timestamp > 0 ? new Date(timestamp).toISOString() : undefined;
}

function maxFiniteTimestamp(rows: readonly Record<string, unknown>[]): number {
  return rows.reduce((max, row) => {
    const timestamp = Math.max(readFiniteTimestamp(row.updatedAt), readFiniteTimestamp(row.createdAt));
    return timestamp > max ? timestamp : max;
  }, 0);
}

function compareLatestProfile(left: Record<string, unknown>, right: Record<string, unknown>): number {
  const leftUpdated = readFiniteTimestamp(left.updatedAt) || readFiniteTimestamp(left._creationTime);
  const rightUpdated = readFiniteTimestamp(right.updatedAt) || readFiniteTimestamp(right._creationTime);
  if (rightUpdated !== leftUpdated) return rightUpdated - leftUpdated;
  return String(right._id ?? "").localeCompare(String(left._id ?? ""));
}

function readFiniteTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function clampSafeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), MAX_SAFE_COUNT);
}
