import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  getProposalVoicePresetDefinition,
  resolveProposalVoicePreset,
  type ProposalCreativityLevel,
  type ProposalFormalityLevel,
  type ProposalVoicePreset,
} from "./voicePresets";

export type ProposalTonePreset = ProposalVoicePreset;

export type EffectiveProposalTone = {
  formalityLevel: ProposalFormalityLevel;
  creativity: ProposalCreativityLevel;
};

export type ProposalToneInput = {
  tonePreset?: string | null;
  formalityLevel?: string | null;
  creativity?: string | null;
};

// Current tone controls only expose formality and creativity. "Signature"
// maps to the neutral + medium baseline owned by the backend.
export const DEFAULT_PROPOSAL_TONE_PRESET: ProposalTonePreset =
  DEFAULT_PROPOSAL_VOICE_PRESET;
export const SIGNATURE_TONE_BASELINE: EffectiveProposalTone = {
  formalityLevel: getProposalVoicePresetDefinition(DEFAULT_PROPOSAL_TONE_PRESET)
    .formalityLevel,
  creativity: getProposalVoicePresetDefinition(DEFAULT_PROPOSAL_TONE_PRESET)
    .creativity,
};
const VALID_FORMALITY_LEVELS = new Set<ProposalFormalityLevel>([
  "informal",
  "neutral",
  "formal",
]);

const VALID_CREATIVITY_LEVELS = new Set<ProposalCreativityLevel>([
  "low",
  "medium",
  "high",
]);

const LEGACY_CREATIVITY_NORMALIZATION: Record<string, ProposalCreativityLevel> =
  {
    standard: "medium",
  };

function normalizeToneToken(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveTonePreset(
  value: string | null | undefined,
): ProposalTonePreset | undefined {
  return resolveProposalVoicePreset(value);
}

function resolveFormalityLevel(
  value: string | null | undefined,
): ProposalFormalityLevel | undefined {
  const normalized = normalizeToneToken(value);
  if (!normalized) return undefined;
  return VALID_FORMALITY_LEVELS.has(normalized as ProposalFormalityLevel)
    ? (normalized as ProposalFormalityLevel)
    : undefined;
}

function resolveCreativityLevel(
  value: string | null | undefined,
): ProposalCreativityLevel | undefined {
  const normalized = normalizeToneToken(value);
  if (!normalized) return undefined;
  const legacy = LEGACY_CREATIVITY_NORMALIZATION[normalized];
  if (legacy) return legacy;
  return VALID_CREATIVITY_LEVELS.has(normalized as ProposalCreativityLevel)
    ? (normalized as ProposalCreativityLevel)
    : undefined;
}

function resolvePresetBaseline(
  preset: ProposalTonePreset,
): EffectiveProposalTone {
  const presetDefinition = getProposalVoicePresetDefinition(preset);
  return {
    formalityLevel: presetDefinition.formalityLevel,
    creativity: presetDefinition.creativity,
  };
}

export function resolveEffectiveProposalTone(
  input: ProposalToneInput,
): EffectiveProposalTone {
  const tonePreset =
    resolveTonePreset(input.tonePreset) ?? DEFAULT_PROPOSAL_TONE_PRESET;
  const presetBaseline = resolvePresetBaseline(tonePreset);
  return {
    formalityLevel:
      resolveFormalityLevel(input.formalityLevel) ??
      presetBaseline.formalityLevel,
    creativity:
      resolveCreativityLevel(input.creativity) ?? presetBaseline.creativity,
  };
}
