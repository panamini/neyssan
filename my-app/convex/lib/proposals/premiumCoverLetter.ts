import { z } from "zod";

import { llmConfig } from "../../../config/llmConfig";
import {
  getDeterministicCopyLanguage,
  type ProposalOutputLanguage,
} from "./proposalOutput";
import {
  COVER_LETTER_ROLE_THESIS_PRIORITY_ORDER,
  normalizeProposalConstraintText,
} from "./proposalPlanner";
import { ENGLISH_SALUTATION, FRENCH_SALUTATION } from "./proposalRenderer";
import type { ProposalVoicePreset } from "./voicePresets";
import type { CompanyValuesPack } from "./companyValues";

export type PremiumCoverLetterContextClass =
  | "cv_direct"
  | "cv_adjacent"
  | "no_cv";
export type PremiumCoverLetterPreset = Extract<
  ProposalVoicePreset,
  "signature" | "expert" | "engaging"
>;
export type PremiumCoverLetterWriterModel = "gpt-5.5" | "gpt-5.4" | "gpt-5-mini";
export type PremiumCoverLetterWriterProvider =
  | "openai"
  | "mistral"
  | "qwen"
  | "unknown";

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
  companyValuesPack?: CompanyValuesPack;
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
  signal?: AbortSignal;
}) => Promise<CoverLetterBodyParts>;

export const PREMIUM_COVER_LETTER_OPENAI_MODEL: PremiumCoverLetterWriterModel =
  "gpt-5.5";
export const PREMIUM_COVER_LETTER_WRITER_MODELS = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5-mini",
] as const satisfies readonly PremiumCoverLetterWriterModel[];
export const PREMIUM_COVER_LETTER_SUPPORTED_PRESETS = [
  "signature",
  "expert",
  "engaging",
] as const satisfies readonly PremiumCoverLetterPreset[];

