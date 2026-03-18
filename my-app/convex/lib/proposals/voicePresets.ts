export const PROPOSAL_FORMALITY_LEVELS = [
  "informal",
  "neutral",
  "formal",
] as const;

export const PROPOSAL_CREATIVITY_LEVELS = ["low", "medium", "high"] as const;

export const PROPOSAL_VOICE_PRESET_IDS = [
  "signature",
  "expert",
  "direct",
  "engaging",
  "storyteller",
] as const;

export const PREMIUM_COVER_LETTER_VOICE_PRESET_IDS = [
  "signature",
  "expert",
  "engaging",
] as const satisfies readonly (typeof PROPOSAL_VOICE_PRESET_IDS)[number][];

export const APPLICATION_MESSAGE_VOICE_PRESET_IDS =
  PREMIUM_COVER_LETTER_VOICE_PRESET_IDS;

export const CHATGPT_FREELANCE_VOICE_PRESET_IDS = [
  "signature",
  "expert",
  "engaging",
] as const satisfies readonly (typeof PROPOSAL_VOICE_PRESET_IDS)[number][];

export type ProposalFormalityLevel = (typeof PROPOSAL_FORMALITY_LEVELS)[number];
export type ProposalCreativityLevel =
  (typeof PROPOSAL_CREATIVITY_LEVELS)[number];
export type ProposalVoicePreset = (typeof PROPOSAL_VOICE_PRESET_IDS)[number];

export type ProposalVoicePresetDefinition = {
  id: ProposalVoicePreset;
  label: string;
  description: string;
  formalityLevel: ProposalFormalityLevel;
  creativity: ProposalCreativityLevel;
  guidance: string;
};

export const DEFAULT_PROPOSAL_VOICE_PRESET: ProposalVoicePreset = "signature";

export const UNIVERSAL_PROPOSAL_VOICE_GUARDRAILS = [
  "Stay grounded in the candidate background, job context, and available data only.",
  "Avoid empty enthusiasm, stacked adjectives, inflated praise, and vague intensity.",
  "Do not exaggerate seniority, leadership, or domain authority.",
  "Respect the requested format, structure, and length.",
  "Keep the writing human, credible, professional, grounded, and non-robotic.",
] as const;

export const UNSUPPORTED_PROPOSAL_CLAIMS_BLACKLIST = [
  "Do not claim an attached CV or resume unless the request explicitly says one is attached.",
  "Do not claim an attached portfolio, demo reel, case study, or work samples unless the request explicitly says they are attached.",
  "Do not invent client names, project lists, shipped products, portfolio pieces, or sample work.",
  "Do not imply unsupported domain expertise, strategic ownership, or decision-making authority.",
] as const;

export const SOURCE_BACKED_SPECIFICITY_RULES = [
  "Preserve concrete source-backed detail when it appears in the candidate background.",
  "Keep employer names, role names, certifications, skills, tools, systems, languages, quantified achievements, procedures, equipment, and sector details concrete when they are explicitly supported.",
  "When a supported detail is concrete and useful, keep it concrete instead of generalizing it away.",
  "Prefer exact source-backed wording over embellished restatement when in doubt.",
  "Do not narrow, expand, upgrade, or reinterpret a detail unless the stronger or more specific version is clearly supported.",
] as const;

export const JOB_DESCRIPTION_TO_CANDIDATE_RULES = [
  "If a fact appears only in the job description, do not present it as something the candidate has already done.",
  "Job requirements may frame fit, motivation, or relevance, but they are not prior experience unless the candidate background clearly supports them.",
] as const;

export const IDENTITY_BACKGROUND_HARD_STOP_RULES = [
  "Do not infer or claim veteran status, military service, public-service background, accreditation/licensing, completed degree status, or direct domain-practice background unless the candidate background explicitly supports it.",
  "Treat adjacent sector exposure, employer context, partial training, coursework, or nearby keywords as insufficient evidence for identity, status, credential, or domain-practice claims.",
] as const;

export const NO_CONTEXT_CANDIDATE_CLAIM_RULES = [
  "When candidate background is empty, do not claim prior work experience or use phrases like 'in previous roles', 'my experience includes', or 'I have worked with'.",
  "Do not use negative-history disclaimers such as 'while I may not have direct experience', 'while I am new to the field', or 'although I lack experience'.",
  "Do not claim prior systems used, incidents handled, quantified outcomes, certifications, management, training, or coordination work.",
  "Do not claim familiarity with CCTV, access control, alarms, visitor systems, inspections, emergency response, or similar tools/processes unless framed only as role understanding or willingness to learn.",
  "Do not use soft acquired-practice language such as 'I understand the importance of' or 'my ability to ... would allow me to ...' when it implies operational readiness or prior practice.",
  "Do not claim direct operational capability, tool familiarity, or target-role readiness when candidate background is empty.",
  "Do not infer generic security experience, visitor management experience, access-control experience, or emergency-response history from the job description.",
  "Keep the output professional but modest, motivation-based, and clearly non-claiming about prior history.",
] as const;

const PROPOSAL_VOICE_PRESET_MAP: Record<
  ProposalVoicePreset,
  ProposalVoicePresetDefinition
