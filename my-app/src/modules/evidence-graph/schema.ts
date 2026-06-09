import type { CandidateFactV1 } from "../candidate-evidence/schema";
import type { CareerKnowledgeRuleV1 } from "../career-knowledge/schema";

export type JobDemandKindV1 =
  | "skill"
  | "experience"
  | "education"
  | "language"
  | "certification"
  | "domain"
  | "responsibility"
  | "seniority"
  | "location"
  | "availability"
  | "other";

export type JobDemandRequiredStateV1 = "required" | "preferred" | "unknown";

export type JobDemandSourceV1 = "job" | "application_context";

export type JobDemandV1 = Readonly<{
  id: string;
  kind: JobDemandKindV1;
  label: string;
  required: JobDemandRequiredStateV1;
  source: JobDemandSourceV1;
  sourcePath?: string;
  weight?: number;
  version: 1;
}>;

export type EvidenceMatchTypeV1 = "direct" | "adjacent" | "inferred";
export type EvidenceMatchStrengthV1 = "strong" | "medium" | "weak";
export type EvidenceMatchReviewStateV1 = "pending" | "accepted" | "rejected";

export type EvidenceMatchV1 = Readonly<{
  id: string;
  demandId: string;
  candidateFactId: string;
  sourceDocumentId: string;
  sourcePath: string;
  matchType: EvidenceMatchTypeV1;
  strength: EvidenceMatchStrengthV1;
  reviewState: EvidenceMatchReviewStateV1;
  reason: string;
  version: 1;
}>;

export type EvidenceGraphBuildInputV1 = Readonly<{
  userId: string;
  applicationContextId: string;
  demands: readonly JobDemandV1[];
  candidateFacts: readonly CandidateFactV1[];
  careerKnowledgeRules: readonly CareerKnowledgeRuleV1[];
  createdAt: number;
}>;