export const MISTRAL_PREMIUM_COVER_LETTER_ADAPTER = [
  "Provider adapter: Mistral",
  "",
  "Follow these rules literally.",
  "",
  "Priority order:",
  "1. Accuracy",
  "2. Source evidence",
  "3. Clear writing",
  "4. Persuasion",
  "",
  "Truth outranks fluency.",
  "CV evidence outranks job-description keywords.",
  "A safe short letter is better than an inflated impressive letter.",
  "",
  "Evidence zones:",
  "- Candidate facts = the only source for candidate claims.",
  "- Job facts = role requirements only.",
  "- Company context = secondary context only.",
  "",
  "Never transfer a job requirement into candidate experience.",
  "Never turn company context into personal motivation.",
  "Use job facts only to choose which CV-backed candidate facts are relevant.",
  "",
  "Before writing, internally classify each possible claim:",
  "- source-backed: directly supported by candidate facts",
  "- adjacent-safe: related to candidate facts, but not exact",
  "- unsupported: not supported by candidate facts",
  "",
  "Output only:",
  "- source-backed claims, stated plainly",
  "- adjacent-safe claims, stated with low-ownership language",
  "",
  "Omit unsupported claims.",
  "",
  "Do not output the classification, audit, chain-of-thought, citations, XML, markdown, or explanations.",
  "",
  "Verb accuracy rule:",
  "Use the candidate's actual CV verb when possible.",
  "If changing verbs, only move to an equal or lower-ownership verb.",
  "",
  "Do not upgrade verbs:",
  "- monitored ≠ managed",
  "- documented ≠ managed",
  "- reported ≠ resolved",
  "- protected ≠ led emergency response",
  "- assisted ≠ owned",
  "- supported ≠ led",
  "- partnered ≠ led unless candidate facts explicitly say led",
  "- maintained ≠ designed",
  "- contributed to ≠ owned",
  "- participated in ≠ directed",
  "",
  "High-ownership verbs are forbidden unless directly source-backed:",
  "- led",
  "- managed",
  "- owned",
  "- directed",
  "- oversaw",
  "- drove",
  "- transformed",
  "- spearheaded",
  "- resolved",
  "- designed",
  "- implemented",
  "",
  "If evidence is adjacent but not exact, use safer constructions:",
  "- supported",
  "- documented",
  "- monitored",
  "- reported",
  "- contributed to",
  "- partnered with",
  "- worked from the relevant side",
  "- brought exposure to",
  "- worked in environments where X mattered",
  "- maintained visibility over X",
  "- supported teams responsible for X",
  "- handled related documentation around X",
  "- reported changes, risks, or all-clear status related to X",
  "",
  "Credential rule:",
  "Never claim a credential, license, diploma, certification, framework, clearance, or formal qualification unless it appears in candidate facts.",
  "",
  "Forbidden unless directly source-backed by candidate facts:",
  "- valid driver's license",
  "- active driver's license",
  "- high school diploma",
  "- GED",
  "- bachelor's degree",
  "- master's degree",
  "- certification",
  "- clearance",
  "- HIPAA",
  "- OSHA",
  "- JCAHO",
  "- Joint Commission",
  "- ISO",
  "- SOC 2",
  "- GDPR",
  "- PCI",
  "",
  "Security ownership rule:",
  "Do not claim the candidate led, managed, owned, resolved, or coordinated emergency response, incidents, preparedness, drills, investigations, or safety programs unless candidate facts directly say so.",
  "",
  "Forbidden unless directly source-backed by candidate facts:",
  "- led emergency preparedness",
  "- led emergency preparedness drills",
  "- managed safety incidents",
  "- resolved safety incidents",
  "- coordinated emergency response",
  "- owned incident response",
  "- conducted investigations",
  "- managed security operations",
  "- led campus security",
  "- safeguarded patients, staff, and facilities as a mission claim",
  "",
  "Mission/value rule:",
  "Do not invent personal enthusiasm for the company.",
  "Do not discuss mission, values, purpose, noble work, or alignment unless the candidate facts directly support that specific motivation.",
  "",
  "Forbidden:",
  "- Ascension mission",
  "- reimagining healthcare security",
  "- safeguarding patients/staff/facilities as mission alignment",
  "- your mission",
  "- your values",
  "- your purpose",
  "- noble mission",
  "- meaningful mission",
  "- I am drawn to",
  "- I am inspired by",
  "- I am passionate about",
  "",
  "Tone rule:",
  "Write as a capable peer.",
  "Do not sound subordinate, needy, performative, or overly grateful.",
  "",
  "Do not use:",
  "- thrilled",
  "- passionate",
  "- eager",
  "- honored",
  "- excited",
  "- delighted",
  "- deeply committed",
  "- excited to contribute",
  "- aligns well",
  "- perfect fit",
  "- proven track record",
  "- fast-paced",
  "- dynamic environment",
  "- testament",
  "- delve",
  "- tapestry",
  "- leverage",
  "- robust",
  "- impactful",
  "",
  "Keyword rule:",
  "Do not mirror ATS keywords as a list.",
  "Do not stuff job-description phrases into the letter.",
  "Use role terminology only when attached to a CV-backed action, responsibility, artifact, environment, or result.",
  "",
  "Numbers rule:",
  "Do not invent metrics.",
  "Use numbers only when present in candidate facts.",
  "",
  "Writing rule:",
  "Prefer a concise, grounded letter over a comprehensive one.",
  "Use 2-4 short paragraphs.",
  "Every sentence must earn its place.",
  "No checklist formatting.",
  "No bullet list unless the required JSON body-part schema already expects one.",
  "",
  "MISTRAL ADJACENT ROLE-MAPPING LOCK",
  "",
  "Apply this section when candidate evidence is adjacent but not exact.",
  "",
  "Adjacent evidence means:",
  "- the candidate facts show related work, nearby workflows, support exposure, monitoring, documentation, reporting, scheduling, coordination, communication, or collaboration;",
  "- but the candidate facts do not show direct ownership, direct execution, or direct responsibility for the JD requirement.",
  "",
  "In adjacent cases, never convert proximity into direct target-role experience, unsupported ownership, guaranteed future performance, or measurable impact not present in candidate facts.",
  "",
  "Mistral cv_adjacent may include one restrained employer-facing bridge when grounded in BOTH candidate evidence and a JD work surface.",
  "The bridge must stay at the level of overlap, relevance, or operating context. It must not claim direct target-role experience, ownership, metrics, measurable impact, guaranteed future performance, or unsupported requirement satisfaction.",
  "",
  "Allowed bridge shapes:",
  "- \"That background is relevant to work where clear handoffs, documentation, and reporting matter.\"",
  "- \"Those operating habits fit environments that depend on accurate records and timely cross-team updates.\"",
  "- \"The overlap is strongest around coordination, reporting, and documentation.\"",
  "- \"That experience is closest to roles where documentation, coordination, and timely updates matter.\"",
  "",
  "Forbidden bridge shapes:",
  "- \"I have direct experience as an Implementation Analyst.\"",
  "- \"I can own your implementation workflows.\"",
  "- \"This will improve your delivery speed.\"",
  "- \"My background perfectly aligns with your role.\"",
  "- \"I can guarantee smoother operations.\"",
  "- \"I am passionate about your mission.\"",
  "- \"I meet your requirements.\"",
  "- \"I am qualified for every requirement.\"",
  "",
  "Role reference rule:",
  "- The JD role title may appear only as neutral context, not as proof of fit.",
  "- Do not attach the JD role title to a candidate experience claim.",
  "- Do not write \"For a [JD role], these skills...\"",
  "- Do not write \"In this role, I can...\"",
  "- Do not write \"My experience maps to the [JD role].\"",
  "- Do not write \"My background aligns with the [JD role].\"",
  "- Do not write \"This translates into the [JD role].\"",
  "- Do not use the JD role name as proof of candidate fit.",
  "",
  "Forbidden role-mapping phrases:",
  "- for an Administrative Coordinator",
  "- for a [JD role]",
  "- for this role",
  "- in this role",
  "- the role you're filling",
  "- your needs",
  "- your requirements",
  "- demands of the role",
  "- requirements of the role",
  "- maps to",
  "- maps closely",
  "- maps directly",
  "- aligns with",
  "- aligns closely",
  "- directly aligns",
  "- translates to",
  "- translates well",
  "- translates directly",
  "- direct fit",
  "- directly fits",
  "- direct match",
  "- exact match",
  "- directly relevant",
  "- directly applicable",
  "- well suited",
  "- ideal fit",
  "- particularly useful in",
  "- useful in managing",
  "- help with",
  "- helps with",
  "- contribute to",
  "- contributes to",
  "- can contribute",
  "- can help",
  "- would help",
  "- will help",
  "- can support [JD task]",
  "- would support [JD task]",
  "- can help ensure",
  "- would allow me to",
  "- I am confident that my skills",
  "- bring the ability to",
  "- ready to step into",
  "- qualified for every requirement",
  "",
  "Meta-competency commentary rule:",
  "Do not use generic relevance explanations. Use candidate evidence directly, with at most one restrained employer-facing bridge grounded in both candidate evidence and a JD work surface.",
  "",
  "Forbidden meta-commentary patterns:",
  "- My closest evidence lies in...",
  "- This experience has given me a strong foundation...",
  "- My background can be particularly useful...",
  "- This background would allow me to...",
  "- These skills help with...",
  "- This experience can translate into...",
  "- My experience is relevant because...",
  "- That experience would be useful in...",
  "- This has prepared me to...",
  "- I am confident that...",
  "",
  "Adjacent-safe writing rule:",
  "For adjacent-safe evidence, prefer neutral CV-backed facts and keep any single bridge grounded in overlap, relevance, or operating context:",
  "- \"I coordinated [CV-backed workflow].\"",
  "- \"I documented [CV-backed process].\"",
  "- \"I tracked [CV-backed deadlines/schedules/items].\"",
  "- \"I handled [CV-backed correspondence/vendor process],\" only if candidate facts support handling.",
  "- \"I maintained [CV-backed records/logs/documentation].\"",
  "- \"I communicated updates to [CV-backed stakeholder type].\"",
  "- \"I worked from the [CV-backed area] side of this kind of work.\"",
  "",
  "Do not write direct role-fit or future-impact explanations.",
  "Do not write outcome claims unless candidate facts directly support them.",
  "Keep employerValueBlock grounded in candidate facts and at most one restrained employer-facing bridge in cv_adjacent mode.",
  "",
  "Concrete evidence rule:",
  "Every body paragraph should include at least one concrete CV-derived anchor when available:",
  "- tool",
  "- system",
  "- project",
  "- named workflow",
  "- document/deliverable",
  "- metric",
  "- volume",
  "- cadence",
  "- stakeholder type",
  "- environment type",
  "",
  "If no concrete artifact is available, keep the claim narrow and factual. Do not compensate with abstract fit language.",
  "",
  "Result-safety rule:",
  "Do not claim business outcomes unless candidate facts directly support them.",
  "",
  "Forbidden unless source-backed:",
  "- reduce bottlenecks",
  "- streamline operations",
  "- improve efficiency",
  "- increase reliability",
  "- keep teams aligned",
  "- remove friction",
  "- ensure smooth operations",
  "- keep operations running smoothly",
  "- keep an office running efficiently",
  "- strengthen operations",
  "- improve office performance",
  "",
  "Closing paragraph rule:",
  "In adjacent-safe cases, the final paragraph must not convert CV-backed experience into role fit, business outcomes, or promised impact.",
  "",
  "Do not close with:",
  "- I can contribute to...",
  "- I can help...",
  "- I would help...",
  "- I am confident that...",
  "- These skills help with...",
  "- This experience would allow me to...",
  "- I am ready to...",
  "- I would welcome the chance to bring...",
  "- I can support your needs...",
  "",
  "Close by restating only CV-backed operating strengths:",
  "- coordination",
  "- documentation",
  "- scheduling",
  "- deadline tracking",
  "- vendor correspondence",
  "- stakeholder communication",
  "- follow-through",
  "- clear records",
  "",
  "Allowed closing patterns:",
  "- \"I bring experience in coordination, documentation, scheduling, and stakeholder communication.\"",
  "- \"My work has centered on clear records, deadline tracking, vendor correspondence, and cross-team updates.\"",
  "- \"I bring the same discipline around records, deadlines, and communication.\"",
  "",
  "Mistral cv_adjacent body-part override:",
  "When contextClass is cv_adjacent:",
  "- employerValueBlock may be a second factual evidence paragraph or one restrained bridge grounded in both candidate evidence and a JD work surface.",
  "- The bridge must stay at overlap, relevance, or operating-context level; it must not claim direct role experience, future performance, unsupported ownership, or invented impact.",
  "- closeLine must restate CV-backed operating strengths only.",
  "- Do not include greeting, signoff, or candidate name in body parts.",
  "- Do not use target role title, \"this role,\" \"your needs,\" \"helps with,\" \"can help,\" \"can contribute,\" \"translates,\" \"aligns,\" \"smoothly,\" or \"efficiently.\"",
  "- If this cannot be done safely, return shorter body parts instead of filling space.",
  "",
  "Ownership rule:",
  "If candidate evidence is adjacent, default to low-ownership verbs:",
  "- supported",
  "- monitored",
  "- documented",
  "- reported",
  "- maintained",
  "- contributed to",
  "- partnered with",
  "- coordinated, only when candidate facts support coordination",
  "- tracked, only when candidate facts support tracking",
  "- handled, only when candidate facts support handling",
  "- worked from the relevant side",
  "- supported related workflows",
  "- maintained visibility over related risks",
  "",
  "Do not use high-ownership verbs unless candidate facts explicitly support them:",
  "- led",
  "- owned",
  "- managed",
  "- directed",
  "- oversaw",
  "- drove",
  "- resolved",
  "- transformed",
  "- spearheaded",
  "",
  "Result-safety rule:",
  "Do not claim business outcomes unless candidate facts directly support them.",
  "",
  "Forbidden unless source-backed:",
  "- reduce bottlenecks",
  "- streamline operations",
  "- improve efficiency",
  "- increase reliability",
  "- keep teams aligned",
  "- remove friction",
  "- ensure smooth operations",
  "- strengthen operations",
  "- improve office performance",
  "",
  "Prefer concrete process language over outcome claims.",
  "Never imply ownership of adjacent areas.",
  "Do not say the candidate has direct experience in a role requirement unless candidate facts directly support it.",
  "",
  "Output rule:",
  "Return only the required JSON body parts.",
  "Do not output audit, chain-of-thought, citations, XML, markdown, or explanations.",
].join("\n");

