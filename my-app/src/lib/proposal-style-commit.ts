import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { getProposalTwinTemplateId } from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";

export function resolveProposalStyleCommitTemplateId({
  currentTemplateId,
  requestedTemplateId,
  stylePreset,
}: {
  currentTemplateId: ProposalTemplateId | null;
  requestedTemplateId?: ProposalTemplateId | null;
  stylePreset: VerbatiStylePreset;
}): ProposalTemplateId {
  const fallbackTemplateId = getProposalTwinTemplateId(stylePreset);

  if (requestedTemplateId !== undefined) {
    return requestedTemplateId ?? fallbackTemplateId;
  }

  return currentTemplateId ?? fallbackTemplateId;
}
