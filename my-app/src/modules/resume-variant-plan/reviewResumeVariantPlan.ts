import { buildResumeVariantPlanHash } from "./buildResumeVariantPlan";
import { isClaimBackedResumeVariantPlanAction } from "./planRules";
import type {
  ResumeVariantPlanReviewStateV1,
  ResumeVariantPlanV1,
} from "./schema";

const RESUME_VARIANT_PLAN_ID_PREFIX = "resume-variant-plan:";

export type ResumeVariantPlanReviewDecisionV1 = Readonly<{
  planItemId: string;
  reviewState: Extract<
    ResumeVariantPlanReviewStateV1,
    "accepted" | "rejected"
  >;
}>;

export type ReviewResumeVariantPlanInputV1 = Readonly<{
  userId: string;
  applicationContextId: string;
  expectedPlanId: string;
  plan: ResumeVariantPlanV1;
  decisions: readonly ResumeVariantPlanReviewDecisionV1[];
  updatedAt: number;
}>;

export async function reviewResumeVariantPlan(
  input: ReviewResumeVariantPlanInputV1,
): Promise<ResumeVariantPlanV1> {
  assertReviewInput(input);

  const itemsById = new Map(input.plan.items.map((item) => [item.id, item]));
  const decisionsByItemId = new Map<
    string,
    ResumeVariantPlanReviewDecisionV1
  >();

  for (const decision of input.decisions) {
    assertReviewDecision(decision);
    if (decisionsByItemId.has(decision.planItemId)) {
      throw new TypeError(
        `duplicate ResumeVariantPlan review decision: ${decision.planItemId}`,
      );
    }

    const item = itemsById.get(decision.planItemId);
    if (!item) {
      throw new TypeError(
        `unknown ResumeVariantPlan item: ${decision.planItemId}`,
      );
    }
    if (
      item.reviewState !== "pending" ||
      !isClaimBackedResumeVariantPlanAction(item.action) ||
      item.allowedClaimIds.length === 0 ||
      item.candidateFactIds.length === 0 ||
      item.evidenceMatchIds.length === 0 ||
      item.riskFlagIds.length > 0
    ) {
      throw new TypeError(
        `ResumeVariantPlan item is not selectable: ${decision.planItemId}`,
      );
    }

    decisionsByItemId.set(decision.planItemId, decision);
  }

  const reviewedPlan: ResumeVariantPlanV1 = {
    ...input.plan,
    items: input.plan.items.map((item) => {
      const decision = decisionsByItemId.get(item.id);
      return decision
        ? {
            ...item,
            reviewState: decision.reviewState,
          }
        : item;
    }),
    updatedAt: input.updatedAt,
  };
  const hash = await buildResumeVariantPlanHash(reviewedPlan);

  return {
    ...reviewedPlan,
    id: `${RESUME_VARIANT_PLAN_ID_PREFIX}${hash}`,
  };
}

function assertReviewInput(input: ReviewResumeVariantPlanInputV1): void {
  if (!input || typeof input !== "object" || !input.plan?.id) {
    throw new TypeError("reviewResumeVariantPlan requires a plan");
  }
  if (input.userId !== input.plan.userId) {
    throw new TypeError("ResumeVariantPlan review user does not match plan");
  }
  if (input.applicationContextId !== input.plan.applicationContextId) {
    throw new TypeError(
      "ResumeVariantPlan review application context does not match plan",
    );
  }
  if (
    typeof input.expectedPlanId !== "string" ||
    input.expectedPlanId !== input.plan.id
  ) {
    throw new TypeError("stale ResumeVariantPlan review");
  }
  if (!Array.isArray(input.decisions) || input.decisions.length === 0) {
    throw new TypeError(
      "reviewResumeVariantPlan requires at least one decision",
    );
  }
  if (
    !Number.isFinite(input.updatedAt) ||
    input.updatedAt < input.plan.updatedAt
  ) {
    throw new TypeError(
      "ResumeVariantPlan review requires a non-decreasing updatedAt",
    );
  }
}

function assertReviewDecision(
  decision: ResumeVariantPlanReviewDecisionV1,
): void {
  if (
    !decision ||
    typeof decision.planItemId !== "string" ||
    !decision.planItemId.trim()
  ) {
    throw new TypeError(
      "ResumeVariantPlan review decision requires planItemId",
    );
  }
  if (
    decision.reviewState !== "accepted" &&
    decision.reviewState !== "rejected"
  ) {
    throw new TypeError(
      "ResumeVariantPlan review decision must be accepted or rejected",
    );
  }
}
