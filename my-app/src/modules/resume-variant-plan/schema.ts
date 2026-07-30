import type { EvidenceGraphV1 } from "../evidence-graph/schema";

export type ResumeVariantPlanSectionV1 =
  | "profile"
  | "summary"
  | "skills"
  | "experience"
  | "education"
  | "languages"
  | "certifications"
  | "achievements"
  | "projects"
  | "portfolio"
  | "other";

export type ResumeVariantPlanActionV1 =
  | "include"
  | "exclude"
  | "reorder"
  | "emphasize"
  | "deemphasize"
  | "add_from_allowed_claim"
  | "needs_review"
  | "block";

export type ResumeVariantPlanPriorityV1 = "required" | "recommended" | "optional";

export type ResumeVariantPlanReviewStateV1 =
  | "pending"
  | "accepted"
  | "rejected"
  | "blocked"
  | "needs_review";

export type ResumeVariantPlanSourceCvFactBindingV1 = Readonly<{
  candidateFactId: string;
  sourceCvItemReferenceId: string;
}>;

export type ResumeVariantPlanItemV1 = Readonly<{
  id: string;
  section: ResumeVariantPlanSectionV1;
  action: ResumeVariantPlanActionV1;
  priority: ResumeVariantPlanPriorityV1;
  reviewState: ResumeVariantPlanReviewStateV1;
  sourceCvItemReferenceIds?: readonly string[];
  allowedClaimIds: readonly string[];
  candidateFactIds: readonly string[];
  evidenceMatchIds: readonly string[];
  demandIds: readonly string[];
  riskFlagIds: readonly string[];
  reason: string;
  version: 1;
}>;

export type ResumeVariantPlanWarningCategoryV1 =
  | "missing_evidence"
  | "blocked_claim"
  | "unsupported_claim"
  | "private_fact"
  | "never_use_fact"
  | "generated_text_as_fact"
  | "source_truth"
  | "other";

export type ResumeVariantPlanWarningSeverityV1 = "info" | "warning" | "blocker";

export type ResumeVariantPlanWarningV1 = Readonly<{
  id: string;
  category: ResumeVariantPlanWarningCategoryV1;
  severity: ResumeVariantPlanWarningSeverityV1;
  demandId?: string;
  riskFlagId?: string;
  candidateFactId?: string;
  reason: string;
  version: 1;
}>;

export type ResumeVariantPlanTargetDocumentKindV1 = "resume" | "cv";

export type ResumeVariantPlanV1 = Readonly<{
  id: string;
  userId: string;
  applicationContextId: string;
  evidenceGraphId: string;
  evidenceGraphHash: string;
  targetDocumentKind: ResumeVariantPlanTargetDocumentKindV1;
  sourceCvId?: string;
  language?: string;
  market?: string;
  items: readonly ResumeVariantPlanItemV1[];
  warnings: readonly ResumeVariantPlanWarningV1[];
  blockedClaimIds: readonly string[];
  sourceFactIds: readonly string[];
  allowedClaimIds: readonly string[];
  riskFlagIds: readonly string[];
  blocked: boolean;
  blockedReason?: string;
  createdAt: number;
  updatedAt: number;
  version: 1;
}>;

export type ResumeVariantPlanArtifactContentV1 = Readonly<{
  kind: "resume_variant_plan";
  plan: ResumeVariantPlanV1;
  version: 1;
}>;

export type BuildResumeVariantPlanInputV1 = Readonly<{
  userId: string;
  applicationContextId: string;
  targetDocumentKind: ResumeVariantPlanTargetDocumentKindV1;
  language?: string;
  market?: string;
  evidenceGraph: EvidenceGraphV1;
  sourceCvId?: string;
  sourceCvFactBindings?: readonly ResumeVariantPlanSourceCvFactBindingV1[];
  createdAt: number;
  updatedAt: number;
}>;
