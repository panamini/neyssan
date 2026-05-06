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
    label: "Workshop Serif",
    description: "Calm workshop structure with a softer serif-led headline.",
    settingsStyleChoice: "balanced",
    stylePreset: {
      layout: "workshop",
      typography: "geist-baskervville",
      palette: "terre",
    },
  },
  {
    id: "swiss_mono",
    label: "Workshop Mono",
    description: "Clean workshop structure with a sharper mono-led register.",
    stylePreset: {
      layout: "workshop",
      typography: "expert",
      palette: "ink",
    },
  },
  {
    id: "magazine_editorial",
    label: "Workshop Editorial",
    description: "Workshop structure with a richer reading voice.",
    settingsStyleChoice: "warm",
    stylePreset: {
      layout: "workshop",
      typography: "engaging",
      palette: "cobalt",
    },
  },
  {
    id: "magazine_serif",
    label: "Workshop Signature",
    description: "Workshop structure with a calmer serif rhythm.",
    stylePreset: {
      layout: "workshop",
      typography: "signature",
      palette: "ochre",
    },
  },
  {
    id: "grid_mono",
    label: "Workshop Signal",
    description: "Workshop structure with precise technical contrast.",
    settingsStyleChoice: "technical",
    stylePreset: {
      layout: "workshop",
      typography: "expert",
      palette: "ink",
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
  id: Extract<VerbatiLayoutPreset, "workshop">;
  label: string;
  description: string;
}> = [
  {
    id: "workshop",
    label: "Workshop",
    description: "Document-first layout for CV and proposal parity.",
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
