/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { z } from "zod";
import {
  PROPOSAL_DOCUMENT_LANGUAGE_CODES,
  getDeterministicCopyLanguage,
  getProposalOutputLanguageLabel,
} from "./proposalOutput";

import {
  type ProposalVoicePreset,
  IDENTITY_BACKGROUND_HARD_STOP_RULES,
  JOB_DESCRIPTION_TO_CANDIDATE_RULES,
  NO_CONTEXT_CANDIDATE_CLAIM_RULES,
  SOURCE_BACKED_SPECIFICITY_RULES,
} from "./voicePresets";
import type { ProposalOutputFormat } from "./proposalOutput";
import {
  analyzeCompanyValues,
  formatCompanyValuesPromptBlock,
  type CompanyValuesPack,
} from "./companyValues";

export type ProposalPlannerPersonalizationContext = {
  summary?: string;
  desiredPosition?: string;
  topSkills?: string[];
  recentExperience?: Array<{
    company?: string;
    position?: string;
    highlights?: string[];
  }>;
  standoutAchievements?: string[];
};

export const PROPOSAL_PLANNER_CONTEXT_MODES = [
  "none",
  "minimal",
  "sparse",
  "rich",
] as const;
export const PROPOSAL_PLANNER_DOMAIN_GAPS = [
  "direct",
  "adjacent",
  "distant",
] as const;
export const PROPOSAL_PLANNER_CREDENTIAL_STATUSES = [
  "exact_required",
  "related_not_equivalent",
  "in_progress_only",
  "unsupported",
] as const;
export const PROPOSAL_PLANNER_TRANSFER_MODES = [
  "literal",
  "abstract_only",
  "no_operational_analogy",
] as const;
export const PROPOSAL_PLANNER_PROOF_STRATEGIES = [
  "none",
  "abstract_only",
  "concrete_supported",
] as const;
export const PROPOSAL_PLANNER_OPENING_STRATEGIES = [
  "signature_default",
  "expert_structured",
  "direct_fast",
  "engaging_people",
  "storyteller_thread",
] as const;
export const PROPOSAL_PLANNER_OUTPUT_LANGUAGES =
  PROPOSAL_DOCUMENT_LANGUAGE_CODES;

export const COVER_LETTER_ROLE_THESIS_PRIORITY_ORDER = [
  "Hard job requirements",
  "Core role responsibilities",
  "Candidate CV evidence",
  "Claim boundaries",
  "Company/product context",
  "Grounded company values / working principles",
  "Natural ATS terms",
  "Tone / format mode",
] as const;

export const COVER_LETTER_ROLE_THESIS_CANON_SENTENCE =
  "Hard requirements and role responsibilities define the target. CV evidence proves relevance. Claim boundaries keep it honest. Company/product context and values sharpen specificity. ATS terms support discoverability. Tone and format shape delivery.";

export type ProposalPlannerContextMode =
  (typeof PROPOSAL_PLANNER_CONTEXT_MODES)[number];
export type ProposalPlannerDomainGap =
  (typeof PROPOSAL_PLANNER_DOMAIN_GAPS)[number];
export type ProposalPlannerCredentialStatus =
  (typeof PROPOSAL_PLANNER_CREDENTIAL_STATUSES)[number];
export type ProposalPlannerTransferMode =
  (typeof PROPOSAL_PLANNER_TRANSFER_MODES)[number];
export type ProposalPlannerProofStrategy =
  (typeof PROPOSAL_PLANNER_PROOF_STRATEGIES)[number];
export type ProposalPlannerOpeningStrategy =
  (typeof PROPOSAL_PLANNER_OPENING_STRATEGIES)[number];
export type ProposalPlannerOutputLanguage =
  (typeof PROPOSAL_PLANNER_OUTPUT_LANGUAGES)[number];

export const PROPOSAL_PLANNER_SCHEMA = z
  .object({
    context_mode: z.enum(PROPOSAL_PLANNER_CONTEXT_MODES),
    domain_gap: z.enum(PROPOSAL_PLANNER_DOMAIN_GAPS),
    credential_status: z.enum(PROPOSAL_PLANNER_CREDENTIAL_STATUSES),
    transfer_mode: z.enum(PROPOSAL_PLANNER_TRANSFER_MODES),
    output_language: z.enum(PROPOSAL_PLANNER_OUTPUT_LANGUAGES),
    allowed_concrete_facts: z.array(z.string()).max(18),
    allowed_transfer_themes: z.array(z.string()).max(12),
    disallowed_claims: z.array(z.string()).max(20),
    identity_hard_stops: z.array(z.string()).max(20),
    proof_strategy: z.enum(PROPOSAL_PLANNER_PROOF_STRATEGIES),
    opening_strategy: z.enum(PROPOSAL_PLANNER_OPENING_STRATEGIES),
  })
  .strict();

export type ProposalPlannerResult = z.infer<typeof PROPOSAL_PLANNER_SCHEMA>;
export type ProposalEvidenceSummary = {
  topEvidencePoints: string[];
  topAchievements: string[];
  topScopePoints: string[];
  relevantBackgroundFacts: string[];
  transferableTraits: string[];
  forbiddenBridges: string[];
  noContextMode: boolean;
};

export type CoverLetterRoleThesisV1 = {
  role_type:
    | "frontend engineer"
    | "backend engineer"
    | "product manager"
    | "designer"
    | "data analyst"
    | "sales executive"
    | "customer success manager"
    | "operations manager"
    | "marketing manager"
    | "finance analyst"
    | "executive assistant"
    | "nurse"
    | "teacher"
    | "legal counsel"
    | "general / unknown";
  hard_job_requirements: string[];
  core_role_responsibilities: string[];
  candidate_evidence: Array<{
    id: string;
    source: string;
    action: string;
    matched_to: string[];
    ownership_level:
      | "owned"
      | "led"
      | "built"
      | "supported"
      | "partnered"
      | "contributed"
      | "exposed to";
  }>;
  claim_boundaries: string[];
  company_product_context: string[];
  company_value_signals: Array<{
    label: string;
    confidence: "high" | "medium" | "low";
    source_text?: string;
  }>;
  ats_terms: string[];
  format_mode:
    | "full_cover_letter"
    | "linkedin_fast_apply"
    | "recruiter_reply"
    | "email_cover_note"
    | "conservative_enterprise";
};

export type ProposalCriteriaSignal = {
  label: string;
  category:
    | "hard_requirement"
    | "core_responsibility"
    | "candidate_evidence"
    | "claim_boundary"
    | "company_product_context"
    | "company_value"
    | "working_principle"
    | "ats_keyword"
    | "tone_format";
  source:
    | "job_description"
    | "resume"
    | "company_values_pack"
    | "company_profile"
    | "user_provided_context"
    | "detector";
  source_text?: string;
  confidence: "high" | "medium" | "low";
  relevance_to_role: "high" | "medium" | "low";
  matched_candidate_evidence_ids: string[];
  priority_rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  allowed_use:
    | "role_thesis"
    | "evidence_selection"
    | "claim_boundary"
    | "company_bridge"
    | "ats_language"
    | "tone_only"
    | "format_choice"
    | "do_not_use_in_output";
};

export type ProposalTruthPlanV1 = {
  planVersion: "proposal_truth_plan_v1";
  roleThesis: CoverLetterRoleThesisV1;
  criteria_signals: ProposalCriteriaSignal[];
  writingMode: "normal" | "adjacent_only" | "no_context_safe";
  modeConfidence: "high" | "medium" | "low";
  writerPolicy:
    | "normal_writer"
    | "constrained_writer"
    | "bypass_writer_use_fallback";
  jobPriorities: Array<{
    id: string;
    requirement: string;
    importance: "critical" | "important" | "nice_to_have";
    sourceText: string;
  }>;
  candidateFacts: Array<{
    id: string;
    fact: string;
    source:
      | "candidate_summary"
      | "candidate_skill"
      | "candidate_experience"
      | "candidate_achievement"
      | "candidate_project";
    sourceText: string;
  }>;
  allowedClaims: Array<{
    claim: string;
    factIds: string[];
    strength: "direct" | "soft" | "adjacent";
    claimType:
      | "candidate_fact"
      | "role_interest"
      | "job_surface"
      | "discussion_forward"
      | "collaboration_area";
  }>;
  blockedClaims: Array<{
    claim: string;
    reason:
      | "no_candidate_evidence"
      | "job_description_only"
      | "missing_requirement"
      | "overstated_seniority"
      | "unsupported_tool"
      | "unsupported_metric"
      | "unsupported_leadership"
      | "company_praise"
      | "no_context_personal_claim";
  }>;
  missingCriticalRequirements: Array<{
    requirement: string;
    sourceText: string;
    safeTreatment:
      | "omit"
      | "frame_as_gap"
      | "collaboration_area"
      | "refer_to_specialist";
  }>;
};

export type ProposalTruthPlanCandidateFactInput = {
  id?: string;
  fact: string;
  source?: ProposalTruthPlanV1["candidateFacts"][number]["source"];
  sourceText?: string;
};

export type BuildProposalTruthPlanV1Input = {
  jobTitle: string;
  jobDescription: string;
  personalizationContext?: ProposalPlannerPersonalizationContext | null;
  candidateFacts?: ProposalTruthPlanCandidateFactInput[];
  contextMode?: ProposalPlannerContextMode;
  expectedCriticalRequirements?: string[];
  expectedBlockedClaims?: string[];
};

export type ProposalTruthPlanValidationIssue = {
  code:
    | "direct_claim_missing_fact_ids"
    | "candidate_claim_missing_fact_ids"
    | "no_context_candidate_facts"
    | "no_context_unsafe_allowed_claim"
    | "no_context_direct_claim";
  claim?: string;
  message: string;
};

type NormalizeProposalPlannerArgs = {
  rawPlan: ProposalPlannerResult;
  voicePreset: ProposalVoicePreset;
  contextMode: ProposalPlannerContextMode;
  sourceFactBank: string[];
  outputLanguage: ProposalPlannerOutputLanguage;
  jobTitle: string;
  jobDescription: string;
};

type BuildProposalPlannerPromptArgs = {
  jobTitle: string;
  jobDescription: string;
  voicePreset: ProposalVoicePreset;
  contextMode: ProposalPlannerContextMode;
  outputLanguage: ProposalPlannerOutputLanguage;
  personalizationContext: ProposalPlannerPersonalizationContext | null;
  generationControlsBlock?: string;
  companyValuesPack?: CompanyValuesPack;
};

const MAX_FACT_BANK_ITEMS = 18;
const MAX_ALLOWED_FACTS = 12;
const MAX_THEMES = 8;
const MAX_DISALLOWED_CLAIMS = 14;
const MAX_HARD_STOPS = 10;
const DOMAIN_GAP_STOPWORDS = new Set([
  "about",
  "align",
  "allows",
  "candidate",
  "company",
  "description",
  "detail",
  "details",
  "experience",
  "group",
  "hiring",
  "interest",
  "position",
  "professional",
  "requirements",
  "responsibilities",
  "role",
  "service",
  "services",
  "skills",
  "support",
  "team",
  "work",
]);

const BASE_IDENTITY_HARD_STOPS = [
  "veteran status",
  "military service",
  "public-service background",
  "accreditation or licensing",
  "completed degree status",
  "direct domain-practice background",
  "community membership or lived experience",
] as const;

