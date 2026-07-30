import type { CvDocument } from "../../src/types/cvDocument";
import type { ApplicationContextV1 } from "../../src/modules/application-harness/schema";
import type {
  AutoRecommendedSourceCvApplicationCompositionResultV1,
  SourceCvApplicationCompositionResultV1,
} from "../../src/modules/application-harness/sourceCvApplicationComposition";
import {
  buildCandidateCvItemReferences,
  resolveCandidateCvItemReference,
} from "../../src/modules/candidate-evidence/cvItemReferences";
import { buildEvidenceGraph } from "../../src/modules/evidence-graph/buildEvidenceGraph";
import type { JobDemandV1 } from "../../src/modules/evidence-graph/schema";
import { buildResumeVariantPlanHash } from "../../src/modules/resume-variant-plan/buildResumeVariantPlan";
import type {
  ResumeVariantPlanItemV1,
  ResumeVariantPlanSectionV1,
  ResumeVariantPlanV1,
} from "../../src/modules/resume-variant-plan/schema";
import { composeSourceCvVariantPlan } from "../../src/modules/application-harness/sourceCvComposition";
import {
  buildApplicationContextV1FromExistingData,
  type ApplicationContextBuilderCandidateProfile,
  type ApplicationContextBuilderJob,
} from "./applicationContextBuilder";
import { buildJobDemandsFromCanonicalJobBrief } from "./jobs/jobBriefDemands";
import {
  buildSourceCvCandidateFactApplicationComposition,
  type CandidateEvidencePersistencePortV1,
} from "./sourceCvCandidateFactAdapter";

type OwnedJobV1 = ApplicationContextBuilderJob & {
  userId?: unknown;
  parseStatus?: unknown;
  reviewState?: unknown;
  mustHaves?: unknown;
  responsibilities?: unknown;
  keywords?: unknown;
};

export type SourceCvPlanPersistencePortV1 =
  CandidateEvidencePersistencePortV1 &
    Readonly<{
      getApplicationContextForUser(input: Readonly<{
        userId: string;
        contextId: string;
      }>): Promise<ApplicationContextV1 | null>;
      getUserProfileById(input: Readonly<{
        userId: string;
      }>): Promise<
        | (ApplicationContextBuilderCandidateProfile & {
            clerkId?: unknown;
          })
        | null
      >;
      getSourceCvProfileForOwner?(input: Readonly<{
        ownerUserId: string;
        canonicalCvId: string;
      }>): Promise<
        | (ApplicationContextBuilderCandidateProfile & {
            clerkId?: unknown;
          })
        | null
      >;
      getJobById(input: Readonly<{
        jobId: string;
      }>): Promise<OwnedJobV1 | null>;
    }>;

export type BuildSourceCvPlanFromPersistenceInputV1 = Readonly<{
  persistence: SourceCvPlanPersistencePortV1;
  callerUserId: string;
  applicationContextId: string;
  requestedJobId: string;
  mode?: "auto_recommended" | "full_source_cv";
  sourceAuthorization?:
    | "persisted_candidate_evidence"
    | "attached_source_cv";
  now: number;
}>;

