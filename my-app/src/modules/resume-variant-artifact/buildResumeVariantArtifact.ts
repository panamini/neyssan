import { buildStableHash } from "../application-harness/fingerprints";
import {
  isClaimBackedResumeVariantPlanAction,
  isForbiddenResumeOrCoverLetterText,
  normalizePlanIdSegment,
  sortUniqueStrings,
} from "../resume-variant-plan/planRules";
import type {
  ResumeVariantPlanActionV1,
  ResumeVariantPlanItemV1,
  ResumeVariantPlanPriorityV1,
} from "../resume-variant-plan/schema";
import type { ReviewCockpitItemV1 } from "../review-cockpit/schema";
import {
  compareResumeVariantArtifactItems,
  labelForResumeVariantArtifactItem,
  mapPlanSectionToResumeVariantArtifactSection,
  noteForResumeVariantArtifactItem,
  RESUME_VARIANT_ARTIFACT_SECTION_ORDER,
  titleForResumeVariantArtifactSection,
} from "./artifactRules";
import type {
  BuildResumeVariantArtifactInputV1,
  ResumeVariantArtifactContentV1,
  ResumeVariantArtifactItemKindV1,
  ResumeVariantArtifactItemV1,
  ResumeVariantArtifactSectionKindV1,
  ResumeVariantArtifactSectionV1,
  ResumeVariantArtifactStatusV1,
  ResumeVariantArtifactV1,
} from "./schema";

const HASH_NAMESPACE = "resume-variant-artifact";
const ARTIFACT_ID_PREFIX = "resume-variant-artifact:";
const EVIDENCE_GRAPH_ID_PREFIX = "evidence-graph:";
const RESUME_VARIANT_PLAN_ID_PREFIX = "resume-variant-plan:";
const BLOCKED_CLAIM_ID_PREFIX = "blocked-claim:";

const SOURCE_BACKED_EXCLUDED_RISK_CATEGORIES = new Set([
  "private_fact",
  "never_use_fact",
  "generated_text_as_fact",
]);

type RollupKey =
  | "sourceFactIds"
  | "allowedClaimIds"
  | "evidenceMatchIds"
  | "demandIds"
  | "riskFlagIds"
  | "reviewItemIds";

type PlanItemMeta = Readonly<{
  priority: ResumeVariantPlanPriorityV1;
  action: ResumeVariantPlanActionV1;
}>;

type StableResumeVariantArtifactHashInput = Readonly<{
  userId: string;
  applicationContextId: string;
  targetDocumentKind: "resume" | "cv";
  language?: string;
  market?: string;
  evidenceGraph: BuildResumeVariantArtifactInputV1["evidenceGraph"];
  resumeVariantPlan: BuildResumeVariantArtifactInputV1["resumeVariantPlan"];
  reviewCockpit: BuildResumeVariantArtifactInputV1["reviewCockpit"];
}>;

type StableResumeVariantArtifactForHash = Omit<
  ResumeVariantArtifactV1,
  "id" | "createdAt" | "updatedAt"
>;

export async function buildResumeVariantArtifact(
  input: BuildResumeVariantArtifactInputV1,
): Promise<ResumeVariantArtifactV1> {
  assertResumeVariantArtifactInput(input);

  const sections = buildResumeVariantArtifactSections(input);
  const status = deriveResumeVariantArtifactStatus(input, sections);

  const artifact: ResumeVariantArtifactV1 = {
    id: `${ARTIFACT_ID_PREFIX}${await buildResumeVariantArtifactHash(input)}`,
    userId: input.userId,
    applicationContextId: input.applicationContextId,
    targetDocumentKind: input.targetDocumentKind,
    language: input.language,
    market: input.market,
    status,
    sections,
    warnings: buildResumeVariantArtifactWarnings(input, status),
    blockedReason: buildResumeVariantArtifactBlockedReason(input, status),
    provenance: {
      applicationContextId: input.applicationContextId,
      evidenceGraphId: input.evidenceGraph.id,
      evidenceGraphHash: stripIdPrefix(input.evidenceGraph.id, EVIDENCE_GRAPH_ID_PREFIX),
      resumeVariantPlanId: input.resumeVariantPlan.id,
      resumeVariantPlanHash: stripIdPrefix(input.resumeVariantPlan.id, RESUME_VARIANT_PLAN_ID_PREFIX),
      reviewCockpitId: input.reviewCockpit.id,
      sourceFactIds: collectIdsFromSections(sections, "sourceFactIds"),
      allowedClaimIds: collectIdsFromSections(sections, "allowedClaimIds"),
      evidenceMatchIds: collectIdsFromSections(sections, "evidenceMatchIds"),
      demandIds: collectIdsFromSections(sections, "demandIds"),
      riskFlagIds: collectIdsFromSections(sections, "riskFlagIds"),
      reviewItemIds: collectIdsFromSections(sections, "reviewItemIds"),
      version: 1,
    },
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    version: 1,
  };

  assertResumeVariantArtifactEvidenceBacked(artifact, input);
  assertResumeVariantArtifactDoesNotContainGeneratedText(artifact);

  return artifact;
}