const SAFE_NO_CONTEXT_TRANSFER_THEMES = [
  "interest in the role",
  "interest in the type of work",
  "company-specific motivation",
  "shared values or mission interest",
  "professional curiosity",
  "role understanding",
  "polite closing",
] as const;
const UNSUPPORTED_TECHNICAL_SEO_CLAIMS = [
  "worked closely with SEO teams",
  "optimized crawlability",
  "schema placement",
  "crawl budget",
  "canonicalization",
  "internal linking patterns",
  "technical SEO diagnosis",
  "search visibility familiarity",
  "marketplace-style SEO implementation",
  "implementing schema changes",
  "optimizing internal linking structures",
  "implementing schema markup",
  "internal-linking adjustments",
  "canonical tags",
  "indexing fixes",
  "crawlability fixes",
  "crawlable markup",
] as const;
export const PROPOSAL_ALLOWED_CAUTIOUS_BRIDGES = [
  "relevant to",
  "background in",
  "experience in",
  "may offer relevant perspective",
] as const;
export const PROPOSAL_GENERIC_FUTURE_VALUE_VERBS = [
  "support",
  "contribute",
  "help",
  "fit",
  "value",
] as const;
export const PROPOSAL_GENERIC_FUTURE_VALUE_TARGETS = [
  "company",
  "team",
  "teams",
  "operations",
  "goals",
  "mission",
  "client",
  "clients",
] as const;
export const PROPOSAL_FORBIDDEN_BRIDGES = [
  "support your team",
  "would allow me to contribute",
  "would enable me to support",
  "aligns with your need for",
  "aligns with your need for someone who can",
  "positions me to",
  "would support",
  "would help ensure",
  "contribute to",
  "contributing to",
  "could support",
  "could contribute",
  "contribute to your team",
  "bring my skills to",
  "bring my experience to",
  "bring my reliability to",
  "bring my attention to detail to",
  "my skills could support",
  "my approach could support",
  "could support your team",
  "could support your needs",
  "could support your operations",
  "support your operations",
  "support your goals",
  "support your mission",
  "contribute effectively",
  "translate effectively to",
  "fit with your team",
  "might fit with your team",
  "fit with your team's goals",
  "fit with your team’s goals",
  "how my skills could",
  "ensures i can contribute",
  "add value",
  "how i might support your goals",
  "opportunity to contribute to your mission",
  "opportunity to contribute to community safety",
  "eager to contribute",
  "prepared to adapt quickly",
  "I am ready to",
  "I am able to",
  "I am capable of",
  "I can help with",
  "I am well qualified",
  "my background positions me well",
] as const;
const ACHIEVEMENT_RESULT_PATTERN =
  /\b(?:improv(?:e|ed|es|ing)|reduc(?:e|ed|es|ing)|increas(?:e|ed|es|ing)|decreas(?:e|ed|es|ing)|grew|grown|boost(?:ed|ing)?|rais(?:ed|ing)|cut|sav(?:ed|ing)|deliver(?:ed|ing)|achiev(?:ed|ing)|drove|driven|expand(?:ed|ing)|optimiz(?:ed|ing)|streamlin(?:ed|ing)|accelerat(?:ed|ing)|surpass(?:ed|ing)|lower(?:ed|ing))\b/i;
const ACHIEVEMENT_METRIC_PATTERN =
  /\b(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:percent|points|hours|days|weeks|months|years|clients|projects|tickets|cases|units|sites|locations|stores|calls|incidents|orders|shipments))\b/i;
const SCOPE_FACT_PATTERN =
  /\b(?:served as|worked as|experience in|background in|responsible for|responsibilities included|managed|supervised|oversaw|led|coordinated|handled|monitored|supported|designed|developed|built|maintained|operated|produced|investigated|documented|validated|tested|installed|trained|implemented|reviewed|executed|performed)\b/i;
const BACKGROUND_FACT_PATTERN =
  /\b(?:degree|education|training|coursework|certification|certificate|background|experience|role|position|company|team)\b/i;

