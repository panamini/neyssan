import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

type McpApplicationPackageSummaryStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required";

type McpApplicationPackageSummaryMissingDataReasonV1 =
  | "application_package_not_available"
  | "owner_onboarding_required";

type McpApplicationPackageSummaryRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpApplicationPackageSummaryStatusV1;
  category: "application_package";
  count: number;
  updatedAt?: string;
  version: 1;
}>;

type McpApplicationPackageSummaryResultV1 = Readonly<{
  kind: "mcp_application_package_summary_result";
  allowed: true;
  status: McpApplicationPackageSummaryStatusV1;
  packageRef: McpApplicationPackageSummaryRefV1;
  availability: {
    source: "convex_application_package_summary";
    ownerState: "resolved" | "onboarding_required";
    version: 1;
  };
  safeCounts: {
    packages: number;
    artifacts: number;
    provenanceLinks: number;
    reviewItems: number;
    warnings: number;
    blockers: number;
    version: 1;
  };
  safeCategories: {
    packageStatus?: "draft" | "needs_review" | "blocked" | "ready_for_review";
    resumeVariantArtifactStatus?: string;
    coverLetterArtifactStatus?: string;
    version: 1;
  };
  updatedAt?: string;
  missingDataReason?: McpApplicationPackageSummaryMissingDataReasonV1;
  capabilities: {
    ownerResolution: "blocked" | "server_only";
    dataReads: "convex_application_package_summary";
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

const MAX_SAFE_COUNT = 100;

const mcpApplicationPackageSummaryStatusValidator = v.union(
  v.literal("available"),
  v.literal("no_data_available"),
  v.literal("onboarding_required"),
);

const mcpApplicationPackageRefValidator = v.object({
  id: v.string(),
  label: v.string(),
  status: mcpApplicationPackageSummaryStatusValidator,
  category: v.literal("application_package"),
  count: v.number(),
  updatedAt: v.optional(v.string()),
  version: v.literal(1),
});

const mcpApplicationPackageSummaryResultValidator = v.object({
  kind: v.literal("mcp_application_package_summary_result"),
  allowed: v.literal(true),
  status: mcpApplicationPackageSummaryStatusValidator,
  packageRef: mcpApplicationPackageRefValidator,
  availability: v.object({
    source: v.literal("convex_application_package_summary"),
    ownerState: v.union(v.literal("resolved"), v.literal("onboarding_required")),
    version: v.literal(1),
  }),
  safeCounts: v.object({
    packages: v.number(),
    artifacts: v.number(),
    provenanceLinks: v.number(),
    reviewItems: v.number(),
    warnings: v.number(),
    blockers: v.number(),
    version: v.literal(1),
  }),
  safeCategories: v.object({
    packageStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("needs_review"),
        v.literal("blocked"),
        v.literal("ready_for_review"),
      ),
    ),
    resumeVariantArtifactStatus: v.optional(v.string()),
    coverLetterArtifactStatus: v.optional(v.string()),
    version: v.literal(1),
  }),
  updatedAt: v.optional(v.string()),
  missingDataReason: v.optional(
    v.union(
      v.literal("application_package_not_available"),
      v.literal("owner_onboarding_required"),
    ),
  ),
  capabilities: v.object({
    ownerResolution: v.union(v.literal("blocked"), v.literal("server_only")),
    dataReads: v.literal("convex_application_package_summary"),
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

export const internalSummarizeMcpApplicationPackage = internalQuery({
  args: {
    twoweeksClerkId: v.string(),
    applicationPackageRef: mcpApplicationPackageRefValidator,
  },
  returns: mcpApplicationPackageSummaryResultValidator,
  handler: async (ctx, args): Promise<McpApplicationPackageSummaryResultV1> => {
    return await summarizeMcpApplicationPackage(ctx.db as unknown as DbReader, args);
  },
});

async function summarizeMcpApplicationPackage(
  db: DbReader,
  args: Readonly<{
    twoweeksClerkId: string;
    applicationPackageRef: McpApplicationPackageSummaryRefV1;
  }>,
): Promise<McpApplicationPackageSummaryResultV1> {
  const packageRef = normalizePackageRef(args.applicationPackageRef);
  if (packageRef.status === "onboarding_required") {
    return buildUnavailableSummary(packageRef, "owner_onboarding_required", "blocked");
  }
  if (packageRef.status === "no_data_available") {
    return buildUnavailableSummary(packageRef, "application_package_not_available", "server_only");
  }

  const profileIds = await readProfileIdsForOwner(db, args.twoweeksClerkId);
  if (profileIds.length === 0) {
    return buildUnavailableSummary(
      { ...packageRef, status: "onboarding_required", count: 0 },
      "owner_onboarding_required",
      "blocked",
    );
  }

  const packages = sortLatestApplicationPackages(
    await queryByFieldForProfileIds(
      db,
      "applicationPackages",
      "by_user_id",
      "userId",
      profileIds,
    ),
  );
  if (packages.length === 0) {
    return buildUnavailableSummary(
      { ...packageRef, status: "no_data_available", count: 0 },
      "application_package_not_available",
      "server_only",
    );
  }

  const latestPackage = packages[0];
  return {
    kind: "mcp_application_package_summary_result",
    allowed: true,
    status: "available",
    packageRef: {
      ...packageRef,
      status: "available",
      count: clampSafeCount(packages.length),
      ...maxUpdatedAt(latestPackage),
    },
    availability: {
      source: "convex_application_package_summary",
      ownerState: "resolved",
      version: 1,
    },
    safeCounts: buildSafeCounts(packages.length, latestPackage),
    safeCategories: buildSafeCategories(latestPackage),
    ...maxUpdatedAt(latestPackage),
    capabilities: buildCapabilities("server_only"),
    modelVisible: true,
    version: 1,
  };
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

function buildUnavailableSummary(
  packageRef: McpApplicationPackageSummaryRefV1,
  missingDataReason: McpApplicationPackageSummaryMissingDataReasonV1,
  ownerResolution: "blocked" | "server_only",
): McpApplicationPackageSummaryResultV1 {
  return {
    kind: "mcp_application_package_summary_result",
    allowed: true,
    status: packageRef.status,
    packageRef: { ...packageRef, count: 0 },
    availability: {
      source: "convex_application_package_summary",
      ownerState: packageRef.status === "onboarding_required" ? "onboarding_required" : "resolved",
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
  packageCount: number,
  row: Record<string, unknown>,
): McpApplicationPackageSummaryResultV1["safeCounts"] {
  return {
    packages: clampSafeCount(packageCount),
    artifacts: countArtifactRefs(row),
    provenanceLinks: clampSafeCount(
      countStringArray(row.sourceFactIds) +
        countStringArray(row.allowedClaimIds) +
        countStringArray(row.evidenceMatchIds) +
        countStringArray(row.demandIds) +
        countStringArray(row.riskFlagIds),
    ),
    reviewItems: clampSafeCount(countStringArray(row.reviewItemIds)),
    warnings: 0,
    blockers: row.status === "blocked" ? 1 : 0,
    version: 1,
  };
}

function buildSafeCategories(
  row: Record<string, unknown>,
): McpApplicationPackageSummaryResultV1["safeCategories"] {
  const packageStatus = readPackageStatus(row.status);
  const resumeVariantArtifactStatus = readSafeCategory(row.resumeVariantArtifactStatus);
  const coverLetterArtifactStatus = readSafeCategory(row.coverLetterArtifactStatus);
  return {
    ...(packageStatus ? { packageStatus } : {}),
    ...(resumeVariantArtifactStatus ? { resumeVariantArtifactStatus } : {}),
    ...(coverLetterArtifactStatus ? { coverLetterArtifactStatus } : {}),
    version: 1,
  };
}

function buildCapabilities(
  ownerResolution: McpApplicationPackageSummaryResultV1["capabilities"]["ownerResolution"],
): McpApplicationPackageSummaryResultV1["capabilities"] {
  return {
    ownerResolution,
    dataReads: "convex_application_package_summary",
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

function zeroCounts(): McpApplicationPackageSummaryResultV1["safeCounts"] {
  return {
    packages: 0,
    artifacts: 0,
    provenanceLinks: 0,
    reviewItems: 0,
    warnings: 0,
    blockers: 0,
    version: 1,
  };
}

function normalizePackageRef(
  packageRef: McpApplicationPackageSummaryRefV1,
): McpApplicationPackageSummaryRefV1 {
  return {
    id: "mcp-safe-ref:application-package:latest",
    label: "Application package availability",
    status: packageRef.status,
    category: "application_package",
    count: clampSafeCount(packageRef.count),
    ...(isIsoTimestamp(packageRef.updatedAt) ? { updatedAt: packageRef.updatedAt } : {}),
    version: 1,
  };
}

function sortLatestApplicationPackages(
  records: readonly Record<string, unknown>[],
): readonly Record<string, unknown>[] {
  return [...records].sort((left, right) => {
    const createdDelta = readFiniteTimestamp(right.createdAt) - readFiniteTimestamp(left.createdAt);
    if (createdDelta !== 0) return createdDelta;
    const updatedDelta = readFiniteTimestamp(right.updatedAt) - readFiniteTimestamp(left.updatedAt);
    if (updatedDelta !== 0) return updatedDelta;
    return String(left.applicationPackageId ?? "").localeCompare(
      String(right.applicationPackageId ?? ""),
    );
  });
}

function countArtifactRefs(row: Record<string, unknown>): number {
  return [row.resumeVariantArtifactId, row.coverLetterArtifactId].filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  ).length;
}

function countStringArray(value: unknown): number {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim().length > 0).length
    : 0;
}

function maxUpdatedAt(
  row: Record<string, unknown>,
): Pick<McpApplicationPackageSummaryResultV1, "updatedAt"> | Record<string, never> {
  const timestamp = readFiniteTimestamp(row.updatedAt) || readFiniteTimestamp(row.createdAt);
  return timestamp > 0 ? { updatedAt: new Date(timestamp).toISOString() } : {};
}

function readFiniteTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readPackageStatus(
  value: unknown,
): McpApplicationPackageSummaryResultV1["safeCategories"]["packageStatus"] | undefined {
  return value === "draft" ||
    value === "needs_review" ||
    value === "blocked" ||
    value === "ready_for_review"
    ? value
    : undefined;
}

function readSafeCategory(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z][a-z0-9_]{1,80}$/u.test(value) ? value : undefined;
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