export const QWEN_PREMIUM_COVER_LETTER_ADAPTER = [
  "Provider adapter: Qwen",
  "",
  "Treat the structured brief as separated evidence zones:",
  "- candidate facts: candidate claims only",
  "- job facts: role requirements only",
  "- company context: secondary context only",
  "",
  "Never transfer a requirement from job facts into candidate experience unless candidate facts support it.",
  "Never turn company context into personal motivation.",
  "",
  "Before writing, internally classify each possible candidate claim as:",
  "- source-backed",
  "- adjacent only",
  "- unsupported",
  "",
  "For cv_adjacent, allow at most one restrained employer-facing bridge.",
  "The bridge must stay at overlap, relevance, or operating-context level.",
  "Do not use the target role title as proof.",
  "Do not use job requirements as candidate experience.",
  "Silently reject any sentence that says the candidate aligns directly with the role, aligns with your goal, translates into the role, or offers direct fit, perfect fit, direct match, or direct role experience.",
  "Silently reject any sentence that says your goal, your needs, your requirements, I can help, I can support, I would contribute, or I am ready to as proof of fit.",
  "Silently reject any sentence that claims the candidate can improve, own, support, or guarantee the JD work surface.",
  "Silently reject any sentence that upgrades verbs beyond the CV or turns JD surfaces into candidate proof.",
  "",
  "Output only:",
  "- source-backed claims",
  "- adjacent-safe claims with low-ownership language",
  "",
  "Preferred safe bridge shapes:",
  "- \"The overlap is strongest around onboarding handoffs, rollout documentation, and feedback tracking.\"",
  "- \"That background is relevant to work where rollout planning, documentation, and cross-functional updates matter.\"",
  "- \"Those operating habits fit environments that depend on accurate records, documentation, and timely updates.\"",
  "",
  "Omit unsupported claims.",
  "",
  "Use ATS terms only when attached to a CV-backed action, artifact, responsibility, environment, or result.",
  "",
  "Do not use job requirements as candidate experience.",
  "Do not invent credentials, licenses, education, certifications, compliance frameworks, mission alignment, or personal motivation.",
  "",
  "Use the same ownership, license, education, compliance, mission, clipped-fragment, anti-keyword-list, and anti-slop safety rules from the shared premium safety canon.",
  "",
  "Return only the required JSON body parts.",
  "Do not output chain-of-thought, audit, XML, citations, markdown, or explanations.",
].join("\n");

export const PREMIUM_COVER_LETTER_REQUIRED_MOVES = [
  "build an internal RoleThesis before writing",
  "extract hard job requirements before role responsibilities",
  "select the strongest truthful CV evidence by relevance, not resume order",
  "identify claim boundaries before writing",
  "use company/product context only after role fit and evidence are established",
  "use company values or working principles only as secondary grounded signals",
  "integrate ATS terms naturally inside human sentences",
  "choose tone and format after factual boundaries are fixed",
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
  "reusing the employment-strong-frontend fixture opening as a template",
  "forcing frontend, product UI, design systems, performance, or experimentation language when absent from the JD/CV",
  "turning criteria signals into a visible checklist",
  "using company values before role fit is established",
  "defensive gap language or apology sentences",
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
const ADJACENT_ROLE_MAPPING_PATTERNS = [
  /\bthis\s+role\s+demands\b/i,
  /\bfor\s+this\s+role\b/i,
  /\bfor\s+(?:a|an)\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,5}\b/,
  /\bfor\s+an?\s+administrative\s+coordinator\b/i,
  /\bthe\s+role\s+you['’]?re\s+filling\b/i,
  /\bkey\s+responsibilities\s+for\s+this\s+role\b/i,
  /\bdemands\s+of\s+the\s+role\b/i,
  /\brequirements\s+of\s+the\s+role\b/i,
  /\bmaps?\s+(?:closely\s+|directly\s+)?to\b/i,
  /\baligns?\s+(?:closely\s+|directly\s+)?with\b/i,
  /\btranslates?\s+(?:directly\s+|well\s+)?(?:into|to)\b/i,
  /\bdirect(?:ly)?\s+(?:fit|fits|match|relevant|applicable)\b/i,
  /\bexact\s+match\b/i,
  /\b(?:particularly\s+)?useful\s+in\s+managing\b/i,
  /\b(?:can|would)\s+support\s+(?:general\s+office\s+operations|office\s+support|vendor\s+communication|schedule\s+management|scheduling|documentation|[a-z][^.!?]{0,80})\b/i,
  /\b(?:i\s+)?meet\s+your\s+requirements\b/i,
  /\bqualified\s+for\s+every\s+requirement\b/i,
] as const;
const ADJACENT_MODAL_FUTURE_CONTRIBUTION_PATTERN =
  /\b(?:can\s+(?:help(?:\s+ensure)?|contribute|support|guarantee|own|manage|lead|drive|direct|oversee|spearhead|transform|resolve)|would\s+(?:help|support|allow\s+me\s+to)|will\s+(?:help|support|improve|increase|reduce|streamline|strengthen|deliver|ensure)|could\s+(?:help|support))\b/i;
const ADJACENT_META_COMMENTARY_PATTERNS = [
  /\bmy\s+closest\s+evidence\s+lies\s+in\b/i,
  /\bthis\s+experience\s+has\s+given\s+me\s+a\s+strong\s+foundation\b/i,
  /\bmy\s+background\s+can\s+be\s+particularly\s+useful\b/i,
  /\bthis\s+background\s+would\s+allow\s+me\s+to\b/i,
  /\bthese\s+skills\s+help\s+with\b/i,
  /\bthis\s+experience\s+can\s+translate\b/i,
  /\bmy\s+experience\s+is\s+relevant\s+because\b/i,
  /\bthat\s+experience\s+would\s+be\s+useful\b/i,
  /\bi\s+am\s+confident\s+that\b/i,
] as const;
const ADJACENT_UNSUPPORTED_OUTCOME_PHRASES = [
  "run smoothly",
  "running smoothly",
  "smoothly and efficiently",
  "run efficiently",
  "office operations run efficiently",
  "keep operations running smoothly",
  "keep an office running efficiently",
  "keep workflows on track",
  "keep all parties aligned",
  "reduce bottlenecks",
  "streamline operations",
  "improve efficiency",
  "remove friction",
  "support smooth office operations",
] as const;
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
  const cleanedLines: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (SIGNOFF_PATTERN.test(line)) {
      const nextLine = lines[index + 1] ?? "";
      if (CANDIDATE_LIKE_FULL_NAME_LINE_PATTERN.test(nextLine)) {
        index += 1;
      }
      continue;
    }
    if (GREETING_PATTERN.test(line)) continue;
    cleanedLines.push(line);
  }
  return cleanedLines
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
    .filter((line) => line)
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
  const deterministicLanguage = getDeterministicCopyLanguage(language);
  if (!deterministicLanguage) return "";
  return deterministicLanguage === "fr"
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
    | undefined = process.env.COVER_LETTER_PREMIUM_WRITER_MODEL ??
    llmConfig.proposalModels?.openaiWriterModel,
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
  companyValuesPack?: CompanyValuesPack;
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
    ...(args.companyValuesPack && args.companyValuesPack.confidence !== "none"
      ? { companyValuesPack: args.companyValuesPack }
      : {}),
    requiredMoves: [...PREMIUM_COVER_LETTER_REQUIRED_MOVES],
    forbiddenMoves: [...PREMIUM_COVER_LETTER_FORBIDDEN_MOVES],
  };
}

