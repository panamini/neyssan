import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_INTERACTION_EVENT_NAMES,
  AI_INTERACTION_TELEMETRY_EVENT,
  createAiInteractionId,
  recordAiInteractionEvent,
  setAiInteractionTelemetrySink,
  type AiInteractionTelemetryEvent,
} from "../aiInteractionTelemetry";

describe("aiInteractionTelemetry", () => {
  afterEach(() => {
    setAiInteractionTelemetrySink(null);
  });

  it("supports exactly the editor AI lifecycle events", () => {
    expect(AI_INTERACTION_EVENT_NAMES).toEqual([
      "ai_started",
      "ai_completed",
      "ai_failed",
      "ai_accepted",
      "ai_discarded",
      "ai_undone",
    ]);
  });

  it("records metadata-only events to the configured sink", () => {
    const events: AiInteractionTelemetryEvent[] = [];
    setAiInteractionTelemetrySink((event) => events.push(event));

    const event = recordAiInteractionEvent({
      name: "ai_completed",
      interactionId: "ai_test",
      surface: "proposal_editor",
      actionId: "rewrite",
      timestamp: 123,
    });

    expect(events).toEqual([event]);
    expect(event).toEqual({
      name: "ai_completed",
      interactionId: "ai_test",
      surface: "proposal_editor",
      actionId: "rewrite",
      applyMode: "preview_required",
      outputMode: "single_text",
      timestamp: 123,
    });
  });

  it("dispatches a browser custom event for existing integrations", () => {
    const listener = vi.fn();
    window.addEventListener(
      AI_INTERACTION_TELEMETRY_EVENT,
      listener as EventListener,
    );

    try {
      recordAiInteractionEvent({
        name: "ai_accepted",
        interactionId: "ai_browser",
        surface: "section_editor",
        actionId: "fix_grammar",
        timestamp: 456,
      });
    } finally {
      window.removeEventListener(
        AI_INTERACTION_TELEMETRY_EVENT,
        listener as EventListener,
      );
    }

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toMatchObject({
      name: "ai_accepted",
      interactionId: "ai_browser",
      surface: "section_editor",
      actionId: "fix_grammar",
      applyMode: "inline_replace_with_undo",
    });
  });

  it("drops content-like fields from runtime payloads", () => {
    const event = recordAiInteractionEvent({
      name: "ai_failed",
      interactionId: "ai_no_content",
      surface: "summary_modal",
      actionId: "custom",
      errorKind: "request_failed",
      timestamp: 789,
      selectedText: "private CV text",
      generatedText: "private AI text",
      prompt: "private instruction",
    } as Parameters<typeof recordAiInteractionEvent>[0] & {
      selectedText: string;
      generatedText: string;
      prompt: string;
    });

    expect(event).not.toHaveProperty("selectedText");
    expect(event).not.toHaveProperty("generatedText");
    expect(event).not.toHaveProperty("prompt");
    expect(JSON.stringify(event)).not.toContain("private CV text");
    expect(JSON.stringify(event)).not.toContain("private AI text");
    expect(JSON.stringify(event)).not.toContain("private instruction");
  });

  it("creates stable-looking interaction ids", () => {
    expect(createAiInteractionId()).toMatch(/^ai_/);
  });
});