export function buildResumeVariantArtifactHash(
  input: BuildResumeVariantArtifactInputV1,
): Promise<string> {
  assertResumeVariantArtifactInput(input);

  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "resume-variant-artifact-input",
    version: 1,
    input: buildStableArtifactHashInput(input),
  });
}

export function buildResumeVariantArtifactContentHash(
  artifact: ResumeVariantArtifactV1,
): Promise<string> {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "resume-variant-artifact-content",
    version: 1,
    artifact: buildStableArtifactForHash(artifact),
  });
}

export function buildResumeVariantArtifactSections(
  input: BuildResumeVariantArtifactInputV1,
): readonly ResumeVariantArtifactSectionV1[] {
  assertResumeVariantArtifactInput(input);

  const planItemMetaById = new Map(
    input.resumeVariantPlan.items.map((item): [string, PlanItemMeta] => [
      item.id,
      { priority: item.priority, action: item.action },
    ]),
  );
  const planItemsById = new Map(input.resumeVariantPlan.items.map((item) => [item.id, item]));
  const itemsBySection = new Map<ResumeVariantArtifactSectionKindV1, ResumeVariantArtifactItemV1[]>();

  const artifactItems = [
    ...input.resumeVariantPlan.items
      .filter((item) => item.reviewState !== "rejected")
      .map((item) => buildArtifactItemFromPlanItem(item, input)),
    ...input.reviewCockpit.items
      .filter(
        (item) =>
          findMatchingPlanItemForReviewItem(item, input, planItemsById)
            ?.reviewState !== "rejected",
      )
      .map((item) =>
        buildArtifactItemFromReviewItem(item, input, planItemsById),
      ),
  ].map(normalizeArtifactItemIds);

  for (const item of artifactItems) {
    itemsBySection.set(item.section, [...(itemsBySection.get(item.section) ?? []), item]);
  }

  return RESUME_VARIANT_ARTIFACT_SECTION_ORDER
    .filter((section) => itemsBySection.has(section))
    .map((section) => buildArtifactSection(section, itemsBySection.get(section) ?? [], planItemMetaById));
}

export function buildResumeVariantArtifactContent(
  artifact: ResumeVariantArtifactV1,
): ResumeVariantArtifactContentV1 {
  return { kind: "resume_variant_artifact", artifact, version: 1 };
}

export function assertResumeVariantArtifactInput(input: BuildResumeVariantArtifactInputV1): void {
  assertBasicResumeVariantArtifactInput(input);

  if (input.userId !== input.evidenceGraph.userId) {
    throw new TypeError("ResumeVariantArtifact input userId must match EvidenceGraph");
  }
  if (input.userId !== input.resumeVariantPlan.userId) {
    throw new TypeError("ResumeVariantArtifact input userId must match ResumeVariantPlan");
  }
  if (input.userId !== input.reviewCockpit.userId) {
    throw new TypeError("ResumeVariantArtifact input userId must match ReviewCockpit");
  }
  if (input.applicationContextId !== input.evidenceGraph.applicationContextId) {
    throw new TypeError("ResumeVariantArtifact input applicationContextId must match EvidenceGraph");
  }
  if (input.applicationContextId !== input.resumeVariantPlan.applicationContextId) {
    throw new TypeError("ResumeVariantArtifact input applicationContextId must match ResumeVariantPlan");
  }
  if (input.applicationContextId !== input.reviewCockpit.applicationContextId) {
    throw new TypeError("ResumeVariantArtifact input applicationContextId must match ReviewCockpit");
  }
  if (input.resumeVariantPlan.evidenceGraphId !== input.evidenceGraph.id) {
    throw new TypeError(
      "ResumeVariantArtifact input requires ResumeVariantPlan evidenceGraphId to match EvidenceGraph",
    );
  }
  if (input.reviewCockpit.evidenceGraphId !== input.evidenceGraph.id) {
    throw new TypeError(
      "ResumeVariantArtifact input requires ReviewCockpit evidenceGraphId to match EvidenceGraph",
    );
  }
  if (input.reviewCockpit.resumeVariantPlanId !== input.resumeVariantPlan.id) {
    throw new TypeError(
      "ResumeVariantArtifact input requires ReviewCockpit resumeVariantPlanId to match ResumeVariantPlan",
    );
  }
}

