export type VisibleMissingRequirementsInput = {
  missing: string[];
  visibleRequirements?: string[];
  jobTitle?: string | null;
  jobCompany?: string | null;
  jobLocation?: string | null;
};

const MAX_VISIBLE_MISSING_CHARS = 80;
const MAX_VISIBLE_MISSING_WORDS = 10;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "job",
  "jobs",
  "location",
  "of",
  "on",
  "or",
  "our",
  "part",
  "part-time",
  "parttime",
  "pay",
  "status",
  "the",
  "this",
  "to",
  "with",
  "company",
  "compensation",
  "benefits",
  "salary",
  "role",
]);

const SCRAPE_METADATA_RE =
  /\b(cookie|cookies|privacy policy|terms of use|sign in|log in|apply now|skip to|navigation|search jobs|share this job|all rights reserved|posted \d+ days ago)\b/i;
const LEGAL_RE =
  /\b(equal opportunity|eeo|reasonable accommodation|protected veteran|disability|background check|non[- ]discrimination)\b/i;
const BENEFITS_RE =
  /\b(benefits?|medical|dental|vision|401k|retirement|pto|paid time off|insurance|wellness|perks?)\b/i;
const COMPENSATION_RE =
  /\b(salary|compensation|pay|wage|hourly|annual(?:ly)?|annually|bonus|equity|commission)\b/i;
const SCHEDULE_RE = /\bpart[- ]time\b/i;
const LOCATION_RE =
  /\b(location|remote|hybrid|onsite|on-site|relocation|travel|commute|nationwide|worldwide|anywhere|local)\b/i;
const HEADING_RE =
  /\b(responsibilities?|requirements?|qualifications?|benefits?|about the role|about us|what you(?:'|’)ll do|what you will do)\b/i;
const STANDALONE_CONTAINER_TERMS = new Set(["store"]);
const LOCATION_FRAGMENT_TERMS = new Set(["district"]);

function compactWhitespace(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripLeadingMarkers(value: string): string {
  return compactWhitespace(value).replace(/^[•*-]+\s*/, "");
}

function stripTrailingPunctuation(value: string): string {
  return compactWhitespace(value).replace(/[.;:,!?]+$/g, "");
}

function normalizeForMatch(value: string): string {
  return stripTrailingPunctuation(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeForMatch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function isStopwordOnly(value: string): boolean {
  const tokens = tokenize(value);
  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => STOP_WORDS.has(token));
}

function isTooLong(value: string): boolean {
  const tokens = tokenize(value);
  return value.length > MAX_VISIBLE_MISSING_CHARS || tokens.length > MAX_VISIBLE_MISSING_WORDS;
}

function isContextNoise(value: string, context: string[]): boolean {
  const normalizedValue = normalizeForMatch(value);
  return context.some((item) => {
    if (!item) {
      return false;
    }

    const normalizedItem = normalizeForMatch(item);
    return (
      Boolean(normalizedItem) &&
      (normalizedValue === normalizedItem ||
        normalizedValue.includes(normalizedItem) ||
        normalizedItem.includes(normalizedValue))
    );
  });
}

function buildMissingContextSignals(missing: string[], context: string[]) {
  const missingTokens = new Set(missing.flatMap((item) => tokenize(item)));
  const contextTokens = new Set(context.flatMap((item) => tokenize(item)));
  const hasLocationTokenInContext = [...missingTokens].some((token) =>
    contextTokens.has(token),
  );
  const looksLikeLocationMetadataCluster =
    (missingTokens.has("location") || hasLocationTokenInContext) &&
    (missingTokens.has("district") || missingTokens.has("store"));

  return {
    looksLikeLocationMetadataCluster,
  };
}

function isLocationDerivedFragment(value: string, args: {
  looksLikeLocationMetadataCluster: boolean;
}): boolean {
  const tokens = tokenize(value);
  if (tokens.length !== 1) {
    return false;
  }

  const [token] = tokens;
  if (STANDALONE_CONTAINER_TERMS.has(token)) {
    return true;
  }

  if (LOCATION_FRAGMENT_TERMS.has(token)) {
    return true;
  }

  return args.looksLikeLocationMetadataCluster && token === "design";
}

function isJunkCandidate(
  value: string,
  context: string[],
  missingSignals: ReturnType<typeof buildMissingContextSignals>,
): boolean {
  const normalized = compactWhitespace(value);
  if (!normalized) {
    return true;
  }

  if (isTooLong(normalized)) {
    return true;
  }

  if (SCRAPE_METADATA_RE.test(normalized)) {
    return true;
  }

  if (LEGAL_RE.test(normalized)) {
    return true;
  }

  if (BENEFITS_RE.test(normalized)) {
    return true;
  }

  if (COMPENSATION_RE.test(normalized)) {
    return true;
  }

  if (SCHEDULE_RE.test(normalized)) {
    return true;
  }

  if (LOCATION_RE.test(normalized)) {
    return true;
  }

  if (HEADING_RE.test(normalized)) {
    return true;
  }

  if (isStopwordOnly(normalized)) {
    return true;
  }

  if (isContextNoise(normalized, context)) {
    return true;
  }

  if (isLocationDerivedFragment(normalized, missingSignals)) {
    return true;
  }

  return false;
}

function buildVisibleRequirementLookup(visibleRequirements: string[] = []) {
  const lookup = new Map<string, string>();
  for (const requirement of visibleRequirements) {
    const normalized = normalizeForMatch(requirement);
    if (!normalized || lookup.has(normalized)) {
      continue;
    }
    lookup.set(normalized, stripTrailingPunctuation(requirement));
  }
  return lookup;
}

export function selectVisibleMissingRequirements(
  input: VisibleMissingRequirementsInput,
): string[] {
  const visibleRequirementLookup = buildVisibleRequirementLookup(
    input.visibleRequirements ?? [],
  );
  const context = [input.jobTitle, input.jobCompany, input.jobLocation]
    .filter((value): value is string => Boolean(value))
    .map((value) => String(value));
  const missingSignals = buildMissingContextSignals(input.missing ?? [], context);

  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawItem of input.missing ?? []) {
    const candidate = stripLeadingMarkers(rawItem);
    if (!candidate) {
      continue;
    }

    const normalized = normalizeForMatch(candidate);
    const mapped = visibleRequirementLookup.get(normalized) ?? candidate;
    if (isJunkCandidate(mapped, context, missingSignals)) {
      continue;
    }

    const dedupeKey = normalizeForMatch(mapped);
    if (!dedupeKey || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(stripTrailingPunctuation(mapped));
  }

  return result;
}
