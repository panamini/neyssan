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
  | "fact_reused_across_sections"
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

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function numericTokens(value: string): string[] {
  const tokens = new Set<string>();
  for (const match of value.toLowerCase().matchAll(/\b\d+(?:\.\d+)?\s*%?/g)) {
    tokens.add(match[0].replace(/\s+/g, ""));
  }
  return [...tokens];
}

function evidenceAnchorTokens(args: {
  factIds: readonly string[];
  factGraph: FactGraphV1;
}): Set<string> {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  return new Set(
    args.factIds
      .map((factId) => factById.get(factId))
      .filter((fact): fact is FactGraphV1["facts"][number] => Boolean(fact))
      .flatMap((fact) => [fact.text, ...fact.entities])
      .flatMap((value) => normalizeText(value).split(/[^a-z0-9%]+/u))
      .filter((token) => token.length >= 4),
  );
}

function sourceMetricTokens(args: {
  factIds: readonly string[];
  factGraph: FactGraphV1;
}): Set<string> {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const source = args.factIds
    .map((factId) => factById.get(factId))
    .filter((fact): fact is FactGraphV1["facts"][number] => Boolean(fact))
    .flatMap((fact) => [fact.text, ...fact.metrics]);
  return new Set(source.flatMap(numericTokens));
}

function pushUnique(
  issues: EnglishCvBackedQualityGateIssue[],
  issue: EnglishCvBackedQualityGateIssue,
): void {
  if (
    issues.some(
      (existing) => JSON.stringify(existing) === JSON.stringify(issue),
    )
  ) {
    return;
  }
  issues.push(issue);
}

/**
 * Provider-free, text-preserving quality gate for English CV-backed output.
 *
 * The gate deliberately fails closed. It never drops IDs, rewrites prose, or
 * chooses a replacement fact. Callers should reject the candidate and leave
 * any repair/retry decision to a separately authorized path.
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
  const seenMetricSections = new Map<string, ClaimPlanSection>();

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

    if (!/[.!?]$/u.test(text)) {
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
        pushUnique(issues, {
          code: "fact_reused_across_sections",
          section,
          otherSection: previousSection,
          factId,
        });
      } else if (!previousSection) {
        seenFactSections.set(factId, section);
      }
    }

    for (const sentence of splitSentences(text)) {
      const normalizedSentence = normalizeText(sentence);
      if (
        /^(?:managed|maintained|documented|coordinated|reduced|tracked|supported|handled|worked|led|built|improved|created|reported)\b/u.test(
          normalizedSentence,
        )
      ) {
        pushUnique(issues, { code: "incomplete_sentence", section });
      }
      const previousSection = seenSentenceSections.get(normalizedSentence);
      if (previousSection && previousSection !== section) {
        pushUnique(issues, {
          code: "duplicate_visible_sentence",
          section,
          otherSection: previousSection,
        });
      } else if (!previousSection) {
        seenSentenceSections.set(normalizedSentence, section);
      }
    }

    const sourceMetrics = sourceMetricTokens({
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
      if (!sourceMetrics.has(metric)) {
        pushUnique(issues, {
          code: "unsupported_visible_metric",
          section,
          metric,
        });
      }
      const previousSection = seenMetricSections.get(metric);
      if (previousSection && previousSection !== section) {
        pushUnique(issues, {
          code: "duplicate_visible_metric",
          section,
          otherSection: previousSection,
          metric,
        });
      } else if (!previousSection) {
        seenMetricSections.set(metric, section);
      }
    }
  }

  return issues;
}
