import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  internalCleanupControlledSyntheticProof,
  internalRecoverControlledSyntheticProof,
  internalResolveControlledSyntheticProofOwner,
  internalSeedControlledSyntheticProof,
  MCP_SAFE_SUMMARY_CONTROLLED_PROOF_LEASE_TTL_MS,
} from "../mcpControlledSyntheticProof";
import { internalSummarizeMcpApplicationPackage } from "../mcpApplicationPackageSummary";
import { MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5 } from "../../src/modules/local-mcp/mcpSafeSummaryProofMarker";

const MARKER = MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5;
const OWNER_A = "profile_A";
const OWNER_B = "profile_B";
const SEEDED_AT = 1_721_000_000_000;
const RUN_ID_A = "mcp-safe-summary-run-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUN_ID_B = "mcp-safe-summary-run-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const CONTROLLED_PROOF_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpControlledSyntheticProof.ts",
);

type TableName =
  | "userProfiles"
  | "candidateSourceDocuments"
  | "candidateFacts"
  | "applicationArtifacts"
  | "applicationPackages";

type StoredDocument = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

function readField(document: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, document);
}

function makeCtx() {
  const tables: Record<TableName, StoredDocument[]> = {
    userProfiles: [
      { _id: OWNER_A, _creationTime: 1, clerkId: "clerk_owner", version: 1 },
      { _id: OWNER_B, _creationTime: 2, clerkId: "clerk_other", version: 1 },
    ],
    candidateSourceDocuments: [],
    candidateFacts: [],
    applicationArtifacts: [],
    applicationPackages: [],
  };
  let nextStorageId = 1;

  const db = {
    get: vi.fn(async (storageId: string) => {
      for (const tableName of Object.keys(tables) as TableName[]) {
        const row = tables[tableName].find(
          (document) => document._id === storageId,
        );
        if (row) return row;
      }
      return null;
    }),
    query: vi.fn((tableName: TableName) => ({
      withIndex: (
        _indexName: string,
        buildQuery: (query: {
          eq: (field: string, value: unknown) => unknown;
        }) => unknown,
      ) => {
        const constraints: Array<{ field: string; value: unknown }> = [];
        const queryBuilder = {
          eq(field: string, value: unknown) {
            constraints.push({ field, value });
            return queryBuilder;
          },
        };
        buildQuery(queryBuilder);
        return {
          unique: async () => {
            const rows = tables[tableName].filter((document) =>
              constraints.every(
                ({ field, value }) => readField(document, field) === value,
              ),
            );
            if (rows.length > 1) throw new Error("not unique");
            return rows[0] ?? null;
          },
          first: async () => {
            const rows = tables[tableName].filter((document) =>
              constraints.every(
                ({ field, value }) => readField(document, field) === value,
              ),
            );
            return rows[0] ?? null;
          },
          collect: async () => tables[tableName].filter((document) =>
            constraints.every(
              ({ field, value }) => readField(document, field) === value,
            ),
          ),
        };
      },
    })),
    insert: vi.fn(
      async (
        tableName: Exclude<TableName, "userProfiles">,
        document: Record<string, unknown>,
      ) => {
        const stored = {
          _id: `${tableName}_${nextStorageId++}`,
          _creationTime: Date.now(),
          ...document,
        };
        tables[tableName].push(stored);
        return stored._id;
      },
    ),
    delete: vi.fn(async (storageId: string) => {
      for (const tableName of Object.keys(tables) as TableName[]) {
        const index = tables[tableName].findIndex(
          (document) => document._id === storageId,
        );
        if (index >= 0) {
          tables[tableName].splice(index, 1);
          return;
        }
      }
    }),
  };

  return { ctx: { db }, db, tables };
}

function fixtureCount(tables: Record<TableName, StoredDocument[]>): number {
  return (
    tables.candidateSourceDocuments.length +
    tables.candidateFacts.length +
    tables.applicationArtifacts.length +
    tables.applicationPackages.length
  );
}

function applicationPackageRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-safe-ref:application-package:latest",
    label: "Application package availability",
    status: "available",
    category: "application_package",
    count: 1,
    version: 1,
    ...overrides,
  };
}

async function summarizeApplicationPackage(
  ctx: { db: unknown },
  clerkId: string,
) {
  return await internalSummarizeMcpApplicationPackage._handler(ctx as any, {
    twoweeksClerkId: clerkId,
    applicationPackageRef: applicationPackageRef(),
  });
}

