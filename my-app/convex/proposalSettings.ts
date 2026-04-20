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
const proposalFontPairIdValidator = v.union(v.string(), v.null());

const proposalSourceModeValidator = v.union(
  v.literal("inherit_cv"),
  v.literal("proposal_local"),
);

const proposalPresetVerbatiStyleValidator = v.object({
  familyId: v.optional(v.string()),
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.union(v.string(), v.null())),
});

export const getCurrent = query({
  args: {},
  returns: v.object({
    voicePreset: proposalVoicePresetChoice,
    savedVoicePreset: v.union(proposalVoicePresetChoice, v.null()),
    templateId: proposalTemplateChoice,
    styleChoice: v.optional(proposalStyleChoiceValidator),
    paletteOverride: v.optional(proposalPaletteOverrideValidator),
    accentHex: v.optional(proposalAccentHexValidator),
    fontPairId: v.optional(proposalFontPairIdValidator),
    verbatiStyle: v.optional(proposalPresetVerbatiStyleValidator),
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
      fontPairId: user?.proposalFontPairId,
      verbatiStyle:
        user?.proposalVerbatiStyle &&
        typeof user.proposalVerbatiStyle === "object"
          ? (user.proposalVerbatiStyle as PresetSlotData["verbatiStyle"])
          : undefined,
      sourceMode: user?.proposalSourceMode,
    };
  },
});

// ─── Preset slot shape ────────────────────────────────────────────────────────

const presetSlotValidator = v.object({
  fontPairId: v.union(v.string(), v.null()),
  styleChoice: proposalStyleChoiceValidator,
  paletteOverride: proposalPaletteOverrideValidator,
  accentHex: proposalAccentHexValidator,
  verbatiStyle: v.optional(proposalPresetVerbatiStyleValidator),
  voicePreset: v.union(proposalVoicePresetChoice, v.null()),
  name: v.optional(v.string()),
});

type PresetSlotData = {
  fontPairId: string | null;
  styleChoice: "auto" | "formal" | "warm" | "technical" | "balanced";
  paletteOverride: "sauge" | "ocre" | "pierre" | "bordeaux" | "encre" | null;
  accentHex: string | null;
  verbatiStyle?: {
    familyId?: string;
    layout: string;
    typography: string;
    palette: string;
    accentHex?: string | null;
  };
  voicePreset: "signature" | "expert" | "direct" | "engaging" | "storyteller" | null;
  name?: string;
};