export function buildPremiumCoverLetterPrompt(args: {
  brief: CoverLetterBrief;
  generationControlsBlock?: string;
  writerProvider?: PremiumCoverLetterWriterProvider;
  writerModel?: string;
}): string {
  const presetGuidance = resolvePremiumCoverLetterPresetGuidance(
    args.brief.preset,
  );
  const providerAdapter = resolvePremiumCoverLetterProviderAdapter({
    writerProvider: args.writerProvider,
    writerModel: args.writerModel,
  });
  const { requiredMoves, forbiddenMoves, companyValuesPack, ...briefRest } =
    args.brief;
  const structuredBrief = {
    ...briefRest,
    ...(companyValuesPack
      ? {
          companyValuesPack: {
            confidence: companyValuesPack.confidence,
            explicitValues: companyValuesPack.explicitValues,
            implicitValues: companyValuesPack.implicitValues,
            valueEvidenceSnippets: companyValuesPack.valueEvidenceSnippets,
            workSurfaceLinks: companyValuesPack.workSurfaceLinks,
            bannedValueClaimCount: companyValuesPack.bannedValueClaims.length,
            usageRule:
              "Values may be used only when they sharpen a concrete hiring case tied to a work surface or source-backed candidate evidence. Values must not replace source-backed candidate evidence or outrank stronger candidate proof. Do not infer personal alignment, admiration, culture fit, or mission resonance. If no strong mapping exists, leave company values unused.",
          },
        }
      : {}),
  };
  const contextGuidance = resolvePremiumCoverLetterContextGuidance({
    contextClass: args.brief.contextClass,
    writerProvider: args.writerProvider,
    writerModel: args.writerModel,
  });
  const bodyPartGuidance = resolvePremiumCoverLetterBodyPartGuidance({
    contextClass: args.brief.contextClass,
    writerProvider: args.writerProvider,
    writerModel: args.writerModel,
  });
  return [
    "Write premium cover-letter body parts.",
    `Planner priority order: ${COVER_LETTER_ROLE_THESIS_PRIORITY_ORDER.map((item, index) => `${index + 1}. ${item}`).join(" | ")}.`,
    "Build a dynamic RoleThesis from JD, CV facts, and detectors; never import fixture wording or one fixed structure.",
    "Use brief facts only. Do not invent credentials, ownership, metrics, tools, timelines, or proof.",
    "Prioritize strongest evidence first. If evidence is modest, let the best available concrete proof carry the case.",
    "Do not lead with secondary qualifications or spend body space on admiration, benefits attraction, checklist summaries, generic enthusiasm, tool repetition, keyword lists, or criteria reporting.",
    "topResponsibilities lead; keyRequirements sharpen; the rest stay secondary.",
    "Dynamic opening only: job-thesis, proof-first, company/problem, direct-match, or human-short when grounded. Never reuse 'Your frontend role sits where...' outside that fixture.",
    "A JD keyword, tool, certification, compliance framework, domain, or responsibility may appear as candidate experience only when the CV supports that exact capability. Bind ATS terms to a concrete action or result; never list them. Bind ATS and JD terms to a concrete CV-backed action, artifact, responsibility, or result. Never use a JD keyword as a floating adjective or implied experience.",
    ...(companyValuesPack
      ? [
          "Company values are bounded secondary context only: use at most one explicit bridge, only when grounded and tied to source-backed candidate evidence; never replace stronger proof or infer personal alignment.",
        ]
      : []),
    "Preset affects rhetorical texture only. It must not change truthfulness, claim strength, or evidence priority. Do not change ownership, metrics, tools, responsibilities, or boundaries.",
    "Across cv_direct and cv_adjacent modes, sound like a person making a case, not a memo.",
    "Avoid clunky inanimate-object phrasing and evaluator/meta phrases like 'the evidence I would bring'.",
    presetGuidance,
    args.generationControlsBlock,
    ...contextGuidance,
    "Return one JSON object with this schema and no extra text:",
    JSON.stringify({
      opening: "string",
      proofBlock: "string",
      employerValueBlock: "string",
      closeLine: "string",
    }),
    ...bodyPartGuidance,
    providerAdapter,
    `Structured brief: ${JSON.stringify(structuredBrief)}`,
  ].filter((line): line is string => typeof line === "string").join("\n");
}

function isMistralWriterIdentity(args: {
  writerProvider?: PremiumCoverLetterWriterProvider;
  writerModel?: string;
}): boolean {
  const normalizedProvider = args.writerProvider ?? "unknown";
  const normalizedModel = compactWhitespace(args.writerModel ?? "").toLowerCase();
  return (
    normalizedProvider === "mistral" ||
    /^(?:mistral|ministral)\b/.test(normalizedModel)
  );
}

function isQwenWriterIdentity(args: {
  writerProvider?: PremiumCoverLetterWriterProvider;
  writerModel?: string;
}): boolean {
  const normalizedProvider = args.writerProvider ?? "unknown";
  const normalizedModel = compactWhitespace(args.writerModel ?? "").toLowerCase();
  return normalizedProvider === "qwen" || /^qwen(?:\b|[-_.0-9])/.test(normalizedModel);
}

