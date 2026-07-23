import type { ClaimPlanSection } from "./premiumCoverLetter";

export type PremiumCoverLetterEnglishProseClassification =
  | "VALID"
  | "INVALID"
  | "UNKNOWN";

export type PremiumCoverLetterEnglishProseConfidence =
  | "high"
  | "medium"
  | "low";

export type PremiumCoverLetterEnglishProseSentenceForm =
  | "declarative"
  | "imperative"
  | "fragment"
  | "unknown";

export type PremiumCoverLetterEnglishProseReasonCode =
  | "ambiguous_clause_structure"
  | "bounded_infinitive"
  | "coordinated_subject"
  | "finite_predicate"
  | "fronted_subordinate_fragment"
  | "imperative_form"
  | "main_finite_predicate_after_infinitive"
  | "missing_finite_predicate"
  | "modified_subject"
  | "prepositional_subject_fragment"
  | "relative_clause"
  | "semicolon_clause_fragment"
  | "simple_subject"
  | "standalone_subordinate_fragment"
  | "verb_led_fragment";

export type PremiumCoverLetterEnglishProseSpan = Readonly<{
  start: number;
  end: number;
}>;

export type PremiumCoverLetterEnglishProseAnalysis = Readonly<{
  section: ClaimPlanSection;
  text: string;
  sentenceSpan: PremiumCoverLetterEnglishProseSpan;
  classification: PremiumCoverLetterEnglishProseClassification;
  confidence: PremiumCoverLetterEnglishProseConfidence;
  reasonCodes: readonly PremiumCoverLetterEnglishProseReasonCode[];
  subjectSpan: PremiumCoverLetterEnglishProseSpan | null;
  finitePredicateSpan: PremiumCoverLetterEnglishProseSpan | null;
  infinitiveSpans: readonly PremiumCoverLetterEnglishProseSpan[];
  relativePredicateSpans: readonly PremiumCoverLetterEnglishProseSpan[];
  sentenceForm: PremiumCoverLetterEnglishProseSentenceForm;
}>;

type SentenceSegment = Readonly<{
  text: string;
  start: number;
  end: number;
}>;

type ProseToken = Readonly<{
  surface: string;
  canonical: string;
  start: number;
  end: number;
}>;

type TokenRange = Readonly<{
  startIndex: number;
  endIndex: number;
}>;

type SubjectAgreement =
  | "base"
  | "third_person_singular"
  | "unknown";

const TITLE_PERIOD_ABBREVIATION_PATTERN =
  /\b(?:dr|mr|mrs|ms|prof|sr|jr|st|no|fig)\.$/iu;
const CONTEXTUAL_PERIOD_ABBREVIATION_PATTERN =
  /\b(?:etc|vs|approx|dept|co|corp|inc|ltd|llc|plc|gmbh|e\.g|i\.e|u\.s|u\.k)\.$/iu;
const DOTTED_INITIALISM_CONTINUATION_PATTERN = /\b(?:[A-Z]\.){2,}$/u;
const DOTTED_INITIALISM_ENTITY_PREFIX_PATTERN =
  /\b(?:at|for|from|to|with|joined|consulted)\s+(?:[A-Z]\.){2,}$/u;
const LOWERCASE_STYLED_SENTENCE_STARTERS = new Set(["npm"]);

const VERB_LED_PARTICIPLES = new Set([
  "built",
  "coordinated",
  "created",
  "documented",
  "handled",
  "improved",
  "led",
  "maintained",
  "managed",
  "reduced",
  "reported",
  "supported",
  "tracked",
  "worked",
]);

const FINITE_AUXILIARIES = new Set([
  "am",
  "are",
  "can",
  "could",
  "did",
  "do",
  "does",
  "had",
  "has",
  "have",
  "is",
  "may",
  "might",
  "must",
  "shall",
  "should",
  "was",
  "were",
  "will",
  "would",
]);
const INFINITIVE_AUXILIARIES = new Set(["be", "do", "have"]);

const FINITE_LEXICAL_FORMS = new Set([
  "built",
  "coordinate",
  "coordinated",
  "coordinates",
  "deliver",
  "delivered",
  "delivers",
  "depend",
  "depends",
  "drive",
  "drives",
  "enable",
  "enables",
  "ensure",
  "ensures",
  "grew",
  "help",
  "helps",
  "improve",
  "improved",
  "improves",
  "keep",
  "keeps",
  "led",
  "manage",
  "managed",
  "manages",
  "matter",
  "matters",
  "remain",
  "remains",
  "review",
  "reviewed",
  "reviews",
  "scale",
  "scales",
  "ship",
  "shipped",
  "ships",
  "support",
  "supported",
  "supports",
  "sustain",
  "sustains",
  "work",
  "worked",
  "works",
  "adapts",
  "emphasizes",
  "foster",
  "flourished",
  "offer",
  "strengthened",
  "sustained",
  "thrive",
  "yield",
]);

const BASE_INFINITIVE_VERBS = new Set([
  "build",
  "coordinate",
  "deliver",
  "drive",
  "enable",
  "ensure",
  "grow",
  "help",
  "improve",
  "keep",
  "make",
  "manage",
  "reduce",
  "report",
  "review",
  "scale",
  "ship",
  "support",
  "sustain",
  "work",
]);

