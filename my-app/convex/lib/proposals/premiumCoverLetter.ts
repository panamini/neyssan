import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatMistralAI } from "@langchain/mistralai";

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

export type AllowedFactWithId = AllowedFact & {
  id: string;
  sourcePath: string;
};

export type FactNodeV1 = {
  id: string;
  text: string;
  source: "cv" | "job_post" | "system_inference";
  sourcePath: string;
  confidence: AllowedFact["confidence"];
  category: AllowedFact["category"];
  metrics: string[];
  entities: string[];
  allowedVerbs: string[];
  forbiddenUpgrades: string[];
  ownershipLevel:
    | "exposure"
    | "support"
    | "coordination"
    | "ownership"
    | "leadership";
};

export type FactGraphV1 = {
  version: "fact_graph_v1";
  facts: FactNodeV1[];
};

export type JobOfferPriorityPack = {
  coreResponsibilities: string[];
  keyRequirements: string[];
  preferredQualifications: string[];
  lowValueChecklist: string[];
  companyFluff: string[];
  priorityTokens: string[];
};

export type JobDemandNodeV1 = {
  id: string;
  text: string;
  bucket:
    | "core_responsibility"
    | "key_requirement"
    | "preferred_qualification"
    | "low_value_checklist"
    | "company_fluff";
  requiredness: "core" | "required" | "preferred" | "low_value" | "fluff";
  tokens: string[];
  mustNotBecomeCandidateClaim: boolean;
};

export type JobDemandGraphV1 = {
  version: "job_demand_graph_v1";
  demands: JobDemandNodeV1[];
  priorityTokens: string[];
};

export type RankedEvidencePack = {
  strongestEvidence: AllowedFact[];
  supportingEvidence: AllowedFact[];
  secondaryQualifications: AllowedFact[];
  transferCore: AllowedFact[];
  weakOrDoNotLeadWith: AllowedFact[];
};

export type ClaimPlanSection =
  | "opening"
  | "proofBlock"
  | "employerValueBlock"
  | "closeLine";

export type ClaimPlanV1 = {
  version: "claim_plan_v1";
  contextClass: PremiumCoverLetterContextClass;
  language: ProposalOutputLanguage;
  targetRole: string;
  preset: PremiumCoverLetterPreset;
  claims: ClaimPlanClaimV1[];
  globalForbidden: string[];
};

export type ClaimPlanClaimV1 = {
  id: string;
  section: ClaimPlanSection;
  factIds: string[];
  demandIds: string[];
  claimType:
    | "source_backed"
    | "adjacent_safe_bridge"
    | "job_surface_only_no_cv";
  requiredElements: string[];
  allowedVerbs: string[];
  forbiddenVerbs: string[];
  forbiddenClaims: string[];
  maxOwnership:
    | "exposure"
    | "support"
    | "coordination"
    | "ownership"
    | "leadership";
  allowEmployerBridge: boolean;
  editorialGuideline: string;
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
  claimPlan?: ClaimPlanV1;
  factGraphVersion?: "fact_graph_v1";
  jobDemandGraphVersion?: "job_demand_graph_v1";
  claimPlanVersion?: "claim_plan_v1";
  referencedFacts?: Array<{ id: string; text: string; source: string }>;
  referencedDemands?: Array<{ id: string; text: string; bucket: string }>;
};

export type CoverLetterBodyParts = {
  opening: string;
  proofBlock: string;
  employerValueBlock: string;
  closeLine: string;
};

export type PremiumWriterBodyPartV1 = {
  section: ClaimPlanSection;
  text: string;
  claimIds: string[];
  factIds: string[];
  demandIds: string[];
};

export type PremiumWriterOutputV1 = {
  version: "premium_writer_output_v1";
  bodyParts: {
    opening: PremiumWriterBodyPartV1;
    proofBlock: PremiumWriterBodyPartV1;
    employerValueBlock: PremiumWriterBodyPartV1;
    closeLine: PremiumWriterBodyPartV1;
  };
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
}) => Promise<unknown>;

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
  "Mistral compactness rule:",
  "- Do not fill all four body parts with multi-sentence material.",
  "- opening and closeLine must be one sentence each.",
  "- proofBlock may use at most two sentences.",
  "- employerValueBlock must be one sentence.",
  "- Use each candidate evidence anchor once across all body parts; do not restate the same employer, duty, cadence, credential, or environment in multiple body parts.",
  "- If a fact was used in opening, do not repeat it in proofBlock or employerValueBlock.",
  "- Prefer one strong evidence paragraph plus one restrained relevance/operating-discipline paragraph over a complete CV recap.",
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
  "- employerValueBlock should be one restrained employer-facing bridge grounded in both candidate evidence and a JD work surface when workContext or topResponsibilities exist.",
  "- Use employerValueBlock as a second factual evidence paragraph only when no safe JD work surface exists.",
  "- The bridge must stay at overlap, relevance, or operating-context level; it must not claim direct role experience, future performance, unsupported ownership, or invented impact.",
  "- closeLine must restate CV-backed operating strengths only.",
  "- closeLine must be first person. Use \"I bring...\" or \"My work has centered on...\" Do not write detached noun phrases like \"Experience includes...\"",
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
  "follow the ClaimPlan strategy before writing",
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

const CLAIM_PLAN_SECTION_SCHEMA = z.enum([
  "opening",
  "proofBlock",
  "employerValueBlock",
  "closeLine",
]);

const PREMIUM_WRITER_BODY_PART_V1_SCHEMA = z
  .object({
    section: CLAIM_PLAN_SECTION_SCHEMA,
    text: z.string(),
    claimIds: z.array(z.string()),
    factIds: z.array(z.string()),
    demandIds: z.array(z.string()),
  })
  .strict();

export const PREMIUM_WRITER_OUTPUT_V1_SCHEMA = z
  .object({
    version: z.literal("premium_writer_output_v1"),
    bodyParts: z
      .object({
        opening: PREMIUM_WRITER_BODY_PART_V1_SCHEMA.extend({
          section: z.literal("opening"),
        }),
        proofBlock: PREMIUM_WRITER_BODY_PART_V1_SCHEMA.extend({
          section: z.literal("proofBlock"),
        }),
        employerValueBlock: PREMIUM_WRITER_BODY_PART_V1_SCHEMA.extend({
          section: z.literal("employerValueBlock"),
        }),
        closeLine: PREMIUM_WRITER_BODY_PART_V1_SCHEMA.extend({
          section: z.literal("closeLine"),
        }),
      })
      .strict(),
  })
  .strict();

