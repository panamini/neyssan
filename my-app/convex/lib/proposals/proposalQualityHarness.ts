import { analyzeCompanyValues } from "./companyValues";
import {
  buildProposalCriteriaAudit,
  type ProposalCriteriaAudit,
} from "./proposalCriteriaAudit";
import {
  buildProposalTruthPlanV1,
  validateProposalTruthPlanV1,
  type ProposalPlannerResult,
  type ProposalTruthPlanV1,
  type ProposalTruthPlanCandidateFactInput,
  type ProposalTruthPlanValidationIssue,
} from "./proposalPlanner";

export type ProposalQualityHarnessKind =
  | "static_safety"
  | "pipeline_mocked"
  | "future_llm_eval";

export type ProposalQualityHarnessHardness =
  | "smoke"
  | "standard"
  | "hard"
  | "adversarial";

export const DEFAULT_PROPOSAL_QUALITY_HARNESS_HARDNESS:
  ProposalQualityHarnessHardness = "standard";

export const PROPOSAL_QUALITY_HARNESS_ARCHITECTURE: Record<
  ProposalQualityHarnessKind,
  { status: "implemented" | "designed" | "deferred"; purpose: string }
> = {
  static_safety: {
    status: "implemented",
    purpose:
      "Score known letters against evidence, keyword, company-praise, and no-context invariants without LLM calls.",
  },
  pipeline_mocked: {
    status: "designed",
    purpose:
      "Replay planner/composer/finalizer integration with mocked model outputs and prove shadow modes preserve prompts and saved output.",
  },
  future_llm_eval: {
    status: "designed",
    purpose:
      "Compare recorded baseline and semantic-planner outputs with selector audit results before any live semantic planner rollout.",
  },
};

export type ProposalQualityHarnessVariant =
  | "baseline"
  | "criteria_audit_shadow"
  | "semantic_planner_shadow";

export type ProposalFactSource =
  | "profile"
  | "cv"
  | "resume"
  | "proposal_context"
  | "source_backed_candidate_data";

export type ProposalQualityCandidateFact = {
  id: string;
  text: string;
  source: ProposalFactSource;
  mapsTo: string[];
  priority:
    | "achievement"
    | "responsibility"
    | "workflow"
    | "domain"
    | "tool"
    | "trait";
};

export type ProposalQualityFixture = {
  id: string;
  label: string;
  jobTitle: string;
  jobDescription: string;
  contextMode: "none" | "minimal" | "sparse" | "rich";
  candidateFacts: ProposalQualityCandidateFact[];
  expectedCriticalRequirements: string[];
  expectedSupportedKeywords: string[];
  expectedBlockedKeywords: string[];
  expectedForbiddenPhrases: string[];
  expectedNoContextBehavior?: string;
  topJobPriorities: string[];
  sourceBackedCandidateFacts: string[];
  allowedTransferableEvidence: string[];
  blockedClaims: string[];
  expectedGaps: string[];
  expectedCompanyValuesBehavior: "none" | "explicit" | "implicit" | "unmapped";
  expectedFailureCodes?: string[];
  safeRoleTransitions: string[];
  letters: Record<"baseline" | "criteria_audit_shadow", string>;
};

export type CoverLetterWritingCanonOpeningMode =
  | "proof_led"
  | "through_line"
  | "candidate_work_context"
  | "adjacent_boundary"
  | "no_context_work_surface";

export type CoverLetterWritingCanonResult = {
  version: "CoverLetterWritingCanonV1";
  openingMode: CoverLetterWritingCanonOpeningMode;
  hardFailures: string[];
  warnings: string[];
};

export const COVER_LETTER_WRITING_CANON_V1 = {
  version: "CoverLetterWritingCanonV1",
  principle:
    "The truthPlan is for the machine. The letter is for the reader.",
  openingModes: {
    proof_led:
      "Open with the candidate's strongest source-backed proof, metric, or achievement.",
    through_line:
      "Open with a compact through-line that connects backed work across roles.",
    candidate_work_context:
      "Open from the candidate's actual work surface before naming role fit.",
    adjacent_boundary:
      "Open by stating the supported adjacent surface and the boundary honestly.",
    no_context_work_surface:
      "Open from the role's concrete work surface without candidate-history claims.",
  },
  openingModeRules: {
    normal:
      "Strong evidence should prefer proof_led, through_line, or candidate_work_context. Do not start by paraphrasing the role.",
    adjacent_only:
      "Adjacent-only evidence should use adjacent_boundary and avoid target-role readiness claims.",
    no_context_safe:
      "No-context letters should use no_context_work_surface and avoid candidate-history, trait, or habit claims.",
  },
  bannedOpeningStarts: [
    "I am excited to apply",
    "I'm excited to apply",
    "I am writing to express my interest",
    "Your role requires",
    "My background aligns with",
    "The role's focus aligns with",
    "What interests me about this role",
  ],
  warningTerms: [
    "aligns with",
    "opportunity",
    "contribute",
    "passion",
    "compelling",
    "excited",
  ],
  goldTargets: {
    "employment-strong-frontend": {
      openingMode: "proof_led",
      letter:
        "Dear Hiring Manager,\n\nAt BrightLayer, I worked on the kind of frontend foundation that matters once a product is already in customers' hands: React and TypeScript work, a design system migration used across 4 product squads, and bundle and rendering optimizations that reduced page load time by 28 percent.\n\nThat was not only component cleanup. It meant making reusable UI patterns easier for product squads to ship, keeping performance visible, and staying close to product and design decisions. At Northline Labs, I built experimentation dashboards used by product and growth teams and partnered directly with design on customer-facing workflow improvements.\n\nThose projects are the through-line I would bring here: frontend systems that make the product faster, clearer, and easier to iterate. The strongest example is the signup work, where iterative UI experiments improved conversion by 11 percent. For a recruiter, the evidence is not a list of tools, but shipped interface work tied to speed, consistency, and conversion. I would treat analytics instrumentation as a learning area rather than claim ownership of it, while bringing a grounded React, TypeScript, performance, and product-design collaboration base.\n\nSincerely,\nAlex Martin",
    },
  },
} as const;

type ProposalQualityFixtureInput = Omit<
  ProposalQualityFixture,
  | "topJobPriorities"
  | "sourceBackedCandidateFacts"
  | "allowedTransferableEvidence"
  | "blockedClaims"
  | "expectedGaps"
  | "expectedCompanyValuesBehavior"
> &
  Partial<
    Pick<
      ProposalQualityFixture,
      | "topJobPriorities"
      | "sourceBackedCandidateFacts"
      | "allowedTransferableEvidence"
      | "blockedClaims"
      | "expectedGaps"
      | "expectedCompanyValuesBehavior"
    >
  >;

export type ProposalTruthPlanOutputViolation = {
  type:
    | "blocked_claim_used"
    | "missing_requirement_claimed"
    | "no_context_personal_claim"
    | "adjacent_mode_overclaim"
    | "direct_claim_without_fact"
    | "unsupported_leadership_claim";
  claim: string;
  evidence?: string;
  severity: "low" | "medium" | "high";
};

export type ProposalTruthPlanOutputCheck = {
  status: "not_run" | "pass" | "warn" | "fail";
  violations: ProposalTruthPlanOutputViolation[];
};

export type ProposalTruthPlanRepairReason = {
  type:
    | "truth_plan_violation_unhandled"
    | "truth_plan_violation_already_detected"
    | "repair_should_remove_blocked_claim"
    | "fallback_preferred_for_no_context"
    | "adjacent_mode_requires_reframe"
    | "missing_requirement_should_remain_gap"
    | "unsupported_leadership_should_be_removed";
  claim?: string;
  evidence?: string;
  severity: "low" | "medium" | "high";
};

export type ProposalTruthPlanRepairAnalysis = {
  status: "not_run" | "pass" | "warn" | "fail";
  recommendedAction:
    | "none"
    | "keep_output"
    | "repair_with_truth_plan"
    | "fallback"
    | "fail_closed";
  reasons: ProposalTruthPlanRepairReason[];
};

