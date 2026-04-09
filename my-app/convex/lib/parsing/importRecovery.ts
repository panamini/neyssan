import { canonicalizeParserResult } from "./canonicalize";
import type { CanonicalizeContext } from "./canonicalize";
import type {
  ImportRecoveryIssueFlag,
  ImportRecoveryItem,
  ImportRecoveryPayload,
  ImportRecoveryRoutingDiagnostics,
  ImportRecoverySectionType,
} from "../../../src/types/importRecovery";
import {
  normalizeHeadingText,
  resolveCanonicalHeadingFamily,
} from "./headingResolver";

const REVIEW_LIMIT = 12;
const RESIDUAL_SECTION_TITLE = "Imported Notes";
const LARGE_RECOVERY_BLOB_THRESHOLD = 500;
const SPLIT_ELIGIBLE_LENGTH = 120;
const MIN_FRAGMENT_LENGTH = 48;
const MAX_SPLIT_FANOUT = 4;
const MAX_REVIEW_ITEMS = 200;

type RecoverySourceSection = {
  title?: string | null;
  label?: string | null;
  fieldKey?: string | null;
  content?: string | null;
  text?: string | null;
  confidence?: number | null;
  sourceSpan?: { start: number; end: number } | null;
  warnings?: string[] | null;
};

const SECTION_LABELS: Record<ImportRecoverySectionType, string> = {
  profile: "PROFILE",
  contact: "CONTACT",
  summary: "SUMMARY",
  experience: "EXPERIENCE",
  education: "EDUCATION",
  skills: "SKILLS",
  languages: "LANGUAGES",
  projects: "PROJECTS",
  certifications: "CERTIFICATIONS",
  achievements: "ACHIEVEMENTS",
  additional_information: "ADDITIONAL INFORMATION",
  affiliations: "AFFILIATIONS",
  hobbies: "HOBBIES",
  custom: "IMPORTED NOTES",
};

function normalizeLookupKey(value: unknown): string {
  return normalizeHeadingText(value).replace(/\s+/g, "").trim();
}

function parseConfidence(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? Number(num) : null;
}

function normalizeBrokenGlyphs(input: string): {
  text: string;
  replacements: number;
} {
  const replacements: Array<[RegExp, string]> = [
    [/\uFFFD/g, ""],
    [/â€¢/g, "•"],
    [/â€“|â€”|â€\"/g, "-"],
    [/â€˜|â€™/g, "'"],
    [/â€œ|â€�/g, '"'],
    [/Â/g, ""],
    [/Ã©/g, "e"],
    [/[\u200B-\u200D\uFEFF]/g, ""],
  ];

  let text = input;
  let count = 0;
  for (const [pattern, replacement] of replacements) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
      text = text.replace(pattern, replacement);
    }
  }
  return { text, replacements: count };
}

function normalizeBullets(input: string): { text: string; repairs: number } {
  let repairs = 0;
  let text = input.replace(/\r/g, "\n");

  const inlineBulletMatches = text.match(/\s[•·●◦◆■►▸➤]\s+/gu);
  if (inlineBulletMatches) {
    repairs += inlineBulletMatches.length;
    text = text.replace(/\s[•·●◦◆■►▸➤]\s+/gu, "\n- ");
  }

  const lines = text.split("\n");
  const normalizedLines = lines.map((line) => {
    let next = line;
    if (/^\s*[•·●◦◆■►▸➤]\s*/u.test(next)) {
      repairs += 1;
      next = next.replace(/^\s*[•·●◦◆■►▸➤]\s*/u, "- ");
    }
    if (/^\s*[-–—*+](?=\S)/.test(next)) {
      repairs += 1;
      next = next.replace(/^\s*([-–—*+])(?=\S)/, "$1 ");
    }
    if (/^\s*\d+[.)](?=\S)/.test(next)) {
      repairs += 1;
      next = next.replace(/^(\s*\d+[.)])(?=\S)/, "$1 ");
    }
    return next;
  });

  return { text: normalizedLines.join("\n"), repairs };
}

function normalizeWhitespace(input: string): {
  text: string;
  changed: boolean;
} {
  const text = input
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text, changed: text !== input.trim() };
}

