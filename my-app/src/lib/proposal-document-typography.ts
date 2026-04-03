import type { ProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";
import {
  DEFAULT_VERBATI_STYLE,
  getVerbatiTypographyFamilies,
  resolveVerbatiStyle,
} from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";

export type ProposalDocumentTypography = {
  fontFamily: string;
  fontSize: string;
  lineHeight: number;
  fontWeight: number;
  letterSpacing?: string;
};

export function getProposalDocumentTypography(
  voicePreset?: ProposalVoicePreset | null,
  stylePreset?: VerbatiStylePreset | null,
): ProposalDocumentTypography {
  const resolvedStyle = stylePreset
    ? resolveVerbatiStyle(stylePreset)
    : DEFAULT_VERBATI_STYLE;
  const typographyFamilies = getVerbatiTypographyFamilies(resolvedStyle);

  if (voicePreset === "expert") {
    return {
      fontFamily: typographyFamilies.bodyFamily,
      fontSize: "calc(var(--proposal-inline-mm) * 3.62)",
      lineHeight: 1.6,
      fontWeight: 400,
      letterSpacing: "0.003em",
    };
  }

  if (voicePreset === "direct") {
    return {
      fontFamily: typographyFamilies.bodyFamily,
      fontSize: "calc(var(--proposal-inline-mm) * 3.7)",
      lineHeight: 1.58,
      fontWeight: 400,
      letterSpacing: "0.002em",
    };
  }

  if (voicePreset === "engaging" || voicePreset === "storyteller") {
    return {
      fontFamily: typographyFamilies.bodyFamily,
      fontSize: "calc(var(--proposal-inline-mm) * 3.88)",
      lineHeight: 1.64,
      fontWeight: 400,
      letterSpacing: "-0.002em",
    };
  }

  return {
    fontFamily: typographyFamilies.bodyFamily,
    fontSize: "calc(var(--proposal-inline-mm) * 3.79)",
    lineHeight: 1.65,
    fontWeight: 400,
    letterSpacing: "0em",
  };
}
