import type React from "react";
import type { CvDocument } from "../../types/cvDocument";
import type { ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type { ResumeLayoutVariantId } from "./resume/resume.types";
import {
  getVerbatiFontPairLabel,
  resolveVerbatiFontPairId,
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
    id: "two-column",
    name: "Two Column",
    description: "Robial split layout with the accent rail sidebar.",
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

const DEFERRED_LAYOUT_REMAPPINGS: Record<VerbatiLayoutPreset, VerbatiLayoutPreset> = {
  swiss: "swiss",
  "volk-register": "swiss",
  "two-column": "two-column",
  editorial: "two-column",
  modernist: "two-column",
  quire: "two-column",
};

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

  return resolveVerbatiStyle(candidate);
}

export function resolveVerbatiStyle(
  candidate: Partial<VerbatiStylePreset> | null | undefined,
): VerbatiStylePreset {
  const safeCandidate = candidate ?? {};

  const paletteOption =
    safeCandidate.palette &&
    (safeCandidate.palette === "custom" ||
      VERBATI_PALETTE_OPTIONS.some(
        (option) => option.id === safeCandidate.palette,
      ))
      ? safeCandidate.palette
      : DEFAULT_VERBATI_STYLE.palette;

  const requestedLayout =
    typeof safeCandidate.layout === "string"
      ? LEGACY_LAYOUT_ALIASES[safeCandidate.layout] ?? safeCandidate.layout
      : null;
  const normalizedRequestedLayout =
    requestedLayout &&
    requestedLayout in DEFERRED_LAYOUT_REMAPPINGS
      ? DEFERRED_LAYOUT_REMAPPINGS[requestedLayout as VerbatiLayoutPreset]
      : null;

  const layout =
    normalizedRequestedLayout &&
    VERBATI_LAYOUT_OPTIONS.some(
      (option) => option.id === normalizedRequestedLayout,
    )
      ? normalizedRequestedLayout
      : DEFAULT_VERBATI_STYLE.layout;

  const typography = resolveVerbatiFontPairId(safeCandidate.typography);

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
  return {
    layout: style.layout,
    typography: resolveVerbatiFontPairId(style.typography),
    palette: style.palette,
    accentHex:
      style.palette === "custom"
        ? normalizeVerbatiAccentHex(style.accentHex)
        : undefined,
  };
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
