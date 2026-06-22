import { v4 as uuidv4 } from "uuid";

import { ensureRemirrorDoc } from "../components/remirror-editor/utils/conversion";
import {
  makeAffiliationItem,
  makeAchievementItem,
  makeCertificationItem,
  makeEducationItem,
  makeExperienceItem,
  makeHobbyItem,
  makeLanguageItem,
  makeProfileItem,
  makeSkillItem,
  makeSummaryItem,
  makeTextSection,
} from "./cv-template";
import type {
  IAffiliationItem,
  CvBlock,
  CvSection,
  IAchievementItem,
  ICertificationItem,
  IEducationItem,
  IExperienceItem,
  IHobbyItem,
  ILanguageItem,
  IProfileItem,
  ISkillItem,
  ISummaryItem,
} from "../types/cvDocument";
import {
  IMPORT_RECOVERY_SECTION_LABELS,
  IMPORT_RECOVERY_SECTION_TYPES,
  type ImportRecoveryBlockMetadata,
  type ImportRecoveryFragmentAssignment,
  type ImportRecoveryItem,
  type ImportRecoverySectionType,
  type ImportRecoverySelectionSource,
  type ImportRecoverySpan,
} from "../types/importRecovery";

export type ImportRecoveryTextSectionKind =
  | "additional_information"
  | "affiliations"
  | "hobbies"
  | "custom";

export interface ImportRecoverySectionOption {
  value: ImportRecoverySectionType;
  label: string;
  createsTextSection?: boolean;
}

export interface ImportRecoveryTextSegment {
  key: string;
  text: string;
  startOffset: number;
  endOffset: number;
  assigned: boolean;
  fragment?: ImportRecoveryFragmentAssignment;
}

export interface RecoveryCommitSummary {
  fragmentCount: number;
  acceptedBlockCount: number;
  pendingCount: number;
}

export interface RecoveryCommitState {
  itemsToApply: ImportRecoveryItem[];
  pendingItems: ImportRecoveryItem[];
  summary: RecoveryCommitSummary;
}

const RECOVERY_SECTION_ORDER: ImportRecoverySectionType[] = [
  "profile",
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "projects",
  "certifications",
  "achievements",
  "additional_information",
  "affiliations",
  "hobbies",
  "custom",
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/i;
const URL_RE = /https?:\/\/[^\s)]+/gi;
const WHITESPACE_ONLY_RE = /^\s*$/;
const TRIVIAL_RESIDUE_RE = /^[\s\p{P}\p{S}\-_=|/\\]+$/u;
const RECOVERY_HEADING_LABELS = new Set(
  [
    ...Object.values(IMPORT_RECOVERY_SECTION_LABELS),
    "Work Experience",
    "Professional Experience",
    "Employment History",
    "Career History",
    "Technical Skills",
    "Core Skills",
    "Professional Summary",
    "Additional Details",
    "Interests",
  ].map((label) =>
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  ),
);

export const IMPORT_RECOVERY_SECTION_OPTIONS: ImportRecoverySectionOption[] =
  IMPORT_RECOVERY_SECTION_TYPES.filter((sectionType) => sectionType !== "contact").map((sectionType) => ({
    value: sectionType,
    label: IMPORT_RECOVERY_SECTION_LABELS[sectionType],
    createsTextSection: isTextBackedRecoverySection(sectionType),
  }));

export function normalizeRecoverySectionTarget(
  sectionType: ImportRecoverySectionType,
): ImportRecoverySectionType {
  return sectionType === "contact" ? "profile" : sectionType;
}

function cloneSections(sections: CvSection[]): CvSection[] {
  return sections.map((section) => ({
    ...section,
    blocks: Array.isArray(section.blocks) ? [...section.blocks] : [],
    structuredContent: Array.isArray(section.structuredContent)
      ? ([...section.structuredContent] as CvSection["structuredContent"])
      : (section.structuredContent ?? null),
  }));
}

function extractPlainText(value: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();

  function walk(node: unknown) {
    if (node == null || seen.has(node)) return;
    if (typeof node === "object") seen.add(node);
    if (typeof node === "string") {
      const trimmed = node.replace(/\s+/g, " ").trim();
      if (trimmed) parts.push(trimmed);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      Object.entries(node as Record<string, unknown>).forEach(([key, entry]) => {
        if (key === "type" || key === "attrs" || key === "id") return;
        walk(entry);
      });
    }
  }

  walk(value);
  return parts.join(" ").trim();
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(trimmed);
  }
  return next;
}

function splitTextTokens(text: string): string[] {
  return dedupeStrings(
    text
      .replace(/\r/g, "\n")
      .split(/[\n,;|]+/)
      .map((token) => token.replace(/^[-•*+\d.)\s]+/, "").trim()),
  );
}

function getRecoveryTextLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*+\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function hasRecoveryDegreeSignal(value: string): boolean {
  return /\b(bachelor|master|mba|phd|doctor|diploma|degree|certificate|certification|licen[cs]e|bsc|msc|ba|bs|ma|llm)\b/i.test(
    value,
  );
}

