import type { CanonicalDocumentTokens } from "../layout/documentTokens";

export type WorkshopHeadingFitContract = {
  sectionTitleReductionMm: number;
  experienceHeadingSizeAdjustMm: number;
  experienceHeadingLineHeight: number;
  bottomFitSafetyMm: number;
};

export const DEFAULT_WORKSHOP_HEADING_FIT_CONTRACT: WorkshopHeadingFitContract = {
  sectionTitleReductionMm: 0.95,
  experienceHeadingSizeAdjustMm: 0.2,
  experienceHeadingLineHeight: 1.25,
  bottomFitSafetyMm: 0.5,
};

export function resolveWorkshopHeadingFitContract(
  tokens: CanonicalDocumentTokens,
): WorkshopHeadingFitContract {
  return {
    sectionTitleReductionMm:
      tokens.flow.component.main?.sectionTitleReductionMm ??
      DEFAULT_WORKSHOP_HEADING_FIT_CONTRACT.sectionTitleReductionMm,
    experienceHeadingSizeAdjustMm:
      tokens.flow.component.experience?.headingSizeAdjustMm ??
      DEFAULT_WORKSHOP_HEADING_FIT_CONTRACT.experienceHeadingSizeAdjustMm,
    experienceHeadingLineHeight:
      tokens.flow.component.experience?.headingLineHeight ??
      DEFAULT_WORKSHOP_HEADING_FIT_CONTRACT.experienceHeadingLineHeight,
    bottomFitSafetyMm:
      tokens.flow.pagination.bottomFitSafetyMm ??
      DEFAULT_WORKSHOP_HEADING_FIT_CONTRACT.bottomFitSafetyMm,
  };
}
