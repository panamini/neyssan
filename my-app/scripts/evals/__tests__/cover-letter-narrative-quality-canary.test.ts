import { describe, expect, it } from "vitest";

import type { CoverLetterBodyParts } from "../../../convex/lib/proposals/premiumCoverLetter";
import {
  QUALITY_CL3_SOURCE_CANARY_HASH,
  buildCoverLetterNarrativeQualityCanary,
  evaluateCoverLetterNarrativeQuality,
} from "../cover-letter-narrative-quality-canary";
import type { CoverLetterStructureAwareFinalizerCanary } from "../cover-letter-structure-aware-finalizer-canary";

const narrativeRedBodyParts: CoverLetterBodyParts = {
  opening:
    "Improved 90-day retention by 18% by redesigning onboarding checkpoints.",
  proofBlock:
    "I improved 90-day retention by 18% while managing enterprise accounts and onboarding.",
  employerValueBlock:
    "This combination would help your team strengthen onboarding and account health.",
  closeLine:
    "I would bring retention, onboarding, and account management to your team.",
};

const cleanBodyParts: CoverLetterBodyParts = {
  opening:
    "Your focus on durable customer relationships matches the work I have chosen to build my career around.",
  proofBlock:
    "At Lumio Health, I improved 90-day retention by 18% by redesigning onboarding checkpoints.",
  employerValueBlock:
    "For Lumio Health's enterprise portfolio, that discipline kept account risks visible before quarterly reviews.",
  closeLine:
    "I would welcome a conversation about the outcomes your customer success team wants to improve next.",
};

function renderBodyParts(bodyParts: CoverLetterBodyParts): string {
  return [
    "Dear Hiring Manager,",
    bodyParts.opening,
    bodyParts.proofBlock,
    bodyParts.employerValueBlock,
    bodyParts.closeLine,
    "Best regards,\nPriya Sharma",
  ].join("\n\n");
}

function buildPinnedSourceCanary(
  bodyParts: CoverLetterBodyParts,
): CoverLetterStructureAwareFinalizerCanary {
  const content = renderBodyParts(bodyParts);
  const entries = Array.from({ length: 5 }, (_, index) => ({
    pairLabel: `PAIR-00${index + 1}`,
    sourceCellLabel: `CL-00${index + 1}`,
    outputLanguage: "English" as const,
    job: {
      title: "Customer Success Manager",
      description:
        "Own account health, onboarding, quarterly reviews, retention, and expansion.",
    },
    profileEvidence: { name: "Priya Sharma" },
    currentFinalizer: {
      content,
      sendability: {
        verdict: "HARD_BLOCKED",
      },
    },
    structureAwareCanary: {
      content,
      sendability: {
        verdict: "REVIEW_REQUIRED",
        hardIssues: [],
      },
      trustedStructuredSectionTextPreserved: true,
      providerCalls: 0,
      retries: 0,
      repairs: 0,
    },
    trustedStructuredSectionTextPreserved: true,
  }));

  return {
    version: "cover_letter_structure_aware_finalizer_canary_v1",
    inputScope: "reviewer_safe_public_packs_only",
    sourceQualitativePackHash:
      "2406c5e85f6bf5c9779180f86939cb3e14448da7e022b33c9aae85144bc06eae",
    sourceFinalArtifactPackHash:
      "4bf698ea8166e721dc3c7e12b47b95e921f936cf6c4815878bebd08384ac8894",
    sourceRef: "07b2c3e136f4d9062dd28c90a22afbe257e68778",
    caseId: "blind-en-clean-engaging-direct",
    providerCalls: 0,
    retries: 0,
    repairs: 0,
    entries,
    summary: {
      totalPairs: 5,
      trustedStructuredSectionTextPreservedCandidates: 5,
      baselineHardBlocked: 5,
      candidateHardBlocked: 0,
      candidateReviewRequired: 5,
      candidatePremiumReady: 0,
    },
    canaryHash: QUALITY_CL3_SOURCE_CANARY_HASH,
  } as unknown as CoverLetterStructureAwareFinalizerCanary;
}

describe("QUALITY-CL-3 narrative-quality canary", () => {
  it("classifies only the narrative defects observed in the frozen development cohort", () => {
    expect(evaluateCoverLetterNarrativeQuality(narrativeRedBodyParts)).toEqual({
      version: "cover_letter_narrative_quality_result_v1",
      inputScope: "trusted_four_section_body_parts_only",
      issues: [
        "proof_led_opening",
        "cross_section_evidence_repetition",
        "formulaic_employer_transition",
        "redundant_close",
      ],
      diagnostics: {
        repeatedEvidenceMarkerCount: 2,
        closeSharedContentTokenCount: 4,
      },
    });
  });

  it("does not reward a natural four-section control mechanically", () => {
    expect(evaluateCoverLetterNarrativeQuality(cleanBodyParts).issues).toEqual(
      [],
    );
  });

  it("builds a zero-call canary anchored to the exact CL2 replay", async () => {
    const canary = await buildCoverLetterNarrativeQualityCanary({
      sourceCanary: buildPinnedSourceCanary(narrativeRedBodyParts),
    });

    expect(canary.providerCalls).toBe(0);
    expect(canary.retries).toBe(0);
    expect(canary.repairs).toBe(0);
    expect(canary.sourceCanaryHash).toBe(QUALITY_CL3_SOURCE_CANARY_HASH);
    expect(canary.summary).toEqual({
      totalCandidates: 5,
      trustedStructuredSectionTextPreservedCandidates: 5,
      hardBlockedCandidates: 0,
      candidatesWithNarrativeIssues: 5,
      issueCounts: {
        proof_led_opening: 5,
        cross_section_evidence_repetition: 5,
        formulaic_employer_transition: 5,
        redundant_close: 5,
      },
      nextStep: "RUN_HELD_OUT_HUMAN_REVIEW_BEFORE_PRODUCTION",
    });
    expect(canary.entries.every((entry) => entry.candidateContentHash)).toBe(
      true,
    );
  });

  it("fails closed when the CL2 replay hash drifts", async () => {
    const sourceCanary = {
      ...buildPinnedSourceCanary(narrativeRedBodyParts),
      canaryHash: "0".repeat(64),
    };

    await expect(
      buildCoverLetterNarrativeQualityCanary({ sourceCanary }),
    ).rejects.toThrow(/exact frozen CL2 canary/iu);
  });
});
