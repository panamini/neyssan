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

const proposalStyleChoiceValidator = v.union(
  v.literal("auto"),
  v.literal("formal"),
  v.literal("warm"),
  v.literal("technical"),
  v.literal("balanced"),
);

const proposalPaletteOverrideValidator = v.union(
  v.literal("sauge"),
  v.literal("ocre"),
  v.literal("pierre"),
  v.literal("bordeaux"),
  v.literal("encre"),
  v.null(),
);
const proposalAccentHexValidator = v.union(v.string(), v.null());

const proposalSourceModeValidator = v.union(
  v.literal("inherit_cv"),
  v.literal("proposal_local"),
);

export const getCurrent = query({
  args: {},
  returns: v.object({
    voicePreset: proposalVoicePresetChoice,
    savedVoicePreset: v.union(proposalVoicePresetChoice, v.null()),
    templateId: proposalTemplateChoice,
    styleChoice: v.optional(proposalStyleChoiceValidator),
    paletteOverride: v.optional(proposalPaletteOverrideValidator),
    accentHex: v.optional(proposalAccentHexValidator),
    sourceMode: v.optional(proposalSourceModeValidator),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        voicePreset: DEFAULT_PROPOSAL_VOICE_PRESET,
        savedVoicePreset: null,
        templateId: DEFAULT_PROPOSAL_TEMPLATE_ID,
      };
    }

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return {
      voicePreset: resolveProposalVoicePreset(user?.proposalVoicePreset)
        ?? DEFAULT_PROPOSAL_VOICE_PRESET,
      savedVoicePreset: resolveProposalVoicePreset(user?.proposalVoicePreset) ?? null,
      templateId:
        resolveProposalTemplateId(user?.proposalTemplateId) ??
        DEFAULT_PROPOSAL_TEMPLATE_ID,
      styleChoice: user?.proposalStyleChoice,
      paletteOverride: user?.proposalPaletteOverride,
      accentHex: user?.proposalAccentHex,
      sourceMode: user?.proposalSourceMode,
    };
  },
});

export const setCurrent = mutation({
  args: {
    voicePreset: v.optional(v.union(proposalVoicePresetChoice, v.null())),
    templateId: v.optional(proposalTemplateChoice),
    styleChoice: v.optional(proposalStyleChoiceValidator),
    paletteOverride: v.optional(proposalPaletteOverrideValidator),
    accentHex: v.optional(proposalAccentHexValidator),
    sourceMode: v.optional(proposalSourceModeValidator),
  },
  returns: v.object({
    voicePreset: proposalVoicePresetChoice,
    savedVoicePreset: v.union(proposalVoicePresetChoice, v.null()),
    templateId: proposalTemplateChoice,
    styleChoice: v.optional(proposalStyleChoiceValidator),
    paletteOverride: v.optional(proposalPaletteOverrideValidator),
    accentHex: v.optional(proposalAccentHexValidator),
    sourceMode: v.optional(proposalSourceModeValidator),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const hasVoicePresetPatch = Object.prototype.hasOwnProperty.call(
      args,
      "voicePreset",
    );
    const hasTemplatePatch = Object.prototype.hasOwnProperty.call(
      args,
      "templateId",
    );
    const hasStyleChoicePatch = Object.prototype.hasOwnProperty.call(
      args,
      "styleChoice",
    );
    const hasPalettePatch = Object.prototype.hasOwnProperty.call(
      args,
      "paletteOverride",
    );
    const hasAccentHexPatch = Object.prototype.hasOwnProperty.call(
      args,
      "accentHex",
    );
    const hasSourceModePatch = Object.prototype.hasOwnProperty.call(
      args,
      "sourceMode",
    );

    if (
      !hasVoicePresetPatch &&
      !hasTemplatePatch &&
      !hasStyleChoicePatch &&
      !hasPalettePatch &&
      !hasAccentHexPatch &&
      !hasSourceModePatch
    ) {
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

    const currentSavedVoicePreset =
      resolveProposalVoicePreset(user.proposalVoicePreset) ?? null;
    const nextSavedVoicePreset = hasVoicePresetPatch
      ? resolveProposalVoicePreset(args.voicePreset) ?? null
      : currentSavedVoicePreset;
    const nextVoicePreset =
      nextSavedVoicePreset ?? DEFAULT_PROPOSAL_VOICE_PRESET;
    const nextTemplateId =
      args.templateId ??
      resolveProposalTemplateId(user.proposalTemplateId) ??
      DEFAULT_PROPOSAL_TEMPLATE_ID;
    const nextStyleChoice = hasStyleChoicePatch
      ? (args.styleChoice ?? undefined)
      : user.proposalStyleChoice;
    const nextPaletteOverride = hasPalettePatch
      ? args.paletteOverride
      : user.proposalPaletteOverride;
    const nextAccentHex =
      hasAccentHexPatch && typeof args.accentHex === "string"
        ? /^#[0-9a-fA-F]{6}$/.test(args.accentHex)
          ? args.accentHex.toUpperCase()
          : user.proposalAccentHex
        : hasAccentHexPatch
          ? null
          : user.proposalAccentHex;
    const nextSourceMode = hasSourceModePatch
      ? (args.sourceMode ?? undefined)
      : user.proposalSourceMode;

    const needsWrite =
      currentSavedVoicePreset !== nextSavedVoicePreset ||
      user.proposalTemplateId !== nextTemplateId ||
      user.proposalStyleChoice !== nextStyleChoice ||
      user.proposalPaletteOverride !== nextPaletteOverride ||
      user.proposalAccentHex !== nextAccentHex ||
      user.proposalSourceMode !== nextSourceMode;

    if (needsWrite) {
      const { _creationTime, _id, ...rest } = user;
      const replacement: Record<string, unknown> = {
        ...rest,
        proposalTemplateId: nextTemplateId,
        updatedAt: Date.now(),
        version: (user.version ?? 1) + 1,
      };

      if (nextSavedVoicePreset) {
        replacement.proposalVoicePreset = nextSavedVoicePreset;
      } else {
        delete replacement.proposalVoicePreset;
      }

      if (nextStyleChoice !== undefined) {
        replacement.proposalStyleChoice = nextStyleChoice;
      } else {
        delete replacement.proposalStyleChoice;
      }

      if (nextPaletteOverride !== undefined) {
        replacement.proposalPaletteOverride = nextPaletteOverride;
      } else {
        delete replacement.proposalPaletteOverride;
      }

      if (nextAccentHex !== undefined) {
        replacement.proposalAccentHex = nextAccentHex;
      } else {
        delete replacement.proposalAccentHex;
      }

      if (nextSourceMode !== undefined) {
        replacement.proposalSourceMode = nextSourceMode;
      } else {
        delete replacement.proposalSourceMode;
      }

      await ctx.db.replace(user._id, replacement);
    }

    return {
      voicePreset: nextVoicePreset,
      savedVoicePreset: nextSavedVoicePreset,
      templateId: nextTemplateId,
      styleChoice: nextStyleChoice,
      paletteOverride: nextPaletteOverride,
      accentHex: nextAccentHex,
      sourceMode: nextSourceMode,
    };
  },
});
