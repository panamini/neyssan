import type { FormValues } from "../components/ProposalInputForm.schemas";

export function getVoicePresetDisplayLabel(
  preset: FormValues["voicePreset"] | null | undefined,
): string {
  if (!preset) return "Auto";
  if (preset === "signature") return "Natural";
  if (preset === "expert") return "Formal";
  if (preset === "engaging") return "Warm";
  if (preset === "direct") return "Direct";
  if (preset === "storyteller") return "Storyteller";
  return "Natural";
}
