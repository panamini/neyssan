import { buildMatchReadProfile, computeMatchRead } from "./jobs/matchRead";
import { detectJobPostingLanguage } from "./jobs/canonicalJobs";
import {
  buildJobMatchReviewFromStructuredDebug,
  buildStructuredMatchReadDebug,
  buildStructuredPendingMatchRead,
  type JobMatchReviewVerdict,
} from "./jobs/structuredMatchRead";

const LINKED_PROPOSAL_PROJECTION_LIMIT = 100;
const JOB_CATALOG_SHADOW_ROWS_LIMIT = 1;

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
  const resumeId =
    typeof job.lastResumeId === "string" && job.lastResumeId
      ? job.lastResumeId
      : typeof profile?.defaultResumeId === "string"
        ? profile.defaultResumeId
        : null;
  if (resumeId && profile?.profileId !== resumeId) {
    const resumeQuery = ctx.db
      .query("userProfiles")
      .withIndex("by_profileId", (q: any) => q.eq("profileId", resumeId));
    const candidates =
      typeof resumeQuery.take === "function"
        ? await resumeQuery.take(4)
        : (await resumeQuery.collect()).slice(0, 4);
    profile =
      candidates.find((candidate: any) => candidate.clerkId === ownerClerkId) ??
      profile;
  }
  const matchTier = profile
    ? computeMatchRead({
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
      }).tier
    : normalizeMatchTier(job.matchTier);
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
      ? await orderedShadowQuery.take(JOB_CATALOG_SHADOW_ROWS_LIMIT)
      : (await orderedShadowQuery.collect()).slice(
          0,
          JOB_CATALOG_SHADOW_ROWS_LIMIT,
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

  const proposalQuery = ctx.db
    .query("proposals")
    .withIndex("by_job_and_status", (q: any) =>
      q.eq("jobId", String(jobId)).eq("status", "saved"),
    );
  const proposals =
    typeof proposalQuery.take === "function"
      ? await proposalQuery.take(LINKED_PROPOSAL_PROJECTION_LIMIT)
      : (await proposalQuery.collect()).slice(0, LINKED_PROPOSAL_PROJECTION_LIMIT);
  const latestProposalAt = proposals.reduce(
    (latest: number, proposal: any) =>
      Math.max(latest, Number(proposal.updatedAt ?? proposal.createdAt ?? 0)),
    0,
  );

  await ctx.db.patch(catalog._id, {
    linkedDocumentCount: proposals.length,
    lastActivityAt: Math.max(
      Number(catalog.updatedAt ?? 0),
      Number(catalog.lastOpenedAt ?? 0),
      latestProposalAt,
    ),
  });
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
    matchTier: catalog.matchTier,
    matchRead: { tier: catalog.matchTier },
    matchReview,
    status: catalog.status,
    importedAt: catalog.importedAt,
    updatedAt: catalog.updatedAt,
    lastOpenedAt: catalog.lastOpenedAt,
    lastActivityAt: catalog.lastActivityAt,
    linkedDocumentCount: catalog.linkedDocumentCount,
  };
}
