export type CanonicalJobParseStatus =
  | "imported"
  | "parsing"
  | "parsed"
  | "failed";

export type CanonicalJobReviewState = "pending" | "needs_review" | "ready";

export type CanonicalJobSourceSpan = {
  start: number;
  end: number;
};

export type CanonicalJobExtraction = {
  value: string;
  confidence: number;
  sourceSpan: CanonicalJobSourceSpan | null;
};

export type CanonicalJobReviewItem = {
  id: string;
  fieldKey: string;
  label: string;
  reviewStatus: "pending" | "approved";
  suggestedValue: unknown;
  approvedValue?: unknown;
  sourceText: string;
  confidence: number;
  updatedAt: number;
};

const MAX_RESPONSIBILITIES = 3;
const MAX_KEYWORDS = 8;
const MAX_MUST_HAVES = 4;
const LOW_CONFIDENCE_REVIEW_THRESHOLD = 0.7;

const RESPONSIBILITY_CUE_RE =
  /\b(lead|manage|coordinate|support|build|develop|maintain|execute|own|deliver|drive|run|monitor|analy[sz]e|partner|collaborate|improve|create|oversee|organize|plan)\b/i;
const REQUIREMENT_CUE_RE =
  /\b(must|required|requirements?|qualifications?|experience with|need to|should have|proficient in|familiar with|expertise in)\b/i;
const STRONG_REQUIREMENT_CUE_RE =
  /\b(must|required|requirements?|qualifications?)\b/i;
const BOILERPLATE_SENTENCE_RE =
  /\b(is hiring|about the role|about us|join our team|we are looking for|this role)\b/i;
const KEYWORD_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "along",
  "among",
  "being",
  "clear",
  "from",
  "have",
  "hiring",
  "into",
  "jobs",
  "maintain",
  "must",
  "need",
  "role",
  "that",
  "their",
  "there",
  "these",
  "this",
  "those",
  "will",
  "with",
  "your",
]);
const TONE_CUE_RULES = [
  { label: "structured", regex: /\bstructured\b/i },
  { label: "collaborative", regex: /\bcollabor(?:ative|ation|ate)\b/i },
  { label: "fast-paced", regex: /\bfast[- ]?paced\b/i },
  { label: "detail-oriented", regex: /\bdetail[- ]oriented\b/i },
] as const;

type SentenceSegment = {
  value: string;
  sourceSpan: CanonicalJobSourceSpan;
};

function compactWhitespace(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizeFieldValue(value: string): string {
  return compactWhitespace(value).replace(/[.;:,!?]+$/g, "");
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16);
}

function extractDomain(sourceUrl: string): string {
  const normalized = compactWhitespace(sourceUrl);
  if (!normalized) {
    return "";
  }

  try {
    return new URL(normalized).hostname.replace(/^www\./i, "");
  } catch {
    return normalized
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .trim();
  }
}

function splitSentences(rawDescription: string): SentenceSegment[] {
  const segments: SentenceSegment[] = [];
  const matcher = /[^.!?\n]+(?:[.!?]+|$)/g;

  for (const match of rawDescription.matchAll(matcher)) {
    const original = match[0] ?? "";
    const leadingWhitespace = original.match(/^\s*/)?.[0]?.length ?? 0;
    const trailingWhitespace = original.match(/\s*$/)?.[0]?.length ?? 0;
    const start = (match.index ?? 0) + leadingWhitespace;
    const end = (match.index ?? 0) + original.length - trailingWhitespace;
    const value = normalizeFieldValue(original.slice(leadingWhitespace, original.length - trailingWhitespace));

    if (!value) {
      continue;
    }

    segments.push({
      value,
      sourceSpan: { start, end },
    });
  }

  return segments;
}

function toExtraction(
  value: string,
  confidence: number,
  sourceSpan: CanonicalJobSourceSpan | null,
): CanonicalJobExtraction {
  return {
    value: normalizeFieldValue(value),
    confidence: clampConfidence(confidence),
    sourceSpan,
  };
}

function dedupeExtractions(
  values: CanonicalJobExtraction[],
  limit: number,
): CanonicalJobExtraction[] {
  const deduped: CanonicalJobExtraction[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalizedValue = normalizeFieldValue(value.value);
    if (!normalizedValue) {
      continue;
    }

    const dedupeKey = normalizedValue.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push({
      ...value,
      value: normalizedValue,
      confidence: clampConfidence(value.confidence),
    });

    if (deduped.length >= limit) {
      break;
    }
  }

  return deduped;
}

