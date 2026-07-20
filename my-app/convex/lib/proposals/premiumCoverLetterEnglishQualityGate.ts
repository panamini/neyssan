import type {
  ClaimPlanSection,
  ClaimPlanV1,
  FactGraphV1,
  JobDemandGraphV1,
  PremiumWriterOutputV1,
} from "./premiumCoverLetter";
import {
  canonicalizePremiumCoverLetterNoun,
  canonicalizePremiumCoverLetterToken,
  normalizePremiumCoverLetterNumericToken,
} from "./premiumCoverLetterTokenNormalization";

const ENGLISH_CV_BACKED_SECTIONS: readonly ClaimPlanSection[] = [
  "opening",
  "proofBlock",
  "employerValueBlock",
  "closeLine",
];

export type EnglishCvBackedQualityGateIssueCode =
  | "incomplete_sentence"
  | "missing_employer_value"
  | "missing_close_line"
  | "missing_fact_reference"
  | "unexpected_writer_reuse"
  | "duplicate_visible_sentence"
  | "duplicate_visible_metric"
  | "unsupported_visible_metric"
  | "fact_not_allowed_for_section"
  | "unknown_fact_reference"
  | "employer_value_not_grounded"
  | "missing_claim_reference"
  | "unknown_claim_reference"
  | "claim_reference_mismatch";

export type EnglishCvBackedQualityGateIssue = Readonly<{
  code: EnglishCvBackedQualityGateIssueCode;
  section?: ClaimPlanSection;
  otherSection?: ClaimPlanSection;
  factId?: string;
  metric?: string;
}>;

export type EnglishCvBackedQualityGateObservation = Readonly<{
  code: "intentional_claim_overlap";
  section: ClaimPlanSection;
  otherSection: ClaimPlanSection;
  factId: string;
}>;

export type EnglishCvBackedQualityGateAnalysis = Readonly<{
  issues: EnglishCvBackedQualityGateIssue[];
  observations: EnglishCvBackedQualityGateObservation[];
}>;

const EVIDENCE_ANCHOR_STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "bring",
  "could",
  "experience",
  "experiences",
  "clear",
  "effective",
  "excellent",
  "experienced",
  "from",
  "have",
  "into",
  "more",
  "organized",
  "proven",
  "reliable",
  "skilled",
  "solid",
  "strong",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "team",
  "teams",
  "with",
  "work",
  "worked",
  "would",
  "your",
]);
const EVIDENCE_IRREGULAR_ACTION_WORDS = new Set([
  "built",
  "brought",
  "drove",
  "grew",
  "led",
  "made",
  "oversaw",
  "ran",
  "sought",
  "taught",
  "won",
  "wrote",
]);

function isEvidenceActionWord(value: string): boolean {
  return (
    EVIDENCE_IRREGULAR_ACTION_WORDS.has(value) ||
    (value.length > 4 && value.endsWith("ed"))
  );
}

const METRIC_MEASUREMENT_STOP_WORDS = new Set([
  "a",
  "across",
  "after",
  "am",
  "and",
  "an",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "because",
  "before",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "during",
  "experience",
  "for",
  "from",
  "had",
  "has",
  "have",
  "if",
  "in",
  "is",
  "may",
  "might",
  "must",
  "once",
  "of",
  "over",
  "per",
  "shall",
  "should",
  "since",
  "than",
  "that",
  "the",
  "to",
  "under",
  "was",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "would",
  "were",
]);
const METRIC_MEASUREMENT_ALIASES = new Map([
  ["customer", "client"],
]);
type MetricCurrency =
  | "usd"
  | "eur"
  | "gbp"
  | "cad"
  | "aud"
  | "nzd"
  | "sgd"
  | "hkd";

const METRIC_CURRENCIES = new Map<string, MetricCurrency>([
  ["$", "usd"],
  ["aud", "aud"],
  ["cad", "cad"],
  ["hkd", "hkd"],
  ["nzd", "nzd"],
  ["sgd", "sgd"],
  ["dollar", "usd"],
  ["dollars", "usd"],
  ["usd", "usd"],
  ["€", "eur"],
  ["euro", "eur"],
  ["euros", "eur"],
  ["eur", "eur"],
  ["£", "gbp"],
  ["pound", "gbp"],
  ["pounds", "gbp"],
  ["gbp", "gbp"],
]);
const NUMERIC_MAGNITUDE_MULTIPLIERS = new Map<string, number>([
  ["k", 1_000],
  ["thousand", 1_000],
  ["m", 1_000_000],
  ["mm", 1_000_000],
  ["mn", 1_000_000],
  ["million", 1_000_000],
  ["b", 1_000_000_000],
  ["bn", 1_000_000_000],
  ["billion", 1_000_000_000],
]);
const PERCENTAGE_DIRECTIONS = new Map<string, "increase" | "decrease">([
  ["boost", "increase"],
  ["boosted", "increase"],
  ["boosts", "increase"],
  ["expand", "increase"],
  ["expanded", "increase"],
  ["expands", "increase"],
  ["grew", "increase"],
  ["grow", "increase"],
  ["grown", "increase"],
  ["grows", "increase"],
  ["improve", "increase"],
  ["improved", "increase"],
  ["improves", "increase"],
  ["increase", "increase"],
  ["increased", "increase"],
  ["increases", "increase"],
  ["lift", "increase"],
  ["lifted", "increase"],
  ["lifts", "increase"],
  ["raise", "increase"],
  ["raised", "increase"],
  ["raises", "increase"],
  ["rise", "increase"],
  ["risen", "increase"],
  ["rises", "increase"],
  ["rose", "increase"],
  ["cut", "decrease"],
  ["cuts", "decrease"],
  ["decline", "decrease"],
  ["declined", "decrease"],
  ["declines", "decrease"],
  ["decrease", "decrease"],
  ["decreased", "decrease"],
  ["decreases", "decrease"],
  ["drop", "decrease"],
  ["dropped", "decrease"],
  ["drops", "decrease"],
  ["fall", "decrease"],
  ["fallen", "decrease"],
  ["falls", "decrease"],
  ["fell", "decrease"],
  ["lower", "decrease"],
  ["lowered", "decrease"],
  ["lowers", "decrease"],
  ["reduce", "decrease"],
  ["reduced", "decrease"],
  ["reduces", "decrease"],
  ["shrink", "decrease"],
  ["shrinks", "decrease"],
  ["shrunk", "decrease"],
]);
const PERCENTAGE_NOMINAL_DIRECTIONS = new Map<
  string,
  "increase" | "decrease"
>([
  ["gain", "increase"],
  ["growth", "increase"],
  ["improvement", "increase"],
  ["increase", "increase"],
  ["lift", "increase"],
  ["decline", "decrease"],
  ["decrease", "decrease"],
  ["drop", "decrease"],
  ["reduction", "decrease"],
]);
const GENERIC_PERCENTAGE_MEASUREMENTS = new Set([
  "change",
  "decrease",
  "gain",
  "growth",
  "improvement",
  "increase",
  "lift",
  "reduction",
  "result",
]);
const GENERIC_SINGLE_EVIDENCE_ANCHORS = new Set([
  "communication",
  "coordinate",
  "delivery",
  "discipline",
  "handoff",
  "operate",
  "process",
  "report",
  "support",
  "workflow",
]);
const VERB_LED_FRAGMENT_PATTERN =
  /^(?:managed|maintained|documented|coordinated|reduced|tracked|supported|handled|worked|led|built|improved|created|reported)\b/u;
