import { internalMutation, internalQuery } from "./_generated/server";
import { v, type GenericId } from "convex/values";
import { MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5 } from "../src/modules/local-mcp/mcpSafeSummaryProofMarker";

const CONTROLLED_RAIL_FLAG = "ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL";
const CONTROLLED_RAIL_MODE = "MCP_CONTROLLED_SYNTHETIC_RAIL_MODE";
const EXPECTED_FIXTURE_COUNT = 3;

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

async function buildOwnerBoundFixtureIds(
  ownerProfileId: string,
  marker: string,
): Promise<ControlledFixtureIds> {
  if (marker !== MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5) {
    throw new Error("invalid_controlled_marker");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${ownerProfileId}\u0000${marker}`),
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
): Record<string, unknown> {
  return {
    id: ids.artifactId,
    userId: ownerProfileId,
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
): readonly ControlledFixtureSpec[] {
  const sourceDocument = buildSourceDocument(ownerProfileId, ids, now);
  const candidateFact = buildCandidateFact(ownerProfileId, ids, now);
  const artifact = buildResumeVariantPlanArtifact(ownerProfileId, ids, now);
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

export const internalSeedControlledSyntheticProof = internalMutation({
  args: {
    ownerProfileId: v.id("userProfiles"),
    marker: v.string(),
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
    const ids = await buildOwnerBoundFixtureIds(
      ownerProfileId,
      args.marker,
    );
    const specs = buildFixtureSpecs(ownerProfileId, ids, args.now);
    const existingRows = await Promise.all(
      specs.map((spec) =>
        queryOwnedRow(ctx, spec.tableName, ownerProfileId, spec.id),
      ),
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
      await ctx.db.insert(specs[index].tableName, specs[index].document);
      createdCount += 1;
    }

    return {
      status: "ready" as const,
      createdCount,
      reusedCount: EXPECTED_FIXTURE_COUNT - createdCount,
      expectedCount: EXPECTED_FIXTURE_COUNT,
      ownerBound: true as const,
      version: 1 as const,
    };
  },
});

export const internalCleanupControlledSyntheticProof = internalMutation({
  args: {
    ownerProfileId: v.id("userProfiles"),
    marker: v.string(),
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
    );
    const specs = buildFixtureSpecs(ownerProfileId, ids, 0);
    const rows = await Promise.all(
      specs.map((spec) =>
        queryOwnedRow(ctx, spec.tableName, ownerProfileId, spec.id),
      ),
    );
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
      deletedCount: EXPECTED_FIXTURE_COUNT,
      residualCount: 0,
      expectedCount: EXPECTED_FIXTURE_COUNT,
      ownerBound: true as const,
      version: 1 as const,
    };
  },
});

export const internalRecoverControlledSyntheticProof = internalMutation({
  args: {
    ownerProfileId: v.id("userProfiles"),
    marker: v.string(),
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
    const ownerProfileId = await requireOwnerProfile(ctx, args.ownerProfileId);
    const ids = await buildOwnerBoundFixtureIds(ownerProfileId, args.marker);
    const specs = buildFixtureSpecs(ownerProfileId, ids, 0);
    const rows = await Promise.all(
      specs.map((spec) => queryOwnedRow(ctx, spec.tableName, ownerProfileId, spec.id)),
    );
    if (rows.some((row, index) => row !== null && !specs[index].isControlled(row))) {
      throw new Error("controlled_fixture_collision");
    }
    for (const row of rows) {
      if (row) await ctx.db.delete(row._id);
    }
    const residualRows = await Promise.all(
      specs.map((spec) => queryOwnedRow(ctx, spec.tableName, ownerProfileId, spec.id)),
    );
    if (residualRows.some(Boolean)) throw new Error("controlled_fixture_recovery_incomplete");
    return {
      status: "recovered" as const,
      deletedCount: rows.filter(Boolean).length,
      residualCount: 0 as const,
      expectedCount: EXPECTED_FIXTURE_COUNT,
      ownerBound: true as const,
      version: 1 as const,
    };
  },
});
