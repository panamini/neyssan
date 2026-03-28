import {
  internalMutation,
  internalQuery,
  query,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { ProposalTemplateId } from "./lib/proposals/renderTemplates";

export type UserProfile = {
  _id: Id<"userProfiles">;
  _creationTime: number;
  clerkId?: string;
  email: string;
  name?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  preferences: {
    rateLimits?: Record<string, unknown>;
    writingStyle: string;
    tonePreference: string;
    autoSend: boolean;
  };
  proposalVoicePreset?:
    | "signature"
    | "expert"
    | "direct"
    | "engaging"
    | "storyteller";
  proposalTemplateId?: ProposalTemplateId;
};

export const createOrUpdateUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { clerkId, email, name } = args;

    const existingUser = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existingUser) {
      const updateData: Partial<UserProfile> = {
        email,
        updatedAt: Date.now(),
      };
      // Only set the name if the existing profile does not already have one.
      // This prevents sign-in hooks (which send identity.name) from overwriting
      // a display name that the user has edited and saved.
      if (name !== undefined && !existingUser.name) {
        updateData.name = name;
      }
      return await ctx.db.patch(existingUser._id, updateData);
    } else {
      const newUser: Omit<UserProfile, "_id" | "_creationTime"> = {
        clerkId,
        email,
        ...(name !== undefined && { name }),
        preferences: {
          writingStyle: "professional",
          tonePreference: "formal",
          autoSend: false,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      return await ctx.db.insert("userProfiles", newUser);
    }
  },
});

// Query to fetch a profile document by its _id (used by HTTP actions for ownership checks)
export const getProfileById = internalQuery({
  args: {
    profileId: v.id("userProfiles"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("userProfiles"),
      _creationTime: v.number(),
      clerkId: v.optional(v.string()),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      version: v.optional(v.number()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      summary: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      experience: v.optional(v.array(v.any())),
      education: v.optional(v.array(v.any())),
      linkedIn: v.optional(v.string()),
      raw_text: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    return profile ?? null;
  },
});

export const deleteUser = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});

export const getUser = query({
  handler: async (
    ctx: QueryCtx, // @ts-ignore unused args
    args: {},
  ): Promise<UserProfile | null> => {
    // 'args' unused but required by Convex signature —ts-ignore suppress if needed
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  },
});

export const updateUserProfile = internalMutation({
  args: {
    clerkId: v.string(),
    profileData: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      summary: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      experience: v.optional(
        v.array(
          v.object({
            company: v.string(),
            title: v.string(),
            startDate: v.optional(v.union(v.string(), v.number(), v.null())),
            endDate: v.optional(v.union(v.string(), v.number(), v.null())),
            description: v.optional(v.string()),
          }),
        ),
      ),
      education: v.optional(
        v.array(
          v.object({
            school: v.string(),
            degree: v.optional(v.string()),
            fieldOfStudy: v.optional(v.string()),
            startDate: v.optional(v.union(v.string(), v.number(), v.null())),
            endDate: v.optional(v.union(v.string(), v.number(), v.null())),
          }),
        ),
      ),
      linkedIn: v.optional(v.string()),
      raw_text: v.optional(v.string()),
      metadata: v.optional(
        v.object({
          source: v.optional(v.string()),
          confidence: v.optional(v.number()),
          importedAt: v.optional(v.number()),
        }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const { clerkId, profileData } = args;

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Prepare update data, only including fields that are provided
    const updateData: Record<string, any> = {
      updatedAt: Date.now(),
    };

    // Add provided fields to update data
    Object.entries(profileData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        updateData[key] = value;
      }
    });

    return await ctx.db.patch(user._id, updateData);
  },
});
