import { buildStableHash } from "../application-harness/fingerprints";
import type {
  AllowedClaimV1,
  EvidenceGraphV1,
  EvidenceMatchV1,
  MissingEvidenceV1,
} from "../evidence-graph/schema";
import {
  isForbiddenResumeOrCoverLetterText,
  normalizePlanIdSegment,
  sortUniqueStrings,
} from "../resume-variant-plan/planRules";
import type {
  ResumeVariantPlanItemV1,
  ResumeVariantPlanV1,
  ResumeVariantPlanWarningV1,
} from "../resume-variant-plan/schema";
import type {
  BuildReviewCockpitInputV1,
  ReviewCockpitItemV1,
  ReviewCockpitModelV1,
  ReviewCockpitStatusV1,
  ReviewCockpitSummaryV1,
} from "./schema";

const REVIEW_COCKPIT_HASH_NAMESPACE = "review-cockpit";
const REVIEW_COCKPIT_ID_PREFIX = "review-cockpit:";
const BLOCKED_CLAIM_PREFIX = "blocked-claim:";

const ATTENTION_REVIEW_STATES = new Set(["blocked", "needs_review"]);

type ReviewCockpitWithoutId = Omit<ReviewCockpitModelV1, "id">;

export async function buildReviewCockpit(
  input: BuildReviewCockpitInputV1,
): Promise<ReviewCockpitModelV1> {
  assertReviewCockpitInput(input);

  const modelWithoutId: ReviewCockpitWithoutId = {
    userId: input.userId,
    applicationContextId: input.applicationContextId,
    evidenceGraphId: input.evidenceGraph.id,
    resumeVariantPlanId: input.resumeVariantPlan.id,
    summary: buildReviewCockpitSummary(input),
    items: buildReviewCockpitItems(input),
    createdAt: input.createdAt,
    version: 1,
  };

  const model: ReviewCockpitModelV1 = {
    id: `${REVIEW_COCKPIT_ID_PREFIX}${await buildReviewCockpitHash(input)}`,
    ...modelWithoutId,
  };

  assertReviewCockpitDoesNotContainGeneratedText(model);

  return model;
}

export function buildReviewCockpitHash(
  inputOrModel: BuildReviewCockpitInputV1 | ReviewCockpitModelV1,
): Promise<string> {
  if (isBuildReviewCockpitInput(inputOrModel)) {
    assertReviewCockpitHashInput(inputOrModel);

    return buildStableHash({
      namespace: REVIEW_COCKPIT_HASH_NAMESPACE,
      type: "review-cockpit-input",
      version: 1,
      input: {
        userId: inputOrModel.userId,
        applicationContextId: inputOrModel.applicationContextId,
        evidenceGraph: inputOrModel.evidenceGraph,
        resumeVariantPlan: inputOrModel.resumeVariantPlan,
        createdAt: inputOrModel.createdAt,
      },
    });
  }

  return buildStableHash({
    namespace: REVIEW_COCKPIT_HASH_NAMESPACE,
    type: "review-cockpit",
    version: 1,
    model: { ...inputOrModel, id: undefined },
  });
}

export function buildReviewCockpitSummary(input: BuildReviewCockpitInputV1): ReviewCockpitSummaryV1 {
  assertReviewCockpitInput(input);

  const items = buildReviewCockpitItems(input);
  const blockerCount = items.filter((item) => item.severity === "blocker").length;
  const warningCount = items.filter((item) => item.severity === "warning").length;
  const status = buildReviewCockpitStatus(input.resumeVariantPlan, warningCount, blockerCount);

  return {
    status,
    allowedClaimCount: input.resumeVariantPlan.allowedClaimIds.length,
    planItemCount: input.resumeVariantPlan.items.length,
    warningCount,
    blockerCount,
    missingEvidenceCount: input.evidenceGraph.missing.length,
    blockedClaimCount: input.resumeVariantPlan.blockedClaimIds.length,
    sourceFactCount: input.resumeVariantPlan.sourceFactIds.length,
    riskFlagCount: input.resumeVariantPlan.riskFlagIds.length,
    reason: buildSummaryReason(
      status,
      warningCount,
      blockerCount,
      input.evidenceGraph.missing.length,
      input.resumeVariantPlan.blockedClaimIds.length,
    ),
    version: 1,
  };
}

