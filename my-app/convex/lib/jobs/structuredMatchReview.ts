import type { MatchReadTier } from "./matchRead";

export const STRUCTURED_MATCH_REVIEW_SCORER_VERSION =
  "structured-match-read-shadow-v1";

export const STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES = [
  "security_licensed",
  "retail_service",
  "admin_office",
  "technical",
  "healthcare_regulated",
  "multilingual",
  "short_noisy_scrape",
  "long_duplicated_scrape",
  "negative_control",
] as const;

export type StructuredMatchReviewCategory =
  (typeof STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES)[number];

export const STRUCTURED_MATCH_REVIEW_LABELS = [
  "good",
  "acceptable but conservative",
  "false weak",
  "false strong",
  "overmatched",
  "undermatched",
  "metadata leak",
  "evidence missing",
  "language issue",
  "hard-gate issue",
] as const;

export type StructuredMatchReviewLabel =
  (typeof STRUCTURED_MATCH_REVIEW_LABELS)[number];

export const STRUCTURED_MATCH_REVIEW_BLOCKER_LABELS = [
  "overmatched",
  "metadata leak",
  "language issue",
  "hard-gate issue",
] as const satisfies readonly StructuredMatchReviewLabel[];

export type StructuredMatchReviewExampleKind =
  | "falseStrong"
  | "falseWeak"
  | "overconfidentPartial"
  | "extractionCorrectEvidenceFailed"
  | "evidenceCorrectTierWrong";

export type StructuredMatchRecommendedNextAction =
  | "add fixtures"
  | "tune extraction semantics"
  | "tune evidence matching"
  | "tune tier gates"
  | "hold rollout";

export type StructuredMatchReviewCase = {
  caseId: string;
  category: StructuredMatchReviewCategory;
  labels: StructuredMatchReviewLabel[];
  structuredTier: MatchReadTier | null;
  structuredScore: number | null;
  productionTier: MatchReadTier | null;
  productionScore: number | null;
  productionScoreChanged?: boolean;
  appGitCommitSha?: string;
  structuredScorerVersion?: string;
  extractionModel?: string;
  extractionPromptVersion?: string;
  reviewedAt?: number;
  matchedCount: number;
  partialCount: number;
  missingCount: number;
  unknownCount: number;
  metadataLeakCount: number;
  languagePreserved: boolean;
  strongMatchedEvidenceCount?: number;
  exampleKinds?: StructuredMatchReviewExampleKind[];
  note?: string;
};

export type StructuredMatchReviewExample = {
  caseId: string;
  category: StructuredMatchReviewCategory;
  labels: StructuredMatchReviewLabel[];
  structuredTier: MatchReadTier | null;
  structuredScore: number | null;
  note?: string;
};

export type StructuredMatchReviewReadout = {
  reviewedCaseCount: number;
  coverageByCategory: Record<StructuredMatchReviewCategory, number>;
  missingCategories: StructuredMatchReviewCategory[];
  labelCounts: Record<StructuredMatchReviewLabel, number>;
  blockerLabelCounts: Partial<Record<StructuredMatchReviewLabel, number>>;
  examples: Record<StructuredMatchReviewExampleKind, StructuredMatchReviewExample[]>;
  rolloutGate: {
    status: "ready" | "blocked";
    reasons: string[];
  };
  recommendedNextActions: StructuredMatchRecommendedNextAction[];
};

const REQUIRED_REVIEW_CASE_COUNT = 30;
const RECURRING_FAILURE_COUNT = 2;
const MAX_EXAMPLES_PER_KIND = 5;

const BLOCKER_LABEL_SET = new Set<StructuredMatchReviewLabel>(
  STRUCTURED_MATCH_REVIEW_BLOCKER_LABELS,
);

function emptyCoverage(): Record<StructuredMatchReviewCategory, number> {
  return Object.fromEntries(
    STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES.map((category) => [category, 0]),
  ) as Record<StructuredMatchReviewCategory, number>;
}

