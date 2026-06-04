import type { ResumeLayoutVariantId } from "../../features/verbati/resume/resume.types";
import type { StyleFamilyId } from "../../features/verbati/types";

export const RESUME_TEMPLATE_IDS = [
  "swiss_resume_legacy",
  "volk_register_resume_legacy",
  "two_column_resume_legacy",
  "editorial_resume_legacy",
  "modernist_resume_legacy",
  "quire_resume_legacy",
  "editorial-sidebar",
  "workshop_resume_onecol_ats",
  "workshop_resume_twocol_ats",
  "sanat_asymmetric_resume",
] as const;

export type ResumeTemplateId = (typeof RESUME_TEMPLATE_IDS)[number];

export const WORKSHOP_RESUME_ONECOL_TEMPLATE_ID = "workshop_resume_onecol_ats";
export const WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID = "workshop_resume_twocol_ats";
export const SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID = "sanat_asymmetric_resume";
export const EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID = "editorial-sidebar";
export const WORKSHOP_RESUME_TEMPLATE_IDS = [
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
  SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID,
] as const satisfies readonly ResumeTemplateId[];

export type WorkshopResumeTemplateId =
  (typeof WORKSHOP_RESUME_TEMPLATE_IDS)[number];

export function isWorkshopResumeTemplateId(
  templateId: ResumeTemplateId | null | undefined,
): templateId is WorkshopResumeTemplateId {
  return WORKSHOP_RESUME_TEMPLATE_IDS.includes(
    templateId as WorkshopResumeTemplateId,
  );
}

export function isResumeTemplateId(
  templateId: ResumeTemplateId | null | undefined,
): templateId is ResumeTemplateId {
  return RESUME_TEMPLATE_IDS.includes(templateId as ResumeTemplateId);
}

export function isWorkshopTwoColumnResumeTemplateId(
  templateId: ResumeTemplateId | null | undefined,
): templateId is typeof WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID {
  return templateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID;
}

export function isSanatResumeTemplateId(
  templateId: ResumeTemplateId | null | undefined,
): templateId is typeof SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID {
  return templateId === SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID;
}

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
  workshopSectionShellGapMm?: number;
  workshopSectionContentGapMm?: number;
  workshopExperienceBlockGapMm?: number;
  workshopExperienceMetaGapMm?: number;
  workshopCompactMetaGapMm?: number;
  workshopSectionTitleReductionMm?: number;
  workshopExperienceHeadingSizeAdjustMm?: number;
  workshopExperienceHeadingLineHeight?: number;
  workshopBottomFitSafetyMm?: number;
};

