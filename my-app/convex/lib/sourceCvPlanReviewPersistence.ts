import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { AutoRecommendedSourceCvApplicationCompositionResultV1 } from "../../src/modules/application-harness/sourceCvApplicationComposition";
import { buildResumeVariantPlanHash } from "../../src/modules/resume-variant-plan/buildResumeVariantPlan";
import { reviewResumeVariantPlan } from "../../src/modules/resume-variant-plan/reviewResumeVariantPlan";
import type {
  ResumeVariantPlanReviewDecisionV1,
} from "../../src/modules/resume-variant-plan/reviewResumeVariantPlan";
import type { ResumeVariantPlanV1 } from "../../src/modules/resume-variant-plan/schema";
import type { EvidenceGraphV1 } from "../../src/modules/evidence-graph/schema";
import { buildReviewCockpitSummary } from "../../src/modules/review-cockpit/buildReviewCockpit";

const REVIEW_ARTIFACT_ID_PREFIX =
  "application-artifact:source-cv-plan-review:";
const PLAN_ID_PREFIX = "resume-variant-plan:";

type ReviewCompositionV1 =
  AutoRecommendedSourceCvApplicationCompositionResultV1;

type ReviewPlanInputV1 = Readonly<{
  db: MutationCtx["db"];
  composition: ReviewCompositionV1;
  requestedJobId: string;
  expectedPlanId: string;
  decisions: readonly ResumeVariantPlanReviewDecisionV1[];
  updatedAt: number;
}>;

export async function loadPersistedSourceCvPlanReview(
  db: QueryCtx["db"],
  composition: ReviewCompositionV1,
  requestedJobId: string,
): Promise<ReviewCompositionV1> {
  const reviewContext = await requireReviewContext(
    db,
    composition,
    requestedJobId,
  );
  const artifact = await findReviewArtifact(db, composition);
  if (!artifact) {
    return composition;
  }

  const plan = await readCurrentReviewedPlan({
    artifact,
    pendingPlan: composition.plan,
    requestedJobId,
    contextHash: reviewContext.contextHash,
  });
  return { ...composition, plan };
}