const FINITE_PREDICATE_TOKENS = new Set([
  "am",
  "are",
  "be",
  "been",
  "being",
  "built",
  "can",
  "could",
  "depend",
  "did",
  "do",
  "does",
  "drive",
  "enable",
  "ensure",
  "evolve",
  "grow",
  "grew",
  "had",
  "has",
  "have",
  "help",
  "is",
  "keep",
  "led",
  "matter",
  "may",
  "might",
  "must",
  "remain",
  "scale",
  "shall",
  "should",
  "sustain",
  "strengthen",
  "translate",
  "was",
  "were",
  "will",
  "would",
]);
const FINITE_PREDICATE_BLOCKERS = new Set([
  "across",
  "and",
  "as",
  "at",
  "by",
  "delivery",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "over",
  "through",
  "to",
  "under",
  "with",
]);
const PREPOSITIONAL_FRAGMENT_STARTERS = new Set([
  "across",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "over",
  "through",
  "to",
  "under",
  "with",
]);
const FINITE_PREDICATE_SUBJECT_TOKENS = new Set([
  "he",
  "i",
  "it",
  "she",
  "that",
  "they",
  "we",
  "which",
  "who",
  "you",
]);
const FINITE_PREDICATE_SUBJECT_DETERMINERS = new Set([
  "a",
  "an",
  "her",
  "his",
  "its",
  "my",
  "our",
  "the",
  "their",
  "this",
  "your",
]);
const WRITTEN_NUMBER_UNITS = new Map([
  ["zero", 0],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
  ["thirteen", 13],
  ["fourteen", 14],
  ["fifteen", 15],
  ["sixteen", 16],
  ["seventeen", 17],
  ["eighteen", 18],
  ["nineteen", 19],
]);
const WRITTEN_NUMBER_TENS = new Map([
  ["twenty", 20],
  ["thirty", 30],
  ["forty", 40],
  ["fifty", 50],
  ["sixty", 60],
  ["seventy", 70],
  ["eighty", 80],
  ["ninety", 90],
]);
const WRITTEN_NUMBER_SCALES = new Map([
  ["hundred", 100],
  ["thousand", 1_000],
  ["million", 1_000_000],
  ["billion", 1_000_000_000],
]);
const WRITTEN_NUMBER_PATTERN =
  /\b((?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|and)(?:[-\s]+)){0,6}(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion))(?:\s+(percent)\b)?/giu;
const NON_QUANTITATIVE_HYPHENATED_NUMBER_PATTERN =
  /\b(?:one-on-one|one-to-one|two-way)\b/giu;
const NON_QUANTITATIVE_WRITTEN_NUMBER_PHRASE_PATTERN =
  /\b(?:as\s+one\s+(?:team|unit)|one\s+source\s+of\s+truth)\b/giu;
