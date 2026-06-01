import {
  getProposalTemplateDefinition,
  resolveProposalTemplateId,
  type ProposalTemplateId,
} from "../../../convex/lib/proposals/renderTemplates";
import { VOLK_REGISTER_GRID } from "../../features/verbati/volkGrid";
import type {
  VerbatiLayoutPreset,
  VerbatiStylePreset,
} from "../../features/verbati/types";
import {
  DEFAULT_VERBATI_STYLE,
  resolveVerbatiStyle,
} from "../../features/verbati/style";
import {
  resolveDocumentPageSize,
  type DocumentPageSize,
} from "../document-page-size";
import type { ProposalDocumentTypography } from "../proposal-document-typography";
import {
  resolvePreviewCanonicalAppearance,
  resolveProposalExportCanonicalAppearance,
  resolveResumeExportCanonicalAppearance,
} from "./documentAppearance";
import {
  A4_PAGE_HEIGHT_MM,
  A4_PAGE_WIDTH_MM,
  BASE_PROPOSAL_TITLE_SCALE_MM,
  createEmptyCanonicalTokens,
  formatMm,
  mmToPt,
  parseEm,
  parseMm,
  parsePercent,
  ptToMm,
  type CanonicalDocumentTokens,
} from "./documentTokens";
import {
  getResumeTemplateDefinition,
  isWorkshopResumeTemplateId,
  resolveWorkshopPreviewHeadingContract,
  type ResumeTemplateDefinition,
  type ResumeTemplateId,
} from "./resumeTemplates";

export type ExportMode = "ats" | "styled";

export type ResumeExportProfileDefinition = {
  id: "ats" | ResumeTemplateId;
  shell: "onecol" | "split";
  margins?: {
    topMm?: number;
    rightMm?: number;
    bottomMm?: number;
    leftMm?: number;
  };
  columns?: {
    sidebarMm: number;
    gutterMm: number;
  };
  flow: {
    summaryWidthMm: number;
    readingWidthMm: number;
    entryMetaWidthMm?: number;
    titleSizePt: number;
    titleLineHeight: number;
    headerGapMm: number;
    sectionGapMm: number;
    entryGapMm: number;
  };
};

export type ProposalExportProfileDefinition = {
  id: "ats" | ProposalTemplateId;
  shell: "onecol" | "rail";
  templateId: ProposalTemplateId | null;
};

type ProposalPreviewNormalizationArgs = {
  templateId?: ProposalTemplateId | null;
  documentTypography: ProposalDocumentTypography;
  stylePreset?: VerbatiStylePreset | null;
  pageGapPx?: number;
  pageSize?: DocumentPageSize | null;
};

const EXPORT_BASE_FONT_TOKENS = {
  displaySizePt: mmToPt(10.6),
  displayLine: 0.96,
  titleSizePt: 20.5,
  titleLine: 1.12,
  subtitleSizePt: 10.5,
  subtitleLine: 1.28,
  summarySizePt: 9.6,
  summaryLine: 1.5,
  bodySizePt: 10,
  bodyLine: 1.46,
  bodySmSizePt: mmToPt(2.95),
  bodySmLine: 1.45,
  labelSizePt: 7.5,
  labelLine: 1.25,
  metaSizePt: 8.6,
  metaLine: 1.34,
};

const PREVIEW_RESUME_FONT_TOKENS = {
  displaySizePt: mmToPt(10.6),
  displayLine: 0.96,
  titleSizePt: mmToPt(4.35),
  titleLine: 1.1,
  bodySizePt: mmToPt(3.35),
  bodyLine: 1.5,
  bodySmSizePt: mmToPt(2.95),
  bodySmLine: 1.45,
  labelSizePt: mmToPt(2.25),
  labelLine: 1.3,
  metaSizePt: mmToPt(2.25),
  metaLine: 1.3,
};

const RESUME_EXPORT_PROFILE_DEFINITIONS: Record<"ats", ResumeExportProfileDefinition> = {
  ats: {
    id: "ats",
    shell: "onecol",
    flow: {
      summaryWidthMm: 112,
      readingWidthMm: 112,
      titleSizePt: 20,
      titleLineHeight: 1.12,
      headerGapMm: 10,
      sectionGapMm: 6.8,
      entryGapMm: 4.8,
    },
  },
};

