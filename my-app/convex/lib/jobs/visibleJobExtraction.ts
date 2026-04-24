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

const MAX_SUMMARY_CHARS = 700;
const MAX_REQUIREMENTS = 24;
const MAX_KEYWORDS = 32;

const SCRAPER_METADATA_RE =
  /\b(cookie|cookies|privacy policy|terms of use|sign in|log in|subscribe|newsletter|captcha|javascript|enable cookies|all rights reserved|posted \d+ days ago)\b/i;
const NAVIGATION_TEXT_RE =
  /\b(skip to|main content|navigation|back to search|see more jobs|similar jobs|apply now|save job|share this job)\b/i;
const MARKDOWN_OR_CODE_RE = /```|~~~|^\s{0,3}#{1,6}\s|\[[^\]]+\]\([^)]+\)|<\/?[a-z][\s\S]*>/i;
const RAW_URL_RE = /https?:\/\/|www\./i;
const ENGLISH_TRANSLATION_RE =
  /\b(the role|this role|you will|you'll|will be responsible|requirements include|we are looking for|candidate will|must have|nice to have)\b/i;

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

function hasDisplayData(selection: Omit<VisibleJobExtractionSelection, "source">): boolean {
  return Boolean(selection.summary) || selection.requirements.length > 0 || selection.keywords.length > 0;
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

function violatesKnownLanguageSignal(args: {
  rawLanguageDetected?: string | null;
  values: string[];
}): boolean {
  const language = compactWhitespace(args.rawLanguageDetected).toLowerCase();
  if (!language.startsWith("fr")) {
    return false;
  }

  const joined = args.values.join(" ");
  return ENGLISH_TRANSLATION_RE.test(joined);
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
  const requirements = compactList(args.output.requirements.map((item) => item.value));
  const keywords = compactList(args.output.keywords_canonical);
  const allValues = [summary, ...requirements, ...keywords].filter(Boolean);

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

function toVisibleLlmSelection(output: NormalizedJobExtraction): VisibleJobExtractionSelection {
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
      const parsed = NormalizedJobExtractionSchema.safeParse(row.llm_normalized_output);
      if (!parsed.success) {
        return null;
      }
      return {
        row,
        output: parsed.data,
      };
    })
    .filter((entry): entry is { row: VisibleJobExtractionShadowRow; output: NormalizedJobExtraction } =>
      entry !== null,
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