export function assertResumeVariantArtifactEvidenceBacked(
  artifact: ResumeVariantArtifactV1,
  input: BuildResumeVariantArtifactInputV1,
): void {
  const allowedClaimsById = new Map(input.evidenceGraph.allowedClaims.map((claim) => [claim.id, claim]));
  const evidenceMatchIds = new Set(input.evidenceGraph.matches.map((match) => match.id));
  const demandIds = new Set(input.evidenceGraph.demands.map((demand) => demand.id));
  const riskFlagIds = new Set(input.evidenceGraph.riskFlags.map((riskFlag) => riskFlag.id));
  const reviewItemIds = new Set(input.reviewCockpit.items.map((item) => item.id));
  const knownSourceFactIds = collectKnownSourceFactIds(input);
  const blockedSourceFactIds = collectBlockedSourceFactIds(input);

  for (const item of artifact.sections.flatMap((section) => section.items)) {
    assertArtifactItemReferencesKnownIds(item, {
      allowedClaimsById,
      evidenceMatchIds,
      demandIds,
      riskFlagIds,
      reviewItemIds,
      knownSourceFactIds,
    });

    if (item.candidateFactId && !knownSourceFactIds.has(item.candidateFactId)) {
      throw new TypeError(`unknown candidate fact ${item.candidateFactId}`);
    }
    if (item.allowedClaimId && !allowedClaimsById.has(item.allowedClaimId)) {
      throw new TypeError(`unknown allowed claim ${item.allowedClaimId}`);
    }
    if (item.evidenceMatchId && !evidenceMatchIds.has(item.evidenceMatchId)) {
      throw new TypeError(`unknown evidence match ${item.evidenceMatchId}`);
    }
    if (item.demandId && !demandIds.has(item.demandId)) {
      throw new TypeError(`unknown demand ${item.demandId}`);
    }
    if (item.riskFlagId && !riskFlagIds.has(item.riskFlagId)) {
      throw new TypeError(`unknown risk flag ${item.riskFlagId}`);
    }

    if (item.kind === "source_backed_claim") {
      assertSourceBackedArtifactItem(item, input, allowedClaimsById, blockedSourceFactIds);
    }
  }
}

export function assertResumeVariantArtifactDoesNotContainGeneratedText(
  artifact: ResumeVariantArtifactV1,
): void {
  const values = [
    artifact.blockedReason,
    ...artifact.warnings,
    ...artifact.sections.flatMap((section) => [
      section.title,
      ...section.items.flatMap((item) => [item.label, item.note]),
    ]),
  ].filter((value): value is string => typeof value === "string");

  for (const value of values) {
    if (isForbiddenResumeOrCoverLetterText(value)) {
      throw new Error("ResumeVariantArtifact contains generated resume or cover-letter text");
    }
  }
}

export function collectResumeVariantArtifactSourceFactIds(
  artifact: ResumeVariantArtifactV1,
): readonly string[] {
  return collectIdsFromSections(artifact.sections, "sourceFactIds");
}

export function collectResumeVariantArtifactAllowedClaimIds(
  artifact: ResumeVariantArtifactV1,
): readonly string[] {
  return collectIdsFromSections(artifact.sections, "allowedClaimIds");
}

