import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/components/ui/toast";
import { showUndoToast } from "../UndoToast";

describe("showUndoToast", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a neutral undo toast for six seconds", () => {
    const show = vi.spyOn(toast, "show").mockReturnValue("toast-1");
    const onUndo = vi.fn();

    showUndoToast({ title: "Change applied.", onUndo });

    expect(show).toHaveBeenCalledWith({
      title: "Change applied.",
      tone: "neutral",
      durationMs: 6000,
      action: {
        label: "Undo",
        onClick: onUndo,
      },
    });
  });
});
