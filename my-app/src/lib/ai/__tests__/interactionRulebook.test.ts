import { describe, expect, it } from "vitest";

import {
  AI_ACTION_IDS,
  VISIBLE_TOOLBAR_AI_ACTIONS,
  VISIBLE_TOOLBAR_AI_ACTION_IDS,
  getAiActionDefinition,
  getVisibleToolbarAiActions,
  isAiActionSupported,
} from "../interactionRulebook";

describe("AI interaction rulebook", () => {
  it("defines the canonical editor action IDs", () => {
    expect(AI_ACTION_IDS).toEqual([
      "fix_grammar",
      "shorten",
      "rewrite",
      "clarify",
      "strengthen",
      "expand",
      "tailor_to_job",
      "custom",
    ]);
  });

  it("keeps the visible toolbar actions minimal and canonical", () => {
    expect(VISIBLE_TOOLBAR_AI_ACTION_IDS).toEqual([
      "rewrite",
      "shorten",
      "fix_grammar",
      "custom",
    ]);
    expect(VISIBLE_TOOLBAR_AI_ACTIONS.map((action) => action.id)).toEqual(
      VISIBLE_TOOLBAR_AI_ACTION_IDS,
    );
    expect(getVisibleToolbarAiActions().map((action) => action.id)).toEqual(
      VISIBLE_TOOLBAR_AI_ACTION_IDS,
    );
  });

  it("defines tailor to job as a high-risk contextual action", () => {
    expect(getAiActionDefinition("tailor_to_job")).toMatchObject({
      risk: "high",
      applyMode: "preview_required",
      outputMode: "single_text",
      requiresJobContext: true,
      visibleInToolbar: false,
    });
    expect(VISIBLE_TOOLBAR_AI_ACTION_IDS).not.toContain("tailor_to_job");
    expect(
      getVisibleToolbarAiActions({ includeJobContextActions: true }).map(
        (action) => action.id,
      ),
    ).toEqual(["rewrite", "shorten", "fix_grammar", "tailor_to_job", "custom"]);
  });

  it("requires preview for custom and medium-risk actions", () => {
    expect(getAiActionDefinition("custom")).toMatchObject({
      risk: "open_ended",
      applyMode: "preview_required",
    });

    for (const actionId of ["rewrite", "clarify", "strengthen", "expand"]) {
      expect(getAiActionDefinition(actionId)).toMatchObject({
        risk: "medium",
        applyMode: "preview_required",
      });
    }
  });

  it("allows low-risk actions to inline replace with undo", () => {
    for (const actionId of ["fix_grammar", "shorten"]) {
      expect(getAiActionDefinition(actionId)).toMatchObject({
        risk: "low",
        applyMode: "inline_replace_with_undo",
      });
    }
  });

  it("gives every visible toolbar action a label", () => {
    for (const action of VISIBLE_TOOLBAR_AI_ACTIONS) {
      expect(action.label.trim()).not.toBe("");
    }
  });

  it("fails unsupported action lookup safely", () => {
    expect(getAiActionDefinition("make_human")).toBeNull();
    expect(isAiActionSupported("make_human")).toBe(false);
  });
});
