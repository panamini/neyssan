import { buildMatchReadProfile, computeMatchRead } from "./jobs/matchRead";

const LINKED_PROPOSAL_PROJECTION_LIMIT = 100;

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

export function buildJobCatalogProjection(
  job: Record<string, any>,
  ownerClerkId: string,
  existing?: Partial<JobCatalogProjection> | null,
  matchTierOverride?: JobCatalogProjection["matchTier"],
): JobCatalogProjection {
  const updatedAt = Number(job.updatedAt ?? job.createdAt ?? 0);
  const lastOpenedAt = Number(job.lastOpenedAt ?? updatedAt);
  const linkedDocumentCount = Number(existing?.linkedDocumentCount ?? 0);
  const lastActivityAt = Math.max(
    updatedAt,
    lastOpenedAt,
    Number(existing?.lastActivityAt ?? 0),
  );

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
  await upsertJobCatalog(ctx, job, ownerClerkId, matchTier);
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
    matchReview: null,
    status: catalog.status,
    importedAt: catalog.importedAt,
    updatedAt: catalog.updatedAt,
    lastOpenedAt: catalog.lastOpenedAt,
    lastActivityAt: catalog.lastActivityAt,
    linkedDocumentCount: catalog.linkedDocumentCount,
  };
}
