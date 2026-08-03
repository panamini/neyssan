import type { MutationCtx } from "../../_generated/server";
import {
  materializeSourceCvVariant,
  type ReviewedSourceCvVariantProvenanceV1,
} from "../../../src/modules/resume-variant-materialization/materializeSourceCvVariant";
import { resolveReviewableCandidateCvItemReference } from "../../../src/modules/candidate-evidence/cvItemReferences";
import type { CvDocument } from "../../../src/types/cvDocument";
import { safeParseCvDocument } from "../../../src/schemas/cvDocument.schema";
import { decodeCvDocumentFromConvex } from "../../../src/adapters/cvDocumentPersistence";
import type { ResumeVariantPlanReviewDecisionV1 } from "../../../src/modules/resume-variant-plan/reviewResumeVariantPlan";
import type {
  ResumeVariantPlanActionV1,
  ResumeVariantPlanPriorityV1,
  ResumeVariantPlanReviewStateV1,
  ResumeVariantPlanSectionV1,
  ResumeVariantPlanWarningCategoryV1,
  ResumeVariantPlanWarningSeverityV1,
} from "../../../src/modules/resume-variant-plan/schema";
import { buildApplicationContextV1FromExistingData } from "../applicationContextBuilder";
import { persistApplicationContext } from "../applicationContextPersistence";
import { buildSourceCvPlanFromPersistence } from "../sourceCvPlanOrchestrator";
import { buildSourceCvPlanPersistence } from "../sourceCvPlanPersistence";
import {
  loadPersistedSourceCvPlanReview,
  resolveApplicationScopedSourceCvReviewOutcome,
  reviewAndPersistSourceCvPlan,
} from "../sourceCvPlanReviewPersistence";
import { resolveResumeProfileById } from "./matchRead";
import {
  isJobLlmVisibleExtractionEnabled,
  resolveVisibleJobBriefReviewState,
  selectVisibleJobExtractionForJob,
} from "./visibleJobExtraction";
import { buildScoringProfileFieldsFromCvDocument } from "../../profiles";
import {
  DEFAULT_PROFILE_PREFERENCES,
  listProfilesForClerk,
  resolveCanonicalProfileKeywordsForWrite,
} from "../userProfiles";

export type CvTailoringReviewModeV1 = "auto_recommended" | "full_source_cv";

export type CvTailoringReviewDecisionV1 =
  ResumeVariantPlanReviewDecisionV1;

export type ReviewedResumeProposalAuthority =
  | "source"
  | "reviewed_ready"
  | "reviewed_invalid";

export function resolveReviewedResumeProposalAuthority(args: {
  resumeId: string | null | undefined;
  jobId: string;
  profile: Record<string, unknown> | null | undefined;
}): ReviewedResumeProposalAuthority {
  if (!args.resumeId?.startsWith("source-cv-variant:v1:")) {
    return "source";
  }

  const decoded = decodeCvDocumentFromConvex(args.profile?.cvDocument);
  const parsed = safeParseCvDocument(decoded);
  if (!parsed.ok || parsed.value.id !== args.resumeId) {
    return "reviewed_invalid";
  }

  const provenance = readReviewedSourceCvVariantProvenance(
    parsed.value as unknown as Record<string, unknown>,
  );
  return provenance?.jobId === args.jobId
    ? "reviewed_ready"
    : "reviewed_invalid";
}

type CvTailoringReviewPlanItemDtoV1 = Readonly<{
  id: string;
  section: ResumeVariantPlanSectionV1;
  action: ResumeVariantPlanActionV1;
  priority: ResumeVariantPlanPriorityV1;
  reviewState: ResumeVariantPlanReviewStateV1;
  displayLabel: string;
  demandIds: string[];
  sourceCvItemReferenceIds: string[];
  reason: string;
}>;

type CvTailoringReviewWarningDtoV1 = Readonly<{
  id: string;
  category: ResumeVariantPlanWarningCategoryV1;
  severity: ResumeVariantPlanWarningSeverityV1;
  reason: string;
}>;

type CvTailoringReviewPlanDtoV1 = Readonly<{
  id: string;
  blocked: boolean;
  blockedReason?: string;
  requiredDemandIds: string[];
  items: CvTailoringReviewPlanItemDtoV1[];
  warnings: CvTailoringReviewWarningDtoV1[];
}>;