export async function buildSourceCvPlanFromPersistence(
  input: BuildSourceCvPlanFromPersistenceInputV1,
): Promise<SourceCvApplicationCompositionResultV1> {
  const callerUserId = requireString(input?.callerUserId, "caller user");
  const applicationContextId = requireString(
    input?.applicationContextId,
    "application context",
  );
  const requestedJobId = requireString(input?.requestedJobId, "requested job");
  if (!Number.isFinite(input?.now)) {
    throw new TypeError("source CV plan orchestrator requires a numeric timestamp");
  }
  if (
    input.mode !== undefined &&
    input.mode !== "auto_recommended" &&
    input.mode !== "full_source_cv"
  ) {
    throw new TypeError("unsupported source CV plan mode");
  }
  if (
    input.sourceAuthorization !== undefined &&
    input.sourceAuthorization !== "persisted_candidate_evidence" &&
    input.sourceAuthorization !== "attached_source_cv"
  ) {
    throw new TypeError("unsupported source CV authorization");
  }

  const applicationContext =
    await input.persistence.getApplicationContextForUser({
      userId: callerUserId,
      contextId: applicationContextId,
    });
  if (
    !applicationContext ||
    applicationContext.id !== applicationContextId ||
    applicationContext.userId !== callerUserId
  ) {
    throw new TypeError("ApplicationContext not found for caller");
  }
  if (applicationContext.job.jobId !== requestedJobId) {
    throw new TypeError("ApplicationContext does not match requested job");
  }
  if (applicationContext.candidate.sourceKind !== "cv") {
    throw new TypeError("ApplicationContext candidate is not a source CV");
  }
  if (!applicationContext.job.jobBriefHash) {
    throw new TypeError(
      "ApplicationContext lacks a verified canonical Job Brief binding",
    );
  }

  const ownerProfile = await input.persistence.getUserProfileById({
    userId: callerUserId,
  });
  if (!ownerProfile || readId(ownerProfile._id) !== callerUserId) {
    throw new TypeError("source CV owner profile not found for caller");
  }
  const ownerSourceCv = requireSourceCv(ownerProfile.cvDocument);
  let candidateProfile = ownerProfile;
  if (ownerSourceCv.id !== applicationContext.candidate.cvId) {
    const ownerClerkId = readId(ownerProfile.clerkId);
    const siblingProfile =
      await input.persistence.getSourceCvProfileForOwner?.({
        ownerUserId: callerUserId,
        canonicalCvId: applicationContext.candidate.cvId,
      });
    if (
      !ownerClerkId ||
      !siblingProfile ||
      readId(siblingProfile.clerkId) !== ownerClerkId
    ) {
      throw new TypeError("source CV profile not found for caller");
    }
    candidateProfile = siblingProfile;
  }
  const sourceCv = requireSourceCv(candidateProfile.cvDocument);
  if (sourceCv.id !== applicationContext.candidate.cvId) {
    throw new TypeError("current source CV does not match ApplicationContext");
  }

  const job = await input.persistence.getJobById({
    jobId: requestedJobId,
  });
  if (!job || readId(job._id) !== requestedJobId) {
    throw new TypeError("ApplicationContext job not found");
  }
  if (readId(job.userId) !== callerUserId) {
    throw new TypeError("ApplicationContext job owner does not match caller");
  }
  if (job.parseStatus !== "parsed" || job.reviewState !== "ready") {
    throw new TypeError(
      "canonical Job Brief must be parsed and ready for source CV plan preparation",
    );
  }

  const rebuilt = await buildApplicationContextV1FromExistingData({
    userId: callerUserId,
    job: projectCurrentJobForStoredContext(job, applicationContext),
    candidateProfile,
    settings: {
      ...(applicationContext.candidate.selectedLanguage
        ? { selectedLanguage: applicationContext.candidate.selectedLanguage }
        : {}),
      ...(applicationContext.candidate.market
        ? { market: applicationContext.candidate.market }
        : {}),
    },
    now: input.now,
  });
  assertCurrentContext(applicationContext, rebuilt.context);

  if (input.mode === "full_source_cv") {
    return composeSourceCvVariantPlan({
      mode: "full_source_cv",
      callerUserId,
      applicationContext,
      sourceCv,
    });
  }

  const demands = await buildJobDemandsFromCanonicalJobBrief({
    jobId: applicationContext.job.jobId,
    mustHaves: readStringArray(job.mustHaves),
    responsibilities: readStringArray(job.responsibilities),
    keywords: readStringArray(job.keywords),
  });

  if (input.sourceAuthorization === "attached_source_cv") {
    return buildApplicationScopedSourceCvComposition({
      callerUserId,
      applicationContext,
      sourceCv,
      demands,
    });
  }

  return buildSourceCvCandidateFactApplicationComposition({
    persistence: input.persistence,
    callerUserId,
    applicationContext,
    sourceCv,
    demands,
    careerKnowledgeRules: [],
    createdAt: applicationContext.createdAt,
    updatedAt: applicationContext.updatedAt,
  });
}

async function buildApplicationScopedSourceCvComposition(input: Readonly<{
  callerUserId: string;
  applicationContext: ApplicationContextV1;
  sourceCv: Readonly<CvDocument>;
  demands: readonly JobDemandV1[];
}>): Promise<AutoRecommendedSourceCvApplicationCompositionResultV1> {
  if (input.callerUserId !== input.applicationContext.userId) {
    throw new TypeError(
      "application-scoped source CV caller does not own the context",
    );
  }
  const cvItemReferences = buildCandidateCvItemReferences(input.sourceCv).sort(
    (left, right) => left.id.localeCompare(right.id),
  );
  const evidenceGraph = await buildEvidenceGraph({
    userId: input.applicationContext.userId,
    applicationContextId: input.applicationContext.id,
    demands: input.demands,
    candidateFacts: [],
    careerKnowledgeRules: [],
    createdAt: input.applicationContext.createdAt,
  });
  const items = cvItemReferences.map((reference) => {
    const resolved = resolveCandidateCvItemReference(
      input.sourceCv,
      reference,
    );
    const matchingDemands = resolveMatchingDemands(
      resolved.item,
      input.demands,
    );
    return buildApplicationScopedPlanItem(reference, matchingDemands);
  });
  const planWithoutStableId: ResumeVariantPlanV1 = {
    id: "resume-variant-plan:pending-hash",
    userId: input.applicationContext.userId,
    applicationContextId: input.applicationContext.id,
    evidenceGraphId: evidenceGraph.id,
    evidenceGraphHash: requireEvidenceGraphHash(evidenceGraph.id),
    targetDocumentKind: "cv",
    sourceCvId: input.sourceCv.id,
    ...(input.applicationContext.candidate.selectedLanguage
      ? { language: input.applicationContext.candidate.selectedLanguage }
      : {}),
    ...(input.applicationContext.candidate.market
      ? { market: input.applicationContext.candidate.market }
      : {}),
    items,
    warnings: [],
    blockedClaimIds: [],
    sourceFactIds: [],
    allowedClaimIds: [],
    riskFlagIds: [],
    blocked: false,
    createdAt: input.applicationContext.createdAt,
    updatedAt: input.applicationContext.updatedAt,
    version: 1,
  };
  const plan: ResumeVariantPlanV1 = {
    ...planWithoutStableId,
    id: `resume-variant-plan:${await buildResumeVariantPlanHash(
      planWithoutStableId,
    )}`,
  };

  return {
    mode: "auto_recommended",
    userId: input.applicationContext.userId,
    applicationContextId: input.applicationContext.id,
    sourceCvId: input.sourceCv.id,
    sourceCvContextHash: input.applicationContext.candidate.candidateHash,
    cvItemReferences,
    candidateFacts: [],
    evidenceGraph,
    plan,
  };
}

