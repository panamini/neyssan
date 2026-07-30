import { describe, expect, it } from "vitest";

import type { ApplicationContextV1 } from "../../application-harness/schema";
import {
  buildReviewableCandidateCvItemReferences,
} from "../../candidate-evidence/cvItemReferences";
import type { ResumeVariantPlanV1 } from "../../resume-variant-plan/schema";
import type { CvDocument } from "../../../types/cvDocument";
import { materializeSourceCvVariant } from "../materializeSourceCvVariant";

const T = Date.UTC(2026, 6, 30);

function sourceCv(): CvDocument {
  return {
    id: "cv-source",
    title: "Canonical CV",
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      version: 7,
      locale: "en",
    },
    tags: ["canonical"],
    summary: "Top-level summary stays unchanged.",
    sections: [
      {
        id: "profile",
        title: "Profile",
        type: "profile",
        blocks: [{ id: "profile-block", type: "text", content: "Profile" }],
        structuredContent: [{ id: "profile-item", name: "Owner" }],
      },
      {
        id: "experience",
        title: "Experience",
        type: "experience",
        blocks: [
          { id: "experience-fallback", type: "text", content: "Must not leak" },
        ],
        structuredContent: [
          {
            id: "experience-keep",
            company: "Bakery One",
            position: "Sales associate",
            startDate: "2024-01-01",
          },
          {
            id: "experience-drop",
            company: "Warehouse Two",
            position: "Picker",
            startDate: "2022-01-01",
          },
        ],
      },
      {
        id: "education",
        title: "Education",
        type: "education",
        blocks: [
          { id: "education-fallback", type: "text", content: "Must not leak" },
        ],
        structuredContent: [
          {
            id: "education-keep",
            institution: "School Two",
            degree: "Diploma",
          },
          {
            id: "education-drop",
            institution: "School One",
            degree: "Certificate",
          },
        ],
      },
      {
        id: "skills",
        title: "Skills",
        type: "skills",
        blocks: [
          { id: "skills-fallback", type: "text", content: "Must not leak" },
        ],
        structuredContent: [
          { id: "skill-drop", name: "Forklift", level: "Advanced" },
          { id: "skill-keep", name: "Customer service", level: "Advanced" },
        ],
      },
      {
        id: "languages",
        title: "Languages",
        type: "languages",
        blocks: [{ id: "language-block", type: "text", content: "English" }],
        structuredContent: [
          { id: "language-en", name: "English", level: "Fluent" },
        ],
      },
    ],
  };
}

function applicationContext(): ApplicationContextV1 {
  return {
    id: "application-context:one",
    userId: "profile-owner",
    job: {
      jobId: "job-one",
      title: "Bakery sales associate",
      rawTextHash: "raw-job-hash",
      jobBriefHash: "job-brief-hash",
    },
    candidate: {
      sourceKind: "cv",
      cvId: "cv-source",
      candidateHash: "source-cv-context-hash",
    },
    settingsHash: "settings-hash",
    contextHash: "application-context-hash",
    reviewState: "draft",
    sourceRefs: [],
    createdAt: T,
    updatedAt: T,
    version: 1,
  };
}

function reviewedPlan(
  document: CvDocument,
  acceptedItemIds: readonly string[],
): ResumeVariantPlanV1 {
  const accepted = new Set(acceptedItemIds);
  const references = buildReviewableCandidateCvItemReferences(document);
  return {
    id: "resume-variant-plan:reviewed-one",
    userId: "profile-owner",
    applicationContextId: "application-context:one",
    evidenceGraphId: "evidence-graph:one",
    evidenceGraphHash: "evidence-graph-hash",
    targetDocumentKind: "cv",
    sourceCvId: document.id,
    items: references.map((reference) => ({
      id: `plan-item:${reference.id}`,
      section:
        reference.sectionType === "skill"
          ? "skills"
          : reference.sectionType,
      action: "include",
      priority: "recommended",
      reviewState: accepted.has(reference.itemId)
        ? "accepted"
        : "rejected",
      sourceCvItemReferenceIds: [reference.id],
      allowedClaimIds: [],
      candidateFactIds: [],
      evidenceMatchIds: [],
      demandIds: [],
      riskFlagIds: [],
      reason: "Deterministic source CV selection.",
      version: 1,
    })),
    warnings: [],
    blockedClaimIds: [],
    sourceFactIds: [],
    allowedClaimIds: [],
    riskFlagIds: [],
    blocked: false,
    createdAt: T,
    updatedAt: T,
    version: 1,
  };
}

