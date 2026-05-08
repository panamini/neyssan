import type {
  StyleFamilyId,
  VerbatiLayoutPreset,
  VerbatiPalettePreset,
  VerbatiStylePreset,
} from "../features/verbati/types";
import {
  resolveVerbatiFontPairId,
  type VerbatiFontPairId,
} from "../features/verbati/fontCatalog";
import type { ResumeTemplateId } from "./layout/resumeTemplates";
import type { ProposalTemplateBundleId } from "./proposal-template-bundles";

export const DOCUMENT_STYLE_SLOT_IDS = [1, 2, 3] as const;
export type DocumentStyleSlotId = (typeof DOCUMENT_STYLE_SLOT_IDS)[number];
export type DocumentStyleSlotSource = "factory" | "settings";
export type DocumentStyleVersion = 1;

export type DocumentAppearanceSnapshot = {
  familyId?: StyleFamilyId;
  layout: VerbatiLayoutPreset;
  typography: VerbatiFontPairId;
  palette: VerbatiPalettePreset;
  accentHex?: string;
  /** CV-only structural template. Proposal projections intentionally strip it. */
  resumeTemplateId?: ResumeTemplateId;
};

export type DocumentStyleSlotDefinition = {
  id: DocumentStyleSlotId;
  label: string;
  appearance: DocumentAppearanceSnapshot;
  defaultCvTemplateId: ResumeTemplateId;
  proposalTemplateBundleId: ProposalTemplateBundleId;
};

export type DocumentStyleMetadata = {
  verbatiStyleSlotId?: DocumentStyleSlotId;
  verbatiStyleSlotSource?: DocumentStyleSlotSource;
  verbatiStyleSlotNameSnapshot?: string;
  verbatiStyleBaseSnapshot?: DocumentAppearanceSnapshot;
  documentStyleVersion?: DocumentStyleVersion;
};

export const DOCUMENT_STYLE_VERSION: DocumentStyleVersion = 1;

export const PROPOSAL_BUNDLE_BY_DOCUMENT_STYLE_SLOT: Record<
  DocumentStyleSlotId,
  ProposalTemplateBundleId
> = {
  1: "swiss_serif",
  2: "magazine_editorial",
  3: "grid_mono",
};

export const DOCUMENT_STYLE_SLOT_BY_PROPOSAL_BUNDLE: Partial<
  Record<ProposalTemplateBundleId, DocumentStyleSlotId>
> = {
  swiss_serif: 1,
  magazine_editorial: 2,
  grid_mono: 3,
};

export const FACTORY_DOCUMENT_STYLE_SLOTS: readonly DocumentStyleSlotDefinition[] =
  [
    {
      id: 1,
      label: "Style 1",
      appearance: {
        familyId: "workshop",
        layout: "workshop",
        typography: "geist-baskervville",
        palette: "ink",
      },
      defaultCvTemplateId: "workshop_resume_onecol_ats",
      proposalTemplateBundleId: "swiss_serif",
    },
    {
      id: 2,
      label: "Style 2",
      appearance: {
        familyId: "workshop",
        layout: "workshop",
        typography: "quiet-editorial",
        palette: "ink",
      },
      defaultCvTemplateId: "workshop_resume_twocol_ats",
      proposalTemplateBundleId: "magazine_editorial",
    },
    {
      id: 3,
      label: "Style 3",
      appearance: {
        familyId: "workshop",
        layout: "workshop",
        typography: "ledger-sans",
        palette: "ink",
      },
      defaultCvTemplateId: "workshop_resume_twocol_ats",
      proposalTemplateBundleId: "grid_mono",
    },
  ] as const;

export function isDocumentStyleSlotId(
  value: unknown,
): value is DocumentStyleSlotId {
  return DOCUMENT_STYLE_SLOT_IDS.includes(value as DocumentStyleSlotId);
}

export function resolveDocumentStyleSlotId(
  value: unknown,
): DocumentStyleSlotId | null {
  return isDocumentStyleSlotId(value) ? value : null;
}

export function isDocumentStyleSlotSource(
  value: unknown,
): value is DocumentStyleSlotSource {
  return value === "factory" || value === "settings";
}

export function getFactoryDocumentStyleSlot(
  slotId: DocumentStyleSlotId,
): DocumentStyleSlotDefinition {
  return (
    FACTORY_DOCUMENT_STYLE_SLOTS.find((slot) => slot.id === slotId) ??
    FACTORY_DOCUMENT_STYLE_SLOTS[0]
  );
}

export function getDocumentStyleSlotIdForProposalBundle(
  bundleId: ProposalTemplateBundleId | null | undefined,
): DocumentStyleSlotId | null {
  return bundleId
    ? DOCUMENT_STYLE_SLOT_BY_PROPOSAL_BUNDLE[bundleId] ?? null
    : null;
}

export function getProposalBundleForDocumentStyleSlot(
  slotId: unknown,
): ProposalTemplateBundleId | null {
  const resolvedSlotId = resolveDocumentStyleSlotId(slotId);
  return resolvedSlotId
    ? PROPOSAL_BUNDLE_BY_DOCUMENT_STYLE_SLOT[resolvedSlotId]
    : null;
}

export function buildDocumentAppearanceSnapshot(
  style: Pick<
    VerbatiStylePreset,
    "familyId" | "layout" | "typography" | "palette" | "accentHex"
  > & { resumeTemplateId?: ResumeTemplateId },
): DocumentAppearanceSnapshot {
  return {
    ...(style.familyId ? { familyId: style.familyId } : null),
    layout: style.layout,
    typography: resolveVerbatiFontPairId(style.typography),
    palette: style.palette,
    ...(style.palette === "custom" && style.accentHex
      ? { accentHex: style.accentHex }
      : null),
    ...(style.resumeTemplateId
      ? { resumeTemplateId: style.resumeTemplateId }
      : null),
  };
}
