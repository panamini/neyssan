import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

type McpReviewCockpitSummaryStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required";

type McpReviewCockpitSummaryMissingDataReasonV1 =
  | "review_cockpit_not_available"
  | "owner_onboarding_required";

type McpReviewCockpitSummaryRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpReviewCockpitSummaryStatusV1;
  category: "review_cockpit";
  count: number;
  updatedAt?: string;
  version: 1;
}>;

type McpReviewCockpitSummaryResultV1 = Readonly<{
  kind: "mcp_review_cockpit_summary_result";
  allowed: true;
  status: McpReviewCockpitSummaryStatusV1;
  reviewCockpitRef: McpReviewCockpitSummaryRefV1;
  availability: {
    source: "convex_review_cockpit_summary";
    ownerState: "resolved" | "onboarding_required";
    version: 1;
  };
  safeCounts: {
    reviewContexts: number;
    reviewRuns: number;
    reviewArtifacts: number;
    applicationPackages: number;
    pendingReviews: number;
    approvedReviews: number;
    blockedReviews: number;
    failedRuns: number;
    blockedRuns: number;
    blockedArtifacts: number;
    blockedPackages: number;
    missingReviewItems: number;
    approvalNeeded: number;
    staleInputs: number;
    overLimitCollections: number;
    version: 1;
  };
  safeCategories: {
    reviewReadiness?:
      | "ready_for_review"
      | "needs_user_review"
      | "blocked"
      | "unknown";
    reviewGateStatus?: "ready" | "needs_review" | "blocked" | "unknown";
    blockerCategory?:
      | "blocked_package"
      | "blocked_artifact"
      | "blocked_run"
      | "failed_run"
      | "none";
    missingReviewCategory?:
      | "missing_review_context"
      | "missing_review_artifact"
      | "missing_application_package"
      | "pending_review_items"
      | "none";
    nextReviewHint?:
      | "review_blockers"
      | "review_pending_items"
      | "review_missing_inputs"
      | "refresh_stale_inputs"
      | "ready_for_review"
      | "add_application_context";
    nextUserAction?:
      | "review_blockers"
      | "review_pending_items"
      | "review_missing_inputs"
      | "refresh_inputs"
      | "approve_review_gate"
      | "none";
    version: 1;
  };
  safeFlags: {
    approvalNeeded: boolean;
    staleData: boolean;
    overLimit: boolean;
    version: 1;
  };
  updatedAt?: string;
  missingDataReason?: McpReviewCockpitSummaryMissingDataReasonV1;
  capabilities: {
    ownerResolution: "blocked" | "server_only";
    dataReads: "convex_review_cockpit_summary";
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
      take?: (limit: number) => Promise<readonly Record<string, unknown>[]>;
      order?: (direction: "asc" | "desc") => {
        take?: (limit: number) => Promise<readonly Record<string, unknown>[]>;
      };
    };
  };
}>;

type ReviewRows = Readonly<{
  applicationContexts: readonly Record<string, unknown>[];
  applicationRuns: readonly Record<string, unknown>[];
  applicationArtifacts: readonly Record<string, unknown>[];
  applicationPackages: readonly Record<string, unknown>[];
  sourceDocuments: readonly Record<string, unknown>[];
  candidateFacts: readonly Record<string, unknown>[];
}>;

const MAX_SAFE_COUNT = 100;
const QUERY_READ_LIMIT = MAX_SAFE_COUNT + 1;

const mcpReviewCockpitSummaryStatusValidator = v.union(
  v.literal("available"),
  v.literal("no_data_available"),
  v.literal("onboarding_required"),
);

const mcpReviewCockpitRefValidator = v.object({
  id: v.string(),
  label: v.string(),
  status: mcpReviewCockpitSummaryStatusValidator,
  category: v.literal("review_cockpit"),
  count: v.number(),
  updatedAt: v.optional(v.string()),
  version: v.literal(1),
});

