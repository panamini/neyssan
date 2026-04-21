import {
  BASE_PROPOSAL_TITLE_SCALE_MM,
  formatEm,
  formatMm,
  formatPt,
  formatUnitless,
  mmToTwip,
  ptLineHeightToTwip,
  ptToMm,
  ptToHalfPoint,
  type CanonicalDocumentTokens,
} from "./documentTokens";
import { densityPtToPreviewMm } from "./documentTokenNormalizer";
import type { ResumeLayoutVariantId } from "../../features/verbati/resume/resume.types";

export type CanonicalVarDescriptor = {
  name: string;
  fieldPath: string;
  classification: "canonical" | "runtime";
  resolve: (tokens: CanonicalDocumentTokens) => string | undefined;
};

function serializeFromDescriptors(
  tokens: CanonicalDocumentTokens,
  descriptors: CanonicalVarDescriptor[],
): Record<string, string> {
  return descriptors.reduce<Record<string, string>>((result, descriptor) => {
    const value = descriptor.resolve(tokens);
    if (value !== undefined) {
      result[descriptor.name] = value;
    }
    return result;
  }, {});
}

export const RESUME_PREVIEW_VAR_DESCRIPTORS: CanonicalVarDescriptor[] = [
  {
    name: "--page-width",
    fieldPath: "geometry.page.widthMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.widthMm),
  },
  {
    name: "--page-height",
    fieldPath: "geometry.page.heightMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.heightMm),
  },
  {
    name: "--page-radius",
    fieldPath: "geometry.page.radiusMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.radiusMm),
  },
  {
    name: "--margin-top",
    fieldPath: "geometry.page.margin.topMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.margin.topMm),
  },
  {
    name: "--margin-right",
    fieldPath: "geometry.page.margin.rightMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.margin.rightMm),
  },
  {
    name: "--margin-bottom",
    fieldPath: "geometry.page.margin.bottomMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.margin.bottomMm),
  },
  {
    name: "--margin-left",
    fieldPath: "geometry.page.margin.leftMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.margin.leftMm),
  },
  {
    name: "--sidebar-width",
    fieldPath: "geometry.columns.sidebarMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.columns?.sidebarMm),
  },
  {
    name: "--gutter-width",
    fieldPath: "geometry.columns.gutterMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.columns?.gutterMm),
  },
  {
    name: "--main-width",
    fieldPath: "geometry.columns.mainMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.columns?.mainMm),
  },
  {
    name: "--header-row-gap",
    fieldPath: "flow.rhythm.headerGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.headerGapMm),
  },
  {
    name: "--header-summary-width",
    fieldPath: "flow.measure.summaryWidthMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.measure.summaryWidthMm),
  },
  {
    name: "--header-bottom-padding",
    fieldPath: "flow.header.bottomPaddingMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.header.bottomPaddingMm),
  },
  {
    name: "--header-title-margin-top",
    fieldPath: "flow.header.titleMarginTopMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.header.titleMarginTopMm),
  },
  {
    name: "--text-display-size",
    fieldPath: "flow.type.display.sizePt",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.flow.type.display.sizePt === undefined
        ? undefined
        : formatMm(ptToMm(tokens.flow.type.display.sizePt)),
  },
  {
    name: "--text-display-line",
    fieldPath: "flow.type.display.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.display.lineHeight),
  },
  {
    name: "--text-title-size",
    fieldPath: "flow.type.title.sizePt",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.flow.type.title.sizePt === undefined
        ? undefined
        : formatMm(ptToMm(tokens.flow.type.title.sizePt)),
  },
  {
    name: "--text-title-line",
    fieldPath: "flow.type.title.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.title.lineHeight),
  },
  {
    name: "--text-body-size",
    fieldPath: "flow.type.body.sizePt",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.flow.type.body.sizePt === undefined
        ? undefined
        : formatMm(ptToMm(tokens.flow.type.body.sizePt)),
  },
  {
    name: "--text-body-line",
    fieldPath: "flow.type.body.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.body.lineHeight),
  },
  {
    name: "--text-body-sm-size",
    fieldPath: "flow.type.bodySm.sizePt",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.flow.type.bodySm.sizePt === undefined
        ? undefined
        : formatMm(ptToMm(tokens.flow.type.bodySm.sizePt)),
  },
  {
    name: "--text-body-sm-line",
    fieldPath: "flow.type.bodySm.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.bodySm.lineHeight),
  },
  {
    name: "--text-caption-size",
    fieldPath: "flow.type.label.sizePt",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.flow.type.label.sizePt === undefined
        ? undefined
        : formatMm(ptToMm(tokens.flow.type.label.sizePt)),
  },
  {
    name: "--text-caption-line",
    fieldPath: "flow.type.label.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.label.lineHeight),
  },
  {
    name: "--text-meta-size",
    fieldPath: "flow.type.meta.sizePt",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.flow.type.meta.sizePt === undefined
        ? undefined
        : formatMm(ptToMm(tokens.flow.type.meta.sizePt)),
  },
  {
    name: "--text-meta-line",
    fieldPath: "flow.type.meta.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.meta.lineHeight),
  },
  {
    name: "--body-row-gap",
    fieldPath: "flow.rhythm.sectionGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.sectionGapMm),
  },
  {
    name: "--sidebar-right-padding",
    fieldPath: "flow.component.sidebar.rightPaddingMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.flow.component.sidebar?.rightPaddingMm),
  },
  {
    name: "--main-left-padding",
    fieldPath: "flow.component.main.leftPaddingMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.main?.leftPaddingMm),
  },
  {
    name: "--sidebar-section-gap",
    fieldPath: "flow.component.sidebar.sectionGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.sidebar?.sectionGapMm),
  },
  {
    name: "--sidebar-title-margin",
    fieldPath: "flow.component.sidebar.titleMarginBottomMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.flow.component.sidebar?.titleMarginBottomMm),
  },
  {
    name: "--sidebar-title-padding",
    fieldPath: "flow.component.sidebar.titlePaddingBottomMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.flow.component.sidebar?.titlePaddingBottomMm),
  },
  {
    name: "--sidebar-content-gap",
    fieldPath: "flow.component.sidebar.contentGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.sidebar?.contentGapMm),
  },
  {
    name: "--main-section-gap",
    fieldPath: "flow.component.main.sectionGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.main?.sectionGapMm),
  },
  {
    name: "--main-heading-gap",
    fieldPath: "flow.component.main.headingGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.main?.headingGapMm),
  },
  {
    name: "--main-heading-margin",
    fieldPath: "flow.component.main.headingMarginBottomMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.flow.component.main?.headingMarginBottomMm),
  },
  {
    name: "--skill-gap",
    fieldPath: "flow.component.skill.gapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.skill?.gapMm),
  },
  {
    name: "--skill-pad-inline",
    fieldPath: "flow.component.skill.padInlineMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.skill?.padInlineMm),
  },
  {
    name: "--skill-pad-block",
    fieldPath: "flow.component.skill.padBlockMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.skill?.padBlockMm),
  },
  {
    name: "--experience-date-column",
    fieldPath: "flow.component.experience.dateColumnWidthMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.flow.component.experience?.dateColumnWidthMm),
  },
  {
    name: "--experience-column-gap",
    fieldPath: "flow.component.experience.columnGapMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.flow.component.experience?.columnGapMm),
  },
  {
    name: "--experience-item-gap",
    fieldPath: "flow.component.experience.itemGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.experience?.itemGapMm),
  },
  {
    name: "--experience-org-margin",
    fieldPath: "flow.component.experience.orgMarginBottomMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.flow.component.experience?.orgMarginBottomMm),
  },
  {
    name: "--experience-bullets-padding",
    fieldPath: "flow.component.experience.bulletsPaddingLeftMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.flow.component.experience?.bulletsPaddingLeftMm),
  },
  {
    name: "--experience-bullets-gap",
    fieldPath: "flow.component.experience.bulletsGapMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.flow.component.experience?.bulletsGapMm),
  },
  {
    name: "--project-gap",
    fieldPath: "flow.component.project.gapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.project?.gapMm),
  },
  {
    name: "--project-padding",
    fieldPath: "flow.component.project.paddingMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.project?.paddingMm),
  },
  {
    name: "--education-gap",
    fieldPath: "flow.component.education.itemGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.education?.itemGapMm),
  },
  {
    name: "--skill-gap",
    fieldPath: "flow.component.skill.gapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.skill?.gapMm),
  },
  {
    name: "--skill-padding-inline",
    fieldPath: "flow.component.skill.padInlineMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.skill?.padInlineMm),
  },
  {
    name: "--skill-padding-block",
    fieldPath: "flow.component.skill.padBlockMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.skill?.padBlockMm),
  },
  {
    name: "--volk-grid-left",
    fieldPath: "geometry.primitives.volkGrid.left",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.primitives?.volkGrid?.left),
  },
  {
    name: "--volk-grid-header-width",
    fieldPath: "geometry.primitives.volkGrid.headerWidth",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.headerWidth),
  },
  {
    name: "--volk-grid-body-width",
    fieldPath: "geometry.primitives.volkGrid.bodyWidth",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.bodyWidth),
  },
  {
    name: "--volk-grid-title-top",
    fieldPath: "geometry.primitives.volkGrid.titleTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.titleTop),
  },
  {
    name: "--volk-grid-subtitle-top",
    fieldPath: "geometry.primitives.volkGrid.subtitleTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.subtitleTop),
  },
  {
    name: "--volk-grid-sender-top",
    fieldPath: "geometry.primitives.volkGrid.senderTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.senderTop),
  },
  {
    name: "--volk-grid-meta-top",
    fieldPath: "geometry.primitives.volkGrid.metaTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.metaTop),
  },
  {
    name: "--volk-grid-subject-top",
    fieldPath: "geometry.primitives.volkGrid.subjectTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.subjectTop),
  },
  {
    name: "--volk-grid-subject-value-top",
    fieldPath: "geometry.primitives.volkGrid.subjectValueTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.subjectValueTop),
  },
  {
    name: "--volk-grid-subject-value-left",
    fieldPath: "geometry.primitives.volkGrid.subjectValueLeft",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.subjectValueLeft),
  },
  {
    name: "--volk-grid-body-top",
    fieldPath: "geometry.primitives.volkGrid.bodyTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.bodyTop),
  },
  {
    name: "--volk-grid-dot-left",
    fieldPath: "geometry.primitives.volkGrid.dotLeft",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.dotLeft),
  },
  {
    name: "--volk-grid-dot-top",
    fieldPath: "geometry.primitives.volkGrid.dotTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.dotTop),
  },
  {
    name: "--volk-grid-bottom-margin",
    fieldPath: "geometry.primitives.volkGrid.bottomMargin",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.bottomMargin),
  },
  {
    name: "--volk-grid-meta-left-0",
    fieldPath: "geometry.primitives.volkGrid.metaLeft0",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.metaLeft0),
  },
  {
    name: "--volk-grid-meta-left-1",
    fieldPath: "geometry.primitives.volkGrid.metaLeft1",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.metaLeft1),
  },
  {
    name: "--volk-grid-meta-left-2",
    fieldPath: "geometry.primitives.volkGrid.metaLeft2",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.metaLeft2),
  },
  {
    name: "--volk-grid-meta-left-3",
    fieldPath: "geometry.primitives.volkGrid.metaLeft3",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.metaLeft3),
  },
  {
    name: "--display-size-adjust",
    fieldPath: "flow.density.displayAdjustPt",
    classification: "canonical",
    resolve: (tokens) =>
      densityPtToPreviewMm(tokens.flow.density.displayAdjustPt),
  },
  {
    name: "--title-size-adjust",
    fieldPath: "flow.density.titleAdjustPt",
    classification: "canonical",
    resolve: (tokens) =>
      densityPtToPreviewMm(tokens.flow.density.titleAdjustPt),
  },
  {
    name: "--body-size-adjust",
    fieldPath: "flow.density.bodyAdjustPt",
    classification: "canonical",
    resolve: (tokens) => densityPtToPreviewMm(tokens.flow.density.bodyAdjustPt),
  },
  {
    name: "--body-sm-size-adjust",
    fieldPath: "flow.density.bodySmAdjustPt",
    classification: "canonical",
    resolve: (tokens) =>
      densityPtToPreviewMm(tokens.flow.density.bodySmAdjustPt),
  },
  {
    name: "--section-gap-adjust",
    fieldPath: "flow.density.sectionGapAdjustMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.density.sectionGapAdjustMm),
  },
  {
    name: "--heading-margin-adjust",
    fieldPath: "flow.density.headingMarginAdjustMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.density.headingMarginAdjustMm),
  },
  {
    name: "--bullet-gap-adjust",
    fieldPath: "flow.density.bulletGapAdjustMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.density.bulletGapAdjustMm),
  },
  {
    name: "--project-gap-adjust",
    fieldPath: "flow.density.projectGapAdjustMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.density.projectGapAdjustMm),
  },
  {
    name: "--project-padding-adjust",
    fieldPath: "flow.density.projectPaddingAdjustMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.density.projectPaddingAdjustMm),
  },
];

