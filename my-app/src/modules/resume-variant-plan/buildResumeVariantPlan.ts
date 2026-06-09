import { buildStableHash } from "../application-harness/fingerprints";
import type {
  AllowedClaimV1,
  EvidenceGraphV1,
  EvidenceMatchV1,
  EvidenceRiskFlagV1,
  JobDemandV1,
  MissingEvidenceV1,
} from "../evidence-graph/schema";
import {
  actionFromWarningSeverity,
  isClaimBackedResumeVariantPlanAction,
  isForbiddenResumeOrCoverLetterText,
  mapAllowedClaimTypeToResumeVariantPlanSection,
  mapJobDemandKindToResumeVariantPlanSection,
  mapRiskFlagCategoryToResumeVariantPlanWarningCategory,
  normalizePlanIdSegment,
  priorityFromWarningSeverity,
  reviewStateFromWarningSeverity,
  sortUniqueStrings,
  warningSeverityFromEvidenceSeverity,
} from "./planRules";
import type {
  BuildResumeVariantPlanInputV1,
  ResumeVariantPlanArtifactContentV1,
  ResumeVariantPlanItemV1,
  ResumeVariantPlanPriorityV1,
  ResumeVariantPlanV1,
  ResumeVariantPlanWarningV1,
} from "./schema";

const RESUME_VARIANT_PLAN_HASH_NAMESPACE = "resume-variant-plan";
const RESUME_VARIANT_PLAN_ID_PREFIX = "resume-variant-plan:";
const EVIDENCE_GRAPH_ID_PREFIX = "evidence-graph:";

const CLAIM_EXCLUDED_RISK_CATEGORIES = new Set([
  "private_fact",
  "never_use_fact",
  "generated_text_as_fact",
  "source_truth",
]);

type ResumeVariantPlanWithoutId = Omit<ResumeVariantPlanV1, "id">;

export async function buildResumeVariantPlan(
  input: BuildResumeVariantPlanInputV1,
): Promise<ResumeVariantPlanV1> {
  assertResumeVariantPlanInput(input);

  const items = buildResumeVariantPlanItems(input);
  const warnings = buildResumeVariantPlanWarnings(input);
  const blocked = warnings.some((warning) => warning.severity === "blocker");
  const blockedReason = buildBlockedReason(warnings);

  const planWithoutId: ResumeVariantPlanWithoutId = {
    userId: input.userId,
    applicationContextId: input.applicationContextId,
    evidenceGraphId: input.evidenceGraph.id,
    evidenceGraphHash: extractEvidenceGraphHash(input.evidenceGraph),
    targetDocumentKind: input.targetDocumentKind,
    language: input.language,
    market: input.market,
    items,
    warnings,
    blockedClaimIds: sortUniqueStrings(input.evidenceGraph.blockedClaimIds),
    sourceFactIds: collectFactIds(items, warnings),
    allowedClaimIds: collectClaimIds(items),
    riskFlagIds: collectRiskIds(items, warnings),
    blocked,
    blockedReason,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    version: 1,
  };

  const plan: ResumeVariantPlanV1 = {
    id: `${RESUME_VARIANT_PLAN_ID_PREFIX}${await buildResumeVariantPlanHash(input)}`,
    ...planWithoutId,
  };

  assertResumeVariantPlanEvidenceBacked(plan, input.evidenceGraph);
  assertResumeVariantPlanDoesNotContainGeneratedText(plan);

  return plan;
}

export function buildResumeVariantPlanHash(
  inputOrPlan: BuildResumeVariantPlanInputV1 | ResumeVariantPlanV1,
): Promise<string> {
  if (isBuildResumeVariantPlanInput(inputOrPlan)) {
    assertResumeVariantPlanInput(inputOrPlan);

    return buildStableHash({
      namespace: RESUME_VARIANT_PLAN_HASH_NAMESPACE,
      type: "resume-variant-plan-input",
      version: 1,
      input: {
        userId: inputOrPlan.userId,
        applicationContextId: inputOrPlan.applicationContextId,
        targetDocumentKind: inputOrPlan.targetDocumentKind,
        language: inputOrPlan.language,
        market: inputOrPlan.market,
        evidenceGraph: inputOrPlan.evidenceGraph,
        createdAt: inputOrPlan.createdAt,
        updatedAt: inputOrPlan.updatedAt,
      },
    });
  }

  return buildStableHash({
    namespace: RESUME_VARIANT_PLAN_HASH_NAMESPACE,
    type: "resume-variant-plan",
    version: 1,
    plan: { ...inputOrPlan, id: undefined },
  });
}

