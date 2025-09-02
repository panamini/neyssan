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
        .map((e) => {
          const title = (e.title ?? e.jobTitle ?? "").toString().trim();
          const company = (e.company ?? e.employer ?? "").toString().trim();
          if (!title || !company) return null; // drop invalid entries that lack required fields
          return {
            title,
            company,
            startDate: e.startDate ?? e.start ?? undefined,
            endDate: e.endDate ?? e.end ?? undefined,
            current: !!e.current,
            description: e.description ?? e.details ?? undefined,
          };
        })
        .filter(Boolean) as Array<Record<string, any>>;
    };

    const coerceEducation = (edu: any) => {
      if (!Array.isArray(edu)) return [];
      return edu
        .filter((e) => e && typeof e === "object")
        .map((e) => {
          const school = (e.school ?? e.institution ?? "").toString().trim();
          if (!school) return null; // drop entries without required school field
          return {
            school,
            degree: e.degree ?? e.program ?? undefined,
            fieldOfStudy: e.fieldOfStudy ?? undefined,
            startDate: e.startDate ?? e.start ?? undefined,
            endDate: e.endDate ?? e.end ?? undefined,
            description: e.description ?? e.details ?? undefined,
          };
        })
        .filter(Boolean) as Array<Record<string, any>>;
    };

    // Build normalized profile object to persist
    const incoming = args.profile || {};
    const normalizedProfile = {
      profileId: args.profileId,
      // Treat name as optional: use undefined when missing so Convex optional validators accept absence
      name: incoming.name ?? undefined,
      // Schema requires email: v.string() — coerce missing/null emails to empty string
      email: incoming.email ?? "",
      // Treat summary as optional: use undefined when missing instead of null
      summary: incoming.summary ?? undefined,
      skills: dedupeStrings(incoming.skills),
      // languages: dedupe and normalize if provided
      languages: dedupeStrings(incoming.languages),
      // contact is a freeform object; accept as-is when present
      contact: incoming.contact ?? undefined,
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
        return { profileId: args.profileId, convexId: existing._id, updatedAt: existing.updatedAt ?? existing.updatedAt, written: false };
      }

      // Merge fields conservatively: prefer incoming non-null values, otherwise keep existing.
      const merged = {
        profileId: args.profileId,
        idempotencyKeys: Array.from(new Set([...existingKeys, args.idempotencyKey])),
        // Use undefined when a value is absent so optional validators are satisfied
        name: normalizedProfile.name ?? existing.name ?? undefined,
        // Ensure merged email is always a string to satisfy schema
        email: normalizedProfile.email ?? existing.email ?? "",
        summary: normalizedProfile.summary ?? existing.summary ?? undefined,
        languages: (normalizedProfile.languages && normalizedProfile.languages.length > 0) ? normalizedProfile.languages : (existing.languages ?? []),
        contact: normalizedProfile.contact ?? existing.contact ?? undefined,
        skills: (normalizedProfile.skills && normalizedProfile.skills.length > 0) ? normalizedProfile.skills : (existing.skills ?? []),
        experience: (normalizedProfile.experience && normalizedProfile.experience.length > 0) ? normalizedProfile.experience : (existing.experience ?? []),
        education: (normalizedProfile.education && normalizedProfile.education.length > 0) ? normalizedProfile.education : (existing.education ?? []),
        achievements: (normalizedProfile.achievements && normalizedProfile.achievements.length > 0) ? normalizedProfile.achievements : (existing.achievements ?? []),
        updatedAt: now,
      };
 
      // Persist merged document using patch (partial update)
      // Cast to any to avoid strict TS structural mismatch — runtime Convex validators are authoritative.
      await ctx.db.patch(existing._id, merged as any);
 
      return { profileId: args.profileId, convexId: existing._id, updatedAt: merged.updatedAt, written: true };
    } else {
      // Create new document
      const doc = {
        profileId: args.profileId,
        idempotencyKeys: [args.idempotencyKey],
        // Only include optional fields when present to avoid inserting nulls.
        ...(normalizedProfile.name !== undefined && { name: normalizedProfile.name }),
        email: normalizedProfile.email,
        ...(normalizedProfile.summary !== undefined && { summary: normalizedProfile.summary }),
        ...(normalizedProfile.languages !== undefined && { languages: normalizedProfile.languages }),
        ...(normalizedProfile.contact !== undefined && { contact: normalizedProfile.contact }),
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
 
      const convexId = await ctx.db.insert("userProfiles", doc as any);
      return { profileId: args.profileId, convexId, updatedAt: normalizedProfile.updatedAt, written: true };
    }
  },
});
