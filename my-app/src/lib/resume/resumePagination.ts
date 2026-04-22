import type {
  ResumeAffiliationItem,
  ResumeCertificationItem,
  ResumeData,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeHobbyItem,
  ResumeLanguage,
  ResumeProjectItem,
  ResumeSkillItem,
  ResumeTextListItem,
  ResumeTextSection,
} from "../../features/verbati/resume/resume.types";
import type { ResumePreviewSectionType } from "../../features/verbati/resumeLinking";
import type { VerbatiStylePreset } from "../../features/verbati/types";
import { normalizeResumePreviewTokens } from "../layout/documentTokenNormalizer";
import { ptToMm } from "../layout/documentTokens";
import {
  resolveWorkshopPreviewLayoutContract,
  type ResumeTemplateDefinition,
} from "../layout/resumeTemplates";
import { resolveWorkshopHeadingFitContract } from "./workshopHeadingContract";

type WorkshopEntryKind =
  | "profile"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "selected_projects"
  | "languages"
  | "certifications"
  | "achievements"
  | "affiliations"
  | "hobbies"
  | "additional_information";

const EXPERIENCE_USEFUL_CHARS_PER_LINE = 70;
const EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES = 3;
const EXPERIENCE_MIN_PARTIAL_SPLIT_USEFUL_LINES = 6;
const EXPERIENCE_MIN_PARTIAL_SPLIT_CHARS =
  EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES * EXPERIENCE_USEFUL_CHARS_PER_LINE;
const EXPERIENCE_DENSE_NUMERIC_CHARS_PER_LINE_MULTIPLIER = 1;
const EXPERIENCE_DENSE_ALNUM_CHARS_PER_LINE_MULTIPLIER = 0.95;

export type WorkshopExperienceContentBlock = {
  kind: "text" | "bullet";
  text: string;
  partial?: boolean;
};

type WorkshopPlannerExperienceContentBlock = WorkshopExperienceContentBlock & {
  charsPerLine: number;
  usefulLines: number;
  estimatedHeight: number;
};

type WorkshopPlannerExperienceEntry = {
  id: string;
  kind: "experience";
  sourceEntryId: string;
  fragmentIndex: number;
  continued: boolean;
  estimatedHeight: number;
  role: string;
  company: string;
  period: string;
  location: string;
  sectionId: string;
  sectionType: ResumePreviewSectionType;
  sectionTitle?: string;
  sectionOrder?: number;
  blocks: WorkshopPlannerExperienceContentBlock[];
};

export type WorkshopPlannerEntry =
  | {
      id: "profile";
      kind: "profile";
      estimatedHeight: number;
    }
  | {
      id: "summary";
      kind: "summary";
      estimatedHeight: number;
      text: string;
    }
  | WorkshopPlannerExperienceEntry
  | {
      id: string;
      kind: "education";
      estimatedHeight: number;
      item: ResumeEducationItem;
    }
  | {
      id: string;
      kind: "skills";
      estimatedHeight: number;
      item: ResumeSkillItem;
    }
  | {
      id: string;
      kind: "selected_projects";
      estimatedHeight: number;
      item: ResumeProjectItem;
    }
  | {
      id: string;
      kind: "languages";
      estimatedHeight: number;
      item: ResumeLanguage;
    }
  | {
      id: string;
      kind: "certifications";
      estimatedHeight: number;
      item: ResumeCertificationItem;
    }
  | {
      id: string;
      kind: "achievements";
      estimatedHeight: number;
      item: ResumeTextListItem;
    }
  | {
      id: string;
      kind: "affiliations";
      estimatedHeight: number;
      item: ResumeAffiliationItem;
    }
  | {
      id: string;
      kind: "hobbies";
      estimatedHeight: number;
      item: ResumeHobbyItem;
    }
  | {
      id: string;
      kind: "additional_information";
      estimatedHeight: number;
      item: ResumeTextSection;
    };

export type WorkshopPlannerSection = {
  key: string;
  kind: WorkshopEntryKind;
  sectionType: ResumePreviewSectionType;
  sectionId?: string;
  title?: string;
  continued: boolean;
  entries: WorkshopPlannerEntry[];
};

function isAtomicNonExperienceEntryKind(
  kind: WorkshopPlannerEntry["kind"],
): boolean {
  return kind !== "profile" && kind !== "summary" && kind !== "experience";
}

export type WorkshopResumePagePlan = {
  index: number;
  estimatedHeight: number;
  entries: WorkshopPlannerEntry[];
  sections: WorkshopPlannerSection[];
};

type WorkshopCommittedMetaItem = {
  label: string;
  value: string;
};

type WorkshopCommittedProfileFragment = {
  fragmentId: string;
  kind: "profile";
  sectionType: "profile";
  sectionId?: string;
  title?: string;
  continued: boolean;
  profile: {
    name: string;
    title: string;
  };
  contact: WorkshopCommittedMetaItem[];
  metadata: WorkshopCommittedMetaItem[];
};

type WorkshopCommittedSummaryFragment = {
  fragmentId: string;
  kind: "summary";
  sectionType: "summary";
  sectionId?: string;
  title?: string;
  continued: boolean;
  text: string;
};

type WorkshopCommittedExperienceItem = {
  id: string;
  continued: boolean;
  role: string;
  company: string;
  period: string;
  location: string;
  blocks: WorkshopExperienceContentBlock[];
};

type WorkshopCommittedEducationItem = {
  id: string;
  degree: string;
  school: string;
  period: string;
};

type WorkshopCommittedSkillItem = {
  id: string;
  name: string;
  level?: string;
};

type WorkshopCommittedProjectItem = {
  id: string;
  name: string;
  meta: string;
  description: string;
};

type WorkshopCommittedLanguageItem = {
  id: string;
  name: string;
  level: string;
};

type WorkshopCommittedCertificationItem = {
  id: string;
  name: string;
  issuer?: string;
  meta?: string;
};

type WorkshopCommittedTextItem = {
  id: string;
  text: string;
};

type WorkshopCommittedAffiliationItem = {
  id: string;
  organizationName: string;
  roleOrMembershipType?: string;
  dateRange?: string;
  notes?: string;
};

type WorkshopCommittedNamedItem = {
  id: string;
  name: string;
};

type WorkshopCommittedTextSectionItem = {
  id: string;
  sectionTitle: string;
  text: string;
};

export type WorkshopResumeCommittedFragment =
  | WorkshopCommittedProfileFragment
  | WorkshopCommittedSummaryFragment
  | {
      fragmentId: string;
      kind: "experience";
      sectionType: "experience";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedExperienceItem[];
    }
  | {
      fragmentId: string;
      kind: "education";
      sectionType: "education";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedEducationItem[];
    }
  | {
      fragmentId: string;
      kind: "skills";
      sectionType: "skills";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedSkillItem[];
    }
  | {
      fragmentId: string;
      kind: "selected_projects";
      sectionType: "selected_projects";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedProjectItem[];
    }
  | {
      fragmentId: string;
      kind: "languages";
      sectionType: "languages";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedLanguageItem[];
    }
  | {
      fragmentId: string;
      kind: "certifications";
      sectionType: "certifications";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedCertificationItem[];
    }
  | {
      fragmentId: string;
      kind: "achievements";
      sectionType: "achievements";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedTextItem[];
    }
  | {
      fragmentId: string;
      kind: "affiliations";
      sectionType: "affiliations";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedAffiliationItem[];
    }
  | {
      fragmentId: string;
      kind: "hobbies";
      sectionType: "hobbies";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedNamedItem[];
    }
  | {
      fragmentId: string;
      kind: "additional_information";
      sectionType: "additional_information";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedTextSectionItem[];
    };

export type WorkshopResumeCommittedPage = {
  pageId: string;
  index: number;
  estimatedHeight: number;
  fragments: WorkshopResumeCommittedFragment[];
};

export type WorkshopResumePlan = {
  pageCount: number;
  pages: WorkshopResumePagePlan[];
  committedPages: WorkshopResumeCommittedPage[];
};

type PlannerSectionDefinition = {
  key: string;
  kind: WorkshopEntryKind;
  sectionType: ResumePreviewSectionType;
  sectionId?: string;
  title?: string;
  order: number;
  headerHeight: number;
  entries: WorkshopPlannerEntry[];
};

const WORKSHOP_SINGLE_TAIL_GUARD_KINDS = new Set<WorkshopEntryKind>([
  "education",
  "skills",
  "languages",
  "achievements",
  "certifications",
  "affiliations",
  "hobbies",
]);

const WORKSHOP_RENDER_SECTION_CONTENT_GAP_MM = 2.6;

