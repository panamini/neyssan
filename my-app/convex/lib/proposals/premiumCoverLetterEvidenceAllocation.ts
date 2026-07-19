import type {
  ClaimPlanSection,
  ClaimPlanV1,
  PremiumWriterOutputV1,
} from "./premiumCoverLetter";

const EVIDENCE_ALLOCATION_SECTIONS: readonly ClaimPlanSection[] = [
  "opening",
  "proofBlock",
  "closeLine",
];

export const ENGLISH_NEUTRAL_EVIDENCE_CLOSE =
  "I would approach the work with care, clear communication, and steady follow-through.";

export type PremiumEvidenceAllocationIssue = Readonly<{
  code: "fact_reallocated";
  section: ClaimPlanSection;
  factId: string;
}>;

export type PremiumEvidenceAllocationResult = Readonly<{
  writerOutput: PremiumWriterOutputV1;
  issues: readonly PremiumEvidenceAllocationIssue[];
  neutralClose: boolean;
}>;

function claimForSection(claimPlan: ClaimPlanV1, section: ClaimPlanSection) {
  return claimPlan.claims.find((claim) => claim.section === section);
}

export function allocateEnglishCvBackedEvidence(args: {
  writerOutput: PremiumWriterOutputV1;
  claimPlan: ClaimPlanV1;
}): PremiumEvidenceAllocationResult {
  const usedFactIds = new Set<string>();
  const usedClaimIds = new Set<string>();
  const issues: PremiumEvidenceAllocationIssue[] = [];
  const bodyParts = { ...args.writerOutput.bodyParts };
  let neutralClose = false;

  for (const section of EVIDENCE_ALLOCATION_SECTIONS) {
    const part = args.writerOutput.bodyParts[section];
    const assignedClaim = claimForSection(args.claimPlan, section);
    const allowedFactIds = new Set(assignedClaim?.factIds ?? []);
    const candidateFactIds: string[] = [];

    if (
      section === "closeLine" &&
      part.factIds.length === 0 &&
      part.text === ENGLISH_NEUTRAL_EVIDENCE_CLOSE
    ) {
      neutralClose = true;
      continue;
    }

    for (const factId of part.factIds) {
      if (allowedFactIds.has(factId) && !candidateFactIds.includes(factId)) {
        candidateFactIds.push(factId);
      }
    }

    const freshFactIds = candidateFactIds.filter(
      (factId) => !usedFactIds.has(factId),
    );
    const reallocatedFactIds = candidateFactIds.filter((factId) =>
      usedFactIds.has(factId),
    );

    if (
      section === "closeLine" &&
      part.factIds.length === 0 &&
      candidateFactIds.length === 0
    ) {
      bodyParts.closeLine = {
        ...part,
        text: ENGLISH_NEUTRAL_EVIDENCE_CLOSE,
        factIds: [],
      };
      neutralClose = true;
      continue;
    }

    if (reallocatedFactIds.length > 0 && freshFactIds.length === 0) {
      if (section === "closeLine") {
        const assignedCloseClaimId = assignedClaim?.id;
        const closeClaimIsReallocated =
          assignedCloseClaimId === undefined ||
          !part.claimIds.includes(assignedCloseClaimId) ||
          part.claimIds.some((claimId) => usedClaimIds.has(claimId));
        if (closeClaimIsReallocated) {
          bodyParts.closeLine = {
            ...part,
            text: ENGLISH_NEUTRAL_EVIDENCE_CLOSE,
            factIds: [],
          };
          neutralClose = true;
        } else {
          // A ClaimPlan-authorized close may preserve its founded text when
          // the writer did not introduce a new evidence allocation.
          bodyParts.closeLine = part;
        }
      } else {
        for (const factId of reallocatedFactIds) {
          issues.push({ code: "fact_reallocated", section, factId });
        }
      }
      continue;
    }

    // Mixed allocations are repaired only by the ClaimPlan-assigned fresh
    // facts and claim; no heuristic comparison decides what survives.
    const hasStructuredDistinctSelection =
      reallocatedFactIds.length > 0 && freshFactIds.length > 0;
    if (candidateFactIds.length > 0) {
      bodyParts[section] = {
        ...part,
        factIds: freshFactIds,
        ...(hasStructuredDistinctSelection && assignedClaim
          ? { claimIds: [assignedClaim.id] }
          : {}),
      };
    }
    for (const factId of freshFactIds) usedFactIds.add(factId);
    if (section !== "closeLine") {
      for (const claimId of part.claimIds) usedClaimIds.add(claimId);
    }
  }

  return {
    writerOutput: {
      ...args.writerOutput,
      bodyParts,
    },
    issues,
    neutralClose,
  };
}