export const PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "bodyParts"],
  properties: {
    version: { const: "premium_writer_output_v1" },
    bodyParts: {
      type: "object",
      additionalProperties: false,
      required: ["opening", "proofBlock", "employerValueBlock", "closeLine"],
      properties: {
        opening: {
          type: "object",
          additionalProperties: false,
          required: ["section", "text", "claimIds", "factIds", "demandIds"],
          properties: {
            section: { const: "opening" },
            text: { type: "string" },
            claimIds: { type: "array", items: { type: "string" } },
            factIds: { type: "array", items: { type: "string" } },
            demandIds: { type: "array", items: { type: "string" } },
          },
        },
        proofBlock: {
          type: "object",
          additionalProperties: false,
          required: ["section", "text", "claimIds", "factIds", "demandIds"],
          properties: {
            section: { const: "proofBlock" },
            text: { type: "string" },
            claimIds: { type: "array", items: { type: "string" } },
            factIds: { type: "array", items: { type: "string" } },
            demandIds: { type: "array", items: { type: "string" } },
          },
        },
        employerValueBlock: {
          type: "object",
          additionalProperties: false,
          required: ["section", "text", "claimIds", "factIds", "demandIds"],
          properties: {
            section: { const: "employerValueBlock" },
            text: { type: "string" },
            claimIds: { type: "array", items: { type: "string" } },
            factIds: { type: "array", items: { type: "string" } },
            demandIds: { type: "array", items: { type: "string" } },
          },
        },
        closeLine: {
          type: "object",
          additionalProperties: false,
          required: ["section", "text", "claimIds", "factIds", "demandIds"],
          properties: {
            section: { const: "closeLine" },
            text: { type: "string" },
            claimIds: { type: "array", items: { type: "string" } },
            factIds: { type: "array", items: { type: "string" } },
            demandIds: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
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
  /\b(?:workflow|process|operations?|handoffs?|sla|qa|quality|ticket|queue|dashboard|reports?|records?|logs?|recording|observations?|surveillance|patrols?|reporting|experiments?|testing|revision|coordination|support|intake|triage|delivery|planning|collaboration)\b/i;
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

function createFactNode(
  id: string,
  sourcePath: string,
  fact: AllowedFact,
): FactNodeV1 {
  return {
    id,
    text: fact.text,
    source: fact.source,
    sourcePath,
    confidence: fact.confidence,
    category: fact.category,
    metrics: extractNumericClaims(fact.text),
    entities: extractFactEntities(fact.text),
    allowedVerbs: extractAllowedVerbs(fact.text),
    forbiddenUpgrades: inferForbiddenUpgrades(fact.text),
    ownershipLevel: inferOwnershipLevel(fact.text),
  };
}

function formatStableOrdinal(index: number): string {
  return String(index + 1).padStart(3, "0");
}

export function buildPremiumFactGraphV1(args: {
  personalizationContext: PremiumCoverLetterPersonalizationContext | null;
  jobDescription: string;
  systemInferenceHints?: string[];
}): FactGraphV1 {
  const facts: FactNodeV1[] = [];
  const context = args.personalizationContext;
  const pushFact = (id: string, sourcePath: string, fact: AllowedFact) => {
    facts.push(createFactNode(id, sourcePath, fact));
  };

  if (context) {
    splitFactSnippets(context.summary).forEach((summaryFact, index) => {
      const category = classifyCvFactCategory(summaryFact, "cv");
      pushFact(`fact_summary_${formatStableOrdinal(index)}`, `summary[${index}]`, {
        text: ensureSentenceEnding(summaryFact),
        source: "cv",
        confidence: inferFactConfidence(summaryFact, "cv", category),
        category,
      });
    });

    dedupeStrings(context.topSkills ?? []).forEach((skill, index) => {
      const category = classifyCvFactCategory(skill, "cv");
      pushFact(`fact_skill_${formatStableOrdinal(index)}`, `topSkills[${index}]`, {
        text: ensureSentenceEnding(skill),
        source: "cv",
        confidence: "medium",
        category,
      });
    });

    (context.recentExperience ?? []).forEach((entry, entryIndex) => {
      const experienceOrdinal = formatStableOrdinal(entryIndex);
      let highlightCounter = 0;
      const roleFact = compactWhitespace(
        [entry.position, entry.company ? `at ${entry.company}` : ""]
          .filter(Boolean)
          .join(" "),
      );
      if (roleFact) {
        pushFact(
          `fact_experience_${experienceOrdinal}_role`,
          `recentExperience[${entryIndex}].role`,
          {
            text: ensureSentenceEnding(roleFact),
            source: "cv",
            confidence: "high",
            category: "domain",
          },
        );
      }
      (entry.highlights ?? []).forEach((highlight, highlightIndex) => {
        splitFactSnippets(highlight).forEach((snippet) => {
          highlightCounter += 1;
          const category = classifyCvFactCategory(snippet, "cv");
          pushFact(
            `fact_experience_${experienceOrdinal}_highlight_${formatStableOrdinal(
              highlightCounter - 1,
            )}`,
            `recentExperience[${entryIndex}].highlights[${highlightIndex}]`,
            {
              text: ensureSentenceEnding(snippet),
              source: "cv",
              confidence: inferFactConfidence(snippet, "cv", category),
              category,
            },
          );
        });
      });
    });

    let achievementCounter = 0;
    (context.standoutAchievements ?? []).forEach((achievement, index) => {
      splitFactSnippets(achievement).forEach((snippet) => {
        achievementCounter += 1;
        pushFact(
          `fact_achievement_${formatStableOrdinal(achievementCounter - 1)}`,
          `standoutAchievements[${index}]`,
          {
            text: ensureSentenceEnding(snippet),
            source: "cv",
            confidence: "high",
            category: classifyCvFactCategory(snippet, "cv"),
          },
        );
      });
    });
  }

  buildJobPostFacts(args.jobDescription).forEach((fact, index) => {
    pushFact(`fact_job_post_${formatStableOrdinal(index)}`, `jobDescription[${index}]`, fact);
  });
  buildSystemInferenceFacts(args.systemInferenceHints).forEach((fact, index) => {
    pushFact(
      `fact_system_${formatStableOrdinal(index)}`,
      `systemInferenceHints[${index}]`,
      fact,
    );
  });

  const seen = new Set<string>();
  return {
    version: "fact_graph_v1",
    facts: facts.filter((fact) => {
      const key = `${fact.source}:${normalizeProposalConstraintText(fact.text)}`;
      if (!fact.text || seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}

export function buildAllowedFactsPackFromFactGraph(
  factGraph: FactGraphV1,
): { facts: AllowedFactWithId[] } {
  return {
    facts: factGraph.facts.map((fact) => ({
      id: fact.id,
      sourcePath: fact.sourcePath,
      text: fact.text,
      source: fact.source,
      confidence: fact.confidence,
      category: fact.category,
    })),
  };
}

function extractFactEntities(text: string): string[] {
  const matches = compactWhitespace(text).match(/\b[A-Z][A-Za-z0-9&'.-]{2,}\b/g);
  return dedupeStrings(matches ?? []).slice(0, 6);
}

function extractAllowedVerbs(text: string): string[] {
  const verbs = new Set<string>();
  const normalized = compactWhitespace(text).toLowerCase();
  const verbPatterns = [
    "assisted",
    "built",
    "coordinated",
    "delivered",
    "documented",
    "drove",
    "handled",
    "improved",
    "led",
    "managed",
    "maintained",
    "monitored",
    "owned",
    "reported",
    "supported",
    "tracked",
  ];
  for (const verb of verbPatterns) {
    if (new RegExp(`\\b${verb}\\b`, "i").test(normalized)) {
      verbs.add(verb);
    }
  }
  if (verbs.size === 0) verbs.add("described");
  return Array.from(verbs);
}

function inferForbiddenUpgrades(text: string): string[] {
  const normalized = compactWhitespace(text);
  const upgrades = new Set<string>();
  if (!/\bmanag(?:ed|es|ing)\b/i.test(normalized)) upgrades.add("managed");
  if (!/\b(?:led|lead(?:s|ing)?)\b/i.test(normalized)) upgrades.add("led");
  if (!/\bown(?:ed|s|ing)?\b/i.test(normalized)) upgrades.add("owned");
  if (!/\bdirect(?:ed|s|ing)?\b/i.test(normalized)) upgrades.add("directed");
  if (!/\b(?:oversaw|oversee(?:s|ing)?|overseen)\b/i.test(normalized)) {
    upgrades.add("oversaw");
  }
  if (!/\bresolv(?:ed|es|ing)\b/i.test(normalized)) upgrades.add("resolved");
  return Array.from(upgrades);
}

function inferOwnershipLevel(text: string): FactNodeV1["ownershipLevel"] {
  if (/\b(?:led|lead(?:s|ing)?|direct(?:ed|s|ing)?|oversaw|oversee(?:s|ing)?|spearhead(?:ed|s|ing)?)\b/i.test(text)) {
    return "leadership";
  }
  if (/\b(?:own(?:ed|s|ing)?|manag(?:ed|es|ing)|drove|drive(?:s|n|ing)?)\b/i.test(text)) {
    return "ownership";
  }
  if (/\bcoordinat(?:ed|es|ing|ion)\b/i.test(text)) return "coordination";
  if (/\b(?:support(?:ed|s|ing)?|assist(?:ed|s|ing)?|help(?:ed|s|ing)?|contribut(?:ed|es|ing))\b/i.test(text)) {
    return "support";
  }
  return "exposure";
}

export function buildPremiumJobDemandGraphV1(
  jobDescription: string,
): JobDemandGraphV1 {
  const pack = buildJobOfferPriorityPack(jobDescription);
  const makeDemand = (
    text: string,
    index: number,
    bucket: JobDemandNodeV1["bucket"],
  ): JobDemandNodeV1 => {
    const prefix =
      bucket === "core_responsibility"
        ? "core"
        : bucket === "key_requirement"
          ? "required"
          : bucket === "preferred_qualification"
            ? "preferred"
            : bucket === "low_value_checklist"
              ? "low_value"
              : "fluff";
    const requiredness =
      bucket === "core_responsibility"
        ? "core"
        : bucket === "key_requirement"
          ? "required"
          : bucket === "preferred_qualification"
            ? "preferred"
            : bucket === "low_value_checklist"
              ? "low_value"
              : "fluff";
    return {
      id: `demand_${prefix}_${formatStableOrdinal(index)}`,
      text,
      bucket,
      requiredness,
      tokens: normalizeTokens(text),
      mustNotBecomeCandidateClaim: true,
    };
  };
  return {
    version: "job_demand_graph_v1",
    demands: [
      ...pack.coreResponsibilities.map((text, index) =>
        makeDemand(text, index, "core_responsibility"),
      ),
      ...pack.keyRequirements.map((text, index) =>
        makeDemand(text, index, "key_requirement"),
      ),
      ...pack.preferredQualifications.map((text, index) =>
        makeDemand(text, index, "preferred_qualification"),
      ),
      ...pack.lowValueChecklist.map((text, index) =>
        makeDemand(text, index, "low_value_checklist"),
      ),
      ...pack.companyFluff.map((text, index) =>
        makeDemand(text, index, "company_fluff"),
      ),
    ],
    priorityTokens: pack.priorityTokens,
  };
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
  if (
    args.fact.source === "cv" &&
    isReportingEvidence(args.fact.text) &&
    hasAnyToken(args.jobTokens, [
      "report",
      "reporting",
      "reports",
      "document",
      "documentation",
      "records",
      "record",
      "communication",
      "handoff",
      "handoffs",
      "escalation",
      "escalate",
    ])
  ) {
    score += 55;
  }
  if (
    args.fact.source === "cv" &&
    /\b(?:maintenance|readiness|troubleshooting|repair coordination|manufacturer instructions)\b/i.test(
      args.fact.text,
    ) &&
    !hasAnyToken(args.jobTokens, [
      "maintenance",
      "readiness",
      "troubleshooting",
      "repair",
      "equipment",
    ])
  ) {
    score -= 24;
  }
  if (args.fact.confidence === "high") score += 8;
  score += overlap * 8;
  score += titleOverlap * 12;
  if (args.fact.source === "job_post") score -= 22;
  if (WEAK_QUALIFICATION_PATTERN.test(args.fact.text)) score -= 40;
  if (COMPANY_ADMIRATION_PATTERN.test(args.fact.text)) score -= 55;
  return score;
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => tokens.has(candidate));
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
  const cvAdjacentOperationalFacts =
    args.contextClass === "cv_adjacent"
      ? scored
          .map((entry) => entry.fact)
          .filter(
            (fact) =>
              fact.source === "cv" &&
              !isWeakOrDoNotLeadWith(fact) &&
              (fact.category === "achievement" ||
                fact.category === "responsibility" ||
                fact.category === "workflow"),
          )
      : [];

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
        (fact.category === "domain" &&
          (args.contextClass !== "cv_adjacent" ||
            strongestEvidence.length >= cvAdjacentOperationalFacts.length)))
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

const CLAIM_PLAN_SECTIONS: ClaimPlanSection[] = [
  "opening",
  "proofBlock",
  "employerValueBlock",
  "closeLine",
];

const CLAIM_ID_BY_SECTION: Record<ClaimPlanSection, string> = {
  opening: "claim_opening_001",
  proofBlock: "claim_proof_001",
  employerValueBlock: "claim_employer_value_001",
  closeLine: "claim_close_001",
};

const OWNERSHIP_ORDER: Record<FactNodeV1["ownershipLevel"], number> = {
  exposure: 0,
  support: 1,
  coordination: 2,
  ownership: 3,
  leadership: 4,
};

function findFactNodeForAllowedFact(
  factGraph: FactGraphV1,
  fact: AllowedFact | undefined,
): FactNodeV1 | undefined {
  if (!fact) return undefined;
  return factGraph.facts.find(
    (node) =>
      node.source === fact.source &&
      node.category === fact.category &&
      normalizeProposalConstraintText(node.text) ===
        normalizeProposalConstraintText(fact.text),
  );
}

function highestOwnershipLevel(facts: FactNodeV1[]): FactNodeV1["ownershipLevel"] {
  return facts.reduce<FactNodeV1["ownershipLevel"]>(
    (highest, fact) =>
      OWNERSHIP_ORDER[fact.ownershipLevel] > OWNERSHIP_ORDER[highest]
        ? fact.ownershipLevel
        : highest,
    "support",
  );
}

function collectAllowedVerbs(facts: FactNodeV1[]): string[] {
  return dedupeStrings(facts.flatMap((fact) => fact.allowedVerbs));
}

function collectForbiddenVerbs(facts: FactNodeV1[]): string[] {
  const allowed = new Set(collectAllowedVerbs(facts));
  return dedupeStrings(facts.flatMap((fact) => fact.forbiddenUpgrades)).filter(
    (verb) => !allowed.has(verb),
  );
}

function firstDemandId(
  jobDemandGraph: JobDemandGraphV1,
  buckets: JobDemandNodeV1["bucket"][],
): string[] {
  const demand = jobDemandGraph.demands.find((item) => buckets.includes(item.bucket));
  return demand ? [demand.id] : [];
}

export function buildPremiumClaimPlanV1(args: {
  factGraph: FactGraphV1;
  jobDemandGraph: JobDemandGraphV1;
  rankedEvidencePack: RankedEvidencePack;
  contextClass: PremiumCoverLetterContextClass;
  preset: PremiumCoverLetterPreset;
  outputLanguage: ProposalOutputLanguage;
  jobTitle: string;
}): ClaimPlanV1 {
  const strongest = args.rankedEvidencePack.strongestEvidence
    .map((fact) => findFactNodeForAllowedFact(args.factGraph, fact))
    .filter((fact): fact is FactNodeV1 => Boolean(fact));
  const supporting = args.rankedEvidencePack.supportingEvidence
    .map((fact) => findFactNodeForAllowedFact(args.factGraph, fact))
    .filter((fact): fact is FactNodeV1 => Boolean(fact));
  const transfer = args.rankedEvidencePack.transferCore
    .map((fact) => findFactNodeForAllowedFact(args.factGraph, fact))
    .filter((fact): fact is FactNodeV1 => Boolean(fact));
  const cvFacts = [...strongest, ...supporting, ...transfer].filter(
    (fact) => fact.source === "cv",
  );
  const primaryCvFact = cvFacts[0];
  const secondaryCvFact = cvFacts[1] ?? primaryCvFact;
  const closeCvFact = cvFacts[2] ?? secondaryCvFact ?? primaryCvFact;
  const sectionCvFacts = cvFacts.slice(0, 4);
  const roleContextDemandIds = firstDemandId(args.jobDemandGraph, [
    "core_responsibility",
    "key_requirement",
  ]);
  const noCvDemandIds = firstDemandId(args.jobDemandGraph, [
    "core_responsibility",
    "key_requirement",
    "preferred_qualification",
  ]);

  const makeClaim = (
    section: ClaimPlanSection,
    facts: FactNodeV1[],
    demandIds: string[],
    claimType: ClaimPlanClaimV1["claimType"],
    editorialGuideline: string,
  ): ClaimPlanClaimV1 => {
    const safeFacts =
      args.contextClass === "no_cv" ? [] : facts.filter((fact) => fact.source === "cv");
    const maxOwnership =
      args.contextClass === "cv_adjacent"
        ? highestOwnershipLevel(safeFacts) === "leadership" ||
          highestOwnershipLevel(safeFacts) === "ownership"
          ? highestOwnershipLevel(safeFacts)
          : "coordination"
        : args.contextClass === "no_cv"
          ? "exposure"
          : highestOwnershipLevel(safeFacts);
    return {
      id: CLAIM_ID_BY_SECTION[section],
      section,
      factIds: safeFacts.map((fact) => fact.id),
      demandIds,
      claimType,
      requiredElements:
        args.contextClass === "no_cv"
          ? ["job-surface-only neutral wording"]
          : safeFacts.map((fact) => fact.text),
      allowedVerbs:
        args.contextClass === "no_cv"
          ? ["discuss", "understand", "focus"]
          : collectAllowedVerbs(safeFacts),
      forbiddenVerbs:
        args.contextClass === "no_cv"
          ? ["led", "managed", "owned", "built", "improved", "certified"]
          : collectForbiddenVerbs(safeFacts),
      forbiddenClaims:
        args.contextClass === "no_cv"
          ? [
              "candidate history",
              "tools as candidate skill",
              "credentials",
              "achievements",
              "metrics",
              "prior work",
            ]
          : args.contextClass === "cv_adjacent"
            ? [
                "direct target-role experience",
                "target role title as proof",
                "future impact promise",
              ]
            : ["unsupported metric", "unsupported credential", "job demand as history"],
      maxOwnership,
      allowEmployerBridge:
        section === "employerValueBlock" && args.contextClass !== "no_cv",
      editorialGuideline,
    };
  };

  const claims =
    args.contextClass === "no_cv"
      ? CLAIM_PLAN_SECTIONS.map((section) =>
          makeClaim(
            section,
            [],
            noCvDemandIds,
            "job_surface_only_no_cv",
            "Use job surfaces only; write neutral, discussion-oriented prose without candidate history.",
          ),
        )
      : [
          makeClaim(
            "opening",
            primaryCvFact ? [primaryCvFact] : [],
            [],
            "source_backed",
            args.contextClass === "cv_adjacent"
              ? "Open with a CV-backed operating strength, not direct target-role fit."
              : "Open with the strongest CV-backed evidence.",
          ),
          makeClaim(
            "proofBlock",
            sectionCvFacts.length > 0
              ? sectionCvFacts
              : secondaryCvFact
                ? [secondaryCvFact]
                : primaryCvFact
                  ? [primaryCvFact]
                  : [],
            [],
            "source_backed",
            "Develop one CV-backed proof point without upgrading ownership or metrics.",
          ),
          makeClaim(
            "employerValueBlock",
            args.contextClass === "cv_adjacent"
              ? sectionCvFacts
              : sectionCvFacts.length > 0
                ? sectionCvFacts
                : primaryCvFact
                  ? [primaryCvFact]
                  : [],
            roleContextDemandIds,
            args.contextClass === "cv_adjacent"
              ? "adjacent_safe_bridge"
              : "source_backed",
            args.contextClass === "cv_adjacent"
              ? "Use the one restrained bridge; job demands are role context only."
              : "Reference a core responsibility only as role context, never candidate history.",
          ),
          makeClaim(
            "closeLine",
            sectionCvFacts.length > 0
              ? sectionCvFacts
              : closeCvFact
                ? [closeCvFact]
                : primaryCvFact
                  ? [primaryCvFact]
                  : [],
            [],
            "source_backed",
            args.contextClass === "cv_adjacent"
              ? "Restate CV-backed operating strengths only."
              : "Restate grounded strengths only.",
          ),
        ];

  return {
    version: "claim_plan_v1",
    contextClass: args.contextClass,
    language: args.outputLanguage,
    targetRole: compactWhitespace(args.jobTitle),
    preset: args.preset,
    claims,
    globalForbidden: [
      "writer-chosen strategy",
      "unsupported claims",
      "company fluff as motivation",
      "job demand as candidate history",
      "unsupported metrics",
      "unsupported credentials",
    ],
  };
}

export type PremiumClaimPlanValidationIssue = {
  code:
    | "missing_fact_id"
    | "missing_demand_id"
    | "no_cv_uses_cv_fact"
    | "missing_required_section"
    | "low_value_primary_proof"
    | "company_fluff_as_motivation"
    | "metric_not_in_fact"
    | "allowed_verb_conflicts_with_forbidden_upgrade"
    | "duplicate_primary_section_claim";
  claimId?: string;
  message: string;
};

export function validatePremiumClaimPlanV1(args: {
  claimPlan: ClaimPlanV1;
  factGraph: FactGraphV1;
  jobDemandGraph: JobDemandGraphV1;
}): PremiumClaimPlanValidationIssue[] {
  const issues: PremiumClaimPlanValidationIssue[] = [];
  const factIds = new Set(args.factGraph.facts.map((fact) => fact.id));
  const demandIds = new Set(args.jobDemandGraph.demands.map((demand) => demand.id));
  const claimsBySection = new Map<ClaimPlanSection, ClaimPlanClaimV1[]>();
  for (const section of CLAIM_PLAN_SECTIONS) claimsBySection.set(section, []);
  for (const claim of args.claimPlan.claims) {
    claimsBySection.get(claim.section)?.push(claim);
    for (const factId of claim.factIds) {
      if (!factIds.has(factId)) {
        issues.push({
          code: "missing_fact_id",
          claimId: claim.id,
          message: `Claim references unknown fact id ${factId}.`,
        });
      }
    }
    for (const demandId of claim.demandIds) {
      if (!demandIds.has(demandId)) {
        issues.push({
          code: "missing_demand_id",
          claimId: claim.id,
          message: `Claim references unknown demand id ${demandId}.`,
        });
      }
    }
    if (args.claimPlan.contextClass === "no_cv" && claim.factIds.length > 0) {
      issues.push({
        code: "no_cv_uses_cv_fact",
        claimId: claim.id,
        message: "no_cv claim plan must not reference candidate facts.",
      });
    }
    const demandNodes = claim.demandIds
      .map((id) => args.jobDemandGraph.demands.find((demand) => demand.id === id))
      .filter((demand): demand is JobDemandNodeV1 => Boolean(demand));
    if (
      claim.section === "proofBlock" &&
      demandNodes.some((demand) => demand.bucket === "low_value_checklist")
    ) {
      issues.push({
        code: "low_value_primary_proof",
        claimId: claim.id,
        message: "Low-value checklist demand cannot be primary proof.",
      });
    }
    if (
      claim.section === "employerValueBlock" &&
      demandNodes.some((demand) => demand.bucket === "company_fluff")
    ) {
      issues.push({
        code: "company_fluff_as_motivation",
        claimId: claim.id,
        message: "Company fluff cannot become candidate motivation.",
      });
    }
    const factNodes = claim.factIds
      .map((id) => args.factGraph.facts.find((fact) => fact.id === id))
      .filter((fact): fact is FactNodeV1 => Boolean(fact));
    const factMetrics = new Set(factNodes.flatMap((fact) => fact.metrics));
    for (const requiredElement of claim.requiredElements) {
      for (const metric of extractNumericClaims(requiredElement)) {
        if (!factMetrics.has(metric)) {
          issues.push({
            code: "metric_not_in_fact",
            claimId: claim.id,
            message: `Required metric ${metric} is not present in referenced facts.`,
          });
        }
      }
    }
    if (claim.allowedVerbs.some((verb) => claim.forbiddenVerbs.includes(verb))) {
      issues.push({
        code: "allowed_verb_conflicts_with_forbidden_upgrade",
        claimId: claim.id,
        message: "Claim allowed verbs conflict with forbidden upgrades.",
      });
    }
  }
  for (const section of CLAIM_PLAN_SECTIONS) {
    const sectionClaims = claimsBySection.get(section) ?? [];
    if (sectionClaims.length === 0) {
      issues.push({
        code: "missing_required_section",
        message: `ClaimPlan is missing ${section}.`,
      });
    }
    if (sectionClaims.length > 1) {
      issues.push({
        code: "duplicate_primary_section_claim",
        message: `ClaimPlan has duplicate primary claims for ${section}.`,
      });
    }
  }
  return issues;
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
  claimPlan?: ClaimPlanV1;
  factGraph?: FactGraphV1;
  jobDemandGraph?: JobDemandGraphV1;
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
    ...(args.claimPlan
      ? {
          claimPlan: args.claimPlan,
          factGraphVersion: "fact_graph_v1" as const,
          jobDemandGraphVersion: "job_demand_graph_v1" as const,
          claimPlanVersion: "claim_plan_v1" as const,
          referencedFacts: args.factGraph
            ? args.factGraph.facts
                .filter((fact) =>
                  new Set(args.claimPlan?.claims.flatMap((claim) => claim.factIds)).has(
                    fact.id,
                  ),
                )
                .map((fact) => ({
                  id: fact.id,
                  text: fact.text,
                  source: fact.source,
                }))
            : [],
          referencedDemands: args.jobDemandGraph
            ? args.jobDemandGraph.demands
                .filter((demand) =>
                  new Set(
                    args.claimPlan?.claims.flatMap((claim) => claim.demandIds),
                  ).has(demand.id),
                )
                .map((demand) => ({
                  id: demand.id,
                  text: demand.text,
                  bucket: demand.bucket,
                }))
            : [],
        }
      : {}),
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
    "The ClaimPlan owns strategy. Do not choose claims. Realize only the claim assigned to each section.",
    `Planner priority order, already resolved into ClaimPlan: ${COVER_LETTER_ROLE_THESIS_PRIORITY_ORDER.map((item, index) => `${index + 1}. ${item}`).join(" | ")}.`,
    "Follow the ClaimPlan exactly.",
    "Do not choose strategic claims.",
    "Each body part must realize only the claim assigned to that section.",
    "Each body part must cite the claimIds, factIds, and demandIds it used.",
    "Do not introduce claims not represented in ClaimPlan.",
    "Use only facts referenced by the section's claim.",
    "Job demands are role context only and must not become candidate experience.",
    "Shorter safe output is better than filled space.",
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
    "Do not include greeting, signoff, signature, candidate name, date, subject, sender block, recipient block, markdown, XML, citations, audit, or explanation.",
    "Return only PremiumWriterOutputV1 JSON.",
    "Return one JSON object with this schema and no extra text:",
    JSON.stringify({
      version: "premium_writer_output_v1",
      bodyParts: {
        opening: {
          section: "opening",
          text: "string",
          claimIds: ["claim_opening_001"],
          factIds: ["fact id strings used by this section"],
          demandIds: ["demand id strings used by this section"],
        },
        proofBlock: {
          section: "proofBlock",
          text: "string",
          claimIds: ["claim_proof_001"],
          factIds: ["fact id strings used by this section"],
          demandIds: ["demand id strings used by this section"],
        },
        employerValueBlock: {
          section: "employerValueBlock",
          text: "string",
          claimIds: ["claim_employer_value_001"],
          factIds: ["fact id strings used by this section"],
          demandIds: ["demand id strings used by this section"],
        },
        closeLine: {
          section: "closeLine",
          text: "string",
          claimIds: ["claim_close_001"],
          factIds: ["fact id strings used by this section"],
          demandIds: ["demand id strings used by this section"],
        },
      },
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
  if (args.contextClass === "cv_direct" && isQwenWriterIdentity(args)) {
    return [
      "Qwen cv_direct ownership and scope contract:",
      "- Direct match means strong source-backed overlap, not permission to borrow every JD responsibility as candidate experience.",
      "- Use exact CV verbs or lower-ownership verbs.",
      "- Use high-ownership verbs only when directly present in candidate facts, and keep them tied to the exact CV-backed scope.",
      "- Do not borrow high-ownership verbs from the job description.",
      "- Do not convert employer objectives into candidate achievements.",
      "- Do not convert collaboration into ownership or control of product, business, or delivery outcomes.",
      "- Do not inflate a supported achievement into a broader operational or business outcome.",
      "- Metrics and measurable outcomes must match candidate facts exactly.",
      "- Do not expand \"Improved release consistency across shared interface work\" into \"significantly improved release consistency across all shared interface work\" unless that exact scope is source-backed.",
      "- Avoid unsupported expansion language unless source-backed: directly aligns, your objective, business objectives, perfectly matches, perfect fit, seamless, ensure, ensuring, significantly, across all, elevate design system quality, drive product outcomes, own delivery, manage delivery, or lead development across surfaces.",
      "- Do not make design systems, reusable components, collaboration, or cross-functional delivery the actor that drives, ensures, or elevates outcomes unless candidate facts directly support that exact outcome.",
      "- Prefer concrete CV-backed evidence, exact tools and work surfaces, exact metrics and scope, and grounded employer relevance without claiming direct objective fulfillment.",
      "- Safe direct examples: \"I led a design-system migration used across four product squads.\" \"I improved release consistency across shared interface work.\" \"I built experimentation dashboards used by product and growth teams.\" \"The strongest overlap is around React, TypeScript, design systems, and product-facing interface work.\" \"That experience is relevant to frontend work where reusable systems, product iteration, and customer-facing surfaces matter.\"",
      "- Keep direct prose specific, confident, grounded, recruiter-readable, and stronger than adjacent; do not turn it into a factual inventory.",
    ];
  }
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
        "- Keep opening and closeLine to one sentence each; proofBlock may use at most two sentences; employerValueBlock must be one sentence.",
        "- Do not reuse the same employer, duty, cadence, credential, or environment across body parts.",
        "- Do not summarize the whole CV in the opening.",
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
        "- Keep opening and closeLine to one sentence each; proofBlock may use at most two sentences; employerValueBlock must be one sentence.",
        "- Do not reuse the same employer, duty, cadence, credential, or environment across body parts.",
        "- Do not summarize the whole CV in the opening.",
        "- Use past or present factual statements.",
        "- Do not use future contribution claims.",
        "- Safe bridge examples: \"That background is relevant to work where clear handoffs, documentation, and reporting matter.\" \"The overlap is strongest around coordination, reporting, and documentation.\"",
        "- Forbidden bridge examples: \"I have direct experience as an Implementation Analyst.\" \"I can own your implementation workflows.\" \"This will improve your delivery speed.\" \"I am passionate about your mission.\"",
        "- Do not use employerValueBlock as another evidence-only sentence when the brief includes topResponsibilities or workContext; use one restrained employer-facing bridge instead.",
        "- Do not repeat duration, employers, or the same evidence anchor in closeLine.",
        "- closeLine must be first person and must restate operating strengths, such as \"I bring discipline around accurate records, steady monitoring, and clear handoffs.\"",
        "- If evidence is limited, return shorter body parts instead of filling space.",
      ];
    }
  }

  if (args.contextClass === "cv_adjacent") {
    return [
      "For cv_adjacent, keep candidate evidence candidate-side and job facts work-surface-side; do not turn adjacent evidence into direct target-role experience, future contribution, or requirement satisfaction.",
      "For cv_adjacent, prioritize concrete CV-backed actions before any employer bridge. Use at most one restrained bridge, and keep it at overlap, relevance, or operating-context level.",
      "For cv_adjacent, do not use the target role title, job requirements, employer needs, direct-fit wording, role-mapping language, or future-value promises as proof.",
      "For cv_adjacent, make persuasion from the operating discipline already present in the CV facts: explain what the concrete work required, such as careful observation, accurate records, clear handoffs, stakeholder communication, or consistent follow-through. Do not add outcomes.",
      "For cv_adjacent, if the safest material is modest, write shorter body parts anchored in monitoring, documentation, reporting, coordination, records, handoffs, tools, environments, stakeholders, or other source-backed facts.",
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
      "- If topResponsibilities or workContext are present, employerValueBlock should be the restrained bridge, not another evidence-only sentence.",
      "- Any bridge must stay at overlap, relevance, or operating-context level; it must not claim direct role experience, future performance, unsupported ownership, or invented impact.",
      "- closeLine: one short sentence restating CV-backed operating strengths only.",
      "- Sentence budget: opening 1 sentence, proofBlock at most 2 sentences, employerValueBlock 1 sentence, closeLine 1 sentence.",
      "- Evidence reuse budget: each employer, duty, cadence, credential, environment, artifact, or workflow may appear in only one body part.",
      "- closeLine must be first person and must not begin with detached noun phrases like \"Experience includes\" or \"Background includes\".",
      "- Do not include greeting, signoff, or candidate name in body parts.",
      "- Do not use the target role title.",
      "- Do not use \"this role,\" \"your needs,\" \"helps with,\" \"can help,\" \"can contribute,\" \"translates,\" \"aligns,\" \"smoothly,\" or \"efficiently.\"",
      "- Do not explain generic fit; any relevance bridge must be restrained and grounded in both candidate evidence and a JD work surface.",
      "- Every body part should include at least one concrete CV-backed anchor when available.",
      "- If no concrete anchor is available, keep the sentence narrow and factual instead of adding abstract fit language.",
      "- If there is not enough safe evidence, return shorter body parts instead of filling space.",
    ];
  }
  if (args.contextClass === "cv_adjacent") {
    return [
      "cv_adjacent body-part contract:",
      "- opening: one factual first-person sentence grounded in the strongest concrete candidate action before duration, employer names, or domain summary; do not attach the target role title to the candidate's experience.",
      "- proofBlock: strongest concrete CV-backed evidence first, before employer context; develop what the work required instead of listing duties flatly.",
      "- employerValueBlock: either more concrete CV-backed evidence or one restrained bridge grounded in both candidate evidence and a JD work surface. The bridge should explain the operating discipline behind the evidence, not just name overlapping duties.",
      "- Any bridge must stay at overlap, relevance, or operating-context level; it must not claim direct role experience, future performance, unsupported ownership, or invented impact.",
      "- closeLine: one short sentence restating CV-backed operating strengths only.",
      "- Do not include greeting, signoff, or candidate name in body parts.",
      "- Do not use \"for this role,\" \"in this role,\" the target role title as proof, \"your needs,\" \"helps with,\" \"can help,\" \"can support,\" \"would bring,\" \"would contribute,\" \"ready to,\" \"translates,\" \"aligns,\" \"smoothly,\" or \"efficiently.\"",
      "- Every body part should include at least one concrete CV-backed anchor when available.",
      "- If evidence is limited, return shorter body parts instead of filling space.",
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
  issues?: string[];
};

function summarizeValidationIssueCodes(
  issues: PremiumBodyPartValidationIssue[],
): PremiumBodyPartValidationIssue["code"][] {
  return Array.from(new Set(issues.map((issue) => issue.code)));
}

export type PremiumWriterOutputValidationIssue = {
  code:
    | "unknown_claim_id"
    | "unknown_fact_id"
    | "unknown_demand_id"
    | "section_claim_mismatch"
    | "section_fact_not_allowed"
    | "section_demand_not_allowed"
    | "no_cv_uses_candidate_fact"
    | "direct_claim_missing_fact"
    | "unsupported_numeric_claim"
    | "unsupported_ownership_verb"
    | "unsupported_credential_claim"
    | "unsupported_compliance_framework"
    | "job_demand_as_candidate_experience"
    | "low_value_checklist_as_proof"
    | "company_fluff_as_motivation"
    | "empty_section"
    | "greeting_leakage"
    | "signoff_leakage";
  section?: ClaimPlanSection;
  claimId?: string;
  message: string;
  repairable: boolean;
};

export function toCoverLetterBodyParts(
  output: PremiumWriterOutputV1,
): CoverLetterBodyParts {
  return {
    opening: output.bodyParts.opening.text,
    proofBlock: output.bodyParts.proofBlock.text,
    employerValueBlock: output.bodyParts.employerValueBlock.text,
    closeLine: output.bodyParts.closeLine.text,
  };
}

function claimForSection(
  claimPlan: ClaimPlanV1,
  section: ClaimPlanSection,
): ClaimPlanClaimV1 | undefined {
  return claimPlan.claims.find((claim) => claim.section === section);
}

function wrapLegacyBodyPartsAsPremiumWriterOutputV1(args: {
  bodyParts: CoverLetterBodyParts;
  claimPlan: ClaimPlanV1;
}): PremiumWriterOutputV1 {
  const partFor = (section: ClaimPlanSection, text: string): PremiumWriterBodyPartV1 => {
    const claim = claimForSection(args.claimPlan, section);
    return {
      section,
      text,
      claimIds: claim ? [claim.id] : [],
      factIds: claim?.factIds ?? [],
      demandIds: claim?.demandIds ?? [],
    };
  };
  return {
    version: "premium_writer_output_v1",
    bodyParts: {
      opening: partFor("opening", args.bodyParts.opening),
      proofBlock: partFor("proofBlock", args.bodyParts.proofBlock),
      employerValueBlock: partFor(
        "employerValueBlock",
        args.bodyParts.employerValueBlock,
      ),
      closeLine: partFor("closeLine", args.bodyParts.closeLine),
    },
  };
}

function parsePremiumWriterOutputV1(args: {
  rawOutput: unknown;
  claimPlan: ClaimPlanV1;
}): { writerOutput: PremiumWriterOutputV1; legacyWrapped: boolean } {
  const premiumParse = PREMIUM_WRITER_OUTPUT_V1_SCHEMA.safeParse(args.rawOutput);
  if (premiumParse.success) {
    return { writerOutput: premiumParse.data, legacyWrapped: false };
  }
  const legacyBodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(args.rawOutput);
  return {
    writerOutput: wrapLegacyBodyPartsAsPremiumWriterOutputV1({
      bodyParts: legacyBodyParts,
      claimPlan: args.claimPlan,
    }),
    legacyWrapped: true,
  };
}

export function validatePremiumWriterOutputV1(args: {
  writerOutput: PremiumWriterOutputV1;
  claimPlan: ClaimPlanV1;
  factGraph: FactGraphV1;
  jobDemandGraph: JobDemandGraphV1;
  brief: CoverLetterBrief;
}): PremiumWriterOutputValidationIssue[] {
  const issues: PremiumWriterOutputValidationIssue[] = [];
  const claimById = new Map(args.claimPlan.claims.map((claim) => [claim.id, claim]));
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const demandById = new Map(
    args.jobDemandGraph.demands.map((demand) => [demand.id, demand]),
  );
  for (const section of CLAIM_PLAN_SECTIONS) {
    const part = args.writerOutput.bodyParts[section];
    const assignedClaim = claimForSection(args.claimPlan, section);
    const compact = compactWhitespace(part.text);
    if (!compact) {
      issues.push({
        code: "empty_section",
        section,
        claimId: assignedClaim?.id,
        message: `${section} is empty.`,
        repairable: true,
      });
    }
    if (GREETING_PATTERN.test(compact)) {
      issues.push({
        code: "greeting_leakage",
        section,
        claimId: assignedClaim?.id,
        message: `${section} contains greeting leakage.`,
        repairable: true,
      });
    }
    if (SIGNOFF_PATTERN.test(compact)) {
      issues.push({
        code: "signoff_leakage",
        section,
        claimId: assignedClaim?.id,
        message: `${section} contains signoff leakage.`,
        repairable: true,
      });
    }
    for (const claimId of part.claimIds) {
      const claim = claimById.get(claimId);
      if (!claim) {
        issues.push({
          code: "unknown_claim_id",
          section,
          claimId,
          message: `Unknown claim id ${claimId}.`,
          repairable: false,
        });
        continue;
      }
      if (claim.section !== section || assignedClaim?.id !== claimId) {
        issues.push({
          code: "section_claim_mismatch",
          section,
          claimId,
          message: `${claimId} is not assigned to ${section}.`,
          repairable: false,
        });
      }
    }
    if (assignedClaim && !part.claimIds.includes(assignedClaim.id)) {
      issues.push({
        code: "section_claim_mismatch",
        section,
        claimId: assignedClaim.id,
        message: `${section} must cite its assigned claim.`,
        repairable: false,
      });
    }
    for (const factId of part.factIds) {
      const fact = factById.get(factId);
      if (!fact) {
        issues.push({
          code: "unknown_fact_id",
          section,
          claimId: assignedClaim?.id,
          message: `Unknown fact id ${factId}.`,
          repairable: false,
        });
        continue;
      }
      if (!assignedClaim?.factIds.includes(factId)) {
        issues.push({
          code: "section_fact_not_allowed",
          section,
          claimId: assignedClaim?.id,
          message: `${factId} is not allowed for ${section}.`,
          repairable: false,
        });
      }
      if (args.claimPlan.contextClass === "no_cv" && fact.source === "cv") {
        issues.push({
          code: "no_cv_uses_candidate_fact",
          section,
          claimId: assignedClaim?.id,
          message: "no_cv output must not cite candidate facts.",
          repairable: false,
        });
      }
    }
    for (const demandId of part.demandIds) {
      const demand = demandById.get(demandId);
      if (!demand) {
        issues.push({
          code: "unknown_demand_id",
          section,
          claimId: assignedClaim?.id,
          message: `Unknown demand id ${demandId}.`,
          repairable: false,
        });
        continue;
      }
      if (!assignedClaim?.demandIds.includes(demandId)) {
        issues.push({
          code: "section_demand_not_allowed",
          section,
          claimId: assignedClaim?.id,
          message: `${demandId} is not allowed for ${section}.`,
          repairable: false,
        });
      }
      if (section === "proofBlock" && demand.bucket === "low_value_checklist") {
        issues.push({
          code: "low_value_checklist_as_proof",
          section,
          claimId: assignedClaim?.id,
          message: "Low-value checklist demand cannot be proof.",
          repairable: false,
        });
      }
      if (
        section === "employerValueBlock" &&
        demand.bucket === "company_fluff" &&
        COMPANY_ADMIRATION_PATTERN.test(compact)
      ) {
        issues.push({
          code: "company_fluff_as_motivation",
          section,
          claimId: assignedClaim?.id,
          message: "Company fluff cannot become candidate motivation.",
          repairable: false,
        });
      }
    }
    if (
      assignedClaim?.claimType === "source_backed" &&
      args.claimPlan.contextClass !== "no_cv" &&
      part.factIds.length === 0
    ) {
      issues.push({
        code: "direct_claim_missing_fact",
        section,
        claimId: assignedClaim.id,
        message: "Source-backed claim must cite an allowed fact.",
        repairable: false,
      });
    }
    const referencedFacts = part.factIds
      .map((id) => factById.get(id))
      .filter((fact): fact is FactNodeV1 => Boolean(fact));
    const referencedDemands = part.demandIds
      .map((id) => demandById.get(id))
      .filter((demand): demand is JobDemandNodeV1 => Boolean(demand));
    const referencedFactSurface = referencedFacts.map((fact) => fact.text).join(" ");
    if (
      hasUnsupportedNumericClaim({
        generatedText: compact,
        sourceSurface: referencedFactSurface,
      })
    ) {
      issues.push({
        code: "unsupported_numeric_claim",
        section,
        claimId: assignedClaim?.id,
        message: "Generated numeric claim is absent from referenced facts.",
        repairable: false,
      });
    }
    if (
      assignedClaim &&
      HIGH_OWNERSHIP_VERB_PATTERNS.some(({ verb, pattern }) => {
        if (!pattern.test(compact)) return false;
        return (
          assignedClaim.forbiddenVerbs.includes(verb) ||
          !assignedClaim.allowedVerbs.some((allowedVerb) =>
            new RegExp(`\\b${escapeRegExp(allowedVerb)}\\b`, "i").test(compact),
          )
        );
      })
    ) {
      issues.push({
        code: "unsupported_ownership_verb",
        section,
        claimId: assignedClaim.id,
        message: "Generated ownership verb is not allowed by section claim.",
        repairable: false,
      });
    }
    if (
      UNSUPPORTED_LICENSE_CLAIM_PATTERN.test(compact) ||
      UNSUPPORTED_EDUCATION_CREDENTIAL_PATTERN.test(compact)
    ) {
      const sourceAllowsCredential =
        UNSUPPORTED_LICENSE_CLAIM_PATTERN.test(referencedFactSurface) ||
        UNSUPPORTED_EDUCATION_CREDENTIAL_PATTERN.test(referencedFactSurface);
      if (!sourceAllowsCredential) {
        issues.push({
          code: "unsupported_credential_claim",
          section,
          claimId: assignedClaim?.id,
          message: "Generated credential is absent from referenced facts.",
          repairable: false,
        });
      }
    }
    if (
      COMPLIANCE_FRAMEWORK_PATTERNS.some((pattern) => pattern.test(compact)) &&
      !COMPLIANCE_FRAMEWORK_PATTERNS.some((pattern) =>
        pattern.test(referencedFactSurface),
      )
    ) {
      issues.push({
        code: "unsupported_compliance_framework",
        section,
        claimId: assignedClaim?.id,
        message: "Generated compliance framework is absent from referenced facts.",
        repairable: false,
      });
    }
    if (
      referencedDemands.some((demand) =>
        compact.toLowerCase().includes(
          demand.text.replace(/[.!?]$/u, "").toLowerCase(),
        ),
      ) &&
      /\b(?:i|my)\s+(?:led|managed|owned|built|improved|delivered|maintained|coordinated|handled|tracked|documented)\b/i.test(
        compact,
      )
    ) {
      issues.push({
        code: "job_demand_as_candidate_experience",
        section,
        claimId: assignedClaim?.id,
        message: "Job demand appears as candidate experience.",
        repairable: false,
      });
    }
    if (
      args.claimPlan.contextClass === "no_cv" &&
      NO_CV_HISTORY_CLAIM_PATTERN.test(compact)
    ) {
      issues.push({
        code: "no_cv_uses_candidate_fact",
        section,
        claimId: assignedClaim?.id,
        message: "no_cv output contains candidate history.",
        repairable: false,
      });
    }
  }
  return issues;
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

function firstPersonEvidenceSentence(value: string): string {
  const compact = compactWhitespace(value).replace(/[.!?]$/u, "");
  if (!compact) return "";
  if (/^i\b/i.test(compact)) return ensureSentenceEnding(compact);
  if (/^[A-Z][\w\s'-]{1,60}\s+at\s+[A-Z]/.test(compact)) {
    return ensureSentenceEnding(`I worked as a ${compact}`);
  }
  const durationContext = adjacentDurationContextPhrase(compact);
  if (durationContext) {
    return ensureSentenceEnding(`I bring ${durationContext}`);
  }

  const verbMatch = compact.match(
    /^(monitored|completed|recorded|documented|reported|scanned|interviewed|coordinated|tracked|maintained|handled|supported|protected|built|reduced|improved|led|managed|owned)\b([\s\S]*)$/i,
  );
  if (verbMatch?.[1]) {
    return ensureSentenceEnding(
      `I ${verbMatch[1].toLowerCase()}${verbMatch[2] ?? ""}`,
    );
  }

  return ensureSentenceEnding(compact);
}

function adjacentDurationContextPhrase(value: string): string | null {
  const compact = compactWhitespace(value).replace(/[.!?]$/u, "");
  const match = compact.match(
    /^(.+?)\s+with\s+((?:\w+\s+){0,3}(?:years?|months?))\s+experience\s+([\s\S]+)$/i,
  );
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const descriptor = compactWhitespace(match[1])
    .toLowerCase()
    .replace(/\bsafety conscious\b/g, "safety-conscious");
  const duration = compactWhitespace(match[2]).toLowerCase();
  const scope = compactWhitespace(match[3]);
  return `${duration} of ${descriptor} work ${scope}`;
}

function adjacentActionPhrase(value: string): string {
  const compact = compactWhitespace(value)
    .replace(/[.!?]$/u, "")
    .replace(/^I\s+/i, "");
  return compact
    .replace(/^monitored\b/i, "monitoring")
    .replace(/^scanned\b/i, "scanning")
    .replace(/^completed\b/i, "completing")
    .replace(/^recorded\b/i, "recording")
    .replace(/^documented\b/i, "documenting")
    .replace(/^reported\b/i, "reporting")
    .replace(/^interviewed\b/i, "interviewing")
    .replace(/^maintained\b/i, "maintaining")
    .replace(/^supported\b/i, "supporting")
    .replace(/\band\s+monitored\b/gi, "and monitoring")
    .replace(/\band\s+scanned\b/gi, "and scanning")
    .replace(/\band\s+completed\b/gi, "and completing")
    .replace(/\band\s+recorded\b/gi, "and recording")
    .replace(/\band\s+documented\b/gi, "and documenting")
    .replace(/\band\s+interviewed\b/gi, "and interviewing");
}

function parseRoleCompanyFact(value: string): { role: string; company: string } | null {
  const compact = compactWhitespace(value).replace(/[.!?]$/u, "");
  const match = compact.match(/^(.+?)\s+at\s+(.+)$/i);
  if (!match?.[1] || !match[2]) return null;
  return {
    role: compactWhitespace(match[1]).toLowerCase(),
    company: compactWhitespace(match[2]),
  };
}

function adjacentRoleCompanyContext(values: string[]): string | null {
  const parsed = values
    .map(parseRoleCompanyFact)
    .filter((item): item is { role: string; company: string } => item !== null);
  if (parsed.length === 0) return null;
  const firstRole = parsed[0]!.role;
  const companies = dedupeStrings(parsed.map((item) => item.company));
  if (parsed.every((item) => item.role === firstRole) && companies.length > 0) {
    return `while working as a ${firstRole} at ${listAsNaturalText(companies)}`;
  }
  return `with experience as ${listAsNaturalText(
    parsed.map((item) => `${item.role} at ${item.company}`),
  )}`;
}

function roleCompanySubject(value: string): string {
  return compactWhitespace(value).replace(/^while\s+working\s+as\s+/i, "As ");
}

function conciseDurationScope(value: string): string {
  const compact = compactWhitespace(value);
  const match = compact.match(
    /^((?:\w+\s+){0,3}(?:years?|months?))\s+of\s+.+?\s+work\s+([\s\S]+)$/i,
  );
  if (!match?.[1] || !match[2]) return compact;
  return `${compactWhitespace(match[1]).toLowerCase()} ${compactWhitespace(match[2])}`;
}

function conciseDurationEvidenceLead(value: string): string {
  return compactWhitespace(conciseDurationScope(value))
    .replace(
      /,\s*(?:presently|currently|also|and\s+(?:qualified|certified|finishing|completing))\b[\s\S]*$/i,
      "",
    )
    .replace(
      /\s+and\s+(?:qualified|certified|presently|currently|finishing|completing)\b[\s\S]*$/i,
      "",
    );
}

function listAsNaturalText(items: string[]): string {
  const cleaned = dedupeStrings(items).map((item) =>
    compactWhitespace(item).replace(/[.!?]$/u, ""),
  );
  if (cleaned.length <= 1) return cleaned[0] ?? "";
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

function selectAdjacentWorkSurfaces(brief: CoverLetterBrief): string[] {
  const normalizedTargetRole = normalizeProposalConstraintText(brief.targetRole);
  return dedupeStrings([
    ...(brief.topResponsibilities ?? []),
    ...(brief.workContext ?? []),
    ...(brief.keyRequirements ?? []),
  ])
    .map((item) => compactWhitespace(item).replace(/[.!?]$/u, ""))
    .filter((item) => {
      const normalized = normalizeProposalConstraintText(item);
      return (
        normalized &&
        !normalized.includes("is hiring") &&
        !normalized.includes(normalizedTargetRole)
      );
    })
    .slice(0, 3);
}

function adjacentOperatingAnchors(brief: CoverLetterBrief): string[] {
  const evidence = [
    ...brief.topEvidence,
    ...brief.supportEvidence,
    ...(brief.transferCore ?? []),
  ].join(" ");
  const anchors: string[] = [];
  if (/\b(?:monitor|surveillance|scan|patrol|observation|watch)\b/i.test(evidence)) {
    anchors.push("careful observation");
  }
  if (/\b(?:reports?|records?|documents?|documented|logs?|notes?|recording)\b/i.test(evidence)) {
    anchors.push("accurate records");
  }
  if (/\b(?:witness(?:es)?|interview|communicat|handoffs?|stakeholders?|updates?)\b/i.test(evidence)) {
    anchors.push("clear handoffs");
  }
  if (/\b(?:coordinat|schedul|track|follow)\b/i.test(evidence)) {
    anchors.push("consistent follow-through");
  }
  return anchors.length > 0
    ? dedupeStrings(anchors).slice(0, 4)
    : ["clear records", "steady communication", "consistent follow-through"];
}

function isReportingEvidence(value: string): boolean {
  return /\b(?:reports?|records?|documents?|documented|logs?|notes?|recording|observations?|occurrences?|witness(?:es)?|interview)\b/i.test(
    value,
  );
}

function isMonitoringEvidence(value: string): boolean {
  return /\b(?:monitor|surveillance|scan|patrol|observation|watch|grounds?)\b/i.test(
    value,
  );
}

function normalizeAdjacentEvidenceOrder(args: {
  bodyParts: CoverLetterBodyParts;
  brief: CoverLetterBrief;
}): CoverLetterBodyParts {
  if (args.brief.contextClass !== "cv_adjacent" || args.brief.topEvidence.length === 0) {
    return args.bodyParts;
  }

  const evidenceSentences = args.brief.topEvidence
    .map(firstPersonEvidenceSentence)
    .filter(Boolean);
  if (evidenceSentences.length === 0) return args.bodyParts;
  const supportSentences = args.brief.supportEvidence
    .map(firstPersonEvidenceSentence)
    .filter(Boolean);
  const roleCompanyContext = adjacentRoleCompanyContext(args.brief.supportEvidence);
  const allCandidateEvidence = [
    ...args.brief.topEvidence,
    ...args.brief.supportEvidence,
  ];
  const durationContext = allCandidateEvidence
    .map(adjacentDurationContextPhrase)
    .find((item): item is string => Boolean(item));
  const reportingEvidence = allCandidateEvidence.find(isReportingEvidence);
  const monitoringEvidence = args.brief.topEvidence.find(
    (item) => item !== reportingEvidence && isMonitoringEvidence(item),
  ) ?? args.brief.supportEvidence.find(
    (item) => item !== reportingEvidence && isMonitoringEvidence(item),
  );
  const reportingSentence = reportingEvidence
    ? firstPersonEvidenceSentence(reportingEvidence)
    : "";
  const monitoringSentence = monitoringEvidence
    ? firstPersonEvidenceSentence(monitoringEvidence)
    : "";

  const anchors = adjacentOperatingAnchors(args.brief);
  const workSurfaces = selectAdjacentWorkSurfaces(args.brief);
  const workSurfaceText = listAsNaturalText(workSurfaces);
  const anchorText = listAsNaturalText(anchors);
  const opening =
    reportingSentence && durationContext
      ? `Across ${conciseDurationEvidenceLead(durationContext)}, ${reportingSentence.replace(/[.!?]$/u, "")}`
      : durationContext
        ? `Across ${durationContext}${roleCompanyContext ? `, ${roleCompanyContext}` : ""}, ${evidenceSentences[0]!.replace(/[.!?]$/u, "")}`
        : evidenceSentences[0] ?? args.bodyParts.opening;
  const proofSentences =
    reportingSentence && monitoringSentence
      ? [
          `That reporting came from active monitoring, including ${adjacentActionPhrase(monitoringSentence)}${roleCompanyContext ? ` ${roleCompanyContext}` : ""}`,
          "The point was not only to observe the work surface, but to leave a clear factual record for the next handoff",
        ]
      : [
          ...evidenceSentences
            .slice(1, 3)
            .filter((sentence) =>
              durationContext
                ? !normalizeProposalConstraintText(sentence).includes(
                    normalizeProposalConstraintText(durationContext),
                  )
                : true,
            ),
          ...(roleCompanyContext ? [] : supportSentences.slice(0, 2)),
          "That reporting and observation work kept facts clear for the next handoff",
        ];

  return {
    opening: ensureSentenceEnding(opening),
    proofBlock: joinSentences(proofSentences),
    employerValueBlock: ensureSentenceEnding(
      workSurfaceText
        ? `For an environment built around ${workSurfaceText}, that background matters because facts need to be noticed, written clearly, and handed off without confusion`
        : `That background matters because facts need to be noticed, written clearly, and handed off without confusion`,
    ),
    closeLine: ensureSentenceEnding(`I bring discipline around ${anchorText}.`),
  };
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

function compactBodyPartSentenceBudget(value: string, maxSentences: number): string {
  const compact = compactWhitespace(value);
  const sentences = splitSentences(compact);
  if (sentences.length === 0) return ensureSentenceEnding(compact);
  return joinSentences(sentences.slice(0, maxSentences));
}

function compactMistralPremiumBodyParts(
  bodyParts: CoverLetterBodyParts,
): CoverLetterBodyParts {
  return {
    opening: compactBodyPartSentenceBudget(bodyParts.opening, 1),
    proofBlock: compactBodyPartSentenceBudget(bodyParts.proofBlock, 2),
    employerValueBlock: compactBodyPartSentenceBudget(
      bodyParts.employerValueBlock,
      1,
    ),
    closeLine: compactBodyPartSentenceBudget(bodyParts.closeLine, 1),
  };
}

function hasBridgeWorkSurfaceOverlap(value: string, workSurfaces: string[]): boolean {
  const normalizedValue = normalizeProposalConstraintText(value);
  return workSurfaces.some((surface) => {
    const tokens = normalizeTokens(surface).filter((token) => token.length > 4);
    return tokens.some((token) => normalizedValue.includes(token));
  });
}

function normalizeMistralAdjacentBridgeBodyParts(args: {
  bodyParts: CoverLetterBodyParts;
  brief: CoverLetterBrief;
}): CoverLetterBodyParts {
  if (args.brief.contextClass !== "cv_adjacent") return args.bodyParts;
  const workSurfaces = selectAdjacentWorkSurfaces(args.brief);
  if (workSurfaces.length === 0) return args.bodyParts;

  const anchors = adjacentOperatingAnchors(args.brief);
  const anchorText = listAsNaturalText(anchors);
  const workSurfaceText = listAsNaturalText(workSurfaces.slice(0, 3));
  const employerValueBlock = hasBridgeWorkSurfaceOverlap(
    args.bodyParts.employerValueBlock,
    workSurfaces,
  )
    ? args.bodyParts.employerValueBlock
    : `For work centered on ${workSurfaceText}, the overlap is ${anchorText}.`;
  const closeLine = /^(?:I|My)\b/i.test(compactWhitespace(args.bodyParts.closeLine))
    ? args.bodyParts.closeLine
    : `I bring discipline around ${anchorText}.`;

  return {
    ...args.bodyParts,
    employerValueBlock: ensureSentenceEnding(employerValueBlock),
    closeLine: ensureSentenceEnding(closeLine),
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
}): Promise<unknown> {
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
              PREMIUM_WRITER_OUTPUT_V1_SCHEMA,
              "premium_writer_output_v1",
            ),
          },
        } as any,
        args.signal ? ({ signal: args.signal } as any) : undefined,
      );

      return PREMIUM_WRITER_OUTPUT_V1_SCHEMA.parse(
        response?.output_parsed ?? extractOpenAIJsonPayload(response),
      );
    }

    const response = await client.responses.create(
      requestBody as any,
      args.signal ? ({ signal: args.signal } as any) : undefined,
    );
    return PREMIUM_WRITER_OUTPUT_V1_SCHEMA.parse(
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
  return PREMIUM_WRITER_OUTPUT_V1_SCHEMA.parse(
    extractOpenAIJsonPayload(await response.json()),
  );
}

function extractPremiumMistralText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((entry: any) => (entry?.type === "text" ? entry.text : ""))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "";
}

function findPremiumEmbeddedJsonObjectCandidates(content: string): string[] {
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(content.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function parsePremiumMistralBodyPartsJson(
  content: string,
): CoverLetterBodyParts {
  const trimmed = content.trim();
  const tryParse = (value: string) =>
    PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(JSON.parse(value));

  try {
    return tryParse(trimmed);
  } catch {
    // Continue through fenced and embedded JSON fallbacks.
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) {
    return tryParse(fenced[1]);
  }

  const embedded = findPremiumEmbeddedJsonObjectCandidates(trimmed);
  if (embedded.length === 1) {
    return tryParse(embedded[0]!);
  }

  throw new Error(
    "Mistral premium cover-letter response did not contain one parseable JSON body-parts object.",
  );
}

export async function generatePremiumCoverLetterBodyPartsWithMistral(args: {
  apiKey: string;
  prompt: string;
  writerModel: string;
  signal?: AbortSignal;
}): Promise<CoverLetterBodyParts> {
  const model = new ChatMistralAI({
    apiKey: args.apiKey,
    modelName: args.writerModel,
    temperature: 0.2,
  });
  const response = await model.invoke(
    [
      new SystemMessage(
        "Return only a valid JSON object with keys opening, proofBlock, employerValueBlock, and closeLine. Do not include markdown, comments, greeting, signoff, or prose outside JSON.",
      ),
      new HumanMessage(args.prompt),
    ],
    args.signal ? ({ signal: args.signal } as any) : undefined,
  );
  const content = extractPremiumMistralText(response.content);
  return parsePremiumMistralBodyPartsJson(content);
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
        name: "premium_writer_output_v1",
        schema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
        strict: true,
        json_schema: {
          name: "premium_writer_output_v1",
          schema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
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
    "The previous output failed because it used adjacent role-mapping, future-impact language, meta-commentary, unsupported ownership verbs, or unsupported outcome claims.",
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
    "- high-ownership verbs unless the exact verb and scope are present in candidate evidence",
    "- managed, oversaw, owned, drove, directed, resolved, transformed, or spearheaded unless source-backed",
    "",
    "Use only:",
    "- factual candidate-backed actions",
    "- factual candidate-backed responsibilities",
    "- factual candidate-backed stakeholders",
    "- factual candidate-backed artifacts",
    "- factual candidate-backed scope, cadence, tools, metrics, projects, workflows, or deliverables",
    "- short CV-backed closeLine",
    "- lower-ownership verbs such as built, improved, maintained, documented, tracked, coordinated, partnered, supported, or contributed when source-backed",
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

function buildPremiumWriterOutputRepairPrompt(args: {
  brief: CoverLetterBrief;
  previousWriterOutput: PremiumWriterOutputV1;
  issues: string[];
}): string {
  return [
    "Repair PremiumWriterOutputV1 without changing claim strategy.",
    "The ClaimPlan owns strategy. Do not choose claims.",
    "Fix only invalid body parts.",
    "Allowed repairs: strip greeting/signoff, dedupe repeated sentences, add punctuation, remove duplicate closeLine from employerValueBlock, or fill empty closeLine with deterministic safe wording only if no unsupported claim is involved.",
    "Not allowed: unknown claim IDs, unknown fact IDs, unknown demand IDs, unsupported metrics, unsupported credentials, unsupported ownership upgrades, no_cv candidate-history claims, job demand as candidate experience, or company fluff as motivation.",
    "Return only PremiumWriterOutputV1 JSON.",
    `Validation issue codes: ${JSON.stringify(args.issues)}`,
    `ClaimPlan: ${JSON.stringify(args.brief.claimPlan)}`,
    `Previous PremiumWriterOutputV1: ${JSON.stringify(args.previousWriterOutput)}`,
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

  const factGraph = buildPremiumFactGraphV1({
    personalizationContext: args.personalizationContext,
    jobDescription: args.jobDescription,
    systemInferenceHints: args.systemInferenceHints,
  });
  const jobDemandGraph = buildPremiumJobDemandGraphV1(args.jobDescription);
  const allowedFactsPack = buildAllowedFactsPackFromFactGraph(factGraph);
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

  const claimPlan = buildPremiumClaimPlanV1({
    factGraph,
    jobDemandGraph,
    rankedEvidencePack,
    contextClass,
    preset: voicePreset,
    outputLanguage: args.outputLanguage,
    jobTitle: args.jobTitle,
  });
  const claimPlanIssues = validatePremiumClaimPlanV1({
    claimPlan,
    factGraph,
    jobDemandGraph,
  });
  if (claimPlanIssues.length > 0) {
    args.onFailure?.({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass,
      issues: claimPlanIssues.map((issue) => issue.code),
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
    claimPlan,
    factGraph,
    jobDemandGraph,
  });
  const prompt = buildPremiumCoverLetterPrompt({
    brief,
    generationControlsBlock: args.generationControlsBlock,
    writerProvider: args.writerProvider,
    writerModel: args.writerModel,
  });
  let parsedWriterOutput = parsePremiumWriterOutputV1({
    rawOutput: await args.writer({
      prompt,
      schema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
      signal: args.signal,
    }),
    claimPlan,
  });
  let writerOutput = parsedWriterOutput.writerOutput;
  let writerOutputIssues = parsedWriterOutput.legacyWrapped
    ? []
    : validatePremiumWriterOutputV1({
        writerOutput,
        claimPlan,
        factGraph,
        jobDemandGraph,
        brief,
      });
  if (writerOutputIssues.some((issue) => !issue.repairable)) {
    args.onFailure?.({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass,
      issues: writerOutputIssues.map((issue) => issue.code),
    });
    return null;
  }
  if (writerOutputIssues.length > 0) {
    const repairedParsedWriterOutput = parsePremiumWriterOutputV1({
      rawOutput: await args.writer({
        prompt: buildPremiumWriterOutputRepairPrompt({
          brief,
          previousWriterOutput: writerOutput,
          issues: writerOutputIssues.map((issue) => issue.code),
        }),
        schema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
        signal: args.signal,
      }),
      claimPlan,
    });
    const repairedWriterOutput = repairedParsedWriterOutput.writerOutput;
    writerOutputIssues = repairedParsedWriterOutput.legacyWrapped
      ? []
      : validatePremiumWriterOutputV1({
          writerOutput: repairedWriterOutput,
          claimPlan,
          factGraph,
          jobDemandGraph,
          brief,
        });
    if (writerOutputIssues.length > 0) {
      args.onFailure?.({
        stage: "validation",
        reason: "repair_failed_validation",
        contextClass,
        issues: writerOutputIssues.map((issue) => issue.code),
      });
      return null;
    }
    writerOutput = repairedWriterOutput;
  }

  let bodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
    toCoverLetterBodyParts(writerOutput),
  );

  let issues = validatePremiumCoverLetterBodyParts({ bodyParts, brief });
  const issueCodes = summarizeValidationIssueCodes(issues);
  const shouldRetryAdjacentDirectFit =
    brief.contextClass === "cv_adjacent" &&
    issueCodes.includes("adjacent_direct_fit");
  const shouldRetryMistralUnsupportedOwnership =
    isMistralWriterIdentity({
      writerProvider: args.writerProvider,
      writerModel: args.writerModel,
    }) && issueCodes.includes("unsupported_ownership_verb");
  const shouldTryAdjacentEvidenceNormalization =
    brief.contextClass === "cv_adjacent" &&
    !isQwenWriterIdentity({
      writerProvider: args.writerProvider,
      writerModel: args.writerModel,
    }) &&
    !isMistralWriterIdentity({
      writerProvider: args.writerProvider,
      writerModel: args.writerModel,
    }) &&
    issueCodes.some((issueCode) =>
      [
        "adjacent_direct_fit",
        "unsupported_ownership_verb",
        "unsupported_security_ownership",
      ].includes(issueCode),
    );

  if (issues.some((issue) => !issue.repairable)) {
    if (shouldTryAdjacentEvidenceNormalization) {
      const normalizedBodyParts = normalizeAdjacentEvidenceOrder({ bodyParts, brief });
      const normalizedIssues = validatePremiumCoverLetterBodyParts({
        bodyParts: normalizedBodyParts,
        brief,
      });
      if (normalizedIssues.length === 0) {
        bodyParts = normalizedBodyParts;
        issues = [];
      }
    }
  }

  if (issues.some((issue) => !issue.repairable)) {
    if (!shouldRetryAdjacentDirectFit && !shouldRetryMistralUnsupportedOwnership) {
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

  if (
    isMistralWriterIdentity({
      writerProvider: args.writerProvider,
      writerModel: args.writerModel,
    })
  ) {
    const compactBodyParts = normalizeMistralAdjacentBridgeBodyParts({
      bodyParts: compactMistralPremiumBodyParts(bodyParts),
      brief,
    });
    const compactIssues = validatePremiumCoverLetterBodyParts({
      bodyParts: compactBodyParts,
      brief,
    });
    if (compactIssues.length === 0) {
      bodyParts = compactBodyParts;
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
