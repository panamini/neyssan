import { describe, expect, it } from "vitest";

import { AI_ACTION_IDS } from "../../../src/lib/ai/interactionRulebook";
import {
  EDITOR_AI_ACTION_IDS,
  getEditorAiActionDefinition,
  normalizeEditorAiActionId,
  requireEditorAiActionDefinition,
} from "../editorAiRulebook";

describe("editor AI rulebook", () => {
  it("defines the accepted canonical editor action IDs", () => {
    expect(EDITOR_AI_ACTION_IDS).toEqual([
      "fix_grammar",
      "shorten",
      "rewrite",
      "clarify",
      "strengthen",
      "expand",
      "tailor_to_job",
      "custom",
    ]);
    expect(EDITOR_AI_ACTION_IDS).toEqual(AI_ACTION_IDS);
  });

  it("normalizes only intentional legacy aliases", () => {
    expect(normalizeEditorAiActionId("make_clearer")).toBe("clarify");
    expect(normalizeEditorAiActionId("make_persuasive")).toBe("strengthen");
    expect(normalizeEditorAiActionId("lengthen")).toBe("expand");
    expect(normalizeEditorAiActionId("fix")).toBe("fix_grammar");
    expect(normalizeEditorAiActionId("make_human")).toBe("rewrite");
    expect(normalizeEditorAiActionId("ask")).toBe("custom");
    expect(normalizeEditorAiActionId("rewrite")).toBe("rewrite");
    expect(normalizeEditorAiActionId("tone")).toBeNull();
    expect(normalizeEditorAiActionId("summarize")).toBeNull();
  });

  it("rejects unknown actions", () => {
    expect(getEditorAiActionDefinition("unknown")).toBeNull();
    expect(() => requireEditorAiActionDefinition("unknown")).toThrow(
      /Unsupported editor AI action/,
    );
  });

  it("defines tailor to job as a high-risk job-context action", () => {
    expect(getEditorAiActionDefinition("tailor_to_job")).toMatchObject({
      risk: "high",
      applyMode: "preview_required",
      outputMode: "single_text",
      requiresJobContext: true,
    });
  });

  it("requires preview for custom and medium-risk actions", () => {
    expect(getEditorAiActionDefinition("custom")).toMatchObject({
      risk: "open_ended",
      applyMode: "preview_required",
    });

    for (const actionId of ["rewrite", "clarify", "strengthen", "expand"]) {
      expect(getEditorAiActionDefinition(actionId)).toMatchObject({
        risk: "medium",
        applyMode: "preview_required",
      });
    }
  });

  it("allows low-risk actions to inline replace with undo", () => {
    for (const actionId of ["fix_grammar", "shorten"]) {
      expect(getEditorAiActionDefinition(actionId)).toMatchObject({
        risk: "low",
        applyMode: "inline_replace_with_undo",
      });
    }
  });
});
