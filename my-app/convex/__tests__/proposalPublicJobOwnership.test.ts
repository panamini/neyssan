import { afterEach, describe, expect, it, vi } from "vitest";

import createProposalPublic from "../createProposalPublic";
import deleteProposalPublic from "../deleteProposalPublic";
import saveJobAndProposalPublic from "../saveJobAndProposal";
import updateProposalPublic from "../updateProposalPublic";

type StoredRow = Record<string, any> & { _id: string };

function createStore(seedProposals: StoredRow[] = []) {
  const profiles = new Map<string, StoredRow>([
    [
      "profile_owner",
      {
        _id: "profile_owner",
        _creationTime: 20,
        clerkId: "clerk_owner",
        profileId: "cv_owner",
      },
    ],
    [
      "profile_foreign",
      {
        _id: "profile_foreign",
        _creationTime: 10,
        clerkId: "clerk_foreign",
        profileId: "cv_foreign",
      },
    ],
  ]);
  const jobs = new Map<string, StoredRow>([
    [
      "job_old",
      { _id: "job_old", userId: "profile_owner", title: "Old job" },
    ],
    [
      "job_new",
      { _id: "job_new", userId: "profile_owner", title: "New job" },
    ],
    [
      "job_foreign",
      {
        _id: "job_foreign",
        userId: "profile_foreign",
        title: "Foreign job",
      },
    ],
  ]);
  const catalogs = new Map<string, StoredRow>(
    [...jobs.keys()].map((jobId) => [
      `catalog_${jobId}`,
      {
        _id: `catalog_${jobId}`,
        jobId,
        updatedAt: 1,
        lastOpenedAt: 1,
        lastActivityAt: 1,
        linkedDocumentCount: 0,
      },
    ]),
  );
  const proposals = new Map<string, StoredRow>(
    seedProposals.map((proposal) => [proposal._id, { ...proposal }]),
  );
  const catalogPatches: Array<{ id: string; patch: Record<string, any> }> = [];
  const proposalPatches: Array<{ id: string; patch: Record<string, any> }> = [];
  const deletedIds: string[] = [];
  let nextProposalId = 1;

  function rowsFor(table: string): StoredRow[] {
    if (table === "userProfiles") return [...profiles.values()];
    if (table === "jobs") return [...jobs.values()];
    if (table === "jobCatalog") return [...catalogs.values()];
    if (table === "proposals") return [...proposals.values()];
    return [];
  }

  const db = {
    normalizeId(table: string, id: string) {
      if (table !== "jobs") return null;
      const normalized = String(id ?? "").trim();
      return jobs.has(normalized) ? normalized : null;
    },
    async get(id: string) {
      return (
        proposals.get(String(id)) ??
        jobs.get(String(id)) ??
        profiles.get(String(id)) ??
        catalogs.get(String(id)) ??
        null
      );
    },
    async insert(table: string, value: Record<string, any>) {
      if (table !== "proposals") {
        throw new Error(`Unexpected insert table: ${table}`);
      }
      const id = `proposal_created_${nextProposalId}`;
      nextProposalId += 1;
      proposals.set(id, { _id: id, ...value });
      return id;
    },
    async patch(id: string, patch: Record<string, any>) {
      const normalizedId = String(id);
      const proposal = proposals.get(normalizedId);
      if (proposal) {
        proposals.set(normalizedId, { ...proposal, ...patch });
        proposalPatches.push({ id: normalizedId, patch });
        return;
      }
      const catalog = catalogs.get(normalizedId);
      if (catalog) {
        catalogs.set(normalizedId, { ...catalog, ...patch });
        catalogPatches.push({ id: normalizedId, patch });
        return;
      }
      throw new Error(`Unexpected patch id: ${normalizedId}`);
    },
    async delete(id: string) {
      const normalizedId = String(id);
      deletedIds.push(normalizedId);
      proposals.delete(normalizedId);
      catalogs.delete(normalizedId);
    },
    query(table: string) {
      return {
        withIndex(_indexName: string, buildIndex: (q: any) => unknown) {
          const conditions = new Map<string, unknown>();
          const q = {
            eq(field: string, value: unknown) {
              conditions.set(field, value);
              return q;
            },
          };
          buildIndex(q);
          const filteredRows = () =>
            rowsFor(table).filter((row) =>
              [...conditions].every(([field, value]) => row[field] === value),
            );
          return {
            collect: async () => filteredRows(),
            first: async () => filteredRows()[0] ?? null,
            unique: async () => filteredRows()[0] ?? null,
            take: async (limit: number) => filteredRows().slice(0, limit),
            filter: () => ({ first: async () => filteredRows()[0] ?? null }),
          };
        },
      };
    },
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: async () => ({
          subject: "clerk_owner",
          email: "owner@example.test",
        }),
      },
      db,
      runMutation: vi.fn(),
    } as any,
    catalogs,
    proposals,
    catalogPatches,
    proposalPatches,
    deletedIds,
  };
}