function emptyLabelCounts(): Record<StructuredMatchReviewLabel, number> {
  return Object.fromEntries(
    STRUCTURED_MATCH_REVIEW_LABELS.map((label) => [label, 0]),
  ) as Record<StructuredMatchReviewLabel, number>;
}

function emptyExamples(): Record<StructuredMatchReviewExampleKind, StructuredMatchReviewExample[]> {
  return {
    falseStrong: [],
    falseWeak: [],
    overconfidentPartial: [],
    extractionCorrectEvidenceFailed: [],
    evidenceCorrectTierWrong: [],
  };
}

function addExample(
  examples: Record<StructuredMatchReviewExampleKind, StructuredMatchReviewExample[]>,
  kind: StructuredMatchReviewExampleKind,
  reviewCase: StructuredMatchReviewCase,
) {
  if (examples[kind].length >= MAX_EXAMPLES_PER_KIND) {
    return;
  }

  examples[kind].push({
    caseId: reviewCase.caseId,
    category: reviewCase.category,
    labels: reviewCase.labels,
    structuredTier: reviewCase.structuredTier,
    structuredScore: reviewCase.structuredScore,
    ...(reviewCase.note ? { note: reviewCase.note } : {}),
  });
}

function hasHighUnknownPressure(reviewCase: StructuredMatchReviewCase): boolean {
  const evidenceBearingCount = reviewCase.matchedCount + reviewCase.partialCount;
  return reviewCase.unknownCount > 0 && reviewCase.unknownCount >= evidenceBearingCount;
}

function hasMeaningfulStrongEvidence(reviewCase: StructuredMatchReviewCase): boolean {
  if (reviewCase.structuredTier !== "strong") {
    return true;
  }

  const matchedEvidenceCount =
    reviewCase.strongMatchedEvidenceCount ?? reviewCase.matchedCount;
  return matchedEvidenceCount >= 2 && !hasHighUnknownPressure(reviewCase);
}

function uniqueActions(
  actions: StructuredMatchRecommendedNextAction[],
): StructuredMatchRecommendedNextAction[] {
  return [...new Set(actions)];
}

