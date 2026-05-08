import type React from "react";
import type { CvDocument } from "../../types/cvDocument";
import {
  getFactoryDocumentStyleSlot,
  resolveDocumentStyleSlotId,
} from "../../lib/document-style-slots";
import type { ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type { ResumeLayoutVariantId } from "./resume/resume.types";
import {
  getVerbatiFontPairLabel,
  sanitizePersistedVerbatiFontPairId,
  VERBATI_FONT_PAIR_OPTIONS,
  type VerbatiFontPairOption,
} from "./fontCatalog";
import {
  ALL_VERBATI_PALETTE_OPTIONS,
  VERBATI_PALETTE_OPTIONS,
  normalizeVerbatiAccentHex,
  resolvePreviewCanonicalAppearance,
  resolveVerbatiAccentHex as resolveCanonicalAccentHex,
  resolveVerbatiTypographyFamilies,
  serializeProposalDocumentThemeVars,
  serializeVerbatiThemeVars,
  type VerbatiPaletteOption,
} from "../../lib/layout/documentAppearance";
import {
  getStyleFamilyProposalTemplateId,
  getStyleFamilyResumeTemplateId,
  getStyleFamilyDefinition,
  resolveStyleFamilyFromStyle,
  resolveStyleFamilyId,
  STYLE_FAMILY_DEFINITIONS,
} from "../../lib/layout/styleFamilies";
import type {
  LegacyVerbatiLayoutAlias,
  StyleFamilyId,
  VerbatiLayoutPreset,
  VerbatiStylePreset,
  VerbatiTypographyPreset,
} from "./types";
import {
  isWorkshopResumeTemplateId,
  type ResumeTemplateId,
} from "../../lib/layout/resumeTemplates";

type LayoutOption = {
  id: StyleFamilyId;
  name: string;
  description: string;
  resumeTemplateId?: ResumeTemplateId;
};

type TypographyOption = VerbatiFontPairOption;
type VerbatiStyleInput =
  | Partial<VerbatiStylePreset>
  | Record<string, unknown>
  | null
  | undefined;

export const DEFAULT_VERBATI_STYLE: VerbatiStylePreset = {
  familyId: "workshop",
  layout: "workshop",
  typography: "geist-baskervville",
  palette: "sauge",
};

const ACTIVE_VERBATI_LAYOUT_FAMILIES = new Set<StyleFamilyId>(["workshop"]);

export const VERBATI_LAYOUT_OPTIONS: LayoutOption[] = [
  ...STYLE_FAMILY_DEFINITIONS.map((family) => ({
    id: family.id,
    name: family.label,
    description: family.description,
    resumeTemplateId: family.resumeTemplateId,
  })).filter((option) => ACTIVE_VERBATI_LAYOUT_FAMILIES.has(option.id)),
  {
    id: "workshop",
    name: "Workshop two-column",
    description: "Workshop ATS layout with a 17/18-inspired two-column grid.",
    resumeTemplateId: "workshop_resume_twocol_ats",
  },
];

export const VERBATI_TYPOGRAPHY_OPTIONS: TypographyOption[] = [
  ...VERBATI_FONT_PAIR_OPTIONS,
];

export { VERBATI_PALETTE_OPTIONS };
export type { VerbatiPaletteOption };

const LEGACY_VERBATI_LAYOUT_TO_RENDERER: Record<
  Exclude<StyleFamilyId, "workshop">,
  ResumeLayoutVariantId
> = {
  swiss: "swissminima",
  "volk-register": "swissminima",
  "two-column": "robial",
  editorial: "robial",
  modernist: "robial",
  quire: "robial",
};

// Legacy-only compatibility map. Family/template identity is canonical in PR1,
// but workshop must continue to render through the existing legacy-safe path.
export const VERBATI_LAYOUT_TO_RENDERER: Record<
  VerbatiLayoutPreset,
  ResumeLayoutVariantId
> = {
  ...LEGACY_VERBATI_LAYOUT_TO_RENDERER,
  workshop: "swissminima",
  "playful-photo": "robial",
  "soft-ribbon": "robial",
  "slate-column": "robial",
};

const LEGACY_LAYOUT_ALIASES: Record<
  LegacyVerbatiLayoutAlias,
  Extract<StyleFamilyId, "two-column">
> = {
  "playful-photo": "two-column",
  "soft-ribbon": "two-column",
  "slate-column": "two-column",
};

function sanitizePersistedVerbatiFamilyId(
  value: unknown,
): StyleFamilyId | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const normalizedValue =
    value in LEGACY_LAYOUT_ALIASES
      ? LEGACY_LAYOUT_ALIASES[value as LegacyVerbatiLayoutAlias]
      : value;

  return resolveStyleFamilyId(normalizedValue);
}

