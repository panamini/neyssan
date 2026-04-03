type FontAssetRecord = Record<string, string>;

export const LOCAL_FONT_DIRECTORY_HINT = "src/assets/fonts";

export const FONT_PAIR_IDS = [
  "quiet-editorial",
  "ledger-sans",
  "mono-signal",
  "studio-grotesk",
  "soft-serif",
  "special-correspondence",
  "poster-accent",
  "high-contrast-editorial",
] as const;

export type VerbatiFontPairId = (typeof FONT_PAIR_IDS)[number];
export type LegacyVerbatiTypographyPreset =
  | "signature"
  | "engaging"
  | "expert";

export type VerbatiTypographyPreset =
  | VerbatiFontPairId
  | LegacyVerbatiTypographyPreset;

type LocalFontAlias = {
  family: string;
  matchTokens: string[];
  fontStyle?: "normal" | "italic";
  fontWeight?: number;
};

export type VerbatiFontPairOption = {
  id: VerbatiFontPairId;
  name: string;
  description: string;
  headingFamily: string;
  bodyFamily: string;
  headingLabel: string;
  bodyLabel: string;
};

const LOCAL_FONT_ALIASES: LocalFontAlias[] = [
  { family: "Sono", matchTokens: ["sono"], fontWeight: 400 },
  { family: "Geist", matchTokens: ["geist"], fontWeight: 400 },
  { family: "Hepta Slab", matchTokens: ["heptaslab", "hepta-slab"], fontWeight: 500 },
  { family: "Permanent Marker", matchTokens: ["permanentmarker", "permanent-marker"], fontWeight: 400 },
  { family: "Special Elite", matchTokens: ["specialelite", "special-elite"], fontWeight: 400 },
  { family: "Fraunces", matchTokens: ["fraunces"], fontWeight: 700 },
  { family: "Syne", matchTokens: ["syne"], fontWeight: 400 },
  {
    family: "Bricolage Grotesque",
    matchTokens: ["bricolagegrotesque", "bricologegrotesque", "bricolage-grotesque"],
    fontWeight: 400,
  },
  { family: "BioRhyme", matchTokens: ["biorhyme", "bio-rhyme"], fontWeight: 400 },
];

const LOCAL_FONT_FILES = import.meta.glob(
  "../../assets/fonts/**/*.{woff,woff2,ttf,otf}",
  {
    eager: true,
    import: "default",
    query: "?url",
  },
) as FontAssetRecord;

const LEGACY_TO_FONT_PAIR_ID: Record<
  LegacyVerbatiTypographyPreset,
  VerbatiFontPairId
> = {
  signature: "quiet-editorial",
  engaging: "soft-serif",
  expert: "mono-signal",
};

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function quoteFamily(value: string): string {
  return value.includes(" ") ? `"${value}"` : value;
}

function buildFamilyStack(primaryFamily: string, fallback: string): string {
  return `${quoteFamily(primaryFamily)}, ${fallback}`;
}

function inferFontFormat(url: string): string | null {
  if (url.endsWith(".woff2")) return "woff2";
  if (url.endsWith(".woff")) return "woff";
  if (url.endsWith(".ttf")) return "truetype";
  if (url.endsWith(".otf")) return "opentype";
  return null;
}

function findLocalFontAsset(alias: LocalFontAlias): string | null {
  const assetEntries = Object.entries(LOCAL_FONT_FILES);
  const match = assetEntries.find(([filePath]) => {
    const normalizedPath = normalizeToken(filePath);
    return alias.matchTokens.some((token) => normalizedPath.includes(token));
  });
  return match?.[1] ?? null;
}

function buildFontFaceCss(): string {
  const rules = LOCAL_FONT_ALIASES.flatMap((alias) => {
    const url = findLocalFontAsset(alias);
    if (!url) return [];
    const format = inferFontFormat(url);
    const formatFragment = format ? ` format("${format}")` : "";
    return [
      `@font-face{font-family:${quoteFamily(alias.family)};src:url("${url}")${formatFragment};font-style:${alias.fontStyle ?? "normal"};font-weight:${alias.fontWeight ?? 400};font-display:swap;}`,
    ];
  });

  return rules.join("");
}

const FONT_FACE_STYLE_ID = "dasti-local-font-faces";
let fontFacesInjected = false;

export function ensureLocalFontFacesLoaded(): void {
  if (fontFacesInjected || typeof document === "undefined") {
    return;
  }

  const css = buildFontFaceCss();
  if (!css) {
    fontFacesInjected = true;
    return;
  }

  const existingTag = document.getElementById(FONT_FACE_STYLE_ID);
  if (existingTag) {
    fontFacesInjected = true;
    return;
  }

  const styleTag = document.createElement("style");
  styleTag.id = FONT_FACE_STYLE_ID;
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
  fontFacesInjected = true;
}

