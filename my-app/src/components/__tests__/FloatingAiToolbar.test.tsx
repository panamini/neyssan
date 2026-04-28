import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FloatingAiToolbar, {
  INLINE_AI_ACTIONS,
} from "../FloatingAiToolbar";

let toolbarMeasurable = true;

vi.mock("@/components/ui/body-portal", () => ({
  BodyPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("FloatingAiToolbar", () => {
  beforeEach(() => {
    toolbarMeasurable = true;
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function offsetWidthMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true" &&
          toolbarMeasurable
          ? 220
          : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function offsetHeightMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true" &&
          toolbarMeasurable
          ? 48
          : 0;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the Ask field collapsed until the Ask action is clicked", () => {
    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    expect(screen.queryByPlaceholderText("Tell AI what to change")).toBeNull();
  });

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

  it("renders only the minimal canonical toolbar actions", async () => {
    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    expect(await screen.findByRole("button", { name: "Rewrite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shorten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fix" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clarify" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Strengthen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand" })).toBeNull();
  });

  it("sends the canonical fix action id", async () => {
    const onRunAction = vi.fn();

    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        onClose={vi.fn()}
        onRunAction={onRunAction}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Fix" }));

    expect(onRunAction).toHaveBeenCalledWith(
      "fix_grammar",
      INLINE_AI_ACTIONS.find((action) => action.id === "fix_grammar")
        ?.instruction,
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

    fireEvent.click((await screen.findAllByRole("button", { name: "Ask" }))[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Ask AI" }), {
      target: { value: "Make this sound calmer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

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
    fireEvent.click((await screen.findAllByRole("button", { name: "Ask" }))[0]);

    rerender(
      <FloatingAiToolbar
        {...props}
        isLoading
        pendingActionId="custom"
      />,
    );

    expect(screen.getByRole("button", { name: "Sending request" })).toBeDisabled();
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

    const action = screen.getByRole("button", { name: "Fix" });
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

    await screen.findByRole("button", { name: "Fix" });
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

    await screen.findByRole("button", { name: "Rewrite" });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside target" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays hidden until it has a measured anchored position", async () => {
    toolbarMeasurable = false;

    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80, bottom: 96 }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { hidden: true });
    expect(toolbar).toHaveStyle({ visibility: "hidden" });

    toolbarMeasurable = true;
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(toolbar).toHaveStyle({ visibility: "visible" });
    });
  });

  it("prefers a roomier above placement when space is available", async () => {
    render(
      <FloatingAiToolbar
        anchor={{
          left: 180,
          top: 200,
          bottom: 216,
          aboveCenter: 180,
          aboveLeft: 150,
          aboveRight: 210,
          aboveLineHeight: 20,
        }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Selected text actions" });
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("data-placement", "above");
      expect(toolbar).toHaveStyle({ top: "124px" });
    });
  });

  it("falls below when there is not enough room above the selection", async () => {
    render(
      <FloatingAiToolbar
        anchor={{
          left: 180,
          top: 36,
          bottom: 52,
          aboveCenter: 180,
          aboveLeft: 150,
          aboveRight: 210,
          aboveLineHeight: 20,
          belowCenter: 180,
          belowLeft: 150,
          belowRight: 210,
          belowLineHeight: 20,
        }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Selected text actions" });
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("data-placement", "below");
      expect(toolbar).toHaveStyle({ top: "80px" });
    });
  });

  it("uses smarter horizontal anchoring for short selections near an edge", async () => {
    render(
      <FloatingAiToolbar
        anchor={{
          left: 180,
          top: 200,
          bottom: 216,
          leftEdge: 170,
          rightEdge: 186,
          width: 16,
          aboveCenter: 180,
          aboveLeft: 170,
          aboveRight: 186,
          aboveLineHeight: 20,
          containerLeft: 100,
          containerRight: 700,
          containerTop: 0,
          containerBottom: 500,
        }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Selected text actions" });
    await waitFor(() => {
      expect(toolbar).toHaveStyle({ left: "166px" });
      expect(
        toolbar.style.getPropertyValue("--dasti-inline-ai-toolbar-pointer-offset"),
      ).toBe("14px");
    });
  });

  it("aligns multi-line selections to the selected block instead of the trailing focus point", async () => {
    render(
      <FloatingAiToolbar
        anchor={{
          left: 320,
          top: 220,
          bottom: 286,
          leftEdge: 116,
          rightEdge: 524,
          width: 408,
          height: 66,
          lineCount: 3,
          focusCenter: 486,
          focusLeft: 482,
          focusRight: 490,
          focusTop: 264,
          focusBottom: 286,
          focusLineHeight: 22,
          containerLeft: 96,
          containerRight: 760,
          containerTop: 120,
          containerBottom: 720,
        }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Selected text actions" });
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("data-placement", "above");
      expect(toolbar).toHaveStyle({ top: "142px" });
      expect(toolbar).toHaveStyle({ left: "376px" });
      expect(
        toolbar.style.getPropertyValue("--dasti-inline-ai-toolbar-pointer-offset"),
      ).toBe("110px");
    });
  });
});
