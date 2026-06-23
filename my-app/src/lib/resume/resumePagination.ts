/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unused-vars, no-constant-condition -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
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
  WorkshopResponsibilitiesRichContent,
  WorkshopResponsibilityTextRun,
} from "../../features/verbati/resume/resume.types";
import { buildResumeEducationDisplay } from "../../features/verbati/resume/resumeEducation";
import type { ResumePreviewSectionType } from "../../features/verbati/resumeLinking";
import type { VerbatiStylePreset } from "../../features/verbati/types";
import { normalizeResumePreviewTokens } from "../layout/documentTokenNormalizer";
import { ptToMm } from "../layout/documentTokens";
import {
  isMaggieResumeTemplateId,
  isSanatResumeTemplateId,
  isWorkshopTwoColumnResumeTemplateId,
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

export type WorkshopTwoColumnLane = "header" | "main" | "sidebar";

export const CERT_SIDEBAR_MAX_ITEMS = 6;
export const CERT_SIDEBAR_MAX_TITLE_CHARS = 48;
export const CERT_SIDEBAR_MAX_META_CHARS = 32;
export const CERT_SIDEBAR_MAX_ESTIMATED_LINES_PER_ITEM = 2;

export type WorkshopExperienceContentBlock = {
  kind: "text" | "bullet";
  text: string;
  partial?: boolean;
};

type WorkshopCommittedResponsibilityParagraphBlock = {
  kind: "paragraph";
  runs: WorkshopResponsibilityTextRun[];
  partial?: boolean;
  sourceBlockIndex: number;
};

type WorkshopCommittedResponsibilityBulletListItem = {
  runs: WorkshopResponsibilityTextRun[];
  partial?: boolean;
  sourceBlockIndex: number;
  sourceItemIndex: number;
};

type WorkshopCommittedResponsibilityBulletListBlock = {
  kind: "bullet_list";
  items: WorkshopCommittedResponsibilityBulletListItem[];
  sourceBlockIndex: number;
};

type WorkshopCommittedResponsibilityRichBlock =
  | WorkshopCommittedResponsibilityParagraphBlock
  | WorkshopCommittedResponsibilityBulletListBlock;

export type WorkshopCommittedResponsibilitiesRichContent = {
  blocks: WorkshopCommittedResponsibilityRichBlock[];
};

type WorkshopPlannerExperienceContentBlock = WorkshopExperienceContentBlock & {
  charsPerLine: number;
  usefulLines: number;
  estimatedHeight: number;
  richFragment?: WorkshopCommittedResponsibilityRichBlock;
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
  responsibilitiesRich?: WorkshopCommittedResponsibilitiesRichContent;
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
      summaryRich?: WorkshopResponsibilitiesRichContent;
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
  lane?: WorkshopTwoColumnLane;
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
  lane?: WorkshopTwoColumnLane;
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
  lane?: WorkshopTwoColumnLane;
  kind: "summary";
  sectionType: "summary";
  sectionId?: string;
  title?: string;
  continued: boolean;
  text: string;
  summaryRich?: WorkshopResponsibilitiesRichContent;
};

type WorkshopCommittedExperienceItem = {
  id: string;
  continued: boolean;
  role: string;
  company: string;
  period: string;
  location: string;
  blocks: WorkshopExperienceContentBlock[];
  responsibilitiesRich?: WorkshopCommittedResponsibilitiesRichContent;
};

type WorkshopCommittedEducationItem = {
  id: string;
  degree: string;
  fieldOfStudy?: string;
  grade?: string;
  school: string;
  period: string;
};

type WorkshopCommittedSkillItem = {
  id: string;
  name: string;
  level?: string;
  bucket?: ResumeSkillItem["bucket"];
  categoryId?: string;
  categoryLabel?: string;
  categoryOrder?: number;
};

type WorkshopCommittedProjectItem = {
  id: string;
  name: string;
  meta: string;
  description: string;
  descriptionRich?: WorkshopResponsibilitiesRichContent;
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
  sectionId?: string;
  sectionType?: ResumePreviewSectionType;
  sectionTitle: string;
  text: string;
};

export type WorkshopResumeCommittedFragment =
  | WorkshopCommittedProfileFragment
  | WorkshopCommittedSummaryFragment
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
      kind: "experience";
      sectionType: "experience";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedExperienceItem[];
    }
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
      kind: "education";
      sectionType: "education";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedEducationItem[];
    }
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
      kind: "skills";
      sectionType: "skills";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedSkillItem[];
    }
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
      kind: "selected_projects";
      sectionType: "selected_projects";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedProjectItem[];
    }
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
      kind: "languages";
      sectionType: "languages";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedLanguageItem[];
    }
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
      kind: "certifications";
      sectionType: "certifications";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedCertificationItem[];
    }
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
      kind: "achievements";
      sectionType: "achievements";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedTextItem[];
    }
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
      kind: "affiliations";
      sectionType: "affiliations";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedAffiliationItem[];
    }
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
      kind: "hobbies";
      sectionType: "hobbies";
      sectionId?: string;
      title?: string;
      continued: boolean;
      items: WorkshopCommittedNamedItem[];
    }
  | {
      fragmentId: string;
      lane?: WorkshopTwoColumnLane;
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
  lane?: WorkshopTwoColumnLane;
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
    tokens.flow.type.title.lineHeight ?? tokens.flow.type.body.lineHeight ?? 1.1;
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
      args.template.preview.sidebarMm > 0
        ? args.template.preview.sidebarMm
        : tokens.flow.measure.resumeReadingWidthMm,
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

function cloneResponsibilityRun(
  run: WorkshopResponsibilityTextRun,
): WorkshopResponsibilityTextRun {
  return { ...run };
}

function cloneResponsibilityRuns(
  runs: WorkshopResponsibilityTextRun[],
): WorkshopResponsibilityTextRun[] {
  return runs.map((run) => cloneResponsibilityRun(run));
}

function appendResponsibilityRun(
  target: WorkshopResponsibilityTextRun[],
  run: WorkshopResponsibilityTextRun,
) {
  if (!run.text) {
    return;
  }

  const previous = target[target.length - 1];
  if (
    previous &&
    previous.bold === run.bold &&
    previous.italic === run.italic &&
    previous.underline === run.underline
  ) {
    previous.text += run.text;
    return;
  }

  target.push(cloneResponsibilityRun(run));
}

function trimResponsibilityRuns(
  runs: WorkshopResponsibilityTextRun[],
): WorkshopResponsibilityTextRun[] {
  const next = cloneResponsibilityRuns(runs);

  while (next.length > 0) {
    const first = next[0]!;
    const trimmed = first.text.replace(/^\s+/, "");
    if (!trimmed) {
      next.shift();
      continue;
    }
    if (trimmed !== first.text) {
      next[0] = { ...first, text: trimmed };
    }
    break;
  }

  while (next.length > 0) {
    const lastIndex = next.length - 1;
    const last = next[lastIndex]!;
    const trimmed = last.text.replace(/\s+$/, "");
    if (!trimmed) {
      next.pop();
      continue;
    }
    if (trimmed !== last.text) {
      next[lastIndex] = { ...last, text: trimmed };
    }
    break;
  }

  return next;
}

function responsibilityRunsToPlainText(runs: WorkshopResponsibilityTextRun[]) {
  return runs.map((run) => run.text).join("");
}

function sliceResponsibilityRuns(args: {
  runs: WorkshopResponsibilityTextRun[];
  start: number;
  end: number;
}): WorkshopResponsibilityTextRun[] {
  const next: WorkshopResponsibilityTextRun[] = [];
  let cursor = 0;

  for (const run of args.runs) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;

    if (args.end <= runStart || args.start >= runEnd) {
      continue;
    }

    const sliceStart = Math.max(args.start, runStart) - runStart;
    const sliceEnd = Math.min(args.end, runEnd) - runStart;
    const text = run.text.slice(sliceStart, sliceEnd);
    if (!text) {
      continue;
    }

    appendResponsibilityRun(next, {
      text,
      ...(run.bold ? { bold: true } : {}),
      ...(run.italic ? { italic: true } : {}),
      ...(run.underline ? { underline: true } : {}),
    });
  }

  return next;
}