export type CvTailoringReviewDtoV1 =
  | Readonly<{
      mode: "auto_recommended";
      sourceCv: Readonly<{
        id: string;
        contextHash: string;
      }>;
      plan: CvTailoringReviewPlanDtoV1;
    }>
  | Readonly<{
      mode: "full_source_cv";
      sourceCv: Readonly<{
        id: string;
        contextHash: string;
      }>;
      plan: null;
    }>;

export type CvTailoringMaterializationDtoV1 = Readonly<{
  jobId: string;
  resumeId: string;
  resumeName: string;
  sourceCvId: string;
  reused: boolean;
}>;

export async function prepareOwnedCvTailoringReview(
  ctx: MutationCtx,
  input: Readonly<{
    jobId: string;
    mode?: CvTailoringReviewModeV1;
  }>,
): Promise<CvTailoringReviewDtoV1> {
  const prepared = await buildOwnedCvTailoringComposition(
    ctx,
    input.jobId,
    input.mode ?? "auto_recommended",
  );
  if (prepared.composition.mode === "full_source_cv") {
    return projectCvTailoringReview(prepared.composition, prepared.sourceCv);
  }
  const resumed = await loadPersistedSourceCvPlanReview(
    ctx.db,
    prepared.composition,
    prepared.jobId,
  );
  return projectCvTailoringReview(resumed, prepared.sourceCv);
}

export async function submitOwnedCvTailoringReview(
  ctx: MutationCtx,
  input: Readonly<{
    jobId: string;
    expectedPlanId: string;
    decisions: readonly CvTailoringReviewDecisionV1[];
  }>,
): Promise<CvTailoringReviewDtoV1> {
  const prepared = await buildOwnedCvTailoringComposition(
    ctx,
    input.jobId,
    "auto_recommended",
  );
  if (prepared.composition.mode !== "auto_recommended") {
    throw new TypeError("CV tailoring review submission requires a plan");
  }
  const reviewed = await reviewAndPersistSourceCvPlan({
    db: ctx.db,
    composition: prepared.composition,
    requestedJobId: prepared.jobId,
    expectedPlanId: input.expectedPlanId,
    decisions: input.decisions,
    updatedAt: Date.now(),
  });
  return projectCvTailoringReview(reviewed, prepared.sourceCv);
}

export async function materializeOwnedCvTailoringReview(
  ctx: MutationCtx,
  input: Readonly<{
    jobId: string;
    expectedPlanId: string;
  }>,
): Promise<CvTailoringMaterializationDtoV1> {
  const expectedPlanId = requireString(input.expectedPlanId, "expectedPlanId");
  const prepared = await buildOwnedCvTailoringComposition(
    ctx,
    input.jobId,
    "auto_recommended",
    expectedPlanId,
  );
  if (prepared.composition.mode !== "auto_recommended") {
    throw new TypeError("CV tailoring materialization requires a plan");
  }
  const reviewed = await loadPersistedSourceCvPlanReview(
    ctx.db,
    prepared.composition,
    prepared.jobId,
  );
  if (reviewed.plan.id !== expectedPlanId) {
    throw new TypeError("stale ResumeVariantPlan materialization");
  }
  const reviewOutcome =
    resolveApplicationScopedSourceCvReviewOutcome(
      reviewed.plan,
      reviewed.evidenceGraph,
    );
  if (reviewOutcome.status !== "approved") {
    throw new TypeError(
      "CV tailoring materialization requires a fully reviewed generation-ready plan",
    );
  }

  const attachmentUpdatedAt = Date.now();
  const materialized = await materializeSourceCvVariant({
    applicationContext: prepared.applicationContext,
    sourceCv: withRequiredCvMetadata(
      prepared.sourceCv,
      prepared.sourceProfile,
      attachmentUpdatedAt,
    ),
    reviewedPlan: reviewed.plan,
  });
  const candidates = await ctx.db
    .query("userProfiles")
    .withIndex("by_profileId", (q) => q.eq("profileId", materialized.id))
    .collect();
  let reused = false;
  let resumeName = materialized.name;

  if (candidates.length > 0) {
    if (candidates.length !== 1) {
      throw new TypeError("deterministic source CV variant identity collision");
    }
    const existing = candidates[0];
    const existingDocument = readRecord(existing.cvDocument);
    const existingProvenance =
      readReviewedSourceCvVariantProvenance(existingDocument);
    if (
      existing.clerkId !== prepared.clerkId ||
      existing.profileId !== materialized.id ||
      existingDocument?.id !== materialized.id ||
      !sameMaterializationProvenance(
        existingProvenance,
        materialized.provenance,
      )
    ) {
      throw new TypeError(
        "deterministic source CV variant provenance collision",
      );
    }
    reused = true;
    resumeName =
      typeof existingDocument.title === "string" &&
      existingDocument.title.trim()
        ? existingDocument.title
        : materialized.name;
  } else {
    const profilePreferences = readRecord(prepared.sourceProfile.preferences);
    const scoringFields = buildScoringProfileFieldsFromCvDocument(
      materialized.document,
    );
    await ctx.db.insert("userProfiles", {
      profileId: materialized.id,
      clerkId: prepared.clerkId,
      email: requireString(
        prepared.sourceProfile.email ??
          prepared.ownerProfile.email,
        "profile email",
      ),
      ...(typeof prepared.sourceProfile.name === "string" &&
      prepared.sourceProfile.name.trim()
        ? { name: prepared.sourceProfile.name }
        : {}),
      preferences: {
        ...DEFAULT_PROFILE_PREFERENCES,
        ...(profilePreferences ?? {}),
      },
      ...(scoringFields.summary
        ? { summary: scoringFields.summary }
        : {}),
      skills: scoringFields.skills,
      keywords: resolveCanonicalProfileKeywordsForWrite({
        summary: scoringFields.summary,
        skills: scoringFields.skills,
        experience: scoringFields.experience,
        rawText: scoringFields.raw_text,
      }),
      experience: scoringFields.experience,
      ...(scoringFields.raw_text
        ? { raw_text: scoringFields.raw_text }
        : {}),
      version: 1,
      createdAt: attachmentUpdatedAt,
      updatedAt: attachmentUpdatedAt,
      cvDocument: materialized.document,
    });
  }

  await ctx.db.patch(prepared.job._id, {
    lastResumeId: materialized.id,
    lastResumeName: resumeName,
    updatedAt: attachmentUpdatedAt,
  });
  return {
    jobId: prepared.jobId,
    resumeId: materialized.id,
    resumeName,
    sourceCvId: materialized.provenance.sourceCvId,
    reused,
  };
}

