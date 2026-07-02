import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { materializeMcpReadSideForStoredProposal } from "../mcpReadSideMaterialization";
import { storeProposal } from "../proposals";

const NOW = Date.UTC(2026, 6, 2, 12, 0, 0, 0);

type TableName =
  | "userProfiles"
  | "jobs"
  | "proposals"
  | "applicationContexts"
  | "applicationPackages";
type StoredDocument = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};
type Constraint = Readonly<{ field: string; value: unknown }>;

function makeCtx(seed: Partial<Record<TableName, StoredDocument[]>> = {}) {
  const tables: Record<TableName, StoredDocument[]> = {
    userProfiles: [profile()],
    jobs: [job()],
    proposals: [],
    applicationContexts: [],
    applicationPackages: [],
    ...seed,
  };
  let sequence = 0;

  function findById(id: unknown) {
    const stringId = String(id);
    return (
      Object.values(tables)
        .flat()
        .find((document) => String(document._id) === stringId) ?? null
    );
  }

  function applyConstraints(
    documents: StoredDocument[],
    constraints: Constraint[],
  ) {
    return documents.filter((document) =>
      constraints.every(
        (constraint) => readField(document, constraint.field) === constraint.value,
      ),
    );
  }

  const db = {
    get: async (id: unknown) => findById(id),
    insert: async (tableName: TableName, document: unknown) => {
      sequence += 1;
      const stored = {
        _id: `${tableName}_${sequence}`,
        _creationTime: NOW + sequence,
        ...(document as Record<string, unknown>),
      };
      tables[tableName].push(stored);
      return stored._id;
    },
    normalizeId: (_tableName: string, id: string) => id,
    query: (tableName: TableName) => ({
      withIndex: (_indexName: string, buildQuery: (query: any) => unknown) => {
        const constraints: Constraint[] = [];
        const query = {
          eq(field: string, value: unknown) {
            constraints.push({ field, value });
            return query;
          },
        };
        buildQuery(query);
        const matching = applyConstraints(tables[tableName], constraints);
        return {
          unique: async () => {
            if (matching.length > 1) throw new Error("expected unique result");
            return matching[0] ?? null;
          },
        };
      },
    }),
  };

  return { ctx: { db }, tables };
}

function readField(document: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, document);
}

function profile(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "profile_storage_id_DO_NOT_ECHO",
    _creationTime: NOW,
    profileId: "profile_external_DO_NOT_ECHO",
    clerkId: "clerk_DO_NOT_ECHO",
    email: "real-user@example.test",
    raw_text: "RAW_CV_TEXT_DO_NOT_ECHO",
    cvDocument: {
      sections: [{ id: "summary", content: "RAW_CV_TEXT_DO_NOT_ECHO" }],
    },
    updatedAt: NOW,
    ...overrides,
  };
}

function job(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "job_storage_id_DO_NOT_ECHO",
    _creationTime: NOW,
    userId: "profile_storage_id_DO_NOT_ECHO",
    rawDescription: "RAW_JOB_TEXT_DO_NOT_ECHO",
    title: "Product Engineer",
    company: "Acme",
    sourceUrl: "https://example.test/jobs/1?secret=DO_NOT_ECHO",
    updatedAt: NOW,
    ...overrides,
  };
}

function proposal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "proposal_storage_id_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    jobId: "job_storage_id_DO_NOT_ECHO",
    content: "GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO",
    createdAt: NOW,
    updatedAt: NOW,
    metadata: {
      jobId: "job_storage_id_DO_NOT_ECHO",
      sourceJobDescription: "RAW_JOB_TEXT_DO_NOT_ECHO",
      sourceUrl: "https://example.test/jobs/1?secret=DO_NOT_ECHO",
      resolvedLanguage: "en",
      requestedModelType: "premium",
      actualModelName: "MODEL_NAME_DO_NOT_ECHO",
    },
    ...overrides,
  };
}

function assertNoRawText(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const fragment of [
    "RAW_CV_TEXT_DO_NOT_ECHO",
    "RAW_JOB_TEXT_DO_NOT_ECHO",
    "GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO",
    "MODEL_NAME_DO_NOT_ECHO",
    "secret=DO_NOT_ECHO",
    "real-user@example.test",
    "clerk_DO_NOT_ECHO",
  ] as const) {
    expect(serialized.includes(fragment)).toBe(false);
  }
}