export function buildResumeVariantPlanItems(
  input: BuildResumeVariantPlanInputV1,
): readonly ResumeVariantPlanItemV1[] {
  assertResumeVariantPlanInput(input);

  const graph = input.evidenceGraph;
  const items: ResumeVariantPlanItemV1[] = [];

  for (const claim of sortAllowedClaims(graph.allowedClaims)) {
    if (!isUsableAllowedClaim(claim, graph)) {
      continue;
    }

    const acceptedMatches = getAcceptedMatchesForAllowedClaim(claim, graph);

    if (acceptedMatches.length === 0) {
      continue;
    }

    const section = mapAllowedClaimTypeToResumeVariantPlanSection(claim.claimType);
    const candidateFactIds = sortUniqueStrings(acceptedMatches.map((match) => match.candidateFactId));
    const demandIds = sortUniqueStrings(acceptedMatches.map((match) => match.demandId));
    const evidenceMatchIds = sortUniqueStrings(acceptedMatches.map((match) => match.id));

    items.push({
      id: ["resume-variant-plan-item", section, "add-from-allowed-claim", claim.id]
        .map(normalizePlanIdSegment)
        .join(":"),
      section,
      action: "add_from_allowed_claim",
      priority: priorityFromDemandIds(demandIds, graph.demands),
      reviewState: "pending",
      allowedClaimIds: [claim.id],
      candidateFactIds,
      evidenceMatchIds,
      demandIds,
      riskFlagIds: [],
      reason: `Add source-backed ${section} claim to ${section} section.`,
      version: 1,
    });
  }

  for (const missing of sortMissingEvidence(graph.missing)) {
    items.push(buildMissingEvidenceItem(missing, graph));
  }

  for (const riskFlag of sortRiskFlags(graph.riskFlags)) {
    items.push(buildRiskFlagItem(riskFlag, graph));
  }

  return items.sort((a, b) => a.id.localeCompare(b.id));
}

export function buildResumeVariantPlanWarnings(
  input: BuildResumeVariantPlanInputV1,
): readonly ResumeVariantPlanWarningV1[] {
  assertResumeVariantPlanInput(input);

  const warnings: ResumeVariantPlanWarningV1[] = [];

  for (const missing of sortMissingEvidence(input.evidenceGraph.missing)) {
    warnings.push({
      id: ["resume-variant-plan-warning", "missing-evidence", missing.id]
        .map(normalizePlanIdSegment)
        .join(":"),
      category: "missing_evidence",
      severity: warningSeverityFromEvidenceSeverity(missing.severity),
      demandId: missing.demandId,
      reason: missing.reason,
      version: 1,
    });
  }

  for (const riskFlag of sortRiskFlags(input.evidenceGraph.riskFlags)) {
    warnings.push({
      id: ["resume-variant-plan-warning", riskFlag.category, riskFlag.id]
        .map(normalizePlanIdSegment)
        .join(":"),
      category: mapRiskFlagCategoryToResumeVariantPlanWarningCategory(riskFlag.category),
      severity: warningSeverityFromEvidenceSeverity(riskFlag.severity),
      demandId: riskFlag.demandId,
      riskFlagId: riskFlag.id,
      candidateFactId: riskFlag.candidateFactId,
      reason: riskFlag.reason,
      version: 1,
    });
  }

  return warnings.sort((a, b) => a.id.localeCompare(b.id));
}

export function buildResumeVariantPlanArtifactContent(
  plan: ResumeVariantPlanV1,
): ResumeVariantPlanArtifactContentV1 {
  return {
    kind: "resume_variant_plan",
    plan,
    version: 1,
  };
}

