import type React from "react";
import type { CvDocument } from "../../types/cvDocument";
import type { ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type { ResumeLayoutVariantId } from "./resume/resume.types";
import {
  getVerbatiFontPairLabel,
  sanitizePersistedVerbatiFontPairId,
  VERBATI_FONT_PAIR_OPTIONS,
  type VerbatiFontPairOption,
} from "./fontCatalog";
import {
  VERBATI_PALETTE_OPTIONS,
  normalizeVerbatiAccentHex,
  resolvePreviewCanonicalAppearance,
  resolveVerbatiAccentHex as resolveCanonicalAccentHex,
  resolveVerbatiTypographyFamilies,
  serializeProposalDocumentThemeVars,
  serializeVerbatiThemeVars,
  type VerbatiPaletteOption,
} from "../../lib/layout/documentAppearance";
import type {
  VerbatiLayoutPreset,
  VerbatiStylePreset,
  VerbatiTypographyPreset,
} from "./types";

type LayoutOption = {
  id: VerbatiLayoutPreset;
  name: string;
  description: string;
};

type TypographyOption = VerbatiFontPairOption;

export const DEFAULT_VERBATI_STYLE: VerbatiStylePreset = {
  layout: "swiss",
  typography: "quiet-editorial",
  palette: "sauge",
};

export const VERBATI_LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: "swiss",
    name: "Swiss Minima",
    description:
      "Swiss register typography built on a Robial 17/18 modular field.",
  },
  {
    id: "volk-register",
    name: "Volk Register",
    description: "Archival civic register with a quieter, slower field.",
  },
  {
    id: "two-column",
    name: "Two Column",
    description: "Robial split layout with the accent rail sidebar.",
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Editorial split layout with a broader, calmer rhythm.",
  },
  {
    id: "modernist",
    name: "Modernist",
    description: "Sharper split layout with a stricter signal-heavy cadence.",
  },
  {
    id: "quire",
    name: "Quire",
    description: "Bookish split layout with quieter literary spacing.",
  },
];

export const VERBATI_TYPOGRAPHY_OPTIONS: TypographyOption[] = [
  ...VERBATI_FONT_PAIR_OPTIONS,
];

export { VERBATI_PALETTE_OPTIONS };
export type { VerbatiPaletteOption };

export const VERBATI_LAYOUT_TO_RENDERER: Record<
  VerbatiLayoutPreset,
  ResumeLayoutVariantId
> = {
  swiss: "swissminima",
  "volk-register": "swissminima",
  "two-column": "robial",
  editorial: "robial",
  modernist: "robial",
  quire: "robial",
};

export const VERBATI_LAYOUT_TO_PROPOSAL_TEMPLATE: Record<
  VerbatiLayoutPreset,
  ProposalTemplateId
> = {
  swiss: "swiss_margin",
  "volk-register": "swiss_margin",
  "two-column": "two_column_rail",
  editorial: "two_column_rail",
  modernist: "two_column_rail",
  quire: "two_column_rail",
};

const LEGACY_LAYOUT_ALIASES: Record<string, VerbatiLayoutPreset> = {
  "playful-photo": "two-column",
  "soft-ribbon": "two-column",
  "slate-column": "two-column",
};

function sanitizePersistedVerbatiLayout(
  value: unknown,
): VerbatiLayoutPreset | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const normalizedValue = LEGACY_LAYOUT_ALIASES[value] ?? value;
  return VERBATI_LAYOUT_OPTIONS.some((option) => option.id === normalizedValue)
    ? (normalizedValue as VerbatiLayoutPreset)
    : null;
}

function sanitizePersistedVerbatiPalette(
  value: unknown,
): VerbatiStylePreset["palette"] | null {
  if (typeof value !== "string") {
    return null;
  }

  return value === "custom" ||
    VERBATI_PALETTE_OPTIONS.some((option) => option.id === value)
    ? (value as VerbatiStylePreset["palette"])
    : null;
}

export function getLayoutLabel(preset: VerbatiLayoutPreset): string {
  return (
    VERBATI_LAYOUT_OPTIONS.find((option) => option.id === preset)?.name ??
    VERBATI_LAYOUT_OPTIONS[0].name
  );
}

