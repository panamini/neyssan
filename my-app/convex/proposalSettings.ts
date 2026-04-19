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
const proposalVerbatiStyleValidator = v.object({
  familyId: v.optional(v.string()),
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.string()),
});

const proposalSourceModeValidator = v.union(
  v.literal("inherit_cv"),
  v.literal("proposal_local"),
);

const STYLE_FAMILY_IDS = [
  "swiss",
  "volk-register",
  "two-column",
  "editorial",
  "modernist",
  "quire",
  "workshop",
] as const;

type StyleFamilyId = (typeof STYLE_FAMILY_IDS)[number];

type CanonicalVerbatiStyle = {
  familyId: StyleFamilyId;
  layout: StyleFamilyId;
  typography: string;
  palette: string;
  accentHex?: string;
};

const LEGACY_PROPOSAL_STYLE_DEFAULTS: Record<
  "auto" | "formal" | "warm" | "technical" | "balanced",
  CanonicalVerbatiStyle
> = {
  auto: {
    familyId: "swiss",
    layout: "swiss",
    typography: "signature",
    palette: "pierre",
  },
  balanced: {
    familyId: "swiss",
    layout: "swiss",
    typography: "signature",
    palette: "pierre",
  },
  formal: {
    familyId: "quire",
    layout: "quire",
    typography: "expert",
    palette: "pierre",
  },
  warm: {
    familyId: "editorial",
    layout: "editorial",
    typography: "engaging",
    palette: "bordeaux",
  },
  technical: {
    familyId: "modernist",
    layout: "modernist",
    typography: "expert",
    palette: "encre",
  },
};

const STYLE_FAMILY_PROPOSAL_TEMPLATES: Record<StyleFamilyId, typeof PROPOSAL_TEMPLATE_IDS[number]> = {
  swiss: "swiss_margin",
  "volk-register": "volk_register",
  "two-column": "two_column_rail",
  editorial: "editorial_wide",
  modernist: "modernist_signal",
  quire: "quire_margin",
  workshop: "workshop_proposal_margin",
};

function resolveStyleFamilyId(value: unknown): StyleFamilyId | null {
  return typeof value === "string" && STYLE_FAMILY_IDS.includes(value as StyleFamilyId)
    ? (value as StyleFamilyId)
    : null;
}

function normalizeProposalPaletteOverride(
  value: unknown,
): "sauge" | "ocre" | "pierre" | "bordeaux" | "encre" | null {
  return value === "sauge" ||
    value === "ocre" ||
    value === "pierre" ||
    value === "bordeaux" ||
    value === "encre"
    ? value
    : null;
}

function normalizeProposalAccentHex(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toUpperCase()
    : null;
}