export function buildStructuredMatchReviewReadout(
  reviewCases: StructuredMatchReviewCase[],
): StructuredMatchReviewReadout {
  const coverageByCategory = emptyCoverage();
  const labelCounts = emptyLabelCounts();
  const blockerLabelCounts: Partial<Record<StructuredMatchReviewLabel, number>> = {};
  const examples = emptyExamples();
  const gateReasons: string[] = [];
  const recommendedActions: StructuredMatchRecommendedNextAction[] = [];

  for (const reviewCase of reviewCases) {
    coverageByCategory[reviewCase.category] += 1;

    for (const label of reviewCase.labels) {
      labelCounts[label] += 1;
      if (BLOCKER_LABEL_SET.has(label)) {
        blockerLabelCounts[label] = (blockerLabelCounts[label] ?? 0) + 1;
      }
    }

    for (const kind of reviewCase.exampleKinds ?? []) {
      addExample(examples, kind, reviewCase);
    }

    if (
      reviewCase.structuredTier === "strong" &&
      reviewCase.labels.includes("overmatched")
    ) {
      addExample(examples, "falseStrong", reviewCase);
    }
    if (
      reviewCase.structuredTier === "weak" &&
      reviewCase.labels.includes("undermatched")
    ) {
      addExample(examples, "falseWeak", reviewCase);
    }
    if (
      reviewCase.structuredTier === "partial" &&
      hasHighUnknownPressure(reviewCase)
    ) {
      addExample(examples, "overconfidentPartial", reviewCase);
    }
    if (reviewCase.labels.includes("evidence missing")) {
      addExample(examples, "extractionCorrectEvidenceFailed", reviewCase);
    }
    if (
      reviewCase.labels.includes("overmatched") ||
      reviewCase.labels.includes("undermatched") ||
      reviewCase.labels.includes("acceptable but conservative")
    ) {
      addExample(examples, "evidenceCorrectTierWrong", reviewCase);
    }
  }

  const missingCategories = STRUCTURED_MATCH_REVIEW_REQUIRED_CATEGORIES.filter(
    (category) => coverageByCategory[category] === 0,
  );

  if (reviewCases.length < REQUIRED_REVIEW_CASE_COUNT) {
    gateReasons.push(
      `reviewed case count ${reviewCases.length} is below ${REQUIRED_REVIEW_CASE_COUNT}`,
    );
    recommendedActions.push("add fixtures");
  }

  if (missingCategories.length > 0) {
    gateReasons.push(`missing required coverage: ${missingCategories.join(", ")}`);
    recommendedActions.push("add fixtures");
  }

  const recurringMetadataLeaks = reviewCases.filter(
    (reviewCase) =>
      reviewCase.metadataLeakCount > 0 ||
      reviewCase.labels.includes("metadata leak"),
  ).length;
  if (recurringMetadataLeaks >= RECURRING_FAILURE_COUNT) {
    gateReasons.push("recurring metadata leak failures");
    recommendedActions.push("tune extraction semantics", "hold rollout");
  }

  const recurringLanguageFailures = reviewCases.filter(
    (reviewCase) =>
      !reviewCase.languagePreserved ||
      reviewCase.labels.includes("language issue"),
  ).length;
  if (recurringLanguageFailures >= RECURRING_FAILURE_COUNT) {
    gateReasons.push("recurring language preservation failures");
    recommendedActions.push("tune extraction semantics", "hold rollout");
  }

  const negativeControlFailures = reviewCases.filter(
    (reviewCase) =>
      reviewCase.category === "negative_control" &&
      reviewCase.structuredTier !== "weak",
  );
  if (negativeControlFailures.length > 0) {
    gateReasons.push("negative controls did not remain weak");
    recommendedActions.push("tune tier gates", "hold rollout");
  }

  const strongEvidenceFailures = reviewCases.filter(
    (reviewCase) => !hasMeaningfulStrongEvidence(reviewCase),
  );
  if (strongEvidenceFailures.length > 0) {
    gateReasons.push("strong tiers lack meaningful matched evidence coverage");
    recommendedActions.push("tune evidence matching", "tune tier gates");
  }

  const overconfidentUnknownFailures = reviewCases.filter(
    (reviewCase) =>
      hasHighUnknownPressure(reviewCase) &&
      (reviewCase.structuredTier === "strong" ||
        reviewCase.structuredTier === "partial"),
  );
  if (overconfidentUnknownFailures.length > 0) {
    gateReasons.push("high unknown counts produced overconfident scores");
    recommendedActions.push("tune tier gates");
  }

  const productionScoreChanges = reviewCases.filter(
    (reviewCase) => reviewCase.productionScoreChanged === true,
  );
  if (productionScoreChanges.length > 0) {
    gateReasons.push("production score changed during shadow review");
    recommendedActions.push("hold rollout");
  }

  const blockerLabels = Object.entries(blockerLabelCounts).filter(
    ([, count]) => (count ?? 0) > 0,
  );
  if (blockerLabels.length > 0) {
    gateReasons.push(
      `blocker labels present: ${blockerLabels
        .map(([label, count]) => `${label}=${count}`)
        .join(", ")}`,
    );
    recommendedActions.push("hold rollout");
  }

  if (labelCounts["evidence missing"] > 0) {
    recommendedActions.push("tune evidence matching");
  }
  if (labelCounts.undermatched > 0) {
    recommendedActions.push("tune evidence matching", "tune tier gates");
  }

  return {
    reviewedCaseCount: reviewCases.length,
    coverageByCategory,
    missingCategories,
    labelCounts,
    blockerLabelCounts,
    examples,
    rolloutGate: {
      status: gateReasons.length === 0 ? "ready" : "blocked",
      reasons: gateReasons,
    },
    recommendedNextActions: uniqueActions(recommendedActions),
  };
}
