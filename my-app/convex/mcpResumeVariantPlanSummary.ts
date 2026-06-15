import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

type McpResumeVariantPlanSummaryStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required";

type McpResumeVariantPlanSummaryMissingDataReasonV1 =
  | "resume_variant_plan_not_available"
  | "owner_onboarding_required";

type McpResumeVariantPlanSummaryRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpResumeVariantPlanSummaryStatusV1;
  category: "resume_variant_plan";
  count: number;
  updatedAt?: string;
  version: 1;
}>;

type McpResumeVariantPlanSummaryResultV1 = Readonly<{
  kind: "mcp_resume_variant_plan_summary_result";
  allowed: true;
  status: McpResumeVariantPlanSummaryStatusV1;
  resumeVariantPlanRef: McpResumeVariantPlanSummaryRefV1;
  availability: {
    source: "convex_resume_variant_plan_summary";
    ownerState: "resolved" | "onboarding_required";
    version: 1;
  };
  safeCounts: {
    plans: number;
    planItems: number;
    claimBackedItems: number;
    missingInputItems: number;
    reviewNeededItems: number;
    acceptedItems: number;
    rejectedItems: number;
    blockedItems: number;
    warnings: number;
    blockers: number;
    restrictedFactBlockers: number;
    excludedFactBlockers: number;
    artifactTextBlockers: number;
    allowedClaims: number;
    sourceFacts: number;
    evidenceMatches: number;
    demands: number;
    riskFlags: number;
    version: 1;
  };
  safeCategories: {
    planStatus?:
      | "draft"
      | "needs_review"
      | "blocked"
      | "ready_for_review"
      | "unknown";
    targetDocumentKind?: "resume" | "cv";
    tailoringCompleteness?: "complete" | "partial" | "missing" | "unknown";
    blockerCategory?:
      | "missing_evidence"
      | "private_fact"
      | "never_use_fact"
      | "generated_text_as_fact"
      | "unsupported"
      | "source_truth"
      | "other"
      | "none";
    missingInputCategory?:
      | "missing_evidence"
      | "missing_claims"
      | "missing_plan_items"
      | "no_plan"
      | "none";
    reviewNeededCategory?:
      | "review_warnings"
      | "review_items"
      | "ready_for_review"
      | "blocked";
    nextReviewHint?:
      | "review_blockers"
      | "review_missing_inputs"
      | "review_plan_items"
      | "ready_for_review";
    version: 1;
  };
  updatedAt?: string;
  missingDataReason?: McpResumeVariantPlanSummaryMissingDataReasonV1;
  capabilities: {
    ownerResolution: "blocked" | "server_only";
    dataReads: "convex_resume_variant_plan_summary";
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

const MAX_SAFE_COUNT = 100;
const QUERY_READ_LIMIT = MAX_SAFE_COUNT + 1;

const mcpResumeVariantPlanSummaryStatusValidator = v.union(
  v.literal("available"),
  v.literal("no_data_available"),
  v.literal("onboarding_required"),
);

const mcpResumeVariantPlanRefValidator = v.object({
  id: v.string(),
  label: v.string(),
  status: mcpResumeVariantPlanSummaryStatusValidator,
  category: v.literal("resume_variant_plan"),
  count: v.number(),
  updatedAt: v.optional(v.string()),
  version: v.literal(1),
});

const mcpResumeVariantPlanSummaryResultValidator = v.object({
  kind: v.literal("mcp_resume_variant_plan_summary_result"),
  allowed: v.literal(true),
  status: mcpResumeVariantPlanSummaryStatusValidator,
  resumeVariantPlanRef: mcpResumeVariantPlanRefValidator,
  availability: v.object({
    source: v.literal("convex_resume_variant_plan_summary"),
    ownerState: v.union(
      v.literal("resolved"),
      v.literal("onboarding_required"),
    ),
    version: v.literal(1),
  }),
  safeCounts: v.object({
    plans: v.number(),
    planItems: v.number(),
    claimBackedItems: v.number(),
    missingInputItems: v.number(),
    reviewNeededItems: v.number(),
    acceptedItems: v.number(),
    rejectedItems: v.number(),
    blockedItems: v.number(),
    warnings: v.number(),
    blockers: v.number(),
    restrictedFactBlockers: v.number(),
    excludedFactBlockers: v.number(),
    artifactTextBlockers: v.number(),
    allowedClaims: v.number(),
    sourceFacts: v.number(),
    evidenceMatches: v.number(),
    demands: v.number(),
    riskFlags: v.number(),
    version: v.literal(1),
  }),
  safeCategories: v.object({
    planStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("needs_review"),
        v.literal("blocked"),
        v.literal("ready_for_review"),
        v.literal("unknown"),
      ),
    ),
    targetDocumentKind: v.optional(
      v.union(v.literal("resume"), v.literal("cv")),
    ),
    tailoringCompleteness: v.optional(
      v.union(
        v.literal("complete"),
        v.literal("partial"),
        v.literal("missing"),
        v.literal("unknown"),
      ),
    ),
    blockerCategory: v.optional(
      v.union(
        v.literal("missing_evidence"),
        v.literal("private_fact"),
        v.literal("never_use_fact"),
        v.literal("generated_text_as_fact"),
        v.literal("unsupported"),
        v.literal("source_truth"),
        v.literal("other"),
        v.literal("none"),
      ),
    ),
    missingInputCategory: v.optional(
      v.union(
        v.literal("missing_evidence"),
        v.literal("missing_claims"),
        v.literal("missing_plan_items"),
        v.literal("no_plan"),
        v.literal("none"),
      ),
    ),
    reviewNeededCategory: v.optional(
      v.union(
        v.literal("review_warnings"),
        v.literal("review_items"),
        v.literal("ready_for_review"),
        v.literal("blocked"),
      ),
    ),
    nextReviewHint: v.optional(
      v.union(
        v.literal("review_blockers"),
        v.literal("review_missing_inputs"),
        v.literal("review_plan_items"),
        v.literal("ready_for_review"),
      ),
    ),
    version: v.literal(1),
  }),
  updatedAt: v.optional(v.string()),
  missingDataReason: v.optional(
    v.union(
      v.literal("resume_variant_plan_not_available"),
      v.literal("owner_onboarding_required"),
    ),
  ),
  capabilities: v.object({
    ownerResolution: v.union(v.literal("blocked"), v.literal("server_only")),
    dataReads: v.literal("convex_resume_variant_plan_summary"),
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

export const internalSummarizeMcpResumeVariantPlan = internalQuery({
  args: {
    twoweeksClerkId: v.string(),
    resumeVariantPlanRef: mcpResumeVariantPlanRefValidator,
  },
  returns: mcpResumeVariantPlanSummaryResultValidator,
  handler: async (ctx, args): Promise<McpResumeVariantPlanSummaryResultV1> => {
    return await summarizeMcpResumeVariantPlan(ctx.db, args);
  },
});

async function summarizeMcpResumeVariantPlan(
  db: DbReader,
  args: Readonly<{
    twoweeksClerkId: string;
    resumeVariantPlanRef: McpResumeVariantPlanSummaryRefV1;
  }>,
): Promise<McpResumeVariantPlanSummaryResultV1> {
  const resumeVariantPlanRef = normalizeResumeVariantPlanRef(
    args.resumeVariantPlanRef,
  );
  if (resumeVariantPlanRef.status === "onboarding_required") {
    return buildUnavailableSummary(
      resumeVariantPlanRef,
      "owner_onboarding_required",
      "blocked",
    );
  }
  if (resumeVariantPlanRef.status === "no_data_available") {
    return buildUnavailableSummary(
      resumeVariantPlanRef,
      "resume_variant_plan_not_available",
      "server_only",
    );
  }

  const profile = await readPrimaryProfileForOwner(db, args.twoweeksClerkId);
  if (!profile) {
    return buildUnavailableSummary(
      { ...resumeVariantPlanRef, status: "onboarding_required", count: 0 },
      "owner_onboarding_required",
      "blocked",
    );
  }

  const ownerStorageRef = String(profile._id);
  const artifacts = sortLatestArtifacts(
    (
      await queryByFields(db, "applicationArtifacts", "by_user_type", [
        { field: "userId", value: ownerStorageRef },
        { field: "type", value: "resume_variant_plan" },
      ])
    ).filter(isResumeVariantPlanArtifact),
  );

  if (artifacts.length === 0) {
    return buildUnavailableSummary(
      { ...resumeVariantPlanRef, status: "no_data_available", count: 0 },
      "resume_variant_plan_not_available",
      "server_only",
    );
  }

  const latestArtifact = artifacts[0]!;
  const latestPlan = readPlan(latestArtifact.content);
  const safeCounts = buildSafeCounts(
    artifacts.length,
    latestArtifact,
    latestPlan,
  );
  const latestUpdatedAt = maxUpdatedAt(artifacts);

  return {
    kind: "mcp_resume_variant_plan_summary_result",
    allowed: true,
    status: "available",
    resumeVariantPlanRef: {
      ...resumeVariantPlanRef,
      status: "available",
      count: clampSafeCount(artifacts.length),
      ...(latestUpdatedAt ? { updatedAt: latestUpdatedAt } : {}),
    },
    availability: {
      source: "convex_resume_variant_plan_summary",
      ownerState: "resolved",
      version: 1,
    },
    safeCounts,
    safeCategories: buildSafeCategories(latestArtifact, latestPlan, safeCounts),
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
  resumeVariantPlanRef: McpResumeVariantPlanSummaryRefV1,
  missingDataReason: McpResumeVariantPlanSummaryMissingDataReasonV1,
  ownerResolution: "blocked" | "server_only",
): McpResumeVariantPlanSummaryResultV1 {
  return {
    kind: "mcp_resume_variant_plan_summary_result",
    allowed: true,
    status: resumeVariantPlanRef.status,
    resumeVariantPlanRef: { ...resumeVariantPlanRef, count: 0 },
    availability: {
      source: "convex_resume_variant_plan_summary",
      ownerState:
        resumeVariantPlanRef.status === "onboarding_required"
          ? "onboarding_required"
          : "resolved",
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

function buildSafeCounts(
  planCount: number,
  latestArtifact: Record<string, unknown>,
  latestPlan: Record<string, unknown> | undefined,
): McpResumeVariantPlanSummaryResultV1["safeCounts"] {
  const items = latestPlan ? readRecordArray(latestPlan.items) : [];
  const warnings = latestPlan ? readRecordArray(latestPlan.warnings) : [];
  const claimBackedItems = items.filter(hasClaimBacking);
  const missingInputItems = items.filter(isMissingInputItem);
  const reviewNeededItems = items.filter(isReviewNeededItem);
  const acceptedItems = items.filter((item) => item.reviewState === "accepted");
  const rejectedItems = items.filter((item) => item.reviewState === "rejected");
  const blockedItems = items.filter(
    (item) => item.reviewState === "blocked" || item.action === "block",
  );
  const blockerWarnings = warnings.filter(
    (warning) => warning.severity === "blocker",
  );

  return {
    plans: clampSafeCount(planCount),
    planItems: clampSafeCount(items.length),
    claimBackedItems: clampSafeCount(claimBackedItems.length),
    missingInputItems: clampSafeCount(missingInputItems.length),
    reviewNeededItems: clampSafeCount(reviewNeededItems.length),
    acceptedItems: clampSafeCount(acceptedItems.length),
    rejectedItems: clampSafeCount(rejectedItems.length),
    blockedItems: clampSafeCount(blockedItems.length),
    warnings: clampSafeCount(warnings.length),
    blockers: clampSafeCount(
      blockerWarnings.length +
        (latestPlan?.blocked === true ? 1 : 0) +
        (latestArtifact.status === "blocked" ? 1 : 0),
    ),
    restrictedFactBlockers: countWarningsByCategory(warnings, "private_fact"),
    excludedFactBlockers: countWarningsByCategory(warnings, "never_use_fact"),
    artifactTextBlockers: countWarningsByCategory(
      warnings,
      "generated_text_as_fact",
    ),
    allowedClaims: clampSafeCount(
      countStringArray(latestPlan?.allowedClaimIds),
    ),
    sourceFacts: clampSafeCount(countStringArray(latestPlan?.sourceFactIds)),
    evidenceMatches: clampSafeCount(
      sumStringArrayCounts(items, "evidenceMatchIds"),
    ),
    demands: clampSafeCount(sumStringArrayCounts(items, "demandIds")),
    riskFlags: clampSafeCount(countStringArray(latestPlan?.riskFlagIds)),
    version: 1,
  };
}

function buildSafeCategories(
  latestArtifact: Record<string, unknown>,
  latestPlan: Record<string, unknown> | undefined,
  counts: McpResumeVariantPlanSummaryResultV1["safeCounts"],
): McpResumeVariantPlanSummaryResultV1["safeCategories"] {
  const blockerCategory = readBlockerCategory(latestPlan, counts);
  const missingInputCategory = readMissingInputCategory(counts);
  const reviewNeededCategory = readReviewNeededCategory(counts);
  return {
    planStatus: readPlanStatus(latestArtifact.status, latestPlan, counts),
    ...(readTargetDocumentKind(latestPlan?.targetDocumentKind)
      ? {
          targetDocumentKind: readTargetDocumentKind(
            latestPlan?.targetDocumentKind,
          ),
        }
      : {}),
    tailoringCompleteness: readTailoringCompleteness(counts),
    blockerCategory,
    missingInputCategory,
    reviewNeededCategory,
    nextReviewHint: readNextReviewHint(
      blockerCategory,
      missingInputCategory,
      reviewNeededCategory,
    ),
    version: 1,
  };
}

function buildCapabilities(
  ownerResolution: McpResumeVariantPlanSummaryResultV1["capabilities"]["ownerResolution"],
): McpResumeVariantPlanSummaryResultV1["capabilities"] {
  return {
    ownerResolution,
    dataReads: "convex_resume_variant_plan_summary",
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

function zeroCounts(): McpResumeVariantPlanSummaryResultV1["safeCounts"] {
  return {
    plans: 0,
    planItems: 0,
    claimBackedItems: 0,
    missingInputItems: 0,
    reviewNeededItems: 0,
    acceptedItems: 0,
    rejectedItems: 0,
    blockedItems: 0,
    warnings: 0,
    blockers: 0,
    restrictedFactBlockers: 0,
    excludedFactBlockers: 0,
    artifactTextBlockers: 0,
    allowedClaims: 0,
    sourceFacts: 0,
    evidenceMatches: 0,
    demands: 0,
    riskFlags: 0,
    version: 1,
  };
}

function normalizeResumeVariantPlanRef(
  resumeVariantPlanRef: McpResumeVariantPlanSummaryRefV1,
): McpResumeVariantPlanSummaryRefV1 {
  return {
    id: "mcp-safe-ref:resume-variant-plan:latest",
    label: "Resume variant plan availability",
    status: resumeVariantPlanRef.status,
    category: "resume_variant_plan",
    count: clampSafeCount(resumeVariantPlanRef.count),
    ...(isIsoTimestamp(resumeVariantPlanRef.updatedAt)
      ? { updatedAt: resumeVariantPlanRef.updatedAt }
      : {}),
    version: 1,
  };
}

function isResumeVariantPlanArtifact(row: Record<string, unknown>): boolean {
  return row.type === "resume_variant_plan";
}

function readPlan(content: unknown): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(content);
  if (!record || record.kind !== "resume_variant_plan" || record.version !== 1)
    return undefined;
  return readPlainObjectRecord(record.plan);
}

function hasClaimBacking(item: Record<string, unknown>): boolean {
  return (
    countStringArray(item.allowedClaimIds) > 0 &&
    countStringArray(item.candidateFactIds) > 0
  );
}

function isMissingInputItem(item: Record<string, unknown>): boolean {
  return (
    item.action === "needs_review" ||
    item.action === "block" ||
    (countStringArray(item.demandIds) > 0 && !hasClaimBacking(item))
  );
}

function isReviewNeededItem(item: Record<string, unknown>): boolean {
  return (
    item.reviewState === "pending" ||
    item.reviewState === "needs_review" ||
    item.action === "needs_review"
  );
}

function countWarningsByCategory(
  rows: readonly Record<string, unknown>[],
  category: string,
): number {
  return clampSafeCount(rows.filter((row) => row.category === category).length);
}

function readPlanStatus(
  artifactStatus: unknown,
  plan: Record<string, unknown> | undefined,
  counts: McpResumeVariantPlanSummaryResultV1["safeCounts"],
): NonNullable<
  McpResumeVariantPlanSummaryResultV1["safeCategories"]["planStatus"]
> {
  if (
    artifactStatus === "blocked" ||
    plan?.blocked === true ||
    counts.blockers > 0
  )
    return "blocked";
  if (counts.reviewNeededItems > 0 || counts.warnings > 0)
    return "needs_review";
  if (artifactStatus === "draft") return "draft";
  if (counts.planItems > 0) return "ready_for_review";
  return "unknown";
}

function readTargetDocumentKind(
  value: unknown,
):
  | McpResumeVariantPlanSummaryResultV1["safeCategories"]["targetDocumentKind"]
  | undefined {
  return value === "resume" || value === "cv" ? value : undefined;
}

function readTailoringCompleteness(
  counts: McpResumeVariantPlanSummaryResultV1["safeCounts"],
): NonNullable<
  McpResumeVariantPlanSummaryResultV1["safeCategories"]["tailoringCompleteness"]
> {
  if (counts.planItems === 0) return "missing";
  if (counts.blockers > 0 || counts.missingInputItems > 0) return "partial";
  if (counts.claimBackedItems > 0 && counts.warnings === 0) return "complete";
  return "unknown";
}

function readBlockerCategory(
  plan: Record<string, unknown> | undefined,
  counts: McpResumeVariantPlanSummaryResultV1["safeCounts"],
): NonNullable<
  McpResumeVariantPlanSummaryResultV1["safeCategories"]["blockerCategory"]
> {
  const warnings = plan ? readRecordArray(plan.warnings) : [];
  if (warnings.some((warning) => warning.category === "missing_evidence"))
    return "missing_evidence";
  if (warnings.some((warning) => warning.category === "private_fact"))
    return "private_fact";
  if (warnings.some((warning) => warning.category === "never_use_fact"))
    return "never_use_fact";
  if (warnings.some((warning) => warning.category === "generated_text_as_fact"))
    return "generated_text_as_fact";
  if (
    warnings.some(
      (warning) =>
        typeof warning.category === "string" &&
        warning.category.startsWith("unsupported"),
    )
  ) {
    return "unsupported";
  }
  if (warnings.some((warning) => warning.category === "source_truth"))
    return "source_truth";
  if (counts.blockers > 0) return "other";
  return "none";
}

function readMissingInputCategory(
  counts: McpResumeVariantPlanSummaryResultV1["safeCounts"],
): NonNullable<
  McpResumeVariantPlanSummaryResultV1["safeCategories"]["missingInputCategory"]
> {
  if (counts.plans === 0) return "no_plan";
  if (counts.missingInputItems > 0) return "missing_evidence";
  if (counts.allowedClaims === 0) return "missing_claims";
  if (counts.planItems === 0) return "missing_plan_items";
  return "none";
}

function readReviewNeededCategory(
  counts: McpResumeVariantPlanSummaryResultV1["safeCounts"],
): NonNullable<
  McpResumeVariantPlanSummaryResultV1["safeCategories"]["reviewNeededCategory"]
> {
  if (counts.blockers > 0) return "blocked";
  if (counts.warnings > 0) return "review_warnings";
  if (counts.reviewNeededItems > 0) return "review_items";
  return "ready_for_review";
}

function readNextReviewHint(
  blockerCategory: NonNullable<
    McpResumeVariantPlanSummaryResultV1["safeCategories"]["blockerCategory"]
  >,
  missingInputCategory: NonNullable<
    McpResumeVariantPlanSummaryResultV1["safeCategories"]["missingInputCategory"]
  >,
  reviewNeededCategory: NonNullable<
    McpResumeVariantPlanSummaryResultV1["safeCategories"]["reviewNeededCategory"]
  >,
): NonNullable<
  McpResumeVariantPlanSummaryResultV1["safeCategories"]["nextReviewHint"]
> {
  if (blockerCategory !== "none" || reviewNeededCategory === "blocked")
    return "review_blockers";
  if (missingInputCategory !== "none") return "review_missing_inputs";
  if (
    reviewNeededCategory === "review_warnings" ||
    reviewNeededCategory === "review_items"
  ) {
    return "review_plan_items";
  }
  return "ready_for_review";
}

function readRecordArray(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.flatMap((item) => readPlainObjectRecord(item) ?? [])
    : [];
}

function readPlainObjectRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  return value as Record<string, unknown>;
}

function sortLatestArtifacts(
  records: readonly Record<string, unknown>[],
): readonly Record<string, unknown>[] {
  return [...records].sort((left, right) => {
    const updatedDelta =
      readFiniteTimestamp(right.updatedAt) -
      readFiniteTimestamp(left.updatedAt);
    if (updatedDelta !== 0) return updatedDelta;
    const createdDelta =
      readFiniteTimestamp(right.createdAt) -
      readFiniteTimestamp(left.createdAt);
    if (createdDelta !== 0) return createdDelta;
    return String(left.id ?? "").localeCompare(String(right.id ?? ""));
  });
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
  const timestamp = rows.reduce((max, row) => {
    const next = Math.max(
      readFiniteTimestamp(row.updatedAt),
      readFiniteTimestamp(row.createdAt),
    );
    return next > max ? next : max;
  }, 0);
  return timestamp > 0 ? new Date(timestamp).toISOString() : undefined;
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