const ADDITIONAL_FINITE_BASE_FORMS = new Set([
  "depend",
  "foster",
  "matter",
  "offer",
  "remain",
  "thrive",
  "yield",
]);

const IMPERATIVE_VERBS = new Set([
  "apply",
  "bring",
  "consider",
  "coordinate",
  "deliver",
  "ensure",
  "keep",
  "review",
  "share",
  "submit",
  "support",
]);

const RELATIVE_MARKERS = new Set(["that", "which", "who"]);
const CLAUSE_COORDINATORS = new Set(["and", "but", "or", "yet"]);
const INFINITIVE_BOUNDARIES = new Set([
  "although",
  "because",
  "if",
  "unless",
  "when",
  "whereas",
  "while",
]);
const SUBJECT_DETERMINERS = new Set([
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
  "those",
  "your",
]);
const SUBJECT_PRONOUNS = new Set([
  "he",
  "i",
  "it",
  "she",
  "they",
  "we",
  "you",
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

function buildSentenceSegment(
  value: string,
  start: number,
  end: number,
): SentenceSegment | null {
  const surface = value.slice(start, end);
  const leadingWhitespace = surface.match(/^\s*/u)?.[0].length ?? 0;
  const text = surface.trim();
  if (!text) return null;
  return {
    text,
    start: start + leadingWhitespace,
    end: start + leadingWhitespace + text.length,
  };
}

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
  if (startsWithLowercaseStyledProperNoun(args.remainingText)) return false;
  return (
    /\b(?:u\.s|u\.k)\.$/iu.test(args.textThroughPunctuation) &&
    /^\s*(?:(?:Bank|Bancorp|Airways|Airlines|Army|Navy|Department|Government|Steel)\b|[a-z]+\b)/u.test(
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

function isSentenceBoundary(args: {
  value: string;
  punctuationIndex: number;
  punctuationSurface: string;
}): boolean {
  const end = args.punctuationIndex + args.punctuationSurface.length;
  const nextCharacter = args.value.slice(end).match(/\S/u)?.[0];
  if (!nextCharacter || /[!?]/u.test(args.punctuationSurface)) return true;
  const punctuationLength =
    args.punctuationSurface.match(/^[.!?]+/u)?.[0].length ?? 0;
  const textThroughPunctuation = args.value.slice(
    0,
    args.punctuationIndex + punctuationLength,
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

function segmentSentences(value: string): SentenceSegment[] {
  const segments: SentenceSegment[] = [];
  let start = 0;
  for (const match of value.matchAll(
    /[.!?]+(?:["'”’»)\]}]+)?(?=\s|$)/gu,
  )) {
    const punctuationIndex = match.index ?? start;
    if (
      !isSentenceBoundary({
        value,
        punctuationIndex,
        punctuationSurface: match[0],
      })
    )
      continue;
    const end = punctuationIndex + match[0].length;
    const segment = buildSentenceSegment(value, start, end);
    if (segment) segments.push(segment);
    start = end;
  }
  const trailing = buildSentenceSegment(value, start, value.length);
  if (trailing) segments.push(trailing);
  return segments;
}

function tokenize(segment: SentenceSegment): ProseToken[] {
  const tokens: ProseToken[] = [];
  for (const match of segment.text.matchAll(
    /(?:Co|Corp|Inc|Ltd|LLC)\.|(?:[A-Za-z]\.){2,}|[A-Za-z]+(?:[-’'][A-Za-z]+)*(?:[’'])?/giu,
  )) {
    const localStart = match.index ?? 0;
    const surface = match[0];
    tokens.push({
      surface,
      canonical: surface.normalize("NFKC").toLowerCase(),
      start: segment.start + localStart,
      end: segment.start + localStart + surface.length,
    });
  }
  return tokens;
}

function isFiniteVerbForm(
  tokens: readonly ProseToken[],
  index: number,
): boolean {
  const token = tokens[index];
  if (!token) return false;
  const previous = tokens[index - 1]?.canonical ?? "";
  if (previous === "to") return false;
  if (
    FINITE_AUXILIARIES.has(token.canonical) ||
    FINITE_LEXICAL_FORMS.has(token.canonical) ||
    isFiniteBaseForm(token.canonical)
  ) {
    return true;
  }
  if (index === 0 || !/(?:ed|en)$/u.test(token.canonical)) return false;
  return (
    !SUBJECT_DETERMINERS.has(previous) &&
    !PREPOSITIONAL_FRAGMENT_STARTERS.has(previous)
  );
}

function isInfinitiveHead(canonical: string): boolean {
  return (
    BASE_INFINITIVE_VERBS.has(canonical) ||
    INFINITIVE_AUXILIARIES.has(canonical)
  );
}

function isFiniteBaseForm(canonical: string): boolean {
  return (
    BASE_INFINITIVE_VERBS.has(canonical) ||
    ADDITIONAL_FINITE_BASE_FORMS.has(canonical)
  );
}

function isThirdPersonSingularFiniteForm(canonical: string): boolean {
  return (
    FINITE_LEXICAL_FORMS.has(canonical) &&
    canonical.endsWith("s") &&
    !/(?:ss|us|is)$/u.test(canonical)
  );
}

function hasPossessiveEnding(canonical: string): boolean {
  return /(?:['’]s|['’])$/u.test(canonical);
}

function subjectAgreementTokens(
  subjectTokens: readonly ProseToken[],
): readonly ProseToken[] {
  let endIndex = subjectTokens.length;
  while (
    endIndex > 0 &&
    /ly$/u.test(subjectTokens[endIndex - 1]?.canonical ?? "")
  ) {
    endIndex -= 1;
  }
  return subjectTokens.slice(0, endIndex);
}

function inferSubjectAgreement(
  subjectTokens: readonly ProseToken[],
): SubjectAgreement {
  const agreementTokens = subjectAgreementTokens(subjectTokens);
  const subjectHead = agreementTokens.at(-1);
  if (!subjectHead || hasPossessiveEnding(subjectHead.canonical)) {
    return "unknown";
  }
  const coordinatorIndex = agreementTokens.findIndex(
    (token) => token.canonical === "and",
  );
  if (
    coordinatorIndex > 0 &&
    coordinatorIndex < agreementTokens.length - 1
  ) {
    return "base";
  }
  if (
    ["i", "you", "we", "they"].includes(subjectHead.canonical)
  ) {
    return "base";
  }
  if (["he", "it", "she"].includes(subjectHead.canonical)) {
    return "third_person_singular";
  }
  const subjectDeterminers = agreementTokens
    .slice(0, -1)
    .map((token) => token.canonical);
  if (
    subjectDeterminers.some((canonical) =>
      ["a", "an", "this"].includes(canonical),
    )
  ) {
    return "third_person_singular";
  }
  if (
    subjectDeterminers.some((canonical) => canonical === "those")
  ) {
    return "base";
  }
  if (/ics$/u.test(subjectHead.canonical)) return "unknown";
  if (
    subjectHead.canonical.endsWith("s") &&
    !/(?:['’]s|ss|us|is)$/u.test(subjectHead.canonical)
  ) {
    return "base";
  }
  return "third_person_singular";
}

function hasPlausibleSubjectTokens(args: {
  subjectTokens: readonly ProseToken[];
  predicateCanonical: string;
}): boolean {
  if (args.subjectTokens.length === 0) return false;
  if (
    PREPOSITIONAL_FRAGMENT_STARTERS.has(
      args.subjectTokens[0]?.canonical ?? "",
    )
  ) {
    return false;
  }
  const agreementTokens = subjectAgreementTokens(args.subjectTokens);
  const subjectHead = agreementTokens.at(-1);
  if (
    !subjectHead ||
    CLAUSE_COORDINATORS.has(subjectHead.canonical)
  ) {
    return false;
  }
  const contentTokens = args.subjectTokens.filter(
    (token) =>
      !SUBJECT_DETERMINERS.has(token.canonical) &&
      !PREPOSITIONAL_FRAGMENT_STARTERS.has(token.canonical) &&
      !RELATIVE_MARKERS.has(token.canonical) &&
      !CLAUSE_COORDINATORS.has(token.canonical),
  );
  if (contentTokens.length === 0) return false;
  if (hasPossessiveEnding(subjectHead.canonical)) return false;
  const agreement = inferSubjectAgreement(args.subjectTokens);
  if (isFiniteBaseForm(args.predicateCanonical)) {
    return agreement === "base";
  }
  if (isThirdPersonSingularFiniteForm(args.predicateCanonical)) {
    return agreement === "third_person_singular";
  }
  return true;
}

function hasPlausibleRelativeSubject(args: {
  tokens: readonly ProseToken[];
  markerIndex: number;
  predicateIndex: number;
}): boolean {
  if (args.predicateIndex === args.markerIndex + 1) return true;
  if (args.predicateIndex <= args.markerIndex + 1) return false;
  return hasPlausibleSubjectTokens({
    subjectTokens: args.tokens.slice(
      args.markerIndex + 1,
      args.predicateIndex,
    ),
    predicateCanonical:
      args.tokens[args.predicateIndex]?.canonical ?? "",
  });
}

function hasPlausibleClauseStartingAt(args: {
  tokens: readonly ProseToken[];
  startIndex: number;
}): boolean {
  const subjectStartIndex = CLAUSE_COORDINATORS.has(
    args.tokens[args.startIndex]?.canonical ?? "",
  )
    ? args.startIndex + 1
    : args.startIndex;
  for (
    let predicateIndex = subjectStartIndex + 1;
    predicateIndex < args.tokens.length;
    predicateIndex += 1
  ) {
    if (!isFiniteVerbForm(args.tokens, predicateIndex)) continue;
    if (
      hasPlausibleSubjectTokens({
        subjectTokens: args.tokens.slice(
          subjectStartIndex,
          predicateIndex,
        ),
        predicateCanonical:
          args.tokens[predicateIndex]?.canonical ?? "",
      })
    ) {
      return true;
    }
  }
  return false;
}

function findInfinitiveRanges(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
}): TokenRange[] {
  const ranges: TokenRange[] = [];
  for (let index = 0; index < args.tokens.length - 1; index += 1) {
    if (
      args.tokens[index]?.canonical !== "to" ||
      !isInfinitiveHead(
        args.tokens[index + 1]?.canonical ?? "",
      )
    ) {
      continue;
    }
    let endIndex = args.tokens.length - 1;
    let infinitivePredicateIndex = index + 1;
    for (
      let cursor = index + 2;
      cursor < args.tokens.length;
      cursor += 1
    ) {
      const token = args.tokens[cursor];
      if (!token) continue;
      if (INFINITIVE_BOUNDARIES.has(token.canonical)) {
        endIndex = cursor - 1;
        break;
      }
      if (
        CLAUSE_COORDINATORS.has(token.canonical) &&
        hasPlausibleClauseStartingAt({
          tokens: args.tokens,
          startIndex: cursor,
        })
      ) {
        endIndex = cursor - 1;
        break;
      }
      if (FINITE_AUXILIARIES.has(token.canonical)) {
        endIndex = cursor - 1;
        break;
      }
      if (
        cursor === index + 2 &&
        INFINITIVE_AUXILIARIES.has(
          args.tokens[index + 1]?.canonical ?? "",
        )
      ) {
        infinitivePredicateIndex = cursor;
        continue;
      }
      const subjectTokensBeforeInfinitive = args.tokens.slice(0, index);
      if (
        isFiniteVerbForm(args.tokens, cursor) &&
        !CLAUSE_COORDINATORS.has(
          args.tokens[cursor - 1]?.canonical ?? "",
        )
      ) {
        const localSubjectTokens = args.tokens.slice(
          infinitivePredicateIndex + 1,
          cursor,
        );
        if (
          hasPlausibleSubjectTokens({
            subjectTokens: localSubjectTokens,
            predicateCanonical: token.canonical,
          })
        ) {
          infinitivePredicateIndex = cursor;
          continue;
        }
        if (
          hasPlausibleSubjectTokens({
            subjectTokens: subjectTokensBeforeInfinitive,
            predicateCanonical: token.canonical,
          })
        ) {
          endIndex = cursor - 1;
          break;
        }
      }
      const previousToken = args.tokens[cursor - 1];
      const punctuationGap = previousToken
        ? args.segment.text.slice(
            previousToken.end - args.segment.start,
            token.start - args.segment.start,
          )
        : "";
      if (
        punctuationGap.includes(",") &&
        hasPlausibleClauseStartingAt({
          tokens: args.tokens,
          startIndex: cursor,
        })
      ) {
        endIndex = cursor - 1;
        break;
      }
    }
    ranges.push({ startIndex: index, endIndex });
    index = endIndex;
  }
  return ranges;
}

function tokenIndexIsInRanges(
  index: number,
  ranges: readonly TokenRange[],
): boolean {
  return ranges.some(
    (range) => index >= range.startIndex && index <= range.endIndex,
  );
}

function findFrontedFiniteSubordinateRange(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
}): TokenRange | null {
  if (
    !INFINITIVE_BOUNDARIES.has(
      args.tokens[0]?.canonical ?? "",
    )
  ) {
    return null;
  }
  let endIndex = -1;
  for (let index = 0; index < args.tokens.length - 1; index += 1) {
    const token = args.tokens[index];
    const nextToken = args.tokens[index + 1];
    const punctuationGap =
      token && nextToken
        ? args.segment.text.slice(
            token.end - args.segment.start,
            nextToken.start - args.segment.start,
          )
        : "";
    if (punctuationGap.includes(",")) {
      endIndex = index;
      break;
    }
  }
  if (endIndex < 2) return null;
  for (let predicateIndex = 2; predicateIndex <= endIndex; predicateIndex += 1) {
    if (!isFiniteVerbForm(args.tokens, predicateIndex)) continue;
    if (
      hasPlausibleSubjectTokens({
        subjectTokens: args.tokens.slice(1, predicateIndex),
        predicateCanonical:
          args.tokens[predicateIndex]?.canonical ?? "",
      })
    ) {
      return { startIndex: 0, endIndex };
    }
  }
  return null;
}

function findImperativePredicateIndex(args: {
  tokens: readonly ProseToken[];
  frontedSubordinateRange: TokenRange | null;
}): number | null {
  const candidateIndex = args.frontedSubordinateRange
    ? args.frontedSubordinateRange.endIndex + 1
    : 0;
  const candidate = args.tokens[candidateIndex];
  const following = args.tokens[candidateIndex + 1];
  if (
    !candidate ||
    !IMPERATIVE_VERBS.has(candidate.canonical) ||
    SUBJECT_PRONOUNS.has(candidate.canonical) ||
    PREPOSITIONAL_FRAGMENT_STARTERS.has(following?.canonical ?? "")
  ) {
    return null;
  }
  return candidateIndex;
}

function startsWithSubordinateMarker(
  tokens: readonly ProseToken[],
): boolean {
  return INFINITIVE_BOUNDARIES.has(tokens[0]?.canonical ?? "");
}

function isUnboundedLeadingPrepositionalFragment(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
}): boolean {
  return (
    PREPOSITIONAL_FRAGMENT_STARTERS.has(
      args.tokens[0]?.canonical ?? "",
    ) && !args.segment.text.includes(",")
  );
}

function findRelativePredicateIndexes(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
  infinitiveRanges: readonly TokenRange[];
}): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < args.tokens.length; index += 1) {
    const marker = args.tokens[index];
    const previousToken = args.tokens[index - 1];
    const precedingGap =
      marker && previousToken
        ? args.segment.text.slice(
            previousToken.end - args.segment.start,
            marker.start - args.segment.start,
          )
        : "";
    if (
      index === 0 ||
      !RELATIVE_MARKERS.has(marker?.canonical ?? "") ||
      (marker?.canonical === "that" &&
        /[,;:—–]/u.test(precedingGap))
    )
      continue;
    for (
      let candidateIndex = index + 1;
      candidateIndex < args.tokens.length;
      candidateIndex += 1
    ) {
      const previousToken = args.tokens[candidateIndex - 1];
      const candidateToken = args.tokens[candidateIndex];
      const punctuationGap =
        previousToken && candidateToken
          ? args.segment.text.slice(
              previousToken.end - args.segment.start,
              candidateToken.start - args.segment.start,
            )
          : "";
      if (/[,;:—–]/u.test(punctuationGap)) break;
      if (
        !tokenIndexIsInRanges(
          candidateIndex,
          args.infinitiveRanges,
        ) &&
        isFiniteVerbForm(args.tokens, candidateIndex) &&
        hasPlausibleRelativeSubject({
          tokens: args.tokens,
          markerIndex: index,
          predicateIndex: candidateIndex,
        })
      ) {
        indexes.push(candidateIndex);
        break;
      }
    }
  }
  return indexes;
}

function findMainFinitePredicateIndex(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
  infinitiveRanges: readonly TokenRange[];
  relativePredicateIndexes: readonly number[];
  frontedSubordinateRange: TokenRange | null;
}): number | null {
  for (let index = 0; index < args.tokens.length; index += 1) {
    const token = args.tokens[index];
    if (!token || !isFiniteVerbForm(args.tokens, index)) continue;
    if (
      args.frontedSubordinateRange &&
      tokenIndexIsInRanges(index, [args.frontedSubordinateRange])
    ) {
      continue;
    }
    if (tokenIndexIsInRanges(index, args.infinitiveRanges)) continue;
    if (args.relativePredicateIndexes.includes(index)) continue;
    if (index === 0 && VERB_LED_PARTICIPLES.has(token.canonical)) continue;
    if (
      !hasPlausibleMainSubject({
        tokens: args.tokens,
        segment: args.segment,
        predicateIndex: index,
        infinitiveRanges: args.infinitiveRanges,
      })
    ) {
      continue;
    }
    return index;
  }
  return null;
}

function spanForTokenRange(
  tokens: readonly ProseToken[],
  range: TokenRange,
): PremiumCoverLetterEnglishProseSpan {
  return {
    start: tokens[range.startIndex]?.start ?? 0,
    end: tokens[range.endIndex]?.end ?? 0,
  };
}

function subjectEndIndex(args: {
  tokens: readonly ProseToken[];
  subjectStartIndex: number;
  predicateIndex: number;
  infinitiveRanges: readonly TokenRange[];
}): number {
  const relativeMarkerIndex = args.tokens.findIndex(
    (token, index) =>
      index >= args.subjectStartIndex &&
      RELATIVE_MARKERS.has(token.canonical),
  );
  if (
    relativeMarkerIndex > args.subjectStartIndex &&
    relativeMarkerIndex < args.predicateIndex
  ) {
    return relativeMarkerIndex - 1;
  }
  const firstInfinitive = args.infinitiveRanges.find(
    (range) =>
      range.startIndex > args.subjectStartIndex &&
      range.startIndex < args.predicateIndex,
  );
  if (firstInfinitive) {
    return firstInfinitive.startIndex - 1;
  }
  return args.predicateIndex - 1;
}

function subjectStartIndex(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
  predicateIndex: number;
}): number {
  const predicate = args.tokens[args.predicateIndex];
  if (!predicate) return 0;
  const predicateLocalStart = predicate.start - args.segment.start;
  const commaIndex = args.segment.text.lastIndexOf(
    ",",
    predicateLocalStart,
  );
  if (commaIndex < 0) return 0;
  const boundary = args.segment.start + commaIndex;
  const firstTokenAfterComma = args.tokens.findIndex(
    (token, index) =>
      index < args.predicateIndex && token.start > boundary,
  );
  return firstTokenAfterComma >= 0 ? firstTokenAfterComma : 0;
}

function looksLikeReducedParticipleContinuation(args: {
  tokens: readonly ProseToken[];
  subjectStartIndex: number;
  subjectEndIndex: number;
  predicateIndex: number;
}): boolean {
  const subjectTokens = args.tokens.slice(
    args.subjectStartIndex,
    args.subjectEndIndex + 1,
  );
  const predicateCanonical =
    args.tokens[args.predicateIndex]?.canonical ?? "";
  const followingCanonical =
    args.tokens[args.predicateIndex + 1]?.canonical ?? "";
  const startsWithVerbLedParticiple =
    args.subjectStartIndex === 0 &&
    VERB_LED_PARTICIPLES.has(subjectTokens[0]?.canonical ?? "");
  const predicateIsParticiple = /(?:ed|en)$/u.test(predicateCanonical);
  return (
    startsWithVerbLedParticiple &&
    predicateIsParticiple &&
    (args.predicateIndex === args.subjectStartIndex + 1 ||
      (subjectTokens.some((token) =>
        SUBJECT_DETERMINERS.has(token.canonical),
      ) &&
        PREPOSITIONAL_FRAGMENT_STARTERS.has(followingCanonical)))
  );
}

function hasPlausibleMainSubject(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
  predicateIndex: number;
  infinitiveRanges: readonly TokenRange[];
}): boolean {
  const startIndex = subjectStartIndex(args);
  const endIndex = subjectEndIndex({
    tokens: args.tokens,
    subjectStartIndex: startIndex,
    predicateIndex: args.predicateIndex,
    infinitiveRanges: args.infinitiveRanges,
  });
  if (endIndex < startIndex) return false;
  const predicateCanonical =
    args.tokens[args.predicateIndex]?.canonical ?? "";
  const subjectTokens = args.tokens.slice(startIndex, endIndex + 1);
  return (
    hasPlausibleSubjectTokens({
      subjectTokens,
      predicateCanonical,
    }) &&
    !looksLikeReducedParticipleContinuation({
      tokens: args.tokens,
      subjectStartIndex: startIndex,
      subjectEndIndex: endIndex,
      predicateIndex: args.predicateIndex,
    })
  );
}

function inferSubject(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
  predicateIndex: number;
  infinitiveRanges: readonly TokenRange[];
}): Readonly<{
  span: PremiumCoverLetterEnglishProseSpan | null;
  reasonCode:
    | "coordinated_subject"
    | "modified_subject"
    | "simple_subject"
    | null;
}> {
  const startIndex = subjectStartIndex(args);
  const endIndex = subjectEndIndex({
    tokens: args.tokens,
    subjectStartIndex: startIndex,
    predicateIndex: args.predicateIndex,
    infinitiveRanges: args.infinitiveRanges,
  });
  if (endIndex < startIndex) return { span: null, reasonCode: null };
  const subjectTokens = args.tokens.slice(startIndex, endIndex + 1);
  if (subjectTokens.length === 0) return { span: null, reasonCode: null };
  const span = {
    start: subjectTokens[0]?.start ?? 0,
    end: subjectTokens.at(-1)?.end ?? 0,
  };
  if (subjectTokens.some((token) => token.canonical === "and")) {
    return { span, reasonCode: "coordinated_subject" };
  }
  if (
    subjectTokens.length === 1 &&
    (SUBJECT_PRONOUNS.has(subjectTokens[0]?.canonical ?? "") ||
      !SUBJECT_DETERMINERS.has(subjectTokens[0]?.canonical ?? ""))
  ) {
    return { span, reasonCode: "simple_subject" };
  }
  return { span, reasonCode: "modified_subject" };
}