function resolvePremiumCoverLetterContextGuidance(args: {
  contextClass: PremiumCoverLetterContextClass;
  writerProvider?: PremiumCoverLetterWriterProvider;
  writerModel?: string;
}): string[] {
  if (args.contextClass === "cv_adjacent" && isQwenWriterIdentity(args)) {
    return [
      "Qwen cv_adjacent contract:",
      "- Evidence first: keep candidate facts candidate-side and JD facts work-surface context only.",
      "- Allow at most one restrained employer-facing bridge.",
      "- The bridge must stay at overlap, relevance, or operating-context level.",
      "- Do not use the target role title, job requirements, or employer goals as proof.",
      "- Do not write generic fit explanations.",
      "- Do not use direct target-role experience, direct-fit wording, or future performance promises.",
      "- Silently reject any sentence that says the candidate aligns directly with the role, translates into the role, or provides direct fit or perfect fit.",
      "- Silently reject any sentence that says your goal, your needs, your requirements, I can help, or I can support as proof of fit.",
      "- Silently reject any sentence that says the candidate would contribute, own, or guarantee the JD work surface.",
      "- Ownership boundary: use the candidate's CV verbs exactly or lower-ownership verbs; do not upgrade adjacent execution work into ownership, management, resolution, or strategic outcome control.",
      "- Do not use high-ownership verbs unless the exact verb and scope are directly present in candidate facts: owned, owning, managed, managing, led, leading, drove, driving, resolved, resolving, transformed, transforming, oversaw, overseeing, directed, directing, spearheaded, guaranteed, guaranteeing, ensured, or ensuring outcome control.",
      "- Do not claim the candidate controls employer outcomes unless candidate facts directly support that exact outcome.",
      "- Avoid outcome-control bridges such as ensure smooth coordination, seamless transitions, frictionless operations, focused on resolution, actionable insights, translate friction into insights, turn feedback into actionable insights, improve rollout planning, improve cross-functional coordination, keep coordination smooth, systematically captured and addressed, robust operational foundation, or scalable operational foundation.",
      "- Prefer lower-ownership supported verbs: documented, tracked, maintained, reported, shared updates, kept notes current, supported handoffs, coordinated when candidate facts support coordination, worked from the customer-facing side, and maintained visibility over issues.",
      "- Prefer a bridge only when it stays concrete and grounded in overlap, relevance, or operating context.",
      "- Safe bridge examples: \"I documented recurring onboarding handoffs and kept rollout notes current for internal teams.\" \"I tracked customer issues and shared updates between customer-facing and internal teams.\" \"The overlap is strongest around documented handoffs, rollout notes, and feedback tracking.\" \"That background is relevant to work where rollout planning, documentation, and cross-functional updates matter.\"",
      "- Keep the result concise, recruiter-readable, and human; do not turn it into a factual inventory.",
    ];
  }
  if (isMistralWriterIdentity(args)) {
    if (args.contextClass === "cv_direct") {
      return [
        "Mistral cv_direct contract:",
        "- Use this as a source-backed cover-letter contract.",
        "- Write a normal premium cover letter.",
        "- Use role context only when candidate evidence directly supports the capability.",
        "- Avoid generic fit language.",
        "- Avoid sycophancy.",
        "- Do not use \"excited,\" \"eager,\" \"thrilled,\" \"aligns well,\" \"directly translates,\" \"leverage,\" \"perfect fit,\" or \"proven track record.\"",
        "- Use concrete candidate evidence: actions, artifacts, tools, metrics, stakeholders, projects, workflows, cadence, or deliverables.",
        "- Do not invent impact. If the CV says page load improved by 28 percent, do not add user retention unless source-backed.",
        "- Do not turn a missing requirement into candidate experience.",
        "- Keep the letter natural and recruiter-readable.",
      ];
    }
    if (args.contextClass === "cv_adjacent") {
      return [
        "Mistral cv_adjacent context guidance:",
        "- This is a grounded adjacent letter with at most one restrained employer-facing bridge.",
        "- Mistral cv_adjacent may include one restrained employer-facing bridge when grounded in BOTH candidate evidence and a JD work surface.",
        "- The bridge must stay at the level of overlap, relevance, or operating context.",
        "- Do not map the background to the target role.",
        "- Do not state direct target-role experience, unsupported ownership, future contribution, promised impact, or unsupported requirement satisfaction.",
        "- Use job facts only to select which candidate facts to include.",
        "- Write only candidate-backed actions, artifacts, scopes, stakeholders, responsibilities, tools, metrics, cadence, or deliverables.",
        "- Use past or present factual statements.",
        "- Do not use future contribution claims.",
        "- Safe bridge examples: \"That background is relevant to work where clear handoffs, documentation, and reporting matter.\" \"The overlap is strongest around coordination, reporting, and documentation.\"",
        "- Forbidden bridge examples: \"I have direct experience as an Implementation Analyst.\" \"I can own your implementation workflows.\" \"This will improve your delivery speed.\" \"I am passionate about your mission.\"",
        "- If evidence is limited, return shorter body parts instead of filling space.",
      ];
    }
  }

  if (args.contextClass === "cv_adjacent") {
    return [
      "For cv_adjacent, keep the transfer honest and concrete; phrase the link as what this background helps with in the role's actual work, not as a generalized explanation of fit or a claim of direct target-role experience.",
      "For cv_adjacent, translate adjacent workflow evidence into role value without implying the candidate has already done the target role itself.",
    ];
  }
  if (args.contextClass === "no_cv") {
    return [
      "For no_cv, there is no supported candidate history. Use job-offer work surfaces not prior history.",
      "For no_cv, stay in first person and sound like a candidate, not a role summary or memo; vary the opening and avoid repeated stems like 'I am drawn to work...', 'I am applying... with a clear focus on...', 'This role centers on...', or 'The highest-value work...'; do not claim prior roles, achievements, credentials, tool usage, readiness, or impact; keep employerValueBlock on operational consequence and closeLine on modest first-person ownership.",
    ];
  }
  return [];
}

function resolvePremiumCoverLetterBodyPartGuidance(args: {
  contextClass: PremiumCoverLetterContextClass;
  writerProvider?: PremiumCoverLetterWriterProvider;
  writerModel?: string;
}): string[] {
  if (args.contextClass === "cv_adjacent" && isQwenWriterIdentity(args)) {
    return [
      "Qwen cv_adjacent body-part contract:",
      "- opening: one factual first-person sentence grounded in candidate evidence.",
      "- proofBlock: concrete CV-backed evidence only.",
      "- employerValueBlock: one restrained bridge or one concrete CV-backed implication, never a generic fit explanation.",
      "- Any bridge must stay at overlap, relevance, or operating-context level.",
      "- closeLine: one short sentence restating CV-backed operating strengths only.",
      "- Do not include greeting, signoff, or candidate name in body parts.",
      "- Do not use the target role title as proof.",
      "- Do not use \"this role,\" \"your needs,\" \"helps with,\" \"can help,\" \"can support,\" \"translates,\" \"aligns,\" \"smoothly,\" \"seamless,\" \"ensure,\" \"ensuring,\" \"actionable insights,\" or \"focused on resolution.\"",
      "- Do not explain generic fit; any relevance bridge must be restrained and grounded in both candidate evidence and a JD work surface.",
      "- Every body part should include at least one concrete CV-backed anchor when available.",
      "- If evidence is limited, return shorter body parts instead of filling space.",
    ];
  }
  if (args.contextClass === "cv_adjacent" && isMistralWriterIdentity(args)) {
    return [
      "Mistral cv_adjacent body-part contract:",
      "- opening: one factual first-person sentence grounded in candidate evidence.",
      "- proofBlock: concrete CV-backed evidence only.",
      "- employerValueBlock: concrete CV-backed evidence or one restrained employer-facing bridge grounded in both candidate evidence and a JD work surface.",
      "- Any bridge must stay at overlap, relevance, or operating-context level; it must not claim direct role experience, future performance, unsupported ownership, or invented impact.",
      "- closeLine: one short sentence restating CV-backed operating strengths only.",
      "- Do not include greeting, signoff, or candidate name in body parts.",
      "- Do not use the target role title.",
      "- Do not use \"this role,\" \"your needs,\" \"helps with,\" \"can help,\" \"can contribute,\" \"translates,\" \"aligns,\" \"smoothly,\" or \"efficiently.\"",
      "- Do not explain generic fit; any relevance bridge must be restrained and grounded in both candidate evidence and a JD work surface.",
      "- Every body part should include at least one concrete CV-backed anchor when available.",
      "- If no concrete anchor is available, keep the sentence narrow and factual instead of adding abstract fit language.",
      "- If there is not enough safe evidence, return shorter body parts instead of filling space.",
    ];
  }
  return [
    "Body-part rules: complete natural sentences only; no greeting, signoff, markdown, bullets, generic excitement, mission praise, defensive gaps, keyword lists, clipped fragments like 'St.' or guessed facility/team names.",
    "Opening: position through the strongest relevant evidence, not generic fit language. ProofBlock: develop top evidence first. EmployerValueBlock: move directly to an employer-facing implication. Use topResponsibilities before requirements. Never echo preferredQualifications or checklist noise. CloseLine: one short role-specific sentence.",
  ];
}