export const PROPOSAL_PREVIEW_VAR_DESCRIPTORS: CanonicalVarDescriptor[] = [
  {
    name: "--proposal-template-left-zone-mm",
    fieldPath: "geometry.template.leftZoneMm",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.geometry.template?.leftZoneMm),
  },
  {
    name: "--proposal-template-top-offset-mm",
    fieldPath: "geometry.template.topOffsetMm",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.geometry.template?.topOffsetMm),
  },
  {
    name: "--proposal-template-body-start-mm",
    fieldPath: "geometry.template.bodyStartMm",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.geometry.template?.bodyStartMm),
  },
  {
    name: "--proposal-template-bottom-margin-mm",
    fieldPath: "geometry.template.bottomMarginMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatUnitless(tokens.geometry.template?.bottomMarginMm),
  },
  {
    name: "--proposal-template-right-margin-mm",
    fieldPath: "geometry.template.rightMarginMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatUnitless(tokens.geometry.template?.rightMarginMm),
  },
  {
    name: "--proposal-document-reading-measure-max",
    fieldPath: "flow.measure.proposalReadingWidthCh",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.flow.measure.proposalReadingWidthCh === undefined
        ? undefined
        : `${tokens.flow.measure.proposalReadingWidthCh}ch`,
  },
  {
    name: "--proposal-document-title-scale",
    fieldPath: "flow.template.titleScaleMultiplier",
    classification: "canonical",
    resolve: (tokens) =>
      formatUnitless(
        (tokens.flow.template.titleScaleMultiplier ?? 1) *
          BASE_PROPOSAL_TITLE_SCALE_MM,
      ),
  },
  {
    name: "--proposal-document-font-family",
    fieldPath: "appearance.font.body.family",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.font.body.family,
  },
  {
    name: "--proposal-document-font-size",
    fieldPath: "flow.type.body.sizePt",
    classification: "canonical",
    resolve: (tokens) => formatPt(tokens.flow.type.body.sizePt),
  },
  {
    name: "--proposal-document-font-weight",
    fieldPath: "appearance.font.body.weight",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.font.body.weight === undefined
        ? undefined
        : String(tokens.appearance.font.body.weight),
  },
  {
    name: "--proposal-document-letter-spacing",
    fieldPath: "flow.type.body.resolvedTrackingEm",
    classification: "canonical",
    resolve: (tokens) =>
      formatEm(tokens.flow.type.body.resolvedTrackingEm) ??
      formatEm(tokens.appearance.font.authoredTrackingEm),
  },
  {
    name: "--proposal-document-line-height",
    fieldPath: "flow.type.body.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.body.lineHeight),
  },
  {
    name: "--volk-grid-left",
    fieldPath: "geometry.primitives.volkGrid.left",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.primitives?.volkGrid?.left),
  },
  {
    name: "--volk-grid-header-width",
    fieldPath: "geometry.primitives.volkGrid.headerWidth",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.headerWidth),
  },
  {
    name: "--volk-grid-body-width",
    fieldPath: "geometry.primitives.volkGrid.bodyWidth",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.bodyWidth),
  },
  {
    name: "--volk-grid-title-top",
    fieldPath: "geometry.primitives.volkGrid.titleTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.titleTop),
  },
  {
    name: "--volk-grid-subtitle-top",
    fieldPath: "geometry.primitives.volkGrid.subtitleTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.subtitleTop),
  },
  {
    name: "--volk-grid-sender-top",
    fieldPath: "geometry.primitives.volkGrid.senderTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.senderTop),
  },
  {
    name: "--volk-grid-meta-top",
    fieldPath: "geometry.primitives.volkGrid.metaTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.metaTop),
  },
  {
    name: "--volk-grid-subject-top",
    fieldPath: "geometry.primitives.volkGrid.subjectTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.subjectTop),
  },
  {
    name: "--volk-grid-subject-value-top",
    fieldPath: "geometry.primitives.volkGrid.subjectValueTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.subjectValueTop),
  },
  {
    name: "--volk-grid-subject-value-left",
    fieldPath: "geometry.primitives.volkGrid.subjectValueLeft",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.subjectValueLeft),
  },
  {
    name: "--volk-grid-body-top",
    fieldPath: "geometry.primitives.volkGrid.bodyTop",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.bodyTop),
  },
  {
    name: "--volk-grid-dot-left",
    fieldPath: "geometry.primitives.volkGrid.dotLeft",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.volkGrid?.dotLeft),
  },
  {
    name: "--volk-grid-dot-top",
    fieldPath: "geometry.primitives.volkGrid.dotTop",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.primitives?.volkGrid?.dotTop),
  },
];

