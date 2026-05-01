import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "../EditorToolbar";

const remirrorMock = vi.hoisted(() => {
  const selection = { from: 3, to: 21, empty: false };
  const collapsedSelection = { from: 12, to: 12, empty: true };
  const dispatch = vi.fn();
  const focusView = vi.fn();
  const setSelection = vi.fn(() => ({ restored: true }));
  const focusCommand = vi.fn();
  const toggleBold = vi.fn();
  const toggleItalic = vi.fn();
  const toggleUnderline = vi.fn();
  const run = vi.fn();
  const chainFocus = vi.fn(() => chain);
  const chainToggleBold = vi.fn(() => chain);
  const chainToggleItalic = vi.fn(() => chain);
  const chainToggleUnderline = vi.fn(() => chain);
  const chain = {
    focus: chainFocus,
    toggleBold: chainToggleBold,
    toggleItalic: chainToggleItalic,
    toggleUnderline: chainToggleUnderline,
    run,
  };
  const view = {
    focus: focusView,
    dispatch,
    state: {
      selection,
      tr: { setSelection },
    },
  };

  return {
    selection,
    collapsedSelection,
    view,
    dispatch,
    focusView,
    setSelection,
    focusCommand,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    chainFocus,
    chainToggleBold,
    chainToggleItalic,
    chainToggleUnderline,
    run,
  };
});

vi.mock("@remirror/react", () => ({
  useCommands: () => ({
    focus: remirrorMock.focusCommand,
    toggleBold: remirrorMock.toggleBold,
    toggleItalic: remirrorMock.toggleItalic,
    toggleUnderline: remirrorMock.toggleUnderline,
  }),
  useChainedCommands: () => ({
    focus: remirrorMock.chainFocus,
    toggleBold: remirrorMock.chainToggleBold,
    toggleItalic: remirrorMock.chainToggleItalic,
    toggleUnderline: remirrorMock.chainToggleUnderline,
    run: remirrorMock.run,
  }),
  useActive: () => ({
    bold: () => false,
    italic: () => false,
    underline: () => false,
    bulletList: () => false,
  }),
  useEditorView: () => remirrorMock.view,
}));

vi.mock("@/lib/icons", () => ({
  Bold: () => <span>bold-icon</span>,
  Italic: () => <span>italic-icon</span>,
  List: () => <span>list-icon</span>,
  Underline: () => <span>underline-icon</span>,
}));

describe("EditorToolbar mark selection preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remirrorMock.view.state.selection = remirrorMock.selection;
  });

  it.each([
    ["Toggle bold", "toggleBold", remirrorMock.chainToggleBold],
    ["Toggle italic", "toggleItalic", remirrorMock.chainToggleItalic],
    ["Toggle underline", "toggleUnderline", remirrorMock.chainToggleUnderline],
  ] as const)(
    "restores selected list-item text before running %s",
    (label, _commandName, chainCommand) => {
      render(<EditorToolbar showLists={false} />);
      const button = screen.getByRole("button", { name: label });

      fireEvent.mouseDown(button);
      remirrorMock.view.state.selection = remirrorMock.collapsedSelection;
      fireEvent.click(button);

      expect(remirrorMock.setSelection).toHaveBeenCalledWith(remirrorMock.selection);
      expect(remirrorMock.dispatch).toHaveBeenCalledWith({ restored: true });
      expect(remirrorMock.focusView).toHaveBeenCalled();
      expect(remirrorMock.chainFocus).toHaveBeenCalled();
      expect(chainCommand).toHaveBeenCalled();
      expect(remirrorMock.run).toHaveBeenCalled();
    },
  );

  it("preserves a collapsed caret so bold affects future typed text only", () => {
    remirrorMock.view.state.selection = remirrorMock.collapsedSelection;
    render(<EditorToolbar showLists={false} />);
    const button = screen.getByRole("button", { name: "Toggle bold" });

    fireEvent.mouseDown(button);
    fireEvent.click(button);

    expect(remirrorMock.setSelection).toHaveBeenCalledWith(
      remirrorMock.collapsedSelection,
    );
    expect(remirrorMock.chainToggleBold).toHaveBeenCalled();
  });
});
