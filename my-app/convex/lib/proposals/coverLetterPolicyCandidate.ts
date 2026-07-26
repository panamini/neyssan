import type {
  FactGraphV1,
  JobDemandGraphV1,
  PremiumCoverLetterContextClass,
  PremiumCoverLetterEligibility,
  RankedEvidencePack,
} from "./premiumCoverLetter";

export const COVER_LETTER_POLICY_CANDIDATE_VERSION =
  "cover_letter_policy_candidate_v1" as const;

export type CoverLetterPolicyCandidatePlannedCohort =
  | "direct"
  | "adjacent"
  | "distant_cautious"
  | "cv_unusable_job_surface_only"
  | "no_cv_job_surface_only";

export type CoverLetterPolicyCandidateDecisionV1 =
  | {
      version: typeof COVER_LETTER_POLICY_CANDIDATE_VERSION;
      status: "planned";
      cohort: CoverLetterPolicyCandidatePlannedCohort;
      planningContextClass: PremiumCoverLetterContextClass;
    }
  | {
      version: typeof COVER_LETTER_POLICY_CANDIDATE_VERSION;
      status: "rejected";
      cohort: "insufficient_input";
      reason: "insufficient_input";
    }
  | {
      version: typeof COVER_LETTER_POLICY_CANDIDATE_VERSION;
      status: "rejected";
      cohort: "preserved_rejection";
      reason: PremiumCoverLetterEligibility["reason"];
    };

const USABLE_JOB_SURFACE_BUCKETS: ReadonlySet<
  JobDemandGraphV1["demands"][number]["bucket"]
> = new Set([
  "core_responsibility",
  "key_requirement",
  "preferred_qualification",
] as const);

const USABLE_ADJACENT_CV_CATEGORIES: ReadonlySet<
  FactGraphV1["facts"][number]["category"]
> = new Set(["achievement", "responsibility", "workflow", "domain"] as const);

function normalizeStructuredText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function usableCvEvidenceKey(args: { category: string; text: string }): string {
  return `${args.category}:${normalizeStructuredText(args.text)}`;
}

function hasUsableJobSurface(jobDemandGraph: JobDemandGraphV1): boolean {
  return jobDemandGraph.demands.some(
    (demand) =>
      USABLE_JOB_SURFACE_BUCKETS.has(demand.bucket) &&
      normalizeStructuredText(demand.text).length > 0,
  );
}

function hasUsableAdjacentCvEvidence(args: {
  factGraph: FactGraphV1;
  rankedEvidencePack: RankedEvidencePack;
}): boolean {
  const usableFactKeys = new Set(
    args.factGraph.facts
      .filter(
        (fact) =>
          fact.source === "cv" &&
          USABLE_ADJACENT_CV_CATEGORIES.has(fact.category) &&
          normalizeStructuredText(fact.text).length > 0,
      )
      .map((fact) => usableCvEvidenceKey(fact)),
  );

  return [
    ...args.rankedEvidencePack.strongestEvidence,
    ...args.rankedEvidencePack.supportingEvidence,
    ...args.rankedEvidencePack.transferCore,
  ].some(
    (fact) =>
      fact.source === "cv" &&
      USABLE_ADJACENT_CV_CATEGORIES.has(fact.category) &&
      usableFactKeys.has(usableCvEvidenceKey(fact)),
  );
}

function preserveCurrentPlan(args: {
  contextClass: PremiumCoverLetterContextClass;
  hasCvInput: boolean;
}): CoverLetterPolicyCandidateDecisionV1 {
  const cohort: CoverLetterPolicyCandidatePlannedCohort =
    args.contextClass === "cv_direct"
      ? "direct"
      : args.contextClass === "cv_adjacent"
        ? "adjacent"
        : args.hasCvInput
          ? "cv_unusable_job_surface_only"
          : "no_cv_job_surface_only";
  return {
    version: COVER_LETTER_POLICY_CANDIDATE_VERSION,
    status: "planned",
    cohort,
    planningContextClass: args.contextClass,
  };
}

export function decideCoverLetterPolicyCandidateV1(args: {
  currentEligibility: PremiumCoverLetterEligibility;
  factGraph: FactGraphV1;
  jobDemandGraph: JobDemandGraphV1;
  rankedEvidencePack: RankedEvidencePack;
  hasCvInput: boolean;
}): CoverLetterPolicyCandidateDecisionV1 {
  if (
    args.currentEligibility.eligible &&
    args.currentEligibility.contextClass
  ) {
    return preserveCurrentPlan({
      contextClass: args.currentEligibility.contextClass,
      hasCvInput: args.hasCvInput,
    });
  }

  if (args.currentEligibility.reason !== "unsupported_context_class") {
    return {
      version: COVER_LETTER_POLICY_CANDIDATE_VERSION,
      status: "rejected",
      cohort: "preserved_rejection",
      reason: args.currentEligibility.reason,
    };
  }

  if (!hasUsableJobSurface(args.jobDemandGraph)) {
    return {
      version: COVER_LETTER_POLICY_CANDIDATE_VERSION,
      status: "rejected",
      cohort: "insufficient_input",
      reason: "insufficient_input",
    };
  }

  if (
    args.hasCvInput &&
    hasUsableAdjacentCvEvidence({
      factGraph: args.factGraph,
      rankedEvidencePack: args.rankedEvidencePack,
    })
  ) {
    return {
      version: COVER_LETTER_POLICY_CANDIDATE_VERSION,
      status: "planned",
      cohort: "distant_cautious",
      planningContextClass: "cv_adjacent",
    };
  }

  return {
    version: COVER_LETTER_POLICY_CANDIDATE_VERSION,
    status: "planned",
    cohort: args.hasCvInput
      ? "cv_unusable_job_surface_only"
      : "no_cv_job_surface_only",
    planningContextClass: "no_cv",
  };
}