function buildApplicationScopedPlanItem(
  reference: ReturnType<typeof buildCandidateCvItemReferences>[number],
  matchingDemands: readonly JobDemandV1[],
): ResumeVariantPlanItemV1 {
  const requiredMatch = matchingDemands.some(
    (demand) => demand.required === "required",
  );
  return {
    id: `resume-variant-plan-item:source-cv:${reference.id}`,
    section: mapReferenceSection(reference.sectionType),
    action: "include",
    priority: requiredMatch
      ? "required"
      : matchingDemands.length > 0
        ? "recommended"
        : "optional",
    reviewState: "pending",
    sourceCvItemReferenceIds: [reference.id],
    allowedClaimIds: [],
    candidateFactIds: [],
    evidenceMatchIds: [],
    demandIds: matchingDemands.map((demand) => demand.id).sort(),
    riskFlagIds: [],
    reason:
      matchingDemands.length > 0
        ? `Current source CV item overlaps ${matchingDemands.length} canonical Job Brief demand(s).`
        : "Current source CV item is available for this application-specific review.",
    version: 1,
  };
}

function mapReferenceSection(
  sectionType: "experience" | "education" | "skill",
): ResumeVariantPlanSectionV1 {
  if (sectionType === "skill") {
    return "skills";
  }
  return sectionType;
}

function resolveMatchingDemands(
  item: unknown,
  demands: readonly JobDemandV1[],
): readonly JobDemandV1[] {
  const itemTokens = normalizeComparableTokens(
    JSON.stringify(item),
  );
  return demands
    .filter((demand) => {
      const demandTokens = normalizeComparableTokens(demand.label);
      return (
        demandTokens.size > 0 &&
        [...demandTokens].every((token) => itemTokens.has(token))
      );
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeComparableTokens(value: string): ReadonlySet<string> {
  return new Set(
    value
      .normalize("NFKC")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

function requireEvidenceGraphHash(id: string): string {
  const prefix = "evidence-graph:";
  if (!id.startsWith(prefix) || id.length === prefix.length) {
    throw new TypeError("application-scoped EvidenceGraph lacks a stable hash");
  }
  return id.slice(prefix.length);
}

function projectCurrentJobForStoredContext(
  currentJob: ApplicationContextBuilderJob,
  storedContext: ApplicationContextV1,
): ApplicationContextBuilderJob {
  return {
    _id: currentJob._id,
    rawDescription: currentJob.rawDescription,
    mustHaves: currentJob.mustHaves,
    responsibilities: currentJob.responsibilities,
    keywords: currentJob.keywords,
    ...(storedContext.job.sourceUrl !== undefined
      ? { sourceUrl: currentJob.sourceUrl }
      : {}),
    ...(storedContext.job.title !== undefined
      ? { title: currentJob.title }
      : {}),
    ...(storedContext.job.company !== undefined
      ? { company: currentJob.company }
      : {}),
  };
}

function assertCurrentContext(
  stored: ApplicationContextV1,
  current: ApplicationContextV1,
): void {
  if (
    stored.id !== current.id ||
    stored.contextHash !== current.contextHash ||
    stored.settingsHash !== current.settingsHash ||
    stored.job.rawTextHash !== current.job.rawTextHash ||
    stored.job.jobBriefHash !== current.job.jobBriefHash ||
    stored.candidate.sourceKind !== "cv" ||
    current.candidate.sourceKind !== "cv" ||
    stored.candidate.cvId !== current.candidate.cvId ||
    stored.candidate.candidateHash !== current.candidate.candidateHash
  ) {
    throw new TypeError(
      "ApplicationContext is stale for the current job or source CV",
    );
  }
}

function requireSourceCv(value: unknown): Readonly<CvDocument> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !requireOptionalString((value as { id?: unknown }).id) ||
    !Array.isArray((value as { sections?: unknown }).sections)
  ) {
    throw new TypeError("owner profile has no canonical source CV");
  }
  return value as Readonly<CvDocument>;
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function readId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function requireString(value: unknown, label: string): string {
  const normalized = readId(value);
  if (!normalized) {
    throw new TypeError(`source CV plan orchestrator requires ${label}`);
  }
  return normalized;
}

function requireOptionalString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}
