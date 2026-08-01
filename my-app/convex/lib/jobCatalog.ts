import type { Id } from "../_generated/dataModel";

export const JOB_CATALOG_VERSION = 1 as const;

export type JobCatalogProjection = {
  jobId: Id<"jobs">;
  profileId: Id<"userProfiles">;
  ownerClerkId: string;
  title: string;
  company: string;
  location: string;
  sourceLanguage: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  parseStatus: string;
  reviewState: string;
  status: string;
  isSample: boolean;
  isFavorite: boolean;
  archived: boolean;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  lastActivityAt: number;
  version: typeof JOB_CATALOG_VERSION;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function buildJobCatalogProjection(
  job: Record<string, any>,
  ownerClerkId: string,
): JobCatalogProjection {
  const updatedAt = Number(job.updatedAt ?? job.importedAt ?? job._creationTime ?? 0);
  const lastOpenedAt = Number(job.lastOpenedAt ?? updatedAt);
  return {
    jobId: job._id as Id<"jobs">,
    profileId: job.userId as Id<"userProfiles">,
    ownerClerkId,
    title: stringValue(job.title),
    company: stringValue(job.company),
    location: stringValue(job.location),
    sourceLanguage: stringValue(job.rawLanguageDetected),
    sourceUrl: stringValue(job.sourceUrl),
    sourceDomain: stringValue(job.sourceDomain),
    sourceType: stringValue(job.sourceType),
    parseStatus: stringValue(job.parseStatus),
    reviewState: stringValue(job.reviewState),
    status: stringValue(job.status),
    isSample: Boolean(job.isSample),
    isFavorite: Boolean(job.isFavorite),
    archived: job.archivedAt !== null && job.archivedAt !== undefined,
    importedAt: Number(job.importedAt ?? job.createdAt ?? job._creationTime ?? 0),
    updatedAt,
    lastOpenedAt,
    lastActivityAt: Math.max(updatedAt, lastOpenedAt),
    version: JOB_CATALOG_VERSION,
  };
}

async function getCatalogRowForJob(ctx: any, jobId: Id<"jobs">) {
  return ctx.db
    .query("jobCatalog")
    .withIndex("by_job_id", (q: any) => q.eq("jobId", jobId))
    .unique();
}

export async function upsertJobCatalogProjection(
  ctx: any,
  job: Record<string, any>,
  ownerClerkId: string,
): Promise<JobCatalogProjection> {
  const projection = buildJobCatalogProjection(job, ownerClerkId);
  const existing = await getCatalogRowForJob(ctx, projection.jobId);
  if (existing) {
    await ctx.db.patch(existing._id, projection);
  } else {
    await ctx.db.insert("jobCatalog", projection);
  }
  return projection;
}

export async function syncJobCatalogById(
  ctx: any,
  jobId: Id<"jobs">,
  ownerClerkId?: string,
): Promise<JobCatalogProjection | null> {
  const job = await ctx.db.get(jobId);
  if (!job) {
    const existing = await getCatalogRowForJob(ctx, jobId);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  }

  let owner = ownerClerkId?.trim() ?? "";
  if (!owner) {
    const profile = await ctx.db.get(job.userId);
    owner = typeof profile?.clerkId === "string" ? profile.clerkId.trim() : "";
  }
  if (!owner) {
    const existing = await getCatalogRowForJob(ctx, jobId);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  }
  return upsertJobCatalogProjection(ctx, job, owner);
}

export async function insertJobWithCatalog(
  ctx: any,
  value: Record<string, unknown>,
  ownerClerkId?: string,
): Promise<Id<"jobs">> {
  const jobId = await ctx.db.insert("jobs", value);
  await syncJobCatalogById(ctx, jobId, ownerClerkId);
  return jobId;
}

export async function patchJobWithCatalog(
  ctx: any,
  jobId: Id<"jobs">,
  value: Record<string, unknown>,
  ownerClerkId?: string,
): Promise<void> {
  await ctx.db.patch(jobId, value);
  await syncJobCatalogById(ctx, jobId, ownerClerkId);
}

export async function deleteJobWithCatalog(
  ctx: any,
  jobId: Id<"jobs">,
): Promise<void> {
  const existing = await getCatalogRowForJob(ctx, jobId);
  if (existing) await ctx.db.delete(existing._id);
  await ctx.db.delete(jobId);
}
