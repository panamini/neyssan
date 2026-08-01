import { describe, expect, it, vi } from "vitest";

import {
  buildProfileCatalogProjection,
  upsertProfileCatalog,
} from "../lib/profileCatalog";

describe("profileCatalog", () => {
  it("projects only catalog identity fields without copying resume payloads", () => {
    const projection = buildProfileCatalogProjection({
      _id: "profile_1",
      clerkId: "clerk_1",
      profileId: "canonical-1",
      email: "owner@example.com",
      name: "Owner",
      version: 3,
      updatedAt: 42,
      summary: "Frontend engineer",
      skills: ["React", 7],
      keywords: ["frontend"],
      experience: [{ company: "Acme", title: "Engineer" }],
      cvDocument: {
        title: "Frontend CV",
        sections: [{ type: "experience", blocks: ["large"] }],
      },
    });

    expect(projection).toEqual({
      profileId: "profile_1",
      clerkId: "clerk_1",
      externalProfileId: "canonical-1",
      label: "Frontend CV",
      version: 3,
      updatedAt: 42,
      matchFingerprint: expect.stringMatching(/^match-v1-/),
    });
    expect(projection).not.toHaveProperty("cvDocument");
    expect(projection).not.toHaveProperty("experience");
    expect(projection).not.toHaveProperty("summary");
  });

  it("invalidates one account read-model state when scoring CV data changes", async () => {
    const current = buildProfileCatalogProjection({
      _id: "profile_1",
      clerkId: "clerk_1",
      profileId: "cv_attached",
      version: 1,
      updatedAt: 10,
      skills: ["Catering"],
      keywords: ["food"],
      experience: [],
    });
    const patch = vi.fn(async () => undefined);
    const replace = vi.fn(async () => undefined);
    const query = vi.fn((table: string) => ({
      withIndex: () => ({
        first: async () =>
          table === "profileCatalog"
            ? { _id: "catalog_1", ...current }
            : {
                _id: "read_model_1",
                clerkId: "clerk_1",
                status: "ready",
                version: 2,
                profileCursor: "done",
                updatedAt: 10,
              },
      }),
    }));
    const ctx = {
      db: {
        query,
        patch,
        replace,
        insert: vi.fn(),
      },
    };

    await upsertProfileCatalog(ctx, {
      _id: "profile_1",
      clerkId: "clerk_1",
      profileId: "cv_attached",
      version: 2,
      updatedAt: 20,
      skills: ["React"],
      keywords: ["frontend"],
      experience: [],
    });

    expect(query).toHaveBeenCalledWith("accountReadModels");
    expect(replace).toHaveBeenCalledWith("read_model_1", {
      clerkId: "clerk_1",
      status: "backfilling",
      version: 2,
      updatedAt: expect.any(Number),
    });
  });

  it("does not restart Jobs backfill for metadata-only profile writes", async () => {
    const currentProfile = {
      _id: "profile_1",
      clerkId: "clerk_1",
      profileId: "cv_attached",
      name: "Before",
      version: 1,
      updatedAt: 10,
      skills: ["React"],
      keywords: ["frontend"],
      experience: [],
    };
    const current = buildProfileCatalogProjection(currentProfile);
    const query = vi.fn((table: string) => {
      if (table !== "profileCatalog") {
        throw new Error(`unexpected metadata-only query: ${table}`);
      }
      return {
        withIndex: () => ({
          first: async () => ({ _id: "catalog_1", ...current }),
        }),
      };
    });
    const replace = vi.fn();

    await upsertProfileCatalog(
      {
        db: {
          query,
          patch: vi.fn(async () => undefined),
          replace,
          insert: vi.fn(),
        },
      },
      {
        ...currentProfile,
        name: "After",
        version: 2,
        updatedAt: 20,
      },
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("invalidates when authoritative CV evidence used by the visible verdict changes", async () => {
    const beforeProfile = {
      _id: "profile_1",
      clerkId: "clerk_1",
      profileId: "cv_attached",
      version: 1,
      updatedAt: 10,
      skills: ["React"],
      keywords: ["frontend"],
      experience: [],
      cvDocument: {
        metadata: {
          authoritativeResume: {
            normalized: { languages: ["English"] },
          },
        },
      },
    };
    const current = buildProfileCatalogProjection(beforeProfile);
    const replace = vi.fn(async () => undefined);
    const query = vi.fn((table: string) => ({
      withIndex: () => ({
        first: async () =>
          table === "profileCatalog"
            ? { _id: "catalog_1", ...current }
            : {
                _id: "read_model_1",
                clerkId: "clerk_1",
                status: "ready",
                version: 2,
                updatedAt: 10,
              },
      }),
    }));

    await upsertProfileCatalog(
      {
        db: {
          query,
          patch: vi.fn(async () => undefined),
          replace,
          insert: vi.fn(),
        },
      },
      {
        ...beforeProfile,
        version: 2,
        updatedAt: 20,
        cvDocument: {
          metadata: {
            authoritativeResume: {
              normalized: { languages: ["English", "French"] },
            },
          },
        },
      },
    );

    expect(replace).toHaveBeenCalledWith(
      "read_model_1",
      expect.objectContaining({
        status: "backfilling",
        version: 2,
      }),
    );
  });

  it("updates an existing projection rather than creating duplicates", async () => {
    const patch = vi.fn(async () => undefined);
    const insert = vi.fn(async () => "catalog_1");
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({
            first: async () => ({ _id: "catalog_1" }),
          }),
        }),
        patch,
        insert,
      },
    };

    await upsertProfileCatalog(ctx, {
      _id: "profile_1",
      clerkId: "clerk_1",
      version: 2,
      updatedAt: 20,
      skills: ["React"],
      keywords: [],
      experience: [],
    });

    expect(patch).toHaveBeenCalledOnce();
    expect(insert).not.toHaveBeenCalled();
  });
});
