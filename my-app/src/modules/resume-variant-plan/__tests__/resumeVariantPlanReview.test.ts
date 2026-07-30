import { describe, expect, it } from "vitest";

import type { ResumeVariantPlanV1 } from "../schema";
import { reviewResumeVariantPlan } from "../reviewResumeVariantPlan";

const T = Date.UTC(2026, 6, 29);

function plan(): ResumeVariantPlanV1 {
  return {
    id: "resume-variant-plan:pending-plan",
    userId: "user_123",
    applicationContextId: "application-context:abc",
    evidenceGraphId: "evidence-graph:hash-a",
    evidenceGraphHash: "hash-a",
    targetDocumentKind: "cv",
    items: [
      {
        id: "resume-variant-plan-item:experience:one",
        section: "experience",
        action: "add_from_allowed_claim",
        priority: "required",
        reviewState: "pending",
        allowedClaimIds: ["allowed-claim:experience-one"],
        candidateFactIds: ["candidate-fact:experience-one"],
        evidenceMatchIds: ["evidence-match:experience-one"],
        demandIds: ["demand:experience-one"],
        riskFlagIds: [],
        reason: "Add source-backed experience claim to experience section.",
        version: 1,
      },
      {
        id: "resume-variant-plan-item:skills:one",
        section: "skills",
        action: "add_from_allowed_claim",
        priority: "recommended",
        reviewState: "pending",
        allowedClaimIds: ["allowed-claim:skill-one"],
        candidateFactIds: ["candidate-fact:skill-one"],
        evidenceMatchIds: ["evidence-match:skill-one"],
        demandIds: ["demand:skill-one"],
        riskFlagIds: [],
        reason: "Add source-backed skills claim to skills section.",
        version: 1,
      },
    ],
    warnings: [],
    blockedClaimIds: [],
    sourceFactIds: [
      "candidate-fact:experience-one",
      "candidate-fact:skill-one",
    ],
    allowedClaimIds: [
      "allowed-claim:experience-one",
      "allowed-claim:skill-one",
    ],
    riskFlagIds: [],
    blocked: false,
    createdAt: T,
    updatedAt: T,
    version: 1,
  };
}

describe("ResumeVariantPlan review", () => {
  it("applies accepted and rejected decisions immutably with a deterministic new plan id", async () => {
    const source = plan();
    const snapshot = JSON.stringify(source);
    const decisions = [
      {
        planItemId: "resume-variant-plan-item:experience:one",
        reviewState: "accepted" as const,
      },
      {
        planItemId: "resume-variant-plan-item:skills:one",
        reviewState: "rejected" as const,
      },
    ];

    const first = await reviewResumeVariantPlan({
      userId: "user_123",
      applicationContextId: "application-context:abc",
      expectedPlanId: source.id,
      plan: source,
      decisions,
      updatedAt: T + 1,
    });
    const reordered = await reviewResumeVariantPlan({
      userId: "user_123",
      applicationContextId: "application-context:abc",
      expectedPlanId: source.id,
      plan: source,
      decisions: [...decisions].reverse(),
      updatedAt: T + 1,
    });

    expect(first).toEqual(reordered);
    expect(first.id).toMatch(/^resume-variant-plan:[a-f0-9]{64}$/u);
    expect(first.id).not.toBe(source.id);
    expect(first.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "resume-variant-plan-item:experience:one",
          reviewState: "accepted",
        }),
        expect.objectContaining({
          id: "resume-variant-plan-item:skills:one",
          reviewState: "rejected",
        }),
      ]),
    );
    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it("supports partial review while leaving undecided items pending", async () => {
    const source = plan();
    const reviewed = await reviewResumeVariantPlan({
      userId: source.userId,
      applicationContextId: source.applicationContextId,
      expectedPlanId: source.id,
      plan: source,
      decisions: [
        {
          planItemId: "resume-variant-plan-item:experience:one",
          reviewState: "accepted",
        },
      ],
      updatedAt: T + 1,
    });

    expect(
      reviewed.items.find(
        (item) => item.id === "resume-variant-plan-item:experience:one",
      )?.reviewState,
    ).toBe("accepted");
    expect(
      reviewed.items.find(
        (item) => item.id === "resume-variant-plan-item:skills:one",
      )?.reviewState,
    ).toBe("pending");
  });

  it("rejects stale identity, duplicate or unknown decisions, ownership mismatch, and non-selectable items", async () => {
    const source = plan();
    const decision = {
      planItemId: "resume-variant-plan-item:experience:one",
      reviewState: "accepted" as const,
    };
    const review = (
      overrides: Partial<Parameters<typeof reviewResumeVariantPlan>[0]> = {},
    ) =>
      reviewResumeVariantPlan({
        userId: source.userId,
        applicationContextId: source.applicationContextId,
        expectedPlanId: source.id,
        plan: source,
        decisions: [decision],
        updatedAt: T + 1,
        ...overrides,
      });

    await expect(review({ expectedPlanId: "resume-variant-plan:stale" })).rejects.toThrow(
      /stale/i,
    );
    await expect(review({ userId: "other-user" })).rejects.toThrow(/user/i);
    await expect(
      review({ applicationContextId: "application-context:other" }),
    ).rejects.toThrow(/application context/i);
    await expect(review({ decisions: [decision, decision] })).rejects.toThrow(
      /duplicate/i,
    );
    await expect(
      review({
        decisions: [
          {
            planItemId: "resume-variant-plan-item:missing",
            reviewState: "accepted",
          },
        ],
      }),
    ).rejects.toThrow(/unknown/i);

    const blockedItemPlan: ResumeVariantPlanV1 = {
      ...source,
      items: [
        {
          ...source.items[0]!,
          action: "block",
          reviewState: "blocked",
          allowedClaimIds: [],
          candidateFactIds: [],
          evidenceMatchIds: [],
        },
      ],
    };
    await expect(
      review({
        plan: blockedItemPlan,
        expectedPlanId: blockedItemPlan.id,
      }),
    ).rejects.toThrow(/selectable/i);
  });
});
