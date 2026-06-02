import { describe, expect, it } from "vitest";

import { listMine } from "../profilesPublic";

function buildProfile(overrides: Record<string, unknown> = {}) {
  return {
    _id: "profile_1",
    _creationTime: 100,
    profileId: "cv_1",
    clerkId: "clerk_123",
    email: "user@example.com",
    name: "User",
    version: 1,
    createdAt: 100,
    updatedAt: 100,
    preferences: {
      writingStyle: "professional",
      tonePreference: "formal",
      autoSend: false,
    },
    summary: "Profile summary",
    skills: ["React"],
    keywords: ["react"],
    experience: [],
    education: [],
    cvDocument: {
      id: "cv_1",
      title: "Full CV payload should not hydrate listMine",
      metadata: { createdAt: "now", updatedAt: "now", version: 1 },
      sections: [{ type: "summary", structuredContent: [{ text: "heavy" }] }],
    },
    ...overrides,
  };
}

describe("profilesPublic.listMine", () => {
  it("loads bounded profile summaries without embedded cvDocument payloads", async () => {
    let usedIndexName: string | null = null;
    let takeLimit: number | null = null;
    const rows = [
      buildProfile({ _id: "profile_new", profileId: "cv_new", updatedAt: 200 }),
      buildProfile({ _id: "profile_old", profileId: "cv_old", updatedAt: 100 }),
    ];

    const result = await listMine._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          query(table: string) {
            expect(table).toBe("userProfiles");
            return {
              withIndex(indexName: string, buildIndex: any) {
                usedIndexName = indexName;
                const scope = {
                  eq(field: string, value: string) {
                    expect(field).toBe("clerkId");
                    expect(value).toBe("clerk_123");
                    return this;
                  },
                };
                buildIndex(scope);
                return {
                  order(direction: string) {
                    expect(direction).toBe("desc");
                    return this;
                  },
                  take: async (limit: number) => {
                    takeLimit = limit;
                    return rows.slice(0, limit);
                  },
                };
              },
            };
          },
        },
      } as any,
      {},
    );

    expect(usedIndexName).toBe("by_clerk_updated_at");
    expect(takeLimit).toBe(40);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      _id: "profile_new",
      profileId: "cv_new",
      summary: "Profile summary",
    });
    expect(result[0].cvDocument).toBeUndefined();
  });
});
