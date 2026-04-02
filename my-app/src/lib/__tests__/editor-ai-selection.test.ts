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
      anchor: expect.objectContaining({
        left: 50,
        top: 30,
        bottom: 42,
        leftEdge: 40,
        rightEdge: 60,
        width: 20,
        height: 12,
        lineCount: 1,
        aboveCenter: 50,
        belowCenter: 50,
      }),
    });
  });

  it("captures first-line and last-line anchors for multi-line selections", () => {
    const root = document.createElement("div");
    const content = document.createElement("span");
    content.textContent = "First line\nSecond line";
    root.appendChild(content);
    document.body.appendChild(root);

    const firstRect = new DOMRect(24, 20, 56, 14);
    const secondRect = new DOMRect(40, 40, 70, 14);
    vi.spyOn(window, "getSelection").mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => "First line Second line",
      getRangeAt: () =>
        ({
          commonAncestorContainer: content,
          getBoundingClientRect: () => new DOMRect(24, 20, 86, 34),
          getClientRects: () => [firstRect, secondRect],
        }) as Range,
    } as Selection);

    expect(getDomSelectionState(root)).toEqual({
      text: "First line Second line",
      anchor: expect.objectContaining({
        lineCount: 2,
        aboveCenter: 52,
        belowCenter: 75,
        aboveLineHeight: 14,
        belowLineHeight: 14,
      }),
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
