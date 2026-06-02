import { describe, expect, it } from "vitest";
import {
  continueMarkdownListOnEnter,
  toggleMarkdownListForSelection,
} from "../proposal-textarea-list";

describe("proposal textarea list helpers", () => {
  it("turns selected plain lines into markdown list lines", () => {
    const text = "Intro\nLine one\nLine two\nOutro";
    const start = text.indexOf("Line one");
    const end = text.indexOf("Line two") + "Line two".length;

    expect(toggleMarkdownListForSelection(text, start, end)).toMatchObject({
      nextText: "Intro\n- Line one\n- Line two\nOutro",
    });
  });

  it("toggles selected list lines back to plain lines", () => {
    const text = "- Line one\n* Line two\n• Line three";

    expect(toggleMarkdownListForSelection(text, 0, text.length)).toMatchObject({
      nextText: "Line one\nLine two\nLine three",
    });
  });

  it("does not double-prefix existing list rows in a mixed selection", () => {
    const text = "- Existing\nNew";

    expect(toggleMarkdownListForSelection(text, 0, text.length)).toMatchObject({
      nextText: "- Existing\n- New",
    });
  });

  it("keeps blank selected lines blank", () => {
    const text = "Line one\n\nLine two";

    expect(toggleMarkdownListForSelection(text, 0, text.length)).toMatchObject({
      nextText: "- Line one\n\n- Line two",
    });
  });

  it("expands partial-line selections to full lines", () => {
    const text = "Intro\nLine one\nLine two\nOutro";
    const start = text.indexOf("one");
    const end = text.indexOf("two") + "two".length;
    const result = toggleMarkdownListForSelection(text, start, end);

    expect(result.nextText).toBe("Intro\n- Line one\n- Line two\nOutro");
    expect(result.nextSelectionStart).toBe(text.indexOf("Line one"));
  });

  it("inserts a starter list when there is no selection", () => {
    const text = "Intro\n";
    const result = toggleMarkdownListForSelection(text, text.length, text.length);

    expect(result.nextText).toBe("Intro\n- First item\n- Second item");
    expect(result.nextSelectionStart).toBe("Intro\n- ".length);
    expect(result.nextSelectionEnd).toBe("Intro\n- First item".length);
  });

  it("continues a list on Enter inside a non-empty list row", () => {
    const text = "- First item";
    const result = continueMarkdownListOnEnter(text, text.length, text.length);

    expect(result).toEqual({
      nextText: "- First item\n- ",
      nextSelectionStart: "- First item\n- ".length,
      nextSelectionEnd: "- First item\n- ".length,
    });
  });

  it("exits a list on Enter from an empty list row", () => {
    const text = "- First item\n- ";
    const result = continueMarkdownListOnEnter(text, text.length, text.length);

    expect(result).toEqual({
      nextText: "- First item\n",
      nextSelectionStart: "- First item\n".length,
      nextSelectionEnd: "- First item\n".length,
    });
  });
});
