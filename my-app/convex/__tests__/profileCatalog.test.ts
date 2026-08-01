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
    });
    expect(projection).not.toHaveProperty("cvDocument");
    expect(projection).not.toHaveProperty("experience");
    expect(projection).not.toHaveProperty("summary");
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
