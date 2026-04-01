import type { ProposalToneTuning } from "./voicePresets";

export type ProposalCharacterLimitMode =
  | "none"
  | "linkedin_note_200"
  | "linkedin_inmail_2000"
  | "indeed_cover_letter_4000"
  | "upwork_proposal_advisory"
  | "custom";

export const DEFAULT_PROPOSAL_CHARACTER_LIMIT_MODE: ProposalCharacterLimitMode =
  "none";

export const DEFAULT_PROPOSAL_CHARACTER_LIMIT_VALUE = 1500;

const CHARACTER_LIMIT_PRESETS: Record<
  Exclude<ProposalCharacterLimitMode, "none" | "custom">,
  { value: number; advisory?: boolean; label: string }
> = {
  linkedin_note_200: {
    value: 200,
    advisory: false,
    label: "LinkedIn note",
  },
  linkedin_inmail_2000: {
    value: 2000,
    advisory: false,
    label: "LinkedIn InMail",
  },
  indeed_cover_letter_4000: {
    value: 4000,
    advisory: false,
    label: "Indeed cover letter",
  },
  upwork_proposal_advisory: {
    value: 2500,
    advisory: true,
    label: "Upwork proposal",
  },
};

export const PROPOSAL_CHARACTER_LIMIT_TOAST_THRESHOLDS = [
  {
    id: "proposal-limit-200",
    limit: 200,
    advisory: false,
    title: "Proposal is getting long",
    description: "This draft has crossed 200 characters.",
  },
  {
    id: "proposal-limit-1000",
    limit: 1000,
    advisory: false,
    title: "Proposal is getting much longer",
    description: "This draft has crossed 1000 characters.",
  },
  {
    id: "proposal-limit-2000",
    limit: 2000,
    advisory: true,
    title: "Proposal may be too long",
    description: "This draft has crossed 2000 characters.",
  },
] as const;

export function sanitizeProposalCharacterLimit(
  value: unknown,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  if (rounded <= 0) {
    return null;
  }

  return Math.min(rounded, 10000);
}

export function resolveProposalCharacterLimit(args: {
  mode?: ProposalCharacterLimitMode | null;
  value?: number | null;
}): number | null {
  const mode = args.mode ?? "none";
  if (mode === "none") {
    return null;
  }

  if (mode === "custom") {
    return sanitizeProposalCharacterLimit(args.value);
  }

  return CHARACTER_LIMIT_PRESETS[mode]?.value ?? null;
}

export function resolveProposalCharacterLimitSelection(args: {
  mode?: ProposalCharacterLimitMode | null;
  value?: number | null;
}): {
  mode: ProposalCharacterLimitMode;
  value: number | null;
  advisory: boolean;
  label: string;
} {
  const mode = args.mode ?? "none";

  if (mode === "custom") {
    return {
      mode,
      value: resolveProposalCharacterLimit(args),
      advisory: false,
      label: "Custom limit",
    };
  }

  if (mode !== "none" && mode in CHARACTER_LIMIT_PRESETS) {
    const preset = CHARACTER_LIMIT_PRESETS[mode];
    return {
      mode,
      value: preset.value,
      advisory: Boolean(preset.advisory),
      label: preset.label,
    };
  }

  return {
    mode: "none",
    value: null,
    advisory: false,
    label: "No limit",
  };
}

export function resolveProposalToneTuning(
  value: unknown,
): ProposalToneTuning | null {
  return value === "more_human" ||
    value === "more_direct" ||
    value === "more_structured" ||
    value === "more_confident"
    ? value
    : null;
}

export function buildProposalGenerationControlsBlock(args: {
  toneTuning?: ProposalToneTuning | null;
  characterLimitMode?: ProposalCharacterLimitMode | null;
  characterLimit?: number | null;
}): string {
  const lines: string[] = [];

  if (args.toneTuning) {
    lines.push(`Tone tuning: ${args.toneTuning}.`);
  }

  if (args.characterLimitMode && args.characterLimitMode !== "none") {
    if (args.characterLimit) {
      lines.push(`Keep the output within ${args.characterLimit} characters.`);
    } else {
      lines.push(`Respect the selected character-limit mode: ${args.characterLimitMode}.`);
    }
  }

  return lines.join("\n");
}