function normalizeStylePreset(
  stylePreset?: VerbatiStylePreset | null,
): VerbatiStylePreset {
  return resolveVerbatiStyle(stylePreset ?? DEFAULT_VERBATI_STYLE);
}

function deriveLiveArea(args: {
  topMm: number;
  rightMm: number;
  bottomMm: number;
  leftMm: number;
  pageWidthMm?: number;
  pageHeightMm?: number;
}) {
  return {
    widthMm:
      (args.pageWidthMm ?? A4_PAGE_WIDTH_MM) - args.leftMm - args.rightMm,
    heightMm:
      (args.pageHeightMm ?? A4_PAGE_HEIGHT_MM) - args.topMm - args.bottomMm,
  };
}

function resolveResumeEntryMetaWidthMm(args: {
  mainMm: number;
  readingWidthMm: number;
  entryMetaWidthMm?: number;
}): number | undefined {
  if (args.entryMetaWidthMm !== undefined) {
    return args.entryMetaWidthMm;
  }

  const derivedWidthMm = args.mainMm - args.readingWidthMm;
  return derivedWidthMm > 0 ? derivedWidthMm : undefined;
}

function resolvePercentMm(
  totalMm: number,
  percentValue: string | undefined,
): number | undefined {
  const parsedPercent = parsePercent(percentValue);
  return parsedPercent === undefined ? undefined : totalMm * parsedPercent;
}

function resolvePercentMmOrZero(totalMm: number, percentValue: string | undefined): number {
  return resolvePercentMm(totalMm, percentValue) ?? 0;
}

function proposalBodySizePtFromTypography(fontSize: string): number {
  const millimeterExpressionMatch = fontSize.match(
    /calc\(\s*var\(--proposal-inline-mm\)\s*\*\s*(-?\d+(?:\.\d+)?)\s*\)/,
  );
  if (millimeterExpressionMatch) {
    return mmToPt(Number.parseFloat(millimeterExpressionMatch[1]));
  }

  const ptValue = fontSize.trim().match(/^(-?\d+(?:\.\d+)?)pt$/i);
  if (ptValue) {
    return Number.parseFloat(ptValue[1]);
  }

  const mmValue = fontSize.trim().match(/^(-?\d+(?:\.\d+)?)mm$/i);
  if (mmValue) {
    return mmToPt(Number.parseFloat(mmValue[1]));
  }

  return EXPORT_BASE_FONT_TOKENS.bodySizePt;
}

function proposalVolkGridTokens(pageSize?: DocumentPageSize | null): Record<string, number> {
  const resolvedPageSize = resolveDocumentPageSize({ pageSize });
  const inlinePercentKeys = [
    "left",
    "headerWidth",
    "bodyWidth",
    "subjectValueLeft",
    "dotLeft",
  ] as const;
  const blockPercentKeys = [
    "titleTop",
    "subtitleTop",
    "senderTop",
    "metaTop",
    "subjectTop",
    "subjectValueTop",
    "bodyTop",
    "dotTop",
  ] as const;

  const tokens: Record<string, number> = {};

  inlinePercentKeys.forEach((key) => {
    const percent = parsePercent(VOLK_REGISTER_GRID[key]);
    if (percent !== undefined) {
      tokens[key] = (percent / 100) * resolvedPageSize.widthMm;
    }
  });

  blockPercentKeys.forEach((key) => {
    const percent = parsePercent(VOLK_REGISTER_GRID[key]);
    if (percent !== undefined) {
      tokens[key] = (percent / 100) * resolvedPageSize.heightMm;
    }
  });

  const bottomMarginMm = parseMm(VOLK_REGISTER_GRID.bottomMargin);
  if (bottomMarginMm !== undefined) {
    tokens.bottomMargin = bottomMarginMm;
  }

  return tokens;
}

