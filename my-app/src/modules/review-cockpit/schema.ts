import type { EvidenceGraphV1 } from "../evidence-graph/schema";
import type { ResumeVariantPlanV1 } from "../resume-variant-plan/schema";

export type ReviewCockpitSeverityV1 = "info" | "warning" | "blocker";

export type ReviewCockpitStatusV1 = "ready" | "needs_review" | "blocked";

export type ReviewCockpitBucketV1 =
  | "allowed_claims"
  | "plan_items"
  | "warnings"
  | "missing_evidence"
  | "blocked_claims"
  | "source_support";

export type ReviewCockpitSummaryV1 = Readonly<{
  status: ReviewCockpitStatusV1;
  allowedClaimCount: number;
  planItemCount: number;
  warningCount: number;
  blockerCount: number;
  missingEvidenceCount: number;
  blockedClaimCount: number;
  sourceFactCount: number;
  riskFlagCount: number;
  reason: string;
  version: 1;
}>;

export type ReviewCockpitItemV1 = Readonly<{
  id: string;
  bucket: ReviewCockpitBucketV1;
  title: string;
  description: string;
  severity: ReviewCockpitSeverityV1;
  planItemId?: string;
  allowedClaimId?: string;
  candidateFactId?: string;
  riskFlagId?: string;
  demandId?: string;
  evidenceMatchId?: string;
  sourceFactIds: readonly string[];
  allowedClaimIds: readonly string[];
  riskFlagIds: readonly string[];
  version: 1;
}>;

export type ReviewCockpitModelV1 = Readonly<{
  id: string;
  userId: string;
  applicationContextId: string;
  evidenceGraphId: string;
  resumeVariantPlanId: string;
  summary: ReviewCockpitSummaryV1;
  items: readonly ReviewCockpitItemV1[];
  createdAt: number;
  version: 1;
}>;

export type BuildReviewCockpitInputV1 = Readonly<{
  userId: string;
  applicationContextId: string;
  evidenceGraph: EvidenceGraphV1;
  resumeVariantPlan: ResumeVariantPlanV1;
  createdAt: number;
}>;
