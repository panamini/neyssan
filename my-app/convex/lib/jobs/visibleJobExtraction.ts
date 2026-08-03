import {
  detectJobPostingLanguage,
  resolveCanonicalJobReviewState,
  type CanonicalJobReviewItem,
  type CanonicalJobReviewState,
} from "./canonicalJobs";
import {
  NormalizedJobExtractionSchema,
  type NormalizedJobExtraction,
} from "./jobExtractionSchema";
import { PROMPT_VERSION, resolveJobExtractionModel } from "./llmExtractJob";

export type VisibleJobExtractionSource = "llm" | "heuristic" | "empty";

export type VisibleJobExtractionSelection = {
  source: VisibleJobExtractionSource;
  summary: string | null;
  requirements: string[];
  keywords: string[];
};

export type VisibleJobExtractionShadowRow = {
  llm_normalized_output: unknown;
  validation_status?: string | null;
  fallback_used?: boolean | null;
  model?: string | null;
  prompt_version?: string | null;
  created_at?: number | null;
  _creationTime?: number | null;
};

export function resolveEffectiveJobRawLanguageDetected(job: {
  rawLanguageDetected?: string | null;
  rawDescription?: string | null;
  title?: string | null;
}): string {
  const stored = String(job.rawLanguageDetected ?? "").trim();
  const detected = detectJobPostingLanguage(
    `${job.title ?? ""}\n${job.rawDescription ?? ""}`,
  );
  if (stored.toLowerCase().startsWith("en") && detected !== "en") {
    return detected;
  }
  return stored || detected;
}

type VisibleJobExtractionJob = {
  summary?: string | null;
  summaryExtraction?: { value?: unknown } | null;
  mustHaves?: unknown;
  mustHavesExtraction?: unknown;
  keywords?: unknown;
  keywordsExtraction?: unknown;
};

const MAX_SUMMARY_CHARS = 700;
const MAX_REQUIREMENTS = 24;
const MAX_KEYWORDS = 32;

const SCRAPER_METADATA_RE =
  /\b(cookie|cookies|privacy policy|terms of use|sign in|log in|subscribe|newsletter|captcha|enable javascript|enable cookies|all rights reserved|posted \d+ days ago)\b/i;
const NAVIGATION_TEXT_RE =
  /\b(skip to|main content|navigation|back to search|see more jobs|similar jobs|apply now|save job|share this job)\b/i;