export function collectResumeVariantArtifactEvidenceMatchIds(
  artifact: ResumeVariantArtifactV1,
): readonly string[] {
  return collectIdsFromSections(artifact.sections, "evidenceMatchIds");
}

export function collectResumeVariantArtifactDemandIds(
  artifact: ResumeVariantArtifactV1,
): readonly string[] {
  return collectIdsFromSections(artifact.sections, "demandIds");
}

export function collectResumeVariantArtifactRiskFlagIds(
  artifact: ResumeVariantArtifactV1,
): readonly string[] {
  return collectIdsFromSections(artifact.sections, "riskFlagIds");
}

export function collectResumeVariantArtifactReviewItemIds(
  artifact: ResumeVariantArtifactV1,
): readonly string[] {
  return collectIdsFromSections(artifact.sections, "reviewItemIds");
}

function buildArtifactItemFromPlanItem(
  planItem: ResumeVariantPlanItemV1,
  input: BuildResumeVariantArtifactInputV1,
): ResumeVariantArtifactItemV1 {
  const kind = deriveArtifactItemKindFromPlanItem(planItem, input);
  const section = mapPlanSectionToResumeVariantArtifactSection(planItem.section);
  const sourceFactIds = sortStrings(planItem.candidateFactIds);
  const allowedClaimIds = sortStrings(planItem.allowedClaimIds);
  const evidenceMatchIds = sortStrings(planItem.evidenceMatchIds);
  const demandIds = sortStrings(planItem.demandIds);
  const riskFlagIds = sortStrings(planItem.riskFlagIds);

  return {
    id: ["resume-variant-artifact-item", section, kind, planItem.id]
      .map(normalizePlanIdSegment)
      .join(":"),
    kind,
    section,
    planItemId: planItem.id,
    allowedClaimId: allowedClaimIds[0],
    candidateFactId: kind === "source_backed_claim" ? sourceFactIds[0] : undefined,
    evidenceMatchId: evidenceMatchIds[0],
    demandId: demandIds[0],
    riskFlagId: riskFlagIds[0],
    sourceFactIds,
    allowedClaimIds,
    evidenceMatchIds,
    demandIds,
    riskFlagIds,
    reviewItemIds: [],
    label: labelForResumeVariantArtifactItem(kind),
    note: noteForResumeVariantArtifactItem(kind),
    version: 1,
  };
}

function buildArtifactItemFromReviewItem(
  reviewItem: ReviewCockpitItemV1,
  input: BuildResumeVariantArtifactInputV1,
  planItemsById: ReadonlyMap<string, ResumeVariantPlanItemV1>,
): ResumeVariantArtifactItemV1 {
  const kind = deriveArtifactItemKindFromReviewItem(reviewItem);
  const matchingPlanItem = findMatchingPlanItemForReviewItem(reviewItem, input, planItemsById);
  const section = matchingPlanItem
    ? mapPlanSectionToResumeVariantArtifactSection(matchingPlanItem.section)
    : "other";

  return {
    id: ["resume-variant-artifact-item", section, kind, reviewItem.id]
      .map(normalizePlanIdSegment)
      .join(":"),
    kind,
    section,
    planItemId: reviewItem.planItemId,
    allowedClaimId: reviewItem.allowedClaimId,
    candidateFactId: reviewItem.candidateFactId,
    evidenceMatchId: reviewItem.evidenceMatchId,
    demandId: reviewItem.demandId,
    riskFlagId: reviewItem.riskFlagId ?? reviewItem.riskFlagIds[0],
    sourceFactIds: sortStrings(reviewItem.sourceFactIds),
    allowedClaimIds: sortStrings(reviewItem.allowedClaimIds),
    evidenceMatchIds: sortStrings(reviewItem.evidenceMatchId ? [reviewItem.evidenceMatchId] : []),
    demandIds: sortStrings(reviewItem.demandId ? [reviewItem.demandId] : []),
    riskFlagIds: sortStrings(reviewItem.riskFlagIds),
    reviewItemIds: [reviewItem.id],
    label: labelForResumeVariantArtifactItem(kind),
    note: noteForResumeVariantArtifactItem(kind),
    version: 1,
  };
}

