import type { NormalizedJobExtraction } from "./jobExtractionSchema";

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

export type NormalizedStructuredJobBriefInput = {
  dateChecked: string;
  contract: unknown;
  schedule: unknown;
  salary: unknown;
  responsibilities: string[];
  mustHaves: string[];
  niceToHaves: string[];
  languageRequirements: string;
  factualCvMatches: string[];
  gapsAndUncertainties: string[];
  excludedCvFacts: string[];
  applicationLanguage: string;
  questionsBeforeDrafting: string[];
};

export type NormalizedJobBriefInput = {
  kind: "url_only" | "pasted_text" | "structured_payload";
  title: string;
  rawDescription: string;
  company: string;
  location: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  applicationUrl: string;
  structuredBrief: NormalizedStructuredJobBriefInput | null;
  unmappedStructuredFields: string[];
};

export type NormalizeJobBriefInputResult =
  | {
      ok: true;
      value: NormalizedJobBriefInput;
    }
  | {
      ok: false;
      code: "job_input_required" | "invalid_job_url";
      message: string;
    };

const MAX_RESPONSIBILITIES = 3;
const MAX_KEYWORDS = 8;
const MAX_MUST_HAVES = 4;
const LOW_CONFIDENCE_REVIEW_THRESHOLD = 0.7;
export type JobPostingLanguage = "en" | "fr" | "es" | "pt" | "it" | "de";

const RESPONSIBILITY_CUE_RE =
  /\b(lead|manage|coordinate|support|build|develop|maintain|execute|own|deliver|drive|run|monitor|analy[sz]e|partner|collaborate|improve|create|oversee|organize|plan)\b/i;
const REQUIREMENT_CUE_RE =
  /\b(must|required|requirements?|qualifications?|experience with|need to|should have|able to|ability to|proficient in|familiar with|expertise in|license[ds]?|certifi(?:ed|cation))\b/i;
const STRONG_REQUIREMENT_CUE_RE =
  /\b(must|required|requirements?|qualifications?)\b/i;
const BOILERPLATE_SENTENCE_RE =
  /\b(is hiring|about the role|about us|join our team|we are looking for|this role)\b/i;
