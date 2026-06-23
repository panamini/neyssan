/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
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
  v.literal("terre"),
  v.literal("cobalt"),
  v.literal("ink"),
  v.literal("sauge"),
  v.literal("plum"),
  v.literal("ochre"),
  v.literal("ocre"),
  v.literal("pierre"),
  v.literal("bordeaux"),
  v.literal("encre"),
  v.null(),
);
const proposalAccentHexValidator = v.union(v.string(), v.null());
const proposalFontPairIdValidator = v.union(v.string(), v.null());
const proposalContactTextValidator = v.union(v.string(), v.null());

const proposalSourceModeValidator = v.union(
  v.literal("inherit_cv"),
  v.literal("proposal_local"),
);

const proposalSignatureFontValidator = v.union(
  v.literal("chaumont"),
  v.literal("fd-garamond"),
  v.literal("parisienne"),
);

const proposalSignatureSettingsValidator = v.object({
  mode: v.union(v.literal("auto"), v.literal("font"), v.literal("image")),
  fontId: v.union(proposalSignatureFontValidator, v.null()),
  imageDataUrl: v.union(v.string(), v.null()),
});

const proposalPresetVerbatiStyleValidator = v.object({
  familyId: v.optional(v.string()),
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.union(v.string(), v.null())),
  // CV-only template/layout choice for shared Settings style slots.
  // Proposal renderers must map the slot to proposal-safe templates instead.
  resumeTemplateId: v.optional(v.string()),
});

type ProposalSignatureSettingsData = {
  mode: "auto" | "font" | "image";
  fontId: "chaumont" | "fd-garamond" | "parisienne" | null;
  imageDataUrl: string | null;
};

const DEFAULT_PROPOSAL_SIGNATURE_SETTINGS: ProposalSignatureSettingsData = {
  mode: "auto",
  fontId: null,
  imageDataUrl: null,
};

const SIGNATURE_IMAGE_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;

function cleanProposalSignatureSettings(
  value: ProposalSignatureSettingsData | null | undefined,
): ProposalSignatureSettingsData {
  if (!value || typeof value !== "object") {
    return DEFAULT_PROPOSAL_SIGNATURE_SETTINGS;
  }

  if (
    value.mode === "image" &&
    typeof value.imageDataUrl === "string" &&
    SIGNATURE_IMAGE_DATA_URL_PATTERN.test(value.imageDataUrl.trim())
  ) {
    return {
      mode: "image",
      fontId: null,
      imageDataUrl: value.imageDataUrl.trim(),
    };
  }

  if (value.mode === "font" && value.fontId) {
    return {
      mode: "font",
      fontId: value.fontId,
      imageDataUrl:
        typeof value.imageDataUrl === "string" &&
        SIGNATURE_IMAGE_DATA_URL_PATTERN.test(value.imageDataUrl.trim())
          ? value.imageDataUrl.trim()
          : null,
    };
  }

  if (value.mode === "auto") {
    return {
      mode: "auto",
      fontId: null,
      imageDataUrl:
        typeof value.imageDataUrl === "string" &&
        SIGNATURE_IMAGE_DATA_URL_PATTERN.test(value.imageDataUrl.trim())
          ? value.imageDataUrl.trim()
          : null,
    };
  }

  return DEFAULT_PROPOSAL_SIGNATURE_SETTINGS;
}