export type ResumeTemplateDefinition = {
  id: ResumeTemplateId;
  familyId: StyleFamilyId;
  label: string;
  shell: "legacy-preview";
  supportsPlanner: boolean;
  supportsLegacyComparison: boolean;
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

export type WorkshopPreviewLayoutContract = {
  sectionShellGapMm: number;
  sectionContentGapMm: number;
  listGapMm: number;
  experienceBlockGapMm: number;
  experienceMetaGapMm: number;
  compactMetaGapMm: number;
};

export type WorkshopPreviewHeadingContract = {
  sectionTitleReductionMm: number;
  experienceHeadingSizeAdjustMm: number;
  experienceHeadingLineHeight: number;
  bottomFitSafetyMm: number;
};

const DEFAULT_WORKSHOP_PREVIEW_LAYOUT_CONTRACT: WorkshopPreviewLayoutContract = {
  sectionShellGapMm: 2.6,
  sectionContentGapMm: 3,
  listGapMm: 1.2,
  experienceBlockGapMm: 1.8,
  experienceMetaGapMm: 0.6,
  compactMetaGapMm: 0.7,
};

const DEFAULT_WORKSHOP_PREVIEW_HEADING_CONTRACT: WorkshopPreviewHeadingContract = {
  sectionTitleReductionMm: 0.95,
  experienceHeadingSizeAdjustMm: 0.2,
  experienceHeadingLineHeight: 1.25,
  bottomFitSafetyMm: 0.5,
};

export function resolveWorkshopPreviewLayoutContract(
  template: ResumeTemplateDefinition,
): WorkshopPreviewLayoutContract {
  const preview = template.preview;

  return {
    sectionShellGapMm:
      preview.workshopSectionShellGapMm ??
      DEFAULT_WORKSHOP_PREVIEW_LAYOUT_CONTRACT.sectionShellGapMm,
    sectionContentGapMm:
      preview.workshopSectionContentGapMm ??
      DEFAULT_WORKSHOP_PREVIEW_LAYOUT_CONTRACT.sectionContentGapMm,
    listGapMm:
      preview.experienceBulletsGapMm ??
      DEFAULT_WORKSHOP_PREVIEW_LAYOUT_CONTRACT.listGapMm,
    experienceBlockGapMm:
      preview.workshopExperienceBlockGapMm ??
      DEFAULT_WORKSHOP_PREVIEW_LAYOUT_CONTRACT.experienceBlockGapMm,
    experienceMetaGapMm:
      preview.workshopExperienceMetaGapMm ??
      DEFAULT_WORKSHOP_PREVIEW_LAYOUT_CONTRACT.experienceMetaGapMm,
    compactMetaGapMm:
      preview.workshopCompactMetaGapMm ??
      DEFAULT_WORKSHOP_PREVIEW_LAYOUT_CONTRACT.compactMetaGapMm,
  };
}

export function resolveWorkshopPreviewHeadingContract(
  template: ResumeTemplateDefinition,
): WorkshopPreviewHeadingContract {
  const preview = template.preview;

  return {
    sectionTitleReductionMm:
      preview.workshopSectionTitleReductionMm ??
      DEFAULT_WORKSHOP_PREVIEW_HEADING_CONTRACT.sectionTitleReductionMm,
    experienceHeadingSizeAdjustMm:
      preview.workshopExperienceHeadingSizeAdjustMm ??
      DEFAULT_WORKSHOP_PREVIEW_HEADING_CONTRACT.experienceHeadingSizeAdjustMm,
    experienceHeadingLineHeight:
      preview.workshopExperienceHeadingLineHeight ??
      DEFAULT_WORKSHOP_PREVIEW_HEADING_CONTRACT.experienceHeadingLineHeight,
    bottomFitSafetyMm:
      preview.workshopBottomFitSafetyMm ??
      DEFAULT_WORKSHOP_PREVIEW_HEADING_CONTRACT.bottomFitSafetyMm,
  };
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
  bottomMm: 18,
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

const TWO_COLUMN_WORKSHOP_EXPORT = {
  topMm: 17,
  rightMm: 35,
  bottomMm: 18,
  leftMm: 18,
  sidebarMm: 45,
  gutterMm: 12,
  mainMm: 100,
  summaryWidthMm: 100,
  readingWidthMm: 100,
  entryMetaWidthMm: 27,
  titleSizePt: 20,
  titleLineHeight: 1.12,
  headerGapMm: 8,
  sectionGapMm: 5.8,
  entryGapMm: 4.4,
} as const;

const SANAT_ASYMMETRIC_EXPORT = {
  topMm: 18,
  rightMm: 20,
  bottomMm: 18,
  leftMm: 17,
  sidebarMm: 63,
  gutterMm: 13,
  mainMm: 97,
  summaryWidthMm: 97,
  readingWidthMm: 97,
  entryMetaWidthMm: 0,
  titleSizePt: 13,
  titleLineHeight: 1.12,
  headerGapMm: 14,
  sectionGapMm: 8,
  entryGapMm: 6,
} as const;

export const DEFAULT_RESUME_TEMPLATE_ID: ResumeTemplateId =
  "swiss_resume_legacy";

export const RESUME_TEMPLATE_DEFINITIONS: readonly ResumeTemplateDefinition[] = [
  defineTemplate({
    id: "swiss_resume_legacy",
    familyId: "swiss",
    label: "Swiss legacy preview",
    shell: "legacy-preview",
    supportsPlanner: false,
    supportsLegacyComparison: true,
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
    supportsPlanner: false,
    supportsLegacyComparison: true,
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
    supportsPlanner: false,
    supportsLegacyComparison: true,
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
    supportsPlanner: false,
    supportsLegacyComparison: true,
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
    id: "editorial-sidebar",
    familyId: "workshop",
    label: "Editorial Sidebar",
    shell: "legacy-preview",
    supportsPlanner: false,
    supportsLegacyComparison: true,
    legacyPreviewVariantId: "editorialsidebar",
    decorVariantId: "editorialsidebar",
    exportShell: "split",
    preview: {
      topMm: 20,
      rightMm: 15,
      bottomMm: 18,
      leftMm: 14,
      liveWidthMm: 181,
      liveHeightMm: 259,
      sidebarMm: 38,
      gutterMm: 13,
      mainMm: 130,
      headerGapMm: 4,
      headerBottomPaddingMm: 5,
      headerSummaryWidthMm: 92,
      headerTitleMarginTopMm: 1.4,
      bodySectionGapMm: 7,
      sidebarRightPaddingMm: 0,
      mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 4.8,
      sidebarTitleMarginBottomMm: 1.8,
      sidebarTitlePaddingBottomMm: 1,
      sidebarContentGapMm: 1.35,
      mainSectionGapMm: 5,
      mainHeadingGapMm: 2.4,
      mainHeadingMarginBottomMm: 2,
      experienceDateColumnMm: 0,
      experienceColumnGapMm: 0,
      experienceItemGapMm: 4.6,
      experienceOrgMarginBottomMm: 1.15,
      experienceBulletsPaddingLeftMm: 3.6,
      experienceBulletsGapMm: 1.1,
      projectGapMm: 3,
      projectPaddingMm: 2.8,
      educationItemGapMm: 1.8,
      skillGapMm: 1.6,
      skillPaddingInlineMm: 2,
      skillPaddingBlockMm: 0.8,
      displaySizeAdjustMm: -0.1,
      titleSizeAdjustMm: 0,
      bodySizeAdjustMm: -0.05,
      bodySmSizeAdjustMm: -0.05,
      sectionGapAdjustMm: -0.1,
      headingMarginAdjustMm: 0,
      bulletGapAdjustMm: -0.05,
      projectGapAdjustMm: -0.05,
      projectPaddingAdjustMm: -0.05,
    },
    export: {
      topMm: 20,
      rightMm: 15,
      bottomMm: 18,
      leftMm: 14,
      sidebarMm: 38,
      gutterMm: 13,
      mainMm: 130,
      summaryWidthMm: 92,
      readingWidthMm: 99,
      entryMetaWidthMm: 31,
      titleSizePt: 20.5,
      titleLineHeight: 1.12,
      headerGapMm: 10,
      sectionGapMm: 6.6,
      entryGapMm: 4.8,
    },
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
  defineTemplate({
    id: "modernist_resume_legacy",
    familyId: "modernist",
    label: "Modernist legacy preview",
    shell: "legacy-preview",
    supportsPlanner: false,
    supportsLegacyComparison: true,
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
    supportsPlanner: false,
    supportsLegacyComparison: true,
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
    supportsPlanner: true,
    supportsLegacyComparison: false,
    legacyPreviewVariantId: "swissminima",
    decorVariantId: "swissminima",
    exportShell: "onecol",
    preview: {
      topMm: 17, rightMm: 35, bottomMm: 18, leftMm: 18,
      liveWidthMm: 157, liveHeightMm: 262,
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
      workshopSectionShellGapMm: 2.6, workshopSectionContentGapMm: 3,
      workshopExperienceBlockGapMm: 1.8, workshopExperienceMetaGapMm: 0.6, workshopCompactMetaGapMm: 0.7,
      workshopSectionTitleReductionMm: 0.95,
      workshopExperienceHeadingSizeAdjustMm: 0.2,
      workshopExperienceHeadingLineHeight: 1.25,
      workshopBottomFitSafetyMm: 0.5,
    },
    export: ONE_COLUMN_EXPORT,
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
  defineTemplate({
    id: "workshop_resume_twocol_ats",
    familyId: "workshop",
    label: "Workshop two-column ATS",
    shell: "legacy-preview",
    supportsPlanner: true,
    supportsLegacyComparison: false,
    legacyPreviewVariantId: "swissminima",
    decorVariantId: "swissminima",
    exportShell: "onecol",
    preview: {
      topMm: 17, rightMm: 35, bottomMm: 18, leftMm: 18,
      liveWidthMm: 157, liveHeightMm: 262,
      sidebarMm: 45, gutterMm: 12, mainMm: 100,
      headerGapMm: 4, headerBottomPaddingMm: 5, headerSummaryWidthMm: 100, headerTitleMarginTopMm: 2,
      bodySectionGapMm: 6.5, sidebarRightPaddingMm: 0, mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 4.2, sidebarTitleMarginBottomMm: 1.4, sidebarTitlePaddingBottomMm: 0.8, sidebarContentGapMm: 1.4,
      mainSectionGapMm: 4.8, mainHeadingGapMm: 2, mainHeadingMarginBottomMm: 1.6,
      experienceDateColumnMm: 0, experienceColumnGapMm: 0, experienceItemGapMm: 4.4, experienceOrgMarginBottomMm: 1.1, experienceBulletsPaddingLeftMm: 3.5, experienceBulletsGapMm: 1.05,
      projectGapMm: 2.7, projectPaddingMm: 2.4, educationItemGapMm: 1.6,
      skillGapMm: 1.5, skillPaddingInlineMm: 1.8, skillPaddingBlockMm: 0.75,
      displaySizeAdjustMm: -0.08, titleSizeAdjustMm: -0.03, bodySizeAdjustMm: -0.06, bodySmSizeAdjustMm: -0.1,
      sectionGapAdjustMm: -0.3, headingMarginAdjustMm: -0.1, bulletGapAdjustMm: -0.05, projectGapAdjustMm: -0.15, projectPaddingAdjustMm: -0.1,
      workshopSectionShellGapMm: 2.4, workshopSectionContentGapMm: 2.6,
      workshopExperienceBlockGapMm: 1.6, workshopExperienceMetaGapMm: 0.55, workshopCompactMetaGapMm: 0.65,
      workshopSectionTitleReductionMm: 0.95,
      workshopExperienceHeadingSizeAdjustMm: 0.12,
      workshopExperienceHeadingLineHeight: 1.22,
      workshopBottomFitSafetyMm: 0.5,
    },
    export: TWO_COLUMN_WORKSHOP_EXPORT,
    paginationPolicy: { mode: "legacy-placeholder" },
  }),
  defineTemplate({
    id: "sanat_asymmetric_resume",
    familyId: "workshop",
    label: "Sanat asymmetric",
    shell: "legacy-preview",
    supportsPlanner: true,
    supportsLegacyComparison: false,
    legacyPreviewVariantId: "swissminima",
    decorVariantId: "swissminima",
    exportShell: "onecol",
    preview: {
      topMm: 18, rightMm: 20, bottomMm: 18, leftMm: 17,
      liveWidthMm: 173, liveHeightMm: 261,
      sidebarMm: 63, gutterMm: 13, mainMm: 97,
      headerGapMm: 13, headerBottomPaddingMm: 10, headerSummaryWidthMm: 97, headerTitleMarginTopMm: 1,
      bodySectionGapMm: 8, sidebarRightPaddingMm: 0, mainLeftPaddingMm: 0,
      sidebarSectionGapMm: 8, sidebarTitleMarginBottomMm: 5.8, sidebarTitlePaddingBottomMm: 0, sidebarContentGapMm: 3,
      mainSectionGapMm: 8, mainHeadingGapMm: 2, mainHeadingMarginBottomMm: 5.8,
      experienceDateColumnMm: 0, experienceColumnGapMm: 0, experienceItemGapMm: 6.8, experienceOrgMarginBottomMm: 1.4, experienceBulletsPaddingLeftMm: 3.5, experienceBulletsGapMm: 1.2,
      projectGapMm: 3, projectPaddingMm: 0, educationItemGapMm: 6,
      skillGapMm: 2.8, skillPaddingInlineMm: 0, skillPaddingBlockMm: 0,
      displaySizeAdjustMm: 2.4, titleSizeAdjustMm: 2.8, bodySizeAdjustMm: -0.45, bodySmSizeAdjustMm: -0.28,
      sectionGapAdjustMm: -0.2, headingMarginAdjustMm: 0, bulletGapAdjustMm: -0.05, projectGapAdjustMm: -0.1, projectPaddingAdjustMm: -0.1,
      workshopSectionShellGapMm: 2.8, workshopSectionContentGapMm: 3.1,
      workshopExperienceBlockGapMm: 2.1, workshopExperienceMetaGapMm: 0.8, workshopCompactMetaGapMm: 0.8,
      workshopSectionTitleReductionMm: 0,
      workshopExperienceHeadingSizeAdjustMm: 0.35,
      workshopExperienceHeadingLineHeight: 1.2,
      workshopBottomFitSafetyMm: 0.5,
    },
    export: SANAT_ASYMMETRIC_EXPORT,
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
