import {
  getAiActionDefinition,
  type AiActionId,
  type AiApplyMode,
  type AiOutputMode,
} from "./interactionRulebook";

export const AI_INTERACTION_EVENT_NAMES = [
  "ai_started",
  "ai_completed",
  "ai_failed",
  "ai_accepted",
  "ai_discarded",
  "ai_undone",
] as const;

export type AiInteractionEventName =
  (typeof AI_INTERACTION_EVENT_NAMES)[number];

export type AiInteractionSurface =
  | "proposal_editor"
  | "section_editor"
  | "summary_modal"
  | "experience_education_modal";

export type AiInteractionErrorKind = "empty_result" | "request_failed";

export type AiInteractionTelemetryEvent = {
  name: AiInteractionEventName;
  interactionId: string;
  surface: AiInteractionSurface;
  actionId: AiActionId;
  applyMode: AiApplyMode;
  outputMode: AiOutputMode;
  timestamp: number;
  errorKind?: AiInteractionErrorKind;
};

type AiInteractionTelemetryInput = {
  name: AiInteractionEventName;
  interactionId: string;
  surface: AiInteractionSurface;
  actionId: AiActionId;
  applyMode?: AiApplyMode;
  outputMode?: AiOutputMode;
  timestamp?: number;
  errorKind?: AiInteractionErrorKind;
};

export type AiInteractionTelemetrySink = (
  event: AiInteractionTelemetryEvent,
) => void;

export const AI_INTERACTION_TELEMETRY_EVENT = "neyssan:ai-interaction";

let telemetrySink: AiInteractionTelemetrySink | null = null;

export function createAiInteractionId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return `ai_${randomUuid}`;
  }

  return `ai_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function setAiInteractionTelemetrySink(
  sink: AiInteractionTelemetrySink | null,
): () => void {
  telemetrySink = sink;

  return () => {
    if (telemetrySink === sink) {
      telemetrySink = null;
    }
  };
}

export function recordAiInteractionEvent(
  input: AiInteractionTelemetryInput,
): AiInteractionTelemetryEvent {
  const actionDefinition = getAiActionDefinition(input.actionId);
  const event: AiInteractionTelemetryEvent = {
    name: input.name,
    interactionId: input.interactionId,
    surface: input.surface,
    actionId: input.actionId,
    applyMode:
      input.applyMode ??
      actionDefinition?.applyMode ??
      "preview_required",
    outputMode:
      input.outputMode ??
      actionDefinition?.outputMode ??
      "single_text",
    timestamp: input.timestamp ?? Date.now(),
    ...(input.errorKind ? { errorKind: input.errorKind } : {}),
  };

  try {
    telemetrySink?.(event);
  } catch {
    // Telemetry must never interrupt editor AI flows.
  }

  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function" &&
    typeof CustomEvent !== "undefined"
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent(AI_INTERACTION_TELEMETRY_EVENT, {
          detail: event,
        }),
      );
    } catch {
      // Telemetry must never interrupt editor AI flows.
    }
  }

  return event;
}
