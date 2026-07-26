import winkPosTaggerFactory from "wink-pos-tagger";
import type { WinkPosToken } from "wink-pos-tagger";
import type { ClaimPlanSection } from "./premiumCoverLetter";
export type PremiumCoverLetterEnglishProseClassification =
  | "VALID" | "INVALID" | "UNKNOWN";
export type PremiumCoverLetterEnglishProseConfidence =
  | "high" | "medium" | "low";
export type PremiumCoverLetterEnglishProseSentenceForm =
  | "declarative" | "imperative" | "fragment" | "unknown";

export type PremiumCoverLetterEnglishProseReasonCode =
  | "ambiguous_clause_structure" | "bounded_infinitive"
  | "coordinated_subject" | "finite_predicate"
  | "fronted_subordinate_fragment" | "imperative_form"
  | "main_finite_predicate_after_infinitive" | "missing_finite_predicate"
  | "modified_subject" | "prepositional_subject_fragment"
  | "relative_clause" | "semicolon_clause_fragment" | "simple_subject"
  | "standalone_subordinate_fragment"
  | "verb_led_fragment";
export type PremiumCoverLetterEnglishProseSpan = Readonly<{
  start: number; end: number;
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
  text: string; start: number; end: number;
}>;
type TaggedToken = WinkPosToken & Readonly<{ start: number; end: number }>;
type TokenRange = Readonly<{ startIndex: number; endIndex: number }>;
const tagger = winkPosTaggerFactory();
const ORGANIZATION_ABBREVIATION_PATTERN = /\b(?:Co|Corp|Inc|Ltd|LLC|PLC|GmbH)\.$/u;
const DOTTED_INITIALISM_PATTERN = /(?:\b\p{Lu}\.){2,}$/u;
const INLINE_DOTTED_INITIALISM_PATTERN = /(?:\b\p{Lu}\.){2,}/u;
const TITLE_ABBREVIATION_PATTERN = /\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|No|Fig)\.$/u;
const CONTEXTUAL_ABBREVIATION_PATTERN = /\b(?:e\.g|i\.e|etc|vs|approx|dept)\.$/iu;
const RELATIVE_MARKER_PATTERN = /^(?:that|which|who)$/iu;
const RELATIVE_MARKER_POS_PATTERN = /^(?:WDT|WP|WP\$)$/u;
const FINITE_POS_PATTERN = /^(?:MD|VBD|VBP|VBZ)$/u;
const NOMINAL_POS_PATTERN = /^(?:NN|NNS|NNP|NNPS|PRP)$/u;
const PROPER_NAME_PREFIX_POS_PATTERN = /^(?:NNP|NNPS|CC|IN|DT)$/u;
const INITIAL_PARTICIPLE_POS_PATTERN = /^(?:VBD|VBN)$/u;
const PUNCTUATION_POS_PATTERN = /^(?:[,.!?;:]|-LRB-|-RRB-)$/u;
const INITIALISM_RELATIVE_MARKER_PATTERN = /^(?:that|which|who|whose|where)$/iu;
const INITIALISM_RELATIVE_MARKER_POS_PATTERN = /^(?:WDT|WP|WP\$|WRB)$/u;
const INITIALISM_ATTACHMENT_CONTEXT_PATTERN =
  /\b(?:at|for|from|to|with|joined|consulted)\s+(?:\p{Lu}\.){2,}$/u;
