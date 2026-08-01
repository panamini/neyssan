import {
  buildMatchReadProfile,
  computeMatchRead,
  resolveMatchReadSourceProfile,
} from "./jobs/matchRead";
import { detectJobPostingLanguage } from "./jobs/canonicalJobs";
import {
  buildJobMatchReviewFromStructuredDebug,
  buildStructuredMatchReadDebug,
  buildStructuredPendingMatchRead,
  STRUCTURED_MATCH_SHADOW_WINDOW,
  type JobMatchReviewVerdict,
} from "./jobs/structuredMatchRead";

type JobCatalogMatchReview = {
  verdict: JobMatchReviewVerdict;
  score: number;
};

export type JobCatalogProjection = {
  jobId: string;
  ownerClerkId: string;
  profileId: string;
  title: string;
  company: string;
  location: string;
  sourceLanguage: string | null;
  isSample: boolean;
  isFavorite: boolean;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  parseStatus: string;
  reviewState: string;
  matchTier: "strong" | "partial" | "weak" | "unknown";
  matchReviewVerdict?: JobMatchReviewVerdict | null;
  matchReviewScore?: number | null;
  status: string;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  lastActivityAt: number;
  linkedDocumentCount: number;
  archivedAt?: number | null;
  isArchived?: boolean;
};

function normalizeMatchTier(value: unknown): JobCatalogProjection["matchTier"] {
  return value === "strong" || value === "partial" || value === "weak"
    ? value
    : "unknown";
}

function normalizeMatchReviewVerdict(
  value: unknown,
): JobMatchReviewVerdict | null {
  return value === "strong_lead" ||
    value === "possible_lead" ||
    value === "probably_skip" ||
    value === "not_enough_signal"
    ? value
    : null;
}

function resolveEffectiveJobRawLanguageDetected(job: Record<string, any>) {
  const stored = String(job.rawLanguageDetected ?? "").trim();
  const detected = detectJobPostingLanguage(
    `${job.title ?? ""}\n${job.rawDescription ?? ""}`,
  );
  if (stored.toLowerCase().startsWith("en") && detected !== "en") {
    return detected;
  }
  return stored || detected;
}

export function buildJobCatalogProjection(
  job: Record<string, any>,
  ownerClerkId: string,
  existing?: Partial<JobCatalogProjection> | null,
  matchTierOverride?: JobCatalogProjection["matchTier"],
  matchReviewOverride?: JobCatalogMatchReview | null,
): JobCatalogProjection {
  const updatedAt = Number(job.updatedAt ?? job.createdAt ?? 0);
  const lastOpenedAt = Number(job.lastOpenedAt ?? updatedAt);
  const linkedDocumentCount = Number(existing?.linkedDocumentCount ?? 0);
  const lastActivityAt = Math.max(
    updatedAt,
    lastOpenedAt,
    Number(existing?.lastActivityAt ?? 0),
  );
  const matchReviewVerdict =
    matchReviewOverride === undefined
      ? normalizeMatchReviewVerdict(existing?.matchReviewVerdict)
      : matchReviewOverride?.verdict ?? null;
  const matchReviewScore =
    matchReviewOverride === undefined
      ? typeof existing?.matchReviewScore === "number"
        ? existing.matchReviewScore
        : null
      : matchReviewOverride?.score ?? null;

  return {
    jobId: String(job._id),
    ownerClerkId,
    profileId: String(job.userId),
    title: String(job.title ?? ""),
    company: String(job.company ?? ""),
    location: String(job.location ?? ""),
    sourceLanguage:
      typeof job.rawLanguageDetected === "string"
        ? job.rawLanguageDetected
        : null,
    isSample: Boolean(job.isSample),
    isFavorite: Boolean(job.isFavorite),
    sourceUrl: String(job.sourceUrl ?? ""),
    sourceDomain: String(job.sourceDomain ?? ""),
    sourceType: String(job.sourceType ?? ""),
    parseStatus: String(job.parseStatus ?? "pending"),
    reviewState: String(job.reviewState ?? "needs_review"),
    matchTier: matchTierOverride ?? normalizeMatchTier(job.matchTier),
    matchReviewVerdict,
    matchReviewScore,
    status: String(job.status ?? "active"),
    importedAt: Number(job.importedAt ?? updatedAt),
    updatedAt,
    lastOpenedAt,
    lastActivityAt,
    linkedDocumentCount,
    archivedAt: typeof job.archivedAt === "number" ? job.archivedAt : null,
    isArchived: typeof job.archivedAt === "number",
  };
}

