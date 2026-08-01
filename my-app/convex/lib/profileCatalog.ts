type UserProfileId = string;

export type ProfileCatalogProjection = {
  profileId: UserProfileId;
  clerkId: string;
  externalProfileId?: string;
  label?: string;
  version: number;
  profileCreatedAt?: number;
  updatedAt: number;
  defaultResumeId?: string | null;
  defaultResumeName?: string | null;
};

function resolveCatalogLabel(profile: Record<string, unknown>): string | null {
  const cvDocument =
    profile.cvDocument && typeof profile.cvDocument === "object"
      ? (profile.cvDocument as Record<string, unknown>)
      : null;
  for (const candidate of [
    cvDocument?.title,
    profile.defaultResumeName,
    profile.name,
    profile.profileId,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

export function buildProfileCatalogProjection(
  profile: Record<string, unknown> & { _id?: UserProfileId },
): ProfileCatalogProjection | null {
  const profileId = profile._id;
  const clerkId = typeof profile.clerkId === "string" ? profile.clerkId : "";
  if (!profileId || !clerkId) return null;
  const label = resolveCatalogLabel(profile);

  return {
    profileId,
    clerkId,
    ...(typeof profile.profileId === "string"
      ? { externalProfileId: profile.profileId }
      : {}),
    ...(label ? { label } : {}),
    version: typeof profile.version === "number" ? profile.version : 1,
    ...(typeof profile.createdAt === "number" ||
    typeof profile._creationTime === "number"
      ? {
          profileCreatedAt:
            typeof profile.createdAt === "number"
              ? profile.createdAt
              : (profile._creationTime as number),
        }
      : {}),
    updatedAt:
      typeof profile.updatedAt === "number"
        ? profile.updatedAt
        : typeof profile.createdAt === "number"
          ? profile.createdAt
          : 0,
    ...(typeof profile.defaultResumeId === "string" ||
    profile.defaultResumeId === null
      ? { defaultResumeId: profile.defaultResumeId }
      : {}),
    ...(typeof profile.defaultResumeName === "string" ||
    profile.defaultResumeName === null
      ? { defaultResumeName: profile.defaultResumeName }
      : {}),
  };
}

export async function upsertProfileCatalog(
  ctx: any,
  profile: Record<string, unknown> & { _id?: UserProfileId },
): Promise<void> {
  const projection = buildProfileCatalogProjection(profile);
  if (!projection) return;

  const existingQuery = ctx.db
    .query("profileCatalog")
    .withIndex("by_profile_id", (q: any) => q.eq("profileId", projection.profileId));
  const existing =
    typeof existingQuery.first === "function"
      ? await existingQuery.first()
      : typeof existingQuery.take === "function"
        ? (await existingQuery.take(1))[0] ?? null
        : (await existingQuery.collect())[0] ?? null;

  if (existing) {
    await ctx.db.patch(existing._id, projection);
  } else {
    await ctx.db.insert("profileCatalog", projection);
  }
}

export async function syncProfileCatalogById(
  ctx: any,
  profileId: any,
): Promise<void> {
  const profile = await ctx.db.get(profileId);
  if (profile) await upsertProfileCatalog(ctx, profile);
}
