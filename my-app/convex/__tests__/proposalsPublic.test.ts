import { describe, expect, it } from "vitest";

import proposalsPublic from "../proposalsPublic";

function createCtx(proposals: any[]) {
  return {
    auth: {
      getUserIdentity: async () => ({ subject: "clerk_1" }),
    },
    db: {
      query: (table: string) => {
        if (table === "userProfiles") {
          return {
            withIndex: () => ({
              collect: async () => [{ _id: "user_1", clerkId: "clerk_1" }],
              unique: async () => ({ _id: "user_1" }),
            }),
          };
        }

        if (table === "proposals") {
          return {
            withIndex: () => ({
              collect: async () => proposals,
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    },
  } as any;
}

describe("proposalsPublic", () => {
  it("returns draft and saved proposal library rows projected to the declared public shape", async () => {
    const result = await proposalsPublic._handler(
      createCtx([
        {
          _id: "proposal_draft",
          _creationTime: 456,
          userId: "user_1",
          title: "Draft proposal",
          content: "Draft body",
          status: "draft",
          updatedAt: 789,
          createdAt: 456,
          sections: [{ type: "text", content: "Draft body" }],
          metadata: {},
          metrics: {},
          version: 1,
        },
        {
          _id: "proposal_1",
          _creationTime: 123,
          userId: "user_1",
          title: "Security Officer Proposal",
          content: "Body",
          status: "saved",
          jobId: "job_1",
          updatedAt: 456,
          createdAt: 123,
          sections: [{ type: "text", content: "Body" }],
          metadata: {
            platform: "web",
            tags: ["parsed"],
            sourceJobDescription: "desc",
            planned_path: "legacy",
            executed_path: "legacy",
            fallback_reason: "rollout_disabled",
            validator_outcome: "legacy_verified_clean",
            save_outcome: "legacy_saved_parsed",
            voicePreset: "signature",
            formalityLevel: "neutral",
            creativity: "medium",
            proposalType: "cover_letter",
            templateBundleId: "magazine_editorial",
            verbatiStyleSlotId: 2,
            verbatiStyleSlotSource: "settings",
            verbatiStyleSlotNameSnapshot: "Style 2",
            verbatiStyleBaseSnapshot: {
              familyId: "workshop",
              layout: "workshop",
              typography: "civic-correspondence",
              palette: "cobalt",
              extra_nested_runtime_only: "should_not_escape",
            },
            documentStyleVersion: 1,
            extra_runtime_only: "should_not_escape",
          },
          metrics: { score: 0.8, confidence: 0.9 },
          version: 1,
          otherFutureField: "should_not_escape",
        },
      ]),
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      _id: "proposal_draft",
      title: "Draft proposal",
      status: "draft",
    });
    expect(result[1]).toMatchObject({
      _id: "proposal_1",
      title: "Security Officer Proposal",
      metadata: {
        jobId: "job_1",
        planned_path: "legacy",
        executed_path: "legacy",
        fallback_reason: "rollout_disabled",
        validator_outcome: "legacy_verified_clean",
        save_outcome: "legacy_saved_parsed",
        templateBundleId: "magazine_editorial",
        verbatiStyleSlotId: 2,
        verbatiStyleSlotSource: "settings",
        verbatiStyleSlotNameSnapshot: "Style 2",
        verbatiStyleBaseSnapshot: {
          familyId: "workshop",
          layout: "workshop",
          typography: "civic-correspondence",
          palette: "cobalt",
        },
        documentStyleVersion: 1,
      },
    });
    expect(result[1]).not.toHaveProperty("otherFutureField");
    expect(result[1].metadata).not.toHaveProperty("extra_runtime_only");
    expect(result[1].metadata.verbatiStyleBaseSnapshot).not.toHaveProperty(
      "extra_nested_runtime_only",
    );
  });

  it("keeps multiple generated draft variants for the same job visible as separate library rows", async () => {
    const result = await proposalsPublic._handler(
      createCtx([
        {
          _id: "proposal_variant_a",
          _creationTime: 100,
          userId: "user_1",
          title: "Operations draft — CV A",
          content: "Draft A",
          status: "draft",
          jobId: "job_shared",
          updatedAt: 100,
          createdAt: 100,
          sections: [{ type: "text", content: "Draft A" }],
          metadata: { jobId: "job_shared", sourceCvId: "cv_a" },
          metrics: {},
          version: 1,
        },
        {
          _id: "proposal_variant_b",
          _creationTime: 200,
          userId: "user_1",
          title: "Operations draft — CV B",
          content: "Draft B",
          status: "draft",
          jobId: "job_shared",
          updatedAt: 200,
          createdAt: 200,
          sections: [{ type: "text", content: "Draft B" }],
          metadata: { jobId: "job_shared", sourceCvId: "cv_b" },
          metrics: {},
          version: 1,
        },
      ]),
    );

    expect(result.map((proposal) => proposal._id)).toEqual([
      "proposal_variant_b",
      "proposal_variant_a",
    ]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: "proposal_variant_a",
          status: "draft",
          metadata: expect.objectContaining({
            jobId: "job_shared",
            sourceCvId: "cv_a",
          }),
        }),
        expect.objectContaining({
          _id: "proposal_variant_b",
          status: "draft",
          metadata: expect.objectContaining({
            jobId: "job_shared",
            sourceCvId: "cv_b",
          }),
        }),
      ]),
    );
  });
});
