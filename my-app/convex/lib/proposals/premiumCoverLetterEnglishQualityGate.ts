import type {
  ClaimPlanSection,
  ClaimPlanV1,
  FactGraphV1,
  JobDemandGraphV1,
  PremiumWriterOutputV1,
} from "./premiumCoverLetter";
import { canonicalizePremiumCoverLetterToken } from "./premiumCoverLetterTokenNormalization";
import {
  MISSING_TARGET_EMPLOYER,
  type TargetEmployerResolution,
} from "./premiumCoverLetterTargetEmployer";
import {
  evaluatePremiumCoverLetterNumericEvidence,
  type PremiumCoverLetterNumericEvidenceProjection,
} from "./premiumCoverLetterNumericEvidence";
import {
  analyzePremiumCoverLetterEnglishProseSections,
  type PremiumCoverLetterEnglishProseAnalysis,
} from "./premiumCoverLetterEnglishProse";

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

export type EnglishCvBackedQualityGateObservation =
  | Readonly<{
      code: "intentional_claim_overlap";
      section: ClaimPlanSection;
      otherSection: ClaimPlanSection;
      factId: string;
    }>
  | Readonly<{
      code: "english_prose_unknown";
      section: ClaimPlanSection;
      analysis: PremiumCoverLetterEnglishProseAnalysis;
    }>;

export type EnglishCvBackedQualityGateAnalysis = Readonly<{
  issues: EnglishCvBackedQualityGateIssue[];
  observations: EnglishCvBackedQualityGateObservation[];
}>;