function savedProposal(
  id: string,
  jobId: string,
  overrides: Record<string, any> = {},
): StoredRow {
  return {
    _id: id,
    userId: "profile_owner",
    jobId,
    title: `Proposal ${id}`,
    content: "Proposal body",
    status: "saved",
    version: 1,
    createdAt: 10,
    updatedAt: 10,
    sections: [{ type: "text", content: "Proposal body" }],
    metrics: { score: 0, confidence: 0 },
    metadata: { jobId, proposalType: "cover_letter" },
    ...overrides,
  };
}

describe("public proposal Job ownership and catalog counters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects foreign Job IDs before public proposal creation", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createStore();

    await expect(
      createProposalPublic._handler(store.ctx, {
        title: "Foreign proposal",
        content: "Proposal body",
        metadata: { jobId: "job_foreign" },
      }),
    ).rejects.toThrow("Job not found");

    expect(store.proposals.size).toBe(0);
    expect(store.catalogPatches).toEqual([]);
  });

  it("normalizes an owned Job ID and refreshes its counter on create", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createStore();

    const proposalId = await createProposalPublic._handler(store.ctx, {
      title: "Owned proposal",
      content: "Proposal body",
      metadata: { jobId: "  job_old  " },
    });

    expect(store.proposals.get(String(proposalId))).toMatchObject({
      jobId: "job_old",
      metadata: expect.objectContaining({ jobId: "job_old" }),
    });
    expect(store.catalogs.get("catalog_job_old")?.linkedDocumentCount).toBe(1);
  });

  it("rejects malformed Job IDs before public proposal creation", async () => {
    const store = createStore();

    await expect(
      createProposalPublic._handler(store.ctx, {
        title: "Malformed proposal",
        content: "Proposal body",
        metadata: { jobId: "not-a-job-id" },
      }),
    ).rejects.toThrow("Job not found");

    expect(store.proposals.size).toBe(0);
    expect(store.catalogPatches).toEqual([]);
  });

  it("rejects foreign Job reassignment before proposal or catalog writes", async () => {
    const store = createStore([savedProposal("proposal_1", "job_old")]);

    await expect(
      updateProposalPublic._handler(store.ctx, {
        id: "proposal_1",
        metadata: { jobId: "job_foreign" },
      }),
    ).rejects.toThrow("Job not found");

    expect(store.proposalPatches).toEqual([]);
    expect(store.catalogPatches).toEqual([]);
  });

  it("refreshes both old and new counters after an owned reassignment", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createStore([savedProposal("proposal_1", "job_old")]);

    await updateProposalPublic._handler(store.ctx, {
      id: "proposal_1",
      metadata: { jobId: "job_new" },
    });

    expect(store.proposals.get("proposal_1")).toMatchObject({
      jobId: "job_new",
      metadata: expect.objectContaining({ jobId: "job_new" }),
    });
    expect(store.catalogs.get("catalog_job_old")?.linkedDocumentCount).toBe(0);
    expect(store.catalogs.get("catalog_job_new")?.linkedDocumentCount).toBe(1);
  });

  it("refreshes has-docs and no-docs counts after public deletion", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createStore([
      savedProposal("proposal_1", "job_old", { updatedAt: 20 }),
      savedProposal("proposal_2", "job_old", { updatedAt: 30 }),
    ]);

    await deleteProposalPublic._handler(store.ctx, { id: "proposal_1" });
    expect(store.catalogs.get("catalog_job_old")?.linkedDocumentCount).toBe(1);

    await deleteProposalPublic._handler(store.ctx, { id: "proposal_2" });
    expect(store.catalogs.get("catalog_job_old")?.linkedDocumentCount).toBe(0);
  });

  it("fails closed when deleting a proposal linked to a foreign Job", async () => {
    const store = createStore([
      savedProposal("proposal_foreign_link", "job_foreign"),
    ]);

    await expect(
      deleteProposalPublic._handler(store.ctx, {
        id: "proposal_foreign_link",
      }),
    ).rejects.toThrow("Job not found");

    expect(store.deletedIds).toEqual([]);
    expect(store.catalogPatches).toEqual([]);
  });

  it("rejects foreign Job IDs on the legacy public save surface", async () => {
    const store = createStore();

    await expect(
      saveJobAndProposalPublic._handler(store.ctx, {
        jobData: {
          platform: "linkedin",
          title: "Foreign job",
          url: "https://example.test/foreign",
          jobId: "job_foreign",
        },
        proposalText: "Proposal body",
      }),
    ).rejects.toThrow("Job not found");

    expect(store.proposals.size).toBe(0);
    expect(store.catalogPatches).toEqual([]);
  });
});