function resolvePremiumCoverLetterProviderAdapter(args: {
  writerProvider?: PremiumCoverLetterWriterProvider;
  writerModel?: string;
}): string | undefined {
  const normalizedProvider = args.writerProvider ?? "unknown";
  const normalizedModel = compactWhitespace(args.writerModel ?? "").toLowerCase();
  if (isMistralWriterIdentity(args)) {
    return MISTRAL_PREMIUM_COVER_LETTER_ADAPTER;
  }
  if (
    normalizedProvider === "qwen" ||
    /^qwen(?:\b|[-_.0-9])/.test(normalizedModel)
  ) {
    return QWEN_PREMIUM_COVER_LETTER_ADAPTER;
  }
  return undefined;
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
      return "Preset contract for signature: professional, warm, personal, concise, and stable; make the opening direct first-person positioning, continue from evidence, and do not let it read like colder expert analysis or a minimal shell.";
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
    | "duplicate_close_line"
    | "ats_keyword_list"
    | "clipped_source_fragment"
    | "unsupported_security_ownership"
    | "unsupported_compliance_framework"
    | "unsupported_license_claim"
    | "unsupported_education_credential"
    | "fabricated_mission_claim"
    | "unsupported_numeric_claim"
    | "unsupported_ownership_verb"
    | "candidate_name_mismatch";
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

const CLIPPED_SOURCE_FRAGMENT_PATTERN =
  /\b(?:your|the|this|our)\s+(?:St\.?|Ste\.?|Suite|Dept\.?)\s+(?:campus|team|department|facility|security|operations)\b/i;
const CLIPPED_CAPITAL_SOURCE_FRAGMENT_PATTERN =
  /\b(?:your|the|this|our)\s+Campus\s+(?:team|department|facility|operations)\b/;
const ATS_KEYWORD_LIST_PATTERN =
  /\b(?:Skills|Keywords|ATS terms)\s*:\s*[^.!?\n]*(?:,|\/)[^.!?\n]*(?:,|\/)/i;
const COMPLIANCE_FRAMEWORK_PATTERNS = [
  /\bHIPAA\b/i,
  /\bOSHA\b/i,
  /\bJCAHO\b/i,
  /\bJoint Commission\b/i,
  /\bISO\b/i,
  /\bSOC 2\b/i,
  /\bGDPR\b/i,
  /\bPCI\b/i,
  /\bregulated healthcare compliance\b/i,
  /\bhealthcare security standards?\b/i,
  /\bsafety compliance standards?\b/i,
] as const;
const UNSUPPORTED_SECURITY_OWNERSHIP_PATTERNS = [
  /\b(?:adept at leading|lead(?:s|ing|d)?)\s+(?:emergency preparedness drills?|emergency drills?)\b/i,
  /\b(?:emergency preparedness drills?|emergency drills?|safety incidents?|incident management|incident response|hazard resolution|emergency readiness|healthcare security strategy)\b\s+(?:led|leading|managed|managing|directed|directing|oversaw|oversight|commanded|commanding|owned|owning|drove|driven)\b/i,
  /\b(?:manage(?:d|s)?|managing|direct(?:ed|s|ing)?|oversee(?:n|s|ing)?|command(?:ed|s|ing)?|own(?:ed|s|ing)?|drive(?:n|s|ing)?)\b[\s\S]{0,60}\b(?:safety incidents?|incident management|incident response|hazard resolution|emergency preparedness drills?|emergency drills?|emergency readiness|healthcare security strategy)\b/i,
  /\b(?:identify\s+and\s+resolve|resolve(?:d|s|ing)?)\s+hazards?\b/i,
] as const;
const UNSUPPORTED_LICENSE_CLAIM_PATTERN =
  /\b(?:active|current|valid|have|hold|possess)\s+(?:a\s+)?(?:driver['’]?s|drivers|driving)\s+licen[cs]e\b|\b(?:driver['’]?s|drivers|driving)\s+licen[cs]e\s+(?:is\s+)?(?:active|current|valid)\b/i;
const UNSUPPORTED_EDUCATION_CREDENTIAL_PATTERN =
  /\b(?:have|hold|earned|completed|with|bring|meet(?:s|ing)?|a|my)\s+(?:a\s+)?(?:high school diploma|GED|diploma equivalency)\b|\b(?:high school diploma|GED|diploma equivalency)\s+(?:further\s+)?(?:meets?|is|are|supports?)\b/i;
const FABRICATED_MISSION_CLAIM_PATTERN =
  /\b(?:mission of|mission to|mission is|mission of safeguarding|reimagining healthcare security|contribute to reimagining healthcare|passionate about (?:your|the) mission|drawn to (?:your|the) mission|inspired by (?:your|the) mission|culture fit)\b/i;
const CANDIDATE_LIKE_FULL_NAME_LINE_PATTERN =
  /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3}$/;
const PERCENTAGE_NUMERIC_CLAIM_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:%|percent|percentage\s+points?)\b/gi;
const DIGIT_NUMERIC_CLAIM_PATTERN = /\b\d+(?:\.\d+)?\b/g;
const WORD_NUMBER_DURATION_CLAIM_PATTERN =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:day|days|week|weeks|month|months|year|years)\b/gi;
const HIGH_OWNERSHIP_VERB_PATTERNS = [
  { verb: "owned", pattern: /\bown(?:ed|s|ing)?\b/i },
  { verb: "managed", pattern: /\bmanag(?:ed|es|ing)\b/i },
  { verb: "led", pattern: /\b(?:led|lead(?:s|ing)?)\b/i },
  { verb: "directed", pattern: /\bdirect(?:ed|s|ing)?\b/i },
  { verb: "oversaw", pattern: /\b(?:oversaw|oversee(?:s|ing)?|overseen)\b/i },
  { verb: "drove", pattern: /\b(?:drove|drive(?:s|n|ing)?)\b/i },
  { verb: "spearheaded", pattern: /\bspearhead(?:ed|s|ing)?\b/i },
  { verb: "transformed", pattern: /\btransform(?:ed|s|ing)?\b/i },
  { verb: "resolved", pattern: /\bresolv(?:ed|es|ing)\b/i },
] as const;

function buildValidationSourceSurface(args: { brief: CoverLetterBrief }): string {
  const companyValuesPack = args.brief.companyValuesPack;
  return [
    args.brief.topEvidence,
    args.brief.supportEvidence,
    args.brief.transferCore ?? [],
    args.brief.topResponsibilities ?? [],
    args.brief.keyRequirements ?? [],
    args.brief.preferredQualifications ?? [],
    args.brief.lowValueChecklist ?? [],
    args.brief.workContext ?? [],
    companyValuesPack ? companyValuesPack.explicitValues : [],
    companyValuesPack ? companyValuesPack.implicitValues : [],
    companyValuesPack ? companyValuesPack.valueEvidenceSnippets : [],
    companyValuesPack ? companyValuesPack.workSurfaceLinks : [],
  ]
    .flat()
    .map((value) => compactWhitespace(value))
    .filter(Boolean)
    .join(" ");
}

