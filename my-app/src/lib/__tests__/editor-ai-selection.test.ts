import { afterEach, describe, expect, it, vi } from "vitest";
import { getDomSelectionState } from "../editor-ai-selection";

describe("getDomSelectionState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("returns selection text and anchor for a non-empty selection inside the root", () => {
    const root = document.createElement("div");
    const content = document.createElement("span");
    content.textContent = "Selected text";
    root.appendChild(content);
    document.body.appendChild(root);

    const rect = new DOMRect(40, 30, 20, 12);
    vi.spyOn(window, "getSelection").mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => "Selected text",
      getRangeAt: () =>
        ({
          commonAncestorContainer: content,
          getBoundingClientRect: () => rect,
          getClientRects: () => [rect],
        }) as Range,
    } as Selection);

    expect(getDomSelectionState(root)).toEqual({
      text: "Selected text",
      anchor: {
        left: 60,
        top: 42,
      },
    });
  });

  it("ignores selections that fall outside the provided root", () => {
    const root = document.createElement("div");
    const inside = document.createElement("span");
    const outside = document.createElement("span");
    inside.textContent = "Inside";
    outside.textContent = "Outside";
    root.appendChild(inside);
    document.body.appendChild(root);
    document.body.appendChild(outside);

    const rect = new DOMRect(12, 18, 16, 10);
    vi.spyOn(window, "getSelection").mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => "Outside",
      getRangeAt: () =>
        ({
          commonAncestorContainer: outside,
          getBoundingClientRect: () => rect,
          getClientRects: () => [rect],
        }) as Range,
    } as Selection);

    expect(getDomSelectionState(root)).toBeNull();
  });
});
