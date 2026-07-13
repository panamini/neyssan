import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import {
  buildAllowedFactsPackFromFactGraph,
  buildPremiumClaimPlanV1,
  buildPremiumFactGraphV1,
  buildPremiumJobDemandGraphV1,
  evaluatePremiumCoverLetterEligibility,
  rankAllowedFacts,
  validatePremiumClaimPlanV1,
  type ClaimPlanV1,
  type PremiumClaimPlanValidationIssue,
  type PremiumCoverLetterContextClass,
  type PremiumCoverLetterEligibility,
} from "../../convex/lib/proposals/premiumCoverLetter";
import { decideCoverLetterPolicyCandidateV1 } from "../../convex/lib/proposals/coverLetterPolicyCandidate";
import {
  COVER_LETTER_POLICY_SHADOW_CASES,
  COVER_LETTER_POLICY_SHADOW_INSUFFICIENT_CASES,
  type CoverLetterPolicyShadowCase,
  type CoverLetterPolicyShadowInsufficientCase,
} from "./cases/cover-letter/policy-shadow-cases";

export type CoverLetterPolicyShadowInput =
  | CoverLetterPolicyShadowCase
  | CoverLetterPolicyShadowInsufficientCase;

export type CoverLetterPolicyShadowRecordV1 = {
  version: "cover_letter_policy_shadow_record_v1";
  caseId: string;
  cohort: CoverLetterPolicyShadowInput["cohort"];
  outputLanguage: CoverLetterPolicyShadowInput["outputLanguage"];
  currentEligibility: PremiumCoverLetterEligibility;
  candidateDecision: ReturnType<typeof decideCoverLetterPolicyCandidateV1>;
  graphSummary: {
    factGraphVersion: "fact_graph_v1";
    factCount: number;
    cvFactCount: number;
    jobDemandGraphVersion: "job_demand_graph_v1";
    demandCount: number;
    usableJobSurfaceDemandCount: number;
  };
  claimPlan: ClaimPlanV1 | null;
  claimPlanValidationIssues: PremiumClaimPlanValidationIssue[];
  claimPlanDemandAnchorCount: number;
  recordHash: string;
};

export type CoverLetterPolicyShadowMatrixV1 = {
  version: "cover_letter_policy_shadow_matrix_v1";
  records: CoverLetterPolicyShadowRecordV1[];
  matrixHash: string;
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${canonicalJson(entryValue)}`,
    )
    .join(",")}}`;
}