export async function upsertJobCatalog(
  ctx: any,
  job: Record<string, any>,
  ownerClerkId: string,
  matchTierOverride?: JobCatalogProjection["matchTier"],
  matchReviewOverride?: JobCatalogMatchReview | null,
): Promise<void> {
  const existingQuery = ctx.db
    .query("jobCatalog")
    .withIndex("by_job_id", (q: any) => q.eq("jobId", job._id));
  const existing =
    typeof existingQuery.first === "function"
      ? await existingQuery.first()
      : typeof existingQuery.take === "function"
        ? (await existingQuery.take(1))[0] ?? null
        : (await existingQuery.collect())[0] ?? null;
  const projection = buildJobCatalogProjection(
    job,
    ownerClerkId,
    existing,
    matchTierOverride,
    matchReviewOverride,
  );

  if (existing) {
    await ctx.db.patch(existing._id, projection);
  } else {
    await ctx.db.insert("jobCatalog", projection);
  }
}

export async function syncJobCatalogById(ctx: any, jobId: any): Promise<void> {
  const job = await ctx.db.get(jobId);
  if (!job) return;
  let ownerClerkId =
    typeof job.ownerClerkId === "string" ? job.ownerClerkId : "";
  let profile = job.userId ? await ctx.db.get(job.userId) : null;
  if (!ownerClerkId && profile) {
    ownerClerkId =
      typeof profile?.clerkId === "string" ? profile.clerkId : "";
  }
  if (!ownerClerkId) return;
  if (job.ownerClerkId !== ownerClerkId) {
    await ctx.db.patch(job._id, { ownerClerkId });
  }
  const primaryCatalogQuery = ctx.db
    .query("profileCatalog")
    .withIndex("by_clerk_variant_updated_at", (q: any) =>
      q.eq("clerkId", ownerClerkId).eq("isReviewedVariant", false),
    );
  const orderedPrimaryQuery =
    typeof primaryCatalogQuery.order === "function"
      ? primaryCatalogQuery.order("desc")
      : primaryCatalogQuery;
  const primaryCatalogRows =
    typeof orderedPrimaryQuery.take === "function"
      ? await orderedPrimaryQuery.take(1)
      : (await orderedPrimaryQuery.collect()).slice(0, 1);
  const primaryProfile = primaryCatalogRows[0]?.profileId
    ? await ctx.db.get(primaryCatalogRows[0].profileId)
    : profile;
  const selectedResumeId =
    typeof job.lastResumeId === "string" && job.lastResumeId.trim()
      ? job.lastResumeId.trim()
      : typeof primaryProfile?.defaultResumeId === "string"
        ? primaryProfile.defaultResumeId.trim()
        : "";
  const candidateProfiles = [primaryProfile].filter(Boolean);
  if (
    selectedResumeId &&
    !candidateProfiles.some(
      (candidate: any) => candidate.profileId === selectedResumeId,
    )
  ) {
    const resumeQuery = ctx.db
      .query("userProfiles")
      .withIndex("by_profileId", (q: any) =>
        q.eq("profileId", selectedResumeId),
      );
    const candidates =
      typeof resumeQuery.take === "function"
        ? await resumeQuery.take(4)
        : (await resumeQuery.collect()).slice(0, 4);
    const selectedProfile = candidates.find(
      (candidate: any) => candidate.clerkId === ownerClerkId,
    );
    if (selectedProfile) candidateProfiles.unshift(selectedProfile);
  }
  profile = resolveMatchReadSourceProfile({
    job,
    primaryProfile,
    profiles: candidateProfiles,
  });
  const matchTier = computeMatchRead({
    job: {
      id: String(job._id),
      parseVersion: job.parseVersion,
      parseStatus: job.parseStatus,
      mustHaves: job.mustHaves,
      keywords: job.keywords,
      mustHavesExtraction: job.mustHavesExtraction,
      keywordsExtraction: job.keywordsExtraction,
    },
    profile: buildMatchReadProfile(profile),
  }).tier;
  const pendingMatchRead = buildStructuredPendingMatchRead({
    jobId: String(job._id),
    profileId: String(profile?.profileId ?? profile?._id ?? ""),
  });
  const shadowQuery = ctx.db
    .query("job_extraction_shadow")
    .withIndex("by_job_id", (q: any) => q.eq("job_id", job._id));
  const orderedShadowQuery =
    typeof shadowQuery.order === "function"
      ? shadowQuery.order("desc")
      : shadowQuery;
  const shadowRows =
    typeof orderedShadowQuery.take === "function"
      ? await orderedShadowQuery.take(STRUCTURED_MATCH_SHADOW_WINDOW)
      : (await orderedShadowQuery.collect()).slice(
          0,
          STRUCTURED_MATCH_SHADOW_WINDOW,
        );
  const matchReview = buildJobMatchReviewFromStructuredDebug(
    buildStructuredMatchReadDebug({
      old: pendingMatchRead,
      job: {
        id: String(job._id),
        rawLanguageDetected: resolveEffectiveJobRawLanguageDetected(job),
      },
      profile,
      shadowRows,
    }),
  );
  await upsertJobCatalog(ctx, job, ownerClerkId, matchTier, {
    verdict: matchReview.verdict,
    score: matchReview.score,
  });
}