const mcpReviewCockpitSummaryResultValidator = v.object({
  kind: v.literal("mcp_review_cockpit_summary_result"),
  allowed: v.literal(true),
  status: mcpReviewCockpitSummaryStatusValidator,
  reviewCockpitRef: mcpReviewCockpitRefValidator,
  availability: v.object({
    source: v.literal("convex_review_cockpit_summary"),
    ownerState: v.union(
      v.literal("resolved"),
      v.literal("onboarding_required"),
    ),
    version: v.literal(1),
  }),
  safeCounts: v.object({
    reviewContexts: v.number(),
    reviewRuns: v.number(),
    reviewArtifacts: v.number(),
    applicationPackages: v.number(),
    pendingReviews: v.number(),
    approvedReviews: v.number(),
    blockedReviews: v.number(),
    failedRuns: v.number(),
    blockedRuns: v.number(),
    blockedArtifacts: v.number(),
    blockedPackages: v.number(),
    missingReviewItems: v.number(),
    approvalNeeded: v.number(),
    staleInputs: v.number(),
    overLimitCollections: v.number(),
    version: v.literal(1),
  }),
  safeCategories: v.object({
    reviewReadiness: v.optional(
      v.union(
        v.literal("ready_for_review"),
        v.literal("needs_user_review"),
        v.literal("blocked"),
        v.literal("unknown"),
      ),
    ),
    reviewGateStatus: v.optional(
      v.union(
        v.literal("ready"),
        v.literal("needs_review"),
        v.literal("blocked"),
        v.literal("unknown"),
      ),
    ),
    blockerCategory: v.optional(
      v.union(
        v.literal("blocked_package"),
        v.literal("blocked_artifact"),
        v.literal("blocked_run"),
        v.literal("failed_run"),
        v.literal("none"),
      ),
    ),
    missingReviewCategory: v.optional(
      v.union(
        v.literal("missing_review_context"),
        v.literal("missing_review_artifact"),
        v.literal("missing_application_package"),
        v.literal("pending_review_items"),
        v.literal("none"),
      ),
    ),
    nextReviewHint: v.optional(
      v.union(
        v.literal("review_blockers"),
        v.literal("review_pending_items"),
        v.literal("review_missing_inputs"),
        v.literal("refresh_stale_inputs"),
        v.literal("ready_for_review"),
        v.literal("add_application_context"),
      ),
    ),
    nextUserAction: v.optional(
      v.union(
        v.literal("review_blockers"),
        v.literal("review_pending_items"),
        v.literal("review_missing_inputs"),
        v.literal("refresh_inputs"),
        v.literal("approve_review_gate"),
        v.literal("none"),
      ),
    ),
    version: v.literal(1),
  }),
  safeFlags: v.object({
    approvalNeeded: v.boolean(),
    staleData: v.boolean(),
    overLimit: v.boolean(),
    version: v.literal(1),
  }),
  updatedAt: v.optional(v.string()),
  missingDataReason: v.optional(
    v.union(
      v.literal("review_cockpit_not_available"),
      v.literal("owner_onboarding_required"),
    ),
  ),
  capabilities: v.object({
    ownerResolution: v.union(v.literal("blocked"), v.literal("server_only")),
    dataReads: v.literal("convex_review_cockpit_summary"),
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

export const internalSummarizeMcpReviewCockpit = internalQuery({
  args: {
    twoweeksClerkId: v.string(),
    reviewCockpitRef: mcpReviewCockpitRefValidator,
  },
  returns: mcpReviewCockpitSummaryResultValidator,
  handler: async (ctx, args): Promise<McpReviewCockpitSummaryResultV1> => {
    return await summarizeMcpReviewCockpit(ctx.db, args);
  },
});

async function summarizeMcpReviewCockpit(
  db: DbReader,
  args: Readonly<{
    twoweeksClerkId: string;
    reviewCockpitRef: McpReviewCockpitSummaryRefV1;
  }>,
): Promise<McpReviewCockpitSummaryResultV1> {
  const reviewCockpitRef = normalizeReviewCockpitRef(args.reviewCockpitRef);
  if (reviewCockpitRef.status === "onboarding_required") {
    return buildUnavailableSummary(
      reviewCockpitRef,
      "owner_onboarding_required",
      "blocked",
    );
  }
  if (reviewCockpitRef.status === "no_data_available") {
    return buildUnavailableSummary(
      reviewCockpitRef,
      "review_cockpit_not_available",
      "server_only",
    );
  }

  const profile = await readPrimaryProfileForOwner(db, args.twoweeksClerkId);
  if (!profile) {
    return buildUnavailableSummary(
      { ...reviewCockpitRef, status: "onboarding_required", count: 0 },
      "owner_onboarding_required",
      "blocked",
    );
  }

  const ownerStorageRef = String(profile._id);
  const [
    applicationContexts,
    applicationRuns,
    applicationArtifacts,
    applicationPackages,
    sourceDocuments,
    candidateFacts,
  ] = await Promise.all([
    queryByFields(db, "applicationContexts", "by_user", [
      { field: "userId", value: ownerStorageRef },
    ]),
    queryByFields(db, "applicationRuns", "by_user", [
      { field: "userId", value: ownerStorageRef },
    ]),
    queryByFields(db, "applicationArtifacts", "by_user", [
      { field: "userId", value: ownerStorageRef },
    ]),
    queryByFields(db, "applicationPackages", "by_user_id", [
      { field: "userId", value: ownerStorageRef },
    ]),
    queryByFields(db, "candidateSourceDocuments", "by_user_id", [
      { field: "userId", value: ownerStorageRef },
    ]),
    queryByFields(db, "candidateFacts", "by_user_id", [
      { field: "userId", value: ownerStorageRef },
    ]),
  ]);

  const rows: ReviewRows = {
    applicationContexts,
    applicationRuns,
    applicationArtifacts,
    applicationPackages,
    sourceDocuments,
    candidateFacts,
  };
  const safeCounts = buildSafeCounts(rows);
  if (
    safeCounts.reviewContexts +
      safeCounts.reviewRuns +
      safeCounts.reviewArtifacts +
      safeCounts.applicationPackages ===
    0
  ) {
    return buildUnavailableSummary(
      { ...reviewCockpitRef, status: "no_data_available", count: 0 },
      "review_cockpit_not_available",
      "server_only",
    );
  }

  const latestUpdatedAt = maxUpdatedAt([
    ...applicationContexts,
    ...applicationRuns,
    ...applicationArtifacts,
    ...applicationPackages,
  ]);

  return {
    kind: "mcp_review_cockpit_summary_result",
    allowed: true,
    status: "available",
    reviewCockpitRef: {
      ...reviewCockpitRef,
      status: "available",
      count: clampSafeCount(
        safeCounts.reviewContexts + safeCounts.reviewRuns,
      ),
      ...(latestUpdatedAt ? { updatedAt: latestUpdatedAt } : {}),
    },
    availability: {
      source: "convex_review_cockpit_summary",
      ownerState: "resolved",
      version: 1,
    },
    safeCounts,
    safeCategories: buildSafeCategories(safeCounts),
    safeFlags: buildSafeFlags(safeCounts),
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
  const orderedQuery = indexedQuery.order?.("desc");
  if (typeof orderedQuery?.take === "function") {
    return await orderedQuery.take(QUERY_READ_LIMIT);
  }
  if (typeof indexedQuery.take === "function") {
    return await indexedQuery.take(QUERY_READ_LIMIT);
  }
  return [];
}

function buildUnavailableSummary(
  reviewCockpitRef: McpReviewCockpitSummaryRefV1,
  missingDataReason: McpReviewCockpitSummaryMissingDataReasonV1,
  ownerResolution: "blocked" | "server_only",
): McpReviewCockpitSummaryResultV1 {
  return {
    kind: "mcp_review_cockpit_summary_result",
    allowed: true,
    status: reviewCockpitRef.status,
    reviewCockpitRef: { ...reviewCockpitRef, count: 0 },
    availability: {
      source: "convex_review_cockpit_summary",
      ownerState:
        reviewCockpitRef.status === "onboarding_required"
          ? "onboarding_required"
          : "resolved",
      version: 1,
    },
    safeCounts: zeroCounts(),
    safeCategories: { version: 1 },
    safeFlags: {
      approvalNeeded: false,
      staleData: false,
      overLimit: false,
      version: 1,
    },
    missingDataReason,
    capabilities: buildCapabilities(ownerResolution),
    modelVisible: true,
    version: 1,
  };
}

function buildSafeCounts(
  rows: ReviewRows,
): McpReviewCockpitSummaryResultV1["safeCounts"] {
  const pendingContexts = rows.applicationContexts.filter(
    isContextPendingReview,
  );
  const approvedContexts = rows.applicationContexts.filter(
    (row) => row.reviewState === "approved",
  );
  const blockedRuns = rows.applicationRuns.filter(
    (row) => row.status === "blocked",
  );
  const failedRuns = rows.applicationRuns.filter(
    (row) => row.status === "failed",
  );
  const pendingArtifacts = rows.applicationArtifacts.filter(
    isArtifactPendingReview,
  );
  const approvedArtifacts = rows.applicationArtifacts.filter(
    (row) => row.status === "approved",
  );
  const blockedArtifacts = rows.applicationArtifacts.filter(
    (row) => row.status === "blocked",
  );
  const pendingPackages = rows.applicationPackages.filter(
    isPackagePendingReview,
  );
  const readyForReviewPackages = rows.applicationPackages.filter(
    (row) => row.status === "ready_for_review",
  );
  const blockedPackages = rows.applicationPackages.filter(
    (row) => row.status === "blocked",
  );
  const latestReviewTimestamp = maxFiniteTimestamp([
    ...rows.applicationContexts,
    ...rows.applicationRuns,
    ...rows.applicationArtifacts,
    ...rows.applicationPackages,
  ]);
  const staleInputs =
    latestReviewTimestamp > 0
      ? [...rows.sourceDocuments, ...rows.candidateFacts].filter((row) => {
          if (!isUsableEvidenceRow(row)) return false;
          const updatedAt = Math.max(
            readFiniteTimestamp(row.updatedAt),
            readFiniteTimestamp(row.createdAt),
          );
          return updatedAt > latestReviewTimestamp;
        }).length
      : 0;
  const missingReviewItems = sumStringArrayCounts(
    rows.applicationPackages,
    "reviewItemIds",
  );
  const approvalNeeded =
    pendingContexts.length +
    pendingArtifacts.length +
    pendingPackages.length +
    missingReviewItems;
  const blockedReviews =
    blockedRuns.length +
    failedRuns.length +
    blockedArtifacts.length +
    blockedPackages.length;

  return {
    reviewContexts: clampSafeCount(rows.applicationContexts.length),
    reviewRuns: clampSafeCount(rows.applicationRuns.length),
    reviewArtifacts: clampSafeCount(rows.applicationArtifacts.length),
    applicationPackages: clampSafeCount(rows.applicationPackages.length),
    pendingReviews: clampSafeCount(
      pendingContexts.length + pendingArtifacts.length + pendingPackages.length,
    ),
    approvedReviews: clampSafeCount(
      approvedContexts.length +
        approvedArtifacts.length +
        readyForReviewPackages.length,
    ),
    blockedReviews: clampSafeCount(blockedReviews),
    failedRuns: clampSafeCount(failedRuns.length),
    blockedRuns: clampSafeCount(blockedRuns.length),
    blockedArtifacts: clampSafeCount(blockedArtifacts.length),
    blockedPackages: clampSafeCount(blockedPackages.length),
    missingReviewItems: clampSafeCount(missingReviewItems),
    approvalNeeded: clampSafeCount(approvalNeeded),
    staleInputs: clampSafeCount(staleInputs),
    overLimitCollections: clampSafeCount(countOverLimitCollections(rows)),
    version: 1,
  };
}

function buildSafeCategories(
  counts: McpReviewCockpitSummaryResultV1["safeCounts"],
): McpReviewCockpitSummaryResultV1["safeCategories"] {
  const blockerCategory = readBlockerCategory(counts);
  const missingReviewCategory = readMissingReviewCategory(counts);
  const reviewGateStatus = readReviewGateStatus(counts);
  return {
    reviewReadiness: readReviewReadiness(counts, reviewGateStatus),
    reviewGateStatus,
    blockerCategory,
    missingReviewCategory,
    nextReviewHint: readNextReviewHint(
      counts,
      blockerCategory,
      missingReviewCategory,
    ),
    nextUserAction: readNextUserAction(
      counts,
      blockerCategory,
      missingReviewCategory,
    ),
    version: 1,
  };
}

function buildSafeFlags(
  counts: McpReviewCockpitSummaryResultV1["safeCounts"],
): McpReviewCockpitSummaryResultV1["safeFlags"] {
  return {
    approvalNeeded: counts.approvalNeeded > 0,
    staleData: counts.staleInputs > 0,
    overLimit: counts.overLimitCollections > 0,
    version: 1,
  };
}

function readReviewReadiness(
  counts: McpReviewCockpitSummaryResultV1["safeCounts"],
  reviewGateStatus: NonNullable<
    McpReviewCockpitSummaryResultV1["safeCategories"]["reviewGateStatus"]
  >,
): NonNullable<
  McpReviewCockpitSummaryResultV1["safeCategories"]["reviewReadiness"]
> {
  if (reviewGateStatus === "blocked") return "blocked";
  if (reviewGateStatus === "needs_review") return "needs_user_review";
  if (reviewGateStatus === "ready") return "ready_for_review";
  if (
    counts.reviewContexts +
      counts.reviewRuns +
      counts.reviewArtifacts +
      counts.applicationPackages >
    0
  ) {
    return "needs_user_review";
  }
  return "unknown";
}

function readReviewGateStatus(
  counts: McpReviewCockpitSummaryResultV1["safeCounts"],
): NonNullable<
  McpReviewCockpitSummaryResultV1["safeCategories"]["reviewGateStatus"]
> {
  if (counts.blockedReviews > 0 || counts.failedRuns > 0) return "blocked";
  if (counts.approvalNeeded > 0 || counts.staleInputs > 0)
    return "needs_review";
  if (counts.approvedReviews > 0 || counts.applicationPackages > 0)
    return "ready";
  return "unknown";
}

function readBlockerCategory(
  counts: McpReviewCockpitSummaryResultV1["safeCounts"],
): NonNullable<
  McpReviewCockpitSummaryResultV1["safeCategories"]["blockerCategory"]
> {
  if (counts.blockedPackages > 0) return "blocked_package";
  if (counts.blockedArtifacts > 0) return "blocked_artifact";
  if (counts.blockedRuns > 0) return "blocked_run";
  if (counts.failedRuns > 0) return "failed_run";
  return "none";
}

function readMissingReviewCategory(
  counts: McpReviewCockpitSummaryResultV1["safeCounts"],
): NonNullable<
  McpReviewCockpitSummaryResultV1["safeCategories"]["missingReviewCategory"]
> {
  if (counts.reviewContexts === 0) return "missing_review_context";
  if (counts.reviewArtifacts === 0) return "missing_review_artifact";
  if (counts.applicationPackages === 0) return "missing_application_package";
  if (counts.missingReviewItems > 0) return "pending_review_items";
  return "none";
}

function readNextReviewHint(
  counts: McpReviewCockpitSummaryResultV1["safeCounts"],
  blockerCategory: NonNullable<
    McpReviewCockpitSummaryResultV1["safeCategories"]["blockerCategory"]
  >,
  missingReviewCategory: NonNullable<
    McpReviewCockpitSummaryResultV1["safeCategories"]["missingReviewCategory"]
  >,
): NonNullable<
  McpReviewCockpitSummaryResultV1["safeCategories"]["nextReviewHint"]
> {
  if (blockerCategory !== "none") return "review_blockers";
  if (counts.staleInputs > 0) return "refresh_stale_inputs";
  if (
    counts.approvalNeeded > 0 ||
    missingReviewCategory === "pending_review_items"
  ) {
    return "review_pending_items";
  }
  if (missingReviewCategory !== "none") return "review_missing_inputs";
  if (counts.approvedReviews > 0 || counts.applicationPackages > 0)
    return "ready_for_review";
  return "add_application_context";
}

function readNextUserAction(
  counts: McpReviewCockpitSummaryResultV1["safeCounts"],
  blockerCategory: NonNullable<
    McpReviewCockpitSummaryResultV1["safeCategories"]["blockerCategory"]
  >,
  missingReviewCategory: NonNullable<
    McpReviewCockpitSummaryResultV1["safeCategories"]["missingReviewCategory"]
  >,
): NonNullable<
  McpReviewCockpitSummaryResultV1["safeCategories"]["nextUserAction"]
> {
  if (blockerCategory !== "none") return "review_blockers";
  if (counts.staleInputs > 0) return "refresh_inputs";
  if (
    counts.approvalNeeded > 0 ||
    missingReviewCategory === "pending_review_items"
  ) {
    return "review_pending_items";
  }
  if (missingReviewCategory !== "none") return "review_missing_inputs";
  if (counts.applicationPackages > 0) return "approve_review_gate";
  return "none";
}

function buildCapabilities(
  ownerResolution: McpReviewCockpitSummaryResultV1["capabilities"]["ownerResolution"],
): McpReviewCockpitSummaryResultV1["capabilities"] {
  return {
    ownerResolution,
    dataReads: "convex_review_cockpit_summary",
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

function zeroCounts(): McpReviewCockpitSummaryResultV1["safeCounts"] {
  return {
    reviewContexts: 0,
    reviewRuns: 0,
    reviewArtifacts: 0,
    applicationPackages: 0,
    pendingReviews: 0,
    approvedReviews: 0,
    blockedReviews: 0,
    failedRuns: 0,
    blockedRuns: 0,
    blockedArtifacts: 0,
    blockedPackages: 0,
    missingReviewItems: 0,
    approvalNeeded: 0,
    staleInputs: 0,
    overLimitCollections: 0,
    version: 1,
  };
}

function normalizeReviewCockpitRef(
  reviewCockpitRef: McpReviewCockpitSummaryRefV1,
): McpReviewCockpitSummaryRefV1 {
  return {
    id: "mcp-safe-ref:review-cockpit:latest",
    label: "Review cockpit availability",
    status: reviewCockpitRef.status,
    category: "review_cockpit",
    count: clampSafeCount(reviewCockpitRef.count),
    ...(isIsoTimestamp(reviewCockpitRef.updatedAt)
      ? { updatedAt: reviewCockpitRef.updatedAt }
      : {}),
    version: 1,
  };
}

function isContextPendingReview(row: Record<string, unknown>): boolean {
  return row.reviewState === "draft" || row.reviewState === "needs_review";
}

function isArtifactPendingReview(row: Record<string, unknown>): boolean {
  return row.status === "draft" || row.status === "needs_review";
}

function isPackagePendingReview(row: Record<string, unknown>): boolean {
  return row.status === "draft" || row.status === "needs_review";
}

function isUsableEvidenceRow(row: Record<string, unknown>): boolean {
  return (
    row.visibility !== "private" &&
    row.visibility !== "never_use" &&
    row.reviewState !== "rejected"
  );
}

function countOverLimitCollections(rows: ReviewRows): number {
  return [
    rows.applicationContexts,
    rows.applicationRuns,
    rows.applicationArtifacts,
    rows.applicationPackages,
    rows.sourceDocuments,
    rows.candidateFacts,
  ].filter((items) => items.length > MAX_SAFE_COUNT).length;
}

function sumStringArrayCounts(
  rows: readonly Record<string, unknown>[],
  key: string,
): number {
  return rows.reduce((sum, row) => sum + countStringArray(row[key]), 0);
}

function countStringArray(value: unknown): number {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim().length > 0)
        .length
    : 0;
}

function maxUpdatedAt(
  rows: readonly Record<string, unknown>[],
): string | undefined {
  const timestamp = maxFiniteTimestamp(rows);
  return timestamp > 0 ? new Date(timestamp).toISOString() : undefined;
}

function maxFiniteTimestamp(rows: readonly Record<string, unknown>[]): number {
  return rows.reduce((max, row) => {
    const timestamp = Math.max(
      readFiniteTimestamp(row.updatedAt),
      readFiniteTimestamp(row.createdAt),
    );
    return timestamp > max ? timestamp : max;
  }, 0);
}

function compareLatestProfile(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): number {
  const leftUpdated =
    readFiniteTimestamp(left.updatedAt) ||
    readFiniteTimestamp(left._creationTime);
  const rightUpdated =
    readFiniteTimestamp(right.updatedAt) ||
    readFiniteTimestamp(right._creationTime);
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
