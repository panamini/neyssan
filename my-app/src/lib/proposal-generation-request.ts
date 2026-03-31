import {
  getProposalVoicePresetDefinition,
} from "../../convex/lib/proposals/voicePresets";
import type { FormValues } from "../components/ProposalInputForm.schemas";
import type { ProposalGenerationPersonalizationPayload } from "./proposal-personalization";

export type ProposalGenerationRequestPayload = {
  jobTitle: FormValues["jobTitle"];
  jobDescription: FormValues["jobDescription"];
  clientRunId?: string;
  proposalType: FormValues["proposalType"];
  modelType: FormValues["modelType"];
  characterLimitMode: FormValues["characterLimitMode"];
  characterLimitValue: FormValues["characterLimitValue"];
  voicePreset?: FormValues["voicePreset"] | null;
  formalityLevel?: FormValues["formalityLevel"];
  creativity?: FormValues["creativity"];
} & ProposalGenerationPersonalizationPayload;

export function applyProposalVoiceSelection(
  values: FormValues,
  voicePresetOverride?: FormValues["voicePreset"] | null,
): FormValues {
  const effectiveVoicePreset =
    voicePresetOverride === undefined
      ? values.voicePreset
      : voicePresetOverride ?? undefined;
  const voicePresetDefinition = effectiveVoicePreset
    ? getProposalVoicePresetDefinition(effectiveVoicePreset)
    : null;

  return {
    ...values,
    voicePreset: effectiveVoicePreset,
    formalityLevel: voicePresetDefinition?.formalityLevel,
    creativity: voicePresetDefinition?.creativity,
  };
}

export function buildProposalGenerationRequest(
  values: FormValues,
  personalization: ProposalGenerationPersonalizationPayload,
  voicePresetOverride?: FormValues["voicePreset"] | null,
): ProposalGenerationRequestPayload {
  const normalizedValues = applyProposalVoiceSelection(
    values,
    voicePresetOverride,
  );
  const payload: ProposalGenerationRequestPayload = {
    jobTitle: normalizedValues.jobTitle,
    jobDescription: normalizedValues.jobDescription,
    proposalType: normalizedValues.proposalType,
    modelType: normalizedValues.modelType,
    characterLimitMode: normalizedValues.characterLimitMode,
    characterLimitValue: normalizedValues.characterLimitValue,
    ...personalization,
  };

  if (normalizedValues.voicePreset) {
    payload.voicePreset = normalizedValues.voicePreset;
    payload.formalityLevel = normalizedValues.formalityLevel;
    payload.creativity = normalizedValues.creativity;
  } else {
    payload.voicePreset = null;
  }

  return payload;
}