export function cleanupImportRecoveryText(rawText: string) {
  const glyphStep = normalizeBrokenGlyphs(rawText);
  const bulletStep = normalizeBullets(glyphStep.text);
  const whitespaceStep = normalizeWhitespace(bulletStep.text);
  const rawLength = Math.max(rawText.trim().length, 1);
  const lengthDelta = Math.abs(whitespaceStep.text.length - rawText.trim().length);
  const lengthDeltaRatio = lengthDelta / rawLength;

  return {
    cleanedText: whitespaceStep.text,
    glyphReplacements: glyphStep.replacements,
    bulletRepairs: bulletStep.repairs,
    whitespaceChanged: whitespaceStep.changed,
    materialRewrite:
      lengthDeltaRatio > 0.2 ||
      glyphStep.replacements >= 3 ||
      bulletStep.repairs >= 2,
  };
}

function coerceSourceSections(sourceSections: unknown[]): RecoverySourceSection[] {
  const next: RecoverySourceSection[] = [];

  sourceSections.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const record = entry as Record<string, unknown>;
    const content =
      typeof record.content === "string"
        ? record.content
        : typeof record.text === "string"
          ? record.text
          : null;
    if (!content || !content.trim()) return;

    const sourceSpanCandidate = record.sourceSpan;
    const sourceSpan =
      sourceSpanCandidate &&
      typeof sourceSpanCandidate === "object" &&
      Number.isFinite(Number((sourceSpanCandidate as Record<string, unknown>).start)) &&
      Number.isFinite(Number((sourceSpanCandidate as Record<string, unknown>).end))
        ? {
            start: Number((sourceSpanCandidate as Record<string, unknown>).start),
            end: Number((sourceSpanCandidate as Record<string, unknown>).end),
          }
        : null;
    const warnings = Array.isArray(record.warnings)
      ? record.warnings.map((warning) => String(warning ?? "")).filter(Boolean)
      : null;

    next.push({
      title:
        typeof record.title === "string"
          ? record.title
          : typeof record.heading === "string"
            ? record.heading
            : null,
      label: typeof record.label === "string" ? record.label : null,
      fieldKey:
        typeof record.fieldKey === "string"
          ? record.fieldKey
          : typeof record.normalizedHeading === "string"
            ? record.normalizedHeading
            : null,
      content,
      text: typeof record.text === "string" ? record.text : null,
      confidence:
        parseConfidence(record.confidence) ??
        parseConfidence(record.sectionConfidence) ??
        parseConfidence(record.score),
      sourceSpan,
      warnings,
    });
  });

  return next;
}

type ResolvedSectionType = {
  predictedSection: ImportRecoverySectionType;
  issueFlags: ImportRecoveryIssueFlag[];
  sourceFieldKey: string | null;
  sourceLabel: string | null;
  selectedSectionTitle?: string | null;
  strongMatch: boolean;
};

type RecoverySplitDiagnostics = {
  splitAttempts: number;
  splitFragmentCount: number;
  suppressedTinyFragments: number;
};

function mapCanonicalFamilyToRecoverySection(
  family: ReturnType<typeof resolveCanonicalHeadingFamily>,
): ImportRecoverySectionType | null {
  if (!family) return null;
  if (family === "contact") return "profile";
  if (family === "profile") return "profile";
  return family;
}

function resolveSectionMatch(
  rawValue: string | null | undefined,
): ImportRecoverySectionType | null {
  const canonical = resolveCanonicalHeadingFamily(rawValue);
  return mapCanonicalFamilyToRecoverySection(canonical);
}

function resolveSectionType(section: RecoverySourceSection): {
  predictedSection: ImportRecoverySectionType;
  issueFlags: ImportRecoveryIssueFlag[];
  sourceFieldKey: string | null;
  sourceLabel: string | null;
  selectedSectionTitle?: string | null;
  strongMatch: boolean;
} {
  const rawFieldKey = String(section.fieldKey ?? "").trim();
  const rawLabel = String(section.label ?? section.title ?? "").trim();
  const fieldKey = normalizeLookupKey(rawFieldKey);
  const label = normalizeLookupKey(rawLabel);
  const fieldMatch = resolveSectionMatch(rawFieldKey) ?? resolveSectionMatch(fieldKey);
  const labelMatch = resolveSectionMatch(rawLabel) ?? resolveSectionMatch(label);
  const issueFlags: ImportRecoveryIssueFlag[] = [];

  if (fieldMatch) {
    return {
      predictedSection: fieldMatch,
      issueFlags,
      sourceFieldKey: rawFieldKey || null,
      sourceLabel: rawLabel || null,
      strongMatch: true,
    };
  }

  if (labelMatch) {
    return {
      predictedSection: labelMatch,
      issueFlags,
      sourceFieldKey: rawFieldKey || null,
      sourceLabel: rawLabel || null,
      strongMatch: true,
    };
  }

  issueFlags.push("unknownSection");
  return {
    predictedSection: "custom",
    issueFlags,
    sourceFieldKey: rawFieldKey || null,
    sourceLabel: rawLabel || null,
    selectedSectionTitle: RESIDUAL_SECTION_TITLE,
    strongMatch: false,
  };
}

function isLikelyHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (resolveCanonicalHeadingFamily(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return false;
  if (/^[A-Z][A-Z\s/&-]{3,}$/.test(trimmed)) return true;
  return /^[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z&/-]+){0,5}:?$/.test(trimmed);
}

function parseHeadingParagraph(paragraph: string): {
  heading: string;
  body: string;
  predictedSection: ImportRecoverySectionType;
} | null {
  const normalizedParagraph = String(paragraph ?? "").replace(/\r/g, "").trim();
  if (!normalizedParagraph) return null;
  const lines = normalizedParagraph.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0] ?? "";
  const canonical = resolveCanonicalHeadingFamily(firstLine.replace(/[:\-–—\s]+$/g, ""));
  if (canonical) {
    const predictedSection = mapCanonicalFamilyToRecoverySection(canonical) ?? "custom";
    const body = lines.slice(1).join("\n").trim();
    if (!body) return null;
    return { heading: firstLine, body, predictedSection };
  }

  const inlineHeading = firstLine.match(/^(.+?)\s*[:\-–—]\s+(.+)$/);
  if (inlineHeading) {
    const canonicalInline = resolveCanonicalHeadingFamily(inlineHeading[1]);
    if (canonicalInline) {
      const predictedSection = mapCanonicalFamilyToRecoverySection(canonicalInline) ?? "custom";
      return {
        heading: inlineHeading[1].trim(),
        body: [inlineHeading[2].trim(), ...lines.slice(1)].join("\n").trim(),
        predictedSection,
      };
    }
  }

  return null;
}