export function buildReviewCockpitItems(input: BuildReviewCockpitInputV1): readonly ReviewCockpitItemV1[] {
  assertReviewCockpitInput(input);

  const graph = input.evidenceGraph;
  const plan = input.resumeVariantPlan;
  const items: ReviewCockpitItemV1[] = [];

  const warningItems = sortPlanWarnings(plan.warnings).map((warning) =>
    buildWarningItem(warning, graph, plan),
  );
  items.push(...warningItems.filter((item) => item.severity === "blocker"));
  items.push(...warningItems.filter((item) => item.severity !== "blocker"));

  for (const missing of sortMissingEvidence(graph.missing)) {
    items.push(buildMissingEvidenceItem(missing));
  }

  for (const blockedClaimId of sortUniqueStrings(plan.blockedClaimIds)) {
    items.push(buildBlockedClaimItem(blockedClaimId, graph));
  }

  for (const planItem of sortPlanItems(plan.items).filter(isPlanItemNeedingReview)) {
    items.push(buildPlanReviewItem(planItem));
  }

  for (const claim of sortAllowedClaims(graph.allowedClaims).filter((candidate) =>
    plan.allowedClaimIds.includes(candidate.id),
  )) {
    items.push(buildAllowedClaimItem(claim, graph));
    items.push(buildSourceSupportItem(claim, graph));
  }

  return items.map(normalizeItemIds).sort(compareReviewItems);
}

export function assertReviewCockpitDoesNotContainGeneratedText(model: ReviewCockpitModelV1): void {
  const values = [
    model.summary.reason,
    ...model.items.flatMap((item) => [item.title, item.description]),
  ].filter((value): value is string => typeof value === "string");

  for (const value of values) {
    if (isForbiddenResumeOrCoverLetterText(value)) {
      throw new Error("ReviewCockpit contains generated resume or cover-letter text");
    }
  }
}

function buildWarningItem(
  warning: ResumeVariantPlanWarningV1,
  graph: EvidenceGraphV1,
  plan: ResumeVariantPlanV1,
): ReviewCockpitItemV1 {
  const sourceFactIds = warning.candidateFactId ? [warning.candidateFactId] : [];
  const riskFlagIds = warning.riskFlagId ? [warning.riskFlagId] : [];
  const matchingPlanItem = findPlanItemForWarning(warning, plan);
  const evidenceMatchId = warning.candidateFactId
    ? firstEvidenceMatchIdForFact(warning.candidateFactId, graph)
    : undefined;

  return {
    id: ["review-cockpit-item", "warnings", warning.severity, warning.id]
      .map(normalizePlanIdSegment)
      .join(":"),
    bucket: "warnings",
    title: warning.severity === "blocker" ? "Blocker warning requires review" : "Plan warning requires review",
    description: "Review planning warning before resume variant generation.",
    severity: warning.severity,
    planItemId: matchingPlanItem?.id,
    candidateFactId: warning.candidateFactId,
    riskFlagId: warning.riskFlagId,
    demandId: warning.demandId,
    evidenceMatchId,
    sourceFactIds,
    allowedClaimIds: matchingPlanItem?.allowedClaimIds ?? [],
    riskFlagIds,
    version: 1,
  };
}

function buildMissingEvidenceItem(missing: MissingEvidenceV1): ReviewCockpitItemV1 {
  return {
    id: ["review-cockpit-item", "missing-evidence", missing.severity, missing.id]
      .map(normalizePlanIdSegment)
      .join(":"),
    bucket: "missing_evidence",
    title: "Review missing evidence",
    description: "Review missing evidence for this demand before resume planning.",
    severity: missing.severity,
    demandId: missing.demandId,
    sourceFactIds: [],
    allowedClaimIds: [],
    riskFlagIds: [],
    version: 1,
  };
}

function buildBlockedClaimItem(blockedClaimId: string, graph: EvidenceGraphV1): ReviewCockpitItemV1 {
  const candidateFactId = blockedClaimId.startsWith(BLOCKED_CLAIM_PREFIX)
    ? blockedClaimId.slice(BLOCKED_CLAIM_PREFIX.length)
    : undefined;
  const riskFlagIds = candidateFactId ? riskFlagIdsForFact(candidateFactId, graph) : [];
  const matchedEvidence = candidateFactId
    ? sortEvidenceMatches(graph.matches.filter((match) => match.candidateFactId === candidateFactId))[0]
    : undefined;

  return {
    id: ["review-cockpit-item", "blocked-claims", blockedClaimId].map(normalizePlanIdSegment).join(":"),
    bucket: "blocked_claims",
    title: "Blocked claim requires source review",
    description: "Blocked claim requires source-truth review before resume planning.",
    severity: "blocker",
    candidateFactId,
    demandId: matchedEvidence?.demandId,
    evidenceMatchId: matchedEvidence?.id,
    sourceFactIds: candidateFactId ? [candidateFactId] : [],
    allowedClaimIds: [],
    riskFlagIds,
    version: 1,
  };
}