function extractResponsibilities(rawDescription: string): CanonicalJobExtraction[] {
  const sentences = splitSentences(rawDescription).filter(
    (sentence) => !BOILERPLATE_SENTENCE_RE.test(sentence.value),
  );

  const strongMatches = sentences
    .filter((sentence) => RESPONSIBILITY_CUE_RE.test(sentence.value))
    .map((sentence) => toExtraction(sentence.value, 0.9, sentence.sourceSpan));

  if (strongMatches.length > 0) {
    return dedupeExtractions(strongMatches, MAX_RESPONSIBILITIES);
  }

  return dedupeExtractions(
    sentences
      .slice(0, MAX_RESPONSIBILITIES)
      .map((sentence) => toExtraction(sentence.value, 0.4, sentence.sourceSpan)),
    MAX_RESPONSIBILITIES,
  );
}

function extractMustHaves(rawDescription: string): CanonicalJobExtraction[] {
  const matches = splitSentences(rawDescription)
    .filter((sentence) => REQUIREMENT_CUE_RE.test(sentence.value))
    .map((sentence) =>
      toExtraction(
        sentence.value,
        STRONG_REQUIREMENT_CUE_RE.test(sentence.value) ? 0.9 : 0.78,
        sentence.sourceSpan,
      ),
    );

  return dedupeExtractions(matches, MAX_MUST_HAVES);
}