function segmentResponsibilityRunsByParagraphBreaks(
  runs: WorkshopResponsibilityTextRun[],
): WorkshopResponsibilityTextRun[][] {
  const text = responsibilityRunsToPlainText(runs);
  const segments: WorkshopResponsibilityTextRun[][] = [];
  let start = 0;
  let index = 0;

  while (index < text.length) {
    const character = text[index];
    if (character !== "\n" && character !== "\r") {
      index += 1;
      continue;
    }

    const trimmedSegment = trimResponsibilityRuns(
      sliceResponsibilityRuns({
        runs,
        start,
        end: index,
      }),
    );
    if (trimmedSegment.length > 0) {
      segments.push(trimmedSegment);
    }

    while (index < text.length && (text[index] === "\n" || text[index] === "\r")) {
      index += 1;
    }
    start = index;
  }

  const trailingSegment = trimResponsibilityRuns(
    sliceResponsibilityRuns({
      runs,
      start,
      end: text.length,
    }),
  );
  if (trailingSegment.length > 0) {
    segments.push(trailingSegment);
  }

  return segments;
}

function buildPlannerExperienceBlock(args: {
  kind: WorkshopExperienceContentBlock["kind"];
  text: string;
  metrics: WorkshopPlannerMetrics;
  partial?: boolean;
  richFragment?: WorkshopCommittedResponsibilityRichBlock;
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
    ...(args.richFragment ? { richFragment: args.richFragment } : {}),
    charsPerLine,
    usefulLines,
    estimatedHeight: usefulLines * args.metrics.bodyLineHeightMm,
  };
}