function splitSectionParagraphs(text: string): string[] {
  const normalized = String(text ?? "").replace(/\r/g, "").trim();
  if (!normalized) return [];
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  return normalized
    .split(/\n(?=[A-Z][^\n]{2,60}$)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function maybeSplitRecoverySection(
  section: RecoverySourceSection,
  diagnostics: RecoverySplitDiagnostics,
): RecoverySourceSection[] {
  const content = String(section.content ?? section.text ?? "").trim();
  if (!content || content.length < SPLIT_ELIGIBLE_LENGTH) {
    return [section];
  }

  const paragraphs = splitSectionParagraphs(content);
  const recognizedParagraphs = paragraphs.filter((paragraph) => parseHeadingParagraph(paragraph));
  const containsMultipleRecognizedHeadings = recognizedParagraphs.length >= 2;
  const lines = content.split(/\n/);
  const canonicalHeadingIndexes = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => Boolean(resolveCanonicalHeadingFamily(line)));
  const containsMixedHeadingSignals = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => isLikelyHeadingLine(line)).length >= 2;

  if (!containsMultipleRecognizedHeadings && !containsMixedHeadingSignals) {
    return [section];
  }

  diagnostics.splitAttempts += 1;

  if (canonicalHeadingIndexes.length >= 2) {
    const lineFragments: RecoverySourceSection[] = [];
    canonicalHeadingIndexes.forEach(({ line, index }, headingIndex) => {
      const nextIndex = canonicalHeadingIndexes[headingIndex + 1]?.index ?? lines.length;
      const body = lines.slice(index + 1, nextIndex).join("\n").trim();
      if (!body) return;
      const predictedSection = resolveSectionMatch(line) ?? "custom";
      lineFragments.push({
        ...section,
        title: line,
        label: line,
        fieldKey: predictedSection,
        content: body,
        text: body,
      });
    });
    if (lineFragments.length >= 2) {
      diagnostics.splitFragmentCount += lineFragments.length - 1;
      return lineFragments;
    }
  }

  const fragments: RecoverySourceSection[] = [];
  for (const paragraph of paragraphs) {
    const parsed = parseHeadingParagraph(paragraph);
    if (parsed) {
      fragments.push({
        ...section,
        title: parsed.heading,
        label: parsed.heading,
        fieldKey: parsed.predictedSection,
        content: parsed.body,
        text: parsed.body,
      });
      continue;
    }

    const previous = fragments[fragments.length - 1] ?? null;
    if (
      previous &&
      String(previous.content ?? previous.text ?? "").trim().length < SPLIT_ELIGIBLE_LENGTH
    ) {
      const merged = [String(previous.content ?? previous.text ?? "").trim(), paragraph]
        .filter(Boolean)
        .join("\n\n")
        .trim();
      previous.content = merged;
      previous.text = merged;
      continue;
    }

    fragments.push({
      ...section,
      content: paragraph,
      text: paragraph,
    });
  }

  if (fragments.length <= 1) {
    return [section];
  }

  const mergedFragments: RecoverySourceSection[] = [];
  fragments.forEach((fragment) => {
    const currentText = String(fragment.content ?? fragment.text ?? "").trim();
    if (!currentText) return;
    if (currentText.length < MIN_FRAGMENT_LENGTH) {
      diagnostics.suppressedTinyFragments += 1;
      const previous = mergedFragments[mergedFragments.length - 1] ?? null;
      if (previous) {
        const merged = [String(previous.content ?? previous.text ?? "").trim(), currentText]
          .filter(Boolean)
          .join("\n\n")
          .trim();
        previous.content = merged;
        previous.text = merged;
      } else {
        mergedFragments.push({ ...fragment });
      }
      return;
    }
    mergedFragments.push({ ...fragment });
  });

  const limitedFragments = mergedFragments.slice(0, MAX_SPLIT_FANOUT);
  if (mergedFragments.length > MAX_SPLIT_FANOUT) {
    const remainder = mergedFragments
      .slice(MAX_SPLIT_FANOUT - 1)
      .map((fragment) => String(fragment.content ?? fragment.text ?? "").trim())
      .filter(Boolean)
      .join("\n\n")
      .trim();
    limitedFragments[MAX_SPLIT_FANOUT - 1] = {
      ...limitedFragments[MAX_SPLIT_FANOUT - 1],
      content: remainder,
      text: remainder,
    };
  }

  diagnostics.splitFragmentCount += Math.max(limitedFragments.length - 1, 0);
  return limitedFragments.length > 1 ? limitedFragments : [section];
}

function hasAmbiguousStructure(text: string, warnings?: string[] | null): boolean {
  const warningText = (warnings ?? []).join(" ").toLowerCase();
  if (warningText.includes("ambiguous") || warningText.includes("uncertain")) {
    return true;
  }

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 5) return false;
  const headingishCount = lines.filter(
    (line) => /^[A-Z][A-Z\s/&-]{3,}$/.test(line) || /^[A-Z][A-Za-z\s/&-]{2,}:$/.test(line),
  ).length;
  const bulletCount = lines.filter((line) => /^[-•*+]/.test(line)).length;
  const canonicalHeadingCount = lines.filter((line) => Boolean(resolveCanonicalHeadingFamily(line))).length;
  return canonicalHeadingCount >= 2 || headingishCount >= 3 || (headingishCount >= 2 && bulletCount >= 3);
}