function normalizeKeywordToken(value: string): string {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/^[^a-z0-9+#./-]+|[^a-z0-9+#./-]+$/g, "");
}

function collectKeywordCandidates(args: {
  title: string;
  rawDescription: string;
  responsibilities: CanonicalJobExtraction[];
  mustHaves: CanonicalJobExtraction[];
}): CanonicalJobExtraction[] {
  const orderedCandidates = new Map<
    string,
    { value: string; confidence: number; sourceSpan: CanonicalJobSourceSpan | null }
  >();
  const requirementSpans = args.mustHaves.map((item) => item.sourceSpan).filter(Boolean);
  const responsibilitySpans = args.responsibilities
    .map((item) => item.sourceSpan)
    .filter(Boolean);

  const pushCandidate = (
    rawValue: string,
    confidence: number,
    sourceSpan: CanonicalJobSourceSpan | null,
  ) => {
    const normalizedValue = normalizeKeywordToken(rawValue);
    if (
      normalizedValue.length < 3 ||
      KEYWORD_STOP_WORDS.has(normalizedValue) ||
      /^\d+$/.test(normalizedValue)
    ) {
      return;
    }

    const existing = orderedCandidates.get(normalizedValue);
    if (!existing) {
      orderedCandidates.set(normalizedValue, {
        value: normalizedValue,
        confidence,
        sourceSpan,
      });
      return;
    }

    if (confidence > existing.confidence) {
      existing.confidence = confidence;
    }
    if (!existing.sourceSpan && sourceSpan) {
      existing.sourceSpan = sourceSpan;
    }
  };

  for (const match of args.title.match(/[A-Za-z][A-Za-z+#./-]{2,}/g) ?? []) {
    pushCandidate(match, 0.82, null);
  }

  for (const match of args.rawDescription.matchAll(/[A-Za-z][A-Za-z+#./-]{2,}/g)) {
    const token = match[0] ?? "";
    const index = match.index ?? 0;
    const tokenSpan = { start: index, end: index + token.length };
    const inRequirement = requirementSpans.some(
      (span) => span && tokenSpan.start >= span.start && tokenSpan.end <= span.end,
    );
    const inResponsibility = responsibilitySpans.some(
      (span) => span && tokenSpan.start >= span.start && tokenSpan.end <= span.end,
    );

    pushCandidate(
      token,
      inRequirement ? 0.9 : inResponsibility ? 0.62 : 0.45,
      tokenSpan,
    );
  }

  return Array.from(orderedCandidates.values()).map((item) => ({
    value: item.value,
    confidence: clampConfidence(item.confidence),
    sourceSpan: item.sourceSpan,
  }));
}

function extractKeywords(args: {
  title: string;
  rawDescription: string;
  responsibilities: CanonicalJobExtraction[];
  mustHaves: CanonicalJobExtraction[];
}): CanonicalJobExtraction[] {
  return dedupeExtractions(collectKeywordCandidates(args), MAX_KEYWORDS);
}

function extractToneCues(rawDescription: string): CanonicalJobExtraction[] {
  const cues: CanonicalJobExtraction[] = [];

  for (const rule of TONE_CUE_RULES) {
    const match = rawDescription.match(rule.regex);
    if (!match || match.index === undefined) {
      continue;
    }

    cues.push(
      toExtraction(rule.label, 0.9, {
        start: match.index,
        end: match.index + match[0].length,
      }),
    );
  }

  return cues;
}

function extractLocation(rawDescription: string): string {
  const locationToken =
    String.raw`(?:[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]*|de|del|della|des|du|da|di|do|dos|das|am|an|der|den|la|le|los|las|el|y)`;
  const locationValuePattern = new RegExp(
    `^(${locationToken}(?:\\s+${locationToken}){0,4})`,
    "u",
  );
  const locationPatterns = [
    /\b(?:based in|located in|office in)\s+([^.,;:!?]+)/iu,
    /\bin\s+([^.,;:!?]+)/u,
    /\b(?:oficina en|ubicad[oa] en|basad[oa] en)\s+([^.,;:!?]+)/iu,
    /\b(?:basé(?:e|es)? à|situé(?:e|es)? à|bureau à)\s+([^.,;:!?]+)/iu,
    /\b(?:standort(?: in)?|büro(?: in)?|sitz(?: in)?|arbeitsort(?: in)?)\s+([^.,;:!?]+)/iu,
    /\b(?:con sede a|sede a|ufficio a|situat[oa] a|localizzato a|localizzata a)\s+([^.,;:!?]+)/iu,
    /\b(?:escritório em|sede em|localizado em|localizada em|baseado em|baseada em)\s+([^.,;:!?]+)/iu,
  ] as const;

  for (const pattern of locationPatterns) {
    const match = rawDescription.match(pattern);
    const location = compactWhitespace(match?.[1] ?? "");
    if (location) {
      const locationValue = location.match(locationValuePattern)?.[1] ?? "";
      if (locationValue) {
        return compactWhitespace(locationValue);
      }
    }
  }

  return "";
}

export function resolveReparsedLocation(args: {
  existingLocation?: string | null;
  parsedLocation?: string | null;
}): string {
  const parsedLocation = compactWhitespace(args.parsedLocation ?? "");
  if (parsedLocation) {
    return parsedLocation;
  }

  return compactWhitespace(args.existingLocation ?? "");
}

function extractCompany(rawDescription: string): string {
  const match =
    rawDescription.match(/\b([A-Z][A-Za-z0-9&.' -]{1,50})\s+is hiring\b/) ??
    rawDescription.match(/\bat\s+([A-Z][A-Za-z0-9&.' -]{1,50})\b/);
  return compactWhitespace(match?.[1] ?? "");
}

function extractSummary(args: {
  title: string;
  rawDescription: string;
  responsibilities: CanonicalJobExtraction[];
}): CanonicalJobExtraction {
  const leadResponsibility = args.responsibilities[0];
  const title = compactWhitespace(args.title);

  if (leadResponsibility) {
    const sourceLength = compactWhitespace(args.rawDescription).length;
    const responsibilityWordCount = leadResponsibility.value
      .split(/\s+/)
      .filter(Boolean).length;
    const summaryConfidence =
      sourceLength < 40 || responsibilityWordCount < 4
        ? 0.35
        : Math.max(0.45, leadResponsibility.confidence);

    return toExtraction(
      `${title} role focused on ${leadResponsibility.value.toLowerCase()}`,
      summaryConfidence,
      leadResponsibility.sourceSpan,
    );
  }

  const fallbackSummary = title || compactWhitespace(args.rawDescription).slice(0, 120);
  return toExtraction(fallbackSummary, 0.35, null);
}

function extractSourceText(
  rawDescription: string,
  values: CanonicalJobExtraction[],
): string {
  const excerpts = values
    .map((value) =>
      value.sourceSpan
        ? compactWhitespace(
            rawDescription.slice(value.sourceSpan.start, value.sourceSpan.end),
          )
        : "",
    )
    .filter(Boolean);

  return excerpts.join("\n") || compactWhitespace(rawDescription);
}

function buildReviewItems(args: {
  responsibilities: CanonicalJobExtraction[];
  mustHaves: CanonicalJobExtraction[];
  keywords: CanonicalJobExtraction[];
  toneCues: CanonicalJobExtraction[];
  rawDescription: string;
  now: number;
}): CanonicalJobReviewItem[] {
  const fields = [
    {
      id: "responsibilities",
      fieldKey: "responsibilities",
      label: "Responsibilities",
      values: args.responsibilities,
      suggestedValue: args.responsibilities.map((item) => item.value),
    },
    {
      id: "must_haves",
      fieldKey: "mustHaves",
      label: "Must-haves",
      values: args.mustHaves,
      suggestedValue: args.mustHaves.map((item) => item.value),
    },
    {
      id: "keywords",
      fieldKey: "keywords",
      label: "Keywords",
      values: args.keywords,
      suggestedValue: args.keywords.map((item) => item.value),
    },
    {
      id: "tone_cues",
      fieldKey: "toneCues",
      label: "Tone cues",
      values: args.toneCues,
      suggestedValue: args.toneCues.map((item) => item.value),
    },
  ] as const;

  return fields.flatMap((field) => {
    if (field.values.length === 0) {
      return [];
    }

    const confidence = Math.min(...field.values.map((value) => value.confidence));
    if (confidence >= LOW_CONFIDENCE_REVIEW_THRESHOLD) {
      return [];
    }

    return [
      {
        id: field.id,
        fieldKey: field.fieldKey,
        label: field.label,
        reviewStatus: "pending" as const,
        suggestedValue: field.suggestedValue,
        sourceText: extractSourceText(args.rawDescription, field.values),
        confidence,
        updatedAt: args.now,
      },
    ];
  });
}

export function flattenExtractionValues(
  values: CanonicalJobExtraction[] | undefined,
): string[] {
  return (values ?? []).map((value) => value.value).filter(Boolean);
}

/**
 * `sourceSpan` offsets are rawDescription character offsets. Title-only keyword matches keep
 * `sourceSpan: null` because they do not originate from a substring in the imported job body.
 */
export function buildCanonicalJobDraftFromSource(args: {
  title: string;
  rawDescription: string;
  sourceUrl?: string;
  sourceDomain?: string;
  sourceType?: string;
  applicationUrl?: string;
}) {
  const now = Date.now();
  const rawDescription = String(args.rawDescription ?? "").trim();
  const title = compactWhitespace(args.title);
  const sourceUrl = compactWhitespace(args.sourceUrl ?? "");
  const sourceDomain = compactWhitespace(args.sourceDomain ?? "") || extractDomain(sourceUrl);
  const responsibilitiesExtraction = extractResponsibilities(rawDescription);
  const mustHavesExtraction = extractMustHaves(rawDescription);
  const keywordsExtraction = extractKeywords({
    title,
    rawDescription,
    responsibilities: responsibilitiesExtraction,
    mustHaves: mustHavesExtraction,
  });
  const toneCuesExtraction = extractToneCues(rawDescription);
  const summaryExtraction = extractSummary({
    title,
    rawDescription,
    responsibilities: responsibilitiesExtraction,
  });
  const reviewItems = buildReviewItems({
    responsibilities: responsibilitiesExtraction,
    mustHaves: mustHavesExtraction,
    keywords: keywordsExtraction,
    toneCues: toneCuesExtraction,
    rawDescription,
    now,
  });

  return {
    createdAt: now,
    updatedAt: now,
    importedAt: now,
    lastOpenedAt: now,
    sourceUrl,
    sourceDomain,
    sourceType: compactWhitespace(args.sourceType ?? "extension") || "extension",
    applicationUrl: compactWhitespace(args.applicationUrl ?? ""),
    dedupeKey: shortHash(
      `${sourceUrl}::${title.toLowerCase()}::${compactWhitespace(rawDescription).toLowerCase()}`,
    ),
    parseVersion: "v1b",
    parseStatus: "parsed" as CanonicalJobParseStatus,
    reviewState: resolveCanonicalJobReviewState(reviewItems),
    title,
    company: extractCompany(rawDescription),
    location: extractLocation(rawDescription),
    rawDescription,
    rawLanguageDetected: "en",
    summary: summaryExtraction.value || title,
    summaryExtraction,
    responsibilities: flattenExtractionValues(responsibilitiesExtraction),
    responsibilitiesExtraction,
    keywords: flattenExtractionValues(keywordsExtraction),
    keywordsExtraction,
    mustHaves: flattenExtractionValues(mustHavesExtraction),
    mustHavesExtraction,
    toneCues: flattenExtractionValues(toneCuesExtraction),
    toneCuesExtraction,
    contacts: [] as string[],
    status: "active",
    archivedAt: null as number | null,
    reviewItems,
  };
}

export function resolveCanonicalJobReviewState(
  reviewItems: CanonicalJobReviewItem[],
): CanonicalJobReviewState {
  if (reviewItems.length === 0) {
    return "ready";
  }

  return reviewItems.some((item) => item.reviewStatus === "pending")
    ? "needs_review"
    : "ready";
}

export function resolveReviewItemsAfterFieldUpdate(args: {
  reviewItems: CanonicalJobReviewItem[];
  fieldKey: string;
  nextValue: unknown;
  now: number;
}) {
  return args.reviewItems.map((item) =>
    item.fieldKey === args.fieldKey
      ? {
          ...item,
          reviewStatus: "approved" as const,
          approvedValue: args.nextValue,
          updatedAt: args.now,
        }
      : item,
  );
}

export function resolveReviewItemsAfterApprove(args: {
  reviewItems: CanonicalJobReviewItem[];
  reviewItemId: string;
  now: number;
}) {
  return args.reviewItems.map((item) =>
    item.id === args.reviewItemId
      ? {
          ...item,
          reviewStatus: "approved" as const,
          approvedValue:
            item.approvedValue === undefined ? item.suggestedValue : item.approvedValue,
          updatedAt: args.now,
        }
      : item,
  );
}