type WorkshopPlannerMetrics = {
  pageHeightBudgetMm: number;
  summaryCharsPerLine: number;
  readingCharsPerLine: number;
  compactCharsPerLine: number;
  bodyLineHeightMm: number;
  bodySmLineHeightMm: number;
  metaLineHeightMm: number;
  experienceHeadingLineHeightMm: number;
  experienceBlockGapMm: number;
  experienceMetaGapMm: number;
  sectionHeaderHeightMm: number;
  labelLineHeightMm: number;
  displayLineHeightMm: number;
  titleLineHeightMm: number;
  headerGapMm: number;
  headerBottomPaddingMm: number;
  sectionGapMm: number;
  sectionContentGapMm: number;
  mainHeadingMarginMm: number;
  experienceBulletGapMm: number;
  listGapMm: number;
  projectGapMm: number;
  projectPaddingMm: number;
  educationGapMm: number;
  compactMetaGapMm: number;
  skillGapMm: number;
  skillPadInlineMm: number;
  skillPadBlockMm: number;
  bottomFitSafetyMm: number;
};

type WorkshopSplitCandidateRejectionReason =
  | "head_below_210_chars"
  | "tail_below_210_chars"
  | "head_below_3_lines"
  | "tail_below_3_lines"
  | "head_does_not_fit"
  | "not_wrap_boundary";

type WorkshopSplitCandidateTrace = {
  splitIndex: number;
  accepted: boolean;
  rejectionReason?: WorkshopSplitCandidateRejectionReason;
  headTextLength: number;
  tailTextLength: number;
  headUsefulLines?: number;
  tailUsefulLines?: number;
  headEstimatedHeight?: number;
  tailEstimatedHeight?: number;
};

export type WorkshopPaginationSplitDecisionTrace = {
  entryId: string;
  fragmentIndex: number;
  blockIndex: number;
  blockKind: WorkshopExperienceContentBlock["kind"];
  blockEstimatedHeight: number;
  pageHeightBudgetMm: number;
  currentPageEstimatedHeightBeforeSplit: number;
  pendingSectionHeaderHeight: number;
  availableHeight: number;
  availableBlockHeight: number;
  availableUsefulLines: number;
  charsPerLine: number;
  candidateStrategy: "whitespace" | "dense-anywhere";
  candidateSplitIndices: number[];
  candidateEvaluations: WorkshopSplitCandidateTrace[];
  deeperRejectedCandidates: WorkshopSplitCandidateTrace[];
  chosenSplitIndex: number | null;
  finalHeadHeight?: number;
  finalTailHeight?: number;
};

export type WorkshopPaginationDebugTrace = {
  pageHeightBudgetMm?: number;
  splitDecisions: WorkshopPaginationSplitDecisionTrace[];
};

function estimateTextHeight(text: string, lineLength: number, lineHeight: number) {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.ceil(normalized.length / lineLength) * lineHeight;
}

function estimateUsefulLines(text: string, charsPerLine: number) {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.ceil(normalized.length / Math.max(1, charsPerLine));
}

function resolveExperienceBlockCharsPerLine(text: string, baseCharsPerLine: number) {
  const normalized = text.trim();
  if (
    normalized.length < EXPERIENCE_USEFUL_CHARS_PER_LINE ||
    /\s/.test(normalized)
  ) {
    return baseCharsPerLine;
  }

  const digitCount = (normalized.match(/[0-9]/g) ?? []).length;
  const alphaNumericCount = (normalized.match(/[A-Za-z0-9]/g) ?? []).length;
  const digitRatio = digitCount / Math.max(1, normalized.length);
  const alphaNumericRatio = alphaNumericCount / Math.max(1, normalized.length);

  if (digitRatio >= 0.9) {
    return Math.max(
      baseCharsPerLine,
      Math.floor(
        baseCharsPerLine *
          EXPERIENCE_DENSE_NUMERIC_CHARS_PER_LINE_MULTIPLIER,
      ),
    );
  }

  if (alphaNumericRatio >= 0.9) {
    return Math.max(
      1,
      Math.floor(
        baseCharsPerLine * EXPERIENCE_DENSE_ALNUM_CHARS_PER_LINE_MULTIPLIER,
      ),
    );
  }

  return baseCharsPerLine;
}

function fitsWithinWorkshopAvailableHeight(
  estimatedHeight: number,
  availableHeight: number,
  safetyMm: number,
) {
  return estimatedHeight <= Math.max(0, availableHeight - safetyMm);
}

function resolveTextLineHeightMm(
  sizePt: number | undefined,
  lineHeight: number | undefined,
  adjustPt = 0,
) {
  if (sizePt === undefined) {
    return 0;
  }

  return ptToMm(sizePt + adjustPt) * (lineHeight ?? 1.2);
}

function resolveCharsPerLine(widthMm: number | undefined, lineHeightMm: number) {
  if (widthMm === undefined || widthMm <= 0) {
    return 60;
  }

  return Math.max(18, Math.floor(widthMm / Math.max(1.65, lineHeightMm * 0.36)));
}

function buildPlannerMetrics(args: {
  template: ResumeTemplateDefinition;
  stylePreset?: VerbatiStylePreset | null;
}): WorkshopPlannerMetrics {
  const tokens = normalizeResumePreviewTokens({
    resumeTemplateId: args.template.id,
    template: args.template,
    stylePreset: args.stylePreset,
  });
  const headingContract = resolveWorkshopHeadingFitContract(tokens);
  const workshopLayout = resolveWorkshopPreviewLayoutContract(args.template);
  const bodyLineHeightMm = resolveTextLineHeightMm(
    tokens.flow.type.body.sizePt,
    tokens.flow.type.body.lineHeight,
    tokens.flow.density.bodyAdjustPt,
  );
  const bodySmLineHeightMm = resolveTextLineHeightMm(
    tokens.flow.type.bodySm.sizePt,
    tokens.flow.type.bodySm.lineHeight,
    tokens.flow.density.bodySmAdjustPt,
  );
  const labelLineHeightMm = resolveTextLineHeightMm(
    tokens.flow.type.label.sizePt,
    tokens.flow.type.label.lineHeight,
  );
  const metaLineHeightMm = resolveTextLineHeightMm(
    tokens.flow.type.meta.sizePt,
    tokens.flow.type.meta.lineHeight,
  );
  const displayLineHeightMm = resolveTextLineHeightMm(
    tokens.flow.type.display.sizePt,
    tokens.flow.type.display.lineHeight,
    tokens.flow.density.displayAdjustPt,
  );
  const titleLineHeightMm = resolveTextLineHeightMm(
    tokens.flow.type.title.sizePt,
    tokens.flow.type.title.lineHeight,
    tokens.flow.density.titleAdjustPt,
  );
  const titleLineHeight =
    tokens.flow.type.title.lineHeight ?? args.template.preview.bodyLineHeight;
  const titleSizeMm = ptToMm(
    (tokens.flow.type.title.sizePt ?? 0) + (tokens.flow.density.titleAdjustPt ?? 0),
  );
  const experienceHeadingLineHeightMm =
    (ptToMm(
      (tokens.flow.type.body.sizePt ?? 0) + (tokens.flow.density.bodyAdjustPt ?? 0),
    ) +
      headingContract.experienceHeadingSizeAdjustMm) *
    headingContract.experienceHeadingLineHeight;
  const sectionHeaderHeightMm = Math.max(
    6,
    Math.max(
      0,
      titleSizeMm - headingContract.sectionTitleReductionMm,
    ) *
      titleLineHeight +
      workshopLayout.sectionShellGapMm,
  );
  const liveHeightMm =
    tokens.geometry.page.liveArea?.heightMm ?? args.template.preview.liveHeightMm;

  return {
    pageHeightBudgetMm: Math.max(liveHeightMm - 4, 120),
    summaryCharsPerLine: resolveCharsPerLine(
      tokens.flow.measure.summaryWidthMm,
      bodyLineHeightMm,
    ),
    readingCharsPerLine: resolveCharsPerLine(
      tokens.flow.measure.resumeReadingWidthMm,
      bodyLineHeightMm,
    ),
    compactCharsPerLine: resolveCharsPerLine(
      tokens.flow.measure.resumeReadingWidthMm,
      bodySmLineHeightMm,
    ),
    bodyLineHeightMm,
    bodySmLineHeightMm,
    metaLineHeightMm,
    experienceHeadingLineHeightMm,
    experienceBlockGapMm: workshopLayout.experienceBlockGapMm,
    experienceMetaGapMm: workshopLayout.experienceMetaGapMm,
    sectionHeaderHeightMm,
    labelLineHeightMm,
    displayLineHeightMm,
    titleLineHeightMm,
    headerGapMm: tokens.flow.rhythm.headerGapMm ?? args.template.preview.headerGapMm,
    headerBottomPaddingMm:
      tokens.flow.header.bottomPaddingMm ?? args.template.preview.headerBottomPaddingMm,
    sectionGapMm:
      tokens.flow.rhythm.sectionGapMm ?? args.template.preview.bodySectionGapMm,
    sectionContentGapMm: workshopLayout.sectionContentGapMm,
    mainHeadingMarginMm:
      tokens.flow.component.main?.headingMarginBottomMm ??
      args.template.preview.mainHeadingMarginBottomMm,
    experienceBulletGapMm: workshopLayout.listGapMm,
    listGapMm: workshopLayout.listGapMm,
    projectGapMm:
      tokens.flow.component.project?.gapMm ?? args.template.preview.projectGapMm,
    projectPaddingMm:
      tokens.flow.component.project?.paddingMm ??
      args.template.preview.projectPaddingMm,
    educationGapMm:
      tokens.flow.component.education?.itemGapMm ??
      args.template.preview.educationItemGapMm,
    compactMetaGapMm: workshopLayout.compactMetaGapMm,
    skillGapMm:
      tokens.flow.component.skill?.gapMm ?? args.template.preview.skillGapMm,
    skillPadInlineMm:
      tokens.flow.component.skill?.padInlineMm ??
      args.template.preview.skillPaddingInlineMm,
    skillPadBlockMm:
      tokens.flow.component.skill?.padBlockMm ??
      args.template.preview.skillPaddingBlockMm,
    bottomFitSafetyMm: headingContract.bottomFitSafetyMm,
  };
}