export async function refreshJobCatalogProposalStats(
  ctx: any,
  jobId: string,
): Promise<void> {
  const catalogQuery = ctx.db
    .query("jobCatalog")
    .withIndex("by_job_id", (q: any) => q.eq("jobId", jobId));
  const catalog =
    typeof catalogQuery.first === "function"
      ? await catalogQuery.first()
      : (await catalogQuery.take(1))[0] ?? null;
  if (!catalog) return;

  const stats = await ctx.db
    .query("jobProposalStats")
    .withIndex("by_job_id", (q: any) => q.eq("jobId", jobId))
    .first();

  await ctx.db.patch(catalog._id, {
    linkedDocumentCount: Number(stats?.linkedDocumentCount ?? 0),
    lastActivityAt: Math.max(
      Number(catalog.updatedAt ?? 0),
      Number(catalog.lastOpenedAt ?? 0),
      Number(stats?.latestProposalAt ?? 0),
    ),
  });
}

async function getJobProposalStats(ctx: any, jobId: string) {
  return ctx.db
    .query("jobProposalStats")
    .withIndex("by_job_id", (q: any) => q.eq("jobId", jobId))
    .first();
}

const JOB_PROPOSAL_MATERIALIZATION_VERSION = 1;

export async function ensureJobProposalStatsMaterialization(
  ctx: any,
  jobId: string,
) {
  const existing = await getJobProposalStats(ctx, jobId);
  if (existing?.materializationVersion === JOB_PROPOSAL_MATERIALIZATION_VERSION) {
    return existing;
  }
  const value = {
    jobId,
    linkedDocumentCount: 0,
    latestProposalAt: 0,
    materializationVersion: JOB_PROPOSAL_MATERIALIZATION_VERSION,
    updatedAt: Date.now(),
  };
  if (existing) await ctx.db.patch(existing._id, value);
  else await ctx.db.insert("jobProposalStats", value);
  await refreshJobCatalogProposalStats(ctx, jobId);
  return { ...existing, ...value };
}

async function writeJobProposalStats(
  ctx: any,
  jobId: string,
  count: number,
  latestProposalAt: number,
) {
  const existing = await getJobProposalStats(ctx, jobId);
  const value = {
    jobId,
    linkedDocumentCount: Math.max(0, count),
    latestProposalAt: Math.max(0, latestProposalAt),
    materializationVersion: JOB_PROPOSAL_MATERIALIZATION_VERSION,
    updatedAt: Date.now(),
  };
  if (existing) await ctx.db.patch(existing._id, value);
  else await ctx.db.insert("jobProposalStats", value);
  await refreshJobCatalogProposalStats(ctx, jobId);
}