function normalizeVerbatiTypography(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function resolveProposalStyleChoiceValue(
  value: unknown,
): "auto" | "formal" | "warm" | "technical" | "balanced" {
  return value === "formal" ||
    value === "warm" ||
    value === "technical" ||
    value === "balanced"
    ? value
    : "auto";
}

export function buildCanonicalProposalVerbatiStyle(input: {
  verbatiStyle?: {
    familyId?: unknown;
    layout?: unknown;
    typography?: unknown;
    palette?: unknown;
    accentHex?: unknown;
  } | null;
  styleChoice?: unknown;
  fontPairId?: unknown;
  paletteOverride?: unknown;
  accentHex?: unknown;
}): CanonicalVerbatiStyle {
  const storedFamilyId =
    resolveStyleFamilyId(input.verbatiStyle?.familyId) ??
    resolveStyleFamilyId(input.verbatiStyle?.layout);

  const baseStyle = storedFamilyId
    ? {
        familyId: storedFamilyId,
        layout: storedFamilyId,
        typography:
          normalizeVerbatiTypography(input.verbatiStyle?.typography) ??
          LEGACY_PROPOSAL_STYLE_DEFAULTS.auto.typography,
        palette:
          normalizeProposalPaletteOverride(input.verbatiStyle?.palette) ??
          (typeof input.verbatiStyle?.palette === "string" &&
          input.verbatiStyle.palette.trim().length > 0
            ? input.verbatiStyle.palette.trim()
            : LEGACY_PROPOSAL_STYLE_DEFAULTS.auto.palette),
      }
    : { ...LEGACY_PROPOSAL_STYLE_DEFAULTS[resolveProposalStyleChoiceValue(input.styleChoice)] };

  const typography =
    normalizeVerbatiTypography(input.fontPairId) ??
    normalizeVerbatiTypography(input.verbatiStyle?.typography) ??
    baseStyle.typography;
  const accentHex =
    normalizeProposalAccentHex(input.accentHex) ??
    normalizeProposalAccentHex(input.verbatiStyle?.accentHex);
  const paletteOverride = accentHex
    ? null
    : normalizeProposalPaletteOverride(input.paletteOverride) ??
      normalizeProposalPaletteOverride(input.verbatiStyle?.palette);

  return {
    familyId: baseStyle.familyId,
    layout: baseStyle.familyId,
    typography,
    palette: accentHex ? "custom" : paletteOverride ?? baseStyle.palette,
    ...(accentHex ? { accentHex } : {}),
  };
}

export function inferLegacyProposalStyleChoice(
  style: CanonicalVerbatiStyle,
): "auto" | "formal" | "warm" | "technical" | "balanced" {
  switch (style.familyId) {
    case "editorial":
      return "warm";
    case "modernist":
      return "technical";
    case "quire":
      return "formal";
    default:
      return "balanced";
  }
}

function buildCompatibilityStyleFields(style: CanonicalVerbatiStyle) {
  const accentHex = normalizeProposalAccentHex(style.accentHex);
  const paletteOverride = accentHex
    ? null
    : normalizeProposalPaletteOverride(style.palette);

  return {
    proposalVerbatiStyle: style,
    proposalStyleChoice: inferLegacyProposalStyleChoice(style),
    proposalPaletteOverride: paletteOverride,
    proposalAccentHex: accentHex,
    proposalFontPairId: style.typography,
    proposalTemplateId: STYLE_FAMILY_PROPOSAL_TEMPLATES[style.familyId],
  };
}

export const getCurrent = query({
  args: {},
  returns: v.object({
    voicePreset: proposalVoicePresetChoice,
    savedVoicePreset: v.union(proposalVoicePresetChoice, v.null()),
    templateId: proposalTemplateChoice,
    verbatiStyle: v.optional(proposalVerbatiStyleValidator),
    styleChoice: v.optional(proposalStyleChoiceValidator),
    paletteOverride: v.optional(proposalPaletteOverrideValidator),
    accentHex: v.optional(proposalAccentHexValidator),
    fontPairId: v.optional(proposalFontPairIdValidator),
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
      verbatiStyle: buildCanonicalProposalVerbatiStyle({
        verbatiStyle:
          user?.proposalVerbatiStyle && typeof user.proposalVerbatiStyle === "object"
            ? user.proposalVerbatiStyle
            : null,
        styleChoice: user?.proposalStyleChoice,
        fontPairId: user?.proposalFontPairId,
        paletteOverride: user?.proposalPaletteOverride,
        accentHex: user?.proposalAccentHex,
      }),
      styleChoice: user?.proposalStyleChoice,
      paletteOverride: user?.proposalPaletteOverride,
      accentHex: user?.proposalAccentHex,
      fontPairId: user?.proposalFontPairId,
      sourceMode: user?.proposalSourceMode,
    };
  },
});

// ─── Preset slot shape ────────────────────────────────────────────────────────

const presetSlotValidator = v.object({
  verbatiStyle: v.optional(proposalVerbatiStyleValidator),
  fontPairId: v.optional(v.union(v.string(), v.null())),
  styleChoice: v.optional(proposalStyleChoiceValidator),
  paletteOverride: v.optional(proposalPaletteOverrideValidator),
  accentHex: v.optional(proposalAccentHexValidator),
  voicePreset: v.union(proposalVoicePresetChoice, v.null()),
  name: v.optional(v.string()),
});

type PresetSlotData = {
  verbatiStyle?: CanonicalVerbatiStyle;
  fontPairId?: string | null;
  styleChoice?: "auto" | "formal" | "warm" | "technical" | "balanced";
  paletteOverride?: "sauge" | "ocre" | "pierre" | "bordeaux" | "encre" | null;
  accentHex?: string | null;
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
    const canonicalStyle = buildCanonicalProposalVerbatiStyle({
      verbatiStyle: args.preset.verbatiStyle ?? null,
      styleChoice: args.preset.styleChoice,
      fontPairId: args.preset.fontPairId,
      paletteOverride: args.preset.paletteOverride,
      accentHex: args.preset.accentHex,
    });
    const compatibilityFields = buildCompatibilityStyleFields(canonicalStyle);
    const cleanPreset: PresetSlotData = {
      verbatiStyle: canonicalStyle,
      fontPairId: compatibilityFields.proposalFontPairId,
      styleChoice: compatibilityFields.proposalStyleChoice,
      paletteOverride: compatibilityFields.proposalPaletteOverride,
      accentHex: compatibilityFields.proposalAccentHex,
      voicePreset: args.preset.voicePreset,
      ...(args.preset.name ? { name: args.preset.name } : {}),
    };

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
          const canonicalStyle = buildCanonicalProposalVerbatiStyle({
            verbatiStyle: preset.verbatiStyle ?? null,
            styleChoice: preset.styleChoice,
            fontPairId: preset.fontPairId,
            paletteOverride: preset.paletteOverride,
            accentHex: preset.accentHex,
          });
          const compatibilityFields = buildCompatibilityStyleFields(canonicalStyle);
          if (preset.voicePreset) {
            nextReplacement.proposalVoicePreset = preset.voicePreset;
          } else {
            delete nextReplacement.proposalVoicePreset;
          }
          nextReplacement.proposalVerbatiStyle = compatibilityFields.proposalVerbatiStyle;
          nextReplacement.proposalStyleChoice = compatibilityFields.proposalStyleChoice;
          nextReplacement.proposalPaletteOverride = compatibilityFields.proposalPaletteOverride;
          nextReplacement.proposalAccentHex = compatibilityFields.proposalAccentHex;
          nextReplacement.proposalFontPairId = compatibilityFields.proposalFontPairId;
          nextReplacement.proposalTemplateId = compatibilityFields.proposalTemplateId;
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
    verbatiStyle: v.optional(v.union(proposalVerbatiStyleValidator, v.null())),
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
    verbatiStyle: v.optional(proposalVerbatiStyleValidator),
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
    const hasVerbatiStylePatch = Object.prototype.hasOwnProperty.call(
      args,
      "verbatiStyle",
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
      !hasVerbatiStylePatch &&
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
    const nextVerbatiStyle = hasVerbatiStylePatch
      ? args.verbatiStyle
        ? buildCanonicalProposalVerbatiStyle({
            verbatiStyle: args.verbatiStyle,
          })
        : null
      : buildCanonicalProposalVerbatiStyle({
          verbatiStyle:
            user.proposalVerbatiStyle && typeof user.proposalVerbatiStyle === "object"
              ? user.proposalVerbatiStyle
              : null,
          styleChoice: user.proposalStyleChoice,
          fontPairId: user.proposalFontPairId,
          paletteOverride: user.proposalPaletteOverride,
          accentHex: user.proposalAccentHex,
        });
    const nextVerbatiCompatibility = nextVerbatiStyle
      ? buildCompatibilityStyleFields(nextVerbatiStyle)
      : null;
    const nextTemplateId = hasTemplatePatch
      ? args.templateId ?? DEFAULT_PROPOSAL_TEMPLATE_ID
      : nextVerbatiCompatibility?.proposalTemplateId ??
        resolveProposalTemplateId(user.proposalTemplateId) ??
        DEFAULT_PROPOSAL_TEMPLATE_ID;
    const nextStyleChoice = hasStyleChoicePatch
      ? (args.styleChoice ?? undefined)
      : nextVerbatiCompatibility?.proposalStyleChoice
        ? nextVerbatiCompatibility.proposalStyleChoice
      : user.proposalStyleChoice;
    const nextPaletteOverride = hasPalettePatch
      ? args.paletteOverride
      : nextVerbatiCompatibility
        ? nextVerbatiCompatibility.proposalPaletteOverride
      : user.proposalPaletteOverride;
    const nextAccentHex =
      hasAccentHexPatch && typeof args.accentHex === "string"
        ? /^#[0-9a-fA-F]{6}$/.test(args.accentHex)
          ? args.accentHex.toUpperCase()
          : user.proposalAccentHex
        : hasAccentHexPatch
          ? null
          : nextVerbatiCompatibility
            ? nextVerbatiCompatibility.proposalAccentHex
          : user.proposalAccentHex;
    const nextFontPairId = hasFontPairPatch
      ? typeof args.fontPairId === "string" && args.fontPairId.trim()
        ? args.fontPairId.trim()
        : null
      : nextVerbatiCompatibility
        ? nextVerbatiCompatibility.proposalFontPairId
      : user.proposalFontPairId;
    const nextSourceMode = hasSourceModePatch
      ? (args.sourceMode ?? undefined)
      : user.proposalSourceMode;

    const needsWrite =
      currentSavedVoicePreset !== nextSavedVoicePreset ||
      user.proposalTemplateId !== nextTemplateId ||
      JSON.stringify(user.proposalVerbatiStyle ?? null) !==
        JSON.stringify(nextVerbatiStyle ?? null) ||
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
        if (nextVerbatiStyle) {
          nextReplacement.proposalVerbatiStyle = nextVerbatiStyle;
        } else {
          delete nextReplacement.proposalVerbatiStyle;
        }

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
      verbatiStyle: nextVerbatiStyle ?? undefined,
      styleChoice: nextStyleChoice,
      paletteOverride: nextPaletteOverride,
      accentHex: nextAccentHex,
      fontPairId: nextFontPairId,
      sourceMode: nextSourceMode,
    };
  },
});