function normalizeExperienceTextSegments(text: string | undefined) {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function buildPlannerExperienceBlock(args: {
  kind: WorkshopExperienceContentBlock["kind"];
  text: string;
  metrics: WorkshopPlannerMetrics;
  partial?: boolean;
}): WorkshopPlannerExperienceContentBlock {
  const charsPerLine = resolveExperienceBlockCharsPerLine(
    args.text,
    args.metrics.readingCharsPerLine,
  );
  const usefulLines = estimateUsefulLines(
    args.text,
    charsPerLine,
  );

  return {
    kind: args.kind,
    text: args.text.trim(),
    ...(args.partial ? { partial: true } : {}),
    charsPerLine,
    usefulLines,
    estimatedHeight: usefulLines * args.metrics.bodyLineHeightMm,
  };
}

function estimateExperienceHeaderHeight(args: {
  role: string;
  company: string;
  location: string;
  period: string;
  continued: boolean;
  metrics: WorkshopPlannerMetrics;
}) {
  const headingText = args.continued ? `${args.role} Continued` : args.role;
  const metaText = [args.company, args.location, args.period]
    .filter(Boolean)
    .join(" · ");

  return (
    estimateTextHeight(
      headingText,
      args.metrics.compactCharsPerLine,
      args.metrics.experienceHeadingLineHeightMm,
    ) +
    args.metrics.experienceMetaGapMm +
    args.metrics.experienceBlockGapMm +
    estimateTextHeight(
      metaText,
      args.metrics.compactCharsPerLine,
      args.metrics.metaLineHeightMm,
    )
  );
}

function estimateExperienceBlocksHeight(
  blocks: WorkshopPlannerExperienceContentBlock[],
  metrics: WorkshopPlannerMetrics,
) {
  if (blocks.length === 0) {
    return 0;
  }

  let totalHeight = 0;
  let groupCount = 0;
  let bulletCount = 0;
  let bulletLineCount = 0;

  const flushBulletGroup = () => {
    if (bulletCount === 0) {
      return;
    }

    totalHeight +=
      bulletLineCount * metrics.bodyLineHeightMm +
      Math.max(0, bulletCount - 1) * metrics.experienceBulletGapMm;
    groupCount += 1;
    bulletCount = 0;
    bulletLineCount = 0;
  };

  for (const block of blocks) {
    if (block.kind === "bullet") {
      bulletCount += 1;
      bulletLineCount += block.usefulLines;
      continue;
    }

    flushBulletGroup();
    totalHeight += block.estimatedHeight;
    groupCount += 1;
  }

  flushBulletGroup();

  return totalHeight + Math.max(0, groupCount - 1) * metrics.experienceBlockGapMm;
}

function countExperienceUsefulLines(
  blocks: WorkshopPlannerExperienceContentBlock[],
) {
  return blocks.reduce((sum, block) => sum + block.usefulLines, 0);
}

function computeMinimumViableExperienceFragmentHeight(
  headerHeight: number,
  metrics: WorkshopPlannerMetrics,
) {
  return (
    headerHeight +
    EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES * metrics.bodyLineHeightMm
  );
}

function buildPlannerExperienceEntry(
  item: ResumeExperienceItem,
  metrics: WorkshopPlannerMetrics,
  fragmentIndex = 0,
  continued = false,
  blocks?: WorkshopPlannerExperienceContentBlock[],
): WorkshopPlannerExperienceEntry {
  const normalizedBlocks =
    blocks ??
    [
      ...normalizeExperienceTextSegments(item.description).map((text) =>
        buildPlannerExperienceBlock({
          kind: "text",
          text,
          metrics,
        }),
      ),
      ...item.bullets
        .map((bullet) => bullet.trim())
        .filter(Boolean)
        .map((text) =>
          buildPlannerExperienceBlock({
            kind: "bullet",
            text,
            metrics,
          }),
        ),
    ];
  const headerHeight = estimateExperienceHeaderHeight({
    role: item.role,
    company: item.company,
    location: item.location,
    period: item.period,
    continued,
    metrics,
  });

  return {
    id: fragmentIndex === 0 ? item.id : `${item.id}__fragment_${fragmentIndex + 1}`,
    kind: "experience",
    sourceEntryId: item.id,
    fragmentIndex,
    continued,
    role: item.role,
    company: item.company,
    period: item.period,
    location: item.location,
    sectionId: item.sectionId,
    sectionType: item.sectionType as ResumePreviewSectionType,
    sectionTitle: item.sectionTitle,
    sectionOrder: item.sectionOrder,
    blocks: normalizedBlocks,
    estimatedHeight:
      headerHeight + estimateExperienceBlocksHeight(normalizedBlocks, metrics),
  };
}

function clonePlannerExperienceEntry(args: {
  entry: WorkshopPlannerExperienceEntry;
  blocks: WorkshopPlannerExperienceContentBlock[];
  fragmentIndex: number;
  continued: boolean;
  metrics: WorkshopPlannerMetrics;
}): WorkshopPlannerExperienceEntry {
  return buildPlannerExperienceEntry(
    {
      id: args.entry.sourceEntryId,
      sectionId: args.entry.sectionId,
      sectionType: "experience",
      sectionTitle: args.entry.sectionTitle,
      sectionOrder: args.entry.sectionOrder,
      role: args.entry.role,
      company: args.entry.company,
      period: args.entry.period,
      location: args.entry.location,
      description: undefined,
      bullets: [],
    },
    args.metrics,
    args.fragmentIndex,
    args.continued,
    args.blocks,
  );
}

function resolveExperienceSplitCandidates(
  text: string,
  maxChars: number,
  charsPerLine: number,
  stepChars = charsPerLine,
) {
  const maxTailSafeSplitIndex = text.length - EXPERIENCE_MIN_PARTIAL_SPLIT_CHARS;
  const cappedMax = Math.min(
    maxChars,
    maxTailSafeSplitIndex,
  );
  if (cappedMax < EXPERIENCE_MIN_PARTIAL_SPLIT_CHARS) {
    return {
      strategy: "whitespace" as const,
      candidateIndices: [],
      maxFeasibleSplitIndex: cappedMax,
      maxTailSafeSplitIndex,
    };
  }

  const indices: number[] = [];
  for (let index = cappedMax; index >= EXPERIENCE_MIN_PARTIAL_SPLIT_CHARS; index -= 1) {
    if (/\s/.test(text[index] ?? "")) {
      indices.push(index);
    }
  }

  if (indices.length > 0) {
    return {
      strategy: "whitespace" as const,
      candidateIndices: indices,
      maxFeasibleSplitIndex: cappedMax,
      maxTailSafeSplitIndex,
    };
  }

  return {
    strategy: "dense-anywhere" as const,
    candidateIndices: Array.from(
      new Set(
        Array.from(
          { length: Math.max(1, Math.floor(cappedMax / Math.max(1, stepChars))) },
          (_, index) => cappedMax - index * Math.max(1, stepChars),
        ).filter((candidateIndex) => candidateIndex >= EXPERIENCE_MIN_PARTIAL_SPLIT_CHARS),
      ),
    ),
    maxFeasibleSplitIndex: cappedMax,
    maxTailSafeSplitIndex,
  };
}

function splitExperienceBlockAtWrapBoundary(args: {
  entry: WorkshopPlannerExperienceEntry;
  blockIndex: number;
  block: WorkshopPlannerExperienceContentBlock;
  prefixBlocks: WorkshopPlannerExperienceContentBlock[];
  suffixBlocks: WorkshopPlannerExperienceContentBlock[];
  pageHeightBudgetMm: number;
  currentPageEstimatedHeightBeforeSplit: number;
  pendingSectionHeaderHeight: number;
  availableBlockHeight: number;
  metrics: WorkshopPlannerMetrics;
  debugTrace?: WorkshopPaginationDebugTrace;
}):
  | {
      headBlocks: WorkshopPlannerExperienceContentBlock[];
      tailBlocks: WorkshopPlannerExperienceContentBlock[];
    }
  | null {
  if (args.block.usefulLines < EXPERIENCE_MIN_PARTIAL_SPLIT_USEFUL_LINES) {
    return null;
  }

  const usedPrefixHeight = estimateExperienceBlocksHeight(
    args.prefixBlocks,
    args.metrics,
  );
  const remainingHeight = args.availableBlockHeight - usedPrefixHeight;
  const availableUsefulLines = Math.floor(
    Math.max(0, remainingHeight - args.metrics.bottomFitSafetyMm) /
      Math.max(args.metrics.bodyLineHeightMm, 0.0001),
  );
  if (availableUsefulLines < EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES) {
    return null;
  }

  const splitCandidates = resolveExperienceSplitCandidates(
    args.block.text,
    availableUsefulLines * args.block.charsPerLine,
    args.block.charsPerLine,
  );
  if (splitCandidates.candidateIndices.length === 0) {
    return null;
  }

  const candidateEvaluations: WorkshopSplitCandidateTrace[] = [];
  let chosenSplit:
    | {
        splitIndex: number;
        headBlocks: WorkshopPlannerExperienceContentBlock[];
        tailBlocks: WorkshopPlannerExperienceContentBlock[];
        headEstimatedHeight: number;
        tailEstimatedHeight: number;
      }
    | null = null;

  for (const splitIndex of splitCandidates.candidateIndices) {
    const headText = args.block.text.slice(0, splitIndex).trim();
    const tailText = args.block.text.slice(splitIndex).trim();
    if (
      headText.length < EXPERIENCE_MIN_PARTIAL_SPLIT_CHARS ||
      tailText.length < EXPERIENCE_MIN_PARTIAL_SPLIT_CHARS
    ) {
      candidateEvaluations.push({
        splitIndex,
        accepted: false,
        rejectionReason:
          headText.length < EXPERIENCE_MIN_PARTIAL_SPLIT_CHARS
            ? "head_below_210_chars"
            : "tail_below_210_chars",
        headTextLength: headText.length,
        tailTextLength: tailText.length,
      });
      continue;
    }

    const headBlock = buildPlannerExperienceBlock({
      kind: args.block.kind,
      text: headText,
      metrics: args.metrics,
      partial: true,
    });
    const tailBlock = buildPlannerExperienceBlock({
      kind: args.block.kind,
      text: tailText,
      metrics: args.metrics,
      partial: true,
    });
    const headBlocks = [...args.prefixBlocks, headBlock];
    const tailBlocks = [tailBlock, ...args.suffixBlocks];
    const headUsefulLines = countExperienceUsefulLines(headBlocks);
    const tailUsefulLines = countExperienceUsefulLines(tailBlocks);
    const headEstimatedHeight = estimateExperienceBlocksHeight(headBlocks, args.metrics);
    const tailEstimatedHeight = estimateExperienceBlocksHeight(tailBlocks, args.metrics);

    if (
      headUsefulLines < EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES ||
      tailUsefulLines < EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES ||
      !fitsWithinWorkshopAvailableHeight(
        headEstimatedHeight,
        args.availableBlockHeight,
        args.metrics.bottomFitSafetyMm,
      )
    ) {
      candidateEvaluations.push({
        splitIndex,
        accepted: false,
        rejectionReason:
          headUsefulLines < EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES
            ? "head_below_3_lines"
            : tailUsefulLines < EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES
              ? "tail_below_3_lines"
              : "head_does_not_fit",
        headTextLength: headText.length,
        tailTextLength: tailText.length,
        headUsefulLines,
        tailUsefulLines,
        headEstimatedHeight,
        tailEstimatedHeight,
      });
      continue;
    }

    candidateEvaluations.push({
      splitIndex,
      accepted: true,
      headTextLength: headText.length,
      tailTextLength: tailText.length,
      headUsefulLines,
      tailUsefulLines,
      headEstimatedHeight,
      tailEstimatedHeight,
    });

    chosenSplit ??= {
      splitIndex,
      headBlocks,
      tailBlocks,
      headEstimatedHeight,
      tailEstimatedHeight,
    };
  }

  if (chosenSplit) {
    if (args.debugTrace) {
      const deeperRejectedCandidates: WorkshopSplitCandidateTrace[] = [];
      for (
        let deeperIndex = splitCandidates.maxTailSafeSplitIndex;
        deeperIndex > chosenSplit.splitIndex;
        deeperIndex -= 1
      ) {
        if (
          splitCandidates.strategy === "whitespace" &&
          /\s/.test(args.block.text[deeperIndex] ?? "")
        ) {
          continue;
        }

        deeperRejectedCandidates.push({
          splitIndex: deeperIndex,
          accepted: false,
          rejectionReason:
            deeperIndex > splitCandidates.maxFeasibleSplitIndex
              ? "head_does_not_fit"
              : "not_wrap_boundary",
          headTextLength: deeperIndex,
          tailTextLength: args.block.text.length - deeperIndex,
        });
      }

      args.debugTrace.splitDecisions.push({
        entryId: args.entry.sourceEntryId,
        fragmentIndex: args.entry.fragmentIndex,
        blockIndex: args.blockIndex,
        blockKind: args.block.kind,
        blockEstimatedHeight: args.block.estimatedHeight,
        pageHeightBudgetMm: args.pageHeightBudgetMm,
        currentPageEstimatedHeightBeforeSplit:
          args.currentPageEstimatedHeightBeforeSplit,
        pendingSectionHeaderHeight: args.pendingSectionHeaderHeight,
        availableHeight:
          args.pageHeightBudgetMm -
          args.currentPageEstimatedHeightBeforeSplit -
          args.pendingSectionHeaderHeight,
        availableBlockHeight: args.availableBlockHeight,
        availableUsefulLines,
        charsPerLine: args.block.charsPerLine,
        candidateStrategy: splitCandidates.strategy,
        candidateSplitIndices: splitCandidates.candidateIndices,
        candidateEvaluations,
        deeperRejectedCandidates,
        chosenSplitIndex: chosenSplit.splitIndex,
        finalHeadHeight: chosenSplit.headEstimatedHeight,
        finalTailHeight: chosenSplit.tailEstimatedHeight,
      });
    }

    return {
      headBlocks: chosenSplit.headBlocks,
      tailBlocks: chosenSplit.tailBlocks,
    };
  }

  if (args.debugTrace) {
    args.debugTrace.splitDecisions.push({
      entryId: args.entry.sourceEntryId,
      fragmentIndex: args.entry.fragmentIndex,
      blockIndex: args.blockIndex,
      blockKind: args.block.kind,
      blockEstimatedHeight: args.block.estimatedHeight,
      pageHeightBudgetMm: args.pageHeightBudgetMm,
      currentPageEstimatedHeightBeforeSplit: args.currentPageEstimatedHeightBeforeSplit,
      pendingSectionHeaderHeight: args.pendingSectionHeaderHeight,
      availableHeight:
        args.pageHeightBudgetMm -
        args.currentPageEstimatedHeightBeforeSplit -
        args.pendingSectionHeaderHeight,
      availableBlockHeight: args.availableBlockHeight,
      availableUsefulLines,
      charsPerLine: args.block.charsPerLine,
      candidateStrategy: splitCandidates.strategy,
      candidateSplitIndices: splitCandidates.candidateIndices,
      candidateEvaluations,
      deeperRejectedCandidates: [],
      chosenSplitIndex: null,
    });
  }

  return null;
}

function splitExperienceEntryToFit(args: {
  entry: WorkshopPlannerExperienceEntry;
  availableHeight: number;
  currentPageEstimatedHeightBeforeSplit: number;
  continuationSectionHeaderHeight: number;
  metrics: WorkshopPlannerMetrics;
  debugTrace?: WorkshopPaginationDebugTrace;
}):
  | {
      head: WorkshopPlannerExperienceEntry;
      tail: WorkshopPlannerExperienceEntry;
    }
  | null {
  const headerHeight = estimateExperienceHeaderHeight({
    role: args.entry.role,
    company: args.entry.company,
    location: args.entry.location,
    period: args.entry.period,
    continued: args.entry.continued,
    metrics: args.metrics,
  });
  const continuationHeaderHeight = estimateExperienceHeaderHeight({
    role: args.entry.role,
    company: args.entry.company,
    location: args.entry.location,
    period: args.entry.period,
    continued: true,
    metrics: args.metrics,
  });
  const minimumFragmentHeight = computeMinimumViableExperienceFragmentHeight(
    headerHeight,
    args.metrics,
  );
  const continuationMinimumFragmentHeight = computeMinimumViableExperienceFragmentHeight(
    continuationHeaderHeight,
    args.metrics,
  );
  const availableBlockHeight = args.availableHeight - headerHeight;
  if (
    args.availableHeight < minimumFragmentHeight ||
    availableBlockHeight <= args.metrics.bottomFitSafetyMm
  ) {
    return null;
  }

  const pageBudgetSupportsContinuation =
    args.metrics.pageHeightBudgetMm -
      args.continuationSectionHeaderHeight >=
    continuationMinimumFragmentHeight;
  if (!pageBudgetSupportsContinuation) {
    return null;
  }

  const placedBlocks: WorkshopPlannerExperienceContentBlock[] = [];

  for (let index = 0; index < args.entry.blocks.length; index += 1) {
    const block = args.entry.blocks[index]!;
    const nextPlacedBlocks = [...placedBlocks, block];
    if (
      fitsWithinWorkshopAvailableHeight(
        estimateExperienceBlocksHeight(nextPlacedBlocks, args.metrics),
        availableBlockHeight,
        args.metrics.bottomFitSafetyMm,
      )
    ) {
      placedBlocks.push(block);
      continue;
    }

    const suffixBlocks = args.entry.blocks.slice(index);
    if (
      placedBlocks.length > 0 &&
      countExperienceUsefulLines(placedBlocks) >=
        EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES &&
      countExperienceUsefulLines(suffixBlocks) >=
        EXPERIENCE_MIN_FRAGMENT_USEFUL_LINES &&
      fitsWithinWorkshopAvailableHeight(
        estimateExperienceBlocksHeight(placedBlocks, args.metrics),
        availableBlockHeight,
        args.metrics.bottomFitSafetyMm,
      )
    ) {
      return {
        head: clonePlannerExperienceEntry({
          entry: args.entry,
          blocks: placedBlocks,
          fragmentIndex: args.entry.fragmentIndex,
          continued: args.entry.continued,
          metrics: args.metrics,
        }),
        tail: clonePlannerExperienceEntry({
          entry: args.entry,
          blocks: suffixBlocks,
          fragmentIndex: args.entry.fragmentIndex + 1,
          continued: true,
          metrics: args.metrics,
        }),
      };
    }

    const intraLineSplit = splitExperienceBlockAtWrapBoundary({
      entry: args.entry,
      blockIndex: index,
      block,
      prefixBlocks: placedBlocks,
      suffixBlocks: args.entry.blocks.slice(index + 1),
      pageHeightBudgetMm: args.metrics.pageHeightBudgetMm,
      currentPageEstimatedHeightBeforeSplit: args.currentPageEstimatedHeightBeforeSplit,
      pendingSectionHeaderHeight: args.continuationSectionHeaderHeight,
      availableBlockHeight,
      metrics: args.metrics,
      debugTrace: args.debugTrace,
    });
    if (intraLineSplit) {
      return {
        head: clonePlannerExperienceEntry({
          entry: args.entry,
          blocks: intraLineSplit.headBlocks,
          fragmentIndex: args.entry.fragmentIndex,
          continued: args.entry.continued,
          metrics: args.metrics,
        }),
        tail: clonePlannerExperienceEntry({
          entry: args.entry,
          blocks: intraLineSplit.tailBlocks,
          fragmentIndex: args.entry.fragmentIndex + 1,
          continued: true,
          metrics: args.metrics,
        }),
      };
    }
  }

  return null;
}

function estimateExperienceHeight(
  item: ResumeExperienceItem,
  metrics: WorkshopPlannerMetrics,
) {
  return buildPlannerExperienceEntry(item, metrics).estimatedHeight;
}

function estimateProjectHeight(
  item: ResumeProjectItem,
  metrics: WorkshopPlannerMetrics,
) {
  return (
    metrics.projectPaddingMm * 2 +
    estimateTextHeight(
      item.name,
      metrics.compactCharsPerLine,
      metrics.bodyLineHeightMm,
    ) +
    (item.meta
      ? metrics.compactMetaGapMm +
        estimateTextHeight(
          item.meta,
          metrics.compactCharsPerLine,
          metrics.metaLineHeightMm,
        )
      : 0) +
    metrics.projectGapMm +
    estimateTextHeight(
      item.description,
      metrics.readingCharsPerLine,
      metrics.bodyLineHeightMm,
    )
  );
}

function estimateEducationHeight(
  item: ResumeEducationItem,
  metrics: WorkshopPlannerMetrics,
) {
  return (
    metrics.educationGapMm +
    estimateTextHeight(
      item.degree,
      metrics.compactCharsPerLine,
      metrics.bodyLineHeightMm,
    ) +
    metrics.compactMetaGapMm +
    estimateTextHeight(
      `${item.school} ${item.period}`,
      metrics.compactCharsPerLine,
      metrics.metaLineHeightMm,
    )
  );
}

function estimateCertificationHeight(
  item: ResumeCertificationItem,
  metrics: WorkshopPlannerMetrics,
) {
  return (
    metrics.educationGapMm +
    estimateTextHeight(
      `${item.name} ${item.issuer ?? ""} ${item.meta ?? ""}`,
      metrics.compactCharsPerLine,
      metrics.bodySmLineHeightMm,
    )
  );
}

function estimateCompactListRowHeight(
  text: string,
  metrics: WorkshopPlannerMetrics,
) {
  return estimateTextHeight(
    text,
    metrics.compactCharsPerLine,
    metrics.bodySmLineHeightMm,
  );
}

function estimateAffiliationHeight(
  item: ResumeAffiliationItem,
  metrics: WorkshopPlannerMetrics,
) {
  return (
    metrics.educationGapMm +
    estimateTextHeight(
      `${item.organizationName} ${item.roleOrMembershipType ?? ""} ${item.dateRange ?? ""} ${item.notes ?? ""}`,
      metrics.compactCharsPerLine,
      metrics.bodySmLineHeightMm,
    )
  );
}

function buildPlannerSections(
  data: ResumeData,
  metrics: WorkshopPlannerMetrics,
): PlannerSectionDefinition[] {
  const sections: PlannerSectionDefinition[] = [];

  sections.push({
    key: "profile",
    kind: "profile",
    sectionType: "profile",
    sectionId: data.profileSectionId,
    order: -20,
    headerHeight: 0,
    entries: [
      {
        id: "profile",
        kind: "profile",
        estimatedHeight:
          metrics.displayLineHeightMm +
          (data.title.trim() ? metrics.titleLineHeightMm : 0) +
          metrics.headerGapMm +
          data.contact.length * metrics.metaLineHeightMm +
          data.metadata.length *
            (metrics.labelLineHeightMm + metrics.metaLineHeightMm) +
          metrics.headerBottomPaddingMm,
      },
    ],
  });

  if (data.summary.trim()) {
    sections.push({
      key: "summary",
      kind: "summary",
      sectionType: "summary",
      sectionId: data.summarySectionId,
      title: "Summary",
      order: -10,
      headerHeight: Math.max(6, metrics.mainHeadingMarginMm + metrics.labelLineHeightMm),
      entries: [
        {
          id: "summary",
          kind: "summary",
          estimatedHeight:
            metrics.sectionGapMm +
            estimateTextHeight(
              data.summary,
              metrics.summaryCharsPerLine,
              metrics.bodyLineHeightMm,
            ),
          text: data.summary,
        },
      ],
    });
  }

  const itemSections: PlannerSectionDefinition[] = [
    {
      key: "experience",
      kind: "experience",
      sectionType: "experience",
      sectionId: data.sectionIdsByType?.experience?.[0] ?? data.experience[0]?.sectionId,
      title: "Experience",
      order: data.experience[0]?.sectionOrder ?? 20,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.experience.map((item) => buildPlannerExperienceEntry(item, metrics)),
    },
    {
      key: "education",
      kind: "education",
      sectionType: "education",
      sectionId: data.sectionIdsByType?.education?.[0] ?? data.education[0]?.sectionId,
      title: "Education",
      order: data.education[0]?.sectionOrder ?? 30,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.education.map((item) => ({
        id: item.id,
        kind: "education",
        estimatedHeight: estimateEducationHeight(item, metrics),
        item,
      })),
    },
    {
      key: "skills",
      kind: "skills",
      sectionType: "skills",
      sectionId: data.sectionIdsByType?.skills?.[0] ?? data.skillItems[0]?.sectionId,
      title: "Skills",
      order: data.skillItems[0]?.sectionOrder ?? 40,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.skillItems.map((item) => ({
        id: item.id,
        kind: "skills",
        estimatedHeight:
          metrics.skillPadBlockMm * 2 +
          estimateTextHeight(
            item.name,
            Math.max(14, Math.floor(metrics.compactCharsPerLine / 2)),
            metrics.bodySmLineHeightMm,
          ),
        item,
      })),
    },
    {
      key: "selected_projects",
      kind: "selected_projects",
      sectionType: "selected_projects",
      sectionId: data.sectionIdsByType?.projects?.[0] ?? data.projects[0]?.sectionId,
      title: "Selected projects",
      order: data.projects[0]?.sectionOrder ?? 50,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.projects.map((item) => ({
        id: item.id,
        kind: "selected_projects",
        estimatedHeight: estimateProjectHeight(item, metrics),
        item,
      })),
    },
    {
      key: "languages",
      kind: "languages",
      sectionType: "languages",
      sectionId: data.sectionIdsByType?.languages?.[0] ?? data.languages[0]?.sectionId,
      title: "Languages",
      order: data.languages[0]?.sectionOrder ?? 60,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.languages.map((item) => ({
        id: item.id,
        kind: "languages",
        estimatedHeight: estimateCompactListRowHeight(
          `${item.name} ${item.level}`,
          metrics,
        ),
        item,
      })),
    },
    {
      key: "certifications",
      kind: "certifications",
      sectionType: "certifications",
      sectionId:
        data.sectionIdsByType?.certifications?.[0] ?? data.certifications[0]?.sectionId,
      title: "Certifications",
      order: data.certifications[0]?.sectionOrder ?? 70,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.certifications.map((item) => ({
        id: item.id,
        kind: "certifications",
        estimatedHeight: estimateCertificationHeight(item, metrics),
        item,
      })),
    },
    {
      key: "achievements",
      kind: "achievements",
      sectionType: "achievements",
      sectionId:
        data.sectionIdsByType?.achievements?.[0] ?? data.achievementItems[0]?.sectionId,
      title: "Achievements",
      order: data.achievementItems[0]?.sectionOrder ?? 80,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.achievementItems.map((item) => ({
        id: item.id,
        kind: "achievements",
        estimatedHeight:
          metrics.educationGapMm +
          estimateTextHeight(
            item.text,
            metrics.readingCharsPerLine,
            metrics.bodyLineHeightMm,
          ),
        item,
      })),
    },
    {
      key: "affiliations",
      kind: "affiliations",
      sectionType: "affiliations",
      sectionId:
        data.sectionIdsByType?.affiliations?.[0] ?? data.affiliations[0]?.sectionId,
      title: "Affiliations",
      order: data.affiliations[0]?.sectionOrder ?? 90,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.affiliations.map((item) => ({
        id: item.id,
        kind: "affiliations",
        estimatedHeight: estimateAffiliationHeight(item, metrics),
        item,
      })),
    },
    {
      key: "hobbies",
      kind: "hobbies",
      sectionType: "hobbies",
      sectionId: data.sectionIdsByType?.hobbies?.[0] ?? data.hobbyItems[0]?.sectionId,
      title: "Hobbies",
      order: data.hobbyItems[0]?.sectionOrder ?? 100,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.hobbyItems.map((item) => ({
        id: item.id,
        kind: "hobbies",
        estimatedHeight: estimateCompactListRowHeight(item.name, metrics),
        item,
      })),
    },
    {
      key: "additional_information",
      kind: "additional_information",
      sectionType: "additional_information",
      sectionId: data.textSections[0]?.sectionId,
      title: data.textSections[0]?.sectionTitle ?? "Additional information",
      order: data.textSections[0]?.sectionOrder ?? 110,
      headerHeight: metrics.sectionHeaderHeightMm,
      entries: data.textSections.map((item) => ({
        id: item.id,
        kind:
          item.sectionType === "custom" ? "additional_information" : "additional_information",
        estimatedHeight:
          metrics.sectionGapMm +
          estimateTextHeight(
            item.text,
            metrics.readingCharsPerLine,
            metrics.bodyLineHeightMm,
          ),
        item,
      })),
    },
  ];

  sections.push(
    ...itemSections
      .filter((section) => section.entries.length > 0)
      .sort((left, right) => left.order - right.order),
  );

  return sections;
}

function buildFragmentId(
  page: WorkshopResumePagePlan,
  section: WorkshopPlannerSection,
): string {
  const firstEntryId = section.entries[0]?.id ?? section.key;
  return `workshop-fragment-${page.index + 1}-${section.key}-${firstEntryId}`;
}

function estimateSectionPlacementHeight(args: {
  currentPageHasSections: boolean;
  section: PlannerSectionDefinition;
  entries: WorkshopPlannerEntry[];
  metrics: WorkshopPlannerMetrics;
}): number {
  const sectionGap =
    args.currentPageHasSections && args.section.kind !== "summary"
      ? args.metrics.sectionGapMm
      : 0;
  const headerHeight = args.section.title ? args.section.headerHeight : 0;
  const entriesHeight = args.entries.reduce((sum, entry, index) => {
    const experienceGap =
      args.section.kind === "experience" && index > 0
        ? args.metrics.sectionContentGapMm
        : 0;
    const compactListGap =
      (args.section.kind === "languages" || args.section.kind === "hobbies") &&
      index > 0
        ? args.metrics.listGapMm
        : 0;
    return sum + experienceGap + compactListGap + entry.estimatedHeight;
  }, 0);

  return sectionGap + headerHeight + entriesHeight;
}

function shouldDeferSectionForSingleTail(args: {
  currentPage: WorkshopResumePagePlan;
  pageHeightBudget: number;
  section: PlannerSectionDefinition;
  state: {
    entryIndex: number;
    carryoverEntries: WorkshopPlannerEntry[];
  };
  metrics: WorkshopPlannerMetrics;
}): boolean {
  if (
    !WORKSHOP_SINGLE_TAIL_GUARD_KINDS.has(args.section.kind) ||
    args.currentPage.entries.length === 0 ||
    args.currentPage.sections.some((section) => section.key === args.section.key) ||
    args.state.carryoverEntries.length > 0
  ) {
    return false;
  }

  const remainingEntries = args.section.entries.slice(args.state.entryIndex);
  if (remainingEntries.length <= 1) {
    return false;
  }

  const totalRemainingHeight = estimateSectionPlacementHeight({
    currentPageHasSections: false,
    section: args.section,
    entries: remainingEntries,
    metrics: args.metrics,
  });
  if (!fitsWithinWorkshopAvailableHeight(
    totalRemainingHeight,
    args.pageHeightBudget,
    args.metrics.bottomFitSafetyMm,
  )) {
    return false;
  }

  const fittingEntryCount = countFittingSectionEntriesOnCurrentPage({
    currentPage: args.currentPage,
    pageHeightBudget: args.pageHeightBudget,
    section: args.section,
    entries: remainingEntries,
    metrics: args.metrics,
  });

  if (!(fittingEntryCount > 0 && remainingEntries.length - fittingEntryCount === 1)) {
    return false;
  }

  return true;
}

function countFittingSectionEntriesOnCurrentPage(args: {
  currentPage: WorkshopResumePagePlan;
  pageHeightBudget: number;
  section: PlannerSectionDefinition;
  entries: WorkshopPlannerEntry[];
  metrics: WorkshopPlannerMetrics;
}): number {
  let fittingEntryCount = 0;

  for (let index = 0; index < args.entries.length; index += 1) {
    const candidateEntries = args.entries.slice(0, index + 1);
    const candidateHeight = estimateSectionPlacementHeight({
      currentPageHasSections: args.currentPage.sections.length > 0,
      section: args.section,
      entries: candidateEntries,
      metrics: args.metrics,
    });
    const availableHeight = args.pageHeightBudget - args.currentPage.estimatedHeight;
    if (!fitsWithinWorkshopAvailableHeight(
      candidateHeight,
      availableHeight,
      args.metrics.bottomFitSafetyMm,
    )) {
      break;
    }

    fittingEntryCount = index + 1;
  }

  return fittingEntryCount;
}

function shouldDeferSelectedProjectsForIsolatedTail(args: {
  currentPage: WorkshopResumePagePlan;
  pageHeightBudget: number;
  section: PlannerSectionDefinition;
  state: {
    entryIndex: number;
    carryoverEntries: WorkshopPlannerEntry[];
  };
  metrics: WorkshopPlannerMetrics;
}): boolean {
  if (
    args.section.kind !== "selected_projects" ||
    args.currentPage.entries.length === 0 ||
    args.currentPage.sections.some((section) => section.key === args.section.key) ||
    args.state.carryoverEntries.length > 0
  ) {
    return false;
  }

  const remainingEntries = args.section.entries.slice(args.state.entryIndex);
  if (remainingEntries.length !== 2) {
    return false;
  }

  const totalRemainingHeight = estimateSectionPlacementHeight({
    currentPageHasSections: false,
    section: args.section,
    entries: remainingEntries,
    metrics: args.metrics,
  });
  if (!fitsWithinWorkshopAvailableHeight(
    totalRemainingHeight,
    args.pageHeightBudget,
    args.metrics.bottomFitSafetyMm,
  )) {
    return false;
  }

  return (
    countFittingSectionEntriesOnCurrentPage({
      currentPage: args.currentPage,
      pageHeightBudget: args.pageHeightBudget,
      section: args.section,
      entries: remainingEntries,
      metrics: args.metrics,
    }) === 1
  );
}

function shouldDeferHobbiesBeforeTrailingTextSection(args: {
  currentPage: WorkshopResumePagePlan;
  pageHeightBudget: number;
  section: PlannerSectionDefinition;
  state: {
    entryIndex: number;
    carryoverEntries: WorkshopPlannerEntry[];
  };
  nextState:
    | {
        section: PlannerSectionDefinition;
        entryIndex: number;
        carryoverEntries: WorkshopPlannerEntry[];
      }
    | undefined;
  metrics: WorkshopPlannerMetrics;
}): boolean {
  if (
    args.section.kind !== "hobbies" ||
    args.currentPage.entries.length === 0 ||
    args.currentPage.sections.some((section) => section.key === args.section.key) ||
    args.state.carryoverEntries.length > 0
  ) {
    return false;
  }

  const nextState = args.nextState;
  if (
    !nextState ||
    nextState.section.kind !== "additional_information" ||
    nextState.carryoverEntries.length > 0 ||
    nextState.entryIndex > 0
  ) {
    return false;
  }

  const remainingEntries = args.section.entries.slice(args.state.entryIndex);
  if (remainingEntries.length !== 2) {
    return false;
  }

  return nextState.section.entries.slice(nextState.entryIndex).length > 0;
}

function estimatePageHeightForSections(args: {
  sections: WorkshopPlannerSection[];
  sectionDefinitionsByKey: Map<string, PlannerSectionDefinition>;
  metrics: WorkshopPlannerMetrics;
}): number {
  return args.sections.reduce((sum, section, index) => {
    const definition = args.sectionDefinitionsByKey.get(section.key);
    if (!definition) {
      return sum;
    }

    return (
      sum +
      estimateSectionPlacementHeight({
        currentPageHasSections: index > 0,
        section: definition,
        entries: section.entries,
        metrics: args.metrics,
      })
    );
  }, 0);
}

function normalizePlannerPages(args: {
  pages: WorkshopResumePagePlan[];
  sectionDefinitionsByKey: Map<string, PlannerSectionDefinition>;
  metrics: WorkshopPlannerMetrics;
}): WorkshopResumePagePlan[] {
  const seenSectionKeys = new Set<string>();

  return args.pages
    .filter((page) => page.sections.length > 0)
    .map((page, index) => {
      const sections = page.sections.map((section) => {
        const normalizedSection = {
          ...section,
          continued: seenSectionKeys.has(section.key),
        };
        seenSectionKeys.add(section.key);
        return normalizedSection;
      });

      return {
        index,
        sections,
        entries: sections.flatMap((section) => section.entries),
        estimatedHeight: estimatePageHeightForSections({
          sections,
          sectionDefinitionsByKey: args.sectionDefinitionsByKey,
          metrics: args.metrics,
        }),
      };
    });
}

function rebalanceTrailingTextSectionPage(args: {
  pages: WorkshopResumePagePlan[];
  pageHeightBudget: number;
  sectionDefinitionsByKey: Map<string, PlannerSectionDefinition>;
  metrics: WorkshopPlannerMetrics;
}): WorkshopResumePagePlan[] {
  if (args.pages.length < 2) {
    return args.pages;
  }

  const pages = args.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => ({
      ...section,
      entries: [...section.entries],
    })),
    entries: [...page.entries],
  }));
  const lastPage = pages[pages.length - 1];
  const previousPage = pages[pages.length - 2];
  const lastPageTextSection = lastPage?.sections[0];
  const previousPageTrailingSection = previousPage?.sections.at(-1);

  if (
    !lastPage ||
    !previousPage ||
    lastPage.sections.length !== 1 ||
    !lastPageTextSection ||
    lastPageTextSection.kind !== "additional_information" ||
    lastPageTextSection.continued ||
    !previousPageTrailingSection ||
    previousPageTrailingSection.continued ||
    previousPageTrailingSection.kind === "profile" ||
    previousPageTrailingSection.kind === "summary" ||
    previousPageTrailingSection.kind === "experience" ||
    previousPageTrailingSection.kind === "additional_information"
  ) {
    return args.pages;
  }

  const nextLastPageSections = [
    previousPageTrailingSection,
    ...lastPage.sections,
  ];
  const nextLastPageHeight = estimatePageHeightForSections({
    sections: nextLastPageSections,
    sectionDefinitionsByKey: args.sectionDefinitionsByKey,
    metrics: args.metrics,
  });

  if (!fitsWithinWorkshopAvailableHeight(
    nextLastPageHeight,
    args.pageHeightBudget,
    args.metrics.bottomFitSafetyMm,
  )) {
    return args.pages;
  }

  previousPage.sections = previousPage.sections.slice(0, -1);
  lastPage.sections = nextLastPageSections;

  return normalizePlannerPages({
    pages,
    sectionDefinitionsByKey: args.sectionDefinitionsByKey,
    metrics: args.metrics,
  });
}