async function buildOwnedCvTailoringComposition(
  ctx: MutationCtx,
  requestedJobId: string,
  mode: CvTailoringReviewModeV1,
  expectedReviewedPlanId?: string,
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const jobId = requireString(requestedJobId, "jobId");
  const normalizedJobId = ctx.db.normalizeId("jobs", jobId);
  if (!normalizedJobId) {
    throw new Error("Invalid jobId");
  }

  const profiles = await listProfilesForClerk(ctx, identity.subject);
  if (profiles.length === 0) {
    throw new Error("User profile not found");
  }
  const job = await ctx.db.get(normalizedJobId);
  const ownerProfile = job
    ? profiles.find((profile) => String(profile._id) === String(job.userId))
    : null;
  if (!job || !ownerProfile) {
    throw new Error("Job not found");
  }
  if (job.archivedAt !== null && job.archivedAt !== undefined) {
    throw new Error("Archived Job cannot be tailored");
  }
  const visibleExtractionFlagEnabled = isJobLlmVisibleExtractionEnabled();
  const shadowRows = visibleExtractionFlagEnabled
    ? await ctx.db
        .query("job_extraction_shadow")
        .withIndex("by_job_id", (q) => q.eq("job_id", job._id))
        .collect()
    : [];
  const visibleExtraction = selectVisibleJobExtractionForJob({
    job,
    shadowRows,
    flagEnabled: visibleExtractionFlagEnabled,
    rawLanguageDetected: job.rawLanguageDetected,
  });
  const visibleReviewState = resolveVisibleJobBriefReviewState({
    reviewItems: job.reviewItems ?? [],
    visibleExtraction,
  });
  const authoritativeJob = {
    ...job,
    reviewState: visibleReviewState,
  };
  if (job.parseStatus !== "parsed" || visibleReviewState !== "ready") {
    throw new Error(
      "Canonical Job Brief must be parsed and ready for CV tailoring",
    );
  }

  const attachedResumeId = requireString(job.lastResumeId, "attached resume");
  const attachedProfile = resolveResumeProfileById(profiles, attachedResumeId);
  if (!attachedProfile) {
    throw new Error("Attached resume not found");
  }
  const attachedProfileId = String(
    attachedProfile.profileId ?? attachedProfile._id ?? "",
  ).trim();
  const attachedCv = readRecord(attachedProfile.cvDocument);
  const attachedCvId = requireString(attachedCv?.id, "canonical attached CV");
  if (
    attachedProfileId !== attachedResumeId ||
    attachedCvId !== attachedResumeId
  ) {
    throw new Error(
      "Attached resume, selected profile, and canonical source CV do not match",
    );
  }
  const attachedMaterialization =
    readReviewedSourceCvVariantProvenance(attachedCv);
  const replayedMaterialization =
    expectedReviewedPlanId &&
    attachedMaterialization?.jobId === jobId &&
    attachedMaterialization.reviewedPlanId ===
      expectedReviewedPlanId
      ? attachedMaterialization
      : null;
  const selectedProfile = replayedMaterialization
    ? resolveResumeProfileById(profiles, replayedMaterialization.sourceCvId)
    : attachedProfile;
  if (!selectedProfile) {
    throw new Error("Materialized resume source CV not found");
  }
  const selectedProfileId = String(
    selectedProfile.profileId ?? selectedProfile._id ?? "",
  ).trim();
  const sourceCv = readRecord(selectedProfile.cvDocument);
  const sourceCvId = requireString(sourceCv?.id, "canonical source CV");
  if (
    selectedProfileId !== sourceCvId ||
    (selectedProfile === attachedProfile &&
      sourceCvId !== attachedResumeId)
  ) {
    throw new Error(
      "Attached resume, selected profile, and canonical source CV do not match",
    );
  }

  const now = Date.now();
  const built = await buildApplicationContextV1FromExistingData({
    userId: String(authoritativeJob.userId),
    job: { ...authoritativeJob, _id: String(authoritativeJob._id) },
    candidateProfile: {
      ...selectedProfile,
      _id: String(selectedProfile._id),
    },
    now,
  });
  const persisted = await persistApplicationContext(ctx.db, built.context);
  if (
    persisted.context.job.jobId !== jobId ||
    persisted.context.candidate.sourceKind !== "cv" ||
    persisted.context.candidate.cvId !== sourceCvId ||
    persisted.context.candidate.candidateHash !== built.candidateHash ||
    (replayedMaterialization &&
      (replayedMaterialization.applicationContextId !==
        persisted.context.id ||
        replayedMaterialization.applicationContextHash !==
          persisted.context.contextHash))
  ) {
    throw new TypeError(
      "Persisted ApplicationContext does not match the attached source CV",
    );
  }

  const basePersistence = buildSourceCvPlanPersistence(ctx.db);
  const composition = await buildSourceCvPlanFromPersistence({
    persistence: {
      ...basePersistence,
      getJobById: async ({ jobId: persistenceJobId }) =>
        persistenceJobId === jobId
          ? authoritativeJob
          : basePersistence.getJobById({ jobId: persistenceJobId }),
    },
    callerUserId: String(authoritativeJob.userId),
    applicationContextId: persisted.context.id,
    requestedJobId: jobId,
    mode,
    sourceAuthorization: "attached_source_cv",
    now: persisted.context.updatedAt,
  });
  return {
    composition,
    jobId,
    job: authoritativeJob,
    clerkId: identity.subject,
    ownerProfile,
    sourceProfile: selectedProfile,
    sourceCv: sourceCv as unknown as Readonly<CvDocument>,
    applicationContext: persisted.context,
  };
}

