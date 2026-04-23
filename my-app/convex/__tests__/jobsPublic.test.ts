import { describe, expect, it } from "vitest";

import { listForUser } from "../jobsPublic";

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
        matchTier: "strong",
      }),
    ]);
  });
});
