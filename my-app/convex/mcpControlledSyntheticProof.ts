import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v, type GenericId } from "convex/values";
import { MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5 } from "../src/modules/local-mcp/mcpSafeSummaryProofMarker";

const CONTROLLED_RAIL_FLAG = "ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL";
const CONTROLLED_RAIL_MODE = "MCP_CONTROLLED_SYNTHETIC_RAIL_MODE";
const EXPECTED_FIXTURE_COUNT = 3;
const CONTROLLED_RUN_ID_PATTERN = /^mcp-safe-summary-run-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_LEASE_TTL_MS = 30 * 60 * 1000;

export const internalResolveControlledSyntheticProofOwner = internalQuery({
  args: {
    twoweeksClerkId: v.string(),
    version: v.literal(1),
  },
  returns: v.union(v.id("userProfiles"), v.null()),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (query) => query.eq("clerkId", args.twoweeksClerkId))
      .first();
    return profile?._id ?? null;
  },
});

const CONTROLLED_PROOF_BRIDGE_OPERATION = v.union(
  v.literal("resolve_owner"),
  v.literal("application_package_summary"),
  v.literal("evidence_graph_summary"),
  v.literal("resume_variant_plan_summary"),
  v.literal("review_cockpit_summary"),
  v.literal("recover"),
  v.literal("seed"),
  v.literal("cleanup"),
);

const CONTROLLED_PROOF_BRIDGE_REF_IDS = Object.freeze({
  application_package_summary: "mcp-safe-ref:application-package:latest",
  evidence_graph_summary: "mcp-safe-ref:evidence-graph:profile",
  resume_variant_plan_summary: "mcp-safe-ref:resume-variant-plan:latest",
  review_cockpit_summary: "mcp-safe-ref:review-cockpit:latest",
});

/**
 * Temporary Clerk-authenticated bridge for the local v10 proof only.
 *
 * Convex internal functions cannot be called directly over Convex HTTP. This
 * public action keeps the internal functions server-side while binding every
 * operation to the short-lived Clerk identity supplied by the proof adapter.
 */
