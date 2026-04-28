export type AiActionId =
  | "fix_grammar"
  | "shorten"
  | "rewrite"
  | "clarify"
  | "strengthen"
  | "expand"
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
  visibleInToolbar: boolean;
};

export const AI_ACTION_IDS = [
  "fix_grammar",
  "shorten",
  "rewrite",
  "clarify",
  "strengthen",
  "expand",
  "custom",
] as const satisfies readonly AiActionId[];

export const VISIBLE_TOOLBAR_AI_ACTION_IDS = [
  "rewrite",
  "shorten",
  "fix_grammar",
  "custom",
] as const satisfies readonly AiActionId[];

export const AI_ACTION_DEFINITIONS = [
  {
    id: "fix_grammar",
    label: "Fix",
    instruction:
      "Fix grammar, spelling, punctuation, and phrasing issues in this selection.",
    risk: "low",
    applyMode: "inline_replace_with_undo",
    outputMode: "single_text",
    visibleInToolbar: true,
  },
  {
    id: "shorten",
    label: "Shorten",
    instruction:
      "Shorten this selection while preserving the strongest meaning and proof.",
    risk: "low",
    applyMode: "inline_replace_with_undo",
    outputMode: "single_text",
    visibleInToolbar: true,
  },
  {
    id: "rewrite",
    label: "Rewrite",
    instruction:
      "Rewrite this selection so it sounds more human, natural, credible, and professional.",
    risk: "medium",
    applyMode: "preview_required",
    outputMode: "single_text",
    visibleInToolbar: true,
  },
  {
    id: "clarify",
    label: "Clarify",
    instruction:
      "Make this selection clearer, easier to scan, and more direct without changing its meaning.",
    risk: "medium",
    applyMode: "preview_required",
    outputMode: "single_text",
    visibleInToolbar: false,
  },
  {
    id: "strengthen",
    label: "Strengthen",
    instruction:
      "Make this selection more persuasive and convincing without exaggerating or inventing facts.",
    risk: "medium",
    applyMode: "preview_required",
    outputMode: "single_text",
    visibleInToolbar: false,
  },
  {
    id: "expand",
    label: "Expand",
    instruction:
      "Make this selection a little longer and fuller while keeping the same core meaning.",
    risk: "medium",
    applyMode: "preview_required",
    outputMode: "single_text",
    visibleInToolbar: false,
  },
  {
    id: "custom",
    label: "Ask",
    instruction: "",
    risk: "open_ended",
    applyMode: "preview_required",
    outputMode: "single_text",
    visibleInToolbar: true,
  },
] as const satisfies readonly AiActionDefinition[];

const AI_ACTION_DEFINITION_BY_ID = new Map<AiActionId, AiActionDefinition>(
  AI_ACTION_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getAiActionDefinition(
  actionId: string,
): AiActionDefinition | null {
  return AI_ACTION_DEFINITION_BY_ID.get(actionId as AiActionId) ?? null;
}

export function isAiActionSupported(actionId: string): actionId is AiActionId {
  return getAiActionDefinition(actionId) !== null;
}

export const VISIBLE_TOOLBAR_AI_ACTIONS = VISIBLE_TOOLBAR_AI_ACTION_IDS.map(
  (actionId) => AI_ACTION_DEFINITION_BY_ID.get(actionId),
).filter((definition): definition is AiActionDefinition =>
  Boolean(definition),
);
