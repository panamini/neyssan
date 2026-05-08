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
};

export type UserProfileDocumentAppearanceSnapshot = {
  familyId?: UserProfileVerbatiLayoutId;
  layout: UserProfileStoredVerbatiLayout;
  typography: UserProfileStoredVerbatiTypography;
  palette: UserProfileVerbatiPaletteId;
  accentHex?: string;
};

export type UserProfileMetadata = {
  source?: string;
  importedAt?: number;
  confidence?: number;
  filename?: string;
  verbatiStyle?: UserProfileVerbatiStyle;
  verbatiStyleSlotId?: 1 | 2 | 3;
  verbatiStyleSlotSource?: "factory" | "settings";
  verbatiStyleSlotNameSnapshot?: string;
  verbatiStyleBaseSnapshot?: UserProfileDocumentAppearanceSnapshot;
  documentStyleVersion?: 1;
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

export const userProfileVerbatiStyleValidator = v.object({
  layout: persistedLayoutChoice,
  typography: persistedTypographyChoice,
  palette: paletteChoice,
  accentHex: v.optional(v.string()),
});

export const userProfileDocumentAppearanceSnapshotValidator = v.object({
  familyId: v.optional(canonicalLayoutChoice),
  layout: persistedLayoutChoice,
  typography: persistedTypographyChoice,
  palette: paletteChoice,
  accentHex: v.optional(v.string()),
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
  verbatiStyle: v.optional(userProfileVerbatiStyleValidator),
  verbatiStyleSlotId: v.optional(documentStyleSlotIdValidator),
  verbatiStyleSlotSource: v.optional(documentStyleSlotSourceValidator),
  verbatiStyleSlotNameSnapshot: v.optional(v.string()),
  verbatiStyleBaseSnapshot: v.optional(
    userProfileDocumentAppearanceSnapshotValidator,
  ),
  documentStyleVersion: v.optional(v.literal(1)),
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
