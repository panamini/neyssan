import { z } from "zod";

import type { ProposalOutputLanguage } from "./proposalOutput";
import { normalizeProposalConstraintText } from "./proposalPlanner";
import { ENGLISH_SALUTATION, FRENCH_SALUTATION } from "./proposalRenderer";
import type { ProposalVoicePreset } from "./voicePresets";

export type PremiumCoverLetterContextClass =
  | "cv_direct"
  | "cv_adjacent"
  | "no_cv";
export type PremiumCoverLetterPreset = Extract<
  ProposalVoicePreset,
  "signature" | "expert" | "engaging"
>;
export type PremiumCoverLetterWriterModel = "gpt-5.4" | "gpt-5-mini";

export type AllowedFact = {
  text: string;
  source: "cv" | "job_post" | "system_inference";
  confidence: "high" | "medium";
  category:
    | "achievement"
    | "responsibility"
    | "tool"
    | "domain"
    | "trait"
    | "workflow"
    | "transfer_signal"
    | "job_context";
};

export type AllowedFactsPack = {
  facts: AllowedFact[];
};

export type JobOfferPriorityPack = {
  coreResponsibilities: string[];
  keyRequirements: string[];
  preferredQualifications: string[];
  lowValueChecklist: string[];
  companyFluff: string[];
  priorityTokens: string[];
};

export type RankedEvidencePack = {
  strongestEvidence: AllowedFact[];
  supportingEvidence: AllowedFact[];
  secondaryQualifications: AllowedFact[];
  transferCore: AllowedFact[];
  weakOrDoNotLeadWith: AllowedFact[];
};

export type CoverLetterBrief = {
  language: string;
  preset: PremiumCoverLetterPreset;
  contextClass: PremiumCoverLetterContextClass;
  candidateEvidenceAvailable: boolean;
  targetRole: string;
  employerName?: string;
  topEvidence: string[];
  supportEvidence: string[];
  transferCore?: string[];
  topResponsibilities?: string[];
  keyRequirements?: string[];
  preferredQualifications?: string[];
  lowValueChecklist?: string[];
  workContext?: string[];
  requiredMoves: string[];
  forbiddenMoves: string[];
};

export type CoverLetterBodyParts = {
  opening: string;
  proofBlock: string;
  employerValueBlock: string;
  closeLine: string;
};

export type PremiumCoverLetterGenerationResult = {
  bodyParts: CoverLetterBodyParts;
  mode: "direct" | "transfer" | "no_cv";
  evidenceUsed: string[];
  omittedWeakEvidence: string[];
};

export type PremiumCoverLetterPersonalizationContext = {
  name?: string;
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

export type PremiumCoverLetterEligibility = {
  eligible: boolean;
  contextClass?: PremiumCoverLetterContextClass;
  reason?:
    | "flag_disabled"
    | "missing_cv"
    | "preset_not_supported"
    | "unsupported_context_class"
    | "no_allowed_facts";
};

export type PremiumCoverLetterAttemptResult =
  PremiumCoverLetterGenerationResult & {
    content: string;
    sections: Array<{
      type: "text";
      content: string;
    }>;
    prompt: string;
    brief: CoverLetterBrief;
    contextClass: PremiumCoverLetterContextClass;
  };

export type PremiumCoverLetterWriter = (args: {
  prompt: string;
  schema: Record<string, unknown>;
}) => Promise<CoverLetterBodyParts>;

export const PREMIUM_COVER_LETTER_OPENAI_MODEL: PremiumCoverLetterWriterModel =
  "gpt-5.4";
export const PREMIUM_COVER_LETTER_WRITER_MODELS = [
  "gpt-5.4",
  "gpt-5-mini",
] as const satisfies readonly PremiumCoverLetterWriterModel[];
export const PREMIUM_COVER_LETTER_SUPPORTED_PRESETS = [
  "signature",
  "expert",
  "engaging",
] as const satisfies readonly PremiumCoverLetterPreset[];

export const PREMIUM_COVER_LETTER_REQUIRED_MOVES = [
  "opening positioning",
  "best available concrete proof should carry the case even when evidence is modest",
  "strongest proof first",
  "one additional concrete proof or operating detail when available",
  "employer-facing value tied to actual work context rather than requirement-listing",
  "short close-body line",
] as const;

export const PREMIUM_COVER_LETTER_FORBIDDEN_MOVES = [
  "benefits attraction",
  "company admiration paragraph",
  "checklist summary",
  "job-post tool repetition",
  "generic excited to join language",
  "unsupported direct-fit claims",
  "weak readiness language replacing proof",
  "paragraphs led by secondary qualifications when stronger evidence exists",
] as const;

export const PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA = z
  .object({
    opening: z.string(),
    proofBlock: z.string(),
    employerValueBlock: z.string(),
    closeLine: z.string(),
  })
  .strict();

export const PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["opening", "proofBlock", "employerValueBlock", "closeLine"],
  properties: {
    opening: { type: "string" },
    proofBlock: { type: "string" },
    employerValueBlock: { type: "string" },
    closeLine: { type: "string" },
  },
} as const;

const MAX_CV_FACTS = 16;
const MAX_JOB_FACTS = 8;
const MAX_EVIDENCE_ITEMS = 3;
const MAX_SUPPORT_ITEMS = 2;
const MAX_TRANSFER_ITEMS = 2;
const MAX_WORK_CONTEXT_ITEMS = 2;
const MAX_TOP_RESPONSIBILITIES = 3;
const MAX_KEY_REQUIREMENTS = 2;
const MAX_PREFERRED_QUALIFICATIONS = 2;
const MAX_LOW_VALUE_CHECKLIST_ITEMS = 5;

const TOKEN_CANONICALIZATION_RULES = [
  { pattern: /^admin(?:istrat(?:ion|ive|or|ors)?)$/, canonical: "admin" },
  {
    pattern: /^coordinat(?:e|ed|es|ing|ion|or|ors)$/,
    canonical: "coordinate",
  },
  {
    pattern: /^document(?:ation|ed|ing|s)?$/,
    canonical: "document",
  },
  { pattern: /^implement(?:ation|ed|ing|s|er|ers)?$/, canonical: "implement" },
  { pattern: /^manag(?:e|ed|es|ing|ement|er|ers)$/, canonical: "manage" },
  {
    pattern: /^operat(?:e|ed|es|ing|ion|ions|ional|or|ors)$/,
    canonical: "operate",
  },
  { pattern: /^record(?:ed|ing|s)?$/, canonical: "record" },
  { pattern: /^report(?:ed|ing|s)?$/, canonical: "report" },
  { pattern: /^schedul(?:e|ed|es|ing|er|ers)$/, canonical: "schedule" },
  { pattern: /^track(?:ed|ing|ers|er|s)?$/, canonical: "track" },
] as const;

const STOPWORDS = new Set([
  "about",
  "across",
  "after",
  "also",
  "and",
  "been",
  "between",
  "build",
  "built",
  "candidate",
  "clear",
  "close",
  "company",
  "cover",
  "create",
  "daily",
  "deliver",
  "described",
  "description",
  "details",
  "drive",
  "from",
  "have",
  "help",
  "into",
  "join",
  "lead",
  "more",
  "must",
  "need",
  "opportunity",
  "position",
  "professional",
  "proof",
  "role",
  "same",
  "show",
  "skills",
  "strong",
  "support",
  "team",
  "their",
  "this",
  "through",
  "used",
  "using",
  "value",
  "what",
  "with",
  "work",
  "worked",
  "working",
  "your",
]);

const ACHIEVEMENT_VERB_PATTERN =
  /\b(?:improv(?:e|ed|es|ing)|reduc(?:e|ed|es|ing)|increas(?:e|ed|es|ing)|grew|grown|boost(?:ed|ing)?|cut|sav(?:ed|ing)|deliver(?:ed|ing)|achiev(?:ed|ing)|drove|driven|expand(?:ed|ing)|optimiz(?:ed|ing)|streamlin(?:ed|ing)|accelerat(?:ed|ing)|surpass(?:ed|ing)|launched?)\b/i;
