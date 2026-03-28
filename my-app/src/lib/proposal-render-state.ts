import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import {
  DEFAULT_VERBATI_STYLE,
  getProposalTwinTemplateId,
  resolveVerbatiStyle,
} from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { resolveProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";

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
  activeCvStylePreset?: VerbatiStyleCandidate;
};

export type ResolvedProposalRenderState = {
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
};

export function resolveProposalRenderState(
  input: ProposalRenderStateInput,
): ResolvedProposalRenderState {
  const stylePreset = resolveVerbatiStyle(
    input.preferredStylePreset ??
      input.storedStylePreset ??
      input.activeCvStylePreset ??
      DEFAULT_VERBATI_STYLE,
  );

  const templateId = input.preferredTemplateId
    ? resolveProposalTemplateId(input.preferredTemplateId)
    : input.storedTemplateId
      ? resolveProposalTemplateId(input.storedTemplateId)
      : getProposalTwinTemplateId(stylePreset);

  return {
    stylePreset,
    templateId,
  };
}