function baseExportFlowTokens(): CanonicalDocumentTokens["flow"] {
  return {
    type: {
      display: {
        sizePt: EXPORT_BASE_FONT_TOKENS.displaySizePt,
        lineHeight: EXPORT_BASE_FONT_TOKENS.displayLine,
      },
      title: {
        sizePt: EXPORT_BASE_FONT_TOKENS.titleSizePt,
        lineHeight: EXPORT_BASE_FONT_TOKENS.titleLine,
      },
      subtitle: {
        sizePt: EXPORT_BASE_FONT_TOKENS.subtitleSizePt,
        lineHeight: EXPORT_BASE_FONT_TOKENS.subtitleLine,
      },
      summary: {
        sizePt: EXPORT_BASE_FONT_TOKENS.summarySizePt,
        lineHeight: EXPORT_BASE_FONT_TOKENS.summaryLine,
      },
      body: {
        sizePt: EXPORT_BASE_FONT_TOKENS.bodySizePt,
        lineHeight: EXPORT_BASE_FONT_TOKENS.bodyLine,
      },
      bodySm: {
        sizePt: EXPORT_BASE_FONT_TOKENS.bodySmSizePt,
        lineHeight: EXPORT_BASE_FONT_TOKENS.bodySmLine,
      },
      label: {
        sizePt: EXPORT_BASE_FONT_TOKENS.labelSizePt,
        lineHeight: EXPORT_BASE_FONT_TOKENS.labelLine,
      },
      meta: {
        sizePt: EXPORT_BASE_FONT_TOKENS.metaSizePt,
        lineHeight: EXPORT_BASE_FONT_TOKENS.metaLine,
      },
    },
    measure: {
      summaryWidthMm: 87,
      resumeReadingWidthMm: 105,
      resumeEntryMetaWidthMm: 31,
      proposalMetaWidthMm: 34,
    },
    header: {},
    template: {},
    rhythm: {
      headerGapMm: 17,
      sectionGapMm: 8.5,
      stackGapMm: 3,
      entryGapMm: 5.1,
      entryHeadGapMm: 1.3,
      listGapMm: 1.3,
      sidebarPadTopMm: 3,
      rulePadTopMm: 2.4,
      closingGapMm: 7,
      closingNameGapMm: 5.2,
    },
    component: {
      tag: {
        gapMm: 1.6,
        rowGapMm: 1.4,
        padBlockMm: 1.1,
        padInlineMm: 1.8,
      },
    },
    pagination: {},
    density: {},
  };
}

