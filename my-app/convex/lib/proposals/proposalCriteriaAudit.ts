import { analyzeCompanyValues, COMPANY_VALUE_BANNED_CLAIMS } from "./companyValues";
import { buildJobOfferPriorityPack } from "./premiumCoverLetter";
import {
  buildProposalEvidenceSummary,
  normalizeProposalConstraintText,
  type ProposalPlannerResult,
} from "./proposalPlanner";

export type ProposalCriteriaAudit = {
  strongestCandidateEvidence: string[];
  employerCoreResponsibilities: string[];
  employerKeyRequirements: string[];
  lowValueChecklistItems: string[];
  companyValuesCoverage: "none" | "implicit" | "explicit";
  keywordReusePolicy: {
    supported: string[];
    advisory: string[];
    blocked: string[];
  };
  evidencePriority: [
    "achievement",
    "responsibility",
    "workflow",
    "domain",
    "tool",
    "trait",
  ];
  majorRisks: Array<
    | "unsupported_keyword"
    | "company_praise"
    | "unmapped_company_values"
    | "weak_evidence"
    | "checklist_letter"
    | "no_context_claim"
    | "credential_inflation"
  >;
};

type BuildProposalCriteriaAuditArgs = {
  plannerResult?: ProposalPlannerResult | null;
  jobTitle: string;
  jobDescription: string;
  plannedText?: string;
  generatedText?: string;
};

const PHRASE_STOPWORDS = new Set([
  "about",
  "across",
  "and",
  "are",
  "be",
  "candidate",
  "company",
  "description",
  "experience",
  "for",
  "have",
  "looking",
  "must",
  "need",
  "needs",
  "of",
  "position",
  "requirements",
  "responsibilities",
  "role",
  "skills",
  "strong",
  "team",
  "the",
  "this",
  "to",
  "with",
]);
const GENERIC_ADJECTIVES = new Set([
  "adaptable",
  "best",
  "clear",
  "cutting",
  "dynamic",
  "excellent",
  "exciting",
  "fast",
  "flexible",
  "great",
  "high",
  "innovative",
  "motivated",
  "paced",
  "passionate",
  "performing",
  "reliable",
  "strong",
  "world",
]);
const IMPORTANT_PHRASE_CONTEXT_PATTERN =
  /\b(?:required|requires?|must(?:\s+have)?|need(?:s|ed)?|experience\s+(?:with|in)|responsible\s+for|responsibilities\s+include|looking\s+for|seeking|proven|lead|own|manage|coordinate)\b/i;
const REQUIRED_CREDENTIAL_PATTERN =
  /\b(?:required|requires?|must(?:\s+have)?|need(?:s|ed)?|certification|certificate|license|licensed|degree|pmp|cpa|cissp|aws certified|security clearance)\b/i;
const CREDENTIAL_PHRASE_PATTERN =
  /\b(?:certification|certificate|license|licensed|degree|pmp|cpa|cissp|security clearance)\b/i;
const TOOL_OR_ACRONYM_PATTERN =
  /\b(?:AWS|API|APIs|CRM|CSS|Excel|Figma|HubSpot|JavaScript|Jira|Kubernetes|Node\.?js|Power BI|Python|React|Salesforce|SQL|Tableau|TypeScript|Windows|Word|Zendesk|[A-Z]{2,})\b/;
const SENIORITY_PHRASE_PATTERN =
  /\b(?:senior|staff|principal|lead|manager|director|head|leadership)\b/i;

function unique(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const compact = (value ?? "").trim();
    if (!compact) continue;
    const key = normalizeProposalConstraintText(compact);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(compact);
  }
  return result;
}

