import { describe, expect, it } from "vitest";

import { buildCandidateCvItemReferences } from "../../candidate-evidence/cvItemReferences";
import type { EvidenceGraphV1 } from "../../evidence-graph/schema";
import type { CvDocument } from "../../../types/cvDocument";
import type { ApplicationContextV1 } from "../schema";
import { composeSourceCvVariantPlan } from "../sourceCvComposition";

const T = Date.UTC(2026, 6, 29);

function sourceCv(
  itemIds = ["exp-a", "exp-b", "exp-c", "exp-d", "exp-e"],
): CvDocument {
  return {
    id: "cv-source-1",
    title: "Source CV",
    metadata: {
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
      version: 1,
    },
    sections: [
      {
        id: "section-experience",
        title: "Experience",
        type: "experience",
        blocks: [],
        structuredContent: itemIds.map((id) => ({
          id,
          company: `Company ${id}`,
          position: id === "exp-c" ? "Adjacent service" : "Direct service",
        })),
      },
    ],
  };
}

function applicationContext(
  overrides: Partial<ApplicationContextV1> = {},
): ApplicationContextV1 {
  return {
    id: "application-context:abc",
    userId: "user_123",
    job: {
      jobId: "job_123",
      rawTextHash: "job-hash",
    },
    candidate: {
      sourceKind: "cv",
      cvId: "cv-source-1",
      candidateHash: "candidate-hash",
    },
    settingsHash: "settings-hash",
    contextHash: "context-hash",
    reviewState: "approved",
    sourceRefs: [
      {
        sourceType: "cv",
        sourceId: "cv-source-1",
        sourceHash: "candidate-hash",
      },
    ],
    createdAt: T,
    updatedAt: T,
    version: 1,
    ...overrides,
  };
}

function evidenceGraph(): EvidenceGraphV1 {
  const demands = [
    {
      id: "demand:required-service",
      kind: "experience" as const,
      label: "Customer service",
      required: "required" as const,
      source: "job" as const,
      version: 1 as const,
    },
    {
      id: "demand:preferred-checkout",
      kind: "experience" as const,
      label: "Checkout",
      required: "preferred" as const,
      source: "job" as const,
      version: 1 as const,
    },
    {
      id: "demand:unknown-domain",
      kind: "experience" as const,
      label: "Domain familiarity",
      required: "unknown" as const,
      source: "job" as const,
      version: 1 as const,
    },
  ];
  const matches = [
    {
      id: "match:exp-a:service",
      demandId: demands[0].id,
      candidateFactId: "fact:exp-a",
      sourceDocumentId: "cv-source-1",
      sourcePath: "document.exp-a",
      matchType: "direct" as const,
      strength: "strong" as const,
      reviewState: "accepted" as const,
      reason: "Direct.",
      version: 1 as const,
    },
    {
      id: "match:exp-a:checkout",
      demandId: demands[1].id,
      candidateFactId: "fact:exp-a",
      sourceDocumentId: "cv-source-1",
      sourcePath: "document.exp-a",
      matchType: "direct" as const,
      strength: "strong" as const,
      reviewState: "accepted" as const,
      reason: "Direct.",
      version: 1 as const,
    },
    {
      id: "match:exp-b:service",
      demandId: demands[0].id,
      candidateFactId: "fact:exp-b",
      sourceDocumentId: "cv-source-1",
      sourcePath: "document.exp-b",
      matchType: "direct" as const,
      strength: "strong" as const,
      reviewState: "accepted" as const,
      reason: "Direct.",
      version: 1 as const,
    },
    {
      id: "match:exp-c:service",
      demandId: demands[0].id,
      candidateFactId: "fact:exp-c",
      sourceDocumentId: "cv-source-1",
      sourcePath: "document.exp-c",
      matchType: "adjacent" as const,
      strength: "medium" as const,
      reviewState: "accepted" as const,
      reason: "Adjacent.",
      version: 1 as const,
    },
    {
      id: "match:exp-d:checkout",
      demandId: demands[1].id,
      candidateFactId: "fact:exp-d",
      sourceDocumentId: "cv-source-1",
      sourcePath: "document.exp-d",
      matchType: "direct" as const,
      strength: "strong" as const,
      reviewState: "accepted" as const,
      reason: "Direct.",
      version: 1 as const,
    },
    {
      id: "match:exp-e:domain",
      demandId: demands[2].id,
      candidateFactId: "fact:exp-e",
      sourceDocumentId: "cv-source-1",
      sourcePath: "document.exp-e",
      matchType: "direct" as const,
      strength: "strong" as const,
      reviewState: "accepted" as const,
      reason: "Direct.",
      version: 1 as const,
    },
  ];
  const allowedClaims = ["exp-a", "exp-b", "exp-c", "exp-d", "exp-e"].map((id) => ({
    id: `allowed-claim:fact:${id}`,
    candidateFactIds: [`fact:${id}`],
    claimType: "experience" as const,
    text: `Source claim ${id}`,
    supportLevel: "strong" as const,
    reviewState: "allowed" as const,
    reason: "Approved source fact.",
    version: 1 as const,
  }));

  return {
    id: "evidence-graph:hash-a",
    userId: "user_123",
    applicationContextId: "application-context:abc",
    jobDemandGraphHash: "job-demand-hash",
    candidateEvidenceHash: "candidate-evidence-hash",
    careerKnowledgeHash: "career-knowledge-hash",
    demands,
    matches,
    missing: [],
    riskFlags: [],
    allowedClaims,
    blockedClaimIds: [],
    createdAt: T,
    version: 1,
  };
}

