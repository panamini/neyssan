import { describe, expect, it } from "vitest";

describe("primary-eligible Profile catalog", () => {
  it("promotes current normal Profiles while excluding newer reviewed variants", async () => {
    const { buildProfileCatalogProjection, selectPrimaryProfileCatalog } =
      await import("../profileCatalog");

    const olderNormal = buildProfileCatalogProjection({
      _id: "profile_old",
      _creationTime: 100,
      profileId: "cv_old",
      clerkId: "clerk_owner",
      email: "owner@example.test",
      createdAt: 100,
      updatedAt: 100,
      version: 1,
      defaultResumeId: "cv_old",
      defaultResumeName: "Original CV",
      cvDocument: { title: "Original CV", sections: [{ payload: "x".repeat(10_000) }] },
    } as any);
    const currentNormal = buildProfileCatalogProjection({
      _id: "profile_current",
      _creationTime: 200,
      profileId: "cv_current",
      clerkId: "clerk_owner",
      email: "owner@example.test",
      createdAt: 200,
      updatedAt: 300,
      version: 2,
      defaultResumeId: "cv_current",
      defaultResumeName: "Current CV",
      cvDocument: { title: "Current CV", sections: [{ payload: "y".repeat(10_000) }] },
    } as any);
    const newerReviewedVariant = buildProfileCatalogProjection({
      _id: "profile_reviewed",
      _creationTime: 400,
      profileId: "source-cv-variant:v1:job_1:cv_current",
      clerkId: "clerk_owner",
      email: "owner@example.test",
      createdAt: 400,
      updatedAt: 500,
      version: 1,
      cvDocument: { title: "Reviewed variant", sections: [{ payload: "z".repeat(10_000) }] },
    } as any);

    expect(newerReviewedVariant).toBeNull();
    expect(selectPrimaryProfileCatalog([olderNormal, currentNormal].filter(Boolean) as any)).toMatchObject({
      profileId: "profile_current",
      defaultResumeId: "cv_current",
      defaultResumeName: "Current CV",
    });

    const metadataPromoted = {
      ...olderNormal!,
      updatedAt: 600,
    };
    expect(selectPrimaryProfileCatalog([currentNormal!, metadataPromoted])).toMatchObject({
      profileId: "profile_old",
      defaultResumeId: "cv_old",
    });
    expect(metadataPromoted).not.toHaveProperty("cvDocument");
  });
});