function normalizePhrase(value: string): string {
  return normalizeProposalConstraintText(value).replace(/[^a-z0-9+#.\s-]/g, " ");
}

function phraseTokens(value: string): string[] {
  return (
    value.match(/[A-Z]{2,}(?:\.[A-Z])?|[A-Za-z][A-Za-z0-9+#./-]*/g) ?? []
  );
}

function trimPhraseTokens(tokens: string[]): string[] {
  let start = 0;
  let end = tokens.length;
  while (
    start < end &&
    PHRASE_STOPWORDS.has(tokens[start].toLowerCase())
  ) {
    start += 1;
  }
  while (
    end > start &&
    PHRASE_STOPWORDS.has(tokens[end - 1].toLowerCase())
  ) {
    end -= 1;
  }
  return tokens.slice(start, end);
}

function isGenericPhrase(phrase: string): boolean {
  const tokens = phraseTokens(phrase).map((token) => token.toLowerCase());
  if (tokens.length === 0) return true;
  if (tokens.every((token) => GENERIC_ADJECTIVES.has(token))) return true;
  if (
    tokens.length === 1 &&
    (GENERIC_ADJECTIVES.has(tokens[0]) || PHRASE_STOPWORDS.has(tokens[0]))
  ) {
    return true;
  }
  return false;
}

function phraseAppearsIn(phrase: string, haystack: string): boolean {
  const normalizedPhrase = normalizePhrase(phrase).trim();
  const normalizedHaystack = normalizePhrase(haystack);
  return Boolean(normalizedPhrase) && normalizedHaystack.includes(normalizedPhrase);
}

function phraseSharesDisallowedSignal(
  phrase: string,
  disallowedClaims: readonly string[],
): boolean {
  const phraseSignalTokens = phraseTokens(phrase)
    .map((token) => token.toLowerCase())
    .filter(
      (token) =>
        token.length >= 3 &&
        !PHRASE_STOPWORDS.has(token) &&
        !GENERIC_ADJECTIVES.has(token),
    );
  if (phraseSignalTokens.length === 0) return false;
  const disallowed = normalizePhrase(disallowedClaims.join(" "));
  return phraseSignalTokens.some((token) => disallowed.includes(token));
}

function extractCandidatePhrases(value: string): Array<{
  phrase: string;
  important: boolean;
  score: number;
}> {
  const candidates: Array<{ phrase: string; important: boolean; score: number }> =
    [];
  const segments = value
    .replace(/\r/g, "\n")
    .split(/\n+|[.;:!?,]|\s+-\s+|\s+\band\b\s+/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const important = IMPORTANT_PHRASE_CONTEXT_PATTERN.test(segment);
    const cleanedSegment = segment.replace(
      /\b(?:required|requires?|must(?:\s+have)?|need(?:s|ed)?|experience\s+(?:with|in)|responsible\s+for|responsibilities\s+include|looking\s+for|seeking|proven|candidates?\s+should\s+(?:be\s+)?|lead|own|manage|coordinate)\b/gi,
      " ",
    );
    const tokens = phraseTokens(cleanedSegment);
    for (let size = Math.min(4, tokens.length); size >= 1; size -= 1) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const trimmed = trimPhraseTokens(tokens.slice(index, index + size));
        if (trimmed.length === 0) continue;
        const phrase = trimmed.join(" ");
        if (isGenericPhrase(phrase)) continue;
        if (
          trimmed.length === 1 &&
          !TOOL_OR_ACRONYM_PATTERN.test(phrase) &&
          !CREDENTIAL_PHRASE_PATTERN.test(phrase)
        ) {
          continue;
        }
        let score = trimmed.length * 8;
        if (important) score += 80;
        if (TOOL_OR_ACRONYM_PATTERN.test(phrase)) score += 28;
        if (CREDENTIAL_PHRASE_PATTERN.test(phrase)) score += 36;
        if (SENIORITY_PHRASE_PATTERN.test(phrase)) score += 24;
        candidates.push({ phrase, important, score });
      }
    }
  }

  return unique(candidates.map((candidate) => candidate.phrase))
    .map((phrase) => {
      const matches = candidates.filter(
        (candidate) => normalizePhrase(candidate.phrase) === normalizePhrase(phrase),
      );
      return matches.sort((left, right) => right.score - left.score)[0];
    })
    .sort((left, right) => right.score - left.score);
}

function buildKeywordReusePolicy(args: {
  plannerResult?: ProposalPlannerResult | null;
  jobTitle: string;
  jobDescription: string;
}): ProposalCriteriaAudit["keywordReusePolicy"] {
  const phrases = extractCandidatePhrases(`${args.jobTitle}. ${args.jobDescription}`);
  const supportedSource = [
    ...(args.plannerResult?.allowed_concrete_facts ?? []),
    ...(args.plannerResult?.allowed_transfer_themes ?? []),
  ].join(" ");
  const disallowedClaims = args.plannerResult?.disallowed_claims ?? [];

  const supported: string[] = [];
  const advisory: string[] = [];
  const blocked: string[] = [];

  for (const { phrase, important } of phrases) {
    const isSupported = phraseAppearsIn(phrase, supportedSource);
    const unsupportedSensitivePhrase =
      !isSupported &&
      (phraseSharesDisallowedSignal(phrase, disallowedClaims) ||
        CREDENTIAL_PHRASE_PATTERN.test(phrase) ||
        TOOL_OR_ACRONYM_PATTERN.test(phrase) ||
        SENIORITY_PHRASE_PATTERN.test(phrase));

    if (isSupported) {
      supported.push(phrase);
      continue;
    }
    if (unsupportedSensitivePhrase) {
      blocked.push(phrase);
      continue;
    }
    if (important || phraseTokens(phrase).length >= 2) {
      advisory.push(phrase);
    }
  }

  return {
    supported: unique(supported).slice(0, 12),
    advisory: unique(advisory).slice(0, 12),
    blocked: unique(blocked).slice(0, 12),
  };
}

function addRisk(
  risks: ProposalCriteriaAudit["majorRisks"],
  risk: ProposalCriteriaAudit["majorRisks"][number],
) {
  if (!risks.includes(risk)) risks.push(risk);
}

export function buildProposalCriteriaAudit(
  args: BuildProposalCriteriaAuditArgs,
): ProposalCriteriaAudit {
  const jobOfferPriorityPack = buildJobOfferPriorityPack(args.jobDescription);
  const companyValuesPack = analyzeCompanyValues(args.jobDescription);
  const evidenceSummary = args.plannerResult
    ? buildProposalEvidenceSummary(args.plannerResult)
    : null;
  const keywordReusePolicy = buildKeywordReusePolicy(args);
  const majorRisks: ProposalCriteriaAudit["majorRisks"] = [];

  if (keywordReusePolicy.blocked.length > 0) {
    addRisk(majorRisks, "unsupported_keyword");
  }
  if (companyValuesPack.confidence !== "none") {
    const valueText = [
      ...companyValuesPack.explicitValues,
      ...companyValuesPack.implicitValues,
    ].join(" ");
    const mappingSurface = [
      ...companyValuesPack.workSurfaceLinks,
      ...(args.plannerResult?.allowed_concrete_facts ?? []),
      ...(args.plannerResult?.allowed_transfer_themes ?? []),
    ].join(" ");
    if (valueText && !phraseTokens(valueText).some((token) => phraseAppearsIn(token, mappingSurface))) {
      addRisk(majorRisks, "unmapped_company_values");
    }
  }
  const availableText = [args.plannedText, args.generatedText].filter(Boolean).join(" ");
  if (
    availableText &&
    COMPANY_VALUE_BANNED_CLAIMS.some((claim) =>
      phraseAppearsIn(claim, availableText),
    )
  ) {
    addRisk(majorRisks, "company_praise");
  }
  if ((args.plannerResult?.allowed_concrete_facts.length ?? 0) === 0) {
    addRisk(majorRisks, "weak_evidence");
  }
  if (
    jobOfferPriorityPack.lowValueChecklist.length >
    jobOfferPriorityPack.coreResponsibilities.length +
      jobOfferPriorityPack.keyRequirements.length
  ) {
    addRisk(majorRisks, "checklist_letter");
  }
  if (args.plannerResult?.context_mode === "none") {
    addRisk(majorRisks, "no_context_claim");
  }
  if (
    args.plannerResult &&
    args.plannerResult.credential_status !== "exact_required" &&
    REQUIRED_CREDENTIAL_PATTERN.test(args.jobDescription) &&
    keywordReusePolicy.blocked.some((phrase) => CREDENTIAL_PHRASE_PATTERN.test(phrase))
  ) {
    addRisk(majorRisks, "credential_inflation");
  }

  return {
    strongestCandidateEvidence: evidenceSummary?.topEvidencePoints ?? [],
    employerCoreResponsibilities: jobOfferPriorityPack.coreResponsibilities,
    employerKeyRequirements: jobOfferPriorityPack.keyRequirements,
    lowValueChecklistItems: jobOfferPriorityPack.lowValueChecklist,
    companyValuesCoverage: companyValuesPack.confidence,
    keywordReusePolicy,
    evidencePriority: [
      "achievement",
      "responsibility",
      "workflow",
      "domain",
      "tool",
      "trait",
    ],
    majorRisks,
  };
}