function sanitizePersistedVerbatiLayout(
  value: unknown,
): VerbatiLayoutPreset | null {
  return sanitizePersistedVerbatiFamilyId(value);
}

function sanitizePersistedResumeTemplateId(
  value: unknown,
): ResumeTemplateId | null {
  return isWorkshopResumeTemplateId(value as ResumeTemplateId)
    ? (value as ResumeTemplateId)
    : null;
}

function sanitizePersistedVerbatiPalette(
  value: unknown,
): VerbatiStylePreset["palette"] | null {
  if (typeof value !== "string") {
    return null;
  }

  return value === "custom" ||
    ALL_VERBATI_PALETTE_OPTIONS.some((option) => option.id === value)
    ? (value as VerbatiStylePreset["palette"])
    : null;
}

export function getLayoutLabel(preset: VerbatiLayoutPreset): string {
  return getStyleFamilyDefinition(sanitizePersistedVerbatiFamilyId(preset)).label;
}

export function getVerbatiStyleFromCv(
  doc: CvDocument | null | undefined,
): VerbatiStylePreset {
  const metadata = doc?.metadata as Record<string, unknown> | undefined;
  const candidate = metadata?.verbatiStyle as
    | Partial<VerbatiStylePreset>
    | undefined;
  const sanitizedCandidate = sanitizePersistedVerbatiStyle(candidate);
  if (sanitizedCandidate) return sanitizedCandidate;

  const baseSnapshot = metadata?.verbatiStyleBaseSnapshot as
    | Partial<VerbatiStylePreset>
    | undefined;
  const sanitizedBaseSnapshot = sanitizePersistedVerbatiStyle({
    ...baseSnapshot,
    ...(candidate?.resumeTemplateId
      ? { resumeTemplateId: candidate.resumeTemplateId }
      : null),
  });
  if (sanitizedBaseSnapshot) return sanitizedBaseSnapshot;

  const slotId = resolveDocumentStyleSlotId(metadata?.verbatiStyleSlotId);
  if (slotId) {
    const factorySlot = getFactoryDocumentStyleSlot(slotId);
    return resolveVerbatiStyle({
      ...factorySlot.appearance,
      resumeTemplateId: candidate?.resumeTemplateId ?? factorySlot.defaultCvTemplateId,
    });
  }

  return resolveVerbatiStyle(candidate);
}

export function sanitizePersistedVerbatiStyle(
  candidate: VerbatiStyleInput,
): VerbatiStylePreset | null {
  const safeCandidate = candidate ?? {};
  const familyId =
    sanitizePersistedVerbatiFamilyId(safeCandidate.familyId) ??
    sanitizePersistedVerbatiFamilyId(safeCandidate.layout);
  const typography = sanitizePersistedVerbatiFontPairId(safeCandidate.typography);
  const palette = sanitizePersistedVerbatiPalette(safeCandidate.palette);

  if (!familyId || !typography || !palette) {
    return null;
  }

  const resumeTemplateId = sanitizePersistedResumeTemplateId(
    safeCandidate.resumeTemplateId,
  );

  return {
    familyId,
    layout: familyId,
    typography,
    palette,
    ...(resumeTemplateId ? { resumeTemplateId } : {}),
    accentHex:
      palette === "custom"
        ? normalizeVerbatiAccentHex(
            typeof safeCandidate.accentHex === "string"
              ? safeCandidate.accentHex
              : undefined,
          )
        : undefined,
  };
}