export type ProposalEvalResult = {
  fixtureId: string;
  variant: ProposalQualityHarnessVariant;
  unsupportedClaims: number;
  bannedCompanyPraise: number;
  missingCriticalRequirements: string[];
  supportedKeywordCoverage: number;
  advisoryKeywordLeakage: number;
  credentialInflation: boolean;
  noContextViolation: boolean;
  recruiterCaseScore: 1 | 2 | 3 | 4 | 5;
  selectorReadiness: "fail" | "weak" | "pass" | "strong";
  worseThanBaseline: boolean;
  topCandidateFactsUsed: Array<{
    fact: string;
    source: ProposalFactSource;
    jobPriority: string;
  }>;
  unsupportedOrWeaklySupportedCriteria: string[];
  companyValuesLanguageUsed: boolean;
  inventedClaimFree: boolean;
  paragraphGrounding: Array<{
    paragraph: string;
    hasSourceBackedFact: boolean;
    hasJustifiedRoleTransition: boolean;
  }>;
  harnessKind: ProposalQualityHarnessKind;
  harnessHardness: ProposalQualityHarnessHardness;
  comparisonKind: "shadow_parity_safety_check" | "baseline_only";
  criteriaAudit: ProposalCriteriaAudit | null;
  truthPlan: ProposalTruthPlanV1 | null;
  plannedWritingMode: ProposalTruthPlanV1["writingMode"] | null;
  plannedBlockedClaimsCount: number | null;
  plannedMissingCriticalRequirementsCount: number | null;
  truthPlanValidationWarnings: ProposalTruthPlanValidationIssue[];
  truthPlanOutputCheck: ProposalTruthPlanOutputCheck;
  truthPlanRepairAnalysis: ProposalTruthPlanRepairAnalysis;
  coverLetterWritingCanon: CoverLetterWritingCanonResult;
  safetyReason?: string;
};

const CLAIM_CUE_PATTERN =
  /\b(?:i|my|me|mine|we)\b|\b(?:experience|led|managed|owned|built|improved|delivered|implemented|certified|licensed|senior|staff|principal)\b/i;
const CREDENTIAL_PATTERN =
  /\b(?:certification|certificate|license|licensed|degree|pmp|cpa|cissp|security clearance|aws certified)\b/i;
const NO_CONTEXT_CLAIM_PATTERN =
  /\b(?:i (?:led|managed|built|improved|delivered|implemented|owned|handled|used|hold|earned|completed|prioritize|take direction|value|tend to|make sure)|i['’]ve (?:worked|developed|taken initiative|always prioritized)|i have experience|i have worked|i (?:do not|don['’]t) have direct experience|i(?:['’]m| am) comfortable|i(?:['’]m| am) confident|in past experiences?|in previous roles?|in my work|my experience|my background|my professional background|my ability|my habit|my attention to detail|my methodical approach|my approach|my work style|my strengths?|how i approach (?:work|tasks?|new responsibilities)|how i handle|(?:something )?i value|skills? i['’]ve developed|administrative and customer-facing tasks|customer-facing tasks|group-project coordination|group projects?|personal work habits|attention to detail|contribut(?:e|ing) effectively|how (?:best )?to contribute|how i can contribute|contribute to your team|support your team|help streamline|eager to support|tasks i(?:['’]m| am) eager to support|developing the skills|would guide (?:my|the) approach|approach (?:to these tasks|these duties)|take seriously|nothing slips through the cracks|critical for supporting|supporting both the team and customers|i share|resonates with me)\b/i;
const VALUE_LANGUAGE_PATTERN =
  /\b(?:mission|values?|principles?|culture|resonates|admire|alignment|share)\b/i;
