import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  resolveProposalVoicePreset,
} from "./lib/proposals/voicePresets";

const proposalVoicePresetChoice = v.union(
  v.literal("signature"),
  v.literal("expert"),
  v.literal("direct"),
  v.literal("engaging"),
  v.literal("storyteller"),
);

export const getCurrent = query({
  args: {},
  returns: v.object({
    voicePreset: proposalVoicePresetChoice,
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { voicePreset: DEFAULT_PROPOSAL_VOICE_PRESET };
    }

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return {
      voicePreset:
        resolveProposalVoicePreset(user?.proposalVoicePreset) ??
        DEFAULT_PROPOSAL_VOICE_PRESET,
    };
  },
});

export const setCurrent = mutation({
  args: {
    voicePreset: proposalVoicePresetChoice,
  },
  returns: v.object({
    voicePreset: proposalVoicePresetChoice,
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      await ctx.runMutation(internal.users.createOrUpdateUser, {
        clerkId: identity.subject,
        email: identity.email ?? "unknown@example.com",
        name: identity.name,
      });

      user = await ctx.db
        .query("userProfiles")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();
    }

    if (!user) {
      throw new Error("User profile not found");
    }

    if (user.proposalVoicePreset !== args.voicePreset) {
      await ctx.db.patch(user._id, {
        proposalVoicePreset: args.voicePreset,
        updatedAt: Date.now(),
        version: (user.version ?? 1) + 1,
      });
    }

    return { voicePreset: args.voicePreset };
  },
});