> = {
  signature: {
    id: "signature",
    label: "Signature",
    description: "Balanced, natural, and credible.",
    formalityLevel: "neutral",
    creativity: "medium",
    guidance: [
      "Preset intent: keep the voice natural, balanced, professional, and credible.",
      "Tone traits: even pacing, moderate sentence length, clear wording, proportionate emphasis, a body that feels substantive rather than minimal, and warm professional continuity without drifting into shell phrasing.",
      "Avoid: stiffness, generic polish, salesy enthusiasm, over-produced phrasing, and stand-alone interest or discussion fragments that do not add body substance.",
    ].join(" "),
  },
  expert: {
    id: "expert",
    label: "Expert",
    description: "More precise, structured, and authoritative.",
    formalityLevel: "formal",
    creativity: "low",
    guidance: [
      "Preset intent: sound more precise, structured, and authoritative when the candidate background supports it.",
      "Tone traits: exact wording, measured transitions, disciplined emphasis, analytical movement, technical credibility without jargon padding, and one interpreting sentence beyond a bare evidence inventory when material supports it.",
      "Avoid: bluffing expertise, dense jargon, inflated authority, unsupported seniority, and collapsing into two factual lines plus the close.",
    ].join(" "),
  },
  direct: {
    id: "direct",
    label: "Direct",
    description: "Tighter, clearer, and more concise.",
    formalityLevel: "neutral",
    creativity: "low",
    guidance: [
      "Preset intent: optimize for clarity, speed, and concise relevance.",
      "Tone traits: shorter sentences, low padding, plainspoken transitions, and direct movement between points without sounding abrupt.",
      "Avoid: lengthy preambles, ceremonial courtesy phrases, clipped logic, cold phrasing, and flattening concrete supported specifics into generic wording.",
    ].join(" "),
  },
  engaging: {
    id: "engaging",
    label: "Engaging",
    description: "Warmer, more lively, and still professional.",
    formalityLevel: "neutral",
    creativity: "medium",
    guidance: [
      "Preset intent: sound warmer, more lively, and more interpersonal while staying professional.",
      "Tone traits: natural warmth, human presence, readable flow, grounded people context when supported, and restrained emotional language.",
      "Avoid: stock enthusiasm formulas, HR clichés, forced enthusiasm, casual slang, template-like friendliness, and overly corporate phrasing.",
    ].join(" "),
  },
  storyteller: {
    id: "storyteller",
    label: "Storyteller",
    description: "Smoother narrative flow with grounded trajectory logic.",
    formalityLevel: "neutral",
    creativity: "medium",
    guidance: [
      "Preset intent: improve narrative flow and make the through-line easier to follow.",
      "Tone traits: smooth continuity, lightly narrative transitions, connected movement between supported points, a visible supported through-line, complete sentence-to-sentence flow, and readable continuity from evidence to role relevance.",
      "Avoid: melodrama, flowery metaphors, theatrical hooks, invented background texture, marketing-style storytelling, generic cover-letter padding, and fragmentary connective beats.",
    ].join(" "),
  },
};

export const PROPOSAL_VOICE_PRESET_DEFINITIONS = PROPOSAL_VOICE_PRESET_IDS.map(
  (preset) => PROPOSAL_VOICE_PRESET_MAP[preset],
) as readonly ProposalVoicePresetDefinition[];

function normalizeVoicePresetToken(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function resolveProposalVoicePreset(
  value: string | null | undefined,
): ProposalVoicePreset | undefined {
  const normalized = normalizeVoicePresetToken(value);
  if (!normalized) return undefined;
  return PROPOSAL_VOICE_PRESET_IDS.includes(normalized as ProposalVoicePreset)
    ? (normalized as ProposalVoicePreset)
    : undefined;
}

export function getSupportedProposalVoicePresetIds(args: {
  proposalType?: string | null;
  modelType?: string | null;
}): readonly ProposalVoicePreset[] {
  if (args.proposalType === "application_message") {
    return APPLICATION_MESSAGE_VOICE_PRESET_IDS;
  }

  if (
    args.proposalType === "cover_letter" &&
    args.modelType === "chatgpt"
  ) {
    return PREMIUM_COVER_LETTER_VOICE_PRESET_IDS;
  }

  if (
    args.proposalType === "freelance_proposal" &&
    args.modelType === "chatgpt"
  ) {
    return CHATGPT_FREELANCE_VOICE_PRESET_IDS;
  }

  return PROPOSAL_VOICE_PRESET_IDS;
}

export function isProposalVoicePresetSupportedForMode(args: {
  preset: ProposalVoicePreset;
  proposalType?: string | null;
  modelType?: string | null;
}): boolean {
  return getSupportedProposalVoicePresetIds(args).includes(args.preset);
}

export function normalizeProposalVoicePresetForMode(args: {
  value: string | null | undefined;
  proposalType?: string | null;
  modelType?: string | null;
}): ProposalVoicePreset | undefined {
  const resolved = resolveProposalVoicePreset(args.value);
  if (!resolved) return undefined;
  return isProposalVoicePresetSupportedForMode({
    preset: resolved,
    proposalType: args.proposalType,
    modelType: args.modelType,
  })
    ? resolved
    : undefined;
}

export function getProposalVoicePresetDefinition(
  preset: ProposalVoicePreset,
): ProposalVoicePresetDefinition {
  return PROPOSAL_VOICE_PRESET_MAP[preset];
}
