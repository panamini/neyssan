import { describe, expect, it } from "vitest";

import { listForUser, setJobFavorite } from "../jobsPublic";

describe("jobsPublic.listForUser", () => {
  it("returns jobs across linked profiles without reading active CV state", async () => {
    const linkedProfiles = [
      {
        _id: "profile_new",
        _creationTime: 200,
        clerkId: "clerk_123",
        updatedAt: 200,
        createdAt: 200,
        version: 2,
        skills: ["react"],
        keywords: ["react"],
        email: "new@example.com",
      },
      {
        _id: "profile_old",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        skills: ["typescript"],
        keywords: ["typescript"],
        email: "old@example.com",
      },
    ];
    const jobsByProfileId = new Map([
      [
        "profile_old",
        [
          {
            _id: "job_old",
            _creationTime: 100,
            userId: "profile_old",
            title: "Legacy job",
            company: "Acme",
            location: "Remote",
            isSample: false,
            sourceUrl: "https://example.com/job",
            sourceDomain: "example.com",
            sourceType: "manual",
            parseStatus: "parsed",
            reviewState: "ready",
            status: "active",
            importedAt: 100,
            updatedAt: 100,
            lastOpenedAt: 100,
            archivedAt: null,
            mustHaves: ["TypeScript"],
            keywords: ["TypeScript"],
            mustHavesExtraction: [],
            keywordsExtraction: [],
          },
        ],
      ],
      ["profile_new", []],
    ]);

    const result = await listForUser._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          query(table: string) {
            if (table === "activeCvSnapshots") {
              throw new Error("listForUser should not read active CV state");
            }

            if (table === "userProfiles") {
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

            if (table === "jobs") {
              return {
                withIndex(indexName: string, buildIndex: any) {
                  expect(indexName).toBe("by_user_updated");
                  const scope = {
                    values: [] as string[],
                    eq(_field: string, value: string) {
                      this.values.push(value);
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order(direction: string) {
                      expect(direction).toBe("desc");
                      return this;
                    },
                    collect: async () => jobsByProfileId.get(scope.values[0]) ?? [],
                  };
                },
              };
            }

            if (table === "proposals") {
              return {
                withIndex(indexName: string, buildIndex: any) {
                  expect(indexName).toBe("by_user");
                  const scope = {
                    eq(_field: string, _value: string) {
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
      {},
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "job_old",
        title: "Legacy job",
        company: "Acme",
        isFavorite: false,
        matchTier: "weak",
      }),
    ]);
  });

  it("prefers a job resume override over the user default resume when computing match tier", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 300,
        profileId: "cv_primary",
        clerkId: "clerk_123",
        updatedAt: 300,
        createdAt: 300,
        version: 3,
        skills: ["design"],
        keywords: ["design"],
        defaultResumeId: "cv_default",
        defaultResumeName: "Default Resume",
        email: "primary@example.com",
      },
      {
        _id: "profile_default",
        _creationTime: 200,
        profileId: "cv_default",
        clerkId: "clerk_123",
        updatedAt: 200,
        createdAt: 200,
        version: 2,
        skills: ["typescript"],
        keywords: ["typescript"],
        email: "default@example.com",
      },
      {
        _id: "profile_override",
        _creationTime: 100,
        profileId: "cv_override",
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        skills: ["react"],
        keywords: ["react"],
        email: "override@example.com",
      },
    ];
    const jobsByProfileId = new Map([
      [
        "profile_primary",
        [
          {
            _id: "job_default",
            _creationTime: 100,
            userId: "profile_primary",
            title: "Default-backed job",
            company: "Acme",
            location: "Remote",
            isSample: false,
            sourceUrl: "https://example.com/job-default",
            sourceDomain: "example.com",
            sourceType: "manual",
            parseStatus: "parsed",
            reviewState: "ready",
            status: "active",
            importedAt: 100,
            updatedAt: 100,
            lastOpenedAt: 100,
            archivedAt: null,
            mustHaves: ["TypeScript"],
            keywords: ["TypeScript"],
            mustHavesExtraction: [],
            keywordsExtraction: [],
          },
          {
            _id: "job_override",
            _creationTime: 120,
            userId: "profile_primary",
            title: "Override-backed job",
            company: "Acme",
            location: "Remote",
            isSample: false,
            sourceUrl: "https://example.com/job-override",
            sourceDomain: "example.com",
            sourceType: "manual",
            parseStatus: "parsed",
            reviewState: "ready",
            status: "active",
            importedAt: 120,
            updatedAt: 120,
            lastOpenedAt: 120,
            archivedAt: null,
            lastResumeId: "cv_override",
            lastResumeName: "Override Resume",
            mustHaves: ["React"],
            keywords: ["React"],
            mustHavesExtraction: [],
            keywordsExtraction: [],
          },
        ],
      ],
      ["profile_default", []],
      ["profile_override", []],
    ]);

    const result = await listForUser._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          query(table: string) {
            if (table === "activeCvSnapshots") {
              throw new Error("listForUser should not read active CV state");
            }

            if (table === "userProfiles") {
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

            if (table === "jobs") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    values: [] as string[],
                    eq(_field: string, value: string) {
                      this.values.push(value);
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order() {
                      return this;
                    },
                    collect: async () => jobsByProfileId.get(scope.values[0]) ?? [],
                  };
                },
              };
            }

            if (table === "proposals") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
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
      {},
    );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job_default",
          matchTier: "strong",
        }),
        expect.objectContaining({
          id: "job_override",
          matchTier: "strong",
        }),
      ]),
    );
  });
});

describe("jobsPublic.setJobFavorite", () => {
  it("persists favorite state on the job record", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        email: "primary@example.com",
      },
    ];
    const job = {
      _id: "job_alpha",
      userId: "profile_primary",
      isFavorite: false,
      updatedAt: 100,
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> = [];

    const result = await setJobFavorite._handler(
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

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_alpha", isFavorite: true },
    );

    expect(result).toBeNull();
    expect(patchCalls).toEqual([
      {
        id: "job_alpha",
        patch: {
          isFavorite: true,
          updatedAt: expect.any(Number),
        },
      },
    ]);
    expect(job.isFavorite).toBe(true);
  });
});
