import type { CandidateFactV1 } from "../candidate-evidence/schema";
import type { CareerKnowledgeRuleV1 } from "../career-knowledge/schema";

export type JobDemandKindV1="skill"|"experience"|"education"|"language"|"certification"|"domain"|"responsibility"|"seniority"|"location"|"availability"|"other";
export type JobDemandRequiredStateV1="required"|"preferred"|"unknown";
export type JobDemandSourceV1="job"|"application_context";
export type JobDemandV1=Readonly<{id:string;kind:JobDemandKindV1;label:string;required:JobDemandRequiredStateV1;source:JobDemandSourceV1;sourcePath?:string;weight?:number;version:1}>;

// PR7 emits direct/adjacent matches; inferred is reserved for a later deterministic implementation.
export type EvidenceMatchTypeV1="direct"|"adjacent"|"inferred";
// PR7 emits strong/medium support; weak is reserved for future lower-confidence evidence.
export type EvidenceMatchStrengthV1="strong"|"medium"|"weak";
export type EvidenceMatchReviewStateV1="pending"|"accepted"|"rejected";
export type EvidenceMatchV1=Readonly<{id:string;demandId:string;candidateFactId:string;sourceDocumentId:string;sourcePath:string;matchType:EvidenceMatchTypeV1;strength:EvidenceMatchStrengthV1;reviewState:EvidenceMatchReviewStateV1;reason:string;version:1}>;

export type MissingEvidenceSeverityV1="info"|"warning"|"blocker";
export type MissingEvidenceV1=Readonly<{id:string;demandId:string;label:string;severity:MissingEvidenceSeverityV1;reason:string;version:1}>;

// unsupported_tool is reserved for future deterministic tool-specific demand checks.
export type EvidenceRiskFlagCategoryV1="unsupported_metric"|"unsupported_tool"|"unsupported_certification"|"unsupported_language"|"private_fact"|"never_use_fact"|"generated_text_as_fact"|"missing_evidence"|"source_truth"|"other";
export type EvidenceRiskFlagSeverityV1="info"|"warning"|"blocker";
export type EvidenceRiskFlagV1=Readonly<{id:string;category:EvidenceRiskFlagCategoryV1;severity:EvidenceRiskFlagSeverityV1;candidateFactId?:string;demandId?:string;careerKnowledgeRuleId?:string;reason:string;version:1}>;

export type AllowedClaimTypeV1="skill"|"experience"|"achievement"|"education"|"language"|"certification"|"project"|"other";
export type AllowedClaimSupportLevelV1="strong"|"medium"|"weak";
// PR7 emits allowed claims only; pending/blocked are reserved for later review workflows.
export type AllowedClaimReviewStateV1="pending"|"allowed"|"blocked";
export type AllowedClaimV1=Readonly<{id:string;candidateFactIds:readonly string[];claimType:AllowedClaimTypeV1;text:string;supportLevel:AllowedClaimSupportLevelV1;reviewState:AllowedClaimReviewStateV1;reason:string;version:1}>;

export type EvidenceGraphV1=Readonly<{id:string;userId:string;applicationContextId:string;jobDemandGraphHash:string;candidateEvidenceHash:string;careerKnowledgeHash:string;demands:readonly JobDemandV1[];matches:readonly EvidenceMatchV1[];missing:readonly MissingEvidenceV1[];riskFlags:readonly EvidenceRiskFlagV1[];allowedClaims:readonly AllowedClaimV1[];blockedClaimIds:readonly string[];createdAt:number;version:1}>;

export type EvidenceGraphBuildInputV1=Readonly<{userId:string;applicationContextId:string;demands:readonly JobDemandV1[];candidateFacts:readonly CandidateFactV1[];careerKnowledgeRules:readonly CareerKnowledgeRuleV1[];createdAt:number}>;