const QUANTIFIED_PATTERN =
  /(?:\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\s*(?:percent|points|hours|days|weeks|months|years|clients|projects|tickets|cases|units|stores|sites|teams|squads|markets|campaigns|experiments|deliverables)\b)/i;
const RESPONSIBILITY_PATTERN =
  /\b(?:led|managed|owned|oversaw|coordinated|handled|supervised|supported|built|developed|implemented|maintained|operated|executed|delivered|trained|documented|reviewed|monitored)\b/i;
const WORKFLOW_PATTERN =
  /\b(?:workflow|process|operations?|handoffs?|sla|qa|quality|ticket|queue|dashboard|reporting|experiments?|testing|revision|coordination|support|intake|triage|delivery|planning|collaboration)\b/i;
const TRAIT_PATTERN =
  /\b(?:reliable|adaptable|flexible|motivated|organized|detail-oriented|communicative|curious|proactive)\b/i;
const TOOL_PATTERN =
  /\b(?:excel|word|windows|powerpoint|google sheets|google docs|jira|salesforce|react|typescript|javascript|figma|sql|zendesk|hubspot|tableau|power bi)\b/i;
const COMPANY_ADMIRATION_PATTERN =
  /\b(?:admire|inspired by|excited to join|drawn to|particularly excited|impressed by|love the idea of|benefits?|perks|compensation|culture|mission statement|values-led)\b/i;
const COMPANY_FLUFF_PATTERN =
  /\b(?:benefits?|perks|compensation|culture|mission(?:-led)?|values?(?:-led)?|why join|join us|great place to work|package|growth opportunities|career growth)\b/i;
const WEAK_QUALIFICATION_PATTERN =
  /\b(?:excel|word|windows|basic english|basic french|language basics?|flexible|adaptable|ready to learn|quick learner|future certification|planned certification|in progress certification|willing to learn|motivated)\b/i;
const MUST_HAVE_REQUIREMENT_PATTERN =
  /\b(?:required|required experience|required qualification|required skill|must(?:\s+have)?|need(?:ed|s)?|seeking|looking for|ability to|experience (?:with|in)|strong\b|proven|background in|communication required|experience required)\b/i;
const PREFERRED_REQUIREMENT_PATTERN =
  /\b(?:preferred|a plus|is a plus|plus|nice to have|bonus|appreciated|ideally|helpful)\b/i;
const SECONDARY_QUALIFICATION_PATTERN =
  /\b(?:enough|basic|comfortable with|working knowledge|familiarity with|certification mindset)\b/i;
const LOW_VALUE_CHECKLIST_PATTERN =
  /\b(?:organized|reliable|adaptable|flexible|motivated|detail-oriented|willing to learn|ready to help|administrative support|microsoft word|microsoft excel|microsoft office)\b/i;
const JOB_OFFER_ACTION_VERB_PATTERN =
  /\b(?:lead|own|coordinate|track|manage|maintain|support|build|improve|drive|handle|answer|update|prepare|document|design|analy[sz]e|mentor|supervise|monitor|report|deliver|keep|develop|create|review|operate|collaborate|implement|schedule)\b/i;
const JOB_OFFER_ACTION_LED_PATTERN =
  /^(?:the\s+[^,]{0,80}?\b(?:will|should|must)\s+|this\s+(?:role|position)\s+(?:will|should|must)\s+)?(?:lead|own|coordinate|track|manage|maintain|support|build|improve|drive|handle|answer|update|prepare|document|design|analy[sz]e|mentor|supervise|monitor|report|deliver|keep|develop|create|review|operate|collaborate|implement|schedule)\b/i;
