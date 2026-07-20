import type {
  ClaimPlanSection,
  ClaimPlanV1,
  FactGraphV1,
  PremiumWriterOutputV1,
} from "./premiumCoverLetter";
import { expandPremiumCoverLetterTokenVariants } from "./premiumCoverLetterTokenNormalization";

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
  "from",
  "have",
  "into",
  "more",
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
  "with",
  "work",
  "worked",
  "would",
  "your",
]);

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeSentenceKey(value: string): string {
  return normalizeText(value)
    .replace(/[.!?]+(?:["'”’»)\]}]+)?$/u, "")
    .trim();
}

type SentenceRange = Readonly<{
  text: string;
  start: number;
  end: number;
}>;

const NON_TERMINAL_PERIOD_ABBREVIATION_PATTERN =
  /(?:(?:\b[a-z]\.){2,}|\b(?:dr|mr|mrs|ms|prof|sr|jr|st|no|fig|vs|etc)\.)$/iu;

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
  if (
    NON_TERMINAL_PERIOD_ABBREVIATION_PATTERN.test(
      args.value.slice(0, matchIndex + punctuationLength),
    )
  ) {
    return false;
  }
  return /[\p{Lu}\p{N}"'“‘(]/u.test(nextCharacter);
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
  index: number;
}>;

function numericTokenOccurrences(value: string): NumericTokenOccurrence[] {
  const tokens: NumericTokenOccurrence[] = [];
  for (const match of value
    .matchAll(/\b\d[\d,]*(?:\.\d+)?\s*(?:%|percent\b)?(?![A-Za-z])/gi)) {
    const prefix = value.slice(Math.max(0, match.index - 16), match.index);
    if (/\b(?:(?:iso|iec|soc|rfc)\s+|no\.\s*)$/iu.test(prefix)) {
      continue;
    }
    const compact = match[0].toLowerCase().replace(/[\s,]+/g, "");
    const percentage = compact.endsWith("%") || compact.endsWith("percent");
    const numericSurface = compact.replace(/(?:%|percent)$/u, "");
    const numericValue = Number(numericSurface);
    if (Number.isFinite(numericValue)) {
      tokens.push({
        metric: `${numericValue}${percentage ? "%" : ""}`,
        index: match.index,
      });
    }
  }
  return tokens;
}

function numericTokens(value: string): string[] {
  return [
    ...new Set(
      numericTokenOccurrences(value).map((occurrence) => occurrence.metric),
    ),
  ];
}

function evidenceAnchorTokens(args: {
  factIds: readonly string[];
  factGraph: FactGraphV1;
}): Set<string> {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  return evidenceAnchorTokensFromValues(
    args.factIds
      .map((factId) => factById.get(factId))
      .filter((fact): fact is FactGraphV1["facts"][number] => Boolean(fact))
      .flatMap((fact) => [fact.text, ...fact.entities]),
  );
}

function evidenceAnchorTokensFromValues(values: readonly string[]): Set<string> {
  return new Set(
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
          ? expandPremiumCoverLetterTokenVariants(normalized)
          : [],
      )
  );
}

function sourceMetricFactIds(args: {
  factIds: readonly string[];
  factGraph: FactGraphV1;
}): Map<string, Set<string>> {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const factIdsByMetric = new Map<string, Set<string>>();
  for (const factId of args.factIds) {
    const fact = factById.get(factId);
    if (!fact) continue;
    for (const metric of [fact.text, ...fact.metrics].flatMap(numericTokens)) {
      const supportingFactIds = factIdsByMetric.get(metric) ?? new Set<string>();
      supportingFactIds.add(factId);
      factIdsByMetric.set(metric, supportingFactIds);
    }
  }
  return factIdsByMetric;
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
      if (
        /^(?:managed|maintained|documented|coordinated|reduced|tracked|supported|handled|worked|led|built|improved|created|reported)\b/u.test(
          normalizedSentence,
        )
      ) {
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
      factGraph: args.factGraph,
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
      const textTokens = evidenceAnchorTokensFromValues([text]);
      if (!Array.from(textTokens).some((token) => anchors.has(token))) {
        pushUnique(issues, {
          code: "employer_value_not_grounded",
          section,
        });
      }
    }
    for (const occurrence of numericTokenOccurrences(text)) {
      const { metric } = occurrence;
      if (!sourceMetricFacts.has(metric)) {
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
        candidateFactIds:
          sourceMetricFacts.get(metric) ?? new Set<string>(),
        factGraph: args.factGraph,
      });
      const previousOccurrence = seenMetricSections
        .get(metric)
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
      const occurrences = seenMetricSections.get(metric) ?? [];
      occurrences.push({ section, factIds: metricFactIds });
      seenMetricSections.set(metric, occurrences);
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