const MARKDOWN_OR_CODE_RE = /```|~~~|^\s{0,3}#{1,6}\s|\[[^\]]+\]\([^)]+\)|<\/?[a-z][\s\S]*>/i;
const RAW_URL_RE = /https?:\/\/|www\./i;
const ENGLISH_TRANSLATION_RE =
  /\b(the role|this role|you will|you'll|will be responsible|requirements include|we are looking for|candidate will|must have|nice to have)\b/i;
const SPANISH_LANGUAGE_SIGNAL_RES = [
  /\beducaci[oó]n\b/i,
  /\bexperiencia\b/i,
  /\bgestión\b/i,
  /\boperaci[oó]n\b/i,
  /\bverificaci[oó]n\b/i,
  /\bdetecci[oó]n\b/i,
  /\bdisponibilidad\b/i,
  /\btrabajar\b/i,
  /\bturnos?\b/i,
  /\bfines de semana\b/i,
  /\bfestivos?\b/i,
  /\bhu[eé]spedes?\b/i,
  /\bseguridad\b/i,
  /\bmonitoreo\b/i,
  /\bantecedentes\b/i,
  /\bprueba de drogas\b/i,
  /\bcapacidad para\b/i,
  /\bconocimiento de\b/i,
  /\bmanejo profesional\b/i,
  /\batenci[oó]n a\b/i,
  /\bpara trabajar\b/i,
  /\bsolo para\b/i,
];
const FRENCH_LANGUAGE_SIGNAL_RES = [
  /\bexp[eé]rience\b/i,
  /\bcomp[eé]tences?\b/i,
  /\bgestion\b/i,
  /\bop[eé]rationnelle\b/i,
  /\bplanification\b/i,
  /\b[eé]quipe\b/i,
  /\btravail\b/i,
  /\bclient[eè]le\b/i,
  /\bs[eé]curit[eé]\b/i,
  /\bcapacit[eé]\b/i,
  /\bconnaissance\b/i,
  /\bdisponibilit[eé]\b/i,
  /\bformation\b/i,
  /\bdipl[oô]me\b/i,
  /\bpermis\b/i,
  /\bcertificat\b/i,
  /\bpour travailler\b/i,
  /\bfin de semaine\b/i,
];
const ITALIAN_LANGUAGE_SIGNAL_RES = [
  /\besperienza\b/i,
  /\bcompetenze?\b/i,
  /\bgestione\b/i,
  /\boperazioni?\b/i,
  /\bsicurezza\b/i,
  /\bclienti\b/i,
  /\bospiti\b/i,
  /\bdisponibilit[aà]\b/i,
  /\bturni\b/i,
  /\bfine settimana\b/i,
  /\bfestivi\b/i,
  /\bistruzione\b/i,
  /\bdiploma\b/i,
  /\bconoscenza\b/i,
  /\bcapacit[aà] di\b/i,
  /\bper lavorare\b/i,
];
const PORTUGUESE_LANGUAGE_SIGNAL_RES = [
  /\bexperi[eê]ncia\b/i,
  /\bcompet[eê]ncias?\b/i,
  /\bgest[aã]o\b/i,
  /\bopera[cç][aã]o\b/i,
  /\bseguran[cç]a\b/i,
  /\bclientes\b/i,
  /\bh[oó]spedes\b/i,
  /\bdisponibilidade\b/i,
  /\bturnos?\b/i,
  /\bfins de semana\b/i,
  /\bferiados\b/i,
  /\bensino\b/i,
  /\bdiploma\b/i,
  /\bconhecimento\b/i,
  /\bcapacidade de\b/i,
  /\bpara trabalhar\b/i,
];
const GERMAN_LANGUAGE_SIGNAL_RES = [
  /\berfahrung\b/i,
  /\bf[aä]higkeiten\b/i,
  /\bkenntnisse\b/i,
  /\bverwaltung\b/i,
  /\bbetrieb\b/i,
  /\bsicherheit\b/i,
  /\bkunden\b/i,
  /\bg[aä]ste\b/i,
  /\bverf[uü]gbarkeit\b/i,
  /\bschichten\b/i,
  /\bwochenenden\b/i,
  /\bfeiertage\b/i,
  /\bschulabschluss\b/i,
  /\bausbildung\b/i,
  /\bf[aä]higkeit\b/i,
  /\bf[uü]r die arbeit\b/i,
];
const MIN_LANGUAGE_SIGNAL_MATCHES = 2;
const LANGUAGE_SIGNAL_GROUPS = [
  { language: "es", patterns: SPANISH_LANGUAGE_SIGNAL_RES },
  { language: "fr", patterns: FRENCH_LANGUAGE_SIGNAL_RES },
  { language: "it", patterns: ITALIAN_LANGUAGE_SIGNAL_RES },
  { language: "pt", patterns: PORTUGUESE_LANGUAGE_SIGNAL_RES },
  { language: "de", patterns: GERMAN_LANGUAGE_SIGNAL_RES },
] as const;

type SupportedSourceLanguage =
  | "en"
  | (typeof LANGUAGE_SIGNAL_GROUPS)[number]["language"];

function compactWhitespace(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compactList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const text = compactWhitespace(value);
    if (!text) {
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(text);
  }
  return result;
}

function hasDisplayData(
  selection: Omit<VisibleJobExtractionSelection, "source">,
): boolean {
  return (
    Boolean(selection.summary) ||
    selection.requirements.length > 0 ||
    selection.keywords.length > 0
  );
}

function includesUnsafeText(values: string[]): boolean {
  return values.some((value) => {
    const text = compactWhitespace(value);
    return (
      MARKDOWN_OR_CODE_RE.test(text) ||
      RAW_URL_RE.test(text) ||
      SCRAPER_METADATA_RE.test(text) ||
      NAVIGATION_TEXT_RE.test(text)
    );
  });
}

function hasRepeatedHeading(values: string[]): boolean {
  const headings = new Map<string, number>();
  for (const value of values) {
    const key = compactWhitespace(value)
      .replace(/[:.]+$/g, "")
      .toLowerCase();
    if (!key) {
      continue;
    }
    headings.set(key, (headings.get(key) ?? 0) + 1);
  }
  return [...headings.values()].some((count) => count > 2);
}

function isMostlyFiller(value: string): boolean {
  const words = compactWhitespace(value).toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return false;
  }

  const fillerWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "be",
    "for",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
    "you",
    "your",
  ]);
  const fillerCount = words.filter((word) => fillerWords.has(word)).length;
  return fillerCount / words.length > 0.72;
}

function hasConfidentLanguageSignal(
  value: string,
  patterns: RegExp[],
): boolean {
  let matches = 0;
  for (const pattern of patterns) {
    if (pattern.test(value)) {
      matches += 1;
    }
    if (matches >= MIN_LANGUAGE_SIGNAL_MATCHES) {
      return true;
    }
  }
  return false;
}

function resolveSupportedSourceLanguage(
  value: unknown,
): SupportedSourceLanguage | null {
  const language = compactWhitespace(value).toLowerCase();
  if (language.startsWith("en")) {
    return "en";
  }
  for (const group of LANGUAGE_SIGNAL_GROUPS) {
    if (language.startsWith(group.language)) {
      return group.language;
    }
  }
  return null;
}

function hasDifferentSupportedLanguageSignal(
  value: string,
  sourceLanguage: SupportedSourceLanguage,
): boolean {
  return LANGUAGE_SIGNAL_GROUPS.some(
    (group) =>
      group.language !== sourceLanguage &&
      hasConfidentLanguageSignal(value, group.patterns),
  );
}

function violatesKnownLanguageSignal(args: {
  rawLanguageDetected?: string | null;
  values: string[];
}): boolean {
  const sourceLanguage = resolveSupportedSourceLanguage(
    args.rawLanguageDetected,
  );
  if (!sourceLanguage) {
    return false;
  }

  const joined = args.values.join(" ");
  const hasDifferentLanguageSignal = hasDifferentSupportedLanguageSignal(
    joined,
    sourceLanguage,
  );
  if (sourceLanguage === "en") {
    return hasDifferentLanguageSignal;
  }
  return ENGLISH_TRANSLATION_RE.test(joined) || hasDifferentLanguageSignal;
}

export function isJobLlmVisibleExtractionEnabled(
  rawValue: string | undefined =
    process.env.JOB_LLM_VISIBLE_EXTRACTION ??
    process.env.ENABLE_JOB_LLM_VISIBLE_EXTRACTION,
): boolean {
  const normalized = compactWhitespace(rawValue).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

export function isUiSafeVisibleJobExtraction(args: {
  output: NormalizedJobExtraction;
  heuristicRequirements?: string[];
  rawLanguageDetected?: string | null;
}): boolean {
  const summary = compactWhitespace(args.output.summary_short);
  const requirements = compactList(
    args.output.requirements.map((item) => item.value),
  );
  const keywords = compactList(args.output.keywords_canonical);
  const licensesOrCertifications = compactList(
    args.output.licenses_or_certifications,
  );
  const scheduleConstraints = compactList(args.output.schedule_constraints);
  const allValues = [
    summary,
    ...requirements,
    ...keywords,
    ...licensesOrCertifications,
    ...scheduleConstraints,
  ].filter(Boolean);

  if (!summary || summary.length > MAX_SUMMARY_CHARS) {
    return false;
  }
  if ((args.heuristicRequirements?.length ?? 0) > 0 && requirements.length === 0) {
    return false;
  }
  if (requirements.length > MAX_REQUIREMENTS || keywords.length > MAX_KEYWORDS) {
    return false;
  }
  if (includesUnsafeText(allValues) || hasRepeatedHeading(requirements)) {
    return false;
  }
  if (isMostlyFiller(summary) || requirements.some(isMostlyFiller)) {
    return false;
  }
  if (
    violatesKnownLanguageSignal({
      rawLanguageDetected: args.rawLanguageDetected,
      values: allValues,
    })
  ) {
    return false;
  }

  return true;
}

function buildHeuristicSelection(args: {
  summary?: string | null;
  requirements?: unknown;
  keywords?: unknown;
}): VisibleJobExtractionSelection {
  const selection = {
    summary: compactWhitespace(args.summary) || null,
    requirements: compactList(args.requirements),
    keywords: compactList(args.keywords),
  };

  return {
    source: hasDisplayData(selection) ? "heuristic" : "empty",
    ...selection,
  };
}

function toVisibleLlmSelection(
  output: NormalizedJobExtraction,
): VisibleJobExtractionSelection {
  return {
    source: "llm",
    summary: compactWhitespace(output.summary_short) || null,
    requirements: compactList(output.requirements.map((item) => item.value)),
    keywords: compactList(output.keywords_canonical),
  };
}

export function selectVisibleJobExtraction(args: {
  flagEnabled?: boolean;
  shadowRows?: VisibleJobExtractionShadowRow[];
  heuristic: {
    summary?: string | null;
    requirements?: unknown;
    keywords?: unknown;
  };
  rawLanguageDetected?: string | null;
  model?: string;
  promptVersion?: string;
}): VisibleJobExtractionSelection {
  const heuristicSelection = buildHeuristicSelection(args.heuristic);
  if (!args.flagEnabled) {
    return heuristicSelection;
  }

  const model = args.model ?? resolveJobExtractionModel();
  const promptVersion = args.promptVersion ?? PROMPT_VERSION;
  const candidates = (args.shadowRows ?? [])
    .filter((row) => row.model === model)
    .filter((row) => row.prompt_version === promptVersion)
    .filter((row) => row.validation_status === "valid")
    .filter((row) => row.fallback_used === false)
    .map((row) => {
      const parsed = NormalizedJobExtractionSchema.safeParse(
        row.llm_normalized_output,
      );
      if (!parsed.success) {
        return null;
      }
      return {
        row,
        output: parsed.data,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        row: VisibleJobExtractionShadowRow;
        output: NormalizedJobExtraction;
      } => entry !== null,
    )
    .sort((left, right) => {
      const leftCreated = left.row.created_at ?? left.row._creationTime ?? 0;
      const rightCreated = right.row.created_at ?? right.row._creationTime ?? 0;
      return rightCreated - leftCreated;
    });

  const winner = candidates[0] ?? null;
  if (
    !winner ||
    !isUiSafeVisibleJobExtraction({
      output: winner.output,
      heuristicRequirements: heuristicSelection.requirements,
      rawLanguageDetected: args.rawLanguageDetected,
    })
  ) {
    return heuristicSelection;
  }

  return toVisibleLlmSelection(winner.output);
}

function compactExtractionValues(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return compactList(
    value.map((entry) =>
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as { value?: unknown }).value
        : entry,
    ),
  );
}

export function selectVisibleJobExtractionForJob(args: {
  job: VisibleJobExtractionJob;
  shadowRows?: VisibleJobExtractionShadowRow[];
  flagEnabled?: boolean;
  rawLanguageDetected?: string | null;
  model?: string;
  promptVersion?: string;
}): VisibleJobExtractionSelection {
  const canonicalRequirements = compactExtractionValues(args.job.mustHaves);
  const canonicalKeywords = compactExtractionValues(args.job.keywords);
  const extractedRequirements = compactExtractionValues(
    args.job.mustHavesExtraction,
  );
  const extractedKeywords = compactExtractionValues(
    args.job.keywordsExtraction,
  );
  return selectVisibleJobExtraction({
    flagEnabled: args.flagEnabled,
    shadowRows: args.shadowRows,
    heuristic: {
      summary:
        typeof args.job.summary === "string"
          ? args.job.summary
          : typeof args.job.summaryExtraction?.value === "string"
            ? args.job.summaryExtraction.value
            : null,
      requirements: Array.isArray(args.job.mustHaves)
        ? canonicalRequirements
        : extractedRequirements,
      keywords: Array.isArray(args.job.keywords)
        ? canonicalKeywords
        : extractedKeywords,
    },
    rawLanguageDetected: args.rawLanguageDetected,
    model: args.model,
    promptVersion: args.promptVersion,
  });
}

export function projectReviewItemsWithVisibleExtraction(args: {
  reviewItems: CanonicalJobReviewItem[];
  visibleExtraction: VisibleJobExtractionSelection;
}): CanonicalJobReviewItem[] {
  if (args.visibleExtraction.source !== "llm") {
    return args.reviewItems;
  }

  const allowedReviewItems = args.reviewItems.filter(
    (item) => item.fieldKey !== "responsibilities",
  );

  const buildReviewItem = (input: {
    id: string;
    fieldKey: string;
    label: string;
    suggestedValue: string | string[];
  }): CanonicalJobReviewItem => {
    const existing = allowedReviewItems.find(
      (item) => item.fieldKey === input.fieldKey,
    );
    const sourceSuggestionUnchanged =
      existing?.reviewStatus === "approved" &&
      JSON.stringify(existing.suggestedValue) ===
        JSON.stringify(input.suggestedValue);
    return {
      ...(existing ?? {}),
      id: existing?.id ?? input.id,
      fieldKey: input.fieldKey,
      label: existing?.label ?? input.label,
      reviewStatus: sourceSuggestionUnchanged ? "approved" : "pending",
      suggestedValue: input.suggestedValue,
      ...(sourceSuggestionUnchanged
        ? { approvedValue: existing.approvedValue }
        : { approvedValue: undefined }),
      sourceText: Array.isArray(input.suggestedValue)
        ? input.suggestedValue.join("\n")
        : input.suggestedValue,
      confidence: Math.max(Number(existing?.confidence ?? 0), 0.9),
      updatedAt:
        typeof existing?.updatedAt === "number" ? existing.updatedAt : 0,
    };
  };

  return [
    ...(args.visibleExtraction.summary
      ? [
          buildReviewItem({
            id: "llm_visible_summary",
            fieldKey: "summary",
            label: "Summary",
            suggestedValue: args.visibleExtraction.summary,
          }),
        ]
      : []),
    ...(args.visibleExtraction.requirements.length > 0
      ? [
          buildReviewItem({
            id: "llm_visible_must_haves",
            fieldKey: "mustHaves",
            label: "Requirements",
            suggestedValue: args.visibleExtraction.requirements,
          }),
        ]
      : []),
    ...(args.visibleExtraction.keywords.length > 0
      ? [
          buildReviewItem({
            id: "llm_visible_keywords",
            fieldKey: "keywords",
            label: "Keywords",
            suggestedValue: args.visibleExtraction.keywords,
          }),
        ]
      : []),
  ];
}

export function resolveVisibleJobBriefReviewState(args: {
  reviewItems: CanonicalJobReviewItem[];
  visibleExtraction: VisibleJobExtractionSelection;
}): CanonicalJobReviewState {
  if (args.visibleExtraction.source === "empty") {
    return "needs_review";
  }
  return resolveCanonicalJobReviewState(
    projectReviewItemsWithVisibleExtraction(args),
  );
}
