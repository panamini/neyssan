import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  resolveProposalVoicePreset,
} from "./lib/proposals/voicePresets";
import {
  DEFAULT_PROPOSAL_TEMPLATE_ID,
  PROPOSAL_TEMPLATE_IDS,
  resolveProposalTemplateId,
} from "./lib/proposals/renderTemplates";

const proposalVoicePresetChoice = v.union(
  v.literal("signature"),
  v.literal("expert"),
  v.literal("direct"),
  v.literal("engaging"),
  v.literal("storyteller"),
);

const proposalTemplateChoice = v.union(
  ...PROPOSAL_TEMPLATE_IDS.map((templateId) => v.literal(templateId)),
);

export const getCurrent = query({
  args: {},
  returns: v.object({
    voicePreset: proposalVoicePresetChoice,
    templateId: proposalTemplateChoice,
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        voicePreset: DEFAULT_PROPOSAL_VOICE_PRESET,
        templateId: DEFAULT_PROPOSAL_TEMPLATE_ID,
      };
    }

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return {
      voicePreset:
        resolveProposalVoicePreset(user?.proposalVoicePreset) ??
        DEFAULT_PROPOSAL_VOICE_PRESET,
      templateId:
        resolveProposalTemplateId(user?.proposalTemplateId) ??
        DEFAULT_PROPOSAL_TEMPLATE_ID,
    };
  },
});

export const setCurrent = mutation({
  args: {
    voicePreset: v.optional(proposalVoicePresetChoice),
    templateId: v.optional(proposalTemplateChoice),
  },
  returns: v.object({
    voicePreset: proposalVoicePresetChoice,
    templateId: proposalTemplateChoice,
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (!args.voicePreset && !args.templateId) {
      throw new Error("No proposal setting patch was provided");
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

    const nextVoicePreset =
      args.voicePreset ??
      resolveProposalVoicePreset(user.proposalVoicePreset) ??
      DEFAULT_PROPOSAL_VOICE_PRESET;
    const nextTemplateId =
      args.templateId ??
      resolveProposalTemplateId(user.proposalTemplateId) ??
      DEFAULT_PROPOSAL_TEMPLATE_ID;

    if (
      user.proposalVoicePreset !== nextVoicePreset ||
      user.proposalTemplateId !== nextTemplateId
    ) {
      await ctx.db.patch(user._id, {
        proposalVoicePreset: nextVoicePreset,
        proposalTemplateId: nextTemplateId,
        updatedAt: Date.now(),
        version: (user.version ?? 1) + 1,
      });
    }

    return { voicePreset: nextVoicePreset, templateId: nextTemplateId };
  },
});