const JOB_OFFER_LIST_LEADER_PATTERN =
  /^(?:the\s+[^,]{0,80}?\b(?:will|should|must)\s+|this\s+(?:role|position)\s+(?:will|should|must)\s+|candidates?\s+should\s+(?:be\s+)?|we(?:'re| are)?\s+(?:hiring|looking for|seeking)\s+(?:a|an)?\s*[^,]{0,80}?\b(?:to|with)\s+)?(lead|own|coordinate|track|manage|maintain|support|build|improve|drive|handle|answer|update|prepare|document|design|analy[sz]e|mentor|supervise|monitor|report|deliver|keep|develop|create|review|operate|collaborate|implement|schedule|be)\b/i;
const JOB_OFFER_CAPABILITY_PATTERN =
  /\b(?:skills?|experience|background|knowledge|communication|certification|degree|license|tooling|systems?)\b/i;
const SIGNOFF_PATTERN =
  /^\s*(?:sincerely|kind regards|best regards|warm regards|cordialement|bien cordialement|respectfully)\s*,?\s*$/i;
const GREETING_PATTERN =
  /^\s*(?:dear\s+[^,]+|madame,\s*monsieur)\s*,?\s*$/i;
const DIRECT_FIT_PATTERN =
  /\b(?:direct experience|exact fit|perfect fit|already done this work|step into the role immediately|ready to perform the role from day one)\b/i;
const NO_CV_HISTORY_CLAIM_PATTERN =
  /\b(?:in previous roles?|at my previous|during my|my experience|my background|my experience includes|my background includes|i have worked with|i have managed|i worked(?: as| at)?|i served as|i led|i managed|i coordinated|i developed|i built|i improved|i delivered|i implemented|i maintained|i operated|i supervised|i trained|i documented|i reviewed|i monitored|i hold\b|i earned\b|i completed\b|i studied\b)\b/i;

function compactWhitespace(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const compact = compactWhitespace(value);
    if (!compact) continue;
    const key = normalizeProposalConstraintText(compact);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(compact);
  }
  return result;
}

function splitFactSnippets(value: string | null | undefined): string[] {
  const compact = compactWhitespace(value);
  if (!compact) return [];
  return dedupeStrings(
    compact
      .replace(/\r/g, "\n")
      .split(/\n+|(?<=[.!?])\s+|;\s+/)
      .map((part) => compactWhitespace(part)),
  );
}

function splitJobOfferClauses(value: string): string[] {
  const clauses = compactWhitespace(value)
    .replace(/\r/g, "\n")
    .split(/,\s+/)
    .map((clause) => compactWhitespace(clause.replace(/^and\s+/i, "")))
    .filter(Boolean);
  return clauses.length > 0 ? clauses : [compactWhitespace(value)];
}

function extractJobOfferLeaderVerb(clause: string): string | null {
  const match = compactWhitespace(clause).match(JOB_OFFER_LIST_LEADER_PATTERN);
  return match?.[1] ? match[1].toLowerCase() : null;
}

function normalizeJobOfferClause(
  clause: string,
  leaderVerb: string | null,
): string {
  let cleaned = compactWhitespace(
    clause
      .replace(/^[Aa]nd\s+/i, "")
      .replace(/^(?:[Cc]andidates?\s+should\s+(?:be\s+)?)/, "")
      .replace(/[.!?]$/u, ""),
  );
  if (!cleaned) return "";
  if (
    leaderVerb &&
    !JOB_OFFER_ACTION_VERB_PATTERN.test(cleaned) &&
    !isLowValueChecklist(cleaned) &&
    /^[a-z][a-z0-9/&+\-\s]{1,90}$/i.test(cleaned)
  ) {
    cleaned =
      leaderVerb === "be" && TOOL_PATTERN.test(cleaned)
        ? cleaned
        : `${leaderVerb} ${cleaned}`;
  }
  return ensureSentenceEnding(cleaned);
}

type JobOfferPriorityBucket =
  | "core_responsibility"
  | "key_requirement"
  | "preferred_qualification"
  | "low_value_checklist"
  | "company_fluff";

type JobOfferPriorityItem = {
  text: string;
  bucket: JobOfferPriorityBucket;
  score: number;
};

function isCompanyFluff(text: string): boolean {
  return (
    COMPANY_ADMIRATION_PATTERN.test(text) || COMPANY_FLUFF_PATTERN.test(text)
  );
}

function isLowValueChecklist(text: string): boolean {
  return (
    WEAK_QUALIFICATION_PATTERN.test(text) ||
    LOW_VALUE_CHECKLIST_PATTERN.test(text)
  );
}

function looksLikeCoreResponsibility(text: string): boolean {
  if (isLowValueChecklist(text) && !WORKFLOW_PATTERN.test(text)) {
    return false;
  }
  return (
    JOB_OFFER_ACTION_LED_PATTERN.test(text) ||
    RESPONSIBILITY_PATTERN.test(text) ||
    WORKFLOW_PATTERN.test(text)
  );
}

function scoreJobOfferPriorityItem(
  text: string,
  bucket: JobOfferPriorityBucket,
): number {
  let score = 0;
  switch (bucket) {
    case "core_responsibility":
      score += 120;
      break;
    case "key_requirement":
      score += 80;
      break;
    case "preferred_qualification":
      score += 36;
      break;
    case "low_value_checklist":
      score += 12;
      break;
    case "company_fluff":
      score += 0;
      break;
  }
  if (WORKFLOW_PATTERN.test(text)) score += 18;
  if (JOB_OFFER_ACTION_VERB_PATTERN.test(text) || RESPONSIBILITY_PATTERN.test(text))
    score += 16;
  if (JOB_OFFER_CAPABILITY_PATTERN.test(text)) score += 10;
  if (QUANTIFIED_PATTERN.test(text)) score += 8;
  if (TOOL_PATTERN.test(text) && !WORKFLOW_PATTERN.test(text)) score -= 18;
  if (isLowValueChecklist(text)) score -= 28;
  if (isCompanyFluff(text)) score -= 40;
  return score;
}

function classifyJobOfferPriorityBucket(
  text: string,
  fallbackBucket?: JobOfferPriorityBucket,
): JobOfferPriorityBucket {
  if (isCompanyFluff(text)) {
    return "company_fluff";
  }

  const preferred =
    PREFERRED_REQUIREMENT_PATTERN.test(text) ||
    (SECONDARY_QUALIFICATION_PATTERN.test(text) && TOOL_PATTERN.test(text));
  const lowValue = isLowValueChecklist(text);
  const coreResponsibility = looksLikeCoreResponsibility(text);
  const keyRequirement =
    MUST_HAVE_REQUIREMENT_PATTERN.test(text) || JOB_OFFER_CAPABILITY_PATTERN.test(text);

  if (preferred) {
    return lowValue ? "low_value_checklist" : "preferred_qualification";
  }
  if (!coreResponsibility && lowValue) {
    return "low_value_checklist";
  }
  if (coreResponsibility) {
    return "core_responsibility";
  }
  if (keyRequirement) {
    return lowValue ? "low_value_checklist" : "key_requirement";
  }
  if (fallbackBucket) {
    return fallbackBucket;
  }
  return lowValue ? "low_value_checklist" : "preferred_qualification";
}

export function buildJobOfferPriorityPack(
  jobDescription: string,
): JobOfferPriorityPack {
  const items: JobOfferPriorityItem[] = [];

  for (const snippet of splitFactSnippets(jobDescription)) {
    const sentenceBucket = classifyJobOfferPriorityBucket(snippet);
    if (sentenceBucket === "company_fluff") {
      items.push({
        text: ensureSentenceEnding(snippet),
        bucket: sentenceBucket,
        score: scoreJobOfferPriorityItem(snippet, sentenceBucket),
      });
      continue;
    }

    const clauses = splitJobOfferClauses(snippet);
    const leaderVerb = extractJobOfferLeaderVerb(clauses[0] ?? "");
    const candidates =
      clauses.length > 1
        ? clauses.map((clause) => normalizeJobOfferClause(clause, leaderVerb))
        : [ensureSentenceEnding(snippet)];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const bucket = classifyJobOfferPriorityBucket(candidate, sentenceBucket);
      items.push({
        text: candidate,
        bucket,
        score: scoreJobOfferPriorityItem(candidate, bucket),
      });
    }
  }

  const byBucket = (bucket: JobOfferPriorityBucket, limit: number): string[] =>
    dedupeStrings(
      items
        .filter((item) => item.bucket === bucket)
        .sort((left, right) => right.score - left.score)
        .map((item) => item.text),
    ).slice(0, limit);

  const coreResponsibilities = byBucket(
    "core_responsibility",
    MAX_TOP_RESPONSIBILITIES,
  );
  const keyRequirements = byBucket("key_requirement", MAX_KEY_REQUIREMENTS);
  const preferredQualifications = byBucket(
    "preferred_qualification",
    MAX_PREFERRED_QUALIFICATIONS,
  );
  const lowValueChecklist = byBucket(
    "low_value_checklist",
    MAX_LOW_VALUE_CHECKLIST_ITEMS,
  );
  const companyFluff = byBucket("company_fluff", 2);
  const priorityTokenSource =
    coreResponsibilities.length > 0 || keyRequirements.length > 0
      ? [...coreResponsibilities, ...keyRequirements]
      : preferredQualifications.length > 0
        ? preferredQualifications
        : splitFactSnippets(jobDescription);

  return {
    coreResponsibilities,
    keyRequirements,
    preferredQualifications,
    lowValueChecklist,
    companyFluff,
    priorityTokens: normalizeTokens(priorityTokenSource.join(" ")),
  };
}

function normalizeTokens(value: string): string[] {
  const tokens = compactWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));

  return Array.from(
    new Set(
      tokens.flatMap((token) => expandNormalizedTokenVariants(token)),
    ),
  );
}

function expandNormalizedTokenVariants(token: string): string[] {
  const variants = new Set<string>();
  if (token.length < 4 || STOPWORDS.has(token)) return [];

  variants.add(token);

  if (token.endsWith("ies") && token.length > 5) {
    variants.add(`${token.slice(0, -3)}y`);
  }

  for (const rule of TOKEN_CANONICALIZATION_RULES) {
    if (rule.pattern.test(token)) {
      variants.add(rule.canonical);
    }
  }

  return Array.from(variants).filter(
    (variant) => variant.length >= 4 && !STOPWORDS.has(variant),
  );
}

function countOverlap(a: string[], b: Set<string>): number {
  return a.reduce((count, token) => count + (b.has(token) ? 1 : 0), 0);
}

function hasSentenceEnding(value: string): boolean {
  return /[.!?]$/u.test(compactWhitespace(value));
}

function ensureSentenceEnding(value: string): string {
  const compact = compactWhitespace(value);
  if (!compact) return "";
  return hasSentenceEnding(compact) ? compact : `${compact}.`;
}

function splitSentences(value: string): string[] {
  const matches = compactWhitespace(value).match(/[^.!?\n]+(?:[.!?]+|$)/g);
  if (!matches) return [];
  return matches.map((sentence) => compactWhitespace(sentence)).filter(Boolean);
}

function joinSentences(sentences: string[]): string {
  return sentences.map((sentence) => ensureSentenceEnding(sentence)).join(" ");
}

function dedupeSentenceSequence(value: string): string {
  const sentences = splitSentences(value);
  if (sentences.length <= 1) {
    return ensureSentenceEnding(value);
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    const normalized = normalizeProposalConstraintText(sentence);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(sentence);
  }
  return joinSentences(result);
}

