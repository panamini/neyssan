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
import {
  getPrimaryProfileForClerk,
  listProfilesForClerk,
} from "./lib/userProfiles";

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

    const user = await getPrimaryProfileForClerk(ctx, identity.subject);

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

    let profiles = await listProfilesForClerk(ctx, identity.subject);
    let user = profiles[0] ?? null;

    if (!user) {
      await ctx.runMutation(internal.users.createOrUpdateUser, {
        clerkId: identity.subject,
        email: identity.email ?? "unknown@example.com",
        name: identity.name,
      });

      profiles = await listProfilesForClerk(ctx, identity.subject);
      user = profiles[0] ?? null;
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
      const replacementByProfile = profiles.map((profile) => {
        const { _creationTime, _id, ...rest } = profile;
        const nextReplacement: Record<string, unknown> = {
          ...rest,
          proposalTemplateId: nextTemplateId,
          updatedAt: Date.now(),
          version: (profile.version ?? 1) + 1,
        };

        if (nextSavedVoicePreset) {
          nextReplacement.proposalVoicePreset = nextSavedVoicePreset;
        } else {
          delete nextReplacement.proposalVoicePreset;
        }

        if (nextStyleChoice !== undefined) {
          nextReplacement.proposalStyleChoice = nextStyleChoice;
        } else {
          delete nextReplacement.proposalStyleChoice;
        }

        if (nextPaletteOverride !== undefined) {
          nextReplacement.proposalPaletteOverride = nextPaletteOverride;
        } else {
          delete nextReplacement.proposalPaletteOverride;
        }

        if (nextAccentHex !== undefined) {
          nextReplacement.proposalAccentHex = nextAccentHex;
        } else {
          delete nextReplacement.proposalAccentHex;
        }

        if (nextSourceMode !== undefined) {
          nextReplacement.proposalSourceMode = nextSourceMode;
        } else {
          delete nextReplacement.proposalSourceMode;
        }

        return { id: profile._id, replacement: nextReplacement };
      });

      await Promise.all(
        replacementByProfile.map(({ id, replacement }) =>
          ctx.db.replace(id, replacement),
        ),
      );
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
