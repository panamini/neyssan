import { describe, expect, it } from "vitest";

import proposalsPublic from "../proposalsPublic";

describe("proposalsPublic", () => {
  it("returns only saved proposals and projects them to the declared public return shape", async () => {
    const result = await proposalsPublic._handler({
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: (table: string) => {
          if (table === "userProfiles") {
            return {
              withIndex: () => ({
                unique: async () => ({ _id: "user_1" }),
              }),
            };
          }

          if (table === "proposals") {
            return {
              withIndex: () => ({
                collect: async () => [
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
                    updatedAt: 456,
                    createdAt: 123,
                    sections: [{ type: "text", content: "Body" }],
                    metadata: {
                      platform: "web",
                      jobId: "N/A",
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
                      extra_runtime_only: "should_not_escape",
                    },
                    metrics: { score: 0.8, confidence: 0.9 },
                    version: 1,
                    otherFutureField: "should_not_escape",
                  },
                ],
              }),
            };
          }

          throw new Error(`Unexpected table: ${table}`);
        },
      },
    } as any);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      _id: "proposal_1",
      title: "Security Officer Proposal",
      metadata: {
        planned_path: "legacy",
        executed_path: "legacy",
        fallback_reason: "rollout_disabled",
        validator_outcome: "legacy_verified_clean",
        save_outcome: "legacy_saved_parsed",
      },
    });
    expect(result[0]).not.toHaveProperty("otherFutureField");
    expect(result[0].metadata).not.toHaveProperty("extra_runtime_only");
  });
});
