import type { Id } from "../_generated/dataModel";

export type StoredUserProfileExperience = {
  company: string;
  title: string;
  startDate?: string | number | null;
  endDate?: string | number | null;
  description?: string;
  current?: boolean;
};

export type StoredUserProfile = {
  _id: Id<"userProfiles">;
  _creationTime: number;
  clerkId?: string;
  email?: string;
  name?: string;
  updatedAt?: number;
  createdAt?: number;
  version?: number;
  summary?: string;
  skills?: string[];
  keywords?: string[];
  experience?: StoredUserProfileExperience[];
  raw_text?: string;
  preferences?: {
    rateLimits?: Record<string, unknown>;
    writingStyle: string;
    tonePreference: string;
    autoSend: boolean;
  };
  [key: string]: any;
};

type ActiveCvSnapshotExperience = {
  company?: string;
  position?: string;
  highlights?: string[];
};

type ActiveCvSnapshotContext = {
  name?: string;
  summary?: string;
  desiredPosition?: string;
  topSkills?: string[];
  recentExperience?: ActiveCvSnapshotExperience[];
  standoutAchievements?: string[];
};

export type ActiveCvSnapshotRecord = {
  title: string;
  personalizationContext: ActiveCvSnapshotContext | null;
  updatedAt?: string;
};

export type CanonicalUserProfile = {
  id: Id<"userProfiles">;
  clerkId?: string;
  email: string;
  name?: string;
  summary?: string;
  skills: string[];
  keywords: string[];
  experience: StoredUserProfileExperience[];
  rawText?: string;
  updatedAt: number;
  version: number;
};

export const DEFAULT_PROFILE_PREFERENCES = {
  writingStyle: "professional",
  tonePreference: "formal",
  autoSend: false,
} as const;

const MAX_CANONICAL_KEYWORDS = 32;
const PROFILE_KEYWORD_STOP_WORDS = new Set([
  "and",
  "about",
  "across",
  "after",
  "again",
  "among",
  "because",
  "being",
  "build",
  "built",
  "candidate",
  "company",
  "currently",
  "deliver",
  "driven",
  "experience",
  "focused",
  "for",
  "including",
  "into",
  "looking",
  "manage",
  "managed",
  "professional",
  "responsible",
  "skilled",
  "strong",
  "support",
  "team",
  "the",
  "their",
  "there",
  "these",
  "those",
  "using",
  "with",
]);

function compactWhitespace(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeStringList(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values ?? []) {
    const nextValue = compactWhitespace(value);
    if (!nextValue) {
      continue;
    }

    const dedupeKey = nextValue.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push(nextValue);
  }

  return normalized;
}