function cleanProposalContactText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

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
    proposalDefaultContactEmail: v.optional(proposalContactTextValidator),
    proposalDefaultContactPhone: v.optional(proposalContactTextValidator),
    proposalDefaultContactLinkedin: v.optional(proposalContactTextValidator),
    proposalDefaultContactWebsite: v.optional(proposalContactTextValidator),
    proposalDefaultContactLocation: v.optional(proposalContactTextValidator),
    signatureSettings: proposalSignatureSettingsValidator,
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        voicePreset: DEFAULT_PROPOSAL_VOICE_PRESET,
        savedVoicePreset: null,
        templateId: DEFAULT_PROPOSAL_TEMPLATE_ID,
        signatureSettings: DEFAULT_PROPOSAL_SIGNATURE_SETTINGS,
      };
    }

    const user = await getCurrentSettingsProfileForClerk(ctx, identity.subject);
    const activeSlot =
      (user?.proposalActivePresetSlot as 1 | 2 | 3 | undefined) ?? null;
    const activePreset = activeSlot
      ? (user?.[
          `proposalPreset${activeSlot}` as
            | "proposalPreset1"
            | "proposalPreset2"
            | "proposalPreset3"
        ] as PresetSlotData | null | undefined) ?? null
      : null;
    const currentVerbatiStyle =
      activePreset?.verbatiStyle ??
      (user?.proposalVerbatiStyle && typeof user.proposalVerbatiStyle === "object"
        ? (user.proposalVerbatiStyle as PresetSlotData["verbatiStyle"])
        : undefined);
    const currentVoicePreset =
      resolveProposalVoicePreset(user?.proposalVoicePreset) ?? null;

    return {
      voicePreset: currentVoicePreset ?? DEFAULT_PROPOSAL_VOICE_PRESET,
      savedVoicePreset: currentVoicePreset,
      templateId:
        resolveProposalTemplateId(user?.proposalTemplateId) ??
        DEFAULT_PROPOSAL_TEMPLATE_ID,
      styleChoice: activePreset?.styleChoice ?? user?.proposalStyleChoice,
      paletteOverride:
        activePreset !== null ? activePreset.paletteOverride : user?.proposalPaletteOverride,
      accentHex: activePreset !== null ? activePreset.accentHex : user?.proposalAccentHex,
      fontPairId: activePreset !== null ? activePreset.fontPairId : user?.proposalFontPairId,
      verbatiStyle: currentVerbatiStyle,
      sourceMode: user?.proposalSourceMode,
      proposalDefaultContactEmail: user?.proposalDefaultContactEmail ?? null,
      proposalDefaultContactPhone: user?.proposalDefaultContactPhone ?? null,
      proposalDefaultContactLinkedin: user?.proposalDefaultContactLinkedin ?? null,
      proposalDefaultContactWebsite: user?.proposalDefaultContactWebsite ?? null,
      proposalDefaultContactLocation: user?.proposalDefaultContactLocation ?? null,
      signatureSettings: cleanProposalSignatureSettings(
        (user?.proposalSignatureSettings ?? activePreset?.signatureSettings) as
          | ProposalSignatureSettingsData
          | null
          | undefined,
      ),
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
  signatureSettings: v.optional(proposalSignatureSettingsValidator),
  name: v.optional(v.string()),
});

type PresetSlotData = {
  fontPairId: string | null;
  styleChoice: "auto" | "formal" | "warm" | "technical" | "balanced";
  paletteOverride:
    | "terre"
    | "cobalt"
    | "ink"
    | "sauge"
    | "plum"
    | "ochre"
    | "ocre"
    | "pierre"
    | "bordeaux"
    | "encre"
    | null;
  accentHex: string | null;
  verbatiStyle?: {
    familyId?: string;
    layout: string;
    typography: string;
    palette: string;
    accentHex?: string | null;
    resumeTemplateId?: string;
  };
  voicePreset: "signature" | "expert" | "direct" | "engaging" | "storyteller" | null;
  signatureSettings?: ProposalSignatureSettingsData;
  name?: string;
};

type UserProfileReplacement = Omit<
  Doc<"userProfiles">,
  "_id" | "_creationTime"
>;

type ClerkIdentity = {
  subject: string;
  email?: string | null;
  name?: string | null;
};

async function getCurrentSettingsProfileForClerk(
  ctx: any,
  clerkId: string,
): Promise<Doc<"userProfiles"> | null> {
  const row = await ctx.db
    .query("userProfiles")
    .withIndex("by_clerk_updated_at", (q: any) => q.eq("clerkId", clerkId))
    .order("desc")
    .first();

  return (row as Doc<"userProfiles"> | null) ?? null;
}

async function ensureCurrentSettingsProfile(
  ctx: any,
  identity: ClerkIdentity,
): Promise<Doc<"userProfiles">> {
  let user = await getCurrentSettingsProfileForClerk(ctx, identity.subject);

  if (!user) {
    await ctx.runMutation(internal.users.createOrUpdateUser, {
      clerkId: identity.subject,
      email: identity.email ?? "unknown@example.com",
      name: identity.name,
    });
    user = await getCurrentSettingsProfileForClerk(ctx, identity.subject);
  }

  if (!user) {
    throw new Error("User profile not found");
  }

  return user;
}

