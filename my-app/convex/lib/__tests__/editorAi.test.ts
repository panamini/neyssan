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

  it("rejects tailor to job when job context is missing", async () => {
    const runTextPrompt = vi.fn();

    await expect(
      runEditorSelectionTransform({
        mode: "tailor_to_job",
        instruction: "Tailor this.",
        selectedText: "Original text",
        runTextPrompt,
      }),
    ).rejects.toThrow(/requires compact job context/);
    expect(runTextPrompt).not.toHaveBeenCalled();
  });

  it("returns preview-required tailor to job results with compact job context", async () => {
    const runTextPrompt = vi.fn().mockResolvedValue(" Tailored text ");

    const result = await runEditorSelectionTransform({
      mode: "tailor_to_job",
      instruction: "Tailor this.",
      selectedText: "Original text",
      jobContext: {
        jobId: "job_123",
        title: "Operations Associate",
        company: "Acme",
        visibleSummary: "Customer operations role.",
        visibleRequirements: ["Customer support", "Scheduling"],
        visibleKeywords: ["operations", "customers"],
      },
      runTextPrompt,
    });

    expect(result).toEqual({
      kind: "text",
      actionId: "tailor_to_job",
      text: "Tailored text",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });
    expect(runTextPrompt).toHaveBeenCalledTimes(1);
    const prompt = runTextPrompt.mock.calls[0]?.[0]?.prompt ?? "";
    expect(prompt).toContain("Transformation action: tailor_to_job");
    expect(prompt).toContain("Operations Associate");
    expect(prompt).toContain("Customer support");
    expect(prompt).not.toContain("raw job text");
  });

  it("rejects tailor to job when compact job context is insufficient", async () => {
    const runTextPrompt = vi.fn();

    await expect(
      runEditorSelectionTransform({
        mode: "tailor_to_job",
        instruction: "Tailor this.",
        selectedText: "Original text",
        jobContext: {
          jobId: "job_123",
        },
        runTextPrompt,
      }),
    ).rejects.toThrow(/requires compact job context/);
    expect(runTextPrompt).not.toHaveBeenCalled();
  });

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
