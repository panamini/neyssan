import { v } from "convex/values";

export const USER_PROFILE_VERBATI_LAYOUT_IDS = [
  "swiss",
  "volk-register",
  "two-column",
  "editorial",
  "modernist",
  "quire",
  "workshop",
] as const;

export const USER_PROFILE_VERBATI_LAYOUT_LEGACY_ALIASES = [
  "playful-photo",
  "soft-ribbon",
  "slate-column",
] as const;

export const USER_PROFILE_VERBATI_PALETTE_IDS = [
  "terre",
  "cobalt",
  "ink",
  "sauge",
  "plum",
  "ochre",
  "ocre",
  "pierre",
  "bordeaux",
  "encre",
  "custom",
] as const;

export const USER_PROFILE_VERBATI_TYPOGRAPHY_IDS = [
  "quiet-editorial",
  "geist-baskervville",
  "civic-correspondence",
  "ledger-sans",
  "mono-signal",
  "studio-grotesk",
  "soft-serif",
  "special-correspondence",
  "fd-garamond-geist",
  "poster-accent",
  "high-contrast-editorial",
  "bricolage-hepta",
  "nunito-ortica",
  "nunito-code",
  "doto-code",
] as const;

export const USER_PROFILE_VERBATI_TYPOGRAPHY_LEGACY_ALIASES = [
  "signature",
  "engaging",
  "expert",
] as const;

export const USER_PROFILE_RESUME_TEMPLATE_IDS = [
  "swiss_resume_legacy",
  "volk_register_resume_legacy",
  "two_column_resume_legacy",
  "editorial_resume_legacy",
  "modernist_resume_legacy",
  "quire_resume_legacy",
  "editorial-sidebar",
  "workshop_resume_onecol_ats",
  "workshop_resume_twocol_ats",
  "sanat_asymmetric_resume",
] as const;

export type UserProfileVerbatiLayoutId =
  (typeof USER_PROFILE_VERBATI_LAYOUT_IDS)[number];
export type UserProfileVerbatiLayoutLegacyAlias =
  (typeof USER_PROFILE_VERBATI_LAYOUT_LEGACY_ALIASES)[number];
export type UserProfileVerbatiPaletteId =
  (typeof USER_PROFILE_VERBATI_PALETTE_IDS)[number];
export type UserProfileVerbatiTypographyId =
  (typeof USER_PROFILE_VERBATI_TYPOGRAPHY_IDS)[number];
export type UserProfileVerbatiTypographyLegacyAlias =
  (typeof USER_PROFILE_VERBATI_TYPOGRAPHY_LEGACY_ALIASES)[number];
export type UserProfileResumeTemplateId =
  (typeof USER_PROFILE_RESUME_TEMPLATE_IDS)[number];

export type UserProfileStoredVerbatiLayout =
  | UserProfileVerbatiLayoutId
  | UserProfileVerbatiLayoutLegacyAlias;
export type UserProfileStoredVerbatiTypography =
  | UserProfileVerbatiTypographyId
  | UserProfileVerbatiTypographyLegacyAlias;

export type UserProfileVerbatiStyle = {
  layout: UserProfileStoredVerbatiLayout;
  typography: UserProfileStoredVerbatiTypography;
  palette: UserProfileVerbatiPaletteId;
  accentHex?: string;
  resumeTemplateId?: UserProfileResumeTemplateId;
};

export type UserProfileDocumentAppearanceSnapshot = {
  familyId?: UserProfileVerbatiLayoutId;
  layout: UserProfileStoredVerbatiLayout;
  typography: UserProfileStoredVerbatiTypography;
  palette: UserProfileVerbatiPaletteId;
  accentHex?: string;
  resumeTemplateId?: UserProfileResumeTemplateId;
};

export type UserProfileLegacyProfileImage = {
  src?: string;
  fileName?: string;
  size?: "small" | "medium" | "large";
  fit?: "contain" | "cover";
};