function bandConfidence(args: {
  confidenceValue: number;
  issueFlags: ImportRecoveryIssueFlag[];
  materialRewrite: boolean;
  whitespaceChanged: boolean;
  glyphReplacements: number;
  bulletRepairs: number;
  strongSectionMatch: boolean;
}): "high" | "medium" | "low" {
  const severeFlags = new Set<ImportRecoveryIssueFlag>([
    "unknownSection",
    "ambiguousStructure",
    "duplicate",
  ]);
  const hasSevereFlag = args.issueFlags.some((flag) => severeFlags.has(flag));
  const isStructurallyUnknown = args.issueFlags.includes("unknownSection");
  const combinedGlyphAndBullet =
    args.issueFlags.includes("glyphIssue") &&
    args.issueFlags.includes("bulletIssue");

  if (
    args.confidenceValue < 0.42 ||
    isStructurallyUnknown ||
    (args.issueFlags.includes("ambiguousStructure") && args.confidenceValue < 0.72) ||
    (args.issueFlags.includes("duplicate") && args.confidenceValue < 0.8) ||
    (!args.strongSectionMatch && hasSevereFlag) ||
    (combinedGlyphAndBullet && args.confidenceValue < 0.65) ||
    (args.materialRewrite && !args.strongSectionMatch && args.confidenceValue < 0.7)
  ) {
    return "low";
  }

  const hasModerateSignal =
    args.issueFlags.includes("glyphIssue") ||
    args.issueFlags.includes("bulletIssue") ||
    args.issueFlags.includes("weakSectionMatch") ||
    args.whitespaceChanged ||
    args.confidenceValue < (args.strongSectionMatch ? 0.68 : 0.8) ||
    args.glyphReplacements > 0 ||
    args.bulletRepairs > 0 ||
    args.materialRewrite;

  if (args.confidenceValue >= 0.82 && args.strongSectionMatch && !hasModerateSignal) {
    return "high";
  }

  return "medium";
}

function toCanonicalRawSections(items: ImportRecoveryItem[]) {
  return items.map((item) => ({
    label: SECTION_LABELS[item.selectedSection ?? item.predictedSection],
    content: item.cleanedText || item.rawText,
  }));
}

function buildReviewNormalized(
  approvedItems: ImportRecoveryItem[],
  fullResult: Record<string, any>,
  context: CanonicalizeContext,
) {
  const rawSections = toCanonicalRawSections(approvedItems);
  const reviewRawText = rawSections.map((section) => section.content).join("\n\n").trim();

  const seeded = canonicalizeParserResult(
    {
      normalized: {
        rawText: reviewRawText,
        rawSections,
      },
      diagnostics:
        fullResult?.diagnostics && typeof fullResult.diagnostics === "object"
          ? { ...fullResult.diagnostics }
          : {},
    },
    context,
  );

  return seeded?.normalized && typeof seeded.normalized === "object"
    ? seeded.normalized
    : null;
}

