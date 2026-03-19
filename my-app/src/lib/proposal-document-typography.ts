import type { ProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";

export type ProposalDocumentTypography = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing?: string;
};

export function getProposalDocumentTypography(
  voicePreset?: ProposalVoicePreset | null,
): ProposalDocumentTypography {
  if (voicePreset === "engaging") {
    return {
      fontFamily: '"Fraunces", serif',
      fontSize: 14.75,
      lineHeight: 1.9,
      fontWeight: 300,
      letterSpacing: "-0.005em",
    };
  }

  if (voicePreset === "expert") {
    return {
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 12.5,
      lineHeight: 1.78,
      fontWeight: 400,
      letterSpacing: "0.01em",
    };
  }

  return {
    fontFamily: '"Source Serif 4", serif',
    fontSize: 15,
    lineHeight: 1.82,
    fontWeight: 400,
    letterSpacing: "0em",
  };
}
