import type React from "react";
import {
  getVerbatiFontPairOption,
  resolveVerbatiFontPairId,
} from "../../features/verbati/fontCatalog";
import type {
  VerbatiLayoutPreset,
  VerbatiPalettePreset,
  VerbatiStylePreset,
} from "../../features/verbati/types";
import type { ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type { CanonicalDocumentTokens } from "./documentTokens";

export type VerbatiPaletteOption = {
  id: Exclude<VerbatiPalettePreset, "custom">;
  name: string;
  accentHex: string;
  cssClassName: `pal-${string}`;
  accentToken: string;
  legacy?: boolean;
};

const PREVIEW_NEUTRAL_THEME = {
  canvas: "#f7f4ee",
  surface: "#fffefa",
  surfaceMuted: "#f6f2eb",
  paper: "#faf9f5",
  text: "#1d1914",
  textMuted: "#655c50",
  textSubtle: "#8a8174",
} as const;

const EXPORT_MONO_THEME = {
  accent: "#1f1d1a",
  ink: "#1f1d1a",
  mutedInk: "#5f594f",
  line: "rgba(31, 29, 26, 0.14)",
  headerRule: "rgba(31, 29, 26, 0.14)",
  ruleStrong: "rgba(31, 29, 26, 0.22)",
  sidebarFill: "transparent",
  tagFill: "transparent",
  paper: "#ffffff",
} as const;

const DOCX_SAFE_FALLBACK_HEX = EXPORT_MONO_THEME.ink.slice(1).toUpperCase();

export const VERBATI_PALETTE_OPTIONS: VerbatiPaletteOption[] = [
  {
    id: "terre",
    name: "Terre",
    accentHex: "#A84E2E",
    cssClassName: "pal-terre",
    accentToken: "var(--ac)",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    accentHex: "#2A78D6",
    cssClassName: "pal-cobalt",
    accentToken: "var(--link)",
  },
  {
    id: "ink",
    name: "Ink",
    accentHex: "#0F0C08",
    cssClassName: "pal-ink",
    accentToken: "var(--paper-dark-heading-ink)",
  },
  {
    id: "sauge",
    name: "Sage",
    accentHex: "#3B6E4E",
    cssClassName: "pal-sauge",
    accentToken: "var(--ac)",
  },
  {
    id: "plum",
    name: "Plum",
    accentHex: "#7A4FA0",
    cssClassName: "pal-plum",
    accentToken: "var(--ac)",
  },
  {
    id: "ochre",
    name: "Ochre",
    accentHex: "#B8843A",
    cssClassName: "pal-ochre",
    accentToken: "var(--ac)",
  },
];

export const LEGACY_VERBATI_PALETTE_OPTIONS: VerbatiPaletteOption[] = [
  {
    id: "ocre",
    name: "Ochre legacy",
    accentHex: "#8c6640",
    cssClassName: "pal-ocre",
    accentToken: "var(--ac)",
    legacy: true,
  },
  {
    id: "pierre",
    name: "Stone legacy",
    accentHex: "#5b6472",
    cssClassName: "pal-pierre",
    accentToken: "var(--ac)",
    legacy: true,
  },
  {
    id: "bordeaux",
    name: "Bordeaux legacy",
    accentHex: "#7c5158",
    cssClassName: "pal-bordeaux",
    accentToken: "var(--ac)",
    legacy: true,
  },
  {
    id: "encre",
    name: "Ink legacy",
    accentHex: "#3f5b67",
    cssClassName: "pal-encre",
    accentToken: "var(--ac)",
    legacy: true,
  },
];

export const ALL_VERBATI_PALETTE_OPTIONS: VerbatiPaletteOption[] = [
  ...VERBATI_PALETTE_OPTIONS,
  ...LEGACY_VERBATI_PALETTE_OPTIONS,
];

export const DEFAULT_VERBATI_ACCENT = VERBATI_PALETTE_OPTIONS[0].accentHex;

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

export function normalizeVerbatiAccentHex(
  input: string | undefined | null,
): string {
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
  const normalized = normalizeVerbatiAccentHex(hex).slice(1);
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

function resolveTypographyOption(style: VerbatiStylePreset) {
  return getVerbatiFontPairOption(resolveVerbatiFontPairId(style.typography));
}

export function resolveVerbatiTypographyFamilies(style: VerbatiStylePreset): {
  headingFamily: string;
  bodyFamily: string;
} {
  const typography = resolveTypographyOption(style);
  return {
    headingFamily: typography.headingFamily,
    bodyFamily: typography.bodyFamily,
  };
}

export function resolveVerbatiAccentHex(style: VerbatiStylePreset): string {
  if (style.palette === "custom") {
    return normalizeVerbatiAccentHex(style.accentHex);
  }

  return (
    ALL_VERBATI_PALETTE_OPTIONS.find((option) => option.id === style.palette)
      ?.accentHex ?? DEFAULT_VERBATI_ACCENT
  );
}

export function resolvePrimaryFontFamily(
  family: string | undefined,
  fallback: string,
): string {
  const source = family?.trim() || fallback;
  const [head] = source.split(",");
  const trimmed = head?.trim();
  return trimmed ? trimmed.replace(/^["']|["']$/g, "") : fallback;
}

function buildPreviewAppearanceTheme(
  style: VerbatiStylePreset,
): CanonicalDocumentTokens["appearance"] {
  const accent = resolveVerbatiAccentHex(style);
  const typography = resolveTypographyOption(style);
  const accentHover = mixHex(accent, "#0f0f0f", 0.12);
  const accentPressed = mixHex(accent, "#0f0f0f", 0.22);
  const accentSoft = mixHex(PREVIEW_NEUTRAL_THEME.surfaceMuted, accent, 0.06);
  const accentMuted = mixHex(PREVIEW_NEUTRAL_THEME.surface, accent, 0.18);
  const interactionRing = withAlpha(
    mixHex(PREVIEW_NEUTRAL_THEME.text, accent, 0.3),
    0.28,
  );
  const interactionFill = withAlpha(
    mixHex(PREVIEW_NEUTRAL_THEME.surface, accent, 0.08),
    0.88,
  );
  const interactionShadow = `inset 0 0 0 0.18mm ${withAlpha(
    mixHex(PREVIEW_NEUTRAL_THEME.text, accent, 0.22),
    0.08,
  )}, 0 1.8mm 4.8mm ${withAlpha(mixHex(accent, "#0f0f0f", 0.34), 0.08)}`;
  const canvas = mixHex(PREVIEW_NEUTRAL_THEME.canvas, accent, 0.012);
  const surfaceMuted = mixHex(
    PREVIEW_NEUTRAL_THEME.surfaceMuted,
    accent,
    0.022,
  );
  const surfaceRaised = mixHex(
    PREVIEW_NEUTRAL_THEME.surface,
    PREVIEW_NEUTRAL_THEME.canvas,
    0.6,
  );
  const border = withAlpha(
    mixHex(PREVIEW_NEUTRAL_THEME.text, accent, 0.06),
    0.13,
  );
  const borderStrong = withAlpha(
    mixHex(PREVIEW_NEUTRAL_THEME.text, accent, 0.1),
    0.22,
  );
  const borderContrast = withAlpha(
    mixHex(PREVIEW_NEUTRAL_THEME.text, accent, 0.14),
    0.3,
  );
  const documentAccentInk = mixHex(PREVIEW_NEUTRAL_THEME.text, accent, 0.62);

  return {
    font: {
      heading: {
        family: typography.headingFamily,
        weight: 600,
      },
      body: {
        family: typography.bodyFamily,
        weight: 400,
      },
      editorial: {
        family: typography.headingFamily,
      },
      kerning: "normal",
      ligatures: "common-ligatures",
    },
    theme: {
      canvas,
      surface: PREVIEW_NEUTRAL_THEME.surface,
      surfaceMuted,
      surfaceRaised,
      paper: PREVIEW_NEUTRAL_THEME.paper,
      accent,
      ink: PREVIEW_NEUTRAL_THEME.text,
      mutedInk: PREVIEW_NEUTRAL_THEME.textMuted,
      textSubtle: PREVIEW_NEUTRAL_THEME.textSubtle,
      border,
      borderStrong,
      borderContrast,
      line: border,
      headerRule: border,
      ruleStrong: borderStrong,
      sidebarFill: surfaceMuted,
      tagFill: accentSoft,
      onAccent: "#fffaf4",
      proposalDocumentInk: PREVIEW_NEUTRAL_THEME.text,
      proposalDocumentMetaInk: PREVIEW_NEUTRAL_THEME.textMuted,
      proposalDocumentAccentInk: documentAccentInk,
    },
    decor: {
      preview: {
        accentHover,
        accentPressed,
        accentSoft,
        accentMuted,
        interactionRing,
        interactionFill,
        interactionShadow,
      },
      export: {},
    },
  };
}

function buildResumeExportDecor(
  layout: VerbatiLayoutPreset,
): CanonicalDocumentTokens["appearance"]["decor"]["export"] {
  const decor: CanonicalDocumentTokens["appearance"]["decor"]["export"] = {
    headerBorderWidth: "0.35mm",
    sidebarRuleWidth: "0.35mm",
    sectionRuleWidth: "0.35mm",
    tagBorderWidth: "0.3mm",
    pageBackground:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper) 88%, #ffffff 12%), var(--paper))",
    headerBackground:
      "linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, transparent), transparent 72%)",
    headerBorderColor:
      "color-mix(in srgb, var(--accent) 24%, var(--header-rule))",
    headerShadow:
      "inset 0 -0.45mm 0 0 color-mix(in srgb, var(--accent) 18%, transparent), inset 0 8mm 16mm -15mm color-mix(in srgb, var(--accent) 8%, transparent)",
    sidebarBackground:
      "linear-gradient(180deg, color-mix(in srgb, var(--accent) 5%, transparent), transparent 64%), var(--sidebar-fill)",
    sidebarShadow:
      "inset -0.4mm 0 0 0 color-mix(in srgb, var(--accent) 16%, transparent)",
    sectionRuleBorderColor:
      "color-mix(in srgb, var(--accent) 18%, var(--line))",
    sectionRuleShadow:
      "inset 0 0.18mm 0 0 color-mix(in srgb, var(--accent) 10%, transparent)",
    sectionTitleColor: "color-mix(in srgb, var(--accent) 74%, var(--ink))",
    metaLabelColor: "color-mix(in srgb, var(--accent) 50%, var(--muted))",
    sectionTitleFontFamily: "var(--heading-font)",
    metaLabelFontFamily: "var(--heading-font)",
    tagBorderColor: "color-mix(in srgb, var(--accent) 18%, var(--line))",
    tagBackground: "color-mix(in srgb, var(--accent) 7%, var(--tag-fill))",
    tagShadow:
      "inset 0 0 0 0.15mm color-mix(in srgb, var(--accent) 8%, transparent)",
    tagBorderRadius: "999px",
    docNameColor: "color-mix(in srgb, var(--accent) 70%, var(--ink))",
    docNameFontWeight: "700",
    docNameLetterSpacing: "-0.015em",
    docTitleColor: "color-mix(in srgb, var(--muted) 76%, var(--accent) 24%)",
    docTitleFontStyle: "normal",
    docSummaryColor: "color-mix(in srgb, var(--ink) 88%, var(--accent) 12%)",
    entryTitleColor: "color-mix(in srgb, var(--ink) 76%, var(--accent) 24%)",
    entryTitleFontFamily: "var(--body-font)",
    entryTitleFontWeight: "700",
    entryMetaColor: "color-mix(in srgb, var(--muted) 74%, var(--accent) 26%)",
    entryMetaFontStyle: "normal",
    sectionTitleFontWeight: "700",
    sectionTitleTextTransform: "uppercase",
    sectionTitleLetterSpacing: "0.14em",
    metaLabelTextTransform: "uppercase",
    metaLabelLetterSpacing: "0.12em",
  };

  switch (layout) {
    case "two-column":
      return {
        ...decor,
        sidebarBackground:
          "linear-gradient(180deg, color-mix(in srgb, var(--accent) 9%, transparent), transparent 58%), var(--sidebar-fill)",
        sidebarShadow:
          "inset -0.95mm 0 0 0 color-mix(in srgb, var(--accent) 26%, transparent)",
        sectionTitleColor: "color-mix(in srgb, var(--accent) 76%, var(--ink))",
        metaLabelColor: "color-mix(in srgb, var(--accent) 56%, var(--muted))",
        entryTitleColor: "color-mix(in srgb, var(--accent) 28%, var(--ink))",
      };
    case "workshop":
    case "swiss":
    default:
      return decor;
  }
}

function buildProposalExportDecor(
  templateId: ProposalTemplateId | null,
): CanonicalDocumentTokens["appearance"]["decor"]["export"] {
  const decor: CanonicalDocumentTokens["appearance"]["decor"]["export"] = {
    headerBorderWidth: "0.35mm",
    sidebarRuleWidth: "0.35mm",
    sectionRuleWidth: "0.35mm",
    tagBorderWidth: "0.3mm",
    pageBackground:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper) 88%, #ffffff 12%), var(--paper))",
    headerBackground:
      "linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, transparent), transparent 72%)",
    headerBorderColor:
      "color-mix(in srgb, var(--accent) 24%, var(--header-rule))",
    headerShadow:
      "inset 0 -0.45mm 0 0 color-mix(in srgb, var(--accent) 18%, transparent), inset 0 8mm 16mm -15mm color-mix(in srgb, var(--accent) 8%, transparent)",
    sidebarBackground:
      "linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, transparent), transparent 62%), var(--sidebar-fill)",
    sidebarShadow:
      "inset -0.45mm 0 0 0 color-mix(in srgb, var(--accent) 18%, transparent)",
    sectionRuleBorderColor:
      "color-mix(in srgb, var(--accent) 18%, var(--line))",
    sectionRuleShadow:
      "inset 0 0.18mm 0 0 color-mix(in srgb, var(--accent) 10%, transparent)",
    sectionTitleColor: "color-mix(in srgb, var(--accent) 76%, var(--ink))",
    metaLabelColor: "color-mix(in srgb, var(--accent) 56%, var(--muted))",
    sectionTitleFontFamily: "var(--heading-font)",
    metaLabelFontFamily: "var(--heading-font)",
    metaValueColor: "color-mix(in srgb, var(--ink) 88%, var(--accent) 12%)",
    proposalTitleColor: "color-mix(in srgb, var(--accent) 72%, var(--ink))",
    proposalTitleFontWeight: "700",
    proposalTitleLetterSpacing: "-0.015em",
    proposalTitleFontStyle: "normal",
    proposalMetaColor: "color-mix(in srgb, var(--muted) 72%, var(--accent) 28%)",
    proposalMetaFontStyle: "normal",
    subjectBackground:
      "linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 88%)",
    subjectShadow:
      "inset 0 -0.35mm 0 0 color-mix(in srgb, var(--accent) 28%, transparent)",
    signoffColor: "color-mix(in srgb, var(--ink) 85%, var(--accent) 15%)",
    signoffFontStyle: "normal",
    signatureColor: "var(--ink)",
    signatureFontWeight: "700",
    signatureTextTransform: "lowercase",
    signatureLetterSpacing: "normal",
    signatureFontVariantCaps: "normal",
    sectionTitleFontWeight: "700",
    sectionTitleTextTransform: "uppercase",
    sectionTitleLetterSpacing: "0.14em",
    metaLabelTextTransform: "uppercase",
    metaLabelLetterSpacing: "0.12em",
  };

  switch (templateId) {
    case "editorial_wide":
      return {
        ...decor,
        pageBackground:
          "linear-gradient(180deg, color-mix(in srgb, var(--accent) 4%, #fff7ef), var(--paper))",
        proposalTitleColor: "color-mix(in srgb, var(--accent) 64%, var(--ink))",
        proposalTitleFontStyle: "italic",
        proposalMetaFontStyle: "italic",
        sectionTitleColor: "color-mix(in srgb, var(--accent) 82%, var(--ink))",
        metaValueColor: "color-mix(in srgb, var(--muted) 82%, var(--accent) 18%)",
        signoffFontStyle: "italic",
        headerAuxShadow: decor.headerShadow,
      };
    case "modernist_signal":
      return {
        ...decor,
        sectionTitleColor: "var(--ink)",
        metaLabelColor: "var(--ink)",
        sectionTitleFontFamily: "var(--body-font)",
        metaLabelFontFamily: "var(--body-font)",
        sidebarShadow:
          "inset -0.85mm 0 0 0 color-mix(in srgb, var(--accent) 24%, transparent)",
        subjectBackground:
          "linear-gradient(90deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent 30%)",
        proposalTitleColor: "var(--ink)",
        metaValueColor: "var(--ink)",
      };
    case "quire_margin":
      return {
        ...decor,
        pageBackground:
          "linear-gradient(180deg, color-mix(in srgb, var(--accent) 4%, #fff8ef), var(--paper))",
        proposalTitleFontStyle: "italic",
        proposalMetaFontStyle: "italic",
        signoffFontStyle: "italic",
        metaValueColor: "color-mix(in srgb, var(--muted) 80%, var(--accent) 20%)",
        headerAuxShadow: decor.headerShadow,
      };
    case "two_column_rail":
      return {
        ...decor,
        sidebarShadow:
          "inset -1mm 0 0 0 color-mix(in srgb, var(--accent) 28%, transparent)",
        metaLabelColor: "color-mix(in srgb, var(--accent) 68%, var(--muted))",
        subjectShadow:
          "inset 0 -0.4mm 0 0 color-mix(in srgb, var(--accent) 30%, transparent), inset 1mm 0 0 0 color-mix(in srgb, var(--accent) 18%, transparent)",
      };
    case "volk_register":
      return {
        ...decor,
        pageBackground:
          "linear-gradient(to right, transparent 0%, transparent 52%, color-mix(in srgb, var(--accent) 7%, transparent) 52.2%, transparent 52.5%, transparent 60%, color-mix(in srgb, var(--accent) 4%, transparent) 60.2%, transparent 60.5%), radial-gradient(circle at 18% 8%, rgba(255, 255, 255, 0.2), transparent 28%), linear-gradient(180deg, color-mix(in srgb, var(--paper) 90%, #ffffff 10%), var(--paper))",
        sectionTitleColor: "color-mix(in srgb, var(--accent) 72%, var(--ink))",
        metaLabelColor: "color-mix(in srgb, var(--accent) 72%, var(--ink))",
        proposalMetaColor: "color-mix(in srgb, var(--ink) 76%, var(--accent) 24%)",
        metaValueColor: "color-mix(in srgb, var(--ink) 76%, var(--accent) 24%)",
        subjectBackground:
          "linear-gradient(90deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 55%)",
        subjectShadow:
          "inset 0 -0.45mm 0 0 color-mix(in srgb, var(--accent) 32%, transparent)",
      };
    case "workshop_proposal_margin":
    case "swiss_margin":
    default:
      return decor;
  }
}

export function resolvePreviewCanonicalAppearance(
  stylePreset: VerbatiStylePreset,
): CanonicalDocumentTokens["appearance"] {
  return buildPreviewAppearanceTheme(stylePreset);
}

export function resolveResumeExportCanonicalAppearance(args: {
  mode: "ats" | "styled";
  stylePreset: VerbatiStylePreset;
  layout: VerbatiLayoutPreset;
}): CanonicalDocumentTokens["appearance"] {
  const previewAppearance = buildPreviewAppearanceTheme(args.stylePreset);
  if (args.mode === "ats") {
    return {
      ...previewAppearance,
      theme: {
        ...previewAppearance.theme,
        ...EXPORT_MONO_THEME,
      },
      decor: {
        ...previewAppearance.decor,
        export: {
          headerBorderWidth: "0.35mm",
          sidebarRuleWidth: "0.35mm",
          sectionRuleWidth: "0.35mm",
          tagBorderWidth: "0.3mm",
          tagBorderRadius: "999px",
        },
      },
    };
  }

  return {
    ...previewAppearance,
    theme: {
      ...previewAppearance.theme,
      ink: "#1f1d1a",
      mutedInk: "#62584d",
      line: "rgba(31, 29, 26, 0.18)",
      headerRule: "rgba(31, 29, 26, 0.18)",
      ruleStrong: previewAppearance.theme.accent,
      sidebarFill: "rgba(31, 29, 26, 0.028)",
      tagFill: "rgba(31, 29, 26, 0.04)",
      paper: "#fffdfa",
    },
    decor: {
      ...previewAppearance.decor,
      export: buildResumeExportDecor(args.layout),
    },
  };
}

export function resolveProposalExportCanonicalAppearance(args: {
  mode: "ats" | "styled";
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId | null;
}): CanonicalDocumentTokens["appearance"] {
  const previewAppearance = buildPreviewAppearanceTheme(args.stylePreset);
  if (args.mode === "ats") {
    return {
      ...previewAppearance,
      theme: {
        ...previewAppearance.theme,
        ...EXPORT_MONO_THEME,
      },
      decor: {
        ...previewAppearance.decor,
        export: {
          headerBorderWidth: "0.35mm",
          sidebarRuleWidth: "0.35mm",
          sectionRuleWidth: "0.35mm",
          tagBorderWidth: "0.3mm",
          tagBorderRadius: "999px",
        },
      },
    };
  }

  return {
    ...previewAppearance,
    theme: {
      ...previewAppearance.theme,
      ink: "#1f1d1a",
      mutedInk: "#62584d",
      line: "rgba(31, 29, 26, 0.18)",
      headerRule: "rgba(31, 29, 26, 0.18)",
      ruleStrong: previewAppearance.theme.accent,
      sidebarFill: "rgba(31, 29, 26, 0.028)",
      tagFill: "rgba(31, 29, 26, 0.04)",
      paper: "#fffdfa",
    },
    decor: {
      ...previewAppearance.decor,
      export: buildProposalExportDecor(args.templateId),
    },
  };
}

export function serializeVerbatiThemeVars(
  appearance: CanonicalDocumentTokens["appearance"],
): React.CSSProperties {
  return {
    "--font-heading-family": appearance.font.heading.family,
    "--font-body-family": appearance.font.body.family,
    "--font-editorial-family": appearance.font.editorial.family,
    "--color-canvas": appearance.theme.canvas,
    "--color-surface": appearance.theme.surface,
    "--color-surface-muted": appearance.theme.surfaceMuted,
    "--color-surface-raised": appearance.theme.surfaceRaised,
    "--color-text": appearance.theme.ink,
    "--color-text-muted": appearance.theme.mutedInk,
    "--color-text-subtle": appearance.theme.textSubtle,
    "--color-border": appearance.theme.border,
    "--color-border-strong": appearance.theme.borderStrong,
    "--color-border-contrast": appearance.theme.borderContrast,
    "--color-accent": appearance.theme.accent,
    "--color-accent-hover": appearance.decor.preview?.accentHover,
    "--color-accent-pressed": appearance.decor.preview?.accentPressed,
    "--color-accent-soft": appearance.decor.preview?.accentSoft,
    "--resume-preview-interaction-ring":
      appearance.decor.preview?.interactionRing,
    "--resume-preview-interaction-fill":
      appearance.decor.preview?.interactionFill,
    "--resume-preview-interaction-shadow":
      appearance.decor.preview?.interactionShadow,
    "--paper": appearance.theme.paper,
    "--proposal-document-paper": appearance.theme.paper,
    "--proposal-document-ink": appearance.theme.proposalDocumentInk,
    "--proposal-document-meta-ink": appearance.theme.proposalDocumentMetaInk,
    "--proposal-document-accent-ink":
      appearance.theme.proposalDocumentAccentInk,
    "--color-on-accent": appearance.theme.onAccent,
    "--bg": appearance.theme.canvas,
    "--sf1": appearance.theme.surface,
    "--sf2": appearance.theme.surfaceMuted,
    "--sfr": appearance.theme.surfaceRaised,
    "--ti": appearance.theme.ink,
    "--tm2": appearance.theme.mutedInk,
    "--tg2": appearance.theme.textSubtle,
    "--border-soft": appearance.theme.border,
    "--border-field": appearance.theme.borderStrong,
    "--border-strong": appearance.theme.borderContrast,
    "--ac": appearance.theme.accent,
    "--ah": appearance.decor.preview?.accentHover,
    "--ap": appearance.decor.preview?.accentSoft,
    "--am": appearance.decor.preview?.accentMuted,
    "--bo": appearance.theme.border,
    "--bm": appearance.theme.borderStrong,
  } as React.CSSProperties;
}

export function serializeProposalDocumentThemeVars(
  appearance: CanonicalDocumentTokens["appearance"],
): React.CSSProperties {
  return {
    "--font-heading-family": appearance.font.heading.family,
    "--font-body-family": appearance.font.body.family,
    "--font-editorial-family": appearance.font.editorial.family,
    "--paper": appearance.theme.paper,
    "--proposal-document-paper": appearance.theme.paper,
    "--proposal-document-ink": appearance.theme.proposalDocumentInk,
    "--proposal-document-meta-ink": appearance.theme.proposalDocumentMetaInk,
    "--proposal-document-accent-ink":
      appearance.theme.proposalDocumentAccentInk,
  } as React.CSSProperties;
}

export function resolveDocxSafeColorHex(
  value: string | undefined,
  fallback = DOCX_SAFE_FALLBACK_HEX,
): string {
  if (!value) {
    return fallback;
  }

  const hexMatch = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    return hexMatch[1].toUpperCase();
  }

  const rgbaMatch = value
    .trim()
    .match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i);
  if (rgbaMatch) {
    return rgbToHex({
      r: Number.parseInt(rgbaMatch[1], 10),
      g: Number.parseInt(rgbaMatch[2], 10),
      b: Number.parseInt(rgbaMatch[3], 10),
    })
      .slice(1)
      .toUpperCase();
  }

  return fallback;
}
