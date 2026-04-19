import type { ResumeLayoutVariantId } from "../../features/verbati/resume/resume.types";
import type { StyleFamilyId } from "../../features/verbati/types";

export const RESUME_TEMPLATE_IDS = [
  "swiss_resume_legacy",
  "volk_register_resume_legacy",
  "two_column_resume_legacy",
  "editorial_resume_legacy",
  "modernist_resume_legacy",
  "quire_resume_legacy",
  "workshop_resume_onecol_ats",
] as const;

export type ResumeTemplateId = (typeof RESUME_TEMPLATE_IDS)[number];

type ResumeTemplateLengthSet = {
  topMm: number;
  rightMm: number;
  bottomMm: number;
  leftMm: number;
  liveWidthMm: number;
  liveHeightMm: number;
  sidebarMm: number;
  gutterMm: number;
  mainMm: number;
  headerGapMm: number;
  headerBottomPaddingMm: number;
  headerSummaryWidthMm: number;
  headerTitleMarginTopMm: number;
  bodySectionGapMm: number;
  sidebarRightPaddingMm: number;
  mainLeftPaddingMm: number;
  sidebarSectionGapMm: number;
  sidebarTitleMarginBottomMm: number;
  sidebarTitlePaddingBottomMm: number;
  sidebarContentGapMm: number;
  mainSectionGapMm: number;
  mainHeadingGapMm: number;
  mainHeadingMarginBottomMm: number;
  experienceDateColumnMm: number;
  experienceColumnGapMm: number;
  experienceItemGapMm: number;
  experienceOrgMarginBottomMm: number;
  experienceBulletsPaddingLeftMm: number;
  experienceBulletsGapMm: number;
  projectGapMm: number;
  projectPaddingMm: number;
  educationItemGapMm: number;
  skillGapMm: number;
  skillPaddingInlineMm: number;
  skillPaddingBlockMm: number;
  displaySizeAdjustMm: number;
  titleSizeAdjustMm: number;
  bodySizeAdjustMm: number;
  bodySmSizeAdjustMm: number;
  sectionGapAdjustMm: number;
  headingMarginAdjustMm: number;
  bulletGapAdjustMm: number;
  projectGapAdjustMm: number;
  projectPaddingAdjustMm: number;
};

export type ResumeTemplateDefinition = {
  id: ResumeTemplateId;
  familyId: StyleFamilyId;
  label: string;
  shell: "legacy-preview";
  legacyPreviewVariantId: ResumeLayoutVariantId;
  decorVariantId: ResumeLayoutVariantId;
  exportShell: "onecol" | "split";
  preview: ResumeTemplateLengthSet;
  export: {
    topMm: number;
    rightMm: number;
    bottomMm: number;
    leftMm: number;
    sidebarMm: number;
    gutterMm: number;
    mainMm: number;
    summaryWidthMm: number;
    readingWidthMm: number;
    entryMetaWidthMm?: number;
    titleSizePt: number;
    titleLineHeight: number;
    headerGapMm: number;
    sectionGapMm: number;
    entryGapMm: number;
  };
  paginationPolicy: {
    mode: "legacy-placeholder";
  };
};

function defineTemplate(
  definition: ResumeTemplateDefinition,
): ResumeTemplateDefinition {
  return definition;
}

const SWISS_EXPORT = {
  topMm: 17,
  rightMm: 35,
  bottomMm: 35,
  leftMm: 17,
  sidebarMm: 35,
  gutterMm: 18,
  mainMm: 105,
  summaryWidthMm: 105,
  readingWidthMm: 105,
  entryMetaWidthMm: 31,
  titleSizePt: 20.5,
  titleLineHeight: 1.12,
  headerGapMm: 17,
  sectionGapMm: 8.5,
  entryGapMm: 5.1,
} as const;

const SPLIT_EXPORT = {
  topMm: 17,
  rightMm: 35,
  bottomMm: 35,
  leftMm: 17,
  sidebarMm: 52,
  gutterMm: 18,
  mainMm: 88,
  summaryWidthMm: 88,
  readingWidthMm: 88,
  entryMetaWidthMm: 28,
  titleSizePt: 20.5,
  titleLineHeight: 1.1,
  headerGapMm: 16,
  sectionGapMm: 8.2,
  entryGapMm: 5,
} as const;

const ONE_COLUMN_EXPORT = {
  topMm: 17,
  rightMm: 35,
  bottomMm: 35,
  leftMm: 18,
  sidebarMm: 0,
  gutterMm: 0,
  mainMm: 157,
  summaryWidthMm: 120,
  readingWidthMm: 120,
  titleSizePt: 20,
  titleLineHeight: 1.12,
  headerGapMm: 10,
  sectionGapMm: 6.8,
  entryGapMm: 4.8,
} as const;

