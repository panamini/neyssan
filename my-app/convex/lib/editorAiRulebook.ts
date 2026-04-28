export type AiActionId =
  | "fix_grammar"
  | "shorten"
  | "rewrite"
  | "clarify"
  | "strengthen"
  | "expand"
  | "tailor_to_job"
  | "custom";

export type AiRiskLevel = "low" | "medium" | "high" | "open_ended";

export type AiApplyMode = "inline_replace_with_undo" | "preview_required";

export type AiOutputMode = "single_text";

export type AiActionDefinition = {
  id: AiActionId;
  label: string;
  instruction: string;
  risk: AiRiskLevel;
  applyMode: AiApplyMode;
  outputMode: AiOutputMode;
  requiresJobContext?: boolean;
};

export const EDITOR_AI_ACTION_IDS = [
  "fix_grammar",
  "shorten",
  "rewrite",
  "clarify",
  "strengthen",
  "expand",
  "tailor_to_job",
  "custom",
] as const satisfies readonly AiActionId[];

export const EDITOR_AI_ACTION_DEFINITIONS = [
  {
    id: "fix_grammar",
    label: "Fix",
    instruction:
      "Fix grammar, spelling, punctuation, and phrasing issues in this selection.",
    risk: "low",
    applyMode: "inline_replace_with_undo",
    outputMode: "single_text",
  },
  {
    id: "shorten",
    label: "Shorten",
    instruction:
      "Shorten this selection while preserving the strongest meaning and proof.",
    risk: "low",
    applyMode: "inline_replace_with_undo",
    outputMode: "single_text",
  },
  {
    id: "rewrite",
    label: "Rewrite",
    instruction:
      "Rewrite this selection so it sounds more human, natural, credible, and professional.",
    risk: "medium",
    applyMode: "preview_required",
    outputMode: "single_text",
  },
  {
    id: "clarify",
    label: "Clarify",
    instruction:
      "Make this selection clearer, easier to scan, and more direct without changing its meaning.",
    risk: "medium",
    applyMode: "preview_required",
    outputMode: "single_text",
  },
  {
    id: "strengthen",
    label: "Strengthen",
    instruction:
      "Make this selection more persuasive and convincing without exaggerating or inventing facts.",
    risk: "medium",
    applyMode: "preview_required",
    outputMode: "single_text",
  },
  {
    id: "expand",
    label: "Expand",
    instruction:
      "Make this selection a little longer and fuller while keeping the same core meaning.",
    risk: "medium",
    applyMode: "preview_required",
    outputMode: "single_text",
  },
  {
    id: "tailor_to_job",
    label: "Tailor",
    instruction:
      "Tailor this selection to the selected job while preserving the user's factual claims.",
    risk: "high",
    applyMode: "preview_required",
    outputMode: "single_text",
    requiresJobContext: true,
  },
  {
    id: "custom",
    label: "Ask",
    instruction: "",
    risk: "open_ended",
    applyMode: "preview_required",
    outputMode: "single_text",
  },
] as const satisfies readonly AiActionDefinition[];

export const EDITOR_AI_LEGACY_ACTION_ALIASES = {
  ask: "custom",
  fix: "fix_grammar",
  make_clearer: "clarify",
  make_human: "rewrite",
  make_persuasive: "strengthen",
  lengthen: "expand",
} as const satisfies Record<string, AiActionId>;

const EDITOR_AI_ACTION_DEFINITION_BY_ID = new Map<
  AiActionId,
  AiActionDefinition
>(EDITOR_AI_ACTION_DEFINITIONS.map((definition) => [definition.id, definition]));

export function normalizeEditorAiActionId(
  actionId: string,
): AiActionId | null {
  if (EDITOR_AI_ACTION_DEFINITION_BY_ID.has(actionId as AiActionId)) {
    return actionId as AiActionId;
  }

  return EDITOR_AI_LEGACY_ACTION_ALIASES[
    actionId as keyof typeof EDITOR_AI_LEGACY_ACTION_ALIASES
  ] ?? null;
}

export function getEditorAiActionDefinition(
  actionId: string,
): AiActionDefinition | null {
  const canonicalActionId = normalizeEditorAiActionId(actionId);
  return canonicalActionId
    ? EDITOR_AI_ACTION_DEFINITION_BY_ID.get(canonicalActionId) ?? null
    : null;
}

export function requireEditorAiActionDefinition(
  actionId: string,
): AiActionDefinition {
  const definition = getEditorAiActionDefinition(actionId);
  if (!definition) {
    throw new Error(`Unsupported editor AI action: ${actionId}`);
  }
  return definition;
}