function shouldPopulateExperienceResponsibilities(text: string): boolean {
  const lines = getRecoveryTextLines(text);
  const tokens = splitTextTokens(text);
  return lines.length > 1 || tokens.length > 1;
}

function shouldPopulateEducationDescription(text: string): boolean {
  return getRecoveryTextLines(text).length > 1;
}

function logRecoveryFallback(
  target: "experience" | "education",
  metadata: ImportRecoveryBlockMetadata,
  text: string,
) {
  try {
    console.debug("[importRecovery] fallback_note_only", {
      target,
      sourceSectionTitle: metadata.sourceSectionTitle ?? null,
      blockId: metadata.blockId,
      preview: text.slice(0, 120),
    });
  } catch {
    /* noop */
  }
}

function sortSections(sections: CvSection[]): CvSection[] {
  const orderIndex = new Map(
    RECOVERY_SECTION_ORDER.map((sectionType, index) => [sectionType, index]),
  );

  return [...sections]
    .map((section, index) => ({ section, index }))
    .sort((left, right) => {
      const leftRank =
        orderIndex.get(canonicalizeExistingSectionType(left.section)) ??
        Number.MAX_SAFE_INTEGER;
      const rightRank =
        orderIndex.get(canonicalizeExistingSectionType(right.section)) ??
        Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.index - right.index;
    })
    .map(({ section }) => section);
}

function canonicalizeExistingSectionType(
  section: CvSection,
): ImportRecoverySectionType {
  const type = String(section.type ?? "").trim().toLowerCase();
  if (type === "text") {
    const title = String(section.title ?? "").trim().toLowerCase();
    if (title === "additional information") return "additional_information";
    if (title === "affiliations") return "affiliations";
    if (title === "hobbies") return "hobbies";
    return "custom";
  }
  if (IMPORT_RECOVERY_SECTION_TYPES.includes(type as ImportRecoverySectionType)) {
    return type as ImportRecoverySectionType;
  }
  return "custom";
}

export function isTextBackedRecoverySection(
  sectionType: ImportRecoverySectionType,
): sectionType is ImportRecoveryTextSectionKind {
  return (
    sectionType === "additional_information" ||
    sectionType === "affiliations" ||
    sectionType === "hobbies" ||
    sectionType === "custom"
  );
}

export function getRecoverySectionDisplayLabel(
  sectionType: ImportRecoverySectionType,
  sectionTitle?: string | null,
): string {
  const resolvedSectionType = normalizeRecoverySectionTarget(sectionType);
  if (resolvedSectionType === "custom") {
    return sectionTitle?.trim() || IMPORT_RECOVERY_SECTION_LABELS.custom;
  }
  return IMPORT_RECOVERY_SECTION_LABELS[resolvedSectionType];
}

export function getRecoveryDisplayText(item: ImportRecoveryItem): string {
  return item.displayTextSource === "raw" && item.rawText.trim()
    ? item.rawText
    : item.cleanedText || item.rawText;
}

export function normalizeRecoveryFragmentAssignments(
  fragments: ImportRecoveryFragmentAssignment[],
  textLength: number,
): ImportRecoveryFragmentAssignment[] {
  return [...fragments]
    .filter((fragment) => fragment.status === "assigned")
    .map((fragment) => {
      const safeStart = Math.max(0, Math.min(fragment.startOffset, textLength));
      const safeEnd = Math.max(safeStart, Math.min(fragment.endOffset, textLength));
      return {
        ...fragment,
        startOffset: safeStart,
        endOffset: safeEnd,
      };
    })
    .filter((fragment) => fragment.endOffset > fragment.startOffset)
    .sort((left, right) => left.startOffset - right.startOffset);
}

export function hasOverlappingRecoveryFragment(
  existingFragments: ImportRecoveryFragmentAssignment[],
  range: ImportRecoverySpan,
): boolean {
  return normalizeRecoveryFragmentAssignments(existingFragments, Number.MAX_SAFE_INTEGER)
    .some(
      (fragment) =>
        Math.max(fragment.startOffset, range.start) <
        Math.min(fragment.endOffset, range.end),
    );
}

export function buildRecoveryTextSegments(
  text: string,
  fragments: ImportRecoveryFragmentAssignment[],
): ImportRecoveryTextSegment[] {
  const normalizedFragments = normalizeRecoveryFragmentAssignments(
    fragments,
    text.length,
  );
  const segments: ImportRecoveryTextSegment[] = [];
  let cursor = 0;

  normalizedFragments.forEach((fragment) => {
    if (fragment.startOffset > cursor) {
      segments.push({
        key: `text-${cursor}-${fragment.startOffset}`,
        text: text.slice(cursor, fragment.startOffset),
        startOffset: cursor,
        endOffset: fragment.startOffset,
        assigned: false,
      });
    }
    segments.push({
      key: fragment.fragmentId,
      text: text.slice(fragment.startOffset, fragment.endOffset),
      startOffset: fragment.startOffset,
      endOffset: fragment.endOffset,
      assigned: true,
      fragment,
    });
    cursor = fragment.endOffset;
  });

  if (cursor < text.length) {
    segments.push({
      key: `text-${cursor}-${text.length}`,
      text: text.slice(cursor),
      startOffset: cursor,
      endOffset: text.length,
      assigned: false,
    });
  }

  if (segments.length === 0) {
    segments.push({
      key: "text-empty",
      text,
      startOffset: 0,
      endOffset: text.length,
      assigned: false,
    });
  }

  return segments;
}

