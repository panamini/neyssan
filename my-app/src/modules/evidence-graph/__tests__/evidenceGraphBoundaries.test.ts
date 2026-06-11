import { describe, expect, it } from "vitest";
import type { CandidateFactV1 } from "../../candidate-evidence/schema";
import { listCareerKnowledgeRules } from "../../career-knowledge/resolver";
import { buildEvidenceGraph } from "../buildEvidenceGraph";
import type { EvidenceGraphBuildInputV1, JobDemandV1 } from "../schema";

const T = Date.UTC(2026, 5, 11);

function demand(overrides: Partial<JobDemandV1> = {}): JobDemandV1 {
  return {
    id: "demand:typescript",
    kind: "skill",
    label: "TypeScript",
    required: "required",
    source: "job",
    sourcePath: "job.requirements[0]",
    weight: 1,
    version: 1,
    ...overrides,
  };
}

function fact(overrides: Partial<CandidateFactV1> = {}): CandidateFactV1 {
  return {
    id: "candidate-fact:typescript-approved",
    userId: "user_123",
    sourceDocumentId: "candidate-source-document:source_hash_a",
    sourcePath: "document.skills[0].name",
    sourceQuote: "TypeScript",
    factType: "skill",
    value: { name: "TypeScript" },
    normalizedText: "TypeScript",
    confidence: 0.96,
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: T,
    updatedAt: T,
    version: 1,
    ...overrides,
  };
}

function input(overrides: Partial<EvidenceGraphBuildInputV1> = {}): EvidenceGraphBuildInputV1 {
  return {
    userId: "user_123",
    applicationContextId: "application-context:abc",
    demands: [demand()],
    candidateFacts: [fact()],
    careerKnowledgeRules: listCareerKnowledgeRules(),
    createdAt: T,
    ...overrides,
  };
}

describe("evidence-graph proof boundaries", () => {
  it("emits allowed claims only from approved use_in_applications facts", async () => {
    const graph = await buildEvidenceGraph(
      input({
        candidateFacts: [
          fact(),
          fact({
            id: "candidate-fact:typescript-private",
            visibility: "private",
            sourcePath: "document.skills[1].name",
          }),
          fact({
            id: "candidate-fact:typescript-never-use",
            visibility: "never_use",
            sourcePath: "document.skills[2].name",
          }),
          fact({
            id: "candidate-fact:typescript-pending",
            reviewState: "pending",
            sourcePath: "document.skills[3].name",
          }),
        ],
      }),
    );

    expect(graph.allowedClaims).toEqual([
      expect.objectContaining({
        candidateFactIds: ["candidate-fact:typescript-approved"],
        text: "TypeScript",
        reviewState: "allowed",
      }),
    ]);
    expect(graph.blockedClaimIds).toEqual([
      "blocked-claim:candidate-fact:typescript-never-use",
      "blocked-claim:candidate-fact:typescript-pending",
      "blocked-claim:candidate-fact:typescript-private",
    ]);
    expect(graph.riskFlags.map((riskFlag) => riskFlag.category)).toEqual(
      expect.arrayContaining(["never_use_fact", "private_fact", "source_truth"]),
    );
  });

  it("keeps a pending matching fact out of allowed claims and reports missing evidence", async () => {
    const graph = await buildEvidenceGraph(
      input({
        candidateFacts: [
          fact({
            id: "candidate-fact:typescript-pending",
            reviewState: "pending",
          }),
        ],
      }),
    );

    expect(graph.allowedClaims).toHaveLength(0);
    expect(graph.matches).toEqual([
      expect.objectContaining({
        candidateFactId: "candidate-fact:typescript-pending",
        reviewState: "pending",
      }),
    ]);
    expect(graph.missing).toEqual([
      expect.objectContaining({
        demandId: "demand:typescript",
        severity: "blocker",
      }),
    ]);
    expect(graph.blockedClaimIds).toEqual(["blocked-claim:candidate-fact:typescript-pending"]);
  });

  it("blocks generated artifact-like facts even when they match a demand", async () => {
    const graph = await buildEvidenceGraph(
      input({
        candidateFacts: [
          fact({
            id: "candidate-fact:generated-copy",
            value: { generatedText: "TypeScript" },
            normalizedText: "TypeScript",
          }),
        ],
      }),
    );

    expect(graph.allowedClaims).toHaveLength(0);
    expect(graph.riskFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "generated_text_as_fact",
          severity: "blocker",
          candidateFactId: "candidate-fact:generated-copy",
        }),
      ]),
    );
    expect(graph.blockedClaimIds).toEqual(["blocked-claim:candidate-fact:generated-copy"]);
  });

  it("keeps deterministic blocked claim order across input fact order", async () => {
    const privateFact = fact({
      id: "candidate-fact:b-private",
      visibility: "private",
      sourcePath: "document.skills[1].name",
    });
    const neverUseFact = fact({
      id: "candidate-fact:a-never-use",
      visibility: "never_use",
      sourcePath: "document.skills[2].name",
    });

    const first = await buildEvidenceGraph(input({ candidateFacts: [privateFact, neverUseFact] }));
    const second = await buildEvidenceGraph(input({ candidateFacts: [neverUseFact, privateFact] }));

    expect(first.blockedClaimIds).toEqual(second.blockedClaimIds);
    expect(first.blockedClaimIds).toEqual([
      "blocked-claim:candidate-fact:a-never-use",
      "blocked-claim:candidate-fact:b-private",
    ]);
  });
});
