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
import {
  MISSING_TARGET_EMPLOYER,
  type TargetEmployerResolution,
} from "./premiumCoverLetterTargetEmployer";
import {
  buildPremiumCoverLetterNumericEvidenceProjection,
  isPremiumCoverLetterNumericLexeme,
  matchPremiumCoverLetterNumericEvidence,
  type PremiumCoverLetterNumericEvidenceProjection,
} from "./premiumCoverLetterNumericEvidence";

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
            !isPremiumCoverLetterNumericLexeme(normalized) &&
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
  if (hasPredicateShape) return true;
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
  if (args.tokens[args.index - 1] === "to") return false;
  const canonicalToken = canonicalizePremiumCoverLetterToken(args.token);
  if (FINITE_PREDICATE_TOKENS.has(canonicalToken)) return true;
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
  targetEmployer?: TargetEmployerResolution;
  numericEvidenceProjection?: PremiumCoverLetterNumericEvidenceProjection;
}): EnglishCvBackedQualityGateIssue[] {
  if (
    args.claimPlan.language !== "English" ||
    (args.claimPlan.contextClass !== "cv_direct" &&
      args.claimPlan.contextClass !== "cv_adjacent")
  ) {
    return [];
  }

  const issues: EnglishCvBackedQualityGateIssue[] = [];
  const targetEmployer = args.targetEmployer ?? MISSING_TARGET_EMPLOYER;
  const numericEvidenceProjection =
    args.numericEvidenceProjection ??
    buildPremiumCoverLetterNumericEvidenceProjection({
      factGraph: args.factGraph,
      claimPlan: args.claimPlan,
      jobDemandGraph:
        args.jobDemandGraph ?? {
          version: "job_demand_graph_v1",
          demands: [],
          priorityTokens: [],
        },
      targetEmployer,
    });
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

    const effectiveFactIds = part.factIds;
    const employerGroundingFactIds =
      part.factIds.length > 0 ? part.factIds : assignedClaim?.factIds ?? [];
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
    const numericEvidence = matchPremiumCoverLetterNumericEvidence({
      projection: numericEvidenceProjection,
      visibleText: text,
      section,
      factIds: effectiveFactIds,
      demandIds: part.demandIds,
      claimIds: part.claimIds,
    });
    for (const unsupported of numericEvidence.unsupported) {
      pushUnique(issues, {
        code: "unsupported_visible_metric",
        section,
        metric: unsupported.normalizedValue,
      });
    }
    const matchesByOccurrence = new Map<
      string,
      typeof numericEvidence.matches
    >();
    for (const match of numericEvidence.matches) {
      if (match.role !== "METRIC" && match.role !== "DURATION") continue;
      const occurrenceKey = `${match.visibleSpan.start}:${match.key}`;
      const matches = matchesByOccurrence.get(occurrenceKey) ?? [];
      matchesByOccurrence.set(occurrenceKey, [...matches, match]);
    }
    for (const matches of matchesByOccurrence.values()) {
      const firstMatch = matches[0];
      if (!firstMatch) continue;
      const supportingFactIds = new Set(
        matches.flatMap((match) => (match.factId ? [match.factId] : [])),
      );
      const localText =
        sentenceRanges.find(
          (sentence) =>
            firstMatch.visibleSpan.start >= sentence.start &&
            firstMatch.visibleSpan.start < sentence.end,
        )?.text ?? text;
      const metricFactIds = attributedMetricFactIds({
        visibleText: localText,
        candidateFactIds: supportingFactIds,
        factGraph: args.factGraph,
      });
      const previousOccurrence = seenMetricSections
        .get(firstMatch.key)
        ?.find((occurrence) => setsOverlap(occurrence.factIds, metricFactIds));
      if (previousOccurrence) {
        pushUnique(issues, {
          code: "duplicate_visible_metric",
          section,
          ...(previousOccurrence.section !== section
            ? { otherSection: previousOccurrence.section }
            : {}),
          metric: firstMatch.normalizedValue,
        });
      }
      const occurrences = seenMetricSections.get(firstMatch.key) ?? [];
      occurrences.push({ section, factIds: metricFactIds });
      seenMetricSections.set(firstMatch.key, occurrences);
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
  targetEmployer?: TargetEmployerResolution;
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