function hasSubjectContent(
  subjectTokens: readonly ProseToken[],
): boolean {
  return subjectTokens.some(
    (token) =>
      !SUBJECT_DETERMINERS.has(token.canonical) &&
      !PREPOSITIONAL_FRAGMENT_STARTERS.has(token.canonical) &&
      !RELATIVE_MARKERS.has(token.canonical) &&
      !CLAUSE_COORDINATORS.has(token.canonical),
  );
}

function postCommaClauseTokens(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
}): readonly ProseToken[] {
  let clauseStartIndex = -1;
  for (let index = 1; index < args.tokens.length; index += 1) {
    const previousToken = args.tokens[index - 1];
    const token = args.tokens[index];
    const punctuationGap =
      previousToken && token
        ? args.segment.text.slice(
            previousToken.end - args.segment.start,
            token.start - args.segment.start,
          )
        : "";
    if (punctuationGap.includes(",")) clauseStartIndex = index;
  }
  return clauseStartIndex < 0
    ? []
    : args.tokens.slice(clauseStartIndex);
}

function hasUnsupportedPresentClauseShape(args: {
  tokens: readonly ProseToken[];
  infinitiveRanges: readonly TokenRange[];
  startIndex?: number;
}): boolean {
  for (
    let index = args.startIndex ?? 2;
    index < args.tokens.length - 1;
    index += 1
  ) {
    const candidate = args.tokens[index];
    const following = args.tokens[index + 1];
    const subjectTokens = args.tokens.slice(0, index);
    const subjectHead = subjectAgreementTokens(subjectTokens).at(-1);
    const subjectAgreement = inferSubjectAgreement(subjectTokens);
    const candidateAgreement: SubjectAgreement =
      candidate?.canonical.endsWith("s") &&
      !/(?:ss|us|is)$/u.test(candidate.canonical)
        ? "third_person_singular"
        : "base";
    const candidateHasPresentShape =
      candidateAgreement === "third_person_singular" ||
      (/^[a-z]+$/u.test(candidate?.canonical ?? "") &&
        !/(?:ed|en|ing|ly|s)$/u.test(candidate?.canonical ?? ""));
    if (
      !candidate ||
      !subjectHead ||
      !following ||
      tokenIndexIsInRanges(index, args.infinitiveRanges) ||
      (isFiniteVerbForm(args.tokens, index) &&
        subjectAgreement !== "unknown") ||
      hasPossessiveEnding(subjectHead.canonical) ||
      SUBJECT_DETERMINERS.has(candidate.canonical) ||
      PREPOSITIONAL_FRAGMENT_STARTERS.has(candidate.canonical) ||
      RELATIVE_MARKERS.has(candidate.canonical) ||
      CLAUSE_COORDINATORS.has(candidate.canonical) ||
      subjectTokens.some((token) =>
        PREPOSITIONAL_FRAGMENT_STARTERS.has(token.canonical),
      ) ||
      PREPOSITIONAL_FRAGMENT_STARTERS.has(following.canonical) ||
      !candidateHasPresentShape ||
      (candidateAgreement === "base" &&
        subjectAgreement === "third_person_singular")
    ) {
      continue;
    }
    return true;
  }
  return false;
}

