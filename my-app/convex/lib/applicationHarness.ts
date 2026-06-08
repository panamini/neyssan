import { v } from "convex/values";

export const applicationHarnessSourceTypeValidator = v.union(
  v.literal("job"),
  v.literal("cv"),
  v.literal("candidate_source_document"),
  v.literal("candidate_fact"),
  v.literal("proposal"),
  v.literal("artifact"),
);

export const applicationHarnessReviewStateValidator = v.union(
  v.literal("draft"),
  v.literal("needs_review"),
  v.literal("approved"),
  v.literal("superseded"),
);

export const applicationHarnessOperationValidator = v.union(
  v.literal("build_context"),
  v.literal("build_evidence_graph"),
  v.literal("plan_resume_variant"),
  v.literal("draft_cover_letter"),
  v.literal("create_artifact"),
  v.literal("export_artifact"),
  v.literal("track_application"),
);

export const applicationHarnessRunStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("blocked"),
);

export const applicationHarnessArtifactTypeValidator = v.union(
  v.literal("cover_letter"),
  v.literal("resume_variant_plan"),
  v.literal("resume_variant"),
  v.literal("resume_patch_plan"),
  v.literal("export"),
);

export const applicationHarnessArtifactStatusValidator = v.union(
  v.literal("draft"),
  v.literal("needs_review"),
  v.literal("approved"),
  v.literal("superseded"),
  v.literal("blocked"),
);

export const applicationHarnessSourceRefValidator = v.object({
  sourceType: applicationHarnessSourceTypeValidator,
  sourceId: v.string(),
  sourcePath: v.optional(v.string()),
  sourceHash: v.optional(v.string()),
});

export const applicationHarnessContextCandidateValidator = v.union(
  v.object({
    sourceKind: v.literal("cv"),
    cvId: v.string(),
    candidateHash: v.string(),
    selectedLanguage: v.optional(v.string()),
    market: v.optional(v.string()),
  }),
  v.object({
    sourceKind: v.literal("candidate_evidence_profile"),
    candidateEvidenceProfileId: v.string(),
    candidateHash: v.string(),
    selectedLanguage: v.optional(v.string()),
    market: v.optional(v.string()),
  }),
);

export const applicationHarnessContextFields = {
  id: v.string(),
  userId: v.string(),
  job: v.object({
    jobId: v.string(),
    sourceUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    rawTextHash: v.string(),
  }),
  candidate: applicationHarnessContextCandidateValidator,
  settingsHash: v.string(),
  contextHash: v.string(),
  reviewState: applicationHarnessReviewStateValidator,
  sourceRefs: v.array(applicationHarnessSourceRefValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.literal(1),
};

export const applicationHarnessContextValidator = v.object(
  applicationHarnessContextFields,
);

export const applicationHarnessStoredContextValidator = v.object({
  _id: v.id("applicationContexts"),
  _creationTime: v.number(),
  ...applicationHarnessContextFields,
});

export const applicationHarnessRunFields = {
  id: v.string(),
  userId: v.string(),
  contextId: v.optional(v.string()),
  operation: applicationHarnessOperationValidator,
  inputHash: v.string(),
  idempotencyKey: v.string(),
  status: applicationHarnessRunStatusValidator,
  attemptCount: v.number(),
  resultIds: v.optional(v.array(v.string())),
  blockedReason: v.optional(v.string()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.literal(1),
};

export const applicationHarnessRunValidator = v.object(
  applicationHarnessRunFields,
);

export const applicationHarnessStoredRunValidator = v.object({
  _id: v.id("applicationRuns"),
  _creationTime: v.number(),
  ...applicationHarnessRunFields,
});

export const applicationHarnessArtifactFields = {
  id: v.string(),
  userId: v.string(),
  contextId: v.string(),
  runId: v.optional(v.string()),
  type: applicationHarnessArtifactTypeValidator,
  status: applicationHarnessArtifactStatusValidator,
  title: v.string(),
  content: v.any(),
  textPreview: v.optional(v.string()),
  sourceHashes: v.object({
    contextHash: v.string(),
    evidenceGraphHash: v.optional(v.string()),
    generatorInputHash: v.optional(v.string()),
  }),
  provenance: v.object({
    jobId: v.optional(v.string()),
    cvId: v.optional(v.string()),
    candidateEvidenceProfileId: v.optional(v.string()),
    evidenceGraphId: v.optional(v.string()),
    sourceFactIds: v.optional(v.array(v.string())),
  }),
  sourceRefs: v.array(applicationHarnessSourceRefValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.literal(1),
};

export const applicationHarnessArtifactValidator = v.object(
  applicationHarnessArtifactFields,
);

export const applicationHarnessStoredArtifactValidator = v.object({
  _id: v.id("applicationArtifacts"),
  _creationTime: v.number(),
  ...applicationHarnessArtifactFields,
});
