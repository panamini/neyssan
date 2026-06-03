import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findInlinePaperEditableForSelection,
  getDomRangeSelectionState,
  getDomSelectionState,
  getInlinePaperFormattingActionsForSelection,
  getTextareaSelectionState,
  INLINE_PAPER_FORMATTING_KEY_ATTR,
  registerInlinePaperFormattingProvider,
} from "../editor-ai-selection";

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

describe("findInlinePaperEditableForSelection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps the inline AI toolbar target when focus lands on a wrapper outside the editable text", () => {
    const root = document.createElement("div");
    const wrapper = document.createElement("section");
    const editable = document.createElement("span");
    editable.dataset.inlinePaperEditable = "true";
    editable.textContent = "Selected target text";
    wrapper.appendChild(editable);
    root.appendChild(wrapper);
    document.body.appendChild(root);

    const textNode = editable.firstChild;
    expect(textNode).toBeTruthy();
    const range = document.createRange();
    range.setStart(textNode as Text, 0);
    range.setEnd(textNode as Text, "Selected".length);

    const selection = {
      rangeCount: 1,
      focusNode: root,
      anchorNode: root,
      getRangeAt: () => range,
    } as unknown as Selection;

    expect(findInlinePaperEditableForSelection(root, selection)).toBe(editable);
  });

  it("does not choose an arbitrary target when a selection spans multiple editables", () => {
    const root = document.createElement("div");
    const first = document.createElement("span");
    const second = document.createElement("span");
    first.dataset.inlinePaperEditable = "true";
    second.dataset.inlinePaperEditable = "true";
    first.textContent = "First field";
    second.textContent = "Second field";
    root.append(first, document.createTextNode(" "), second);
    document.body.appendChild(root);

    const range = document.createRange();
    range.setStart(first.firstChild as Text, 0);
    range.setEnd(second.firstChild as Text, 6);

    const selection = {
      rangeCount: 1,
      focusNode: root,
      anchorNode: root,
      getRangeAt: () => range,
    } as unknown as Selection;

    expect(findInlinePaperEditableForSelection(root, selection)).toBeNull();
  });
});

describe("getInlinePaperFormattingActionsForSelection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns registered formatting actions for a selection inside one paper editor", () => {
    const editable = document.createElement("span");
    editable.setAttribute(INLINE_PAPER_FORMATTING_KEY_ATTR, "paper-editor-1");
    editable.textContent = "Selected rich text";
    document.body.appendChild(editable);
    const action = {
      id: "bold",
      label: "Bold",
      onRun: vi.fn(),
    };
    const unregister = registerInlinePaperFormattingProvider(
      "paper-editor-1",
      () => [action],
    );
    const range = document.createRange();
    range.setStart(editable.firstChild as Text, 0);
    range.setEnd(editable.firstChild as Text, "Selected".length);
    const selection = {
      rangeCount: 1,
      isCollapsed: false,
      focusNode: editable.firstChild,
      anchorNode: editable.firstChild,
      getRangeAt: () => range,
    } as unknown as Selection;

    expect(getInlinePaperFormattingActionsForSelection(selection)).toEqual([
      action,
    ]);

    unregister();
  });

  it("does not return formatting actions for a selection spanning multiple paper editors", () => {
    const first = document.createElement("span");
    const second = document.createElement("span");
    first.setAttribute(INLINE_PAPER_FORMATTING_KEY_ATTR, "paper-editor-1");
    second.setAttribute(INLINE_PAPER_FORMATTING_KEY_ATTR, "paper-editor-2");
    first.textContent = "First";
    second.textContent = "Second";
    document.body.append(first, second);
    const unregisterFirst = registerInlinePaperFormattingProvider(
      "paper-editor-1",
      () => [{ id: "bold", label: "Bold", onRun: vi.fn() }],
    );
    const unregisterSecond = registerInlinePaperFormattingProvider(
      "paper-editor-2",
      () => [{ id: "italic", label: "Italic", onRun: vi.fn() }],
    );
    const range = document.createRange();
    range.setStart(first.firstChild as Text, 0);
    range.setEnd(second.firstChild as Text, "Second".length);
    const selection = {
      rangeCount: 1,
      isCollapsed: false,
      focusNode: second.firstChild,
      anchorNode: first.firstChild,
      getRangeAt: () => range,
    } as unknown as Selection;

    expect(getInlinePaperFormattingActionsForSelection(selection)).toEqual([]);

    unregisterFirst();
    unregisterSecond();
  });
});

describe("getDomRangeSelectionState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("remeasures the cloned range anchor after the document scrolls", () => {
    const root = document.createElement("div");
    const content = document.createElement("span");
    content.textContent = "Moving selection";
    root.appendChild(content);
    document.body.appendChild(root);

    let rect = new DOMRect(420, 80, 120, 20);
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 0, 700, 500),
    );
    const range = {
      commonAncestorContainer: content,
      getBoundingClientRect: () => rect,
      getClientRects: () => [rect],
    } as unknown as Range;

    expect(getDomRangeSelectionState(root, range, "Moving")).toEqual({
      text: "Moving",
      anchor: expect.objectContaining({
        left: 480,
        leftEdge: 420,
        rightEdge: 540,
      }),
    });

    rect = new DOMRect(360, 80, 120, 20);

    expect(getDomRangeSelectionState(root, range, "Moving")).toEqual({
      text: "Moving",
      anchor: expect.objectContaining({
        left: 420,
        leftEdge: 360,
        rightEdge: 480,
      }),
    });
  });
});

describe("getTextareaSelectionState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("anchors focus metrics to the highlighted textarea span", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "A proposal line";
    document.body.appendChild(textarea);
    textarea.setSelectionRange(0, 1, "backward");

    const textareaRect = new DOMRect(20, 40, 360, 180);
    const selectedRect = new DOMRect(24, 52, 8, 20);

    vi.spyOn(textarea, "getBoundingClientRect").mockReturnValue(textareaRect);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRectMock() {
        if (
          this instanceof HTMLSpanElement &&
          this.textContent === textarea.value.slice(0, 1)
        ) {
          return selectedRect;
        }

        return new DOMRect(0, 0, 0, 0);
      },
    );

    expect(getTextareaSelectionState(textarea)).toEqual({
      text: "A",
      start: 0,
      end: 1,
      anchor: expect.objectContaining({
        leftEdge: 24,
        rightEdge: 32,
        top: 52,
        bottom: 72,
        focusLeft: 24,
        focusRight: 32,
        focusTop: 52,
        focusBottom: 72,
        focusCenter: 28,
      }),
    });
  });
});
