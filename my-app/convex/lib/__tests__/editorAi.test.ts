import { describe, expect, it, vi } from "vitest";

import { runEditorSelectionTransform } from "../editorAi";

describe("editor AI transform contract", () => {
  async function runTransform(mode: string) {
    const runTextPrompt = vi.fn().mockResolvedValue(" Improved text ");

    const result = await runEditorSelectionTransform({
      mode,
      instruction: "Improve this.",
      selectedText: "Original text",
      runTextPrompt,
    });

    return { result, runTextPrompt };
  }

  it("returns low-risk fix grammar results with inline replace apply mode", async () => {
    const { result } = await runTransform("fix_grammar");

    expect(result).toEqual({
      kind: "text",
      actionId: "fix_grammar",
      text: "Improved text",
      applyMode: "inline_replace_with_undo",
      outputMode: "single_text",
      variants: [],
    });
  });

  it("returns low-risk shorten results with inline replace apply mode", async () => {
    const { result } = await runTransform("shorten");

    expect(result.applyMode).toBe("inline_replace_with_undo");
    expect(result.actionId).toBe("shorten");
    expect(result.variants).toEqual([]);
  });

  it.each(["rewrite", "clarify", "strengthen", "expand", "custom"] as const)(
    "returns preview-required results for %s",
    async (mode) => {
      const { result } = await runTransform(mode);

      expect(result).toMatchObject({
        kind: "text",
        actionId: mode,
        applyMode: "preview_required",
        outputMode: "single_text",
      });
      expect(result.variants).toEqual([]);
    },
  );

  it("normalizes the legacy ask alias to canonical custom", async () => {
    const { result } = await runTransform("ask");

    expect(result.actionId).toBe("custom");
    expect(result.applyMode).toBe("preview_required");
    expect(result.variants).toEqual([]);
  });

  it("rejects invalid actions before calling the model", async () => {
    const runTextPrompt = vi.fn();

    await expect(
      runEditorSelectionTransform({
        mode: "tone",
        instruction: "Change tone.",
        selectedText: "Original text",
        runTextPrompt,
      }),
    ).rejects.toThrow(/Unsupported editor AI action/);
    expect(runTextPrompt).not.toHaveBeenCalled();
  });
});
