import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Idempotent upsert mutation for canonical profiles.
 *
 * Args:
 * - profileId: external UUID string
 * - idempotencyKey: unique key for this write
 * - source: string (e.g. "llm_refine")
 * - version: number
 * - profile: object containing canonical profile fields
 *
 * Behavior:
 * - If a profiles document with profileId exists and already contains the idempotencyKey
 *   in its idempotencyKeys array, return success (no-op).
 * - Otherwise create or update the profiles document, append the idempotencyKey, set updatedAt.
 */
export const upsertProfile = mutation({
  args: {
    profileId: v.string(),
    idempotencyKey: v.string(),
    source: v.string(),
    version: v.number(),
    profile: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Defensive normalization helpers
    const dedupeStrings = (arr: any) => {
      if (!Array.isArray(arr)) return [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const it of arr) {
        if (it == null) continue;
        const s = String(it).trim();
        if (!s) continue;
        if (!seen.has(s)) {
          seen.add(s);
          out.push(s);
        }
      }
      return out;
    };

    const coerceExperience = (exp: any) => {
      if (!Array.isArray(exp)) return [];
      return exp
        .filter((e) => e && typeof e === "object")
        .map((e) => ({
          title: e.title ?? e.jobTitle ?? null,
          company: e.company ?? e.employer ?? null,
          startDate: e.startDate ?? e.start ?? null,
          endDate: e.endDate ?? e.end ?? null,
          current: !!e.current,
          description: e.description ?? e.details ?? null,
        }));
    };

    const coerceEducation = (edu: any) => {
      if (!Array.isArray(edu)) return [];
      return edu
        .filter((e) => e && typeof e === "object")
        .map((e) => ({
          degree: e.degree ?? e.program ?? null,
          school: e.school ?? e.institution ?? null,
          startDate: e.startDate ?? e.start ?? null,
          endDate: e.endDate ?? e.end ?? null,
          description: e.description ?? e.details ?? null,
        }));
    };

    // Build normalized profile object to persist
    const incoming = args.profile || {};
    const normalizedProfile = {
      profileId: args.profileId,
      name: incoming.name ?? null,
      email: incoming.email ?? null,
      summary: incoming.summary ?? null,
      skills: dedupeStrings(incoming.skills),
      experience: coerceExperience(incoming.experience),
      education: coerceEducation(incoming.education),
      achievements: dedupeStrings(incoming.achievements),
      updatedAt: now,
    };

    // Try to find existing doc by index 'by_profileId'
    const existingRows = await ctx.db
      .query("userProfiles")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .take(1);

    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0];
      // If idempotencyKey already applied -> no-op success
      const existingKeys = Array.isArray(existing.idempotencyKeys) ? existing.idempotencyKeys : [];
      if (existingKeys.includes(args.idempotencyKey)) {
        return { profileId: args.profileId, updatedAt: existing.updatedAt ?? existing.updatedAt, written: false };
      }

      // Merge fields conservatively: prefer incoming non-null values, otherwise keep existing.
      const merged = {
        profileId: args.profileId,
        idempotencyKeys: Array.from(new Set([...existingKeys, args.idempotencyKey])),
        name: normalizedProfile.name ?? existing.name ?? null,
        email: normalizedProfile.email ?? existing.email ?? null,
        summary: normalizedProfile.summary ?? existing.summary ?? null,
        skills: (normalizedProfile.skills && normalizedProfile.skills.length > 0) ? normalizedProfile.skills : (existing.skills ?? []),
        experience: (normalizedProfile.experience && normalizedProfile.experience.length > 0) ? normalizedProfile.experience : (existing.experience ?? []),
        education: (normalizedProfile.education && normalizedProfile.education.length > 0) ? normalizedProfile.education : (existing.education ?? []),
        achievements: (normalizedProfile.achievements && normalizedProfile.achievements.length > 0) ? normalizedProfile.achievements : (existing.achievements ?? []),
        updatedAt: now,
      };

      // Persist merged document using patch (partial update)
      await ctx.db.patch(existing._id, merged);

      return { profileId: args.profileId, updatedAt: merged.updatedAt, written: true };
    } else {
      // Create new document
      const doc = {
        profileId: args.profileId,
        idempotencyKeys: [args.idempotencyKey],
        name: normalizedProfile.name,
        email: normalizedProfile.email,
        summary: normalizedProfile.summary,
        skills: normalizedProfile.skills,
        experience: normalizedProfile.experience,
        education: normalizedProfile.education,
        achievements: normalizedProfile.achievements,
        // required schema fields
        version: args.version,
        createdAt: now,
        preferences: {
          writingStyle: "professional",
          tonePreference: "formal",
          autoSend: false,
        },
        updatedAt: normalizedProfile.updatedAt,
      };

      await ctx.db.insert("userProfiles", doc);
      return { profileId: args.profileId, updatedAt: normalizedProfile.updatedAt, written: true };
    }
  },
});