export function getRemainingRecoveryText(
  item: ImportRecoveryItem,
): { text: string; selectionSource: ImportRecoverySelectionSource } {
  const text = getRecoveryDisplayText(item);
  const segments = buildRecoveryTextSegments(text, item.fragmentAssignments);
  const remaining = segments
    .filter((segment) => !segment.assigned)
    .map((segment) => segment.text)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text: remaining,
    selectionSource: item.displayTextSource,
  };
}

export function trimRecoverySelection(args: {
  text: string;
  range: ImportRecoverySpan;
}): { text: string; range: ImportRecoverySpan } | null {
  const { text, range } = args;
  const leadingWhitespace = text.match(/^\s+/)?.[0].length ?? 0;
  const trailingWhitespace = text.match(/\s+$/)?.[0].length ?? 0;
  const start = Math.min(range.end, range.start + leadingWhitespace);
  const end = Math.max(start, range.end - trailingWhitespace);
  const trimmedText = text.slice(leadingWhitespace, text.length - trailingWhitespace);
  if (!trimmedText.trim()) {
    return null;
  }
  return {
    text: trimmedText,
    range: { start, end },
  };
}

export function isTrivialRecoveryResidue(text: string): boolean {
  const normalized = text.replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) {
    return true;
  }
  if (TRIVIAL_RESIDUE_RE.test(normalized)) {
    return true;
  }
  const normalizedHeading = normalized
    .replace(/:+$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return RECOVERY_HEADING_LABELS.has(normalizedHeading);
}

export function isRecoveryItemResolved(item: ImportRecoveryItem): boolean {
  if (
    item.reviewStatus === "accepted" ||
    item.reviewStatus === "reassigned" ||
    item.reviewStatus === "ignored"
  ) {
    return true;
  }
  const remaining = getRemainingRecoveryText(item).text;
  return isTrivialRecoveryResidue(remaining);
}

function createPendingResidueItem(item: ImportRecoveryItem): ImportRecoveryItem | null {
  const remaining = getRemainingRecoveryText(item);
  if (!remaining.text || isTrivialRecoveryResidue(remaining.text)) {
    return null;
  }

  return {
    ...item,
    rawText: remaining.text,
    cleanedText: remaining.text,
    displayTextSource: remaining.selectionSource,
    reviewStatus: "pending",
    selectedSection: item.predictedSection,
    selectedSectionTitle: null,
    fragmentAssignments: [],
  };
}

