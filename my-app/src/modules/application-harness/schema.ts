export type SourceRefV1SourceType =
  | "job"
  | "cv"
  | "candidate_source_document"
  | "candidate_fact"
  | "proposal"
  | "artifact";

export type ApplicationReviewStateV1 =
  | "draft"
  | "needs_review"
  | "approved"
  | "superseded";

export type ApplicationCandidateSourceKindV1 =
  | "cv"
  | "candidate_evidence_profile";

export type ApplicationOperationV1 =
  | "build_context"
  | "build_evidence_graph"
  | "plan_resume_variant"
  | "draft_cover_letter"
  | "create_artifact"
  | "export_artifact"
  | "track_application";

export type ApplicationRunStatusV1 =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked";

export type ApplicationArtifactTypeV1 =
  | "cover_letter"
  | "resume_variant_plan"
  | "resume_variant"
  | "resume_patch_plan"
  | "export";

export type ApplicationArtifactStatusV1 =
  | "draft"
  | "needs_review"
  | "approved"
  | "superseded"
  | "blocked";

export type ApplicationHarnessTimestampV1 = string;

export type SourceRefV1 = Readonly<{
  sourceType: SourceRefV1SourceType;
  sourceId: string;
  sourcePath?: string;
  sourceHash?: string;
}>;

export type ApplicationContextV1 = Readonly<{
  id: string;
  userId: string;
  job: Readonly<{
    jobId: string;
    sourceUrl?: string;
    title?: string;
    company?: string;
    rawTextHash: string;
  }>;
  candidate: Readonly<{
    sourceKind: ApplicationCandidateSourceKindV1;
    cvId?: string;
    candidateEvidenceProfileId?: string;
    candidateHash: string;
    selectedLanguage?: string;
    market?: string;
  }>;
  settingsHash: string;
  contextHash: string;
  reviewState: ApplicationReviewStateV1;
  sourceRefs: readonly SourceRefV1[];
  createdAt: ApplicationHarnessTimestampV1;
  updatedAt: ApplicationHarnessTimestampV1;
  version: 1;
}>;

export type ApplicationRunV1 = Readonly<{
  id: string;
  userId: string;
  contextId?: string;
  operation: ApplicationOperationV1;
  inputHash: string;
  idempotencyKey: string;
  status: ApplicationRunStatusV1;
  attemptCount: number;
  resultIds?: readonly string[];
  blockedReason?: string;
  error?: unknown;
  createdAt: ApplicationHarnessTimestampV1;
  updatedAt: ApplicationHarnessTimestampV1;
  version: 1;
}>;

export type ApplicationArtifactV1 = Readonly<{
  id: string;
  userId: string;
  contextId: string;
  runId?: string;
  type: ApplicationArtifactTypeV1;
  status: ApplicationArtifactStatusV1;
  title: string;
  content: unknown;
  textPreview?: string;
  sourceHashes: Readonly<{
    contextHash: string;
    evidenceGraphHash?: string;
    generatorInputHash?: string;
  }>;
  provenance: Readonly<{
    jobId?: string;
    cvId?: string;
    candidateEvidenceProfileId?: string;
    evidenceGraphId?: string;
    sourceFactIds?: readonly string[];
  }>;
  sourceRefs: readonly SourceRefV1[];
  createdAt: ApplicationHarnessTimestampV1;
  updatedAt: ApplicationHarnessTimestampV1;
  version: 1;
}>;

export type ApplicationEventV1 = Readonly<{
  id: string;
  userId: string;
  contextId?: string;
  runId?: string;
  eventType: string;
  payload?: unknown;
  createdAt: ApplicationHarnessTimestampV1;
  version: 1;
}>;