function normalizeKeywordValue(value: string): string {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/^[,.;:!?()[\]{}"'`-]+|[,.;:!?()[\]{}"'`-]+$/g, "");
}

function tokenizeKeywordText(value: string): string[] {
  const matches = compactWhitespace(value).match(/[a-z0-9+#./-]{3,}/gi) ?? [];
  const orderedTokens: string[] = [];

  for (const match of matches) {
    const token = normalizeKeywordValue(match);
    if (!token || PROFILE_KEYWORD_STOP_WORDS.has(token)) {
      continue;
    }

    orderedTokens.push(token);
  }

  return orderedTokens;
}

function normalizeExperience(
  experience: StoredUserProfileExperience[] | undefined,
): StoredUserProfileExperience[] {
  return (experience ?? [])
    .map((entry) => ({
      company: compactWhitespace(entry.company),
      title: compactWhitespace(entry.title),
      ...(entry.startDate !== undefined ? { startDate: entry.startDate } : {}),
      ...(entry.endDate !== undefined ? { endDate: entry.endDate } : {}),
      ...(compactWhitespace(entry.description ?? "")
        ? { description: compactWhitespace(entry.description ?? "") }
        : {}),
      ...(entry.current !== undefined ? { current: entry.current } : {}),
    }))
    .filter(
      (entry) =>
        entry.company.length > 0 ||
        entry.title.length > 0 ||
        compactWhitespace(entry.description ?? "").length > 0,
    );
}

function mapActiveCvSnapshotExperience(
  snapshotExperience: ActiveCvSnapshotExperience[] | undefined,
): StoredUserProfileExperience[] {
  return (snapshotExperience ?? [])
    .map((entry) => {
      const description = normalizeStringList(entry.highlights).join(" • ");
      return {
        company: compactWhitespace(entry.company ?? ""),
        title: compactWhitespace(entry.position ?? ""),
        ...(description ? { description } : {}),
      };
    })
    .filter(
      (entry) =>
        entry.company.length > 0 ||
        entry.title.length > 0 ||
        compactWhitespace(entry.description ?? "").length > 0,
    );
}

/**
 * Deterministic derivation contract for canonical profile keywords:
 * summary tokens -> normalized skill phrases -> experience title/description tokens -> raw text tokens.
 * Each candidate is lower-cased, whitespace-compacted, de-duplicated by exact normalized value,
 * and the ordered output is capped at MAX_CANONICAL_KEYWORDS.
 */
export function deriveCanonicalProfileKeywords(args: {
  summary?: string;
  skills?: string[];
  experience?: StoredUserProfileExperience[];
  rawText?: string;
}): string[] {
  const orderedKeywords: string[] = [];
  const seen = new Set<string>();

  const pushKeyword = (value: string) => {
    const normalizedValue = normalizeKeywordValue(value);
    if (!normalizedValue || seen.has(normalizedValue)) {
      return;
    }

    seen.add(normalizedValue);
    orderedKeywords.push(normalizedValue);
  };

  for (const token of tokenizeKeywordText(args.summary ?? "")) {
    pushKeyword(token);
    if (orderedKeywords.length >= MAX_CANONICAL_KEYWORDS) {
      return orderedKeywords;
    }
  }

  for (const skill of normalizeStringList(args.skills)) {
    pushKeyword(skill);
    if (orderedKeywords.length >= MAX_CANONICAL_KEYWORDS) {
      return orderedKeywords;
    }
  }

  for (const experienceEntry of normalizeExperience(args.experience)) {
    for (const token of [
      ...tokenizeKeywordText(experienceEntry.title),
      ...tokenizeKeywordText(experienceEntry.description ?? ""),
    ]) {
      pushKeyword(token);
      if (orderedKeywords.length >= MAX_CANONICAL_KEYWORDS) {
        return orderedKeywords;
      }
    }
  }

  for (const token of tokenizeKeywordText(args.rawText ?? "")) {
    pushKeyword(token);
    if (orderedKeywords.length >= MAX_CANONICAL_KEYWORDS) {
      return orderedKeywords;
    }
  }

  return orderedKeywords;
}

export function resolveCanonicalProfileKeywordsForWrite(args: {
  nextKeywords?: string[];
  summary?: string;
  skills?: string[];
  experience?: StoredUserProfileExperience[];
  rawText?: string;
}): string[] {
  if (args.nextKeywords !== undefined) {
    return normalizeStringList(args.nextKeywords)
      .map(normalizeKeywordValue)
      .filter(Boolean)
      .slice(0, MAX_CANONICAL_KEYWORDS);
  }

  return deriveCanonicalProfileKeywords({
    summary: args.summary,
    skills: args.skills,
    experience: args.experience,
    rawText: args.rawText,
  });
}

function resolveStoredKeywords(args: {
  profile?: Pick<
    StoredUserProfile,
    "keywords" | "summary" | "skills" | "experience" | "raw_text"
  > | null;
}): string[] {
  const explicitKeywords = normalizeStringList(args.profile?.keywords).map(
    normalizeKeywordValue,
  ).filter(Boolean);

  if (explicitKeywords.length > 0) {
    return explicitKeywords.slice(0, MAX_CANONICAL_KEYWORDS);
  }

  return deriveCanonicalProfileKeywords({
    summary: args.profile?.summary,
    skills: args.profile?.skills,
    experience: args.profile?.experience,
    rawText: args.profile?.raw_text,
  });
}

export function buildCanonicalProfileSeed(args: {
  existingProfile?: Pick<
    StoredUserProfile,
    "name" | "email" | "summary" | "skills" | "keywords" | "experience" | "raw_text"
  > | null;
  activeCvSnapshot?: ActiveCvSnapshotRecord | null;
  fallbackEmail?: string | null;
  fallbackName?: string | null;
}): {
  email: string;
  name?: string;
  summary?: string;
  skills: string[];
  keywords: string[];
  experience: StoredUserProfileExperience[];
  raw_text?: string;
} {
  const snapshotContext = args.activeCvSnapshot?.personalizationContext;
  const existingProfile = args.existingProfile ?? null;
  const nextSummary =
    compactWhitespace(existingProfile?.summary ?? "") ||
    compactWhitespace(snapshotContext?.summary ?? "") ||
    undefined;
  const nextSkills = normalizeStringList(
    existingProfile?.skills?.length
      ? existingProfile.skills
      : snapshotContext?.topSkills,
  );
  const nextExperience = normalizeExperience(
    existingProfile?.experience?.length
      ? existingProfile.experience
      : mapActiveCvSnapshotExperience(snapshotContext?.recentExperience),
  );
  const nextRawText = compactWhitespace(existingProfile?.raw_text ?? "") || undefined;
  const nextEmail =
    compactWhitespace(existingProfile?.email ?? "") ||
    compactWhitespace(args.fallbackEmail ?? "");
  const nextName =
    compactWhitespace(existingProfile?.name ?? "") ||
    compactWhitespace(snapshotContext?.name ?? "") ||
    compactWhitespace(args.fallbackName ?? "") ||
    undefined;
  const explicitKeywords = normalizeStringList(existingProfile?.keywords);
  const nextKeywords =
    explicitKeywords.length > 0
      ? explicitKeywords.map(normalizeKeywordValue).filter(Boolean).slice(0, MAX_CANONICAL_KEYWORDS)
      : deriveCanonicalProfileKeywords({
          summary: nextSummary,
          skills: nextSkills,
          experience: nextExperience,
          rawText: nextRawText,
        });

  return {
    email: nextEmail,
    ...(nextName ? { name: nextName } : {}),
    ...(nextSummary ? { summary: nextSummary } : {}),
    ...(nextRawText ? { raw_text: nextRawText } : {}),
    skills: nextSkills,
    keywords: nextKeywords,
    experience: nextExperience,
  };
}

function buildCanonicalProfileProjection(
  profile: StoredUserProfile,
): CanonicalUserProfile {
  const skills = normalizeStringList(profile.skills);
  const experience = normalizeExperience(profile.experience);
  const summary = compactWhitespace(profile.summary ?? "") || undefined;
  const rawText = compactWhitespace(profile.raw_text ?? "") || undefined;

  return {
    id: profile._id,
    clerkId: profile.clerkId,
    email: compactWhitespace(profile.email ?? ""),
    ...(compactWhitespace(profile.name ?? "")
      ? { name: compactWhitespace(profile.name ?? "") }
      : {}),
    ...(summary ? { summary } : {}),
    skills,
    keywords: resolveStoredKeywords({
      profile: {
        keywords: profile.keywords,
        summary,
        skills,
        experience,
        raw_text: rawText,
      },
    }),
    experience,
    ...(rawText ? { rawText } : {}),
    updatedAt: profile.updatedAt ?? profile.createdAt ?? profile._creationTime ?? 0,
    version: profile.version ?? 1,
  };
}

function sortByRecency(left: StoredUserProfile, right: StoredUserProfile): number {
  const leftIsVariant = isReviewedSourceCvVariant(left);
  const rightIsVariant = isReviewedSourceCvVariant(right);
  if (leftIsVariant !== rightIsVariant) {
    return leftIsVariant ? 1 : -1;
  }

  const leftTs = left.updatedAt ?? left.createdAt ?? left._creationTime ?? 0;
  const rightTs = right.updatedAt ?? right.createdAt ?? right._creationTime ?? 0;
  if (rightTs !== leftTs) {
    return rightTs - leftTs;
  }

  if (right._creationTime !== left._creationTime) {
    return right._creationTime - left._creationTime;
  }

  return String(right._id).localeCompare(String(left._id));
}

export function isReviewedSourceCvVariant(profile: StoredUserProfile): boolean {
  return (
    typeof profile.profileId === "string" &&
    profile.profileId.startsWith("source-cv-variant:v1:")
  );
}

export async function listProfilesForClerk(
  ctx: any,
  clerkId: string,
): Promise<StoredUserProfile[]> {
  const rows = await ctx.db
    .query("userProfiles")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .collect();

  return (rows as StoredUserProfile[]).sort(sortByRecency);
}

export async function getPrimaryProfileForClerk(
  ctx: any,
  clerkId: string,
): Promise<StoredUserProfile | null> {
  const profiles = await listProfilesForClerk(ctx, clerkId);
  return profiles[0] ?? null;
}

export async function getCanonicalProfileForClerk(
  ctx: any,
  clerkId: string,
): Promise<CanonicalUserProfile | null> {
  const profile = await getPrimaryProfileForClerk(ctx, clerkId);
  return profile ? buildCanonicalProfileProjection(profile) : null;
}

export async function ensureCanonicalProfileForClerk(args: {
  ctx: any;
  clerkId: string;
  fallbackEmail?: string | null;
  fallbackName?: string | null;
}): Promise<CanonicalUserProfile> {
  const { ctx, clerkId, fallbackEmail, fallbackName } = args;
  const now = Date.now();
  const existingProfile = await getPrimaryProfileForClerk(ctx, clerkId);
  const activeCvSnapshot = (await ctx.db
    .query("activeCvSnapshots")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .unique()) as ActiveCvSnapshotRecord | null;

  const seededProfile = buildCanonicalProfileSeed({
    existingProfile,
    activeCvSnapshot,
    fallbackEmail,
    fallbackName,
  });

  if (!existingProfile) {
    const insertedProfileId = await ctx.db.insert("userProfiles", {
      clerkId,
      email: seededProfile.email || compactWhitespace(fallbackEmail ?? ""),
      ...(seededProfile.name ? { name: seededProfile.name } : {}),
      preferences: { ...DEFAULT_PROFILE_PREFERENCES },
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...(seededProfile.summary ? { summary: seededProfile.summary } : {}),
      ...(seededProfile.raw_text ? { raw_text: seededProfile.raw_text } : {}),
      skills: seededProfile.skills,
      keywords: seededProfile.keywords,
      experience: seededProfile.experience,
    });

    const insertedProfile = await ctx.db.get(insertedProfileId);
    if (!insertedProfile) {
      throw new Error("Canonical profile insert failed");
    }

    return buildCanonicalProfileProjection(insertedProfile as StoredUserProfile);
  }

  const patch: Record<string, unknown> = {};

  if (!compactWhitespace(existingProfile.email ?? "") && seededProfile.email) {
    patch.email = seededProfile.email;
  }
  if (!compactWhitespace(existingProfile.name ?? "") && seededProfile.name) {
    patch.name = seededProfile.name;
  }
  if (!compactWhitespace(existingProfile.summary ?? "") && seededProfile.summary) {
    patch.summary = seededProfile.summary;
  }
  if ((existingProfile.skills?.length ?? 0) === 0 && seededProfile.skills.length > 0) {
    patch.skills = seededProfile.skills;
  }
  if ((existingProfile.experience?.length ?? 0) === 0 && seededProfile.experience.length > 0) {
    patch.experience = seededProfile.experience;
  }
  if ((existingProfile.keywords?.length ?? 0) === 0 && seededProfile.keywords.length > 0) {
    patch.keywords = seededProfile.keywords;
  }

  if (Object.keys(patch).length === 0) {
    return buildCanonicalProfileProjection(existingProfile);
  }

  await ctx.db.patch(existingProfile._id, {
    ...patch,
    updatedAt: now,
    version: (existingProfile.version ?? 1) + 1,
  });

  const patchedProfile = await ctx.db.get(existingProfile._id);
  if (!patchedProfile) {
    throw new Error("Canonical profile patch failed");
  }

  return buildCanonicalProfileProjection(patchedProfile as StoredUserProfile);
}
