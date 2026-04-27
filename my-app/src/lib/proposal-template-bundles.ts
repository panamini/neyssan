import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import {
  getProposalTwinTemplateId,
  resolveVerbatiStyle,
} from "../features/verbati/style";
import type {
  VerbatiLayoutPreset,
  VerbatiStylePreset,
  VerbatiTypographyPreset,
} from "../features/verbati/types";
import type { ProposalStyleChoice } from "./proposal-style-choice";

export const PROPOSAL_TEMPLATE_BUNDLE_IDS = [
  "swiss_serif",
  "swiss_mono",
  "magazine_editorial",
  "magazine_serif",
  "grid_mono",
] as const;

export type ProposalTemplateBundleId =
  (typeof PROPOSAL_TEMPLATE_BUNDLE_IDS)[number];

export type ProposalTemplateBundleDefinition = {
  id: ProposalTemplateBundleId;
  label: string;
  description: string;
  settingsStyleChoice?: ProposalStyleChoice;
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
};

type BundleBase = Omit<ProposalTemplateBundleDefinition, "stylePreset" | "templateId"> & {
  stylePreset: Partial<VerbatiStylePreset>;
};

const TEMPLATE_BUNDLE_BASES: readonly BundleBase[] = [
  {
    id: "swiss_serif",
    label: "Swiss Serif",
    description: "Calm Swiss grid with a softer serif-led headline.",
    settingsStyleChoice: "balanced",
    stylePreset: {
      layout: "swiss",
      typography: "geist-baskervville",
      palette: "pierre",
    },
  },
  {
    id: "swiss_mono",
    label: "Swiss Mono",
    description: "Clean grid with a sharper mono-led register.",
    stylePreset: {
      layout: "swiss",
      typography: "expert",
      palette: "encre",
    },
  },
  {
    id: "magazine_editorial",
    label: "Magazine Editorial",
    description: "Wide editorial pacing with a richer reading voice.",
    settingsStyleChoice: "warm",
    stylePreset: {
      layout: "editorial",
      typography: "engaging",
      palette: "bordeaux",
    },
  },
  {
    id: "magazine_serif",
    label: "Magazine Serif",
    description: "Magazine proportions with a calmer serif rhythm.",
    stylePreset: {
      layout: "editorial",
      typography: "signature",
      palette: "ocre",
    },
  },
  {
    id: "grid_mono",
    label: "Grid Mono",
    description: "Tighter modernist structure with precise technical contrast.",
    settingsStyleChoice: "technical",
    stylePreset: {
      layout: "modernist",
      typography: "expert",
      palette: "encre",
    },
  },
] as const;

export const PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS: readonly ProposalTemplateBundleDefinition[] =
  TEMPLATE_BUNDLE_BASES.map((definition) => {
    const stylePreset = resolveVerbatiStyle(definition.stylePreset);
    return {
      ...definition,
      stylePreset,
      templateId: getProposalTwinTemplateId(stylePreset),
    };
  });

export const PROPOSAL_TYPOGRAPHY_OPTIONS: ReadonlyArray<{
  id: VerbatiTypographyPreset;
  label: string;
  description: string;
}> = [
  {
    id: "signature",
    label: "Serif",
    description: "Fraunces-led headings with a calm body rhythm.",
  },
  {
    id: "engaging",
    label: "Editorial",
    description: "A fuller serif reading voice with more character.",
  },
  {
    id: "expert",
    label: "Mono",
    description: "Sharper technical contrast with utility-led typography.",
  },
] as const;

export const PROPOSAL_LAYOUT_OPTIONS: ReadonlyArray<{
  id: Extract<VerbatiLayoutPreset, "swiss" | "editorial" | "modernist">;
  label: string;
  description: string;
}> = [
  {
    id: "swiss",
    label: "Swiss",
    description: "Quiet grid with broad readability.",
  },
  {
    id: "editorial",
    label: "Magazine",
    description: "Long reading line with editorial pacing.",
  },
  {
    id: "modernist",
    label: "Grid",
    description: "Denser signal and a tighter information ladder.",
  },
] as const;

export function getProposalTemplateBundleDefinition(
  id: ProposalTemplateBundleId,
): ProposalTemplateBundleDefinition {
  return (
    PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS.find((definition) => definition.id === id) ??
    PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS[0]
  );
}

export function getProposalTemplateBundleForStyleChoice(
  choice: ProposalStyleChoice | null | undefined,
): ProposalTemplateBundleId {
  const match = PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS.find(
    (definition) => definition.settingsStyleChoice === choice,
  );

  return match?.id ?? "swiss_serif";
}

export function resolveProposalTemplateBundleId(
  value: unknown,
): ProposalTemplateBundleId | null {
  return typeof value === "string" &&
    PROPOSAL_TEMPLATE_BUNDLE_IDS.includes(value as ProposalTemplateBundleId)
    ? (value as ProposalTemplateBundleId)
    : null;
}

export function findProposalTemplateBundleIdByStylePreset(
  stylePreset: Partial<VerbatiStylePreset> | VerbatiStylePreset | null | undefined,
): ProposalTemplateBundleId | null {
  if (!stylePreset) {
    return null;
  }

  const normalized = resolveVerbatiStyle(stylePreset);
  const match = PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS.find(
    (definition) =>
      definition.stylePreset.layout === normalized.layout &&
      definition.stylePreset.typography === normalized.typography &&
      definition.stylePreset.palette === normalized.palette,
  );

  return match?.id ?? null;
}
