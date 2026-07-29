import { describe, expect, it } from "vitest";

import type { CandidateFactV1 } from "../../../../src/modules/candidate-evidence/schema";
import { buildEvidenceGraph } from "../../../../src/modules/evidence-graph/buildEvidenceGraph";
import { buildResumeVariantPlan } from "../../../../src/modules/resume-variant-plan/buildResumeVariantPlan";
import { buildJobDemandsFromCanonicalJobBrief } from "../jobBriefDemands";

const CANDIDATE_FACT: CandidateFactV1 = {
  id: "candidate-fact:customer-service",
  userId: "user-owner",
  sourceDocumentId: "candidate-source-document:source-cv-1",
  sourcePath: "document.skills[section-skills][skill-service]",
  sourceQuote: "Customer service",
  factType: "skill",
  value: { name: "Customer service" },
  normalizedText: "Customer service",
  reviewState: "approved",
  visibility: "use_in_applications",
  createdAt: 100,
  updatedAt: 100,
  version: 1,
};

describe("canonical Job Brief demands", () => {
  it("normalizes editable Job Brief fields into typed deterministic demands", async () => {
    const demands = await buildJobDemandsFromCanonicalJobBrief({
      jobId: "job-moulin-de-flor",
      mustHaves: [
        "Customer service",
        "French language",
        "Weekend availability",
      ],
      responsibilities: ["Welcome customers"],
      keywords: ["customer service", "Retail"],
    });

    expect(demands).toHaveLength(5);
    expect(demands.map((demand) => demand.id)).toEqual(
      [...demands.map((demand) => demand.id)].sort(),
    );
    expect(demands.every((demand) => /^job-demand:[a-f0-9]{64}$/u.test(demand.id))).toBe(
      true,
    );
    expect(demands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "skill",
          label: "Customer service",
          required: "required",
          source: "job",
          sourcePath: "job.mustHaves",
        }),
        expect.objectContaining({
          kind: "language",
          label: "French language",
          required: "required",
        }),
        expect.objectContaining({
          kind: "availability",
          label: "Weekend availability",
          required: "required",
        }),
        expect.objectContaining({
          kind: "responsibility",
          label: "Welcome customers",
          required: "unknown",
          sourcePath: "job.responsibilities",
        }),
        expect.objectContaining({
          kind: "skill",
          label: "Retail",
          required: "preferred",
          sourcePath: "job.keywords",
        }),
      ]),
    );
  });

  it("is stable across reorder, removes empty values, and promotes duplicate must-haves", async () => {
    const brief = {
      jobId: "job-1",
      mustHaves: [" Customer   service ", "", "customer service"],
      responsibilities: ["Welcome customers"],
      keywords: ["Retail", "CUSTOMER SERVICE"],
    } as const;
    const reordered = {
      ...brief,
      mustHaves: [...brief.mustHaves].reverse(),
      responsibilities: [...brief.responsibilities].reverse(),
      keywords: [...brief.keywords].reverse(),
    };

    const before = await buildJobDemandsFromCanonicalJobBrief(brief);
    const after = await buildJobDemandsFromCanonicalJobBrief(reordered);

    expect(after).toEqual(before);
    expect(
      before.filter((demand) => demand.label.toLowerCase() === "customer service"),
    ).toHaveLength(1);
    expect(
      before.find((demand) => demand.label.toLowerCase() === "customer service"),
    ).toMatchObject({
      required: "required",
      sourcePath: "job.mustHaves",
    });
    expect(
      await buildJobDemandsFromCanonicalJobBrief({
        jobId: "job-empty",
        mustHaves: [],
        responsibilities: [" ", "\n"],
        keywords: [],
      }),
    ).toEqual([]);
  });

  it("feeds demand matches into the existing evidence graph and resume-plan boundary without mutating inputs", async () => {
    const brief = {
      jobId: "job-moulin-de-flor",
      mustHaves: ["Customer service"],
      responsibilities: [],
      keywords: [],
    } as const;
    const snapshot = JSON.stringify(brief);
    const demands = await buildJobDemandsFromCanonicalJobBrief(brief);
    const evidenceGraph = await buildEvidenceGraph({
      userId: "user-owner",
      applicationContextId: "application-context:job-and-source-cv",
      demands,
      candidateFacts: [CANDIDATE_FACT],
      careerKnowledgeRules: [],
      createdAt: 100,
    });
    const plan = await buildResumeVariantPlan({
      userId: "user-owner",
      applicationContextId: "application-context:job-and-source-cv",
      targetDocumentKind: "cv",
      evidenceGraph,
      createdAt: 100,
      updatedAt: 100,
    });

    expect(evidenceGraph.matches).toEqual([
      expect.objectContaining({
        candidateFactId: CANDIDATE_FACT.id,
        demandId: demands[0]?.id,
      }),
    ]);
    expect(plan.sourceFactIds).toContain(CANDIDATE_FACT.id);
    expect(
      plan.items.some((item) => item.candidateFactIds.includes(CANDIDATE_FACT.id)),
    ).toBe(true);
    expect(JSON.stringify(brief)).toBe(snapshot);
  });
});