function compactWhitespace(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function isUnsupportedTechnicalSeoMove(args: {
  jobTitle: string;
  jobDescription: string;
  sourceFacts: readonly string[];
}): boolean {
  const jobText = `${args.jobTitle} ${args.jobDescription}`;
  if (!/\b(?:technical\s+seo|indexing|schema|crawl|internal[-\s]linking)\b/i.test(jobText)) {
    return false;
  }

  const sourceText = args.sourceFacts.join(" ");
  return (
    /\b(?:front[-\s]?end|landing pages?|conversion(?: optimization)?)\b/i.test(
      sourceText,
    ) &&
    !/\b(?:technical\s+seo|seo specialist|crawl diagnostics?|schema strategy|indexing|canonicalization|crawl budget)\b/i.test(
      sourceText,
    )
  );
}

function buildAdjacentOnlySeoGuidance(): string[] {
  return [
    "adjacent_only_seo_rule: the candidate evidence supports frontend/conversion only, not technical SEO.",
    "For technical SEO marketplace work, switch to adjacent-only framing.",
    "Allowed framing: 'My background is frontend and conversion-focused, not technical SEO.'",
    "Allowed framing: 'I could support frontend execution once a technical SEO specialist defines the audit and recommendations.'",
    "Allowed framing: 'Indexing, schema strategy, crawl diagnostics, and internal-linking recommendations should be led by a technical SEO specialist.'",
    "Allowed framing: 'I can help with landing-page structure, frontend implementation, and conversion-aware page improvements if that adjacent support is useful.'",
    "Do not offer to implement schema markup, schema changes, internal-linking adjustments, canonical tags, indexing fixes, crawlability fixes, or crawlable markup unless source-backed.",
    `Do not claim SEO-team work, crawlability optimization, schema placement, crawl budget, canonicalization, internal-linking patterns, technical SEO diagnosis, search visibility familiarity, or marketplace-style SEO implementation.`,
  ];
}

export function normalizeProposalConstraintText(
  value: string | null | undefined,
): string {
  if (typeof value !== "string") return "";
  return compactWhitespace(
    value
      .normalize("NFKC")
      .replace(/\p{Cf}/gu, "")
      .replace(/[’`]/g, "'"),
  ).toLowerCase();
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PROPOSAL_GENERIC_FUTURE_VALUE_VERB_PATTERN = new RegExp(
  `\\b(?:${PROPOSAL_GENERIC_FUTURE_VALUE_VERBS.map((value) =>
    escapeForRegex(value),
  ).join("|")})\\b`,
  "i",
);
const PROPOSAL_GENERIC_FUTURE_VALUE_TARGET_PATTERN = new RegExp(
  `\\b(?:${PROPOSAL_GENERIC_FUTURE_VALUE_TARGETS.map((value) =>
    escapeForRegex(value),
  ).join("|")})(?:['’]s)?\\b`,
  "i",
);
const PROPOSAL_GENERIC_FUTURE_VALUE_COMBINED_PATTERN = new RegExp(
  `(?:\\b(?:${PROPOSAL_GENERIC_FUTURE_VALUE_VERBS.map((value) =>
    escapeForRegex(value),
  ).join("|")})\\b[^.!?\\n]{0,60}\\b(?:${PROPOSAL_GENERIC_FUTURE_VALUE_TARGETS.map(
    (value) => escapeForRegex(value),
  ).join("|")})(?:['’]s)?\\b)|(?:\\b(?:${PROPOSAL_GENERIC_FUTURE_VALUE_TARGETS.map(
    (value) => escapeForRegex(value),
  ).join("|")})(?:['’]s)?\\b[^.!?\\n]{0,60}\\b(?:${PROPOSAL_GENERIC_FUTURE_VALUE_VERBS.map(
    (value) => escapeForRegex(value),
  ).join("|")})\\b)`,
  "i",
);

export function containsForbiddenProposalBridge(
  value: string | null | undefined,
): boolean {
  const normalized = normalizeProposalConstraintText(value);
  if (!normalized) return false;

  if (
    PROPOSAL_FORBIDDEN_BRIDGES.some((phrase) =>
      normalized.includes(normalizeProposalConstraintText(phrase)),
    )
  ) {
    return true;
  }

  if (
    PROPOSAL_GENERIC_FUTURE_VALUE_COMBINED_PATTERN.test(normalized) ||
    (PROPOSAL_GENERIC_FUTURE_VALUE_VERB_PATTERN.test(normalized) &&
      PROPOSAL_GENERIC_FUTURE_VALUE_TARGET_PATTERN.test(normalized))
  ) {
    return true;
  }

  return false;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = compactWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function splitIntoFactSnippets(value: string | null | undefined): string[] {
  const normalized = compactWhitespace(value);
  if (!normalized) return [];

  const malformedFragmentPatterns = [
    /\b(?:which|that|who|while|because|although|though|and|but|or)\.$/i,
    /(?:[—-]|,\s*)(?:qualities?|skills?|strengths?|traits?|capabilities?)\.$/i,
    /\b(?:a|an|the)\s+(?:skill|strength|quality|trait|ability|capability)\.$/i,
  ] as const;
  const protectAbbreviations = (input: string): string =>
    input
      .replace(/\bPvt\.(?=\s|$)/g, "Pvt__DOT__")
      .replace(/\bLtd\.(?=\s|$)/g, "Ltd__DOT__")
      .replace(/\bSt\.(?=\s|$)/g, "St__DOT__")
      .replace(/\bInc\.(?=\s|$)/g, "Inc__DOT__")
      .replace(/\bCo\.(?=\s|$)/g, "Co__DOT__")
      .replace(/\bCorp\.(?=\s|$)/g, "Corp__DOT__");
  const restoreAbbreviations = (input: string): string =>
    input.replace(/__DOT__/g, ".");
  const snippetLooksUsable = (snippet: string): boolean => {
    const compacted = compactWhitespace(snippet);
    if (!compacted) return false;
    if (
      /^\d+\s+(?:month|months|year|years)\s+work experience\b/i.test(
        compacted,
      )
    ) {
      return false;
    }
    if (malformedFragmentPatterns.some((pattern) => pattern.test(compacted))) {
      return false;
    }
    if (
      /^(?:the|this|these|those)\b/i.test(compacted) &&
      /\bi\s+(?:installed|built|developed|created|implemented|maintained|managed|configured|designed)\b/i.test(
        compacted,
      )
    ) {
      const match = compacted.match(
        /\bi\s+(installed|built|developed|created|implemented|maintained|managed|configured|designed)\b/i,
      );
      if (match?.index !== undefined) {
        const trailing = compactWhitespace(
          compacted.slice(match.index + match[0].length),
        );
        if (
          trailing &&
          !/\b(?:were|was|are|is|reduced|improved|increased|decreased|provided|gave|enabled|helped|supported|kept|led|resulted|cut|boosted|made)\b/i.test(
            trailing,
          )
        ) {
          return false;
        }
      }
    }
    return true;
  };

  return uniqueStrings(
    protectAbbreviations(normalized)
      .split(/\n+|(?<=[.!?])\s+|;\s+/)
      .map((entry) => compactWhitespace(restoreAbbreviations(entry)))
      .filter((entry) => snippetLooksUsable(entry)),
  );
}

function normalizeComparisonToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function extractDomainGapTokens(value: string): string[] {
  return Array.from(
    new Set(
      normalizeComparisonToken(value)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(
          (token) =>
            token.length >= 4 && !DOMAIN_GAP_STOPWORDS.has(token),
        ),
    ),
  );
}

function filterFactsAgainstBank(
  candidateFacts: string[],
  sourceFactBank: string[],
): string[] {
  if (sourceFactBank.length === 0) return [];
  const bankTokens = sourceFactBank.map((fact) => ({
    raw: fact,
    normalized: normalizeComparisonToken(fact),
  }));
  return uniqueStrings(candidateFacts).filter((fact) => {
    const normalized = normalizeComparisonToken(fact);
    if (!normalized) return false;
    return bankTokens.some(
      (entry) =>
        entry.normalized === normalized ||
        entry.normalized.includes(normalized) ||
        normalized.includes(entry.normalized),
    );
  });
}

function inferDomainGapFromFacts(args: {
  jobTitle: string;
  jobDescription: string;
  sourceFactBank: string[];
}): ProposalPlannerDomainGap | undefined {
  if (args.sourceFactBank.length === 0) return undefined;

  const titleTokens = new Set(extractDomainGapTokens(args.jobTitle));
  const jobTokens = new Set([
    ...titleTokens,
    ...extractDomainGapTokens(args.jobDescription),
  ]);
  if (jobTokens.size === 0) return undefined;

  const factTokens = new Set(
    args.sourceFactBank.flatMap((fact) => extractDomainGapTokens(fact)),
  );
  const totalOverlap = Array.from(factTokens).filter((token) =>
    jobTokens.has(token),
  ).length;
  const titleOverlap = Array.from(factTokens).filter((token) =>
    titleTokens.has(token),
  ).length;

  if ((titleOverlap >= 1 && totalOverlap >= 2) || titleOverlap >= 2) {
    return "direct";
  }
  if (totalOverlap >= 1) {
    return "adjacent";
  }
  return "distant";
}

function buildDefaultDisallowedClaims(args: {
  contextMode: ProposalPlannerContextMode;
  domainGap: ProposalPlannerDomainGap;
  credentialStatus: ProposalPlannerCredentialStatus;
  outputLanguage: ProposalPlannerOutputLanguage;
}): string[] {
  const claims = [
    "Do not rewrite job-description requirements as prior candidate experience.",
    "Do not infer veteran status, military service, public-service background, accreditation/licensing, completed degree status, or direct domain-practice background unless explicitly source-backed.",
  ];

  if (args.contextMode === "none") {
    claims.push(
      "Do not claim prior roles, prior systems used, prior incidents handled, quantified results, certifications, degrees, licenses, or generic pseudo-background in no-context mode.",
      "Do not use invented negative-history disclaimers or soft capability wording that implies acquired practice in no-context mode.",
      "Do not describe the candidate's past, capability, familiarity, or experience in no-context mode.",
      "Do not use phrases such as 'while I may not have direct experience', 'while I am new to the field', 'I understand the importance of', or 'my ability to ... would allow me to ...' when they imply soft readiness in no-context mode.",
      "Do not claim familiarity with CCTV, access control, alarms, inspections, emergency response, visitor systems, or other tools/processes in no-context mode unless framed only as willingness to learn or simple role understanding.",
    );
  }

  if (args.credentialStatus !== "exact_required") {
    claims.push(
      "Do not claim the exact required credential, license, or completed qualification unless the source explicitly proves it.",
      "Do not say the candidate meets the requirement, holds the required certification, is licensed, or is qualified under the requirement unless that exact claim is source-backed.",
    );
  }

  if (args.credentialStatus === "in_progress_only") {
    claims.push(
      "Do not present in-progress education or in-progress credentials as completed.",
    );
  }

  if (args.credentialStatus === "related_not_equivalent") {
    claims.push(
      "Do not present related training or related certification as satisfying the exact requirement.",
    );
  }

  if (args.domainGap === "adjacent" || args.domainGap === "distant") {
    claims.push(
      "Do not present adjacent strengths as direct target-role readiness or use literal task-to-task analogies that overstate fit.",
    );
  }

  if (args.domainGap === "distant") {
    claims.push(
      "Do not use direct target-domain verbs, public-service practice language, or operational analogies unless those claims are explicitly source-backed.",
    );
  }

  if (args.domainGap === "direct") {
    claims.push(
      "Do not sharpen supported details into stronger operational ownership, broader emergency-response history, visitor-documentation work, or JD-matching task history unless that exact wording is source-backed.",
    );
  }

  claims.push(
    "Do not synthesize employer-style names, organization names, or role labels that do not appear exactly in source-backed facts.",
  );

  const deterministicLanguage = getDeterministicCopyLanguage(
    args.outputLanguage,
  );
  claims.push(
    deterministicLanguage === "fr"
      ? "Do not switch to English; final prose must remain entirely in French."
      : deterministicLanguage === "en"
        ? "Do not switch to French or another language; final prose must remain entirely in English."
        : `Do not switch to English, French, or another language; final prose must remain entirely in ${getProposalOutputLanguageLabel(args.outputLanguage)}.`,
  );

  return claims;
}

function buildOpeningStrategyContract(
  openingStrategy: ProposalPlannerOpeningStrategy,
): string {
  switch (openingStrategy) {
    case "engaging_people":
      return "Keep the opening warm and grounded in people, team context, service, or shared work without stock enthusiasm or stronger fit/contribution claims. Let one later body sentence carry grounded people, guest, user, or collaborative context when the evidence or job description supports it.";
    case "storyteller_thread":
      return "Keep the opening connected and trajectory-aware when the supported evidence naturally allows it, without theatricality or a forced narrative hook. Carry one visible supported thread across the body so the next movement feels like a continuation rather than a detached inventory line, keep those transitions in complete sentences rather than fragmentary narrative beats, and avoid isolated relevance fragments that break continuity.";
    case "direct_fast":
      return "Keep the opening concise and close to the most relevant supported point without forcing a resume-style proof dump or contribution claim. Move quickly, but still give the body one additional grounded supporting beat when material exists before the close.";
    case "expert_structured":
      return "Keep the opening precise and well-structured, grounded in supported scope or evidence rather than ceremonial setup or stronger fit claims. Let the body include one analytical sentence explaining what the supported evidence says about the role's actual demands or operating context, and do not let it collapse into two factual inventory lines and the closing sentence when more grounded material exists.";
    case "signature_default":
    default:
      return "Open naturally from supported scope, grounded role context, or concrete work context, staying balanced and credible. Keep the body warm, concise, and substantive rather than minimal, do not let it stop at one proof sentence plus the close, and avoid stand-alone interest, commitment, or discussion fragments that do not add body substance.";
  }
}

function buildNoContextWriterPlanGuidance(
  format: ProposalOutputFormat,
): string[] {
  const shared = [
    "No-context mode must be motivation and work-surface only. Do not claim traits, habits, abilities, skills, background, experience, past work, group-project history, customer-facing history, or personal work habits.",
    "If context_mode is none, do not mention 'my background', 'my experience', 'my professional background', 'in past experiences', 'I’ve worked', 'skills I’ve developed', 'I’ve taken initiative', 'I’ve always prioritized', 'my ability', 'my habit', or any implied prior work history.",
    "If context_mode is none, do not claim traits, habits, or abilities such as 'my attention to detail', 'my methodical approach', 'how I approach work', 'what I value', 'what I prioritize', comfort with procedures, or confidence in adapting.",
    "If context_mode is none, do not say 'I do not have direct experience'; simply avoid experience claims.",
    "If context_mode is none, do not describe the candidate's past, capability, familiarity, experience, readiness, fit, or contribution potential.",
    "If context_mode is none, do not use phrases such as 'while I may not have direct experience', 'while I am new to the field', 'I understand the importance of', 'my ability to ... would allow me to ...', 'I am ready to', 'I am able to', 'I am capable of', 'I could support your team', or 'I would bring my skills to ...'.",
    "If context_mode is none, do not mention contribution to safety, mission, operations, team value, or how the candidate would perform tasks.",
    "If context_mode is none, do not mention secure environments, scenarios, patrols, access control, conflict resolution, or similar operational execution as something the candidate would do.",
    "If context_mode is none, do not combine a trait, interest, or value statement with operational role execution, support, or mission language.",
  ];

  switch (format) {
    case "application_message":
      return [
        "If context_mode is none, write a short, grounded application message rather than a capability pitch.",
        "If context_mode is none, use opener for the role contact context, proof for one concrete work surface, operating context, artifact, deliverable, or coordination thread from the job description, and follow_up_line for one short continuation that stays on that same thread.",
        "If context_mode is none, keep the proof on one concrete surface from the posting itself rather than turning the note into a role summary or compressed job-description paraphrase.",
        "If context_mode is none, let at most one sentence rely mainly on personal-interest framing; move any later sentence to the work itself, workflow, operating context, or team interaction described in the job description.",
        "If context_mode is none, do not connect the lines with past-experience summary wording, background-summary wording, prior-role narration, self-introduction, or recruiter-close filler.",
        ...shared,
      ];
    case "freelance_proposal":
      return [
        "If context_mode is none, write a cautious project proposal grounded in the client's described work, workflow, scope, deliverables, or collaboration context rather than in claimed past experience.",
        "If context_mode is none, use only project understanding, concrete work surfaces from the brief, a practical working approach, and a modest next-step close.",
        "If context_mode is none, do not invent prior clients, shipped projects, tools, timelines, deliverables, outcomes, or delivery readiness.",
        "If context_mode is none, do not lean on repeated personal-interest phrasing or generic enthusiasm.",
        ...shared,
      ];
    case "cover_letter":
    default:
      return [
        "If context_mode is none, write a grounded, non-claiming cover-letter body rather than a capability-based cover letter.",
        "If context_mode is none, use only role context, concrete work surfaces from the job description, company-specific detail when the employer context supports it, shared values or mission interest when grounded, and one brief discussion-forward close.",
        "If context_mode is none, aim for a body built from two grounded job-description sentences about the work itself, workflow, operating context, or employer context, plus at most one brief role-interest or curiosity sentence before the close.",
        "If context_mode is none and the job description gives enough concrete detail, make at least two substantive sentences about recurring responsibilities, workflow, operating context, coordination, communication, records, or team interaction from the job description before the brief close.",
        "If context_mode is none and concrete job-description material exists, make the first substantive sentence describe the actual work, products, outputs, media, files, process, or operating context rather than personal interest or admiration.",
        "If context_mode is none and concrete job-description material exists, make the next substantive sentence describe workflow, collaboration, revision, production constraints, deliverables, or coordination from the job description before any motivation-led sentence.",
        "If context_mode is none, do not let a role-title summary, scenic employer description, or generic paraphrase of the job description count as one of the grounded body sentences.",
        "If context_mode is none, do not let benefit-summary shells, environment-summary shells, or generic teamwork, professionalism, reliability, or seriousness filler stand in for the main body substance.",
        "If context_mode is none and you include one curiosity, seriousness, or role-interest sentence, make it concrete about the work, operating context, or employer context rather than generic admiration, benefits, or atmosphere.",
        "If context_mode is none, keep the main body substance on the work itself rather than on mission admiration, culture admiration, schedule, flexibility, growth language, or generic role-interest rhetoric.",
        "If context_mode is none, keep challenge language, opportunity language, mission admiration, growth language, and personal-interest rhetoric secondary only; they must not carry the body or come before the concrete work/process sentences when those are available.",
        "If context_mode is none, let at most one sentence rely mainly on personal-interest framing; move later sentences to the work itself, workflow, operating context, or team interaction described in the job description.",
        "If context_mode is none, do not use phrases such as 'I am particularly drawn to', 'The opportunity to', 'The day-to-day work itself', 'prepared to adapt', 'prepared to meet the minimum requirements', 'develop skills in', 'particularly engaging', 'compelling', 'attractive place to grow professionally', or 'resonates with my understanding'.",
        "If context_mode is none, do not let schedule, flexibility, or willingness-to-adapt language serve as one of the main supporting sentences.",
        ...shared,
      ];
  }
}

function buildEarlyProofGuidance(format: ProposalOutputFormat): string[] {
  switch (format) {
    case "application_message":
      return [
        "In CV-backed application messages, teach one named-fact proof sentence rather than a profile summary.",
        "Preferred proof shapes are 'At <company>, I <action> <result>.', 'I <action> at <company> <context/result>.', or 'One relevant example: <named fact>.'",
        "Prefer a named employer, site, artifact, file, workflow, or operating surface over anonymous previous-role or previous-employer setup.",
        "If multiple top_achievement items exist, you may bring one early when it helps, but do not default to opening with the only standout achievement.",
        "When supported evidence is thin or clustered around one proof point, open from supported scope, role context, or concrete work context first and use the achievement as later proof.",
        "If no top_achievement exists, use the strongest supported scope, responsibility, or named background fact early instead.",
        "Keep proof_line on one named fact that clearly maps to one employer-side work surface in the posting; a concrete but weakly related academic, research, presentation, or profile fact is not strong proof unless that mapping is explicit and hiring-useful.",
        "Keep fallback proof concrete and named; do not turn it into a role-history summary, category-level skill summary, broad background statement, record-of-results slogan, or fit-summary bridge.",
        "In no-context application messages, proof_line should stay on one concrete work surface from the posting itself, not on generic interest or a compressed summary of the whole role.",
      ];
    case "freelance_proposal":
      return [
        "If top_achievement or concrete scope items exist, use the most relevant one early to establish credibility, but do not force a formulaic proof-dump opening.",
        "If evidence is thin, stay specific about the client need, workflow, or working approach rather than inflating background claims.",
      ];
    case "cover_letter":
    default:
      return [
        "In CV-backed cover letters, let the first substantive movement prefer one top_evidence_point, top_scope_point, or relevant_background_fact before transferable_trait, generic role-interest language, or mission admiration.",
        "If multiple top_achievement items exist, you may bring one of the strongest supported proof points early when it helps, but do not default to opening with the only standout achievement.",
        "When supported evidence is thin or clustered around one proof point, open from supported scope, grounded role context, or concrete work context first and use the achievement as later proof.",
        "If no top_achievement exists, use the strongest supported scope, responsibility, or background fact instead.",
        "After the evidence anchor, use the next substantive movement to explain why that supported proof matters for the role's actual work, workflow, users, team context, or operating environment rather than defaulting to generic transfer or future-value language.",
        "When additional supported scope, background, or operating detail exists, spend one more grounded supporting sentence on that material before the close rather than stopping at proof plus generic relevance.",
        "In adjacent or distant CV-backed cover letters, make that relevance movement name one concrete overlap, operating constraint, or perspective the supported evidence speaks to; do not retreat into broad adaptability, fit, or value claims.",
      ];
  }
}

function buildClosingGuidance(format: ProposalOutputFormat): string {
  if (format === "freelance_proposal") {
    return "Any closing sentence must stay brief and limited to discussing the project, scope, or next step further. Do not add inflated promises, guarantees, value claims, or ceremonial sign-offs.";
  }

  return "Any closing sentence must stay brief and limited to discussing the role further. Do not mention contribution, support, value, fit, readiness, or how the candidate could help.";
}

function buildApplicationMessageBridgeGuidance(
  noContextMode: boolean,
): string {
  if (noContextMode) {
    return "After the work-surface anchor, the only allowed continuation is one short sentence that stays on that same named surface and makes the note more concrete, such as 'That entrance-coverage thread is the part of the role that stood out most to me.' or 'That records-and-handoff side of the posting is the part of the work that caught me first.' Do not shift into candidate history, past-execution verbs, self-introduction, fit summary, detail offers, profile or portfolio invitations, or recruiter-close filler.";
  }

  return "After the proof anchor, the only allowed continuation is one short sentence that stays on the same named proof and same work surface, such as 'That production-handoff thread is the part of the posting my Northline work maps to most clearly.' or 'That documentation-heavy side of the posting is where the hotel incident work is most relevant.' Do not switch into category summaries, anonymous role-history phrasing, fit summaries, detail offers, profile or portfolio invitations, or recruiter-close filler.";
}

function classifyEvidenceFact(
  fact: string,
): "achievement" | "scope" | "background" {
  if (
    ACHIEVEMENT_RESULT_PATTERN.test(fact) ||
    ACHIEVEMENT_METRIC_PATTERN.test(fact)
  ) {
    return "achievement";
  }
  if (SCOPE_FACT_PATTERN.test(fact)) {
    return "scope";
  }
  if (BACKGROUND_FACT_PATTERN.test(fact)) {
    return "background";
  }
  return "scope";
}

function truthPlanFactSourceForText(
  text: string,
): ProposalTruthPlanV1["candidateFacts"][number]["source"] {
  if (ACHIEVEMENT_RESULT_PATTERN.test(text) || ACHIEVEMENT_METRIC_PATTERN.test(text)) {
    return "candidate_achievement";
  }
  if (/\b(?:react|typescript|seo|crm|salesforce|excel|python|figma|webflow|sql|node\.?js|design systems?|frontend|landing pages?|conversion optimization|coordination|documentation|stakeholder communication)\b/i.test(text)) {
    return "candidate_skill";
  }
  return "candidate_experience";
}

function buildTruthPlanCandidateFacts(
  args: Pick<BuildProposalTruthPlanV1Input, "personalizationContext" | "candidateFacts">,
): ProposalTruthPlanV1["candidateFacts"] {
  const explicitFacts = args.candidateFacts ?? [];
  const facts: ProposalTruthPlanV1["candidateFacts"] = [];
  const addFact = (
    fact: string | null | undefined,
    source: ProposalTruthPlanV1["candidateFacts"][number]["source"],
    sourceText?: string,
    id?: string,
  ) => {
    const cleaned = compactWhitespace(fact);
    if (!cleaned) return;
    const key = normalizeComparisonToken(cleaned);
    if (facts.some((entry) => normalizeComparisonToken(entry.fact) === key)) {
      return;
    }
    facts.push({
      id: compactWhitespace(id) || `fact_${facts.length + 1}`,
      fact: cleaned,
      source,
      sourceText: compactWhitespace(sourceText) || cleaned,
    });
  };

  for (const fact of explicitFacts) {
    addFact(
      fact.fact,
      fact.source ?? truthPlanFactSourceForText(fact.fact),
      fact.sourceText,
      fact.id,
    );
  }

  const context = args.personalizationContext;
  if (context) {
    for (const snippet of splitIntoFactSnippets(context.summary)) {
      addFact(snippet, "candidate_summary");
    }
    for (const skill of context.topSkills ?? []) {
      addFact(skill, "candidate_skill");
    }
    for (const experience of context.recentExperience ?? []) {
      const role = compactWhitespace(
        [experience.position, experience.company ? `at ${experience.company}` : ""]
          .filter(Boolean)
          .join(" "),
      );
      addFact(role, "candidate_experience");
      for (const highlight of experience.highlights ?? []) {
        for (const snippet of splitIntoFactSnippets(highlight)) {
          addFact(snippet, "candidate_experience");
        }
      }
    }
    for (const achievement of context.standoutAchievements ?? []) {
      for (const snippet of splitIntoFactSnippets(achievement)) {
        addFact(snippet, "candidate_achievement");
      }
    }
  }

  return facts.slice(0, 18);
}

function addTruthPlanPriority(
  priorities: ProposalTruthPlanV1["jobPriorities"],
  requirement: string,
  sourceText: string,
  importance: ProposalTruthPlanV1["jobPriorities"][number]["importance"],
): void {
  const cleaned = compactWhitespace(requirement);
  if (!cleaned) return;
  const key = normalizeComparisonToken(cleaned);
  if (priorities.some((priority) => normalizeComparisonToken(priority.requirement) === key)) {
    return;
  }
  priorities.push({
    id: `job_${priorities.length + 1}`,
    requirement: cleaned,
    importance,
    sourceText: compactWhitespace(sourceText) || cleaned,
  });
}

function buildTruthPlanJobPriorities(args: {
  jobTitle: string;
  jobDescription: string;
  expectedCriticalRequirements?: string[];
}): ProposalTruthPlanV1["jobPriorities"] {
  const jobText = `${args.jobTitle}. ${args.jobDescription}`;
  const priorities: ProposalTruthPlanV1["jobPriorities"] = [];
  for (const requirement of args.expectedCriticalRequirements ?? []) {
    addTruthPlanPriority(priorities, requirement, requirement, "critical");
  }

  const keywordPriorities: Array<{
    pattern: RegExp;
    requirement: string;
    importance: ProposalTruthPlanV1["jobPriorities"][number]["importance"];
  }> = [
    { pattern: /\breact\b/i, requirement: "React development", importance: "critical" },
    { pattern: /\btypescript\b/i, requirement: "TypeScript development", importance: "critical" },
    { pattern: /\b(?:reusable ui systems?|design systems?)\b/i, requirement: "reusable UI systems", importance: "important" },
    { pattern: /\bperformance\b/i, requirement: "performance optimization", importance: "important" },
    { pattern: /\b(?:product and design|design and product|product\/design)\b/i, requirement: "collaboration with product and design", importance: "important" },
    { pattern: /\bmentor(?:ing)?\b/i, requirement: "mentoring junior engineers", importance: "important" },
    { pattern: /\banalytics instrumentation\b/i, requirement: "analytics instrumentation", importance: "nice_to_have" },
    { pattern: /\bexperimentation\b/i, requirement: "experimentation workflows", importance: "nice_to_have" },
    { pattern: /\bindexing\b/i, requirement: "indexing fixes", importance: "critical" },
    { pattern: /\bschema\b/i, requirement: "schema strategy / schema implementation", importance: "critical" },
    { pattern: /\bcrawl diagnostics?\b/i, requirement: "crawl diagnostics", importance: "critical" },
    { pattern: /\binternal[-\s]linking\b/i, requirement: "internal-linking recommendations", importance: "critical" },
    { pattern: /\bfollow[-\s]?up\b/i, requirement: "follow-up coordination", importance: "critical" },
    { pattern: /\brecords?\b/i, requirement: "organized records", importance: "critical" },
    { pattern: /\bprofessional(?:ly)? communication|communicate professionally\b/i, requirement: "professional communication", importance: "important" },
    { pattern: /\bcrm\b/i, requirement: "CRM expertise", importance: "important" },
    { pattern: /\bquota\b/i, requirement: "quota ownership", importance: "important" },
    { pattern: /\bschedules?\b/i, requirement: "schedule management", importance: "critical" },
    { pattern: /\bdocumentation\b/i, requirement: "documentation", importance: "critical" },
    { pattern: /\bvendor\b/i, requirement: "vendor communication", importance: "critical" },
    { pattern: /\bprocurement\b/i, requirement: "vendor procurement ownership", importance: "critical" },
    { pattern: /\boffice support\b/i, requirement: "general office support", importance: "important" },
    { pattern: /\bprocess follow[-\s]?through\b/i, requirement: "process follow-through", importance: "important" },
  ];

  for (const entry of keywordPriorities) {
    if (entry.pattern.test(jobText)) {
      addTruthPlanPriority(priorities, entry.requirement, jobText, entry.importance);
    }
  }

  if (priorities.length === 0) {
    addTruthPlanPriority(priorities, args.jobTitle, jobText, "critical");
  }

  return priorities.slice(0, 12);
}

function factSupportsRequirement(
  fact: ProposalTruthPlanV1["candidateFacts"][number],
  requirement: string,
): "direct" | "adjacent" | null {
  const factText = normalizeComparisonToken(fact.fact);
  const requirementText = normalizeComparisonToken(requirement);
  if (!factText || !requirementText) return null;
  const directGroups = [
    ["react", "typescript", "frontend"],
    ["design system", "ui systems"],
    ["performance", "load time", "optimization", "optimizations"],
    ["experiment", "ab testing", "conversion"],
    ["product", "design", "collaborat", "partnered"],
    ["coordination", "coordinate", "schedules", "process follow"],
    ["documentation", "records"],
    ["stakeholder communication", "communication"],
    ["landing pages", "frontend", "conversion"],
  ];
  for (const group of directGroups) {
    const requirementMatch = group.some((token) => requirementText.includes(token));
    const factMatch = group.some((token) => factText.includes(token));
    if (requirementMatch && factMatch) return "direct";
  }
  const requirementTokens = new Set(extractDomainGapTokens(requirement));
  const factTokens = new Set(extractDomainGapTokens(fact.fact));
  const overlap = Array.from(requirementTokens).filter((token) => factTokens.has(token));
  if (overlap.length >= 2) return "direct";
  if (overlap.length === 1) return "adjacent";
  if (
    /\b(?:vendor|office|schedule|procurement)\b/i.test(requirement) &&
    /\b(?:coordination|documentation|stakeholder communication|process)\b/i.test(fact.fact)
  ) {
    return "adjacent";
  }
  if (
    /\b(?:indexing|schema|crawl|internal[-\s]linking|technical seo)\b/i.test(requirement) &&
    /\b(?:frontend|landing pages?|conversion)\b/i.test(fact.fact)
  ) {
    return "adjacent";
  }
  return null;
}

function hasDirectSupport(
  facts: ProposalTruthPlanV1["candidateFacts"],
  requirement: string,
): boolean {
  return facts.some((fact) => factSupportsRequirement(fact, requirement) === "direct");
}

function blockedClaim(
  claim: string,
  reason: ProposalTruthPlanV1["blockedClaims"][number]["reason"],
): ProposalTruthPlanV1["blockedClaims"][number] {
  return { claim, reason };
}

function missingRequirement(
  requirement: string,
  sourceText: string,
  safeTreatment: ProposalTruthPlanV1["missingCriticalRequirements"][number]["safeTreatment"],
): ProposalTruthPlanV1["missingCriticalRequirements"][number] {
  return { requirement, sourceText, safeTreatment };
}

function uniqueBlockedClaims(
  claims: ProposalTruthPlanV1["blockedClaims"],
): ProposalTruthPlanV1["blockedClaims"] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${normalizeComparisonToken(claim.claim)}:${claim.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferCoverLetterRoleType(
  jobTitle: string,
  jobDescription: string,
): CoverLetterRoleThesisV1["role_type"] {
  const text = `${jobTitle} ${jobDescription}`;
  if (/\bfront[-\s]?end|react|typescript|ui engineer\b/i.test(text)) return "frontend engineer";
  if (/\bback[-\s]?end|node\.?js|api|database|services?\b/i.test(text)) return "backend engineer";
  if (/\bproduct manager|roadmap|product strategy\b/i.test(text)) return "product manager";
  if (/\bdesigner|ux|ui design|figma\b/i.test(text)) return "designer";
  if (/\bdata analyst|analytics|dashboard|sql|reporting\b/i.test(text)) return "data analyst";
  if (/\bsales|account executive|business development\b/i.test(text)) return "sales executive";
  if (/\bcustomer success|account management|customer support|support specialist\b/i.test(text)) return "customer success manager";
  if (/\boperations|program manager|coordinator|process|handoff\b/i.test(text)) return "operations manager";
  if (/\bmarketing|campaign|content|seo|growth\b/i.test(text)) return "marketing manager";
  if (/\bfinance|financial|accounting|revenue operations\b/i.test(text)) return "finance analyst";
  if (/\bexecutive assistant|administrative assistant|admin\b/i.test(text)) return "executive assistant";
  if (/\bnurse|patient|clinical|healthcare|medical\b/i.test(text)) return "nurse";
  if (/\bteacher|teaching|classroom|students?\b/i.test(text)) return "teacher";
  if (/\blegal counsel|lawyer|contract|compliance counsel\b/i.test(text)) return "legal counsel";
  return "general / unknown";
}

function coverLetterOwnershipLevel(
  fact: string,
): CoverLetterRoleThesisV1["candidate_evidence"][number]["ownership_level"] {
  if (/\bowned|ownership\b/i.test(fact)) return "owned";
  if (/\bled|lead\b/i.test(fact)) return "led";
  if (/\bbuilt|developed|implemented|created\b/i.test(fact)) return "built";
  if (/\bpartnered|collaborated\b/i.test(fact)) return "partnered";
  if (/\bsupported|assisted|helped\b/i.test(fact)) return "supported";
  if (/\bexposure|exposed|familiar\b/i.test(fact)) return "exposed to";
  return "contributed";
}

function roleThesisAtsTerms(jobPriorities: ProposalTruthPlanV1["jobPriorities"]): string[] {
  return uniqueStrings(
    jobPriorities
      .map((priority) => priority.requirement.replace(/[.!?]$/u, ""))
      .filter((requirement) => requirement.split(/\s+/).length <= 5),
  ).slice(0, 8);
}

function buildCoverLetterRoleThesis(args: {
  jobTitle: string;
  jobDescription: string;
  jobPriorities: ProposalTruthPlanV1["jobPriorities"];
  candidateFacts: ProposalTruthPlanV1["candidateFacts"];
  blockedClaims: ProposalTruthPlanV1["blockedClaims"];
  missingCriticalRequirements: ProposalTruthPlanV1["missingCriticalRequirements"];
  contextMode: ProposalPlannerContextMode;
}): CoverLetterRoleThesisV1 {
  const hardRequirements = args.jobPriorities
    .filter((priority) => priority.importance === "critical" || priority.importance === "important")
    .map((priority) => priority.requirement);
  const coreResponsibilities = args.jobPriorities
    .filter((priority) => /\b(?:lead|own|coordinate|track|manage|maintain|support|build|improve|handle|prepare|document|design|analy[sz]e|report|deliver|develop|review|operate|collaborate|implement|schedule)\b/i.test(priority.requirement))
    .map((priority) => priority.requirement);
  const selectedEvidence = args.candidateFacts.slice(0, 3).map((fact) => ({
    id: fact.id,
    source: fact.sourceText,
    action: fact.fact,
    matched_to: args.jobPriorities
      .filter((priority) => Boolean(factSupportsRequirement(fact, priority.requirement)))
      .map((priority) => priority.requirement)
      .slice(0, 3),
    ownership_level: coverLetterOwnershipLevel(fact.fact),
  }));
  const companyValues = analyzeCompanyValues(args.jobDescription);
  const companyValueSignals = [
    ...companyValues.explicitValues.map((label) => ({
      label,
      confidence: "high" as const,
      source_text: companyValues.valueEvidenceSnippets.find((snippet) =>
        new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(snippet),
      ),
    })),
    ...companyValues.implicitValues.map((label) => ({
      label,
      confidence: "medium" as const,
      source_text: companyValues.valueEvidenceSnippets.find((snippet) =>
        new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(snippet),
      ),
    })),
  ].slice(0, 6);

  return {
    role_type: inferCoverLetterRoleType(args.jobTitle, args.jobDescription),
    hard_job_requirements: uniqueStrings(hardRequirements).slice(0, 8),
    core_role_responsibilities: uniqueStrings(coreResponsibilities).slice(0, 8),
    candidate_evidence: selectedEvidence,
    claim_boundaries: uniqueStrings([
      ...args.blockedClaims.map((claim) => claim.claim),
      ...args.missingCriticalRequirements.map(
        (requirement) => `${requirement.requirement} must not be claimed as candidate experience`,
      ),
    ]).slice(0, 10),
    company_product_context: uniqueStrings([
      ...companyValues.workSurfaceLinks,
      ...args.jobPriorities.slice(0, 2).map((priority) => priority.sourceText),
    ]).slice(0, 5),
    company_value_signals: companyValueSignals,
    ats_terms: roleThesisAtsTerms(args.jobPriorities),
    format_mode: args.contextMode === "none" ? "linkedin_fast_apply" : "full_cover_letter",
  };
}

function criteriaSignalPriority(
  category: ProposalCriteriaSignal["category"],
): ProposalCriteriaSignal["priority_rank"] {
  if (category === "hard_requirement") return 1;
  if (category === "core_responsibility") return 2;
  if (category === "candidate_evidence") return 3;
  if (category === "claim_boundary") return 4;
  if (category === "company_product_context") return 5;
  if (category === "company_value" || category === "working_principle") return 6;
  if (category === "ats_keyword") return 7;
  return 8;
}

function addCriteriaSignal(
  signals: ProposalCriteriaSignal[],
  signal: Omit<ProposalCriteriaSignal, "priority_rank">,
): void {
  const key = `${signal.category}:${normalizeComparisonToken(signal.label)}`;
  if (signals.some((entry) => `${entry.category}:${normalizeComparisonToken(entry.label)}` === key)) {
    return;
  }
  signals.push({ ...signal, priority_rank: criteriaSignalPriority(signal.category) });
}

function companyValueMatchesCandidateEvidence(
  valueLabel: string,
  evidenceText: string,
): boolean {
  const value = normalizeComparisonToken(valueLabel);
  const evidence = normalizeComparisonToken(evidenceText);
  if (!value || !evidence) return false;

  const hasAny = (terms: readonly string[]) =>
    terms.some((term) => evidence.includes(term));

  if (value.includes("customer") || value.includes("client") || value.includes("trust")) {
    return hasAny([
      "customer",
      "client",
      "patient",
      "user",
      "support",
      "service",
      "issue tracking",
      "compliance",
      "reliability",
      "reliable",
      "workflow",
      "facing",
    ]);
  }
  if (value.includes("operational") || value.includes("excellence") || value.includes("accountability")) {
    return hasAny([
      "process",
      "documentation",
      "reporting",
      "coordination",
      "handoff",
      "accuracy",
      "reliability",
      "operations",
      "tracked",
      "maintained",
    ]);
  }
  if (value.includes("craft") || value.includes("quality") || value.includes("precision")) {
    return hasAny([
      "design system",
      "product quality",
      "ui",
      "writing",
      "code quality",
      "shipped",
      "detail",
      "quality",
      "polish",
    ]);
  }
  if (value.includes("speed") || value.includes("iteration") || value.includes("fast")) {
    return hasAny([
      "experiment",
      "conversion",
      "iteration",
      "iterative",
      "release",
      "rapid",
      "delivery",
      "turnaround",
      "reduced",
      "improved",
    ]);
  }
  if (value.includes("security") || value.includes("safety") || value.includes("compliance") || value.includes("reliability")) {
    return hasAny([
      "security",
      "compliance",
      "risk",
      "audit",
      "regulated",
      "privacy",
      "reliability",
      "incident",
      "safety",
      "policy",
    ]);
  }
  if (value.includes("collaboration") || value.includes("ownership")) {
    return hasAny([
      "partnered",
      "collaborated",
      "cross functional",
      "handoff",
      "stakeholder",
      "owned",
      "led",
      "coordinated",
    ]);
  }

  return value
    .split(/\s+/)
    .filter((token) => token.length >= 5)
    .some((token) => evidence.includes(token));
}

function buildCriteriaSignals(args: {
  roleThesis: CoverLetterRoleThesisV1;
  jobPriorities: ProposalTruthPlanV1["jobPriorities"];
  candidateFacts: ProposalTruthPlanV1["candidateFacts"];
  blockedClaims: ProposalTruthPlanV1["blockedClaims"];
  missingCriticalRequirements: ProposalTruthPlanV1["missingCriticalRequirements"];
}): ProposalCriteriaSignal[] {
  const signals: ProposalCriteriaSignal[] = [];
  for (const priority of args.jobPriorities) {
    const matched = args.candidateFacts
      .filter((fact) => Boolean(factSupportsRequirement(fact, priority.requirement)))
      .map((fact) => fact.id);
    addCriteriaSignal(signals, {
      label: priority.requirement,
      category: priority.importance === "nice_to_have" ? "ats_keyword" : "hard_requirement",
      source: "job_description",
      source_text: priority.sourceText,
      confidence: priority.importance === "critical" ? "high" : "medium",
      relevance_to_role: priority.importance === "nice_to_have" ? "medium" : "high",
      matched_candidate_evidence_ids: matched,
      allowed_use: matched.length > 0 ? "role_thesis" : "claim_boundary",
    });
  }
  for (const evidence of args.roleThesis.candidate_evidence) {
    addCriteriaSignal(signals, {
      label: evidence.action,
      category: "candidate_evidence",
      source: "resume",
      source_text: evidence.source,
      confidence: "high",
      relevance_to_role: evidence.matched_to.length > 0 ? "high" : "medium",
      matched_candidate_evidence_ids: [evidence.id],
      allowed_use: "evidence_selection",
    });
  }
  for (const boundary of [...args.blockedClaims.map((claim) => claim.claim), ...args.missingCriticalRequirements.map((entry) => entry.requirement)]) {
    addCriteriaSignal(signals, {
      label: boundary,
      category: "claim_boundary",
      source: "detector",
      confidence: "high",
      relevance_to_role: "high",
      matched_candidate_evidence_ids: [],
      allowed_use: "claim_boundary",
    });
  }
  for (const value of args.roleThesis.company_value_signals) {
    const matchedEvidenceIds = args.roleThesis.candidate_evidence
      .filter((item) =>
        companyValueMatchesCandidateEvidence(value.label, item.action),
      )
      .map((item) => item.id);
    addCriteriaSignal(signals, {
      label: value.label,
      category: "company_value",
      source: "company_values_pack",
      source_text: value.source_text,
      confidence: value.confidence,
      relevance_to_role: value.confidence === "low" ? "low" : "medium",
      matched_candidate_evidence_ids: matchedEvidenceIds,
      allowed_use:
        value.confidence === "low"
          ? "do_not_use_in_output"
          : matchedEvidenceIds.length > 0
            ? "company_bridge"
            : "tone_only",
    });
  }
  for (const term of args.roleThesis.ats_terms) {
    addCriteriaSignal(signals, {
      label: term,
      category: "ats_keyword",
      source: "detector",
      confidence: "medium",
      relevance_to_role: "medium",
      matched_candidate_evidence_ids: args.candidateFacts
        .filter((fact) => factSupportsRequirement(fact, term))
        .map((fact) => fact.id),
      allowed_use: "ats_language",
    });
  }
  addCriteriaSignal(signals, {
    label: args.roleThesis.format_mode,
    category: "tone_format",
    source: "detector",
    confidence: "medium",
    relevance_to_role: "medium",
    matched_candidate_evidence_ids: [],
    allowed_use: "format_choice",
  });
  return signals.sort((left, right) => left.priority_rank - right.priority_rank);
}

function buildNoContextTruthPlan(args: {
  jobTitle: string;
  jobDescription: string;
  jobPriorities: ProposalTruthPlanV1["jobPriorities"];
}): ProposalTruthPlanV1 {
  const jobText = `${args.jobTitle}. ${args.jobDescription}`;
  const candidateFacts: ProposalTruthPlanV1["candidateFacts"] = [];
  const blockedClaims = uniqueBlockedClaims([
    blockedClaim("prior sales experience", "no_candidate_evidence"),
    blockedClaim("CRM expertise", "no_candidate_evidence"),
    blockedClaim("quota ownership", "no_candidate_evidence"),
    blockedClaim("how I approach new responsibilities", "no_context_personal_claim"),
    blockedClaim("attention to detail", "no_context_personal_claim"),
    blockedClaim("confidence or comfort with the work", "no_context_personal_claim"),
    blockedClaim("personal work-style claims", "no_context_personal_claim"),
    blockedClaim("candidate strengths, traits, habits, or abilities", "no_context_personal_claim"),
    blockedClaim("prior tools, projects, metrics, or credentials", "no_candidate_evidence"),
    ...args.jobPriorities.map((priority) =>
      blockedClaim(`${priority.requirement} as candidate experience`, "job_description_only"),
    ),
  ]);
  const missingCriticalRequirements = args.jobPriorities
    .filter((priority) => priority.importance === "critical")
    .map((priority) => missingRequirement(priority.requirement, priority.sourceText || jobText, "omit"));
  const roleThesis = buildCoverLetterRoleThesis({
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    jobPriorities: args.jobPriorities,
    candidateFacts,
    blockedClaims,
    missingCriticalRequirements,
    contextMode: "none",
  });
  return {
    planVersion: "proposal_truth_plan_v1",
    roleThesis,
    criteria_signals: buildCriteriaSignals({
      roleThesis,
      jobPriorities: args.jobPriorities,
      candidateFacts,
      blockedClaims,
      missingCriticalRequirements,
    }),
    writingMode: "no_context_safe",
    modeConfidence: "high",
    writerPolicy: "bypass_writer_use_fallback",
    jobPriorities: args.jobPriorities,
    candidateFacts,
    allowedClaims: [
      {
        claim: `interest in the ${args.jobTitle} role`,
        factIds: [],
        strength: "soft",
        claimType: "role_interest",
      },
      {
        claim: `the role centers on ${args.jobPriorities
          .slice(0, 3)
          .map((priority) => priority.requirement)
          .join(", ")}`,
        factIds: [],
        strength: "soft",
        claimType: "job_surface",
      },
      {
        claim: "willingness to discuss the team process and role expectations",
        factIds: [],
        strength: "soft",
        claimType: "discussion_forward",
      },
    ],
    blockedClaims,
    missingCriticalRequirements,
  };
}

export function buildProposalTruthPlanV1(
  input: BuildProposalTruthPlanV1Input,
): ProposalTruthPlanV1 {
  const contextMode =
    input.contextMode ??
    computeProposalPlannerContextMode(
      input.personalizationContext ? "rich" : "none",
      Boolean(input.personalizationContext || input.candidateFacts?.length),
    );
  const candidateFacts =
    contextMode === "none"
      ? []
      : buildTruthPlanCandidateFacts({
          personalizationContext: input.personalizationContext,
          candidateFacts: input.candidateFacts,
        });
  const jobPriorities = buildTruthPlanJobPriorities({
    jobTitle: input.jobTitle,
    jobDescription: input.jobDescription,
    expectedCriticalRequirements: input.expectedCriticalRequirements,
  });
  const jobText = `${input.jobTitle}. ${input.jobDescription}`;

  if (contextMode === "none" || candidateFacts.length === 0) {
    return buildNoContextTruthPlan({
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
      jobPriorities,
    });
  }

  const allowedClaims: ProposalTruthPlanV1["allowedClaims"] = [];
  const blockedClaims: ProposalTruthPlanV1["blockedClaims"] = [];
  const missingCriticalRequirements: ProposalTruthPlanV1["missingCriticalRequirements"] = [];
  let directSupportCount = 0;
  let adjacentSupportCount = 0;

  for (const priority of jobPriorities) {
    const supportingFacts = candidateFacts.filter((fact) =>
      factSupportsRequirement(fact, priority.requirement),
    );
    const directFacts = supportingFacts.filter(
      (fact) => factSupportsRequirement(fact, priority.requirement) === "direct",
    );
    if (directFacts.length > 0) {
      directSupportCount += 1;
      allowedClaims.push({
        claim: priority.requirement,
        factIds: directFacts.slice(0, 3).map((fact) => fact.id),
        strength: "direct",
        claimType: "candidate_fact",
      });
      continue;
    }
    if (supportingFacts.length > 0) {
      adjacentSupportCount += 1;
      allowedClaims.push({
        claim: `${priority.requirement} can be discussed only as adjacent support`,
        factIds: supportingFacts.slice(0, 3).map((fact) => fact.id),
        strength: "adjacent",
        claimType: "collaboration_area",
      });
    }
    if (priority.importance === "critical" || priority.importance === "important") {
      const specialist =
        /\b(?:indexing|schema|crawl|internal[-\s]linking|technical seo)\b/i.test(
          priority.requirement,
        );
      missingCriticalRequirements.push(
        missingRequirement(
          priority.requirement,
          priority.sourceText,
          specialist ? "refer_to_specialist" : "collaboration_area",
        ),
      );
      blockedClaims.push(
        blockedClaim(`${priority.requirement} as direct candidate experience`, "missing_requirement"),
      );
    }
  }

  for (const fact of candidateFacts) {
    if (
      !allowedClaims.some((claim) => claim.factIds.includes(fact.id)) &&
      allowedClaims.length < 10
    ) {
      allowedClaims.push({
        claim: fact.fact,
        factIds: [fact.id],
        strength: "soft",
        claimType: "candidate_fact",
      });
    }
  }

  if (/\b(?:technical\s+seo|indexing|schema|crawl|internal[-\s]linking)\b/i.test(jobText)) {
    const seoClaims = [
      "technical SEO specialist",
      "indexing fixes",
      "schema strategy / schema implementation",
      "crawl diagnostics",
      "internal-linking recommendations",
    ];
    for (const claim of seoClaims) {
      if (!hasDirectSupport(candidateFacts, claim)) {
        blockedClaims.push(
          blockedClaim(
            claim,
            /\b(?:schema|indexing|crawl|internal)/i.test(claim)
              ? "unsupported_tool"
              : "missing_requirement",
          ),
        );
      }
    }
  }

  if (/\bmentor(?:ing)?|people management|manage junior/i.test(jobText)) {
    const mentoringSupported = candidateFacts.some((fact) =>
      /\b(?:mentor|managed people|people management|coached junior|managed junior)\b/i.test(
        fact.fact,
      ),
    );
    if (!mentoringSupported) {
      blockedClaims.push(
        blockedClaim("mentoring or people-management experience", "unsupported_leadership"),
      );
    }
  }

  if (/\banalytics instrumentation\b/i.test(jobText) && !hasDirectSupport(candidateFacts, "analytics instrumentation")) {
    blockedClaims.push(blockedClaim("analytics instrumentation as direct experience", "unsupported_tool"));
  }

  if (/\bvendor|procurement\b/i.test(jobText)) {
    for (const claim of ["vendor communication", "vendor procurement ownership"]) {
      const hasLiteralVendorSupport = candidateFacts.some((fact) =>
        /\bvendor|procurement\b/i.test(fact.fact),
      );
      if (!hasLiteralVendorSupport) {
        blockedClaims.push(blockedClaim(claim, "missing_requirement"));
        if (
          !missingCriticalRequirements.some(
            (entry) =>
              normalizeComparisonToken(entry.requirement) ===
              normalizeComparisonToken(claim),
          )
        ) {
          missingCriticalRequirements.push(
            missingRequirement(claim, jobText, "collaboration_area"),
          );
        }
      }
    }
  }

  for (const claim of input.expectedBlockedClaims ?? []) {
    blockedClaims.push(blockedClaim(claim, "missing_requirement"));
  }

  const unsupportedTechnicalSeoMove =
    /\b(?:technical\s+seo|indexing|schema|crawl|internal[-\s]linking)\b/i.test(jobText) &&
    candidateFacts.some((fact) =>
      /\b(?:front[-\s]?end|landing pages?|conversion(?: optimization)?)\b/i.test(
        fact.fact,
      ),
    ) &&
    !candidateFacts.some((fact) =>
      /\b(?:technical\s+seo|seo specialist|crawl diagnostics?|schema strategy|indexing|canonicalization|crawl budget|internal[-\s]linking)\b/i.test(
        fact.fact,
      ),
    );
  const unsupportedVendorCentral =
    /\bvendor|procurement\b/i.test(jobText) &&
    !candidateFacts.some((fact) => /\bvendor|procurement\b/i.test(fact.fact));

  const writingMode: ProposalTruthPlanV1["writingMode"] =
    unsupportedTechnicalSeoMove || unsupportedVendorCentral || directSupportCount === 0
      ? "adjacent_only"
      : "normal";
  const modeConfidence: ProposalTruthPlanV1["modeConfidence"] =
    writingMode === "normal" && directSupportCount >= 2
      ? "high"
      : writingMode === "adjacent_only" && (adjacentSupportCount > 0 || missingCriticalRequirements.length > 0)
        ? "high"
        : "medium";
  const normalizedBlockedClaims = uniqueBlockedClaims(blockedClaims);
  const normalizedMissingCriticalRequirements = missingCriticalRequirements.filter(
    (entry, index, entries) =>
      entries.findIndex(
        (candidate) =>
          normalizeComparisonToken(candidate.requirement) ===
          normalizeComparisonToken(entry.requirement),
      ) === index,
  );
  const roleThesis = buildCoverLetterRoleThesis({
    jobTitle: input.jobTitle,
    jobDescription: input.jobDescription,
    jobPriorities,
    candidateFacts,
    blockedClaims: normalizedBlockedClaims,
    missingCriticalRequirements: normalizedMissingCriticalRequirements,
    contextMode,
  });

  return {
    planVersion: "proposal_truth_plan_v1",
    roleThesis,
    criteria_signals: buildCriteriaSignals({
      roleThesis,
      jobPriorities,
      candidateFacts,
      blockedClaims: normalizedBlockedClaims,
      missingCriticalRequirements: normalizedMissingCriticalRequirements,
    }),
    writingMode,
    modeConfidence,
    writerPolicy: writingMode === "normal" ? "normal_writer" : "constrained_writer",
    jobPriorities,
    candidateFacts,
    allowedClaims:
      writingMode === "adjacent_only"
        ? allowedClaims.map((claim) =>
            claim.strength === "direct" && /\b(?:technical seo|indexing|schema|crawl|internal|vendor|procurement)\b/i.test(claim.claim)
              ? { ...claim, strength: "adjacent", claimType: "collaboration_area" }
              : claim,
          )
        : allowedClaims,
    blockedClaims: normalizedBlockedClaims,
    missingCriticalRequirements: normalizedMissingCriticalRequirements,
  };
}

export function validateProposalTruthPlanV1(
  plan: ProposalTruthPlanV1,
): ProposalTruthPlanValidationIssue[] {
  const issues: ProposalTruthPlanValidationIssue[] = [];
  if (plan.writingMode === "no_context_safe" && plan.candidateFacts.length > 0) {
    issues.push({
      code: "no_context_candidate_facts",
      message: "no_context_safe plans must not expose candidate facts.",
    });
  }

  for (const claim of plan.allowedClaims) {
    if (claim.strength === "direct" && claim.factIds.length === 0) {
      issues.push({
        code: "direct_claim_missing_fact_ids",
        claim: claim.claim,
        message: "Direct allowed claims require non-empty factIds.",
      });
    }
    if (claim.claimType === "candidate_fact" && claim.factIds.length === 0) {
      issues.push({
        code: "candidate_claim_missing_fact_ids",
        claim: claim.claim,
        message: "Candidate fact claims require non-empty factIds.",
      });
    }
    if (plan.writingMode === "no_context_safe") {
      const safeNoContextClaim =
        claim.strength === "soft" &&
        (claim.claimType === "role_interest" ||
          claim.claimType === "job_surface" ||
          claim.claimType === "discussion_forward");
      if (!safeNoContextClaim) {
        issues.push({
          code:
            claim.strength === "direct"
              ? "no_context_direct_claim"
              : "no_context_unsafe_allowed_claim",
          claim: claim.claim,
          message:
            "No-context plans may only allow soft role-interest, job-surface, or discussion-forward claims.",
        });
      }
    }
  }

  return issues;
}

export function buildProposalEvidenceSummary(
  plan: ProposalPlannerResult,
): ProposalEvidenceSummary {
  const topAchievements: string[] = [];
  const topScopePoints: string[] = [];
  const relevantBackgroundFacts: string[] = [];

  for (const fact of plan.allowed_concrete_facts) {
    const bucket = classifyEvidenceFact(fact);
    if (bucket === "achievement" && topAchievements.length < 3) {
      topAchievements.push(fact);
      continue;
    }
    if (bucket === "scope" && topScopePoints.length < 3) {
      topScopePoints.push(fact);
      continue;
    }
    if (relevantBackgroundFacts.length < 4) {
      relevantBackgroundFacts.push(fact);
    }
  }

  const topEvidencePoints =
    topAchievements.length >= 2
      ? topAchievements.slice(0, 2)
      : topAchievements.length === 1 && topScopePoints.length > 0
        ? [topScopePoints[0]!, topAchievements[0]!]
      : topScopePoints.length > 0
        ? topScopePoints.slice(0, 2)
        : relevantBackgroundFacts.slice(0, 2);

  return {
    topEvidencePoints,
    topAchievements,
    topScopePoints,
    relevantBackgroundFacts,
    transferableTraits:
      plan.context_mode === "none"
        ? []
        : plan.allowed_transfer_themes.slice(0, 4),
    forbiddenBridges: [...PROPOSAL_FORBIDDEN_BRIDGES],
    noContextMode: plan.context_mode === "none",
  };
}

export function computeProposalPlannerContextMode(
  richness: "none" | "minimal" | "sparse" | "rich" | undefined,
  hasCandidateContext: boolean,
): ProposalPlannerContextMode {
  if (!hasCandidateContext) return "none";
  switch (richness) {
    case "none":
      return "none";
    case "minimal":
      return "minimal";
    case "sparse":
      return "sparse";
    case "rich":
    default:
      return "rich";
  }
}

export function getProposalPlannerOpeningStrategy(
  voicePreset: ProposalVoicePreset,
): ProposalPlannerOpeningStrategy {
  switch (voicePreset) {
    case "expert":
      return "expert_structured";
    case "direct":
      return "direct_fast";
    case "engaging":
      return "engaging_people";
    case "storyteller":
      return "storyteller_thread";
    case "signature":
    default:
      return "signature_default";
  }
}

export function buildProposalSourceFactBank(
  context: ProposalPlannerPersonalizationContext | null,
): string[] {
  if (!context) return [];
  const facts: string[] = [];

  facts.push(...splitIntoFactSnippets(context.summary));

  if (context.topSkills && context.topSkills.length > 0) {
    for (const skill of context.topSkills) {
      facts.push(compactWhitespace(skill));
    }
  }

  if (context.recentExperience && context.recentExperience.length > 0) {
    for (const entry of context.recentExperience) {
      const role = compactWhitespace(
        [entry.position, entry.company ? `at ${entry.company}` : ""]
          .filter(Boolean)
          .join(" "),
      );
      if (role) facts.push(role);
      if (entry.highlights && entry.highlights.length > 0) {
        for (const highlight of entry.highlights) {
          facts.push(...splitIntoFactSnippets(highlight));
        }
      }
    }
  }

  if (context.standoutAchievements && context.standoutAchievements.length > 0) {
    for (const achievement of context.standoutAchievements) {
      facts.push(...splitIntoFactSnippets(achievement));
    }
  }

  return uniqueStrings(facts).slice(0, MAX_FACT_BANK_ITEMS);
}

export function buildProposalPlannerPrompt(
  args: BuildProposalPlannerPromptArgs,
): string {
  const factBank = buildProposalSourceFactBank(args.personalizationContext);
  const openingStrategy = getProposalPlannerOpeningStrategy(args.voicePreset);
  const factBankBlock =
    factBank.length > 0
      ? [
          "Source fact bank (exact candidate facts only; allowed_concrete_facts must come only from this bank):",
          ...factBank.map((fact, index) => `${index + 1}. ${fact}`),
        ].join("\n")
      : "Source fact bank: none.";

  return [
    "Task: return only a compact JSON planning object for the final proposal writer. Do not write proposal prose.",
    `Selected voice preset: ${args.voicePreset}. Default opening strategy enum: ${openingStrategy}.`,
    `Observed context mode: ${args.contextMode}.`,
    "Planner output requirements:",
    "- context_mode: none | minimal | sparse | rich",
    "- domain_gap: direct | adjacent | distant",
    "- credential_status: exact_required | related_not_equivalent | in_progress_only | unsupported",
    "- transfer_mode: literal | abstract_only | no_operational_analogy",
    `- output_language: ${PROPOSAL_PLANNER_OUTPUT_LANGUAGES.join(" | ")}`,
    "- proof_strategy: none | abstract_only | concrete_supported",
    "- opening_strategy: signature_default | expert_structured | direct_fast | engaging_people | storyteller_thread",
    "- allowed_concrete_facts must be exact source-backed facts copied from the source fact bank only. If a concrete candidate fact is unsupported, omit it.",
    "- allowed_transfer_themes must be abstract transferable themes only, not rewritten job duties or unsupported target-role competence.",
    "- disallowed_claims must list the exact claim types that must not appear in final prose.",
    "- identity_hard_stops must list identity, status, affiliation, credential, or background claims that must not be inferred.",
    `Observed output language: ${args.outputLanguage}.`,
    `Target role: ${args.jobTitle}`,
    `Job description: ${compactWhitespace(args.jobDescription)}`,
    args.generationControlsBlock,
    args.companyValuesPack
      ? formatCompanyValuesPromptBlock(args.companyValuesPack)
      : undefined,
    factBankBlock,
    "Planner rules:",
    ...SOURCE_BACKED_SPECIFICITY_RULES.map((rule) => `- ${rule}`),
    ...JOB_DESCRIPTION_TO_CANDIDATE_RULES.map((rule) => `- ${rule}`),
    ...IDENTITY_BACKGROUND_HARD_STOP_RULES.map((rule) => `- ${rule}`),
    ...NO_CONTEXT_CANDIDATE_CLAIM_RULES.map((rule) => `- ${rule}`),
    "- If the source is empty, context_mode must be none, proof_strategy must be none, transfer_mode must be no_operational_analogy, allowed_concrete_facts must be empty, and allowed_transfer_themes must stay limited to company-specific interest, interest in the type of work, shared values or mission interest, professional curiosity, role understanding, and a polite closing.",
    "- In no-context mode, the final writer must produce a grounded, non-claiming cover-letter body centered on concrete work surfaces, workflow, team interaction, or operating context rather than a capability-based cover letter.",
    "- In no-context mode, the final writer must stay fully forward-looking and non-claiming. Do not allow pseudo-background, soft readiness, fit language, contribution language, trait-to-role bridging, tool familiarity, or capability language that implies prior practice.",
    "- In no-context cover-letter mode, the body should resolve into two grounded job-description movements about the actual work, workflow, employer context, outputs, deliverables, or coordination, plus at most one brief curiosity or role-interest movement before the close.",
    "- In no-context cover-letter mode, when the job description contains concrete products, outputs, media, files, processes, workflow, collaboration, or production constraints, the writer should spend the first substantive movement on the actual work and the next substantive movement on workflow, revision, production, deliverables, or coordination before generic motivation.",
    "- In no-context cover-letter mode, challenge language, opportunity language, mission admiration, growth language, and other personal-interest rhetoric should remain secondary only; they must not carry the body when concrete work/process detail is available.",
    "- In no-context cover-letter mode, do not let a role-title shell, scenic employer description, or generic paraphrase of the job description stand in for one of the grounded body movements.",
    "- In no-context cover-letter mode, do not let benefit-summary shells, environment-summary shells, or generic teamwork, professionalism, reliability, or seriousness filler stand in for one of the grounded body movements.",
    "- If a detail exists only in the job description, it may support role understanding or motivation, but it must not be treated as prior candidate experience.",
    "- In CV-backed cover-letter mode, when supported concrete facts exist, the writer should anchor the body in the strongest available evidence first: achievements, then scope or responsibility facts, then relevant background facts, and only then brief abstract transfer themes if still useful.",
    "- In CV-backed cover-letter mode, the first substantive movement should prefer one concrete supported evidence point or one supported scope/background fact rather than generic transfer rhetoric, mission admiration, or ceremonial interest framing.",
    "- In CV-backed cover-letter mode, after the evidence anchor, the next substantive movement should explain why that supported proof matters for the role's actual work, workflow, users, deliverables, team context, or operating environment rather than defaulting to generic transfer or future-value language.",
    "- In CV-backed cover-letter mode, when more supported scope, background, or operating detail exists, the writer should spend one additional grounded supporting sentence on that material before the close rather than ending after one proof point and a generic close.",
    "- If achievements are absent, provide the strongest supported scope or background facts rather than leaving the writer to rely on generic fit, mission, or transfer language.",
    "- Transferable themes are secondary framing only. They must not become the main body substance when stronger supported facts exist.",
    "- If supported achievements exist, they should be treated as the strongest proof points. If no supported achievements exist, the writer should lead with scope, responsibility, or background facts rather than inventing stronger readiness or contribution claims.",
    "- Even in direct same-domain cases, preserve exact supported wording and do not sharpen nearby operational detail or synthesize employer-style names unless the exact wording is source-backed.",
    "- Related certification is not the same as an exact required credential. In-progress education is not a completed degree.",
    "- If the candidate does not explicitly hold the exact required credential, credential_status must not be exact_required.",
    "- Adjacent sector exposure is not identity, status, military service, public-service background, or direct domain-practice evidence.",
    "- For direct-domain moves, concrete operational proof may map more literally when source-backed.",
    "- For adjacent-domain moves, use concrete proof only as relevant background or cautious perspective, never as direct target-role readiness, team support, or task ownership.",
    "- For distant-domain or no-context moves, avoid operational analogy and stay with grounded interest, role understanding, or cautious relevance only.",
    "- Voice presets may change rhythm, sentence length, rhetorical texture, narrative hook, executive formality, and energy level only. They must not change claim strength, readiness, contribution implication, qualification implication, or task-readiness.",
    "- The planner must set output_language explicitly and the writer must obey it exactly.",
    "Compact contrast examples:",
    "- JD-only acceptable: 'The role involves CCTV and access control, and I would approach that work with professionalism and attention to detail.'",
    "- JD-only not acceptable: 'I have managed CCTV and access control systems' when those facts appear only in the job description.",
    "- Identity/domain acceptable: 'Worked in military and defense sectors.'",
    "- Identity/domain not acceptable: 'As a veteran', 'my military service', or 'my public-service background' unless the source explicitly says that.",
  ].join("\n");
}

export function normalizeProposalPlannerResult(
  args: NormalizeProposalPlannerArgs,
): ProposalPlannerResult {
  const normalizedContextMode = args.contextMode;
  const normalizedOpeningStrategy = getProposalPlannerOpeningStrategy(
    args.voicePreset,
  );
  const sourceFactBank = uniqueStrings(args.sourceFactBank);
  const inferredDomainGap = inferDomainGapFromFacts({
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    sourceFactBank,
  });

  let domainGap = inferredDomainGap ?? args.rawPlan.domain_gap;
  let credentialStatus = args.rawPlan.credential_status;
  let transferMode = args.rawPlan.transfer_mode;
  let proofStrategy = args.rawPlan.proof_strategy;
  const outputLanguage = args.outputLanguage;
  let allowedConcreteFacts = filterFactsAgainstBank(
    args.rawPlan.allowed_concrete_facts,
    sourceFactBank,
  ).slice(0, MAX_ALLOWED_FACTS);
  const unsupportedTechnicalSeoMove = isUnsupportedTechnicalSeoMove({
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    sourceFacts: sourceFactBank,
  });

  if (normalizedContextMode === "none") {
    domainGap = "distant";
    credentialStatus = "unsupported";
    transferMode = "no_operational_analogy";
    proofStrategy = "none";
    allowedConcreteFacts = [];
  }

  if (domainGap === "distant") {
    transferMode = "no_operational_analogy";
  } else if (domainGap === "adjacent" && transferMode === "literal") {
    transferMode = "abstract_only";
  }

  if (unsupportedTechnicalSeoMove) {
    domainGap = "adjacent";
    transferMode = "abstract_only";
    credentialStatus = "unsupported";
    if (proofStrategy === "concrete_supported") {
      proofStrategy = "abstract_only";
    }
  }

  if (proofStrategy === "concrete_supported" && allowedConcreteFacts.length === 0) {
    proofStrategy = normalizedContextMode === "none" ? "none" : "abstract_only";
  }

  const allowedTransferThemes =
    normalizedContextMode === "none"
      ? [...SAFE_NO_CONTEXT_TRANSFER_THEMES]
      : uniqueStrings(args.rawPlan.allowed_transfer_themes).slice(0, MAX_THEMES);

  const identityHardStops = uniqueStrings([
    ...BASE_IDENTITY_HARD_STOPS,
    ...args.rawPlan.identity_hard_stops,
  ]).slice(0, MAX_HARD_STOPS);

  const disallowedClaims = uniqueStrings([
    ...buildDefaultDisallowedClaims({
      contextMode: normalizedContextMode,
      domainGap,
      credentialStatus,
      outputLanguage,
    }),
    ...args.rawPlan.disallowed_claims,
    ...(unsupportedTechnicalSeoMove ? UNSUPPORTED_TECHNICAL_SEO_CLAIMS : []),
  ]).slice(0, MAX_DISALLOWED_CLAIMS);

  return {
    context_mode: normalizedContextMode,
    domain_gap: domainGap,
    credential_status: credentialStatus,
    transfer_mode: transferMode,
    output_language: outputLanguage,
    allowed_concrete_facts: allowedConcreteFacts,
    allowed_transfer_themes: allowedTransferThemes,
    disallowed_claims: disallowedClaims,
    identity_hard_stops: identityHardStops,
    proof_strategy: proofStrategy,
    opening_strategy: normalizedOpeningStrategy,
  };
}

export function buildProposalWriterPlanBlock(
  plan: ProposalPlannerResult,
  format: ProposalOutputFormat,
): string {
  const evidenceSummary = buildProposalEvidenceSummary(plan);
  const surfaceTopAchievements =
    evidenceSummary.topAchievements.length >= 2 ||
    evidenceSummary.topScopePoints.length === 0;
  return [
    "Writing plan (must obey as a hard contract):",
    "Treat every planner field below as a binding boundary, not soft guidance.",
    `- context_mode: ${plan.context_mode}`,
    `- domain_gap: ${plan.domain_gap}`,
    `- credential_status: ${plan.credential_status}`,
    `- transfer_mode: ${plan.transfer_mode}`,
    `- output_language: ${plan.output_language}`,
    `- proof_strategy: ${plan.proof_strategy}`,
    `- opening_strategy: ${plan.opening_strategy}`,
    "- allowed_concrete_facts:",
    ...(plan.allowed_concrete_facts.length > 0
      ? plan.allowed_concrete_facts.map((fact) => `  - ${fact}`)
      : ["  - none"]),
    "- allowed_transfer_themes:",
    ...(plan.allowed_transfer_themes.length > 0
      ? plan.allowed_transfer_themes.map((theme) => `  - ${theme}`)
      : ["  - none"]),
    "- disallowed_claims:",
    ...(plan.disallowed_claims.length > 0
      ? plan.disallowed_claims.map((claim) => `  - ${claim}`)
      : ["  - none"]),
    "- identity_hard_stops:",
    ...(plan.identity_hard_stops.length > 0
      ? plan.identity_hard_stops.map((stop) => `  - ${stop}`)
      : ["  - none"]),
    "- evidence_summary:",
    `  - no_context_mode: ${evidenceSummary.noContextMode ? "true" : "false"}`,
    ...(evidenceSummary.topEvidencePoints.length > 0
      ? evidenceSummary.topEvidencePoints.map(
          (fact) => `  - top_evidence_point: ${fact}`,
        )
      : ["  - top_evidence_point: none"]),
    ...(surfaceTopAchievements && evidenceSummary.topAchievements.length > 0
      ? evidenceSummary.topAchievements.map(
          (fact) => `  - top_achievement: ${fact}`,
        )
      : ["  - top_achievement: none"]),
    ...(evidenceSummary.topAchievements.length === 1 &&
    evidenceSummary.topScopePoints.length > 0
      ? [
          "  - lone_achievement_handling: do not default to opening with the single standout achievement; use supported scope first and keep the achievement as later proof.",
        ]
      : []),
    ...(evidenceSummary.topScopePoints.length > 0
      ? evidenceSummary.topScopePoints.map(
          (fact) => `  - top_scope_point: ${fact}`,
        )
      : ["  - top_scope_point: none"]),
    ...(evidenceSummary.relevantBackgroundFacts.length > 0
      ? evidenceSummary.relevantBackgroundFacts.map(
          (fact) => `  - relevant_background_fact: ${fact}`,
        )
      : ["  - relevant_background_fact: none"]),
    ...(evidenceSummary.transferableTraits.length > 0
      ? evidenceSummary.transferableTraits.map(
          (trait) => `  - transferable_trait: ${trait}`,
        )
      : ["  - transferable_trait: none"]),
    ...(format === "cover_letter" && !evidenceSummary.noContextMode
      ? [
          "Evidence chain requirement: each main paragraph should map job priority -> source-backed candidate fact -> recruiter case for why that fact matters in the role.",
          "Use evidence_summary as the body priority order: top_evidence_point, then top_achievement, then top_scope_point, then relevant_background_fact, and only then transferable_trait if it still helps.",
          "If any top_evidence_point, top_scope_point, or relevant_background_fact exists, the first substantive movement should come from one of those supported facts rather than from generic transfer framing, mission admiration, or role-interest language.",
          "After the opening evidence movement, use the next substantive movement to explain why that supported proof matters for the role's work, workflow, users, team context, or operating environment rather than reducing it to generic 'aligns with' or future-value language.",
          "If more supported scope, background, or operating detail exists after the opening proof, spend one additional grounded supporting sentence on it before the close rather than ending on proof plus a generic close.",
          "If top_achievement items are absent, use top_scope_point or relevant_background_fact instead of generic fit language.",
          "Use transferable_trait only as brief secondary support after concrete supported facts; do not let transferable traits become the main body substance when stronger evidence exists.",
          "Missing requirements must become gaps, omissions, or cautious non-claims; never turn job keywords into candidate proof.",
          "Do not praise company mission, culture, values, or the employer as a substitute for candidate evidence.",
        ]
      : []),
    ...(plan.disallowed_claims.some((claim) =>
      /crawl budget|schema placement|technical seo diagnosis|seo teams/i.test(
        claim,
      ),
    )
      ? buildAdjacentOnlySeoGuidance()
      : []),
    ...(format === "cover_letter"
      ? [
          "Keep the final cover-letter body in first person throughout. Do not use he, she, they, or third-person self-reference for the candidate.",
          "Every sentence must be complete and grammatically closed. Do not leave unfinished trailing clauses or half-finished continuations such as '... is.' or 'I look forward to discussing how my background.'.",
          "If opening_strategy is engaging_people or storyteller_thread, prioritize completed sentence closure and clean paragraph endings over flourish.",
        ]
      : []),
    ...(evidenceSummary.forbiddenBridges.length > 0
      ? evidenceSummary.forbiddenBridges.map(
          (phrase) => `  - forbidden_bridge: ${phrase}`,
        )
      : ["  - forbidden_bridge: none"]),
    "If a claim is not present in allowed_concrete_facts or clearly permitted by allowed_transfer_themes, it must not appear in the final letter.",
    "If wording implies a stronger level of experience, qualification, operational readiness, identity, status, or domain practice than this plan allows, it must not appear even if it sounds rhetorically plausible.",
    "Use only allowed_concrete_facts for candidate-specific detail.",
    "Use allowed_transfer_themes only as abstract framing, never as invented direct experience or direct target-role competence.",
    "Never state or imply any item from disallowed_claims or identity_hard_stops.",
    "Use voice presets only to alter rhythm, sentence length, rhetorical texture, narrative hook, executive formality, and energy level. Do not let a preset increase claim strength, readiness, contribution implication, qualification implication, or task-readiness.",
    ...buildNoContextWriterPlanGuidance(format),
    "If domain_gap is direct, preserve exact supported detail without sharpening nearby operational wording, inventing employer-style names, or importing JD-adjacent tasks as proven candidate history.",
    ...buildEarlyProofGuidance(format),
    format === "application_message"
      ? buildApplicationMessageBridgeGuidance(evidenceSummary.noContextMode)
      : `After the evidence anchor, the only allowed bridge is one cautious relevance sentence such as '${PROPOSAL_ALLOWED_CAUTIOUS_BRIDGES.join(
          "', '",
        )}'.`,
    "Do not compensate for missing achievements or missing target-domain evidence with readiness, contribution, fit, or qualification language.",
    "If domain_gap is adjacent, concrete proof may appear only as relevant background or cautious perspective, not as direct target-role readiness, task ownership, mission support, team value, operational support, or ability transfer into the target environment.",
    "If domain_gap is distant, do not use direct target-domain verbs or operational analogy unless the exact claim appears in allowed_concrete_facts.",
    "If domain_gap is distant, remain interest-led and cautiously relevant only; do not project future operational value, team value, mission support, or readiness for target-role tasks.",
    "If credential_status is not exact_required, do not say the candidate meets the requirement, holds the required certification, is licensed, or is qualified under the requirement unless that exact claim appears in allowed_concrete_facts.",
    "If credential_status is related_not_equivalent, related training or certification may be mentioned only as related, never as satisfying the exact requirement.",
    "If credential_status is in_progress_only, education or credentials may be mentioned only as in progress, never as completed.",
    "If credential_status is unsupported, do not imply credential fit.",
    "Any phrase that combines support, contribute, help, fit, or value with company, team, operations, goals, mission, or clients is forbidden unless it is literally source-backed.",
    buildClosingGuidance(format),
    buildOpeningStrategyContract(plan.opening_strategy),
    getDeterministicCopyLanguage(plan.output_language) === "fr"
      ? "Write the final prose in French only."
      : getDeterministicCopyLanguage(plan.output_language) === "en"
        ? "Write the final prose in English only."
        : `Write the final prose in ${getProposalOutputLanguageLabel(plan.output_language)} only.`,
  ].join("\n");
}
