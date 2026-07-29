import type { CvDocument } from "../../src/types/cvDocument";
import type { ApplicationContextV1 } from "../../src/modules/application-harness/schema";
import type { AutoRecommendedSourceCvApplicationCompositionResultV1 } from "../../src/modules/application-harness/sourceCvApplicationComposition";
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
  now: number;
}>;

export async function buildSourceCvPlanFromPersistence(
  input: BuildSourceCvPlanFromPersistenceInputV1,
): Promise<AutoRecommendedSourceCvApplicationCompositionResultV1> {
  const callerUserId = requireString(input?.callerUserId, "caller user");
  const applicationContextId = requireString(
    input?.applicationContextId,
    "application context",
  );
  const requestedJobId = requireString(input?.requestedJobId, "requested job");
  if (!Number.isFinite(input?.now)) {
    throw new TypeError("source CV plan orchestrator requires a numeric timestamp");
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
    job,
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

  const demands = await buildJobDemandsFromCanonicalJobBrief({
    jobId: applicationContext.job.jobId,
    mustHaves: readStringArray(job.mustHaves),
    responsibilities: readStringArray(job.responsibilities),
    keywords: readStringArray(job.keywords),
  });

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