function projectCvTailoringReview(
  composition: Awaited<
    ReturnType<typeof buildSourceCvPlanFromPersistence>
  >,
  canonicalSourceCv: Readonly<CvDocument>,
): CvTailoringReviewDtoV1 {
  const sourceCv = {
    id: composition.sourceCvId,
    contextHash: composition.sourceCvContextHash,
  };
  if (composition.mode === "full_source_cv") {
    return {
      mode: "full_source_cv",
      sourceCv,
      plan: null,
    };
  }
  const reviewOutcome =
    resolveApplicationScopedSourceCvReviewOutcome(
      composition.plan,
      composition.evidenceGraph,
    );
  const referenceById = new Map(
    composition.cvItemReferences.map((reference) => [reference.id, reference]),
  );
  return {
    mode: "auto_recommended",
    sourceCv,
    plan: {
      id: composition.plan.id,
      blocked: reviewOutcome.status === "blocked",
      ...(reviewOutcome.blockedReason
        ? { blockedReason: reviewOutcome.blockedReason }
        : {}),
      requiredDemandIds: composition.evidenceGraph.demands
        .filter((demand) => demand.required === "required")
        .map((demand) => demand.id)
        .sort(),
      items: composition.plan.items.map((item) => {
        const sourceCvItemReferenceIds = [
          ...(item.sourceCvItemReferenceIds ?? []),
        ];
        const reference = sourceCvItemReferenceIds
          .map((referenceId) => referenceById.get(referenceId))
          .find((candidate) => candidate !== undefined);
        if (!reference) {
          throw new TypeError(
            "CV tailoring review item requires an authorized source CV reference",
          );
        }
        const resolved =
          resolveReviewableCandidateCvItemReference(
            canonicalSourceCv,
            reference,
          );
        return {
          id: item.id,
          section: item.section,
          action: item.action,
          priority: item.priority,
          reviewState: item.reviewState,
          displayLabel: buildCvTailoringDisplayLabel(
            resolved.reference.sectionType,
            resolved.item,
          ),
          demandIds: [...item.demandIds].sort(),
          sourceCvItemReferenceIds,
          reason: item.reason,
        };
      }),
      warnings: composition.plan.warnings.map((warning) => ({
        id: warning.id,
        category: warning.category,
        severity: warning.severity,
        reason: warning.reason,
      })),
    },
  };
}

