import type React from "react";
import type { CvDocument } from "../../types/cvDocument";
import type { ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type { ResumeLayoutVariantId } from "./resume/resume.types";
import type {
  VerbatiLayoutPreset,
  VerbatiPalettePreset,
  VerbatiStylePreset,
  VerbatiTypographyPreset,
} from "./types";

type LayoutOption = {
  id: VerbatiLayoutPreset;
  name: string;
  description: string;
};

type TypographyOption = {
  id: VerbatiTypographyPreset;
  name: string;
  description: string;
  headingFamily: string;
  bodyFamily: string;
};

type PaletteOption = {
  id: Exclude<VerbatiPalettePreset, "custom">;
  name: string;
  accentHex: string;
};

export const DEFAULT_VERBATI_STYLE: VerbatiStylePreset = {
  layout: "swiss",
  typography: "signature",
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
  {
    id: "editorial",
    name: "Editorial Wide",
    description:
      "Magazine-led editorial page with a long reading column and quieter side notes.",
  },
  {
    id: "modernist",
    name: "Modernist Grid",
    description:
      "A stricter 17/18 modular resume with a narrow signal rail and a clearer information ladder.",
  },
  {
    id: "quire",
    name: "Quire",
    description:
      "Fraunces italic roles, monospace dates, and prose skills — pure typographic hierarchy.",
  },
];

export const VERBATI_TYPOGRAPHY_OPTIONS: TypographyOption[] = [
  {
    id: "signature",
    name: "Signature",
    description: "Fraunces heading with a calm sans body.",
    headingFamily: '"Fraunces", serif',
    bodyFamily: '"Source Sans 3", system-ui, sans-serif',
  },
  {
    id: "engaging",
    name: "Engaging",
    description: "Source Serif display with a full editorial text voice.",
    headingFamily: '"Source Serif 4", serif',
    bodyFamily: '"Source Serif 4", serif',
  },
  {
    id: "expert",
    name: "Expert",
    description: "IBM Plex Mono display over a sharper utility sans.",
    headingFamily:
      '"IBM Plex Mono", source-code-pro, Menlo, Monaco, Consolas, monospace',
    bodyFamily: '"IBM Plex Sans", "Source Sans 3", system-ui, sans-serif',
  },
];

export const VERBATI_PALETTE_OPTIONS: PaletteOption[] = [
  { id: "sauge", name: "Sage", accentHex: "#556d60" },
  { id: "ocre", name: "Ochre", accentHex: "#8c6640" },
  { id: "pierre", name: "Stone", accentHex: "#5b6472" },
  { id: "bordeaux", name: "Bordeaux", accentHex: "#7c5158" },
  { id: "encre", name: "Ink", accentHex: "#3f5b67" },
];

export const VERBATI_LAYOUT_TO_RENDERER: Record<
  VerbatiLayoutPreset,
  ResumeLayoutVariantId
> = {
  swiss: "swissminima",
  "two-column": "robial",
  editorial: "editorialmag",
  modernist: "signalgrid",
  "playful-photo": "studiopop",
  "soft-ribbon": "softribbon",
  "slate-column": "slateprofile",
  quire: "quire",
};

const NEUTRAL_THEME = {
  canvas: "#f7f4ee",
  surface: "#fffefa",
  surfaceMuted: "#f6f2eb",
  paper: "#faf9f5",
  text: "#1d1914",
  textMuted: "#655c50",
  textSubtle: "#8a8174",
};

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function sanitizeHexChannel(segment: string): string {
  const safeSegment = segment.trim();
  if (safeSegment.length === 1) {
    return `${safeSegment}${safeSegment}`;
  }
  return safeSegment.slice(0, 2);
}

function normalizeHexColor(input: string | undefined | null): string {
  const raw = String(input ?? "")
    .trim()
    .replace("#", "");
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((segment) => sanitizeHexChannel(segment))
          .join("")
      : raw.length === 6
        ? raw
        : DEFAULT_VERBATI_ACCENT;

  return `#${normalized.toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHex(
  baseHex: string,
  targetHex: string,
  targetWeight: number,
): string {
  const safeWeight = Math.max(0, Math.min(1, targetWeight));
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  return rgbToHex({
    r: base.r * (1 - safeWeight) + target.r * safeWeight,
    g: base.g * (1 - safeWeight) + target.g * safeWeight,
    b: base.b * (1 - safeWeight) + target.b * safeWeight,
  });
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function getTypographyOption(
  preset: VerbatiTypographyPreset,
): TypographyOption {
  return (
    VERBATI_TYPOGRAPHY_OPTIONS.find((option) => option.id === preset) ??
    VERBATI_TYPOGRAPHY_OPTIONS[0]
  );
}

const DEFAULT_VERBATI_ACCENT = VERBATI_PALETTE_OPTIONS[0].accentHex;

export const VERBATI_LAYOUT_TO_PROPOSAL_TEMPLATE: Record<
  VerbatiLayoutPreset,
  ProposalTemplateId
> = {
  swiss: "swiss_margin",
  "two-column": "two_column_rail",
  editorial: "editorial_wide",
  modernist: "modernist_signal",
  "playful-photo": "editorial_wide",
  "soft-ribbon": "two_column_rail",
  "slate-column": "modernist_signal",
  quire: "quire_margin",
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

  const layout =
    safeCandidate.layout &&
    VERBATI_LAYOUT_OPTIONS.some((option) => option.id === safeCandidate.layout)
      ? safeCandidate.layout
      : DEFAULT_VERBATI_STYLE.layout;

  const typography =
    safeCandidate.typography &&
    VERBATI_TYPOGRAPHY_OPTIONS.some(
      (option) => option.id === safeCandidate.typography,
    )
      ? safeCandidate.typography
      : DEFAULT_VERBATI_STYLE.typography;

  const accentHex =
    paletteOption === "custom"
      ? normalizeHexColor(safeCandidate.accentHex)
      : undefined;

  return {
    layout,
    typography,
    palette: paletteOption,
    accentHex,
  };
}

export function resolveVerbatiAccentHex(style: VerbatiStylePreset): string {
  if (style.palette === "custom") {
    return normalizeHexColor(style.accentHex);
  }

  return (
    VERBATI_PALETTE_OPTIONS.find((option) => option.id === style.palette)
      ?.accentHex ?? DEFAULT_VERBATI_ACCENT
  );
}

export function getVerbatiTypographyFamilies(style: VerbatiStylePreset): {
  headingFamily: string;
  bodyFamily: string;
} {
  const typography = getTypographyOption(style.typography);

  return {
    headingFamily: typography.headingFamily,
    bodyFamily: typography.bodyFamily,
  };
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
  const accent = resolveVerbatiAccentHex(style);
  const accentHover = mixHex(accent, "#0f0f0f", 0.12);
  const accentPressed = mixHex(accent, "#0f0f0f", 0.22);
  const accentSoft = mixHex(NEUTRAL_THEME.surfaceMuted, accent, 0.06);
  const accentMuted = mixHex(NEUTRAL_THEME.surface, accent, 0.18);
  const canvas = mixHex(NEUTRAL_THEME.canvas, accent, 0.012);
  const surfaceMuted = mixHex(NEUTRAL_THEME.surfaceMuted, accent, 0.022);
  const surfaceRaised = mixHex(NEUTRAL_THEME.surface, NEUTRAL_THEME.canvas, 0.6);
  const border = withAlpha(mixHex(NEUTRAL_THEME.text, accent, 0.06), 0.13);
  const borderStrong = withAlpha(mixHex(NEUTRAL_THEME.text, accent, 0.1), 0.22);
  const borderContrast = withAlpha(
    mixHex(NEUTRAL_THEME.text, accent, 0.14),
    0.3,
  );
  const documentAccent = mixHex(NEUTRAL_THEME.text, accent, 0.62);
  const typography = getTypographyOption(style.typography);

  return {
    "--font-heading-family": typography.headingFamily,
    "--font-body-family": typography.bodyFamily,
    "--font-editorial-family": typography.headingFamily,
    "--color-canvas": canvas,
    "--color-surface": NEUTRAL_THEME.surface,
    "--color-surface-muted": surfaceMuted,
    "--color-surface-raised": surfaceRaised,
    "--color-text": NEUTRAL_THEME.text,
    "--color-text-muted": NEUTRAL_THEME.textMuted,
    "--color-text-subtle": NEUTRAL_THEME.textSubtle,
    "--color-border": border,
    "--color-border-strong": borderStrong,
    "--color-border-contrast": borderContrast,
    "--color-accent": accent,
    "--color-accent-hover": accentHover,
    "--color-accent-pressed": accentPressed,
    "--color-accent-soft": accentSoft,
    "--paper": NEUTRAL_THEME.paper,
    "--proposal-document-paper": "var(--paper)",
    "--proposal-document-ink": NEUTRAL_THEME.text,
    "--proposal-document-meta-ink": NEUTRAL_THEME.textMuted,
    "--proposal-document-accent-ink": documentAccent,
    "--color-on-accent": "#fffaf4",
    "--bg": canvas,
    "--sf1": NEUTRAL_THEME.surface,
    "--sf2": surfaceMuted,
    "--sfr": surfaceRaised,
    "--ti": NEUTRAL_THEME.text,
    "--tm2": NEUTRAL_THEME.textMuted,
    "--tg2": NEUTRAL_THEME.textSubtle,
    "--border-soft": border,
    "--border-field": borderStrong,
    "--border-strong": borderContrast,
    "--ac": accent,
    "--ah": accentHover,
    "--ap": accentSoft,
    "--am": accentMuted,
    "--bo": border,
    "--bm": borderStrong,
  } as React.CSSProperties;
}

export function serializeVerbatiStyle(
  style: VerbatiStylePreset,
): VerbatiStylePreset {
  return {
    layout: style.layout,
    typography: style.typography,
    palette: style.palette,
    accentHex:
      style.palette === "custom"
        ? normalizeHexColor(style.accentHex)
        : undefined,
  };
}

export function buildVerbatiProposalDocumentVars(
  style: VerbatiStylePreset,
): React.CSSProperties {
  const accent = resolveVerbatiAccentHex(style);
  const documentAccent = mixHex(NEUTRAL_THEME.text, accent, 0.62);
  const typography = getTypographyOption(style.typography);

  return {
    "--font-heading-family": typography.headingFamily,
    "--font-body-family": typography.bodyFamily,
    "--font-editorial-family": typography.headingFamily,
    "--paper": NEUTRAL_THEME.paper,
    "--proposal-document-paper": "var(--paper)",
    "--proposal-document-ink": NEUTRAL_THEME.text,
    "--proposal-document-meta-ink": NEUTRAL_THEME.textMuted,
    "--proposal-document-accent-ink": documentAccent,
  } as React.CSSProperties;
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