export const DEFAULT_RESUME_TEMPLATE_ID: ResumeTemplateId =
  "swiss_resume_legacy";

export const RESUME_TEMPLATE_DEFINITIONS: readonly ResumeTemplateDefinition[] = [
  defineTemplate({
    id: "swiss_resume_legacy",
    familyId: "swiss",
    label: "Swiss legacy preview",
    shell: "legacy-preview",
    legacyPreviewVariantId: "swissminima",
    decorVariantId: "swissminima",
    exportShell: "split",
    preview: {
      topMm: 17, rightMm: 35, bottomMm: 35, leftMm: 17,
      liveWidthMm: 158, liveHeightMm: 245,
      sidebarMm: 35, gutterMm: 18, mainMm: 105,
      headerGapMm: 4, headerBottomPaddingMm: 5, headerSummaryWidthMm: 108, headerTitleMarginTopMm: 2,
      bodySectionGapMm: 8, sidebarRightPaddingMm: 0, mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 0, sidebarTitleMarginBottomMm: 0, sidebarTitlePaddingBottomMm: 0, sidebarContentGapMm: 0,
      mainSectionGapMm: 0, mainHeadingGapMm: 0, mainHeadingMarginBottomMm: 0,
      experienceDateColumnMm: 0, experienceColumnGapMm: 0, experienceItemGapMm: 5, experienceOrgMarginBottomMm: 1.4, experienceBulletsPaddingLeftMm: 3.5, experienceBulletsGapMm: 1.2,
      projectGapMm: 3, projectPaddingMm: 2.6, educationItemGapMm: 1.8,
      skillGapMm: 1.7, skillPaddingInlineMm: 2, skillPaddingBlockMm: 0.9,
      displaySizeAdjustMm: 0, titleSizeAdjustMm: 0, bodySizeAdjustMm: -0.05, bodySmSizeAdjustMm: -0.08,
      sectionGapAdjustMm: -0.2, headingMarginAdjustMm: 0, bulletGapAdjustMm: -0.05, projectGapAdjustMm: -0.1, projectPaddingAdjustMm: -0.1,
    },
    export: SWISS_EXPORT,
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
  defineTemplate({
    id: "volk_register_resume_legacy",
    familyId: "volk-register",
    label: "Volk Register legacy preview",
    shell: "legacy-preview",
    legacyPreviewVariantId: "swissminima",
    decorVariantId: "volkregister",
    exportShell: "split",
    preview: {
      topMm: 18, rightMm: 18, bottomMm: 18, leftMm: 18,
      liveWidthMm: 174, liveHeightMm: 261,
      sidebarMm: 42, gutterMm: 8, mainMm: 124,
      headerGapMm: 3.8, headerBottomPaddingMm: 4, headerSummaryWidthMm: 116, headerTitleMarginTopMm: 0,
      bodySectionGapMm: 6.2, sidebarRightPaddingMm: 0, mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 4, sidebarTitleMarginBottomMm: 1.4, sidebarTitlePaddingBottomMm: 0.6, sidebarContentGapMm: 1.2,
      mainSectionGapMm: 4.4, mainHeadingGapMm: 2, mainHeadingMarginBottomMm: 1.7,
      experienceDateColumnMm: 0, experienceColumnGapMm: 0, experienceItemGapMm: 4, experienceOrgMarginBottomMm: 1.1, experienceBulletsPaddingLeftMm: 3.6, experienceBulletsGapMm: 1,
      projectGapMm: 2.8, projectPaddingMm: 2.7, educationItemGapMm: 1.6,
      skillGapMm: 1.5, skillPaddingInlineMm: 1.8, skillPaddingBlockMm: 0.75,
      displaySizeAdjustMm: -0.08, titleSizeAdjustMm: -0.05, bodySizeAdjustMm: -0.08, bodySmSizeAdjustMm: -0.08,
      sectionGapAdjustMm: -0.1, headingMarginAdjustMm: 0, bulletGapAdjustMm: -0.05, projectGapAdjustMm: -0.05, projectPaddingAdjustMm: -0.05,
    },
    export: SWISS_EXPORT,
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
  defineTemplate({
    id: "two_column_resume_legacy",
    familyId: "two-column",
    label: "Two-column legacy preview",
    shell: "legacy-preview",
    legacyPreviewVariantId: "robial",
    decorVariantId: "robial",
    exportShell: "split",
    preview: {
      topMm: 26, rightMm: 35, bottomMm: 53, leftMm: 18,
      liveWidthMm: 157, liveHeightMm: 218,
      sidebarMm: 35, gutterMm: 17, mainMm: 105,
      headerGapMm: 3, headerBottomPaddingMm: 5, headerSummaryWidthMm: 128, headerTitleMarginTopMm: 1,
      bodySectionGapMm: 8, sidebarRightPaddingMm: 0, mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 5, sidebarTitleMarginBottomMm: 2, sidebarTitlePaddingBottomMm: 1.5, sidebarContentGapMm: 1.5,
      mainSectionGapMm: 5, mainHeadingGapMm: 3, mainHeadingMarginBottomMm: 2.4,
      experienceDateColumnMm: 18, experienceColumnGapMm: 4, experienceItemGapMm: 4.5, experienceOrgMarginBottomMm: 1.4, experienceBulletsPaddingLeftMm: 3.5, experienceBulletsGapMm: 1.1,
      projectGapMm: 3, projectPaddingMm: 3, educationItemGapMm: 1.6,
      skillGapMm: 1.6, skillPaddingInlineMm: 2.2, skillPaddingBlockMm: 1,
      displaySizeAdjustMm: -0.15, titleSizeAdjustMm: 0, bodySizeAdjustMm: 0, bodySmSizeAdjustMm: -0.05,
      sectionGapAdjustMm: -0.6, headingMarginAdjustMm: -0.2, bulletGapAdjustMm: -0.08, projectGapAdjustMm: -0.2, projectPaddingAdjustMm: -0.15,
    },
    export: SPLIT_EXPORT,
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
  defineTemplate({
    id: "editorial_resume_legacy",
    familyId: "editorial",
    label: "Editorial legacy preview",
    shell: "legacy-preview",
    legacyPreviewVariantId: "robial",
    decorVariantId: "robial",
    exportShell: "split",
    preview: {
      topMm: 24.75, rightMm: 35, bottomMm: 49.5, leftMm: 17.5,
      liveWidthMm: 157.5, liveHeightMm: 222.75,
      sidebarMm: 36, gutterMm: 17.5, mainMm: 104,
      headerGapMm: 4.5, headerBottomPaddingMm: 6, headerSummaryWidthMm: 102, headerTitleMarginTopMm: 2.4,
      bodySectionGapMm: 7.5, sidebarRightPaddingMm: 0, mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 4.5, sidebarTitleMarginBottomMm: 1.8, sidebarTitlePaddingBottomMm: 1.2, sidebarContentGapMm: 1.8,
      mainSectionGapMm: 5, mainHeadingGapMm: 2.5, mainHeadingMarginBottomMm: 2.2,
      experienceDateColumnMm: 0, experienceColumnGapMm: 0, experienceItemGapMm: 4.6, experienceOrgMarginBottomMm: 1.1, experienceBulletsPaddingLeftMm: 3.7, experienceBulletsGapMm: 1.1,
      projectGapMm: 3, projectPaddingMm: 2.8, educationItemGapMm: 1.8,
      skillGapMm: 1.6, skillPaddingInlineMm: 2, skillPaddingBlockMm: 0.8,
      displaySizeAdjustMm: -0.1, titleSizeAdjustMm: 0, bodySizeAdjustMm: -0.05, bodySmSizeAdjustMm: -0.05,
      sectionGapAdjustMm: -0.1, headingMarginAdjustMm: 0, bulletGapAdjustMm: -0.05, projectGapAdjustMm: -0.05, projectPaddingAdjustMm: -0.05,
    },
    export: SPLIT_EXPORT,
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
  defineTemplate({
    id: "modernist_resume_legacy",
    familyId: "modernist",
    label: "Modernist legacy preview",
    shell: "legacy-preview",
    legacyPreviewVariantId: "robial",
    decorVariantId: "robial",
    exportShell: "split",
    preview: {
      topMm: 17, rightMm: 35, bottomMm: 35, leftMm: 17,
      liveWidthMm: 158, liveHeightMm: 245,
      sidebarMm: 28, gutterMm: 18, mainMm: 105,
      headerGapMm: 4, headerBottomPaddingMm: 5, headerSummaryWidthMm: 96, headerTitleMarginTopMm: 1,
      bodySectionGapMm: 7, sidebarRightPaddingMm: 0, mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 4, sidebarTitleMarginBottomMm: 1.6, sidebarTitlePaddingBottomMm: 0.8, sidebarContentGapMm: 1.5,
      mainSectionGapMm: 4.4, mainHeadingGapMm: 2.2, mainHeadingMarginBottomMm: 1.8,
      experienceDateColumnMm: 0, experienceColumnGapMm: 0, experienceItemGapMm: 4, experienceOrgMarginBottomMm: 1, experienceBulletsPaddingLeftMm: 3.5, experienceBulletsGapMm: 0.9,
      projectGapMm: 2.8, projectPaddingMm: 2.6, educationItemGapMm: 1.6,
      skillGapMm: 1.5, skillPaddingInlineMm: 1.8, skillPaddingBlockMm: 0.75,
      displaySizeAdjustMm: -0.08, titleSizeAdjustMm: -0.05, bodySizeAdjustMm: -0.05, bodySmSizeAdjustMm: -0.08,
      sectionGapAdjustMm: -0.1, headingMarginAdjustMm: 0, bulletGapAdjustMm: -0.05, projectGapAdjustMm: -0.05, projectPaddingAdjustMm: -0.05,
    },
    export: SPLIT_EXPORT,
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
  defineTemplate({
    id: "quire_resume_legacy",
    familyId: "quire",
    label: "Quire legacy preview",
    shell: "legacy-preview",
    legacyPreviewVariantId: "robial",
    decorVariantId: "robial",
    exportShell: "split",
    preview: {
      topMm: 22, rightMm: 28, bottomMm: 38, leftMm: 20,
      liveWidthMm: 162, liveHeightMm: 237,
      sidebarMm: 57, gutterMm: 0, mainMm: 105,
      headerGapMm: 3.5, headerBottomPaddingMm: 5.5, headerSummaryWidthMm: 115, headerTitleMarginTopMm: 1.5,
      bodySectionGapMm: 7, sidebarRightPaddingMm: 0, mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 5.5, sidebarTitleMarginBottomMm: 2, sidebarTitlePaddingBottomMm: 1.2, sidebarContentGapMm: 1.6,
      mainSectionGapMm: 5.5, mainHeadingGapMm: 2.8, mainHeadingMarginBottomMm: 2.4,
      experienceDateColumnMm: 19, experienceColumnGapMm: 4, experienceItemGapMm: 5, experienceOrgMarginBottomMm: 1.2, experienceBulletsPaddingLeftMm: 3.6, experienceBulletsGapMm: 1.2,
      projectGapMm: 3.2, projectPaddingMm: 3, educationItemGapMm: 2,
      skillGapMm: 1.8, skillPaddingInlineMm: 0, skillPaddingBlockMm: 0,
      displaySizeAdjustMm: -0.55, titleSizeAdjustMm: -0.1, bodySizeAdjustMm: -0.05, bodySmSizeAdjustMm: -0.08,
      sectionGapAdjustMm: -0.2, headingMarginAdjustMm: 0, bulletGapAdjustMm: -0.05, projectGapAdjustMm: -0.1, projectPaddingAdjustMm: -0.05,
    },
    export: SPLIT_EXPORT,
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
  defineTemplate({
    id: "workshop_resume_onecol_ats",
    familyId: "workshop",
    label: "Workshop one-column ATS",
    shell: "legacy-preview",
    legacyPreviewVariantId: "swissminima",
    decorVariantId: "swissminima",
    exportShell: "onecol",
    preview: {
      topMm: 17, rightMm: 35, bottomMm: 35, leftMm: 18,
      liveWidthMm: 157, liveHeightMm: 245,
      sidebarMm: 0, gutterMm: 0, mainMm: 157,
      headerGapMm: 4, headerBottomPaddingMm: 5, headerSummaryWidthMm: 120, headerTitleMarginTopMm: 2,
      bodySectionGapMm: 8, sidebarRightPaddingMm: 0, mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 0, sidebarTitleMarginBottomMm: 0, sidebarTitlePaddingBottomMm: 0, sidebarContentGapMm: 0,
      mainSectionGapMm: 0, mainHeadingGapMm: 0, mainHeadingMarginBottomMm: 0,
      experienceDateColumnMm: 0, experienceColumnGapMm: 0, experienceItemGapMm: 5, experienceOrgMarginBottomMm: 1.4, experienceBulletsPaddingLeftMm: 3.5, experienceBulletsGapMm: 1.2,
      projectGapMm: 3, projectPaddingMm: 2.6, educationItemGapMm: 1.8,
      skillGapMm: 1.7, skillPaddingInlineMm: 2, skillPaddingBlockMm: 0.9,
      displaySizeAdjustMm: 0, titleSizeAdjustMm: 0, bodySizeAdjustMm: -0.05, bodySmSizeAdjustMm: -0.08,
      sectionGapAdjustMm: -0.2, headingMarginAdjustMm: 0, bulletGapAdjustMm: -0.05, projectGapAdjustMm: -0.1, projectPaddingAdjustMm: -0.1,
    },
    export: ONE_COLUMN_EXPORT,
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
] as const;

export function getResumeTemplateDefinition(
  templateId: ResumeTemplateId | null | undefined,
): ResumeTemplateDefinition {
  return (
    RESUME_TEMPLATE_DEFINITIONS.find(
      (definition) => definition.id === templateId,
    ) ?? RESUME_TEMPLATE_DEFINITIONS[0]
  );
}
