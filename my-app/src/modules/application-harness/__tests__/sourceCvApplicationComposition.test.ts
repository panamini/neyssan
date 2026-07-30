import { describe, expect, it } from "vitest";

import { buildCandidateCvItemReferences } from "../../candidate-evidence/cvItemReferences";
import type { JobDemandV1 } from "../../evidence-graph/schema";
import type { CvDocument } from "../../../types/cvDocument";
import type { ApplicationContextV1 } from "../schema";
import { buildSourceCvApplicationComposition } from "../sourceCvApplicationComposition";

const T = Date.UTC(2026, 6, 29);

function sourceCv(reverse = false): CvDocument {
  const sections: CvDocument["sections"] = [
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
          startDate: "2024-01-01",
          responsibilityBullets: ["Customer service", "Operate the checkout"],
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
          id: "skill-typescript",
          name: "TypeScript",
          level: "Advanced",
        },
      ],
    },
  ];

  return {
    id: "cv-source-1",
    title: "Source CV",
    metadata: {
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
      version: 1,
    },
    sections: reverse ? [...sections].reverse() : sections,
  };
}

function applicationContext(): ApplicationContextV1 {
  return {
    id: "application-context:job-source-cv",
    userId: "user-owner",
    job: {
      jobId: "job-bakery-1",
      rawTextHash: "job-brief-hash",
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
  };
}

function demands(): readonly JobDemandV1[] {
  return [
    {
      id: "demand:customer-service",
      kind: "skill",
      label: "Customer service",
      required: "required",
      source: "job",
      sourcePath: "job.mustHaves",
      version: 1,
    },
    {
      id: "demand:typescript",
      kind: "skill",
      label: "TypeScript",
      required: "preferred",
      source: "job",
      sourcePath: "job.keywords",
      version: 1,
    },
  ];
}

function experienceReferenceId(document = sourceCv()): string {
  return buildCandidateCvItemReferences(document).find(
    (reference) => reference.sectionType === "experience",
  )!.id;
}

describe("source CV application composition", () => {
  it("builds a pending plan from only explicitly authorized stable CV items", async () => {
    const document = sourceCv();
    const snapshot = JSON.stringify(document);
    const result = await buildSourceCvApplicationComposition({
      mode: "auto_recommended",
      callerUserId: "user-owner",
      applicationContext: applicationContext(),
      sourceCv: document,
      sourceDocumentId: "candidate-source-document:source-cv-1",
      demands: demands(),
      authorizedCvItemReferenceIds: [experienceReferenceId(document)],
      careerKnowledgeRules: [],
      createdAt: T,
      updatedAt: T,
    });

    expect(result.mode).toBe("auto_recommended");
    if (result.mode !== "auto_recommended") {
      throw new Error("Expected automatic composition");
    }
    expect(result.candidateFacts).toHaveLength(1);
    expect(result.cvItemReferences).toHaveLength(1);
    const includedItems = result.plan.items.filter(
      (item) => item.action === "include",
    );
    expect(includedItems.length).toBeGreaterThan(0);
    expect(
      includedItems.every(
        (item) =>
          item.reviewState === "pending" &&
          item.sourceCvItemReferenceIds?.[0] === experienceReferenceId(document),
      ),
    ).toBe(true);
    expect(
      result.candidateFacts.some((fact) =>
        fact.normalizedText.toLocaleLowerCase().includes("typescript"),
      ),
    ).toBe(false);
    expect(JSON.stringify(document)).toBe(snapshot);
  });

  it("keeps the automatic result stable across source section and demand reorder", async () => {
    const firstDocument = sourceCv();
    const secondDocument = sourceCv(true);
    const first = await buildSourceCvApplicationComposition({
      callerUserId: "user-owner",
      applicationContext: applicationContext(),
      sourceCv: firstDocument,
      sourceDocumentId: "candidate-source-document:source-cv-1",
      demands: demands(),
      authorizedCvItemReferenceIds: [experienceReferenceId(firstDocument)],
      careerKnowledgeRules: [],
      createdAt: T,
      updatedAt: T,
    });
    const second = await buildSourceCvApplicationComposition({
      callerUserId: "user-owner",
      applicationContext: applicationContext(),
      sourceCv: secondDocument,
      sourceDocumentId: "candidate-source-document:source-cv-1",
      demands: [...demands()].reverse(),
      authorizedCvItemReferenceIds: [experienceReferenceId(secondDocument)],
      careerKnowledgeRules: [],
      createdAt: T,
      updatedAt: T,
    });

    expect(first.mode).toBe("auto_recommended");
    expect(second.mode).toBe("auto_recommended");
    if (first.mode !== "auto_recommended" || second.mode !== "auto_recommended") {
      throw new Error("Expected automatic compositions");
    }
    expect(second.candidateFacts).toEqual(first.candidateFacts);
    expect(second.plan.items).toEqual(first.plan.items);
  });

  it("rejects unknown authorization and keeps full_source_cv as an immutable pass-through", async () => {
    const document = sourceCv();
    const snapshot = JSON.stringify(document);

    await expect(
      buildSourceCvApplicationComposition({
        callerUserId: "user-owner",
        applicationContext: applicationContext(),
        sourceCv: document,
        sourceDocumentId: "candidate-source-document:source-cv-1",
        demands: demands(),
        authorizedCvItemReferenceIds: ["candidate-cv-item:unknown"],
        careerKnowledgeRules: [],
        createdAt: T,
        updatedAt: T,
      }),
    ).rejects.toThrow(/unknown.*reference/i);

    await expect(
      buildSourceCvApplicationComposition({
        mode: "full_source_cv",
        callerUserId: "user-owner",
        applicationContext: applicationContext(),
        sourceCv: document,
      }),
    ).resolves.toEqual({
      mode: "full_source_cv",
      userId: "user-owner",
      applicationContextId: "application-context:job-source-cv",
      sourceCvId: "cv-source-1",
      sourceCvContextHash: "candidate-hash",
      plan: null,
    });
    expect(JSON.stringify(document)).toBe(snapshot);
  });

  it("does not authorize facts implicitly and rejects a context bound to another CV", async () => {
    const document = sourceCv();
    const empty = await buildSourceCvApplicationComposition({
      callerUserId: "user-owner",
      applicationContext: applicationContext(),
      sourceCv: document,
      sourceDocumentId: "candidate-source-document:source-cv-1",
      demands: demands(),
      authorizedCvItemReferenceIds: [],
      careerKnowledgeRules: [],
      createdAt: T,
      updatedAt: T,
    });

    expect(empty.mode).toBe("auto_recommended");
    if (empty.mode !== "auto_recommended") {
      throw new Error("Expected automatic composition");
    }
    expect(empty.candidateFacts).toEqual([]);
    expect(empty.plan.items.some((item) => item.action === "include")).toBe(
      false,
    );

    await expect(
      buildSourceCvApplicationComposition({
        callerUserId: "user-owner",
        applicationContext: {
          ...applicationContext(),
          candidate: {
            sourceKind: "cv",
            cvId: "other-cv",
            candidateHash: "other-candidate-hash",
          },
        },
        sourceCv: document,
        sourceDocumentId: "candidate-source-document:source-cv-1",
        demands: demands(),
        authorizedCvItemReferenceIds: [experienceReferenceId(document)],
        careerKnowledgeRules: [],
        createdAt: T,
        updatedAt: T,
      }),
    ).rejects.toThrow(/source CV.*application context/i);

    await expect(
      buildSourceCvApplicationComposition({
        callerUserId: "other-user",
        applicationContext: applicationContext(),
        sourceCv: document,
        sourceDocumentId: "candidate-source-document:source-cv-1",
        demands: demands(),
        authorizedCvItemReferenceIds: [experienceReferenceId(document)],
        careerKnowledgeRules: [],
        createdAt: T,
        updatedAt: T,
      }),
    ).rejects.toThrow(/caller.*user/i);
  });
});