export function assertResumeVariantPlanEvidenceBacked(
  plan: ResumeVariantPlanV1,
  evidenceGraph: EvidenceGraphV1,
): void {
  const claimsById = new Map(evidenceGraph.allowedClaims.map((claim) => [claim.id, claim]));
  const acceptedMatchesByFactId = buildAcceptedMatchesByFactId(evidenceGraph.matches);
  const blockedClaimIds = new Set(evidenceGraph.blockedClaimIds);
  const excludedFactIds = collectExcludedFactIds(evidenceGraph);

  for (const item of plan.items) {
    if (!isClaimBackedResumeVariantPlanAction(item.action)) {
      continue;
    }

    if (item.allowedClaimIds.length === 0) {
      throw new Error(`Claim-backed plan item lacks allowedClaimIds: ${item.id}`);
    }

    if (item.candidateFactIds.length === 0) {
      throw new Error(`Claim-backed plan item lacks candidateFactIds: ${item.id}`);
    }

    const claimFactIds = new Set<string>();

    for (const allowedClaimId of item.allowedClaimIds) {
      const claim = claimsById.get(allowedClaimId);

      if (!claim) {
        throw new Error(`Plan item references unknown allowed claim: ${allowedClaimId}`);
      }

      if (blockedClaimIds.has(allowedClaimId)) {
        throw new Error(`Plan item references blocked claim: ${allowedClaimId}`);
      }

      for (const candidateFactId of claim.candidateFactIds) {
        claimFactIds.add(candidateFactId);
      }

      if (!item.candidateFactIds.some((candidateFactId) => claim.candidateFactIds.includes(candidateFactId))) {
        throw new Error(`Allowed claim does not map back to plan item facts: ${allowedClaimId}`);
      }
    }

    for (const candidateFactId of item.candidateFactIds) {
      if (!claimFactIds.has(candidateFactId)) {
        throw new Error(`Plan item fact does not map back to allowed claims: ${candidateFactId}`);
      }

      if (blockedClaimIds.has(`blocked-claim:${candidateFactId}`)) {
        throw new Error(`Plan item references fact from blocked claim: ${candidateFactId}`);
      }

      if (excludedFactIds.has(candidateFactId)) {
        throw new Error(`Claim-backed plan item references excluded source fact: ${candidateFactId}`);
      }

      if (!acceptedMatchesByFactId.get(candidateFactId)?.length) {
        throw new Error(`Claim-backed plan item lacks accepted evidence match: ${candidateFactId}`);
      }
    }
  }
}

export function assertResumeVariantPlanDoesNotContainGeneratedText(plan: ResumeVariantPlanV1): void {
  const values = [
    plan.blockedReason,
    ...plan.items.map((item) => item.reason),
    ...plan.warnings.map((warning) => warning.reason),
  ].filter((value): value is string => typeof value === "string");

  for (const value of values) {
    if (isForbiddenResumeOrCoverLetterText(value)) {
      throw new Error("ResumeVariantPlan contains generated resume or cover-letter text");
    }
  }
}

export function collectResumeVariantPlanSourceFactIds(plan: ResumeVariantPlanV1): readonly string[] {
  return collectFactIds(plan.items, plan.warnings);
}

export function collectResumeVariantPlanAllowedClaimIds(plan: ResumeVariantPlanV1): readonly string[] {
  return collectClaimIds(plan.items);
}

export function collectResumeVariantPlanRiskFlagIds(plan: ResumeVariantPlanV1): readonly string[] {
  return collectRiskIds(plan.items, plan.warnings);
}

function buildMissingEvidenceItem(
  missing: MissingEvidenceV1,
  evidenceGraph: EvidenceGraphV1,
): ResumeVariantPlanItemV1 {
  const demand = findDemand(evidenceGraph, missing.demandId);
  const section = demand ? mapJobDemandKindToResumeVariantPlanSection(demand.kind) : "other";
  const action = actionFromWarningSeverity(missing.severity);

  return {
    id: ["resume-variant-plan-item", section, action, missing.id].map(normalizePlanIdSegment).join(":"),
    section,
    action,
    priority: priorityFromWarningSeverity(missing.severity),
    reviewState: reviewStateFromWarningSeverity(missing.severity),
    allowedClaimIds: [],
    candidateFactIds: [],
    evidenceMatchIds: [],
    demandIds: [missing.demandId],
    riskFlagIds: [],
    reason:
      missing.severity === "blocker"
        ? "Block plan until required missing evidence is reviewed."
        : "Flag missing evidence before resume planning.",
    version: 1,
  };
}