function applyPresetToCurrentProposalFields(
  nextReplacement: Record<string, unknown>,
  preset: PresetSlotData,
) {
  if (preset.styleChoice && preset.styleChoice !== "auto") {
    nextReplacement.proposalStyleChoice = preset.styleChoice;
  } else {
    delete nextReplacement.proposalStyleChoice;
  }

  nextReplacement.proposalPaletteOverride = preset.paletteOverride;
  const nextAccentHex =
    typeof preset.accentHex === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(preset.accentHex)
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
    const user = await getCurrentSettingsProfileForClerk(ctx, identity.subject);
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

    const user = await ensureCurrentSettingsProfile(ctx, identity);

    const fieldKey = `proposalPreset${args.slot}` as "proposalPreset1" | "proposalPreset2" | "proposalPreset3";
    const nextAccentHex =
      typeof args.preset.accentHex === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(args.preset.accentHex)
        ? args.preset.accentHex.toUpperCase()
        : null;
    const cleanPreset: PresetSlotData = {
      ...args.preset,
      accentHex: nextAccentHex,
      signatureSettings: cleanProposalSignatureSettings(
        args.preset.signatureSettings as
          | ProposalSignatureSettingsData
          | null
          | undefined,
      ),
    };
    const activeSlot = (user.proposalActivePresetSlot as 1 | 2 | 3 | undefined) ?? 1;

    const { _creationTime, _id, ...rest } = user;
    const nextReplacement: UserProfileReplacement = {
      ...rest,
      [fieldKey]: cleanPreset,
      updatedAt: Date.now(),
      version: (user.version ?? 1) + 1,
    };
    if (activeSlot === args.slot) {
      applyPresetToCurrentProposalFields(nextReplacement, cleanPreset);
    }

    await ctx.db.replace(_id, nextReplacement);
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

    const user = await ensureCurrentSettingsProfile(ctx, identity);

    const fieldKey = `proposalPreset${args.slot}` as "proposalPreset1" | "proposalPreset2" | "proposalPreset3";
    const preset = (user[fieldKey] as PresetSlotData | null | undefined) ?? null;

    const { _creationTime, _id, ...rest } = user;
    const nextReplacement: UserProfileReplacement = {
      ...rest,
      proposalActivePresetSlot: args.slot,
      updatedAt: Date.now(),
      version: (user.version ?? 1) + 1,
    };

    // Mirror active preset into legacy single-default fields so ProposalForge continues to work.
    if (preset) {
      applyPresetToCurrentProposalFields(nextReplacement, preset);
    }

    await ctx.db.replace(_id, nextReplacement);
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
    proposalDefaultContactEmail: v.optional(proposalContactTextValidator),
    proposalDefaultContactPhone: v.optional(proposalContactTextValidator),
    proposalDefaultContactLinkedin: v.optional(proposalContactTextValidator),
    proposalDefaultContactWebsite: v.optional(proposalContactTextValidator),
    proposalDefaultContactLocation: v.optional(proposalContactTextValidator),
    signatureSettings: v.optional(proposalSignatureSettingsValidator),
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
    proposalDefaultContactEmail: v.optional(proposalContactTextValidator),
    proposalDefaultContactPhone: v.optional(proposalContactTextValidator),
    proposalDefaultContactLinkedin: v.optional(proposalContactTextValidator),
    proposalDefaultContactWebsite: v.optional(proposalContactTextValidator),
    proposalDefaultContactLocation: v.optional(proposalContactTextValidator),
    signatureSettings: proposalSignatureSettingsValidator,
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
    const hasContactEmailPatch = Object.prototype.hasOwnProperty.call(
      args,
      "proposalDefaultContactEmail",
    );
    const hasContactPhonePatch = Object.prototype.hasOwnProperty.call(
      args,
      "proposalDefaultContactPhone",
    );
    const hasContactLinkedinPatch = Object.prototype.hasOwnProperty.call(
      args,
      "proposalDefaultContactLinkedin",
    );
    const hasContactWebsitePatch = Object.prototype.hasOwnProperty.call(
      args,
      "proposalDefaultContactWebsite",
    );
    const hasContactLocationPatch = Object.prototype.hasOwnProperty.call(
      args,
      "proposalDefaultContactLocation",
    );
    const hasSignatureSettingsPatch = Object.prototype.hasOwnProperty.call(
      args,
      "signatureSettings",
    );

    if (
      !hasVoicePresetPatch &&
      !hasTemplatePatch &&
      !hasStyleChoicePatch &&
      !hasPalettePatch &&
      !hasAccentHexPatch &&
      !hasFontPairPatch &&
      !hasSourceModePatch &&
      !hasContactEmailPatch &&
      !hasContactPhonePatch &&
      !hasContactLinkedinPatch &&
      !hasContactWebsitePatch &&
      !hasContactLocationPatch &&
      !hasSignatureSettingsPatch
    ) {
      throw new Error("No proposal setting patch was provided");
    }

    const user = await ensureCurrentSettingsProfile(ctx, identity);

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
    const nextContactEmail = hasContactEmailPatch
      ? cleanProposalContactText(args.proposalDefaultContactEmail)
      : user.proposalDefaultContactEmail;
    const nextContactPhone = hasContactPhonePatch
      ? cleanProposalContactText(args.proposalDefaultContactPhone)
      : user.proposalDefaultContactPhone;
    const nextContactLinkedin = hasContactLinkedinPatch
      ? cleanProposalContactText(args.proposalDefaultContactLinkedin)
      : user.proposalDefaultContactLinkedin;
    const nextContactWebsite = hasContactWebsitePatch
      ? cleanProposalContactText(args.proposalDefaultContactWebsite)
      : user.proposalDefaultContactWebsite;
    const nextContactLocation = hasContactLocationPatch
      ? cleanProposalContactText(args.proposalDefaultContactLocation)
      : user.proposalDefaultContactLocation;
    const currentSignatureSettings = cleanProposalSignatureSettings(
      user.proposalSignatureSettings as ProposalSignatureSettingsData | null | undefined,
    );
    const nextSignatureSettings = hasSignatureSettingsPatch
      ? cleanProposalSignatureSettings(
          args.signatureSettings as ProposalSignatureSettingsData | null | undefined,
        )
      : currentSignatureSettings;

    const needsWrite =
      currentSavedVoicePreset !== nextSavedVoicePreset ||
      user.proposalTemplateId !== nextTemplateId ||
      user.proposalStyleChoice !== nextStyleChoice ||
      user.proposalPaletteOverride !== nextPaletteOverride ||
      user.proposalAccentHex !== nextAccentHex ||
      user.proposalFontPairId !== nextFontPairId ||
      user.proposalSourceMode !== nextSourceMode ||
      user.proposalDefaultContactEmail !== nextContactEmail ||
      user.proposalDefaultContactPhone !== nextContactPhone ||
      user.proposalDefaultContactLinkedin !== nextContactLinkedin ||
      user.proposalDefaultContactWebsite !== nextContactWebsite ||
      user.proposalDefaultContactLocation !== nextContactLocation ||
      JSON.stringify(currentSignatureSettings) !== JSON.stringify(nextSignatureSettings);

    if (needsWrite) {
      const { _creationTime, _id, ...rest } = user;
      const nextReplacement: UserProfileReplacement = {
        ...rest,
        proposalTemplateId: nextTemplateId,
        updatedAt: Date.now(),
        version: (user.version ?? 1) + 1,
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

      nextReplacement.proposalDefaultContactEmail = nextContactEmail ?? null;
      nextReplacement.proposalDefaultContactPhone = nextContactPhone ?? null;
      nextReplacement.proposalDefaultContactLinkedin = nextContactLinkedin ?? null;
      nextReplacement.proposalDefaultContactWebsite = nextContactWebsite ?? null;
      nextReplacement.proposalDefaultContactLocation = nextContactLocation ?? null;
      nextReplacement.proposalSignatureSettings = nextSignatureSettings;

      await ctx.db.replace(_id, nextReplacement);
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
      proposalDefaultContactEmail: nextContactEmail ?? null,
      proposalDefaultContactPhone: nextContactPhone ?? null,
      proposalDefaultContactLinkedin: nextContactLinkedin ?? null,
      proposalDefaultContactWebsite: nextContactWebsite ?? null,
      proposalDefaultContactLocation: nextContactLocation ?? null,
      signatureSettings: nextSignatureSettings,
    };
  },
});