export const PROPOSAL_RUNTIME_VAR_DESCRIPTORS: CanonicalVarDescriptor[] = [
  {
    name: "--proposal-inline-mm",
    fieldPath: "runtime.derived.proposalInlineMmPx",
    classification: "runtime",
    resolve: () => undefined,
  },
  {
    name: "--proposal-block-mm",
    fieldPath: "runtime.derived.proposalBlockMmPx",
    classification: "runtime",
    resolve: () => undefined,
  },
  {
    name: "--proposal-document-page-gap",
    fieldPath: "runtime.rendererCompensation.proposalDocumentPageGapPx",
    classification: "runtime",
    resolve: (tokens) => {
      const value =
        tokens.runtime.rendererCompensation.proposalDocumentPageGapPx;
      return value === undefined ? undefined : `${value}px`;
    },
  },
];

export const EXPORT_VAR_DESCRIPTORS: CanonicalVarDescriptor[] = [
  {
    name: "--page-width",
    fieldPath: "geometry.page.widthMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.widthMm),
  },
  {
    name: "--page-height",
    fieldPath: "geometry.page.heightMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.heightMm),
  },
  {
    name: "--page-margin-top",
    fieldPath: "geometry.page.margin.topMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.margin.topMm),
  },
  {
    name: "--page-margin-right",
    fieldPath: "geometry.page.margin.rightMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.margin.rightMm),
  },
  {
    name: "--page-margin-bottom",
    fieldPath: "geometry.page.margin.bottomMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.margin.bottomMm),
  },
  {
    name: "--page-margin-left",
    fieldPath: "geometry.page.margin.leftMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.page.margin.leftMm),
  },
  {
    name: "--page-sidebar",
    fieldPath: "geometry.columns.sidebarMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.columns?.sidebarMm),
  },
  {
    name: "--page-gutter",
    fieldPath: "geometry.columns.gutterMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.columns?.gutterMm),
  },
  {
    name: "--page-main",
    fieldPath: "geometry.columns.mainMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.geometry.columns?.mainMm),
  },
  {
    name: "--robial-step-a",
    fieldPath: "geometry.primitives.robialStep.stepAMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.robialStep?.stepAMm),
  },
  {
    name: "--robial-step-b",
    fieldPath: "geometry.primitives.robialStep.stepBMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.robialStep?.stepBMm),
  },
  {
    name: "--robial-step-half",
    fieldPath: "geometry.primitives.robialStep.halfStepMm",
    classification: "canonical",
    resolve: (tokens) =>
      formatMm(tokens.geometry.primitives?.robialStep?.halfStepMm),
  },
  {
    name: "--flow-body-size",
    fieldPath: "flow.type.body.sizePt",
    classification: "canonical",
    resolve: (tokens) => formatPt(tokens.flow.type.body.sizePt),
  },
  {
    name: "--flow-body-line",
    fieldPath: "flow.type.body.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.body.lineHeight),
  },
  {
    name: "--flow-meta-size",
    fieldPath: "flow.type.meta.sizePt",
    classification: "canonical",
    resolve: (tokens) => formatPt(tokens.flow.type.meta.sizePt),
  },
  {
    name: "--flow-meta-line",
    fieldPath: "flow.type.meta.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.meta.lineHeight),
  },
  {
    name: "--flow-label-size",
    fieldPath: "flow.type.label.sizePt",
    classification: "canonical",
    resolve: (tokens) => formatPt(tokens.flow.type.label.sizePt),
  },
  {
    name: "--flow-label-line",
    fieldPath: "flow.type.label.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.label.lineHeight),
  },
  {
    name: "--flow-title-size",
    fieldPath: "flow.type.title.sizePt",
    classification: "canonical",
    resolve: (tokens) => formatPt(tokens.flow.type.title.sizePt),
  },
  {
    name: "--flow-title-line",
    fieldPath: "flow.type.title.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.title.lineHeight),
  },
  {
    name: "--flow-subtitle-size",
    fieldPath: "flow.type.subtitle.sizePt",
    classification: "canonical",
    resolve: (tokens) => formatPt(tokens.flow.type.subtitle.sizePt),
  },
  {
    name: "--flow-subtitle-line",
    fieldPath: "flow.type.subtitle.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.subtitle.lineHeight),
  },
  {
    name: "--flow-summary-size",
    fieldPath: "flow.type.summary.sizePt",
    classification: "canonical",
    resolve: (tokens) => formatPt(tokens.flow.type.summary.sizePt),
  },
  {
    name: "--flow-summary-line",
    fieldPath: "flow.type.summary.lineHeight",
    classification: "canonical",
    resolve: (tokens) => formatUnitless(tokens.flow.type.summary.lineHeight),
  },
  {
    name: "--flow-summary-measure",
    fieldPath: "flow.measure.summaryWidthMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.measure.summaryWidthMm),
  },
  {
    name: "--flow-section-gap",
    fieldPath: "flow.rhythm.sectionGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.sectionGapMm),
  },
  {
    name: "--flow-stack-gap",
    fieldPath: "flow.rhythm.stackGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.stackGapMm),
  },
  {
    name: "--flow-entry-gap",
    fieldPath: "flow.rhythm.entryGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.entryGapMm),
  },
  {
    name: "--flow-entry-head-gap",
    fieldPath: "flow.rhythm.entryHeadGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.entryHeadGapMm),
  },
  {
    name: "--flow-list-gap",
    fieldPath: "flow.rhythm.listGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.listGapMm),
  },
  {
    name: "--flow-tag-gap",
    fieldPath: "flow.component.tag.gapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.tag?.gapMm),
  },
  {
    name: "--flow-tag-row-gap",
    fieldPath: "flow.component.tag.rowGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.tag?.rowGapMm),
  },
  {
    name: "--flow-tag-pad-block",
    fieldPath: "flow.component.tag.padBlockMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.tag?.padBlockMm),
  },
  {
    name: "--flow-tag-pad-inline",
    fieldPath: "flow.component.tag.padInlineMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.component.tag?.padInlineMm),
  },
  {
    name: "--flow-sidebar-pad-top",
    fieldPath: "flow.rhythm.sidebarPadTopMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.sidebarPadTopMm),
  },
  {
    name: "--flow-rule-pad-top",
    fieldPath: "flow.rhythm.rulePadTopMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.rulePadTopMm),
  },
  {
    name: "--flow-header-gap",
    fieldPath: "flow.rhythm.headerGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.headerGapMm),
  },
  {
    name: "--flow-proposal-gap",
    fieldPath: "flow.rhythm.stackGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.stackGapMm),
  },
  {
    name: "--flow-closing-gap",
    fieldPath: "flow.rhythm.closingGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.closingGapMm),
  },
  {
    name: "--flow-closing-name-gap",
    fieldPath: "flow.rhythm.closingNameGapMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.rhythm.closingNameGapMm),
  },
  {
    name: "--flow-reading-measure",
    fieldPath:
      "flow.measure.resumeReadingWidthMm|flow.measure.proposalReadingWidthCh",
    classification: "canonical",
    resolve: (tokens) => {
      if (tokens.flow.measure.proposalReadingWidthCh !== undefined) {
        return `${tokens.flow.measure.proposalReadingWidthCh}ch`;
      }
      return formatMm(tokens.flow.measure.resumeReadingWidthMm);
    },
  },
  {
    name: "--flow-entry-meta-width",
    fieldPath: "flow.measure.resumeEntryMetaWidthMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.measure.resumeEntryMetaWidthMm),
  },
  {
    name: "--flow-proposal-meta-width",
    fieldPath: "flow.measure.proposalMetaWidthMm",
    classification: "canonical",
    resolve: (tokens) => formatMm(tokens.flow.measure.proposalMetaWidthMm),
  },
  {
    name: "--proposal-title-size",
    fieldPath: "flow.type.title.sizePt*flow.template.titleScaleMultiplier",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.flow.measure.proposalReadingWidthCh === undefined &&
      tokens.flow.template.titleScaleMultiplier === undefined
        ? undefined
        : formatPt(
            (tokens.flow.type.title.sizePt ?? 0) *
              (tokens.flow.template.titleScaleMultiplier ?? 1),
          ),
  },
  {
    name: "--proposal-title-line",
    fieldPath: "flow.type.title.lineHeight",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.flow.measure.proposalReadingWidthCh === undefined &&
      tokens.flow.template.titleScaleMultiplier === undefined
        ? undefined
        : formatUnitless(tokens.flow.type.title.lineHeight),
  },
  {
    name: "--accent",
    fieldPath: "appearance.theme.accent",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.theme.accent,
  },
  {
    name: "--ink",
    fieldPath: "appearance.theme.ink",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.theme.ink,
  },
  {
    name: "--muted",
    fieldPath: "appearance.theme.mutedInk",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.theme.mutedInk,
  },
  {
    name: "--line",
    fieldPath: "appearance.theme.line",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.theme.line,
  },
  {
    name: "--header-rule",
    fieldPath: "appearance.theme.headerRule",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.theme.headerRule,
  },
  {
    name: "--rule-strong",
    fieldPath: "appearance.theme.ruleStrong",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.theme.ruleStrong,
  },
  {
    name: "--sidebar-fill",
    fieldPath: "appearance.theme.sidebarFill",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.theme.sidebarFill,
  },
  {
    name: "--tag-fill",
    fieldPath: "appearance.theme.tagFill",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.theme.tagFill,
  },
  {
    name: "--paper",
    fieldPath: "appearance.theme.paper",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.theme.paper,
  },
  {
    name: "--heading-font",
    fieldPath: "appearance.font.heading.family",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.font.heading.family,
  },
  {
    name: "--body-font",
    fieldPath: "appearance.font.body.family",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.font.body.family,
  },
  {
    name: "--decor-page-background",
    fieldPath: "appearance.decor.export.pageBackground",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.pageBackground,
  },
  {
    name: "--decor-header-background",
    fieldPath: "appearance.decor.export.headerBackground",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.headerBackground,
  },
  {
    name: "--decor-header-border-color",
    fieldPath: "appearance.decor.export.headerBorderColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.headerBorderColor,
  },
  {
    name: "--decor-header-border-width",
    fieldPath: "appearance.decor.export.headerBorderWidth",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.headerBorderWidth,
  },
  {
    name: "--decor-header-shadow",
    fieldPath: "appearance.decor.export.headerShadow",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.headerShadow,
  },
  {
    name: "--decor-header-aux-shadow",
    fieldPath: "appearance.decor.export.headerAuxShadow",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.headerAuxShadow,
  },
  {
    name: "--decor-sidebar-background",
    fieldPath: "appearance.decor.export.sidebarBackground",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.sidebarBackground,
  },
  {
    name: "--decor-sidebar-rule-width",
    fieldPath: "appearance.decor.export.sidebarRuleWidth",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.sidebarRuleWidth,
  },
  {
    name: "--decor-sidebar-shadow",
    fieldPath: "appearance.decor.export.sidebarShadow",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.sidebarShadow,
  },
  {
    name: "--decor-section-rule-border-color",
    fieldPath: "appearance.decor.export.sectionRuleBorderColor",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.sectionRuleBorderColor,
  },
  {
    name: "--decor-section-rule-width",
    fieldPath: "appearance.decor.export.sectionRuleWidth",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.sectionRuleWidth,
  },
  {
    name: "--decor-section-rule-shadow",
    fieldPath: "appearance.decor.export.sectionRuleShadow",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.sectionRuleShadow,
  },
  {
    name: "--decor-section-title-color",
    fieldPath: "appearance.decor.export.sectionTitleColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.sectionTitleColor,
  },
  {
    name: "--decor-section-title-font-family",
    fieldPath: "appearance.decor.export.sectionTitleFontFamily",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.sectionTitleFontFamily,
  },
  {
    name: "--decor-meta-label-color",
    fieldPath: "appearance.decor.export.metaLabelColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.metaLabelColor,
  },
  {
    name: "--decor-meta-label-font-family",
    fieldPath: "appearance.decor.export.metaLabelFontFamily",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.metaLabelFontFamily,
  },
  {
    name: "--decor-tag-border-color",
    fieldPath: "appearance.decor.export.tagBorderColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.tagBorderColor,
  },
  {
    name: "--decor-tag-border-width",
    fieldPath: "appearance.decor.export.tagBorderWidth",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.tagBorderWidth,
  },
  {
    name: "--decor-tag-background",
    fieldPath: "appearance.decor.export.tagBackground",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.tagBackground,
  },
  {
    name: "--decor-tag-shadow",
    fieldPath: "appearance.decor.export.tagShadow",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.tagShadow,
  },
  {
    name: "--decor-tag-border-radius",
    fieldPath: "appearance.decor.export.tagBorderRadius",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.tagBorderRadius,
  },
  {
    name: "--decor-doc-name-color",
    fieldPath: "appearance.decor.export.docNameColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.docNameColor,
  },
  {
    name: "--decor-doc-name-font-weight",
    fieldPath: "appearance.decor.export.docNameFontWeight",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.docNameFontWeight,
  },
  {
    name: "--decor-doc-name-letter-spacing",
    fieldPath: "appearance.decor.export.docNameLetterSpacing",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.docNameLetterSpacing,
  },
  {
    name: "--decor-doc-title-color",
    fieldPath: "appearance.decor.export.docTitleColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.docTitleColor,
  },
  {
    name: "--decor-doc-title-font-style",
    fieldPath: "appearance.decor.export.docTitleFontStyle",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.docTitleFontStyle,
  },
  {
    name: "--decor-doc-summary-color",
    fieldPath: "appearance.decor.export.docSummaryColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.docSummaryColor,
  },
  {
    name: "--decor-entry-title-color",
    fieldPath: "appearance.decor.export.entryTitleColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.entryTitleColor,
  },
  {
    name: "--decor-entry-title-font-family",
    fieldPath: "appearance.decor.export.entryTitleFontFamily",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.entryTitleFontFamily,
  },
  {
    name: "--decor-entry-title-font-weight",
    fieldPath: "appearance.decor.export.entryTitleFontWeight",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.entryTitleFontWeight,
  },
  {
    name: "--decor-entry-meta-color",
    fieldPath: "appearance.decor.export.entryMetaColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.entryMetaColor,
  },
  {
    name: "--decor-entry-meta-font-style",
    fieldPath: "appearance.decor.export.entryMetaFontStyle",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.entryMetaFontStyle,
  },
  {
    name: "--decor-support-text-primary",
    fieldPath: "appearance.decor.export.supportTextPrimaryColor",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.supportTextPrimaryColor,
  },
  {
    name: "--decor-support-text-secondary",
    fieldPath: "appearance.decor.export.supportTextSecondaryColor",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.supportTextSecondaryColor,
  },
  {
    name: "--decor-support-accent",
    fieldPath: "appearance.decor.export.supportAccentColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.supportAccentColor,
  },
  {
    name: "--decor-support-rule-color",
    fieldPath: "appearance.decor.export.supportRuleColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.supportRuleColor,
  },
  {
    name: "--decor-proposal-title-color",
    fieldPath: "appearance.decor.export.proposalTitleColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.proposalTitleColor,
  },
  {
    name: "--decor-proposal-title-font-weight",
    fieldPath: "appearance.decor.export.proposalTitleFontWeight",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.proposalTitleFontWeight,
  },
  {
    name: "--decor-proposal-title-letter-spacing",
    fieldPath: "appearance.decor.export.proposalTitleLetterSpacing",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.proposalTitleLetterSpacing,
  },
  {
    name: "--decor-proposal-title-font-style",
    fieldPath: "appearance.decor.export.proposalTitleFontStyle",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.proposalTitleFontStyle,
  },
  {
    name: "--decor-proposal-meta-color",
    fieldPath: "appearance.decor.export.proposalMetaColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.proposalMetaColor,
  },
  {
    name: "--decor-proposal-meta-font-style",
    fieldPath: "appearance.decor.export.proposalMetaFontStyle",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.proposalMetaFontStyle,
  },
  {
    name: "--decor-meta-value-color",
    fieldPath: "appearance.decor.export.metaValueColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.metaValueColor,
  },
  {
    name: "--decor-subject-background",
    fieldPath: "appearance.decor.export.subjectBackground",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.subjectBackground,
  },
  {
    name: "--decor-subject-shadow",
    fieldPath: "appearance.decor.export.subjectShadow",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.subjectShadow,
  },
  {
    name: "--decor-signoff-color",
    fieldPath: "appearance.decor.export.signoffColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.signoffColor,
  },
  {
    name: "--decor-signoff-font-style",
    fieldPath: "appearance.decor.export.signoffFontStyle",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.signoffFontStyle,
  },
  {
    name: "--decor-signature-color",
    fieldPath: "appearance.decor.export.signatureColor",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.signatureColor,
  },
  {
    name: "--decor-signature-font-weight",
    fieldPath: "appearance.decor.export.signatureFontWeight",
    classification: "canonical",
    resolve: (tokens) => tokens.appearance.decor.export?.signatureFontWeight,
  },
  {
    name: "--decor-signature-text-transform",
    fieldPath: "appearance.decor.export.signatureTextTransform",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.signatureTextTransform,
  },
  {
    name: "--decor-signature-letter-spacing",
    fieldPath: "appearance.decor.export.signatureLetterSpacing",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.signatureLetterSpacing,
  },
  {
    name: "--decor-signature-font-variant-caps",
    fieldPath: "appearance.decor.export.signatureFontVariantCaps",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.signatureFontVariantCaps,
  },
  {
    name: "--decor-section-title-font-weight",
    fieldPath: "appearance.decor.export.sectionTitleFontWeight",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.sectionTitleFontWeight,
  },
  {
    name: "--decor-section-title-text-transform",
    fieldPath: "appearance.decor.export.sectionTitleTextTransform",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.sectionTitleTextTransform,
  },
  {
    name: "--decor-section-title-letter-spacing",
    fieldPath: "appearance.decor.export.sectionTitleLetterSpacing",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.sectionTitleLetterSpacing,
  },
  {
    name: "--decor-meta-label-text-transform",
    fieldPath: "appearance.decor.export.metaLabelTextTransform",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.metaLabelTextTransform,
  },
  {
    name: "--decor-meta-label-letter-spacing",
    fieldPath: "appearance.decor.export.metaLabelLetterSpacing",
    classification: "canonical",
    resolve: (tokens) =>
      tokens.appearance.decor.export?.metaLabelLetterSpacing,
  },
];