export const getPresets = query({
  args: {},
  returns: v.object({
    preset1: v.union(presetSlotValidator, v.null()),
    preset2: v.union(presetSlotValidator, v.null()),
    preset3: v.union(presetSlotValidator, v.null()),
    activeSlot: v.union(v.literal(1), v.literal(2), v.literal(3), v.null()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { preset1: null, preset2: null, preset3: null, activeSlot: null };
    }
    const user = await getPrimaryProfileForClerk(ctx, identity.subject);
    return {
      preset1: (user?.proposalPreset1 as PresetSlotData | null | undefined) ?? null,
      preset2: (user?.proposalPreset2 as PresetSlotData | null | undefined) ?? null,
      preset3: (user?.proposalPreset3 as PresetSlotData | null | undefined) ?? null,
      activeSlot: (user?.proposalActivePresetSlot as 1 | 2 | 3 | undefined) ?? null,
    };
  },
});

export const savePreset = mutation({
  args: {
    slot: v.union(v.literal(1), v.literal(2), v.literal(3)),
    preset: presetSlotValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

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
    if (!user) throw new Error("User profile not found");

    const fieldKey = `proposalPreset${args.slot}` as "proposalPreset1" | "proposalPreset2" | "proposalPreset3";
    const nextAccentHex =
      typeof args.preset.accentHex === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(args.preset.accentHex)
        ? args.preset.accentHex.toUpperCase()
        : null;
    const cleanPreset: PresetSlotData = { ...args.preset, accentHex: nextAccentHex };

    await Promise.all(
      profiles.map((profile) => {
        const { _creationTime, _id, ...rest } = profile;
        return ctx.db.replace(_id, {
          ...rest,
          [fieldKey]: cleanPreset,
          updatedAt: Date.now(),
          version: (profile.version ?? 1) + 1,
        });
      }),
    );
    return null;
  },
});

export const setActivePreset = mutation({
  args: {
    slot: v.union(v.literal(1), v.literal(2), v.literal(3)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

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
    if (!user) throw new Error("User profile not found");

    const fieldKey = `proposalPreset${args.slot}` as "proposalPreset1" | "proposalPreset2" | "proposalPreset3";
    const preset = (user[fieldKey] as PresetSlotData | null | undefined) ?? null;

    await Promise.all(
      profiles.map((profile) => {
        const { _creationTime, _id, ...rest } = profile;
        const nextReplacement: Record<string, unknown> = {
          ...rest,
          proposalActivePresetSlot: args.slot,
          updatedAt: Date.now(),
          version: (profile.version ?? 1) + 1,
        };

        // Mirror active preset into legacy single-default fields so ProposalForge continues to work
        if (preset) {
          if (preset.voicePreset) {
            nextReplacement.proposalVoicePreset = preset.voicePreset;
          } else {
            delete nextReplacement.proposalVoicePreset;
          }
          if (preset.styleChoice && preset.styleChoice !== "auto") {
            nextReplacement.proposalStyleChoice = preset.styleChoice;
          } else {
            delete nextReplacement.proposalStyleChoice;
          }
          nextReplacement.proposalPaletteOverride = preset.paletteOverride;
          const nextAccentHex =
            typeof preset.accentHex === "string" && /^#[0-9a-fA-F]{6}$/.test(preset.accentHex)
              ? preset.accentHex.toUpperCase()
              : null;
          nextReplacement.proposalAccentHex = nextAccentHex;
          nextReplacement.proposalFontPairId = preset.fontPairId;
          if (preset.verbatiStyle) {
            const nextVerbatiAccentHex =
              typeof preset.verbatiStyle.accentHex === "string" &&
              /^#[0-9a-fA-F]{6}$/.test(preset.verbatiStyle.accentHex)
                ? preset.verbatiStyle.accentHex.toUpperCase()
                : preset.verbatiStyle.accentHex === null
                  ? null
                  : undefined;
            nextReplacement.proposalVerbatiStyle = {
              ...preset.verbatiStyle,
              accentHex: nextVerbatiAccentHex,
            };
          } else {
            delete nextReplacement.proposalVerbatiStyle;
          }
        }

        return ctx.db.replace(_id, nextReplacement);
      }),
    );
    return null;
  },
});

export const setCurrent = mutation({
  args: {
    voicePreset: v.optional(v.union(proposalVoicePresetChoice, v.null())),
    templateId: v.optional(proposalTemplateChoice),
    styleChoice: v.optional(proposalStyleChoiceValidator),
    paletteOverride: v.optional(proposalPaletteOverrideValidator),
    accentHex: v.optional(proposalAccentHexValidator),
    fontPairId: v.optional(proposalFontPairIdValidator),
    sourceMode: v.optional(proposalSourceModeValidator),
  },
  returns: v.object({
    voicePreset: proposalVoicePresetChoice,
    savedVoicePreset: v.union(proposalVoicePresetChoice, v.null()),
    templateId: proposalTemplateChoice,
    styleChoice: v.optional(proposalStyleChoiceValidator),
    paletteOverride: v.optional(proposalPaletteOverrideValidator),
    accentHex: v.optional(proposalAccentHexValidator),
    fontPairId: v.optional(proposalFontPairIdValidator),
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
    const hasFontPairPatch = Object.prototype.hasOwnProperty.call(
      args,
      "fontPairId",
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
      !hasFontPairPatch &&
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
    const nextFontPairId = hasFontPairPatch
      ? typeof args.fontPairId === "string" && args.fontPairId.trim()
        ? args.fontPairId.trim()
        : null
      : user.proposalFontPairId;
    const nextSourceMode = hasSourceModePatch
      ? (args.sourceMode ?? undefined)
      : user.proposalSourceMode;

    const needsWrite =
      currentSavedVoicePreset !== nextSavedVoicePreset ||
      user.proposalTemplateId !== nextTemplateId ||
      user.proposalStyleChoice !== nextStyleChoice ||
      user.proposalPaletteOverride !== nextPaletteOverride ||
      user.proposalAccentHex !== nextAccentHex ||
      user.proposalFontPairId !== nextFontPairId ||
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

        if (nextFontPairId !== undefined) {
          nextReplacement.proposalFontPairId = nextFontPairId;
        } else {
          delete nextReplacement.proposalFontPairId;
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
      fontPairId: nextFontPairId,
      sourceMode: nextSourceMode,
    };
  },
});
