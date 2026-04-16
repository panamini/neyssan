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
  "nunito-ortica",
  "nunito-code",
  "doto-code",
] as const;

export type VerbatiFontPairId = (typeof FONT_PAIR_IDS)[number];
export type LegacyVerbatiTypographyPreset =
  | "signature"
  | "engaging"
  | "expert";

export type VerbatiTypographyPreset =
  | VerbatiFontPairId
  | LegacyVerbatiTypographyPreset;

type FontWeightValue = number | `${number} ${number}`;

type LocalFontFace = {
  family: string;
  matchTokens: string[];
  excludeTokens?: string[];
  fontStyle: "normal" | "italic";
  fontWeight: FontWeightValue;
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

const LOCAL_FONT_FACES: LocalFontFace[] = [
  {
    family: "Fraunces",
    matchTokens: ["fraunces", "variablefont", "soft", "wonk"],
    excludeTokens: ["italic"],
    fontStyle: "normal",
    fontWeight: "100 900",
  },
  {
    family: "Fraunces",
    matchTokens: ["fraunces", "italic", "variablefont", "soft", "wonk"],
    fontStyle: "italic",
    fontWeight: "100 900",
  },
  {
    family: "Syne",
    matchTokens: ["syne", "variablefont", "wght"],
    fontStyle: "normal",
    fontWeight: "400 800",
  },
  {
    family: "Thestral Neue",
    matchTokens: ["thestralneue", "bold"],
    fontStyle: "normal",
    fontWeight: 700,
  },
  {
    family: "BioRhyme",
    matchTokens: ["biorhyme", "variablefont"],
    fontStyle: "normal",
    fontWeight: "200 800",
  },
  {
    family: "Special Elite",
    matchTokens: ["specialelite", "regular"],
    fontStyle: "normal",
    fontWeight: 400,
  },
  {
    family: "Courier Prime",
    matchTokens: ["courierprime", "regular"],
    fontStyle: "normal",
    fontWeight: 400,
  },
  {
    family: "Courier Prime",
    matchTokens: ["courierprime", "italic"],
    excludeTokens: ["bold"],
    fontStyle: "italic",
    fontWeight: 400,
  },
  {
    family: "Courier Prime",
    matchTokens: ["courierprime", "bold"],
    excludeTokens: ["italic"],
    fontStyle: "normal",
    fontWeight: 700,
  },
  {
    family: "Courier Prime",
    matchTokens: ["courierprime", "bolditalic"],
    fontStyle: "italic",
    fontWeight: 700,
  },
  {
    family: "Archivo",
    matchTokens: ["archivo", "variablefont", "wdth", "wght"],
    excludeTokens: ["italic"],
    fontStyle: "normal",
    fontWeight: "100 900",
  },
  {
    family: "Archivo",
    matchTokens: ["archivo", "italic", "variablefont", "wdth", "wght"],
    fontStyle: "italic",
    fontWeight: "100 900",
  },
  {
    family: "Parisienne",
    matchTokens: ["parisienne", "regular"],
    fontStyle: "normal",
    fontWeight: 400,
  },
  {
    family: "Cormorant",
    matchTokens: ["cormorant", "variablefont", "wght"],
    excludeTokens: ["italic"],
    fontStyle: "normal",
    fontWeight: "300 700",
  },
  {
    family: "Cormorant",
    matchTokens: ["cormorant", "italic", "variablefont", "wght"],
    fontStyle: "italic",
    fontWeight: "300 700",
  },
  {
    family: "Bonbance",
    matchTokens: ["bonbance", "boldcondensed"],
    fontStyle: "normal",
    fontWeight: 700,
  },
  {
    family: "Geist",
    matchTokens: ["geist", "variablefont", "wght"],
    fontStyle: "normal",
    fontWeight: "100 900",
  },
  {
    family: "Grave Presse",
    matchTokens: ["gravepresse", "extrabold"],
    fontStyle: "normal",
    fontWeight: 800,
  },
  {
    family: "Borel",
    matchTokens: ["borel", "regular"],
    fontStyle: "normal",
    fontWeight: 400,
  },
  {
    family: "Algo",
    matchTokens: ["algofy", "regular"],
    fontStyle: "normal",
    fontWeight: 400,
  },
  {
    family: "Hepta Slab",
    matchTokens: ["heptaslab", "light"],
    fontStyle: "normal",
    fontWeight: 300,
  },
  {
    family: "Hepta Slab",
    matchTokens: ["heptaslab", "regular"],
    fontStyle: "normal",
    fontWeight: 400,
  },
  {
    family: "Hepta Slab",
    matchTokens: ["heptaslab", "bold"],
    fontStyle: "normal",
    fontWeight: 700,
  },
  {
    family: "Bricolage Grotesque",
    matchTokens: ["bricolagegrotesque", "variablefont"],
    fontStyle: "normal",
    fontWeight: "200 800",
  },
  {
    family: "Sono",
    matchTokens: ["sono", "mono", "wght"],
    fontStyle: "normal",
    fontWeight: "200 800",
  },
  {
    family: "Nunito Sans",
    matchTokens: ["nunitosans", "variablefont", "wdth", "wght"],
    excludeTokens: ["italic"],
    fontStyle: "normal",
    fontWeight: "200 1000",
  },
  {
    family: "Nunito Sans",
    matchTokens: ["nunitosans", "italic", "variablefont", "wdth", "wght"],
    fontStyle: "italic",
    fontWeight: "200 1000",
  },
  {
    family: "Ortica",
    matchTokens: ["orticalinear", "light"],
    fontStyle: "normal",
    fontWeight: 300,
  },
  {
    family: "Ortica",
    matchTokens: ["orticalinear", "regular"],
    fontStyle: "normal",
    fontWeight: 400,
  },
  {
    family: "Ortica",
    matchTokens: ["orticalinear", "bold"],
    fontStyle: "normal",
    fontWeight: 700,
  },
  {
    family: "Source Code Pro",
    matchTokens: ["sourcecodepro", "variablefont", "wght"],
    excludeTokens: ["italic"],
    fontStyle: "normal",
    fontWeight: "200 900",
  },
  {
    family: "Source Code Pro",
    matchTokens: ["sourcecodepro", "italic", "variablefont", "wght"],
    fontStyle: "italic",
    fontWeight: "200 900",
  },
  {
    family: "Doto",
    matchTokens: ["doto", "variablefont", "rond", "wght"],
    fontStyle: "normal",
    fontWeight: "100 900",
  },
];

const LOCAL_FONT_FILES =
  typeof window !== "undefined"
    ? (import.meta.glob("../../assets/fonts/**/*.{woff,woff2,ttf,otf}", {
        eager: true,
        import: "default",
        query: "?url",
      }) as FontAssetRecord)
    : ({} as FontAssetRecord);

const LEGACY_TO_FONT_PAIR_ID: Record<
  LegacyVerbatiTypographyPreset,
  VerbatiFontPairId
> = {
  signature: "quiet-editorial",
  engaging: "soft-serif",
  expert: "mono-signal",
};

export function sanitizePersistedVerbatiFontPairId(
  value: unknown,
): VerbatiFontPairId | null {
  if (typeof value !== "string") {
    return null;
  }

  if ((FONT_PAIR_IDS as readonly string[]).includes(value)) {
    return value as VerbatiFontPairId;
  }

  if (value in LEGACY_TO_FONT_PAIR_ID) {
    return LEGACY_TO_FONT_PAIR_ID[value as LegacyVerbatiTypographyPreset];
  }

  return null;
}

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

function findLocalFontAsset(face: LocalFontFace): string | null {
  const assetEntries = Object.entries(LOCAL_FONT_FILES);
  const match = assetEntries.find(([filePath]) => {
    const normalizedPath = normalizeToken(filePath);
    const includesTokens = face.matchTokens.every((token) =>
      normalizedPath.includes(normalizeToken(token)),
    );
    const excludesTokens = (face.excludeTokens ?? []).some((token) =>
      normalizedPath.includes(normalizeToken(token)),
    );
    return includesTokens && !excludesTokens;
  });
  return match?.[1] ?? null;
}

function buildFontFaceCss(): string {
  const rules = LOCAL_FONT_FACES.flatMap((face) => {
    const url = findLocalFontAsset(face);
    if (!url) return [];
    const format = inferFontFormat(url);
    const formatFragment = format ? ` format("${format}")` : "";
    return [
      `@font-face{font-family:${quoteFamily(face.family)};src:url("${url}")${formatFragment};font-style:${face.fontStyle};font-weight:${face.fontWeight};font-display:swap;}`,
    ];
  });

  return rules.join("");
}

const FONT_FACE_STYLE_ID = "dasti-local-font-faces";
let fontFacesInjected = false;

export function ensureLocalFontFacesLoaded(): void {
  if (typeof document === "undefined") {
    return;
  }

  const existingTag = document.getElementById(FONT_FACE_STYLE_ID);
  if (fontFacesInjected && existingTag) {
    return;
  }

  const css = buildFontFaceCss();
  if (!css) {
    return;
  }

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
  return (
    sanitizePersistedVerbatiFontPairId(value) ??
    LEGACY_TO_FONT_PAIR_ID.signature
  );
}

export const VERBATI_FONT_PAIR_OPTIONS: VerbatiFontPairOption[] = [
  {
    id: "quiet-editorial",
    name: "Quiet Editorial",
    description: "Fraunces Bold heading over Syne Regular for a crisp serif-to-grotesk transition.",
    headingFamily: buildFamilyStack("Fraunces", "Georgia, serif"),
    bodyFamily: buildFamilyStack("Syne", '"Avenir Next", system-ui, sans-serif'),
    headingLabel: "Fraunces Bold",
    bodyLabel: "Syne Regular",
  },
  {
    id: "civic-correspondence",
    name: "Civic Correspondence",
    description:
      "Thestral Neue headlines over BioRhyme Light for a dramatic poster-letter cadence.",
    headingFamily: buildFamilyStack("Thestral Neue", '"Helvetica Neue", Helvetica, Arial, sans-serif'),
    bodyFamily: buildFamilyStack("BioRhyme", 'Georgia, "Times New Roman", serif'),
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
    description: "Archivo over Archivo for a restrained mono-family register.",
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
    bodyFamily: buildFamilyStack("Hepta Slab", 'Georgia, "Times New Roman", serif'),
    headingLabel: "Algo",
    bodyLabel: "Hepta Slab Regular",
  },
  {
    id: "high-contrast-editorial",
    name: "High Contrast Editorial",
    description: "Bricolage Bold display with Sono Light body text for a contemporary grotesk-mono mix.",
    headingFamily: buildFamilyStack("Bricolage Grotesque", '"Avenir Next", system-ui, sans-serif'),
    bodyFamily: buildFamilyStack("Sono", '"IBM Plex Mono", Menlo, monospace'),
    headingLabel: "Bricolage Bold",
    bodyLabel: "Sono Light",
  },
  {
    id: "bricolage-hepta",
    name: "Bricolage Hepta",
    description: "Bricolage Bold headings with Hepta Slab Regular body text for a sharper serif counterpoint.",
    headingFamily: buildFamilyStack("Bricolage Grotesque", '"Avenir Next", system-ui, sans-serif'),
    bodyFamily: buildFamilyStack("Hepta Slab", 'Georgia, "Times New Roman", serif'),
    headingLabel: "Bricolage Bold",
    bodyLabel: "Hepta Slab Regular",
  },
  {
    id: "nunito-ortica",
    name: "Nunito Ortica",
    description: "Nunito ExtraBold headlines with Ortica body text for a soft-modern contrast.",
    headingFamily: buildFamilyStack("Nunito Sans", "system-ui, sans-serif"),
    bodyFamily: buildFamilyStack("Ortica", 'Georgia, "Times New Roman", serif'),
    headingLabel: "Nunito ExtraBold",
    bodyLabel: "Ortica",
  },
  {
    id: "nunito-code",
    name: "Nunito Code",
    description: "Nunito ExtraBold headlines with Source Code Pro Regular for a humane mono contrast.",
    headingFamily: buildFamilyStack("Nunito Sans", "system-ui, sans-serif"),
    bodyFamily: buildFamilyStack("Source Code Pro", '"IBM Plex Mono", Menlo, monospace'),
    headingLabel: "Nunito ExtraBold",
    bodyLabel: "Source Code Pro Regular",
  },
  {
    id: "doto-code",
    name: "Doto Code",
    description: "Doto Black headlines with Source Code Pro Regular for a sharper technical display.",
    headingFamily: buildFamilyStack("Doto", "system-ui, sans-serif"),
    bodyFamily: buildFamilyStack("Source Code Pro", '"IBM Plex Mono", Menlo, monospace'),
    headingLabel: "Doto Black",
    bodyLabel: "Source Code Pro Regular",
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