const JOB_LANGUAGE_SIGNAL_PATTERNS: Array<{
  language: Exclude<JobPostingLanguage, "en">;
  patterns: RegExp[];
}> = [
  {
    language: "fr",
    patterns: [
      /\bexp[eé]rience\b/i,
      /\bcomp[eé]tences?\b/i,
      /\bgestion\b/i,
      /\b[eé]quipe\b/i,
      /\btravail\b/i,
      /\bclient[eè]le\b/i,
      /\bcapacit[eé]\b/i,
      /\bformation\b/i,
      /\bdipl[oô]me\b/i,
      /\bposte\b/i,
      /\bprofil\b/i,
      /\bmissions?\b/i,
      /\bcandidature\b/i,
      /\bcontr[oô]le\b/i,
      /\bfinanci[eè]re?\b/i,
      /\bnous recherchons\b/i,
      /\bvous (êtes|serez|avez)\b/i,
    ],
  },
  {
    language: "es",
    patterns: [
      /\bexperiencia\b/i,
      /\bhabilidades?\b/i,
      /\bgesti[oó]n\b/i,
      /\bequipo\b/i,
      /\btrabajo\b/i,
      /\bclientes?\b/i,
      /\bcapacidad\b/i,
      /\beducaci[oó]n\b/i,
      /\bformaci[oó]n\b/i,
      /\bpuesto\b/i,
      /\brequisitos?\b/i,
      /\bresponsabilidades?\b/i,
      /\bdisponibilidad\b/i,
      /\bjornada\b/i,
      /\bse busca\b/i,
      /\bpara trabajar\b/i,
    ],
  },
  {
    language: "pt",
    patterns: [
      /\bexperi[eê]ncia\b/i,
      /\bcompet[eê]ncias?\b/i,
      /\bgest[aã]o\b/i,
      /\bequipe\b/i,
      /\btrabalho\b/i,
      /\bclientes?\b/i,
      /\bcapacidade\b/i,
      /\bforma[cç][aã]o\b/i,
      /\bvaga\b/i,
      /\brequisitos?\b/i,
      /\bresponsabilidades?\b/i,
      /\bdisponibilidade\b/i,
      /\bconhecimentos?\b/i,
      /\bensino\b/i,
      /\bpara trabalhar\b/i,
    ],
  },
  {
    language: "it",
    patterns: [
      /\besperienza\b/i,
      /\bcompetenze?\b/i,
      /\bgestione\b/i,
      /\bsquadra\b/i,
      /\blavoro\b/i,
      /\bclienti\b/i,
      /\bcapacit[aà]\b/i,
      /\bformazione\b/i,
      /\bposizione\b/i,
      /\brequisiti\b/i,
      /\bresponsabilit[aà]\b/i,
      /\bdisponibilit[aà]\b/i,
      /\bconoscenza\b/i,
      /\bper lavorare\b/i,
    ],
  },
  {
    language: "de",
    patterns: [
      /\berfahrung\b/i,
      /\bkenntnisse\b/i,
      /\bf[aä]higkeiten\b/i,
      /\bteam\b/i,
      /\barbeit\b/i,
      /\bkunden\b/i,
      /\bausbildung\b/i,
      /\bstudium\b/i,
      /\bstelle\b/i,
      /\banforderungen\b/i,
      /\baufgaben\b/i,
      /\bverantwortung\b/i,
      /\bverf[uü]gbarkeit\b/i,
      /\bbewerbung\b/i,
      /\bdeutsch\b/i,
    ],
  },
];
const KEYWORD_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "about",
  "above",
  "after",
  "again",
  "all",
  "along",
  "also",
  "am",
  "are",
  "as",
  "at",
  "be",
  "been",
  "before",
  "among",
  "any",
  "being",
  "by",
  "clear",
  "can",
  "de",
  "des",
  "du",
  "el",
  "en",
  "es",
  "et",
  "for",
  "from",
  "have",
  "hiring",
  "in",
  "into",
  "is",
  "it",
  "job",
  "jobs",
  "location",
  "la",
  "las",
  "le",
  "les",
  "los",
  "maintain",
  "must",
  "need",
  "of",
  "on",
  "or",
  "our",
  "over",
  "para",
  "por",
  "role",
  "status",
  "required",
  "responsibilities",
  "the",
  "to",
  "that",
  "their",
  "there",
  "these",
  "this",
  "those",
  "un",
  "una",
  "und",
  "une",
  "will",
  "with",
  "wir",
  "your",
  "zu",
  "zur",
  "compensation",
  "experience",
  "preferred",
  // French function words
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "dans",
  "dela",
  "elle",
  "est",
  "ils",
  "nous",
  "ou",
  "plus",
  "pour",
  "que",
  "qui",
  "sur",
  "vous",
  // Spanish function words
  "al",
  "con",
  "del",
  "esta",
  "este",
  "los",
  "mas",
  "más",
  "que",
  "se",
  "sin",
  "sus",
  "y",
  // German function words
  "auf",
  "das",
  "der",
  "die",
  "ein",
  "eine",
  "für",
  "im",
  "ist",
  "mit",
  "oder",
  "sich",
  "von",
  // Italian function words
  "che",
  "con",
  "dei",
  "del",
  "della",
  "di",
  "e",
  "gli",
  "il",
  "in",
  "lo",
  "per",
  "un",
  "una",
  // Portuguese function words
  "aos",
  "com",
  "da",
  "das",
  "do",
  "dos",
  "em",
  "na",
  "no",
  "nos",
  "os",
  "ou",
  "um",
  "uma",
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

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? compactWhitespace(value) : "";
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const values: string[] = [];
  for (const entry of value) {
    const normalized = readString(entry);
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    values.push(normalized);
  }
  return values;
}

function readFirstValue(
  source: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return undefined;
}

function parseStructuredJobPayload(
  rawDescription: string,
): {
  root: Record<string, unknown>;
  brief: Record<string, unknown>;
} | null {
  const trimmed = rawDescription.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  try {
    const root = readObject(JSON.parse(trimmed));
    if (!root) {
      return null;
    }
    const brief =
      readObject(
        readFirstValue(root, [
          "normalized_job_brief",
          "normalizedJobBrief",
          "job_brief",
          "jobBrief",
        ]),
      ) ?? {};
    const hasRecognizedShape =
      Object.keys(brief).length > 0 ||
      readFirstValue(root, [
        "job_title",
        "jobTitle",
        "employer",
        "source_url",
        "sourceUrl",
      ]) !== undefined;
    return hasRecognizedShape ? { root, brief } : null;
  } catch {
    return null;
  }
}