function buildPlanReviewItem(planItem: ResumeVariantPlanItemV1): ReviewCockpitItemV1 {
  const severity = planItem.reviewState === "blocked" || planItem.action === "block" ? "blocker" : "warning";

  return {
    id: ["review-cockpit-item", "plan-items", severity, planItem.id]
      .map(normalizePlanIdSegment)
      .join(":"),
    bucket: "plan_items",
    title: severity === "blocker" ? "Plan item is blocked" : "Plan item needs review",
    description: "Plan item needs review before resume variant generation.",
    severity,
    planItemId: planItem.id,
    demandId: sortUniqueStrings(planItem.demandIds)[0],
    evidenceMatchId: sortUniqueStrings(planItem.evidenceMatchIds)[0],
    sourceFactIds: sortUniqueStrings(planItem.candidateFactIds),
    allowedClaimIds: sortUniqueStrings(planItem.allowedClaimIds),
    riskFlagIds: sortUniqueStrings(planItem.riskFlagIds),
    version: 1,
  };
}

function buildAllowedClaimItem(claim: AllowedClaimV1, graph: EvidenceGraphV1): ReviewCockpitItemV1 {
  const matches = acceptedMatchesForClaim(claim, graph);

  return {
    id: ["review-cockpit-item", "allowed-claims", claim.id].map(normalizePlanIdSegment).join(":"),
    bucket: "allowed_claims",
    title: "Allowed claim is available for planning",
    description: "Allowed claim has source-backed support for review.",
    severity: "info",
    allowedClaimId: claim.id,
    candidateFactId: claim.candidateFactIds[0],
    demandId: matches[0]?.demandId,
    evidenceMatchId: matches[0]?.id,
    sourceFactIds: sortUniqueStrings(claim.candidateFactIds),
    allowedClaimIds: [claim.id],
    riskFlagIds: sortUniqueStrings(claim.candidateFactIds.flatMap((candidateFactId) => riskFlagIdsForFact(candidateFactId, graph))),
    version: 1,
  };
}

function buildSourceSupportItem(claim: AllowedClaimV1, graph: EvidenceGraphV1): ReviewCockpitItemV1 {
  const matches = acceptedMatchesForClaim(claim, graph);

  return {
    id: ["review-cockpit-item", "source-support", claim.id].map(normalizePlanIdSegment).join(":"),
    bucket: "source_support",
    title: "Allowed claim has source support",
    description: "Allowed claim has source-backed support.",
    severity: "info",
    allowedClaimId: claim.id,
    candidateFactId: claim.candidateFactIds[0],
    demandId: matches[0]?.demandId,
    evidenceMatchId: matches[0]?.id,
    sourceFactIds: sortUniqueStrings(claim.candidateFactIds),
    allowedClaimIds: [claim.id],
    riskFlagIds: sortUniqueStrings(claim.candidateFactIds.flatMap((candidateFactId) => riskFlagIdsForFact(candidateFactId, graph))),
    version: 1,
  };
}

function buildReviewCockpitStatus(
  plan: ResumeVariantPlanV1,
  warningCount: number,
  blockerCount: number,
): ReviewCockpitStatusV1 {
  if (plan.blocked || blockerCount > 0) {
    return "blocked";
  }

  if (warningCount > 0) {
    return "needs_review";
  }

  return "ready";
}

function buildSummaryReason(
  status: ReviewCockpitStatusV1,
  warningCount: number,
  blockerCount: number,
  missingEvidenceCount: number,
  blockedClaimCount: number,
): string {
  if (status === "blocked") {
    return `Review cockpit is blocked by ${blockerCount} blocker item(s).`;
  }

  if (status === "needs_review") {
    return `Review cockpit needs review for ${warningCount} warning item(s).`;
  }

  return `Review cockpit is ready with ${missingEvidenceCount} missing evidence item(s) and ${blockedClaimCount} blocked claim item(s).`;
}

function isPlanItemNeedingReview(item: ResumeVariantPlanItemV1): boolean {
  return (
    ATTENTION_REVIEW_STATES.has(item.reviewState) ||
    item.action === "block" ||
    item.action === "needs_review"
  );
}

function findPlanItemForWarning(
  warning: ResumeVariantPlanWarningV1,
  plan: ResumeVariantPlanV1,
): ResumeVariantPlanItemV1 | undefined {
  return sortPlanItems(plan.items).find((item) => {
    if (warning.demandId && item.demandIds.includes(warning.demandId)) {
      return true;
    }
    if (warning.riskFlagId && item.riskFlagIds.includes(warning.riskFlagId)) {
      return true;
    }
    if (warning.candidateFactId && item.candidateFactIds.includes(warning.candidateFactId)) {
      return true;
    }
    return false;
  });
}