function hasPostCommaPredicateEvidence(args: {
  tokens: readonly ProseToken[];
  segment: SentenceSegment;
}): boolean {
  const clauseTokens = postCommaClauseTokens(args);
  for (let index = 1; index < clauseTokens.length; index += 1) {
    const subjectTokens = clauseTokens.slice(0, index);
    const subjectHead = subjectAgreementTokens(subjectTokens).at(-1);
    if (
      isFiniteVerbForm(clauseTokens, index) &&
      subjectHead &&
      !hasPossessiveEnding(subjectHead.canonical) &&
      hasSubjectContent(subjectTokens)
    ) {
      return true;
    }
  }
  return hasUnsupportedPresentClauseShape({
    tokens: clauseTokens,
    infinitiveRanges: [],
  });
}

function isVerbLedFragmentCategory(args: {
  tokens: readonly ProseToken[];
  infinitiveRanges: readonly TokenRange[];
  mainFinitePredicateIndex: number | null;
  segment: SentenceSegment;
}): boolean {
  const firstToken = args.tokens[0];
  if (
    !firstToken ||
    !VERB_LED_PARTICIPLES.has(firstToken.canonical)
  ) {
    return false;
  }
  if (
    PREPOSITIONAL_FRAGMENT_STARTERS.has(
      args.tokens[1]?.canonical ?? "",
    ) &&
    !args.segment.text.includes(",") &&
    !args.tokens
      .slice(2)
      .some((token) => SUBJECT_PRONOUNS.has(token.canonical))
  ) {
    return true;
  }
  if (args.mainFinitePredicateIndex !== null) return false;
  if (
    hasPostCommaPredicateEvidence({
      tokens: args.tokens,
      segment: args.segment,
    })
  ) {
    return false;
  }
  if (
    hasUnsupportedPresentClauseShape({
      tokens: args.tokens,
      infinitiveRanges: args.infinitiveRanges,
    })
  ) {
    return false;
  }
  const firstInfinitive = args.infinitiveRanges[0];
  if (!firstInfinitive) return true;
  const nominalHead = args.tokens[firstInfinitive.startIndex - 1];
  if (!nominalHead) return true;
  if (/(?:ing)$/u.test(nominalHead.canonical)) return true;
  return firstInfinitive.startIndex !== 2 || !nominalHead.canonical.endsWith("s");
}

