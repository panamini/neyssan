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
const WRITTEN_NUMBER_PATTERN =
  /\b((?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)|(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))?))(?:\s+(percent)\b)?/giu;
const NON_QUANTITATIVE_WRITTEN_NUMBER_MEASUREMENTS = new Set([
  "example",
  "reason",
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
    return (
      /[\p{Lu}\p{N}"'“‘(]/u.test(nextCharacter) ||
      startsWithLowercaseStyledProperNoun(args.value.slice(end))
    );
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
  index: number;
}>;

type SourceMetricFacts = Readonly<{
  factIdsByKey: Map<string, Set<string>>;
  baseKeysWithUnmeasuredSource: Set<string>;
}>;

function numericMagnitudeMultiplier(suffix: string): number {
  switch (suffix) {
    case "k":
    case "thousand":
      return 1_000;
    case "m":
    case "million":
      return 1_000_000;
    case "b":
    case "billion":
      return 1_000_000_000;
    default:
      return 1;
  }
}

function canonicalMetricMeasurement(value: string): string {
  const canonical = canonicalizePremiumCoverLetterNoun(value);
  return METRIC_MEASUREMENT_ALIASES.get(canonical) ?? canonical;
}

function metricCurrency(symbol: string): "usd" | "eur" | "gbp" | null {
  switch (symbol.toLowerCase()) {
    case "$":
    case "usd":
      return "usd";
    case "€":
    case "eur":
      return "eur";
    case "£":
    case "gbp":
      return "gbp";
    default:
      return null;
  }
}

function isPlainToolVersion(args: {
  prefix: string;
  sign: string;
  suffix: string;
  currency: "usd" | "eur" | "gbp" | null;
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
  currency: "usd" | "eur" | "gbp" | null;
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
  return ["-", "minus", "negative"].includes(sign.toLowerCase()) ? -1 : 1;
}

function metricMeasurement(args: {
  value: string;
  end: number;
  percentage: boolean;
}): string {
  if (args.percentage) return "";
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
        /(?:ed|en|ing)$/iu.test(token)),
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
  currency: "usd" | "eur" | "gbp" | null;
  percentage: boolean;
  multiplier: boolean;
}): string {
  if (args.currency) return args.currency;
  if (args.multiplier) return "multiplier";
  return args.percentage ? "percent" : "number";
}

function metricLabel(args: {
  value: number;
  percentage: boolean;
  multiplier: boolean;
}): string {
  if (args.percentage) return `${args.value}%`;
  if (args.multiplier) return `${args.value}x`;
  return String(args.value);
}

function normalizeNumericTokenOccurrence(args: {
  value: string;
  match: RegExpMatchArray;
}): NumericTokenOccurrence | null {
  const index = args.match.index ?? 0;
  const prefix = args.value.slice(Math.max(0, index - 16), index);
  const sign = args.match[1] ?? "";
  const suffix = (args.match[4] ?? "").toLowerCase();
  const currency = metricCurrency(args.match[2] || args.match[5] || "");
  if (isIgnoredNumericOccurrence({ prefix, sign, suffix, currency })) {
    return null;
  }

  const numericValue = Number(args.match[3].replace(/,/g, ""));
  const metricValue =
    numericValue *
    numericSignMultiplier(sign, prefix) *
    numericMagnitudeMultiplier(suffix);
  const percentage = suffix === "%" || suffix === "percent";
  const multiplier = suffix === "x" || suffix === "×";
  const end = index + args.match[0].length;
  const measurement = metricMeasurement({
    value: args.value,
    end,
    percentage,
  });
  const metric = metricLabel({
    value: metricValue,
    percentage,
    multiplier,
  });
  const baseKey = [
    metricUnit({ currency, percentage, multiplier }),
    metricValue,
  ].join(":");
  return {
    metric,
    baseKey,
    key: [baseKey, measurement]
      .filter((part) => part !== "")
      .join(":"),
    index,
  };
}

function writtenNumberValue(value: string): number | null {
  const parts = value.toLowerCase().split(/[-\s]+/u);
  const unit = WRITTEN_NUMBER_UNITS.get(parts[0]);
  if (unit !== undefined) return unit;
  const tens = WRITTEN_NUMBER_TENS.get(parts[0]);
  if (tens === undefined) return null;
  return tens + (WRITTEN_NUMBER_UNITS.get(parts[1] ?? "") ?? 0);
}

function writtenNumericTokenOccurrences(
  value: string,
): NumericTokenOccurrence[] {
  return Array.from(value.matchAll(WRITTEN_NUMBER_PATTERN)).flatMap((match) => {
    const metricValue = writtenNumberValue(match[1]);
    if (metricValue === null) return [];
    const percentage = Boolean(match[2]);
    const index = match.index ?? 0;
    const end = index + match[0].length;
    if (/^\s+(?:hundred|thousand|million|billion)\b/iu.test(value.slice(end))) {
      return [];
    }
    const measurement = metricMeasurement({ value, end, percentage });
    const immediateMeasurement =
      value
        .slice(end)
        .match(/^\s*([A-Za-z][A-Za-z-]*)/u)?.[1]
        .toLowerCase() ?? "";
    if (
      !percentage &&
      (!measurement ||
        value[end] === "-" ||
        NON_QUANTITATIVE_WRITTEN_NUMBER_MEASUREMENTS.has(
          canonicalMetricMeasurement(immediateMeasurement),
        ))
    ) {
      return [];
    }
    const baseKey = [
      metricUnit({ currency: null, percentage, multiplier: false }),
      metricValue,
    ].join(":");
    return [
      {
        metric: metricLabel({
          value: metricValue,
          percentage,
          multiplier: false,
        }),
        baseKey,
        key: [baseKey, measurement]
          .filter((part) => part !== "")
          .join(":"),
        index,
      },
    ];
  });
}

function numericTokenOccurrences(value: string): NumericTokenOccurrence[] {
  const tokens: NumericTokenOccurrence[] = [];
  for (const match of value
    .matchAll(
      /(?<![A-Za-z0-9])([+-]|minus\b|negative\b|plus\b|positive\b)?\s*((?:USD|EUR|GBP|[$€£])?)\s*(\d[\d,]*(?:\.\d+)?)\s*(%|percent\b|[KMB]\b|thousand\b|million\b|billion\b|[x×])?(?:\s*((?:USD|EUR|GBP)\b))?(?![A-Za-z0-9])/gi,
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
          .split(/[^A-Za-z0-9%]+/u)
          .filter(Boolean);
        const canonicalEntityToken =
          entityTokens.length === 1
            ? canonicalizePremiumCoverLetterToken(entityTokens[0])
            : "";
        const firstFactToken = fact.text
          .normalize("NFKC")
          .match(/[A-Za-z0-9%]+/u)?.[0];
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
        /(?:^|[^\p{L}\p{N}_])((?:C\+\+|C#|R|Go))(?=$|[^\p{L}\p{N}_+#])/gu,
      ),
      (match) => match[1].toLowerCase(),
    ),
  );
  return new Set(
    technologyAnchors.concat(
      values
        .flatMap((value) => value.normalize("NFKC").split(/[^A-Za-z0-9%]+/u))
        .map((token) => ({
          normalized: token.toLowerCase(),
          shortAcronym: /^[A-Z][A-Z0-9]{1,3}$/u.test(token),
        }))
        .flatMap(({ normalized, shortAcronym }) =>
          (
            (normalized.length >= 4 || shortAcronym) &&
            !numericTokens(normalized).length &&
            !EVIDENCE_ANCHOR_STOP_WORDS.has(normalized)
          )
            ? [canonicalizePremiumCoverLetterToken(normalized)]
            : [],
        ),
    ),
  );
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
    const textMetrics = numericTokenOccurrences(fact.text);
    const metrics =
      textMetrics.length > 0
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
  for (const { occurrence, sourceId } of sourceMetricOccurrences(args)) {
    for (const key of new Set([occurrence.key, occurrence.baseKey])) {
      const supportingFactIds = factIdsByMetric.get(key) ?? new Set<string>();
      supportingFactIds.add(sourceId);
      factIdsByMetric.set(key, supportingFactIds);
    }
    if (occurrence.key === occurrence.baseKey) {
      baseKeysWithUnmeasuredSource.add(occurrence.baseKey);
    }
  }
  return {
    factIdsByKey: factIdsByMetric,
    baseKeysWithUnmeasuredSource,
  };
}

function isLikelyUnlistedFinitePredicate(args: {
  tokens: readonly string[];
  token: string;
  index: number;
}): boolean {
  if (args.index !== 0 || args.tokens.length < 4) return false;
  if (FINITE_PREDICATE_BLOCKERS.has(args.token)) return false;
  if (
    /(?:ing|tion|ment|ity|ness|ance|ence|ship|ure|age|ery|ory|ism)$/u.test(
      args.token,
    )
  ) {
    return false;
  }
  const followingToken = args.tokens[args.index + 3];
  if (!followingToken || FINITE_PREDICATE_BLOCKERS.has(followingToken)) {
    return false;
  }
  if (/(?:e|s|ify|ise|ize|ate)$/u.test(args.token)) return true;
  return (
    args.tokens[1]?.endsWith("s") === true && /^[a-z]+$/u.test(args.token)
  );
}

function isFinitePredicateCandidate(args: {
  tokens: readonly string[];
  token: string;
  index: number;
}): boolean {
  const canonicalToken = canonicalizePremiumCoverLetterToken(args.token);
  if (FINITE_PREDICATE_TOKENS.has(canonicalToken)) return true;
  if (
    /(?:ed|en)$/u.test(args.token) &&
    (args.index === 0 ||
      ["that", "which", "who"].includes(args.tokens[args.index + 1]))
  ) {
    return true;
  }
  return isLikelyUnlistedFinitePredicate(args);
}

function isVerbLedFragment(normalizedSentence: string): boolean {
  if (!VERB_LED_FRAGMENT_PATTERN.test(normalizedSentence)) return false;
  const tokens = normalizedSentence.split(/[^a-z0-9]+/u).filter(Boolean);
  const hasLaterFinitePredicate = tokens
    .slice(2)
    .some((token, index) =>
      isFinitePredicateCandidate({ tokens, token, index }),
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
      if (isVerbLedFragment(normalizedSentence)) {
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

    const sourceMetricFacts = sourceMetricFactIds({
      factIds: part.factIds,
      demandIds: part.demandIds,
      factGraph: args.factGraph,
      jobDemandGraph: args.jobDemandGraph,
    });
    const employerGroundingFactIds =
      part.factIds.length > 0
        ? part.factIds
        : assignedClaim?.factIds ?? [];
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
        entityAnchors.has(token),
      );
      if (
        anchorOverlapCount < 2 &&
        !hasDistinctiveLexicalAnchor &&
        !hasDistinctiveEntityAnchor
      ) {
        pushUnique(issues, {
          code: "employer_value_not_grounded",
          section,
        });
      }
    }
    for (const occurrence of numericTokenOccurrences(text)) {
      const { key, metric } = occurrence;
      const resolvedMetricKey = sourceMetricFacts.factIdsByKey.has(key)
        ? key
        : (
              key === occurrence.baseKey ||
              sourceMetricFacts.baseKeysWithUnmeasuredSource.has(
                occurrence.baseKey,
              )
            ) &&
            sourceMetricFacts.factIdsByKey.has(occurrence.baseKey)
          ? occurrence.baseKey
          : key;
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