function seedArgs(ownerProfileId = OWNER_A, runId = RUN_ID_A) {
  return {
    ownerProfileId,
    marker: MARKER,
    runId,
    now: SEEDED_AT,
    version: 1 as const,
  };
}

function cleanupArgs(ownerProfileId = OWNER_A, runId = RUN_ID_A) {
  return {
    ownerProfileId,
    marker: MARKER,
    runId,
    now: SEEDED_AT,
    version: 1 as const,
  };
}

function recoveryArgs(ownerProfileId = OWNER_A, runId = RUN_ID_A, now = SEEDED_AT) {
  return {
    ownerProfileId,
    marker: MARKER,
    runId,
    now,
    version: 1 as const,
  };
}

describe("minimal controlled synthetic MCP fixture", () => {
  beforeEach(() => {
    process.env.ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL = "1";
    process.env.MCP_CONTROLLED_SYNTHETIC_RAIL_MODE = "development";
  });

  it("resolves the owner profile on the Convex side from the authenticated Clerk subject", async () => {
    const { ctx } = makeCtx();
    const result = await internalResolveControlledSyntheticProofOwner._handler(
      ctx as any,
      { twoweeksClerkId: "clerk_owner", version: 1 },
    );
    expect(result).toBe(OWNER_A);
  });

  afterEach(() => {
    delete process.env.ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL;
    delete process.env.MCP_CONTROLLED_SYNTHETIC_RAIL_MODE;
    vi.restoreAllMocks();
  });

  it("fails closed when the feature flag is disabled", async () => {
    delete process.env.ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL;
    const { ctx, tables } = makeCtx();

    await expect(
      internalSeedControlledSyntheticProof._handler(
        ctx as any,
        seedArgs() as any,
      ),
    ).rejects.toThrow("controlled_rail_disabled");

    expect(fixtureCount(tables)).toBe(0);
  });

  it("fails closed outside the explicit development mode", async () => {
    process.env.MCP_CONTROLLED_SYNTHETIC_RAIL_MODE = "production";
    const { ctx, tables } = makeCtx();

    await expect(
      internalSeedControlledSyntheticProof._handler(
        ctx as any,
        seedArgs() as any,
      ),
    ).rejects.toThrow("controlled_rail_disabled");

    expect(fixtureCount(tables)).toBe(0);
  });

  it("rejects malformed markers, timestamps, and absent owners", async () => {
    const malformed = makeCtx();
    await expect(
      internalSeedControlledSyntheticProof._handler(malformed.ctx as any, {
        ...seedArgs(),
        marker: "not-a-marker",
      } as any),
    ).rejects.toThrow("invalid_controlled_marker");
    expect(fixtureCount(malformed.tables)).toBe(0);

    const invalidTimestamp = makeCtx();
    await expect(
      internalSeedControlledSyntheticProof._handler(
        invalidTimestamp.ctx as any,
        { ...seedArgs(), now: 0 } as any,
      ),
    ).rejects.toThrow("invalid_controlled_timestamp");
    expect(fixtureCount(invalidTimestamp.tables)).toBe(0);

    const missingOwner = makeCtx();
    await expect(
      internalSeedControlledSyntheticProof._handler(
        missingOwner.ctx as any,
        seedArgs("missing_profile") as any,
      ),
    ).rejects.toThrow("controlled_owner_profile_required");
    expect(fixtureCount(missingOwner.tables)).toBe(0);
  });

  it("rejects malformed run identifiers before touching fixtures", async () => {
    const { ctx, tables } = makeCtx();

    await expect(
      internalSeedControlledSyntheticProof._handler(
        ctx as any,
        { ...seedArgs(), runId: "not-a-run-id" } as any,
      ),
    ).rejects.toThrow("invalid_controlled_run_id");

    expect(fixtureCount(tables)).toBe(0);
  });

  it("seeds exactly four non-PII rows including a needs_review package and returns only safe counters", async () => {
    const { ctx, db, tables } = makeCtx();

    const result = await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );

    expect(result).toEqual({
      status: "ready",
      createdCount: 4,
      reusedCount: 0,
      expectedCount: 4,
      ownerBound: true,
      version: 1,
    });
    expect(db.insert).toHaveBeenCalledTimes(4);
    expect(tables.candidateSourceDocuments).toHaveLength(1);
    expect(tables.candidateFacts).toHaveLength(1);
    expect(tables.applicationArtifacts).toHaveLength(1);
    expect(tables.applicationPackages).toHaveLength(1);
    expect(tables.applicationPackages[0].status).toBe("needs_review");
    expect(tables.applicationPackages[0].userId).toBe(OWNER_A);
    const packagePayload = tables.applicationPackages[0].package as Record<string, unknown>;
    expect(packagePayload.warnings).toEqual([]);
    expect(packagePayload.items).toHaveLength(2);
    expect(tables.applicationArtifacts[0].runId).toBe(RUN_ID_A);
    expect(JSON.stringify(result)).not.toContain(MARKER);
    expect(JSON.stringify(result)).not.toContain(OWNER_A);
    expect(JSON.stringify(tables)).not.toMatch(
      /@|email|phone|address|employer|person/i,
    );
  });

  it("reuses only the exact owner-bound fixture", async () => {
    const { ctx, db, tables } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );

    const second = await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );

    expect(second).toMatchObject({ createdCount: 0, reusedCount: 4 });
    expect(db.insert).toHaveBeenCalledTimes(4);
    expect(fixtureCount(tables)).toBe(4);
  });

  it("binds the synthetic marker to the owner profile", async () => {
    const { ctx, db, tables } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );

    await expect(
      internalCleanupControlledSyntheticProof._handler(
        ctx as any,
        cleanupArgs(OWNER_B) as any,
      ),
    ).rejects.toThrow("controlled_fixture_missing");

    expect(db.delete).not.toHaveBeenCalled();
    expect(fixtureCount(tables)).toBe(4);

    tables.applicationPackages[0].userId = OWNER_A;
    await internalCleanupControlledSyntheticProof._handler(
      ctx as any,
      cleanupArgs() as any,
    );
    expect(fixtureCount(tables)).toBe(0);
  });

  it("fails closed on collision before inserting or deleting", async () => {
    const { ctx, db, tables } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );
    tables.applicationPackages[0].userId = OWNER_B;
    db.delete.mockClear();

    await expect(
      internalCleanupControlledSyntheticProof._handler(
        ctx as any,
        cleanupArgs() as any,
      ),
    ).rejects.toThrow("controlled_fixture_collision");

    expect(db.delete).not.toHaveBeenCalled();
    expect(fixtureCount(tables)).toBe(4);
  });

  it("refuses cleanup when any nested fixture-authored field has drifted", async () => {
    const { ctx, db, tables } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );
    const content = tables.applicationArtifacts[0]
      .content as Record<string, unknown>;
    const plan = content.plan as Record<string, unknown>;
    const items = plan.items as Array<Record<string, unknown>>;
    items[0].reason = "drifted fixture";
    db.delete.mockClear();

    await expect(
      internalCleanupControlledSyntheticProof._handler(
        ctx as any,
        cleanupArgs() as any,
      ),
    ).rejects.toThrow("controlled_fixture_collision");

    expect(db.delete).not.toHaveBeenCalled();
    expect(fixtureCount(tables)).toBe(4);
  });

  it("deletes exactly the four controlled rows and leaves zero residue", async () => {
    const { ctx, db, tables } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );

    const result = await internalCleanupControlledSyntheticProof._handler(
      ctx as any,
      cleanupArgs() as any,
    );

    expect(result).toEqual({
      status: "clean",
      deletedCount: 4,
      residualCount: 0,
      expectedCount: 4,
      ownerBound: true,
      version: 1,
    });
    expect(db.delete).toHaveBeenCalledTimes(4);
    expect(fixtureCount(tables)).toBe(0);
    expect(JSON.stringify(result)).not.toContain(MARKER);
    expect(JSON.stringify(result)).not.toContain(OWNER_A);
  });

  it("recovers an expired prior run after process restart without knowing its runId", async () => {
    const { ctx, db, tables } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs(OWNER_A, RUN_ID_A) as any,
    );

    const result = await internalRecoverControlledSyntheticProof._handler(
      ctx as any,
      recoveryArgs(
        OWNER_A,
        RUN_ID_B,
        SEEDED_AT + MCP_SAFE_SUMMARY_CONTROLLED_PROOF_LEASE_TTL_MS + 1,
      ),
    );

    expect(result).toEqual({
      status: "recovered",
      deletedCount: 4,
      residualCount: 0,
      expectedCount: 4,
      ownerBound: true,
      version: 1,
    });
    expect(db.delete).toHaveBeenCalledTimes(4);
    expect(fixtureCount(tables)).toBe(0);

    const reseeded = await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      {
        ...seedArgs(OWNER_A, RUN_ID_B),
        now: SEEDED_AT + MCP_SAFE_SUMMARY_CONTROLLED_PROOF_LEASE_TTL_MS + 1,
      } as any,
    );
    expect(reseeded).toMatchObject({ createdCount: 4, reusedCount: 0 });
  });

  it("refuses cleanup when any controlled row is absent", async () => {
    const { ctx, db, tables } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );
    tables.candidateFacts.splice(0, 1);
    db.delete.mockClear();

    await expect(
      internalCleanupControlledSyntheticProof._handler(
        ctx as any,
        cleanupArgs() as any,
      ),
    ).rejects.toThrow("controlled_fixture_missing");

    expect(db.delete).not.toHaveBeenCalled();
    expect(fixtureCount(tables)).toBe(3);
  });

  it("refuses a recent concurrent run and preserves its fixtures during recovery", async () => {
    const { ctx, db, tables } = makeCtx();

    const first = await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs(OWNER_A, RUN_ID_A) as any,
    );
    await expect(
      internalSeedControlledSyntheticProof._handler(
        ctx as any,
        seedArgs(OWNER_A, RUN_ID_B) as any,
      ),
    ).rejects.toThrow("controlled_proof_already_running");

    expect(first).toMatchObject({ createdCount: 4, reusedCount: 0 });
    expect(fixtureCount(tables)).toBe(4);

    const recovery = await internalRecoverControlledSyntheticProof._handler(
      ctx as any,
      recoveryArgs(OWNER_A, RUN_ID_B, SEEDED_AT + 1) as any,
    );
    expect(recovery.deletedCount).toBe(0);
    expect(fixtureCount(tables)).toBe(4);

    await internalCleanupControlledSyntheticProof._handler(
      ctx as any,
      cleanupArgs(OWNER_A, RUN_ID_A) as any,
    );
    expect(fixtureCount(tables)).toBe(0);

    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs(OWNER_A, RUN_ID_B) as any,
    );
    expect(fixtureCount(tables)).toBe(4);

    await internalCleanupControlledSyntheticProof._handler(
      ctx as any,
      cleanupArgs(OWNER_A, RUN_ID_B) as any,
    );
    expect(fixtureCount(tables)).toBe(0);
    expect(db.delete).toHaveBeenCalledTimes(8);
  });

  it("returns available bounded package data for account A", async () => {
    const { ctx, tables } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(ctx as any, seedArgs() as any);

    const result = await summarizeApplicationPackage(ctx, "clerk_owner");
    const packageRow = tables.applicationPackages[0];

    expect(result).toMatchObject({
      status: "available",
      packageRef: { status: "available", count: 1 },
      safeCounts: {
        packages: 1,
        artifacts: 2,
        provenanceLinks: 2,
        reviewItems: 1,
        warnings: 0,
        blockers: 0,
      },
      safeCategories: {
        packageStatus: "needs_review",
        resumeVariantArtifactStatus: "draft",
        coverLetterArtifactStatus: "needs_review",
      },
      capabilities: {
        dataWrites: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        rawDataProjection: "blocked",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /@|email|phone|address|employer|retry|repair|fallback/i,
    );
    expect(JSON.stringify(packageRow)).not.toMatch(
      /"(?:text|rawText|raw_text|content|resumeText|coverLetterText|fullCvText|fullJobText|pdf|docx|exportOutput|toolExecutionLogs|email|phone|address|employer|provider|model|retry|repair|fallback)"\s*:/i,
    );
    expect(tables.applicationPackages).toHaveLength(1);
  });

  it("keeps empty account B in onboarding and isolates account A from another profile", async () => {
    const { ctx } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(ctx as any, seedArgs() as any);

    const accountB = await summarizeApplicationPackage(ctx, "clerk_empty");
    const otherAccount = await summarizeApplicationPackage(ctx, "clerk_other");

    expect(accountB).toMatchObject({
      status: "onboarding_required",
      missingDataReason: "owner_onboarding_required",
      safeCounts: {
        packages: 0,
        artifacts: 0,
        provenanceLinks: 0,
        reviewItems: 0,
        warnings: 0,
        blockers: 0,
      },
    });
    expect(otherAccount).toMatchObject({
      status: "no_data_available",
      missingDataReason: "application_package_not_available",
      safeCounts: { packages: 0 },
    });
    expect(JSON.stringify(accountB)).not.toContain(OWNER_A);
    expect(JSON.stringify(otherAccount)).not.toContain(OWNER_A);
  });

  it("keeps the controlled proof metadata-only and provider-free", () => {
    const source = readFileSync(CONTROLLED_PROOF_SOURCE_FILE, "utf8");

    expect(source).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|openai|langchain|provider|model|retry|repair|fallback)\b/iu,
    );
    expect(source).not.toMatch(/\bctx\.runAction\s*\(/u);
  });
});