function savedProposalJobId(proposal: any): string | null {
  return proposal?.status === "saved" && typeof proposal.jobId === "string"
    ? proposal.jobId
    : null;
}

function proposalActivity(proposal: any): number {
  return Number(proposal?.updatedAt ?? proposal?.createdAt ?? 0);
}

export async function syncJobProposalStatsDelta(
  ctx: any,
  before: Record<string, any> | null,
  after: Record<string, any> | null,
) {
  const proposalId = String(after?._id ?? before?._id ?? "");
  if (!proposalId) return;
  const materialized = await ctx.db
    .query("jobProposalMaterializations")
    .withIndex("by_proposal_id", (q: any) => q.eq("proposalId", proposalId))
    .first();
  const observedActivity = proposalActivity(after ?? before);
  if (materialized && Number(materialized.proposalActivityAt) > observedActivity) {
    return;
  }
  const oldJobId = typeof materialized?.jobId === "string"
    ? materialized.jobId
    : null;
  const newJobId = savedProposalJobId(after);
  if (
    materialized &&
    oldJobId === newJobId &&
    Number(materialized.proposalActivityAt) === observedActivity
  ) {
    return;
  }
  const affected = new Set([oldJobId, newJobId].filter(Boolean) as string[]);
  for (const jobId of affected) {
    const stats = await ensureJobProposalStatsMaterialization(ctx, jobId);
    let count = Number(stats?.linkedDocumentCount ?? 0);
    let latest = Number(stats?.latestProposalAt ?? 0);
    if (oldJobId !== newJobId) {
      if (oldJobId === jobId) count -= 1;
      if (newJobId === jobId) count += 1;
    }
    if (newJobId === jobId) latest = Math.max(latest, proposalActivity(after));
    if (
      oldJobId === jobId &&
      newJobId !== jobId &&
      proposalActivity(before) >= latest
    ) {
      const latestQuery = ctx.db
        .query("proposals")
        .withIndex("by_job_status_updated", (q: any) =>
          q.eq("jobId", jobId).eq("status", "saved"),
        );
      const orderedLatestQuery =
        typeof latestQuery.order === "function"
          ? latestQuery.order("desc")
          : latestQuery;
      const latestRow = await orderedLatestQuery.first();
      latest = proposalActivity(latestRow);
    }
    await writeJobProposalStats(ctx, jobId, count, latest);
  }
  const materializedValue = {
    proposalId,
    ...(newJobId ? { jobId: newJobId } : {}),
    proposalActivityAt: observedActivity,
    updatedAt: Date.now(),
  };
  if (materialized) await ctx.db.replace(materialized._id, materializedValue);
  else await ctx.db.insert("jobProposalMaterializations", materializedValue);
}

export function toJobListItem(catalog: JobCatalogProjection) {
  const matchReviewVerdict = normalizeMatchReviewVerdict(
    catalog.matchReviewVerdict,
  );
  const matchReview =
    matchReviewVerdict !== null &&
    typeof catalog.matchReviewScore === "number"
      ? {
          verdict: matchReviewVerdict,
          score: catalog.matchReviewScore,
        }
      : null;
  const visibleTier =
    matchReviewVerdict === "not_enough_signal" ? "unknown" : catalog.matchTier;
  return {
    id: String(catalog.jobId),
    title: catalog.title,
    company: catalog.company,
    location: catalog.location,
    sourceLanguage: catalog.sourceLanguage,
    isSample: catalog.isSample,
    isFavorite: catalog.isFavorite,
    sourceUrl: catalog.sourceUrl,
    sourceDomain: catalog.sourceDomain,
    sourceType: catalog.sourceType,
    parseStatus: catalog.parseStatus,
    reviewState: catalog.reviewState,
    matchTier: visibleTier,
    matchRead: { tier: visibleTier },
    matchReview,
    status: catalog.status,
    importedAt: catalog.importedAt,
    updatedAt: catalog.updatedAt,
    lastOpenedAt: catalog.lastOpenedAt,
    lastActivityAt: catalog.lastActivityAt,
    linkedDocumentCount: catalog.linkedDocumentCount,
  };
}
