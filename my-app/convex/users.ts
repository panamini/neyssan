import { internalMutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export type UserProfile = {
  _id: Id<"userProfiles">;
  _creationTime: number;
  clerkId: string;
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
};

export const createOrUpdateUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string())
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
      if (name !== undefined) {
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
  handler: async (ctx: QueryCtx, _args: Record<string, never>): Promise<UserProfile | null> => {
    // '_args' is intentionally unused; Convex requires an args parameter in the signature
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
