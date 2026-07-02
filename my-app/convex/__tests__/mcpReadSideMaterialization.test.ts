import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bestEffortDeleteMcpReadSidePackageForStoredProposal,
  bestEffortMaterializeMcpReadSideForStoredProposal,
  materializeMcpReadSideForStoredProposal,
} from "../mcpReadSideMaterialization";
import { deleteProposal, storeProposal, updateProposal } from "../proposals";

const NOW = Date.UTC(2026, 6, 2, 12, 0, 0, 0);

type TableName =
  | "userProfiles"
  | "jobs"
  | "proposals"
  | "applicationContexts"
  | "applicationRuns"
  | "applicationArtifacts"
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
    applicationRuns: [],
    applicationArtifacts: [],
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
    patch: async (id: unknown, patch: unknown) => {
      const stringId = String(id);
      for (const documents of Object.values(tables)) {
        const document = documents.find((candidate) => candidate._id === stringId);
        if (document) {
          Object.assign(document, patch);
          return;
        }
      }
      throw new Error(`missing document ${stringId}`);
    },
    delete: async (id: unknown) => {
      const stringId = String(id);
      for (const documents of Object.values(tables)) {
        const index = documents.findIndex((document) => document._id === stringId);
        if (index >= 0) {
          documents.splice(index, 1);
          return;
        }
      }
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
          take: async (limit: number) => matching.slice(0, limit),
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
    "EDITED_GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO",
    "MODEL_NAME_DO_NOT_ECHO",
    "secret=DO_NOT_ECHO",
    "real-user@example.test",
    "clerk_DO_NOT_ECHO",
  ] as const) {
    expect(serialized.includes(fragment)).toBe(false);
  }
}

function readProjectSource(relativePath: string): string {
  for (const candidate of [resolve(relativePath), resolve("my-app", relativePath)]) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8");
    }
  }

  throw new Error(`Could not resolve project source: ${relativePath}`);
}

