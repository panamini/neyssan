import type {
  ClaimPlanSection,
  ClaimPlanV1,
  FactGraphV1,
  JobDemandGraphV1,
} from "./premiumCoverLetter";
import {
  canonicalizePremiumCoverLetterNoun,
  normalizePremiumCoverLetterNumericToken,
} from "./premiumCoverLetterTokenNormalization";
import {
  MISSING_TARGET_EMPLOYER,
  targetEmployerOwnsOccurrence,
  type TargetEmployerResolution,
} from "./premiumCoverLetterTargetEmployer";

export type PremiumCoverLetterNumericEvidenceRole =
  | "METRIC"
  | "DURATION"
  | "DATE"
  | "VERSION"
  | "JOB_LEVEL"
  | "PROPER_NAME"
  | "EMPLOYER"
  | "UNKNOWN";

export type PremiumCoverLetterNumericEvidenceOwner =
  | "CANDIDATE"
  | "TARGET_EMPLOYER"
  | "JOB_CONTEXT";

export type PremiumCoverLetterNumericEvidenceReasonCode =
  | "candidate_fact_source"
  | "job_context_source"
  | "resolved_target_employer"
  | "duration_context"
  | "date_context"
  | "version_context"
  | "job_level_context"
  | "structured_proper_name"
  | "quantitative_metric"
  | "normalized_exact"
  | "normalized_numeric_variant"
  | "normalized_hyphen_variant"
  | "source_provenance_missing"
  | "claim_id_not_source_provenance"
  | "owner_mismatch"
  | "visible_numeric_unknown";

export type PremiumCoverLetterNumericEvidenceSpan = Readonly<{
  start: number;
  end: number;
  text: string;
}>;

type NumericOccurrence = Readonly<{
  metric: string;
  normalizedValue: string;
  key: string;
  baseKey: string;
  measurement: string;
  index: number;
  end: number;
}>;

export type PremiumCoverLetterNumericEvidenceSource = Readonly<{
  sourceId: string;
  factId?: string;
  demandId?: string;
  claimIds: readonly string[];
  role: PremiumCoverLetterNumericEvidenceRole;
  owner: PremiumCoverLetterNumericEvidenceOwner;
  normalizedValue: string;
  key: string;
  baseKey: string;
  measurement: string;
  contextQualifier?: string;
  sourceSpan: PremiumCoverLetterNumericEvidenceSpan;
  entityText?: string;
  reasonCodes: readonly PremiumCoverLetterNumericEvidenceReasonCode[];
}>;

export type PremiumCoverLetterNumericEvidenceProjection = Readonly<{
  version: "premium_cover_letter_numeric_evidence_v1";
  sources: readonly PremiumCoverLetterNumericEvidenceSource[];
  targetEmployer: TargetEmployerResolution;
}>;

export type PremiumCoverLetterNumericEvidenceMatch = Readonly<{
  section: ClaimPlanSection;
  role: PremiumCoverLetterNumericEvidenceRole;
  owner: PremiumCoverLetterNumericEvidenceOwner;
  normalizedValue: string;
  key: string;
  factId?: string;
  demandId?: string;
  sourceSpan: PremiumCoverLetterNumericEvidenceSpan;
  visibleSpan: PremiumCoverLetterNumericEvidenceSpan;
  reasonCodes: readonly PremiumCoverLetterNumericEvidenceReasonCode[];
}>;

export type PremiumCoverLetterUnsupportedNumericEvidence = Readonly<{
  section: ClaimPlanSection;
  role: "UNKNOWN";
  owner?: PremiumCoverLetterNumericEvidenceOwner;
  normalizedValue: string;
  key: string;
  visibleSpan: PremiumCoverLetterNumericEvidenceSpan;
  reasonCodes: readonly PremiumCoverLetterNumericEvidenceReasonCode[];
}>;