export function buildImportRecoveryPayload(args: {
  sourceSections: unknown[];
  fullResult: Record<string, any>;
  context: CanonicalizeContext;
}): ImportRecoveryPayload | null {
  const startedAt = Date.now();
  const sourceSections = coerceSourceSections(args.sourceSections);
  if (sourceSections.length === 0) {
    return null;
  }

  const splitDiagnostics: RecoverySplitDiagnostics = {
    splitAttempts: 0,
    splitFragmentCount: 0,
    suppressedTinyFragments: 0,
  };

  const expandedSections = sourceSections.flatMap((section) =>
    maybeSplitRecoverySection(section, splitDiagnostics),
  );

  const scoredCandidates = expandedSections.slice(0, MAX_REVIEW_ITEMS).map((section, index) => {
    const rawText = String(section.content ?? section.text ?? "").trim();
    const cleanup = cleanupImportRecoveryText(rawText);
    const resolved = resolveSectionType(section);
    const issueFlags = [...resolved.issueFlags];
    const confidenceValue = parseConfidence(section.confidence) ?? (resolved.strongMatch ? 0.72 : 0.58);

    if (!resolved.strongMatch && resolved.predictedSection !== "custom") {
      issueFlags.push("weakSectionMatch");
    }

    if (cleanup.glyphReplacements > 0) {
      issueFlags.push("glyphIssue");
    }
    if (cleanup.bulletRepairs > 0) {
      issueFlags.push("bulletIssue");
    }
    if (hasAmbiguousStructure(cleanup.cleanedText, section.warnings)) {
      issueFlags.push("ambiguousStructure");
    }

    const dedupedFlags = Array.from(new Set(issueFlags));
    const confidenceScore = bandConfidence({
      confidenceValue,
      issueFlags: dedupedFlags,
      materialRewrite: cleanup.materialRewrite,
      whitespaceChanged: cleanup.whitespaceChanged,
      glyphReplacements: cleanup.glyphReplacements,
      bulletRepairs: cleanup.bulletRepairs,
      strongSectionMatch: resolved.strongMatch,
    });

    const item: ImportRecoveryItem = {
      blockId: `recovery-${index + 1}`,
      rawText,
      cleanedText: cleanup.cleanedText,
      displayTextSource: "cleaned",
      predictedSection: resolved.predictedSection,
      confidenceScore,
      confidenceValue,
      issueFlags: dedupedFlags,
      reviewStatus: "pending",
      selectedSection: resolved.predictedSection,
      selectedSectionTitle: resolved.selectedSectionTitle ?? null,
      sourceSectionTitle: section.title ?? null,
      sourceFieldKey: resolved.sourceFieldKey,
      sourceLabel: resolved.sourceLabel,
      sourceSpan: section.sourceSpan ?? null,
      fragmentAssignments: [],
    };

    return {
      item,
      cleanup,
    };
  });

  const duplicateCounts = new Map<string, number>();
  scoredCandidates.forEach(({ item }) => {
    const key = item.cleanedText.trim().toLowerCase();
    if (!key) return;
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  });

  const rescoredItems = scoredCandidates.map(({ item, cleanup }) => {
    const key = item.cleanedText.trim().toLowerCase();
    const issueFlags = new Set(item.issueFlags);
    if (key && (duplicateCounts.get(key) ?? 0) > 1) {
      issueFlags.add("duplicate");
    }
    const nextIssueFlags = Array.from(issueFlags);
    return {
      ...item,
      issueFlags: nextIssueFlags,
      confidenceScore: bandConfidence({
        confidenceValue: item.confidenceValue ?? 0.65,
        issueFlags: nextIssueFlags,
        materialRewrite: cleanup.materialRewrite,
        whitespaceChanged: cleanup.whitespaceChanged,
        glyphReplacements: cleanup.glyphReplacements,
        bulletRepairs: cleanup.bulletRepairs,
        strongSectionMatch:
          item.predictedSection !== "custom" && !nextIssueFlags.includes("unknownSection"),
      }),
    } satisfies ImportRecoveryItem;
  });

  const reviewItems = rescoredItems.filter(
    (item) => item.confidenceScore === "low",
  );

  const approvedItems = rescoredItems.filter(
    (item) => item.confidenceScore !== "low",
  );

  const countsByPredictedSection = rescoredItems.reduce<ImportRecoveryRoutingDiagnostics["countsByPredictedSection"]>((acc, item) => {
    acc[item.predictedSection] = (acc[item.predictedSection] ?? 0) + 1;
    return acc;
  }, {});

  const countsByIssueFlag = rescoredItems.reduce<ImportRecoveryRoutingDiagnostics["countsByIssueFlag"]>((acc, item) => {
    item.issueFlags.forEach((flag) => {
      acc[flag] = (acc[flag] ?? 0) + 1;
    });
    return acc;
  }, {});

  const countsByConfidenceBand = rescoredItems.reduce<ImportRecoveryRoutingDiagnostics["countsByConfidenceBand"]>((acc, item) => {
    acc[item.confidenceScore] = (acc[item.confidenceScore] ?? 0) + 1;
    return acc;
  }, {});

  const diagnostics: ImportRecoveryRoutingDiagnostics = {
    sourceSectionCount: sourceSections.length,
    splitFragmentCount: splitDiagnostics.splitFragmentCount,
    directImportItemCount: approvedItems.length,
    recoveryItemCount: reviewItems.length,
    countsByPredictedSection,
    countsByIssueFlag,
    countsByConfidenceBand,
    unknownResidualCount: rescoredItems.filter((item) => item.predictedSection === "custom").length,
    largeRecoveryBlobCount: reviewItems.filter((item) => item.cleanedText.length >= LARGE_RECOVERY_BLOB_THRESHOLD).length,
    splitAttempts: splitDiagnostics.splitAttempts,
    suppressedTinyFragments: splitDiagnostics.suppressedTinyFragments,
    processingTimeMs: Math.max(0, Date.now() - startedAt),
  };

  return {
    items: reviewItems,
    reviewRequired: reviewItems.length > 0,
    totalItems: reviewItems.length,
    overflowCount: Math.max(reviewItems.length - REVIEW_LIMIT, 0),
    reviewLimit: REVIEW_LIMIT,
    diagnostics,
    reviewNormalized:
      reviewItems.length > 0
        ? buildReviewNormalized(approvedItems, args.fullResult, args.context)
        : null,
  };
}
