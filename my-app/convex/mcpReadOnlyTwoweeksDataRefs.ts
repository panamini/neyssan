import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export type McpReadOnlyTwoweeksDataReadScopeV1 =
  | "twoweeks.mcp.read"
  | "twoweeks.application_package.read"
  | "twoweeks.evidence_graph.read"
  | "twoweeks.resume_variant_plan.read"
  | "twoweeks.review_cockpit.read";

export type McpReadOnlyTwoweeksDataRefClassV1 =
  | "applicationPackageRef"
  | "evidenceGraphRef"
  | "resumeVariantPlanRef"
  | "reviewCockpitRef";

export type McpReadOnlyTwoweeksDataRefStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required"
  | "blocked";

export type McpReadOnlyTwoweeksDataRefCategoryV1 =
  | "application_package"
  | "evidence_graph"
  | "resume_variant_plan"
  | "review_cockpit";

export type McpReadOnlyTwoweeksDataRefCandidateV1 = Readonly<{
  kind: "mcp_read_only_twoweeks_data_ref_candidate";
  refClass: McpReadOnlyTwoweeksDataRefClassV1;
  refId: string;
  label: string;
  status: McpReadOnlyTwoweeksDataRefStatusV1;
  category: McpReadOnlyTwoweeksDataRefCategoryV1;
  count: number;
  updatedAt?: string;
  version: 1;
}>;

export type McpReadOnlyTwoweeksDataBlockedRefClassV1 = Readonly<{
  refClass: McpReadOnlyTwoweeksDataRefClassV1;
  reason: "missing_class_scope";
  version: 1;
}>;

