import type { EvidenceGraphV1 } from "../evidence-graph/schema";
import type { ResumeVariantPlanV1 } from "../resume-variant-plan/schema";
import type { ReviewCockpitModelV1 } from "../review-cockpit/schema";

export type ResumeVariantArtifactStatusV1 =
  | "draft"
  | "needs_review"
  | "blocked"
  | "ready_for_generation";

export type ResumeVariantArtifactSectionKindV1 =
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

export type ResumeVariantArtifactItemKindV1 =
  | "source_backed_claim"
  | "plan_instruction"
  | "missing_evidence_notice"
  | "risk_notice"
  | "blocked_claim_notice"
  | "review_notice";

export type ResumeVariantArtifactItemV1 = Readonly<{
  id: string;
  kind: ResumeVariantArtifactItemKindV1;
  section: ResumeVariantArtifactSectionKindV1;
  planItemId?: string;
  allowedClaimId?: string;
  candidateFactId?: string;
  evidenceMatchId?: string;
  demandId?: string;
  riskFlagId?: string;
  sourceFactIds: readonly string[];
  allowedClaimIds: readonly string[];
  evidenceMatchIds: readonly string[];
  demandIds: readonly string[];
  riskFlagIds: readonly string[];
  reviewItemIds: readonly string[];
  label: string;
  note: string;
  version: 1;
}>;

export type ResumeVariantArtifactSectionV1 = Readonly<{
  id: string;
  kind: ResumeVariantArtifactSectionKindV1;
  title: string;
  items: readonly ResumeVariantArtifactItemV1[];
  sourceFactIds: readonly string[];
  allowedClaimIds: readonly string[];
  evidenceMatchIds: readonly string[];
  demandIds: readonly string[];
  riskFlagIds: readonly string[];
  reviewItemIds: readonly string[];
  version: 1;
}>;

export type ResumeVariantArtifactProvenanceV1 = Readonly<{
  applicationContextId: string;
  evidenceGraphId: string;
  evidenceGraphHash: string;
  resumeVariantPlanId: string;
  resumeVariantPlanHash: string;
  reviewCockpitId: string;
  sourceFactIds: readonly string[];
  allowedClaimIds: readonly string[];
  evidenceMatchIds: readonly string[];
  demandIds: readonly string[];
  riskFlagIds: readonly string[];
  reviewItemIds: readonly string[];
  version: 1;
}>;

export type ResumeVariantArtifactV1 = Readonly<{
  id: string;
  userId: string;
  applicationContextId: string;
  targetDocumentKind: "resume" | "cv";
  language?: string;
  market?: string;
  status: ResumeVariantArtifactStatusV1;
  sections: readonly ResumeVariantArtifactSectionV1[];
  warnings: readonly string[];
  blockedReason?: string;
  provenance: ResumeVariantArtifactProvenanceV1;
  createdAt: number;
  updatedAt: number;
  version: 1;
}>;

export type ResumeVariantArtifactContentV1 = Readonly<{
  kind: "resume_variant_artifact";
  artifact: ResumeVariantArtifactV1;
  version: 1;
}>;

export type BuildResumeVariantArtifactInputV1 = Readonly<{
  userId: string;
  applicationContextId: string;
  targetDocumentKind: "resume" | "cv";
  language?: string;
  market?: string;
  evidenceGraph: EvidenceGraphV1;
  resumeVariantPlan: ResumeVariantPlanV1;
  reviewCockpit: ReviewCockpitModelV1;
  createdAt: number;
  updatedAt: number;
}>;