function stripGreetingAndSignoffLeakage(value: string): string {
  const lines = value
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => compactWhitespace(line))
    .filter(Boolean);
  return lines
    .map((line) =>
      compactWhitespace(
        line
          .replace(/^\s*dear\s+[^,]+,\s*/i, "")
          .replace(/^\s*madame,\s*monsieur,\s*/i, "")
          .replace(
            /^\s*(?:sincerely|kind regards|best regards|warm regards|cordialement|bien cordialement|respectfully)\s*,?\s*/i,
            "",
          ),
      ),
    )
    .filter(
      (line) => line && !GREETING_PATTERN.test(line) && !SIGNOFF_PATTERN.test(line),
    )
    .join(" ");
}

function classifyCvFactCategory(text: string, source: "cv" | "job_post"): AllowedFact["category"] {
  if (ACHIEVEMENT_VERB_PATTERN.test(text) && QUANTIFIED_PATTERN.test(text)) {
    return "achievement";
  }
  if (source === "job_post") {
    if (WORKFLOW_PATTERN.test(text)) return "workflow";
    if (TOOL_PATTERN.test(text)) return "tool";
    if (RESPONSIBILITY_PATTERN.test(text)) return "responsibility";
    return "job_context";
  }
  if (RESPONSIBILITY_PATTERN.test(text)) return "responsibility";
  if (WORKFLOW_PATTERN.test(text)) return "workflow";
  if (TOOL_PATTERN.test(text)) return "tool";
  if (TRAIT_PATTERN.test(text)) return "trait";
  return "domain";
}

function inferFactConfidence(
  text: string,
  source: AllowedFact["source"],
  category: AllowedFact["category"],
): AllowedFact["confidence"] {
  if (source === "system_inference") return "medium";
  if (category === "achievement" || category === "responsibility") return "high";
  if (source === "job_post") return "high";
  if (QUANTIFIED_PATTERN.test(text)) return "high";
  return "medium";
}

function buildCvFacts(
  context: PremiumCoverLetterPersonalizationContext | null,
): AllowedFact[] {
  if (!context) return [];
  const facts: AllowedFact[] = [];

  for (const summaryFact of splitFactSnippets(context.summary)) {
    const category = classifyCvFactCategory(summaryFact, "cv");
    facts.push({
      text: ensureSentenceEnding(summaryFact),
      source: "cv",
      confidence: inferFactConfidence(summaryFact, "cv", category),
      category,
    });
  }

  for (const skill of dedupeStrings(context.topSkills ?? [])) {
    const category = classifyCvFactCategory(skill, "cv");
    facts.push({
      text: ensureSentenceEnding(skill),
      source: "cv",
      confidence: "medium",
      category,
    });
  }

  for (const entry of context.recentExperience ?? []) {
    const roleFact = compactWhitespace(
      [entry.position, entry.company ? `at ${entry.company}` : ""]
        .filter(Boolean)
        .join(" "),
    );
    if (roleFact) {
      facts.push({
        text: ensureSentenceEnding(roleFact),
        source: "cv",
        confidence: "high",
        category: "domain",
      });
    }
    for (const highlight of entry.highlights ?? []) {
      for (const snippet of splitFactSnippets(highlight)) {
        const category = classifyCvFactCategory(snippet, "cv");
        facts.push({
          text: ensureSentenceEnding(snippet),
          source: "cv",
          confidence: inferFactConfidence(snippet, "cv", category),
          category,
        });
      }
    }
  }

  for (const achievement of context.standoutAchievements ?? []) {
    for (const snippet of splitFactSnippets(achievement)) {
      facts.push({
        text: ensureSentenceEnding(snippet),
        source: "cv",
        confidence: "high",
        category: classifyCvFactCategory(snippet, "cv"),
      });
    }
  }

  return dedupeFacts(facts).slice(0, MAX_CV_FACTS);
}

function buildJobPostFacts(jobDescription: string): AllowedFact[] {
  const facts: AllowedFact[] = [];
  for (const snippet of splitFactSnippets(jobDescription)) {
    if (!snippet || isCompanyFluff(snippet)) continue;
    const category = classifyCvFactCategory(snippet, "job_post");
    facts.push({
      text: ensureSentenceEnding(snippet),
      source: "job_post",
      confidence: inferFactConfidence(snippet, "job_post", category),
      category,
    });
  }
  return dedupeFacts(facts).slice(0, MAX_JOB_FACTS);
}

function buildWorkContextSnippets(jobPostFacts: AllowedFact[]): string[] {
  const snippets = jobPostFacts.flatMap((fact) => {
    const clauses = fact.text
      .replace(/\r/g, "\n")
      .split(/,\s+|(?:\s+and\s+)/i)
      .map((part) => compactWhitespace(part.replace(/[.!?]$/u, "")))
      .filter(Boolean);

    const operationalClauses = clauses.filter((clause) => {
      if (WEAK_QUALIFICATION_PATTERN.test(clause)) return false;
      if (COMPANY_ADMIRATION_PATTERN.test(clause)) return false;
      if (TOOL_PATTERN.test(clause) && !WORKFLOW_PATTERN.test(clause)) {
        return false;
      }
      return (
        RESPONSIBILITY_PATTERN.test(clause) ||
        WORKFLOW_PATTERN.test(clause) ||
        /\b(?:coordinate|track|manage|maintain|support|handle|schedule|document|report|follow(?:\s|-)?up|escalation|deliverables)\b/i.test(
          clause,
        )
      );
    });

    return operationalClauses.length > 0
      ? operationalClauses.map((clause) => ensureSentenceEnding(clause))
      : [];
  });

  return dedupeStrings(snippets).slice(0, MAX_WORK_CONTEXT_ITEMS);
}

function buildSystemInferenceFacts(
  systemInferenceHints: string[] | undefined,
): AllowedFact[] {
  const hints = dedupeStrings(systemInferenceHints ?? []);
  const facts: AllowedFact[] = [];
  for (const hint of hints) {
    const normalized = normalizeProposalConstraintText(hint);
    if (
      ACHIEVEMENT_VERB_PATTERN.test(hint) ||
      QUANTIFIED_PATTERN.test(hint) ||
      /\b(?:experience|responsib|managed|led|owned|certifi|degree|license)\b/i.test(
        normalized,
      )
    ) {
      continue;
    }
    if (
      /\b(?:adjacent|transfer|overlap|related workflow|similar operating context|nearby domain)\b/i.test(
        normalized,
      )
    ) {
      facts.push({
        text: ensureSentenceEnding(hint),
        source: "system_inference",
        confidence: "medium",
        category: "transfer_signal",
      });
    }
  }
  return dedupeFacts(facts);
}

function dedupeFacts(facts: AllowedFact[]): AllowedFact[] {
  const seen = new Set<string>();
  const result: AllowedFact[] = [];
  for (const fact of facts) {
    const key = `${fact.source}:${normalizeProposalConstraintText(fact.text)}`;
    if (!fact.text || seen.has(key)) continue;
    seen.add(key);
    result.push(fact);
  }
  return result;
}

function scoreFact(args: {
  fact: AllowedFact;
  jobTokens: Set<string>;
  jobTitleTokens: Set<string>;
}): number {
  const factTokens = normalizeTokens(args.fact.text);
  const overlap = countOverlap(factTokens, args.jobTokens);
  const titleOverlap = countOverlap(factTokens, args.jobTitleTokens);
  let score = 0;
  switch (args.fact.category) {
    case "achievement":
      score += 170;
      break;
    case "responsibility":
      score += 80;
      break;
    case "workflow":
      score += 68;
      break;
    case "domain":
      score += 42;
      break;
    case "tool":
      score += 42;
      break;
    case "trait":
      score += 24;
      break;
    case "transfer_signal":
      score += 14;
      break;
    case "job_context":
      score += 18;
      break;
  }
  if (QUANTIFIED_PATTERN.test(args.fact.text)) score += 80;
  if (RESPONSIBILITY_PATTERN.test(args.fact.text)) score += 15;
  if (WORKFLOW_PATTERN.test(args.fact.text)) score += 12;
  if (args.fact.confidence === "high") score += 8;
  score += overlap * 8;
  score += titleOverlap * 12;
  if (args.fact.source === "job_post") score -= 22;
  if (WEAK_QUALIFICATION_PATTERN.test(args.fact.text)) score -= 40;
  if (COMPANY_ADMIRATION_PATTERN.test(args.fact.text)) score -= 55;
  return score;
}