function projectExperienceRichContentToPlannerBlocks(args: {
  rich: WorkshopResponsibilitiesRichContent;
  metrics: WorkshopPlannerMetrics;
}): WorkshopPlannerExperienceContentBlock[] {
  const blocks: WorkshopPlannerExperienceContentBlock[] = [];

  args.rich.blocks.forEach((block, sourceBlockIndex) => {
    if (block.kind === "paragraph") {
      segmentResponsibilityRunsByParagraphBreaks(block.runs).forEach((runs) => {
        const text = responsibilityRunsToPlainText(runs).trim();
        if (!text) {
          return;
        }

        blocks.push(
          buildPlannerExperienceBlock({
            kind: "text",
            text,
            metrics: args.metrics,
            richFragment: {
              kind: "paragraph",
              runs,
              sourceBlockIndex,
            },
          }),
        );
      });
      return;
    }

    block.items.forEach((item, sourceItemIndex) => {
      const runs = trimResponsibilityRuns(item.runs);
      const text = responsibilityRunsToPlainText(runs).trim();

      blocks.push(
        buildPlannerExperienceBlock({
          kind: "bullet",
          text,
          metrics: args.metrics,
          richFragment: {
            kind: "bullet_list",
            sourceBlockIndex,
            items: [
              {
                runs,
                sourceBlockIndex,
                sourceItemIndex,
              },
            ],
          },
        }),
      );
    });
  });

  return blocks;
}

function buildFallbackResponsibilitiesRichContent(
  item: ResumeExperienceItem,
): WorkshopResponsibilitiesRichContent | undefined {
  const blocks: WorkshopResponsibilitiesRichContent["blocks"] = [
    ...normalizeExperienceTextSegments(item.description).map((text) => ({
      kind: "paragraph" as const,
      runs: [{ text }],
    })),
  ];

  const bulletItems = item.bullets
    .map((bullet) => bullet.trim())
    .map((text) => ({
      runs: [{ text }],
    }));

  if (bulletItems.length > 0) {
    blocks.push({
      kind: "bullet_list",
      items: bulletItems,
    });
  }

  return blocks.length > 0 ? { blocks } : undefined;
}

