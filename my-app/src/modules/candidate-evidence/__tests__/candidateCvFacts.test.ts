import { describe, expect, it } from "vitest";

import type { CvDocument } from "../../../types/cvDocument";
import { buildCandidateCvFacts } from "../candidateCvFacts";
import { buildEvidenceGraph } from "../../evidence-graph/buildEvidenceGraph";
import { buildResumeVariantPlan } from "../../resume-variant-plan/buildResumeVariantPlan";
import {
  buildCandidateCvItemReferences,
  resolveCandidateCvItemReference,
} from "../cvItemReferences";

function buildSourceCv(): CvDocument {
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
        structuredContent: [
          {
            id: "exp-bakery",
            company: "Bakery One",
            position: "Sales associate",
            startDate: "2024-01-01T00:00:00.000Z",
            responsibilityBullets: ["Welcome customers", "Operate the checkout"],
          },
        ],
      },
      {
        id: "section-education",
        title: "Education",
        type: "education",
        blocks: [],
        structuredContent: [
          {
            id: "edu-commerce",
            institution: "Lycée Example",
            degree: "Commerce",
          },
        ],
      },
      {
        id: "section-skills",
        title: "Skills",
        type: "skills",
        blocks: [],
        structuredContent: [
          {
            id: "skill-service",
            name: "Customer service",
            level: "Advanced",
          },
        ],
      },
    ],
  };
}

const FACT_OPTIONS = {
  userId: "user-owner",
  sourceDocumentId: "candidate-source-document:source-cv-1",
  reviewState: "approved",
  visibility: "use_in_applications",
  createdAt: 100,
  updatedAt: 100,
} as const;

describe("candidate CV facts", () => {
  it("resolves stable locators and builds reviewed CandidateFacts without mutating the source CV", async () => {
    const sourceCv = buildSourceCv();
    const sourceSnapshot = JSON.stringify(sourceCv);
    const references = buildCandidateCvItemReferences(sourceCv);

    const resolved = references.map((reference) =>
      resolveCandidateCvItemReference(sourceCv, reference),
    );
    const facts = await buildCandidateCvFacts({
      ...FACT_OPTIONS,
      document: sourceCv,
      references,
    });

    expect(
      resolved
        .map(({ item }) => (item as { id?: string }).id)
        .sort(),
    ).toEqual(["edu-commerce", "exp-bakery", "skill-service"]);
    expect(facts).toHaveLength(3);
    expect(facts.map((fact) => fact.factType).sort()).toEqual([
      "education",
      "experience",
      "skill",
    ]);
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user-owner",
          sourceDocumentId: "candidate-source-document:source-cv-1",
          reviewState: "approved",
          visibility: "use_in_applications",
          version: 1,
        }),
      ]),
    );
    expect(
      facts.find((fact) => fact.factType === "experience")?.normalizedText,
    ).toContain("Operate the checkout");
    expect(JSON.stringify(sourceCv)).toBe(sourceSnapshot);
  });

  it("keeps CandidateFact ids deterministic across section and item reorder", async () => {
    const sourceCv = buildSourceCv();
    const reordered: CvDocument = {
      ...sourceCv,
      sections: [...sourceCv.sections].reverse(),
    };

    const before = await buildCandidateCvFacts({
      ...FACT_OPTIONS,
      document: sourceCv,
      references: buildCandidateCvItemReferences(sourceCv),
    });
    const after = await buildCandidateCvFacts({
      ...FACT_OPTIONS,
      document: reordered,
      references: buildCandidateCvItemReferences(reordered),
    });

    expect(after).toEqual(before);
  });

  it("feeds stable candidateFactIds through the existing evidence graph and resume plan boundary", async () => {
    const sourceCv = buildSourceCv();
    const references = buildCandidateCvItemReferences(sourceCv);
    const facts = await buildCandidateCvFacts({
      ...FACT_OPTIONS,
      document: sourceCv,
      references,
    });
    const customerServiceFact = facts.find(
      (fact) => fact.factType === "skill",
    );
    const evidenceGraph = await buildEvidenceGraph({
      userId: "user-owner",
      applicationContextId: "application-context:job-and-source-cv",
      demands: [
        {
          id: "demand:customer-service",
          kind: "skill",
          label: "Customer service",
          required: "required",
          source: "job",
          sourcePath: "job.mustHaves[0]",
          version: 1,
        },
      ],
      candidateFacts: facts,
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

    expect(customerServiceFact).toBeDefined();
    expect(plan.sourceFactIds).toContain(customerServiceFact!.id);
    expect(
      plan.items.some((item) =>
        item.candidateFactIds.includes(customerServiceFact!.id),
      ),
    ).toBe(true);
  });

  it("keeps the item reference stable but changes the fact id when source content changes", async () => {
    const sourceCv = buildSourceCv();
    const edited: CvDocument = {
      ...sourceCv,
      sections: sourceCv.sections.map((section) =>
        section.type === "experience"
          ? {
              ...section,
              structuredContent: [
                {
                  ...(section.structuredContent?.[0] as Record<string, unknown>),
                  position: "Senior sales associate",
                },
              ] as typeof section.structuredContent,
            }
          : section,
      ),
    };
    const originalReference = buildCandidateCvItemReferences(sourceCv).find(
      (reference) => reference.itemId === "exp-bakery",
    );
    const editedReference = buildCandidateCvItemReferences(edited).find(
      (reference) => reference.itemId === "exp-bakery",
    );

    expect(editedReference).toEqual(originalReference);

    const [originalFact] = await buildCandidateCvFacts({
      ...FACT_OPTIONS,
      document: sourceCv,
      references: [originalReference!],
    });
    const [editedFact] = await buildCandidateCvFacts({
      ...FACT_OPTIONS,
      document: edited,
      references: [editedReference!],
    });

    expect(editedFact.id).not.toBe(originalFact.id);
  });

  it("rejects forged or stale locators and scopes fact ids by user", async () => {
    const sourceCv = buildSourceCv();
    const [reference] = buildCandidateCvItemReferences(sourceCv);
    const forgedReference = {
      ...reference,
      sourcePath: `${reference.sourcePath}.forged`,
    };

    expect(() =>
      resolveCandidateCvItemReference(sourceCv, forgedReference),
    ).toThrow(/does not match the source CV/i);

    const [ownerFact] = await buildCandidateCvFacts({
      ...FACT_OPTIONS,
      document: sourceCv,
      references: [reference],
    });
    const [otherUserFact] = await buildCandidateCvFacts({
      ...FACT_OPTIONS,
      userId: "user-other",
      document: sourceCv,
      references: [reference],
    });

    expect(otherUserFact.id).not.toBe(ownerFact.id);
  });
});