function isWeakOrDoNotLeadWith(fact: AllowedFact): boolean {
  return (
    fact.category === "trait" ||
    WEAK_QUALIFICATION_PATTERN.test(fact.text) ||
    COMPANY_ADMIRATION_PATTERN.test(fact.text)
  );
}

function isSecondaryQualification(fact: AllowedFact): boolean {
  return (
    fact.category === "tool" ||
    fact.category === "trait" ||
    WEAK_QUALIFICATION_PATTERN.test(fact.text)
  );
}

function extractEmployerName(jobTitle: string, jobDescription: string): string | undefined {
  const candidate = (
    jobTitle.match(/\bat\s+([A-Z][\w&'.-]+(?:\s+[A-Z][\w&'.-]+){0,3})/)?.[1] ??
    jobDescription.match(/\b(?:join|at)\s+([A-Z][\w&'.-]+(?:\s+[A-Z][\w&'.-]+){0,3})/)?.[1]
  )?.trim();
  return candidate ? compactWhitespace(candidate) : undefined;
}

function resolveCloseFallback(language: string): string {
  return language === "French"
    ? "Je serais disponible pour échanger davantage au sujet du poste."
    : "I would welcome the opportunity to discuss the role further.";
}

export function isPremiumCoverLetterPreset(
  preset: ProposalVoicePreset,
): preset is PremiumCoverLetterPreset {
  return PREMIUM_COVER_LETTER_SUPPORTED_PRESETS.includes(
    preset as PremiumCoverLetterPreset,
  );
}

export function resolvePremiumCoverLetterWriterModel(
  rawValue:
    | string
    | undefined = process.env.COVER_LETTER_PREMIUM_WRITER_MODEL,
): PremiumCoverLetterWriterModel {
  const normalized = compactWhitespace(rawValue ?? "");
  return PREMIUM_COVER_LETTER_WRITER_MODELS.includes(
    normalized as PremiumCoverLetterWriterModel,
  )
    ? (normalized as PremiumCoverLetterWriterModel)
    : PREMIUM_COVER_LETTER_OPENAI_MODEL;
}

