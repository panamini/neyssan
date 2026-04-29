import {
  getAiActionDefinition,
  type AiActionId,
  type AiApplyMode,
  type AiOutputMode,
} from "./interactionRulebook";

export type EditorAiTextResult =
  | string
  | {
      kind?: "text";
      actionId?: string;
      text?: string;
      applyMode?: string;
      outputMode?: string;
      variants?: unknown[];
    };

export type NormalizedEditorAiTextResult = {
  actionId: AiActionId;
  actionLabel: string;
  text: string;
  applyMode: AiApplyMode;
  outputMode: AiOutputMode;
  variants: [];
};

export type TextSelectionRange = {
  start: number;
  end: number;
};

export type AiUndoSnapshot<T> = {
  before: T;
  after: T;
};

function isAiOutputMode(value: unknown): value is AiOutputMode {
  return value === "single_text";
}

export function normalizeEditorAiTextResult(
  result: EditorAiTextResult,
  requestedActionId: AiActionId,
): NormalizedEditorAiTextResult | null {
  const requestedDefinition = getAiActionDefinition(requestedActionId);
  if (!requestedDefinition) return null;

  const structuredResult = typeof result === "string" ? null : result;
  const text =
    typeof result === "string"
      ? result.trim()
      : String(result.text ?? "").trim();

  if (!text) return null;

  const resultDefinition =
    !structuredResult || typeof structuredResult.actionId !== "string"
      ? requestedDefinition
      : getAiActionDefinition(structuredResult.actionId) ?? requestedDefinition;

  const applyMode = requestedDefinition.applyMode;
  const outputMode =
    !structuredResult || !isAiOutputMode(structuredResult.outputMode)
      ? resultDefinition.outputMode
      : structuredResult.outputMode;

  return {
    actionId: resultDefinition.id,
    actionLabel: resultDefinition.label,
    text,
    applyMode,
    outputMode,
    variants: [],
  };
}

export function replaceSelectedText(args: {
  text: string;
  selection: TextSelectionRange;
  replacementText: string;
}): string {
  const start = Math.max(0, Math.min(args.selection.start, args.text.length));
  const end = Math.max(start, Math.min(args.selection.end, args.text.length));

  return (
    args.text.slice(0, start) + args.replacementText + args.text.slice(end)
  );
}

export function createAiUndoSnapshot<T>(before: T, after: T): AiUndoSnapshot<T> {
  return { before, after };
}

export function restoreAiUndoSnapshot<T>(snapshot: AiUndoSnapshot<T>): T {
  return snapshot.before;
}
