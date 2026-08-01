import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { syncProfileCatalogById } from "../lib/profileCatalog";

/**
 * Mutation: updateUserProfile
 *
 * Args:
 *  - clerkId: string (identity from Clerk)
 *  - profileData: top-level NormalizedProfile object (partial)
 *
 * Behavior (skeleton):
 *  - Find userProfiles document by clerkId (index "by_clerk_id").
 *  - If not found, insert a new userProfiles document.
 *  - If found, patch the provided fields, bump version and updatedAt.
 *
 * Notes:
 *  - This is intentionally conservative: only patches fields present in profileData.
 *  - Ensure schema.ts includes the userProfiles table and index by_clerk_id.
 *  - You can extend validation and normalization as needed.
 */

export default mutation({
  args: {
    clerkId: v.string(),
    profileData: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      summary: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      experience: v.optional(v.array(v.any())),
      education: v.optional(v.array(v.any())),
      linkedIn: v.optional(v.string()),
      rawText: v.optional(v.string()),
      confidence: v.optional(v.number()),
      metadata: v.optional(v.any()),
    }),
  },
  returns: v.object({
    status: v.string(),
    profileId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Ensure user record exists (users.createOrUpdateUser is typically called elsewhere).
    // Find existing userProfiles by clerk id.
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    const now = Date.now();

    if (!existing) {
      // create a new profile document
      const toInsert: any = {
        clerkId: args.clerkId,
        email: args.profileData.email ?? null,
        name: args.profileData.name ?? null,
        summary: args.profileData.summary ?? null,
        skills: args.profileData.skills ?? null,
        experience: args.profileData.experience ?? null,
        education: args.profileData.education ?? null,
        linkedIn: args.profileData.linkedIn ?? null,
        raw_text: args.profileData.rawText ?? null,
        metadata: args.profileData.metadata ?? { source: "ingest", createdAt: now },
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      const id = await ctx.db.insert("userProfiles", toInsert);
      await syncProfileCatalogById(ctx, id);
      return { status: "created", profileId: id.toString() };
    } else {
      // patch only provided fields and bump version/updatedAt
      const updates: any = { updatedAt: now, version: (existing.version || 1) + 1 };

      if (args.profileData.name !== undefined) updates.name = args.profileData.name;
      if (args.profileData.email !== undefined) updates.email = args.profileData.email;
      if (args.profileData.summary !== undefined) updates.summary = args.profileData.summary;
      if (args.profileData.skills !== undefined) updates.skills = args.profileData.skills;
      if (args.profileData.experience !== undefined) updates.experience = args.profileData.experience;
      if (args.profileData.education !== undefined) updates.education = args.profileData.education;
      if (args.profileData.linkedIn !== undefined) updates.linkedIn = args.profileData.linkedIn;
      if (args.profileData.rawText !== undefined) updates.raw_text = args.profileData.rawText;
      if (args.profileData.confidence !== undefined) {
        updates.metadata = {
          ...(existing.metadata || {}),
          confidence: args.profileData.confidence,
          ...(args.profileData.metadata || {}),
        };
      } else if (args.profileData.metadata !== undefined) {
        updates.metadata = {
          ...(existing.metadata || {}),
          ...(args.profileData.metadata || {}),
        };
      }

      await ctx.db.patch(existing._id, updates);
      await syncProfileCatalogById(ctx, existing._id);
      return { status: "patched", profileId: existing._id.toString() };
    }
  },
});
