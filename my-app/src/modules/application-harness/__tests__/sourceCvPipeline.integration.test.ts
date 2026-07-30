import { describe, expect, it } from "vitest";

import { buildJobDemandsFromCanonicalJobBrief } from "../../../../convex/lib/jobs/jobBriefDemands";
import { buildApplicationPackage } from "../../application-package/buildApplicationPackage";
import { buildCandidateCvItemReferences } from "../../candidate-evidence/cvItemReferences";
import { buildCoverLetterArtifact } from "../../cover-letter-artifact/buildCoverLetterArtifact";
import { buildResumeVariantArtifact } from "../../resume-variant-artifact/buildResumeVariantArtifact";
import { reviewResumeVariantPlan } from "../../resume-variant-plan/reviewResumeVariantPlan";
import { buildReviewCockpit } from "../../review-cockpit/buildReviewCockpit";
import type { CvDocument } from "../../../types/cvDocument";
import type { ApplicationContextV1 } from "../schema";
import { buildSourceCvApplicationComposition } from "../sourceCvApplicationComposition";

const T = Date.UTC(2026, 6, 29);
const USER_ID = "user-owner";
const APPLICATION_CONTEXT_ID = "application-context:job-source-cv";

function sourceCv(): CvDocument {
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
            startDate: "2024-01-01",
            responsibilityBullets: [
              "Customer service",
              "Operate the checkout",
            ],
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

function applicationContext(): ApplicationContextV1 {
  return {
    id: APPLICATION_CONTEXT_ID,
    userId: USER_ID,
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

describe("source CV pipeline integration", () => {
  it("keeps rejected CV evidence out while carrying accepted stable evidence through the application package", async () => {
    const document = sourceCv();
    const sourceSnapshot = JSON.stringify(document);
    const references = buildCandidateCvItemReferences(document);
    const demands = await buildJobDemandsFromCanonicalJobBrief({
      jobId: "job-bakery-1",
      mustHaves: ["Customer service", "Operate the checkout"],
    });
    const composition = await buildSourceCvApplicationComposition({
      mode: "auto_recommended",
      callerUserId: "user-owner",
      applicationContext: applicationContext(),
      sourceCv: document,
      sourceDocumentId: "candidate-source-document:source-cv-1",
      demands,
      authorizedCvItemReferenceIds: references.map(
        (reference) => reference.id,
      ),
      careerKnowledgeRules: [],
      createdAt: T,
      updatedAt: T,
    });

    expect(composition.mode).toBe("auto_recommended");
    if (composition.mode !== "auto_recommended") {
      throw new Error("Expected automatic composition");
    }
    expect(composition.plan.items.length).toBeGreaterThanOrEqual(2);
    expect(
      composition.plan.items.every(
        (item) =>
          item.action === "include" &&
          item.reviewState === "pending" &&
          item.sourceCvItemReferenceIds?.length === 1,
      ),
    ).toBe(true);

    const distinctFactIds = [
      ...new Set(
        composition.plan.items.flatMap((item) => item.candidateFactIds),
      ),
    ];
    expect(distinctFactIds.length).toBeGreaterThanOrEqual(2);
    const rejectedFactId = distinctFactIds[1]!;
    const acceptedFactId = distinctFactIds[0]!;
    const evidenceGraph = composition.evidenceGraph;
    const reviewedPlan = await reviewResumeVariantPlan({
      userId: USER_ID,
      applicationContextId: APPLICATION_CONTEXT_ID,
      expectedPlanId: composition.plan.id,
      plan: composition.plan,
      decisions: composition.plan.items.map((item) => ({
        planItemId: item.id,
        reviewState: item.candidateFactIds.includes(rejectedFactId)
          ? ("rejected" as const)
          : ("accepted" as const),
      })),
      updatedAt: T + 1,
    });
    expect(
      reviewedPlan.items
        .filter((item) => item.candidateFactIds.includes(rejectedFactId))
        .map((item) => item.reviewState),
    ).toEqual(
      reviewedPlan.items
        .filter((item) => item.candidateFactIds.includes(rejectedFactId))
        .map(() => "rejected"),
    );
    const reviewCockpit = await buildReviewCockpit({
      userId: USER_ID,
      applicationContextId: APPLICATION_CONTEXT_ID,
      evidenceGraph,
      resumeVariantPlan: reviewedPlan,
      createdAt: T + 1,
    });
    const resumeArtifact = await buildResumeVariantArtifact({
      userId: USER_ID,
      applicationContextId: APPLICATION_CONTEXT_ID,
      targetDocumentKind: "cv",
      evidenceGraph,
      resumeVariantPlan: reviewedPlan,
      reviewCockpit,
      createdAt: T + 1,
      updatedAt: T + 1,
    });
    const coverLetterArtifact = await buildCoverLetterArtifact({
      userId: USER_ID,
      applicationContextId: APPLICATION_CONTEXT_ID,
      resumeVariantArtifact: resumeArtifact,
      sourceText: "",
      sourceKind: "unknown",
      format: "plain_text",
      createdAt: T + 1,
      updatedAt: T + 1,
    });
    const applicationPackage = await buildApplicationPackage({
      userId: USER_ID,
      applicationContextId: APPLICATION_CONTEXT_ID,
      resumeVariantArtifact: resumeArtifact,
      coverLetterArtifact,
      createdAt: T + 1,
      updatedAt: T + 1,
    });

    expect(reviewCockpit.summary.status).toBe("ready");
    expect(resumeArtifact.status).toBe("ready_for_generation");
    expect(resumeArtifact.provenance.sourceFactIds).toContain(acceptedFactId);
    expect(resumeArtifact.provenance.sourceFactIds).not.toContain(
      rejectedFactId,
    );
    expect(applicationPackage.provenance.sourceFactIds).toEqual(
      resumeArtifact.provenance.sourceFactIds,
    );
    expect(applicationPackage.provenance.sourceFactIds).not.toContain(
      rejectedFactId,
    );
    expect(coverLetterArtifact.text.value).toBe("");
    expect(JSON.stringify(document)).toBe(sourceSnapshot);
  });
});