const GAP_OR_SAFETY_PATTERN =
  /\b(?:gap|not source-backed|not backed|rather than claim|rather than claims|rather than inflate|flag rather than claim|should remain a gap|should stay (?:as )?(?:a topic|an area|areas)|topic to discuss|areas to discuss|should be led by|technical seo specialist|not technical seo|outside my expertise|outside my core skill|not the person to lead|(?:have not|haven['’]t) directly handled)\b/i;
const BANNED_OPENING_START_PATTERNS = [
  /^\s*i am excited to apply\b/i,
  /^\s*i['’]m excited to apply\b/i,
  /^\s*i am writing to express my interest\b/i,
  /^\s*your role requires\b/i,
  /^\s*my background aligns with\b/i,
  /^\s*the role['’]s focus aligns with\b/i,
  /^\s*what interests me about this role\b/i,
] as const;
const ROLE_PARAPHRASE_OPENING_PATTERN =
  /^\s*(?:the role|this role|your role|the position|this position|the job|your posting)\b/i;
const VISIBLE_CHECKLIST_RHYTHM_PATTERNS = [
  /\brole requires\b/i,
  /\bcandidate has\b/i,
  /\btherefore\b/i,
  /\bthis directly supports\b/i,
  /\bdirectly aligns with\b/i,
  /\bwhich matters for\b/i,
  /\bjob priority\b/i,
] as const;
const UNSUPPORTED_MENTORING_PATTERN =
  /\b(?:mentor(?:ing|ed)?|junior engineers?|share best practices|coach(?:ing|ed)?)\b/i;
const PEOPLE_MANAGEMENT_PATTERN =
  /\b(?:people management|managed people|managing people|direct reports?|hiring decisions?|performance reviews?|managed a team|led a team)\b/i;
const BACKEND_OR_MOBILE_OWNERSHIP_PATTERN =
  /\b(?:own(?:ed)?|lead|led|build|built|develop(?:ed)?|implement(?:ed)?|architect(?:ed)?|managed?)\b.{0,80}\b(?:backend|back-end|mobile|ios|android)\b|\b(?:backend|back-end|mobile|ios|android)\b.{0,80}\b(?:own(?:ed)?|lead|led|build|built|develop(?:ed)?|implement(?:ed)?|architect(?:ed)?|managed?)\b/i;
const ANALYTICS_INSTRUMENTATION_OWNERSHIP_PATTERN =
  /\b(?:own(?:ed)?|lead|led|implement(?:ed)?|instrument(?:ed)?|set up|built|practical expertise in|hands-on experience with)\b.{0,80}\banalytics instrumentation\b|\banalytics instrumentation\b.{0,80}\b(?:own(?:ed)?|lead|led|implement(?:ed)?|instrument(?:ed)?|direct experience|practical expertise|hands-on experience)\b/i;
const MATCH_STOPWORDS = new Set([
  "about",
  "after",
  "and",
  "are",
  "candidate",
  "directly",
  "experience",
  "improvement",
  "leadership",
  "role",
  "should",
  "that",
  "the",
  "through",
  "used",
  "with",
  "work",
]);

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function includesPhrase(haystack: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);
  return Boolean(normalizedPhrase) && normalize(haystack).includes(normalizedPhrase);
}

function tokenizeForMatch(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter((token) => token.length >= 2 && !MATCH_STOPWORDS.has(token));
}

function tokenOverlapScore(haystack: string, phrase: string): number {
  const haystackTokens = new Set(tokenizeForMatch(haystack));
  const phraseTokens = [...new Set(tokenizeForMatch(phrase))];
  if (phraseTokens.length === 0) return 0;
  const matched = phraseTokens.filter((token) => haystackTokens.has(token)).length;
  return matched / phraseTokens.length;
}

function includesMeaningfulEvidence(haystack: string, phrase: string): boolean {
  if (includesPhrase(haystack, phrase)) return true;
  const tokens = tokenizeForMatch(phrase);
  if (tokens.length <= 2) {
    return tokens.every((token) => new RegExp(`\\b${token}\\b`, "i").test(normalize(haystack)));
  }
  return tokenOverlapScore(haystack, phrase) >= 0.5;
}

function factMatchesRequirement(
  fact: ProposalQualityCandidateFact,
  requirement: string,
): boolean {
  if (fact.mapsTo.some((priority) => includesPhrase(priority, requirement))) return true;
  if (fact.mapsTo.some((priority) => includesMeaningfulEvidence(priority, requirement))) {
    return true;
  }
  if (includesMeaningfulEvidence(fact.text, requirement)) return true;
  const normalizedFact = normalize(fact.text);
  const normalizedRequirement = normalize(requirement);
  if (
    /\breact\b/.test(normalizedRequirement) &&
    /\btypescript\b/.test(normalizedRequirement)
  ) {
    return /\breact\b/.test(normalizedFact) && /\btypescript\b/.test(normalizedFact);
  }
  if (/\b28 percent\b/.test(normalizedRequirement)) {
    return /\b28 percent\b/.test(normalizedFact);
  }
  if (/\bdesign system\b/.test(normalizedRequirement)) {
    return /\bdesign system\b/.test(normalizedFact);
  }
  if (/\bdesign\b/.test(normalizedRequirement) && /\bproduct\b/.test(normalizedRequirement)) {
    return /\bdesign\b/.test(normalizedFact) && /\bproduct\b/.test(normalizedFact);
  }
  return false;
}

function requirementClaimedAsSupported(letter: string, requirement: string): boolean {
  return splitSentences(letter).some(
    (sentence) =>
      includesMeaningfulEvidence(sentence, requirement) &&
      !GAP_OR_SAFETY_PATTERN.test(sentence),
  );
}

function splitParagraphs(letter: string): string[] {
  return letter
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(letter: string): string[] {
  return letter
    .replace(/\r/g, "\n")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildPlannerResult(fixture: ProposalQualityFixture): ProposalPlannerResult {
  const credentialBlocked = fixture.expectedBlockedKeywords.some((keyword) =>
    CREDENTIAL_PATTERN.test(keyword),
  );
  return {
    context_mode: fixture.contextMode,
    domain_gap: fixture.contextMode === "none" ? "distant" : "direct",
    credential_status: credentialBlocked ? "unsupported" : "exact_required",
    transfer_mode: fixture.contextMode === "none" ? "no_operational_analogy" : "literal",
    output_language: "en",
    allowed_concrete_facts: fixture.candidateFacts.map((fact) => fact.text),
    allowed_transfer_themes: fixture.candidateFacts
      .filter((fact) => fact.priority === "workflow" || fact.priority === "domain")
      .map((fact) => fact.mapsTo.join(" / ")),
    disallowed_claims: fixture.expectedBlockedKeywords.map(
      (keyword) => `unsupported ${keyword}`,
    ),
    identity_hard_stops: [],
    proof_strategy:
      fixture.candidateFacts.length > 0 ? "concrete_supported" : "none",
    opening_strategy: "direct_fast",
  };
}

function truthPlanSourceForFixtureFact(
  fact: ProposalQualityCandidateFact,
): ProposalTruthPlanCandidateFactInput["source"] {
  if (fact.priority === "achievement") return "candidate_achievement";
  if (fact.priority === "tool" || fact.priority === "trait") return "candidate_skill";
  if (fact.source === "proposal_context") return "candidate_summary";
  return "candidate_experience";
}

function buildTruthPlanForFixture(
  fixture: ProposalQualityFixture,
): ProposalTruthPlanV1 {
  return buildProposalTruthPlanV1({
    jobTitle: fixture.jobTitle,
    jobDescription: fixture.jobDescription,
    contextMode: fixture.contextMode,
    candidateFacts: fixture.candidateFacts.map((fact) => ({
      id: fact.id,
      fact: fact.text,
      source: truthPlanSourceForFixtureFact(fact),
      sourceText: fact.text,
    })),
    expectedCriticalRequirements: fixture.topJobPriorities,
    expectedBlockedClaims: fixture.blockedClaims,
  });
}

function truthPlanOutputCheckNotRun(): ProposalTruthPlanOutputCheck {
  return { status: "not_run", violations: [] };
}

function truthPlanRepairAnalysisNotRun(): ProposalTruthPlanRepairAnalysis {
  return { status: "not_run", recommendedAction: "none", reasons: [] };
}

function truthPlanOutputCheckStatus(
  violations: ProposalTruthPlanOutputViolation[],
): ProposalTruthPlanOutputCheck["status"] {
  if (violations.length === 0) return "pass";
  return violations.some((violation) => violation.severity === "high")
    ? "fail"
    : "warn";
}

function sentenceClaimedAsCandidateCapability(sentence: string): boolean {
  if (
    /\b(?:i(?:'m| am|’m)\s+interested|i(?:'d| would)\s+(?:welcome|value)\s+the\s+opportunity|willing(?:ness)?\s+to\s+discuss|role\s+(?:centers|focuses|involves)|posting\s+(?:centers|focuses|involves))\b/i.test(
      sentence,
    )
  ) {
    return false;
  }
  return CLAIM_CUE_PATTERN.test(sentence) && !GAP_OR_SAFETY_PATTERN.test(sentence);
}

function sentenceMatchesPlanFact(
  sentence: string,
  truthPlan: ProposalTruthPlanV1,
): boolean {
  return truthPlan.candidateFacts.some((fact) =>
    includesMeaningfulEvidence(sentence, fact.fact),
  );
}

function addTruthPlanOutputViolation(
  violations: ProposalTruthPlanOutputViolation[],
  violation: ProposalTruthPlanOutputViolation,
): void {
  const key = `${violation.type}:${normalize(violation.claim)}:${normalize(
    violation.evidence ?? "",
  )}`;
  if (
    violations.some(
      (entry) =>
        `${entry.type}:${normalize(entry.claim)}:${normalize(
          entry.evidence ?? "",
        )}` === key,
    )
  ) {
    return;
  }
  violations.push(violation);
}

function analyzeTruthPlanOutput(args: {
  truthPlan: ProposalTruthPlanV1 | null;
  letter: string;
}): ProposalTruthPlanOutputCheck {
  const truthPlan = args.truthPlan;
  if (!truthPlan) return truthPlanOutputCheckNotRun();

  const violations: ProposalTruthPlanOutputViolation[] = [];
  const sentences = splitSentences(args.letter);

  for (const blockedClaim of truthPlan.blockedClaims) {
    for (const sentence of sentences) {
      if (
        includesMeaningfulEvidence(sentence, blockedClaim.claim) &&
        !GAP_OR_SAFETY_PATTERN.test(sentence)
      ) {
        addTruthPlanOutputViolation(violations, {
          type:
            blockedClaim.reason === "unsupported_leadership"
              ? "unsupported_leadership_claim"
              : "blocked_claim_used",
          claim: blockedClaim.claim,
          evidence: sentence,
          severity:
            blockedClaim.reason === "unsupported_leadership" ||
            blockedClaim.reason === "no_context_personal_claim"
              ? "high"
              : "medium",
        });
      }
    }
  }

  for (const missingRequirement of truthPlan.missingCriticalRequirements) {
    for (const sentence of sentences) {
      if (
        includesMeaningfulEvidence(sentence, missingRequirement.requirement) &&
        sentenceClaimedAsCandidateCapability(sentence)
      ) {
        addTruthPlanOutputViolation(violations, {
          type: "missing_requirement_claimed",
          claim: missingRequirement.requirement,
          evidence: sentence,
          severity: "high",
        });
      }
    }
  }

  if (truthPlan.writingMode === "no_context_safe") {
    for (const sentence of sentences) {
      if (NO_CONTEXT_CLAIM_PATTERN.test(sentence)) {
        addTruthPlanOutputViolation(violations, {
          type: "no_context_personal_claim",
          claim: "no-context personal claim",
          evidence: sentence,
          severity: "high",
        });
      }
    }
  }

  if (truthPlan.writingMode === "adjacent_only") {
    for (const sentence of sentences) {
      if (!sentenceClaimedAsCandidateCapability(sentence)) continue;
      const usesMissingRequirement = truthPlan.missingCriticalRequirements.some(
        (requirement) =>
          includesMeaningfulEvidence(sentence, requirement.requirement),
      );
      const usesBlockedClaim = truthPlan.blockedClaims.some((claim) =>
        includesMeaningfulEvidence(sentence, claim.claim),
      );
      if (usesMissingRequirement || usesBlockedClaim) {
        addTruthPlanOutputViolation(violations, {
          type: "adjacent_mode_overclaim",
          claim: usesMissingRequirement
            ? "adjacent missing requirement claimed as capability"
            : "adjacent blocked claim used as capability",
          evidence: sentence,
          severity: "high",
        });
      }
    }
  }

  const leadershipUnsupported =
    truthPlan.blockedClaims.some(
      (claim) => claim.reason === "unsupported_leadership",
    ) ||
    truthPlan.missingCriticalRequirements.some((requirement) =>
      /\b(?:mentor|people[-\s]?management|manage junior|manage people)\b/i.test(
        requirement.requirement,
      ),
    );
  if (leadershipUnsupported) {
    for (const sentence of sentences) {
      if (
        /\b(?:mentor(?:ing)?|people[-\s]?management|manage(?:d|s)?\s+(?:people|junior)|managing\s+(?:people|junior))\b/i.test(
          sentence,
        ) &&
        sentenceClaimedAsCandidateCapability(sentence)
      ) {
        addTruthPlanOutputViolation(violations, {
          type: "unsupported_leadership_claim",
          claim: "mentoring or people-management experience",
          evidence: sentence,
          severity: "high",
        });
      }
    }
  }

  for (const sentence of sentences) {
    if (!sentenceClaimedAsCandidateCapability(sentence)) continue;
    if (sentenceMatchesPlanFact(sentence, truthPlan)) continue;
    if (
      truthPlan.allowedClaims.some(
        (claim) =>
          claim.claimType === "candidate_fact" &&
          claim.factIds.length > 0 &&
          includesMeaningfulEvidence(sentence, claim.claim),
      )
    ) {
      continue;
    }
    addTruthPlanOutputViolation(violations, {
      type: "direct_claim_without_fact",
      claim: "candidate capability not matched to truth-plan fact",
      evidence: sentence,
      severity: truthPlan.writingMode === "normal" ? "medium" : "high",
    });
  }

  return {
    status: truthPlanOutputCheckStatus(violations),
    violations,
  };
}

function addTruthPlanRepairReason(
  reasons: ProposalTruthPlanRepairReason[],
  reason: ProposalTruthPlanRepairReason,
): void {
  const key = `${reason.type}:${normalize(reason.claim ?? "")}:${normalize(
    reason.evidence ?? "",
  )}`;
  if (
    reasons.some(
      (entry) =>
        `${entry.type}:${normalize(entry.claim ?? "")}:${normalize(
          entry.evidence ?? "",
        )}` === key,
    )
  ) {
    return;
  }
  reasons.push(reason);
}

function existingFindingCoversTruthPlanViolation(args: {
  violation: ProposalTruthPlanOutputViolation;
  unsupportedClaims: number;
  bannedCompanyPraise: number;
  credentialInflation: boolean;
  noContextViolation: boolean;
}): boolean {
  if (args.violation.type === "no_context_personal_claim") {
    return args.noContextViolation;
  }
  if (args.violation.type === "blocked_claim_used") {
    return args.unsupportedClaims > 0 || args.bannedCompanyPraise > 0;
  }
  if (args.violation.type === "unsupported_leadership_claim") {
    return args.unsupportedClaims > 0;
  }
  if (args.violation.type === "missing_requirement_claimed") {
    return args.unsupportedClaims > 0 || args.credentialInflation;
  }
  if (args.violation.type === "adjacent_mode_overclaim") {
    return args.unsupportedClaims > 0 || args.noContextViolation;
  }
  return false;
}

function truthPlanRepairReasonForViolation(
  violation: ProposalTruthPlanOutputViolation,
): ProposalTruthPlanRepairReason["type"] {
  if (violation.type === "blocked_claim_used") {
    return "repair_should_remove_blocked_claim";
  }
  if (violation.type === "missing_requirement_claimed") {
    return "missing_requirement_should_remain_gap";
  }
  if (violation.type === "no_context_personal_claim") {
    return "fallback_preferred_for_no_context";
  }
  if (violation.type === "adjacent_mode_overclaim") {
    return "adjacent_mode_requires_reframe";
  }
  if (violation.type === "unsupported_leadership_claim") {
    return "unsupported_leadership_should_be_removed";
  }
  return "truth_plan_violation_unhandled";
}

function analyzeTruthPlanRepair(args: {
  truthPlan: ProposalTruthPlanV1 | null;
  outputCheck: ProposalTruthPlanOutputCheck;
  unsupportedClaims: number;
  bannedCompanyPraise: number;
  credentialInflation: boolean;
  noContextViolation: boolean;
}): ProposalTruthPlanRepairAnalysis {
  if (!args.truthPlan || args.outputCheck.status === "not_run") {
    return truthPlanRepairAnalysisNotRun();
  }
  if (args.outputCheck.violations.length === 0) {
    return { status: "pass", recommendedAction: "keep_output", reasons: [] };
  }

  const reasons: ProposalTruthPlanRepairReason[] = [];
  let recommendedAction: ProposalTruthPlanRepairAnalysis["recommendedAction"] =
    "repair_with_truth_plan";

  for (const violation of args.outputCheck.violations) {
    const mappedReason = truthPlanRepairReasonForViolation(violation);
    addTruthPlanRepairReason(reasons, {
      type: mappedReason,
      claim: violation.claim,
      evidence: violation.evidence,
      severity: violation.severity,
    });

    const existingFindingCoversViolation = existingFindingCoversTruthPlanViolation({
      violation,
      unsupportedClaims: args.unsupportedClaims,
      bannedCompanyPraise: args.bannedCompanyPraise,
      credentialInflation: args.credentialInflation,
      noContextViolation: args.noContextViolation,
    });
    addTruthPlanRepairReason(reasons, {
      type: existingFindingCoversViolation
        ? "truth_plan_violation_already_detected"
        : "truth_plan_violation_unhandled",
      claim: violation.claim,
      evidence: violation.evidence,
      severity: violation.severity,
    });

    if (
      args.truthPlan.writingMode === "no_context_safe" &&
      violation.severity === "high" &&
      (violation.type === "no_context_personal_claim" ||
        violation.type === "direct_claim_without_fact")
    ) {
      recommendedAction = "fallback";
    }
  }

  if (
    recommendedAction !== "fallback" &&
    args.truthPlan.writerPolicy === "bypass_writer_use_fallback" &&
    args.outputCheck.violations.some((violation) => violation.severity === "high")
  ) {
    recommendedAction = "fallback";
  }

  return {
    status: args.outputCheck.violations.some(
      (violation) => violation.severity === "high",
    )
      ? "fail"
      : "warn",
    recommendedAction,
    reasons,
  };
}

function isLetterBoundaryParagraph(value: string): boolean {
  return (
    /^dear\b/i.test(value) ||
    /^(best regards|regards|sincerely|kind regards|thank you),?$/i.test(value) ||
    /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(value)
  );
}

function compactCanonWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function readerParagraphs(letter: string): string[] {
  return letter
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((paragraph) => !isLetterBoundaryParagraph(paragraph));
}

function firstReaderParagraph(letter: string): string {
  return readerParagraphs(letter)[0] ?? compactCanonWhitespace(letter);
}

function countCanonTerm(letter: string, term: string): number {
  const normalizedLetter = compactCanonWhitespace(letter).toLowerCase();
  const normalizedTerm = term.toLowerCase();
  let count = 0;
  let index = normalizedLetter.indexOf(normalizedTerm);
  while (index >= 0) {
    count += 1;
    index = normalizedLetter.indexOf(normalizedTerm, index + normalizedTerm.length);
  }
  return count;
}

function factBankMatches(
  fixture: ProposalQualityFixture,
  pattern: RegExp,
): boolean {
  const factBank =
    fixture.sourceBackedCandidateFacts ??
    fixture.candidateFacts?.map((fact) => fact.text) ??
    [];
  return factBank.some((fact) => pattern.test(fact));
}

function classifyCoverLetterOpeningMode(args: {
  fixture: ProposalQualityFixture;
  opening: string;
  truthPlan: ProposalTruthPlanV1 | null;
}): CoverLetterWritingCanonOpeningMode {
  if (args.truthPlan?.writingMode === "no_context_safe" || args.fixture.contextMode === "none") {
    return "no_context_work_surface";
  }
  if (args.truthPlan?.writingMode === "adjacent_only") {
    return "adjacent_boundary";
  }
  if (/\b(?:through-line|through line|thread)\b/i.test(args.opening)) {
    return "through_line";
  }
  if (/\b(?:\d+\s*%|\d+\s*percent|improved|reduced|led|built|brightlayer|northline)\b/i.test(args.opening)) {
    return "proof_led";
  }
  return "candidate_work_context";
}

function evaluateCoverLetterWritingCanon(args: {
  fixture: ProposalQualityFixture;
  letter: string;
  truthPlan: ProposalTruthPlanV1 | null;
}): CoverLetterWritingCanonResult {
  const opening = firstReaderParagraph(args.letter);
  const hardFailures: string[] = [];
  const warnings: string[] = [];
  const addHardFailure = (code: string) => {
    if (!hardFailures.includes(code)) hardFailures.push(code);
  };
  const addWarning = (code: string) => {
    if (!warnings.includes(code)) warnings.push(code);
  };

  if (BANNED_OPENING_START_PATTERNS.some((pattern) => pattern.test(opening))) {
    addHardFailure("banned_opening_start");
  }
  if (
    UNSUPPORTED_MENTORING_PATTERN.test(args.letter) &&
    !factBankMatches(args.fixture, /\bmentor(?:ing|ed)?|junior engineers?|coach(?:ing|ed)?\b/i)
  ) {
    addHardFailure("unsupported_mentoring");
  }
  if (
    PEOPLE_MANAGEMENT_PATTERN.test(args.letter) &&
    !factBankMatches(args.fixture, /\bpeople management|managed people|direct reports?|managed a team|led a team\b/i)
  ) {
    addHardFailure("people_management");
  }
  if (BACKEND_OR_MOBILE_OWNERSHIP_PATTERN.test(args.letter)) {
    addHardFailure("backend_mobile_ownership");
  }
  if (ANALYTICS_INSTRUMENTATION_OWNERSHIP_PATTERN.test(args.letter)) {
    addHardFailure("analytics_instrumentation_ownership");
  }

  for (const term of COVER_LETTER_WRITING_CANON_V1.warningTerms) {
    if (countCanonTerm(args.letter, term) > 1) {
      addWarning(`overused_${term.replace(/\s+/g, "_")}`);
    }
  }
  if (
    args.fixture.contextMode !== "none" &&
    args.fixture.contextMode !== "minimal" &&
    ROLE_PARAPHRASE_OPENING_PATTERN.test(opening)
  ) {
    addWarning("opens_with_role_paraphrase");
  }
  if (
    factBankMatches(args.fixture, /\b(?:\d+\s*%|\d+\s*percent)\b/i) &&
    !/\b(?:\d+\s*%|\d+\s*percent)\b/i.test(args.letter)
  ) {
    addWarning("missing_sourced_metric");
  }
  if (
    factBankMatches(args.fixture, /\bdesign[-\s]?system\b/i) &&
    !/\bdesign[-\s]?system\b/i.test(args.letter)
  ) {
    addWarning("missing_design_system_evidence");
  }
  if (
    factBankMatches(args.fixture, /\b(?:page[-\s]?load|performance|rendering|bundle)\b/i) &&
    !/\b(?:page[-\s]?load|load time|performance|rendering|bundle)\b/i.test(args.letter)
  ) {
    addWarning("missing_performance_evidence");
  }
  if (
    ROLE_PARAPHRASE_OPENING_PATTERN.test(opening) ||
    /\b(?:your goal|your need|your needs|your emphasis|your interest|the role includes|this role includes)\b/i.test(args.letter)
  ) {
    addWarning("sounds_like_job_description_paraphrase");
  }
  if (VISIBLE_CHECKLIST_RHYTHM_PATTERNS.some((pattern) => pattern.test(args.letter))) {
    addWarning("visible_checklist_rhythm");
  }

  return {
    version: "CoverLetterWritingCanonV1",
    openingMode: classifyCoverLetterOpeningMode({
      fixture: args.fixture,
      opening,
      truthPlan: args.truthPlan,
    }),
    hardFailures,
    warnings,
  };
}

function selectFactsUsed(
  fixture: ProposalQualityFixture,
  letter: string,
): ProposalEvalResult["topCandidateFactsUsed"] {
  return fixture.candidateFacts
    .filter((fact) => includesMeaningfulEvidence(letter, fact.text))
    .sort((left, right) => {
      const rank = {
        achievement: 5,
        responsibility: 4,
        workflow: 3,
        domain: 2,
        tool: 1,
        trait: 0,
      } as const;
      return rank[right.priority] - rank[left.priority];
    })
    .slice(0, 3)
    .map((fact) => ({
      fact: fact.text,
      source: fact.source,
      jobPriority: fact.mapsTo[0] ?? "unmapped",
    }));
}

function countBannedPraise(
  fixture: ProposalQualityFixture,
  letter: string,
): number {
  const blockedKeywords = new Set(
    fixture.expectedBlockedKeywords.map((keyword) => normalize(keyword)),
  );
  const sentences = splitSentences(letter);
  return fixture.expectedForbiddenPhrases.filter((phrase) => {
    const normalizedPhrase = normalize(phrase);
    if (!blockedKeywords.has(normalizedPhrase)) {
      return includesPhrase(letter, phrase);
    }
    return sentences.some(
      (sentence) =>
        includesPhrase(sentence, phrase) && !GAP_OR_SAFETY_PATTERN.test(sentence),
    );
  }).length;
}

function countUnsupportedClaims(
  fixture: ProposalQualityFixture,
  letter: string,
): number {
  const sentences = splitSentences(letter);
  return fixture.expectedBlockedKeywords.filter((keyword) =>
    sentences.some(
      (sentence) =>
        includesPhrase(sentence, keyword) &&
        CLAIM_CUE_PATTERN.test(sentence) &&
        !GAP_OR_SAFETY_PATTERN.test(sentence),
    ),
  ).length;
}

function findMissingRequirements(
  fixture: ProposalQualityFixture,
  letter: string,
  usedFacts: ProposalEvalResult["topCandidateFactsUsed"],
): string[] {
  return fixture.expectedCriticalRequirements.filter(
    (requirement) =>
      !requirementClaimedAsSupported(letter, requirement) &&
      !usedFacts.some((fact) => includesMeaningfulEvidence(fact.jobPriority, requirement)) &&
      !fixture.candidateFacts.some(
        (fact) => includesMeaningfulEvidence(letter, fact.text) && factMatchesRequirement(fact, requirement),
      ),
  );
}

function supportedKeywordCoverage(
  fixture: ProposalQualityFixture,
  letter: string,
): number {
  if (fixture.expectedSupportedKeywords.length === 0) return 1;
  const supported = fixture.expectedSupportedKeywords.filter(
    (keyword) =>
      includesPhrase(letter, keyword) ||
      fixture.candidateFacts.some((fact) => includesPhrase(fact.text, keyword)),
  );
  return Number((supported.length / fixture.expectedSupportedKeywords.length).toFixed(2));
}

function countAdvisoryLeakage(
  fixture: ProposalQualityFixture,
  letter: string,
): number {
  const sourceBacked = fixture.candidateFacts.map((fact) => fact.text).join(" ");
  return fixture.expectedSupportedKeywords.filter(
    (keyword) =>
      includesPhrase(letter, keyword) &&
      !includesPhrase(sourceBacked, keyword) &&
      CLAIM_CUE_PATTERN.test(letter),
  ).length;
}

function paragraphGrounding(
  fixture: ProposalQualityFixture,
  letter: string,
): ProposalEvalResult["paragraphGrounding"] {
  return splitParagraphs(letter).map((paragraph) => ({
    paragraph,
    hasSourceBackedFact: fixture.candidateFacts.some((fact) =>
      includesMeaningfulEvidence(paragraph, fact.text),
    ),
    hasJustifiedRoleTransition: fixture.safeRoleTransitions.some((transition) =>
      includesMeaningfulEvidence(paragraph, transition),
    ),
  }));
}

function scoreRecruiterCase(args: {
  unsupportedClaims: number;
  bannedCompanyPraise: number;
  noContextViolation: boolean;
  credentialInflation: boolean;
  coverage: number;
  usedFacts: ProposalEvalResult["topCandidateFactsUsed"];
  grounding: ProposalEvalResult["paragraphGrounding"];
}): 1 | 2 | 3 | 4 | 5 {
  if (
    args.unsupportedClaims > 0 ||
    args.bannedCompanyPraise > 0 ||
    args.noContextViolation ||
    args.credentialInflation
  ) {
    return 1;
  }
  const allParagraphsGrounded = args.grounding.every(
    (entry) => entry.hasSourceBackedFact || entry.hasJustifiedRoleTransition,
  );
  if (!allParagraphsGrounded) return 2;
  if (args.usedFacts.length >= 2 && args.coverage >= 0.75) return 5;
  if (args.usedFacts.length >= 1 && args.coverage >= 0.5) return 4;
  return 3;
}

function readinessFromScore(score: number): ProposalEvalResult["selectorReadiness"] {
  if (score <= 1) return "fail";
  if (score === 2) return "weak";
  if (score === 3 || score === 4) return "pass";
  return "strong";
}

function readinessRank(value: ProposalEvalResult["selectorReadiness"]): number {
  return { fail: 0, weak: 1, pass: 2, strong: 3 }[value];
}

function evaluateFixtureVariant(args: {
  fixture: ProposalQualityFixture;
  variant: ProposalQualityHarnessVariant;
  hardness: ProposalQualityHarnessHardness;
  baseline?: ProposalEvalResult;
}): ProposalEvalResult {
  const fixture = args.fixture;
  const letter =
    args.variant === "semantic_planner_shadow"
      ? fixture.letters.criteria_audit_shadow
      : fixture.letters[args.variant];
  const plannerResult = buildPlannerResult(fixture);
  const criteriaAudit =
    args.variant === "baseline"
      ? null
      : buildProposalCriteriaAudit({
          plannerResult,
          jobTitle: fixture.jobTitle,
          jobDescription: fixture.jobDescription,
          generatedText: letter,
        });
  const truthPlan =
    args.variant === "semantic_planner_shadow"
      ? buildTruthPlanForFixture(fixture)
      : null;
  const truthPlanValidationWarnings = truthPlan
    ? validateProposalTruthPlanV1(truthPlan)
    : [];
  const truthPlanOutputCheck = analyzeTruthPlanOutput({
    truthPlan,
    letter,
  });
  const usedFacts = selectFactsUsed(fixture, letter);
  const missingCriticalRequirements = findMissingRequirements(fixture, letter, usedFacts);
  const unsupportedClaims = countUnsupportedClaims(fixture, letter);
  const bannedCompanyPraise = countBannedPraise(fixture, letter);
  const credentialInflation =
    fixture.expectedBlockedKeywords.some((keyword) =>
      splitSentences(letter).some(
        (sentence) =>
          CREDENTIAL_PATTERN.test(keyword) &&
          includesPhrase(sentence, keyword) &&
          CLAIM_CUE_PATTERN.test(sentence) &&
          !GAP_OR_SAFETY_PATTERN.test(sentence),
      ),
    );
  const noContextViolation =
    fixture.contextMode === "none" && NO_CONTEXT_CLAIM_PATTERN.test(letter);
  const coverage = supportedKeywordCoverage(fixture, letter);
  const advisoryKeywordLeakage = countAdvisoryLeakage(fixture, letter);
  const grounding = paragraphGrounding(fixture, letter);
  const coverLetterWritingCanon = evaluateCoverLetterWritingCanon({
    fixture,
    letter,
    truthPlan,
  });
  const recruiterCaseScore = scoreRecruiterCase({
    unsupportedClaims,
    bannedCompanyPraise,
    noContextViolation,
    credentialInflation,
    coverage,
    usedFacts,
    grounding,
  });
  const selectorReadiness = readinessFromScore(recruiterCaseScore);
  const truthPlanRepairAnalysis = analyzeTruthPlanRepair({
    truthPlan,
    outputCheck: truthPlanOutputCheck,
    unsupportedClaims,
    bannedCompanyPraise,
    credentialInflation,
    noContextViolation,
  });
  const worseThanBaseline = args.baseline
    ? selectorReadiness !== args.baseline.selectorReadiness &&
        readinessRank(selectorReadiness) <
          readinessRank(args.baseline.selectorReadiness)
      ? true
      : recruiterCaseScore < args.baseline.recruiterCaseScore ||
        (coverage < args.baseline.supportedKeywordCoverage &&
          unsupportedClaims === 0 &&
          bannedCompanyPraise === 0)
    : false;

  return {
    fixtureId: fixture.id,
    variant: args.variant,
    unsupportedClaims,
    bannedCompanyPraise,
    missingCriticalRequirements,
    supportedKeywordCoverage: coverage,
    advisoryKeywordLeakage,
    credentialInflation,
    noContextViolation,
    recruiterCaseScore,
    selectorReadiness,
    worseThanBaseline,
    topCandidateFactsUsed: usedFacts,
    unsupportedOrWeaklySupportedCriteria: missingCriticalRequirements,
    companyValuesLanguageUsed: VALUE_LANGUAGE_PATTERN.test(letter),
    inventedClaimFree:
      unsupportedClaims === 0 &&
      !credentialInflation &&
      !noContextViolation &&
      bannedCompanyPraise === 0,
    paragraphGrounding: grounding,
    harnessKind: "static_safety",
    harnessHardness: args.hardness,
    comparisonKind:
      args.variant === "baseline"
        ? "baseline_only"
        : "shadow_parity_safety_check",
    criteriaAudit,
    truthPlan,
    plannedWritingMode: truthPlan?.writingMode ?? null,
    plannedBlockedClaimsCount: truthPlan?.blockedClaims.length ?? null,
    plannedMissingCriticalRequirementsCount:
      truthPlan?.missingCriticalRequirements.length ?? null,
    truthPlanValidationWarnings,
    truthPlanOutputCheck,
    truthPlanRepairAnalysis,
    coverLetterWritingCanon,
    safetyReason:
      coverage < (args.baseline?.supportedKeywordCoverage ?? 0)
        ? "lower keyword coverage only allowed when avoiding unsupported claims"
        : undefined,
  };
}

export function runProposalQualityHarness(args?: {
  variants?: ProposalQualityHarnessVariant[];
  fixtures?: ProposalQualityFixture[];
  hardness?: ProposalQualityHarnessHardness;
}): ProposalEvalResult[] {
  const fixtures = args?.fixtures ?? PROPOSAL_QUALITY_FIXTURES;
  const variants = args?.variants ?? ["baseline", "criteria_audit_shadow"];
  const hardness = args?.hardness ?? DEFAULT_PROPOSAL_QUALITY_HARNESS_HARDNESS;
  return fixtures.flatMap((fixture) => {
    const baseline = evaluateFixtureVariant({
      fixture,
      variant: "baseline",
      hardness,
    });
    return variants.map((variant) =>
      variant === "baseline"
        ? baseline
        : evaluateFixtureVariant({ fixture, variant, hardness, baseline }),
    );
  });
}

export function assertProposalQualityHardGates(
  results: readonly ProposalEvalResult[],
): string[] {
  const failures: string[] = [];
  for (const result of results) {
    if (result.unsupportedClaims > 0) failures.push(`${result.fixtureId}:${result.variant}:unsupportedClaims`);
    if (result.bannedCompanyPraise > 0) failures.push(`${result.fixtureId}:${result.variant}:bannedCompanyPraise`);
    if (result.noContextViolation) failures.push(`${result.fixtureId}:${result.variant}:noContextViolation`);
    if (result.credentialInflation) failures.push(`${result.fixtureId}:${result.variant}:credentialInflation`);
    if (result.worseThanBaseline) failures.push(`${result.fixtureId}:${result.variant}:worseThanBaseline`);
    const ungroundedParagraph = result.paragraphGrounding.some(
      (entry) => !entry.hasSourceBackedFact && !entry.hasJustifiedRoleTransition,
    );
    if (ungroundedParagraph) failures.push(`${result.fixtureId}:${result.variant}:ungroundedParagraph`);
    for (const failure of result.coverLetterWritingCanon.hardFailures) {
      failures.push(`${result.fixtureId}:${result.variant}:${failure}`);
    }
  }
  return failures;
}

const SHARED_FORBIDDEN = [
  "I am passionate about your mission",
  "My skills make me a perfect fit",
  "I share your values",
  "your mission resonates with me",
  "I admire your culture",
];

function sameLetter(value: string): Record<"baseline" | "criteria_audit_shadow", string> {
  return { baseline: value, criteria_audit_shadow: value };
}

function withFixtureMetadata(
  fixture: ProposalQualityFixtureInput,
): ProposalQualityFixture {
  return {
    ...fixture,
    topJobPriorities:
      fixture.topJobPriorities ?? fixture.expectedCriticalRequirements,
    sourceBackedCandidateFacts:
      fixture.sourceBackedCandidateFacts ??
      fixture.candidateFacts.map((fact) => fact.text),
    allowedTransferableEvidence:
      fixture.allowedTransferableEvidence ??
      fixture.candidateFacts
        .filter((fact) => fact.priority === "workflow" || fact.priority === "domain")
        .map((fact) => fact.text),
    blockedClaims:
      fixture.blockedClaims ??
      fixture.expectedBlockedKeywords.map((keyword) => `unsupported ${keyword}`),
    expectedGaps:
      fixture.expectedGaps ??
      fixture.expectedCriticalRequirements.filter((requirement) =>
        fixture.expectedBlockedKeywords.some((keyword) =>
          includesPhrase(keyword, requirement),
        ),
      ),
    expectedCompanyValuesBehavior:
      fixture.expectedCompanyValuesBehavior ??
      analyzeCompanyValues(fixture.jobDescription).confidence,
  };
}

export const PROPOSAL_QUALITY_FIXTURES: ProposalQualityFixture[] = ([
  {
    id: "employment-strong-frontend",
    label: "gold target: strong frontend cover letter",
    jobTitle: "Senior Frontend Engineer",
    jobDescription:
      "Lead React and TypeScript development for a customer-facing SaaS platform, build reusable UI systems, improve performance, collaborate with product and design, and use experimentation carefully.",
    contextMode: "rich",
    candidateFacts: [
      {
        id: "f1",
        text: "React and TypeScript work on product-facing web apps.",
        source: "profile",
        mapsTo: ["React and TypeScript development"],
        priority: "tool",
      },
      {
        id: "f2",
        text: "Led a design system migration used across 4 product squads.",
        source: "profile",
        mapsTo: ["reusable UI systems"],
        priority: "responsibility",
      },
      {
        id: "f3",
        text: "Reduced page load time by 28 percent through bundle and rendering optimizations.",
        source: "profile",
        mapsTo: ["performance optimization"],
        priority: "achievement",
      },
      {
        id: "f4",
        text: "Built experimentation dashboards used by product and growth teams.",
        source: "profile",
        mapsTo: ["experimentation"],
        priority: "workflow",
      },
      {
        id: "f5",
        text: "Partnered directly with design on customer-facing workflow improvements.",
        source: "profile",
        mapsTo: ["collaboration with product and design"],
        priority: "workflow",
      },
      {
        id: "f6",
        text: "Improved signup conversion by 11 percent after iterative UI experiments.",
        source: "profile",
        mapsTo: ["experimentation"],
        priority: "achievement",
      },
    ],
    expectedCriticalRequirements: [
      "React and TypeScript development",
      "reusable UI systems",
      "performance optimization",
      "collaboration with product and design",
    ],
    expectedSupportedKeywords: [
      "React",
      "TypeScript",
      "design system",
      "page load",
      "28 percent",
      "product and design",
      "11 percent",
    ],
    expectedBlockedKeywords: [
      "mentoring junior engineers",
      "people management",
      "backend ownership",
      "mobile development",
      "analytics instrumentation ownership",
    ],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: [
      "analytics instrumentation as a learning area",
      "frontend systems",
    ],
    letters: sameLetter(
      [
        "At BrightLayer, I worked on the kind of frontend foundation that matters once a product is already in customers' hands: React and TypeScript work, a design system migration used across 4 product squads, and bundle and rendering optimizations that reduced page load time by 28 percent.",
        "That was not only component cleanup. It meant making reusable UI patterns easier for product squads to ship, keeping performance visible, and staying close to product and design decisions. At Northline Labs, I built experimentation dashboards used by product and growth teams and partnered directly with design on customer-facing workflow improvements.",
        "Those projects are the through-line I would bring here: frontend systems that make the product faster, clearer, and easier to iterate. The strongest example is the signup work, where iterative UI experiments improved conversion by 11 percent. For a recruiter, the evidence is not a list of tools, but shipped interface work tied to speed, consistency, and conversion. I would treat analytics instrumentation as a learning area rather than claim ownership of it, while bringing a grounded React, TypeScript, performance, and product-design collaboration base.",
      ].join("\n\n"),
    ),
  },
  {
    id: "strong-fit",
    label: "strong candidate / strong fit",
    jobTitle: "Senior Frontend Engineer",
    jobDescription:
      "Lead React delivery for customer-facing web applications and improve experimentation workflows.",
    contextMode: "rich",
    candidateFacts: [
      {
        id: "f1",
        text: "Improved signup conversion by 11 percent after iterative UI experiments.",
        source: "profile",
        mapsTo: ["improve experimentation workflows"],
        priority: "achievement",
      },
      {
        id: "f2",
        text: "Led a design system migration used across 4 product squads.",
        source: "profile",
        mapsTo: ["Lead React delivery"],
        priority: "responsibility",
      },
    ],
    expectedCriticalRequirements: [
      "improve experimentation workflows",
      "Lead React delivery",
    ],
    expectedSupportedKeywords: ["React delivery", "experimentation workflows"],
    expectedBlockedKeywords: [],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["customer-facing web applications"],
    letters: sameLetter(
      [
        "The role emphasizes React delivery for customer-facing web applications. Improved signup conversion by 11 percent after iterative UI experiments.",
        "Led a design system migration used across 4 product squads.",
      ].join("\n\n"),
    ),
  },
  {
    id: "weak-candidate-ambitious-job",
    label: "weak candidate / ambitious job",
    jobTitle: "Machine Learning Platform Engineer",
    jobDescription:
      "Build production machine learning systems, own model deployment, and maintain Python services.",
    contextMode: "sparse",
    candidateFacts: [
      {
        id: "f1",
        text: "Built experimentation dashboards for growth teams.",
        source: "cv",
        mapsTo: ["maintain analytical workflows"],
        priority: "workflow",
      },
    ],
    expectedCriticalRequirements: ["production machine learning systems"],
    expectedSupportedKeywords: ["experimentation dashboards"],
    expectedBlockedKeywords: ["machine learning systems", "model deployment", "Python services"],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["production machine learning systems remains a gap"],
    letters: sameLetter(
      [
        "Built experimentation dashboards for growth teams.",
        "Production machine learning systems remains a gap to mark rather than inflate.",
      ].join("\n\n"),
    ),
  },
  {
    id: "no-context",
    label: "no-context mode",
    jobTitle: "Operations Associate",
    jobDescription:
      "Support recurring service records, coordinate handoffs, and keep documentation current.",
    contextMode: "none",
    candidateFacts: [],
    expectedCriticalRequirements: ["service records", "coordinate handoffs"],
    expectedSupportedKeywords: [],
    expectedBlockedKeywords: ["service records", "coordinate handoffs"],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    expectedNoContextBehavior: "no candidate history or alignment claims",
    safeRoleTransitions: [
      "service records and handoffs are the concrete work surfaces in the posting",
      "documentation current",
    ],
    letters: sameLetter(
      [
        "Service records and handoffs are the concrete work surfaces in the posting.",
        "Keeping documentation current is the role-specific thread to discuss.",
      ].join("\n\n"),
    ),
  },
  {
    id: "explicit-company-values",
    label: "explicit company values",
    jobTitle: "Client Operations Coordinator",
    jobDescription:
      "Our values are service, accountability, and trust. Coordinate client updates and issue follow-up.",
    contextMode: "rich",
    candidateFacts: [
      {
        id: "f1",
        text: "Managed weekly stakeholder updates and issue tracking for client operations.",
        source: "proposal_context",
        mapsTo: ["Coordinate client updates"],
        priority: "responsibility",
      },
    ],
    expectedCriticalRequirements: ["Coordinate client updates"],
    expectedSupportedKeywords: ["client updates", "issue follow-up"],
    expectedBlockedKeywords: [],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["issue follow-up"],
    letters: sameLetter(
      "Managed weekly stakeholder updates and issue tracking for client operations.",
    ),
  },
  {
    id: "generic-employer-fluff",
    label: "generic employer fluff",
    jobTitle: "Support Specialist",
    jobDescription:
      "Join a dynamic, fast-paced, world-class team with great culture. Answer customer tickets and document recurring issues.",
    contextMode: "rich",
    candidateFacts: [
      {
        id: "f1",
        text: "Documented recurring support issues and routed escalations.",
        source: "cv",
        mapsTo: ["document recurring issues"],
        priority: "responsibility",
      },
    ],
    expectedCriticalRequirements: ["document recurring issues"],
    expectedSupportedKeywords: ["support issues"],
    expectedBlockedKeywords: [],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["customer tickets"],
    letters: sameLetter(
      "Documented recurring support issues and routed escalations.",
    ),
  },
  {
    id: "implicit-values",
    label: "repeated concrete implicit values",
    jobTitle: "Safety Compliance Coordinator",
    jobDescription:
      "Maintain compliance logs and review safety records after each incident. Keep compliance documentation current and verify safety handoffs.",
    contextMode: "rich",
    candidateFacts: [
      {
        id: "f1",
        text: "Maintained audit logs and policy reporting for regulated vendor reviews.",
        source: "resume",
        mapsTo: ["Maintain compliance logs"],
        priority: "workflow",
      },
    ],
    expectedCriticalRequirements: ["Maintain compliance logs"],
    expectedSupportedKeywords: ["audit logs", "policy reporting"],
    expectedBlockedKeywords: ["safety handoffs"],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["safety records"],
    letters: sameLetter(
      "Maintained audit logs and policy reporting for regulated vendor reviews.",
    ),
  },
  {
    id: "missing-hard-credential",
    label: "missing hard credential",
    jobTitle: "Project Manager",
    jobDescription:
      "Must have PMP certification and experience leading regulated delivery.",
    contextMode: "rich",
    candidateFacts: [
      {
        id: "f1",
        text: "Coordinated delivery plans and weekly risk reviews for product launches.",
        source: "cv",
        mapsTo: ["regulated delivery"],
        priority: "responsibility",
      },
    ],
    expectedCriticalRequirements: ["PMP certification"],
    expectedSupportedKeywords: ["delivery plans"],
    expectedBlockedKeywords: ["PMP certification"],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["PMP certification is a gap"],
    letters: sameLetter(
      [
        "Coordinated delivery plans and weekly risk reviews for product launches.",
        "PMP certification is a gap to flag rather than claim.",
      ].join("\n\n"),
    ),
  },
  {
    id: "unsupported-tool",
    label: "unsupported tool requirement",
    jobTitle: "Cloud Operations Analyst",
    jobDescription:
      "Experience with Kubernetes reliability work and AWS incident response is required.",
    contextMode: "rich",
    candidateFacts: [
      {
        id: "f1",
        text: "Maintained incident trackers and escalation handoffs for operations teams.",
        source: "profile",
        mapsTo: ["incident response"],
        priority: "workflow",
      },
    ],
    expectedCriticalRequirements: ["Kubernetes reliability work"],
    expectedSupportedKeywords: ["incident trackers"],
    expectedBlockedKeywords: ["Kubernetes reliability work", "AWS incident response"],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["Kubernetes reliability work is not source-backed"],
    letters: sameLetter(
      [
        "Maintained incident trackers and escalation handoffs for operations teams.",
        "Kubernetes reliability work is not source-backed in the candidate material.",
      ].join("\n\n"),
    ),
  },
  {
    id: "transferable-adjacent",
    label: "transferable adjacent experience",
    jobTitle: "Implementation Analyst",
    jobDescription:
      "Coordinate implementation workflows, track deliverables, and manage cross-functional handoffs.",
    contextMode: "sparse",
    candidateFacts: [
      {
        id: "f1",
        text: "Owned ticket triage, handoffs, and SLA reporting across support and product teams.",
        source: "cv",
        mapsTo: ["cross-functional handoffs"],
        priority: "workflow",
      },
    ],
    expectedCriticalRequirements: ["cross-functional handoffs"],
    expectedSupportedKeywords: ["handoffs", "SLA reporting"],
    expectedBlockedKeywords: ["implementation workflows"],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["transferable workflow evidence"],
    letters: sameLetter(
      [
        "Owned ticket triage, handoffs, and SLA reporting across support and product teams.",
        "That is transferable workflow evidence for cross-functional handoffs, not direct implementation ownership.",
      ].join("\n\n"),
    ),
  },
  {
    id: "seniority-mismatch",
    label: "seniority mismatch",
    jobTitle: "Staff Product Designer",
    jobDescription:
      "Staff-level design leadership, design strategy ownership, and senior stakeholder influence are required.",
    contextMode: "rich",
    candidateFacts: [
      {
        id: "f1",
        text: "Designed onboarding screens and documented component usage for a product team.",
        source: "cv",
        mapsTo: ["design work"],
        priority: "responsibility",
      },
    ],
    expectedCriticalRequirements: ["Staff-level design leadership"],
    expectedSupportedKeywords: ["onboarding screens"],
    expectedBlockedKeywords: ["Staff-level design leadership", "senior stakeholder influence"],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["staff-level leadership is not source-backed"],
    letters: sameLetter(
      [
        "Designed onboarding screens and documented component usage for a product team.",
        "Staff-level leadership is not source-backed and should remain a gap.",
      ].join("\n\n"),
    ),
  },
  {
    id: "ats-keyword-heavy",
    label: "ATS keyword-heavy job",
    jobTitle: "Revenue Operations Specialist",
    jobDescription:
      "CRM hygiene, Salesforce reporting, pipeline dashboards, SQL analysis, stakeholder follow-up, and process documentation.",
    contextMode: "rich",
    candidateFacts: [
      {
        id: "f1",
        text: "Built weekly pipeline dashboards and stakeholder follow-up trackers.",
        source: "source_backed_candidate_data",
        mapsTo: ["pipeline dashboards", "stakeholder follow-up"],
        priority: "achievement",
      },
      {
        id: "f2",
        text: "Documented process changes for CRM handoffs.",
        source: "source_backed_candidate_data",
        mapsTo: ["process documentation"],
        priority: "workflow",
      },
    ],
    expectedCriticalRequirements: ["pipeline dashboards", "process documentation"],
    expectedSupportedKeywords: ["pipeline dashboards", "stakeholder follow-up", "CRM handoffs"],
    expectedBlockedKeywords: ["SQL analysis", "Salesforce reporting"],
    expectedForbiddenPhrases: SHARED_FORBIDDEN,
    safeRoleTransitions: ["ATS keywords stay source-backed"],
    letters: sameLetter(
      [
        "Built weekly pipeline dashboards and stakeholder follow-up trackers.",
        "Documented process changes for CRM handoffs.",
      ].join("\n\n"),
    ),
  },
] satisfies ProposalQualityFixtureInput[]).map(withFixtureMetadata);

export const PROPOSAL_QUALITY_NEGATIVE_CONTROL_FIXTURES:
  ProposalQualityFixture[] = ([
    {
      id: "negative-unsupported-credential-claimed",
      label: "negative control: unsupported credential claimed",
      jobTitle: "Project Manager",
      jobDescription:
        "Must have PMP certification and regulated delivery experience.",
      contextMode: "rich",
      candidateFacts: [
        {
          id: "f1",
          text: "Coordinated delivery plans and weekly risk reviews for product launches.",
          source: "cv",
          mapsTo: ["regulated delivery"],
          priority: "responsibility",
        },
      ],
      expectedCriticalRequirements: ["PMP certification"],
      expectedSupportedKeywords: ["delivery plans"],
      expectedBlockedKeywords: ["PMP certification"],
      expectedForbiddenPhrases: SHARED_FORBIDDEN,
      blockedClaims: ["I hold PMP certification"],
      expectedGaps: ["PMP certification"],
      expectedFailureCodes: [
        "negative-unsupported-credential-claimed:baseline:unsupportedClaims",
        "negative-unsupported-credential-claimed:baseline:credentialInflation",
      ],
      safeRoleTransitions: [],
      letters: sameLetter(
        "I hold PMP certification and coordinated delivery plans and weekly risk reviews for product launches.",
      ),
    },
    {
      id: "negative-company-praise-main-argument",
      label: "negative control: company praise used as main argument",
      jobTitle: "Client Operations Coordinator",
      jobDescription:
        "Our mission is to earn trust through careful service. Coordinate client issue follow-up.",
      contextMode: "rich",
      candidateFacts: [
        {
          id: "f1",
          text: "Managed weekly stakeholder updates and issue tracking for client operations.",
          source: "proposal_context",
          mapsTo: ["client issue follow-up"],
          priority: "responsibility",
        },
      ],
      expectedCriticalRequirements: ["client issue follow-up"],
      expectedSupportedKeywords: ["issue tracking"],
      expectedBlockedKeywords: [],
      expectedForbiddenPhrases: SHARED_FORBIDDEN,
      expectedCompanyValuesBehavior: "explicit",
      expectedFailureCodes: [
        "negative-company-praise-main-argument:baseline:bannedCompanyPraise",
      ],
      safeRoleTransitions: [],
      letters: sameLetter(
        "I share your values and your mission resonates with me. Managed weekly stakeholder updates and issue tracking for client operations.",
      ),
    },
    {
      id: "negative-no-context-invented-experience",
      label: "negative control: no-context invented experience",
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring service records, coordinate handoffs, and keep documentation current.",
      contextMode: "none",
      candidateFacts: [],
      expectedCriticalRequirements: ["service records", "coordinate handoffs"],
      expectedSupportedKeywords: [],
      expectedBlockedKeywords: ["service records", "coordinate handoffs"],
      expectedForbiddenPhrases: SHARED_FORBIDDEN,
      expectedNoContextBehavior: "no invented experience",
      expectedFailureCodes: [
        "negative-no-context-invented-experience:baseline:unsupportedClaims",
        "negative-no-context-invented-experience:baseline:noContextViolation",
      ],
      safeRoleTransitions: [],
      letters: sameLetter(
        "I managed service records and coordinated handoffs while keeping documentation current.",
      ),
    },
    {
      id: "negative-unsupported-tool-claim",
      label: "negative control: unsupported tool keyword inserted",
      jobTitle: "Cloud Operations Analyst",
      jobDescription:
        "Experience with Kubernetes reliability work and AWS incident response is required.",
      contextMode: "rich",
      candidateFacts: [
        {
          id: "f1",
          text: "Maintained incident trackers and escalation handoffs for operations teams.",
          source: "profile",
          mapsTo: ["incident response"],
          priority: "workflow",
        },
      ],
      expectedCriticalRequirements: ["Kubernetes reliability work"],
      expectedSupportedKeywords: ["incident trackers"],
      expectedBlockedKeywords: ["Kubernetes reliability work", "AWS incident response"],
      expectedForbiddenPhrases: SHARED_FORBIDDEN,
      blockedClaims: ["I have Kubernetes reliability work"],
      expectedGaps: ["Kubernetes reliability work", "AWS incident response"],
      expectedFailureCodes: [
        "negative-unsupported-tool-claim:baseline:unsupportedClaims",
      ],
      safeRoleTransitions: [],
      letters: sameLetter(
        "I have Kubernetes reliability work and AWS incident response experience. Maintained incident trackers and escalation handoffs for operations teams.",
      ),
    },
    {
      id: "negative-ungrounded-paragraph",
      label: "negative control: ungrounded paragraph",
      jobTitle: "Customer Support Specialist",
      jobDescription:
        "Manage email support and document recurring issues.",
      contextMode: "rich",
      candidateFacts: [
        {
          id: "f1",
          text: "Documented recurring support issues and routed escalations.",
          source: "cv",
          mapsTo: ["document recurring issues"],
          priority: "responsibility",
        },
      ],
      expectedCriticalRequirements: ["document recurring issues"],
      expectedSupportedKeywords: ["support issues"],
      expectedBlockedKeywords: [],
      expectedForbiddenPhrases: SHARED_FORBIDDEN,
      expectedFailureCodes: [
        "negative-ungrounded-paragraph:baseline:ungroundedParagraph",
      ],
      safeRoleTransitions: [],
      letters: sameLetter(
        [
          "Documented recurring support issues and routed escalations.",
          "I would bring energy, motivation, and a positive mindset to the team.",
        ].join("\n\n"),
      ),
    },
  ] satisfies ProposalQualityFixtureInput[]).map(withFixtureMetadata);