function normalizeHttpJobUrl(
  value: unknown,
  options: { preserveHash?: boolean } = {},
): { value: string; error: string | null } {
  const raw = readString(value);
  if (!raw) {
    return { value: "", error: null };
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;

  try {
    const url = new URL(candidate);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return { value: "", error: "Job URL must use http or https." };
    }
    if (!options.preserveHash) {
      url.hash = "";
    }
    return { value: url.toString(), error: null };
  } catch {
    return { value: "", error: "Job URL must use http or https." };
  }
}

function deriveUrlOnlyTitle(sourceDomain: string): string {
  return sourceDomain ? `Job from ${sourceDomain}` : "Untitled job";
}

function hasStructuredValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return readString(value).length > 0;
}

export function normalizeJobBriefInput(args: {
  title?: string;
  rawDescription?: string;
  sourceUrl?: string;
  sourceDomain?: string;
  sourceType?: string;
  applicationUrl?: string;
  company?: string;
  location?: string;
}): NormalizeJobBriefInputResult {
  const rawDescription =
    typeof args.rawDescription === "string" ? args.rawDescription.trim() : "";
  const structuredPayload = parseStructuredJobPayload(rawDescription);
  const payloadSourceUrl = structuredPayload
    ? readFirstValue(structuredPayload.root, ["source_url", "sourceUrl"])
    : undefined;
  const normalizedSourceUrl = normalizeHttpJobUrl(
    readString(args.sourceUrl) || payloadSourceUrl,
  );

  if (!rawDescription && normalizedSourceUrl.error) {
    return {
      ok: false,
      code: "invalid_job_url",
      message: normalizedSourceUrl.error,
    };
  }

  if (!rawDescription && !normalizedSourceUrl.value) {
    return {
      ok: false,
      code: "job_input_required",
      message: "Paste a job offer or provide a valid job URL.",
    };
  }

  const sourceUrl = normalizedSourceUrl.value;
  const sourceDomain =
    readString(args.sourceDomain) || extractDomain(sourceUrl);
  const root = structuredPayload?.root ?? {};
  const brief = structuredPayload?.brief ?? {};
  const title =
    readString(args.title) ||
    readString(readFirstValue(root, ["job_title", "jobTitle", "title"])) ||
    (!rawDescription ? deriveUrlOnlyTitle(sourceDomain) : "Untitled job");
  const company =
    readString(args.company) ||
    readString(readFirstValue(root, ["employer", "company"]));
  const location =
    readString(args.location) ||
    readString(readFirstValue(brief, ["location"])) ||
    readString(readFirstValue(root, ["location"]));

  const structuredBrief = structuredPayload
    ? {
        dateChecked: readString(
          readFirstValue(root, ["date_checked", "dateChecked"]),
        ),
        contract: readFirstValue(brief, ["contract"]) ?? null,
        schedule:
          readFirstValue(brief, ["schedule"]) ??
          readFirstValue(readObject(brief.contract) ?? {}, [
            "schedule",
            "working_days",
            "daily_time_range",
          ]) ??
          null,
        salary: readFirstValue(brief, ["salary", "compensation"]) ?? null,
        responsibilities: readStringList(
          readFirstValue(brief, ["responsibilities"]),
        ),
        mustHaves: readStringList(
          readFirstValue(brief, [
            "must_have_requirements",
            "mustHaves",
            "must_haves",
          ]),
        ),
        niceToHaves: readStringList(
          readFirstValue(brief, ["nice_to_haves", "niceToHaves"]),
        ),
        languageRequirements: readString(
          readFirstValue(brief, [
            "language_requirements",
            "languageRequirements",
          ]),
        ),
        factualCvMatches: readStringList(
          readFirstValue(brief, [
            "strongest_factual_matches",
            "factual_cv_matches",
            "factualCvMatches",
          ]) ??
            readFirstValue(root, [
              "cv_facts_to_emphasize",
              "cvFactsToEmphasize",
            ]),
        ),
        gapsAndUncertainties: readStringList(
          readFirstValue(brief, [
            "gaps_and_uncertainties",
            "gapsAndUncertainties",
          ]),
        ),
        excludedCvFacts: readStringList(
          readFirstValue(root, [
            "facts_that_must_not_be_used",
            "factsThatMustNotBeUsed",
          ]) ??
            readFirstValue(brief, [
              "excluded_cv_facts",
              "excludedCvFacts",
            ]),
        ),
        applicationLanguage: readString(
          readFirstValue(root, [
            "application_language",
            "applicationLanguage",
          ]),
        ),
        questionsBeforeDrafting: readStringList(
          readFirstValue(root, [
            "questions_before_drafting",
            "questionsBeforeDrafting",
          ]) ??
            readFirstValue(brief, [
              "questions_before_drafting",
              "questionsBeforeDrafting",
            ]),
        ),
      }
    : null;

  const unmappedStructuredFields = structuredBrief
    ? (
        [
          ["dateChecked", structuredBrief.dateChecked],
          ["contract", structuredBrief.contract],
          ["schedule", structuredBrief.schedule],
          ["salary", structuredBrief.salary],
          ["niceToHaves", structuredBrief.niceToHaves],
          ["languageRequirements", structuredBrief.languageRequirements],
          ["factualCvMatches", structuredBrief.factualCvMatches],
          ["gapsAndUncertainties", structuredBrief.gapsAndUncertainties],
          ["excludedCvFacts", structuredBrief.excludedCvFacts],
          ["applicationLanguage", structuredBrief.applicationLanguage],
          ["questionsBeforeDrafting", structuredBrief.questionsBeforeDrafting],
        ] as const
      )
        .filter(([, value]) => hasStructuredValue(value))
        .map(([field]) => field)
    : [];

  return {
    ok: true,
    value: {
      kind: structuredPayload
        ? "structured_payload"
        : rawDescription
          ? "pasted_text"
          : "url_only",
      title,
      rawDescription,
      company,
      location,
      sourceUrl,
      sourceDomain,
      sourceType: readString(args.sourceType) || "extension",
      applicationUrl: normalizeHttpJobUrl(args.applicationUrl, {
        preserveHash: true,
      }).value,
      structuredBrief,
      unmappedStructuredFields,
    },
  };
}