function buildCandidateEvidenceSurface(args: { brief: CoverLetterBrief }): string {
  const companyValuesPack = args.brief.companyValuesPack;
  return [
    args.brief.topEvidence,
    args.brief.supportEvidence,
    args.brief.transferCore ?? [],
    companyValuesPack ? companyValuesPack.valueEvidenceSnippets : [],
  ]
    .flat()
    .map((value) => compactWhitespace(value))
    .filter(Boolean)
    .join(" ");
}

function normalizeNumericClaim(value: string): string {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/percentage\s+points?/g, "percent")
    .replace(/%/g, " percent");
}

function extractNumericClaims(value: string): string[] {
  const claims = new Set<string>();
  for (const match of value.matchAll(PERCENTAGE_NUMERIC_CLAIM_PATTERN)) {
    claims.add(normalizeNumericClaim(match[0]));
  }
  for (const match of value.matchAll(DIGIT_NUMERIC_CLAIM_PATTERN)) {
    claims.add(normalizeNumericClaim(match[0]));
  }
  for (const match of value.matchAll(WORD_NUMBER_DURATION_CLAIM_PATTERN)) {
    claims.add(normalizeNumericClaim(match[0]));
  }
  return Array.from(claims);
}

function hasUnsupportedNumericClaim(args: {
  generatedText: string;
  sourceSurface: string;
}): boolean {
  const generatedClaims = extractNumericClaims(args.generatedText);
  if (generatedClaims.length === 0) return false;
  const sourceClaims = new Set(extractNumericClaims(args.sourceSurface));
  return generatedClaims.some((claim) => !sourceClaims.has(claim));
}

