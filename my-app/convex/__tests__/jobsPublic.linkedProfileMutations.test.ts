import { describe, expect, it, vi } from "vitest";

import { approveReviewItem, updateField } from "../jobsPublic";

vi.mock("../lib/jobCatalog", () => ({
  patchJobWithCatalog: (ctx: any, id: string, value: Record<string, unknown>) =>
    ctx.db.patch(id, value),
}));

function buildLinkedProfiles() {
  return [
    {
      _id: "profile_primary",
      _creationTime: 200,
      clerkId: "clerk_123",
      updatedAt: 200,
      createdAt: 200,
      version: 2,
      email: "primary@example.com",
    },
    {
      _id: "profile_legacy",
      _creationTime: 100,
      clerkId: "clerk_123",
      updatedAt: 100,
      createdAt: 100,
      version: 1,
      email: "legacy@example.com",
    },
  ];
}

function buildUserProfilesQuery(linkedProfiles: Array<Record<string, unknown>>) {
  return {
    withIndex(_indexName: string, buildIndex: any) {
      const scope = {
        eq(_field: string, value: string) {
          return value;
        },
      };
      const clerkId = buildIndex(scope);
      return {
        collect: async () =>
          linkedProfiles.filter((profile) => profile.clerkId === clerkId),
      };
    },
  };
}

describe("jobsPublic linked-profile review mutations", () => {
  it("allows updateField for jobs owned by a linked profile", async () => {
    const linkedProfiles = buildLinkedProfiles();
    const job = {
      _id: "job_legacy",
      userId: "profile_legacy",
      summary: "Original summary",
      reviewState: "needs_review",
      reviewItems: [
        {
          id: "summary",
          fieldKey: "summary",
          label: "Summary",
          reviewStatus: "pending",
          suggestedValue: "Original summary",
          sourceText: "Original summary",
          confidence: 0.4,
          updatedAt: 100,
        },
      ],
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    const result = await updateField._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId(table: string, id: string) {
            expect(table).toBe("jobs");
            return id;
          },
          get: async (id: string) => (id === job._id ? job : null),
          patch: async (id: string, patch: Record<string, unknown>) => {
            patchCalls.push({ id, patch });
            Object.assign(job, patch);
          },
          query(table: string) {
            if (table === "userProfiles") {
              return buildUserProfilesQuery(linkedProfiles);
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      {
        jobId: "job_legacy",
        fieldKey: "summary",
        value: "Updated linked-profile summary",
      },
    );

    expect(result).toBeNull();
    expect(patchCalls).toEqual([
      {
        id: "job_legacy",
        patch: expect.objectContaining({
          summary: "Updated linked-profile summary",
          reviewState: "ready",
          updatedAt: expect.any(Number),
        }),
      },
    ]);
    expect(patchCalls[0]?.patch.reviewItems).toEqual([
      expect.objectContaining({
        fieldKey: "summary",
        reviewStatus: "approved",
        approvedValue: "Updated linked-profile summary",
      }),
    ]);
  });

  it("allows approveReviewItem for jobs owned by a linked profile", async () => {
    const linkedProfiles = buildLinkedProfiles();
    const job = {
      _id: "job_legacy",
      userId: "profile_legacy",
      title: "Legacy job",
      summary: "Original summary",
      summaryExtraction: {
        value: "Original summary",
        confidence: 0.6,
        sourceSpan: null,
      },
      rawLanguageDetected: "en",
      mustHaves: [],
      mustHavesExtraction: [],
      keywords: [],
      keywordsExtraction: [],
      reviewItems: [
        {
          id: "summary",
          fieldKey: "summary",
          label: "Summary",
          reviewStatus: "pending",
          suggestedValue: "Approved linked-profile summary",
          sourceText: "Approved linked-profile summary",
          confidence: 0.4,
          updatedAt: 100,
        },
      ],
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    const result = await approveReviewItem._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId(table: string, id: string) {
            expect(table).toBe("jobs");
            return id;
          },
          get: async (id: string) => (id === job._id ? job : null),
          patch: async (id: string, patch: Record<string, unknown>) => {
            patchCalls.push({ id, patch });
            Object.assign(job, patch);
          },
          query(table: string) {
            if (table === "userProfiles") {
              return buildUserProfilesQuery(linkedProfiles);
            }

            if (table === "job_extraction_shadow") {
              return {
                withIndex(indexName: string, buildIndex: any) {
                  expect(indexName).toBe("by_job_id");
                  const scope = {
                    eq(field: string, value: string) {
                      expect(field).toBe("job_id");
                      expect(value).toBe(job._id);
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => [],
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_legacy", reviewItemId: "summary" },
    );

    expect(result).toBeNull();
    expect(patchCalls).toEqual([
      {
        id: "job_legacy",
        patch: expect.objectContaining({
          summary: "Approved linked-profile summary",
          reviewState: "ready",
          updatedAt: expect.any(Number),
        }),
      },
    ]);
    expect(patchCalls[0]?.patch.reviewItems).toEqual([
      expect.objectContaining({
        fieldKey: "summary",
        reviewStatus: "approved",
        approvedValue: "Approved linked-profile summary",
      }),
    ]);
  });

  it("rejects updateField for jobs outside linked profiles without patching", async () => {
    const linkedProfiles = buildLinkedProfiles();
    const job = {
      _id: "job_foreign",
      userId: "profile_other",
      summary: "Foreign summary",
      reviewState: "needs_review",
      reviewItems: [],
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    await expect(
      updateField._handler(
        {
          auth: {
            getUserIdentity: async () => ({ subject: "clerk_123" }),
          },
          db: {
            normalizeId(table: string, id: string) {
              expect(table).toBe("jobs");
              return id;
            },
            get: async (id: string) => (id === job._id ? job : null),
            patch: async (id: string, patch: Record<string, unknown>) => {
              patchCalls.push({ id, patch });
            },
            query(table: string) {
              if (table === "userProfiles") {
                return buildUserProfilesQuery(linkedProfiles);
              }

              throw new Error(`Unexpected table: ${table}`);
            },
          },
        } as any,
        {
          jobId: "job_foreign",
          fieldKey: "summary",
          value: "Cross-owner update",
        },
      ),
    ).rejects.toThrow("Job not found");

    expect(patchCalls).toEqual([]);
  });
});