export function detectJobPostingLanguage(value: string): JobPostingLanguage {
  const text = compactWhitespace(value).toLowerCase();
  if (!text) {
    return "en";
  }

  let bestLanguage: JobPostingLanguage = "en";
  let bestScore = 0;
  for (const group of JOB_LANGUAGE_SIGNAL_PATTERNS) {
    const score = group.patterns.reduce(
      (count, pattern) => count + (pattern.test(text) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestLanguage = group.language;
      bestScore = score;
    }
  }

  return bestScore >= 3 ? bestLanguage : "en";
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

function extractRoleRequirementFromTitle(title: string): CanonicalJobExtraction | null {
  const titleLead = compactWhitespace(title.split("|")[0]?.split(" - ")[0] ?? "");
  if (!titleLead) {
    return null;
  }

  const tokens = titleLead.match(/[A-Za-z0-9+#./-]+/g) ?? [];
  const meaningfulTokens = tokens
    .map(normalizeKeywordToken)
    .filter((token) => token.length >= 3 && !KEYWORD_STOP_WORDS.has(token));

  if (meaningfulTokens.length === 0 || meaningfulTokens.length > 5) {
    return null;
  }

  return toExtraction(titleLead, 0.86, null);
}

function buildMustHavesWithTitleRole(args: {
  title: string;
  rawDescription: string;
}): CanonicalJobExtraction[] {
  const mustHaves = extractMustHaves(args.rawDescription);
  const titleRole = extractRoleRequirementFromTitle(args.title);
  return dedupeExtractions(
    titleRole ? [...mustHaves, titleRole] : mustHaves,
    MAX_MUST_HAVES,
  );
}

function normalizeKeywordToken(value: string): string {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/^[^a-z0-9+#./-]+|[^a-z0-9+#./-]+$/g, "");
}

function buildTitleKeywordTokens(title: string): Set<string> {
  const tokens = new Set<string>();

  for (const match of title.match(/[A-Za-z0-9+#./-]+/g) ?? []) {
    const normalized = normalizeKeywordToken(match);
    if (!normalized) {
      continue;
    }

    tokens.add(normalized);
    for (const part of normalized.split(/[-/]+/)) {
      if (part) {
        tokens.add(part);
      }
    }
  }

  return tokens;
}

function isTitleKeywordToken(
  normalizedValue: string,
  titleKeywordTokens: Set<string>,
): boolean {
  if (titleKeywordTokens.has(normalizedValue)) {
    return true;
  }

  const hyphenParts = normalizedValue.split(/[-/]+/).filter(Boolean);
  return (
    hyphenParts.length > 1 &&
    hyphenParts.every((part) => titleKeywordTokens.has(part))
  );
}

function collectKeywordCandidates(args: {
  title: string;
  rawDescription: string;
  responsibilities: CanonicalJobExtraction[];
  mustHaves: CanonicalJobExtraction[];
}): CanonicalJobExtraction[] {
  const orderedCandidates = new Map<
    string,
    { value: string; confidence: number; sourceSpan: CanonicalJobSourceSpan | null; order: number }
  >();
  const requirementSpans = args.mustHaves.map((item) => item.sourceSpan).filter(Boolean);
  const responsibilitySpans = args.responsibilities
    .map((item) => item.sourceSpan)
    .filter(Boolean);
  const titleKeywordTokens = buildTitleKeywordTokens(args.title);

  const pushCandidate = (
    rawValue: string,
    confidence: number,
    sourceSpan: CanonicalJobSourceSpan | null,
  ) => {
    const normalizedValue = normalizeKeywordToken(rawValue);
    if (
      normalizedValue.length < 3 ||
      KEYWORD_STOP_WORDS.has(normalizedValue) ||
      isTitleKeywordToken(normalizedValue, titleKeywordTokens) ||
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
        order: orderedCandidates.size,
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

  return Array.from(orderedCandidates.values())
    .sort((left, right) => right.confidence - left.confidence || left.order - right.order)
    .map((item) => ({
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

function buildProvidedExtractions(values: string[]): CanonicalJobExtraction[] {
  return values.map((value) => toExtraction(value, 0.55, null));
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
  company?: string;
  location?: string;
}) {
  const now = Date.now();
  const normalizedInput = normalizeJobBriefInput(args);
  if (normalizedInput.ok === false) {
    throw new TypeError(normalizedInput.message);
  }

  const {
    title,
    rawDescription,
    sourceUrl,
    sourceDomain,
    sourceType,
    applicationUrl,
    company: structuredCompany,
    location: structuredLocation,
    structuredBrief,
  } = normalizedInput.value;
  const extractionText = structuredBrief
    ? [
        ...structuredBrief.responsibilities,
        ...structuredBrief.mustHaves,
        ...structuredBrief.niceToHaves,
        structuredBrief.languageRequirements,
      ]
        .filter(Boolean)
        .join(". ")
    : rawDescription;
  const responsibilitiesExtraction = structuredBrief
    ? buildProvidedExtractions(structuredBrief.responsibilities)
    : extractResponsibilities(rawDescription);
  const mustHavesExtraction = structuredBrief
    ? buildProvidedExtractions(structuredBrief.mustHaves)
    : buildMustHavesWithTitleRole({
        title,
        rawDescription,
      });
  const keywordsExtraction = extractKeywords({
    title,
    rawDescription: extractionText,
    responsibilities: responsibilitiesExtraction,
    mustHaves: mustHavesExtraction,
  });
  const toneCuesExtraction = extractToneCues(extractionText);
  const summaryExtraction = extractSummary({
    title,
    rawDescription: extractionText,
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
    sourceType,
    applicationUrl,
    dedupeKey: shortHash(
      `${sourceUrl}::${title.toLowerCase()}::${compactWhitespace(rawDescription).toLowerCase()}`,
    ),
    parseVersion: "v1b",
    parseStatus: (
      rawDescription ? "parsed" : "imported"
    ) as CanonicalJobParseStatus,
    reviewState: rawDescription
      ? structuredBrief
        ? "needs_review"
        : resolveCanonicalJobReviewState(reviewItems)
      : "needs_review",
    title,
    company: structuredCompany || extractCompany(rawDescription),
    location: structuredLocation || extractLocation(rawDescription),
    rawDescription,
    rawLanguageDetected: detectJobPostingLanguage(
      `${title}\n${extractionText}`,
    ),
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
    isFavorite: false,
    status: "active",
    archivedAt: null as number | null,
    reviewItems,
    inputKind: normalizedInput.value.kind,
    unmappedStructuredFields:
      normalizedInput.value.unmappedStructuredFields,
  };
}

export function inferRequirementType(value: string): NormalizedJobExtraction["requirements"][number]["type"] {
  if (/\b(certifi(?:ed|cation)|license[ds]?|guard card|permit)\b/i.test(value)) {
    return "certification";
  }
  if (/\b(degree|diploma|bachelor|master|education)\b/i.test(value)) {
    return "education";
  }
  const normalizedLanguageRequirement = value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "");
  if (
    /\b(language|langue|idioma|lingua|sprache|sprachkenntnisse|bilingual|bilingue|zweisprachig|english|anglais|ingles|inglese|englisch|french|francais|francaise|frances|francese|franzosisch|spanish|espagnol|espagnole|espanol|espanola|spagnolo|spagnola|spanisch|german|allemand|allemande|aleman|alemana|alemao|tedesco|tedesca|deutsch|italian|italien|italienne|italiano|italiana|italienisch|portuguese|portugais|portugaise|portugues|portuguesa|portoghese|portugiesisch)\b/i.test(
      normalizedLanguageRequirement,
    )
  ) {
    return "language";
  }
  if (/\b(shift|schedule|weekend|onsite|standing|availability)\b/i.test(value)) {
    return "constraint";
  }
  if (/\b(tool|software|system|platform|workspace|notion|airtable|excel|google)\b/i.test(value)) {
    return "tool";
  }
  if (/\b(experience|background|years?)\b/i.test(value)) {
    return "experience";
  }
  return "skill";
}

function extractMatchingValues(values: string[], pattern: RegExp): string[] {
  return values.filter((value) => pattern.test(value));
}

export function buildNormalizedJobExtractionFromHeuristic(args: {
  title: string;
  rawDescription: string;
  sourceUrl?: string;
  sourceDomain?: string;
  sourceType?: string;
  applicationUrl?: string;
  company?: string;
  location?: string;
}): NormalizedJobExtraction {
  const draft = buildCanonicalJobDraftFromSource(args);
  const requirementValues = [...draft.mustHaves, ...draft.responsibilities].filter(Boolean);
  const requirements = requirementValues.map((value) => ({
    value,
    type: inferRequirementType(value),
    required: draft.mustHaves.includes(value),
  }));

  return {
    summary_short: draft.summary,
    role_title_normalized: draft.title,
    requirements,
    keywords_canonical: draft.keywords,
    licenses_or_certifications: extractMatchingValues(
      requirementValues,
      /\b(certifi(?:ed|cation)|license[ds]?|guard card|permit)\b/i,
    ),
    schedule_constraints: extractMatchingValues(
      requirementValues,
      /\b(shift|schedule|weekend|availability|full[- ]time|part[- ]time)\b/i,
    ),
    environment: {
      customer_facing: /\b(customer[- ]facing|visitors?|clients?|customers?)\b/i.test(
        draft.rawDescription,
      )
        ? true
        : null,
      retail: /\bretail|store\b/i.test(draft.rawDescription) ? true : null,
      physical_standing: /\bstanding|stand for|physical\b/i.test(draft.rawDescription)
        ? true
        : null,
      onsite: /\bonsite|on-site|in office|store\b/i.test(draft.rawDescription)
        ? true
        : null,
    },
    confidence: requirements.length >= 2 ? "medium" : "low",
  };
}

export function resolveReparsedCompany(args: {
  existingCompany?: string | null;
  parsedCompany?: string | null;
}): string {
  const parsedCompany = compactWhitespace(args.parsedCompany ?? "");
  if (parsedCompany) {
    return parsedCompany;
  }

  return compactWhitespace(args.existingCompany ?? "");
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