function buildCvTailoringDisplayLabel(
  sectionType: "experience" | "education" | "skill",
  item: unknown,
): string {
  const record = readRecord(item);
  const parts =
    sectionType === "experience"
      ? [
          readDisplayLabelPart(record?.position),
          readDisplayLabelPart(record?.company),
        ]
      : sectionType === "education"
        ? [
            readDisplayLabelPart(record?.degree) ||
              readDisplayLabelPart(record?.fieldOfStudy),
            readDisplayLabelPart(record?.institution),
          ]
        : [readDisplayLabelPart(record?.name)];
  const label = parts.filter(Boolean).join(" · ");
  if (label) {
    return label;
  }
  return sectionType === "experience"
    ? "Experience"
    : sectionType === "education"
      ? "Education"
      : "Skill";
}

function readDisplayLabelPart(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, 80)
    : "";
}

function requireString(value: unknown, label: string): string {
  const normalized =
    typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new TypeError(`CV tailoring review requires ${label}`);
  }
  return normalized;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function withRequiredCvMetadata(
  sourceCv: Readonly<CvDocument>,
  sourceProfile: Readonly<Record<string, unknown>>,
  now: number,
): Readonly<CvDocument> {
  const metadata = readRecord(sourceCv.metadata) ?? {};
  const createdAtFallback = Number(
    sourceProfile.createdAt ?? sourceProfile._creationTime ?? now,
  );
  const updatedAtFallback = Number(
    sourceProfile.updatedAt ??
      sourceProfile.createdAt ??
      sourceProfile._creationTime ??
      now,
  );
  const createdAt =
    typeof metadata.createdAt === "string" && metadata.createdAt.trim()
      ? metadata.createdAt
      : new Date(
          Number.isFinite(createdAtFallback) ? createdAtFallback : now,
        ).toISOString();
  const updatedAt =
    typeof metadata.updatedAt === "string" && metadata.updatedAt.trim()
      ? metadata.updatedAt
      : new Date(
          Number.isFinite(updatedAtFallback) ? updatedAtFallback : now,
        ).toISOString();
  const version = Number(metadata.version);

  return {
    ...sourceCv,
    metadata: {
      ...metadata,
      createdAt,
      updatedAt,
      version: Number.isFinite(version) && version > 0 ? version : 1,
    },
  };
}

function readReviewedSourceCvVariantProvenance(
  document: Record<string, unknown> | null,
): ReviewedSourceCvVariantProvenanceV1 | null {
  const metadata = readRecord(document?.metadata);
  const provenance = readRecord(metadata?.reviewedSourceCvVariant);
  return provenance?.kind === "reviewed_source_cv_variant" &&
    provenance.version === 1 &&
    typeof provenance.sourceCvId === "string" &&
    typeof provenance.jobId === "string" &&
    typeof provenance.applicationContextId === "string" &&
    typeof provenance.applicationContextHash === "string" &&
    typeof provenance.reviewedPlanId === "string"
    ? (provenance as ReviewedSourceCvVariantProvenanceV1)
    : null;
}

function sameMaterializationProvenance(
  left: ReviewedSourceCvVariantProvenanceV1 | null,
  right: ReviewedSourceCvVariantProvenanceV1,
): boolean {
  return (
    left?.kind === right.kind &&
    left.sourceCvId === right.sourceCvId &&
    left.jobId === right.jobId &&
    left.applicationContextId === right.applicationContextId &&
    left.applicationContextHash ===
      right.applicationContextHash &&
    left.reviewedPlanId === right.reviewedPlanId &&
    left.version === right.version
  );
}