function buildCommittedFragment(args: {
  data: ResumeData;
  page: WorkshopResumePagePlan;
  section: WorkshopPlannerSection;
}): WorkshopResumeCommittedFragment {
  const fragmentId = buildFragmentId(args.page, args.section);
  const base = {
    fragmentId,
    sectionId: args.section.sectionId,
    title: args.section.title,
    continued: args.section.continued,
  };

  switch (args.section.kind) {
    case "profile":
      return {
        ...base,
        kind: "profile",
        sectionType: "profile",
        profile: {
          name: args.data.name,
          title: args.data.title,
        },
        contact: args.data.contact.map((item) => ({
          label: item.label,
          value: item.value,
        })),
        metadata: args.data.metadata.map((item) => ({
          label: item.label,
          value: item.value,
        })),
      };
    case "summary":
      return {
        ...base,
        kind: "summary",
        sectionType: "summary",
        text:
          args.section.entries[0]?.kind === "summary"
            ? args.section.entries[0].text
            : "",
      };
    case "experience":
      return {
        ...base,
        kind: "experience",
        sectionType: "experience",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "experience" }> => entry.kind === "experience")
          .map((entry) => ({
            id: entry.sourceEntryId,
            continued: entry.continued,
            role: entry.role,
            company: entry.company,
            period: entry.period,
            location: entry.location,
            blocks: entry.blocks.map((block) => ({
              kind: block.kind,
              text: block.text,
              ...(block.partial ? { partial: true } : {}),
            })),
          })),
      };
    case "education":
      return {
        ...base,
        kind: "education",
        sectionType: "education",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "education" }> => entry.kind === "education")
          .map((entry) => ({
            id: entry.item.id,
            degree: entry.item.degree,
            school: entry.item.school,
            period: entry.item.period,
          })),
      };
    case "skills":
      return {
        ...base,
        kind: "skills",
        sectionType: "skills",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "skills" }> => entry.kind === "skills")
          .map((entry) => ({
            id: entry.item.id,
            name: entry.item.name,
            level: entry.item.level,
          })),
      };
    case "selected_projects":
      return {
        ...base,
        kind: "selected_projects",
        sectionType: "selected_projects",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "selected_projects" }> => entry.kind === "selected_projects")
          .map((entry) => ({
            id: entry.item.id,
            name: entry.item.name,
            meta: entry.item.meta,
            description: entry.item.description,
          })),
      };
    case "languages":
      return {
        ...base,
        kind: "languages",
        sectionType: "languages",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "languages" }> => entry.kind === "languages")
          .map((entry) => ({
            id: entry.item.id,
            name: entry.item.name,
            level: entry.item.level,
          })),
      };
    case "certifications":
      return {
        ...base,
        kind: "certifications",
        sectionType: "certifications",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "certifications" }> => entry.kind === "certifications")
          .map((entry) => ({
            id: entry.item.id,
            name: entry.item.name,
            issuer: entry.item.issuer,
            meta: entry.item.meta,
          })),
      };
    case "achievements":
      return {
        ...base,
        kind: "achievements",
        sectionType: "achievements",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "achievements" }> => entry.kind === "achievements")
          .map((entry) => ({
            id: entry.item.id,
            text: entry.item.text,
          })),
      };
    case "affiliations":
      return {
        ...base,
        kind: "affiliations",
        sectionType: "affiliations",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "affiliations" }> => entry.kind === "affiliations")
          .map((entry) => ({
            id: entry.item.id,
            organizationName: entry.item.organizationName,
            roleOrMembershipType: entry.item.roleOrMembershipType,
            dateRange: entry.item.dateRange,
            notes: entry.item.notes,
          })),
      };
    case "hobbies":
      return {
        ...base,
        kind: "hobbies",
        sectionType: "hobbies",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "hobbies" }> => entry.kind === "hobbies")
          .map((entry) => ({
            id: entry.item.id,
            name: entry.item.name,
          })),
      };
    case "additional_information":
      return {
        ...base,
        kind: "additional_information",
        sectionType: "additional_information",
        items: args.section.entries
          .filter((entry): entry is Extract<WorkshopPlannerEntry, { kind: "additional_information" }> => entry.kind === "additional_information")
          .map((entry) => ({
            id: entry.item.id,
            sectionTitle: entry.item.sectionTitle,
            text: entry.item.text,
          })),
      };
  }
}