function formatRecoveryCount(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function joinRecoverySummaryParts(parts: string[]): string {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function buildRecoveryCommitState(items: ImportRecoveryItem[]): RecoveryCommitState {
  let fragmentCount = 0;
  let acceptedBlockCount = 0;
  let pendingCount = 0;
  const itemsToApply: ImportRecoveryItem[] = [];
  const pendingItems: ImportRecoveryItem[] = [];

  items.forEach((rawItem) => {
    const item: ImportRecoveryItem = {
      ...rawItem,
      selectedSection: rawItem.selectedSection ?? rawItem.predictedSection,
      fragmentAssignments: normalizeRecoveryFragmentAssignments(
        rawItem.fragmentAssignments,
        getRecoveryDisplayText(rawItem).length,
      ),
    };
    fragmentCount += item.fragmentAssignments.length;

    const remaining = getRemainingRecoveryText(item).text;
    const hasMeaningfulRemaining = !isTrivialRecoveryResidue(remaining);

    if (item.reviewStatus === "pending") {
      if (item.fragmentAssignments.length > 0) {
        itemsToApply.push({ ...item, reviewStatus: "ignored" });
        const residueItem = createPendingResidueItem(item);
        if (residueItem) {
          pendingItems.push(residueItem);
          pendingCount += 1;
        }
        return;
      }

      if (hasMeaningfulRemaining) {
        pendingItems.push(item);
        pendingCount += 1;
        return;
      }

      itemsToApply.push({ ...item, reviewStatus: "ignored" });
      return;
    }

    itemsToApply.push(item);

    if (item.reviewStatus === "ignored") {
      return;
    }

    if (hasMeaningfulRemaining) {
      acceptedBlockCount += 1;
    }
  });

  return {
    itemsToApply,
    pendingItems,
    summary: {
      fragmentCount,
      acceptedBlockCount,
      pendingCount,
    },
  };
}

export function summarizeRecoveryCommitState(items: ImportRecoveryItem[]): RecoveryCommitSummary {
  return buildRecoveryCommitState(items).summary;
}

export function formatRecoveryCommitSummary(summary: RecoveryCommitSummary): string {
  if (summary.pendingCount === 0) {
    return "Save all changes and finish";
  }

  const savingParts: string[] = [];
  if (summary.fragmentCount > 0) {
    savingParts.push(formatRecoveryCount("fragment", summary.fragmentCount));
  }
  if (summary.acceptedBlockCount > 0) {
    savingParts.push(formatRecoveryCount("accepted block", summary.acceptedBlockCount));
  }

  const savingLabel = savingParts.length > 0
    ? `Saving ${joinRecoverySummaryParts(savingParts)} now`
    : "Saving reviewed work now";

  return `${savingLabel} • ${summary.pendingCount} item${summary.pendingCount === 1 ? " stays" : "s stay"} pending`;
}

export function formatRecoveryCommitToast(summary: RecoveryCommitSummary): string {
  const savedParts: string[] = [];
  if (summary.fragmentCount > 0) {
    savedParts.push(formatRecoveryCount("fragment", summary.fragmentCount));
  }
  if (summary.acceptedBlockCount > 0) {
    savedParts.push(formatRecoveryCount("accepted block", summary.acceptedBlockCount));
  }

  if (summary.pendingCount > 0) {
    const savedLabel = savedParts.length > 0
      ? `Saved ${joinRecoverySummaryParts(savedParts)}`
      : "Saved reviewed work";
    return `${savedLabel} • ${summary.pendingCount} item${summary.pendingCount === 1 ? "" : "s"} pending review`;
  }

  if (savedParts.length > 0) {
    return `Saved ${joinRecoverySummaryParts(savedParts)}`;
  }

  return "Saved all changes and finished review";
}

function buildRecoveryMetadata(
  item: ImportRecoveryItem,
  resolvedSection: ImportRecoverySectionType,
  reviewStatus: "accepted" | "reassigned",
  overrides?: Partial<ImportRecoveryBlockMetadata>,
): ImportRecoveryBlockMetadata {
  const normalizedResolvedSection = normalizeRecoverySectionTarget(resolvedSection);
  return {
    blockId: item.blockId,
    predictedSection: item.predictedSection,
    resolvedSection: normalizedResolvedSection,
    resolvedSectionTitle: item.selectedSectionTitle ?? null,
    reviewStatus,
    confidenceScore: item.confidenceScore,
    confidenceValue: item.confidenceValue,
    issueFlags: item.issueFlags,
    sourceSectionTitle: item.sourceSectionTitle ?? null,
    sourceFieldKey: item.sourceFieldKey ?? null,
    sourceLabel: item.sourceLabel ?? null,
    ...overrides,
  };
}

function appendRecoveryMetadata(
  attributes: Record<string, unknown> | undefined,
  metadata: ImportRecoveryBlockMetadata,
) {
  const nextAttributes = { ...(attributes ?? {}) };
  const current = nextAttributes.importRecovery;
  if (Array.isArray(current)) {
    nextAttributes.importRecovery = [...current, metadata];
  } else if (current) {
    nextAttributes.importRecovery = [current, metadata];
  } else {
    nextAttributes.importRecovery = metadata;
  }
  return nextAttributes;
}

function createRecoveryBlock(args: {
  title: string;
  text: string;
  linkedStructuredId?: string;
  metadata: ImportRecoveryBlockMetadata;
}): CvBlock {
  return {
    id: uuidv4(),
    title: args.title,
    type: "text",
    content: ensureRemirrorDoc(args.text),
    attributes: appendRecoveryMetadata(
      args.linkedStructuredId
        ? { linkedStructuredId: args.linkedStructuredId }
        : undefined,
      args.metadata,
    ),
  };
}

function deriveBlockTitle(
  text: string,
  fallback: string,
  sourceTitle?: string | null,
): string {
  const titleCandidate = sourceTitle?.trim();
  if (titleCandidate && titleCandidate.length <= 96) {
    return titleCandidate;
  }
  const firstLine = text.split(/\n+/)[0]?.trim() ?? "";
  if (firstLine && firstLine.length <= 96) {
    return firstLine.replace(/^[-•*+\d.)\s]+/, "");
  }
  return fallback;
}

function ensureSection(
  sections: CvSection[],
  sectionType: ImportRecoverySectionType,
  sectionTitle?: string | null,
): CvSection {
  const resolvedSectionType = normalizeRecoverySectionTarget(sectionType);
  const existing = sections.find((section) => {
    const existingType = canonicalizeExistingSectionType(section);
    if (existingType !== resolvedSectionType) return false;
    if (resolvedSectionType !== "custom") return true;
    return String(section.title ?? "").trim() === String(sectionTitle ?? "").trim();
  });
  if (existing) return existing;

  let nextSection: CvSection;
  if (resolvedSectionType === "profile") {
    nextSection = {
      id: uuidv4(),
      title: "Profile",
      type: "profile",
      blocks: [],
      structuredContent: [makeProfileItem()] as IProfileItem[],
      collapsed: false,
    };
  } else if (resolvedSectionType === "summary") {
    const summaryItem = makeSummaryItem();
    nextSection = {
      id: uuidv4(),
      title: "Summary",
      type: "summary",
      blocks: [
        {
          id: uuidv4(),
          title: "Summary",
          type: "text",
          content: ensureRemirrorDoc((summaryItem).summary),
          attributes: { linkedStructuredId: summaryItem.id },
        },
      ],
      structuredContent: [summaryItem] as ISummaryItem[],
      collapsed: false,
    };
  } else if (resolvedSectionType === "experience") {
    nextSection = {
      id: uuidv4(),
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: [] as IExperienceItem[],
      collapsed: false,
    };
  } else if (resolvedSectionType === "education") {
    nextSection = {
      id: uuidv4(),
      title: "Education",
      type: "education",
      blocks: [],
      structuredContent: [] as IEducationItem[],
      collapsed: false,
    };
  } else if (resolvedSectionType === "skills") {
    nextSection = {
      id: uuidv4(),
      title: "Skills",
      type: "skills",
      blocks: [],
      structuredContent: [] as ISkillItem[],
      collapsed: false,
    };
  } else if (resolvedSectionType === "languages") {
    nextSection = {
      id: uuidv4(),
      title: "Languages",
      type: "languages",
      blocks: [],
      structuredContent: [] as ILanguageItem[],
      collapsed: false,
    };
  } else if (resolvedSectionType === "projects") {
    nextSection = {
      id: uuidv4(),
      title: "Projects",
      type: "projects",
      blocks: [],
      structuredContent: null,
      collapsed: false,
    };
  } else if (resolvedSectionType === "certifications") {
    nextSection = {
      id: uuidv4(),
      title: "Certifications",
      type: "certifications",
      blocks: [],
      structuredContent: [] as ICertificationItem[],
      collapsed: false,
    };
  } else if (resolvedSectionType === "achievements") {
    nextSection = {
      id: uuidv4(),
      title: "Achievements",
      type: "achievements",
      blocks: [],
      structuredContent: [] as IAchievementItem[],
      collapsed: false,
    };
  } else if (resolvedSectionType === "hobbies") {
    nextSection = makeTextSection("Hobbies");
  } else if (resolvedSectionType === "affiliations") {
    nextSection = makeTextSection("Affiliations");
  } else {
    nextSection = makeTextSection(
      getRecoverySectionDisplayLabel(resolvedSectionType, sectionTitle),
    );
  }

  sections.push(nextSection);
  return nextSection;
}

function mergeParagraphText(existingText: string, nextText: string): string {
  return dedupeStrings([existingText, nextText]).join("\n\n");
}

function applyToSummary(
  section: CvSection,
  text: string,
  metadata: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as ISummaryItem[])
    : [];
  const summaryItem = structured[0] ? { ...structured[0] } : makeSummaryItem();
  const nextText = mergeParagraphText(
    extractPlainText(summaryItem.summary),
    text,
  );
  summaryItem.summary = ensureRemirrorDoc(nextText);
  if (structured.length === 0) structured.push(summaryItem);
  else structured[0] = summaryItem;
  section.structuredContent = structured;

  const linkedId = summaryItem.id;
  const blockIndex = section.blocks.findIndex(
    (block) =>
      String(block.attributes?.linkedStructuredId ?? "") === String(linkedId ?? ""),
  );
  const nextBlock: CvBlock = {
    id: section.blocks[blockIndex]?.id ?? uuidv4(),
    title: "Summary",
    type: "text",
    content: ensureRemirrorDoc(nextText),
    attributes: appendRecoveryMetadata(
      {
        ...(section.blocks[blockIndex]?.attributes ?? {}),
        ...(linkedId ? { linkedStructuredId: linkedId } : {}),
      },
      metadata,
    ),
  };

  if (blockIndex >= 0) section.blocks[blockIndex] = nextBlock;
  else section.blocks.push(nextBlock);
}