describe("materializeSourceCvVariant", () => {
  it("keeps accepted canonical items in source order and preserves non-planifiable sections", async () => {
    const source = sourceCv();
    const sourceBefore = structuredClone(source);
    const result = await materializeSourceCvVariant({
      applicationContext: applicationContext(),
      sourceCv: source,
      reviewedPlan: reviewedPlan(source, [
        "experience-keep",
        "education-keep",
        "skill-keep",
      ]),
    });

    expect(result.document.sections.map((section) => section.id)).toEqual([
      "profile",
      "experience",
      "education",
      "skills",
      "languages",
    ]);
    expect(result.document.sections[0]).toEqual(source.sections[0]);
    expect(result.document.sections[4]).toEqual(source.sections[4]);
    expect(result.document.sections[1]).toMatchObject({
      id: "experience",
      blocks: [],
      structuredContent: [{ id: "experience-keep" }],
    });
    expect(result.document.sections[2]).toMatchObject({
      id: "education",
      blocks: [],
      structuredContent: [{ id: "education-keep" }],
    });
    expect(result.document.sections[3]).toMatchObject({
      id: "skills",
      blocks: [],
      structuredContent: [{ id: "skill-keep" }],
    });
    expect(JSON.stringify(result.document)).not.toContain("experience-drop");
    expect(JSON.stringify(result.document)).not.toContain("skill-drop");
    expect(JSON.stringify(result.document)).not.toContain("education-drop");
    expect(JSON.stringify(result.document)).not.toContain("Must not leak");
    expect(source).toEqual(sourceBefore);
  });

  it("resolves stable references after source reordering and repeats deterministically", async () => {
    const reordered = sourceCv();
    reordered.sections = [
      reordered.sections[4],
      reordered.sections[3],
      reordered.sections[1],
      reordered.sections[0],
      reordered.sections[2],
    ];
    const skills = reordered.sections[1].structuredContent;
    if (!Array.isArray(skills)) {
      throw new Error("Expected skills");
    }
    reordered.sections[1].structuredContent = [...skills].reverse() as typeof skills;
    const input = {
      applicationContext: applicationContext(),
      sourceCv: reordered,
      reviewedPlan: reviewedPlan(reordered, [
        "experience-keep",
        "skill-keep",
      ]),
    };

    const first = await materializeSourceCvVariant(input);
    const second = await materializeSourceCvVariant(input);

    expect(first).toEqual(second);
    expect(first.id).toMatch(/^source-cv-variant:v1:/);
    expect(first.document.id).toBe(first.id);
    expect(first.document.sections.map((section) => section.id)).toEqual([
      "languages",
      "skills",
      "experience",
      "profile",
    ]);
    expect(first.document.sections[1].structuredContent).toEqual([
      expect.objectContaining({ id: "skill-keep" }),
    ]);
    expect(first.document.metadata.reviewedSourceCvVariant).toEqual({
      kind: "reviewed_source_cv_variant",
      sourceCvId: "cv-source",
      jobId: "job-one",
      applicationContextId: "application-context:one",
      applicationContextHash: "application-context-hash",
      reviewedPlanId: "resume-variant-plan:reviewed-one",
      version: 1,
    });
  });

  it("removes empty filtered sections and clears fallback blocks on retained filtered sections", async () => {
    const source = sourceCv();
    const result = await materializeSourceCvVariant({
      applicationContext: applicationContext(),
      sourceCv: source,
      reviewedPlan: reviewedPlan(source, ["experience-keep"]),
    });

    expect(
      result.document.sections.some(
        (section) => section.type === "education",
      ),
    ).toBe(false);
    expect(
      result.document.sections.some((section) => section.type === "skills"),
    ).toBe(false);
    expect(
      result.document.sections.find(
        (section) => section.type === "experience",
      )?.blocks,
    ).toEqual([]);
  });
});
