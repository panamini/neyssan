import { describe, expect, it } from "vitest";

import {
  createAiUndoSnapshot,
  normalizeEditorAiTextResult,
  replaceSelectedText,
  restoreAiUndoSnapshot,
} from "../applyAiSuggestion";

describe("applyAiSuggestion", () => {
  it("normalizes structured preview-required editor AI results", () => {
    expect(
      normalizeEditorAiTextResult(
        {
          kind: "text",
          actionId: "custom",
          text: "Better text",
          applyMode: "preview_required",
          outputMode: "single_text",
          variants: [],
        },
        "custom",
      ),
    ).toEqual({
      actionId: "custom",
      actionLabel: "Ask",
      text: "Better text",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });
  });

  it("uses the requested action contract for legacy string results", () => {
    expect(normalizeEditorAiTextResult(" Fixed text ", "fix_grammar")).toMatchObject({
      actionId: "fix_grammar",
      actionLabel: "Fix",
      text: "Fixed text",
      applyMode: "inline_replace_with_undo",
      outputMode: "single_text",
    });
  });

  it.each(["rewrite", "custom", "tailor_to_job"] as const)(
    "keeps %s preview-required when backend returns inline apply mode",
    (requestedActionId) => {
      expect(
        normalizeEditorAiTextResult(
          {
            kind: "text",
            actionId: "fix_grammar",
            text: "Better text",
            applyMode: "inline_replace_with_undo",
            outputMode: "single_text",
          },
          requestedActionId,
        ),
      ).toMatchObject({
        actionId: "fix_grammar",
        actionLabel: "Fix",
        text: "Better text",
        applyMode: "preview_required",
        outputMode: "single_text",
      });
    },
  );

  it.each(["fix_grammar", "shorten"] as const)(
    "keeps %s inline replace behavior for low-risk requests",
    (requestedActionId) => {
      expect(
        normalizeEditorAiTextResult(
          {
            kind: "text",
            actionId: requestedActionId,
            text: "Better text",
            applyMode: "inline_replace_with_undo",
            outputMode: "single_text",
          },
          requestedActionId,
        ),
      ).toMatchObject({
        actionId: requestedActionId,
        text: "Better text",
        applyMode: "inline_replace_with_undo",
        outputMode: "single_text",
      });
    },
  );

  it("replaces selected text in string content", () => {
    expect(
      replaceSelectedText({
        text: "One rough sentence.",
        selection: { start: 4, end: 9 },
        replacementText: "clear",
      }),
    ).toBe("One clear sentence.");
  });

  it("restores the previous value from an undo snapshot", () => {
    const snapshot = createAiUndoSnapshot("before", "after");

    expect(restoreAiUndoSnapshot(snapshot)).toBe("before");
  });
});