function buildRiskFlagItem(riskFlag: EvidenceRiskFlagV1, evidenceGraph: EvidenceGraphV1): ResumeVariantPlanItemV1 {
  const demand = riskFlag.demandId ? findDemand(evidenceGraph, riskFlag.demandId) : undefined;
  const section = demand ? mapJobDemandKindToResumeVariantPlanSection(demand.kind) : "other";
  const action = actionFromWarningSeverity(riskFlag.severity);

  return {
    id: ["resume-variant-plan-item", section, action, riskFlag.id].map(normalizePlanIdSegment).join(":"),
    section,
    action,
    priority: priorityFromWarningSeverity(riskFlag.severity),
    reviewState: reviewStateFromWarningSeverity(riskFlag.severity),
    allowedClaimIds: [],
    candidateFactIds: riskFlag.candidateFactId ? [riskFlag.candidateFactId] : [],
    evidenceMatchIds: [],
    demandIds: riskFlag.demandId ? [riskFlag.demandId] : [],
    riskFlagIds: [riskFlag.id],
    reason: buildRiskFlagPlanReason(riskFlag),
    version: 1,
  };
}

function buildRiskFlagPlanReason(riskFlag: EvidenceRiskFlagV1): string {
  switch (riskFlag.category) {
    case "private_fact":
      return "Block plan until private fact use is reviewed.";
    case "never_use_fact":
      return "Block plan because never_use facts cannot support a resume variant.";
    case "generated_text_as_fact":
      return "Block plan because artifact text cannot be treated as source evidence.";
    case "source_truth":
      return "Flag source-truth issue before resume planning.";
    case "missing_evidence":
      return riskFlag.severity === "blocker"
        ? "Block plan until required missing evidence is reviewed."
        : "Flag missing evidence before resume planning.";
    case "unsupported_metric":
    case "unsupported_tool":
    case "unsupported_certification":
    case "unsupported_language":
      return "Flag unsupported claim before resume planning.";
    case "other":
      return "Flag evidence risk before resume planning.";
  }
}

function priorityFromDemandIds(
  demandIds: readonly string[],
  demands: readonly JobDemandV1[],
): ResumeVariantPlanPriorityV1 {
  const matchingDemands = demands.filter((demand) => demandIds.includes(demand.id));

  if (matchingDemands.some((demand) => demand.required === "required")) {
    return "required";
  }

  if (matchingDemands.some((demand) => demand.required === "preferred")) {
    return "recommended";
  }

  return "optional";
}

function isUsableAllowedClaim(claim: AllowedClaimV1, evidenceGraph: EvidenceGraphV1): boolean {
  if (claim.reviewState !== "allowed" || claim.candidateFactIds.length === 0) {
    return false;
  }

  const blockedClaimIds = new Set(evidenceGraph.blockedClaimIds);

  if (blockedClaimIds.has(claim.id)) {
    return false;
  }

  if (claim.candidateFactIds.some((candidateFactId) => blockedClaimIds.has(`blocked-claim:${candidateFactId}`))) {
    return false;
  }

  const excludedFactIds = collectExcludedFactIds(evidenceGraph);
  return !claim.candidateFactIds.some((candidateFactId) => excludedFactIds.has(candidateFactId));
}

function getAcceptedMatchesForAllowedClaim(
  claim: AllowedClaimV1,
  evidenceGraph: EvidenceGraphV1,
): readonly EvidenceMatchV1[] {
  const claimFactIds = new Set(claim.candidateFactIds);

  return sortEvidenceMatches(
    evidenceGraph.matches.filter(
      (match) => claimFactIds.has(match.candidateFactId) && match.reviewState === "accepted",
    ),
  );
}

function buildAcceptedMatchesByFactId(
  matches: readonly EvidenceMatchV1[],
): Map<string, readonly EvidenceMatchV1[]> {
  const matchesByFactId = new Map<string, EvidenceMatchV1[]>();

  for (const match of matches) {
    if (match.reviewState !== "accepted") {
      continue;
    }

    const matchesForFact = matchesByFactId.get(match.candidateFactId) ?? [];
    matchesForFact.push(match);
    matchesByFactId.set(match.candidateFactId, matchesForFact);
  }

  return new Map(
    [...matchesByFactId.entries()].map(([candidateFactId, matchesForFact]) => [
      candidateFactId,
      sortEvidenceMatches(matchesForFact),
    ]),
  );
}