export const runControlledSyntheticProofOperation = internalAction({
  args: {
    operation: CONTROLLED_PROOF_BRIDGE_OPERATION,
    refId: v.optional(v.string()),
    runId: v.optional(v.string()),
    marker: v.optional(v.string()),
    now: v.optional(v.number()),
    twoweeksClerkId: v.string(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    assertControlledRailEnabled();
    const ownerProfileId: GenericId<"userProfiles"> | null = await ctx.runQuery(
      internal.mcpControlledSyntheticProof.internalResolveControlledSyntheticProofOwner,
      { twoweeksClerkId: args.twoweeksClerkId, version: 1 },
    );
    if (!ownerProfileId) throw new Error("controlled_proof_owner_not_found");
    if (args.operation === "resolve_owner") return ownerProfileId;

    if (
      args.operation === "application_package_summary" ||
      args.operation === "evidence_graph_summary" ||
      args.operation === "resume_variant_plan_summary" ||
      args.operation === "review_cockpit_summary"
    ) {
      const expectedRefId = CONTROLLED_PROOF_BRIDGE_REF_IDS[args.operation];
      if (args.refId !== expectedRefId) throw new Error("controlled_proof_ref_not_allowed");
      const common = { twoweeksClerkId: args.twoweeksClerkId };
      switch (args.operation) {
        case "application_package_summary":
          return ctx.runQuery(internal.mcpApplicationPackageSummary.internalSummarizeMcpApplicationPackage, {
            ...common,
            applicationPackageRef: {
              id: expectedRefId,
              label: "Application package availability",
              status: "available",
              category: "application_package",
              count: 1,
              version: 1,
            },
          });
        case "evidence_graph_summary":
          return ctx.runQuery(internal.mcpEvidenceGraphSummary.internalSummarizeMcpEvidenceGraph, {
            ...common,
            evidenceGraphRef: {
              id: expectedRefId,
              label: "Candidate evidence availability",
              status: "available",
              category: "evidence_graph",
              count: 1,
              version: 1,
            },
          });
        case "resume_variant_plan_summary":
          return ctx.runQuery(internal.mcpResumeVariantPlanSummary.internalSummarizeMcpResumeVariantPlan, {
            ...common,
            resumeVariantPlanRef: {
              id: expectedRefId,
              label: "Resume variant plan availability",
              status: "available",
              category: "resume_variant_plan",
              count: 1,
              version: 1,
            },
          });
        case "review_cockpit_summary":
          return ctx.runQuery(internal.mcpReviewCockpitSummary.internalSummarizeMcpReviewCockpit, {
            ...common,
            reviewCockpitRef: {
              id: expectedRefId,
              label: "Review cockpit availability",
              status: "available",
              category: "review_cockpit",
              count: 1,
              version: 1,
            },
          });
      }
    }

    if (
      args.marker !== MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5 ||
      args.runId === undefined ||
      args.now === undefined
    ) {
      throw new Error("controlled_proof_mutation_args_invalid");
    }
    const mutationArgs = {
      ownerProfileId,
      marker: args.marker,
      runId: args.runId,
      now: args.now,
      version: 1 as const,
    };
    if (args.operation === "recover") {
      return ctx.runMutation(internal.mcpControlledSyntheticProof.internalRecoverControlledSyntheticProof, mutationArgs);
    }
    if (args.operation === "seed") {
      return ctx.runMutation(internal.mcpControlledSyntheticProof.internalSeedControlledSyntheticProof, mutationArgs);
    }
    if (args.operation === "cleanup") {
      return ctx.runMutation(internal.mcpControlledSyntheticProof.internalCleanupControlledSyntheticProof, mutationArgs);
    }
    throw new Error("controlled_proof_operation_not_allowed");
  },
});

type ControlledTableName =
  | "candidateSourceDocuments"
  | "candidateFacts"
  | "applicationArtifacts";

type ControlledFixtureIds = Readonly<{
  sourceHash: string;
  sourceDocumentId: string;
  candidateFactId: string;
  artifactId: string;
  contextId: string;
  planId: string;
  planItemId: string;
  claimId: string;
}>;

type StoredRow = Record<string, unknown> & {
  _id: GenericId<ControlledTableName>;
};

type ControlledFixtureSpec = Readonly<{
  tableName: ControlledTableName;
  id: string;
  document: Record<string, unknown>;
  isControlled: (row: StoredRow) => boolean;
}>;

function assertControlledRailEnabled(): void {
  if (
    (process.env[CONTROLLED_RAIL_FLAG] ?? "").trim() !== "1" ||
    (process.env[CONTROLLED_RAIL_MODE] ?? "").trim() !== "development"
  ) {
    throw new Error("controlled_rail_disabled");
  }
}

function assertValidTimestamp(now: number): void {
  if (!Number.isSafeInteger(now) || now <= 0) {
    throw new Error("invalid_controlled_timestamp");
  }
}

function assertValidRunId(runId: string): void {
  if (!CONTROLLED_RUN_ID_PATTERN.test(runId)) {
    throw new Error("invalid_controlled_run_id");
  }
}

async function buildOwnerBoundFixtureIds(
  ownerProfileId: string,
  marker: string,
  runId: string,
): Promise<ControlledFixtureIds> {
  if (marker !== MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5) {
    throw new Error("invalid_controlled_marker");
  }
  assertValidRunId(runId);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${ownerProfileId}\u0000${marker}\u0000${runId}`),
  );
  const token = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const sourceHash = `controlled-mcp-proof-v1-${token}`;
  return {
    sourceHash,
    sourceDocumentId: `candidate-source-document:${sourceHash}`,
    candidateFactId: `candidate-fact:${sourceHash}`,
    artifactId: `application-artifact:${sourceHash}`,
    contextId: `application-context:${sourceHash}`,
    planId: `resume-variant-plan:${sourceHash}`,
    planItemId: `resume-variant-plan-item:${sourceHash}`,
    claimId: `allowed-claim:${sourceHash}`,
  };
}

async function requireOwnerProfile(
  ctx: any,
  ownerProfileId: GenericId<"userProfiles">,
): Promise<string> {
  const profile = await ctx.db.get(ownerProfileId);
  if (!profile || String(profile._id) !== String(ownerProfileId)) {
    throw new Error("controlled_owner_profile_required");
  }
  return String(ownerProfileId);
}

async function queryOwnedRow(
  ctx: any,
  tableName: ControlledTableName,
  ownerProfileId: string,
  id: string,
): Promise<StoredRow | null> {
  const indexName =
    tableName === "applicationArtifacts" ? "by_user_id" : "by_user_id_id";
  return await ctx.db
    .query(tableName)
    .withIndex(indexName, (query: any) =>
      query.eq("userId", ownerProfileId).eq("id", id),
    )
    .unique();
}

async function insertControlledFixture(
  ctx: any,
  spec: ControlledFixtureSpec,
): Promise<void> {
  await ctx.db.insert(spec.tableName, spec.document);
}

async function queryControlledArtifacts(
  ctx: any,
  ownerProfileId: string,
): Promise<StoredRow[]> {
  return (await ctx.db
    .query("applicationArtifacts")
    .withIndex("by_user_type", (query: any) =>
      query.eq("userId", ownerProfileId).eq("type", "resume_variant_plan"),
    )
    .collect()) as StoredRow[];
}

function readControlledRunId(row: StoredRow): string | null {
  const runId = row.runId;
  return typeof runId === "string" && CONTROLLED_RUN_ID_PATTERN.test(runId)
    ? runId
    : null;
}

function readLeaseStartedAt(row: StoredRow | null): number | null {
  const leaseStartedAt = row?.createdAt;
  return typeof leaseStartedAt === "number" && Number.isSafeInteger(leaseStartedAt)
    ? leaseStartedAt
    : null;
}

function isLeaseExpired(leaseStartedAt: number, now: number): boolean {
  return now >= leaseStartedAt + MCP_SAFE_SUMMARY_CONTROLLED_PROOF_LEASE_TTL_MS;
}

function isLeaseRecent(leaseStartedAt: number, now: number): boolean {
  return now < leaseStartedAt + MCP_SAFE_SUMMARY_CONTROLLED_PROOF_LEASE_TTL_MS;
}

function buildSourceDocument(
  ownerProfileId: string,
  ids: ControlledFixtureIds,
  now: number,
): Record<string, unknown> {
  return {
    id: ids.sourceDocumentId,
    userId: ownerProfileId,
    sourceType: "manual_entry",
    title: "Controlled MCP proof fixture",
    textHash: ids.sourceHash,
    sourceHash: ids.sourceHash,
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function buildCandidateFact(
  ownerProfileId: string,
  ids: ControlledFixtureIds,
  now: number,
): Record<string, unknown> {
  return {
    id: ids.candidateFactId,
    userId: ownerProfileId,
    sourceDocumentId: ids.sourceDocumentId,
    sourcePath: "document.skills[0].name",
    sourceQuote: "Synthetic verification skill",
    factType: "skill",
    value: { name: "Synthetic verification skill" },
    normalizedText: "Synthetic verification skill",
    confidence: 1,
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function buildResumeVariantPlanArtifact(
  ownerProfileId: string,
  ids: ControlledFixtureIds,
  now: number,
  runId: string,
): Record<string, unknown> {
  return {
    id: ids.artifactId,
    userId: ownerProfileId,
    runId,
    contextId: ids.contextId,
    type: "resume_variant_plan",
    status: "needs_review",
    title: "Controlled MCP proof resume plan",
    content: {
      kind: "resume_variant_plan",
      plan: {
        id: ids.planId,
        applicationContextId: ids.contextId,
        evidenceGraphId: `evidence-graph:${ids.sourceHash}`,
        evidenceGraphHash: ids.sourceHash,
        targetDocumentKind: "resume",
        language: "en",
        market: "global",
        items: [
          {
            id: ids.planItemId,
            section: "skills",
            action: "add_from_allowed_claim",
            priority: "required",
            reviewState: "pending",
            allowedClaimIds: [ids.claimId],
            candidateFactIds: [ids.candidateFactId],
            evidenceMatchIds: [],
            demandIds: [],
            riskFlagIds: [],
            reason: "Controlled non-PII fixture",
            version: 1,
          },
        ],
        warnings: [],
        blockedClaimIds: [],
        sourceFactIds: [ids.candidateFactId],
        allowedClaimIds: [ids.claimId],
        riskFlagIds: [],
        blocked: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      version: 1,
    },
    sourceHashes: {
      contextHash: ids.sourceHash,
      evidenceGraphHash: ids.sourceHash,
      generatorInputHash: ids.sourceHash,
    },
    provenance: {
      evidenceGraphId: `evidence-graph:${ids.sourceHash}`,
      sourceFactIds: [ids.candidateFactId],
    },
    sourceRefs: [
      {
        sourceType: "candidate_fact",
        sourceId: ids.candidateFactId,
        sourcePath: "document.skills[0].name",
        sourceHash: ids.sourceHash,
      },
    ],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function isExactControlledDocument(
  row: StoredRow,
  expectedDocument: Record<string, unknown>,
): boolean {
  return structurallyEqual(
    stripVolatileFields(row),
    stripVolatileFields(expectedDocument),
  );
}

function stripVolatileFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripVolatileFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["_id", "_creationTime", "createdAt", "updatedAt"].includes(key))
      .map(([key, child]) => [key, stripVolatileFields(child)]),
  );
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]))
    );
  }
  if (
    !left ||
    !right ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        structurallyEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

function buildFixtureSpecs(
  ownerProfileId: string,
  ids: ControlledFixtureIds,
  now: number,
  runId: string,
): readonly ControlledFixtureSpec[] {
  const sourceDocument = buildSourceDocument(ownerProfileId, ids, now);
  const candidateFact = buildCandidateFact(ownerProfileId, ids, now);
  const artifact = buildResumeVariantPlanArtifact(ownerProfileId, ids, now, runId);
  return [
    {
      tableName: "candidateSourceDocuments",
      id: ids.sourceDocumentId,
      document: sourceDocument,
      isControlled: (row) =>
        isExactControlledDocument(row, sourceDocument),
    },
    {
      tableName: "candidateFacts",
      id: ids.candidateFactId,
      document: candidateFact,
      isControlled: (row) => isExactControlledDocument(row, candidateFact),
    },
    {
      tableName: "applicationArtifacts",
      id: ids.artifactId,
      document: artifact,
      isControlled: (row) => isExactControlledDocument(row, artifact),
    },
  ];
}

function buildSpecsForRows(
  ownerProfileId: string,
  ids: ControlledFixtureIds,
  runId: string,
  now: number,
): readonly ControlledFixtureSpec[] {
  return buildFixtureSpecs(ownerProfileId, ids, now, runId);
}

async function discoverExpiredControlledRunIds(
  ctx: any,
  ownerProfileId: string,
  marker: string,
  now: number,
): Promise<Set<string>> {
  const expiredRunIds = new Set<string>();
  const artifacts = await queryControlledArtifacts(ctx, ownerProfileId);
  for (const artifact of artifacts) {
    const runId = readControlledRunId(artifact);
    const leaseStartedAt = readLeaseStartedAt(artifact);
    if (!runId || leaseStartedAt === null || !isLeaseExpired(leaseStartedAt, now)) continue;
    const ids = await buildOwnerBoundFixtureIds(ownerProfileId, marker, runId);
    if (artifact.id !== ids.artifactId) continue;
    const artifactSpec = buildFixtureSpecs(
      ownerProfileId,
      ids,
      0,
      runId,
    )[2];
    if (artifactSpec.isControlled(artifact)) expiredRunIds.add(runId);
  }
  return expiredRunIds;
}

async function assertNoRecentOtherControlledRun(
  ctx: any,
  ownerProfileId: string,
  marker: string,
  currentRunId: string,
  now: number,
): Promise<void> {
  const artifacts = await queryControlledArtifacts(ctx, ownerProfileId);
  for (const artifact of artifacts) {
    const runId = readControlledRunId(artifact);
    const leaseStartedAt = readLeaseStartedAt(artifact);
    if (
      !runId ||
      runId === currentRunId ||
      leaseStartedAt === null ||
      !isLeaseRecent(leaseStartedAt, now)
    ) {
      continue;
    }
    const ids = await buildOwnerBoundFixtureIds(ownerProfileId, marker, runId);
    if (artifact.id !== ids.artifactId) continue;
    const artifactSpec = buildFixtureSpecs(
      ownerProfileId,
      ids,
      0,
      runId,
    )[2];
    if (artifactSpec.isControlled(artifact)) {
      throw new Error("controlled_proof_already_running");
    }
  }
}

export const internalSeedControlledSyntheticProof = internalMutation({
  args: {
    ownerProfileId: v.id("userProfiles"),
    marker: v.string(),
    runId: v.string(),
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.object({
    status: v.literal("ready"),
    createdCount: v.number(),
    reusedCount: v.number(),
    expectedCount: v.literal(EXPECTED_FIXTURE_COUNT),
    ownerBound: v.literal(true),
    version: v.literal(1),
  }),
  handler: async (ctx, args) => {
    assertControlledRailEnabled();
    assertValidTimestamp(args.now);
    const ownerProfileId = await requireOwnerProfile(ctx, args.ownerProfileId);
    assertValidRunId(args.runId);
    await assertNoRecentOtherControlledRun(
      ctx,
      ownerProfileId,
      args.marker,
      args.runId,
      args.now,
    );
    const ids = await buildOwnerBoundFixtureIds(
      ownerProfileId,
      args.marker,
      args.runId,
    );
    const existingRows = await Promise.all(
      buildFixtureSpecs(
        ownerProfileId,
        ids,
        args.now,
        args.runId,
      ).map((spec) =>
        queryOwnedRow(ctx, spec.tableName, ownerProfileId, spec.id),
      ),
    );
    const specs = buildSpecsForRows(
      ownerProfileId,
      ids,
      args.runId,
      args.now,
    );
    if (
      existingRows.some(
        (row, index) => row !== null && !specs[index].isControlled(row),
      )
    ) {
      throw new Error("controlled_fixture_collision");
    }

    let createdCount = 0;
    for (let index = 0; index < specs.length; index += 1) {
      if (existingRows[index] !== null) continue;
      await insertControlledFixture(ctx, specs[index]);
      createdCount += 1;
    }

    return {
      status: "ready" as const,
      createdCount,
      reusedCount: EXPECTED_FIXTURE_COUNT - createdCount,
      expectedCount: EXPECTED_FIXTURE_COUNT as typeof EXPECTED_FIXTURE_COUNT,
      ownerBound: true as const,
      version: 1 as const,
    };
  },
});

export const internalCleanupControlledSyntheticProof = internalMutation({
  args: {
    ownerProfileId: v.id("userProfiles"),
    marker: v.string(),
    runId: v.string(),
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.object({
    status: v.literal("clean"),
    deletedCount: v.literal(EXPECTED_FIXTURE_COUNT),
    residualCount: v.literal(0),
    expectedCount: v.literal(EXPECTED_FIXTURE_COUNT),
    ownerBound: v.literal(true),
    version: v.literal(1),
  }),
  handler: async (ctx, args) => {
    assertControlledRailEnabled();
    const ownerProfileId = await requireOwnerProfile(ctx, args.ownerProfileId);
    const ids = await buildOwnerBoundFixtureIds(
      ownerProfileId,
      args.marker,
      args.runId,
    );
    const rows = await Promise.all(
      buildFixtureSpecs(
        ownerProfileId,
        ids,
        0,
        args.runId,
      ).map((spec) =>
        queryOwnedRow(ctx, spec.tableName, ownerProfileId, spec.id),
      ),
    );
    const specs = buildSpecsForRows(ownerProfileId, ids, args.runId, 0);
    if (rows.some((row) => row === null)) {
      throw new Error("controlled_fixture_missing");
    }
    if (
      rows.some(
        (row, index) => !specs[index].isControlled(row as StoredRow),
      )
    ) {
      throw new Error("controlled_fixture_collision");
    }

    for (const row of rows as StoredRow[]) {
      await ctx.db.delete(row._id);
    }
    const residualRows = await Promise.all(
      specs.map((spec) =>
        queryOwnedRow(ctx, spec.tableName, ownerProfileId, spec.id),
      ),
    );
    const residualCount = residualRows.filter(Boolean).length;
    if (residualCount !== 0) {
      throw new Error("controlled_fixture_cleanup_incomplete");
    }

    return {
      status: "clean" as const,
      deletedCount: EXPECTED_FIXTURE_COUNT as typeof EXPECTED_FIXTURE_COUNT,
      residualCount: 0 as const,
      expectedCount: EXPECTED_FIXTURE_COUNT as typeof EXPECTED_FIXTURE_COUNT,
      ownerBound: true as const,
      version: 1 as const,
    };
  },
});

export const internalRecoverControlledSyntheticProof = internalMutation({
  args: {
    ownerProfileId: v.id("userProfiles"),
    marker: v.string(),
    runId: v.string(),
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.object({
    status: v.literal("recovered"),
    deletedCount: v.number(),
    residualCount: v.literal(0),
    expectedCount: v.literal(EXPECTED_FIXTURE_COUNT),
    ownerBound: v.literal(true),
    version: v.literal(1),
  }),
  handler: async (ctx, args) => {
    assertControlledRailEnabled();
    assertValidTimestamp(args.now);
    const ownerProfileId = await requireOwnerProfile(ctx, args.ownerProfileId);
    assertValidRunId(args.runId);
    const runIds = await discoverExpiredControlledRunIds(
      ctx,
      ownerProfileId,
      args.marker,
      args.now,
    );
    runIds.add(args.runId);
    let deletedCount = 0;
    for (const runId of runIds) {
      const ids = await buildOwnerBoundFixtureIds(ownerProfileId, args.marker, runId);
      const initialSpecs = buildFixtureSpecs(
        ownerProfileId,
        ids,
        args.now,
        runId,
      );
      const rows = await Promise.all(
        initialSpecs.map((spec) =>
          queryOwnedRow(ctx, spec.tableName, ownerProfileId, spec.id),
        ),
      );
      const specs = buildSpecsForRows(ownerProfileId, ids, runId, args.now);
      if (rows.some((row, index) => row !== null && !specs[index].isControlled(row))) {
        throw new Error("controlled_fixture_collision");
      }
      for (const row of rows) {
        if (row) {
          await ctx.db.delete(row._id);
          deletedCount += 1;
        }
      }
      const residualRows = await Promise.all(
        specs.map((spec) =>
          queryOwnedRow(ctx, spec.tableName, ownerProfileId, spec.id),
        ),
      );
      if (residualRows.some(Boolean)) throw new Error("controlled_fixture_recovery_incomplete");
    }
    return {
      status: "recovered" as const,
      deletedCount,
      residualCount: 0 as const,
      expectedCount: EXPECTED_FIXTURE_COUNT as typeof EXPECTED_FIXTURE_COUNT,
      ownerBound: true as const,
      version: 1 as const,
    };
  },
});