describe("MCP read-side materialization from proposal persistence", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it("updates the same package row when proposal content changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW + 1_000);
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(ctx as any, proposal());
    const firstPackageId = tables.applicationPackages[0].applicationPackageId;
    const firstContentHash = tables.applicationPackages[0].contentHash;

    vi.setSystemTime(NOW + 2_000);
    const second = await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal({
        content: "EDITED_GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO",
        sections: [
          {
            type: "text",
            content: "EDITED_GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO",
          },
        ],
        updatedAt: NOW + 2_000,
      }),
    );

    expect(second).toMatchObject({
      status: "materialized",
      packageReused: true,
    });
    expect(tables.applicationPackages).toHaveLength(1);
    expect(tables.applicationPackages[0].applicationPackageId).toBe(firstPackageId);
    expect(tables.applicationPackages[0].contentHash).not.toBe(firstContentHash);
    expect(tables.applicationPackages[0].createdAt).toBe(NOW + 1_000);
    expect(tables.applicationPackages[0].updatedAt).toBe(NOW + 2_000);
    expect((tables.applicationPackages[0].package as any).updatedAt).toBe(NOW + 2_000);
    assertNoRawText(tables.applicationPackages);
  });

  it("hashes exact proposal formatting changes into the package content hash", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW + 1_000);
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal({
        content: "Line one\n\nLine two",
        sections: [{ type: "text", content: "Line one\n\nLine two" }],
      }),
    );
    const firstContentHash = tables.applicationPackages[0].contentHash;

    vi.setSystemTime(NOW + 2_000);
    await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal({
        content: "Line one Line two",
        sections: [{ type: "text", content: "Line one Line two" }],
        updatedAt: NOW + 2_000,
      }),
    );

    expect(tables.applicationPackages).toHaveLength(1);
    expect(tables.applicationPackages[0].contentHash).not.toBe(firstContentHash);
  });

  it("does not claim an attached CV identity without its snapshot", async () => {
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal({
        _id: "proposal_a_DO_NOT_ECHO",
        metadata: {
          jobId: "job_storage_id_DO_NOT_ECHO",
          sourceCvId: "cv_a_DO_NOT_ECHO",
          resolvedLanguage: "en",
        },
      }),
    );
    await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal({
        _id: "proposal_b_DO_NOT_ECHO",
        metadata: {
          jobId: "job_storage_id_DO_NOT_ECHO",
          sourceCvId: "cv_b_DO_NOT_ECHO",
          resolvedLanguage: "en",
        },
      }),
    );

    expect(tables.applicationContexts).toHaveLength(1);
    expect((tables.applicationContexts[0].candidate as any).cvId).toBe(
      "profile_storage_id_DO_NOT_ECHO",
    );
    assertNoRawText(tables.applicationContexts);
  });

  it("rematerializes from internal updateProposal when only sections change", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW + 1_000);
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
      sections: [{ type: "text", content: "GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO" }],
      metrics: { score: 0, confidence: 0 },
      metadata: {
        jobId: "job_storage_id_DO_NOT_ECHO",
        resolvedLanguage: "en",
      },
    });
    const firstContentHash = tables.applicationPackages[0].contentHash;

    vi.setSystemTime(NOW + 2_000);
    await (updateProposal as any)._handler(ctx as any, {
      id: proposalId,
      sections: [
        {
          type: "text",
          content: "EDITED_GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO",
        },
      ],
      metrics: { score: 1, confidence: 1 },
      metadata: {
        resolvedLanguage: "en",
      },
      updatedAt: NOW + 2_000,
    });

    expect(tables.applicationPackages).toHaveLength(1);
    expect(tables.applicationPackages[0].contentHash).not.toBe(firstContentHash);
    expect(tables.applicationPackages[0].updatedAt).toBe(NOW + 2_000);
    assertNoRawText(tables.applicationPackages);
  });

  it("uses materialization time for newly created package timestamps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW + 3_000);
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal({ createdAt: NOW - 10_000, updatedAt: NOW - 5_000 }),
    );

    expect(tables.applicationPackages[0].createdAt).toBe(NOW + 3_000);
    expect(tables.applicationPackages[0].updatedAt).toBe(NOW + 3_000);
    expect((tables.applicationPackages[0].package as any).createdAt).toBe(NOW + 3_000);
    expect((tables.applicationPackages[0].package as any).updatedAt).toBe(NOW + 3_000);
  });

  it("skips invalid external job ids instead of passing them to db.get", async () => {
    const { ctx, tables } = makeCtx();
    const getSpy = vi.spyOn(ctx.db, "get");
    ctx.db.normalizeId = () => null;

    await expect(
      materializeMcpReadSideForStoredProposal(
        ctx as any,
        proposal({ jobId: "legacy-external-job-id", metadata: {} }),
      ),
    ).resolves.toEqual({
      status: "skipped",
      reason: "proposal_missing_job",
      version: 1,
    });
    expect(getSpy).not.toHaveBeenCalledWith("legacy-external-job-id");
    expect(tables.applicationPackages).toHaveLength(0);
  });

  it("removes stale package and orphan context when a materialized proposal loses its valid job", async () => {
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(ctx as any, proposal());
    expect(tables.applicationContexts).toHaveLength(1);
    expect(tables.applicationPackages).toHaveLength(1);

    ctx.db.normalizeId = () => null;
    await expect(
      materializeMcpReadSideForStoredProposal(
        ctx as any,
        proposal({
          jobId: "legacy-external-job-id",
          metadata: {},
        }),
      ),
    ).resolves.toEqual({
      status: "skipped",
      reason: "proposal_missing_job",
      version: 1,
    });

    expect(tables.applicationPackages).toHaveLength(0);
    expect(tables.applicationContexts).toHaveLength(0);
  });

  it("removes stale package and orphan context when a materialized proposal job is deleted", async () => {
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(ctx as any, proposal());
    tables.jobs.length = 0;

    await expect(
      materializeMcpReadSideForStoredProposal(ctx as any, proposal()),
    ).resolves.toEqual({
      status: "skipped",
      reason: "job_not_found",
      version: 1,
    });

    expect(tables.applicationPackages).toHaveLength(0);
    expect(tables.applicationContexts).toHaveLength(0);
  });

  it("removes stale package and orphan context when a materialized proposal profile is deleted", async () => {
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(ctx as any, proposal());
    tables.userProfiles.length = 0;

    await expect(
      materializeMcpReadSideForStoredProposal(ctx as any, proposal()),
    ).resolves.toEqual({
      status: "skipped",
      reason: "profile_not_found",
      version: 1,
    });

    expect(tables.applicationPackages).toHaveLength(0);
    expect(tables.applicationContexts).toHaveLength(0);
  });

  it("does not fail proposal persistence when materialization throws", async () => {
    const { ctx, tables } = makeCtx();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const insert = ctx.db.insert;
    ctx.db.insert = async (tableName: TableName, document: unknown) => {
      if (tableName === "applicationContexts") {
        throw new Error("derived read-side insert failed");
      }
      return insert(tableName, document);
    };

    await expect(
      bestEffortMaterializeMcpReadSideForStoredProposal(ctx as any, proposal()),
    ).resolves.toEqual({
      status: "skipped",
      reason: "materialization_failed",
      version: 1,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "MCP read-side best-effort operation failed",
      expect.objectContaining({
        operation: "materialize",
        version: 1,
      }),
    );

    const proposalId = await (storeProposal as any)._handler(ctx as any, {
      userId: "profile_storage_id_DO_NOT_ECHO",
      jobId: "job_storage_id_DO_NOT_ECHO",
      title: "Generated proposal",
      content: "GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO",
      status: "saved",
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      sections: [{ type: "text", content: "GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO" }],
      metrics: { score: 0, confidence: 0 },
      metadata: {
        jobId: "job_storage_id_DO_NOT_ECHO",
        resolvedLanguage: "en",
      },
    });

    expect(proposalId).toBe("proposals_1");
    expect(tables.proposals).toHaveLength(1);
  });

  it("removes an inserted context when package materialization fails", async () => {
    const { ctx, tables } = makeCtx();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const insert = ctx.db.insert;
    ctx.db.insert = async (tableName: TableName, document: unknown) => {
      if (tableName === "applicationPackages") {
        throw new Error("derived package insert failed");
      }
      return insert(tableName, document);
    };

    await expect(
      bestEffortMaterializeMcpReadSideForStoredProposal(ctx as any, proposal()),
    ).resolves.toEqual({
      status: "skipped",
      reason: "materialization_failed",
      version: 1,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "MCP read-side best-effort operation failed",
      expect.objectContaining({
        operation: "materialize",
        version: 1,
      }),
    );
    expect(tables.applicationContexts).toHaveLength(0);
    expect(tables.applicationPackages).toHaveLength(0);
  });

  it("deletes the derived application package before proposal deletion", async () => {
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
      sections: [{ type: "text", content: "GENERATED_PROPOSAL_TEXT_DO_NOT_ECHO" }],
      metrics: { score: 0, confidence: 0 },
      metadata: {
        jobId: "job_storage_id_DO_NOT_ECHO",
        resolvedLanguage: "en",
      },
    });

    expect(tables.applicationPackages).toHaveLength(1);
    await (deleteProposal as any)._handler(ctx as any, { id: proposalId });

    expect(tables.proposals).toHaveLength(0);
    expect(tables.applicationPackages).toHaveLength(0);
    expect(tables.applicationContexts).toHaveLength(0);
  });

  it("deletes materialized packages through the explicit cleanup helper", async () => {
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(ctx as any, proposal());
    await expect(
      bestEffortDeleteMcpReadSidePackageForStoredProposal(ctx as any, proposal()),
    ).resolves.toBe(true);

    expect(tables.applicationPackages).toHaveLength(0);
    expect(tables.applicationContexts).toHaveLength(0);
  });

  it("keeps a context while another package still references it", async () => {
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal({ _id: "proposal_a_DO_NOT_ECHO" }),
    );
    await materializeMcpReadSideForStoredProposal(
      ctx as any,
      proposal({ _id: "proposal_b_DO_NOT_ECHO" }),
    );
    expect(tables.applicationContexts).toHaveLength(1);
    expect(tables.applicationPackages).toHaveLength(2);

    await expect(
      bestEffortDeleteMcpReadSidePackageForStoredProposal(
        ctx as any,
        proposal({ _id: "proposal_a_DO_NOT_ECHO" }),
      ),
    ).resolves.toBe(true);

    expect(tables.applicationPackages).toHaveLength(1);
    expect(tables.applicationContexts).toHaveLength(1);
  });

  it("keeps a context while a run still references it", async () => {
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(ctx as any, proposal());
    const applicationContextId = String(tables.applicationContexts[0].id);
    tables.applicationRuns.push({
      _id: "applicationRuns_1",
      _creationTime: NOW,
      userId: "profile_storage_id_DO_NOT_ECHO",
      contextId: applicationContextId,
    });

    await expect(
      bestEffortDeleteMcpReadSidePackageForStoredProposal(ctx as any, proposal()),
    ).resolves.toBe(true);

    expect(tables.applicationPackages).toHaveLength(0);
    expect(tables.applicationContexts).toHaveLength(1);
  });

  it("keeps a context while an artifact still references it", async () => {
    const { ctx, tables } = makeCtx();

    await materializeMcpReadSideForStoredProposal(ctx as any, proposal());
    const applicationContextId = String(tables.applicationContexts[0].id);
    tables.applicationArtifacts.push({
      _id: "applicationArtifacts_1",
      _creationTime: NOW,
      userId: "profile_storage_id_DO_NOT_ECHO",
      contextId: applicationContextId,
    });

    await expect(
      bestEffortDeleteMcpReadSidePackageForStoredProposal(ctx as any, proposal()),
    ).resolves.toBe(true);

    expect(tables.applicationPackages).toHaveLength(0);
    expect(tables.applicationContexts).toHaveLength(1);
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
    const source = readProjectSource("convex/mcpReadSideMaterialization.ts");
    const proposalsSource = readProjectSource("convex/proposals.ts");

    expect(source.includes("./_generated/api")).toBe(false);
    expect(source.includes("ctx.runMutation")).toBe(false);
    expect(source.includes("ctx.runAction")).toBe(false);
    expect(/\bfetch\s*\(/u.test(source)).toBe(false);
    expect(/\b(modelCalls|provider|token|secret)\b/u.test(source)).toBe(false);
    expect(proposalsSource).toContain(
      "bestEffortMaterializeMcpReadSideForStoredProposal",
    );
  });
});