export function isCoverLetterPremiumPathV1Enabled(
  rawValue:
    | string
    | undefined = process.env.cover_letter_premium_path_v1 ??
    process.env.COVER_LETTER_PREMIUM_PATH_V1 ??
    process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1,
): boolean {
  const normalized = compactWhitespace(rawValue ?? "").toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

export function evaluatePremiumCoverLetterEligibility(args: {
  personalizationContext: PremiumCoverLetterPersonalizationContext | null;
  voicePreset: ProposalVoicePreset;
  jobTitle: string;
  jobDescription: string;
}): PremiumCoverLetterEligibility {
  if (!isPremiumCoverLetterPreset(args.voicePreset)) {
    return { eligible: false, reason: "preset_not_supported" };
  }
  const contextClass = inferPremiumCoverLetterContextClass({
    personalizationContext: args.personalizationContext,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
  });
  if (!contextClass) {
    return { eligible: false, reason: "unsupported_context_class" };
  }
  const allowedFactsPack = buildAllowedFactsPack({
    personalizationContext: args.personalizationContext,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
  });
  const rankedEvidencePack = rankAllowedFacts({
    allowedFactsPack,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    contextClass,
  });
  if (rankedEvidencePack.strongestEvidence.length === 0) {
    return {
      eligible: false,
      contextClass,
      reason: "no_allowed_facts",
    };
  }
  return { eligible: true, contextClass };
}

export function inferPremiumCoverLetterContextClass(args: {
  personalizationContext: PremiumCoverLetterPersonalizationContext | null;
  jobTitle: string;
  jobDescription: string;
}): PremiumCoverLetterContextClass | null {
  const cvFacts = buildCvFacts(args.personalizationContext);
  if (cvFacts.length === 0) {
    const jobOfferPriorityPack = buildJobOfferPriorityPack(args.jobDescription);
    if (
      jobOfferPriorityPack.coreResponsibilities.length > 0 ||
      jobOfferPriorityPack.keyRequirements.length > 0
    ) {
      return "no_cv";
    }

    const fallbackJobFacts = buildJobPostFacts(args.jobDescription).filter(
      (fact) =>
        !isWeakOrDoNotLeadWith(fact) &&
        (fact.category === "responsibility" ||
          fact.category === "workflow" ||
          fact.category === "job_context" ||
          fact.category === "domain"),
    );
    return fallbackJobFacts.length > 0 ? "no_cv" : null;
  }
  const jobOfferPriorityPack = buildJobOfferPriorityPack(args.jobDescription);
  const jobTitleTokens = new Set(normalizeTokens(args.jobTitle));
  const jobTokens = new Set([
    ...jobTitleTokens,
    ...(jobOfferPriorityPack.priorityTokens.length > 0
      ? jobOfferPriorityPack.priorityTokens
      : normalizeTokens(args.jobDescription)),
  ]);
  const matchedJobTokens = new Set<string>();
  const matchedTitleTokens = new Set<string>();
  for (const fact of cvFacts) {
    const factTokens = normalizeTokens(fact.text);
    for (const token of factTokens) {
      if (jobTokens.has(token)) matchedJobTokens.add(token);
      if (jobTitleTokens.has(token)) matchedTitleTokens.add(token);
    }
  }
  const totalOverlap = matchedJobTokens.size;
  const titleOverlap = matchedTitleTokens.size;
  if (titleOverlap >= 2 || (titleOverlap >= 1 && totalOverlap >= 5)) {
    return "cv_direct";
  }
  if (totalOverlap >= 2) {
    return "cv_adjacent";
  }
  return null;
}

export function buildAllowedFactsPack(args: {
  personalizationContext: PremiumCoverLetterPersonalizationContext | null;
  jobTitle: string;
  jobDescription: string;
  systemInferenceHints?: string[];
}): AllowedFactsPack {
  return {
    facts: dedupeFacts([
      ...buildCvFacts(args.personalizationContext),
      ...buildJobPostFacts(args.jobDescription),
      ...buildSystemInferenceFacts(args.systemInferenceHints),
    ]),
  };
}

export function rankAllowedFacts(args: {
  allowedFactsPack: AllowedFactsPack;
  jobTitle: string;
  jobDescription: string;
  contextClass: PremiumCoverLetterContextClass;
}): RankedEvidencePack {
  const jobOfferPriorityPack = buildJobOfferPriorityPack(args.jobDescription);
  const jobTitleTokens = new Set(normalizeTokens(args.jobTitle));
  const jobTokens = new Set([
    ...jobTitleTokens,
    ...(jobOfferPriorityPack.priorityTokens.length > 0
      ? jobOfferPriorityPack.priorityTokens
      : normalizeTokens(args.jobDescription)),
  ]);
  const scored = args.allowedFactsPack.facts
    .map((fact) => ({
      fact,
      score: scoreFact({ fact, jobTokens, jobTitleTokens }),
    }))
    .sort((a, b) => b.score - a.score);

  const strongestEvidence: AllowedFact[] = [];
  const supportingEvidence: AllowedFact[] = [];
  const secondaryQualifications: AllowedFact[] = [];
  const weakOrDoNotLeadWith: AllowedFact[] = [];
  const transferCore: AllowedFact[] = [];

  for (const { fact } of scored) {
    if (isWeakOrDoNotLeadWith(fact)) {
      weakOrDoNotLeadWith.push(fact);
      if (isSecondaryQualification(fact)) {
        secondaryQualifications.push(fact);
      }
      continue;
    }

    if (isSecondaryQualification(fact)) {
      secondaryQualifications.push(fact);
      continue;
    }

    if (
      args.contextClass === "no_cv" &&
      fact.source === "job_post" &&
      strongestEvidence.length < MAX_EVIDENCE_ITEMS &&
      (fact.category === "responsibility" ||
        fact.category === "workflow" ||
        fact.category === "job_context" ||
        fact.category === "domain")
    ) {
      strongestEvidence.push(fact);
      continue;
    }

    if (
      args.contextClass !== "no_cv" &&
      fact.source === "cv" &&
      strongestEvidence.length < MAX_EVIDENCE_ITEMS &&
      (fact.category === "achievement" ||
        fact.category === "responsibility" ||
        fact.category === "workflow" ||
        fact.category === "domain")
    ) {
      strongestEvidence.push(fact);
      continue;
    }

    if (
      args.contextClass === "no_cv" &&
      fact.source === "job_post" &&
      supportingEvidence.length < MAX_SUPPORT_ITEMS &&
      fact.category !== "tool"
    ) {
      supportingEvidence.push(fact);
      continue;
    }

    if (
      args.contextClass !== "no_cv" &&
      fact.source === "cv" &&
      supportingEvidence.length < MAX_SUPPORT_ITEMS &&
      fact.category !== "transfer_signal"
    ) {
      supportingEvidence.push(fact);
      continue;
    }
  }

  if (args.contextClass === "cv_adjacent") {
    const transferCandidates = scored
      .map((entry) => entry.fact)
      .filter(
        (fact) =>
          fact.source === "cv" &&
          !isWeakOrDoNotLeadWith(fact) &&
          (fact.category === "achievement" ||
            fact.category === "responsibility" ||
            fact.category === "workflow" ||
            fact.category === "domain"),
      );
    transferCore.push(...transferCandidates.slice(0, MAX_TRANSFER_ITEMS));
  }

  return {
    strongestEvidence,
    supportingEvidence,
    secondaryQualifications: dedupeFacts(secondaryQualifications),
    transferCore: dedupeFacts(transferCore),
    weakOrDoNotLeadWith: dedupeFacts(weakOrDoNotLeadWith),
  };
}

export function buildPremiumCoverLetterBrief(args: {
  preset: PremiumCoverLetterPreset;
  outputLanguage: ProposalOutputLanguage;
  jobTitle: string;
  jobDescription: string;
  contextClass: PremiumCoverLetterContextClass;
  allowedFactsPack: AllowedFactsPack;
  rankedEvidencePack: RankedEvidencePack;
}): CoverLetterBrief {
  const jobOfferPriorityPack = buildJobOfferPriorityPack(args.jobDescription);
  const jobPostFacts = args.allowedFactsPack.facts
    .filter(
      (fact) =>
        fact.source === "job_post" &&
        fact.category !== "trait" &&
        !isCompanyFluff(fact.text),
    );
  const workContext =
    jobOfferPriorityPack.coreResponsibilities.slice(0, MAX_WORK_CONTEXT_ITEMS);
  const fallbackWorkContext =
    workContext.length > 0 ? workContext : buildWorkContextSnippets(jobPostFacts);

  return {
    language: args.outputLanguage,
    preset: args.preset,
    contextClass: args.contextClass,
    candidateEvidenceAvailable: args.contextClass !== "no_cv",
    targetRole: compactWhitespace(args.jobTitle),
    employerName: extractEmployerName(args.jobTitle, args.jobDescription),
    topEvidence: args.rankedEvidencePack.strongestEvidence
      .slice(0, MAX_EVIDENCE_ITEMS)
      .map((fact) => fact.text),
    supportEvidence: args.rankedEvidencePack.supportingEvidence
      .slice(0, MAX_SUPPORT_ITEMS)
      .map((fact) => fact.text),
    ...(args.contextClass === "cv_adjacent"
      ? {
          transferCore: args.rankedEvidencePack.transferCore
            .slice(0, MAX_TRANSFER_ITEMS)
            .map((fact) => fact.text),
        }
      : {}),
    ...(jobOfferPriorityPack.coreResponsibilities.length > 0
      ? {
          topResponsibilities: jobOfferPriorityPack.coreResponsibilities.slice(
            0,
            MAX_TOP_RESPONSIBILITIES,
          ),
        }
      : {}),
    ...(jobOfferPriorityPack.keyRequirements.length > 0
      ? {
          keyRequirements: jobOfferPriorityPack.keyRequirements.slice(
            0,
            MAX_KEY_REQUIREMENTS,
          ),
        }
      : {}),
    ...(jobOfferPriorityPack.preferredQualifications.length > 0
      ? {
          preferredQualifications:
            jobOfferPriorityPack.preferredQualifications.slice(
              0,
              MAX_PREFERRED_QUALIFICATIONS,
            ),
        }
      : {}),
    ...(jobOfferPriorityPack.lowValueChecklist.length > 0
      ? {
          lowValueChecklist: jobOfferPriorityPack.lowValueChecklist.slice(
            0,
            MAX_LOW_VALUE_CHECKLIST_ITEMS,
          ),
        }
      : {}),
    ...(fallbackWorkContext.length > 0 ? { workContext: fallbackWorkContext } : {}),
    requiredMoves: [...PREMIUM_COVER_LETTER_REQUIRED_MOVES],
    forbiddenMoves: [...PREMIUM_COVER_LETTER_FORBIDDEN_MOVES],
  };
}

export function buildPremiumCoverLetterPrompt(args: {
  brief: CoverLetterBrief;
}): string {
  const presetGuidance = resolvePremiumCoverLetterPresetGuidance(
    args.brief.preset,
  );
  const { requiredMoves, forbiddenMoves, ...structuredBrief } = args.brief;
  const contextGuidance =
    args.brief.contextClass === "cv_adjacent"
      ? [
          "For cv_adjacent, keep the transfer honest and concrete; phrase the link as what this background helps with in the role's actual work, not as a generalized explanation of fit or a claim of direct target-role experience.",
          "For cv_adjacent, translate adjacent workflow evidence into role value without implying the candidate has already done the target role itself.",
        ]
      : args.brief.contextClass === "no_cv"
        ? [
            "For no_cv, there is no supported candidate history. Use job-offer work surfaces not prior history.",
            "For no_cv, stay in first person and sound like a candidate, not a role summary or memo; vary the opening and avoid repeated stems like 'I am drawn to work...', 'I am applying... with a clear focus on...', 'This role centers on...', or 'The highest-value work...'.",
            "For no_cv, do not claim prior roles, achievements, credentials, tool usage, readiness, or impact; keep employerValueBlock on operational consequence and closeLine on modest first-person ownership.",
            "For no_cv, ground opening and proof in concrete role priorities.",
          ]
        : [];
  return [
    "You write premium employment cover-letter body parts.",
    "Use only the brief facts. Do not invent experience, responsibilities, achievements, credentials, or compensating evidence.",
    "Prioritize strongest evidence first. If evidence is modest, let the best available concrete proof carry the case.",
    "Do not lead with secondary qualifications when stronger evidence exists.",
    "Do not spend body space on admiration, benefits attraction, checklist summaries, generic enthusiasm, or tool repetition.",
    "Treat topResponsibilities as the employer-side priority order. Use keyRequirements only when they sharpen those responsibilities, and keep preferredQualifications or lowValueChecklist out of the lead.",
    "Preset affects rhetorical texture only. It must not change truthfulness, claim strength, or evidence priority.",
    "Across cv_direct and cv_adjacent modes, sound like a person making a case in a letter, not a memo explaining why the evidence is relevant.",
    presetGuidance,
    ...contextGuidance,
    "Return exactly one JSON object with this schema and no extra text:",
    JSON.stringify({
      opening: "string",
      proofBlock: "string",
      employerValueBlock: "string",
      closeLine: "string",
    }),
    "Body-part rules: complete natural sentences only; no greeting, signoff, signature, markdown, or bullets.",
    "Opening: position through the strongest relevant evidence, not generic fit language.",
    "ProofBlock: develop the top evidence first, then add one supporting concrete detail when available.",
    "EmployerValueBlock: move directly to an employer-facing implication — what cleaner, faster, or more reliable looks like when this evidence is applied in this specific role. Write it as a natural continuation of the proof, not as a step back to explain why the proof matters. Use topResponsibilities before requirements. Never echo preferredQualifications or checklist noise.",
    "CloseLine: one short forward-looking sentence that is role-specific and situational — it can reference a concrete next step, a specific contribution, or a detail from the operating context of this role. Vary the shape each time.",
    "Banned openers for any block: 'That combination', 'Applied to', 'Applied in', 'Applied here', 'That kind of', 'That background'. Banned close stems: 'I would welcome the chance to', \"I'd welcome the chance to\", 'I would bring that same', 'I would bring that level'.",
    `Structured brief: ${JSON.stringify(structuredBrief)}`,
  ].join("\n");
}

function resolvePremiumCoverLetterPresetGuidance(
  preset: PremiumCoverLetterPreset,
): string {
  switch (preset) {
    case "expert":
      return "Preset contract for expert: compact, professional, and controlled; when the brief supports it, make one precise employer-facing observation about what controlled execution produces for this specific role — embedded in natural letter prose, not delivered as a stand-alone analytical sentence.";
    case "engaging":
      return "Preset contract for engaging: warmer but restrained; let one grounded sentence show who benefits when coordination, reporting, service, or follow-through are done well, using team, stakeholder, customer, guest, vendor, or user context when the brief supports it; avoid neutral template lead-ins such as a flat relevance summary, and keep the warmth concrete rather than enthusiastic.";
    case "signature":
    default:
      return "Preset contract for signature: professional, warm, personal, concise, and stable; make the opening sound like direct first-person professional positioning, then let the next movement continue naturally from the evidence — do not step back into an abstract relevance sentence, and do not let it read like colder expert analysis or a minimal shell.";
  }
}

type PremiumBodyPartValidationIssue = {
  code:
    | "missing_field"
    | "incomplete_sentence"
    | "greeting_leakage"
    | "signoff_leakage"
    | "adjacent_direct_fit"
    | "no_cv_history_claim"
    | "duplicate_close_line";
  repairable: boolean;
};

export type PremiumCoverLetterFailureTrace = {
  stage: "eligibility" | "ranking" | "validation";
  reason:
    | "ineligible"
    | "no_strongest_evidence"
    | "non_repairable_validation"
    | "repair_failed_validation";
  contextClass?: PremiumCoverLetterContextClass;
  eligibilityReason?: PremiumCoverLetterEligibility["reason"];
  issues?: PremiumBodyPartValidationIssue["code"][];
};

function summarizeValidationIssueCodes(
  issues: PremiumBodyPartValidationIssue[],
): PremiumBodyPartValidationIssue["code"][] {
  return Array.from(new Set(issues.map((issue) => issue.code)));
}

export function validatePremiumCoverLetterBodyParts(args: {
  bodyParts: CoverLetterBodyParts;
  brief: CoverLetterBrief;
}): PremiumBodyPartValidationIssue[] {
  const bodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(args.bodyParts);
  const issues: PremiumBodyPartValidationIssue[] = [];
  const values = Object.values(bodyParts);
  for (const value of values) {
    const compact = compactWhitespace(value);
    if (!compact) {
      issues.push({ code: "missing_field", repairable: true });
      continue;
    }
    if (GREETING_PATTERN.test(compact)) {
      issues.push({ code: "greeting_leakage", repairable: true });
    }
    if (SIGNOFF_PATTERN.test(compact)) {
      issues.push({ code: "signoff_leakage", repairable: true });
    }
    if (!hasSentenceEnding(compact)) {
      issues.push({ code: "incomplete_sentence", repairable: true });
    }
    if (
      args.brief.contextClass === "cv_adjacent" &&
      (DIRECT_FIT_PATTERN.test(compact) ||
        new RegExp(
          `\\b(?:as|worked\\s+as|experience\\s+as)\\s+(?:a|an|the)?\\s*${args.brief.targetRole
            .split(/\s+/)
            .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("\\s+")}\\b`,
          "i",
        ).test(compact))
    ) {
      issues.push({ code: "adjacent_direct_fit", repairable: false });
    }
    if (
      args.brief.contextClass === "no_cv" &&
      NO_CV_HISTORY_CLAIM_PATTERN.test(compact)
    ) {
      issues.push({ code: "no_cv_history_claim", repairable: false });
    }
  }

  const normalizedEmployerValue = normalizeProposalConstraintText(
    bodyParts.employerValueBlock,
  );
  const normalizedClose = normalizeProposalConstraintText(bodyParts.closeLine);
  if (normalizedEmployerValue && normalizedClose) {
    const employerValueSentences = splitSentences(bodyParts.employerValueBlock).map(
      (sentence) => normalizeProposalConstraintText(sentence),
    );
    if (employerValueSentences.includes(normalizedClose)) {
      issues.push({ code: "duplicate_close_line", repairable: true });
    }
  }

  return issues;
}

export function repairPremiumCoverLetterBodyParts(args: {
  bodyParts: CoverLetterBodyParts;
  brief: CoverLetterBrief;
}): CoverLetterBodyParts {
  const cleaned: CoverLetterBodyParts = {
    opening: dedupeSentenceSequence(
      stripGreetingAndSignoffLeakage(args.bodyParts.opening),
    ),
    proofBlock: dedupeSentenceSequence(
      stripGreetingAndSignoffLeakage(args.bodyParts.proofBlock),
    ),
    employerValueBlock: dedupeSentenceSequence(
      stripGreetingAndSignoffLeakage(args.bodyParts.employerValueBlock),
    ),
    closeLine: dedupeSentenceSequence(
      stripGreetingAndSignoffLeakage(args.bodyParts.closeLine),
    ),
  };

  if (!compactWhitespace(cleaned.employerValueBlock)) {
    const workContext = args.brief.workContext?.[0];
    cleaned.employerValueBlock = ensureSentenceEnding(
      workContext
        ? args.brief.contextClass === "cv_adjacent"
          ? `The role's focus on ${workContext.replace(/[.!?]$/u, "")} is where this background is most relevant`
          : args.brief.contextClass === "no_cv"
            ? `The role's focus on ${workContext.replace(/[.!?]$/u, "")} is the clearest signal of where careful, consistent work matters most`
          : `The role's focus on ${workContext.replace(/[.!?]$/u, "")} matches the work reflected in this background`
        : args.brief.contextClass === "no_cv"
          ? "The work described in the role is the clearest signal of where careful, consistent work matters most"
          : "The work described in the role is where this background is most relevant",
    );
  }

  if (!compactWhitespace(cleaned.closeLine)) {
    cleaned.closeLine = resolveCloseFallback(args.brief.language);
  }

  const closeSentences = splitSentences(cleaned.closeLine).map((sentence) =>
    normalizeProposalConstraintText(sentence),
  );
  const employerValueSentences = splitSentences(cleaned.employerValueBlock);
  cleaned.employerValueBlock = joinSentences(
    employerValueSentences.filter(
      (sentence) =>
        !closeSentences.includes(normalizeProposalConstraintText(sentence)),
    ),
  );

  return {
    opening: ensureSentenceEnding(cleaned.opening),
    proofBlock: ensureSentenceEnding(cleaned.proofBlock),
    employerValueBlock: ensureSentenceEnding(cleaned.employerValueBlock),
    closeLine: ensureSentenceEnding(cleaned.closeLine),
  };
}

export function renderPremiumCoverLetter(args: {
  bodyParts: CoverLetterBodyParts;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
}): { content: string; sections: Array<{ type: "text"; content: string }> } {
  const signoff =
    args.outputLanguage === "French" ? "Cordialement," : "Sincerely,";
  const salutation =
    args.outputLanguage === "French"
      ? FRENCH_SALUTATION
      : ENGLISH_SALUTATION;
  const bodyParagraphs = [
    args.bodyParts.opening,
    args.bodyParts.proofBlock,
    args.bodyParts.employerValueBlock,
    args.bodyParts.closeLine,
  ]
    .map((part) => ensureSentenceEnding(compactWhitespace(part)))
    .filter(Boolean);

  const lines = [
    salutation,
    "",
    ...bodyParagraphs.flatMap((paragraph, index) =>
      index === bodyParagraphs.length - 1 ? [paragraph] : [paragraph, ""],
    ),
    "",
    signoff,
    ...(compactWhitespace(args.candidateName) ? [compactWhitespace(args.candidateName)] : []),
  ];
  const content = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    content,
    sections: [{ type: "text", content }],
  };
}