export function getVerbatiStyleFromCv(
  doc: CvDocument | null | undefined,
): VerbatiStylePreset {
  const candidate = (doc?.metadata as Record<string, unknown> | undefined)
    ?.verbatiStyle as Partial<VerbatiStylePreset> | undefined;

  return sanitizePersistedVerbatiStyle(candidate) ?? resolveVerbatiStyle(candidate);
}

export function sanitizePersistedVerbatiStyle(
  candidate: Partial<VerbatiStylePreset> | null | undefined,
): VerbatiStylePreset | null {
  const safeCandidate = candidate ?? {};
  const layout = sanitizePersistedVerbatiLayout(safeCandidate.layout);
  const typography = sanitizePersistedVerbatiFontPairId(safeCandidate.typography);
  const palette = sanitizePersistedVerbatiPalette(safeCandidate.palette);

  if (!layout || !typography || !palette) {
    return null;
  }

  return {
    layout,
    typography,
    palette,
    accentHex:
      palette === "custom"
        ? normalizeVerbatiAccentHex(safeCandidate.accentHex)
        : undefined,
  };
}

export function resolveVerbatiStyle(
  candidate: Partial<VerbatiStylePreset> | null | undefined,
): VerbatiStylePreset {
  const safeCandidate = candidate ?? {};
  const layout =
    sanitizePersistedVerbatiLayout(safeCandidate.layout) ??
    DEFAULT_VERBATI_STYLE.layout;
  const typography =
    sanitizePersistedVerbatiFontPairId(safeCandidate.typography) ??
    DEFAULT_VERBATI_STYLE.typography;
  const paletteOption =
    sanitizePersistedVerbatiPalette(safeCandidate.palette) ??
    DEFAULT_VERBATI_STYLE.palette;

  return {
    layout,
    typography,
    palette: paletteOption,
    accentHex:
      paletteOption === "custom"
        ? normalizeVerbatiAccentHex(safeCandidate.accentHex)
        : undefined,
  };
}

export function resolveVerbatiAccentHex(style: VerbatiStylePreset): string {
  return resolveCanonicalAccentHex(style);
}

export function getVerbatiTypographyFamilies(style: VerbatiStylePreset): {
  headingFamily: string;
  bodyFamily: string;
} {
  return resolveVerbatiTypographyFamilies(style);
}

export function getProposalTwinTemplateId(
  style: VerbatiStylePreset | null | undefined,
): ProposalTemplateId {
  const resolvedStyle = style
    ? resolveVerbatiStyle(style)
    : DEFAULT_VERBATI_STYLE;

  return VERBATI_LAYOUT_TO_PROPOSAL_TEMPLATE[resolvedStyle.layout];
}

export function buildVerbatiThemeVars(
  style: VerbatiStylePreset,
): React.CSSProperties {
  return serializeVerbatiThemeVars(resolvePreviewCanonicalAppearance(style));
}

export function serializeVerbatiStyle(
  style: VerbatiStylePreset,
): VerbatiStylePreset {
  return (
    sanitizePersistedVerbatiStyle(style) ?? {
      layout: DEFAULT_VERBATI_STYLE.layout,
      typography: DEFAULT_VERBATI_STYLE.typography,
      palette: DEFAULT_VERBATI_STYLE.palette,
      accentHex: undefined,
    }
  );
}

export function buildVerbatiProposalDocumentVars(
  style: VerbatiStylePreset,
): React.CSSProperties {
  return serializeProposalDocumentThemeVars(
    resolvePreviewCanonicalAppearance(style),
  );
}

export function stylesEqual(
  left: VerbatiStylePreset,
  right: VerbatiStylePreset,
): boolean {
  const normalizedLeft = serializeVerbatiStyle(left);
  const normalizedRight = serializeVerbatiStyle(right);

  return (
    normalizedLeft.layout === normalizedRight.layout &&
    normalizedLeft.typography === normalizedRight.typography &&
    normalizedLeft.palette === normalizedRight.palette &&
    String(normalizedLeft.accentHex ?? "") ===
      String(normalizedRight.accentHex ?? "")
  );
}

export function getVerbatiTypographyLabel(
  preset: VerbatiTypographyPreset,
): string {
  return getVerbatiFontPairLabel(preset);
}