function autoInput(
  document = sourceCv(),
  graph = evidenceGraph(),
) {
  const references = buildCandidateCvItemReferences(document);
  return {
    mode: "auto_recommended" as const,
    callerUserId: "user_123",
    applicationContext: applicationContext(),
    sourceCv: document,
    evidenceGraph: graph,
    cvItemReferences: references,
    factReferenceBindings: references.map((reference) => ({
      candidateFactId: `fact:${reference.itemId}`,
      cvItemReferenceId: reference.id,
    })),
    createdAt: T,
    updatedAt: T,
  };
}

describe("source CV variant-plan composition", () => {
  it("ranks every recommendation deterministically without a cap across reordered CV and graph inputs", async () => {
    const base = autoInput();
    const reorderedDocument = sourceCv([
      "exp-e",
      "exp-d",
      "exp-c",
      "exp-b",
      "exp-a",
    ]);
    const reorderedGraph = evidenceGraph();
    const reordered = autoInput(reorderedDocument, {
      ...reorderedGraph,
      demands: [...reorderedGraph.demands].reverse(),
      matches: [...reorderedGraph.matches].reverse(),
      allowedClaims: [...reorderedGraph.allowedClaims].reverse(),
    });
    reordered.factReferenceBindings = [
      ...reordered.factReferenceBindings,
    ].reverse();

    const first = await composeSourceCvVariantPlan(base);
    const second = await composeSourceCvVariantPlan(reordered);
    const firstItems =
      first.mode === "auto_recommended" ? first.plan.items : [];
    const secondItems =
      second.mode === "auto_recommended" ? second.plan.items : [];

    expect(firstItems).toHaveLength(5);
    expect(
      firstItems.map((item) => item.sourceCvItemReferenceIds?.[0]),
    ).toEqual([
      expect.stringContaining("exp-a"),
      expect.stringContaining("exp-b"),
      expect.stringContaining("exp-c"),
      expect.stringContaining("exp-d"),
      expect.stringContaining("exp-e"),
    ]);
    expect(secondItems.map((item) => item.id)).toEqual(
      firstItems.map((item) => item.id),
    );
    expect(firstItems.every((item) => item.action === "include")).toBe(true);
    expect(firstItems.every((item) => item.reviewState === "pending")).toBe(
      true,
    );
  });

  it("keeps an allowed claim absent from the target CV as add_from_allowed_claim", async () => {
    const input = autoInput();
    input.factReferenceBindings = input.factReferenceBindings.filter(
      (binding) => binding.candidateFactId !== "fact:exp-c",
    );

    const result = await composeSourceCvVariantPlan(input);
    const item =
      result.mode === "auto_recommended"
        ? result.plan.items.find((candidate) =>
            candidate.candidateFactIds.includes("fact:exp-c"),
          )
        : undefined;

    expect(item).toMatchObject({
      action: "add_from_allowed_claim",
      reviewState: "pending",
    });
    expect(item?.sourceCvItemReferenceIds).toBeUndefined();
  });

  it("binds both modes to the owning application context and rejects stale or mismatched CVs", async () => {
    const input = autoInput();

    await expect(
      composeSourceCvVariantPlan({
        ...input,
        callerUserId: "other-user",
      }),
    ).rejects.toThrow(/caller.*user/i);
    await expect(
      composeSourceCvVariantPlan({
        mode: "full_source_cv",
        callerUserId: "other-user",
        applicationContext: applicationContext(),
        sourceCv: sourceCv(),
      }),
    ).rejects.toThrow(/caller.*user/i);
    await expect(
      composeSourceCvVariantPlan({
        ...input,
        applicationContext: applicationContext({ userId: "other-user" }),
      }),
    ).rejects.toThrow(/user/i);
    await expect(
      composeSourceCvVariantPlan({
        ...input,
        applicationContext: applicationContext({
          candidate: {
            sourceKind: "cv",
            cvId: "other-cv",
            candidateHash: "candidate-hash",
          },
        }),
      }),
    ).rejects.toThrow(/source CV/i);
    await expect(
      composeSourceCvVariantPlan({
        ...input,
        evidenceGraph: {
          ...input.evidenceGraph,
          applicationContextId: "application-context:stale",
        },
      }),
    ).rejects.toThrow(/application context/i);
    await expect(
      composeSourceCvVariantPlan({
        mode: "full_source_cv",
        callerUserId: "user_123",
        applicationContext: applicationContext(),
        sourceCv: {
          ...sourceCv(),
          id: "other-cv",
        },
      }),
    ).rejects.toThrow(/source CV/i);
  });

  it("returns a context-bound full_source_cv pass-through with no plan and never mutates the CV", async () => {
    const document = sourceCv();
    const snapshot = JSON.stringify(document);

    const result = await composeSourceCvVariantPlan({
      mode: "full_source_cv",
      callerUserId: "user_123",
      applicationContext: applicationContext(),
      sourceCv: document,
    });

    expect(result).toEqual({
      mode: "full_source_cv",
      userId: "user_123",
      applicationContextId: "application-context:abc",
      sourceCvId: "cv-source-1",
      sourceCvContextHash: "candidate-hash",
      plan: null,
    });
    expect(JSON.stringify(document)).toBe(snapshot);
  });

  it("never mutates the source CV while composing automatic recommendations", async () => {
    const input = autoInput();
    const snapshot = JSON.stringify(input.sourceCv);

    await composeSourceCvVariantPlan(input);

    expect(JSON.stringify(input.sourceCv)).toBe(snapshot);
  });
});
