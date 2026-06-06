import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const personalizationContextValidator = v.union(
  v.null(),
  v.object({
    name: v.optional(v.string()),
    summary: v.optional(v.string()),
    desiredPosition: v.optional(v.string()),
    topSkills: v.optional(v.array(v.string())),
    recentExperience: v.optional(
      v.array(
        v.object({
          company: v.optional(v.string()),
          position: v.optional(v.string()),
          highlights: v.optional(v.array(v.string())),
        })
      )
    ),
    standoutAchievements: v.optional(v.array(v.string())),
  })
);

const activeCvSnapshotValidator = v.object({
  title: v.string(),
  personalizationContext: personalizationContextValidator,
  updatedAt: v.optional(v.string()),
});

const activeCvOptionValidator = v.object({
  profileId: v.string(),
  title: v.string(),
  subtitle: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
  personalizationContext: personalizationContextValidator,
});

function compactText(value: unknown, maxLength = 180): string | undefined {
  if (typeof value !== "string") return undefined;
  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted ? compacted.slice(0, maxLength).trim() : undefined;
}

function buildProfileSnapshot(profile: any) {
  const recentExperience = Array.isArray(profile.experience)
    ? profile.experience
        .slice(0, 3)
        .map((item: any) => ({
          ...(compactText(item?.company, 80) ? { company: compactText(item.company, 80) } : {}),
          ...(compactText(item?.title, 80) ? { position: compactText(item.title, 80) } : {}),
          ...(compactText(item?.description, 240)
            ? { highlights: [compactText(item.description, 240)] }
            : {}),
        }))
        .filter((item: any) => item.company || item.position || item.highlights?.length)
    : undefined;

  const personalizationContext = {
    ...(compactText(profile.name, 80) ? { name: compactText(profile.name, 80) } : {}),
    ...(compactText(profile.summary, 500) ? { summary: compactText(profile.summary, 500) } : {}),
    ...(compactText(profile.defaultResumeName, 120)
      ? { desiredPosition: compactText(profile.defaultResumeName, 120) }
      : {}),
    ...(Array.isArray(profile.skills)
      ? { topSkills: profile.skills.map((skill: unknown) => compactText(skill, 60)).filter(Boolean).slice(0, 12) }
      : {}),
    ...(recentExperience?.length ? { recentExperience } : {}),
    ...(Array.isArray(profile.achievements)
      ? { standoutAchievements: profile.achievements.map((item: unknown) => compactText(item, 180)).filter(Boolean).slice(0, 8) }
      : {}),
  };

  const hasContext = Object.keys(personalizationContext).length > 0;
  const title =
    compactText(profile.defaultResumeName, 120) ||
    compactText(profile.name, 120) ||
    compactText(profile.email, 120) ||
    "Untitled CV";

  return {
    title,
    personalizationContext: hasContext ? personalizationContext : null,
    updatedAt: new Date(profile.updatedAt || profile.createdAt || Date.now()).toISOString(),
  };
}

export const getCurrent = query({
  args: {},
  returns: v.union(v.null(), activeCvSnapshotValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const snapshot = await ctx.db
      .query("activeCvSnapshots")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!snapshot) {
      return null;
    }

    return {
      title: snapshot.title,
      personalizationContext: snapshot.personalizationContext,
      ...(snapshot.updatedAt ? { updatedAt: snapshot.updatedAt } : {}),
    };
  },
});

export const listOptions = query({
  args: {},
  returns: v.array(activeCvOptionValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .order("desc")
      .take(12);

    return profiles.map((profile) => {
      const snapshot = buildProfileSnapshot(profile);
      return {
        profileId: profile._id,
        title: snapshot.title,
        ...(compactText(profile.summary, 120) ? { subtitle: compactText(profile.summary, 120) } : {}),
        ...(snapshot.updatedAt ? { updatedAt: snapshot.updatedAt } : {}),
        personalizationContext: snapshot.personalizationContext,
      };
    });
  },
});

export const setCurrentFromProfile = mutation({
  args: {
    profileId: v.string(),
  },
  returns: activeCvSnapshotValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db.get(args.profileId as any);
    if (!profile || profile.clerkId !== identity.subject) {
      throw new Error("CV profile not found");
    }

    const snapshot = buildProfileSnapshot(profile);
    const existing = await ctx.db
      .query("activeCvSnapshots")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const nextDoc = {
      clerkId: identity.subject,
      title: snapshot.title,
      personalizationContext: snapshot.personalizationContext,
      ...(snapshot.updatedAt ? { updatedAt: snapshot.updatedAt } : {}),
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, nextDoc);
    } else {
      await ctx.db.insert("activeCvSnapshots", nextDoc);
    }

    return snapshot;
  },
});

export const setCurrent = mutation({
  args: {
    snapshot: v.union(v.null(), activeCvSnapshotValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("activeCvSnapshots")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (args.snapshot === null) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return null;
    }

    const nextDoc = {
      clerkId: identity.subject,
      title: args.snapshot.title,
      personalizationContext: args.snapshot.personalizationContext,
      ...(args.snapshot.updatedAt ? { updatedAt: args.snapshot.updatedAt } : {}),
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, nextDoc);
      return null;
    }

    await ctx.db.insert("activeCvSnapshots", nextDoc);
    return null;
  },
});