function applyToProfile(
  section: CvSection,
  text: string,
  metadata?: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as IProfileItem[])
    : [];
  const profileItem = structured[0] ? { ...structured[0] } : makeProfileItem();
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(EMAIL_RE)?.[0];
  const phone = text.match(PHONE_RE)?.[0];
  const linkedin = text.match(LINKEDIN_RE)?.[0];
  const urls = Array.from(new Set(text.match(URL_RE) ?? []));
  const website = urls.find((url) => !/linkedin\.com/i.test(url));
  const nameCandidate = lines.find(
    (line) =>
      !/@/.test(line) &&
      !/https?:\/\//i.test(line) &&
      /^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3}$/.test(line),
  );
  const desiredPositionCandidate = lines.find(
    (line) =>
      line !== nameCandidate &&
      line.length <= 80 &&
      !/@/.test(line) &&
      !/https?:\/\//i.test(line),
  );
  const locationCandidate = lines.find(
    (line) =>
      line !== nameCandidate &&
      line !== desiredPositionCandidate &&
      /,/.test(line) &&
      !/@/.test(line),
  );

  if (!profileItem.name && nameCandidate) profileItem.name = nameCandidate;
  if (!profileItem.email && email) profileItem.email = email.trim();
  if (!profileItem.phone && phone) profileItem.phone = phone.trim();
  if (!profileItem.linkedin && linkedin) profileItem.linkedin = linkedin.trim();
  if (!profileItem.website && website) profileItem.website = website.trim();
  if (!profileItem.desiredPosition && desiredPositionCandidate) {
    profileItem.desiredPosition = desiredPositionCandidate;
  }
  if (!profileItem.location && locationCandidate) {
    profileItem.location = locationCandidate;
  }

  if (structured.length === 0) structured.push(profileItem);
  else structured[0] = profileItem;
  section.structuredContent = structured;

  if (metadata) {
    section.blocks.push(
      createRecoveryBlock({
        title: deriveBlockTitle(text, "Profile", metadata.sourceSectionTitle),
        text,
        metadata,
      }),
    );
  }
}