export function normalizeResumePreviewTokens(args: {
  resumeTemplateId: ResumeTemplateId;
  template?: ResumeTemplateDefinition | null;
  stylePreset?: VerbatiStylePreset | null;
  pageSize?: DocumentPageSize | null;
}): CanonicalDocumentTokens {
  const tokens = createEmptyCanonicalTokens();
  const pageSize = resolveDocumentPageSize({ pageSize: args.pageSize });
  const template = args.template ?? getResumeTemplateDefinition(args.resumeTemplateId);
  const preview = template.preview;
  tokens.appearance = resolvePreviewCanonicalAppearance(
    normalizeStylePreset(args.stylePreset),
  );
  const topMm = preview.topMm;
  const rightMm = preview.rightMm;
  const bottomMm = preview.bottomMm;
  const leftMm = preview.leftMm;
  const liveArea = deriveLiveArea({
    topMm,
    rightMm,
    bottomMm,
    leftMm,
    pageWidthMm: pageSize.widthMm,
    pageHeightMm: pageSize.heightMm,
  });

  tokens.geometry.page = {
    widthMm: pageSize.widthMm,
    heightMm: pageSize.heightMm,
    radiusMm: parseMm("1mm") ?? 1,
    margin: {
      topMm,
      rightMm,
      bottomMm,
      leftMm,
    },
    liveArea: {
      widthMm: preview.liveWidthMm ?? liveArea.widthMm,
      heightMm: preview.liveHeightMm ?? liveArea.heightMm,
    },
  };
  tokens.geometry.columns = {
    sidebarMm: preview.sidebarMm,
    gutterMm: preview.gutterMm,
    mainMm: preview.mainMm,
  };
  if (template.id === "volk_register_resume_legacy") {
    tokens.geometry.primitives = {
      ...tokens.geometry.primitives,
      volkGrid: {
        left: resolvePercentMmOrZero(tokens.geometry.page.widthMm, VOLK_REGISTER_GRID.left),
        headerWidth: resolvePercentMmOrZero(
          tokens.geometry.page.widthMm,
          VOLK_REGISTER_GRID.headerWidth,
        ),
        bodyWidth: resolvePercentMmOrZero(
          tokens.geometry.page.widthMm,
          VOLK_REGISTER_GRID.bodyWidth,
        ),
        titleTop: resolvePercentMmOrZero(tokens.geometry.page.heightMm, VOLK_REGISTER_GRID.titleTop),
        subtitleTop: resolvePercentMmOrZero(
          tokens.geometry.page.heightMm,
          VOLK_REGISTER_GRID.subtitleTop,
        ),
        senderTop: resolvePercentMmOrZero(tokens.geometry.page.heightMm, VOLK_REGISTER_GRID.senderTop),
        metaTop: resolvePercentMmOrZero(tokens.geometry.page.heightMm, VOLK_REGISTER_GRID.metaTop),
        subjectTop: resolvePercentMmOrZero(tokens.geometry.page.heightMm, VOLK_REGISTER_GRID.subjectTop),
        subjectValueTop: resolvePercentMmOrZero(
          tokens.geometry.page.heightMm,
          VOLK_REGISTER_GRID.subjectValueTop,
        ),
        subjectValueLeft: resolvePercentMmOrZero(
          tokens.geometry.page.widthMm,
          VOLK_REGISTER_GRID.subjectValueLeft,
        ),
        bodyTop: resolvePercentMmOrZero(tokens.geometry.page.heightMm, VOLK_REGISTER_GRID.bodyTop),
        dotLeft: resolvePercentMmOrZero(tokens.geometry.page.widthMm, VOLK_REGISTER_GRID.dotLeft),
        dotTop: resolvePercentMmOrZero(tokens.geometry.page.heightMm, VOLK_REGISTER_GRID.dotTop),
        bottomMargin: parseMm(VOLK_REGISTER_GRID.bottomMargin) ?? 0,
        metaLeft0: resolvePercentMmOrZero(tokens.geometry.page.widthMm, VOLK_REGISTER_GRID.metaLefts[0]),
        metaLeft1: resolvePercentMmOrZero(tokens.geometry.page.widthMm, VOLK_REGISTER_GRID.metaLefts[1]),
        metaLeft2: resolvePercentMmOrZero(tokens.geometry.page.widthMm, VOLK_REGISTER_GRID.metaLefts[2]),
        metaLeft3: resolvePercentMmOrZero(tokens.geometry.page.widthMm, VOLK_REGISTER_GRID.metaLefts[3]),
      },
    };
  }

  tokens.flow.type.display = {
    sizePt: PREVIEW_RESUME_FONT_TOKENS.displaySizePt,
    lineHeight: PREVIEW_RESUME_FONT_TOKENS.displayLine,
  };
  tokens.flow.type.title = {
    sizePt: PREVIEW_RESUME_FONT_TOKENS.titleSizePt,
    lineHeight: PREVIEW_RESUME_FONT_TOKENS.titleLine,
  };
  tokens.flow.type.body = {
    sizePt: PREVIEW_RESUME_FONT_TOKENS.bodySizePt,
    lineHeight: PREVIEW_RESUME_FONT_TOKENS.bodyLine,
  };
  tokens.flow.type.bodySm = {
    sizePt: PREVIEW_RESUME_FONT_TOKENS.bodySmSizePt,
    lineHeight: PREVIEW_RESUME_FONT_TOKENS.bodySmLine,
  };
  tokens.flow.type.label = {
    sizePt: PREVIEW_RESUME_FONT_TOKENS.labelSizePt,
    lineHeight: PREVIEW_RESUME_FONT_TOKENS.labelLine,
  };
  tokens.flow.type.meta = {
    sizePt: PREVIEW_RESUME_FONT_TOKENS.metaSizePt,
    lineHeight: PREVIEW_RESUME_FONT_TOKENS.metaLine,
  };
  tokens.flow.measure.summaryWidthMm = preview.headerSummaryWidthMm;
  tokens.flow.measure.resumeReadingWidthMm = preview.mainMm;
  tokens.flow.header.titleMarginTopMm = preview.headerTitleMarginTopMm;
  tokens.flow.header.bottomPaddingMm = preview.headerBottomPaddingMm;
  tokens.flow.rhythm.headerGapMm = preview.headerGapMm;
  tokens.flow.rhythm.sectionGapMm = preview.bodySectionGapMm;
  tokens.flow.component.sidebar = {
    rightPaddingMm: preview.sidebarRightPaddingMm,
    sectionGapMm: preview.sidebarSectionGapMm,
    titleMarginBottomMm: preview.sidebarTitleMarginBottomMm,
    titlePaddingBottomMm: preview.sidebarTitlePaddingBottomMm,
    contentGapMm: preview.sidebarContentGapMm,
  };
  tokens.flow.component.main = {
    leftPaddingMm: preview.mainLeftPaddingMm,
    sectionGapMm: preview.mainSectionGapMm,
    headingGapMm: preview.mainHeadingGapMm,
    headingMarginBottomMm: preview.mainHeadingMarginBottomMm,
  };
  tokens.flow.component.experience = {
    dateColumnWidthMm: preview.experienceDateColumnMm,
    columnGapMm: preview.experienceColumnGapMm,
    itemGapMm: preview.experienceItemGapMm,
    orgMarginBottomMm: preview.experienceOrgMarginBottomMm,
    bulletsPaddingLeftMm: preview.experienceBulletsPaddingLeftMm,
    bulletsGapMm: preview.experienceBulletsGapMm,
  };
  tokens.flow.component.project = {
    gapMm: preview.projectGapMm,
    paddingMm: preview.projectPaddingMm,
  };
  tokens.flow.component.education = {
    itemGapMm: preview.educationItemGapMm,
  };
  tokens.flow.component.skill = {
    gapMm: preview.skillGapMm,
    padInlineMm: preview.skillPaddingInlineMm,
    padBlockMm: preview.skillPaddingBlockMm,
  };
  if (isWorkshopResumeTemplateId(template.id)) {
    const workshopHeading = resolveWorkshopPreviewHeadingContract(template);
    tokens.flow.component.main = {
      ...tokens.flow.component.main,
      sectionTitleReductionMm: workshopHeading.sectionTitleReductionMm,
    };
    tokens.flow.component.experience = {
      ...tokens.flow.component.experience,
      headingSizeAdjustMm: workshopHeading.experienceHeadingSizeAdjustMm,
      headingLineHeight: workshopHeading.experienceHeadingLineHeight,
    };
    tokens.flow.pagination.bottomFitSafetyMm = workshopHeading.bottomFitSafetyMm;
  }
  tokens.flow.density = {
    displayAdjustPt: mmToPt(preview.displaySizeAdjustMm),
    titleAdjustPt: mmToPt(preview.titleSizeAdjustMm),
    bodyAdjustPt: mmToPt(preview.bodySizeAdjustMm),
    bodySmAdjustPt: mmToPt(preview.bodySmSizeAdjustMm),
    sectionGapAdjustMm: preview.sectionGapAdjustMm,
    headingMarginAdjustMm: preview.headingMarginAdjustMm,
    bulletGapAdjustMm: preview.bulletGapAdjustMm,
    projectGapAdjustMm: preview.projectGapAdjustMm,
    projectPaddingAdjustMm: preview.projectPaddingAdjustMm,
  };
  return tokens;
}