export function planWorkshopResumePages(args: {
  data: ResumeData;
  template: ResumeTemplateDefinition;
  stylePreset?: VerbatiStylePreset | null;
  debugTrace?: WorkshopPaginationDebugTrace;
}): WorkshopResumePlan {
  const metrics = buildPlannerMetrics({
    template: args.template,
    stylePreset: args.stylePreset,
  });
  const pageHeightBudget = metrics.pageHeightBudgetMm;
  if (args.debugTrace) {
    args.debugTrace.pageHeightBudgetMm = pageHeightBudget;
  }
  const pages: WorkshopResumePagePlan[] = [];
  const sections = buildPlannerSections(args.data, metrics);
  const sectionDefinitionsByKey = new Map(sections.map((section) => [section.key, section]));
  const sectionStates = sections.map((section) => ({
    section,
    entryIndex: 0,
    carryoverEntries: [] as WorkshopPlannerEntry[],
  }));

  let currentPage: WorkshopResumePagePlan = {
    index: 0,
    estimatedHeight: 0,
    entries: [],
    sections: [],
  };

  const commitPage = () => {
    if (currentPage.entries.length === 0) {
      return;
    }

    pages.push(currentPage);
    currentPage = {
      index: pages.length,
      estimatedHeight: 0,
      entries: [],
      sections: [],
    };
  };

  const getNextEntry = (state: (typeof sectionStates)[number]) =>
    state.carryoverEntries[0] ?? state.section.entries[state.entryIndex] ?? null;

  const consumeNextEntry = (state: (typeof sectionStates)[number]) => {
    if (state.carryoverEntries.length > 0) {
      state.carryoverEntries.shift();
      return;
    }

    state.entryIndex += 1;
  };

  const ensurePageSection = (section: PlannerSectionDefinition) => {
    let pageSection = currentPage.sections.find((item) => item.key === section.key);
    if (pageSection) {
      return pageSection;
    }

    pageSection = {
      key: section.key,
      kind: section.kind,
      sectionType: section.sectionType,
      sectionId: section.sectionId,
      title: section.title,
      continued: pages.some((page) =>
        page.sections.some((pageSectionItem) => pageSectionItem.key === section.key),
      ),
      entries: [],
    };
    if (currentPage.sections.length > 0 && section.kind !== "summary") {
      currentPage.estimatedHeight += metrics.sectionGapMm;
    }
    currentPage.sections.push(pageSection);
    currentPage.estimatedHeight += section.title ? section.headerHeight : 0;
    return pageSection;
  };

  const placeEntryOnPage = (section: PlannerSectionDefinition, entry: WorkshopPlannerEntry) => {
    const pageSection = ensurePageSection(section);
    if (pageSection.entries.length > 0 && section.kind === "experience") {
      currentPage.estimatedHeight += metrics.sectionContentGapMm;
    }
    if (
      pageSection.entries.length > 0 &&
      (section.kind === "languages" || section.kind === "hobbies")
    ) {
      currentPage.estimatedHeight += metrics.listGapMm;
    }
    pageSection.entries.push(entry);
    currentPage.entries.push(entry);
    currentPage.estimatedHeight += entry.estimatedHeight;
  };

  const hasPendingEntries = () =>
    sectionStates.some(
      (state) =>
        state.carryoverEntries.length > 0 ||
        state.entryIndex < state.section.entries.length,
    );

  while (hasPendingEntries()) {
    let placedEntryThisPass = false;
    let blockedByPendingExperience = false;
    let blockedByPendingSelectedProjects = false;
    let deferredSingleTailSection = false;
    let deferredSelectedProjectsTail = false;
    let deferredHobbiesBeforeText = false;
    let blockedByPendingAtomicSection = false;

    for (let stateIndex = 0; stateIndex < sectionStates.length; stateIndex += 1) {
      const state = sectionStates[stateIndex]!;
      const nextState = sectionStates[stateIndex + 1];
      while (true) {
        const entry = getNextEntry(state);
        if (!entry) {
          break;
        }
        if (
          shouldDeferSectionForSingleTail({
            currentPage,
            pageHeightBudget,
            section: state.section,
            state,
            metrics,
          })
        ) {
          deferredSingleTailSection = true;
          break;
        }

        if (
          shouldDeferSelectedProjectsForIsolatedTail({
            currentPage,
            pageHeightBudget,
            section: state.section,
            state,
            metrics,
          })
        ) {
          deferredSelectedProjectsTail = true;
          break;
        }

        if (
          shouldDeferHobbiesBeforeTrailingTextSection({
            currentPage,
            pageHeightBudget,
            section: state.section,
            state,
            nextState,
            metrics,
          })
        ) {
          deferredHobbiesBeforeText = true;
          break;
        }
        const needsHeader = Boolean(state.section.title) &&
          !currentPage.sections.some((item) => item.key === state.section.key);
        const availableHeight =
          pageHeightBudget -
          currentPage.estimatedHeight -
          (needsHeader ? state.section.headerHeight : 0);
        const entryFits = fitsWithinWorkshopAvailableHeight(
          entry.estimatedHeight,
          availableHeight,
          metrics.bottomFitSafetyMm,
        );

        if (!entryFits && entry.kind === "experience") {
          const splitEntry = splitExperienceEntryToFit({
            entry,
            availableHeight,
            currentPageEstimatedHeightBeforeSplit: currentPage.estimatedHeight,
            continuationSectionHeaderHeight: state.section.title
              ? state.section.headerHeight
              : 0,
            metrics,
            debugTrace: args.debugTrace,
          });

          if (splitEntry) {
            placeEntryOnPage(state.section, splitEntry.head);
            consumeNextEntry(state);
            state.carryoverEntries.unshift(splitEntry.tail);
            placedEntryThisPass = true;
            blockedByPendingExperience = true;
            break;
          }
        }

        if (!entryFits && currentPage.entries.length > 0) {
          if (entry.kind === "experience") {
            blockedByPendingExperience = true;
          } else if (isAtomicNonExperienceEntryKind(entry.kind)) {
            blockedByPendingAtomicSection = true;
          }
          if (state.section.kind === "selected_projects") {
            blockedByPendingSelectedProjects = true;
          }
          break;
        }

        placeEntryOnPage(state.section, entry);
        consumeNextEntry(state);
        placedEntryThisPass = true;

        if (currentPage.estimatedHeight >= pageHeightBudget) {
          break;
        }
      }

      if (blockedByPendingExperience || blockedByPendingAtomicSection) {
        break;
      }
      if (blockedByPendingSelectedProjects) {
        break;
      }

      if (deferredSingleTailSection) {
        break;
      }

      if (deferredSelectedProjectsTail) {
        break;
      }

      if (deferredHobbiesBeforeText) {
        break;
      }
    }

    if (
      deferredSingleTailSection ||
      deferredSelectedProjectsTail ||
      deferredHobbiesBeforeText
    ) {
      commitPage();
      continue;
    }
    if (!placedEntryThisPass) {
      break;
    }

    commitPage();
  }

  commitPage();

  const resolvedPages = rebalanceTrailingTextSectionPage({
    pages: pages.length > 0 ? pages : [currentPage],
    pageHeightBudget,
    sectionDefinitionsByKey,
    metrics,
  });

  return {
    pageCount: Math.max(1, resolvedPages.length),
    pages: resolvedPages,
    committedPages: resolvedPages.map((page) => ({
      pageId: `workshop-page-${page.index + 1}`,
      index: page.index,
      estimatedHeight: page.estimatedHeight,
      fragments: page.sections.map((section) =>
        buildCommittedFragment({
          data: args.data,
          page,
          section,
        }),
      ),
    })),
  };
}