export async function reviewAndPersistSourceCvPlan(
  input: ReviewPlanInputV1,
): Promise<ReviewCompositionV1> {
  if (!Number.isFinite(input.updatedAt)) {
    throw new TypeError("source CV plan review requires a numeric timestamp");
  }

  const reviewContext = await requireReviewContext(
    input.db,
    input.composition,
    input.requestedJobId,
  );
  const existing = await findReviewArtifact(input.db, input.composition);
  const currentPlan = existing
    ? await readCurrentReviewedPlan({
        artifact: existing,
        pendingPlan: input.composition.plan,
        requestedJobId: input.requestedJobId,
        contextHash: reviewContext.contextHash,
      })
    : input.composition.plan;
  assertDesiredReviewDecisions(currentPlan, input.decisions);
  if (areDesiredReviewDecisionsApplied(currentPlan, input.decisions)) {
    if (
      input.expectedPlanId === currentPlan.id ||
      (existing && input.expectedPlanId === input.composition.plan.id)
    ) {
      return { ...input.composition, plan: currentPlan };
    }
    throw new TypeError("stale ResumeVariantPlan review");
  }
  if (input.expectedPlanId !== currentPlan.id) {
    throw new TypeError("stale ResumeVariantPlan review");
  }

  const applicationScopedPlan =
    isApplicationScopedSourceCvSelectionPlan(currentPlan);
  const reviewedPlan = applicationScopedPlan
    ? await reviewApplicationScopedSourceCvSelectionPlan({
        plan: currentPlan,
        decisions: input.decisions,
        updatedAt: input.updatedAt,
      })
    : await reviewResumeVariantPlan({
        userId: input.composition.userId,
        applicationContextId: input.composition.applicationContextId,
        expectedPlanId: input.expectedPlanId,
        plan: currentPlan,
        decisions: input.decisions,
        updatedAt: input.updatedAt,
      });
  const status = applicationScopedPlan
    ? resolveApplicationScopedSourceCvReviewOutcome(
        reviewedPlan,
        input.composition.evidenceGraph,
      ).status
    : (() => {
        const summary = buildReviewCockpitSummary({
          userId: input.composition.userId,
          applicationContextId: input.composition.applicationContextId,
          evidenceGraph: input.composition.evidenceGraph,
          resumeVariantPlan: reviewedPlan,
          createdAt: input.updatedAt,
        });
        return summary.status === "ready"
          ? ("approved" as const)
          : summary.status === "blocked"
            ? ("blocked" as const)
            : ("needs_review" as const);
      })();
  const artifact = {
    id: buildReviewArtifactId(input.composition.plan.id),
    userId: input.composition.userId,
    contextId: input.composition.applicationContextId,
    type: "resume_variant_plan" as const,
    status,
    title: "Source CV variant plan review",
    content: {
      kind: "resume_variant_plan" as const,
      plan: reviewedPlan,
      version: 1 as const,
    },
    sourceHashes: {
      contextHash: reviewContext.contextHash,
      evidenceGraphHash: reviewedPlan.evidenceGraphHash,
    },
    provenance: {
      jobId: input.requestedJobId,
      cvId: input.composition.sourceCvId,
      evidenceGraphId: reviewedPlan.evidenceGraphId,
      sourceFactIds: [...reviewedPlan.sourceFactIds],
    },
    sourceRefs: reviewContext.sourceRefs.map((sourceRef) => ({
      ...sourceRef,
    })),
    createdAt: existing?.createdAt ?? input.updatedAt,
    updatedAt: input.updatedAt,
    version: 1 as const,
  };

  if (existing) {
    await input.db.patch(existing._id, artifact);
  } else {
    await input.db.insert("applicationArtifacts", artifact);
  }

  return { ...input.composition, plan: reviewedPlan };
}

