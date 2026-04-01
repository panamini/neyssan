import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FloatingAiToolbar, {
  INLINE_AI_ACTIONS,
} from "../FloatingAiToolbar";

describe("FloatingAiToolbar", () => {
  it("runs a preset action from the floating toolbar", async () => {
    const onRunAction = vi.fn();

    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        onClose={vi.fn()}
        onRunAction={onRunAction}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Shorten" }));

    expect(onRunAction).toHaveBeenCalledWith(
      "shorten",
      INLINE_AI_ACTIONS.find((action) => action.id === "shorten")?.instruction,
    );
  });

  it("submits a custom instruction from the inline prompt", async () => {
    const onRunAction = vi.fn();

    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        onClose={vi.fn()}
        onRunAction={onRunAction}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ask AI" }));
    fireEvent.change(screen.getByPlaceholderText("Tell AI what to change"), {
      target: { value: "Make this sound calmer." },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Ask AI" })[1]);

    expect(onRunAction).toHaveBeenCalledWith(
      "custom",
      "Make this sound calmer.",
    );
  });

  it("shows the targeted custom loading state without relabeling preset actions", async () => {
    const onRunAction = vi.fn();
    const props = {
      anchor: { left: 120, top: 80 },
      open: true,
      onClose: vi.fn(),
      onRunAction,
    };

    const { rerender } = render(<FloatingAiToolbar {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask AI" }));

    rerender(
      <FloatingAiToolbar
        {...props}
        isLoading
        pendingActionId="custom"
      />,
    );

    expect(screen.getByRole("button", { name: "Asking..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Shorten" })).toBeDisabled();
  });

  it("shows a spinner on the targeted preset action while AI is running", () => {
    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        isLoading
        pendingActionId="fix_grammar"
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    const action = screen.getByRole("button", { name: "Fix Grammar" });
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute("aria-busy", "true");
    expect(
      action.querySelector(".dasti-inline-ai-toolbar__action-spinner"),
    ).not.toBeNull();
  });

  it("dismisses on Escape", async () => {
    const onClose = vi.fn();

    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        onClose={onClose}
        onRunAction={vi.fn()}
      />,
    );

    await screen.findByRole("button", { name: "Fix Grammar" });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses on outside pointer down", async () => {
    const onClose = vi.fn();

    render(
      <div>
        <button type="button">Outside target</button>
        <FloatingAiToolbar
          anchor={{ left: 120, top: 80 }}
          open
          onClose={onClose}
          onRunAction={vi.fn()}
        />
      </div>,
    );

    await screen.findByRole("button", { name: "Make It Human" });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside target" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
