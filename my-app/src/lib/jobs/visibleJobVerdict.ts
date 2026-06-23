/* eslint-disable @typescript-eslint/no-redundant-type-constituents -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
export type VisibleJobVerdictTone = "strong" | "worth" | "maybe" | "skip";

export type VisibleJobVerdictKey =
  | "strong_match"
  | "worth_a_shot"
  | "probably_skip"
  | "maybe";

export type VisibleJobMatchTier = "strong" | "partial" | "weak" | "unknown";

export type VisibleJobMatchReviewVerdict =
  | "strong_lead"
  | "possible_lead"
  | "probably_skip"
  | "not_enough_signal";

export type VisibleJobMatchReviewInput = {
  verdict?: VisibleJobMatchReviewVerdict | null;
  score?: number | null;
} | null;

export type VisibleJobMatchReadInput = {
  tier?: VisibleJobMatchTier | string | null;
} | null;

export type VisibleJobVerdict = {
  key: VisibleJobVerdictKey;
  label: string;
  tone: VisibleJobVerdictTone;
};

function isMatchTier(value: unknown): value is VisibleJobMatchTier {
  return (
    value === "strong" ||
    value === "partial" ||
    value === "weak" ||
    value === "unknown"
  );
}

export function hasUsableMatchReview(
  matchReview: VisibleJobMatchReviewInput | undefined,
): matchReview is NonNullable<VisibleJobMatchReviewInput> {
  if (!matchReview?.verdict) {
    return false;
  }

  if (matchReview.verdict === "not_enough_signal") {
    return false;
  }

  if (
    matchReview.verdict === "probably_skip" &&
    (matchReview.score ?? 0) <= 0
  ) {
    return false;
  }

  return true;
}

function resolveFromReview(
  verdict: VisibleJobMatchReviewVerdict,
): VisibleJobVerdict {
  switch (verdict) {
    case "strong_lead":
      return {
        key: "strong_match",
        label: "Strong match",
        tone: "strong",
      };
    case "possible_lead":
      return {
        key: "worth_a_shot",
        label: "Worth a shot",
        tone: "worth",
      };
    case "probably_skip":
      return {
        key: "probably_skip",
        label: "Probably skip",
        tone: "skip",
      };
    case "not_enough_signal":
      return {
        key: "maybe",
        label: "Maybe",
        tone: "maybe",
      };
  }
}

function resolveFromTier(tier: VisibleJobMatchTier): VisibleJobVerdict {
  switch (tier) {
    case "strong":
      return {
        key: "strong_match",
        label: "Strong match",
        tone: "strong",
      };
    case "partial":
      return {
        key: "worth_a_shot",
        label: "Worth a shot",
        tone: "worth",
      };
    case "weak":
      return {
        key: "probably_skip",
        label: "Probably skip",
        tone: "skip",
      };
    case "unknown":
      return {
        key: "maybe",
        label: "Maybe",
        tone: "maybe",
      };
  }
}

export function resolveVisibleJobVerdict({
  matchReview,
  matchRead,
  matchTier,
}: {
  matchReview?: VisibleJobMatchReviewInput;
  matchRead?: VisibleJobMatchReadInput;
  matchTier?: VisibleJobMatchTier | string | null;
}): VisibleJobVerdict {
  if (hasUsableMatchReview(matchReview)) {
    return resolveFromReview(matchReview.verdict!);
  }

  if (isMatchTier(matchRead?.tier)) {
    return resolveFromTier(matchRead.tier);
  }

  if (isMatchTier(matchTier)) {
    return resolveFromTier(matchTier);
  }

  return resolveFromTier("unknown");
}