function applyToContact(
  section: CvSection,
  text: string,
  metadata: ImportRecoveryBlockMetadata,
) {
  section.blocks.push(
    createRecoveryBlock({
      title: deriveBlockTitle(text, "Contact", metadata.sourceSectionTitle),
      text,
      metadata,
    }),
  );
}

function applyToExperience(
  section: CvSection,
  text: string,
  metadata: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as IExperienceItem[])
    : [];
  const experienceItem = makeExperienceItem();
  const entryTitle = deriveBlockTitle(text, "Recovered experience", metadata.sourceSectionTitle);
  const lines = getRecoveryTextLines(text);
  const atMatch = entryTitle.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    experienceItem.position = atMatch[1].trim();
    experienceItem.company = atMatch[2].trim();
  }
  const bullets = splitTextTokens(text);
  if (bullets.length > 1) experienceItem.responsibilityBullets = bullets;
  if (shouldPopulateExperienceResponsibilities(text)) {
    experienceItem.responsibilities = ensureRemirrorDoc(text);
  } else {
    logRecoveryFallback("experience", metadata, text);
  }
  if (!experienceItem.position && lines.length > 0 && /^role\s*:/i.test(lines[0])) {
    experienceItem.position = lines[0].replace(/^role\s*:/i, "").trim();
  }
  if (!experienceItem.company && lines.length > 1 && /^company\s*:/i.test(lines[1])) {
    experienceItem.company = lines[1].replace(/^company\s*:/i, "").trim();
  }
  structured.push(experienceItem);
  section.structuredContent = structured;
  section.blocks.push(
    createRecoveryBlock({
      title: entryTitle,
      text,
      linkedStructuredId: experienceItem.id,
      metadata,
    }),
  );
}

function applyToEducation(
  section: CvSection,
  text: string,
  metadata: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as IEducationItem[])
    : [];
  const educationItem = makeEducationItem();
  const entryTitle = deriveBlockTitle(text, "Recovered education", metadata.sourceSectionTitle);
  const lines = getRecoveryTextLines(text);
  if (hasRecoveryDegreeSignal(entryTitle)) {
    educationItem.degree = entryTitle;
  } else if (lines[0] && hasRecoveryDegreeSignal(lines[0])) {
    educationItem.degree = lines[0];
  }
  if (shouldPopulateEducationDescription(text)) {
    educationItem.description = ensureRemirrorDoc(text);
  } else {
    logRecoveryFallback("education", metadata, text);
  }
  structured.push(educationItem);
  section.structuredContent = structured;
  section.blocks.push(
    createRecoveryBlock({
      title: entryTitle,
      text,
      linkedStructuredId: educationItem.id,
      metadata,
    }),
  );
}

function applyToAchievements(
  section: CvSection,
  text: string,
  metadata: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as IAchievementItem[])
    : [];
  const achievementItem = makeAchievementItem() as IAchievementItem;
  achievementItem.text = text;
  structured.push(achievementItem);
  section.structuredContent = structured;
  section.blocks.push(
    createRecoveryBlock({
      title: deriveBlockTitle(text, "Recovered achievement", metadata.sourceSectionTitle),
      text,
      linkedStructuredId: achievementItem.id,
      metadata,
    }),
  );
}

function applyToSkills(
  section: CvSection,
  text: string,
  metadata?: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as ISkillItem[])
    : [];
  const existing = new Set(
    structured.map((entry) => String(entry.name ?? "").trim().toLowerCase()),
  );
  const values = splitTextTokens(text).length > 0 ? splitTextTokens(text) : [text.trim()];
  values.forEach((value) => {
    const key = value.toLowerCase();
    if (!value || existing.has(key)) return;
    existing.add(key);
    const skillItem = makeSkillItem();
    skillItem.name = value;
    structured.push(skillItem);
  });
  section.structuredContent = structured;
  if (metadata) {
    section.blocks.push(
      createRecoveryBlock({
        title: deriveBlockTitle(text, "Skills", metadata.sourceSectionTitle),
        text,
        metadata,
      }),
    );
  }
}

function getMeaningfulRecoveryLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*+\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function isLikelyDateLine(line: string): boolean {
  return /\b(19|20)\d{2}\b/.test(line) || /\b(?:present|current|expires?)\b/i.test(line);
}

