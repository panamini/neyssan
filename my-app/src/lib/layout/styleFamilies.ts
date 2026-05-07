import type { ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type {
  StyleFamilyId,
  VerbatiStylePreset,
} from "../../features/verbati/types";
import {
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  type ResumeTemplateId,
} from "./resumeTemplates";

export type StyleFamilyDefinition = {
  id: StyleFamilyId;
  label: string;
  description: string;
  defaultTypography: VerbatiStylePreset["typography"];
  defaultPalette: VerbatiStylePreset["palette"];
  resumeTemplateId: ResumeTemplateId;
  proposalTemplateId: ProposalTemplateId;
};

export const STYLE_FAMILY_DEFINITIONS: readonly StyleFamilyDefinition[] = [
  {
    id: "swiss",
    label: "Swiss Minima",
    description:
      "Swiss register typography built on a Robial 17/18 modular field.",
    defaultTypography: "geist-baskervville",
    defaultPalette: "sauge",
    resumeTemplateId: "swiss_resume_legacy",
    proposalTemplateId: "swiss_margin",
  },
  {
    id: "volk-register",
    label: "Volk Register",
    description: "Archival civic register with a quieter, slower field.",
    defaultTypography: "geist-baskervville",
    defaultPalette: "sauge",
    resumeTemplateId: "volk_register_resume_legacy",
    proposalTemplateId: "volk_register",
  },
  {
    id: "two-column",
    label: "Two Column",
    description: "Robial split layout with the accent rail sidebar.",
    defaultTypography: "geist-baskervville",
    defaultPalette: "sauge",
    resumeTemplateId: "two_column_resume_legacy",
    proposalTemplateId: "two_column_rail",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Editorial split layout with a broader, calmer rhythm.",
    defaultTypography: "geist-baskervville",
    defaultPalette: "sauge",
    resumeTemplateId: "editorial_resume_legacy",
    proposalTemplateId: "editorial_wide",
  },
  {
    id: "modernist",
    label: "Modernist",
    description: "Sharper split layout with a stricter signal-heavy cadence.",
    defaultTypography: "geist-baskervville",
    defaultPalette: "sauge",
    resumeTemplateId: "modernist_resume_legacy",
    proposalTemplateId: "modernist_signal",
  },
  {
    id: "quire",
    label: "Quire",
    description: "Bookish split layout with quieter literary spacing.",
    defaultTypography: "geist-baskervville",
    defaultPalette: "sauge",
    resumeTemplateId: "quire_resume_legacy",
    proposalTemplateId: "quire_margin",
  },
  {
    id: "workshop",
    label: "Workshop",
    description: "Family identity scaffold for the workshop paired templates.",
    defaultTypography: "geist-baskervville",
    defaultPalette: "sauge",
    resumeTemplateId: WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
    proposalTemplateId: "workshop_proposal_margin",
  },
] as const;

export function resolveStyleFamilyId(value: unknown): StyleFamilyId | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return (
    STYLE_FAMILY_DEFINITIONS.find((family) => family.id === value)?.id ?? null
  );
}

export function getStyleFamilyDefinition(
  familyId: StyleFamilyId | null | undefined,
): StyleFamilyDefinition {
  return (
    STYLE_FAMILY_DEFINITIONS.find((family) => family.id === familyId) ??
    STYLE_FAMILY_DEFINITIONS[0]
  );
}

export function resolveStyleFamilyFromStyle(
  style: Pick<VerbatiStylePreset, "familyId" | "layout"> | null | undefined,
): StyleFamilyDefinition {
  return getStyleFamilyDefinition(
    resolveStyleFamilyId(style?.familyId) ?? resolveStyleFamilyId(style?.layout),
  );
}

export function getStyleFamilyProposalTemplateId(
  familyId: StyleFamilyId | null | undefined,
): ProposalTemplateId {
  return getStyleFamilyDefinition(familyId).proposalTemplateId;
}

export function getStyleFamilyResumeTemplateId(
  familyId: StyleFamilyId | null | undefined,
): ResumeTemplateId {
  return getStyleFamilyDefinition(familyId).resumeTemplateId;
}