function hasUnsupportedOwnershipVerb(args: {
  generatedText: string;
  candidateEvidenceSurface: string;
}): boolean {
  return HIGH_OWNERSHIP_VERB_PATTERNS.some(
    ({ pattern }) =>
      pattern.test(args.generatedText) &&
      !pattern.test(args.candidateEvidenceSurface),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function targetRolePattern(targetRole: string, prefix: string): RegExp | null {
  const tokens = compactWhitespace(targetRole).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  return new RegExp(`${prefix}${tokens.map(escapeRegExp).join("\\s+")}\\b`, "i");
}

function hasUnsupportedAdjacentOutcome(
  compact: string,
  candidateEvidenceSurface: string,
): boolean {
  const normalizedCompact = normalizeProposalConstraintText(compact);
  const normalizedCandidateEvidence = normalizeProposalConstraintText(
    candidateEvidenceSurface,
  );
  return ADJACENT_UNSUPPORTED_OUTCOME_PHRASES.some((phrase) => {
    const normalizedPhrase = normalizeProposalConstraintText(phrase);
    return (
      normalizedCompact.includes(normalizedPhrase) &&
      !normalizedCandidateEvidence.includes(normalizedPhrase)
    );
  });
}

function hasAdjacentRoleMappingLeak(args: {
  compact: string;
  brief: CoverLetterBrief;
  candidateEvidenceSurface: string;
}): boolean {
  const targetRolePatterns = [
    targetRolePattern(args.brief.targetRole, "\\bfor\\s+(?:a|an|the)?\\s*"),
    targetRolePattern(args.brief.targetRole, "\\brelevant\\s+to\\s+the\\s+"),
  ].filter((pattern): pattern is RegExp => pattern !== null);
  return (
    ADJACENT_ROLE_MAPPING_PATTERNS.some((pattern) =>
      pattern.test(args.compact),
    ) ||
    targetRolePatterns.some((pattern) => pattern.test(args.compact)) ||
    ADJACENT_MODAL_FUTURE_CONTRIBUTION_PATTERN.test(args.compact) ||
    ADJACENT_META_COMMENTARY_PATTERNS.some((pattern) =>
      pattern.test(args.compact),
    ) ||
    hasUnsupportedAdjacentOutcome(
      args.compact,
      args.candidateEvidenceSurface,
    )
  );
}

export function validatePremiumCoverLetterBodyParts(args: {
  bodyParts: CoverLetterBodyParts;
  brief: CoverLetterBrief;
}): PremiumBodyPartValidationIssue[] {
  const bodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(args.bodyParts);
  const issues: PremiumBodyPartValidationIssue[] = [];
  const values = Object.values(bodyParts);
  const sourceSurface = buildValidationSourceSurface(args);
  const candidateEvidenceSurface = buildCandidateEvidenceSurface(args);
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
        hasAdjacentRoleMappingLeak({
          compact,
          brief: args.brief,
          candidateEvidenceSurface,
        }) ||
        new RegExp(
          `\\b(?:as|worked\\s+as|experience\\s+as)\\s+(?:a|an|the)?\\s*${args.brief.targetRole
            .split(/\s+/)
            .map(escapeRegExp)
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
    if (ATS_KEYWORD_LIST_PATTERN.test(compact)) {
      issues.push({ code: "ats_keyword_list", repairable: false });
    }
    if (
      CLIPPED_SOURCE_FRAGMENT_PATTERN.test(compact) ||
      CLIPPED_CAPITAL_SOURCE_FRAGMENT_PATTERN.test(compact)
    ) {
      issues.push({ code: "clipped_source_fragment", repairable: false });
    }
    for (const pattern of COMPLIANCE_FRAMEWORK_PATTERNS) {
      if (pattern.test(compact) && !pattern.test(sourceSurface)) {
        issues.push({ code: "unsupported_compliance_framework", repairable: false });
        break;
      }
    }
    if (UNSUPPORTED_SECURITY_OWNERSHIP_PATTERNS.some((pattern) => pattern.test(compact))) {
      const sourceAllowsEmergencyOwnership = UNSUPPORTED_SECURITY_OWNERSHIP_PATTERNS.some(
        (pattern) => pattern.test(candidateEvidenceSurface),
      );
      if (!sourceAllowsEmergencyOwnership) {
        issues.push({ code: "unsupported_security_ownership", repairable: false });
      }
    }
    if (
      UNSUPPORTED_LICENSE_CLAIM_PATTERN.test(compact) &&
      !UNSUPPORTED_LICENSE_CLAIM_PATTERN.test(candidateEvidenceSurface)
    ) {
      issues.push({ code: "unsupported_license_claim", repairable: false });
    }
    if (
      UNSUPPORTED_EDUCATION_CREDENTIAL_PATTERN.test(compact) &&
      !UNSUPPORTED_EDUCATION_CREDENTIAL_PATTERN.test(candidateEvidenceSurface)
    ) {
      issues.push({ code: "unsupported_education_credential", repairable: false });
    }
    if (FABRICATED_MISSION_CLAIM_PATTERN.test(compact)) {
      issues.push({ code: "fabricated_mission_claim", repairable: false });
    }
    if (hasUnsupportedNumericClaim({ generatedText: compact, sourceSurface })) {
      issues.push({ code: "unsupported_numeric_claim", repairable: false });
    }
    if (
      hasUnsupportedOwnershipVerb({
        generatedText: compact,
        candidateEvidenceSurface,
      })
    ) {
      issues.push({ code: "unsupported_ownership_verb", repairable: false });
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
    if (getDeterministicCopyLanguage(args.brief.language)) {
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
  const deterministicLanguage = getDeterministicCopyLanguage(
    args.outputLanguage,
  );
  const signoff =
    deterministicLanguage === "fr"
      ? "Cordialement,"
      : deterministicLanguage === "en"
        ? "Sincerely,"
        : "";
  const salutation =
    deterministicLanguage === "fr"
      ? FRENCH_SALUTATION
      : deterministicLanguage === "en"
        ? ENGLISH_SALUTATION
        : "";
  const bodyParagraphs = [
    args.bodyParts.opening,
    args.bodyParts.proofBlock,
    args.bodyParts.employerValueBlock,
    args.bodyParts.closeLine,
  ]
    .map((part) => ensureSentenceEnding(compactWhitespace(part)))
    .filter(Boolean);

  const lines = [
    ...(salutation ? [salutation, ""] : []),
    ...bodyParagraphs.flatMap((paragraph, index) =>
      index === bodyParagraphs.length - 1 ? [paragraph] : [paragraph, ""],
    ),
    ...(signoff ? ["", signoff] : []),
    ...(signoff && compactWhitespace(args.candidateName) ? [compactWhitespace(args.candidateName)] : []),
  ];
  const content = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    content,
    sections: [{ type: "text", content }],
  };
}

function hasExpectedCandidateSignature(args: {
  content: string;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
}): boolean {
  if (!getDeterministicCopyLanguage(args.outputLanguage)) return true;
  const expectedName = compactWhitespace(args.candidateName);
  if (!expectedName) return true;
  const lines = args.content
    .split(/\n+/)
    .map((line) => compactWhitespace(line))
    .filter(Boolean);
  return lines[lines.length - 1] === expectedName;
}

export async function generatePremiumCoverLetterBodyPartsWithOpenAI(args: {
  apiKey: string;
  prompt: string;
  writerModel?: PremiumCoverLetterWriterModel;
  signal?: AbortSignal;
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
      const response = await client.responses.parse(
        {
          model: resolvedModel,
          input: args.prompt,
          reasoning: {
            effort: llmConfig.proposalModels?.openaiWriterReasoningEffort ?? "low",
          },
          text: {
            verbosity: "medium",
            format: zodTextFormat(
              PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA,
              "cover_letter_body_parts",
            ),
          },
        } as any,
        args.signal ? ({ signal: args.signal } as any) : undefined,
      );

      return PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
        response?.output_parsed ?? extractOpenAIJsonPayload(response),
      );
    }

    const response = await client.responses.create(
      requestBody as any,
      args.signal ? ({ signal: args.signal } as any) : undefined,
    );
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
    signal: args.signal,
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
    reasoning: {
      effort: llmConfig.proposalModels?.openaiWriterReasoningEffort ?? "low",
    },
    text: {
      verbosity: "medium",
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

function buildPremiumCoverLetterRepairPrompt(args: {
  brief: CoverLetterBrief;
  previousBodyParts: CoverLetterBodyParts;
  issues: PremiumBodyPartValidationIssue["code"][];
}): string {
  return [
    "Rewrite the cover-letter body parts to satisfy validation.",
    "",
    "The previous output failed because it used adjacent role-mapping, future-impact language, meta-commentary, or unsupported outcome claims.",
    "",
    "Remove:",
    "- role title references",
    "- \"this role\"",
    "- \"for this role\"",
    "- \"your needs\"",
    "- \"helps with\"",
    "- \"can help\"",
    "- \"can contribute\"",
    "- \"translates\"",
    "- \"aligns\"",
    "- \"strong foundation\"",
    "- \"key responsibilities\"",
    "- \"smoothly\"",
    "- \"efficiently\"",
    "- \"I'd welcome\"",
    "- \"excited\"",
    "- \"eager\"",
    "- business outcome claims not present in candidate evidence",
    "",
    "Use only:",
    "- factual candidate-backed actions",
    "- factual candidate-backed responsibilities",
    "- factual candidate-backed stakeholders",
    "- factual candidate-backed artifacts",
    "- factual candidate-backed scope, cadence, tools, metrics, projects, workflows, or deliverables",
    "- short CV-backed closeLine",
    "",
    "Structure:",
    "- opening: factual candidate role/responsibility sentence",
    "- proofBlock: concrete CV evidence",
    "- employerValueBlock: more concrete CV evidence, not employer value",
    "- closeLine: one short factual sentence",
    "",
    "Do not include greeting, signoff, or candidate name.",
    "Return only the same JSON body parts.",
    "No explanation.",
    "No markdown.",
    "No XML.",
    "No audit.",
    "",
    `Validation issues: ${JSON.stringify(args.issues)}`,
    `Previous body parts: ${JSON.stringify(args.previousBodyParts)}`,
    `Structured brief: ${JSON.stringify(args.brief)}`,
  ].join("\n");
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
  generationControlsBlock?: string;
  companyValuesPack?: CompanyValuesPack;
  writerProvider?: PremiumCoverLetterWriterProvider;
  writerModel?: string;
  signal?: AbortSignal;
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
  if (!isPremiumCoverLetterPreset(args.voicePreset)) {
    args.onFailure?.({
      stage: "eligibility",
      reason: "ineligible",
      eligibilityReason: "preset_not_supported",
    });
    return null;
  }
  const contextClass = eligibility.contextClass;
  const voicePreset = args.voicePreset;

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
    preset: voicePreset,
    outputLanguage: args.outputLanguage,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    contextClass,
    allowedFactsPack,
    rankedEvidencePack,
    companyValuesPack: args.companyValuesPack,
  });
  const prompt = buildPremiumCoverLetterPrompt({
    brief,
    generationControlsBlock: args.generationControlsBlock,
    writerProvider: args.writerProvider,
    writerModel: args.writerModel,
  });
  let bodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
    await args.writer({
      prompt,
      schema: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
      signal: args.signal,
    }),
  );

  let issues = validatePremiumCoverLetterBodyParts({ bodyParts, brief });
  const issueCodes = summarizeValidationIssueCodes(issues);
  const shouldRetryMistralAdjacentDirectFit =
    brief.contextClass === "cv_adjacent" &&
    isMistralWriterIdentity({
      writerProvider: args.writerProvider,
      writerModel: args.writerModel,
    }) &&
    issueCodes.includes("adjacent_direct_fit");

  if (issues.some((issue) => !issue.repairable)) {
    if (!shouldRetryMistralAdjacentDirectFit) {
      args.onFailure?.({
        stage: "validation",
        reason: "non_repairable_validation",
        contextClass,
        issues: issueCodes,
      });
      return null;
    }

    const repairedBodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
      await args.writer({
        prompt: buildPremiumCoverLetterRepairPrompt({
          brief,
          previousBodyParts: bodyParts,
          issues: issueCodes,
        }),
        schema: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
        signal: args.signal,
      }),
    );
    const repairedIssues = validatePremiumCoverLetterBodyParts({
      bodyParts: repairedBodyParts,
      brief,
    });
    if (repairedIssues.some((issue) => !issue.repairable) || repairedIssues.length > 0) {
      args.onFailure?.({
        stage: "validation",
        reason: "repair_failed_validation",
        contextClass,
        issues: summarizeValidationIssueCodes(repairedIssues),
      });
      return null;
    }

    bodyParts = repairedBodyParts;
  } else if (issues.length > 0) {
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
  if (
    !hasExpectedCandidateSignature({
      content: rendered.content,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
    })
  ) {
    args.onFailure?.({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass,
      issues: ["candidate_name_mismatch"],
    });
    return null;
  }

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