export function normalizeResumeExportTokens(args: {
  mode: ExportMode;
  resumeTemplateId?: ResumeTemplateId | null;
  layout?: VerbatiLayoutPreset | null;
  stylePreset?: VerbatiStylePreset | null;
  pageSize?: DocumentPageSize | null;
}): {
  id: ResumeExportProfileDefinition["id"];
  shell: ResumeExportProfileDefinition["shell"];
  canonical: CanonicalDocumentTokens;
} {
  const pageSize = resolveDocumentPageSize({ pageSize: args.pageSize });
  const normalizedStylePreset = normalizeStylePreset(args.stylePreset);
  const activeTemplate = args.resumeTemplateId
    ? getResumeTemplateDefinition(args.resumeTemplateId)
    : null;
  const derivedOneColumnEntryMetaWidthMm =
    activeTemplate?.exportShell === "onecol"
      ? resolveResumeEntryMetaWidthMm({
          mainMm: activeTemplate.export.mainMm,
          readingWidthMm: activeTemplate.export.readingWidthMm,
          entryMetaWidthMm: activeTemplate.export.entryMetaWidthMm,
        })
      : undefined;
  const definition =
    args.mode === "ats"
      ? {
          ...RESUME_EXPORT_PROFILE_DEFINITIONS.ats,
          flow: {
            ...RESUME_EXPORT_PROFILE_DEFINITIONS.ats.flow,
            entryMetaWidthMm: derivedOneColumnEntryMetaWidthMm,
          },
        }
      : (() => {
          const template = getResumeTemplateDefinition(args.resumeTemplateId);
          return {
            id: template.id,
            shell: template.exportShell,
            margins: {
              topMm: template.export.topMm,
              rightMm: template.export.rightMm,
              bottomMm: template.export.bottomMm,
              leftMm: template.export.leftMm,
            },
            columns:
              template.exportShell === "split" || template.export.sidebarMm > 0
                ? {
                    sidebarMm: template.export.sidebarMm,
                    gutterMm: template.export.gutterMm,
                  }
                : undefined,
            flow: {
              summaryWidthMm: template.export.summaryWidthMm,
              readingWidthMm: template.export.readingWidthMm,
              entryMetaWidthMm: resolveResumeEntryMetaWidthMm({
                mainMm: template.export.mainMm,
                readingWidthMm: template.export.readingWidthMm,
                entryMetaWidthMm: template.export.entryMetaWidthMm,
              }),
              titleSizePt: template.export.titleSizePt,
              titleLineHeight: template.export.titleLineHeight,
              headerGapMm: template.export.headerGapMm,
              sectionGapMm: template.export.sectionGapMm,
              entryGapMm: template.export.entryGapMm,
            },
          } satisfies ResumeExportProfileDefinition;
        })();
  const tokens = createEmptyCanonicalTokens();
  const topMm = definition.margins?.topMm ?? 17;
  const rightMm = definition.margins?.rightMm ?? 35;
  const bottomMm = definition.margins?.bottomMm ?? 35;
  const leftMm = definition.margins?.leftMm ?? 17;
  const liveArea = deriveLiveArea({
    topMm,
    rightMm,
    bottomMm,
    leftMm,
    pageWidthMm: pageSize.widthMm,
    pageHeightMm: pageSize.heightMm,
  });

  tokens.geometry.page = {
    widthMm: pageSize.widthMm,
    heightMm: pageSize.heightMm,
    margin: {
      topMm,
      rightMm,
      bottomMm,
      leftMm,
    },
    liveArea,
  };
  tokens.geometry.columns = {
    sidebarMm: definition.columns?.sidebarMm ?? 0,
    gutterMm: definition.columns?.gutterMm ?? 0,
    mainMm:
      definition.columns !== undefined
        ? liveArea.widthMm -
          definition.columns.sidebarMm -
          definition.columns.gutterMm
        : liveArea.widthMm,
  };
  tokens.geometry.primitives = {
    robialStep: {
      stepAMm: 17,
      stepBMm: 18,
      halfStepMm: 8.5,
    },
  };
  tokens.flow = baseExportFlowTokens();
  tokens.flow.measure.summaryWidthMm = definition.flow.summaryWidthMm;
  tokens.flow.measure.resumeReadingWidthMm = definition.flow.readingWidthMm;
  tokens.flow.measure.resumeEntryMetaWidthMm = definition.flow.entryMetaWidthMm;
  tokens.flow.type.title = {
    sizePt: definition.flow.titleSizePt,
    lineHeight: definition.flow.titleLineHeight,
  };
  tokens.flow.rhythm.headerGapMm = definition.flow.headerGapMm;
  tokens.flow.rhythm.sectionGapMm = definition.flow.sectionGapMm;
  tokens.flow.rhythm.entryGapMm = definition.flow.entryGapMm;
  tokens.flow.component.experience = {
    bulletsPaddingLeftMm: activeTemplate?.preview.experienceBulletsPaddingLeftMm,
  };
  tokens.appearance = resolveResumeExportCanonicalAppearance({
    mode: args.mode,
    stylePreset: normalizedStylePreset,
    layout: definition.id === "ats" ? "swiss" : normalizedStylePreset.layout,
  });

  return {
    id: definition.id,
    shell: definition.shell,
    canonical: tokens,
  };
}

