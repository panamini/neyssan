import { describe, expect, it, vi } from "vitest";

import { getByProfileId, listMine } from "../profilesPublic";

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

describe("profilesPublic.getByProfileId", () => {
  it("resolves document decoration storage IDs into runtime-only URLs", async () => {
    const profile = buildProfile({
      metadata: {
        documentDecoration: {
          visible: true,
          source: "upload",
          assetId: "storage_decoration_1",
          fileName: "mark.jpg",
          mimeType: "image/jpeg",
          alt: "Mark",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
          dataUrl: "data:image/jpeg;base64,AAAA",
        },
      },
      cvDocument: {
        id: "cv_1",
        title: "Decorated CV",
        metadata: {
          documentDecoration: {
            visible: true,
            source: "upload",
            assetId: "storage_decoration_1",
            fileName: "embedded.jpg",
            mimeType: "image/jpeg",
            alt: "Embedded",
            sizePreset: 35,
            fit: "contain",
            placementMode: "custom",
            xMm: 17,
            yMm: 35,
            dataUrl: "data:image/jpeg;base64,BBBB",
          },
        },
        sections: [],
      },
    });
    const getUrl = vi.fn(async (storageId: string) => {
      expect(storageId).toBe("storage_decoration_1");
      return "https://files.example.test/storage_decoration_1";
    });

    const result = await getByProfileId._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        storage: { getUrl },
        db: {
          query(table: string) {
            expect(table).toBe("userProfiles");
            return {
              withIndex(_indexName: string, buildIndex: any) {
                const scope = {
                  eq(_field: string, value: string) {
                    expect(value).toBe("cv_1");
                    return value;
                  },
                };
                buildIndex(scope);
                return {
                  collect: async () => [profile],
                };
              },
            };
          },
        },
      } as any,
      { profileId: "cv_1" },
    );

    expect(getUrl).toHaveBeenCalledTimes(1);
    expect(result?.metadata?.documentDecoration).toMatchObject({
      assetId: "storage_decoration_1",
      resolvedUrl: "https://files.example.test/storage_decoration_1",
    });
    expect(result?.metadata?.documentDecoration?.dataUrl).toBeUndefined();
    expect(
      (result?.cvDocument as any)?.metadata?.documentDecoration?.resolvedUrl,
    ).toBe("https://files.example.test/storage_decoration_1");
    expect(
      (result?.cvDocument as any)?.metadata?.documentDecoration?.dataUrl,
    ).toBeUndefined();
  });

  it("marks document decoration assets as missing when storage getUrl returns null", async () => {
    const profile = buildProfile({
      profileId: "cv_missing_asset",
      clerkId: "clerk_123",
      metadata: {
        documentDecoration: {
          visible: true,
          source: "upload",
          assetId: "storage_missing",
          fileName: "missing.jpg",
          mimeType: "image/jpeg",
          sizePreset: 35,
          fit: "contain",
          placementMode: "default",
        },
      },
    });
    const getUrl = vi.fn(async () => null);

    const result = await getByProfileId._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        storage: { getUrl },
        db: {
          query(table: string) {
            expect(table).toBe("userProfiles");
            return {
              withIndex(_indexName: string, buildIndex: any) {
                buildIndex({
                  eq(_field: string, value: string) {
                    expect(value).toBe("cv_missing_asset");
                    return value;
                  },
                });
                return {
                  collect: async () => [profile],
                };
              },
            };
          },
        },
      } as any,
      { profileId: "cv_missing_asset" },
    );

    expect(getUrl).toHaveBeenCalledWith("storage_missing");
    expect(result?.metadata?.documentDecoration).toMatchObject({
      assetId: "storage_missing",
      assetMissing: true,
    });
    expect(result?.metadata?.documentDecoration?.resolvedUrl).toBeUndefined();
  });
});
