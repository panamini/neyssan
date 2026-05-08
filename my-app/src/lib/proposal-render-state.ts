import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import {
  DEFAULT_VERBATI_STYLE,
  getProposalTwinTemplateId,
  resolveVerbatiStyle,
  sanitizePersistedVerbatiStyle,
} from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import {
  isProposalTemplateId,
  resolveProposalTemplateId,
} from "../../convex/lib/proposals/renderTemplates";
import { getProposalBundleForDocumentStyleSlot } from "./document-style-slots";
import { getProposalTemplateBundleDefinition } from "./proposal-template-bundles";

type VerbatiStyleCandidate =
  | Partial<VerbatiStylePreset>
  | VerbatiStylePreset
  | null
  | undefined;

export type ProposalRenderStateInput = {
  preferredStylePreset?: VerbatiStyleCandidate;
  preferredTemplateId?: ProposalTemplateId | null;
  storedStylePreset?: VerbatiStyleCandidate;
  storedTemplateId?: ProposalTemplateId | null;
  storedStyleBaseSnapshot?: VerbatiStyleCandidate;
  storedStyleSlotId?: unknown;
  activeCvStylePreset?: VerbatiStyleCandidate;
};

export type ResolvedProposalRenderState = {
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
};

function resolveExplicitProposalTemplateId(
  ...candidates: ReadonlyArray<ProposalTemplateId | null | undefined>
): ProposalTemplateId | null {
  for (const candidate of candidates) {
    if (isProposalTemplateId(candidate)) {
      return resolveProposalTemplateId(candidate);
    }
  }

  return null;
}

export function resolveProposalRenderState(
  input: ProposalRenderStateInput,
): ResolvedProposalRenderState {
  const storedSlotBundleId = getProposalBundleForDocumentStyleSlot(
    input.storedStyleSlotId,
  );
  const storedSlotBundleDefinition = storedSlotBundleId
    ? getProposalTemplateBundleDefinition(storedSlotBundleId)
    : null;

  const stylePreset =
    (input.preferredStylePreset
      ? sanitizePersistedVerbatiStyle(input.preferredStylePreset) ??
        resolveVerbatiStyle(input.preferredStylePreset)
      : null) ??
    (input.storedStylePreset
      ? sanitizePersistedVerbatiStyle(input.storedStylePreset) ??
        resolveVerbatiStyle(input.storedStylePreset)
      : null) ??
    (input.storedStyleBaseSnapshot
      ? sanitizePersistedVerbatiStyle(input.storedStyleBaseSnapshot) ??
        resolveVerbatiStyle(input.storedStyleBaseSnapshot)
      : null) ??
    storedSlotBundleDefinition?.stylePreset ??
    (input.activeCvStylePreset
      ? resolveVerbatiStyle(input.activeCvStylePreset)
      : null) ??
    DEFAULT_VERBATI_STYLE;

  const templateId =
    resolveExplicitProposalTemplateId(
      input.preferredTemplateId,
      input.storedTemplateId,
      storedSlotBundleDefinition?.templateId,
    ) ?? getProposalTwinTemplateId(stylePreset);

  return {
    stylePreset,
    templateId,
  };
}