function deriveArtifactItemKindFromPlanItem(
  planItem: ResumeVariantPlanItemV1,
  input: BuildResumeVariantArtifactInputV1,
): ResumeVariantArtifactItemKindV1 {
  if (isSafeSourceBackedPlanItem(planItem, input)) {
    return "source_backed_claim";
  }
  if (planItem.riskFlagIds.length > 0) {
    return "risk_notice";
  }
  if (planItem.action === "block") {
    return "blocked_claim_notice";
  }
  if (
    planItem.action === "needs_review" ||
    planItem.reviewState === "pending" ||
    planItem.reviewState === "needs_review" ||
    planItem.reviewState === "blocked"
  ) {
    return "review_notice";
  }
  return "plan_instruction";
}

function deriveArtifactItemKindFromReviewItem(
  reviewItem: ReviewCockpitItemV1,
): ResumeVariantArtifactItemKindV1 {
  if (reviewItem.bucket === "missing_evidence") {
    return "missing_evidence_notice";
  }
  if (reviewItem.bucket === "blocked_claims") {
    return "blocked_claim_notice";
  }
  if (reviewItem.riskFlagId || reviewItem.riskFlagIds.length > 0) {
    return "risk_notice";
  }
  return "review_notice";
}

function isSafeSourceBackedPlanItem(
  planItem: ResumeVariantPlanItemV1,
  input: BuildResumeVariantArtifactInputV1,
): boolean {
  if (
    !isClaimBackedResumeVariantPlanAction(planItem.action) ||
    planItem.allowedClaimIds.length === 0 ||
    planItem.candidateFactIds.length === 0
  ) {
    return false;
  }
  if (
    planItem.reviewState !== "accepted"
  ) {
    return false;
  }
  if (
    planItem.candidateFactIds.some((factId) =>
      input.evidenceGraph.blockedClaimIds.includes(`${BLOCKED_CLAIM_ID_PREFIX}${factId}`),
    )
  ) {
    return false;
  }
  return !planItem.candidateFactIds.some((factId) =>
    input.evidenceGraph.riskFlags.some(
      (riskFlag) =>
        riskFlag.candidateFactId === factId &&
        SOURCE_BACKED_EXCLUDED_RISK_CATEGORIES.has(riskFlag.category),
    ),
  );
}

