import { describe, expect, it } from "vitest";

import {
  STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES,
  buildStructuredMatchReviewReadout,
  type StructuredMatchReviewCase,
  type StructuredMatchReviewCategory,
} from "../structuredMatchReview";

function reviewCase(
  caseId: string,
  category: StructuredMatchReviewCategory,
  overrides: Partial<StructuredMatchReviewCase> = {},
): StructuredMatchReviewCase {
  return {
    caseId,
    category,
    labels: ["good"],
    structuredTier: category === "negative_control" ? "weak" : "strong",
    structuredScore: category === "negative_control" ? 20 : 92,
    productionTier: category === "negative_control" ? "weak" : "partial",
    productionScore: category === "negative_control" ? 12 : 55,
    productionScoreChanged: false,
    matchedCount: category === "negative_control" ? 0 : 3,
    partialCount: 0,
    missingCount: 0,
    unknownCount: category === "negative_control" ? 3 : 0,
    metadataLeakCount: 0,
    languagePreserved: true,
    ...overrides,
  };
}

function completeThirtyCaseReviewSet(): StructuredMatchReviewCase[] {
  const cases: StructuredMatchReviewCase[] = [];

  for (const category of STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES) {
    cases.push(reviewCase(`${category}_0`, category));
  }

  let index = 0;
  while (cases.length < 30) {
    const category =
      STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES[
        index % STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES.length
      ]!;
    cases.push(reviewCase(`${category}_${index + 1}`, category));
    index += 1;
  }

  return cases;
}

describe("structured match internal beta review readout", () => {
  it("blocks broader rollout until at least thirty reviewed cases cover every required category", () => {
    const readout = buildStructuredMatchReviewReadout([
      reviewCase("security_0", "security_licensed"),
      reviewCase("retail_0", "retail_service"),
      reviewCase("negative_0", "negative_control"),
    ]);

    expect(readout.reviewedCaseCount).toBe(3);
    expect(readout.coverageByCategory.security_licensed).toBe(1);
    expect(readout.coverageByCategory.negative_control).toBe(1);
    expect(readout.missingCategories).toEqual(
      expect.arrayContaining([
        "admin_office",
        "technical",
        "healthcare_regulated",
        "multilingual",
        "short_noisy_scrape",
        "long_duplicated_scrape",
      ]),
    );
    expect(readout.rolloutGate).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        "reviewed case count 3 is below 30",
        expect.stringContaining("missing required coverage"),
      ]),
    });
    expect(readout.recommendedNextActions).toEqual(
      expect.arrayContaining(["add fixtures"]),
    );
  });

  it("treats blocker labels as rollout blockers and records required readout examples", () => {
    const cases = completeThirtyCaseReviewSet();
    cases[0] = reviewCase("false_strong_security", "security_licensed", {
      labels: ["overmatched"],
      structuredTier: "strong",
      structuredScore: 94,
      note: "Security license was inferred from generic safety language.",
    });
    cases[1] = reviewCase("metadata_leak_retail", "retail_service", {
      labels: ["metadata leak"],
      metadataLeakCount: 1,
      structuredTier: "partial",
      structuredScore: 58,
    });
    cases[2] = reviewCase("language_issue_fr", "multilingual", {
      labels: ["language issue"],
      languagePreserved: false,
      structuredTier: "partial",
      structuredScore: 62,
    });
    cases[3] = reviewCase("hard_gate_healthcare", "healthcare_regulated", {
      labels: ["hard-gate issue"],
      structuredTier: "strong",
      structuredScore: 91,
    });

    const readout = buildStructuredMatchReviewReadout(cases);

    expect(readout.labelCounts.overmatched).toBe(1);
    expect(readout.labelCounts["metadata leak"]).toBe(1);
    expect(readout.labelCounts["language issue"]).toBe(1);
    expect(readout.labelCounts["hard-gate issue"]).toBe(1);
    expect(readout.blockerLabelCounts).toMatchObject({
      overmatched: 1,
      "metadata leak": 1,
      "language issue": 1,
      "hard-gate issue": 1,
    });
    expect(readout.examples.falseStrong).toEqual([
      expect.objectContaining({
        caseId: "false_strong_security",
        note: "Security license was inferred from generic safety language.",
      }),
    ]);
    expect(readout.rolloutGate.status).toBe("blocked");
    expect(readout.rolloutGate.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("blocker labels present")]),
    );
    expect(readout.recommendedNextActions).toEqual(
      expect.arrayContaining(["hold rollout"]),
    );
  });

  it("flags calibration failures without treating conservative labels as blockers", () => {
    const cases = completeThirtyCaseReviewSet();
    cases[0] = reviewCase("false_weak_admin", "admin_office", {
      labels: ["undermatched"],
      structuredTier: "weak",
      structuredScore: 28,
      matchedCount: 1,
      unknownCount: 2,
    });
    cases[1] = reviewCase("missing_evidence_technical", "technical", {
      labels: ["evidence missing"],
      structuredTier: "partial",
      structuredScore: 55,
      matchedCount: 1,
      partialCount: 1,
      unknownCount: 2,
      note: "React requirement was extracted correctly but ignored project evidence.",
    });
    cases[2] = reviewCase("conservative_healthcare", "healthcare_regulated", {
      labels: ["acceptable but conservative"],
      structuredTier: "partial",
      structuredScore: 66,
      matchedCount: 2,
      partialCount: 1,
      unknownCount: 0,
    });

    const readout = buildStructuredMatchReviewReadout(cases);

    expect(readout.blockerLabelCounts).toEqual({});
    expect(readout.examples.falseWeak).toEqual([
      expect.objectContaining({ caseId: "false_weak_admin" }),
    ]);
    expect(readout.examples.extractionCorrectEvidenceFailed).toEqual([
      expect.objectContaining({ caseId: "missing_evidence_technical" }),
    ]);
    expect(readout.examples.evidenceCorrectTierWrong).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ caseId: "false_weak_admin" }),
        expect.objectContaining({ caseId: "conservative_healthcare" }),
      ]),
    );
    expect(readout.rolloutGate.status).toBe("blocked");
    expect(readout.rolloutGate.reasons).toEqual(
      expect.arrayContaining(["high unknown counts produced overconfident scores"]),
    );
    expect(readout.recommendedNextActions).toEqual(
      expect.arrayContaining(["tune tier gates", "tune evidence matching"]),
    );
  });

  it("passes the rollout gate only when the reviewed set satisfies every beta condition", () => {
    const readout = buildStructuredMatchReviewReadout(completeThirtyCaseReviewSet());

    expect(readout.reviewedCaseCount).toBe(30);
    expect(readout.missingCategories).toEqual([]);
    expect(readout.labelCounts.good).toBe(30);
    expect(readout.rolloutGate).toEqual({
      status: "ready",
      reasons: [],
    });
    expect(readout.recommendedNextActions).toEqual([]);
  });
});