export type UserProfileDocumentDecoration = {
  visible: boolean;
  source: "upload";
  assetId?: string;
  dataUrl?: string;
  resolvedUrl?: string;
  assetMissing?: boolean;
  fileName?: string;
  mimeType?: "image/png" | "image/jpeg" | "image/svg+xml";
  alt?: string;
  sizePreset: 18 | 35 | 52 | "custom";
  customSizeMm?: number;
  fit: "contain" | "cover";
  placementMode: "default" | "custom";
  xMm?: number;
  yMm?: number;
};

export type UserProfileMetadata = {
  source?: string;
  importedAt?: number;
  confidence?: number;
  filename?: string;
  titleLocked?: boolean;
  resumeTemplateId?: UserProfileResumeTemplateId;
  verbatiStyle?: UserProfileVerbatiStyle;
  verbatiStyleSlotId?: 1 | 2 | 3;
  verbatiStyleSlotSource?: "factory" | "settings";
  verbatiStyleSlotNameSnapshot?: string;
  verbatiStyleBaseSnapshot?: UserProfileDocumentAppearanceSnapshot;
  documentStyleVersion?: 1;
  profileImage?: UserProfileLegacyProfileImage;
  documentDecoration?: UserProfileDocumentDecoration;
};

const LEGACY_LAYOUT_TO_CANONICAL: Record<
  UserProfileVerbatiLayoutLegacyAlias,
  UserProfileVerbatiLayoutId
> = {
  "playful-photo": "two-column",
  "soft-ribbon": "two-column",
  "slate-column": "two-column",
};

const LEGACY_TYPOGRAPHY_TO_CANONICAL: Record<
  UserProfileVerbatiTypographyLegacyAlias,
  UserProfileVerbatiTypographyId
> = {
  signature: "quiet-editorial",
  engaging: "soft-serif",
  expert: "mono-signal",
};

const canonicalLayoutChoice = v.union(
  ...USER_PROFILE_VERBATI_LAYOUT_IDS.map((layoutId) => v.literal(layoutId)),
);

const persistedLayoutChoice = v.union(
  ...[
    ...USER_PROFILE_VERBATI_LAYOUT_IDS,
    ...USER_PROFILE_VERBATI_LAYOUT_LEGACY_ALIASES,
  ].map((layoutId) => v.literal(layoutId)),
);

const paletteChoice = v.union(
  ...USER_PROFILE_VERBATI_PALETTE_IDS.map((paletteId) => v.literal(paletteId)),
);

const canonicalTypographyChoice = v.union(
  ...USER_PROFILE_VERBATI_TYPOGRAPHY_IDS.map((pairId) => v.literal(pairId)),
);

const persistedTypographyChoice = v.union(
  ...[
    ...USER_PROFILE_VERBATI_TYPOGRAPHY_IDS,
    ...USER_PROFILE_VERBATI_TYPOGRAPHY_LEGACY_ALIASES,
  ].map((pairId) => v.literal(pairId)),
);

const resumeTemplateChoice = v.union(
  ...USER_PROFILE_RESUME_TEMPLATE_IDS.map((templateId) =>
    v.literal(templateId),
  ),
);

export const userProfileVerbatiStyleValidator = v.object({
  layout: persistedLayoutChoice,
  typography: persistedTypographyChoice,
  palette: paletteChoice,
  accentHex: v.optional(v.string()),
  resumeTemplateId: v.optional(resumeTemplateChoice),
});

export const userProfileDocumentAppearanceSnapshotValidator = v.object({
  familyId: v.optional(canonicalLayoutChoice),
  layout: persistedLayoutChoice,
  typography: persistedTypographyChoice,
  palette: paletteChoice,
  accentHex: v.optional(v.string()),
  resumeTemplateId: v.optional(resumeTemplateChoice),
});

