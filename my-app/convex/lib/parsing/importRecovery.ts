import { canonicalizeParserResult } from "./canonicalize";
import type { CanonicalizeContext } from "./canonicalize";
import type {
  ImportRecoveryIssueFlag,
  ImportRecoveryItem,
  ImportRecoveryPayload,
  ImportRecoverySectionType,
} from "../../../src/types/importRecovery";

const REVIEW_LIMIT = 12;

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

const SECTION_ALIASES: Record<string, ImportRecoverySectionType> = {
  profile: "profile",
  identity: "profile",
  contact: "profile",
  details: "profile",
  personal: "profile",
  header: "profile",
  personaldetails: "profile",
  summary: "summary",
  introduction: "summary",
  objective: "summary",
  about: "summary",
  experience: "experience",
  workexperience: "experience",
  work_experience: "experience",
  employment: "experience",
  employmenthistory: "experience",
  work: "experience",
  achievements: "achievements",
  accomplishment: "achievements",
  accomplishments: "achievements",
  award: "achievements",
  awards: "achievements",
  publication: "achievements",
  publications: "achievements",
  education: "education",
  formation: "education",
  academic: "education",
  academics: "education",
  studies: "education",
  skills: "skills",
  skill: "skills",
  competency: "skills",
  competencies: "skills",
  competence: "skills",
  competences: "skills",
  technicalskills: "skills",
  language: "languages",
  languages: "languages",
  langue: "languages",
  langues: "languages",
  project: "projects",
  projects: "projects",
  portfolio: "projects",
  certification: "certifications",
  certifications: "certifications",
  certificate: "certifications",
  certificates: "certifications",
  license: "certifications",
  licenses: "certifications",
  licence: "certifications",
  licences: "certifications",
  hobbies: "hobbies",
  hobby: "hobbies",
  interests: "hobbies",
  interest: "hobbies",
  affiliations: "affiliations",
  affiliation: "affiliations",
  memberships: "affiliations",
  membership: "affiliations",
  associations: "affiliations",
  association: "affiliations",
  additionalinformation: "additional_information",
  additionalinfo: "additional_information",
  otherinformation: "additional_information",
  miscellaneous: "additional_information",
  misc: "additional_information",
  extras: "additional_information",
  custom: "custom",
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
  custom: "ADDITIONAL INFORMATION",
};

function normalizeLookupKey(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "")
    .trim();
}

function parseConfidence(value: unknown): number | null {
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

function resolveSectionType(section: RecoverySourceSection): {
  predictedSection: ImportRecoverySectionType;
  issueFlags: ImportRecoveryIssueFlag[];
  sourceFieldKey: string | null;
  sourceLabel: string | null;
} {
  const rawFieldKey = String(section.fieldKey ?? "").trim();
  const rawLabel = String(section.label ?? section.title ?? "").trim();
  const fieldKey = normalizeLookupKey(rawFieldKey);
  const label = normalizeLookupKey(rawLabel);
  const fieldMatch = SECTION_ALIASES[fieldKey] ?? null;
  const labelMatch = SECTION_ALIASES[label] ?? null;
  const issueFlags: ImportRecoveryIssueFlag[] = [];

  if (fieldMatch) {
    return {
      predictedSection: fieldMatch,
      issueFlags,
      sourceFieldKey: rawFieldKey || null,
      sourceLabel: rawLabel || null,
    };
  }

  if (labelMatch) {
    if (!parseConfidence(section.confidence)) {
      issueFlags.push("weakSectionMatch");
    }
    return {
      predictedSection: labelMatch,
      issueFlags,
      sourceFieldKey: rawFieldKey || null,
      sourceLabel: rawLabel || null,
    };
  }

  issueFlags.push("unknownSection");
  return {
    predictedSection: "summary",
    issueFlags,
    sourceFieldKey: rawFieldKey || null,
    sourceLabel: rawLabel || null,
  };
}

function hasAmbiguousStructure(text: string, warnings?: string[] | null): boolean {
  const warningText = (warnings ?? []).join(" ").toLowerCase();
  if (warningText.includes("ambiguous") || warningText.includes("uncertain")) {
    return true;
  }

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 4) return false;
  const headingishCount = lines.filter(
    (line) => /^[A-Z][A-Z\s/&-]{3,}$/.test(line) || /^[A-Z][A-Za-z\s/&-]{2,}:$/.test(line),
  ).length;
  const bulletCount = lines.filter((line) => /^[-•*+]/.test(line)).length;
  return headingishCount >= 2 || (headingishCount >= 1 && bulletCount >= 2);
}

function bandConfidence(args: {
  confidenceValue: number;
  issueFlags: ImportRecoveryIssueFlag[];
  materialRewrite: boolean;
  whitespaceChanged: boolean;
  glyphReplacements: number;
  bulletRepairs: number;
}): "high" | "medium" | "low" {
  const severeFlags = new Set<ImportRecoveryIssueFlag>([
    "unknownSection",
    "weakSectionMatch",
    "ambiguousStructure",
    "duplicate",
  ]);
  const hasSevereFlag = args.issueFlags.some((flag) => severeFlags.has(flag));
  const combinedGlyphAndBullet =
    args.issueFlags.includes("glyphIssue") &&
    args.issueFlags.includes("bulletIssue");

  if (
    args.confidenceValue < 0.55 ||
    hasSevereFlag ||
    combinedGlyphAndBullet ||
    args.materialRewrite
  ) {
    return "low";
  }

  const hasModerateSignal =
    args.issueFlags.includes("glyphIssue") ||
    args.issueFlags.includes("bulletIssue") ||
    args.whitespaceChanged ||
    args.confidenceValue < 0.8 ||
    args.glyphReplacements > 0 ||
    args.bulletRepairs > 0;

  if (args.confidenceValue >= 0.8 && !hasModerateSignal) {
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
  const sourceSections = coerceSourceSections(args.sourceSections);
  if (sourceSections.length === 0) {
    return null;
  }

  const scoredCandidates = sourceSections.map((section, index) => {
    const rawText = String(section.content ?? section.text ?? "").trim();
    const cleanup = cleanupImportRecoveryText(rawText);
    const resolved = resolveSectionType(section);
    const issueFlags = [...resolved.issueFlags];
    const confidenceValue = parseConfidence(section.confidence) ?? 0.65;

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
      }),
    } satisfies ImportRecoveryItem;
  });

  const reviewItems = rescoredItems.filter(
    (item) => item.confidenceScore === "low",
  );

  const approvedItems = rescoredItems.filter(
    (item) => item.confidenceScore !== "low",
  );

  return {
    items: reviewItems,
    reviewRequired: reviewItems.length > 0,
    totalItems: reviewItems.length,
    overflowCount: Math.max(reviewItems.length - REVIEW_LIMIT, 0),
    reviewLimit: REVIEW_LIMIT,
    reviewNormalized:
      reviewItems.length > 0
        ? buildReviewNormalized(approvedItems, args.fullResult, args.context)
        : null,
  };
}
