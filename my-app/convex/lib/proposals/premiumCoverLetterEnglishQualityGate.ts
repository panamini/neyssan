import type {
  ClaimPlanSection,
  ClaimPlanV1,
  FactGraphV1,
  PremiumWriterOutputV1,
} from "./premiumCoverLetter";

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

function splitSentences(value: string): string[] {
  return Array.from(
    value.matchAll(/[^.!?\n]+(?:[.!?]+(?:["'”’»)\]}]+)?|$)/gu),
    (match) => match[0],
  )
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function numericTokens(value: string): string[] {
  const tokens = new Set<string>();
  for (const match of value
    .toLowerCase()
    .matchAll(/\b\d[\d,]*(?:\.\d+)?\s*(?:%|percent\b)?/g)) {
    const compact = match[0].replace(/[\s,]+/g, "");
    const percentage = compact.endsWith("%") || compact.endsWith("percent");
    const numericSurface = compact.replace(/(?:%|percent)$/u, "");
    const numericValue = Number(numericSurface);
    if (Number.isFinite(numericValue)) {
      tokens.add(`${numericValue}${percentage ? "%" : ""}`);
    }
  }
  return [...tokens];
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
      .flatMap((value) => normalizeText(value).split(/[^a-z0-9%]+/u))
      .filter(
        (token) =>
          token.length >= 4 &&
          !numericTokens(token).length &&
          !EVIDENCE_ANCHOR_STOP_WORDS.has(token),
      ),
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

    for (const sentence of splitSentences(text)) {
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
    if (section === "employerValueBlock" && part.factIds.length > 0) {
      const anchors = evidenceAnchorTokens({
        factIds: part.factIds,
        factGraph: args.factGraph,
      });
      const textTokens = new Set(
        normalizeText(text)
          .split(/[^a-z0-9%]+/u)
          .filter((token) => token.length >= 4),
      );
      if (!Array.from(textTokens).some((token) => anchors.has(token))) {
        pushUnique(issues, {
          code: "employer_value_not_grounded",
          section,
        });
      }
    }
    for (const metric of numericTokens(text)) {
      if (!sourceMetricFacts.has(metric)) {
        pushUnique(issues, {
          code: "unsupported_visible_metric",
          section,
          metric,
        });
      }
      const metricFactIds = attributedMetricFactIds({
        visibleText: text,
        candidateFactIds:
          sourceMetricFacts.get(metric) ?? new Set<string>(),
        factGraph: args.factGraph,
      });
      const previousOccurrence = seenMetricSections
        .get(metric)
        ?.find(
          (occurrence) =>
            occurrence.section !== section &&
            setsOverlap(occurrence.factIds, metricFactIds),
        );
      if (previousOccurrence) {
        pushUnique(issues, {
          code: "duplicate_visible_metric",
          section,
          otherSection: previousOccurrence.section,
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