export function normalizeProposalExportTokens(args: {
  mode: ExportMode;
  proposalTemplateId?: ProposalTemplateId | null;
  stylePreset?: VerbatiStylePreset | null;
  pageSize?: DocumentPageSize | null;
}): {
  id: ProposalExportProfileDefinition["id"];
  shell: ProposalExportProfileDefinition["shell"];
  templateId: ProposalTemplateId | null;
  canonical: CanonicalDocumentTokens;
} {
  const pageSize = resolveDocumentPageSize({ pageSize: args.pageSize });
  const resolvedTemplateId =
    args.mode === "ats"
      ? null
      : resolveProposalTemplateId(args.proposalTemplateId);
  const definition = resolvedTemplateId
    ? getProposalTemplateDefinition(resolvedTemplateId)
    : null;
  const leftMarginMm = definition?.leftMarginMm ?? 17;
  const topMm = definition?.topOffsetMm ?? 17;
  const rightMm = definition?.rightMarginMm ?? 35;
  const bottomMm = definition?.bottomMarginMm ?? 35;
  const leftZoneMm = definition?.leftZoneMm ?? 35;
  const gutterMm = definition?.gutterMm ?? 18;
  const liveArea = deriveLiveArea({
    topMm,
    rightMm,
    bottomMm,
    leftMm: leftMarginMm,
    pageWidthMm: pageSize.widthMm,
    pageHeightMm: pageSize.heightMm,
  });
  const mainMm =
    pageSize.widthMm - leftMarginMm - rightMm - leftZoneMm - gutterMm;
  const tokens = createEmptyCanonicalTokens();

  tokens.geometry.page = {
    widthMm: pageSize.widthMm,
    heightMm: pageSize.heightMm,
    margin: {
      topMm,
      rightMm,
      bottomMm,
      leftMm: leftMarginMm,
    },
    liveArea,
  };
  tokens.geometry.columns = {
    sidebarMm: leftZoneMm,
    gutterMm,
    mainMm,
  };
  tokens.geometry.template = {
    leftZoneMm,
    topOffsetMm: topMm,
    bodyStartMm: definition?.bodyStartMm ?? 94.5,
    rightMarginMm: rightMm,
    bottomMarginMm: bottomMm,
  };
  tokens.geometry.primitives = {
    robialStep: {
      stepAMm: definition?.gridStepAMm ?? 17,
      stepBMm: definition?.gridStepBMm ?? 18,
      halfStepMm: definition?.gridHalfStepMm ?? 8.5,
    },
    volkGrid: proposalVolkGridTokens(pageSize),
  };
  tokens.flow = baseExportFlowTokens();
  tokens.flow.type.title = {
    sizePt: mmToPt(BASE_PROPOSAL_TITLE_SCALE_MM),
    lineHeight:
      args.mode === "ats"
        ? 1.08
        : definition?.id === "editorial_wide"
          ? 1.02
          : 1.06,
  };
  tokens.flow.measure.proposalReadingWidthCh =
    definition?.readingMeasureCh ?? undefined;
  tokens.flow.measure.proposalMetaWidthMm =
    definition?.leftZoneMm === 52 ? 42 : 34;
  tokens.flow.template.titleScaleMultiplier = definition
    ? definition.titleScaleMm / BASE_PROPOSAL_TITLE_SCALE_MM
    : 1;
  tokens.flow.rhythm.headerGapMm =
    args.mode === "ats" ? 10 : definition?.leftZoneMm === 52 ? 13 : 11;
  tokens.flow.rhythm.sectionGapMm =
    args.mode === "ats" ? 6.8 : definition?.id === "volk_register" ? 7.4 : 7;
  tokens.flow.rhythm.stackGapMm =
    args.mode === "ats" ? 4.4 : definition?.id === "volk_register" ? 5.2 : 4.8;
  tokens.appearance = resolveProposalExportCanonicalAppearance({
    mode: args.mode,
    stylePreset: normalizeStylePreset(args.stylePreset),
    templateId: resolvedTemplateId,
  });

  return {
    id: resolvedTemplateId ?? "ats",
    shell:
      args.mode === "ats"
        ? "onecol"
        : definition?.exportShell ?? "rail",
    templateId: resolvedTemplateId,
    canonical: tokens,
  };
}

