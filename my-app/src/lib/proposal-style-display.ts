import type { ResolvedProposalStyleChoice } from "./proposal-style-choice";
import { ALL_VERBATI_PALETTE_OPTIONS, VERBATI_PALETTE_OPTIONS } from "./layout/documentAppearance";
import type { VerbatiStylePreset } from "../features/verbati/types";

export type ProposalPaletteId = Exclude<VerbatiStylePreset["palette"], "custom">;

export type ProposalStylePreviewDefinition = {
  headingFont: string;
  headingWeight: number;
  fontStyle?: "normal" | "italic";
  fontName: string;
  templateName: string;
};

export const PROPOSAL_PALETTE_OPTIONS: Array<{
  id: ProposalPaletteId;
  label: string;
  color: string;
  cssClassName: `pal-${string}`;
  accentToken: string;
}> = VERBATI_PALETTE_OPTIONS.map((option) => ({
  id: option.id,
  label: option.name,
  color: option.accentHex,
  cssClassName: option.cssClassName,
  accentToken: option.accentToken,
}));

export function isProposalPaletteId(value: unknown): value is ProposalPaletteId {
  return (
    typeof value === "string" &&
    ALL_VERBATI_PALETTE_OPTIONS.some((option) => option.id === value)
  );
}

export const PROPOSAL_STYLE_PREVIEW_DEFINITIONS: Record<
  ResolvedProposalStyleChoice,
  ProposalStylePreviewDefinition
> = {
  balanced: {
    headingFont: '"Baskervville", serif',
    headingWeight: 600,
    fontStyle: "normal",
    fontName: "Baskervville",
    templateName: "Swiss Margin",
  },
  formal: {
    headingFont: '"IBM Plex Mono", monospace',
    headingWeight: 400,
    fontStyle: "normal",
    fontName: "IBM Plex Mono",
    templateName: "Quire Margin",
  },
  technical: {
    headingFont: '"IBM Plex Mono", monospace',
    headingWeight: 700,
    fontStyle: "normal",
    fontName: "IBM Plex Mono",
    templateName: "Modernist Signal",
  },
  warm: {
    headingFont: '"Source Serif 4", serif',
    headingWeight: 400,
    fontStyle: "normal",
    fontName: "Source Serif 4",
    templateName: "Editorial Wide",
  },
};

export const PROPOSAL_AUTO_STYLE_PREVIEW: ProposalStylePreviewDefinition = {
  headingFont: '"Baskervville", serif',
  headingWeight: 300,
  fontStyle: "italic",
  fontName: "Adaptive",
  templateName: "Role matched",
};