const INITIALISM_CONTINUATION_MAX_CHARS = 240;
const SENTENCE_BOUNDARY_PATTERN =
  /[.!?]+(?:["'”’»)}\]]+)?(?=\s|$)/gu;
function isRelativeMarker(token: TaggedToken | undefined): boolean {
  return Boolean(
    token &&
    RELATIVE_MARKER_PATTERN.test(token.normal) &&
    RELATIVE_MARKER_POS_PATTERN.test(token.pos),
  );
}
function isCapitalizedNameStart(token: WinkPosToken | undefined): boolean {
  return Boolean(token && /^\p{Lu}/u.test(token.value));
}
function isInlineInitialismCandidatePeriod(
  value: string,
  periodIndex: number,
): boolean {
  const throughPeriod = value.slice(0, periodIndex + 1);
  return (
    TITLE_ABBREVIATION_PATTERN.test(throughPeriod) ||
    CONTEXTUAL_ABBREVIATION_PATTERN.test(throughPeriod) ||
    ORGANIZATION_ABBREVIATION_PATTERN.test(throughPeriod) ||
    DOTTED_INITIALISM_PATTERN.test(throughPeriod)
  );
}
function buildBoundedInitialismCandidate(remaining: string): string {
  const boundedRemaining = remaining.slice(
    0,
    INITIALISM_CONTINUATION_MAX_CHARS,
  );
  for (const match of boundedRemaining.matchAll(SENTENCE_BOUNDARY_PATTERN)) {
    const punctuationIndex = match.index ?? 0;
    if (
      match[0].startsWith(".") &&
      isInlineInitialismCandidatePeriod(boundedRemaining, punctuationIndex)
    ) {
      continue;
    }
    return boundedRemaining
      .slice(0, punctuationIndex + match[0].length)
      .trim();
  }
  return boundedRemaining.trim();
}
function isInitialismRelativeClauseContinuation(
  tokens: readonly WinkPosToken[],
): boolean {
  const relativeIndex = tokens.findIndex(
    (token, index) =>
      index > 0 &&
      INITIALISM_RELATIVE_MARKER_PATTERN.test(token.normal) &&
      INITIALISM_RELATIVE_MARKER_POS_PATTERN.test(token.pos),
  );
  if (relativeIndex < 0) return false;
  const relativePredicateIndex = tokens.findIndex(
    (token, index) =>
      index > relativeIndex && FINITE_POS_PATTERN.test(token.pos),
  );
  if (relativePredicateIndex < 0) return true;
  const closingCommaIndex = tokens.findIndex(
    (token, index) =>
      index > relativePredicateIndex && token.value === ",",
  );
  if (closingCommaIndex < 0) return true;
  const trailingTokens = tokens.slice(closingCommaIndex + 1);
  const trailingPredicateIndex = trailingTokens.findIndex((token) =>
    FINITE_POS_PATTERN.test(token.pos),
  );
  if (trailingPredicateIndex < 0) return true;
  return !trailingTokens
    .slice(0, trailingPredicateIndex)
    .some((token) => NOMINAL_POS_PATTERN.test(token.pos));
}
function hasCoordinatedProperNameBeforePredicate(
  tokens: readonly WinkPosToken[],
  predicateIndex: number,
): boolean {
  const nameTokens = tokens.slice(0, predicateIndex);
  return nameTokens.some(
    (token, conjunctionIndex) =>
      token.pos === "CC" &&
      nameTokens
        .slice(0, conjunctionIndex)
        .some((candidate) => isCapitalizedNameStart(candidate)) &&
      nameTokens
        .slice(conjunctionIndex + 1)
        .some((candidate) => isCapitalizedNameStart(candidate)),
  );
}
function hasNominalInitialismContinuation(
  candidate: string,
  hasAttachmentContext: boolean,
): boolean {
  return (
    hasAttachmentContext ||
    INLINE_DOTTED_INITIALISM_PATTERN.test(candidate)
  );
}
function hasProperNamePrefixBeforeConjunction(
  tokens: readonly WinkPosToken[],
  conjunctionIndex: number,
): boolean {
  const prefix = tokens.slice(0, conjunctionIndex);
  return (
    prefix.some((token) => /^(?:NNP|NNPS)$/u.test(token.pos)) &&
    prefix.every((token) => PROPER_NAME_PREFIX_POS_PATTERN.test(token.pos))
  );
}
function hasAppositiveBeforeCoordination(candidate: string): boolean {
  return (
    /,[^,]+,\s+and\b/iu.test(candidate) ||
    /\([^()]+\)\s+and\b/iu.test(candidate) ||
    /(?:—|–|-)\s+[^—–-]+\s+(?:—|–|-)\s+and\b/iu.test(candidate)
  );
}
function hasAttachedAppositive(
  candidate: string,
  hasAttachmentContext: boolean,
): boolean {
  return (
    hasAttachmentContext &&
    hasAppositiveBeforeCoordination(candidate)
  );
}
function isCoordinatedContinuationPredicate(args: {
  tokens: readonly WinkPosToken[];
  predicateIndex: number;
  finite: boolean;
  allowAppositive: boolean;
}): boolean {
  return args.tokens.some((token, conjunctionIndex) => {
    if (token.pos !== "CC" || conjunctionIndex >= args.predicateIndex) {
      return false;
    }
    if (
      !args.allowAppositive &&
      !hasProperNamePrefixBeforeConjunction(args.tokens, conjunctionIndex)
    ) {
      return false;
    }
    const intervening = args.tokens.slice(
      conjunctionIndex + 1,
      args.predicateIndex,
    );
    if (intervening.some(
      (candidate) => NOMINAL_POS_PATTERN.test(candidate.pos),
    )) {
      return false;
    }
    return !(
      args.finite &&
      intervening.some((candidate) =>
        INITIAL_PARTICIPLE_POS_PATTERN.test(candidate.pos),
      )
    );
  });
}
function isProperNameInitialismContinuation(
  remaining: string,
  segmentPrefix: string,
): boolean {
  const candidate = buildBoundedInitialismCandidate(remaining);
  const taggedTokens = tagger.tagSentence(candidate);
  const tokens = taggedTokens.filter(
    (token) => !PUNCTUATION_POS_PATTERN.test(token.pos),
  );
  if (!isCapitalizedNameStart(tokens[0])) return false;
  if (/^(?:\p{Lu}\.){2,}$/u.test(segmentPrefix)) return true;
  const hasAttachmentContext =
    INITIALISM_ATTACHMENT_CONTEXT_PATTERN.test(segmentPrefix);
  const allowAppositive = hasAttachedAppositive(
    candidate,
    hasAttachmentContext,
  );
  if (
    hasAttachmentContext &&
    isInitialismRelativeClauseContinuation(taggedTokens)
  ) {
    return true;
  }
  const finitePredicateIndex = tokens.findIndex(
    (token, index) => index > 0 && FINITE_POS_PATTERN.test(token.pos),
  );
  if (finitePredicateIndex >= 0) {
    return isCoordinatedContinuationPredicate({
      tokens,
      predicateIndex: finitePredicateIndex,
      finite: true,
      allowAppositive,
    });
  }
  const participleIndex = tokens.findIndex(
    (token, index) =>
      index > 0 && INITIAL_PARTICIPLE_POS_PATTERN.test(token.pos),
  );
  if (participleIndex < 0) {
    return hasNominalInitialismContinuation(candidate, hasAttachmentContext);
  }
  return (
    isCoordinatedContinuationPredicate({
      tokens,
      predicateIndex: participleIndex,
      finite: false,
      allowAppositive,
    }) ||
    (
      hasAttachmentContext &&
      hasCoordinatedProperNameBeforePredicate(tokens, participleIndex)
    )
  );
}
function hasCommaBetween(
  segment: SentenceSegment, previous: TaggedToken, marker: TaggedToken,
): boolean {
  return segment.text
    .slice(previous.end - segment.start, marker.start - segment.start)
    .includes(",");
}
function buildSegment(value: string, start: number, end: number): SentenceSegment | null {
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
function isProtectedPeriod(value: string, periodIndex: number, segmentStart: number): boolean {
  const throughPeriod = value.slice(0, periodIndex + 1);
  const segmentPrefix = value.slice(segmentStart, periodIndex + 1).trim();
  const remaining = value.slice(periodIndex + 1);
  const nextWord = remaining.match(/^\s*(\S+)/u)?.[1] ?? "";
  const lowercaseStyled = /^(?:[a-z]+[A-Z][A-Za-z]*|npm)\b/u.test(nextWord);
  if (TITLE_ABBREVIATION_PATTERN.test(throughPeriod)) return true;
  if (/\b(?:e\.g|i\.e)\.$/iu.test(throughPeriod)) return true;
  if (CONTEXTUAL_ABBREVIATION_PATTERN.test(throughPeriod)) {
    return !/^[\p{Lu}\p{N}"'“‘(]/u.test(nextWord);
  }
  if (ORGANIZATION_ABBREVIATION_PATTERN.test(throughPeriod)) {
    return /^[a-z]/u.test(nextWord) && !lowercaseStyled;
  }
  if (DOTTED_INITIALISM_PATTERN.test(throughPeriod)) {
    if (lowercaseStyled) return false;
    if (/^\s*[a-z]/u.test(remaining)) return true;
    return isProperNameInitialismContinuation(
      remaining,
      segmentPrefix,
    );
  }
  return false;
}
function segmentSentences(value: string): SentenceSegment[] {
  const segments: SentenceSegment[] = [];
  let start = 0;
  for (const match of value.matchAll(SENTENCE_BOUNDARY_PATTERN)) {
    const punctuationIndex = match.index ?? 0;
    if (
      match[0].startsWith(".") &&
      isProtectedPeriod(value, punctuationIndex, start)
    ) {
      continue;
    }
    const end = punctuationIndex + match[0].length;
    const segment = buildSegment(value, start, end);
    if (segment) segments.push(segment);
    start = end;
  }
  const trailing = buildSegment(value, start, value.length);
  if (trailing) segments.push(trailing);
  return segments;
}
function tagSegment(segment: SentenceSegment): TaggedToken[] {
  const tagged: TaggedToken[] = [];
  let cursor = 0;
  for (const token of tagger.tagSentence(segment.text)) {
    const localStart = segment.text.indexOf(token.value, cursor);
    if (localStart < 0) continue;
    const start = segment.start + localStart;
    tagged.push({
      ...token,
      start,
      end: start + token.value.length,
    });
    cursor = localStart + token.value.length;
  }
  return tagged;
}
function contentTokens(tokens: readonly TaggedToken[]): TaggedToken[] {
  return tokens.filter((token) => !PUNCTUATION_POS_PATTERN.test(token.pos));
}

function findInfinitiveEnd(
  tokens: readonly TaggedToken[],
  startIndex: number,
): number {
  const offset = tokens.slice(startIndex + 2).findIndex((token, offset) => {
    const cursor = startIndex + 2 + offset;
    if (token.pos === "MD") return true;
    if (token.pos === "CC") return tokens[cursor + 1]?.pos !== "VB";
    if (
      token.pos === "IN" &&
      NOMINAL_POS_PATTERN.test(tokens[cursor + 1]?.pos ?? "") &&
      FINITE_POS_PATTERN.test(tokens[cursor + 2]?.pos ?? "")
    ) {
      return true;
    }
    if (!FINITE_POS_PATTERN.test(token.pos)) return false;
    if (cursor === tokens.length - 1) return false;
    return !tokens
      .slice(cursor + 1)
      .some((candidate) => FINITE_POS_PATTERN.test(candidate.pos));
  });
  return offset < 0 ? tokens.length - 1 : startIndex + 1 + offset;
}
function findInfinitiveRanges(tokens: readonly TaggedToken[]): TokenRange[] {
  const ranges: TokenRange[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (
      tokens[index]?.pos !== "TO" ||
      tokens[index + 1]?.pos !== "VB"
    ) {
      continue;
    }
    const endIndex = findInfinitiveEnd(tokens, index);
    ranges.push({ startIndex: index, endIndex });
    index = endIndex;
  }
  return ranges;
}

function indexInRanges(index: number, ranges: readonly TokenRange[]): boolean {
  return ranges.some(
    (range) => index >= range.startIndex && index <= range.endIndex,
  );
}

function findRelativePredicateIndexes(
  tokens: readonly TaggedToken[],
  infinitiveRanges: readonly TokenRange[],
  segment: SentenceSegment,
): number[] {
  const indexes: number[] = [];
  for (let markerIndex = 1; markerIndex < tokens.length; markerIndex += 1) {
    const marker = tokens[markerIndex];
    const previous = tokens[markerIndex - 1];
    if (!isRelativeMarker(marker)) continue;
    if (marker && previous && hasCommaBetween(segment, previous, marker)) continue;
    for (
      let index = markerIndex + 1;
      index < tokens.length;
      index += 1
    ) {
      if (
        !indexInRanges(index, infinitiveRanges) &&
        FINITE_POS_PATTERN.test(tokens[index]?.pos ?? "")
      ) {
        indexes.push(index);
        break;
      }
    }
  }
  return indexes;
}

function findMainPredicateIndex(args: {
  tokens: readonly TaggedToken[];
  infinitiveRanges: readonly TokenRange[];
  relativePredicateIndexes: readonly number[];
}): number | null {
  for (let index = 0; index < args.tokens.length; index += 1) {
    const token = args.tokens[index];
    if (
      !token ||
      !FINITE_POS_PATTERN.test(token.pos) ||
      indexInRanges(index, args.infinitiveRanges) ||
      args.relativePredicateIndexes.includes(index)
    ) {
      continue;
    }
    if (index === 0 && INITIAL_PARTICIPLE_POS_PATTERN.test(token.pos)) {
      continue;
    }
    return index;
  }
  return null;
}

function spanForRange(
  tokens: readonly TaggedToken[],
  range: TokenRange,
): PremiumCoverLetterEnglishProseSpan {
  return {
    start: tokens[range.startIndex]?.start ?? 0,
    end: tokens[range.endIndex]?.end ?? 0,
  };
}

function subjectEndIndex(args: {
  tokens: readonly TaggedToken[];
  predicateIndex: number;
  infinitiveRanges: readonly TokenRange[];
  relativePredicateIndexes: readonly number[];
}): number {
  const firstRelativePredicateIndex = args.relativePredicateIndexes[0];
  const relativeMarkerIndex = args.tokens.findIndex(
    (token, index) =>
      firstRelativePredicateIndex !== undefined &&
      index < args.predicateIndex &&
      index < firstRelativePredicateIndex &&
      isRelativeMarker(token),
  );
  if (relativeMarkerIndex > 0) return relativeMarkerIndex - 1;
  const infinitive = args.infinitiveRanges.find(
    (range) => range.startIndex < args.predicateIndex,
  );
  if (infinitive) return infinitive.startIndex - 1;
  return args.predicateIndex - 1;
}
function subjectReason(subjectTokens: readonly TaggedToken[]):
  "coordinated_subject" | "modified_subject" | "simple_subject" {
  if (subjectTokens.some((token) => token.pos === "CC")) {
    return "coordinated_subject";
  }
  return subjectTokens.length === 1
    ? "simple_subject"
    : "modified_subject";
}
type AnalysisEvidence = Readonly<{
  section: ClaimPlanSection; segment: SentenceSegment;
  infinitiveSpans: readonly PremiumCoverLetterEnglishProseSpan[];
  relativePredicateSpans: readonly PremiumCoverLetterEnglishProseSpan[];
}>;
function unknownAnalysis(args: AnalysisEvidence):
  PremiumCoverLetterEnglishProseAnalysis {
  return {
    section: args.section,
    text: args.segment.text,
    sentenceSpan: { start: args.segment.start, end: args.segment.end },
    classification: "UNKNOWN",
    confidence: "low",
    reasonCodes: ["ambiguous_clause_structure"],
    subjectSpan: null,
    finitePredicateSpan: null,
    infinitiveSpans: args.infinitiveSpans,
    relativePredicateSpans: args.relativePredicateSpans,
    sentenceForm: "unknown",
  };
}
function invalidAnalysis(
  evidence: AnalysisEvidence,
  reasonCodes: readonly PremiumCoverLetterEnglishProseReasonCode[],
): PremiumCoverLetterEnglishProseAnalysis {
  return {
    ...unknownAnalysis(evidence),
    classification: "INVALID",
    confidence: "high",
    reasonCodes,
    sentenceForm: "fragment",
  };
}
function analyzeSemicolon(evidence: AnalysisEvidence):
  PremiumCoverLetterEnglishProseAnalysis {
  let localOffset = 0;
  for (const surface of evidence.segment.text.split(";")) {
    const text = surface.trim();
    const leading = Math.max(surface.indexOf(text), 0);
    const start = evidence.segment.start + localOffset + leading;
    const clause = analyzeSentence({
      section: evidence.section,
      segment: { text, start, end: start + text.length },
    });
    if (clause.classification === "INVALID") {
      return invalidAnalysis(evidence, [
        "semicolon_clause_fragment",
        "missing_finite_predicate",
      ]);
    }
    localOffset += surface.length + 1;
  }
  return unknownAnalysis(evidence);
}
function imperativeAnalysis(evidence: AnalysisEvidence, predicate: TaggedToken):
  PremiumCoverLetterEnglishProseAnalysis {
  return {
    ...unknownAnalysis(evidence),
    classification: "VALID",
    confidence: "high",
    reasonCodes: ["imperative_form"],
    finitePredicateSpan: { start: predicate.start, end: predicate.end },
    sentenceForm: "imperative",
  };
}
function isProvenVerbLedFragment(args: {
  tokens: readonly TaggedToken[];
  segment: SentenceSegment;
  infinitiveRanges: readonly TokenRange[];
  mainPredicateIndex: number | null;
}): boolean {
  const first = args.tokens[0];
  if (
    args.mainPredicateIndex !== null ||
    !first ||
    !INITIAL_PARTICIPLE_POS_PATTERN.test(first.pos) ||
    args.segment.text.endsWith("?") ||
    args.segment.text.includes(",")
  ) {
    return false;
  }
  if (args.tokens[1]?.pos === "DT") return true;
  const hasGerund = args.tokens.slice(1).some((token) => token.pos === "VBG");
  const hasOtherPredicate = args.tokens.slice(1).some(
    (token, index) =>
      !indexInRanges(index + 1, args.infinitiveRanges) &&
      /^(?:MD|VBD|VBN|VBP|VBZ)$/u.test(token.pos),
  );
  return hasGerund && !hasOtherPredicate;
}
function hasUncertainLead(
  first: TaggedToken, segment: SentenceSegment, predicate: TaggedToken,
): boolean {
  if (/^(?:IN|WRB|RB)$/u.test(first.pos)) return true;
  return (
    INITIAL_PARTICIPLE_POS_PATTERN.test(first.pos) &&
    segment.text
      .slice(0, predicate.start - segment.start)
      .includes(",")
  );
}
function declarativeAnalysis(args: {
  evidence: AnalysisEvidence;
  tokens: readonly TaggedToken[];
  predicateIndex: number;
  infinitiveRanges: readonly TokenRange[];
  relativePredicateIndexes: readonly number[];
}): PremiumCoverLetterEnglishProseAnalysis | null {
  const endIndex = subjectEndIndex({
    tokens: args.tokens,
    predicateIndex: args.predicateIndex,
    infinitiveRanges: args.infinitiveRanges,
    relativePredicateIndexes: args.relativePredicateIndexes,
  });
  const subjectTokens = args.tokens.slice(0, endIndex + 1);
  if (
    subjectTokens.length === 0 ||
    !subjectTokens.some((token) => NOMINAL_POS_PATTERN.test(token.pos))
  ) {
    return null;
  }
  const reasonCodes: PremiumCoverLetterEnglishProseReasonCode[] = [
    "finite_predicate",
    subjectReason(subjectTokens),
  ];
  if (args.relativePredicateIndexes.length > 0) reasonCodes.push("relative_clause");
  if (args.infinitiveRanges.length > 0) {
    reasonCodes.push("bounded_infinitive");
    if (
      args.infinitiveRanges.some(
        (range) => args.predicateIndex > range.endIndex,
      )
    ) {
      reasonCodes.push("main_finite_predicate_after_infinitive");
    }
  }
  const predicate = args.tokens[args.predicateIndex];
  if (!predicate) return null;
  return {
    ...unknownAnalysis(args.evidence),
    classification: "VALID",
    confidence: "high",
    reasonCodes,
    subjectSpan: {
      start: subjectTokens[0]?.start ?? 0,
      end: subjectTokens.at(-1)?.end ?? 0,
    },
    finitePredicateSpan: { start: predicate.start, end: predicate.end },
    sentenceForm: "declarative",
  };
}
function analyzeSentence(args: {
  section: ClaimPlanSection;
  segment: SentenceSegment;
}): PremiumCoverLetterEnglishProseAnalysis {
  const tokens = contentTokens(tagSegment(args.segment));
  const infinitiveRanges = findInfinitiveRanges(tokens);
  const relativePredicateIndexes = findRelativePredicateIndexes(
    tokens,
    infinitiveRanges,
    args.segment,
  );
  const evidence: AnalysisEvidence = {
    section: args.section,
    segment: args.segment,
    infinitiveSpans: infinitiveRanges.map((range) =>
      spanForRange(tokens, range),
    ),
    relativePredicateSpans: relativePredicateIndexes.map((index) =>
      spanForRange(tokens, { startIndex: index, endIndex: index }),
    ),
  };
  const first = tokens[0];
  if (!first) return unknownAnalysis(evidence);
  if (args.segment.text.includes(";")) return analyzeSemicolon(evidence);
  if (first.pos === "VB") return imperativeAnalysis(evidence, first);
  const mainPredicateIndex = findMainPredicateIndex({
    tokens,
    infinitiveRanges,
    relativePredicateIndexes,
  });
  if (
    isProvenVerbLedFragment({
      tokens,
      segment: args.segment,
      infinitiveRanges,
      mainPredicateIndex,
    })
  ) {
    return invalidAnalysis(evidence, [
      "verb_led_fragment",
      "missing_finite_predicate",
    ]);
  }
  if (mainPredicateIndex === null) return unknownAnalysis(evidence);
  const predicate = tokens[mainPredicateIndex];
  if (!predicate || hasUncertainLead(first, args.segment, predicate)) {
    return unknownAnalysis(evidence);
  }
  return declarativeAnalysis({
    evidence,
    tokens,
    predicateIndex: mainPredicateIndex,
    infinitiveRanges,
    relativePredicateIndexes,
  }) ?? unknownAnalysis(evidence);
}
export function analyzePremiumCoverLetterEnglishProseSection(args: {
  section: ClaimPlanSection;
  text: string;
}): readonly PremiumCoverLetterEnglishProseAnalysis[] {
  return segmentSentences(args.text).map((segment) =>
    analyzeSentence({ section: args.section, segment }),
  );
}

export type PremiumCoverLetterEnglishProseSectionInput = Readonly<{
  section: ClaimPlanSection;
  text: string;
}>;

/**
 * Analyze the retained cover-letter sections through one module boundary.
 * The section-level function remains available for focused module tests and
 * callers that need one section in isolation.
 */
export function analyzePremiumCoverLetterEnglishProseSections(args: {
  sections: readonly PremiumCoverLetterEnglishProseSectionInput[];
}): readonly PremiumCoverLetterEnglishProseAnalysis[] {
  return args.sections.flatMap((section) =>
    analyzePremiumCoverLetterEnglishProseSection(section),
  );
}