export function normalizeProposalPreviewTokens(
  args: ProposalPreviewNormalizationArgs,
): CanonicalDocumentTokens {
  const pageSize = resolveDocumentPageSize({ pageSize: args.pageSize });
  const resolvedTemplateId = resolveProposalTemplateId(args.templateId);
  const definition = getProposalTemplateDefinition(resolvedTemplateId);
  const tokens = createEmptyCanonicalTokens();
  const resolvedStyle = normalizeStylePreset(args.stylePreset);
  tokens.appearance = resolvePreviewCanonicalAppearance(resolvedStyle);
  const leftMarginMm = definition.leftMarginMm;
  const rightMm = definition.rightMarginMm;
  const topMm = definition.topOffsetMm;
  const bottomMm = definition.bottomMarginMm;

  tokens.geometry.page = {
    widthMm: pageSize.widthMm,
    heightMm: pageSize.heightMm,
    margin: {
      topMm,
      rightMm,
      bottomMm,
      leftMm: leftMarginMm,
    },
    liveArea: deriveLiveArea({
      topMm,
      rightMm,
      bottomMm,
      leftMm: leftMarginMm,
      pageWidthMm: pageSize.widthMm,
      pageHeightMm: pageSize.heightMm,
    }),
  };
  tokens.geometry.template = {
    leftZoneMm: definition.leftZoneMm,
    topOffsetMm: definition.topOffsetMm,
    bodyStartMm: definition.bodyStartMm,
    rightMarginMm: definition.rightMarginMm,
    bottomMarginMm: definition.bottomMarginMm,
  };
  tokens.geometry.columns = {
    sidebarMm: definition.leftZoneMm,
    gutterMm: definition.gutterMm,
    mainMm:
      pageSize.widthMm -
      leftMarginMm -
      definition.rightMarginMm -
      definition.leftZoneMm -
      definition.gutterMm,
  };
  tokens.geometry.primitives = {
    robialStep: {
      stepAMm: definition.gridStepAMm,
      stepBMm: definition.gridStepBMm,
      halfStepMm: definition.gridHalfStepMm,
    },
    volkGrid: proposalVolkGridTokens(pageSize),
  };
  tokens.flow.type.title = {
    sizePt: mmToPt(BASE_PROPOSAL_TITLE_SCALE_MM),
    lineHeight: resolvedTemplateId === "editorial_wide" ? 1.02 : 1.06,
  };
  tokens.flow.type.body = {
    sizePt: proposalBodySizePtFromTypography(args.documentTypography.fontSize),
    lineHeight: args.documentTypography.lineHeight,
    resolvedTrackingEm: parseEm(args.documentTypography.letterSpacing),
  };
  tokens.flow.measure.proposalReadingWidthCh = definition.readingMeasureCh;
  tokens.flow.template.titleScaleMultiplier =
    definition.titleScaleMm / BASE_PROPOSAL_TITLE_SCALE_MM;
  tokens.flow.rhythm.headerGapMm = definition.leftZoneMm === 52 ? 13 : 11;
  tokens.flow.rhythm.sectionGapMm =
    resolvedTemplateId === "volk_register" ? 7.4 : 7;
  tokens.flow.rhythm.stackGapMm =
    resolvedTemplateId === "volk_register" ? 5.2 : 4.8;
  tokens.appearance.font.body = {
    family: args.documentTypography.fontFamily,
    weight: args.documentTypography.fontWeight,
  };
  tokens.runtime.rendererCompensation["proposalDocumentPageGapPx"] =
    args.pageGapPx ?? 0;

  return tokens;
}

export function canonicalSnapshot(tokens: CanonicalDocumentTokens) {
  return JSON.parse(JSON.stringify(tokens)) as CanonicalDocumentTokens;
}

export function proposalTitleScaleMm(tokens: CanonicalDocumentTokens): number {
  return (
    (tokens.flow.template.titleScaleMultiplier ?? 1) *
    BASE_PROPOSAL_TITLE_SCALE_MM
  );
}

export function densityPtToPreviewMm(
  valuePt: number | undefined,
): string | undefined {
  if (valuePt === undefined) {
    return undefined;
  }

  return formatMm(ptToMm(valuePt));
}