export function serializeResumePreviewVars(tokens: CanonicalDocumentTokens) {
  return serializeFromDescriptors(tokens, RESUME_PREVIEW_VAR_DESCRIPTORS);
}

export function serializeActiveResumePreviewDecorVars(
  _tokens: CanonicalDocumentTokens,
  variantId: ResumeLayoutVariantId,
): Record<string, string> {
  switch (variantId) {
    case "swissminima":
      return {
        "--resume-preview-page-background": "var(--paper)",
        "--resume-preview-page-border-color":
          "color-mix(in srgb, var(--color-text) 18%, transparent)",
        "--resume-preview-page-border-width": "0.6mm",
        "--resume-preview-page-shadow":
          "0 5mm 14mm color-mix(in srgb, var(--color-text) 8%, transparent)",
        "--resume-preview-frame-inset": "12mm",
        "--resume-preview-frame-border":
          "0.46mm solid color-mix(in srgb, var(--color-text) 18%, transparent)",
      };
    case "volkregister":
      return {
        "--resume-preview-page-background":
          "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04)), radial-gradient(circle at 18% 8%, rgba(255,255,255,0.22), transparent 26%), radial-gradient(circle at 92% 92%, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 34%), var(--paper)",
        "--resume-preview-page-border-color":
          "color-mix(in srgb, var(--color-text) 14%, transparent)",
        "--resume-preview-page-border-width": "0.42mm",
        "--resume-preview-page-shadow":
          "0 5mm 13mm color-mix(in srgb, var(--color-text) 8%, transparent), inset 0 0 0 0.18mm color-mix(in srgb, var(--color-on-accent) 38%, transparent), inset 0 0 10mm color-mix(in srgb, var(--color-accent) 10%, transparent)",
        "--resume-preview-volk-overlay-primary":
          "linear-gradient(to right, transparent 0%, transparent 50.5%, color-mix(in srgb, var(--color-accent) 12%, transparent) 50.67%, transparent 50.84%, transparent 58.58%, color-mix(in srgb, var(--color-accent) 6%, transparent) 58.73%, transparent 58.88%, transparent 100%)",
        "--resume-preview-volk-overlay-secondary":
          "linear-gradient(to right, color-mix(in srgb, var(--color-on-accent) 14%, transparent), transparent 3%, transparent 97%, color-mix(in srgb, var(--color-accent) 6%, transparent)), linear-gradient(to bottom, color-mix(in srgb, var(--color-on-accent) 8%, transparent), transparent 5%, transparent 97%, color-mix(in srgb, var(--color-accent) 6%, transparent))",
        "--resume-preview-volk-body-color":
          "color-mix(in srgb, var(--color-text) 90%, transparent)",
        "--resume-preview-volk-title-size":
          "calc(var(--text-display-size) + 0.689mm)",
        "--resume-preview-volk-subtitle-size":
          "calc(var(--text-title-size) + 2.706mm)",
        "--resume-preview-volk-meta-size":
          "calc(var(--text-body-size) - 0.025mm)",
        "--resume-preview-volk-section-heading-size":
          "calc(var(--text-title-size) - 0.291mm)",
        "--resume-preview-volk-section-heading-line":
          "calc(var(--text-title-line) + 0.15)",
      };
    case "editorialmag":
      return {
        "--resume-preview-page-background":
          "linear-gradient(180deg, var(--paper), color-mix(in srgb, var(--paper) 94%, var(--sf1) 6%))",
        "--resume-preview-editorial-rule-color":
          "color-mix(in srgb, var(--color-text) 16%, transparent)",
        "--resume-preview-editorial-rule-fill":
          "linear-gradient(90deg, color-mix(in srgb, var(--color-text) 28%, transparent), transparent 78%)",
      };
    case "signalgrid":
      return {
        "--resume-preview-page-background":
          "linear-gradient(180deg, var(--paper), color-mix(in srgb, var(--paper) 96%, var(--sf1) 4%))",
        "--resume-preview-signal-rail-background":
          "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-muted) 88%), color-mix(in srgb, var(--color-accent) 18%, var(--color-surface-muted) 82%))",
        "--resume-preview-signal-rail-border":
          "0.24mm solid color-mix(in srgb, var(--color-border) 70%, transparent)",
        "--resume-preview-signal-photo-border":
          "0.5mm solid color-mix(in srgb, var(--color-surface-raised) 86%, var(--color-accent) 14%)",
        "--resume-preview-signal-photo-shadow":
          "0 2mm 6mm color-mix(in srgb, var(--color-text) 6%, transparent)",
        "--resume-preview-signal-rule":
          "0.34mm solid color-mix(in srgb, var(--color-accent) 16%, var(--color-border-strong) 84%)",
        "--resume-preview-signal-summary-rule":
          "0.6mm solid color-mix(in srgb, var(--color-accent) 62%, transparent)",
        "--resume-preview-signal-card-background":
          "color-mix(in srgb, var(--color-surface-muted) 52%, var(--color-surface-raised) 48%)",
        "--resume-preview-signal-card-border":
          "0.22mm solid color-mix(in srgb, var(--color-border) 72%, transparent)",
      };
    case "quire":
      return {
        "--resume-preview-page-background": "var(--paper)",
        "--resume-preview-page-border":
          "0.36mm solid color-mix(in srgb, var(--color-text) 15%, transparent)",
        "--resume-preview-quire-sidebar-width": "var(--sidebar-width)",
        "--resume-preview-quire-sidebar-background":
          "color-mix(in srgb, var(--color-accent) 18%, #1a1a1a 82%)",
        "--resume-preview-quire-sidebar-rule-color":
          "color-mix(in srgb, var(--color-on-accent) 18%, transparent)",
        "--resume-preview-quire-sidebar-label-color":
          "color-mix(in srgb, var(--color-on-accent) 46%, transparent)",
        "--resume-preview-quire-sidebar-text-primary": "var(--color-on-accent)",
        "--resume-preview-quire-sidebar-text-secondary":
          "color-mix(in srgb, var(--color-on-accent) 62%, transparent)",
        "--resume-preview-quire-sidebar-accent":
          "color-mix(in srgb, var(--color-accent-soft) 80%, white 20%)",
        "--resume-preview-quire-main-rule":
          "0.26mm solid color-mix(in srgb, var(--color-border-strong) 58%, transparent)",
        "--resume-preview-quire-sidebar-rule":
          "0.2mm solid var(--resume-preview-quire-sidebar-rule-color)",
      };
    default:
      return {};
  }
}