export const userProfileLegacyProfileImageValidator = v.object({
  src: v.optional(v.string()),
  fileName: v.optional(v.string()),
  size: v.optional(
    v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
  ),
  fit: v.optional(v.union(v.literal("contain"), v.literal("cover"))),
});

export const userProfileDocumentDecorationValidator = v.object({
  visible: v.boolean(),
  source: v.literal("upload"),
  assetId: v.optional(v.string()),
  dataUrl: v.optional(v.string()),
  resolvedUrl: v.optional(v.string()),
  assetMissing: v.optional(v.boolean()),
  fileName: v.optional(v.string()),
  mimeType: v.optional(
    v.union(
      v.literal("image/png"),
      v.literal("image/jpeg"),
      v.literal("image/svg+xml"),
    ),
  ),
  alt: v.optional(v.string()),
  sizePreset: v.union(
    v.literal(18),
    v.literal(35),
    v.literal(52),
    v.literal("custom"),
  ),
  customSizeMm: v.optional(v.number()),
  fit: v.union(v.literal("contain"), v.literal("cover")),
  placementMode: v.union(v.literal("default"), v.literal("custom")),
  xMm: v.optional(v.number()),
  yMm: v.optional(v.number()),
});

export const documentStyleSlotIdValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

export const documentStyleSlotSourceValidator = v.union(
  v.literal("factory"),
  v.literal("settings"),
);

export const userProfileMetadataValidator = v.object({
  source: v.optional(v.string()),
  importedAt: v.optional(v.number()),
  confidence: v.optional(v.number()),
  filename: v.optional(v.string()),
  titleLocked: v.optional(v.boolean()),
  resumeTemplateId: v.optional(resumeTemplateChoice),
  verbatiStyle: v.optional(userProfileVerbatiStyleValidator),
  verbatiStyleSlotId: v.optional(documentStyleSlotIdValidator),
  verbatiStyleSlotSource: v.optional(documentStyleSlotSourceValidator),
  verbatiStyleSlotNameSnapshot: v.optional(v.string()),
  verbatiStyleBaseSnapshot: v.optional(
    userProfileDocumentAppearanceSnapshotValidator,
  ),
  documentStyleVersion: v.optional(v.literal(1)),
  profileImage: v.optional(userProfileLegacyProfileImageValidator),
  documentDecoration: v.optional(userProfileDocumentDecorationValidator),
});

function canonicalizeLayout(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if ((USER_PROFILE_VERBATI_LAYOUT_IDS as readonly string[]).includes(value)) {
    return value;
  }

  return (
    LEGACY_LAYOUT_TO_CANONICAL[value as UserProfileVerbatiLayoutLegacyAlias] ??
    value
  );
}

function canonicalizeTypography(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if (
    (USER_PROFILE_VERBATI_TYPOGRAPHY_IDS as readonly string[]).includes(value)
  ) {
    return value;
  }

  return (
    LEGACY_TYPOGRAPHY_TO_CANONICAL[
      value as UserProfileVerbatiTypographyLegacyAlias
    ] ?? value
  );
}

export function canonicalizeUserProfileVerbatiStyle(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const candidate = value as Record<string, unknown>;

  return {
    ...candidate,
    layout: canonicalizeLayout(candidate.layout),
    typography: canonicalizeTypography(candidate.typography),
  };
}

export function canonicalizeUserProfileMetadata(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  const next = { ...candidate };

  if ("verbatiStyle" in candidate) {
    next.verbatiStyle = canonicalizeUserProfileVerbatiStyle(
      candidate.verbatiStyle,
    );
  }

  if ("verbatiStyleBaseSnapshot" in candidate) {
    next.verbatiStyleBaseSnapshot = canonicalizeUserProfileVerbatiStyle(
      candidate.verbatiStyleBaseSnapshot,
    );
  }

  return next;
}

export const canonicalUserProfileVerbatiLayoutChoice = canonicalLayoutChoice;
export const canonicalUserProfileVerbatiTypographyChoice =
  canonicalTypographyChoice;