type SemicolonClauseValidation = "valid" | "invalid" | "unknown";

function validateSemicolonClauses(
  segment: SentenceSegment,
): SemicolonClauseValidation {
  if (!segment.text.includes(";")) return "valid";
  let validation: SemicolonClauseValidation = "valid";
  let localOffset = 0;
  for (const surface of segment.text.split(";")) {
    const text = surface.trim();
    const trimOffset = surface.indexOf(text);
    if (!text) {
      localOffset += surface.length + 1;
      continue;
    }
    const clause: SentenceSegment = {
      text,
      start: segment.start + localOffset + Math.max(trimOffset, 0),
      end: segment.start + localOffset + Math.max(trimOffset, 0) + text.length,
    };
    const tokens = tokenize(clause);
    const infinitiveRanges = findInfinitiveRanges({
      tokens,
      segment: clause,
    });
    const relativePredicateIndexes = findRelativePredicateIndexes({
      tokens,
      segment: clause,
      infinitiveRanges,
    });
    const frontedSubordinateRange =
      findFrontedFiniteSubordinateRange({
        tokens,
        segment: clause,
      });
    const imperativePredicateIndex = findImperativePredicateIndex({
      tokens,
      frontedSubordinateRange,
    });
    const mainFinitePredicateIndex = findMainFinitePredicateIndex({
      tokens,
      segment: clause,
      infinitiveRanges,
      relativePredicateIndexes,
      frontedSubordinateRange,
    });
    const isStandaloneSubordinate =
      startsWithSubordinateMarker(tokens) &&
      frontedSubordinateRange === null;
    const isPrepositionalFragment =
      isUnboundedLeadingPrepositionalFragment({
        tokens,
        segment: clause,
      });
    if (isStandaloneSubordinate || isPrepositionalFragment) {
      return "invalid";
    }
    if (
      imperativePredicateIndex === null &&
      mainFinitePredicateIndex === null
    ) {
      if (
        isVerbLedFragmentCategory({
          tokens,
          infinitiveRanges,
          mainFinitePredicateIndex,
          segment: clause,
        }) ||
        !hasUnsupportedPresentClauseShape({
          tokens,
          infinitiveRanges,
          startIndex: 1,
        })
      ) {
        return "invalid";
      }
      validation = "unknown";
    }
    localOffset += surface.length + 1;
  }
  return validation;
}