type EnglishQualityGateDisposition = "PASS" | "OBSERVE" | "BLOCK";

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
function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeSentenceKey(value: string): string {
  return normalizeText(value)
    .replace(/^["'“‘«([{]+/u, "")
    .replace(/[.!?]+(?:["'”’»)\]}]+)?$/u, "")
    .trim();
}

function evidenceAnchorTokens(args: {
  factIds: readonly string[];
  factGraph: FactGraphV1;
  excludedTokens?: ReadonlySet<string>;
}): Set<string> {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const facts = args.factIds
    .map((factId) => factById.get(factId))
    .filter((fact): fact is FactGraphV1["facts"][number] => Boolean(fact));
  const tokens = evidenceAnchorTokensFromValues(
    facts.flatMap((fact) => [fact.text, ...fact.entities]),
    args.excludedTokens,
  );
  for (const verb of facts.flatMap((fact) => fact.allowedVerbs)) {
    tokens.delete(canonicalizePremiumCoverLetterToken(verb));
  }
  return tokens;
}

function evidenceEntityAnchorTokens(args: {
  factIds: readonly string[];
  factGraph: FactGraphV1;
  excludedTokens?: ReadonlySet<string>;
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
    args.excludedTokens,
  );
}

function evidenceAnchorTokensFromValues(
  values: readonly string[],
  excludedTokens: ReadonlySet<string> = new Set(),
): Set<string> {
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
            !excludedTokens.has(canonicalizePremiumCoverLetterToken(source)) &&
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
  excludedTokens?: ReadonlySet<string>;
}): boolean {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  return args.factIds.some((factId) => {
    const fact = factById.get(factId);
    if (!fact) return false;
    const factAnchors = evidenceAnchorTokens({
      factIds: [factId],
      factGraph: args.factGraph,
      excludedTokens: args.excludedTokens,
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

function setsOverlap(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function attributedMetricFactIds(args: {
  visibleText: string;
  candidateFactIds: ReadonlySet<string>;
  factGraph: FactGraphV1;
  excludedTokens?: ReadonlySet<string>;
}): Set<string> {
  if (args.candidateFactIds.size <= 1) {
    return new Set(args.candidateFactIds);
  }

  const visibleTokens = evidenceAnchorTokensFromValues(
    [args.visibleText],
    args.excludedTokens,
  );
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const scores = Array.from(args.candidateFactIds, (factId) => {
    const fact = factById.get(factId);
    const anchors = fact
      ? evidenceAnchorTokensFromValues(
          [fact.text, ...fact.entities],
          args.excludedTokens,
        )
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

function collectEnglishProseUnknownObservations(
  analyses: readonly PremiumCoverLetterEnglishProseAnalysis[],
): EnglishCvBackedQualityGateObservation[] {
  return analyses
    .filter((analysis) => proseDisposition(analysis) === "OBSERVE")
    .map((analysis) => ({
      code: "english_prose_unknown" as const,
      section: analysis.section,
      analysis,
    }));
}

function proseDisposition(
  analysis: PremiumCoverLetterEnglishProseAnalysis,
): EnglishQualityGateDisposition {
  if (
    analysis.classification === "INVALID" &&
    analysis.confidence === "high"
  ) {
    return "BLOCK";
  }
  if (analysis.classification === "UNKNOWN") return "OBSERVE";
  return "PASS";
}

function numericEvidenceDisposition(args: {
  unsupported: readonly unknown[];
}): EnglishQualityGateDisposition {
  return args.unsupported.length > 0 ? "BLOCK" : "PASS";
}

type EnglishQualityGateEvaluation = Readonly<{
  issues: EnglishCvBackedQualityGateIssue[];
  proseAnalyses: readonly PremiumCoverLetterEnglishProseAnalysis[];
}>;

function evaluateEnglishCvBackedQualityGate(args: {
  writerOutput: PremiumWriterOutputV1;
  claimPlan: ClaimPlanV1;
  factGraph: FactGraphV1;
  jobDemandGraph?: JobDemandGraphV1;
  targetEmployer?: TargetEmployerResolution;
  numericEvidenceProjection?: PremiumCoverLetterNumericEvidenceProjection;
}): EnglishQualityGateEvaluation {
  if (
    args.claimPlan.language !== "English" ||
    (args.claimPlan.contextClass !== "cv_direct" &&
      args.claimPlan.contextClass !== "cv_adjacent")
  ) {
    return { issues: [], proseAnalyses: [] };
  }

  const targetEmployer = args.targetEmployer ?? MISSING_TARGET_EMPLOYER;
  const sections = ENGLISH_CV_BACKED_SECTIONS.map((section) => {
    const part = args.writerOutput.bodyParts[section];
    return {
      section,
      visibleText: part.text.trim(),
      factIds: part.factIds,
      demandIds: part.demandIds,
      claimIds: part.claimIds,
    };
  });
  const numericEvidenceEvaluation = evaluatePremiumCoverLetterNumericEvidence({
    factGraph: args.factGraph,
    claimPlan: args.claimPlan,
    jobDemandGraph: args.jobDemandGraph ?? {
      version: "job_demand_graph_v1",
      demands: [],
      priorityTokens: [],
    },
    targetEmployer,
    projection: args.numericEvidenceProjection,
    sections,
  });
  const proseAnalyses = analyzePremiumCoverLetterEnglishProseSections({
    sections: sections.map(({ section, visibleText }) => ({
      section,
      text: visibleText,
    })),
  });
  const numericEvidenceBySection = new Map(
    sections.map((section, index) => [
      section.section,
      numericEvidenceEvaluation.sectionResults[index] ?? {
        matches: [],
        unsupported: [],
      },
    ]),
  );
  const excludedNumericAnchorTokens =
    numericEvidenceEvaluation.excludedAnchorTokens;

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

  const proseAnalysisBySection = new Map<
    ClaimPlanSection,
    PremiumCoverLetterEnglishProseAnalysis[]
  >();
  for (const analysis of proseAnalyses) {
    const analyses = proseAnalysisBySection.get(analysis.section) ?? [];
    analyses.push(analysis);
    proseAnalysisBySection.set(analysis.section, analyses);
  }

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

    const proseAnalysesForSection = proseAnalysisBySection.get(section) ?? [];
    for (const proseAnalysis of proseAnalysesForSection) {
      const normalizedSentence = normalizeSentenceKey(proseAnalysis.text);
      if (proseDisposition(proseAnalysis) === "BLOCK") {
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

    const employerGroundingFactIds =
      part.factIds.length > 0 ? part.factIds : assignedClaim?.factIds ?? [];
    if (
      section === "employerValueBlock" &&
      employerGroundingFactIds.length > 0
    ) {
      const anchors = evidenceAnchorTokens({
        factIds: employerGroundingFactIds,
        factGraph: args.factGraph,
        excludedTokens: excludedNumericAnchorTokens,
      });
      const entityAnchors = evidenceEntityAnchorTokens({
        factIds: employerGroundingFactIds,
        factGraph: args.factGraph,
        excludedTokens: excludedNumericAnchorTokens,
      });
      const textTokens = evidenceAnchorTokensFromValues(
        [text],
        excludedNumericAnchorTokens,
      );
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
        excludedTokens: excludedNumericAnchorTokens,
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
    const numericEvidence =
      numericEvidenceBySection.get(section) ?? {
        matches: [],
        unsupported: [],
      };
    if (numericEvidenceDisposition(numericEvidence) === "BLOCK") {
      for (const unsupported of numericEvidence.unsupported) {
        pushUnique(issues, {
          code: "unsupported_visible_metric",
          section,
          metric: unsupported.normalizedValue,
        });
      }
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
        proseAnalysesForSection.find(
          (analysis) =>
            firstMatch.visibleSpan.start >= analysis.sentenceSpan.start &&
            firstMatch.visibleSpan.start < analysis.sentenceSpan.end,
        )?.text ?? text;
      const metricFactIds = attributedMetricFactIds({
        visibleText: localText,
        candidateFactIds: supportingFactIds,
        factGraph: args.factGraph,
        excludedTokens: excludedNumericAnchorTokens,
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

  return { issues, proseAnalyses };
}

/**
 * Provider-free, text-preserving compatibility facade for English CV-backed
 * output. Module reason codes are reduced to the existing issue/observation
 * contract: PASS produces no result, OBSERVE produces an observation, and
 * BLOCK produces a compatibility issue.
 */
export function validateEnglishCvBackedQualityGate(args: {
  writerOutput: PremiumWriterOutputV1;
  claimPlan: ClaimPlanV1;
  factGraph: FactGraphV1;
  jobDemandGraph?: JobDemandGraphV1;
  targetEmployer?: TargetEmployerResolution;
  numericEvidenceProjection?: PremiumCoverLetterNumericEvidenceProjection;
}): EnglishCvBackedQualityGateIssue[] {
  return evaluateEnglishCvBackedQualityGate(args).issues;
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
  const evaluation = evaluateEnglishCvBackedQualityGate(args);
  const issues = evaluation.issues;
  if (
    args.claimPlan.language !== "English" ||
    (args.claimPlan.contextClass !== "cv_direct" &&
      args.claimPlan.contextClass !== "cv_adjacent")
  ) {
    return { issues, observations: [] };
  }
  return {
    issues,
    observations: [
      ...collectIntentionalClaimOverlapObservations(args),
      ...collectEnglishProseUnknownObservations(evaluation.proseAnalyses),
    ],
  };
}