export function serializeProposalPreviewVars(tokens: CanonicalDocumentTokens) {
  return serializeFromDescriptors(tokens, PROPOSAL_PREVIEW_VAR_DESCRIPTORS);
}

export function serializeProposalRuntimeVars(tokens: CanonicalDocumentTokens) {
  return serializeFromDescriptors(tokens, PROPOSAL_RUNTIME_VAR_DESCRIPTORS);
}

export function serializeProposalMeasurementRuntimeVars(
  millimeterPx: number,
): Record<string, string> {
  return {
    "--proposal-inline-mm": `${millimeterPx}px`,
    "--proposal-block-mm": `${millimeterPx}px`,
  };
}

export function serializeExportVars(tokens: CanonicalDocumentTokens) {
  return serializeFromDescriptors(tokens, EXPORT_VAR_DESCRIPTORS);
}

export type ResumeDocxSurfaceTokens = {
  pageMarginsTwip: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  bodySizeHalfPt: number;
  titleSizeHalfPt: number;
  metaSizeHalfPt: number;
  labelSizeHalfPt: number;
  bodyLineTwip: number;
  compactLineTwip: number;
  sectionGapTwip: number;
  compactGapTwip: number;
  bodyGapTwip: number;
  bulletGapTwip: number;
};

export type ProposalDocxSurfaceTokens = {
  pageMarginsTwip: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  bodySizeHalfPt: number;
  metaSizeHalfPt: number;
  labelSizeHalfPt: number;
  subjectSizeHalfPt: number;
  bodyLineTwip: number;
  compactLineTwip: number;
  sectionGapTwip: number;
  compactGapTwip: number;
  bodyGapTwip: number;
  salutationGapTwip: number;
  closingBeforeTwip: number;
  closingLineGapTwip: number;
};

