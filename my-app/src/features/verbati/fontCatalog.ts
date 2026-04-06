type FontAssetRecord = Record<string, string>;

export const LOCAL_FONT_DIRECTORY_HINT = "src/assets/fonts";

export const FONT_PAIR_IDS = [
  "quiet-editorial",
  "civic-correspondence",
  "ledger-sans",
  "mono-signal",
  "studio-grotesk",
  "soft-serif",
  "special-correspondence",
  "poster-accent",
  "high-contrast-editorial",
  "bricolage-hepta",
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
  { family: "Fraunces Bold", matchTokens: ["fraunces"], fontWeight: 700 },
  { family: "Syne Regular", matchTokens: ["syne"], fontWeight: 400 },
  {
    family: "Thestral Neue",
    matchTokens: ["thestralneue", "thestral-neue"],
    fontWeight: 700,
  },
  {
    family: "BioRhyme Light",
    matchTokens: ["biorhyme", "bio-rhyme"],
    fontWeight: 300,
  },
  {
    family: "Special Elite",
    matchTokens: ["specialelite", "special-elite"],
    fontWeight: 400,
  },
  {
    family: "Courier Prime",
    matchTokens: ["courierprime", "courier-prime"],
    fontWeight: 400,
  },
  { family: "Archivo", matchTokens: ["archivo"], fontWeight: 400 },
  { family: "Parisienne", matchTokens: ["parisienne"], fontWeight: 400 },
  { family: "Cormorant", matchTokens: ["cormorant"], fontWeight: 400 },
  { family: "Bonbance", matchTokens: ["bonbance"], fontWeight: 700 },
  { family: "Geist", matchTokens: ["geist"], fontWeight: 400 },
  {
    family: "Grave Presse",
    matchTokens: ["gravepresse", "grave-presse", "gravepress"],
    fontWeight: 800,
  },
  { family: "Borel", matchTokens: ["borel"], fontWeight: 400 },
  {
    family: "Algo",
    matchTokens: ["algofy", "tryalgofy", "algofy", "algo"],
    fontWeight: 400,
  },
  {
    family: "Hepta Slab Regular",
    matchTokens: ["heptaslab", "hepta-slab"],
    fontWeight: 400,
  },
  {
    family: "Bricolage Bold",
    matchTokens: ["bricolagegrotesque", "bricologegrotesque", "bricolage-grotesque"],
    fontWeight: 700,
  },
  { family: "Sono Light", matchTokens: ["sono"], fontWeight: 300 },
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
    description: "Fraunces Bold heading over Syne Regular for a crisp serif-to-grotesk transition.",
    headingFamily: buildFamilyStack("Fraunces Bold", "Georgia, serif"),
    bodyFamily: buildFamilyStack("Syne Regular", '"Avenir Next", system-ui, sans-serif'),
    headingLabel: "Fraunces Bold",
    bodyLabel: "Syne Regular",
  },
  {
    id: "civic-correspondence",
    name: "Civic Correspondence",
    description:
      "Thestral Neue headlines over BioRhyme Light for a dramatic poster-letter cadence.",
    headingFamily: buildFamilyStack("Thestral Neue", '"Helvetica Neue", Helvetica, Arial, sans-serif'),
    bodyFamily: buildFamilyStack("BioRhyme Light", 'Georgia, "Times New Roman", serif'),
    headingLabel: "Thestral Neue",
    bodyLabel: "BioRhyme Light",
  },
  {
    id: "ledger-sans",
    name: "Ledger Sans",
    description: "Special Elite headings with Courier Prime body copy for a typewritten document voice.",
    headingFamily: buildFamilyStack("Special Elite", '"Courier New", monospace'),
    bodyFamily: buildFamilyStack("Courier Prime", '"Courier New", monospace'),
    headingLabel: "Special Elite",
    bodyLabel: "Courier Prime",
  },
  {
    id: "mono-signal",
    name: "Mono Signal",
    description: "Archivo over Archivo for a restrained mono-family register when the font is available locally.",
    headingFamily: buildFamilyStack("Archivo", '"Helvetica Neue", Helvetica, Arial, sans-serif'),
    bodyFamily: buildFamilyStack("Archivo", '"Helvetica Neue", Helvetica, Arial, sans-serif'),
    headingLabel: "Archivo",
    bodyLabel: "Archivo",
  },
  {
    id: "studio-grotesk",
    name: "Studio Grotesk",
    description: "Parisienne headings over Cormorant for a calligraphic editorial treatment.",
    headingFamily: buildFamilyStack("Parisienne", '"Snell Roundhand", cursive'),
    bodyFamily: buildFamilyStack("Cormorant", 'Georgia, "Times New Roman", serif'),
    headingLabel: "Parisienne",
    bodyLabel: "Cormorant",
  },
  {
    id: "soft-serif",
    name: "Soft Serif",
    description: "Bonbance display with Geist body text for a condensed-fashion contrast.",
    headingFamily: buildFamilyStack("Bonbance", 'Impact, "Arial Narrow", sans-serif'),
    bodyFamily: buildFamilyStack("Geist", "system-ui, sans-serif"),
    headingLabel: "Bonbance",
    bodyLabel: "Geist",
  },
  {
    id: "special-correspondence",
    name: "Special Correspondence",
    description: "Grave Presse headings with Borel body text for an expressive poster-script collision.",
    headingFamily: buildFamilyStack("Grave Presse", 'Impact, "Arial Black", sans-serif'),
    bodyFamily: buildFamilyStack("Borel", '"Brush Script MT", cursive'),
    headingLabel: "Grave Presse",
    bodyLabel: "Borel",
  },
  {
    id: "poster-accent",
    name: "Poster Accent",
    description: "Algo display with Hepta Slab Regular body copy for a shaped editorial masthead.",
    headingFamily: buildFamilyStack("Algo", '"Arial Rounded MT Bold", system-ui, sans-serif'),
    bodyFamily: buildFamilyStack("Hepta Slab Regular", 'Georgia, "Times New Roman", serif'),
    headingLabel: "Algo",
    bodyLabel: "Hepta Slab Regular",
  },
  {
    id: "high-contrast-editorial",
    name: "High Contrast Editorial",
    description: "Bricolage Bold display with Sono Light body text for a contemporary grotesk-mono mix.",
    headingFamily: buildFamilyStack("Bricolage Bold", '"Avenir Next", system-ui, sans-serif'),
    bodyFamily: buildFamilyStack("Sono Light", '"IBM Plex Mono", Menlo, monospace'),
    headingLabel: "Bricolage Bold",
    bodyLabel: "Sono Light",
  },
  {
    id: "bricolage-hepta",
    name: "Bricolage Hepta",
    description: "Bricolage Bold headings with Hepta Slab Regular body text for a sharper serif counterpoint.",
    headingFamily: buildFamilyStack("Bricolage Bold", '"Avenir Next", system-ui, sans-serif'),
    bodyFamily: buildFamilyStack("Hepta Slab Regular", 'Georgia, "Times New Roman", serif'),
    headingLabel: "Bricolage Bold",
    bodyLabel: "Hepta Slab Regular",
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