export function hashCoverLetterPolicyShadowValue(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function provisionalPlanningContext(args: {
  currentEligibility: PremiumCoverLetterEligibility;
  cvFactCount: number;
}): PremiumCoverLetterContextClass {
  if (args.currentEligibility.contextClass) {
    return args.currentEligibility.contextClass;
  }
  return args.cvFactCount > 0 ? "cv_adjacent" : "no_cv";
}

export function evaluateCoverLetterPolicyShadowCase(
  input: CoverLetterPolicyShadowInput,
): CoverLetterPolicyShadowRecordV1 {
  const currentEligibility = evaluatePremiumCoverLetterEligibility({
    personalizationContext: input.personalizationContext,
    voicePreset: input.preset,
    jobTitle: input.jobTitle,
    jobDescription: input.jobDescription,
  });
  const factGraph = buildPremiumFactGraphV1({
    personalizationContext: input.personalizationContext,
    jobDescription: input.jobDescription,
  });
  const jobDemandGraph = buildPremiumJobDemandGraphV1(input.jobDescription);
  const cvFactCount = factGraph.facts.filter(
    (fact) => fact.source === "cv",
  ).length;
  const rankingContextClass = provisionalPlanningContext({
    currentEligibility,
    cvFactCount,
  });
  const rankedEvidencePack = rankAllowedFacts({
    allowedFactsPack: buildAllowedFactsPackFromFactGraph(factGraph),
    jobTitle: input.jobTitle,
    jobDescription: input.jobDescription,
    contextClass: rankingContextClass,
  });
  const candidateDecision = decideCoverLetterPolicyCandidateV1({
    currentEligibility,
    factGraph,
    jobDemandGraph,
    rankedEvidencePack,
    hasCvInput: input.personalizationContext !== null,
  });

  let claimPlan: ClaimPlanV1 | null = null;
  let claimPlanValidationIssues: PremiumClaimPlanValidationIssue[] = [];
  if (candidateDecision.status === "planned") {
    const finalRankedEvidencePack =
      candidateDecision.planningContextClass === rankingContextClass
        ? rankedEvidencePack
        : rankAllowedFacts({
            allowedFactsPack: buildAllowedFactsPackFromFactGraph(factGraph),
            jobTitle: input.jobTitle,
            jobDescription: input.jobDescription,
            contextClass: candidateDecision.planningContextClass,
          });
    claimPlan = buildPremiumClaimPlanV1({
      factGraph,
      jobDemandGraph,
      rankedEvidencePack: finalRankedEvidencePack,
      contextClass: candidateDecision.planningContextClass,
      preset: input.preset,
      outputLanguage: input.outputLanguage,
      jobTitle: input.jobTitle,
    });
    claimPlanValidationIssues = validatePremiumClaimPlanV1({
      claimPlan,
      factGraph,
      jobDemandGraph,
    });
  }

  const recordWithoutHash: Omit<CoverLetterPolicyShadowRecordV1, "recordHash"> =
    {
      version: "cover_letter_policy_shadow_record_v1",
      caseId: input.id,
      cohort: input.cohort,
      outputLanguage: input.outputLanguage,
      currentEligibility,
      candidateDecision,
      graphSummary: {
        factGraphVersion: factGraph.version,
        factCount: factGraph.facts.length,
        cvFactCount,
        jobDemandGraphVersion: jobDemandGraph.version,
        demandCount: jobDemandGraph.demands.length,
        usableJobSurfaceDemandCount: jobDemandGraph.demands.filter(
          (demand) =>
            demand.requiredness === "core" ||
            demand.requiredness === "required" ||
            demand.requiredness === "preferred",
        ).length,
      },
      claimPlan,
      claimPlanValidationIssues,
      claimPlanDemandAnchorCount: new Set(
        claimPlan?.claims.flatMap((claim) => claim.demandIds) ?? [],
      ).size,
    };
  return {
    ...recordWithoutHash,
    recordHash: hashCoverLetterPolicyShadowValue(recordWithoutHash),
  };
}

export function runCoverLetterPolicyShadowMatrix(): CoverLetterPolicyShadowRecordV1[] {
  return [
    ...COVER_LETTER_POLICY_SHADOW_CASES,
    ...COVER_LETTER_POLICY_SHADOW_INSUFFICIENT_CASES,
  ].map(evaluateCoverLetterPolicyShadowCase);
}

export function buildCoverLetterPolicyShadowMatrix(): CoverLetterPolicyShadowMatrixV1 {
  const records = runCoverLetterPolicyShadowMatrix();
  return {
    version: "cover_letter_policy_shadow_matrix_v1",
    records,
    matrixHash: hashCoverLetterPolicyShadowValue(records),
  };
}

function isMainModule(): boolean {
  const scriptPath = process.argv[1];
  return Boolean(
    scriptPath && pathToFileURL(scriptPath).href === import.meta.url,
  );
}

if (isMainModule()) {
  const matrix = buildCoverLetterPolicyShadowMatrix();
  const plannedCount = matrix.records.filter(
    (record) => record.candidateDecision.status === "planned",
  ).length;
  const unanchoredPlannedCount = matrix.records.filter(
    (record) =>
      record.candidateDecision.status === "planned" &&
      record.claimPlanDemandAnchorCount === 0,
  ).length;
  process.stdout.write(
    `${JSON.stringify({
      contract: matrix.version,
      recordCount: matrix.records.length,
      plannedCount,
      rejectedCount: matrix.records.length - plannedCount,
      unanchoredPlannedCount,
      matrixHash: matrix.matrixHash,
    })}\n`,
  );
}