function findMatchingPlanItemForReviewItem(
  reviewItem: ReviewCockpitItemV1,
  input: BuildResumeVariantArtifactInputV1,
  planItemsById: ReadonlyMap<string, ResumeVariantPlanItemV1>,
): ResumeVariantPlanItemV1 | undefined {
  if (reviewItem.planItemId) {
    return planItemsById.get(reviewItem.planItemId);
  }
  return input.resumeVariantPlan.items
    .map((planItem) => ({
      planItem,
      score:
        (reviewItem.allowedClaimId &&
        planItem.allowedClaimIds.includes(reviewItem.allowedClaimId)
          ? 8
          : 0) +
        (reviewItem.evidenceMatchId &&
        planItem.evidenceMatchIds.includes(reviewItem.evidenceMatchId)
          ? 4
          : 0) +
        (reviewItem.sourceFactIds.some((factId) =>
          planItem.candidateFactIds.includes(factId),
        )
          ? 2
          : 0) +
        (reviewItem.demandId &&
        planItem.demandIds.includes(reviewItem.demandId)
          ? 1
          : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.planItem.id.localeCompare(right.planItem.id),
    )[0]?.planItem;
}

function buildArtifactSection(
  kind: ResumeVariantArtifactSectionKindV1,
  items: readonly ResumeVariantArtifactItemV1[],
  planItemMetaById: ReadonlyMap<string, PlanItemMeta>,
): ResumeVariantArtifactSectionV1 {
  const sortedItems = [...items].sort((a, b) =>
    compareResumeVariantArtifactItems(a, b, planItemMetaById),
  );
  return {
    id: ["resume-variant-artifact-section", kind].map(normalizePlanIdSegment).join(":"),
    kind,
    title: titleForResumeVariantArtifactSection(kind),
    items: sortedItems,
    sourceFactIds: collectIdsFromItems(sortedItems, "sourceFactIds"),
    allowedClaimIds: collectIdsFromItems(sortedItems, "allowedClaimIds"),
    evidenceMatchIds: collectIdsFromItems(sortedItems, "evidenceMatchIds"),
    demandIds: collectIdsFromItems(sortedItems, "demandIds"),
    riskFlagIds: collectIdsFromItems(sortedItems, "riskFlagIds"),
    reviewItemIds: collectIdsFromItems(sortedItems, "reviewItemIds"),
    version: 1,
  };
}

function normalizeArtifactItemIds(item: ResumeVariantArtifactItemV1): ResumeVariantArtifactItemV1 {
  return {
    ...item,
    sourceFactIds: sortStrings(item.sourceFactIds),
    allowedClaimIds: sortStrings(item.allowedClaimIds),
    evidenceMatchIds: sortStrings(item.evidenceMatchIds),
    demandIds: sortStrings(item.demandIds),
    riskFlagIds: sortStrings(item.riskFlagIds),
    reviewItemIds: sortStrings(item.reviewItemIds),
  };
}

function deriveResumeVariantArtifactStatus(
  input: BuildResumeVariantArtifactInputV1,
  sections: readonly ResumeVariantArtifactSectionV1[],
): ResumeVariantArtifactStatusV1 {
  if (input.resumeVariantPlan.blocked || input.reviewCockpit.summary.status === "blocked") {
    return "blocked";
  }
  if (input.reviewCockpit.summary.status === "needs_review") {
    return "needs_review";
  }
  return sections.some((section) => section.items.some((item) => item.kind === "source_backed_claim"))
    ? "ready_for_generation"
    : "draft";
}

function buildResumeVariantArtifactWarnings(
  input: BuildResumeVariantArtifactInputV1,
  status: ResumeVariantArtifactStatusV1,
): readonly string[] {
  return sortStrings([
    status === "blocked" ? "Resume variant artifact is blocked until review resolves blockers." : undefined,
    status === "needs_review" ? "Resume variant artifact needs review before generation." : undefined,
    ...input.resumeVariantPlan.warnings.map((warning) => `Plan warning preserved for review: ${warning.id}`),
    ...input.reviewCockpit.items
      .filter((item) => item.severity !== "info")
      .map((item) => `Review cockpit item preserved for review: ${item.id}`),
  ]);
}

function buildResumeVariantArtifactBlockedReason(
  input: BuildResumeVariantArtifactInputV1,
  status: ResumeVariantArtifactStatusV1,
): string | undefined {
  if (status !== "blocked") {
    return undefined;
  }
  return input.resumeVariantPlan.blocked ? "Blocked by ResumeVariantPlan." : "Blocked by ReviewCockpit.";
}

function buildStableArtifactHashInput(
  input: BuildResumeVariantArtifactInputV1,
): StableResumeVariantArtifactHashInput {
  return {
    userId: input.userId,
    applicationContextId: input.applicationContextId,
    targetDocumentKind: input.targetDocumentKind,
    language: input.language,
    market: input.market,
    evidenceGraph: input.evidenceGraph,
    resumeVariantPlan: input.resumeVariantPlan,
    reviewCockpit: input.reviewCockpit,
  };
}

function buildStableArtifactForHash(
  artifact: ResumeVariantArtifactV1,
): StableResumeVariantArtifactForHash {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...stableArtifact } = artifact;
  return stableArtifact;
}

function assertArtifactItemReferencesKnownIds(
  item: ResumeVariantArtifactItemV1,
  context: Readonly<{
    allowedClaimsById: ReadonlyMap<string, BuildResumeVariantArtifactInputV1["evidenceGraph"]["allowedClaims"][number]>;
    evidenceMatchIds: ReadonlySet<string>;
    demandIds: ReadonlySet<string>;
    riskFlagIds: ReadonlySet<string>;
    reviewItemIds: ReadonlySet<string>;
    knownSourceFactIds: ReadonlySet<string>;
  }>,
): void {
  for (const id of item.allowedClaimIds) {
    if (!context.allowedClaimsById.has(id)) throw new TypeError(`unknown allowed claim ${id}`);
  }
  for (const id of item.sourceFactIds) {
    if (!context.knownSourceFactIds.has(id)) throw new TypeError(`unknown source fact ${id}`);
  }
  for (const id of item.evidenceMatchIds) {
    if (!context.evidenceMatchIds.has(id)) throw new TypeError(`unknown evidence match ${id}`);
  }
  for (const id of item.demandIds) {
    if (!context.demandIds.has(id)) throw new TypeError(`unknown demand ${id}`);
  }
  for (const id of item.riskFlagIds) {
    if (!context.riskFlagIds.has(id)) throw new TypeError(`unknown risk flag ${id}`);
  }
  for (const id of item.reviewItemIds) {
    if (!context.reviewItemIds.has(id)) throw new TypeError(`unknown review item ${id}`);
  }
}

function assertSourceBackedArtifactItem(
  item: ResumeVariantArtifactItemV1,
  input: BuildResumeVariantArtifactInputV1,
  allowedClaimsById: ReadonlyMap<string, BuildResumeVariantArtifactInputV1["evidenceGraph"]["allowedClaims"][number]>,
  blockedSourceFactIds: ReadonlySet<string>,
): void {
  if (item.allowedClaimIds.length === 0) {
    throw new TypeError("source_backed_claim lacks allowedClaimIds");
  }
  if (item.sourceFactIds.length === 0) {
    throw new TypeError("source_backed_claim lacks sourceFactIds");
  }
  for (const sourceFactId of item.sourceFactIds) {
    if (blockedSourceFactIds.has(sourceFactId)) {
      throw new TypeError(`blocked source fact ${sourceFactId}`);
    }
    if (!item.allowedClaimIds.some((claimId) => allowedClaimsById.get(claimId)?.candidateFactIds.includes(sourceFactId))) {
      throw new TypeError(`source fact does not map to allowed claims ${sourceFactId}`);
    }
    if (
      input.evidenceGraph.riskFlags.some(
        (riskFlag) =>
          riskFlag.candidateFactId === sourceFactId &&
          SOURCE_BACKED_EXCLUDED_RISK_CATEGORIES.has(riskFlag.category),
      )
    ) {
      throw new TypeError(`excluded source fact ${sourceFactId}`);
    }
  }
}

function collectKnownSourceFactIds(input: BuildResumeVariantArtifactInputV1): ReadonlySet<string> {
  return new Set(
    sortStrings([
      ...input.resumeVariantPlan.sourceFactIds,
      ...input.resumeVariantPlan.items.flatMap((item) => item.candidateFactIds),
      ...input.reviewCockpit.items.flatMap((item) => item.sourceFactIds),
      ...input.reviewCockpit.items.map((item) => item.candidateFactId),
      ...input.evidenceGraph.allowedClaims.flatMap((claim) => claim.candidateFactIds),
    ]),
  );
}

function collectBlockedSourceFactIds(input: BuildResumeVariantArtifactInputV1): ReadonlySet<string> {
  return new Set(
    input.evidenceGraph.blockedClaimIds
      .filter((id) => id.startsWith(BLOCKED_CLAIM_ID_PREFIX))
      .map((id) => id.slice(BLOCKED_CLAIM_ID_PREFIX.length)),
  );
}

function assertBasicResumeVariantArtifactInput(input: BuildResumeVariantArtifactInputV1): void {
  if (!input?.userId || !input.applicationContextId || !input.evidenceGraph?.id || !input.resumeVariantPlan?.id || !input.reviewCockpit?.id) {
    throw new TypeError("invalid ResumeVariantArtifact input");
  }
  if (input.targetDocumentKind !== "resume" && input.targetDocumentKind !== "cv") {
    throw new TypeError("ResumeVariantArtifact targetDocumentKind must be resume or cv");
  }
  if (!Number.isFinite(input.createdAt) || !Number.isFinite(input.updatedAt)) {
    throw new TypeError("ResumeVariantArtifact input requires numeric timestamps");
  }
}

function sortStrings(values: readonly (string | undefined)[]): readonly string[] {
  return sortUniqueStrings(values.filter((value): value is string => Boolean(value)));
}

function collectIdsFromSections(
  sections: readonly ResumeVariantArtifactSectionV1[],
  key: RollupKey,
): readonly string[] {
  return sortStrings(sections.flatMap((section) => section[key]));
}

function collectIdsFromItems(
  items: readonly ResumeVariantArtifactItemV1[],
  key: RollupKey,
): readonly string[] {
  return sortStrings(items.flatMap((item) => item[key]));
}

function stripIdPrefix(id: string, prefix: string): string {
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}