function buildCommittedResponsibilitiesRichFromPlannerBlocks(
  blocks: WorkshopPlannerExperienceContentBlock[],
): WorkshopCommittedResponsibilitiesRichContent | undefined {
  const richBlocks: WorkshopCommittedResponsibilityRichBlock[] = [];
  let pendingBulletList: WorkshopCommittedResponsibilityBulletListBlock | null = null;

  const flushPendingBulletList = () => {
    if (!pendingBulletList || pendingBulletList.items.length === 0) {
      pendingBulletList = null;
      return;
    }

    richBlocks.push({
      kind: "bullet_list",
      sourceBlockIndex: pendingBulletList.sourceBlockIndex,
      items: pendingBulletList.items.map((item) => ({
        runs: cloneResponsibilityRuns(item.runs),
        sourceBlockIndex: item.sourceBlockIndex,
        sourceItemIndex: item.sourceItemIndex,
        ...(item.partial ? { partial: true } : {}),
      })),
    });
    pendingBulletList = null;
  };

  for (const block of blocks) {
    if (!block.richFragment) {
      flushPendingBulletList();
      continue;
    }

    if (block.richFragment.kind === "paragraph") {
      flushPendingBulletList();
      richBlocks.push({
        kind: "paragraph",
        sourceBlockIndex: block.richFragment.sourceBlockIndex,
        runs: cloneResponsibilityRuns(block.richFragment.runs),
        ...(block.richFragment.partial ? { partial: true } : {}),
      });
      continue;
    }

    const richBulletBlock = block.richFragment;
    const bulletItem = richBulletBlock.items[0];
    if (!bulletItem) {
      continue;
    }

    if (
      !pendingBulletList ||
      pendingBulletList.sourceBlockIndex !== richBulletBlock.sourceBlockIndex
    ) {
      flushPendingBulletList();
      pendingBulletList = {
        kind: "bullet_list",
        sourceBlockIndex: richBulletBlock.sourceBlockIndex,
        items: [],
      };
    }

    pendingBulletList.items.push({
      runs: cloneResponsibilityRuns(bulletItem.runs),
      sourceBlockIndex: bulletItem.sourceBlockIndex,
      sourceItemIndex: bulletItem.sourceItemIndex,
      ...(bulletItem.partial ? { partial: true } : {}),
    });
  }

  flushPendingBulletList();

  return richBlocks.length > 0 ? { blocks: richBlocks } : undefined;
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

function buildPlannerExperienceContent(
  item: ResumeExperienceItem,
  metrics: WorkshopPlannerMetrics,
): {
  blocks: WorkshopPlannerExperienceContentBlock[];
  responsibilitiesRich?: WorkshopCommittedResponsibilitiesRichContent;
} {
  const sourceRich =
    item.responsibilitiesRich && item.responsibilitiesRich.blocks.length > 0
      ? item.responsibilitiesRich
      : buildFallbackResponsibilitiesRichContent(item);
  if (!sourceRich || sourceRich.blocks.length === 0) {
    return { blocks: [] };
  }

  const blocks = projectExperienceRichContentToPlannerBlocks({
    rich: sourceRich,
    metrics,
  });

  return {
    blocks,
    responsibilitiesRich: buildCommittedResponsibilitiesRichFromPlannerBlocks(blocks),
  };
}

function buildPlannerExperienceEntry(
  item: ResumeExperienceItem,
  metrics: WorkshopPlannerMetrics,
  fragmentIndex = 0,
  continued = false,
  content?: {
    blocks: WorkshopPlannerExperienceContentBlock[];
    responsibilitiesRich?: WorkshopCommittedResponsibilitiesRichContent;
  },
): WorkshopPlannerExperienceEntry {
  const normalizedContent = content ?? buildPlannerExperienceContent(item, metrics);
  const normalizedBlocks = normalizedContent.blocks;
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
    responsibilitiesRich: normalizedContent.responsibilitiesRich,
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
    {
      blocks: args.blocks,
      responsibilitiesRich: buildCommittedResponsibilitiesRichFromPlannerBlocks(
        args.blocks,
      ),
    },
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

function splitResponsibilityRichFragmentAtTextIndex(args: {
  fragment: WorkshopCommittedResponsibilityRichBlock;
  splitIndex: number;
}):
  | {
      head: WorkshopCommittedResponsibilityRichBlock;
      tail: WorkshopCommittedResponsibilityRichBlock;
    }
  | null {
  if (args.fragment.kind === "paragraph") {
    const fullText = responsibilityRunsToPlainText(args.fragment.runs);
    const headRuns = trimResponsibilityRuns(
      sliceResponsibilityRuns({
        runs: args.fragment.runs,
        start: 0,
        end: Math.min(args.splitIndex, fullText.length),
      }),
    );
    const tailRuns = trimResponsibilityRuns(
      sliceResponsibilityRuns({
        runs: args.fragment.runs,
        start: Math.min(args.splitIndex, fullText.length),
        end: fullText.length,
      }),
    );

    if (headRuns.length === 0 || tailRuns.length === 0) {
      return null;
    }

    return {
      head: {
        kind: "paragraph",
        sourceBlockIndex: args.fragment.sourceBlockIndex,
        runs: headRuns,
        partial: true,
      },
      tail: {
        kind: "paragraph",
        sourceBlockIndex: args.fragment.sourceBlockIndex,
        runs: tailRuns,
        partial: true,
      },
    };
  }

  const bulletItem = args.fragment.items[0];
  if (!bulletItem) {
    return null;
  }

  const fullText = responsibilityRunsToPlainText(bulletItem.runs);
  const headRuns = trimResponsibilityRuns(
    sliceResponsibilityRuns({
      runs: bulletItem.runs,
      start: 0,
      end: Math.min(args.splitIndex, fullText.length),
    }),
  );
  const tailRuns = trimResponsibilityRuns(
    sliceResponsibilityRuns({
      runs: bulletItem.runs,
      start: Math.min(args.splitIndex, fullText.length),
      end: fullText.length,
    }),
  );

  if (headRuns.length === 0 || tailRuns.length === 0) {
    return null;
  }

  return {
    head: {
      kind: "bullet_list",
      sourceBlockIndex: args.fragment.sourceBlockIndex,
      items: [
        {
          runs: headRuns,
          sourceBlockIndex: bulletItem.sourceBlockIndex,
          sourceItemIndex: bulletItem.sourceItemIndex,
          partial: true,
        },
      ],
    },
    tail: {
      kind: "bullet_list",
      sourceBlockIndex: args.fragment.sourceBlockIndex,
      items: [
        {
          runs: tailRuns,
          sourceBlockIndex: bulletItem.sourceBlockIndex,
          sourceItemIndex: bulletItem.sourceItemIndex,
          partial: true,
        },
      ],
    },
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

    const splitRichFragment = args.block.richFragment
      ? splitResponsibilityRichFragmentAtTextIndex({
          fragment: args.block.richFragment,
          splitIndex,
        })
      : null;
    const headBlock = buildPlannerExperienceBlock({
      kind: args.block.kind,
      text: headText,
      metrics: args.metrics,
      partial: true,
      richFragment: splitRichFragment?.head,
    });
    const tailBlock = buildPlannerExperienceBlock({
      kind: args.block.kind,
      text: tailText,
      metrics: args.metrics,
      partial: true,
      richFragment: splitRichFragment?.tail,
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
  const educationDisplay = buildResumeEducationDisplay(item);
  return (
    metrics.educationGapMm +
    estimateTextHeight(
      educationDisplay.title,
      metrics.compactCharsPerLine,
      metrics.bodyLineHeightMm,
    ) +
    metrics.compactMetaGapMm +
    estimateTextHeight(
      educationDisplay.previewMeta,
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

  if (
    data.summary.trim() ||
    (data.summarySectionId && data.draftSectionIds?.includes(data.summarySectionId))
  ) {
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
          ...(data.summaryRich ? { summaryRich: data.summaryRich } : {}),
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
          (item.categoryLabel &&
          data.skillItems.findIndex(
            (candidate) => candidate.categoryId === item.categoryId,
          ) === data.skillItems.indexOf(item)
            ? metrics.sectionHeaderHeightMm * 0.65
            : 0) +
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

function estimateCertificationLines(
  item: ResumeCertificationItem,
  metrics: WorkshopPlannerMetrics,
): number {
  return Math.max(
    estimateUsefulLines(item.name, metrics.compactCharsPerLine),
    estimateUsefulLines([item.issuer, item.meta].filter(Boolean).join(" "), metrics.compactCharsPerLine),
  );
}

function hasDetailedCertificationContent(item: ResumeCertificationItem): boolean {
  const maybeDetailed = item as ResumeCertificationItem & {
    description?: string;
    summary?: string;
    responsibilities?: unknown;
    rich?: unknown;
    descriptionRich?: unknown;
  };

  return Boolean(
    maybeDetailed.description?.trim() ||
      maybeDetailed.summary?.trim() ||
      maybeDetailed.responsibilities ||
      maybeDetailed.rich ||
      maybeDetailed.descriptionRich,
  );
}

function isCompactCertificationSection(
  section: PlannerSectionDefinition,
  metrics: WorkshopPlannerMetrics,
): boolean {
  const certificationEntries = section.entries.filter(
    (entry): entry is Extract<WorkshopPlannerEntry, { kind: "certifications" }> =>
      entry.kind === "certifications",
  );

  if (
    certificationEntries.length === 0 ||
    certificationEntries.length > CERT_SIDEBAR_MAX_ITEMS
  ) {
    return false;
  }

  return certificationEntries.every((entry) => {
    const item = entry.item;
    const metaText = [item.issuer, item.meta].filter(Boolean).join(" ").trim();
    return (
      !hasDetailedCertificationContent(item) &&
      item.name.trim().length <= CERT_SIDEBAR_MAX_TITLE_CHARS &&
      metaText.length <= CERT_SIDEBAR_MAX_META_CHARS &&
      estimateCertificationLines(item, metrics) <=
        CERT_SIDEBAR_MAX_ESTIMATED_LINES_PER_ITEM
    );
  });
}

function resolveWorkshopTwoColumnSectionLane(
  section: PlannerSectionDefinition,
  metrics: WorkshopPlannerMetrics,
): WorkshopTwoColumnLane {
  if (section.kind === "profile" || section.kind === "summary") {
    return "header";
  }

  if (
    section.kind === "skills" ||
    section.kind === "languages" ||
    section.kind === "affiliations" ||
    section.kind === "hobbies"
  ) {
    return "sidebar";
  }

  if (section.kind === "certifications") {
    return isCompactCertificationSection(section, metrics) ? "sidebar" : "main";
  }

  return "main";
}

function resolveSanatSectionLane(
  section: PlannerSectionDefinition,
  metrics: WorkshopPlannerMetrics,
): WorkshopTwoColumnLane {
  if (section.kind === "profile" || section.kind === "summary") {
    return "header";
  }

  if (
    section.kind === "education" ||
    section.kind === "skills" ||
    section.kind === "languages" ||
    section.kind === "certifications" ||
    section.kind === "affiliations" ||
    section.kind === "hobbies"
  ) {
    return section.kind === "certifications" && !isCompactCertificationSection(section, metrics)
      ? "main"
      : "sidebar";
  }

  return "main";
}

function resolveMaggieSectionLane(
  section: PlannerSectionDefinition,
  _metrics: WorkshopPlannerMetrics,
): WorkshopTwoColumnLane {
  if (section.kind === "profile" || section.kind === "summary") {
    return "header";
  }

  if (
    section.kind === "education" ||
    section.kind === "skills" ||
    section.kind === "languages" ||
    section.kind === "certifications" ||
    section.kind === "achievements" ||
    section.kind === "hobbies"
  ) {
    return "sidebar";
  }

  return "main";
}

export function resolveWorkshopTwoColumnFragmentLane(
  fragment: WorkshopResumeCommittedFragment,
): WorkshopTwoColumnLane {
  if (fragment.lane) {
    return fragment.lane;
  }

  if (fragment.kind === "profile" || fragment.kind === "summary") {
    return "header";
  }

  if (
    fragment.kind === "skills" ||
    fragment.kind === "languages" ||
    fragment.kind === "certifications" ||
    fragment.kind === "affiliations" ||
    fragment.kind === "hobbies"
  ) {
    return "sidebar";
  }

  return "main";
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

  if (nextState.section.entries.slice(nextState.entryIndex).length === 0) {
    return false;
  }

  const availableHeight = args.pageHeightBudget - args.currentPage.estimatedHeight;
  const fullCurrentPageHeight = estimateSectionPlacementHeight({
    currentPageHasSections: args.currentPage.sections.length > 0,
    section: args.section,
    entries: remainingEntries,
    metrics: args.metrics,
  });
  if (fitsWithinWorkshopAvailableHeight(
    fullCurrentPageHeight,
    availableHeight,
    args.metrics.bottomFitSafetyMm,
  )) {
    return false;
  }

  const firstEntryCurrentPageHeight = estimateSectionPlacementHeight({
    currentPageHasSections: args.currentPage.sections.length > 0,
    section: args.section,
    entries: remainingEntries.slice(0, 1),
    metrics: args.metrics,
  });
  if (!fitsWithinWorkshopAvailableHeight(
    firstEntryCurrentPageHeight,
    availableHeight,
    args.metrics.bottomFitSafetyMm,
  )) {
    return false;
  }

  const fullFreshPageHeight = estimateSectionPlacementHeight({
    currentPageHasSections: false,
    section: args.section,
    entries: remainingEntries,
    metrics: args.metrics,
  });
  if (!fitsWithinWorkshopAvailableHeight(
    fullFreshPageHeight,
    args.pageHeightBudget,
    args.metrics.bottomFitSafetyMm,
  )) {
    return false;
  }

  return true;
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
    previousPageTrailingSection.kind === "hobbies" ||
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
    lane: args.section.lane,
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
        ...(args.section.entries[0]?.kind === "summary" && args.section.entries[0].summaryRich
          ? { summaryRich: args.section.entries[0].summaryRich }
          : {}),
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
            ...(entry.responsibilitiesRich
              ? { responsibilitiesRich: entry.responsibilitiesRich }
              : {}),
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
            fieldOfStudy: entry.item.fieldOfStudy,
            grade: entry.item.grade,
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
            ...(entry.item.bucket ? { bucket: entry.item.bucket } : {}),
            ...(entry.item.categoryId ? { categoryId: entry.item.categoryId } : {}),
            ...(entry.item.categoryLabel ? { categoryLabel: entry.item.categoryLabel } : {}),
            ...(typeof entry.item.categoryOrder === "number"
              ? { categoryOrder: entry.item.categoryOrder }
              : {}),
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
            ...(entry.item.descriptionRich
              ? { descriptionRich: entry.item.descriptionRich }
              : {}),
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
            sectionId: entry.item.sectionId,
            sectionType: entry.item.sectionType as ResumePreviewSectionType,
            sectionTitle: entry.item.sectionTitle,
            text: entry.item.text,
          })),
      };
  }
}

function buildTwoColumnWorkshopPlan(args: {
  data: ResumeData;
  metrics: WorkshopPlannerMetrics;
  pageHeightBudget: number;
  laneResolver?: (
    section: PlannerSectionDefinition,
    metrics: WorkshopPlannerMetrics,
  ) => WorkshopTwoColumnLane;
}): WorkshopResumePlan {
  const resolveLane = args.laneResolver ?? resolveWorkshopTwoColumnSectionLane;
  const allSections = buildPlannerSections(args.data, args.metrics).map((section) => ({
    ...section,
    lane: resolveLane(section, args.metrics),
  }));
  const headerSections = allSections.filter((section) => section.lane === "header");
  const mainSections = allSections.filter((section) => section.lane === "main");
  const sidebarSections = allSections.filter((section) => section.lane === "sidebar");
  const headerContentHeight = headerSections.reduce(
    (sum, section, index) =>
      sum +
      estimateSectionPlacementHeight({
        currentPageHasSections: index > 0,
        section,
        entries: section.entries,
        metrics: args.metrics,
      }),
    0,
  );
  const headerToBodyGap = headerSections.length > 0 ? args.metrics.sectionGapMm : 0;
  const firstPageHeaderHeight = headerContentHeight + headerToBodyGap;

  const paginateLane = (
    sections: PlannerSectionDefinition[],
  ): Map<number, { height: number; sections: WorkshopPlannerSection[] }> => {
    const pageMap = new Map<number, { height: number; sections: WorkshopPlannerSection[] }>();
    let pageIndex = 0;
    let currentHeight = 0;
    let currentSections: WorkshopPlannerSection[] = [];

    const capacityForPage = (index: number) =>
      Math.max(0, args.pageHeightBudget - (index === 0 ? firstPageHeaderHeight : 0));
    const commit = () => {
      if (currentSections.length === 0) return;
      pageMap.set(pageIndex, { height: currentHeight, sections: currentSections });
      pageIndex += 1;
      currentHeight = 0;
      currentSections = [];
    };

    for (const section of sections) {
      let sectionOnCurrentPage: WorkshopPlannerSection | null = null;
      const hasPriorSectionOnAnyPage = () =>
        Array.from(pageMap.values()).some((page) =>
          page.sections.some((item) => item.key === section.key),
        ) || currentSections.some((item) => item.key === section.key);

      for (const entry of section.entries) {
        const isNewSection = !sectionOnCurrentPage;
        const sectionGap =
          isNewSection && currentSections.length > 0 && section.kind !== "summary"
            ? args.metrics.sectionGapMm
            : 0;
        const header = isNewSection && section.title ? section.headerHeight : 0;
        const repeatedEntryGap =
          sectionOnCurrentPage && section.kind === "experience"
            ? args.metrics.sectionContentGapMm
            : sectionOnCurrentPage &&
                (section.kind === "languages" || section.kind === "hobbies")
              ? args.metrics.listGapMm
              : 0;
        const addedHeight = sectionGap + header + repeatedEntryGap + entry.estimatedHeight;

        const entryFitsCurrentPage = fitsWithinWorkshopAvailableHeight(
          addedHeight,
          capacityForPage(pageIndex) - currentHeight,
          args.metrics.bottomFitSafetyMm,
        );

        if (currentSections.length > 0 && !entryFitsCurrentPage) {
          commit();
          sectionOnCurrentPage = null;
        } else if (
          currentSections.length === 0 &&
          pageIndex === 0 &&
          !entryFitsCurrentPage &&
          fitsWithinWorkshopAvailableHeight(
            addedHeight,
            capacityForPage(1),
            args.metrics.bottomFitSafetyMm,
          )
        ) {
          pageIndex = 1;
        }

        if (!sectionOnCurrentPage) {
          sectionOnCurrentPage = {
            key: section.key,
            kind: section.kind,
            lane: section.lane,
            sectionType: section.sectionType,
            sectionId: section.sectionId,
            title: section.title,
            continued: hasPriorSectionOnAnyPage(),
            entries: [],
          };
          if (currentSections.length > 0 && section.kind !== "summary") {
            currentHeight += args.metrics.sectionGapMm;
          }
          if (section.title) {
            currentHeight += section.headerHeight;
          }
          currentSections.push(sectionOnCurrentPage);
        } else if (section.kind === "experience") {
          currentHeight += args.metrics.sectionContentGapMm;
        } else if (section.kind === "languages" || section.kind === "hobbies") {
          currentHeight += args.metrics.listGapMm;
        }

        sectionOnCurrentPage.entries.push(entry);
        currentHeight += entry.estimatedHeight;
      }
    }

    commit();
    return pageMap;
  };

  const mainPages = paginateLane(mainSections);
  const sidebarPages = paginateLane(sidebarSections);
  const maxLanePageIndex = Math.max(
    -1,
    ...Array.from(mainPages.keys()),
    ...Array.from(sidebarPages.keys()),
  );
  const pageCount = Math.max(1, maxLanePageIndex + 1);
  const pages: WorkshopResumePagePlan[] = [];

  for (let index = 0; index < pageCount; index += 1) {
    const mainPage = mainPages.get(index);
    const sidebarPage = sidebarPages.get(index);
    const pageSections: WorkshopPlannerSection[] = [
      ...(index === 0
        ? headerSections.map((section) => ({
            key: section.key,
            kind: section.kind,
            lane: section.lane,
            sectionType: section.sectionType,
            sectionId: section.sectionId,
            title: section.title,
            continued: false,
            entries: section.entries,
          }))
        : []),
      ...(mainPage?.sections ?? []),
      ...(sidebarPage?.sections ?? []),
    ];
    pages.push({
      index,
      estimatedHeight:
        (index === 0 ? firstPageHeaderHeight : 0) +
        Math.max(mainPage?.height ?? 0, sidebarPage?.height ?? 0),
      entries: pageSections.flatMap((section) => section.entries),
      sections: pageSections,
    });
  }

  return {
    pageCount: pages.length,
    pages,
    committedPages: pages.map((page) => ({
      pageId: `workshop-page-${page.index + 1}`,
      index: page.index,
      estimatedHeight: page.estimatedHeight,
      fragments: page.sections.map((section) =>
        buildCommittedFragment({ data: args.data, page, section }),
      ),
    })),
  };
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
  if (isMaggieResumeTemplateId(args.template.id)) {
    return buildTwoColumnWorkshopPlan({
      data: args.data,
      metrics,
      pageHeightBudget,
      laneResolver: resolveMaggieSectionLane,
    });
  }
  if (isWorkshopTwoColumnResumeTemplateId(args.template.id)) {
    return buildTwoColumnWorkshopPlan({
      data: args.data,
      metrics,
      pageHeightBudget,
    });
  }
  if (isSanatResumeTemplateId(args.template.id)) {
    return buildTwoColumnWorkshopPlan({
      data: args.data,
      metrics,
      pageHeightBudget,
      laneResolver: resolveSanatSectionLane,
    });
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
      lane: section.lane,
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