export type McpReadOnlyTwoweeksDataRefsResultV1 = Readonly<{
  kind: "mcp_read_only_twoweeks_data_refs_result";
  ownerState: "resolved" | "onboarding_required";
  refs: McpReadOnlyTwoweeksDataRefCandidateV1[];
  blockedRefClasses: McpReadOnlyTwoweeksDataBlockedRefClassV1[];
  capabilities: {
    ownerResolvedServerOnly: boolean;
    dataReads: "convex_read_only_refs";
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

type DbReader = Readonly<{
  query: (tableName: string) => {
    withIndex: (
      indexName: string,
      buildQuery: (query: { eq: (field: string, value: unknown) => unknown }) => unknown,
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

type OwnerDataCounts = Readonly<{
  applicationPackageCount: number;
  evidenceItemCount: number;
  resumeVariantPlanCount: number;
  reviewCockpitCount: number;
  applicationPackageUpdatedAt?: string;
  evidenceUpdatedAt?: string;
  resumeVariantPlanUpdatedAt?: string;
  reviewCockpitUpdatedAt?: string;
}>;

const mcpReadOnlyScopeValidator = v.union(
  v.literal("twoweeks.mcp.read"),
  v.literal("twoweeks.application_package.read"),
  v.literal("twoweeks.evidence_graph.read"),
  v.literal("twoweeks.resume_variant_plan.read"),
  v.literal("twoweeks.review_cockpit.read"),
);

const mcpReadOnlyRefClassValidator = v.union(
  v.literal("applicationPackageRef"),
  v.literal("evidenceGraphRef"),
  v.literal("resumeVariantPlanRef"),
  v.literal("reviewCockpitRef"),
);

const mcpReadOnlyRefStatusValidator = v.union(
  v.literal("available"),
  v.literal("no_data_available"),
  v.literal("onboarding_required"),
  v.literal("blocked"),
);

const mcpReadOnlyRefCategoryValidator = v.union(
  v.literal("application_package"),
  v.literal("evidence_graph"),
  v.literal("resume_variant_plan"),
  v.literal("review_cockpit"),
);

const mcpReadOnlyDataRefCandidateValidator = v.object({
  kind: v.literal("mcp_read_only_twoweeks_data_ref_candidate"),
  refClass: mcpReadOnlyRefClassValidator,
  refId: v.string(),
  label: v.string(),
  status: mcpReadOnlyRefStatusValidator,
  category: mcpReadOnlyRefCategoryValidator,
  count: v.number(),
  updatedAt: v.optional(v.string()),
  version: v.literal(1),
});

const mcpReadOnlyBlockedRefClassValidator = v.object({
  refClass: mcpReadOnlyRefClassValidator,
  reason: v.literal("missing_class_scope"),
  version: v.literal(1),
});

const mcpReadOnlyDataRefsResultValidator = v.object({
  kind: v.literal("mcp_read_only_twoweeks_data_refs_result"),
  ownerState: v.union(v.literal("resolved"), v.literal("onboarding_required")),
  refs: v.array(mcpReadOnlyDataRefCandidateValidator),
  blockedRefClasses: v.array(mcpReadOnlyBlockedRefClassValidator),
  capabilities: v.object({
    ownerResolvedServerOnly: v.boolean(),
    dataReads: v.literal("convex_read_only_refs"),
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

const REF_DEFINITIONS = [
  {
    refClass: "applicationPackageRef",
    scope: "twoweeks.application_package.read",
    refId: "mcp-safe-ref:application-package:latest",
    label: "Application package availability",
    category: "application_package",
    countKey: "applicationPackageCount",
    updatedAtKey: "applicationPackageUpdatedAt",
  },
  {
    refClass: "evidenceGraphRef",
    scope: "twoweeks.evidence_graph.read",
    refId: "mcp-safe-ref:evidence-graph:profile",
    label: "Candidate evidence availability",
    category: "evidence_graph",
    countKey: "evidenceItemCount",
    updatedAtKey: "evidenceUpdatedAt",
  },
  {
    refClass: "resumeVariantPlanRef",
    scope: "twoweeks.resume_variant_plan.read",
    refId: "mcp-safe-ref:resume-variant-plan:latest",
    label: "Resume variant plan availability",
    category: "resume_variant_plan",
    countKey: "resumeVariantPlanCount",
    updatedAtKey: "resumeVariantPlanUpdatedAt",
  },
  {
    refClass: "reviewCockpitRef",
    scope: "twoweeks.review_cockpit.read",
    refId: "mcp-safe-ref:review-cockpit:latest",
    label: "Review cockpit availability",
    category: "review_cockpit",
    countKey: "reviewCockpitCount",
    updatedAtKey: "reviewCockpitUpdatedAt",
  },
] as const satisfies readonly Readonly<{
  refClass: McpReadOnlyTwoweeksDataRefClassV1;
  scope: Exclude<McpReadOnlyTwoweeksDataReadScopeV1, "twoweeks.mcp.read">;
  refId: string;
  label: string;
  category: McpReadOnlyTwoweeksDataRefCategoryV1;
  countKey: keyof Pick<
    OwnerDataCounts,
    | "applicationPackageCount"
    | "evidenceItemCount"
    | "resumeVariantPlanCount"
    | "reviewCockpitCount"
  >;
  updatedAtKey: keyof Pick<
    OwnerDataCounts,
    | "applicationPackageUpdatedAt"
    | "evidenceUpdatedAt"
    | "resumeVariantPlanUpdatedAt"
    | "reviewCockpitUpdatedAt"
  >;
}>[];

const MAX_SAFE_COUNT = 100;

export const internalListMcpReadOnlyTwoweeksDataRefs = internalQuery({
  args: {
    twoweeksClerkId: v.string(),
    grantedReadScopes: v.array(mcpReadOnlyScopeValidator),
  },
  returns: mcpReadOnlyDataRefsResultValidator,
  handler: async (ctx, args): Promise<McpReadOnlyTwoweeksDataRefsResultV1> => {
    return await listMcpReadOnlyTwoweeksDataRefs(ctx.db as unknown as DbReader, args);
  },
});

async function listMcpReadOnlyTwoweeksDataRefs(
  db: DbReader,
  args: Readonly<{
    twoweeksClerkId: string;
    grantedReadScopes: readonly McpReadOnlyTwoweeksDataReadScopeV1[];
  }>,
): Promise<McpReadOnlyTwoweeksDataRefsResultV1> {
  const grantedScopes = new Set(args.grantedReadScopes);
  if (!grantedScopes.has("twoweeks.mcp.read")) {
    return buildResult("onboarding_required", false, zeroCounts(), grantedScopes);
  }

  const profileIds = await readProfileIdsForOwner(db, args.twoweeksClerkId);
  if (profileIds.length === 0) {
    return buildResult("onboarding_required", false, zeroCounts(), grantedScopes);
  }

  const [
    applicationPackages,
    sourceDocuments,
    candidateFacts,
    applicationContexts,
    applicationRuns,
    applicationArtifacts,
  ] = await Promise.all([
    queryByFieldForProfileIds(db, "applicationPackages", "by_user_id", "userId", profileIds),
    queryByFieldForProfileIds(db, "candidateSourceDocuments", "by_user_id", "userId", profileIds),
    queryByFieldForProfileIds(db, "candidateFacts", "by_user_id", "userId", profileIds),
    queryByFieldForProfileIds(db, "applicationContexts", "by_user", "userId", profileIds),
    queryByFieldForProfileIds(db, "applicationRuns", "by_user", "userId", profileIds),
    queryByFieldForProfileIds(db, "applicationArtifacts", "by_user", "userId", profileIds),
  ]);

  return buildResult(
    "resolved",
    true,
    {
      applicationPackageCount: applicationPackages.length,
      evidenceItemCount: countSafeEvidenceItems(sourceDocuments, candidateFacts),
      resumeVariantPlanCount: applicationArtifacts.filter(isResumeVariantPlanArtifact).length,
      reviewCockpitCount: applicationContexts.length + applicationRuns.length,
      ...maxUpdatedAt("applicationPackageUpdatedAt", applicationPackages),
      ...maxUpdatedAt("evidenceUpdatedAt", [
        ...sourceDocuments.filter(isUsableEvidenceRow),
        ...candidateFacts.filter(isUsableEvidenceRow),
      ]),
      ...maxUpdatedAt(
        "resumeVariantPlanUpdatedAt",
        applicationArtifacts.filter(isResumeVariantPlanArtifact),
      ),
      ...maxUpdatedAt("reviewCockpitUpdatedAt", [...applicationContexts, ...applicationRuns]),
    },
    grantedScopes,
  );
}

async function readProfileIdsForOwner(
  db: DbReader,
  twoweeksClerkId: string,
): Promise<readonly string[]> {
  const profiles = await queryByField(db, "userProfiles", "by_clerk_id", "clerkId", twoweeksClerkId);
  return profiles
    .map((profile) => (typeof profile._id === "string" ? profile._id : undefined))
    .filter((profileId): profileId is string => profileId !== undefined);
}

async function queryByFieldForProfileIds(
  db: DbReader,
  tableName: string,
  indexName: string,
  field: string,
  profileIds: readonly string[],
): Promise<readonly Record<string, unknown>[]> {
  const rows = await Promise.all(
    profileIds.map((profileId) => queryByField(db, tableName, indexName, field, profileId)),
  );
  return rows.flat();
}

async function queryByField(
  db: DbReader,
  tableName: string,
  indexName: string,
  field: string,
  value: unknown,
): Promise<readonly Record<string, unknown>[]> {
  const indexedQuery = db
    .query(tableName)
    .withIndex(indexName, (query) => query.eq(field, value));
  if (typeof indexedQuery.collect === "function") return await indexedQuery.collect();
  if (typeof indexedQuery.take === "function") return await indexedQuery.take(MAX_SAFE_COUNT);
  const orderedQuery = indexedQuery.order?.("desc");
  if (typeof orderedQuery?.collect === "function") return await orderedQuery.collect();
  if (typeof orderedQuery?.take === "function") return await orderedQuery.take(MAX_SAFE_COUNT);
  return [];
}

function buildResult(
  ownerState: McpReadOnlyTwoweeksDataRefsResultV1["ownerState"],
  ownerResolvedServerOnly: boolean,
  counts: OwnerDataCounts,
  grantedScopes: ReadonlySet<McpReadOnlyTwoweeksDataReadScopeV1>,
): McpReadOnlyTwoweeksDataRefsResultV1 {
  const refs: McpReadOnlyTwoweeksDataRefCandidateV1[] = [];
  const blockedRefClasses: McpReadOnlyTwoweeksDataBlockedRefClassV1[] = [];

  for (const definition of REF_DEFINITIONS) {
    if (!grantedScopes.has(definition.scope)) {
      blockedRefClasses.push({
        refClass: definition.refClass,
        reason: "missing_class_scope",
        version: 1,
      });
      continue;
    }

    const count = clampSafeCount(counts[definition.countKey]);
    refs.push({
      kind: "mcp_read_only_twoweeks_data_ref_candidate",
      refClass: definition.refClass,
      refId: definition.refId,
      label: definition.label,
      status: ownerState === "onboarding_required" ? "onboarding_required" : statusForCount(count),
      category: definition.category,
      count,
      ...(counts[definition.updatedAtKey] ? { updatedAt: counts[definition.updatedAtKey] } : {}),
      version: 1,
    });
  }

  return {
    kind: "mcp_read_only_twoweeks_data_refs_result",
    ownerState,
    refs,
    blockedRefClasses,
    capabilities: buildCapabilities(ownerResolvedServerOnly),
    modelVisible: true,
    version: 1,
  };
}

function buildCapabilities(
  ownerResolvedServerOnly: boolean,
): McpReadOnlyTwoweeksDataRefsResultV1["capabilities"] {
  return {
    ownerResolvedServerOnly,
    dataReads: "convex_read_only_refs",
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

function zeroCounts(): OwnerDataCounts {
  return {
    applicationPackageCount: 0,
    evidenceItemCount: 0,
    resumeVariantPlanCount: 0,
    reviewCockpitCount: 0,
  };
}

function countSafeEvidenceItems(
  sourceDocuments: readonly Record<string, unknown>[],
  candidateFacts: readonly Record<string, unknown>[],
): number {
  return (
    sourceDocuments.filter(isUsableEvidenceRow).length +
    candidateFacts.filter(isUsableEvidenceRow).length
  );
}

function isUsableEvidenceRow(row: Record<string, unknown>): boolean {
  return row.visibility !== "private" && row.visibility !== "never_use" && row.reviewState !== "rejected";
}

function isResumeVariantPlanArtifact(row: Record<string, unknown>): boolean {
  return row.type === "resume_variant_plan";
}

function statusForCount(count: number): McpReadOnlyTwoweeksDataRefStatusV1 {
  return count > 0 ? "available" : "no_data_available";
}

function clampSafeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), MAX_SAFE_COUNT);
}

function maxUpdatedAt<K extends keyof OwnerDataCounts>(
  key: K,
  rows: readonly Record<string, unknown>[],
): Pick<OwnerDataCounts, K> | Record<string, never> {
  const latest = rows
    .map(readUpdatedAtTimestamp)
    .filter((timestamp): timestamp is number => timestamp !== undefined)
    .sort((left, right) => right - left)[0];
  return latest === undefined ? {} : ({ [key]: new Date(latest).toISOString() } as Pick<OwnerDataCounts, K>);
}

function readUpdatedAtTimestamp(row: Record<string, unknown>): number | undefined {
  return readFiniteTimestamp(row.updatedAt) ?? readFiniteTimestamp(row.createdAt);
}

function readFiniteTimestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