const NON_QUANTITATIVE_WRITTEN_NUMBER_MEASUREMENTS = new Set([
  "advantage",
  "benefit",
  "contribution",
  "example",
  "point",
  "priority",
  "reason",
  "specific",
  "strength",
  "thing",
  "things",
  "way",
]);

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeSentenceKey(value: string): string {
  return normalizeText(value)
    .replace(/^["'“‘«([{]+/u, "")
    .replace(/[.!?]+(?:["'”’»)\]}]+)?$/u, "")
    .trim();
}

type SentenceRange = Readonly<{
  text: string;
  start: number;
  end: number;
}>;

const TITLE_PERIOD_ABBREVIATION_PATTERN =
  /\b(?:dr|mr|mrs|ms|prof|sr|jr|st|no|fig)\.$/iu;
const CONTEXTUAL_PERIOD_ABBREVIATION_PATTERN =
  /\b(?:etc|vs|approx|dept|co|corp|inc|ltd|llc|plc|gmbh|e\.g|i\.e|u\.s|u\.k)\.$/iu;
const DOTTED_INITIALISM_CONTINUATION_PATTERN = /\b(?:[A-Z]\.){2,}$/u;
const DOTTED_INITIALISM_ENTITY_PREFIX_PATTERN =
  /\b(?:at|for|from|to|with|joined|consulted)\s+(?:[A-Z]\.){2,}$/u;
const LOWERCASE_STYLED_SENTENCE_STARTERS = new Set(["npm"]);

function startsWithLowercaseStyledProperNoun(value: string): boolean {
  const token =
    value
      .trimStart()
      .match(/^[A-Za-z][A-Za-z0-9+#.-]*/u)?.[0] ?? "";
  return (
    /^[a-z]+[A-Z]/u.test(token) ||
    LOWERCASE_STYLED_SENTENCE_STARTERS.has(token.toLowerCase())
  );
}

function continuesContextualAbbreviation(args: {
  textThroughPunctuation: string;
  remainingText: string;
}): boolean {
  if (/\b(?:e\.g|i\.e)\.$/iu.test(args.textThroughPunctuation)) return true;
  return (
    /\b(?:u\.s|u\.k)\.$/iu.test(args.textThroughPunctuation) &&
    /^\s*(?:Bank|Bancorp|Airways|Airlines|Army|Navy|Department|Government|Steel)\b/u.test(
      args.remainingText,
    )
  );
}

function continuesDottedInitialism(args: {
  textThroughPunctuation: string;
  remainingText: string;
}): boolean {
  if (
    !DOTTED_INITIALISM_CONTINUATION_PATTERN.test(
      args.textThroughPunctuation,
    )
  ) {
    return false;
  }
  return (
    (DOTTED_INITIALISM_ENTITY_PREFIX_PATTERN.test(
      args.textThroughPunctuation,
    ) &&
      /^\s*[A-Z][A-Za-z]+\b/u.test(args.remainingText)) ||
    /^\s*[A-Z][A-Za-z]+\s+[A-Z][A-Za-z]+\b/u.test(args.remainingText)
  );
}

function isContextualPeriodSentenceBoundary(args: {
  textThroughPunctuation: string;
  remainingText: string;
  nextCharacter: string;
}): boolean {
  if (continuesContextualAbbreviation(args)) return false;
  return (
    /[\p{Lu}\p{N}"'“‘(]/u.test(args.nextCharacter) ||
    startsWithLowercaseStyledProperNoun(args.remainingText)
  );
}

function buildSentenceRange(
  value: string,
  start: number,
  end: number,
): SentenceRange | null {
  const surface = value.slice(start, end);
  const text = surface.trim();
  if (!text) return null;
  return {
    text,
    start: start + (surface.match(/^\s*/u)?.[0].length ?? 0),
    end,
  };
}

function isSentenceBoundary(args: {
  value: string;
  match: RegExpMatchArray;
  start: number;
}): boolean {
  const matchIndex = args.match.index ?? args.start;
  const end = matchIndex + args.match[0].length;
  const nextCharacter = args.value.slice(end).match(/\S/u)?.[0];
  if (!nextCharacter || /[!?]/u.test(args.match[0])) return true;

  const punctuationLength =
    args.match[0].match(/^[.!?]+/u)?.[0].length ?? 0;
  const textThroughPunctuation = args.value.slice(
    0,
    matchIndex + punctuationLength,
  );
  if (TITLE_PERIOD_ABBREVIATION_PATTERN.test(textThroughPunctuation)) {
    return false;
  }
  if (CONTEXTUAL_PERIOD_ABBREVIATION_PATTERN.test(textThroughPunctuation)) {
    return isContextualPeriodSentenceBoundary({
      textThroughPunctuation,
      remainingText: args.value.slice(end),
      nextCharacter,
    });
  }
  if (
    continuesDottedInitialism({
      textThroughPunctuation,
      remainingText: args.value.slice(end),
    })
  ) {
    return false;
  }
  return true;
}

function splitSentenceRanges(value: string): SentenceRange[] {
  const sentences: SentenceRange[] = [];
  let start = 0;
  for (const match of value.matchAll(
    /[.!?]+(?:["'”’»)\]}]+)?(?=\s|$)/gu,
  )) {
    const end = (match.index ?? start) + match[0].length;
    if (!isSentenceBoundary({ value, match, start })) continue;
    const sentence = buildSentenceRange(value, start, end);
    if (sentence) sentences.push(sentence);
    start = end;
  }
  const trailing = buildSentenceRange(value, start, value.length);
  if (trailing) sentences.push(trailing);
  return sentences;
}

type NumericTokenOccurrence = Readonly<{
  metric: string;
  key: string;
  baseKey: string;
  measurement: string;
  index: number;
}>;

type SourceMetricFacts = Readonly<{
  factIdsByKey: Map<string, Set<string>>;
  baseKeysWithUnmeasuredSource: Set<string>;
  measuredKeysByBase: Map<string, Set<string>>;
}>;

function numericMagnitudeMultiplier(suffix: string): number {
  return NUMERIC_MAGNITUDE_MULTIPLIERS.get(suffix) ?? 1;
}

function canonicalMetricMeasurement(value: string): string {
  const canonical = canonicalizePremiumCoverLetterNoun(value);
  return METRIC_MEASUREMENT_ALIASES.get(canonical) ?? canonical;
}

function metricCurrency(symbol: string): MetricCurrency | null {
  return METRIC_CURRENCIES.get(symbol.trim().toLowerCase()) ?? null;
}

function qualifiedMetricCurrency(value: string): MetricCurrency | null {
  return metricCurrency(
    value.match(/\b(?:USD|EUR|GBP|CAD|AUD|NZD|SGD|HKD)\s*$/iu)?.[0] ?? "",
  );
}

function numericOccurrenceCurrency(args: {
  prefix: string;
  leadingCurrency: string;
  trailingCurrency: string;
}): MetricCurrency | null {
  return (
    qualifiedMetricCurrency(args.prefix) ??
    metricCurrency(args.leadingCurrency || args.trailingCurrency)
  );
}

function isPlainToolVersion(args: {
  prefix: string;
  sign: string;
  suffix: string;
  currency: MetricCurrency | null;
}): boolean {
  if (args.sign || args.suffix || args.currency) return false;
  return /\b(?:version|ver|v|windows|python|node(?:\.js)?|java|typescript|react|angular|vue|ios|android|macos|ubuntu|debian|rhel|postgres(?:ql)?|mysql|redis|mongodb|kubernetes|docker|terraform|aws|azure|gcp|excel|office)\s*$/iu.test(
    args.prefix,
  );
}

function isIgnoredNumericOccurrence(args: {
  prefix: string;
  sign: string;
  suffix: string;
  currency: MetricCurrency | null;
}): boolean {
  return (
    /\b(?:(?:iso|iec|soc|rfc)(?:\s+|\s*[-–—]\s*)|no\.\s*)$/iu.test(
      args.prefix,
    ) ||
    isPlainToolVersion(args)
  );
}

function numericSignMultiplier(sign: string, prefix: string): number {
  if (sign === "-" && /\d\s*$/u.test(prefix)) return 1;
  return ["-", "−", "minus", "negative"].includes(sign.toLowerCase()) ? -1 : 1;
}

function metricSentencePrefix(args: {
  value: string;
  start: number;
}): string {
  const sentenceStart =
    splitSentenceRanges(args.value).find(
      (range) => args.start >= range.start && args.start < range.end,
    )?.start ?? 0;
  return args.value.slice(sentenceStart, args.start);
}

function percentageOutcomeMeasurement(value: string): string {
  const tokens = value.split(/\s+/u);
  const stopIndex = tokens.findIndex((token) =>
    METRIC_MEASUREMENT_STOP_WORDS.has(token.toLowerCase()),
  );
  return canonicalMetricMeasurement(
    tokens
      .slice(0, stopIndex >= 0 ? stopIndex : undefined)
      .filter((token) => !token.toLowerCase().endsWith("ly"))
      .at(-1) ?? "",
  );
}

type PercentageOutcome = Readonly<{
  measurement: string;
  direction: "increase" | "decrease";
}>;

function buildPercentageOutcome(
  nominal: string,
  measurementSurface: string,
): PercentageOutcome | null {
  const direction = PERCENTAGE_NOMINAL_DIRECTIONS.get(nominal.toLowerCase());
  if (!direction) return null;
  const measurement = percentageOutcomeMeasurement(measurementSurface);
  return measurement ? { measurement, direction } : null;
}

function nominalPercentageOutcomeAfterMetric(
  suffix: string,
): PercentageOutcome | null {
  const match = suffix.match(
    /^\s*(gain|growth|improvement|increase|lift|decline|decrease|drop|reduction)\s+(?:in|of)\s+([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,2})/iu,
  );
  return match ? buildPercentageOutcome(match[1], match[2]) : null;
}

function measurementPercentageOutcomeAfterMetric(
  suffix: string,
): PercentageOutcome | null {
  const match = suffix.match(
    /^\s*([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,2})\s+(gain|growth|improvement|increase|lift|decline|decrease|drop|reduction)\b/iu,
  );
  return match ? buildPercentageOutcome(match[2], match[1]) : null;
}

function followingPercentageOutcome(args: {
  value: string;
  end: number;
  percentage: boolean;
}): PercentageOutcome | null {
  if (!args.percentage) return null;
  const suffix = args.value.slice(args.end);
  return (
    nominalPercentageOutcomeAfterMetric(suffix) ??
    measurementPercentageOutcomeAfterMetric(suffix)
  );
}

function precedingPercentageMeasurement(args: {
  value: string;
  start: number;
  percentage: boolean;
}): string | null {
  if (!args.percentage) return null;
  const prefix = metricSentencePrefix(args);
  const reorderedOutcome = prefix.match(
    /\b([A-Za-z][A-Za-z-]*)\s+(?:(?:was|were|is|has|had|been)\s+){0,2}([A-Za-z][A-Za-z-]*)(?:\s+(?:by|of|at|to))?\s*$/u,
  );
  if (
    reorderedOutcome &&
    PERCENTAGE_DIRECTIONS.has(reorderedOutcome[2].toLowerCase())
  ) {
    return canonicalMetricMeasurement(reorderedOutcome[1]);
  }
  const precedingMeasurement =
    prefix.match(/\b([A-Za-z][A-Za-z-]*)\s+(?:by|of|at|to)\s*$/u)?.[1] ??
    "";
  return precedingMeasurement
    ? canonicalMetricMeasurement(precedingMeasurement)
    : null;
}

function percentageDirection(args: {
  value: string;
  start: number;
  end: number;
  percentage: boolean;
}): "increase" | "decrease" | "" {
  if (!args.percentage) return "";
  const followingOutcome = followingPercentageOutcome(args);
  if (followingOutcome) return followingOutcome.direction;
  const directionTokens = Array.from(
    metricSentencePrefix(args)
      .toLowerCase()
      .matchAll(/\b[a-z]+\b/gu),
    (match) => match[0],
  ).filter((token) => PERCENTAGE_DIRECTIONS.has(token));
  const directionToken = directionTokens.at(-1);
  return directionToken
    ? (PERCENTAGE_DIRECTIONS.get(directionToken) ?? "")
    : "";
}

function metricOccurrenceKey(args: {
  baseKey: string;
  measurement: string;
  direction: string;
}): string {
  return [args.baseKey, args.measurement, args.direction]
    .filter((part) => part !== "")
    .join(":");
}

function metricMeasurement(args: {
  value: string;
  start: number;
  end: number;
  percentage: boolean;
}): string {
  const followingOutcome = followingPercentageOutcome(args);
  if (followingOutcome) return followingOutcome.measurement;
  const percentageMeasurement = precedingPercentageMeasurement(args);
  if (percentageMeasurement !== null) return percentageMeasurement;
  const measurementSurface =
    args.value
      .slice(args.end)
      .match(
        /^\s*(?:[+-]\s*)?([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,3})/u,
      )?.[1] ?? "";
  const measurementTokens = measurementSurface.split(/\s+/u);
  const stopIndex = measurementTokens.findIndex((token) =>
    METRIC_MEASUREMENT_STOP_WORDS.has(token.toLowerCase()),
  );
  const postmodifierIndex = measurementTokens.findIndex(
    (token, index) =>
      index > 0 &&
      (token.toLowerCase() === "responsible" ||
        /(?:ed|en)$/iu.test(token) ||
        (token.toLowerCase().endsWith("ing") &&
          measurementTokens[index - 1]?.toLowerCase().endsWith("s"))),
  );
  const boundaryIndexes = [stopIndex, postmodifierIndex].filter(
    (index) => index >= 0,
  );
  const boundaryIndex =
    boundaryIndexes.length > 0 ? Math.min(...boundaryIndexes) : undefined;
  const measurement =
    measurementTokens
      .slice(0, boundaryIndex)
      .filter((token) => !token.toLowerCase().endsWith("ly"))
      .at(-1) ?? "";
  return canonicalMetricMeasurement(measurement);
}

function metricUnit(args: {
  currency: MetricCurrency | null;
  percentage: boolean;
  percentagePoint: boolean;
  multiplier: boolean;
}): string {
  if (args.currency) return args.currency;
  if (args.percentagePoint) return "percentage_point";
  if (args.multiplier) return "multiplier";
  return args.percentage ? "percent" : "number";
}

function metricLabel(args: {
  value: number;
  percentage: boolean;
  percentagePoint: boolean;
  multiplier: boolean;
}): string {
  if (args.percentage) return `${args.value}%`;
  if (args.percentagePoint) {
    return `${args.value} percentage point${Math.abs(args.value) === 1 ? "" : "s"}`;
  }
  if (args.multiplier) return `${args.value}x`;
  return String(args.value);
}

function normalizeMetricNumericToken(args: {
  value: string;
  percentage: boolean;
}): string {
  if (
    args.percentage &&
    /^\d+,\d{1,2}$/u.test(args.value) &&
    !args.value.includes(".")
  ) {
    return args.value.replace(",", ".");
  }
  return normalizePremiumCoverLetterNumericToken(args.value);
}

type NumericMetricFormat = Readonly<{
  percentage: boolean;
  percentagePoint: boolean;
  percentageLike: boolean;
  multiplier: boolean;
}>;

function numericMetricFormat(suffix: string): NumericMetricFormat {
  const percentage = suffix === "%" || suffix === "percent";
  const percentagePoint =
    suffix === "percentage point" || suffix === "percentage points";
  return {
    percentage,
    percentagePoint,
    percentageLike: percentage || percentagePoint,
    multiplier: suffix === "x" || suffix === "×",
  };
}

function normalizeNumericTokenOccurrence(args: {
  value: string;
  match: RegExpMatchArray;
}): NumericTokenOccurrence | null {
  const index = args.match.index ?? 0;
  const prefix = args.value.slice(Math.max(0, index - 16), index);
  const sign = args.match[1] ?? "";
  const suffix = (args.match[4] ?? "").toLowerCase();
  const currency = numericOccurrenceCurrency({
    prefix,
    leadingCurrency: args.match[2] ?? "",
    trailingCurrency: args.match[5] ?? "",
  });
  if (isIgnoredNumericOccurrence({ prefix, sign, suffix, currency })) {
    return null;
  }

  const format = numericMetricFormat(suffix);
  const numericValue = Number(
    normalizeMetricNumericToken({
      value: args.match[3],
      percentage: format.percentageLike,
    }),
  );
  const metricValue =
    numericValue *
    numericSignMultiplier(sign, prefix) *
    numericMagnitudeMultiplier(suffix);
  const end = index + args.match[0].length;
  const measurement = metricMeasurement({
    value: args.value,
    start: index,
    end,
    percentage: format.percentageLike,
  });
  const direction = percentageDirection({
    value: args.value,
    start: index,
    end,
    percentage: format.percentageLike,
  });
  const metric = metricLabel({
    value: metricValue,
    ...format,
  });
  const baseKey = [
    metricUnit({ currency, ...format }),
    metricValue,
  ].join(":");
  return {
    metric,
    baseKey,
    key: metricOccurrenceKey({ baseKey, measurement, direction }),
    measurement,
    index,
  };
}

function writtenNumberValue(value: string): number | null {
  const parts = value.toLowerCase().split(/[-\s]+/u);
  let total = 0;
  let current = 0;
  for (const part of parts) {
    if (part === "and") continue;
    const unit = WRITTEN_NUMBER_UNITS.get(part);
    if (unit !== undefined) {
      current += unit;
      continue;
    }
    const tens = WRITTEN_NUMBER_TENS.get(part);
    if (tens !== undefined) {
      current += tens;
      continue;
    }
    const scale = WRITTEN_NUMBER_SCALES.get(part);
    if (scale === undefined) return null;
    if (scale === 100) {
      current = Math.max(current, 1) * scale;
    } else {
      total += Math.max(current, 1) * scale;
      current = 0;
    }
  }
  return total + current;
}

function isWrittenNumberLexeme(value: string): boolean {
  return (
    WRITTEN_NUMBER_UNITS.has(value) ||
    WRITTEN_NUMBER_TENS.has(value) ||
    WRITTEN_NUMBER_SCALES.has(value)
  );
}

function isNonQuantitativeWrittenNumberMeasurement(args: {
  measurement: string;
  immediateMeasurement: string;
}): boolean {
  return [args.measurement, canonicalMetricMeasurement(args.immediateMeasurement)].some(
    (measurement) =>
      NON_QUANTITATIVE_WRITTEN_NUMBER_MEASUREMENTS.has(measurement),
  );
}

function writtenNumberOccurrenceMatchesPattern(args: {
  value: string;
  index: number;
  end: number;
  pattern: RegExp;
}): boolean {
  return Array.from(args.value.matchAll(args.pattern)).some((match) => {
    const phraseStart = match.index ?? 0;
    return phraseStart <= args.index && args.end <= phraseStart + match[0].length;
  });
}

function isIgnoredWrittenNumberOccurrence(args: {
  value: string;
  matchedNumber: string;
  index: number;
  end: number;
}): boolean {
  const standaloneScaleAfterDigit =
    WRITTEN_NUMBER_SCALES.has(args.matchedNumber.toLowerCase()) &&
    /\d\s*$/u.test(args.value.slice(0, args.index));
  const partOfIdiom = [
    NON_QUANTITATIVE_HYPHENATED_NUMBER_PATTERN,
    NON_QUANTITATIVE_WRITTEN_NUMBER_PHRASE_PATTERN,
  ].some((pattern) =>
    writtenNumberOccurrenceMatchesPattern({ ...args, pattern }),
  );
  return standaloneScaleAfterDigit || partOfIdiom;
}

function writtenNumberSignMultiplier(value: string, index: number): number {
  const sign =
    value
      .slice(Math.max(0, index - 16), index)
      .match(/\b(minus|negative|plus|positive)\s*$/iu)?.[1] ?? "";
  return numericSignMultiplier(sign, "");
}

function writtenNumericTokenOccurrences(
  value: string,
): NumericTokenOccurrence[] {
  return Array.from(value.matchAll(WRITTEN_NUMBER_PATTERN)).flatMap((match) => {
    const unsignedMetricValue = writtenNumberValue(match[1]);
    if (unsignedMetricValue === null) return [];
    const percentage = Boolean(match[2]);
    const index = match.index ?? 0;
    const end = index + match[0].length;
    const metricValue =
      unsignedMetricValue * writtenNumberSignMultiplier(value, index);
    if (
      isIgnoredWrittenNumberOccurrence({
        value,
        matchedNumber: match[1],
        index,
        end,
      })
    ) {
      return [];
    }
    const measurement = metricMeasurement({
      value,
      start: index,
      end,
      percentage,
    });
    const direction = percentageDirection({
      value,
      start: index,
      end,
      percentage,
    });
    const immediateMeasurement =
      value
        .slice(end)
        .match(/^\s*([A-Za-z][A-Za-z-]*)/u)?.[1]
        .toLowerCase() ?? "";
    const currency = metricCurrency(immediateMeasurement);
    if (
      !percentage &&
      (!measurement ||
        isNonQuantitativeWrittenNumberMeasurement({
          measurement,
          immediateMeasurement,
        }))
    ) {
      return [];
    }
    const baseKey = [
      metricUnit({
        currency,
        percentage,
        percentagePoint: false,
        multiplier: false,
      }),
      metricValue,
    ].join(":");
    return [
      {
        metric: metricLabel({
          value: metricValue,
          percentage,
          percentagePoint: false,
          multiplier: false,
        }),
        baseKey,
        key: metricOccurrenceKey({ baseKey, measurement, direction }),
        measurement,
        index,
      },
    ];
  });
}

function numericTokenOccurrences(value: string): NumericTokenOccurrence[] {
  const tokens: NumericTokenOccurrence[] = [];
  for (const match of value
    .matchAll(
      /(?<![A-Za-z0-9])([+−-]|minus\b|negative\b|plus\b|positive\b)?\s*((?:USD|EUR|GBP|CAD|AUD|NZD|SGD|HKD|[$€£])?)\s*(\d[\d,]*(?:\.\d+)?)\s*(percentage\s+points?\b|%|percent\b|bn\b|mn\b|mm\b|[KMB]\b|thousand\b|million\b|billion\b|[x×])?(?:\s*((?:USD|EUR|GBP|CAD|AUD|NZD|SGD|HKD|dollars?|euros?|pounds?)\b))?(?![A-Za-z0-9])/gi,
    )) {
    const occurrence = normalizeNumericTokenOccurrence({ value, match });
    if (occurrence) tokens.push(occurrence);
  }
  return [...tokens, ...writtenNumericTokenOccurrences(value)];
}

function numericTokens(value: string): string[] {
  return [
    ...new Set(
      numericTokenOccurrences(value).map((occurrence) => occurrence.key),
    ),
  ];
}

function numericOccurrenceIsPartOfContextualEntity(args: {
  value: string;
  occurrence: NumericTokenOccurrence;
}): boolean {
  return Array.from(
    args.value.matchAll(
      /\b(?:[Aa]t|[Ff]or|[Ww]ith|[Jj]oined)\s+(\d+(?:[-–—]\d+)*(?:[-–—]?[A-Z][A-Za-z0-9&'.-]*))\b/gu,
    ),
  ).some((match) => {
    const entity = match[1] ?? "";
    const entityStart = (match.index ?? 0) + match[0].lastIndexOf(entity);
    return (
      args.occurrence.index >= entityStart &&
      args.occurrence.index < entityStart + entity.length
    );
  });
}

function numericOccurrenceIsPartOfWrittenNumberEntity(args: {
  value: string;
  occurrence: NumericTokenOccurrence;
}): boolean {
  return Array.from(
    args.value.matchAll(
      /\b(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty|Fifty|Sixty|Seventy|Eighty|Ninety)(?:\s+[A-Z][A-Za-z0-9&'.-]*)+\b/gu,
    ),
  ).some((match) => {
    const entityStart = match.index ?? 0;
    return (
      args.occurrence.index >= entityStart &&
      args.occurrence.index < entityStart + match[0].length
    );
  });
}

function numericOccurrenceIsPartOfEntity(args: {
  value: string;
  occurrence: NumericTokenOccurrence;
  entities: readonly string[];
}): boolean {
  if (
    numericOccurrenceIsPartOfContextualEntity(args) ||
    numericOccurrenceIsPartOfWrittenNumberEntity(args)
  ) {
    return true;
  }
  const searchableValue = args.value.toLocaleLowerCase("en-US");
  return args.entities.some((rawEntity) => {
    const entity = rawEntity.trim();
    if (!/\p{L}/u.test(entity) || !/\p{N}/u.test(entity)) return false;
    const searchableEntity = entity.toLocaleLowerCase("en-US");
    let entityIndex = searchableValue.indexOf(searchableEntity);
    while (entityIndex >= 0) {
      if (
        args.occurrence.index >= entityIndex &&
        args.occurrence.index < entityIndex + searchableEntity.length
      ) {
        return true;
      }
      entityIndex = searchableValue.indexOf(
        searchableEntity,
        entityIndex + searchableEntity.length,
      );
    }
    return false;
  });
}

function evidenceAnchorTokens(args: {
  factIds: readonly string[];
  factGraph: FactGraphV1;
}): Set<string> {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const facts = args.factIds
    .map((factId) => factById.get(factId))
    .filter((fact): fact is FactGraphV1["facts"][number] => Boolean(fact));
  const tokens = evidenceAnchorTokensFromValues(
    facts.flatMap((fact) => [fact.text, ...fact.entities]),
  );
  for (const verb of facts.flatMap((fact) => fact.allowedVerbs)) {
    tokens.delete(canonicalizePremiumCoverLetterToken(verb));
  }
  return tokens;
}

function evidenceEntityAnchorTokens(args: {
  factIds: readonly string[];
  factGraph: FactGraphV1;
}): Set<string> {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  return evidenceAnchorTokensFromValues(
    args.factIds.flatMap((factId) => {
      const fact = factById.get(factId);
      if (!fact) return [];
      const allowedVerbTokens = new Set(
        fact.allowedVerbs.map((verb) =>
          canonicalizePremiumCoverLetterToken(verb),
        ),
      );
      return fact.entities.filter((entity) => {
        const entityTokens = entity
          .normalize("NFKC")
          .split(/[^\p{L}\p{N}%]+/u)
          .filter(Boolean);
        const canonicalEntityToken =
          entityTokens.length === 1
            ? canonicalizePremiumCoverLetterToken(entityTokens[0])
            : "";
        const firstFactToken = fact.text
          .normalize("NFKC")
          .match(/[\p{L}\p{N}%]+/u)?.[0];
        const isGenericSentenceOpener =
          entityTokens.length === 1 &&
          fact.category !== "tool" &&
          firstFactToken !== undefined &&
          canonicalizePremiumCoverLetterToken(firstFactToken) ===
            canonicalEntityToken;
        return (
          !isGenericSentenceOpener &&
          (entityTokens.length !== 1 ||
            !allowedVerbTokens.has(canonicalEntityToken))
        );
      });
    }),
  );
}

function evidenceAnchorTokensFromValues(values: readonly string[]): Set<string> {
  const technologyAnchors = values.flatMap((value) =>
    Array.from(
      value.matchAll(
        /(?:^|[^\p{L}\p{N}_])((?:C\+\+|C#|R|Go|Git|Vue))(?=$|[^\p{L}\p{N}_+#])/gu,
      ),
      (match) => match[1].toLowerCase(),
    ),
  );
  return new Set(
    technologyAnchors.concat(
      values
        .flatMap((value) =>
          value.normalize("NFKC").split(/[^\p{L}\p{N}%]+/u),
        )
        .map((token) => ({
          source: token,
          normalized: token.toLowerCase(),
          shortAcronym: /^\p{Lu}[\p{Lu}\p{N}]{1,3}$/u.test(token),
        }))
        .flatMap(({ source, normalized, shortAcronym }) =>
          (
            (normalized.length >= 4 || shortAcronym) &&
            !numericTokens(normalized).length &&
            !isWrittenNumberLexeme(normalized) &&
            !isEvidenceActionWord(normalized) &&
            !EVIDENCE_ANCHOR_STOP_WORDS.has(normalized)
          )
            ? [canonicalizePremiumCoverLetterToken(source)]
            : [],
        ),
    ),
  );
}

function hasExactSparseFactGrounding(args: {
  factIds: readonly string[];
  factGraph: FactGraphV1;
  textTokens: ReadonlySet<string>;
}): boolean {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  return args.factIds.some((factId) => {
    const fact = factById.get(factId);
    if (!fact) return false;
    const factAnchors = evidenceAnchorTokens({
      factIds: [factId],
      factGraph: args.factGraph,
    });
    if (
      factAnchors.size !== 1 ||
      !Array.from(factAnchors).every((token) => args.textTokens.has(token))
    ) {
      return false;
    }
    return fact.allowedVerbs
      .map((verb) => canonicalizePremiumCoverLetterToken(verb))
      .some((verb) => args.textTokens.has(verb));
  });
}

function sourceMetricOccurrences(args: {
  factIds: readonly string[];
  demandIds: readonly string[];
  factGraph: FactGraphV1;
  jobDemandGraph?: JobDemandGraphV1;
}): Array<{ occurrence: NumericTokenOccurrence; sourceId: string }> {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const demandById = new Map(
    (args.jobDemandGraph?.demands ?? []).map((demand) => [demand.id, demand]),
  );
  const factOccurrences = args.factIds.flatMap((factId) => {
    const fact = factById.get(factId);
    if (!fact) return [];
    const rawTextMetrics = numericTokenOccurrences(fact.text);
    const textMetrics = rawTextMetrics.filter(
      (occurrence) =>
        !numericOccurrenceIsPartOfEntity({
          value: fact.text,
          occurrence,
          entities: fact.entities,
        }),
    );
    const metrics =
      rawTextMetrics.length > 0
        ? textMetrics
        : fact.metrics.flatMap((metric) => numericTokenOccurrences(metric));
    return metrics.map((occurrence) => ({ occurrence, sourceId: factId }));
  });
  const demandOccurrences = args.demandIds.flatMap((demandId) => {
    const demand = demandById.get(demandId);
    if (!demand) return [];
    return numericTokenOccurrences(demand.text).map((occurrence) => ({
      occurrence,
      sourceId: demandId,
    }));
  });
  return [...factOccurrences, ...demandOccurrences];
}

function sourceMetricFactIds(args: {
  factIds: readonly string[];
  demandIds: readonly string[];
  factGraph: FactGraphV1;
  jobDemandGraph?: JobDemandGraphV1;
}): SourceMetricFacts {
  const factIdsByMetric = new Map<string, Set<string>>();
  const baseKeysWithUnmeasuredSource = new Set<string>();
  const measuredKeysByBase = new Map<string, Set<string>>();
  for (const { occurrence, sourceId } of sourceMetricOccurrences(args)) {
    for (const key of new Set([occurrence.key, occurrence.baseKey])) {
      const supportingFactIds = factIdsByMetric.get(key) ?? new Set<string>();
      supportingFactIds.add(sourceId);
      factIdsByMetric.set(key, supportingFactIds);
    }
    if (occurrence.key === occurrence.baseKey) {
      baseKeysWithUnmeasuredSource.add(occurrence.baseKey);
    } else {
      const measuredKeys =
        measuredKeysByBase.get(occurrence.baseKey) ?? new Set<string>();
      measuredKeys.add(occurrence.key);
      measuredKeysByBase.set(occurrence.baseKey, measuredKeys);
    }
  }
  return {
    factIdsByKey: factIdsByMetric,
    baseKeysWithUnmeasuredSource,
    measuredKeysByBase,
  };
}

function resolveSourceMetricKey(args: {
  occurrence: NumericTokenOccurrence;
  sourceMetricFacts: SourceMetricFacts;
}): string {
  if (args.sourceMetricFacts.factIdsByKey.has(args.occurrence.key)) {
    return args.occurrence.key;
  }
  if (
    (args.occurrence.key === args.occurrence.baseKey ||
      args.sourceMetricFacts.baseKeysWithUnmeasuredSource.has(
        args.occurrence.baseKey,
      )) &&
    args.sourceMetricFacts.factIdsByKey.has(args.occurrence.baseKey)
  ) {
    return args.occurrence.baseKey;
  }
  const measuredKeys = args.sourceMetricFacts.measuredKeysByBase.get(
    args.occurrence.baseKey,
  );
  if (
    GENERIC_PERCENTAGE_MEASUREMENTS.has(args.occurrence.measurement) &&
    measuredKeys?.size === 1
  ) {
    return Array.from(measuredKeys)[0] ?? args.occurrence.key;
  }
  return args.occurrence.key;
}

function hasPluralSubjectForUnlistedPredicate(args: {
  tokens: readonly string[];
  token: string;
  index: number;
}): boolean {
  return (
    args.tokens[args.index - 1]?.endsWith("s") === true &&
    /^[a-z]+$/u.test(args.token)
  );
}

function hasNounPhraseSubjectForUnlistedPredicate(args: {
  tokens: readonly string[];
  index: number;
}): boolean {
  return (
    args.index >= 2 &&
    FINITE_PREDICATE_SUBJECT_DETERMINERS.has(
      args.tokens[args.index - 2] ?? "",
    ) &&
    /^[a-z][a-z-]*$/u.test(args.tokens[args.index - 1] ?? "")
  );
}

function hasMultiwordNounSubjectAfterLeadingParticiple(args: {
  tokens: readonly string[];
  index: number;
}): boolean {
  const subjectTokens = args.tokens.slice(1, args.index);
  const followingToken = args.tokens[args.index + 1];
  return (
    subjectTokens.length >= 2 &&
    subjectTokens.every(
      (token) =>
        /^[a-z][a-z-]*$/u.test(token) &&
        !FINITE_PREDICATE_BLOCKERS.has(token),
    ) &&
    (!followingToken || !FINITE_PREDICATE_BLOCKERS.has(followingToken))
  );
}

function hasSupportedSubjectForUnlistedPredicate(args: {
  tokens: readonly string[];
  index: number;
  hasFrontedClause: boolean;
}): boolean {
  return (
    args.index === 2 ||
    hasNounPhraseSubjectForUnlistedPredicate(args) ||
    hasMultiwordNounSubjectAfterLeadingParticiple(args) ||
    hasFrontedBareNounSubject(args)
  );
}

function isTerminalUnlistedFinitePredicate(args: {
  tokens: readonly string[];
  token: string;
  index: number;
  hasFrontedClause: boolean;
}): boolean {
  return (
    /(?:e|s|ify|ise|ize|ate)$/u.test(args.token) &&
    (hasNounPhraseSubjectForUnlistedPredicate(args) ||
      hasFrontedBareNounSubject(args))
  );
}

function isAmbiguousAdverbOnlyPredicate(args: {
  tokens: readonly string[];
  token: string;
  index: number;
}): boolean {
  const followingToken = args.tokens[args.index + 1] ?? "";
  return (
    args.token.endsWith("s") &&
    args.index === args.tokens.length - 2 &&
    followingToken.endsWith("ly") &&
    hasMultiwordNounSubjectAfterLeadingParticiple(args)
  );
}

function isLikelyUnlistedFinitePredicate(args: {
  tokens: readonly string[];
  token: string;
  index: number;
  hasFrontedClause: boolean;
}): boolean {
  if (
    !hasSupportedSubjectForUnlistedPredicate(args) ||
    args.tokens.length < 4
  ) {
    return false;
  }
  if (args.token.includes("-")) return false;
  if (FINITE_PREDICATE_BLOCKERS.has(args.token)) return false;
  if (
    /(?:ing|tion|ment|ity|ness|ance|ence|ship|ure|age|ery|ory|ism)$/u.test(
      args.token,
    )
  ) {
    return false;
  }
  const followingToken = args.tokens[args.index + 1];
  const hasPredicateShape = /(?:e|s|ify|ise|ize|ate)$/u.test(args.token);
  if (!followingToken) {
    return isTerminalUnlistedFinitePredicate(args);
  }
  if (FINITE_PREDICATE_BLOCKERS.has(followingToken)) {
    return false;
  }
  if (hasPredicateShape) return !isAmbiguousAdverbOnlyPredicate(args);
  return hasPluralSubjectForUnlistedPredicate(args);
}

function hasFrontedBareNounSubject(args: {
  tokens: readonly string[];
  index: number;
  hasFrontedClause: boolean;
}): boolean {
  const subject = args.tokens[args.index - 1] ?? "";
  return (
    args.hasFrontedClause &&
    args.index >= 4 &&
    /^[a-z][a-z-]*$/u.test(subject) &&
    !FINITE_PREDICATE_BLOCKERS.has(subject)
  );
}

function hasSupportedSubjectForRegularPastPredicate(args: {
  tokens: readonly string[];
  index: number;
  hasFrontedClause: boolean;
}): boolean {
  return (
    args.index === 2 ||
    ["i", "we", "you", "they", "he", "she", "it"].includes(
      args.tokens[args.index - 1],
    ) ||
    hasNounPhraseSubjectForUnlistedPredicate(args) ||
    hasMultiwordNounSubjectAfterLeadingParticiple(args) ||
    hasFrontedBareNounSubject(args) ||
    args.tokens[args.index - 1]?.endsWith("s") === true ||
    ["that", "which", "who"].includes(args.tokens[args.index + 1])
  );
}

function isFinitePredicateCandidate(args: {
  tokens: readonly string[];
  token: string;
  index: number;
  hasFrontedClause: boolean;
}): boolean {
  const canonicalToken = canonicalizePremiumCoverLetterToken(args.token);
  if (
    FINITE_PREDICATE_TOKENS.has(canonicalToken) &&
    args.tokens[args.index - 1] !== "to"
  ) {
    return true;
  }
  if (
    /(?:ed|en)$/u.test(args.token) &&
    hasSupportedSubjectForRegularPastPredicate(args)
  ) {
    return true;
  }
  return isLikelyUnlistedFinitePredicate(args);
}

function isVerbLedFragment(normalizedSentence: string): boolean {
  if (!VERB_LED_FRAGMENT_PATTERN.test(normalizedSentence)) return false;
  const tokens = normalizedSentence.split(/[^a-z0-9-]+/u).filter(Boolean);
  if (
    PREPOSITIONAL_FRAGMENT_STARTERS.has(tokens[1] ?? "") &&
    !normalizedSentence.includes(",") &&
    !tokens
      .slice(2)
      .some((token) => FINITE_PREDICATE_SUBJECT_TOKENS.has(token))
  ) {
    return true;
  }
  const hasLaterFinitePredicate = tokens.some(
    (token, index) =>
      index >= 2 &&
      isFinitePredicateCandidate({
        tokens,
        token,
        index,
        hasFrontedClause: normalizedSentence.includes(","),
      }),
  );
  return !hasLaterFinitePredicate;
}

function attributedMetricFactIds(args: {
  visibleText: string;
  candidateFactIds: ReadonlySet<string>;
  factGraph: FactGraphV1;
}): Set<string> {
  if (args.candidateFactIds.size <= 1) {
    return new Set(args.candidateFactIds);
  }

  const visibleTokens = evidenceAnchorTokensFromValues([args.visibleText]);
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const scores = Array.from(args.candidateFactIds, (factId) => {
    const fact = factById.get(factId);
    const anchors = fact
      ? evidenceAnchorTokensFromValues([fact.text, ...fact.entities])
      : new Set<string>();
    return {
      factId,
      score: Array.from(anchors).filter((token) => visibleTokens.has(token))
        .length,
    };
  });
  const highestScore = Math.max(...scores.map(({ score }) => score));
  const bestMatches = scores.filter(({ score }) => score === highestScore);
  if (highestScore === 0 || bestMatches.length !== 1) {
    return new Set();
  }
  return new Set([bestMatches[0].factId]);
}

function setsOverlap(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function pushUnique<T>(items: T[], item: T): void {
  if (
    items.some((existing) => JSON.stringify(existing) === JSON.stringify(item))
  ) {
    return;
  }
  items.push(item);
}

function collectIntentionalClaimOverlapObservations(args: {
  writerOutput: PremiumWriterOutputV1;
  claimPlan: ClaimPlanV1;
}): EnglishCvBackedQualityGateObservation[] {
  const observations: EnglishCvBackedQualityGateObservation[] = [];
  const claimBySection = new Map(
    args.claimPlan.claims.map((claim) => [claim.section, claim]),
  );
  const seenFactSections = new Map<string, ClaimPlanSection>();
  for (const section of ENGLISH_CV_BACKED_SECTIONS) {
    const allowedFactIds = new Set(
      claimBySection.get(section)?.factIds ?? [],
    );
    for (const factId of args.writerOutput.bodyParts[section].factIds) {
      const previousSection = seenFactSections.get(factId);
      if (!previousSection) {
        seenFactSections.set(factId, section);
        continue;
      }
      if (
        previousSection !== section &&
        allowedFactIds.has(factId) &&
        claimBySection.get(previousSection)?.factIds.includes(factId)
      ) {
        pushUnique(observations, {
          code: "intentional_claim_overlap",
          section,
          otherSection: previousSection,
          factId,
        });
      }
    }
  }
  return observations;
}

/**
 * Provider-free, text-preserving quality gate for English CV-backed output.
 *
 * Claim-authorized fact overlap is not blocking. Unexpected writer reuse
 * remains fail-closed. The gate never drops IDs, rewrites prose, or chooses a
 * replacement fact.
 */
export function validateEnglishCvBackedQualityGate(args: {
  writerOutput: PremiumWriterOutputV1;
  claimPlan: ClaimPlanV1;
  factGraph: FactGraphV1;
  jobDemandGraph?: JobDemandGraphV1;
  targetEmployerName?: string;
}): EnglishCvBackedQualityGateIssue[] {
  if (
    args.claimPlan.language !== "English" ||
    (args.claimPlan.contextClass !== "cv_direct" &&
      args.claimPlan.contextClass !== "cv_adjacent")
  ) {
    return [];
  }

  const issues: EnglishCvBackedQualityGateIssue[] = [];
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const claimBySection = new Map(
    args.claimPlan.claims.map((claim) => [claim.section, claim]),
  );
  const seenFactSections = new Map<string, ClaimPlanSection>();
  const seenSentenceSections = new Map<string, ClaimPlanSection>();
  const seenMetricSections = new Map<
    string,
    Array<{ section: ClaimPlanSection; factIds: ReadonlySet<string> }>
  >();

  for (const section of ENGLISH_CV_BACKED_SECTIONS) {
    const part = args.writerOutput.bodyParts[section];
    const text = part.text.trim();

    if (!text || (section === "employerValueBlock" && !text)) {
      pushUnique(issues, {
        code:
          section === "employerValueBlock"
            ? "missing_employer_value"
            : section === "closeLine"
              ? "missing_close_line"
              : "incomplete_sentence",
        section,
      });
      continue;
    }

    if (!/[.!?](?:["'”’»)\]}]+)?$/u.test(text)) {
      pushUnique(issues, { code: "incomplete_sentence", section });
    }

    const assignedClaim = claimBySection.get(section);
    if (!assignedClaim) {
      pushUnique(issues, { code: "missing_claim_reference", section });
    } else {
      if (!part.claimIds.includes(assignedClaim.id)) {
        pushUnique(issues, { code: "claim_reference_mismatch", section });
      }
      for (const claimId of part.claimIds) {
        const referencedClaim = args.claimPlan.claims.find(
          (claim) => claim.id === claimId,
        );
        if (!referencedClaim) {
          pushUnique(issues, {
            code: "unknown_claim_reference",
            section,
          });
        } else if (referencedClaim.section !== section) {
          pushUnique(issues, { code: "claim_reference_mismatch", section });
        }
      }
    }
    const allowedFactIds = new Set(assignedClaim?.factIds ?? []);
    if (
      assignedClaim?.claimType === "source_backed" &&
      allowedFactIds.size > 0 &&
      part.factIds.length === 0
    ) {
      pushUnique(issues, { code: "missing_fact_reference", section });
    }
    for (const factId of part.factIds) {
      if (!factById.has(factId)) {
        pushUnique(issues, {
          code: "unknown_fact_reference",
          section,
          factId,
        });
      }
      if (!allowedFactIds.has(factId)) {
        pushUnique(issues, {
          code: "fact_not_allowed_for_section",
          section,
          factId,
        });
      }
      const previousSection = seenFactSections.get(factId);
      if (previousSection && previousSection !== section) {
        const previousClaim = claimBySection.get(previousSection);
        const previousClaimAllowsFact =
          previousClaim?.factIds.includes(factId) ?? false;
        if (!previousClaimAllowsFact || !allowedFactIds.has(factId)) {
          pushUnique(issues, {
            code: "unexpected_writer_reuse",
            section,
            otherSection: previousSection,
            factId,
          });
        }
      } else if (!previousSection) {
        seenFactSections.set(factId, section);
      }
    }

    const sentenceRanges = splitSentenceRanges(text);
    for (const { text: sentence } of sentenceRanges) {
      const normalizedSentence = normalizeSentenceKey(sentence);
      const hasVerbLedFragment = sentence
        .split(";")
        .some((clause) => isVerbLedFragment(normalizeSentenceKey(clause)));
      if (hasVerbLedFragment) {
        pushUnique(issues, { code: "incomplete_sentence", section });
      }
      const previousSection = seenSentenceSections.get(normalizedSentence);
      if (previousSection) {
        pushUnique(issues, {
          code: "duplicate_visible_sentence",
          section,
          ...(previousSection !== section
            ? { otherSection: previousSection }
            : {}),
        });
      } else if (!previousSection) {
        seenSentenceSections.set(normalizedSentence, section);
      }
    }

    const effectiveFactIds =
      part.factIds.length > 0 ? part.factIds : assignedClaim?.factIds ?? [];
    const sourceMetricFacts = sourceMetricFactIds({
      factIds: effectiveFactIds,
      demandIds: part.demandIds,
      factGraph: args.factGraph,
      jobDemandGraph: args.jobDemandGraph,
    });
    const visibleMetricEntities = effectiveFactIds.flatMap(
      (factId) =>
        args.factGraph.facts.find((fact) => fact.id === factId)?.entities ?? [],
    );
    if (args.targetEmployerName) {
      visibleMetricEntities.push(args.targetEmployerName);
    }
    const employerGroundingFactIds = effectiveFactIds;
    if (
      section === "employerValueBlock" &&
      employerGroundingFactIds.length > 0
    ) {
      const anchors = evidenceAnchorTokens({
        factIds: employerGroundingFactIds,
        factGraph: args.factGraph,
      });
      const entityAnchors = evidenceEntityAnchorTokens({
        factIds: employerGroundingFactIds,
        factGraph: args.factGraph,
      });
      const textTokens = evidenceAnchorTokensFromValues([text]);
      const anchorOverlapCount = Array.from(textTokens).filter((token) =>
        anchors.has(token),
      ).length;
      const hasDistinctiveLexicalAnchor = Array.from(textTokens).some(
        (token) =>
          anchors.has(token) &&
          !GENERIC_SINGLE_EVIDENCE_ANCHORS.has(token),
      );
      const hasDistinctiveEntityAnchor = Array.from(textTokens).some((token) =>
        entityAnchors.has(token) &&
        !GENERIC_SINGLE_EVIDENCE_ANCHORS.has(token),
      );
      const hasExactSparseFactAnchor = hasExactSparseFactGrounding({
        factIds: employerGroundingFactIds,
        factGraph: args.factGraph,
        textTokens,
      });
      if (
        anchorOverlapCount < 2 &&
        !hasDistinctiveLexicalAnchor &&
        !hasDistinctiveEntityAnchor &&
        !hasExactSparseFactAnchor
      ) {
        pushUnique(issues, {
          code: "employer_value_not_grounded",
          section,
        });
      }
    }
    for (const occurrence of numericTokenOccurrences(text).filter(
      (candidate) =>
        !numericOccurrenceIsPartOfEntity({
          value: text,
          occurrence: candidate,
          entities: visibleMetricEntities,
        }),
    )) {
      const { metric } = occurrence;
      const resolvedMetricKey = resolveSourceMetricKey({
        occurrence,
        sourceMetricFacts,
      });
      const supportingMetricFactIds =
        sourceMetricFacts.factIdsByKey.get(resolvedMetricKey);
      if (!supportingMetricFactIds) {
        pushUnique(issues, {
          code: "unsupported_visible_metric",
          section,
          metric,
        });
      }
      const localText =
        sentenceRanges.find(
          (sentence) =>
            occurrence.index >= sentence.start &&
            occurrence.index < sentence.end,
        )?.text ?? text;
      const metricFactIds = attributedMetricFactIds({
        visibleText: localText,
        candidateFactIds: supportingMetricFactIds ?? new Set<string>(),
        factGraph: args.factGraph,
      });
      const previousOccurrence = seenMetricSections
        .get(resolvedMetricKey)
        ?.find(
          (occurrence) =>
            setsOverlap(occurrence.factIds, metricFactIds),
        );
      if (previousOccurrence) {
        pushUnique(issues, {
          code: "duplicate_visible_metric",
          section,
          ...(previousOccurrence.section !== section
            ? { otherSection: previousOccurrence.section }
            : {}),
          metric,
        });
      }
      const occurrences = seenMetricSections.get(resolvedMetricKey) ?? [];
      occurrences.push({ section, factIds: metricFactIds });
      seenMetricSections.set(resolvedMetricKey, occurrences);
    }
  }

  return issues;
}

/**
 * Quality-gate issues plus non-blocking ClaimPlan-authorized overlap.
 */
export function analyzeEnglishCvBackedQualityGate(args: {
  writerOutput: PremiumWriterOutputV1;
  claimPlan: ClaimPlanV1;
  factGraph: FactGraphV1;
  jobDemandGraph?: JobDemandGraphV1;
  targetEmployerName?: string;
}): EnglishCvBackedQualityGateAnalysis {
  const issues = validateEnglishCvBackedQualityGate(args);
  if (
    args.claimPlan.language !== "English" ||
    (args.claimPlan.contextClass !== "cv_direct" &&
      args.claimPlan.contextClass !== "cv_adjacent")
  ) {
    return { issues, observations: [] };
  }
  return {
    issues,
    observations: collectIntentionalClaimOverlapObservations(args),
  };
}
