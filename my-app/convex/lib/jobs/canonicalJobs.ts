export type CanonicalJobParseStatus =
  | "imported"
  | "parsing"
  | "parsed"
  | "failed";

export type CanonicalJobReviewState = "pending" | "needs_review" | "ready";

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

function compactWhitespace(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function splitSentences(rawDescription: string): string[] {
  return rawDescription
    .split(/[\n.!?]+/g)
    .map((item) => compactWhitespace(item))
    .filter(Boolean);
}

function extractResponsibilities(rawDescription: string): string[] {
  const segments = splitSentences(rawDescription);
  return segments.slice(0, 3);
}

function extractKeywords(title: string, rawDescription: string): string[] {
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "along",
    "among",
    "being",
    "clear",
    "hiring",
    "maintain",
    "their",
    "there",
    "these",
    "those",
    "with",
    "from",
    "this",
    "that",
    "will",
    "your",
    "into",
    "role",
    "jobs",
    "need",
    "must",
    "have",
  ]);

  const tokens = `${title} ${rawDescription}`
    .toLowerCase()
    .match(/[a-z][a-z-]{3,}/g);

  if (!tokens) {
    return [];
  }

  return Array.from(
    new Set(tokens.filter((token) => !stopWords.has(token))),
  ).slice(0, 8);
}

function extractMustHaves(rawDescription: string): string[] {
  const sentences = splitSentences(rawDescription);
  return sentences
    .filter((sentence) =>
      /\b(must|required|experience with|need to|should have)\b/i.test(sentence),
    )
    .slice(0, 4);
}

function extractToneCues(rawDescription: string): string[] {
  const cues: string[] = [];
  if (/\bstructured\b/i.test(rawDescription)) cues.push("structured");
  if (/\bcollabor/i.test(rawDescription)) cues.push("collaborative");
  if (/\bfast[- ]?paced\b/i.test(rawDescription)) cues.push("fast-paced");
  if (/\bdetail[- ]oriented\b/i.test(rawDescription)) cues.push("detail-oriented");
  return cues;
}

function extractLocation(rawDescription: string): string {
  const match = rawDescription.match(/\b(?:in|based in)\s+([A-Z][A-Za-z -]{1,40})/);
  return compactWhitespace(match?.[1] ?? "");
}

function extractCompany(rawDescription: string): string {
  const match =
    rawDescription.match(/\b([A-Z][A-Za-z0-9&.' -]{1,50})\s+is hiring\b/) ??
    rawDescription.match(/\bat\s+([A-Z][A-Za-z0-9&.' -]{1,50})\b/);
  return compactWhitespace(match?.[1] ?? "");
}

function buildReviewItems(args: {
  responsibilities: string[];
  mustHaves: string[];
  keywords: string[];
  toneCues: string[];
  rawDescription: string;
  now: number;
}): CanonicalJobReviewItem[] {
  const items: CanonicalJobReviewItem[] = [];

  if (args.responsibilities.length > 0) {
    items.push({
      id: "responsibilities",
      fieldKey: "responsibilities",
      label: "Responsibilities",
      reviewStatus: "pending",
      suggestedValue: args.responsibilities,
      sourceText: args.rawDescription,
      confidence: 0.52,
      updatedAt: args.now,
    });
  }

  if (args.mustHaves.length > 0) {
    items.push({
      id: "must_haves",
      fieldKey: "mustHaves",
      label: "Must-haves",
      reviewStatus: "pending",
      suggestedValue: args.mustHaves,
      sourceText: args.rawDescription,
      confidence: 0.48,
      updatedAt: args.now,
    });
  }

  if (args.keywords.length > 0) {
    items.push({
      id: "keywords",
      fieldKey: "keywords",
      label: "Keywords",
      reviewStatus: "pending",
      suggestedValue: args.keywords,
      sourceText: args.rawDescription,
      confidence: 0.42,
      updatedAt: args.now,
    });
  }

  if (args.toneCues.length > 0) {
    items.push({
      id: "tone_cues",
      fieldKey: "toneCues",
      label: "Tone cues",
      reviewStatus: "pending",
      suggestedValue: args.toneCues,
      sourceText: args.rawDescription,
      confidence: 0.46,
      updatedAt: args.now,
    });
  }

  return items;
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
  const responsibilities = extractResponsibilities(rawDescription);
  const keywords = extractKeywords(title, rawDescription);
  const mustHaves = extractMustHaves(rawDescription);
  const toneCues = extractToneCues(rawDescription);
  const reviewItems = buildReviewItems({
    responsibilities,
    mustHaves,
    keywords,
    toneCues,
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
    dedupeKey: shortHash(`${sourceUrl}::${title.toLowerCase()}::${compactWhitespace(rawDescription).toLowerCase()}`),
    parseVersion: "v1a",
    parseStatus: "parsed" as CanonicalJobParseStatus,
    reviewState: resolveCanonicalJobReviewState(reviewItems),
    title,
    company: extractCompany(rawDescription),
    location: extractLocation(rawDescription),
    rawDescription,
    rawLanguageDetected: "en",
    summary:
      compactWhitespace(
        `${title}${rawDescription ? ` role focused on ${extractResponsibilities(rawDescription).slice(0, 2).join(" and ").toLowerCase()}` : ""}`,
      ) || title,
    responsibilities,
    keywords,
    mustHaves,
    toneCues,
    contacts: [] as string[],
    status: "active",
    archivedAt: null as number | null,
    reviewItems,
  };
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
