import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  internalCleanupControlledSyntheticProof,
  internalRecoverControlledSyntheticProof,
  internalResolveControlledSyntheticProofOwner,
  internalSeedControlledSyntheticProof,
  MCP_SAFE_SUMMARY_CONTROLLED_PROOF_LEASE_TTL_MS,
} from "../mcpControlledSyntheticProof";
import { MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5 } from "../../src/modules/local-mcp/mcpSafeSummaryProofMarker";

const MARKER = MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5;
const OWNER_A = "profile_A";
const OWNER_B = "profile_B";
const SEEDED_AT = 1_721_000_000_000;
const RUN_ID_A = "mcp-safe-summary-run-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUN_ID_B = "mcp-safe-summary-run-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type TableName =
  | "userProfiles"
  | "candidateSourceDocuments"
  | "candidateFacts"
  | "applicationArtifacts";

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
    tables.applicationArtifacts.length
  );
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

  it("seeds exactly three non-PII rows and returns only safe counters", async () => {
    const { ctx, db, tables } = makeCtx();

    const result = await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );

    expect(result).toEqual({
      status: "ready",
      createdCount: 3,
      reusedCount: 0,
      expectedCount: 3,
      ownerBound: true,
      version: 1,
    });
    expect(db.insert).toHaveBeenCalledTimes(3);
    expect(tables.candidateSourceDocuments).toHaveLength(1);
    expect(tables.candidateFacts).toHaveLength(1);
    expect(tables.applicationArtifacts).toHaveLength(1);
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

    expect(second).toMatchObject({ createdCount: 0, reusedCount: 3 });
    expect(db.insert).toHaveBeenCalledTimes(3);
    expect(fixtureCount(tables)).toBe(3);
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
    expect(fixtureCount(tables)).toBe(3);
  });

  it("fails closed on collision before inserting or deleting", async () => {
    const { ctx, db, tables } = makeCtx();
    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs() as any,
    );
    tables.candidateSourceDocuments[0].title = "uncontrolled row";
    db.delete.mockClear();

    await expect(
      internalCleanupControlledSyntheticProof._handler(
        ctx as any,
        cleanupArgs() as any,
      ),
    ).rejects.toThrow("controlled_fixture_collision");

    expect(db.delete).not.toHaveBeenCalled();
    expect(fixtureCount(tables)).toBe(3);
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
    expect(fixtureCount(tables)).toBe(3);
  });

  it("deletes exactly the three controlled rows and leaves zero residue", async () => {
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
      deletedCount: 3,
      residualCount: 0,
      expectedCount: 3,
      ownerBound: true,
      version: 1,
    });
    expect(db.delete).toHaveBeenCalledTimes(3);
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
      deletedCount: 3,
      residualCount: 0,
      expectedCount: 3,
      ownerBound: true,
      version: 1,
    });
    expect(db.delete).toHaveBeenCalledTimes(3);
    expect(fixtureCount(tables)).toBe(0);

    const reseeded = await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      {
        ...seedArgs(OWNER_A, RUN_ID_B),
        now: SEEDED_AT + MCP_SAFE_SUMMARY_CONTROLLED_PROOF_LEASE_TTL_MS + 1,
      } as any,
    );
    expect(reseeded).toMatchObject({ createdCount: 3, reusedCount: 0 });
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
    expect(fixtureCount(tables)).toBe(2);
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

    expect(first).toMatchObject({ createdCount: 3, reusedCount: 0 });
    expect(fixtureCount(tables)).toBe(3);

    const recovery = await internalRecoverControlledSyntheticProof._handler(
      ctx as any,
      recoveryArgs(OWNER_A, RUN_ID_B, SEEDED_AT + 1) as any,
    );
    expect(recovery.deletedCount).toBe(0);
    expect(fixtureCount(tables)).toBe(3);

    await internalCleanupControlledSyntheticProof._handler(
      ctx as any,
      cleanupArgs(OWNER_A, RUN_ID_A) as any,
    );
    expect(fixtureCount(tables)).toBe(0);

    await internalSeedControlledSyntheticProof._handler(
      ctx as any,
      seedArgs(OWNER_A, RUN_ID_B) as any,
    );
    expect(fixtureCount(tables)).toBe(3);

    await internalCleanupControlledSyntheticProof._handler(
      ctx as any,
      cleanupArgs(OWNER_A, RUN_ID_B) as any,
    );
    expect(fixtureCount(tables)).toBe(0);
    expect(db.delete).toHaveBeenCalledTimes(6);
  });
});
