import type { MutationCtx } from "../../_generated/server";
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
import {
  buildSourceCvPlanFromPersistence,
} from "../sourceCvPlanOrchestrator";
import { buildSourceCvPlanPersistence } from "../sourceCvPlanPersistence";
import {
  loadPersistedSourceCvPlanReview,
  reviewAndPersistSourceCvPlan,
} from "../sourceCvPlanReviewPersistence";
import { resolveResumeProfileById } from "./matchRead";
import { listProfilesForClerk } from "../userProfiles";

export type CvTailoringReviewModeV1 =
  | "auto_recommended"
  | "full_source_cv";

export type CvTailoringReviewDecisionV1 =
  ResumeVariantPlanReviewDecisionV1;

type CvTailoringReviewPlanItemDtoV1 = Readonly<{
  id: string;
  section: ResumeVariantPlanSectionV1;
  action: ResumeVariantPlanActionV1;
  priority: ResumeVariantPlanPriorityV1;
  reviewState: ResumeVariantPlanReviewStateV1;
  sourceCvItemReferenceIds: readonly string[];
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
  items: readonly CvTailoringReviewPlanItemDtoV1[];
  warnings: readonly CvTailoringReviewWarningDtoV1[];
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
    return projectCvTailoringReview(prepared.composition);
  }
  const resumed = await loadPersistedSourceCvPlanReview(
    ctx.db,
    prepared.composition,
    prepared.jobId,
  );
  return projectCvTailoringReview(resumed);
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
  return projectCvTailoringReview(reviewed);
}

async function buildOwnedCvTailoringComposition(
  ctx: MutationCtx,
  requestedJobId: string,
  mode: CvTailoringReviewModeV1,
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
    ? profiles.find(
        (profile) => String(profile._id) === String(job.userId),
      )
    : null;
  if (!job || !ownerProfile) {
    throw new Error("Job not found");
  }
  if (job.archivedAt !== null && job.archivedAt !== undefined) {
    throw new Error("Archived Job cannot be tailored");
  }
  if (job.parseStatus !== "parsed" || job.reviewState !== "ready") {
    throw new Error(
      "Canonical Job Brief must be parsed and ready for CV tailoring",
    );
  }

  const attachedResumeId = requireString(
    job.lastResumeId,
    "attached resume",
  );
  const selectedProfile = resolveResumeProfileById(
    profiles,
    attachedResumeId,
  );
  if (!selectedProfile) {
    throw new Error("Attached resume not found");
  }
  const selectedProfileId = String(
    selectedProfile.profileId ?? selectedProfile._id ?? "",
  ).trim();
  const sourceCv = readRecord(selectedProfile.cvDocument);
  const sourceCvId = requireString(sourceCv?.id, "canonical source CV");
  if (
    selectedProfileId !== attachedResumeId ||
    sourceCvId !== attachedResumeId
  ) {
    throw new Error(
      "Attached resume, selected profile, and canonical source CV do not match",
    );
  }

  const now = Date.now();
  const built = await buildApplicationContextV1FromExistingData({
    userId: String(job.userId),
    job: { ...job, _id: String(job._id) },
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
    persisted.context.candidate.cvId !== attachedResumeId ||
    persisted.context.candidate.candidateHash !== built.candidateHash
  ) {
    throw new TypeError(
      "Persisted ApplicationContext does not match the attached source CV",
    );
  }

  const composition = await buildSourceCvPlanFromPersistence({
    persistence: buildSourceCvPlanPersistence(ctx.db),
    callerUserId: String(job.userId),
    applicationContextId: persisted.context.id,
    requestedJobId: jobId,
    mode,
    sourceAuthorization: "attached_source_cv",
    now: persisted.context.updatedAt,
  });
  return { composition, jobId };
}

function projectCvTailoringReview(
  composition: Awaited<
    ReturnType<typeof buildSourceCvPlanFromPersistence>
  >,
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
  return {
    mode: "auto_recommended",
    sourceCv,
    plan: {
      id: composition.plan.id,
      blocked: composition.plan.blocked,
      ...(composition.plan.blockedReason
        ? { blockedReason: composition.plan.blockedReason }
        : {}),
      items: composition.plan.items.map((item) => ({
        id: item.id,
        section: item.section,
        action: item.action,
        priority: item.priority,
        reviewState: item.reviewState,
        sourceCvItemReferenceIds: [
          ...(item.sourceCvItemReferenceIds ?? []),
        ],
        reason: item.reason,
      })),
      warnings: composition.plan.warnings.map((warning) => ({
        id: warning.id,
        category: warning.category,
        severity: warning.severity,
        reason: warning.reason,
      })),
    },
  };
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
