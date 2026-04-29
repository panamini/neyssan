import type { ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type {
  ProposalStylePaletteHint,
  ProposalStyleSuggestion,
  VerbatiStyleBundleId,
} from "../../../convex/lib/proposals/styleSuggestions";
import type { VerbatiStylePreset } from "./types";
import {
  getLayoutLabel,
  getProposalTwinTemplateId,
  resolveVerbatiStyle,
  VERBATI_PALETTE_OPTIONS,
  VERBATI_TYPOGRAPHY_OPTIONS,
} from "./style";

export type VerbatiStyleBundleDefinition = {
  id: VerbatiStyleBundleId;
  label: string;
  description: string;
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
};

const STYLE_BUNDLE_BASES: ReadonlyArray<{
  id: VerbatiStyleBundleId;
  label: string;
  description: string;
  stylePreset: VerbatiStylePreset;
}> = [
  {
    id: "minimal",
    label: "Clean",
    description: "Tighter grid, restrained typography, quieter colour.",
    stylePreset: {
      layout: "workshop",
      typography: "expert",
      palette: "pierre",
    },
  },
  {
    id: "rounded",
    label: "Soft",
    description: "Softer split layout with a warmer, friendlier tone.",
    stylePreset: {
      layout: "workshop",
      typography: "signature",
      palette: "sauge",
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Long reading line, serif-led hierarchy, richer accent.",
    stylePreset: {
      layout: "workshop",
      typography: "engaging",
      palette: "bordeaux",
    },
  },
  {
    id: "bold",
    label: "Bold",
    description: "Sharper contrast, tighter signal, stronger emphasis.",
    stylePreset: {
      layout: "workshop",
      typography: "expert",
      palette: "encre",
    },
  },
] as const;

export const VERBATI_STYLE_BUNDLE_DEFINITIONS: readonly VerbatiStyleBundleDefinition[] =
  STYLE_BUNDLE_BASES.map((definition) => ({
    ...definition,
    stylePreset: resolveVerbatiStyle(definition.stylePreset),
    templateId: getProposalTwinTemplateId(definition.stylePreset),
  }));

export function getVerbatiStyleBundleDefinition(
  bundleId: VerbatiStyleBundleId,
): VerbatiStyleBundleDefinition {
  return (
    VERBATI_STYLE_BUNDLE_DEFINITIONS.find(
      (definition) => definition.id === bundleId,
    ) ?? VERBATI_STYLE_BUNDLE_DEFINITIONS[0]
  );
}

export function resolveVerbatiStyleBundleId(args: {
  templateId?: ProposalTemplateId | null;
  stylePreset?: Partial<VerbatiStylePreset> | VerbatiStylePreset | null;
}): VerbatiStyleBundleId | null {
  const templateId = args.templateId ?? null;
  const normalizedStyle = args.stylePreset
    ? resolveVerbatiStyle(args.stylePreset)
    : null;

  const match = VERBATI_STYLE_BUNDLE_DEFINITIONS.find((definition) => {
    if (!normalizedStyle) {
      return false;
    }

    return (
      definition.templateId === templateId &&
      definition.stylePreset.layout === normalizedStyle.layout &&
      definition.stylePreset.typography === normalizedStyle.typography &&
      definition.stylePreset.palette === normalizedStyle.palette
    );
  });

  return match?.id ?? null;
}

export function applyVerbatiStyleSuggestion(
  suggestion: ProposalStyleSuggestion,
): VerbatiStyleBundleDefinition {
  const baseBundle = getVerbatiStyleBundleDefinition(suggestion.bundleId);
  const nextStyle = resolveVerbatiStyle({
    ...baseBundle.stylePreset,
    ...suggestion.overrides,
    accentHex: baseBundle.stylePreset.accentHex,
  });

  return {
    ...baseBundle,
    stylePreset: nextStyle,
    templateId: getProposalTwinTemplateId(nextStyle),
  };
}

export function getVerbatiPaletteLabel(
  palette: ProposalStylePaletteHint | VerbatiStylePreset["palette"],
): string {
  return (
    VERBATI_PALETTE_OPTIONS.find((option) => option.id === palette)?.name ??
    String(palette)
  );
}

export function getVerbatiTypographyLabel(
  typography: VerbatiStylePreset["typography"],
): string {
  return (
    VERBATI_TYPOGRAPHY_OPTIONS.find((option) => option.id === typography)?.name ??
    String(typography)
  );
}

export function formatVerbatiStyleSummary(
  stylePreset: VerbatiStylePreset,
): string {
  const normalized = resolveVerbatiStyle(stylePreset);
  return `${getLayoutLabel(normalized.layout)} · ${getVerbatiTypographyLabel(
    normalized.typography,
  )} · ${getVerbatiPaletteLabel(normalized.palette)}`;
}
