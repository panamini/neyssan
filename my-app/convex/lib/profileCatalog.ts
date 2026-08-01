type UserProfileId = string;

export const JOBS_READ_MODEL_VERSION = 4;

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
  matchFingerprint: string;
  isReviewedVariant: boolean;
};

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstPresent(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function buildMatchFingerprint(profile: Record<string, unknown>): string {
  const profileDetails = objectOrEmpty(profile.profile);
  const contact = objectOrEmpty(profile.contact);
  const cvDocument = objectOrEmpty(profile.cvDocument);
  const cvMetadata = objectOrEmpty(cvDocument.metadata);
  const authoritativeResume = objectOrEmpty(
    firstPresent(
      cvMetadata.authoritativeResume,
      cvDocument.authoritativeResume,
    ),
  );
  const serialized = JSON.stringify({
    profileId: stringOrNull(profile.profileId),
    defaultResumeId: stringOrNull(profile.defaultResumeId),
    desiredPosition: firstPresent(
      profile.desiredPosition,
      profileDetails.desiredPosition,
    ),
    headline: firstPresent(profile.headline),
    summary: stringOrNull(profile.summary),
    skills: arrayOrEmpty(profile.skills),
    keywords: arrayOrEmpty(profile.keywords),
    experience: arrayOrEmpty(profile.experience),
    education: arrayOrEmpty(profile.education),
    certifications: firstPresent(profile.certifications),
    certificates: firstPresent(profile.certificates),
    licenses: firstPresent(profile.licenses),
    languages: firstPresent(profile.languages),
    projects: firstPresent(profile.projects),
    achievements: firstPresent(profile.achievements),
    awards: firstPresent(profile.awards),
    publications: firstPresent(profile.publications),
    volunteer: firstPresent(profile.volunteer),
    affiliations: firstPresent(profile.affiliations),
    professionalAffiliations: firstPresent(profile.professionalAffiliations),
    memberships: firstPresent(profile.memberships),
    associations: firstPresent(profile.associations),
    additionalInformation: firstPresent(
      profile.additional_information,
      profile.additionalInformation,
      profile.additionalInfo,
    ),
    portfolio: firstPresent(profile.portfolio),
    website: firstPresent(profile.website),
    location: firstPresent(profile.location, contact.address),
    rawText: stringOrNull(profile.raw_text),
    authoritativeNormalized: firstPresent(authoritativeResume.normalized),
  });
  let primary = 0x811c9dc5;
  let secondary = 0x9e3779b9;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    primary = Math.imul(primary ^ code, 0x01000193);
    secondary = Math.imul(secondary ^ code, 0x85ebca6b);
  }
  return `match-v1-${(primary >>> 0).toString(16).padStart(8, "0")}${(
    secondary >>> 0
  )
    .toString(16)
    .padStart(8, "0")}-${serialized.length}`;
}

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
    matchFingerprint: buildMatchFingerprint(profile),
    isReviewedVariant:
      typeof profile.profileId === "string" &&
      profile.profileId.startsWith("source-cv-variant:v1:"),
  };
}

async function invalidateJobsReadModelForClerk(
  ctx: any,
  clerkId: string,
): Promise<void> {
  const state = await ctx.db
    .query("accountReadModels")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .first();
  if (!state) return;

  await ctx.db.replace(state._id, {
    clerkId,
    status: "backfilling",
    version: JOBS_READ_MODEL_VERSION,
    updatedAt: Date.now(),
  });
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
  const primarySelectionMayChange =
    !existing || Number(existing.updatedAt ?? 0) !== projection.updatedAt;
  const matchInputsChanged =
    existing &&
    typeof existing.matchFingerprint === "string" &&
    existing.matchFingerprint !== projection.matchFingerprint;

  if (existing) {
    await ctx.db.patch(existing._id, projection);
  } else {
    await ctx.db.insert("profileCatalog", projection);
  }

  if (primarySelectionMayChange || matchInputsChanged) {
    await invalidateJobsReadModelForClerk(ctx, projection.clerkId);
  }
}

export async function syncProfileCatalogById(
  ctx: any,
  profileId: any,
): Promise<void> {
  const profile = await ctx.db.get(profileId);
  if (profile) await upsertProfileCatalog(ctx, profile);
}