function acceptedMatchesForClaim(claim: AllowedClaimV1, graph: EvidenceGraphV1): readonly EvidenceMatchV1[] {
  const claimFactIds = new Set(claim.candidateFactIds);
  return sortEvidenceMatches(
    graph.matches.filter((match) => claimFactIds.has(match.candidateFactId) && match.reviewState === "accepted"),
  );
}

function firstEvidenceMatchIdForFact(candidateFactId: string, graph: EvidenceGraphV1): string | undefined {
  return sortEvidenceMatches(
    graph.matches.filter((match) => match.candidateFactId === candidateFactId),
  )[0]?.id;
}

function riskFlagIdsForFact(candidateFactId: string, graph: EvidenceGraphV1): readonly string[] {
  return sortUniqueStrings(
    graph.riskFlags
      .filter((riskFlag) => riskFlag.candidateFactId === candidateFactId)
      .map((riskFlag) => riskFlag.id),
  );
}

function normalizeItemIds(item: ReviewCockpitItemV1): ReviewCockpitItemV1 {
  return {
    ...item,
    sourceFactIds: sortUniqueStrings(item.sourceFactIds),
    allowedClaimIds: sortUniqueStrings(item.allowedClaimIds),
    riskFlagIds: sortUniqueStrings(item.riskFlagIds),
  };
}

function compareReviewItems(a: ReviewCockpitItemV1, b: ReviewCockpitItemV1): number {
  return groupOrder(a) - groupOrder(b) || a.id.localeCompare(b.id);
}

function groupOrder(item: ReviewCockpitItemV1): number {
  if (item.bucket === "warnings" && item.severity === "blocker") {
    return 1;
  }
  if (item.bucket === "warnings") {
    return 2;
  }
  if (item.bucket === "missing_evidence") {
    return 3;
  }
  if (item.bucket === "blocked_claims") {
    return 4;
  }
  if (item.bucket === "plan_items") {
    return 5;
  }
  if (item.bucket === "allowed_claims" || item.bucket === "source_support") {
    return 6;
  }
  return 7;
}

function sortPlanWarnings(warnings: readonly ResumeVariantPlanWarningV1[]): readonly ResumeVariantPlanWarningV1[] {
  return [...warnings].sort((a, b) => a.id.localeCompare(b.id));
}

function sortPlanItems(items: readonly ResumeVariantPlanItemV1[]): readonly ResumeVariantPlanItemV1[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function sortMissingEvidence(missing: readonly MissingEvidenceV1[]): readonly MissingEvidenceV1[] {
  return [...missing].sort((a, b) => a.id.localeCompare(b.id));
}

function sortAllowedClaims(allowedClaims: readonly AllowedClaimV1[]): readonly AllowedClaimV1[] {
  return [...allowedClaims].sort((a, b) => a.id.localeCompare(b.id));
}

function sortEvidenceMatches(matches: readonly EvidenceMatchV1[]): readonly EvidenceMatchV1[] {
  return [...matches].sort((a, b) => a.id.localeCompare(b.id));
}

function isBuildReviewCockpitInput(
  value: BuildReviewCockpitInputV1 | ReviewCockpitModelV1,
): value is BuildReviewCockpitInputV1 {
  return "evidenceGraph" in value;
}

function assertReviewCockpitHashInput(input: BuildReviewCockpitInputV1): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("invalid ReviewCockpit hash input");
  }

  if (!input.userId || !input.applicationContextId) {
    throw new TypeError("ReviewCockpit hash input requires userId and applicationContextId");
  }

  if (!input.evidenceGraph?.id || !input.resumeVariantPlan?.id) {
    throw new TypeError("ReviewCockpit hash input requires EvidenceGraph and ResumeVariantPlan");
  }

  if (!Number.isFinite(input.createdAt)) {
    throw new TypeError("ReviewCockpit hash input requires a numeric createdAt timestamp");
  }
}

function assertReviewCockpitInput(input: BuildReviewCockpitInputV1): void {
  assertReviewCockpitHashInput(input);

  if (input.userId !== input.evidenceGraph.userId) {
    throw new TypeError("ReviewCockpit input userId must match EvidenceGraph");
  }

  if (input.userId !== input.resumeVariantPlan.userId) {
    throw new TypeError("ReviewCockpit input userId must match ResumeVariantPlan");
  }

  if (input.evidenceGraph.id !== input.resumeVariantPlan.evidenceGraphId) {
    throw new TypeError("ReviewCockpit input requires plan and EvidenceGraph IDs to match");
  }

  if (input.applicationContextId !== input.evidenceGraph.applicationContextId) {
    throw new TypeError("ReviewCockpit input applicationContextId must match EvidenceGraph");
  }

  if (input.applicationContextId !== input.resumeVariantPlan.applicationContextId) {
    throw new TypeError("ReviewCockpit input applicationContextId must match ResumeVariantPlan");
  }
}