export function resolveVerbatiFontPairId(
  value: unknown,
): VerbatiFontPairId {
  if (typeof value !== "string") {
    return LEGACY_TO_FONT_PAIR_ID.signature;
  }

  if ((FONT_PAIR_IDS as readonly string[]).includes(value)) {
    return value as VerbatiFontPairId;
  }

  if (value in LEGACY_TO_FONT_PAIR_ID) {
    return LEGACY_TO_FONT_PAIR_ID[value as LegacyVerbatiTypographyPreset];
  }

  return LEGACY_TO_FONT_PAIR_ID.signature;
}

export const VERBATI_FONT_PAIR_OPTIONS: VerbatiFontPairOption[] = [
  {
    id: "quiet-editorial",
    name: "Quiet Editorial",
    description: "Fraunces Bold heading over Geist for a calm premium baseline.",
    headingFamily: buildFamilyStack("Fraunces", "Georgia, serif"),
    bodyFamily: buildFamilyStack("Geist", "system-ui, sans-serif"),
    headingLabel: "Fraunces Bold",
    bodyLabel: "Geist",
  },
  {
    id: "ledger-sans",
    name: "Ledger Sans",
    description: "Hepta Slab headlines with Geist body copy for restrained structure.",
    headingFamily: buildFamilyStack("Hepta Slab", "Georgia, serif"),
    bodyFamily: buildFamilyStack("Geist", "system-ui, sans-serif"),
    headingLabel: "Hepta Slab",
    bodyLabel: "Geist",
  },
  {
    id: "mono-signal",
    name: "Mono Signal",
    description: "Sono display with Geist body text for technical, compact output.",
    headingFamily: buildFamilyStack("Sono", '"IBM Plex Mono", Menlo, monospace'),
    bodyFamily: buildFamilyStack("Geist", "system-ui, sans-serif"),
    headingLabel: "Sono",
    bodyLabel: "Geist",
  },
  {
    id: "studio-grotesk",
    name: "Studio Grotesk",
    description: "Syne headlines and Bricolage Grotesque body text for design-led work.",
    headingFamily: buildFamilyStack("Syne", '"Avenir Next", system-ui, sans-serif'),
    bodyFamily: buildFamilyStack("Bricolage Grotesque", "system-ui, sans-serif"),
    headingLabel: "Syne",
    bodyLabel: "Bricolage Grotesque",
  },
  {
    id: "soft-serif",
    name: "Soft Serif",
    description: "BioRhyme display with Geist body text for warmer editorial applications.",
    headingFamily: buildFamilyStack("BioRhyme", "Georgia, serif"),
    bodyFamily: buildFamilyStack("Geist", "system-ui, sans-serif"),
    headingLabel: "BioRhyme",
    bodyLabel: "Geist",
  },
  {
    id: "special-correspondence",
    name: "Special Correspondence",
    description: "Special Elite accent headings with Geist body text for crafted letters.",
    headingFamily: buildFamilyStack("Special Elite", '"Courier New", monospace'),
    bodyFamily: buildFamilyStack("Geist", "system-ui, sans-serif"),
    headingLabel: "Special Elite",
    bodyLabel: "Geist",
  },
  {
    id: "poster-accent",
    name: "Poster Accent",
    description: "Permanent Marker display with Bricolage Grotesque body text for expressive roles.",
    headingFamily: buildFamilyStack("Permanent Marker", '"Bradley Hand", cursive'),
    bodyFamily: buildFamilyStack("Bricolage Grotesque", "system-ui, sans-serif"),
    headingLabel: "Permanent Marker",
    bodyLabel: "Bricolage Grotesque",
  },
  {
    id: "high-contrast-editorial",
    name: "High Contrast Editorial",
    description: "Fraunces Bold headlines with Sono body text for dramatic, concise layouts.",
    headingFamily: buildFamilyStack("Fraunces", "Georgia, serif"),
    bodyFamily: buildFamilyStack("Sono", '"IBM Plex Mono", Menlo, monospace'),
    headingLabel: "Fraunces Bold",
    bodyLabel: "Sono",
  },
];

export function getVerbatiFontPairOption(
  value: VerbatiTypographyPreset | null | undefined,
): VerbatiFontPairOption {
  const resolvedId = resolveVerbatiFontPairId(value);
  return (
    VERBATI_FONT_PAIR_OPTIONS.find((option) => option.id === resolvedId) ??
    VERBATI_FONT_PAIR_OPTIONS[0]
  );
}

export function getVerbatiFontPairLabel(
  value: VerbatiTypographyPreset | null | undefined,
): string {
  return getVerbatiFontPairOption(value).name;
}
