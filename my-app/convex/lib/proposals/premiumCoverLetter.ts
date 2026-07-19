import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatMistralAI } from "@langchain/mistralai";

import {
  llmConfig,
  resolveOpenAIProposalReasoningEffort,
  type OpenAIProposalReasoningEffort,
} from "../../../config/llmConfig";
import {
  getDeterministicCopyLanguage,
  type ProposalOutputLanguage,
} from "./proposalOutput";
import {
  COVER_LETTER_ROLE_THESIS_PRIORITY_ORDER,
  normalizeProposalConstraintText,
} from "./proposalPlanner";
import {
  ENGLISH_DEFAULT_SIGNOFF,
  ENGLISH_SALUTATION,
  FRENCH_DEFAULT_SIGNOFF,
  FRENCH_SALUTATION,
} from "./proposalRenderer";
import {
  buildOpenAIResponsesRequest,
  extractOpenAIJsonPayload as extractOpenAIJsonPayloadFromTransport,
  generateOpenAIResponsesStructured,
  type OpenAIResponsesProviderResponseMetadata,
} from "./premiumCoverLetterOpenAITransport";
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

export type PremiumCoverLetterFinalProvenanceStatus =
  | "validated_final_text"
  | "validated_after_structured_repair"
  | "invalidated_by_late_mutation"
  | "untrusted_legacy_wrapped"
  | "untrusted_no_cv"
  | "untrusted_no_candidate_fact";

export type PremiumCoverLetterFinalProvenanceOrigin =
  | "provider_reported"
  | "provider_normalized"
  | "legacy_wrapped";

export type PremiumCoverLetterFinalProvenanceFact = {
  id: string;
  section: ClaimPlanSection;
  text: string;
  source: "cv";
  metrics: string[];
  entities: string[];
};

export type PremiumCoverLetterFinalProvenanceSection = {
  section: ClaimPlanSection;
  text: string;
  claimIds: string[];
  factIds: string[];
  demandIds: string[];
  candidateFactIds: string[];
  verifiedCandidateFactIds: string[];
};

export type PremiumCoverLetterFinalProvenance = {
  version: "premium_cover_letter_final_provenance_v1";
  status: PremiumCoverLetterFinalProvenanceStatus;
  origin: PremiumCoverLetterFinalProvenanceOrigin;
  contextClass: PremiumCoverLetterContextClass;
  candidateFactIds: string[];
  verifiedCandidateFactIds: string[];
  candidateFacts: PremiumCoverLetterFinalProvenanceFact[];
  sections: Record<ClaimPlanSection, PremiumCoverLetterFinalProvenanceSection>;
};