describe("MCP read-side materialization from proposal persistence", () => {
  it("runs from the internal storeProposal persistence boundary", async () => {
    const { ctx, tables } = makeCtx();

    const proposalId = await (storeProposal as any)._handler(ctx as any, {
      userId: "profile_storage_id_DO_NOT_ECHO",
      jobId: "job_storage_id_DO_NOT_ECHO",
      title: "Generated proposal",
      content: "GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO",
      status: "saved",
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      sections: [
        {
          type: "text",
          content: "GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO",
        },
      ],
      metrics: {
        score: 0,
        confidence: 0,
      },
      metadata: {
        jobId: "job_storage_id_DO_NOT_ECHO",
        sourceJobDescription: "RAW_JOB_TEXT_DO_NOT_ECHO",
        sourceUrl: "https://example.test/jobs/1?secret=DO_NOT_ECHO",
        resolvedLanguage: "en",
      },
    });

    expect(proposalId).toBe("proposals_1");
    expect(tables.proposals).toHaveLength(1);
    expect(tables.applicationContexts).toHaveLength(1);
    expect(tables.applicationPackages).toHaveLength(1);
    expect(tables.applicationPackages[0]).toMatchObject({
      userId: "profile_storage_id_DO_NOT_ECHO",
      status: "needs_review",
      resumeVariantArtifactStatus: "draft",
      coverLetterArtifactStatus: "needs_review",
    });
    assertNoRawText(tables.applicationContexts);
    assertNoRawText(tables.applicationPackages);
  });

  it("materializes safe owner-bound context and package rows from a stored proposal", async () => {
    const { ctx, tables } = makeCtx();

    const result = await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal(),
    );

    expect(result).toMatchObject({
      status: "materialized",
      contextReused: false,
      packageReused: false,
      version: 1,
    });
    expect(tables.applicationContexts).toHaveLength(1);
    expect(tables.applicationPackages).toHaveLength(1);
    expect(tables.applicationPackages[0]).toMatchObject({
      userId: "profile_storage_id_DO_NOT_ECHO",
      status: "needs_review",
      resumeVariantArtifactStatus: "draft",
      coverLetterArtifactStatus: "needs_review",
      sourceFactIds: [],
      allowedClaimIds: [],
      evidenceMatchIds: [],
      demandIds: [],
      riskFlagIds: [],
      reviewItemIds: [],
      version: 1,
    });
    expect(tables.applicationPackages[0].status === "ready_for_review").toBe(false);
    expect(
      (tables.applicationPackages[0].package as any).status === "ready_for_review",
    ).toBe(false);
    assertNoRawText(tables.applicationContexts);
    assertNoRawText(tables.applicationPackages);
  });

  it("reuses the same context and package for the same proposal input", async () => {
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(ctx as any, proposal());
    const second = await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal(),
    );

    expect(second).toMatchObject({
      status: "materialized",
      contextReused: true,
      packageReused: true,
    });
    expect(tables.applicationContexts).toHaveLength(1);
    expect(tables.applicationPackages).toHaveLength(1);
  });

  it("does not materialize packages across owner boundaries", async () => {
    const { ctx, tables } = makeCtx({
      jobs: [job({ userId: "other_profile_DO_NOT_ECHO" })],
    });

    await expect(
      materializeMcpReadSideForStoredProposal(ctx as any, proposal()),
    ).resolves.toEqual({
      status: "skipped",
      reason: "job_owner_mismatch",
      version: 1,
    });
    expect(tables.applicationContexts).toHaveLength(0);
    expect(tables.applicationPackages).toHaveLength(0);
  });

  it("does not materialize when the proposal has no job link", async () => {
    const { ctx, tables } = makeCtx();

    await expect(
      materializeMcpReadSideForStoredProposal(
        ctx as any,
        proposal({ jobId: undefined, metadata: {} }),
      ),
    ).resolves.toEqual({
      status: "skipped",
      reason: "proposal_missing_job",
      version: 1,
    });
    expect(tables.applicationContexts).toHaveLength(0);
    expect(tables.applicationPackages).toHaveLength(0);
  });

  it("keeps the producer free of generated API and provider execution surfaces", () => {
    const source = readFileSync("convex/mcpReadSideMaterialization.ts", "utf8");
    const proposalsSource = readFileSync("convex/proposals.ts", "utf8");

    expect(source.includes("./_generated/api")).toBe(false);
    expect(source.includes("ctx.runMutation")).toBe(false);
    expect(source.includes("ctx.runAction")).toBe(false);
    expect(/\bfetch\s*\(/u.test(source)).toBe(false);
    expect(/\b(modelCalls|provider|token|secret)\b/u.test(source)).toBe(false);
    expect(proposalsSource).toContain(
      "materializeMcpReadSideForStoredProposal",
    );
  });
});