function extractLooseCredentialId(text: string): string {
  const match = text.match(/(?:credential|license|licence|cert(?:ification)?\s*id)\s*[:#-]?\s*([A-Z0-9-]+)/i);
  return match?.[1]?.trim() ?? "";
}

function applyToHobbies(
  section: CvSection,
  text: string,
  metadata?: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as IHobbyItem[])
    : [];
  const existing = new Set(
    structured.map((entry) => String(entry.name ?? "").trim().toLowerCase()),
  );
  const values = splitTextTokens(text).length > 0 ? splitTextTokens(text) : [text.trim()];
  values.forEach((value) => {
    const key = value.toLowerCase();
    if (!value || existing.has(key)) return;
    existing.add(key);
    const hobbyItem = makeHobbyItem();
    hobbyItem.name = value;
    structured.push(hobbyItem);
  });
  section.structuredContent = structured;
  if (metadata) {
    section.blocks.push(
      createRecoveryBlock({
        title: deriveBlockTitle(text, "Hobbies", metadata.sourceSectionTitle),
        text,
        metadata,
      }),
    );
  }
}

function applyToCertifications(
  section: CvSection,
  text: string,
  metadata: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as ICertificationItem[])
    : [];
  const certificationItem = makeCertificationItem();
  const lines = getMeaningfulRecoveryLines(text);
  const firstLine = lines[0] ?? "";
  const secondLine = lines.find((line, index) => index > 0 && !isLikelyDateLine(line)) ?? "";
  certificationItem.certificationName =
    firstLine || deriveBlockTitle(text, "Recovered certification", metadata.sourceSectionTitle);
  certificationItem.issuingOrganization = secondLine || certificationItem.issuingOrganization;
  certificationItem.credentialId = extractLooseCredentialId(text);
  structured.push(certificationItem);
  section.structuredContent = structured;
  section.blocks.push(
    createRecoveryBlock({
      title: certificationItem.certificationName || "Certification",
      text,
      linkedStructuredId: certificationItem.id,
      metadata,
    }),
  );
}

function applyToAffiliations(
  section: CvSection,
  text: string,
  metadata: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as IAffiliationItem[])
    : [];
  const affiliationItem = makeAffiliationItem();
  const lines = getMeaningfulRecoveryLines(text);
  affiliationItem.organizationName =
    lines[0] || deriveBlockTitle(text, "Recovered affiliation", metadata.sourceSectionTitle);
  affiliationItem.roleOrMembershipType =
    lines.find((line, index) => index > 0 && !isLikelyDateLine(line)) ?? "";
  affiliationItem.notes = text;
  structured.push(affiliationItem);
  section.structuredContent = structured;
  section.blocks.push(
    createRecoveryBlock({
      title: affiliationItem.organizationName || "Affiliation",
      text,
      linkedStructuredId: affiliationItem.id,
      metadata,
    }),
  );
}

function parseLanguageToken(
  token: string,
): { name: string; level: ILanguageItem["level"] } | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const name = (match?.[1] ?? trimmed).trim();
  const rawLevel = (match?.[2] ?? "").toLowerCase();
  if (!name) return null;
  const level = /native|fluent|c2/.test(rawLevel)
    ? "Fluent"
    : /advanced|c1/.test(rawLevel)
      ? "Advanced"
      : /elementary|a1|a2/.test(rawLevel)
        ? "Elementary"
        : /beginner|basic/.test(rawLevel)
          ? "Beginner"
          : "Intermediate";
  return { name, level };
}

function applyToLanguages(
  section: CvSection,
  text: string,
  metadata?: ImportRecoveryBlockMetadata,
) {
  const structured = Array.isArray(section.structuredContent)
    ? ([...section.structuredContent] as ILanguageItem[])
    : [];
  const existing = new Set(
    structured.map((entry) => String(entry.name ?? "").trim().toLowerCase()),
  );
  const values = splitTextTokens(text).length > 0 ? splitTextTokens(text) : [text.trim()];
  values.forEach((value) => {
    const parsed = parseLanguageToken(value);
    if (!parsed) return;
    const key = parsed.name.toLowerCase();
    if (existing.has(key)) return;
    existing.add(key);
    const languageItem = makeLanguageItem();
    languageItem.name = parsed.name;
    languageItem.level = parsed.level;
    structured.push(languageItem);
  });
  section.structuredContent = structured;
  if (metadata) {
    section.blocks.push(
      createRecoveryBlock({
        title: deriveBlockTitle(text, "Languages", metadata.sourceSectionTitle),
        text,
        metadata,
      }),
    );
  }
}

function applyToPlainBlocks(
  section: CvSection,
  text: string,
  metadata: ImportRecoveryBlockMetadata,
  fallbackTitle: string,
) {
  section.blocks.push(
    createRecoveryBlock({
      title: deriveBlockTitle(text, fallbackTitle, metadata.sourceSectionTitle),
      text,
      metadata,
    }),
  );
}

