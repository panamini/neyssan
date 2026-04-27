import type { ResolvedProposalStyleChoice } from "./proposal-style-choice";

export type ProposalPaletteId =
  | "sauge"
  | "ocre"
  | "pierre"
  | "bordeaux"
  | "encre";

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
}> = [
  { id: "sauge", label: "Sage", color: "hsl(155 22% 30%)" },
  { id: "ocre", label: "Ochre", color: "hsl(34 38% 32%)" },
  { id: "pierre", label: "Stone", color: "hsl(220 14% 30%)" },
  { id: "bordeaux", label: "Bordeaux", color: "hsl(348 22% 30%)" },
  { id: "encre", label: "Ink", color: "hsl(200 18% 24%)" },
];

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