export async function generatePremiumCoverLetterBodyPartsWithOpenAI(args: {
  apiKey: string;
  prompt: string;
  writerModel?: PremiumCoverLetterWriterModel;
}): Promise<CoverLetterBodyParts> {
  const resolvedModel = resolvePremiumCoverLetterWriterModel(args.writerModel);
  const requestBody = buildPremiumCoverLetterOpenAIRequest({
    prompt: args.prompt,
    writerModel: resolvedModel,
  });

  const openaiModule: any = await import("openai").catch(() => null);
  const OpenAI = openaiModule?.default ?? openaiModule?.OpenAI ?? null;
  if (OpenAI) {
    const client = new OpenAI({ apiKey: args.apiKey });
    const zodHelperModule: any = await import("openai/helpers/zod").catch(
      () => null,
    );
    const zodTextFormat = zodHelperModule?.zodTextFormat ?? null;

    if (typeof client.responses?.parse === "function" && zodTextFormat) {
      const response = await client.responses.parse({
        model: resolvedModel,
        input: args.prompt,
        text: {
          format: zodTextFormat(
            PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA,
            "cover_letter_body_parts",
          ),
        },
      } as any);

      return PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
        response?.output_parsed ?? extractOpenAIJsonPayload(response),
      );
    }

    const response = await client.responses.create(requestBody as any);
    return PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
      extractOpenAIJsonPayload(response),
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    throw new Error(
      `OpenAI premium cover-letter request failed: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }
  return PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
    extractOpenAIJsonPayload(await response.json()),
  );
}

export function buildPremiumCoverLetterOpenAIRequest(args: {
  prompt: string;
  writerModel?: PremiumCoverLetterWriterModel;
}) {
  return {
    model: resolvePremiumCoverLetterWriterModel(args.writerModel),
    input: args.prompt,
    text: {
      format: {
        type: "json_schema",
        name: "cover_letter_body_parts",
        schema: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
        strict: true,
        json_schema: {
          name: "cover_letter_body_parts",
          schema: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
          strict: true,
        },
      },
    },
  };
}

export function extractOpenAIJsonPayload(response: any): unknown {
  if (response?.output_parsed && typeof response.output_parsed === "object") {
    return response.output_parsed;
  }

  const contentArrays = [
    ...(Array.isArray(response?.output) ? response.output : []),
    ...(Array.isArray(response?.outputs) ? response.outputs : []),
  ]
    .flatMap((entry: any) =>
      Array.isArray(entry?.content) ? entry.content : entry ? [entry] : [],
    )
    .filter(Boolean);

  for (const item of contentArrays) {
    if (item?.json && typeof item.json === "object") {
      return item.json;
    }
    if (item?.parsed && typeof item.parsed === "object") {
      return item.parsed;
    }
    if (typeof item?.text === "string") {
      try {
        return JSON.parse(item.text);
      } catch {
        // Keep scanning: some envelopes include plain text alongside parseable content.
      }
    }
    if (typeof item?.output_text === "string") {
      try {
        return JSON.parse(item.output_text);
      } catch {
        // Keep scanning: some envelopes include plain text alongside parseable content.
      }
    }
  }

  if (typeof response?.output_text === "string") {
    try {
      return JSON.parse(response.output_text);
    } catch {
      // Fall through to other extraction attempts.
    }
  }

  const chatContent =
    response?.choices?.[0]?.message?.content ??
    response?.full_response?.choices?.[0]?.message?.content ??
    null;
  if (typeof chatContent === "string") {
    try {
      return JSON.parse(chatContent);
    } catch {
      // Fall through to the fenced JSON scan below.
    }
  }

  const serialized = JSON.stringify(response);
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(serialized);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]);
  }
  throw new Error("Premium cover-letter response did not contain parsed JSON");
}

export async function attemptPremiumCoverLetterGeneration(args: {
  personalizationContext: PremiumCoverLetterPersonalizationContext | null;
  voicePreset: ProposalVoicePreset;
  outputLanguage: ProposalOutputLanguage;
  jobTitle: string;
  jobDescription: string;
  candidateName?: string;
  systemInferenceHints?: string[];
  writer: PremiumCoverLetterWriter;
  onFailure?: (failure: PremiumCoverLetterFailureTrace) => void;
}): Promise<PremiumCoverLetterAttemptResult | null> {
  const eligibility = evaluatePremiumCoverLetterEligibility({
    personalizationContext: args.personalizationContext,
    voicePreset: args.voicePreset,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
  });
  if (!eligibility.eligible || !eligibility.contextClass) {
    args.onFailure?.({
      stage: "eligibility",
      reason: "ineligible",
      eligibilityReason: eligibility.reason,
    });
    return null;
  }
  const contextClass = eligibility.contextClass;

  const allowedFactsPack = buildAllowedFactsPack({
    personalizationContext: args.personalizationContext,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    systemInferenceHints: args.systemInferenceHints,
  });
  const rankedEvidencePack = rankAllowedFacts({
    allowedFactsPack,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    contextClass,
  });

  if (rankedEvidencePack.strongestEvidence.length === 0) {
    args.onFailure?.({
      stage: "ranking",
      reason: "no_strongest_evidence",
      contextClass,
    });
    return null;
  }

  const brief = buildPremiumCoverLetterBrief({
    preset: args.voicePreset,
    outputLanguage: args.outputLanguage,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    contextClass,
    allowedFactsPack,
    rankedEvidencePack,
  });
  const prompt = buildPremiumCoverLetterPrompt({ brief });
  let bodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
    await args.writer({
      prompt,
      schema: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
    }),
  );

  let issues = validatePremiumCoverLetterBodyParts({ bodyParts, brief });
  if (issues.some((issue) => !issue.repairable)) {
    args.onFailure?.({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass,
      issues: summarizeValidationIssueCodes(issues),
    });
    return null;
  }
  if (issues.length > 0) {
    bodyParts = repairPremiumCoverLetterBodyParts({ bodyParts, brief });
    issues = validatePremiumCoverLetterBodyParts({ bodyParts, brief });
    if (issues.some((issue) => !issue.repairable) || issues.length > 0) {
      args.onFailure?.({
        stage: "validation",
        reason: "repair_failed_validation",
        contextClass,
        issues: summarizeValidationIssueCodes(issues),
      });
      return null;
    }
  }

  const rendered = renderPremiumCoverLetter({
    bodyParts,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });

  return {
    content: rendered.content,
    sections: rendered.sections,
    prompt,
    brief,
    contextClass,
    bodyParts,
    mode:
      contextClass === "cv_direct"
        ? "direct"
        : contextClass === "cv_adjacent"
          ? "transfer"
          : "no_cv",
    evidenceUsed: dedupeStrings([
      ...brief.topEvidence,
      ...brief.supportEvidence,
      ...(brief.transferCore ?? []),
    ]),
    omittedWeakEvidence: rankedEvidencePack.weakOrDoNotLeadWith.map(
      (fact) => fact.text,
    ),
  };
}