export function resolveResumeDocxSurfaceTokens(
  tokens: CanonicalDocumentTokens,
): ResumeDocxSurfaceTokens {
  return {
    pageMarginsTwip: {
      top: mmToTwip(tokens.geometry.page.margin.topMm),
      right: mmToTwip(tokens.geometry.page.margin.rightMm),
      bottom: mmToTwip(tokens.geometry.page.margin.bottomMm),
      left: mmToTwip(tokens.geometry.page.margin.leftMm),
    },
    bodySizeHalfPt: ptToHalfPoint(tokens.flow.type.body.sizePt ?? 10),
    titleSizeHalfPt: ptToHalfPoint(tokens.flow.type.title.sizePt ?? 20),
    metaSizeHalfPt: ptToHalfPoint(tokens.flow.type.meta.sizePt ?? 8.6),
    labelSizeHalfPt: ptToHalfPoint(tokens.flow.type.label.sizePt ?? 7.5),
    bodyLineTwip: ptLineHeightToTwip(
      tokens.flow.type.body.sizePt,
      tokens.flow.type.body.lineHeight,
    ),
    compactLineTwip: ptLineHeightToTwip(
      tokens.flow.type.meta.sizePt,
      tokens.flow.type.meta.lineHeight,
    ),
    sectionGapTwip: mmToTwip(tokens.flow.rhythm.sectionGapMm ?? 0),
    compactGapTwip: mmToTwip(
      tokens.flow.rhythm.entryHeadGapMm ?? tokens.flow.rhythm.listGapMm ?? 1.3,
    ),
    bodyGapTwip: mmToTwip(
      tokens.flow.rhythm.entryGapMm ?? tokens.flow.rhythm.stackGapMm ?? 3,
    ),
    bulletGapTwip: mmToTwip(
      tokens.flow.component.experience?.bulletsGapMm ??
        tokens.flow.rhythm.listGapMm ??
        1.3,
    ),
  };
}