export type PremiumCoverLetterNumericEvidenceMatchResult = Readonly<{
  matches: readonly PremiumCoverLetterNumericEvidenceMatch[];
  unsupported: readonly PremiumCoverLetterUnsupportedNumericEvidence[];
}>;

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
  "through",
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
  ["squad", "team"],
]);
const TRANSLATED_METRIC_MEASUREMENT_ALIASES = new Map([
  ["chiffre", "revenue"],
  ["client", "client"],
  ["clients", "client"],
  ["conversion", "conversion"],
  ["équipe", "team"],
  ["équipes", "team"],
  ["projet", "project"],
  ["projets", "project"],
  ["revenu", "revenue"],
  ["revenus", "revenue"],
  ["utilisateur", "user"],
  ["utilisateurs", "user"],
]);
const TOOL_VERSION_QUALIFIERS = new Set([
  "android",
  "angular",
  "aws",
  "azure",
  "debian",
  "docker",
  "excel",
  "gcp",
  "ios",
  "iso",
  "java",
  "kubernetes",
  "macos",
  "mongodb",
  "mysql",
  "node",
  "office",
  "postgres",
  "python",
  "react",
  "redis",
  "rfc",
  "rhel",
  "terraform",
  "typescript",
  "ubuntu",
  "vue",
  "windows",
]);
const CONTEXTUAL_NUMERIC_OCCURRENCE_PATTERN =
  /\b([A-Za-z][A-Za-z.]*|level|grade|tier)\s*[-–—:]?\s*(\d+(?:\.\d+)*)\b/giu;
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
  /\b(?:as\s+one\s+(?:team|unit)|one\s+source\s+of\s+truth|one(?:\s+\p{L}[\p{L}-]*){0,2}\s+(?:example|focus|opportunity|priority|reason|thing|way))\b/giu;
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

function numericMagnitudeMultiplier(suffix: string): number {
  return NUMERIC_MAGNITUDE_MULTIPLIERS.get(suffix) ?? 1;
}

function canonicalMetricMeasurement(value: string): string {
  const canonical = canonicalizePremiumCoverLetterNoun(value);
  return METRIC_MEASUREMENT_ALIASES.get(canonical) ?? canonical;
}