function analyzeSentence(args: {
  section: ClaimPlanSection;
  segment: SentenceSegment;
}): PremiumCoverLetterEnglishProseAnalysis {
  const tokens = tokenize(args.segment);
  const infinitiveRanges = findInfinitiveRanges({
    tokens,
    segment: args.segment,
  });
  const infinitiveSpans = infinitiveRanges.map((range) =>
    spanForTokenRange(tokens, range),
  );
  const relativePredicateIndexes = findRelativePredicateIndexes({
    tokens,
    segment: args.segment,
    infinitiveRanges,
  });
  const relativePredicateSpans = relativePredicateIndexes.map((index) =>
    spanForTokenRange(tokens, { startIndex: index, endIndex: index }),
  );
  const frontedSubordinateRange =
    findFrontedFiniteSubordinateRange({
      tokens,
      segment: args.segment,
    });
  const imperativePredicateIndex = findImperativePredicateIndex({
    tokens,
    frontedSubordinateRange,
  });
  const isImperative = imperativePredicateIndex !== null;
  const mainFinitePredicateIndex = isImperative
    ? imperativePredicateIndex
    : findMainFinitePredicateIndex({
        tokens,
        segment: args.segment,
        infinitiveRanges,
        relativePredicateIndexes,
        frontedSubordinateRange,
      });
  const isIncompleteFrontedSubordinate =
    frontedSubordinateRange !== null &&
    mainFinitePredicateIndex === null &&
    !hasPostCommaPredicateEvidence({
      tokens,
      segment: args.segment,
    });
  const isStandaloneSubordinate =
    startsWithSubordinateMarker(tokens) &&
    frontedSubordinateRange === null;
  const isPrepositionalSubjectFragment =
    isUnboundedLeadingPrepositionalFragment({
      tokens,
      segment: args.segment,
    });
  const semicolonClauseValidation = validateSemicolonClauses(
    args.segment,
  );
  const isInvalidFragment =
    isIncompleteFrontedSubordinate ||
    isStandaloneSubordinate ||
    isPrepositionalSubjectFragment ||
    semicolonClauseValidation === "invalid" ||
    isVerbLedFragmentCategory({
      tokens,
      infinitiveRanges,
      mainFinitePredicateIndex,
      segment: args.segment,
    });

  if (isInvalidFragment) {
    return {
      section: args.section,
      text: args.segment.text,
      sentenceSpan: { start: args.segment.start, end: args.segment.end },
      classification: "INVALID",
      confidence: "high",
      reasonCodes: isIncompleteFrontedSubordinate
        ? ["fronted_subordinate_fragment", "missing_finite_predicate"]
        : isStandaloneSubordinate
          ? [
              "standalone_subordinate_fragment",
              "missing_finite_predicate",
            ]
          : isPrepositionalSubjectFragment
            ? [
                "prepositional_subject_fragment",
                "missing_finite_predicate",
              ]
            : semicolonClauseValidation === "invalid"
              ? [
                  "semicolon_clause_fragment",
                  "missing_finite_predicate",
                ]
              : ["verb_led_fragment", "missing_finite_predicate"],
      subjectSpan: null,
      finitePredicateSpan: null,
      infinitiveSpans,
      relativePredicateSpans,
      sentenceForm: "fragment",
    };
  }

  if (
    mainFinitePredicateIndex === null ||
    semicolonClauseValidation === "unknown"
  ) {
    return {
      section: args.section,
      text: args.segment.text,
      sentenceSpan: { start: args.segment.start, end: args.segment.end },
      classification: "UNKNOWN",
      confidence: "low",
      reasonCodes: ["ambiguous_clause_structure"],
      subjectSpan: null,
      finitePredicateSpan: null,
      infinitiveSpans,
      relativePredicateSpans,
      sentenceForm: "unknown",
    };
  }

  const finitePredicateSpan = spanForTokenRange(tokens, {
    startIndex: mainFinitePredicateIndex,
    endIndex: mainFinitePredicateIndex,
  });
  const subject = isImperative
    ? { span: null, reasonCode: null }
    : inferSubject({
        tokens,
        segment: args.segment,
        predicateIndex: mainFinitePredicateIndex,
        infinitiveRanges,
      });
  const reasonCodes: PremiumCoverLetterEnglishProseReasonCode[] = [];
  if (isImperative) {
    reasonCodes.push("imperative_form");
  } else {
    reasonCodes.push("finite_predicate");
    if (subject.reasonCode) reasonCodes.push(subject.reasonCode);
  }
  if (relativePredicateIndexes.length > 0) {
    reasonCodes.push("relative_clause");
  }
  if (infinitiveRanges.length > 0) {
    reasonCodes.push("bounded_infinitive");
    if (
      infinitiveRanges.some(
        (range) => mainFinitePredicateIndex > range.endIndex,
      )
    ) {
      reasonCodes.push("main_finite_predicate_after_infinitive");
    }
  }

  return {
    section: args.section,
    text: args.segment.text,
    sentenceSpan: { start: args.segment.start, end: args.segment.end },
    classification: "VALID",
    confidence: "high",
    reasonCodes,
    subjectSpan: subject.span,
    finitePredicateSpan,
    infinitiveSpans,
    relativePredicateSpans,
    sentenceForm: isImperative ? "imperative" : "declarative",
  };
}

export function analyzePremiumCoverLetterEnglishProseSection(args: {
  section: ClaimPlanSection;
  text: string;
}): readonly PremiumCoverLetterEnglishProseAnalysis[] {
  return segmentSentences(args.text).map((segment) =>
    analyzeSentence({ section: args.section, segment }),
  );
}