function materializeTextIntoSection(
  sections: CvSection[],
  targetSection: ImportRecoverySectionType,
  targetSectionTitle: string | null | undefined,
  text: string,
  metadata: ImportRecoveryBlockMetadata,
) {
  if (!text.trim()) return;

  const resolvedTargetSection = normalizeRecoverySectionTarget(targetSection);
  const section = ensureSection(sections, resolvedTargetSection, targetSectionTitle);

  if (resolvedTargetSection === "profile") {
    applyToProfile(section, text, metadata);
    return;
  }
  if (resolvedTargetSection === "summary") {
    applyToSummary(section, text, metadata);
    return;
  }
  if (resolvedTargetSection === "experience") {
    applyToExperience(section, text, metadata);
    return;
  }
  if (resolvedTargetSection === "education") {
    applyToEducation(section, text, metadata);
    return;
  }
  if (resolvedTargetSection === "skills") {
    applyToSkills(section, text, metadata);
    return;
  }
  if (resolvedTargetSection === "hobbies") {
    applyToHobbies(section, text, metadata);
    return;
  }
  if (resolvedTargetSection === "languages") {
    applyToLanguages(section, text, metadata);
    return;
  }
  if (resolvedTargetSection === "certifications") {
    applyToCertifications(section, text, metadata);
    return;
  }
  if (resolvedTargetSection === "affiliations") {
    applyToAffiliations(section, text, metadata);
    return;
  }
  if (resolvedTargetSection === "achievements") {
    applyToAchievements(section, text, metadata);
    return;
  }
  applyToPlainBlocks(
    section,
    text,
    metadata,
    getRecoverySectionDisplayLabel(resolvedTargetSection, targetSectionTitle),
  );
}

export function applyImportRecoveryItems(
  baseSections: CvSection[],
  recoveryItems: ImportRecoveryItem[],
): CvSection[] {
  const nextSections = cloneSections(baseSections);

  recoveryItems.forEach((item) => {
    const activeFragments = normalizeRecoveryFragmentAssignments(
      item.fragmentAssignments,
      getRecoveryDisplayText(item).length,
    );

    activeFragments.forEach((fragment) => {
      const fragmentMetadata = buildRecoveryMetadata(
        item,
        fragment.targetSection,
        "reassigned",
        {
          resolvedSectionTitle: fragment.targetSectionTitle ?? null,
          selectedText: fragment.selectedText,
          selectionSource: fragment.selectionSource,
          selectionOffsets: {
            start: fragment.startOffset,
            end: fragment.endOffset,
          },
          fragmentId: fragment.fragmentId,
        },
      );
      materializeTextIntoSection(
        nextSections,
        fragment.targetSection,
        fragment.targetSectionTitle,
        fragment.selectedText,
        fragmentMetadata,
      );
    });

    const remaining = getRemainingRecoveryText(item).text;
    if (!remaining || WHITESPACE_ONLY_RE.test(remaining) || isTrivialRecoveryResidue(remaining)) {
      return;
    }
    if (item.reviewStatus === "ignored") {
      return;
    }

    const resolvedSection =
      item.reviewStatus === "reassigned"
        ? item.selectedSection ?? item.predictedSection
        : item.predictedSection;
    const normalizedResolvedSection = normalizeRecoverySectionTarget(resolvedSection);
    const resolvedTitle =
      item.reviewStatus === "reassigned"
        ? item.selectedSectionTitle ?? null
        : null;
    const residueStatus =
      item.reviewStatus === "reassigned" ? "reassigned" : "accepted";
    const residueMetadata = buildRecoveryMetadata(
      item,
      normalizedResolvedSection,
      residueStatus,
      {
        resolvedSectionTitle: resolvedTitle,
      },
    );

    materializeTextIntoSection(
      nextSections,
      normalizedResolvedSection,
      resolvedTitle,
      remaining,
      residueMetadata,
    );
  });

  return sortSections(nextSections).map((section) => ({
    ...section,
    title:
      section.title && section.title.trim().length > 0
        ? section.title
        : getRecoverySectionDisplayLabel(canonicalizeExistingSectionType(section)),
  }));
}

export function collectRecoveryDestinationSectionIds(
  sections: CvSection[],
  recoveryItems: ImportRecoveryItem[],
): string[] {
  const destinationKeys = new Set<string>();

  recoveryItems.forEach((item) => {
    normalizeRecoveryFragmentAssignments(
      item.fragmentAssignments,
      getRecoveryDisplayText(item).length,
    ).forEach((fragment) => {
      const sectionType = normalizeRecoverySectionTarget(fragment.targetSection);
      const sectionTitle = fragment.targetSectionTitle ?? null;
      destinationKeys.add(`${sectionType}::${sectionTitle ?? ""}`);
    });

    const remaining = getRemainingRecoveryText(item).text;
    if (!remaining || WHITESPACE_ONLY_RE.test(remaining) || isTrivialRecoveryResidue(remaining)) {
      return;
    }
    if (item.reviewStatus === "ignored") {
      return;
    }

    const resolvedSection = normalizeRecoverySectionTarget(
      item.reviewStatus === "reassigned"
        ? item.selectedSection ?? item.predictedSection
        : item.predictedSection,
    );
    const resolvedTitle =
      item.reviewStatus === "reassigned" ? item.selectedSectionTitle ?? null : null;
    destinationKeys.add(`${resolvedSection}::${resolvedTitle ?? ""}`);
  });

  const revealedSectionIds: string[] = [];
  destinationKeys.forEach((key) => {
    const [sectionType, rawTitle] = key.split("::");
    const matchingSection = sections.find((section) => {
      const existingType = canonicalizeExistingSectionType(section);
      if (existingType !== sectionType) return false;
      if (sectionType !== "custom") return true;
      return String(section.title ?? "").trim() === rawTitle;
    });
    if (matchingSection?.id) {
      revealedSectionIds.push(String(matchingSection.id));
    }
  });

  return Array.from(new Set(revealedSectionIds));
}