function assertDesiredReviewDecisions(
  plan: ResumeVariantPlanV1,
  decisions: readonly ResumeVariantPlanReviewDecisionV1[],
): void {
  if (!Array.isArray(decisions) || decisions.length === 0) {
    throw new TypeError(
      "reviewResumeVariantPlan requires at least one decision",
    );
  }
  const itemsById = new Map(plan.items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  for (const decision of decisions) {
    if (
      !decision ||
      typeof decision.planItemId !== "string" ||
      !decision.planItemId.trim() ||
      (decision.reviewState !== "accepted" &&
        decision.reviewState !== "rejected")
    ) {
      throw new TypeError("invalid ResumeVariantPlan review decision");
    }
    if (seen.has(decision.planItemId)) {
      throw new TypeError(
        `duplicate ResumeVariantPlan review decision: ${decision.planItemId}`,
      );
    }
    if (!itemsById.has(decision.planItemId)) {
      throw new TypeError(
        `unknown ResumeVariantPlan item: ${decision.planItemId}`,
      );
    }
    seen.add(decision.planItemId);
  }
}

function areDesiredReviewDecisionsApplied(
  plan: ResumeVariantPlanV1,
  decisions: readonly ResumeVariantPlanReviewDecisionV1[],
): boolean {
  const itemsById = new Map(plan.items.map((item) => [item.id, item]));
  return decisions.every(
    (decision) =>
      itemsById.get(decision.planItemId)?.reviewState ===
      decision.reviewState,
  );
}

function isApplicationScopedSourceCvSelectionPlan(
  plan: ResumeVariantPlanV1,
): boolean {
  return (
    plan.sourceFactIds.length === 0 &&
    plan.allowedClaimIds.length === 0 &&
    plan.items.length > 0 &&
    plan.items.every(
      (item) =>
        item.action === "include" &&
        item.candidateFactIds.length === 0 &&
        item.allowedClaimIds.length === 0 &&
        item.evidenceMatchIds.length === 0 &&
        item.riskFlagIds.length === 0 &&
        item.sourceCvItemReferenceIds?.length === 1,
    )
  );
}

async function reviewApplicationScopedSourceCvSelectionPlan(input: {
  plan: ResumeVariantPlanV1;
  decisions: readonly ResumeVariantPlanReviewDecisionV1[];
  updatedAt: number;
}): Promise<ResumeVariantPlanV1> {
  if (
    !Number.isFinite(input.updatedAt) ||
    input.updatedAt < input.plan.updatedAt
  ) {
    throw new TypeError(
      "ResumeVariantPlan review requires a non-decreasing updatedAt",
    );
  }
  const decisionsByItemId = new Map(
    input.decisions.map((decision) => [
      decision.planItemId,
      decision.reviewState,
    ]),
  );
  const reviewedPlan: ResumeVariantPlanV1 = {
    ...input.plan,
    items: input.plan.items.map((item) => {
      const reviewState = decisionsByItemId.get(item.id);
      if (!reviewState) {
        return item;
      }
      if (item.reviewState !== "pending") {
        throw new TypeError(
          `ResumeVariantPlan item is not selectable: ${item.id}`,
        );
      }
      return { ...item, reviewState };
    }),
    updatedAt: input.updatedAt,
  };
  return {
    ...reviewedPlan,
    id: `${PLAN_ID_PREFIX}${await buildResumeVariantPlanHash(reviewedPlan)}`,
  };
}

export function resolveApplicationScopedSourceCvReviewOutcome(
  plan: ResumeVariantPlanV1,
  evidenceGraph: EvidenceGraphV1,
): Readonly<{
  status: "approved" | "blocked" | "needs_review";
  blockedReason?: string;
}> {
  if (
    evidenceGraph.id !== plan.evidenceGraphId ||
    evidenceGraph.userId !== plan.userId ||
    evidenceGraph.applicationContextId !== plan.applicationContextId
  ) {
    throw new TypeError(
      "application-scoped review EvidenceGraph does not match the plan",
    );
  }
  if (
    plan.blocked ||
    plan.items.some((item) => item.reviewState === "blocked")
  ) {
    return {
      status: "blocked",
      ...(plan.blockedReason
        ? { blockedReason: plan.blockedReason }
        : {}),
    };
  }
  if (
    plan.items.some(
      (item) =>
        item.reviewState === "pending" ||
        item.reviewState === "needs_review",
    )
  ) {
    return { status: "needs_review" };
  }

  const requiredDemandIds = new Set(
    evidenceGraph.demands
      .filter((demand) => demand.required === "required")
      .map((demand) => demand.id),
  );
  const acceptedDemandIds = new Set(
    plan.items
      .filter((item) => item.reviewState === "accepted")
      .flatMap((item) => item.demandIds),
  );
  const uncoveredRequiredDemandIds = [...requiredDemandIds].filter(
    (demandId) => !acceptedDemandIds.has(demandId),
  );
  if (uncoveredRequiredDemandIds.length > 0) {
    return {
      status: "blocked",
      blockedReason:
        "Every required Job Brief demand needs at least one accepted source CV item.",
    };
  }

  return {
    status: "approved",
  };
}

function buildReviewArtifactId(pendingPlanId: string): string {
  return `${REVIEW_ARTIFACT_ID_PREFIX}${pendingPlanId}`;
}

async function findReviewArtifact(
  db: QueryCtx["db"],
  composition: ReviewCompositionV1,
) {
  return await db
    .query("applicationArtifacts")
    .withIndex("by_user_id", (q) =>
      q
        .eq("userId", composition.userId)
        .eq("id", buildReviewArtifactId(composition.plan.id)),
    )
    .unique();
}

async function requireReviewContext(
  db: QueryCtx["db"],
  composition: ReviewCompositionV1,
  requestedJobId: string,
) {
  const context = await db
    .query("applicationContexts")
    .withIndex("by_user_id", (q) =>
      q
        .eq("userId", composition.userId)
        .eq("id", composition.applicationContextId),
    )
    .unique();
  if (
    !context ||
    context.userId !== composition.userId ||
    context.job.jobId !== requestedJobId ||
    context.candidate.sourceKind !== "cv" ||
    context.candidate.cvId !== composition.sourceCvId ||
    context.candidate.candidateHash !== composition.sourceCvContextHash
  ) {
    throw new TypeError(
      "source CV plan review context does not match the current composition",
    );
  }
  return context;
}

async function readCurrentReviewedPlan(input: {
  artifact: NonNullable<
    Awaited<ReturnType<typeof findReviewArtifact>>
  >;
  pendingPlan: ResumeVariantPlanV1;
  requestedJobId: string;
  contextHash: string;
}): Promise<ResumeVariantPlanV1> {
  const content = input.artifact.content;
  const plan =
    isResumeVariantPlanArtifactContent(content) ? content.plan : null;
  if (
    input.artifact.type !== "resume_variant_plan" ||
    input.artifact.userId !== input.pendingPlan.userId ||
    input.artifact.contextId !== input.pendingPlan.applicationContextId ||
    input.artifact.sourceHashes.contextHash !== input.contextHash ||
    input.artifact.sourceHashes.evidenceGraphHash !==
      input.pendingPlan.evidenceGraphHash ||
    input.artifact.provenance.jobId !== input.requestedJobId ||
    input.artifact.provenance.cvId !== input.pendingPlan.sourceCvId ||
    !plan
  ) {
    throw new TypeError("persisted source CV plan review is invalid");
  }

  const planHash = await buildResumeVariantPlanHash(plan);
  if (plan.id !== `${PLAN_ID_PREFIX}${planHash}`) {
    throw new TypeError("persisted source CV plan review hash is invalid");
  }

  const pendingItemsById = new Map(
    input.pendingPlan.items.map((item) => [item.id, item]),
  );
  if (
    plan.items.length !== input.pendingPlan.items.length ||
    plan.items.some((item) => {
      const pendingItem = pendingItemsById.get(item.id);
      return (
        !pendingItem ||
        (item.reviewState !== pendingItem.reviewState &&
          (pendingItem.reviewState !== "pending" ||
            (item.reviewState !== "accepted" &&
              item.reviewState !== "rejected")))
      );
    })
  ) {
    throw new TypeError(
      "persisted source CV plan review contains an invalid transition",
    );
  }

  const normalizedPlan: ResumeVariantPlanV1 = {
    ...plan,
    id: input.pendingPlan.id,
    items: plan.items.map((item) => ({
      ...item,
      reviewState: pendingItemsById.get(item.id)?.reviewState ?? item.reviewState,
    })),
    updatedAt: input.pendingPlan.updatedAt,
  };
  const normalizedHash = await buildResumeVariantPlanHash(normalizedPlan);
  const pendingHash = await buildResumeVariantPlanHash(input.pendingPlan);
  if (pendingHash !== normalizedHash) {
    throw new TypeError(
      "persisted source CV plan review does not match the current plan",
    );
  }

  return plan;
}

function isResumeVariantPlanArtifactContent(
  value: unknown,
): value is {
  kind: "resume_variant_plan";
  plan: ResumeVariantPlanV1;
  version: 1;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const content = value as Record<string, unknown>;
  const plan = content.plan;
  return (
    content.kind === "resume_variant_plan" &&
    content.version === 1 &&
    Boolean(plan) &&
    typeof plan === "object" &&
    !Array.isArray(plan) &&
    typeof (plan as Record<string, unknown>).id === "string" &&
    Array.isArray((plan as Record<string, unknown>).items)
  );
}