export function resolveProposalDocxSurfaceTokens(
  tokens: CanonicalDocumentTokens,
): ProposalDocxSurfaceTokens {
  return {
    pageMarginsTwip: {
      top: mmToTwip(tokens.geometry.page.margin.topMm),
      right: mmToTwip(tokens.geometry.page.margin.rightMm),
      bottom: mmToTwip(tokens.geometry.page.margin.bottomMm),
      left: mmToTwip(tokens.geometry.page.margin.leftMm),
    },
    bodySizeHalfPt: ptToHalfPoint(tokens.flow.type.body.sizePt ?? 10),
    metaSizeHalfPt: ptToHalfPoint(tokens.flow.type.meta.sizePt ?? 8.6),
    labelSizeHalfPt: ptToHalfPoint(tokens.flow.type.label.sizePt ?? 7.5),
    subjectSizeHalfPt: ptToHalfPoint(
      (tokens.flow.type.title.sizePt ?? 0) *
        (tokens.flow.template.titleScaleMultiplier ?? 1),
    ),
    bodyLineTwip: ptLineHeightToTwip(
      tokens.flow.type.body.sizePt,
      tokens.flow.type.body.lineHeight,
    ),
    compactLineTwip: ptLineHeightToTwip(
      tokens.flow.type.meta.sizePt,
      tokens.flow.type.meta.lineHeight,
    ),
    sectionGapTwip: mmToTwip(tokens.flow.rhythm.sectionGapMm ?? 0),
    compactGapTwip: mmToTwip(tokens.flow.rhythm.stackGapMm ?? 3),
    bodyGapTwip: mmToTwip(tokens.flow.rhythm.stackGapMm ?? 3),
    salutationGapTwip: mmToTwip(tokens.flow.rhythm.stackGapMm ?? 3),
    closingBeforeTwip: mmToTwip(tokens.flow.rhythm.closingGapMm ?? 7),
    closingLineGapTwip: mmToTwip(tokens.flow.rhythm.closingNameGapMm ?? 5.2),
  };
}

export function mappingSummary(descriptors: CanonicalVarDescriptor[]) {
  return descriptors.map(({ name, fieldPath, classification }) => ({
    name,
    fieldPath,
    classification,
  }));
}
