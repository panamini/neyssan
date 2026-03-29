export const PROPOSAL_STYLE_TOOLBAR_PRESET_IDS = [
  "minimal",
  "rounded",
  "editorial",
  "bold",
] as const;

export type VerbatiStyleBundleId =
  (typeof PROPOSAL_STYLE_TOOLBAR_PRESET_IDS)[number];
export type ProposalStyleToolbarPresetId = VerbatiStyleBundleId;

export type ProposalStylePaletteHint =
  | "sauge"
  | "ocre"
  | "pierre"
  | "bordeaux"
  | "encre";

export type VerbatiLayoutHint =
  | "swiss"
  | "two-column"
  | "editorial"
  | "modernist"
  | "quire";

export type VerbatiTypographyHint =
  | "signature"
  | "engaging"
  | "expert";

export type ProposalStyleSuggestion = {
  bundleId: VerbatiStyleBundleId;
  overrides: {
    layout?: VerbatiLayoutHint;
    typography?: VerbatiTypographyHint;
    palette?: ProposalStylePaletteHint;
  };
  matchedKeywords: string[];
};

type KeywordScoreMap = Record<VerbatiStyleBundleId, number>;

const STYLE_KEYWORDS: Record<VerbatiStyleBundleId, readonly string[]> = {
  minimal: [
    "minimal",
    "clean",
    "simple",
    "swiss",
    "structured",
    "plain",
    "restrained",
  ],
  rounded: [
    "rounded",
    "soft",
    "friendly",
    "approachable",
    "gentle",
    "curved",
    "calm",
  ],
  editorial: [
    "editorial",
    "magazine",
    "serif",
    "reading",
    "luxury",
    "elegant",
    "publication",
  ],
  bold: [
    "bold",
    "strong",
    "impact",
    "contrast",
    "black",
    "graphic",
    "sharp",
  ],
};

const PALETTE_KEYWORDS: Record<ProposalStylePaletteHint, readonly string[]> = {
  sauge: ["green", "sage", "natural", "olive"],
  ocre: ["ochre", "ocre", "gold", "warm", "sand", "amber"],
  pierre: ["stone", "gray", "grey", "slate", "neutral"],
  bordeaux: ["bordeaux", "wine", "red", "burgundy"],
  encre: ["ink", "black", "navy", "charcoal", "dark"],
};

const LAYOUT_KEYWORDS: Record<VerbatiLayoutHint, readonly string[]> = {
  swiss: ["swiss", "grid", "structured"],
  "two-column": ["two column", "two-column", "sidebar", "split"],
  editorial: ["editorial", "magazine", "reading", "publication"],
  modernist: ["modernist", "minimal", "clean", "signal"],
  quire: ["quire", "literary", "bookish", "mono dates"],
};

const TYPOGRAPHY_KEYWORDS: Record<VerbatiTypographyHint, readonly string[]> = {
  signature: ["signature", "fraunces", "calm sans", "classic"],
  engaging: ["serif", "editorial serif", "reading", "literary"],
  expert: ["mono", "monospace", "utility", "technical"],
};

function normalizeStyleDescription(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

export function suggestProposalStyleFromDescription(
  description: string | null | undefined,
): ProposalStyleSuggestion {
  const normalized = normalizeStyleDescription(description);
  const matchedKeywords: string[] = [];
  const scores: KeywordScoreMap = {
    minimal: 0,
    rounded: 0,
    editorial: 0,
    bold: 0,
  };

  for (const presetId of PROPOSAL_STYLE_TOOLBAR_PRESET_IDS) {
    for (const keyword of STYLE_KEYWORDS[presetId]) {
      if (normalized.includes(keyword)) {
        scores[presetId] += 1;
        matchedKeywords.push(keyword);
      }
    }
  }

  const bundleId =
    PROPOSAL_STYLE_TOOLBAR_PRESET_IDS.reduce(
      (best, presetId) =>
        scores[presetId] > scores[best] ? presetId : best,
      "minimal" as VerbatiStyleBundleId,
    ) ?? "minimal";

  let paletteHint: ProposalStylePaletteHint | undefined;
  let paletteScore = 0;

  for (const [palette, keywords] of Object.entries(PALETTE_KEYWORDS) as Array<
    [ProposalStylePaletteHint, readonly string[]]
  >) {
    const score = keywords.filter((keyword) => normalized.includes(keyword)).length;
    if (score > paletteScore) {
      paletteScore = score;
      paletteHint = palette;
    }
  }

  let layoutHint: VerbatiLayoutHint | undefined;
  let layoutScore = 0;

  for (const [layout, keywords] of Object.entries(LAYOUT_KEYWORDS) as Array<
    [VerbatiLayoutHint, readonly string[]]
  >) {
    const score = keywords.filter((keyword) => normalized.includes(keyword)).length;
    if (score > layoutScore) {
      layoutScore = score;
      layoutHint = layout;
    }
  }

  let typographyHint: VerbatiTypographyHint | undefined;
  let typographyScore = 0;

  for (const [typography, keywords] of Object.entries(
    TYPOGRAPHY_KEYWORDS,
  ) as Array<[VerbatiTypographyHint, readonly string[]]>) {
    const score = keywords.filter((keyword) => normalized.includes(keyword)).length;
    if (score > typographyScore) {
      typographyScore = score;
      typographyHint = typography;
    }
  }

  return {
    bundleId,
    overrides: {
      layout: layoutHint,
      typography: typographyHint,
      palette: paletteHint,
    },
    matchedKeywords: Array.from(new Set(matchedKeywords)),
  };
}