function translatedMetricMeasurementForOccurrence(
  visibleText: string,
  occurrence: NumericOccurrence,
): string | undefined {
  const direct = TRANSLATED_METRIC_MEASUREMENT_ALIASES.get(
    occurrence.measurement,
  );
  if (direct) return direct;
  const contextTokens = visibleText
    .slice(Math.max(0, occurrence.index - 64), occurrence.end + 64)
    .toLocaleLowerCase("fr-FR")
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  for (const token of contextTokens) {
    const translated = TRANSLATED_METRIC_MEASUREMENT_ALIASES.get(token);
    if (translated) return translated;
  }
  return undefined;
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

function versionQualifierFromPrefix(prefix: string): string | undefined {
  const qualifier = prefix.match(
    /\b([A-Za-z][A-Za-z.]*)(?:\s*(?:version|ver|v))?\s*[-–—:]?\s*$/iu,
  )?.[1];
  if (!qualifier) return undefined;
  const normalized = qualifier.toLocaleLowerCase("en-US");
  if (normalized === "version" || normalized === "ver" || normalized === "v") {
    return "version";
  }
  const canonical =
    normalized === "node.js"
      ? "node"
      : normalized === "postgresql"
        ? "postgres"
        : normalized;
  return TOOL_VERSION_QUALIFIERS.has(canonical) ? canonical : undefined;
}

function isPlainToolVersion(args: {
  prefix: string;
  sign: string;
  suffix: string;
  currency: MetricCurrency | null;
}): boolean {
  if (args.sign || args.suffix || args.currency) return false;
  return Boolean(versionQualifierFromPrefix(args.prefix));
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
    args.value.slice(args.end).match(
      /^\s*(?:[+-]\s*)?(?:(?:in|of|for|with|across|through|de|du|des|d['’])\s*)?(\p{L}[\p{L}'’-]*(?:\s+\p{L}[\p{L}'’-]*){0,3})/u,
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
      /(?<![A-Za-z0-9])([+−-]|minus\b|negative\b|plus\b|positive\b)?\s*((?:USD|EUR|GBP|CAD|AUD|NZD|SGD|HKD|[$€£])?)\s*(\d[\d,]*(?:\.\d+)?)\s*(percentage\s+points?\b|%|percent\b|bn\b|mn\b|mm\b|[KMB]\b|thousand\b|million\b|billion\b|[x×])?(?:\s*((?:(?:USD|EUR|GBP|CAD|AUD|NZD|SGD|HKD|dollars?|euros?|pounds?)\b|[$€£])))?(?![A-Za-z0-9])/gi,
    )) {
    const occurrence = normalizeNumericTokenOccurrence({ value, match });
    if (!occurrence) continue;
    const numericSurface = match[3] ?? "";
    const numericIndex =
      (match.index ?? occurrence.index) + match[0].indexOf(numericSurface);
    const isSemanticVersionFragment =
      /\d\.$/u.test(value.slice(Math.max(0, numericIndex - 2), numericIndex)) ||
      /^\.\d/u.test(value.slice(numericIndex + numericSurface.length));
    if (!isSemanticVersionFragment) tokens.push(occurrence);
  }
  return [...tokens, ...writtenNumericTokenOccurrences(value)];
}

function numericOccurrenceSurfaceEnd(
  value: string,
  occurrence: NumericTokenOccurrence,
): number {
  const tail = value.slice(occurrence.index);
  const surface = tail.match(
    /^(?:(?:[+−-]|minus\b|negative\b|plus\b|positive\b)?\s*(?:(?:USD|EUR|GBP|CAD|AUD|NZD|SGD|HKD|[$€£])?)\s*\d[\d,]*(?:\.\d+)?\s*(?:percentage\s+points?\b|%|percent\b|bn\b|mn\b|mm\b|[KMB]\b|thousand\b|million\b|billion\b|[x×])?(?:\s*(?:(?:(?:USD|EUR|GBP|CAD|AUD|NZD|SGD|HKD|dollars?|euros?|pounds?)\b|[$€£])))?|(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)(?:[-\s]+(?:and|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)){0,6}(?:\s+percent\b)?)/iu,
  )?.[0];
  return occurrence.index + (surface?.length ?? occurrence.metric.length);
}

function numericOccurrences(value: string): NumericOccurrence[] {
  const quantitative = numericTokenOccurrences(value).map((occurrence) => ({
    ...occurrence,
    normalizedValue: occurrence.metric,
    end: numericOccurrenceSurfaceEnd(value, occurrence),
  }));
  const contextual: NumericOccurrence[] = [];
  for (const match of value.matchAll(CONTEXTUAL_NUMERIC_OCCURRENCE_PATTERN)) {
    const qualifier = match[1]?.toLocaleLowerCase("en-US");
    const raw = match[2];
    if (!raw || match.index === undefined) continue;
    if (
      qualifier !== "level" &&
      qualifier !== "grade" &&
      qualifier !== "tier" &&
      !versionQualifierFromPrefix(match[1])
    ) {
      continue;
    }
    const relativeIndex = match[0].lastIndexOf(raw);
    const index = match.index + relativeIndex;
    const end = index + raw.length;
    if (quantitative.some((occurrence) => index < occurrence.end && end > occurrence.index)) {
      continue;
    }
    const normalizedValue =
      raw.split(".").length > 2
        ? raw
            .split(".")
            .map((part) => String(Number(part)))
            .join(".")
        : normalizePremiumCoverLetterNumericToken(raw);
    const baseKey = `number:${normalizedValue}`;
    contextual.push({
      metric: normalizedValue,
      normalizedValue,
      key: baseKey,
      baseKey,
      measurement: "",
      index,
      end,
    });
  }
  return [...quantitative, ...contextual].sort((left, right) => left.index - right.index);
}

function entityCoveringOccurrence(
  value: string,
  occurrence: NumericOccurrence,
  entities: readonly string[],
): string | undefined {
  const searchable = value.toLocaleLowerCase("en-US");
  return entities.find((rawEntity) => {
    const entity = rawEntity.trim();
    if (
      !/\p{L}/u.test(entity) ||
      (!/\p{N}/u.test(entity) &&
        writtenNumericTokenOccurrences(entity).length === 0)
    ) {
      return false;
    }
    const normalized = entity.toLocaleLowerCase("en-US");
    let start = searchable.indexOf(normalized);
    while (start >= 0) {
      if (occurrence.index >= start && occurrence.index < start + normalized.length) {
        return true;
      }
      start = searchable.indexOf(normalized, start + normalized.length);
    }
    return false;
  });
}

const DURATION_UNITS = new Set([
  "day",
  "days",
  "week",
  "weeks",
  "month",
  "months",
  "quarter",
  "quarters",
  "year",
  "years",
]);
const TRANSLATED_DURATION_UNITS = new Map([
  ["jour", "day"],
  ["jours", "day"],
  ["semaine", "week"],
  ["semaines", "week"],
  ["mois", "month"],
  ["trimestre", "quarter"],
  ["trimestres", "quarter"],
  ["an", "year"],
  ["ans", "year"],
  ["année", "year"],
  ["années", "year"],
]);

function durationUnitForOccurrence(
  value: string,
  occurrence: NumericOccurrence,
): string | undefined {
  const suffix = value.slice(occurrence.end, occurrence.end + 32);
  const unit =
    suffix.match(/^\s*[-–—]?\s*([A-Za-z]+)/u)?.[1]?.toLocaleLowerCase(
      "en-US",
    ) ?? "";
  if (!DURATION_UNITS.has(unit)) return undefined;
  return unit.endsWith("s") ? unit.slice(0, -1) : unit;
}

function translatedDurationUnitForOccurrence(
  value: string,
  occurrence: NumericOccurrence,
): string | undefined {
  const suffix = value.slice(occurrence.end, occurrence.end + 32);
  const unit =
    suffix
      .match(/^\s*[-–—]?\s*([\p{L}]+)/u)?.[1]
      ?.toLocaleLowerCase("fr-FR") ?? "";
  return TRANSLATED_DURATION_UNITS.get(unit);
}

function versionQualifierForOccurrence(
  value: string,
  occurrence: NumericOccurrence,
): string | undefined {
  const prefix = value.slice(Math.max(0, occurrence.index - 32), occurrence.index);
  return versionQualifierFromPrefix(prefix);
}

function isCalendarYearOccurrence(occurrence: NumericOccurrence): boolean {
  const numeric = Number(occurrence.metric.replace(/[^\d.-]/gu, ""));
  return Number.isInteger(numeric) && numeric >= 1900 && numeric <= 2100;
}

function hasDateContextForOccurrence(
  value: string,
  occurrence: NumericOccurrence,
): boolean {
  if (!isCalendarYearOccurrence(occurrence)) return false;
  const prefix = value.slice(Math.max(0, occurrence.index - 32), occurrence.index);
  const suffix = value.slice(occurrence.end, occurrence.end + 32);
  const surface = value.slice(occurrence.index, occurrence.end);
  return (
    /\b(?:in|since|during|from|until|through)\s*$/iu.test(prefix) ||
    /\bbetween\s*$/iu.test(prefix) ||
    /\bbetween\s+(?:19|20|21)\d{2}\s+and\s*$/iu.test(prefix) ||
    /\b(?:19|20|21)\d{2}\s+to\s*$/iu.test(prefix) ||
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{1,2}(?:st|nd|rd|th)?)?,?\s*$/iu.test(
      prefix,
    ) ||
    /^\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/iu.test(
      suffix,
    ) ||
    /\b(?:19|20|21)\d{2}\s*[-–—]\s*$/u.test(prefix) ||
    /^\s*[-–—]\s*(?:19|20|21)\d{2}\b/u.test(suffix) ||
    /^\s*[-–—]\s*(?:present|current|now)\b/iu.test(suffix) ||
    (/\b(?:19|20|21)\d{2}\s*$/u.test(prefix) &&
      /^\s*[-–—]\s*(?:19|20|21)\d{2}\b/u.test(surface))
  );
}

function explicitContextRoleForOccurrence(
  value: string,
  occurrence: NumericOccurrence,
): PremiumCoverLetterNumericEvidenceRole | undefined {
  if (durationUnitForOccurrence(value, occurrence)) return "DURATION";
  const prefix = value.slice(Math.max(0, occurrence.index - 32), occurrence.index);
  if (/\b(?:level|grade|tier)\s*[-–—:]?\s*$/iu.test(prefix)) {
    return "JOB_LEVEL";
  }
  if (versionQualifierForOccurrence(value, occurrence)) return "VERSION";
  if (hasDateContextForOccurrence(value, occurrence)) {
    return "DATE";
  }
  return undefined;
}

function classifyRole(args: {
  value: string;
  occurrence: NumericOccurrence;
  entityText?: string;
}): {
  role: PremiumCoverLetterNumericEvidenceRole;
  reason: PremiumCoverLetterNumericEvidenceReasonCode;
} {
  const prefix = args.value.slice(Math.max(0, args.occurrence.index - 32), args.occurrence.index);
  const suffix = args.value.slice(args.occurrence.end, args.occurrence.end + 32);
  const immediateMeasurement =
    suffix.match(/^\s*[-–—]?\s*([A-Za-z]+)/u)?.[1]?.toLocaleLowerCase("en-US") ?? "";
  if (DURATION_UNITS.has(immediateMeasurement)) {
    return { role: "DURATION", reason: "duration_context" };
  }
  if (/\b(?:level|grade|tier)\s*[-–—:]?\s*$/iu.test(prefix)) {
    return { role: "JOB_LEVEL", reason: "job_level_context" };
  }
  if (versionQualifierForOccurrence(args.value, args.occurrence)) {
    return { role: "VERSION", reason: "version_context" };
  }
  if (hasDateContextForOccurrence(args.value, args.occurrence)) {
    return { role: "DATE", reason: "date_context" };
  }
  if (args.entityText) {
    return { role: "PROPER_NAME", reason: "structured_proper_name" };
  }
  return { role: "METRIC", reason: "quantitative_metric" };
}

function claimIdsForSource(
  claimPlan: ClaimPlanV1,
  sourceId: string,
  kind: "fact" | "demand",
): string[] {
  return claimPlan.claims.flatMap((claim) =>
    (kind === "fact" ? claim.factIds : claim.demandIds).includes(sourceId)
      ? [claim.id]
      : [],
  );
}

function sourceFromOccurrence(args: {
  occurrence: NumericOccurrence;
  value: string;
  sourceId: string;
  owner: PremiumCoverLetterNumericEvidenceOwner;
  baseReason: PremiumCoverLetterNumericEvidenceReasonCode;
  claimIds: readonly string[];
  factId?: string;
  demandId?: string;
  entities?: readonly string[];
}): PremiumCoverLetterNumericEvidenceSource {
  const entityText = entityCoveringOccurrence(
    args.value,
    args.occurrence,
    args.entities ?? [],
  );
  const classification = classifyRole({
    value: args.value,
    occurrence: args.occurrence,
    entityText,
  });
  const contextQualifier =
    classification.role === "VERSION"
      ? versionQualifierForOccurrence(args.value, args.occurrence)
      : classification.role === "DURATION"
        ? durationUnitForOccurrence(args.value, args.occurrence)
        : undefined;
  return {
    sourceId: args.sourceId,
    ...(args.factId ? { factId: args.factId } : {}),
    ...(args.demandId ? { demandId: args.demandId } : {}),
    claimIds: args.claimIds,
    role: classification.role,
    owner: args.owner,
    normalizedValue: args.occurrence.normalizedValue,
    key: args.occurrence.key,
    baseKey: args.occurrence.baseKey,
    measurement: args.occurrence.measurement,
    ...(contextQualifier ? { contextQualifier } : {}),
    sourceSpan: {
      start: args.occurrence.index,
      end: args.occurrence.end,
      text: args.value.slice(args.occurrence.index, args.occurrence.end),
    },
    ...(entityText ? { entityText } : {}),
    reasonCodes: [args.baseReason, classification.reason],
  };
}

export function buildPremiumCoverLetterNumericEvidenceProjection(args: {
  factGraph: FactGraphV1;
  claimPlan: ClaimPlanV1;
  jobDemandGraph: JobDemandGraphV1;
  targetEmployer?: TargetEmployerResolution;
}): PremiumCoverLetterNumericEvidenceProjection {
  const sources: PremiumCoverLetterNumericEvidenceSource[] = [];

  for (const fact of args.factGraph.facts) {
    const textOccurrences = numericOccurrences(fact.text);
    const sourceOccurrences =
      textOccurrences.length > 0
        ? textOccurrences.map((occurrence) => ({
            occurrence,
            value: fact.text,
          }))
        : fact.metrics.flatMap((metric) =>
            numericOccurrences(metric).map((occurrence) => ({
              occurrence,
              value: metric,
            })),
          );
    for (const { occurrence, value } of sourceOccurrences) {
      sources.push(
        sourceFromOccurrence({
          occurrence,
          value,
          sourceId: fact.id,
          factId: fact.id,
          owner: fact.source === "cv" ? "CANDIDATE" : "JOB_CONTEXT",
          baseReason:
            fact.source === "cv" ? "candidate_fact_source" : "job_context_source",
          claimIds: claimIdsForSource(args.claimPlan, fact.id, "fact"),
          entities: fact.entities,
        }),
      );
    }
  }

  for (const demand of args.jobDemandGraph.demands) {
    for (const occurrence of numericOccurrences(demand.text)) {
      sources.push(
        sourceFromOccurrence({
          occurrence,
          value: demand.text,
          sourceId: demand.id,
          demandId: demand.id,
          owner: "JOB_CONTEXT",
          baseReason: "job_context_source",
          claimIds: claimIdsForSource(args.claimPlan, demand.id, "demand"),
        }),
      );
    }
  }

  const targetEmployer = args.targetEmployer ?? MISSING_TARGET_EMPLOYER;
  if (targetEmployer.status === "RESOLVED") {
    for (const occurrence of numericOccurrences(targetEmployer.canonicalName)) {
      sources.push({
        sourceId: `target_employer:${targetEmployer.normalizedName}`,
        claimIds: [],
        role: "EMPLOYER",
        owner: "TARGET_EMPLOYER",
        normalizedValue: occurrence.normalizedValue,
        key: occurrence.key,
        baseKey: occurrence.baseKey,
        measurement: occurrence.measurement,
        sourceSpan: {
          start: occurrence.index,
          end: occurrence.end,
          text: targetEmployer.canonicalName.slice(occurrence.index, occurrence.end),
        },
        entityText: targetEmployer.displayName,
        reasonCodes: ["resolved_target_employer"],
      });
    }
  }

  return Object.freeze({
    version: "premium_cover_letter_numeric_evidence_v1",
    sources: Object.freeze(sources.map((source) => Object.freeze(source))),
    targetEmployer,
  });
}

function sourceIsAvailable(args: {
  source: PremiumCoverLetterNumericEvidenceSource;
  factIds: ReadonlySet<string>;
  demandIds: ReadonlySet<string>;
  visibleText: string;
  occurrence: NumericOccurrence;
  targetEmployer: TargetEmployerResolution;
}): boolean {
  if (args.source.owner === "TARGET_EMPLOYER") {
    return (
      targetEmployerOwnsOccurrence({
        value: args.visibleText,
        occurrenceIndex: args.occurrence.index,
        targetEmployer: args.targetEmployer,
      }) ||
      (args.targetEmployer.status === "RESOLVED" &&
        Boolean(
          entityCoveringOccurrence(
            args.visibleText,
            args.occurrence,
            args.targetEmployer.aliases,
          ),
        ))
    );
  }
  if (args.source.factId) return args.factIds.has(args.source.factId);
  if (args.source.demandId) return args.demandIds.has(args.source.demandId);
  return false;
}

function sourceMatchesOccurrence(
  source: PremiumCoverLetterNumericEvidenceSource,
  occurrence: NumericOccurrence,
  visibleText: string,
  allowMeasurementTranslation: boolean,
): boolean {
  if (source.baseKey !== occurrence.baseKey) return false;
  const prefix = visibleText.slice(
    Math.max(0, occurrence.index - 32),
    occurrence.index,
  );
  if (source.role === "EMPLOYER") return true;
  if (source.role === "PROPER_NAME") {
    return Boolean(
      source.entityText &&
        entityCoveringOccurrence(visibleText, occurrence, [source.entityText]),
    );
  }
  const explicitVisibleRole = explicitContextRoleForOccurrence(
    visibleText,
    occurrence,
  );
  if (explicitVisibleRole && explicitVisibleRole !== source.role) return false;
  if (source.role === "DURATION") {
    const visibleUnit =
      durationUnitForOccurrence(visibleText, occurrence) ??
      (allowMeasurementTranslation
        ? translatedDurationUnitForOccurrence(visibleText, occurrence)
        : undefined);
    return Boolean(
      source.contextQualifier &&
        visibleUnit &&
        source.contextQualifier === visibleUnit,
    );
  }
  if (source.role === "JOB_LEVEL") {
    return /\b(?:level|grade|tier)\s*[-–—:]?\s*$/iu.test(prefix);
  }
  if (source.role === "VERSION") {
    const visibleQualifier = versionQualifierForOccurrence(visibleText, occurrence);
    return Boolean(
      source.contextQualifier &&
        visibleQualifier &&
        source.contextQualifier === visibleQualifier,
    );
  }
  if (source.role === "DATE") {
    return hasDateContextForOccurrence(visibleText, occurrence);
  }
  if (source.key === occurrence.key) return true;
  if (allowMeasurementTranslation) {
    const translatedMeasurement = translatedMetricMeasurementForOccurrence(
      visibleText,
      occurrence,
    );
    if (translatedMeasurement) {
      return Boolean(
        source.measurement &&
          translatedMeasurement === source.measurement,
      );
    }
    return Boolean(source.measurement && occurrence.measurement);
  }
  if (!source.measurement || !occurrence.measurement) return true;
  return false;
}

function sourceIsAuthorizedForMatch(args: {
  source: PremiumCoverLetterNumericEvidenceSource;
  requiredOwner?: PremiumCoverLetterNumericEvidenceOwner;
}): boolean {
  if (args.requiredOwner) return args.source.owner === args.requiredOwner;
  if (args.source.role === "EMPLOYER") {
    return args.source.owner === "TARGET_EMPLOYER";
  }
  return args.source.owner === "CANDIDATE";
}

export function matchPremiumCoverLetterNumericEvidence(args: {
  projection: PremiumCoverLetterNumericEvidenceProjection;
  visibleText: string;
  section: ClaimPlanSection;
  factIds: readonly string[];
  demandIds: readonly string[];
  claimIds: readonly string[];
  requiredOwner?: PremiumCoverLetterNumericEvidenceOwner;
  allowMeasurementTranslation?: boolean;
}): PremiumCoverLetterNumericEvidenceMatchResult {
  const factIds = new Set(args.factIds);
  const demandIds = new Set(args.demandIds);
  const matches: PremiumCoverLetterNumericEvidenceMatch[] = [];
  const unsupported: PremiumCoverLetterUnsupportedNumericEvidence[] = [];

  for (const occurrence of numericOccurrences(args.visibleText)) {
    const availableSources = args.projection.sources.filter((source) =>
      sourceIsAvailable({
        source,
        factIds,
        demandIds,
        visibleText: args.visibleText,
        occurrence,
        targetEmployer: args.projection.targetEmployer,
      }),
    );
    let matchingSources = availableSources.filter((source) =>
      sourceMatchesOccurrence(
        source,
        occurrence,
        args.visibleText,
        args.allowMeasurementTranslation ?? false,
      ),
    );
    if (
      matchingSources.length === 0 &&
      GENERIC_PERCENTAGE_MEASUREMENTS.has(occurrence.measurement)
    ) {
      const sameBaseSources = availableSources.filter(
        (source) => source.baseKey === occurrence.baseKey,
      );
      const measuredKeys = new Set(
        sameBaseSources
          .filter((source) => source.key !== source.baseKey)
          .map((source) => source.key),
      );
      if (measuredKeys.size === 1) matchingSources = sameBaseSources;
    }
    const ownerMatches = matchingSources.filter((source) =>
      sourceIsAuthorizedForMatch({
        source,
        requiredOwner: args.requiredOwner,
      }),
    );
    const visibleSpan = {
      start: occurrence.index,
      end: occurrence.end,
      text: args.visibleText.slice(occurrence.index, occurrence.end),
    };

    if (ownerMatches.length === 0) {
      const reasons: PremiumCoverLetterNumericEvidenceReasonCode[] = [];
      if (matchingSources.length > 0) reasons.push("owner_mismatch");
      if (args.claimIds.length > 0 && factIds.size === 0 && demandIds.size === 0) {
        reasons.push("claim_id_not_source_provenance");
      }
      if (availableSources.length === 0) reasons.push("source_provenance_missing");
      reasons.push("visible_numeric_unknown");
      unsupported.push({
        section: args.section,
        role: "UNKNOWN",
        ...(matchingSources[0]?.owner ? { owner: matchingSources[0].owner } : {}),
        normalizedValue: occurrence.normalizedValue,
        key: occurrence.key,
        visibleSpan,
        reasonCodes: [...new Set(reasons)],
      });
      continue;
    }

    for (const source of ownerMatches) {
      const variantReason =
        source.sourceSpan.text.toLocaleLowerCase("en-US") ===
        visibleSpan.text.toLocaleLowerCase("en-US")
          ? "normalized_exact"
          : source.sourceSpan.text.replace(/[-–—\s]/gu, "").toLocaleLowerCase("en-US") ===
              visibleSpan.text.replace(/[-–—\s]/gu, "").toLocaleLowerCase("en-US")
            ? "normalized_hyphen_variant"
            : "normalized_numeric_variant";
      matches.push({
        section: args.section,
        role: source.role,
        owner: source.owner,
        normalizedValue: source.normalizedValue,
        key: source.key,
        ...(source.factId ? { factId: source.factId } : {}),
        ...(source.demandId ? { demandId: source.demandId } : {}),
        sourceSpan: source.sourceSpan,
        visibleSpan,
        reasonCodes: [...source.reasonCodes, variantReason],
      });
    }
  }

  return { matches, unsupported };
}

export function numericEvidenceNormalizedValues(value: string): string[] {
  return numericOccurrences(value).map((occurrence) => {
    const role = explicitContextRoleForOccurrence(value, occurrence) ?? "METRIC";
    const qualifier =
      role === "DURATION"
        ? durationUnitForOccurrence(value, occurrence)
        : role === "VERSION"
          ? versionQualifierForOccurrence(value, occurrence)
          : undefined;
    return [role, occurrence.baseKey, qualifier].filter(Boolean).join(":");
  });
}

const FACT_GRAPH_PERCENTAGE_PATTERN =
  /\b\d[\d,]*(?:\.\d+)?\s*(?:%|percent|percentage\s+points?)\b/gi;
const FACT_GRAPH_DIGIT_PATTERN = /\b\d[\d,]*(?:\.\d+)?\b/g;
const FACT_GRAPH_WORD_DURATION_PATTERN =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:day|days|week|weeks|month|months|year|years)\b/gi;

function normalizeFactGraphNumericMetric(value: string): string {
  return normalizeText(value)
    .replace(/percentage\s+points?/g, "percent")
    .replace(/%/g, " percent")
    .replace(
      /\d[\d,]*(?:\.\d+)?/gu,
      normalizePremiumCoverLetterNumericToken,
    );
}

/**
 * Preserves the existing FactGraphV1 metrics representation while keeping
 * numeric parsing out of premiumCoverLetter.ts. Role/owner classification is
 * intentionally not performed here; the projection owns that decision once.
 */
export function premiumCoverLetterFactGraphNumericMetrics(
  value: string,
): string[] {
  return [
    ...new Set(
      [
        ...value.matchAll(FACT_GRAPH_PERCENTAGE_PATTERN),
        ...value.matchAll(FACT_GRAPH_DIGIT_PATTERN),
        ...value.matchAll(FACT_GRAPH_WORD_DURATION_PATTERN),
      ].map((match) => normalizeFactGraphNumericMetric(match[0])),
    ),
  ];
}

export function isPremiumCoverLetterNumericLexeme(value: string): boolean {
  const normalized = normalizeText(value);
  return (
    numericOccurrences(normalized).length > 0 ||
    WRITTEN_NUMBER_UNITS.has(normalized) ||
    WRITTEN_NUMBER_TENS.has(normalized) ||
    WRITTEN_NUMBER_SCALES.has(normalized)
  );
}
