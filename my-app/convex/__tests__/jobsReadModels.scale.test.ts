import { describe, expect, it, vi } from "vitest";

import { ensureJobsReadModelPage, listPageForUser } from "../jobsPublic";
import { buildJobCatalogProjection } from "../lib/jobCatalog";

function makeFullJob(index: number) {
  return {
    _id: `job_${index}`,
    userId: `profile_${index % 100}`,
    title: `Job ${index}`,
    company: "Synthetic Co",
    location: "Remote",
    rawDescription: "x".repeat(20_000),
    rawLanguageDetected: "en",
    sourceUrl: `https://example.test/jobs/${index}`,
    sourceDomain: "example.test",
    sourceType: "synthetic",
    parseStatus: "parsed",
    reviewState: "ready",
    status: "active",
    importedAt: 10_000 - index,
    updatedAt: 10_000 - index,
    lastOpenedAt: 10_000 - index,
    archivedAt: null,
  };
}

function makeCatalogRow(job: ReturnType<typeof makeFullJob>, index: number) {
  return {
    ...buildJobCatalogProjection(job, "clerk_scale"),
    _id: `catalog_${index}`,
  };
}

describe("bounded Jobs read model scale", () => {
  it("restarts a legacy ready state when the projection version changes", async () => {
    const replace = vi.fn(async () => undefined);
    const query = vi.fn((table: string) => {
      if (table === "accountReadModels") {
        return {
          withIndex: () => ({
            first: async () => ({
              _id: "legacy_state",
              clerkId: "clerk_scale",
              status: "ready",
              updatedAt: 1,
            }),
          }),
        };
      }
      if (table === "userProfiles") {
        return {
          withIndex: () => ({
            paginate: async () => ({
              page: [],
              isDone: true,
              continueCursor: "",
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    await expect(
      ensureJobsReadModelPage._handler(
        {
          auth: {
            getUserIdentity: vi.fn(async () => ({ subject: "clerk_scale" })),
          },
          db: { query, replace },
        } as any,
        {},
      ),
    ).resolves.toEqual({
      done: true,
      processedProfiles: 0,
      processedJobs: 0,
    });
    expect(replace).toHaveBeenCalledWith(
      "legacy_state",
      expect.objectContaining({
        status: "ready",
        version: 2,
      }),
    );
  });

  it("selects a legacy profile without issuing a second paginated query", async () => {
    let paginatedQueries = 0;
    const insert = vi.fn(async (table: string) => `${table}_inserted`);
    const profile = {
      _id: "profile_1",
      clerkId: "clerk_scale",
      email: "scale@example.invalid",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      preferences: {
        writingStyle: "professional",
        tonePreference: "neutral",
        autoSend: false,
      },
    };
    const ctx = {
      auth: {
        getUserIdentity: vi.fn(async () => ({ subject: "clerk_scale" })),
      },
      db: {
        insert,
        query: vi.fn((table: string) => {
          if (table === "accountReadModels") {
            return { withIndex: () => ({ first: async () => null }) };
          }
          if (table === "profileCatalog") {
            return { withIndex: () => ({ first: async () => null }) };
          }
          if (table === "userProfiles") {
            return {
              withIndex: () => ({
                paginate: async () => {
                  paginatedQueries += 1;
                  if (paginatedQueries > 1) {
                    throw new Error("multiple paginated queries are forbidden");
                  }
                  return {
                    page: [profile],
                    continueCursor: "profile_cursor_1",
                    isDone: false,
                  };
                },
              }),
            };
          }
          if (table === "jobs") {
            throw new Error("jobs must be processed in the next mutation");
          }
          throw new Error(`unexpected table: ${table}`);
        }),
      },
    };

    await expect(
      ensureJobsReadModelPage._handler(ctx as any, {}),
    ).resolves.toEqual({
      done: false,
      processedProfiles: 1,
      processedJobs: 0,
    });
    expect(paginatedQueries).toBe(1);
    expect(insert).toHaveBeenCalledWith(
      "accountReadModels",
      expect.objectContaining({
        clerkId: "clerk_scale",
        activeProfileId: "profile_1",
        profileCursor: "profile_cursor_1",
      }),
    );
  });

  it("reads one globally bounded catalog page without CV/proposal/shadow fan-out", async () => {
    const fullJobs = Array.from({ length: 500 }, (_, index) =>
      makeFullJob(index),
    );
    const jobs = fullJobs.map(makeCatalogRow);
    Object.assign(jobs[0], {
      matchReviewVerdict: "possible_lead",
      matchReviewScore: 68,
    });
    const profiles = Array.from({ length: 100 }, (_, index) => ({
      _id: `profile_${index}`,
      cvDocument: { rawText: "cv".repeat(100_000) },
    }));
    const proposals = Array.from({ length: 200 }, (_, index) => ({
      _id: `proposal_${index}`,
      jobId: `job_${index % 500}`,
    }));
    expect(profiles).toHaveLength(100);
    expect(proposals).toHaveLength(200);
    const store: Record<string, unknown[]> = {
      jobCatalog: jobs,
      jobs: fullJobs,
      userProfiles: profiles,
      proposals,
      job_extraction_shadow: Array.from({ length: 500 }, (_, index) => ({
        _id: `shadow_${index}`,
        job_id: `job_${index}`,
      })),
    };
    expect(store.jobs).toHaveLength(500);
    expect(store.userProfiles).toHaveLength(100);
    expect(store.proposals).toHaveLength(200);

    const queriedTables: string[] = [];
    const paginate = vi.fn(async ({ numItems }: { numItems: number }) => ({
      page: jobs.slice(0, numItems),
      isDone: numItems >= jobs.length,
      continueCursor: "cursor_36",
    }));
    const ctx = {
      auth: {
        getUserIdentity: vi.fn(async () => ({ subject: "clerk_scale" })),
      },
      db: {
        query: vi.fn((table: string) => {
          queriedTables.push(table);
          if (!(table in store)) throw new Error(`unknown table: ${table}`);
          if (table !== "jobCatalog") {
            throw new Error(`forbidden list-path query: ${table}`);
          }
          const chain: any = {
            withIndex: (_name: string, callback: (q: any) => unknown) => {
              const q: any = { eq: () => q };
              callback(q);
              return chain;
            },
            order: () => chain,
            paginate: async (options: { numItems: number }) => {
              expect(store.jobCatalog).toBe(jobs);
              return paginate(options);
            },
          };
          return chain;
        }),
      },
    };

    const result = await listPageForUser._handler(ctx as any, {
      paginationOpts: { cursor: null, numItems: 500 },
    });

    expect(queriedTables).toEqual(["jobCatalog"]);
    expect(paginate).toHaveBeenCalledOnce();
    expect(paginate).toHaveBeenCalledWith({ cursor: null, numItems: 36 });
    expect(result.page).toHaveLength(36);
    expect(result.page[0]).toEqual(
      expect.objectContaining({
        matchTier: "unknown",
        matchReview: {
          verdict: "possible_lead",
          score: 68,
        },
      }),
    );
    expect(JSON.stringify(result)).not.toContain("cvDocument");
    expect(JSON.stringify(result)).not.toContain("rawDescription");
    expect(JSON.stringify(result).length).toBeLessThan(100_000);
  });

  it("rejects unauthenticated list reads before touching storage", async () => {
    const query = vi.fn();
    await expect(
      listPageForUser._handler(
        {
          auth: { getUserIdentity: vi.fn(async () => null) },
          db: { query },
        } as any,
        { paginationOpts: { cursor: null, numItems: 36 } },
      ),
    ).rejects.toThrow("Not authenticated");
    expect(query).not.toHaveBeenCalled();
  });
});