export type PremiumCoverLetterGenerationResult = {
  bodyParts: CoverLetterBodyParts;
  qualityShadow?: PremiumCoverLetterQualityShadowResult;
  qualityRepair?: PremiumCoverLetterQualityRepairTrace;
  finalProvenance?: PremiumCoverLetterFinalProvenance;
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

export type PremiumCoverLetterQualityRepairOutcome =
  | "disabled"
  | "not_needed"
  | "attempted_accepted"
  | "rejected_invalid_output"
  | "rejected_validation"
  | "rejected_provenance"
  | "rejected_not_improved"
  | "provider_error"
  | "canceled";

export type PremiumCoverLetterQualityRepairTrace = {
  enabled: boolean;
  eligible: boolean;
  attempted: boolean;
  outcome: PremiumCoverLetterQualityRepairOutcome;
  rejectionCategory?: Exclude<
    PremiumCoverLetterQualityRepairOutcome,
    "disabled" | "not_needed" | "attempted_accepted" | "canceled"
  >;
  qualityBefore: PremiumCoverLetterQualityShadowResult;
  qualityAfter?: PremiumCoverLetterQualityShadowResult;
  finalProvenanceStatus?: PremiumCoverLetterFinalProvenanceStatus;
  verifiedCandidateFactCount?: number;
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

export type PremiumCoverLetterProviderResponseMetadata =
  OpenAIResponsesProviderResponseMetadata;

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

export const PREMIUM_COVER_LETTER_PROMPT_V2_MISTRAL_VERSION =
  "premium_cover_letter_prompt_v2_mistral";

const PREMIUM_COVER_LETTER_PROMPT_V2_MISTRAL_GUIDANCE = [
  `Premium cover-letter prompt version: ${PREMIUM_COVER_LETTER_PROMPT_V2_MISTRAL_VERSION}.`,
  "This V2 block is Mistral-only and feature-flagged. It refines writing behavior without changing ClaimPlan, facts, provenance, schema, retries, or provider routing.",
  "Offer appropriation: read the job offer as prioritization context, then write from the candidate's strongest relevant evidence. Do not summarize, repeat, enumerate, or paraphrase the offer back to the employer.",
  "Requirement-to-candidate angle: transform each selected requirement into a candidate-side angle only when a CV fact supports the action, artifact, scope, stakeholder, tool, metric, environment, or operating habit.",
  "Missing requirements are gaps, omissions, or non-claims. Never convert a job demand, preferred qualification, compliance framework, credential, or employer goal into candidate experience.",
  "No job-offer listing: do not write a checklist of responsibilities, benefits, requirements, keywords, or company claims. Use job terms only when attached to structured CV evidence.",
  "Factuality lock: do not invent facts, credentials, numbers, timelines, seniority, ownership, outcomes, motivation, values alignment, or company-specific admiration.",
  "Atomic CV fact lock: CV facts are atomic and non-expandable. Reuse or narrowly paraphrase the exact CV fact; do not add plausible adjacent engineering, process, ownership, or system details unless explicitly present in candidate facts.",
  "Migration boundary: \"migration\" describes movement only. It does not imply system redesign, process ownership, component governance, component versioning, token architecture, release process ownership, tooling ownership, or system standardization unless those details are explicitly present in CV evidence.",
  "Design-system migration boundary: never infer component versioning, component governance, token architecture, release process ownership, tooling ownership, or system standardization from a design-system migration fact unless the CV evidence explicitly says that exact system or process detail.",
  "If the CV says only design-system migration across squads and improved release consistency across shared interface work, write only those facts or a narrow paraphrase. Do not expand them into component standards, versioning, governance, token work, tooling ownership, release ownership, or system standardization.",
  "Structured evidence lock: keep PremiumWriterOutputV1 provenance precise. Cite only claimIds, factIds, and demandIds actually used by that section; demandIds remain role context and never candidate proof.",
  "Keep candidate proof structured and visible through the JSON ids while making the prose read like a natural premium cover letter.",
  "Prefer one sharp CV-backed hiring case over comprehensive coverage of the offer.",
];

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
  "Never write meta-writing or provenance language such as 'I have described', 'I described', 'as described', 'the evidence shows', 'this section shows', 'work surface', or 'concrete bridge'. Write the real candidate action directly.",
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
  /(?:\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?(?:\s+|[-‑–—])(?:(?:customer|client)\s+)?(?:percent|points|hours|days|weeks|months|years|accounts?|clients?|projects?|tickets?|cases?|units?|stores?|sites?|teams?|squads?|markets?|campaigns?|experiments?|deliverables?|comptes?|projets?|jours?|semaines?|mois|années?|équipes?)\b)/i;
const RESPONSIBILITY_PATTERN =
  /\b(?:led|managed|owned|oversaw|coordinated|handled|supervised|supported|built|developed|implemented|maintained|operated|executed|delivered|trained|documented|reviewed|monitored)\b/i;
const WORKFLOW_PATTERN =
  /\b(?:workflow|process|operations?|handoffs?|sla|qa|quality|ticket|queue|dashboard|reports?|records?|logs?|recording|observations?|surveillance|patrols?|reporting|experiments?|testing|revision|coordination|support|intake|triage|delivery|planning|collaboration|tableau de bord|comptes? à risque|revues? trimestrielles?)\b/i;
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
const LOW_VALUE_JOB_ECHO_PATTERN =
  /\b(?:region and area management support staff|area management support staff|management support staff|growth and advancement|career growth|growth opportunities|advancement opportunities|guide growth|support staff)\b/i;
const REPORTING_BODY_PART_CLEANUP_REPLACEMENTS = [
  {
    pattern: /\breports?\s+were\s+completed\s+by\s+recording\b/gi,
    replacement: "I completed reports documenting",
  },
  {
    pattern: /\b(completed\s+reports?)\s+that\s+described\b/gi,
    replacement: "$1 documenting",
  },
  {
    pattern: /\b(completed\s+reports?)\s+by\s+recording\b/gi,
    replacement: "$1 documenting",
  },
  {
    pattern: /\b(reports?)\s+that\s+described\b/gi,
    replacement: "$1 documenting",
  },
] as const;
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
const NO_CV_HISTORY_CLAIM_PATTERNS = [
  /\b(?:in previous roles?|at my previous|during my|my experience|my background|experience includes|background includes|my experience includes|my background includes|i have (?:experience|worked|managed|handled|coordinated|maintained|supported|specialized)\b|i worked(?: as| at)?|i served as|i led|i manage|i managed|i coordinate|i coordinated|i handle|i handled|i maintain|i maintained|i support|i supported|i specialize|i specialize in|i developed|i built|i improve|i improved|i deliver|i delivered|i implement|i implemented|i operate|i operated|i supervise|i supervised|i train|i trained|i document|i documented|i review|i reviewed|i monitor|i monitored|i focus on|i bring (?:experience|background|skills?|discipline|strength|capability|ability|expertise)\b|i hold\b|i earned\b|i completed\b|i studied\b|i(?:'m| am)\s+(?:a|an)\s+(?:administrator|analyst|assistant|coordinator|engineer|lead|manager|officer|operator|professional|specialist|supervisor|worker)\b)\b/i,
  /\b(?:mon\s+(?:exp[ée]rience|parcours)|mes\s+exp[ée]riences|je\s+coordonne|je\s+g[eè]re|je\s+m(?:['’]|\s+)occupe\s+de|je\s+veille\s+(?:à|a)(?:\s|$)|je\s+suis\s+sp[eé]cialis[ée]e?(?:\s|$)|j(?:['’]|\s+)ai\s+(?:travaill[ée]e?|coordonn[ée]e?|g[ée]r[ée]e?|maintenu|d[ée]velopp[ée]e?|r[ée]alis[ée]e?|supervis[ée]e?|document[ée]e?|suivi))\b/iu,
] as const;

function hasNoCvHistoryClaim(value: string): boolean {
  return NO_CV_HISTORY_CLAIM_PATTERNS.some((pattern) => pattern.test(value));
}

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
    ? "J'aborderais ce travail avec attention, communication claire et suivi régulier."
    : "I would approach the work with care, clear communication, and steady follow-through.";
}

function isGenericPremiumClosingLine(value: string): boolean {
  const normalized = compactWhitespace(value);
  if (!normalized) return false;
  return /\b(?:i\s+(?:welcome|would\s+(?:welcome|be\s+glad|be\s+happy))\s+(?:the\s+)?(?:opportunity|chance)?\s*(?:to\s+)?(?:discuss|speak|talk)\s+(?:the\s+)?(?:position|role|opportunity)\s+further|i\s+(?:welcome|would\s+(?:welcome|be\s+glad|be\s+happy))\s+(?:the\s+)?(?:opportunity|chance)?\s*(?:to\s+)?(?:discuss|speak|talk)\s+my\s+interest\s+in\s+(?:the\s+)?(?:position|role|opportunity)|(?:would\s+)?welcome\s+the\s+(?:opportunity|chance)\s+to\s+(?:discuss|speak)\s+(?:the\s+)?(?:position|role|opportunity)(?:\s+further)?|discuss\s+(?:the\s+)?(?:position|role|opportunity)\s+further|speak\s+further\s+about\s+(?:the\s+)?(?:position|role|opportunity)|je\s+serais\s+(?:ravi|ravie|heureux|heureuse)\s+(?:d['’]|de\s+(?:pouvoir\s+)?)(?:en\s+)?(?:échanger|discuter)|au\s+plaisir\s+d['’]échanger(?:\s+davantage)?(?:\s+(?:sur|à\s+propos\s+de|avec\s+vous))?)\b/iu.test(
    normalized,
  );
}

function preserveGroundedPremiumClosingClause(value: string): string {
  const normalized = compactWhitespace(value);
  const clauseBoundaries = [
    /,\s+(?=(?:and\s+)?(?:i\s+)?(?:welcome|would\s+(?:welcome|be\s+glad|be\s+happy))\b)/giu,
    /\s+and\s+(?=(?:i\s+)?(?:welcome|would\s+(?:welcome|be\s+glad|be\s+happy))\b)/giu,
    /,\s+(?=(?:et\s+)?je\s+serais\s+(?:ravi|ravie|heureux|heureuse)\b)/giu,
    /\s+et\s+(?=je\s+serais\s+(?:ravi|ravie|heureux|heureuse)\b)/giu,
    /,\s+(?=(?:et\s+)?au\s+plaisir\s+d['’]échanger\b)/giu,
    /\s+et\s+(?=au\s+plaisir\s+d['’]échanger\b)/giu,
  ];

  for (const boundaryPattern of clauseBoundaries) {
    const match = boundaryPattern.exec(normalized);
    if (!match) continue;
    const suffix = normalized.slice(match.index + match[0].length);
    if (!isGenericPremiumClosingLine(suffix)) continue;
    return ensureSentenceEnding(normalized.slice(0, match.index));
  }

  return normalized;
}

function buildEvidenceGroundedCloseLine(brief: CoverLetterBrief): string {
  const deterministicLanguage = getDeterministicCopyLanguage(brief.language);
  if (!deterministicLanguage) return "";
  if (brief.contextClass === "no_cv") {
    return resolveCloseFallback(brief.language);
  }

  const anchors = adjacentOperatingAnchors(brief, brief.language, false).slice(
    0,
    3,
  );
  if (anchors.length === 0) {
    return deterministicLanguage === "fr"
      ? "Cette expérience continue de nourrir ma pratique professionnelle."
      : "That experience continues to inform my work.";
  }
  const anchorText = listAsNaturalTextForLanguage(anchors, brief.language);
  if (deterministicLanguage === "fr") {
    return ensureSentenceEnding(`J'apporte de la rigueur dans ${anchorText}`);
  }
  return ensureSentenceEnding(`I bring discipline around ${anchorText}`);
}

function repairGenericPremiumClosingLine(args: {
  closeLine: string;
  brief: CoverLetterBrief;
}): string {
  const specificSentences = splitSentences(args.closeLine)
    .map(preserveGroundedPremiumClosingClause)
    .filter((sentence) => !isGenericPremiumClosingLine(sentence));
  if (specificSentences.length > 0) {
    return joinSentences(specificSentences);
  }
  return buildEvidenceGroundedCloseLine(args.brief) || args.closeLine;
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

export function isCoverLetterPremiumPromptV2Enabled(
  rawValue:
    | string
    | undefined = process.env.cover_letter_premium_prompt_v2 ??
    process.env.COVER_LETTER_PREMIUM_PROMPT_V2 ??
    process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2,
): boolean {
  const normalized = compactWhitespace(rawValue ?? "").toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

export function isCoverLetterQualityRepairV1Enabled(
  rawValue:
    | string
    | undefined = process.env.ENABLE_COVER_LETTER_QUALITY_REPAIR_V1,
): boolean {
  const normalized = compactWhitespace(rawValue ?? "").toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

export function isPremiumCoverLetterPromptV2MistralEnabled(args: {
  writerProvider?: PremiumCoverLetterWriterProvider;
  rawFlagValue?: string;
}): boolean {
  return (
    args.writerProvider === "mistral" &&
    isCoverLetterPremiumPromptV2Enabled(args.rawFlagValue)
  );
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
  const cvBackedOperationalFacts =
    args.contextClass !== "no_cv"
      ? scored
          .map((entry) => entry.fact)
          .filter(
            (fact) =>
              fact.source === "cv" &&
              !isWeakOrDoNotLeadWith(fact) &&
              !isSecondaryQualification(fact) &&
              (QUANTIFIED_PATTERN.test(fact.text) ||
                fact.category === "achievement" ||
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
          (QUANTIFIED_PATTERN.test(fact.text) ||
            strongestEvidence.length >= cvBackedOperationalFacts.length)))
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

function dedupeFactNodes(facts: FactNodeV1[]): FactNodeV1[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    if (seen.has(fact.id)) return false;
    seen.add(fact.id);
    return true;
  });
}

function selectDistinctPremiumProofFacts(args: {
  cvFacts: FactNodeV1[];
  primaryCvFact: FactNodeV1 | undefined;
}): FactNodeV1[] {
  const concreteFacts = dedupeFactNodes(args.cvFacts).filter(
    (fact) =>
      fact.id !== args.primaryCvFact?.id &&
      isConcretePremiumProofFact(fact),
  );
  const primaryMetrics = new Set(args.primaryCvFact?.metrics ?? []);
  const factsWithDistinctMetrics = concreteFacts.filter((fact) =>
    fact.metrics.every((metric) => !primaryMetrics.has(metric)),
  );
  const selected =
    factsWithDistinctMetrics.length > 0 ? factsWithDistinctMetrics : concreteFacts;
  return selected.slice(0, 2);
}

function isConcretePremiumProofFact(fact: FactNodeV1): boolean {
  return (
    fact.category === "achievement" ||
    fact.category === "responsibility" ||
    fact.category === "workflow"
  );
}

type PremiumClaimPlanEditorialPolicyArgs = {
  contextClass: PremiumCoverLetterContextClass;
  outputLanguage: ProposalOutputLanguage;
  cvFacts: FactNodeV1[];
  primaryCvFact: FactNodeV1 | undefined;
  secondaryCvFact: FactNodeV1 | undefined;
  sectionCvFacts: FactNodeV1[];
  roleContextDemandIds: string[];
};

type PremiumClaimPlanEditorialPolicy = Readonly<{
  openingDemandIds: string[];
  openingGuideline: string;
  proofFacts: FactNodeV1[];
  proofGuideline: string;
  closeDemandIds: string[];
  closeGuideline: string;
}>;

function resolveLegacyPremiumProofFacts(
  args: PremiumClaimPlanEditorialPolicyArgs,
): FactNodeV1[] {
  if (args.sectionCvFacts.length > 0) return args.sectionCvFacts;
  if (args.secondaryCvFact) return [args.secondaryCvFact];
  return args.primaryCvFact ? [args.primaryCvFact] : [];
}

function buildLegacyPremiumClaimPlanEditorialPolicy(
  args: PremiumClaimPlanEditorialPolicyArgs,
  proofFacts: FactNodeV1[],
): PremiumClaimPlanEditorialPolicy {
  return {
    openingDemandIds: [],
    openingGuideline:
      args.contextClass === "cv_adjacent"
        ? "Open with a CV-backed operating strength, not direct target-role fit."
        : "Open with the strongest CV-backed evidence.",
    proofFacts,
    proofGuideline:
      "Develop one CV-backed proof point without upgrading ownership or metrics.",
    closeDemandIds: [],
    closeGuideline:
      args.contextClass === "cv_adjacent"
        ? "Restate CV-backed operating strengths only."
        : "Restate grounded strengths only.",
  };
}

function buildDeterministicPremiumClaimPlanEditorialPolicy(
  args: PremiumClaimPlanEditorialPolicyArgs,
  legacyProofFacts: FactNodeV1[],
): PremiumClaimPlanEditorialPolicy {
  const distinctProofFacts = selectDistinctPremiumProofFacts({
    cvFacts: args.cvFacts,
    primaryCvFact: args.primaryCvFact,
  });
  const hasAssignedRoleContext = args.roleContextDemandIds.length > 0;
  const hasDistinctProof = distinctProofFacts.length > 0;
  const hasConcreteProof = args.cvFacts.some(isConcretePremiumProofFact);
  return {
    openingDemandIds: args.roleContextDemandIds,
    openingGuideline: hasAssignedRoleContext
      ? args.contextClass === "cv_adjacent"
        ? "Open from the candidate's relevant experience, then relate it to the assigned responsibility without claiming direct target-role experience or teaching the employer how its work functions."
        : "Open from the candidate's relevant experience, then relate it to the assigned responsibility without teaching the employer how its work functions."
      : args.contextClass === "cv_adjacent"
        ? "No role responsibility is assigned; open with concise professional context around the strongest CV-backed operating proof without claiming direct target-role experience or inventing job context."
        : "No role responsibility is assigned; open with concise professional context around the strongest CV-backed evidence without inventing job context.",
    proofFacts: hasDistinctProof ? distinctProofFacts : legacyProofFacts,
    proofGuideline: hasDistinctProof
      ? "Develop the distinct assigned CV-backed proof without repeating the opening evidence or upgrading ownership or metrics."
      : hasConcreteProof
        ? "Only one concrete CV proof is available; develop a different supported aspect of it once without restating its metric or result or upgrading ownership."
        : "No concrete CV proof is available; use the assigned CV context only as bounded background, keep the section concise, and do not invent actions, ownership, metrics, or results.",
    closeDemandIds: args.roleContextDemandIds,
    closeGuideline: hasAssignedRoleContext
      ? args.contextClass === "cv_adjacent"
        ? "Close with one specific CV-backed operating contribution to the assigned responsibility, without a skills inventory or future-impact promise."
        : "Close with one specific evidence-grounded contribution to the assigned responsibility, without a skills inventory."
      : args.contextClass === "cv_adjacent"
        ? "Close with one specific CV-backed operating contribution, without inventing job context, a skills inventory, or a future-impact promise."
        : "Close with one specific evidence-grounded contribution, without inventing job context or using a skills inventory.",
  };
}

function resolvePremiumClaimPlanEditorialPolicy(
  args: PremiumClaimPlanEditorialPolicyArgs,
): PremiumClaimPlanEditorialPolicy {
  const legacyProofFacts = resolveLegacyPremiumProofFacts(args);
  if (
    args.contextClass === "no_cv" ||
    getDeterministicCopyLanguage(args.outputLanguage) === null
  ) {
    return buildLegacyPremiumClaimPlanEditorialPolicy(args, legacyProofFacts);
  }
  return buildDeterministicPremiumClaimPlanEditorialPolicy(
    args,
    legacyProofFacts,
  );
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
  const editorialPolicy = resolvePremiumClaimPlanEditorialPolicy({
    contextClass: args.contextClass,
    outputLanguage: args.outputLanguage,
    cvFacts,
    primaryCvFact,
    secondaryCvFact,
    sectionCvFacts,
    roleContextDemandIds,
  });

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
          ? ["interested", "discuss", "approach"]
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
            editorialPolicy.openingDemandIds,
            "source_backed",
            editorialPolicy.openingGuideline,
          ),
          makeClaim(
            "proofBlock",
            editorialPolicy.proofFacts,
            [],
            "source_backed",
            editorialPolicy.proofGuideline,
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
            editorialPolicy.closeDemandIds,
            "source_backed",
            editorialPolicy.closeGuideline,
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
  const promptVersionGuidance = resolvePremiumCoverLetterPromptVersionGuidance({
    writerProvider: args.writerProvider,
  });
  const editorialQualityGuidance =
    resolvePremiumCoverLetterEditorialQualityGuidance(args.brief);
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
    "lowValueChecklist is diagnostic-only. Do not quote it, paraphrase it, or use it as employer-value language in the letter.",
    "A JD keyword, tool, certification, compliance framework, domain, or responsibility may appear as candidate experience only when the CV supports that exact capability. Bind ATS terms to a concrete action or result; never list them. Bind ATS and JD terms to a concrete CV-backed action, artifact, responsibility, or result. Never use a JD keyword as a floating adjective or implied experience.",
    ...(companyValuesPack
      ? [
          "Company values are bounded secondary context only: use at most one explicit bridge, only when grounded and tied to source-backed candidate evidence; never replace stronger proof or infer personal alignment.",
        ]
      : []),
    "Preset affects rhetorical texture only. It must not change truthfulness, claim strength, or evidence priority. Do not change ownership, metrics, tools, responsibilities, or boundaries.",
    "Across cv_direct and cv_adjacent modes, sound like a person making a case, not a memo.",
    "Avoid clunky inanimate-object phrasing and evaluator/meta phrases like 'the evidence I would bring'.",
    "Do not narrate the writing plan or provenance. Never write 'I have described', 'I described', 'as described', 'the evidence shows', 'this section shows', 'this letter shows', 'the claim is', 'work surface', or 'concrete bridge'.",
    "Do not use self-scoring or section-label openings such as 'my strongest match', 'my best match', 'the strongest evidence', 'my fit for this role', or 'the main reason I am a fit'.",
    ...(args.brief.contextClass !== "no_cv"
      ? [
          "Use one cautious employer-facing implication. Avoid formula bridges ('That is useful...', 'That matters...', 'day-to-day depends...', 'those habits matter'); write the concrete team consequence plainly.",
        ]
      : []),
    ...(args.brief.contextClass === "no_cv"
      ? [
          "Use one cautious employer-facing implication. Avoid formula bridges ('That is useful...', 'That matters...', 'day-to-day depends...', 'those habits matter'); write the concrete team consequence plainly.",
          "closeLine: concise evidence-grounded contribution, not generic interview-request wording.",
        ]
      : []),
    presetGuidance,
    args.generationControlsBlock,
    ...promptVersionGuidance,
    ...editorialQualityGuidance,
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

function resolvePremiumEditorialAllocationState(brief: CoverLetterBrief): {
  hasAssignedRoleContext: boolean;
  hasConcreteProof: boolean;
  hasDistinctProof: boolean;
} {
  if (!brief.claimPlan) {
    return {
      hasAssignedRoleContext: true,
      hasConcreteProof: true,
      hasDistinctProof: true,
    };
  }
  const openingClaim = claimForSection(brief.claimPlan, "opening");
  const proofClaim = claimForSection(brief.claimPlan, "proofBlock");
  const openingFactIds = new Set(openingClaim?.factIds ?? []);
  return {
    hasAssignedRoleContext: (openingClaim?.demandIds.length ?? 0) > 0,
    hasConcreteProof:
      proofClaim?.requiredElements.some((text) =>
        ["achievement", "responsibility", "workflow"].includes(
          classifyCvFactCategory(text, "cv"),
        ),
      ) ?? false,
    hasDistinctProof:
      (proofClaim?.factIds.length ?? 0) > 0 &&
      (proofClaim?.factIds.every((factId) => !openingFactIds.has(factId)) ??
        false),
  };
}

function buildNaturalCvBackedEditorialGuidance(brief: CoverLetterBrief): string[] {
  const { hasAssignedRoleContext, hasConcreteProof, hasDistinctProof } =
    resolvePremiumEditorialAllocationState(brief);
  return [
    "CV-backed editorial quality contract: write a natural first paragraph rooted in the candidate's relevant experience, not a résumé bullet, standalone metric, abstract maxim, or lesson about the employer's work.",
    hasAssignedRoleContext
      ? "Connect that experience to the assigned responsibility as role context, never candidate history; do not use generic setups such as 'X is most valuable when...' or 'X demande/exige...' before the proof."
      : "No role responsibility is assigned; open with concise professional context around the assigned CV proof and do not invent or select unassigned job context.",
    hasDistinctProof
      ? "Use the distinct fact assigned to proofBlock and never repeat an opening metric, result, employer, duty, or cadence."
      : hasConcreteProof
        ? "Only one concrete CV proof is assigned; develop a different supported aspect of it once without restating the same metric or result."
        : "No concrete CV proof is assigned; use the assigned CV context only as bounded background, keep the proof section concise, and do not invent actions, ownership, metrics, or results.",
    hasAssignedRoleContext
      ? "Every sentence must contain a complete thought with a subject and finite predicate, never a CV fragment; explain why the selected evidence matters to the assigned responsibility rather than stating abstract advice; close with one specific evidence-grounded contribution to the assigned responsibility, not a skills inventory or résumé-summary label."
      : "Every sentence must contain a complete thought with a subject and finite predicate, never a CV fragment; explain the concrete value of the selected evidence without inventing job context or stating abstract advice; close with one specific evidence-grounded contribution, not a skills inventory or résumé-summary label.",
  ];
}

function resolvePremiumCoverLetterEditorialQualityGuidance(
  brief: CoverLetterBrief,
): string[] {
  if (brief.contextClass === "no_cv") return [];

  const shared =
    "CV-backed editorial quality contract: build one hiring case, not a CV inventory; use one role-specific opening, select one or two concrete candidate proofs, state why each proof is relevant to one top responsibility, and end with one short evidence-grounded sentence rather than an interview request.";
  const naturalCvBackedShared = buildNaturalCvBackedEditorialGuidance(brief);

  const deterministicLanguage = getDeterministicCopyLanguage(brief.language);
  if (deterministicLanguage === "fr") {
    return [
      ...naturalCvBackedShared,
      "French editorial contract: compose in idiomatic professional French, not translated English cadence; avoid 'je serais ravi de', 'se traduit par', 's'aligne avec', 'apporter de la valeur', 'mon socle', repeated discussion invitations, and untranslated handoffs, rollouts, or enterprise when normal French equivalents exist.",
    ];
  }

  if (deterministicLanguage === "en") {
    return [
      ...naturalCvBackedShared,
      "English editorial contract: use concise professional English, direct verbs, and concrete nouns; avoid résumé-summary cadence, 'I am writing to apply', generic enthusiasm, alignment claims, and discussion invitations.",
    ];
  }

  return [shared];
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
        "- Never use meta-writing language such as \"I have described\", \"I described\", \"as described\", \"the evidence shows\", \"this section shows\", \"work surface\", or \"concrete bridge\".",
        "- Safe bridge examples: \"That background is relevant to work where clear handoffs, documentation, and reporting matter.\" \"The overlap is strongest around coordination, reporting, and documentation.\"",
        "- Forbidden bridge examples: \"I have direct experience as an Implementation Analyst.\" \"I can own your implementation workflows.\" \"This will improve your delivery speed.\" \"I am passionate about your mission.\"",
        "- Do not use employerValueBlock as another evidence-only sentence when the brief includes topResponsibilities or workContext; use one restrained employer-facing bridge instead.",
        "- Do not repeat duration, employers, or the same evidence anchor in closeLine.",
        "- closeLine must be first person and must restate operating strengths, such as \"I bring discipline around accurate records, steady monitoring, and clear handoffs.\"",
        "- If evidence is limited, return shorter body parts instead of filling space.",
      ];
    }
    if (args.contextClass === "no_cv") {
      return [
        "Mistral no_cv contract:",
        "- There is no CV evidence. Operate with three layers only: JOB SURFACE, INTENT LAYER, and CV EVIDENCE when present.",
        "- Never convert JOB SURFACE into CANDIDATE EXPERIENCE.",
        "- Job descriptions can become neutral role explanation, intent statements, or conditional approach statements only.",
        "- Keep a modest first-person candidate voice without claiming prior work, skills, habits, capability, or worker identity.",
        "- Allowed no_cv stems include \"I am interested in this role because\", \"The role involves\", \"The position appears to focus on\", and \"I would approach this work by\".",
        "- Use any \"I would be glad to discuss\" sentence only once, in closeLine.",
        "- Forbidden no_cv stems include \"I coordinate\", \"I manage\", \"I handle\", \"I maintain\", \"I focus on\", \"I bring experience\", \"My background is\", \"I specialize\", and \"I have worked\".",
        "- opening: one sentence expressing interest or intent tied to the role's work surface.",
        "- proofBlock: one sentence about what the role requires operationally, not what the candidate has done.",
        "- employerValueBlock: one sentence about the practical consequence for the team, not another discussion sentence.",
        "- closeLine: one modest first-person sentence such as \"I would be glad to discuss how I would approach this work with care and follow-through.\"",
        "- Do not begin closeLine with \"Experience includes\", \"Background includes\", or a detached task noun.",
        "- Do not claim achievements, tools used, managed workflows, maintained systems, or completed tasks.",
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
      "For no_cv, there is no supported candidate history. Use job-offer work surfaces and candidate intent only, never prior history.",
      "For no_cv, job descriptions can become neutral role explanation, intent statements, or conditional approach statements only; never convert job surface into candidate experience.",
      "For no_cv, stay in first person and sound like a candidate, not a role summary or memo; vary the opening and avoid repeated stems like 'I am drawn to work...', 'I am applying... with a clear focus on...', 'This role centers on...', or 'The highest-value work...'; do not claim prior roles, achievements, credentials, tool usage, skills, habits, worker identity, readiness, or impact; keep employerValueBlock on operational consequence and closeLine on modest first-person intent.",
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
      "- Never use meta-writing language such as \"I have described\", \"I described\", \"as described\", \"the evidence shows\", \"this section shows\", \"work surface\", or \"concrete bridge\".",
      "- Do not use \"this role,\" \"your needs,\" \"helps with,\" \"can help,\" \"can contribute,\" \"translates,\" \"aligns,\" \"smoothly,\" or \"efficiently.\"",
      "- Do not use \"I can help\" or \"I can support\" in adjacent cases; use a cautious work-context bridge instead.",
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
      "- Do not use \"I can help\" or \"I can support\" in adjacent cases; use a cautious work-context bridge instead.",
      "- Every body part should include at least one concrete CV-backed anchor when available.",
      "- If evidence is limited, return shorter body parts instead of filling space.",
    ];
  }
  return [
    "Body-part rules: complete natural sentences only; no greeting, signoff, markdown, bullets, generic excitement, mission praise, defensive gaps, keyword lists, clipped fragments like 'St.' or guessed facility/team names.",
    "Opening: position through the strongest relevant evidence, not generic fit language. ProofBlock: develop top evidence first. EmployerValueBlock: move directly to an employer-facing implication from the candidate evidence; do not name company hierarchy, career-growth language, support-staff boilerplate, or the target role title as proof. Use topResponsibilities before requirements. Never echo preferredQualifications or checklist noise. CloseLine: one short role-specific sentence.",
  ];
}

function resolvePremiumCoverLetterPromptVersionGuidance(args: {
  writerProvider?: PremiumCoverLetterWriterProvider;
}): string[] {
  return isPremiumCoverLetterPromptV2MistralEnabled({
    writerProvider: args.writerProvider,
  })
    ? PREMIUM_COVER_LETTER_PROMPT_V2_MISTRAL_GUIDANCE
    : [];
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
    | "meta_prose"
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

export type PremiumCoverLetterModelRepairRequiredDiagnostic = Readonly<{
  stage: "writer_output_validation" | "body_parts_validation";
  issues: readonly string[];
}>;

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
    | "meta_prose"
    | "empty_section"
    | "greeting_leakage"
    | "signoff_leakage";
  section?: ClaimPlanSection;
  claimId?: string;
  message: string;
  repairable: boolean;
};

export type PremiumCoverLetterQualityShadowIssueCode =
  | "meta_prose"
  | "generic_tone"
  | "factual_inventory"
  | "weak_employer_argument"
  | "low_value_job_echo"
  | "low_specificity"
  | "too_verbose";

export type PremiumCoverLetterQualityShadowResult = {
  passed: boolean;
  score: number;
  issues: PremiumCoverLetterQualityShadowIssueCode[];
};

const REPAIRABLE_PREMIUM_COVER_LETTER_QUALITY_SHADOW_ISSUES =
  new Set<PremiumCoverLetterQualityShadowIssueCode>([
    "meta_prose",
    "generic_tone",
    "factual_inventory",
    "weak_employer_argument",
    "low_value_job_echo",
    "too_verbose",
  ]);

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

  const rawRecord =
    args.rawOutput && typeof args.rawOutput === "object" && !Array.isArray(args.rawOutput)
      ? (args.rawOutput as Record<string, unknown>)
      : null;
  const legacyBodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
    rawRecord?.bodyParts ?? args.rawOutput,
  );
  return {
    writerOutput: wrapLegacyBodyPartsAsPremiumWriterOutputV1({
      bodyParts: legacyBodyParts,
      claimPlan: args.claimPlan,
    }),
    legacyWrapped: true,
  };
}

function parseCoverLetterBodyPartsWriterPayload(rawOutput: unknown): CoverLetterBodyParts {
  const rawRecord =
    rawOutput && typeof rawOutput === "object" && !Array.isArray(rawOutput)
      ? (rawOutput as Record<string, unknown>)
      : null;
  return PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
    rawRecord?.bodyParts ?? rawOutput,
  );
}

const PREMIUM_ENGLISH_CAPABILITY_VERB_FAMILIES = [
  { source: "lead(?:s|ing)?|led", canonical: "lead" },
  { source: "manag(?:e|es|ed|ing)", canonical: "manage" },
  { source: "own(?:s|ed|ing)?", canonical: "own" },
  { source: "build(?:s|ing)?|built", canonical: "build" },
  { source: "improv(?:e|es|ed|ing)", canonical: "improve" },
  { source: "drive|drives|drove|driven|driving", canonical: "drive" },
  { source: "deliver(?:s|ed|ing)?", canonical: "deliver" },
  { source: "maintain(?:s|ed|ing)?", canonical: "maintain" },
  { source: "coordinat(?:e|es|ed|ing)", canonical: "coordinate" },
  { source: "handl(?:e|es|ed|ing)", canonical: "handle" },
  { source: "track(?:s|ed|ing)?", canonical: "track" },
  { source: "answer(?:s|ed|ing)?", canonical: "answer" },
  { source: "updat(?:e|es|ed|ing)", canonical: "update" },
  { source: "prepar(?:e|es|ed|ing)", canonical: "prepare" },
  { source: "document(?:s|ed|ing)?", canonical: "document" },
  { source: "design(?:s|ed|ing)?", canonical: "design" },
  { source: "analy[sz](?:e|es|ed|ing)", canonical: "analyze" },
  { source: "mentor(?:s|ed|ing)?", canonical: "mentor" },
  { source: "supervis(?:e|es|ed|ing)", canonical: "supervise" },
  { source: "support(?:s|ed|ing)?", canonical: "support" },
  { source: "assist(?:s|ed|ing)?", canonical: "assist" },
  { source: "monitor(?:s|ed|ing)?", canonical: "monitor" },
  { source: "report(?:s|ed|ing)?", canonical: "report" },
  { source: "keep|keeps|kept|keeping", canonical: "keep" },
  { source: "develop(?:s|ed|ing)?", canonical: "develop" },
  { source: "creat(?:e|es|ed|ing)", canonical: "create" },
  { source: "review(?:s|ed|ing)?", canonical: "review" },
  { source: "operat(?:e|es|ed|ing)", canonical: "operate" },
  { source: "collaborat(?:e|es|ed|ing)", canonical: "collaborate" },
  { source: "implement(?:s|ed|ing)?", canonical: "implement" },
  { source: "schedul(?:e|es|ed|ing)", canonical: "schedule" },
] as const;
const CANDIDATE_HISTORY_ENGLISH_ACTION_VERB_SOURCE =
  PREMIUM_ENGLISH_CAPABILITY_VERB_FAMILIES.map(
    ({ source }) => `(?:${source})`,
  ).join("|");
const CANDIDATE_HISTORY_ENGLISH_COPULAR_SOURCE =
  "(?:i\\s+(?:am|was|have\\s+been)|i['’](?:m|ve\\s+been))";
const PREMIUM_ENGLISH_CAPABILITY_VERB_PATTERNS =
  PREMIUM_ENGLISH_CAPABILITY_VERB_FAMILIES.map(({ source, canonical }) => ({
    pattern: new RegExp(`^(?:${source})$`, "u"),
    canonical,
  }));
const CANDIDATE_HISTORY_FRENCH_PAST_ACTION_SOURCE =
  "dirigé(?:e|s|es)?|géré(?:e|s|es)?|construit(?:e|s|es)?|créé(?:e|s|es)?|amélioré(?:e|s|es)?|livré(?:e|s|es)?|maintenu(?:e|s|es)?|coordonné(?:e|s|es)?|traité(?:e|s|es)?|suivi(?:e|s|es)?|documenté(?:e|s|es)?|piloté(?:e|s|es)?|assuré(?:e|s|es)?|pris(?:e|es)?\\s+en\\s+charge";
const CANDIDATE_HISTORY_FRENCH_PRESENT_ACTION_SOURCE =
  "dirige|gère|construis|crée|améliore|livre|maintiens|coordonne|traite|documente|pilote|assure|prends\\s+en\\s+charge";
const CANDIDATE_HISTORY_FRENCH_FIRST_PERSON_ACTION_SOURCE =
  `(?:j['’]\\s*ai\\s+(?:${CANDIDATE_HISTORY_FRENCH_PAST_ACTION_SOURCE})|(?:je\\s+|j['’]\\s*)(?:${CANDIDATE_HISTORY_FRENCH_PRESENT_ACTION_SOURCE}))`;
const CANDIDATE_HISTORY_FRENCH_OWNERSHIP_PREFIX_SOURCE =
  "(?:responsable|en\\s+charge)\\s+(?:(?:de|du|des)\\s+|d['’]\\s*)";
const PREMIUM_FRENCH_DEMAND_LEADER_SOURCE =
  "diriger|gérer|construire|créer|améliorer|livrer|maintenir|coordonner|traiter|suivre|documenter|piloter|assurer|prendre\\s+en\\s+charge|être";
const PREMIUM_OWNERSHIP_DEMAND_PREFIX_PATTERN =
  new RegExp(
    `^(?:(?:responsible\\s+for|in\\s+charge\\s+of|accountable\\s+for|tasked\\s+with)\\s+|${CANDIDATE_HISTORY_FRENCH_OWNERSHIP_PREFIX_SOURCE})`,
    "iu",
  );
const PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE =
  "(?=$|[,.!?;:]|\\s+(?:for|at|across|with|within|during|pour|chez|dans|pendant|lors\\s+(?:de|du|des)|auprès\\s+de)\\b)";
const PREMIUM_GENERATED_DEMAND_SURFACE_BOUNDARY_SOURCE =
  "(?=$|[,.!?;:])";

function extractPremiumDemandLeaderVerb(value: string): string | null {
  const jobOfferLeader = extractJobOfferLeaderVerb(value);
  if (jobOfferLeader) return jobOfferLeader;
  const frenchMatch = compactWhitespace(value).match(
    new RegExp(`^(${PREMIUM_FRENCH_DEMAND_LEADER_SOURCE})\\b`, "iu"),
  );
  return frenchMatch?.[1]?.toLowerCase() ?? null;
}

function resolvePremiumDemandSurface(value: string): {
  surface: string;
  leader: string | null;
  objectSurface: string;
  ownershipPrefixStripped: boolean;
} | null {
  const surface = compactWhitespace(value).replace(/[.!?]$/u, "");
  if (!surface) return null;
  const englishLeaderMatch = surface.match(JOB_OFFER_LIST_LEADER_PATTERN);
  const leader =
    englishLeaderMatch?.[1]?.toLowerCase() ??
    extractPremiumDemandLeaderVerb(value);
  const withoutLeader = englishLeaderMatch?.[0]
    ? surface.slice(englishLeaderMatch[0].length).trim()
    : leader
      ? surface.replace(new RegExp(`^${escapeRegExp(leader)}\\s+`, "iu"), "")
      : surface;
  const objectSurface = withoutLeader.replace(
    PREMIUM_OWNERSHIP_DEMAND_PREFIX_PATTERN,
    "",
  );
  if (!objectSurface) return null;
  return {
    surface,
    leader,
    objectSurface,
    ownershipPrefixStripped: objectSurface !== withoutLeader,
  };
}

function usesJobDemandAsCandidateExperience(args: {
  generatedText: string;
  referencedDemands: JobDemandNodeV1[];
  referencedFacts: FactNodeV1[];
}): boolean {
  const compact = compactWhitespace(args.generatedText);
  return args.referencedDemands.some((demand) => {
    if (
      args.referencedFacts.some((fact) =>
        premiumCandidateFactSupportsDemand({
          fact,
          demand,
          generatedText: compact,
        }),
      )
    ) {
      return false;
    }
    const resolvedDemand = resolvePremiumDemandSurface(demand.text);
    if (!resolvedDemand) return false;
    const escapedDemand = escapeRegExp(resolvedDemand.surface);
    const escapedDemandObject = escapeRegExp(resolvedDemand.objectSurface);
    const escapedDemandReference =
      resolvedDemand.surface !== resolvedDemand.objectSurface
        ? `(?:${escapedDemand}|${escapedDemandObject})`
      : escapedDemandObject;
    const ownershipPatterns = [
      new RegExp(`\\bi\\s+${escapedDemand}(?=\\s|[,.!?;:]|$)`, "i"),
      new RegExp(
        `\\bi\\s+(?:${CANDIDATE_HISTORY_ENGLISH_ACTION_VERB_SOURCE})\\s+(?:(?:the|this|that|my)\\s+)?${escapedDemandReference}(?=\\s|[,.!?;:]|$)`,
        "i",
      ),
      new RegExp(
        `\\b${CANDIDATE_HISTORY_ENGLISH_COPULAR_SOURCE}\\s+(?:responsible\\s+for|in\\s+charge\\s+of|accountable\\s+for|tasked\\s+with)\\s+${escapedDemandReference}(?=\\s|[,.!?;:]|$)`,
        "i",
      ),
      new RegExp(
        `\\b(?:j['’]\\s*ai|je)\\s+${escapedDemand}(?=\\s|[,.!?;:]|$)`,
        "iu",
      ),
      new RegExp(
        `\\b${CANDIDATE_HISTORY_FRENCH_FIRST_PERSON_ACTION_SOURCE}\\s+(?:(?:le|la|les|du|des)\\s+|l['’]\\s*)?${escapedDemandReference}(?=\\s|[,.!?;:]|$)`,
        "iu",
      ),
      new RegExp(
        `\\b(?:je\\s+suis|j['’]\\s*(?:étais|ai\\s+été))\\s+${CANDIDATE_HISTORY_FRENCH_OWNERSHIP_PREFIX_SOURCE}${escapedDemandReference}(?=\\s|[,.!?;:]|$)`,
        "iu",
      ),
      new RegExp(
        `${escapedDemandReference}\\s*,?\\s+(?:which|that)\\s+i\\s+(?:${CANDIDATE_HISTORY_ENGLISH_ACTION_VERB_SOURCE})\\b`,
        "i",
      ),
      new RegExp(
        `${escapedDemandReference}\\s*,?\\s+(?:que|ce\\s+que)\\s+${CANDIDATE_HISTORY_FRENCH_FIRST_PERSON_ACTION_SOURCE}(?=\\s|[,.!?;:]|$)`,
        "iu",
      ),
      new RegExp(
        `${escapedDemandReference}\\s+(?:was|were|is|are)\\s+(?:among\\s+)?(?:the\\s+)?(?:work|something|responsibilit(?:y|ies)|dut(?:y|ies)|tasks?)\\s+(?:that\\s+)?i\\s+(?:${CANDIDATE_HISTORY_ENGLISH_ACTION_VERB_SOURCE})\\b`,
        "i",
      ),
      new RegExp(
        `${escapedDemandReference}\\s+(?:était|étaient|est|sont)\\s+(?:parmi\\s+)?(?:le|la|les|un|une|des)?\\s*(?:travail|responsabilit(?:é|és)|tâche(?:s)?)\\s+(?:que\\s+)?${CANDIDATE_HISTORY_FRENCH_FIRST_PERSON_ACTION_SOURCE}(?=\\s|[,.!?;:]|$)`,
        "iu",
      ),
      new RegExp(
        `${escapedDemandReference}\\s*[-–—,:]\\s*(?:(?:a|the|one\\s+of\\s+the)\\s+)?(?:responsibilit(?:y|ies)|dut(?:y|ies)|tasks?|work)\\s+(?:that\\s+)?i\\s+(?:${CANDIDATE_HISTORY_ENGLISH_ACTION_VERB_SOURCE})\\b`,
        "i",
      ),
      new RegExp(
        `${escapedDemandReference}\\s*[-–—,:]\\s*(?:(?:une|des|la|les)\\s+)?(?:responsabilit(?:é|és)|tâche(?:s)?|travail)\\s+(?:que\\s+)?${CANDIDATE_HISTORY_FRENCH_FIRST_PERSON_ACTION_SOURCE}(?=\\s|[,.!?;:]|$)`,
        "iu",
      ),
    ];
    const canonicalLeader = resolvedDemand.leader
      ? canonicalizePremiumCapabilityVerb(resolvedDemand.leader)
      : null;
    const usesGenericCopularDemand =
      !resolvedDemand.ownershipPrefixStripped &&
      ((canonicalLeader === "be" &&
        new RegExp(
          `\\b${CANDIDATE_HISTORY_ENGLISH_COPULAR_SOURCE}\\s+${escapedDemandObject}(?=\\s|[,.!?;:]|$)`,
          "i",
        ).test(compact)) ||
        (canonicalLeader === "être" &&
          new RegExp(
            `\\b(?:je\\s+suis|j['’]\\s*(?:étais|ai\\s+été))\\s+${escapedDemandObject}(?=\\s|[,.!?;:]|$)`,
            "iu",
          ).test(compact)));
    const usesFrenchSuivreDemand =
      canonicalLeader === "suivre" &&
      new RegExp(
        `\\bje\\s+suis\\s+${escapedDemandObject}(?=\\s|[,.!?;:]|$)`,
        "iu",
      ).test(compact);
    return (
      usesGenericCopularDemand ||
      usesFrenchSuivreDemand ||
      ownershipPatterns.some((pattern) => pattern.test(compact))
    );
  });
}

function premiumCandidateFactSupportsDemand(args: {
  fact: FactNodeV1;
  demand: JobDemandNodeV1;
  generatedText: string;
}): boolean {
  if (args.fact.source !== "cv") return false;
  const normalizedDemand = normalizePremiumProvenanceText(
    args.demand.text,
  ).replace(/[.!?]+$/u, "");
  const normalizedFact = normalizePremiumProvenanceText(args.fact.text);
  const factSupportsDemand =
    normalizedDemand.length >= 12 &&
    normalizedFact.includes(normalizedDemand)
      ? true
      : (() => {
          const demandTokens = args.demand.tokens;
          if (demandTokens.length < 2) return false;
          const factTokens = new Set(normalizeTokens(args.fact.text));
          const overlap = countOverlap(demandTokens, factTokens);
          const threshold = Math.max(2, Math.ceil(demandTokens.length * 0.75));
          if (overlap < threshold) return false;

          const demandLeader = extractPremiumDemandLeaderVerb(args.demand.text);
          if (!demandLeader) return true;
          const canonicalDemandLeader =
            canonicalizePremiumCapabilityVerb(demandLeader);
          if (
            canonicalDemandLeader === "be" ||
            canonicalDemandLeader === "être"
          ) {
            return true;
          }
          return args.fact.allowedVerbs.some(
            (verb) =>
              canonicalizePremiumCapabilityVerb(verb) ===
              canonicalDemandLeader,
          );
        })();
  if (!factSupportsDemand) return false;

  const generatedVerb = extractGeneratedPremiumCapabilityVerbForDemand({
    generatedText: args.generatedText,
    demand: args.demand,
    allowContextualComplements: normalizedFact.includes(
      normalizePremiumProvenanceText(args.generatedText),
    ),
  });
  if (!generatedVerb) return false;
  const factVerb = extractCandidateFactCapabilityVerbForDemand({
    factText: args.fact.text,
    demand: args.demand,
  });
  return factVerb === generatedVerb;
}

function canonicalizePremiumCapabilityVerb(value: string): string {
  const normalized = compactWhitespace(value).toLowerCase();
  const englishFamily = PREMIUM_ENGLISH_CAPABILITY_VERB_PATTERNS.find(
    ({ pattern }) => pattern.test(normalized),
  );
  if (englishFamily) return englishFamily.canonical;
  if (/^dirig(?:é(?:e|s|es)?|e)$/u.test(normalized)) return "diriger";
  if (/^gér(?:é(?:e|s|es)?|e)$/u.test(normalized)) return "gérer";
  if (/^construit(?:e|s|es)?$|^construis$/u.test(normalized)) {
    return "construire";
  }
  if (/^cré(?:é(?:e|s|es)?|e)$/u.test(normalized)) return "créer";
  if (/^amélior(?:é(?:e|s|es)?|e)$/u.test(normalized)) return "améliorer";
  if (/^livr(?:é(?:e|s|es)?|e)$/u.test(normalized)) return "livrer";
  if (/^maintenu(?:e|s|es)?$|^maintiens$/u.test(normalized)) {
    return "maintenir";
  }
  if (/^coordonn(?:é(?:e|s|es)?|e)$/u.test(normalized)) {
    return "coordonner";
  }
  if (/^trait(?:é(?:e|s|es)?|e)$/u.test(normalized)) return "traiter";
  if (/^suivi(?:e|s|es)?$/u.test(normalized)) return "suivre";
  if (/^document(?:é(?:e|s|es)?|e)$/u.test(normalized)) {
    return "documenter";
  }
  if (/^pilot(?:é(?:e|s|es)?|e)$/u.test(normalized)) return "piloter";
  if (/^assur(?:é(?:e|s|es)?|e)$/u.test(normalized)) return "assurer";
  if (/^pris(?:e|es)? en charge$|^prends en charge$/u.test(normalized)) {
    return "prendre en charge";
  }
  return normalized;
}

function extractCandidateFactCapabilityVerbForDemand(args: {
  factText: string;
  demand: JobDemandNodeV1;
}): string | null {
  const resolvedDemand = resolvePremiumDemandSurface(args.demand.text);
  if (!resolvedDemand) return null;
  const escapedDemandObject = escapeRegExp(resolvedDemand.objectSurface).replace(
    /\s+/g,
    "\\s+",
  );
  const directActionPatterns = [
    new RegExp(
      `\\b(${CANDIDATE_HISTORY_ENGLISH_ACTION_VERB_SOURCE})\\s+(?:(?:the|this|that|my)\\s+)?${escapedDemandObject}${PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE}`,
      "i",
    ),
    new RegExp(
      `\\b(${CANDIDATE_HISTORY_FRENCH_PAST_ACTION_SOURCE})\\s+(?:(?:le|la|les|du|des)\\s+|l['’]\\s*)?${escapedDemandObject}${PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE}`,
      "iu",
    ),
    new RegExp(
      `\\b(${CANDIDATE_HISTORY_FRENCH_PRESENT_ACTION_SOURCE})\\s+(?:(?:le|la|les|du|des)\\s+|l['’]\\s*)?${escapedDemandObject}${PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE}`,
      "iu",
    ),
  ];
  for (const pattern of directActionPatterns) {
    const match = pattern.exec(args.factText);
    if (match?.[1]) return canonicalizePremiumCapabilityVerb(match[1]);
  }
  const canonicalLeader = resolvedDemand.leader
    ? canonicalizePremiumCapabilityVerb(resolvedDemand.leader)
    : null;
  if (
    !resolvedDemand.ownershipPrefixStripped &&
    canonicalLeader === "be" &&
    new RegExp(
      `(?:^|[.!?]\\s+)(?:(?:${CANDIDATE_HISTORY_ENGLISH_COPULAR_SOURCE}|was|were|is|are)\\s+)?${escapedDemandObject}${PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE}`,
      "i",
    ).test(args.factText)
  ) {
    return "be";
  }
  if (
    !resolvedDemand.ownershipPrefixStripped &&
    canonicalLeader === "être" &&
    new RegExp(
      `(?:^|[.!?]\\s+)(?:(?:je\\s+suis|j['’]\\s*(?:étais|ai\\s+été)|(?:était|étaient))\\s+)?${escapedDemandObject}${PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE}`,
      "iu",
    ).test(args.factText)
  ) {
    return "être";
  }
  if (
    canonicalLeader === "suivre" &&
    new RegExp(
      `(?:^|[.!?]\\s+)(?:je\\s+)?suis\\s+${escapedDemandObject}${PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE}`,
      "iu",
    ).test(args.factText)
  ) {
    return "suivre";
  }
  if (
    new RegExp(
      `\\b(?:responsible\\s+for|in\\s+charge\\s+of|accountable\\s+for|tasked\\s+with)\\s+${escapedDemandObject}${PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE}`,
      "i",
    ).test(args.factText) ||
    new RegExp(
      `\\b${CANDIDATE_HISTORY_FRENCH_OWNERSHIP_PREFIX_SOURCE}${escapedDemandObject}${PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE}`,
      "iu",
    ).test(args.factText)
  ) {
    return "own";
  }
  return null;
}

function extractGeneratedPremiumCapabilityVerbForDemand(args: {
  generatedText: string;
  demand: JobDemandNodeV1;
  allowContextualComplements: boolean;
}): string | null {
  const resolvedDemand = resolvePremiumDemandSurface(args.demand.text);
  if (!resolvedDemand) return null;
  const escapedDemand = escapeRegExp(resolvedDemand.surface);
  const escapedDemandObject = escapeRegExp(resolvedDemand.objectSurface);
  const escapedDemandReference =
    resolvedDemand.surface !== resolvedDemand.objectSurface
      ? `(?:${escapedDemand}|${escapedDemandObject})`
    : escapedDemandObject;
  const generatedDemandBoundary = args.allowContextualComplements
    ? PREMIUM_DEMAND_SURFACE_BOUNDARY_SOURCE
    : PREMIUM_GENERATED_DEMAND_SURFACE_BOUNDARY_SOURCE;
  const verbs = new Set<string>();
  const directActionPatterns = [
    new RegExp(
      `\\bi\\s+(${CANDIDATE_HISTORY_ENGLISH_ACTION_VERB_SOURCE})\\s+(?:(?:the|this|that|my)\\s+)?${escapedDemandReference}${generatedDemandBoundary}`,
      "gi",
    ),
    new RegExp(
      `\\bj['’]\\s*ai\\s+(${CANDIDATE_HISTORY_FRENCH_PAST_ACTION_SOURCE})\\s+(?:(?:le|la|les|du|des)\\s+|l['’]\\s*)?${escapedDemandReference}${generatedDemandBoundary}`,
      "giu",
    ),
    new RegExp(
      `\\b(?:je\\s+|j['’]\\s*)(${CANDIDATE_HISTORY_FRENCH_PRESENT_ACTION_SOURCE})\\s+(?:(?:le|la|les|du|des)\\s+|l['’]\\s*)?${escapedDemandReference}${generatedDemandBoundary}`,
      "giu",
    ),
  ];
  for (const pattern of directActionPatterns) {
    for (const match of args.generatedText.matchAll(pattern)) {
      if (match[1]) {
        verbs.add(canonicalizePremiumCapabilityVerb(match[1]));
      }
    }
  }

  const canonicalLeader = resolvedDemand.leader
    ? canonicalizePremiumCapabilityVerb(resolvedDemand.leader)
    : null;
  if (
    !resolvedDemand.ownershipPrefixStripped &&
    canonicalLeader === "be" &&
    new RegExp(
      `\\b${CANDIDATE_HISTORY_ENGLISH_COPULAR_SOURCE}\\s+${escapedDemandObject}${generatedDemandBoundary}`,
      "i",
    ).test(args.generatedText)
  ) {
    verbs.add("be");
  }
  if (
    !resolvedDemand.ownershipPrefixStripped &&
    canonicalLeader === "être" &&
    new RegExp(
      `\\b(?:je\\s+suis|j['’]\\s*(?:étais|ai\\s+été))\\s+${escapedDemandObject}${generatedDemandBoundary}`,
      "iu",
    ).test(args.generatedText)
  ) {
    verbs.add("être");
  }
  if (
    canonicalLeader === "suivre" &&
    new RegExp(
      `\\bje\\s+suis\\s+${escapedDemandObject}${generatedDemandBoundary}`,
      "iu",
    ).test(args.generatedText)
  ) {
    verbs.add("suivre");
  }

  if (
    new RegExp(
      `\\b${CANDIDATE_HISTORY_ENGLISH_COPULAR_SOURCE}\\s+(?:responsible\\s+for|in\\s+charge\\s+of|accountable\\s+for|tasked\\s+with)\\s+${escapedDemandReference}${generatedDemandBoundary}`,
      "i",
    ).test(args.generatedText) ||
    new RegExp(
      `\\b(?:je\\s+suis|j['’]\\s*(?:étais|ai\\s+été))\\s+${CANDIDATE_HISTORY_FRENCH_OWNERSHIP_PREFIX_SOURCE}${escapedDemandReference}${generatedDemandBoundary}`,
      "iu",
    ).test(args.generatedText)
  ) {
    verbs.add("own");
  }

  if (
    resolvedDemand.leader &&
    (new RegExp(
      `\\bi\\s+${escapedDemand}${generatedDemandBoundary}`,
      "i",
    ).test(
      args.generatedText,
    ) ||
      new RegExp(
        `\\b(?:j['’]\\s*ai|je)\\s+${escapedDemand}${generatedDemandBoundary}`,
        "iu",
      ).test(args.generatedText))
  ) {
    verbs.add(canonicalizePremiumCapabilityVerb(resolvedDemand.leader));
  }

  const trailingActionPatterns = [
    new RegExp(
      `${escapedDemandReference}${generatedDemandBoundary}(?:(?![.!?]).){0,100}\\bi\\s+(${CANDIDATE_HISTORY_ENGLISH_ACTION_VERB_SOURCE})\\b`,
      "gi",
    ),
    new RegExp(
      `${escapedDemandReference}${generatedDemandBoundary}(?:(?![.!?]).){0,100}\\bj['’]\\s*ai\\s+(${CANDIDATE_HISTORY_FRENCH_PAST_ACTION_SOURCE})\\b`,
      "giu",
    ),
    new RegExp(
      `${escapedDemandReference}${generatedDemandBoundary}(?:(?![.!?]).){0,100}\\b(?:je\\s+|j['’]\\s*)(${CANDIDATE_HISTORY_FRENCH_PRESENT_ACTION_SOURCE})\\b`,
      "giu",
    ),
  ];
  for (const pattern of trailingActionPatterns) {
    for (const match of args.generatedText.matchAll(pattern)) {
      if (match[1]) {
        verbs.add(canonicalizePremiumCapabilityVerb(match[1]));
      }
    }
  }
  return verbs.size === 1 ? (verbs.values().next().value ?? null) : null;
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
    if (WRITER_META_PROSE_PATTERN.test(compact)) {
      issues.push({
        code: "meta_prose",
        section,
        claimId: assignedClaim?.id,
        message: `${section} contains writer meta prose.`,
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
    const assignedDemands = (assignedClaim?.demandIds ?? [])
      .map((id) => demandById.get(id))
      .filter((demand): demand is JobDemandNodeV1 => Boolean(demand));
    const candidateHistoryDemands = Array.from(
      new Map(
        [...referencedDemands, ...assignedDemands].map((demand) => [
          demand.id,
          demand,
        ]),
      ).values(),
    );
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
      usesJobDemandAsCandidateExperience({
        generatedText: compact,
        referencedDemands: candidateHistoryDemands,
        referencedFacts,
      })
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
      hasNoCvHistoryClaim(compact)
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

function isBlockingPremiumWriterOutputIssue(
  issue: PremiumWriterOutputValidationIssue,
): boolean {
  if (issue.repairable) return false;
  return ![
    // These have provider-specific normalization or body-level validation paths below.
    "unsupported_numeric_claim",
    "unsupported_ownership_verb",
    "unsupported_credential_claim",
    "unsupported_compliance_framework",
  ].includes(issue.code);
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
const WRITER_META_PROSE_PATTERN =
  /\b(?:i have described|i described|as described|as mentioned|as noted|the evidence (?:shows|demonstrates|suggests)|this (?:letter|paragraph|section) (?:shows|demonstrates|describes)|the claim (?:is|shows|demonstrates)|my strongest match|my best match|the strongest evidence|my fit for this role|the main reason i am a fit|work surface|concrete bridge)\b/i;
const EMPLOYER_ARGUMENT_BRIDGE_PATTERN =
  /(?:^|[^\p{L}\p{N}_])(?:that|this|for|where|because|matters|relevant|role|team|environment|work|needs?|requires?|dans|pour|où|parce\s+que|pertinent(?:e|es|s)?|rôles?|équipes?|environnement|travail|besoins?|exige(?:nt)?|priorités?)(?=$|[^\p{L}\p{N}_])/iu;
const CANDIDATE_LIKE_FULL_NAME_LINE_PATTERN =
  /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3}$/;
const PERCENTAGE_NUMERIC_CLAIM_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:%|percent|percentage\s+points?)\b/gi;
const DIGIT_NUMERIC_CLAIM_PATTERN = /\b\d+(?:\.\d+)?\b/g;
const WORD_NUMBER_DURATION_CLAIM_PATTERN =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:day|days|week|weeks|month|months|year|years)\b/gi;
const HIGH_OWNERSHIP_VERB_PATTERNS = [
  { verb: "owned", pattern: /\bown(?:ed|s|ing)\b/i },
  { verb: "managed", pattern: /\bmanag(?:ed|es|ing)\b/i },
  { verb: "led", pattern: /\b(?:led|lead(?:s|ing)?)\b/i },
  { verb: "directed", pattern: /\bdirect(?:ed|s|ing)?\b/i },
  { verb: "oversaw", pattern: /\b(?:oversaw|oversee(?:s|ing)?|overseen)\b/i },
  { verb: "drove", pattern: /\b(?:drove|drive(?:s|n|ing)?)\b/i },
  { verb: "spearheaded", pattern: /\bspearhead(?:ed|s|ing)?\b/i },
  { verb: "transformed", pattern: /\btransform(?:ed|s|ing)?\b/i },
  { verb: "resolved", pattern: /\bresolv(?:ed|es|ing)\b/i },
] as const;
const OWNERSHIP_VERB_DOWNGRADES = [
  {
    pattern: HIGH_OWNERSHIP_VERB_PATTERNS[0].pattern,
    replacements: {
      owned: "handled",
      owns: "handles",
      owning: "handling",
    },
  },
  {
    pattern: HIGH_OWNERSHIP_VERB_PATTERNS[1].pattern,
    replacements: {
      managed: "handled",
      manages: "handles",
      managing: "handling",
    },
  },
  {
    pattern: HIGH_OWNERSHIP_VERB_PATTERNS[2].pattern,
    replacements: {
      lead: "coordinate",
      led: "coordinated",
      leads: "coordinates",
      leading: "coordinating",
    },
  },
  {
    pattern: HIGH_OWNERSHIP_VERB_PATTERNS[3].pattern,
    replacements: {
      direct: "coordinate",
      directed: "coordinated",
      directs: "coordinates",
      directing: "coordinating",
    },
  },
  {
    pattern: HIGH_OWNERSHIP_VERB_PATTERNS[4].pattern,
    replacements: {
      oversaw: "coordinated",
      oversee: "coordinate",
      overseen: "coordinated",
      oversees: "coordinates",
      overseeing: "coordinating",
    },
  },
  {
    pattern: HIGH_OWNERSHIP_VERB_PATTERNS[5].pattern,
    replacements: {
      drove: "supported",
      drive: "support",
      driven: "supported",
      drives: "supports",
      driving: "supporting",
    },
  },
  {
    pattern: HIGH_OWNERSHIP_VERB_PATTERNS[6].pattern,
    replacements: {
      spearhead: "support",
      spearheaded: "supported",
      spearheads: "supports",
      spearheading: "supporting",
    },
  },
  {
    pattern: HIGH_OWNERSHIP_VERB_PATTERNS[7].pattern,
    replacements: {
      transform: "work on",
      transformed: "worked on",
      transforms: "works on",
      transforming: "working on",
    },
  },
  {
    pattern: HIGH_OWNERSHIP_VERB_PATTERNS[8].pattern,
    replacements: {
      resolve: "address",
      resolved: "addressed",
      resolves: "addresses",
      resolving: "addressing",
    },
  },
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

function preserveReplacementCasing(source: string, replacement: string): string {
  if (/^[A-Z]/.test(source)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function downgradeUnsupportedOwnershipVerbs(args: {
  value: string;
  brief: CoverLetterBrief;
}): string {
  const candidateEvidenceSurface = buildCandidateEvidenceSurface({
    brief: args.brief,
  });
  let value = args.value;
  for (const downgrade of OWNERSHIP_VERB_DOWNGRADES) {
    if (!downgrade.pattern.test(value) || downgrade.pattern.test(candidateEvidenceSurface)) {
      continue;
    }
    const globalPattern = new RegExp(
      downgrade.pattern.source,
      downgrade.pattern.flags.includes("i") ? "gi" : "g",
    );
    value = value.replace(globalPattern, (match) => {
      const replacement =
        downgrade.replacements[
          match.toLowerCase() as keyof typeof downgrade.replacements
        ];
      return replacement ? preserveReplacementCasing(match, replacement) : match;
    });
  }
  return value;
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

function listAsNaturalTextForLanguage(
  items: string[],
  language: string,
): string {
  const cleaned = dedupeStrings(items).map((item) =>
    compactWhitespace(item).replace(/[.!?]$/u, ""),
  );
  const conjunction =
    getDeterministicCopyLanguage(language) === "fr" ? "et" : "and";
  if (cleaned.length <= 1) return cleaned[0] ?? "";
  if (cleaned.length === 2) {
    return `${cleaned[0]} ${conjunction} ${cleaned[1]}`;
  }
  return `${cleaned.slice(0, -1).join(", ")} ${conjunction} ${cleaned[cleaned.length - 1]}`;
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

function adjacentOperatingAnchors(
  brief: CoverLetterBrief,
  language = "English",
  includeFallback = true,
): string[] {
  const evidence = [
    ...brief.topEvidence,
    ...brief.supportEvidence,
    ...(brief.transferCore ?? []),
  ].join(" ");
  const french = getDeterministicCopyLanguage(language) === "fr";
  const labels = french
    ? {
        observation: "une observation attentive",
        records: "des dossiers fiables",
        handoffs: "des transmissions claires",
        followThrough: "un suivi régulier",
        fallback: [
          "des dossiers clairs",
          "une communication constante",
          "un suivi régulier",
        ],
      }
    : {
        observation: "careful observation",
        records: "accurate records",
        handoffs: "clear handoffs",
        followThrough: "consistent follow-through",
        fallback: [
          "clear records",
          "steady communication",
          "consistent follow-through",
        ],
      };
  const anchors: string[] = [];
  if (/\b(?:monitor|surveillance|scan|patrol|observation|watch)\b/i.test(evidence)) {
    anchors.push(labels.observation);
  }
  if (/\b(?:reports?|records?|documents?|documented|logs?|notes?|recording)\b/i.test(evidence)) {
    anchors.push(labels.records);
  }
  if (/\b(?:witness(?:es)?|interview|communicat|handoffs?|stakeholders?|updates?)\b/i.test(evidence)) {
    anchors.push(labels.handoffs);
  }
  if (/\b(?:coordinat|schedul|track|follow)\b/i.test(evidence)) {
    anchors.push(labels.followThrough);
  }
  if (anchors.length > 0) return dedupeStrings(anchors).slice(0, 4);
  return includeFallback ? labels.fallback : [];
}

type PremiumWorkSurfaceId =
  | "reporting_documentation"
  | "customer_success_retention"
  | "operations_scheduling"
  | "revenue_forecasting"
  | "facilities_maintenance"
  | "security_observation";

type PremiumWorkSurfaceDefinition = {
  id: PremiumWorkSurfaceId;
  evidencePattern: RegExp;
  jobPattern: RegExp;
  contextPhrase: string;
  anchorPhrase: string;
  frenchContextPhrase: string;
  frenchAnchorPhrase: string;
};

const PREMIUM_WORK_SURFACE_DEFINITIONS = [
  {
    id: "customer_success_retention",
    evidencePattern:
      /\b(?:customer success|account health|retention|onboarding|qbrs?|quarterly business reviews?|at-risk accounts?|escalation triggers?|customer health)\b/i,
    jobPattern:
      /\b(?:customer success|account health|retention|onboarding|qbrs?|quarterly business reviews?|expansion|churn|customer reporting)\b/i,
    contextPhrase: "customer success and retention work",
    anchorPhrase: "clear account signals and consistent follow-through",
    frenchContextPhrase: "le suivi et la fidélisation des clients",
    frenchAnchorPhrase: "des signaux client clairs et un suivi régulier",
  },
  {
    id: "revenue_forecasting",
    evidencePattern:
      /\b(?:revenue operations?|forecast(?:s|ing)?|pipeline|salesforce|crm|dashboard|operating cadence|sales|finance)\b/i,
    jobPattern:
      /\b(?:revenue operations?|forecast(?:s|ing)?|pipeline|salesforce|crm|dashboard|operating cadence|sales|finance)\b/i,
    contextPhrase: "revenue reporting and forecasting",
    anchorPhrase: "clear reporting cadence and reliable operating visibility",
    frenchContextPhrase: "le reporting et les prévisions de revenus",
    frenchAnchorPhrase:
      "un reporting régulier et une visibilité opérationnelle fiable",
  },
  {
    id: "facilities_maintenance",
    evidencePattern:
      /\b(?:facilities|maintenance|work-?order|service records?|repairs?|equipment|request routing)\b/i,
    jobPattern:
      /\b(?:facilities|maintenance|work-?order|service records?|repairs?|equipment)\b/i,
    contextPhrase: "facilities and maintenance coordination",
    anchorPhrase: "current service records and timely follow-up",
    frenchContextPhrase: "la coordination des installations et de la maintenance",
    frenchAnchorPhrase: "des dossiers d'intervention à jour et un suivi rapide",
  },
  {
    id: "security_observation",
    evidencePattern:
      /\b(?:security|guard|patrols?|surveillance|cctv|observation|observe|monitor(?:ed|ing)?|witness(?:es)?|access control|grounds?)\b/i,
    jobPattern:
      /\b(?:security|guard|patrols?|surveillance|cctv|observation|observe|monitor(?:ed|ing)?|witness(?:es)?|access control|site safety|incident response)\b/i,
    contextPhrase: "security observation and patrol work",
    anchorPhrase: "careful observation and clear records",
    frenchContextPhrase: "la surveillance et les rondes de sécurité",
    frenchAnchorPhrase: "une observation attentive et des dossiers clairs",
  },
  {
    id: "reporting_documentation",
    evidencePattern:
      /\b(?:reports?|reporting|records?|documentation|documents?|documented|logs?|notes?|observations?|occurrences?|surveillance activit(?:y|ies))\b/i,
    jobPattern:
      /\b(?:reports?|reporting|records?|documentation|documents?|documented|logs?|notes?|observations?|incidents?|status)\b/i,
    contextPhrase: "reporting and documentation",
    anchorPhrase: "accurate records and clear handoffs",
    frenchContextPhrase: "le reporting et la documentation",
    frenchAnchorPhrase: "des dossiers fiables et des transmissions claires",
  },
  {
    id: "operations_scheduling",
    evidencePattern:
      /\b(?:operations?|scheduling|schedule|coordination|coordinate|handoffs?|follow-up|track(?:ed|ing)?|intake|workflow|process)\b/i,
    jobPattern:
      /\b(?:operations?|scheduling|schedule|coordination|coordinate|handoffs?|follow-up|track(?:ed|ing)?|intake|workflow|process)\b/i,
    contextPhrase: "operations and scheduling",
    anchorPhrase: "organized coordination and steady follow-through",
    frenchContextPhrase: "les opérations et la planification",
    frenchAnchorPhrase: "une coordination structurée et un suivi régulier",
  },
] as const satisfies readonly PremiumWorkSurfaceDefinition[];

function collectCandidateSurfaceText(brief: CoverLetterBrief): string {
  return [
    ...brief.topEvidence,
    ...brief.supportEvidence,
    ...(brief.transferCore ?? []),
  ].join(" ");
}

function collectJobSurfaceText(brief: CoverLetterBrief): string {
  return [
    brief.targetRole,
    ...(brief.topResponsibilities ?? []),
    ...(brief.keyRequirements ?? []),
    ...(brief.workContext ?? []),
  ].join(" ");
}

function resolvePremiumWorkSurfaces(
  brief: CoverLetterBrief,
): PremiumWorkSurfaceDefinition[] {
  const candidateSurfaceText = collectCandidateSurfaceText(brief);
  const jobSurfaceText = collectJobSurfaceText(brief);
  const candidateMatches = PREMIUM_WORK_SURFACE_DEFINITIONS.filter((surface) =>
    surface.evidencePattern.test(candidateSurfaceText),
  );
  const jobMatches = PREMIUM_WORK_SURFACE_DEFINITIONS.filter((surface) =>
    surface.jobPattern.test(jobSurfaceText),
  );
  const jobIds = new Set(jobMatches.map((surface) => surface.id));
  const overlapping = candidateMatches.filter((surface) => jobIds.has(surface.id));

  if (overlapping.length > 0) return overlapping;
  if (brief.contextClass === "no_cv" && jobMatches.length > 0) return jobMatches;
  if (candidateMatches.length > 0) return candidateMatches;
  return jobMatches;
}

function buildNoCvWorkSurfaceEmployerValueBridge(
  brief: CoverLetterBrief,
  primarySurface: PremiumWorkSurfaceDefinition | undefined,
): string {
  const anchors = primarySurface
    ? [primarySurface.anchorPhrase]
    : adjacentOperatingAnchors(brief, "English").slice(0, 3);
  const anchorText = listAsNaturalText(anchors);
  const contextText = (primarySurface?.contextPhrase ?? "the work").replace(
    /\s+work$/i,
    "",
  );
  return `The role points to ${contextText} work that calls for ${anchorText}.`;
}

function resolveLocalizedWorkSurfaceCopy(
  brief: CoverLetterBrief,
  primarySurface: PremiumWorkSurfaceDefinition | undefined,
): { french: boolean; anchorText: string; contextText: string } {
  const french = getDeterministicCopyLanguage(brief.language) === "fr";
  if (french) {
    const anchors = primarySurface
      ? [primarySurface.frenchAnchorPhrase]
      : adjacentOperatingAnchors(brief, brief.language).slice(0, 3);
    return {
      french,
      anchorText: listAsNaturalTextForLanguage(anchors, brief.language),
      contextText: primarySurface?.frenchContextPhrase ?? "ce travail",
    };
  }

  const anchors = primarySurface
    ? [primarySurface.anchorPhrase]
    : adjacentOperatingAnchors(brief, brief.language).slice(0, 3);
  return {
    french,
    anchorText: listAsNaturalTextForLanguage(anchors, brief.language),
    contextText: (primarySurface?.contextPhrase ?? "the work").replace(
      /\s+work$/i,
      "",
    ),
  };
}

function buildWorkSurfaceEmployerValueBridge(brief: CoverLetterBrief): string {
  const surfaces = resolvePremiumWorkSurfaces(brief);
  const primarySurface = surfaces[0];

  if (brief.contextClass === "no_cv") {
    return buildNoCvWorkSurfaceEmployerValueBridge(brief, primarySurface);
  }

  const { french, anchorText, contextText } = resolveLocalizedWorkSurfaceCopy(
    brief,
    primarySurface,
  );

  if (brief.contextClass === "cv_adjacent") {
    if (french) {
      return `Cette expérience est pertinente pour ${contextText}, où les priorités incluent ${anchorText}.`;
    }
    return `In ${contextText} work, that kind of background supports ${anchorText} without turning small issues into unclear handoffs.`;
  }

  if (french) {
    return `Dans ${contextText}, cette expérience apporte ${anchorText}.`;
  }
  return `In ${contextText} work, that background supports ${anchorText}.`;
}

function shouldReplaceLowValueEmployerValueBlock(value: string): boolean {
  const normalized = compactWhitespace(value);
  return Boolean(normalized) && LOW_VALUE_JOB_ECHO_PATTERN.test(normalized);
}

function cleanPremiumBodyPartProse(value: string): string {
  const withoutSignatureLines = value
    .split(/\n+/)
    .map((line) => compactWhitespace(line))
    .filter(
      (line) =>
        line &&
        !SIGNOFF_PATTERN.test(line) &&
        !CANDIDATE_LIKE_FULL_NAME_LINE_PATTERN.test(line),
    )
    .join(" ");
  let cleaned = compactWhitespace(withoutSignatureLines)
    .replace(/\bwork\s+surfaces?\b/gi, "work")
    .replace(
      /\bthat\s+gives\s+the\s+letter\s+a\s+concrete\s+bridge\s+to\b/gi,
      "that connects to",
    )
    .replace(
      /\bthe\s+letter\s+has\s+a\s+concrete\s+bridge\s+to\b/gi,
      "that connects to",
    );

  for (const replacement of REPORTING_BODY_PART_CLEANUP_REPLACEMENTS) {
    cleaned = cleaned.replace(replacement.pattern, replacement.replacement);
  }

  return cleaned;
}

function cleanPremiumWriterOutputText(
  writerOutput: PremiumWriterOutputV1,
): PremiumWriterOutputV1 {
  return {
    ...writerOutput,
    bodyParts: {
      opening: {
        ...writerOutput.bodyParts.opening,
        text: cleanPremiumBodyPartProse(writerOutput.bodyParts.opening.text),
      },
      proofBlock: {
        ...writerOutput.bodyParts.proofBlock,
        text: cleanPremiumBodyPartProse(writerOutput.bodyParts.proofBlock.text),
      },
      employerValueBlock: {
        ...writerOutput.bodyParts.employerValueBlock,
        text: cleanPremiumBodyPartProse(
          writerOutput.bodyParts.employerValueBlock.text,
        ),
      },
      closeLine: {
        ...writerOutput.bodyParts.closeLine,
        text: cleanPremiumBodyPartProse(writerOutput.bodyParts.closeLine.text),
      },
    },
  };
}

function containsOnlyUnknownProviderIds(
  ids: readonly string[],
  knownIds: ReadonlySet<string>,
): boolean {
  return ids.length > 0 && ids.every((id) => !knownIds.has(id));
}

function normalizeProviderWriterOutputProvenance(args: {
  writerOutput: PremiumWriterOutputV1;
  claimPlan: ClaimPlanV1;
  factGraph: FactGraphV1;
  jobDemandGraph: JobDemandGraphV1;
  writerProvider?: PremiumCoverLetterWriterProvider;
  writerModel?: string;
}): PremiumWriterOutputV1 {
  if (
    !isMistralWriterIdentity(args) &&
    !isQwenWriterIdentity(args)
  ) {
    return args.writerOutput;
  }

  const demandIds = new Set(args.jobDemandGraph.demands.map((demand) => demand.id));
  const normalizedParts = { ...args.writerOutput.bodyParts };

  for (const section of CLAIM_PLAN_SECTIONS) {
    const part = args.writerOutput.bodyParts[section];
    const assignedClaim = claimForSection(args.claimPlan, section);
    if (!assignedClaim) continue;

    const claimIdsNeedNormalization =
      part.claimIds.length === 0 ||
      part.claimIds.some((claimId) => claimId !== assignedClaim.id);
    const demandIdsNeedNormalization = containsOnlyUnknownProviderIds(
      part.demandIds,
      demandIds,
    );

    normalizedParts[section] = {
      ...part,
      claimIds: claimIdsNeedNormalization ? [assignedClaim.id] : part.claimIds,
      factIds: part.factIds,
      demandIds: demandIdsNeedNormalization
        ? assignedClaim.demandIds
        : part.demandIds,
    };
  }

  return {
    ...args.writerOutput,
    bodyParts: normalizedParts,
  };
}

function stringArraysEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function writerOutputProvenanceChanged(
  before: PremiumWriterOutputV1,
  after: PremiumWriterOutputV1,
): boolean {
  return CLAIM_PLAN_SECTIONS.some((section) => {
    const beforePart = before.bodyParts[section];
    const afterPart = after.bodyParts[section];
    return (
      !stringArraysEqual(beforePart.claimIds, afterPart.claimIds) ||
      !stringArraysEqual(beforePart.factIds, afterPart.factIds) ||
      !stringArraysEqual(beforePart.demandIds, afterPart.demandIds)
    );
  });
}

function premiumBodyPartTextChanged(
  writerOutput: PremiumWriterOutputV1,
  bodyParts: CoverLetterBodyParts,
): boolean {
  return CLAIM_PLAN_SECTIONS.some(
    (section) =>
      compactWhitespace(writerOutput.bodyParts[section].text) !==
      compactWhitespace(bodyParts[section]),
  );
}

function normalizePremiumProvenanceText(value: string): string {
  return normalizeProposalConstraintText(value);
}

function premiumTextSupportsCandidateFact(args: {
  generatedText: string;
  fact: Pick<
    PremiumCoverLetterFinalProvenanceFact,
    "text" | "source" | "metrics" | "entities"
  >;
}): boolean {
  if (args.fact.source !== "cv") return false;

  const generatedText = compactWhitespace(args.generatedText);
  const factText = compactWhitespace(args.fact.text);
  if (!generatedText || !factText) return false;

  const normalizedGenerated = normalizePremiumProvenanceText(generatedText);
  const normalizedFact = normalizePremiumProvenanceText(factText);
  if (
    normalizedFact.length >= 24 &&
    normalizedGenerated.includes(normalizedFact)
  ) {
    return true;
  }

  const generatedTokens = new Set(normalizeTokens(generatedText));
  const factTokens = normalizeTokens(factText);
  const overlap = countOverlap(factTokens, generatedTokens);
  const threshold = Math.min(5, Math.max(3, Math.ceil(factTokens.length * 0.35)));
  if (overlap >= threshold) {
    return true;
  }

  const hasMetricOverlap = args.fact.metrics.some((metric) => {
    const normalizedMetric = normalizePremiumProvenanceText(metric);
    return (
      normalizedMetric.length > 0 &&
      normalizedGenerated.includes(normalizedMetric)
    );
  });
  if (hasMetricOverlap && overlap >= 2) {
    return true;
  }

  const hasEntityOverlap = args.fact.entities.some((entity) => {
    const normalizedEntity = normalizePremiumProvenanceText(entity);
    return (
      normalizedEntity.length >= 3 &&
      normalizedGenerated.includes(normalizedEntity)
    );
  });
  return hasEntityOverlap && overlap >= 2;
}

function buildPremiumProvenanceSection(args: {
  section: ClaimPlanSection;
  part: PremiumWriterBodyPartV1;
  finalText: string;
  factById: Map<string, FactNodeV1>;
}): {
  section: PremiumCoverLetterFinalProvenanceSection;
  candidateFacts: PremiumCoverLetterFinalProvenanceFact[];
} {
  const candidateFacts: PremiumCoverLetterFinalProvenanceFact[] = [];
  for (const factId of args.part.factIds) {
    const fact = args.factById.get(factId);
    if (!fact || fact.source !== "cv") continue;
    candidateFacts.push({
      id: fact.id,
      section: args.section,
      text: fact.text,
      source: "cv",
      metrics: fact.metrics,
      entities: fact.entities,
    });
  }

  const verifiedCandidateFactIds = candidateFacts
    .filter((fact) =>
      premiumTextSupportsCandidateFact({
        generatedText: args.finalText,
        fact,
      }),
    )
    .map((fact) => fact.id);

  return {
    section: {
      section: args.section,
      text: args.finalText,
      claimIds: [...args.part.claimIds],
      factIds: [...args.part.factIds],
      demandIds: [...args.part.demandIds],
      candidateFactIds: candidateFacts.map((fact) => fact.id),
      verifiedCandidateFactIds,
    },
    candidateFacts,
  };
}

export function buildPremiumCoverLetterFinalProvenance(args: {
  writerOutput: PremiumWriterOutputV1;
  finalBodyParts: CoverLetterBodyParts;
  claimPlan: ClaimPlanV1;
  factGraph: FactGraphV1;
  legacyWrapped: boolean;
  provenanceIdsNormalized: boolean;
}): PremiumCoverLetterFinalProvenance {
  const factById = new Map(args.factGraph.facts.map((fact) => [fact.id, fact]));
  const sections = {} as Record<
    ClaimPlanSection,
    PremiumCoverLetterFinalProvenanceSection
  >;
  const candidateFacts: PremiumCoverLetterFinalProvenanceFact[] = [];

  for (const section of CLAIM_PLAN_SECTIONS) {
    const built = buildPremiumProvenanceSection({
      section,
      part: args.writerOutput.bodyParts[section],
      finalText: args.finalBodyParts[section],
      factById,
    });
    sections[section] = built.section;
    candidateFacts.push(...built.candidateFacts);
  }

  const candidateFactIds = dedupeStrings(candidateFacts.map((fact) => fact.id));
  const verifiedCandidateFactIds = dedupeStrings(
    CLAIM_PLAN_SECTIONS.flatMap(
      (section) => sections[section].verifiedCandidateFactIds,
    ),
  );
  const origin: PremiumCoverLetterFinalProvenanceOrigin = args.legacyWrapped
    ? "legacy_wrapped"
    : args.provenanceIdsNormalized
      ? "provider_normalized"
      : "provider_reported";
  const mutatedAfterStructuredOutput = premiumBodyPartTextChanged(
    args.writerOutput,
    args.finalBodyParts,
  );
  const status: PremiumCoverLetterFinalProvenanceStatus =
    args.claimPlan.contextClass === "no_cv"
      ? "untrusted_no_cv"
      : args.legacyWrapped
        ? "untrusted_legacy_wrapped"
        : verifiedCandidateFactIds.length > 0
          ? mutatedAfterStructuredOutput
            ? "validated_after_structured_repair"
            : "validated_final_text"
          : candidateFactIds.length > 0
            ? "invalidated_by_late_mutation"
            : "untrusted_no_candidate_fact";

  return {
    version: "premium_cover_letter_final_provenance_v1",
    status,
    origin,
    contextClass: args.claimPlan.contextClass,
    candidateFactIds,
    verifiedCandidateFactIds,
    candidateFacts,
    sections,
  };
}

function isTrustedPremiumFinalProvenanceStatus(
  status: PremiumCoverLetterFinalProvenanceStatus,
): boolean {
  return (
    status === "validated_final_text" ||
    status === "validated_after_structured_repair"
  );
}

export function refreshPremiumCoverLetterFinalProvenanceForContent(args: {
  provenance: PremiumCoverLetterFinalProvenance;
  finalText: string;
}): PremiumCoverLetterFinalProvenance {
  if (!isTrustedPremiumFinalProvenanceStatus(args.provenance.status)) {
    return args.provenance;
  }

  const verifiedCandidateFacts = args.provenance.candidateFacts.filter((fact) =>
    premiumTextSupportsCandidateFact({
      generatedText: args.finalText,
      fact,
    }),
  );
  const verifiedCandidateFactIds = dedupeStrings(
    verifiedCandidateFacts.map((fact) => fact.id),
  );
  if (verifiedCandidateFactIds.length === 0) {
    return {
      ...args.provenance,
      status: "invalidated_by_late_mutation",
      verifiedCandidateFactIds: [],
      sections: Object.fromEntries(
        CLAIM_PLAN_SECTIONS.map((section) => [
          section,
          {
            ...args.provenance.sections[section],
            verifiedCandidateFactIds: [],
          },
        ]),
      ) as unknown as Record<
        ClaimPlanSection,
        PremiumCoverLetterFinalProvenanceSection
      >,
    };
  }

  const originalBodyText = compactWhitespace(
    CLAIM_PLAN_SECTIONS.map(
      (section) => args.provenance.sections[section].text,
    ).join(" "),
  );
  const finalTextChanged =
    normalizePremiumProvenanceText(originalBodyText) !==
    normalizePremiumProvenanceText(args.finalText);

  return {
    ...args.provenance,
    status:
      args.provenance.status === "validated_after_structured_repair" ||
      finalTextChanged
        ? "validated_after_structured_repair"
        : "validated_final_text",
    verifiedCandidateFactIds,
    sections: Object.fromEntries(
      CLAIM_PLAN_SECTIONS.map((section) => [
        section,
        {
          ...args.provenance.sections[section],
          verifiedCandidateFactIds: args.provenance.candidateFacts
            .filter(
              (fact) =>
                fact.section === section && verifiedCandidateFactIds.includes(fact.id),
            )
            .map((fact) => fact.id),
        },
      ]),
    ) as Record<ClaimPlanSection, PremiumCoverLetterFinalProvenanceSection>,
  };
}

export function premiumCoverLetterFinalProvenanceSatisfiesCandidateEvidence(args: {
  provenance: PremiumCoverLetterFinalProvenance | undefined;
  finalText: string;
}): boolean {
  if (!args.provenance) return false;
  const refreshed = refreshPremiumCoverLetterFinalProvenanceForContent({
    provenance: args.provenance,
    finalText: args.finalText,
  });
  return (
    isTrustedPremiumFinalProvenanceStatus(refreshed.status) &&
    refreshed.verifiedCandidateFactIds.length > 0
  );
}

function lowerUnsupportedOwnershipVerbs(args: {
  value: string;
  brief: CoverLetterBrief;
}): string {
  const candidateEvidenceSurface = buildCandidateEvidenceSurface({
    brief: args.brief,
  });
  let value = args.value;
  const sourceSupports = (pattern: RegExp) => pattern.test(candidateEvidenceSurface);

  if (!sourceSupports(/\bown(?:ed|s|ing)?\b/i)) {
    value = value
      .replace(/\bowned\b/gi, "handled")
      .replace(/\bowning\b/gi, "handling")
      .replace(/\bowns\b/gi, "handles");
  }
  if (!sourceSupports(/\bmanag(?:ed|es|ing)\b/i)) {
    value = value
      .replace(/\bmanaged\b/gi, "handled")
      .replace(/\bmanaging\b/gi, "handling")
      .replace(/\bmanages\b/gi, "handles");
  }
  if (!sourceSupports(/\b(?:led|lead(?:s|ing)?)\b/i)) {
    value = value
      .replace(/\bled\b/gi, "coordinated")
      .replace(/\bleading\b/gi, "coordinating")
      .replace(/\bleads\b/gi, "coordinates")
      .replace(/\blead\b/gi, "coordinate");
  }
  if (!sourceSupports(/\bdirect(?:ed|s|ing)?\b/i)) {
    value = value
      .replace(/\bdirected\b/gi, "coordinated")
      .replace(/\bdirecting\b/gi, "coordinating")
      .replace(/\bdirects\b/gi, "coordinates")
      .replace(/\bdirect\b/gi, "coordinate");
  }
  if (!sourceSupports(/\b(?:oversaw|oversee(?:s|ing)?|overseen)\b/i)) {
    value = value
      .replace(/\boversaw\b/gi, "coordinated")
      .replace(/\boverseeing\b/gi, "coordinating")
      .replace(/\boversees\b/gi, "coordinates")
      .replace(/\boverseen\b/gi, "coordinated")
      .replace(/\boversee\b/gi, "coordinate");
  }
  if (!sourceSupports(/\b(?:drove|drive(?:s|n|ing)?)\b/i)) {
    value = value
      .replace(/\bdrove\b/gi, "supported")
      .replace(/\bdriven\b/gi, "supported")
      .replace(/\bdriving\b/gi, "supporting")
      .replace(/\bdrives\b/gi, "supports")
      .replace(/\bdrive\b/gi, "support");
  }
  if (!sourceSupports(/\bspearhead(?:ed|s|ing)?\b/i)) {
    value = value
      .replace(/\bspearheaded\b/gi, "supported")
      .replace(/\bspearheading\b/gi, "supporting")
      .replace(/\bspearheads\b/gi, "supports")
      .replace(/\bspearhead\b/gi, "support");
  }
  if (!sourceSupports(/\btransform(?:ed|s|ing)\b/i)) {
    value = value
      .replace(/\btransformed\b/gi, "worked on")
      .replace(/\btransforming\b/gi, "working on")
      .replace(/\btransforms\b/gi, "works on");
  }
  if (!sourceSupports(/\bresolv(?:ed|es|ing)\b/i)) {
    value = value
      .replace(/\bresolved\b/gi, "addressed")
      .replace(/\bresolving\b/gi, "addressing")
      .replace(/\bresolves\b/gi, "addresses");
  }

  return value;
}

function normalizeBodyPartRepetitionKey(value: string): string {
  return normalizeProposalConstraintText(value)
    .split(/\s+/)
    .filter((token) => token.length > 3 && !STOPWORDS.has(token))
    .join(" ");
}

function isRepeatedBodyPartSentence(
  sentence: string,
  previousSentences: string[],
): boolean {
  const normalized = normalizeBodyPartRepetitionKey(sentence);
  if (!normalized) return false;
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  if (tokenCount < 6) return false;
  return previousSentences.some((previous) => {
    const previousNormalized = normalizeBodyPartRepetitionKey(previous);
    if (!previousNormalized) return false;
    return (
      previousNormalized === normalized ||
      previousNormalized.includes(normalized) ||
      normalized.includes(previousNormalized)
    );
  });
}

function removeRepeatedBodyPartSentences(
  bodyParts: CoverLetterBodyParts,
): CoverLetterBodyParts {
  const previousSentences: string[] = [];
  const cleanPart = (value: string): string => {
    const kept = splitSentences(value).filter((sentence) => {
      if (isRepeatedBodyPartSentence(sentence, previousSentences)) {
        return false;
      }
      return true;
    });
    previousSentences.push(...kept);
    return kept.length > 0 ? joinSentences(kept) : value;
  };

  return {
    opening: cleanPart(bodyParts.opening),
    proofBlock: cleanPart(bodyParts.proofBlock),
    employerValueBlock: cleanPart(bodyParts.employerValueBlock),
    closeLine: cleanPart(bodyParts.closeLine),
  };
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
          "I kept the observation work tied to a clear factual record for the next handoff",
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
      buildWorkSurfaceEmployerValueBridge(args.brief),
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
      hasNoCvHistoryClaim(compact)
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
    if (WRITER_META_PROSE_PATTERN.test(compact)) {
      issues.push({ code: "meta_prose", repairable: false });
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

export function evaluatePremiumCoverLetterQualityShadow(args: {
  bodyParts: CoverLetterBodyParts;
  content: string;
  contextClass?: PremiumCoverLetterContextClass;
}): PremiumCoverLetterQualityShadowResult {
  const issues: PremiumCoverLetterQualityShadowIssueCode[] = [];
  const bodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(args.bodyParts);
  const content = compactWhitespace(args.content);
  const bodyText = compactWhitespace(Object.values(bodyParts).join(" "));
  const sentenceCount = splitSentences(bodyText).length;
  const employerValue = compactWhitespace(bodyParts.employerValueBlock);
  const opening = compactWhitespace(bodyParts.opening);
  const proof = compactWhitespace(bodyParts.proofBlock);

  if (WRITER_META_PROSE_PATTERN.test(bodyText)) {
    issues.push("meta_prose");
  }
  if (
    /\b(?:excited|thrilled|passionate|perfect fit|strong fit|dream role)\b/i.test(
      bodyText,
    )
  ) {
    issues.push("generic_tone");
  }
  if (
    args.contextClass !== "no_cv" &&
    /\b(?:that is useful in\b|that matters where|day-to-day depends on|those habits matter|would welcome the chance to (?:discuss|speak)|discuss the position further|discuss the role further)\b/i.test(
      bodyText,
    )
  ) {
    issues.push("generic_tone");
  }
  if (
    args.contextClass !== "no_cv" &&
    isGenericPremiumClosingLine(bodyParts.closeLine)
  ) {
    issues.push("generic_tone");
  }
  if (
    /^(?:i|at)\b/i.test(opening) &&
    /^(?:i|at)\b/i.test(proof) &&
    !EMPLOYER_ARGUMENT_BRIDGE_PATTERN.test(employerValue)
  ) {
    issues.push("factual_inventory");
  }
  if (!EMPLOYER_ARGUMENT_BRIDGE_PATTERN.test(employerValue)) {
    issues.push("weak_employer_argument");
  }
  if (LOW_VALUE_JOB_ECHO_PATTERN.test(employerValue)) {
    issues.push("low_value_job_echo");
  }
  if (!/\d|\bAt\s+[A-Z][\w&'.-]+/u.test(content)) {
    issues.push("low_specificity");
  }
  if (content.length > 1900 || sentenceCount > 8) {
    issues.push("too_verbose");
  }

  const uniqueIssues = dedupeStrings(
    issues,
  ) as PremiumCoverLetterQualityShadowIssueCode[];
  return {
    passed: uniqueIssues.length === 0,
    score: Math.max(0, 100 - uniqueIssues.length * 18),
    issues: uniqueIssues,
  };
}

function getRepairablePremiumCoverLetterQualityShadowIssues(
  qualityShadow: PremiumCoverLetterQualityShadowResult,
): PremiumCoverLetterQualityShadowIssueCode[] {
  if (qualityShadow.passed) return [];
  return qualityShadow.issues.filter((issue) =>
    REPAIRABLE_PREMIUM_COVER_LETTER_QUALITY_SHADOW_ISSUES.has(issue),
  );
}

function premiumCoverLetterQualityShadowImproved(args: {
  before: PremiumCoverLetterQualityShadowResult;
  after: PremiumCoverLetterQualityShadowResult;
}): boolean {
  if (args.after.passed) return true;
  return (
    args.after.score > args.before.score &&
    args.after.issues.length < args.before.issues.length
  );
}

export function repairPremiumCoverLetterBodyParts(args: {
  bodyParts: CoverLetterBodyParts;
  brief: CoverLetterBrief;
  forceGenericCloseRepair?: boolean;
}): CoverLetterBodyParts {
  const cleanBodyPart = (value: string) =>
    dedupeSentenceSequence(
      downgradeUnsupportedOwnershipVerbs({
        value: cleanPremiumBodyPartProse(stripGreetingAndSignoffLeakage(value)),
        brief: args.brief,
      }),
    );
  const cleaned: CoverLetterBodyParts = {
    opening: cleanBodyPart(args.bodyParts.opening),
    proofBlock: cleanBodyPart(args.bodyParts.proofBlock),
    employerValueBlock: cleanBodyPart(args.bodyParts.employerValueBlock),
    closeLine: cleanBodyPart(args.bodyParts.closeLine),
  };

  if (!compactWhitespace(cleaned.employerValueBlock)) {
    if (getDeterministicCopyLanguage(args.brief.language)) {
      cleaned.employerValueBlock = ensureSentenceEnding(
        buildWorkSurfaceEmployerValueBridge(args.brief),
      );
    }
  }
  if (
    getDeterministicCopyLanguage(args.brief.language) === "en" &&
    shouldReplaceLowValueEmployerValueBlock(cleaned.employerValueBlock)
  ) {
    cleaned.employerValueBlock = buildWorkSurfaceEmployerValueBridge(args.brief);
  }

  const originalCloseSentences = splitSentences(cleaned.closeLine).map(
    (sentence) => normalizeProposalConstraintText(sentence),
  );
  cleaned.employerValueBlock = joinSentences(
    splitSentences(cleaned.employerValueBlock).filter(
      (sentence) =>
        !originalCloseSentences.includes(
          normalizeProposalConstraintText(sentence),
        ),
    ),
  );
  if (
    !compactWhitespace(cleaned.employerValueBlock) &&
    getDeterministicCopyLanguage(args.brief.language)
  ) {
    cleaned.employerValueBlock = ensureSentenceEnding(
      buildWorkSurfaceEmployerValueBridge(args.brief),
    );
  }

  if (!compactWhitespace(cleaned.closeLine)) {
    cleaned.closeLine =
      buildEvidenceGroundedCloseLine(args.brief) ||
      resolveCloseFallback(args.brief.language);
  } else if (
    args.brief.contextClass !== "no_cv" &&
    (args.forceGenericCloseRepair || !isCoverLetterQualityRepairV1Enabled()) &&
    isGenericPremiumClosingLine(cleaned.closeLine)
  ) {
    cleaned.closeLine = repairGenericPremiumClosingLine({
      closeLine: cleaned.closeLine,
      brief: args.brief,
    });
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

  const deRepeated = removeRepeatedBodyPartSentences(cleaned);

  return {
    opening: ensureSentenceEnding(deRepeated.opening),
    proofBlock: ensureSentenceEnding(deRepeated.proofBlock),
    employerValueBlock: ensureSentenceEnding(deRepeated.employerValueBlock),
    closeLine: ensureSentenceEnding(deRepeated.closeLine),
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
      ? FRENCH_DEFAULT_SIGNOFF
      : deterministicLanguage === "en"
        ? ENGLISH_DEFAULT_SIGNOFF
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

function hasRestrainedEmployerBridgeLanguage(value: string): boolean {
  return /\b(?:that|this|those|background|experience|operating habits?|discipline)\b[\s\S]{0,90}\b(?:relevant|useful|matters?|fit|fits|depends?|where|environments?)\b/i.test(
    compactWhitespace(value),
  );
}

function startsLowercase(value: string): string {
  const compact = compactWhitespace(value);
  if (!compact) return "";
  return compact.charAt(0).toLowerCase() + compact.slice(1);
}

function addAdjacentRoleCompanyContextToOpening(args: {
  opening: string;
  brief: CoverLetterBrief;
}): string {
  const roleCompanyContext = adjacentRoleCompanyContext([
    ...args.brief.topEvidence,
    ...args.brief.supportEvidence,
  ]);
  if (!roleCompanyContext) return args.opening;

  const existingText = compactWhitespace(
    [
      args.opening,
      args.brief.supportEvidence.join(" "),
      args.brief.topEvidence.join(" "),
    ].join(" "),
  );
  const parsedContext = roleCompanyContext.match(/\bat\s+(.+)$/i)?.[1] ?? "";
  const companies = parsedContext
    .split(/\s+(?:and|,)\s+/)
    .map((item) => compactWhitespace(item))
    .filter(Boolean);
  const openingAlreadyHasCompany = companies.some((company) =>
    compactWhitespace(args.opening).includes(company),
  );
  if (openingAlreadyHasCompany || !existingText) return args.opening;

  const subject = roleCompanySubject(roleCompanyContext).replace(/[.!?]$/u, "");
  const opening = compactWhitespace(args.opening);
  if (!opening) return ensureSentenceEnding(subject);
  if (/^I\b/.test(opening)) {
    return ensureSentenceEnding(`${subject}, ${opening}`);
  }
  return ensureSentenceEnding(`${subject}, ${startsLowercase(opening)}`);
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
  const existingEmployerValue = compactWhitespace(args.bodyParts.employerValueBlock);
  const shouldUseDeterministicBridgeFallback =
    !existingEmployerValue ||
    shouldReplaceLowValueEmployerValueBlock(existingEmployerValue);
  const employerValueBlock = shouldUseDeterministicBridgeFallback
    ? buildWorkSurfaceEmployerValueBridge(args.brief)
    : args.bodyParts.employerValueBlock;
  const closeLine = /^(?:I|My)\b/i.test(compactWhitespace(args.bodyParts.closeLine))
    ? args.bodyParts.closeLine
    : `I bring discipline around ${anchorText}.`;

  return {
    ...args.bodyParts,
    opening: ensureSentenceEnding(
      addAdjacentRoleCompanyContextToOpening({
        opening: args.bodyParts.opening,
        brief: args.brief,
      }),
    ),
    employerValueBlock: ensureSentenceEnding(employerValueBlock),
    closeLine: ensureSentenceEnding(closeLine),
  };
}

function strengthenAdjacentEmployerArgumentBodyParts(args: {
  bodyParts: CoverLetterBodyParts;
  brief: CoverLetterBrief;
}): CoverLetterBodyParts {
  if (args.brief.contextClass !== "cv_adjacent") return args.bodyParts;

  const anchors = adjacentOperatingAnchors(args.brief);
  const anchorText = listAsNaturalText(anchors);
  const opening = addAdjacentRoleCompanyContextToOpening({
    opening: args.bodyParts.opening,
    brief: args.brief,
  });
  const closeLine = /^(?:I|My)\b/i.test(compactWhitespace(args.bodyParts.closeLine))
    ? args.bodyParts.closeLine
    : `I bring discipline around ${anchorText}.`;

  return {
    ...args.bodyParts,
    opening: ensureSentenceEnding(opening),
    employerValueBlock: ensureSentenceEnding(
      buildWorkSurfaceEmployerValueBridge(args.brief),
    ),
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

type ExactPremiumCoverLetterOpenAIArgs = {
  apiKey: string;
  prompt: string;
  writerModel: string;
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
  maxRetries?: number;
  maxOutputTokens?: number;
  reasoningEffort?: OpenAIProposalReasoningEffort;
  onResponseMetadata?: (
    metadata: PremiumCoverLetterProviderResponseMetadata,
  ) => void;
};

export async function generatePremiumCoverLetterBodyPartsWithExactOpenAIModel(
  args: ExactPremiumCoverLetterOpenAIArgs,
): Promise<unknown> {
  const responseFormat = resolvePremiumCoverLetterOpenAIResponseFormat({
    schema: args.schema,
  });
  return generateOpenAIResponsesStructured({
    apiKey: args.apiKey,
    prompt: args.prompt,
    writerModel: args.writerModel,
    responseFormat,
    signal: args.signal,
    maxRetries: args.maxRetries,
    maxOutputTokens: args.maxOutputTokens,
    reasoningEffort:
      args.reasoningEffort ?? resolveOpenAIProposalReasoningEffort(),
    onResponseMetadata: args.onResponseMetadata,
  });
}

export async function generatePremiumCoverLetterBodyPartsWithOpenAI(args: {
  apiKey: string;
  prompt: string;
  writerModel?: PremiumCoverLetterWriterModel;
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
  maxRetries?: number;
  maxOutputTokens?: number;
  reasoningEffort?: OpenAIProposalReasoningEffort;
  onResponseMetadata?: (
    metadata: PremiumCoverLetterProviderResponseMetadata,
  ) => void;
}): Promise<unknown> {
  return generatePremiumCoverLetterBodyPartsWithExactOpenAIModel({
    ...args,
    writerModel: resolvePremiumCoverLetterWriterModel(args.writerModel),
  });
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

function parsePremiumMistralWriterJson(content: string): unknown {
  const trimmed = content.trim();
  const tryParse = (value: string) => JSON.parse(value) as unknown;

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
    "Mistral premium cover-letter response did not contain one parseable JSON object.",
  );
}

export const PREMIUM_COVER_LETTER_MISTRAL_SYSTEM_PROMPT =
  "Return only a valid JSON object matching the requested schema. Do not include markdown, comments, greeting, signoff, or prose outside JSON. Never write meta-prose such as 'I have described', 'I described', 'as described', 'the evidence shows', 'this section shows', 'work surface', or 'concrete bridge'. Write the actual candidate action directly.";

export async function generatePremiumCoverLetterBodyPartsWithMistral(args: {
  apiKey: string;
  prompt: string;
  writerModel: string;
  signal?: AbortSignal;
  maxRetries?: number;
  maxOutputTokens?: number;
  onResponseMetadata?: (
    metadata: PremiumCoverLetterProviderResponseMetadata,
  ) => void;
}): Promise<unknown> {
  const model = new ChatMistralAI({
    apiKey: args.apiKey,
    modelName: args.writerModel,
    temperature: 0.2,
    ...(args.maxRetries !== undefined
      ? { maxRetries: args.maxRetries }
      : {}),
    ...(args.maxOutputTokens !== undefined
      ? { maxTokens: args.maxOutputTokens }
      : {}),
  });
  const response = await model.invoke(
    [
      new SystemMessage(PREMIUM_COVER_LETTER_MISTRAL_SYSTEM_PROMPT),
      new HumanMessage(args.prompt),
    ],
    args.signal ? ({ signal: args.signal } as any) : undefined,
  );
  args.onResponseMetadata?.(extractPremiumProviderResponseMetadata(response));
  const content = extractPremiumMistralText(response.content);
  return parsePremiumMistralWriterJson(content);
}

export function buildPremiumCoverLetterOpenAIRequest(args: {
  prompt: string;
  writerModel?: PremiumCoverLetterWriterModel;
  schema?: Record<string, unknown>;
  schemaName?: string;
  maxOutputTokens?: number;
  reasoningEffort?: OpenAIProposalReasoningEffort;
}) {
  return buildPremiumCoverLetterOpenAIRequestForExactModel({
    ...args,
    writerModel: resolvePremiumCoverLetterWriterModel(args.writerModel),
  });
}

export function buildPremiumCoverLetterOpenAIRequestForExactModel(args: {
  prompt: string;
  writerModel: string;
  schema?: Record<string, unknown>;
  schemaName?: string;
  maxOutputTokens?: number;
  reasoningEffort?: OpenAIProposalReasoningEffort;
}) {
  const schema = args.schema ?? PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA;
  const schemaName = args.schemaName ?? "premium_writer_output_v1";
  return buildOpenAIResponsesRequest({
    prompt: args.prompt,
    writerModel: args.writerModel,
    schema,
    schemaName,
    maxOutputTokens: args.maxOutputTokens,
    reasoningEffort:
      args.reasoningEffort ?? resolveOpenAIProposalReasoningEffort(),
  });
}

function extractPremiumProviderResponseMetadata(
  response: any,
): PremiumCoverLetterProviderResponseMetadata {
  const usage = response?.usage ?? response?.usage_metadata ?? null;
  const inputTokens = usage?.input_tokens ?? usage?.promptTokens;
  const outputTokens = usage?.output_tokens ?? usage?.completionTokens;
  const totalTokens = usage?.total_tokens ?? usage?.totalTokens;
  const tokenUsage = [inputTokens, outputTokens, totalTokens].every(
    (value) => Number.isInteger(value) && value >= 0,
  )
    ? { inputTokens, outputTokens, totalTokens }
    : null;
  return {
    returnedModel: typeof response?.model === "string" ? response.model : null,
    tokenUsage,
  };
}

function resolvePremiumCoverLetterOpenAIResponseFormat(args: {
  schema?: Record<string, unknown>;
}): {
  name: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: z.ZodTypeAny;
} {
  if (args.schema === PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA) {
    return {
      name: "premium_cover_letter_body_parts",
      jsonSchema: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
      zodSchema: PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA,
    };
  }
  return {
    name: "premium_writer_output_v1",
    jsonSchema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
    zodSchema: PREMIUM_WRITER_OUTPUT_V1_SCHEMA,
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
    "- meta-writing such as \"I have described\", \"I described\", \"as described\", \"the evidence shows\", \"this section shows\", \"work surface\", or \"concrete bridge\"",
    "- unsupported numbers, percentages, durations, team counts, deadlines, or metrics that are not present in the candidate evidence",
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

function buildPremiumCoverLetterQualityRepairPrompt(args: {
  brief: CoverLetterBrief;
  previousBodyParts: CoverLetterBodyParts;
  qualityShadow: PremiumCoverLetterQualityShadowResult;
  issues: PremiumCoverLetterQualityShadowIssueCode[];
}): string {
  return [
    "Repair cover-letter body parts for quality only.",
    "",
    "This is a bounded quality pass after the output already passed safety validation.",
    "Make at most small wording changes that address the listed quality issues.",
    "If a listed issue cannot be fixed using only the structured brief, return the previous body parts unchanged.",
    "",
    "Allowed repairs:",
    "- remove meta-writing and generic cover-letter phrases",
    "- make the employerValueBlock use the job context as an angle instead of listing the job offer",
    "- replace low-value job echo with candidate-backed overlap already present in the brief",
    "- reduce verbosity by shortening or deduplicating sentences",
    "- keep every candidate claim grounded in existing candidate facts from the brief",
    "",
    "Not allowed:",
    "- add new candidate experience, credentials, metrics, names, employers, tools, certifications, or outcomes",
    "- turn job demands into candidate history",
    "- change claim strategy or invent proof",
    "- add greeting, signoff, candidate name, markdown, explanation, audit, or labels",
    "- use this repair to satisfy provenance; final validation still decides",
    "",
    "Return only the same JSON body parts.",
    `Quality issues: ${JSON.stringify(args.issues)}`,
    `Quality shadow: ${JSON.stringify(args.qualityShadow)}`,
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
    "Also allowed: remove meta-writing such as 'I have described', 'I described', 'as described', 'the evidence shows', 'this section shows', 'work surface', or 'concrete bridge'; lower unsupported ownership verbs to source-backed lower-ownership verbs.",
    "Not allowed: unknown claim IDs, unknown fact IDs, unknown demand IDs, unsupported metrics, unsupported credentials, unsupported ownership upgrades, no_cv candidate-history claims, job demand as candidate experience, or company fluff as motivation.",
    "Return only PremiumWriterOutputV1 JSON.",
    `Validation issue codes: ${JSON.stringify(args.issues)}`,
    `ClaimPlan: ${JSON.stringify(args.brief.claimPlan)}`,
    `Previous PremiumWriterOutputV1: ${JSON.stringify(args.previousWriterOutput)}`,
    `Structured brief: ${JSON.stringify(args.brief)}`,
  ].join("\n");
}

function isAbortLikeError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  const code = typeof (error as any).code === "string" ? (error as any).code : "";
  return (
    name === "aborterror" ||
    name === "cancelederror" ||
    name === "cancellederror" ||
    name === "proposalgenerationcancelederror" ||
    code === "ERR_CANCELED" ||
    message === "proposal generation canceled." ||
    message.includes("aborted")
  );
}

function buildPremiumCoverLetterQualityRepairTrace(args: {
  enabled: boolean;
  eligible: boolean;
  attempted: boolean;
  outcome: PremiumCoverLetterQualityRepairOutcome;
  qualityBefore: PremiumCoverLetterQualityShadowResult;
  qualityAfter?: PremiumCoverLetterQualityShadowResult;
}): PremiumCoverLetterQualityRepairTrace {
  const rejected =
    args.outcome !== "disabled" &&
    args.outcome !== "not_needed" &&
    args.outcome !== "attempted_accepted" &&
    args.outcome !== "canceled";
  const trace: PremiumCoverLetterQualityRepairTrace = {
    enabled: args.enabled,
    eligible: args.eligible,
    attempted: args.attempted,
    outcome: args.outcome,
    qualityBefore: args.qualityBefore,
    ...(args.qualityAfter ? { qualityAfter: args.qualityAfter } : {}),
  };
  if (rejected) {
    trace.rejectionCategory = args.outcome as NonNullable<
      PremiumCoverLetterQualityRepairTrace["rejectionCategory"]
    >;
  }
  return trace;
}

function getChangedPremiumCoverLetterSections(args: {
  before: CoverLetterBodyParts;
  after: CoverLetterBodyParts;
}): ClaimPlanSection[] {
  return CLAIM_PLAN_SECTIONS.filter(
    (section) =>
      compactWhitespace(args.before[section]) !==
      compactWhitespace(args.after[section]),
  );
}

function repairTextHasCandidateUnsupportedClaim(args: {
  text: string;
  candidateEvidenceSurface: string;
}): boolean {
  const compact = compactWhitespace(args.text);
  if (
    hasUnsupportedNumericClaim({
      generatedText: compact,
      sourceSurface: args.candidateEvidenceSurface,
    })
  ) {
    return true;
  }
  if (
    (UNSUPPORTED_LICENSE_CLAIM_PATTERN.test(compact) &&
      !UNSUPPORTED_LICENSE_CLAIM_PATTERN.test(args.candidateEvidenceSurface)) ||
    (UNSUPPORTED_EDUCATION_CREDENTIAL_PATTERN.test(compact) &&
      !UNSUPPORTED_EDUCATION_CREDENTIAL_PATTERN.test(
        args.candidateEvidenceSurface,
      ))
  ) {
    return true;
  }
  if (
    COMPLIANCE_FRAMEWORK_PATTERNS.some((pattern) => pattern.test(compact)) &&
    !COMPLIANCE_FRAMEWORK_PATTERNS.some((pattern) =>
      pattern.test(args.candidateEvidenceSurface),
    )
  ) {
    return true;
  }
  return hasUnsupportedOwnershipVerb({
    generatedText: compact,
    candidateEvidenceSurface: args.candidateEvidenceSurface,
  });
}

function premiumCoverLetterQualityRepairPreservesCandidateGrounding(args: {
  before: CoverLetterBodyParts;
  after: CoverLetterBodyParts;
  brief: CoverLetterBrief;
  repairedProvenance: PremiumCoverLetterFinalProvenance;
}): boolean {
  const changedSections = getChangedPremiumCoverLetterSections({
    before: args.before,
    after: args.after,
  });
  if (changedSections.length === 0) return true;

  const candidateEvidenceSurface = buildCandidateEvidenceSurface({
    brief: args.brief,
  });
  return changedSections.every((section) => {
    const repairedSection = args.repairedProvenance.sections[section];
    return (
      repairedSection.verifiedCandidateFactIds.length > 0 &&
      !repairTextHasCandidateUnsupportedClaim({
        text: args.after[section],
        candidateEvidenceSurface,
      })
    );
  });
}

async function tryRepairPremiumCoverLetterQualityShadow(args: {
  bodyParts: CoverLetterBodyParts;
  qualityShadow: PremiumCoverLetterQualityShadowResult;
  brief: CoverLetterBrief;
  writer: PremiumCoverLetterWriter;
  signal?: AbortSignal;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  writerOutput: PremiumWriterOutputV1;
  claimPlan: ClaimPlanV1;
  factGraph: FactGraphV1;
  legacyWrapped: boolean;
  provenanceIdsNormalized: boolean;
}): Promise<{
  bodyParts?: CoverLetterBodyParts;
  rendered?: { content: string; sections: Array<{ type: "text"; content: string }> };
  qualityShadow?: PremiumCoverLetterQualityShadowResult;
  trace: PremiumCoverLetterQualityRepairTrace;
}> {
  const repairEnabled = isCoverLetterQualityRepairV1Enabled();
  if (!repairEnabled) {
    return {
      trace: buildPremiumCoverLetterQualityRepairTrace({
        enabled: false,
        eligible: false,
        attempted: false,
        outcome: "disabled",
        qualityBefore: args.qualityShadow,
      }),
    };
  }

  if (args.legacyWrapped || args.brief.contextClass === "no_cv") {
    return {
      trace: buildPremiumCoverLetterQualityRepairTrace({
        enabled: true,
        eligible: false,
        attempted: false,
        outcome: "not_needed",
        qualityBefore: args.qualityShadow,
      }),
    };
  }

  const repairableIssues = getRepairablePremiumCoverLetterQualityShadowIssues(
    args.qualityShadow,
  );
  if (repairableIssues.length === 0) {
    return {
      trace: buildPremiumCoverLetterQualityRepairTrace({
        enabled: true,
        eligible: false,
        attempted: false,
        outcome: "not_needed",
        qualityBefore: args.qualityShadow,
      }),
    };
  }

  let repairedBodyParts: CoverLetterBodyParts;
  try {
    repairedBodyParts = parseCoverLetterBodyPartsWriterPayload(
      await args.writer({
        prompt: buildPremiumCoverLetterQualityRepairPrompt({
          brief: args.brief,
          previousBodyParts: args.bodyParts,
          qualityShadow: args.qualityShadow,
          issues: repairableIssues,
        }),
        schema: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
        signal: args.signal,
      }),
    );
  } catch (error) {
    if (isAbortLikeError(error, args.signal)) {
      throw error;
    }
    const outcome =
      error instanceof z.ZodError || error instanceof SyntaxError
        ? "rejected_invalid_output"
        : "provider_error";
    return {
      trace: buildPremiumCoverLetterQualityRepairTrace({
        enabled: true,
        eligible: true,
        attempted: true,
        outcome,
        qualityBefore: args.qualityShadow,
      }),
    };
  }

  const repairedIssues = validatePremiumCoverLetterBodyParts({
    bodyParts: repairedBodyParts,
    brief: args.brief,
  });
  if (repairedIssues.length > 0) {
    return {
      trace: buildPremiumCoverLetterQualityRepairTrace({
        enabled: true,
        eligible: true,
        attempted: true,
        outcome: "rejected_validation",
        qualityBefore: args.qualityShadow,
      }),
    };
  }

  const repairedProvenance = buildPremiumCoverLetterFinalProvenance({
    writerOutput: args.writerOutput,
    finalBodyParts: repairedBodyParts,
    claimPlan: args.claimPlan,
    factGraph: args.factGraph,
    legacyWrapped: args.legacyWrapped,
    provenanceIdsNormalized: args.provenanceIdsNormalized,
  });
  if (!isTrustedPremiumFinalProvenanceStatus(repairedProvenance.status)) {
    return {
      trace: buildPremiumCoverLetterQualityRepairTrace({
        enabled: true,
        eligible: true,
        attempted: true,
        outcome: "rejected_provenance",
        qualityBefore: args.qualityShadow,
      }),
    };
  }
  if (
    !premiumCoverLetterQualityRepairPreservesCandidateGrounding({
      before: args.bodyParts,
      after: repairedBodyParts,
      brief: args.brief,
      repairedProvenance,
    })
  ) {
    return {
      trace: buildPremiumCoverLetterQualityRepairTrace({
        enabled: true,
        eligible: true,
        attempted: true,
        outcome: "rejected_provenance",
        qualityBefore: args.qualityShadow,
      }),
    };
  }

  const repairedRendered = renderPremiumCoverLetter({
    bodyParts: repairedBodyParts,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  if (
    !hasExpectedCandidateSignature({
      content: repairedRendered.content,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
    })
  ) {
    return {
      trace: buildPremiumCoverLetterQualityRepairTrace({
        enabled: true,
        eligible: true,
        attempted: true,
        outcome: "rejected_validation",
        qualityBefore: args.qualityShadow,
      }),
    };
  }

  const repairedQualityShadow = evaluatePremiumCoverLetterQualityShadow({
    bodyParts: repairedBodyParts,
    content: repairedRendered.content,
    contextClass: args.brief.contextClass,
  });
  if (
    !premiumCoverLetterQualityShadowImproved({
      before: args.qualityShadow,
      after: repairedQualityShadow,
    })
  ) {
    return {
      trace: buildPremiumCoverLetterQualityRepairTrace({
        enabled: true,
        eligible: true,
        attempted: true,
        outcome: "rejected_not_improved",
        qualityBefore: args.qualityShadow,
        qualityAfter: repairedQualityShadow,
      }),
    };
  }

  return {
    bodyParts: repairedBodyParts,
    rendered: repairedRendered,
    qualityShadow: repairedQualityShadow,
    trace: buildPremiumCoverLetterQualityRepairTrace({
      enabled: true,
      eligible: true,
      attempted: true,
      outcome: "attempted_accepted",
      qualityBefore: args.qualityShadow,
      qualityAfter: repairedQualityShadow,
    }),
  };
}

export function extractOpenAIJsonPayload(response: any): unknown {
  return extractOpenAIJsonPayloadFromTransport(response);
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
  onModelRepairRequired?: (
    diagnostic: PremiumCoverLetterModelRepairRequiredDiagnostic,
  ) => void;
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
  let legacyWrapped = parsedWriterOutput.legacyWrapped;
  let provenanceIdsNormalized = false;
  let writerOutput = cleanPremiumWriterOutputText(
    parsedWriterOutput.writerOutput,
  );
  const normalizedWriterOutput = normalizeProviderWriterOutputProvenance({
    writerOutput,
    claimPlan,
    factGraph,
    jobDemandGraph,
    writerProvider: args.writerProvider,
    writerModel: args.writerModel,
  });
  provenanceIdsNormalized = writerOutputProvenanceChanged(
    writerOutput,
    normalizedWriterOutput,
  );
  writerOutput = normalizedWriterOutput;
  let writerOutputIssues = validatePremiumWriterOutputV1({
    writerOutput,
    claimPlan,
    factGraph,
    jobDemandGraph,
    brief,
  });
  const blockingWriterOutputIssues = writerOutputIssues.filter(
    isBlockingPremiumWriterOutputIssue,
  );
  if (blockingWriterOutputIssues.length > 0) {
    args.onFailure?.({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass,
      issues: blockingWriterOutputIssues.map((issue) => issue.code),
    });
    return null;
  }
  let repairableWriterOutputIssues = parsedWriterOutput.legacyWrapped
    ? []
    : writerOutputIssues.filter((issue) => issue.repairable);
  if (repairableWriterOutputIssues.length > 0) {
    args.onModelRepairRequired?.({
      stage: "writer_output_validation",
      issues: repairableWriterOutputIssues.map((issue) => issue.code),
    });
    const repairedParsedWriterOutput = parsePremiumWriterOutputV1({
      rawOutput: await args.writer({
        prompt: buildPremiumWriterOutputRepairPrompt({
          brief,
          previousWriterOutput: writerOutput,
          issues: repairableWriterOutputIssues.map((issue) => issue.code),
        }),
        schema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
        signal: args.signal,
      }),
      claimPlan,
    });
    const repairedWriterOutput = cleanPremiumWriterOutputText(
      repairedParsedWriterOutput.writerOutput,
    );
    const normalizedRepairedWriterOutput = normalizeProviderWriterOutputProvenance({
      writerOutput: repairedWriterOutput,
      claimPlan,
      factGraph,
      jobDemandGraph,
      writerProvider: args.writerProvider,
      writerModel: args.writerModel,
    });
    legacyWrapped = repairedParsedWriterOutput.legacyWrapped;
    provenanceIdsNormalized = writerOutputProvenanceChanged(
      repairedWriterOutput,
      normalizedRepairedWriterOutput,
    );
    writerOutputIssues = validatePremiumWriterOutputV1({
      writerOutput: normalizedRepairedWriterOutput,
      claimPlan,
      factGraph,
      jobDemandGraph,
      brief,
    });
    const repairedBlockingWriterOutputIssues = writerOutputIssues.filter(
      isBlockingPremiumWriterOutputIssue,
    );
    repairableWriterOutputIssues = repairedParsedWriterOutput.legacyWrapped
      ? []
      : writerOutputIssues.filter((issue) => issue.repairable);
    if (
      repairedBlockingWriterOutputIssues.length > 0 ||
      repairableWriterOutputIssues.length > 0
    ) {
      args.onFailure?.({
        stage: "validation",
        reason: "repair_failed_validation",
        contextClass,
        issues: [
          ...repairedBlockingWriterOutputIssues,
          ...repairableWriterOutputIssues,
        ].map((issue) => issue.code),
      });
      return null;
    }
    writerOutput = normalizedRepairedWriterOutput;
  }

  let bodyParts = PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA.parse(
    toCoverLetterBodyParts(writerOutput),
  );

  let issues = validatePremiumCoverLetterBodyParts({ bodyParts, brief });
  const issueCodes = summarizeValidationIssueCodes(issues);
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
    const remainingIssueCodes = summarizeValidationIssueCodes(issues);
    if (
      remainingIssueCodes.includes("unsupported_ownership_verb") &&
      !isQwenWriterIdentity({
        writerProvider: args.writerProvider,
        writerModel: args.writerModel,
      })
    ) {
      const ownershipRepairedBodyParts = repairPremiumCoverLetterBodyParts({
        bodyParts,
        brief,
      });
      const ownershipRepairedIssues = validatePremiumCoverLetterBodyParts({
        bodyParts: ownershipRepairedBodyParts,
        brief,
      });
      if (ownershipRepairedIssues.length === 0) {
        bodyParts = ownershipRepairedBodyParts;
        issues = [];
      }
    }
  }

  if (issues.some((issue) => !issue.repairable)) {
    const remainingIssueCodes = summarizeValidationIssueCodes(issues);
    const shouldRetryRemainingAdjacentDirectFit =
      brief.contextClass === "cv_adjacent" &&
      remainingIssueCodes.includes("adjacent_direct_fit");
    const shouldRetryRemainingMistralUnsupportedOwnership =
      isMistralWriterIdentity({
        writerProvider: args.writerProvider,
        writerModel: args.writerModel,
      }) && remainingIssueCodes.includes("unsupported_ownership_verb");
    const shouldRetryRemainingMetaProse =
      remainingIssueCodes.includes("meta_prose");
    if (
      !shouldRetryRemainingAdjacentDirectFit &&
      !shouldRetryRemainingMistralUnsupportedOwnership &&
      !shouldRetryRemainingMetaProse
    ) {
      args.onFailure?.({
        stage: "validation",
        reason: "non_repairable_validation",
        contextClass,
        issues: remainingIssueCodes,
      });
      return null;
    }

    args.onModelRepairRequired?.({
      stage: "body_parts_validation",
      issues: remainingIssueCodes,
    });
    const repairedBodyParts = parseCoverLetterBodyPartsWriterPayload(
      await args.writer({
        prompt: buildPremiumCoverLetterRepairPrompt({
          brief,
          previousBodyParts: bodyParts,
          issues: remainingIssueCodes,
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

  const qualityCleanedBodyParts = repairPremiumCoverLetterBodyParts({
    bodyParts,
    brief,
  });
  const qualityCleanedIssues = validatePremiumCoverLetterBodyParts({
    bodyParts: qualityCleanedBodyParts,
    brief,
  });
  if (qualityCleanedIssues.length === 0) {
    bodyParts = qualityCleanedBodyParts;
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

  let rendered = renderPremiumCoverLetter({
    bodyParts,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  let qualityShadow = evaluatePremiumCoverLetterQualityShadow({
    bodyParts,
    content: rendered.content,
    contextClass: brief.contextClass,
  });
  let qualityRepairTrace: PremiumCoverLetterQualityRepairTrace | undefined;

  const qualityRepair = await tryRepairPremiumCoverLetterQualityShadow({
    bodyParts,
    qualityShadow,
    brief,
    writer: args.writer,
    signal: args.signal,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    writerOutput,
    claimPlan,
    factGraph,
    legacyWrapped,
    provenanceIdsNormalized,
  });
  qualityRepairTrace = qualityRepair.trace;
  if (qualityRepair.bodyParts && qualityRepair.rendered && qualityRepair.qualityShadow) {
    bodyParts = qualityRepair.bodyParts;
    rendered = qualityRepair.rendered;
    qualityShadow = qualityRepair.qualityShadow;
  } else if (
    brief.contextClass !== "no_cv" &&
    isGenericPremiumClosingLine(bodyParts.closeLine)
  ) {
    const deterministicFallbackBodyParts = repairPremiumCoverLetterBodyParts({
      bodyParts,
      brief,
      forceGenericCloseRepair: true,
    });
    const deterministicFallbackIssues = validatePremiumCoverLetterBodyParts({
      bodyParts: deterministicFallbackBodyParts,
      brief,
    });
    if (deterministicFallbackIssues.length === 0) {
      bodyParts = deterministicFallbackBodyParts;
      rendered = renderPremiumCoverLetter({
        bodyParts,
        outputLanguage: args.outputLanguage,
        candidateName: args.candidateName,
      });
      qualityShadow = evaluatePremiumCoverLetterQualityShadow({
        bodyParts,
        content: rendered.content,
        contextClass: brief.contextClass,
      });
    }
  }

  const finalProvenance = buildPremiumCoverLetterFinalProvenance({
    writerOutput,
    finalBodyParts: bodyParts,
    claimPlan,
    factGraph,
    legacyWrapped,
    provenanceIdsNormalized,
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
  qualityRepairTrace = qualityRepairTrace
    ? {
        ...qualityRepairTrace,
        finalProvenanceStatus: finalProvenance.status,
        verifiedCandidateFactCount:
          finalProvenance.verifiedCandidateFactIds.length,
      }
    : undefined;

  return {
    content: rendered.content,
    sections: rendered.sections,
    prompt,
    brief,
    contextClass,
    bodyParts,
    qualityShadow,
    qualityRepair: qualityRepairTrace,
    finalProvenance,
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