export function resolveVerbatiStyle(
  candidate: VerbatiStyleInput,
): VerbatiStylePreset {
  const safeCandidate = candidate ?? {};
  const familyId =
    sanitizePersistedVerbatiFamilyId(safeCandidate.familyId) ??
    sanitizePersistedVerbatiFamilyId(safeCandidate.layout) ??
    DEFAULT_VERBATI_STYLE.familyId ??
    "swiss";
  const family = getStyleFamilyDefinition(familyId);
  const typography =
    sanitizePersistedVerbatiFontPairId(safeCandidate.typography) ??
    family.defaultTypography ??
    DEFAULT_VERBATI_STYLE.typography;
  const paletteOption =
    sanitizePersistedVerbatiPalette(safeCandidate.palette) ??
    family.defaultPalette ??
    DEFAULT_VERBATI_STYLE.palette;

  const resumeTemplateId = sanitizePersistedResumeTemplateId(
    safeCandidate.resumeTemplateId,
  );

  return {
    familyId,
    layout: family.id,
    typography,
    palette: paletteOption,
    ...(resumeTemplateId ? { resumeTemplateId } : {}),
    accentHex:
      paletteOption === "custom"
        ? normalizeVerbatiAccentHex(
            typeof safeCandidate.accentHex === "string"
              ? safeCandidate.accentHex
              : undefined,
          )
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
  return getStyleFamilyProposalTemplateId(
    resolveStyleFamilyFromStyle(
      style ? resolveVerbatiStyle(style) : DEFAULT_VERBATI_STYLE,
    ).id,
  );
}

export function getResumeTemplateId(
  style: VerbatiStylePreset | null | undefined,
): ResumeTemplateId {
  const resolvedStyle = style ? resolveVerbatiStyle(style) : DEFAULT_VERBATI_STYLE;
  return (
    sanitizePersistedResumeTemplateId(resolvedStyle.resumeTemplateId) ??
    getStyleFamilyResumeTemplateId(
      resolveStyleFamilyFromStyle(resolvedStyle).id,
    )
  );
}

export function getStyleFamilyId(
  style: VerbatiStylePreset | null | undefined,
): StyleFamilyId {
  return resolveStyleFamilyFromStyle(
    style ? resolveVerbatiStyle(style) : DEFAULT_VERBATI_STYLE,
  ).id;
}

export function resolveLegacyResumeRendererVariantId(
  style: VerbatiStylePreset | VerbatiLayoutPreset | null | undefined,
): ResumeLayoutVariantId | null {
  const familyId =
    typeof style === "string"
      ? sanitizePersistedVerbatiFamilyId(style)
      : style
        ? resolveVerbatiStyle(style).familyId
        : DEFAULT_VERBATI_STYLE.familyId;

  if (!familyId || familyId === "workshop") {
    return VERBATI_LAYOUT_TO_RENDERER.workshop;
  }

  return LEGACY_VERBATI_LAYOUT_TO_RENDERER[familyId];
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
      familyId: DEFAULT_VERBATI_STYLE.familyId,
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
    normalizedLeft.familyId === normalizedRight.familyId &&
    normalizedLeft.layout === normalizedRight.layout &&
    normalizedLeft.typography === normalizedRight.typography &&
    normalizedLeft.palette === normalizedRight.palette &&
    String(normalizedLeft.accentHex ?? "") ===
      String(normalizedRight.accentHex ?? "") &&
    String(normalizedLeft.resumeTemplateId ?? "") ===
      String(normalizedRight.resumeTemplateId ?? "")
  );
}

export function getVerbatiTypographyLabel(
  preset: VerbatiTypographyPreset,
): string {
  return getVerbatiFontPairLabel(preset);
}