function collectExcludedFactIds(evidenceGraph: EvidenceGraphV1): Set<string> {
  return new Set(
    evidenceGraph.riskFlags
      .filter(
        (riskFlag) =>
          riskFlag.candidateFactId && CLAIM_EXCLUDED_RISK_CATEGORIES.has(riskFlag.category),
      )
      .map((riskFlag) => riskFlag.candidateFactId)
      .filter((candidateFactId): candidateFactId is string => typeof candidateFactId === "string"),
  );
}

function collectFactIds(
  items: readonly ResumeVariantPlanItemV1[],
  warnings: readonly ResumeVariantPlanWarningV1[],
): readonly string[] {
  return sortUniqueStrings([
    ...items.flatMap((item) => item.candidateFactIds),
    ...warnings
      .map((warning) => warning.candidateFactId)
      .filter((candidateFactId): candidateFactId is string => typeof candidateFactId === "string"),
  ]);
}

function collectClaimIds(items: readonly ResumeVariantPlanItemV1[]): readonly string[] {
  return sortUniqueStrings(items.flatMap((item) => item.allowedClaimIds));
}

function collectRiskIds(
  items: readonly ResumeVariantPlanItemV1[],
  warnings: readonly ResumeVariantPlanWarningV1[],
): readonly string[] {
  return sortUniqueStrings([
    ...items.flatMap((item) => item.riskFlagIds),
    ...warnings
      .map((warning) => warning.riskFlagId)
      .filter((riskFlagId): riskFlagId is string => typeof riskFlagId === "string"),
  ]);
}

function buildBlockedReason(warnings: readonly ResumeVariantPlanWarningV1[]): string | undefined {
  const firstBlocker = warnings
    .filter((warning) => warning.severity === "blocker")
    .sort((a, b) => a.id.localeCompare(b.id))[0];

  return firstBlocker ? `${firstBlocker.category}: ${firstBlocker.reason}` : undefined;
}

function extractEvidenceGraphHash(evidenceGraph: EvidenceGraphV1): string {
  return evidenceGraph.id.startsWith(EVIDENCE_GRAPH_ID_PREFIX)
    ? evidenceGraph.id.slice(EVIDENCE_GRAPH_ID_PREFIX.length)
    : evidenceGraph.id;
}

function findDemand(evidenceGraph: EvidenceGraphV1, demandId: string): JobDemandV1 | undefined {
  return evidenceGraph.demands.find((demand) => demand.id === demandId);
}

function sortAllowedClaims(allowedClaims: readonly AllowedClaimV1[]): readonly AllowedClaimV1[] {
  return [...allowedClaims].sort((a, b) => a.id.localeCompare(b.id));
}

function sortEvidenceMatches(matches: readonly EvidenceMatchV1[]): readonly EvidenceMatchV1[] {
  return [...matches].sort((a, b) => a.id.localeCompare(b.id));
}

function sortMissingEvidence(missing: readonly MissingEvidenceV1[]): readonly MissingEvidenceV1[] {
  return [...missing].sort((a, b) => a.id.localeCompare(b.id));
}

function sortRiskFlags(riskFlags: readonly EvidenceRiskFlagV1[]): readonly EvidenceRiskFlagV1[] {
  return [...riskFlags].sort((a, b) => a.id.localeCompare(b.id));
}

function isBuildResumeVariantPlanInput(
  value: BuildResumeVariantPlanInputV1 | ResumeVariantPlanV1,
): value is BuildResumeVariantPlanInputV1 {
  return "evidenceGraph" in value;
}

function assertResumeVariantPlanInput(input: BuildResumeVariantPlanInputV1): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("invalid ResumeVariantPlan input");
  }

  if (!input.userId || !input.applicationContextId) {
    throw new TypeError("ResumeVariantPlan input requires userId and applicationContextId");
  }

  if (input.targetDocumentKind !== "resume" && input.targetDocumentKind !== "cv") {
    throw new TypeError('ResumeVariantPlan targetDocumentKind must be "resume" or "cv"');
  }

  if (!input.evidenceGraph?.id) {
    throw new TypeError("ResumeVariantPlan input requires an EvidenceGraph");
  }

  if (!Number.isFinite(input.createdAt) || !Number.isFinite(input.updatedAt)) {
    throw new TypeError("ResumeVariantPlan input requires numeric timestamps");
  }
}
