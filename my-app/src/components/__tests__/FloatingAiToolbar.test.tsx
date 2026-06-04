import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FloatingAiToolbar, {
  INLINE_AI_ACTIONS,
} from "../FloatingAiToolbar";

let toolbarMeasurable = true;
let collapsedDensityMatches = false;

vi.mock("@/components/ui/body-portal", () => ({
  BodyPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("FloatingAiToolbar", () => {
  beforeEach(() => {
    toolbarMeasurable = true;
    collapsedDensityMatches = false;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 768,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches:
          query === "(max-width: 420px)" && collapsedDensityMatches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
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
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 768,
    });
    vi.restoreAllMocks();
    document.body.innerHTML = "";
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

    expect(screen.queryByRole("textbox", { name: "Ask AI" })).toBeNull();
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

    expect(
      await screen.findByRole("button", { name: "Rewrite" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shorten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fix" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clarify" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Strengthen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tailor" })).toBeNull();
  });

  it("adds contextual job actions when job context actions are enabled", async () => {
    const onRunAction = vi.fn();

    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        includeJobContextActions
        onClose={vi.fn()}
        onRunAction={onRunAction}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Rewrite" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shorten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fix" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tailor" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(onRunAction).not.toHaveBeenCalled();
  });

  it("hosts local formatting actions in the same selection toolbar", async () => {
    const onFormat = vi.fn();

    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        formattingActions={[
          {
            id: "bold",
            label: "Bold",
            icon: <span aria-hidden="true">B</span>,
            onRun: onFormat,
          },
        ]}
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Rewrite" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onFormat).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("toolbar", { name: "Selected text actions" }))
      .toHaveLength(1);
  });

  it("keeps compact mode AI-first and switches Edit into formatting actions", async () => {
    const onFormat = vi.fn();

    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        formattingActions={[
          {
            id: "bold",
            label: "Bold",
            onRun: onFormat,
          },
          {
            id: "italic",
            label: "Italic",
            onRun: onFormat,
          },
          {
            id: "underline",
            label: "Underline",
            onRun: onFormat,
          },
          {
            id: "list",
            label: "List",
            onRun: onFormat,
          },
        ]}
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Rewrite" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shorten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("button", { name: "Back to AI" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Bold" }).at(-1)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Italic" }).at(-1)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Underline" }).at(-1)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "List" }).at(-1)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "List" }).at(-1)!);

    expect(onFormat).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Rewrite" })).toBeInTheDocument();
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
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Ask AI" }), {
      key: "Enter",
    });

    expect(onRunAction).toHaveBeenCalledWith(
      "custom",
      "Make this sound calmer.",
    );
  });

  it("submits a custom instruction from the Send button", async () => {
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
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Ask AI" }), {
      target: { value: "Make this sound calmer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onRunAction).toHaveBeenCalledWith(
      "custom",
      "Make this sound calmer.",
    );
  });

  it("replaces the Ask button with the inline prompt while expanded", async () => {
    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    fireEvent.click((await screen.findAllByRole("button", { name: "Ask" }))[0]);

    expect(screen.getByRole("textbox", { name: "Ask AI" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("keeps the Ask focus ring on the full input container", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles/ds-v2.css"), "utf8");

    expect(styles).toContain(".ds-ask-ai:focus-within");
    expect(styles).toMatch(/\.ds-ask-ai:focus-within\s*\{[^}]*outline-color:\s*var\(--fr\)/s);
    expect(styles).toMatch(/\.ds-ask-ai\s*\{[^}]*outline:\s*2px solid transparent/s);
    expect(styles).toMatch(/\.ds-ask-ai__input\s*\{[^}]*outline:\s*none/s);
    expect(styles).toMatch(/\.ds-ask-ai__input\s*\{[^}]*box-shadow:\s*none !important/s);
  });

  it("keeps AI action labels visible in short desktop windows", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles/ds-v2.css"), "utf8");

    expect(styles).toContain(".ds-ai-toolbar__ai-label");
    expect(styles).not.toContain("@media (max-height: 680px)");
  });

  it("keeps the very collapsed toolbar compact and icon-only for edit", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles/ds-v2.css"), "utf8");

    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.ds-ai-toolbar__btn--edit\s*\{[\s\S]*?width:\s*28px;[\s\S]*?padding:\s*0;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.ds-ai-toolbar\s*\{[\s\S]*?gap:\s*3px;[\s\S]*?padding-inline:\s*var\(--s1\);/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.ds-ai-toolbar__btn\s*\{[\s\S]*?padding:\s*0 var\(--s2\);/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.ds-ai-toolbar__btn--edit \.ds-ai-toolbar__btn-label\s*\{[\s\S]*?display:\s*none;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.ds-ai-toolbar__actions \.ds-ai-toolbar__divider:not\(\.ds-ai-toolbar__divider--compact-edit\)\s*\{[\s\S]*?display:\s*none;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 420px\)[\s\S]*?\.ds-ai-toolbar\s*\{[\s\S]*?gap:\s*2px;[\s\S]*?min-height:\s*32px;[\s\S]*?padding:\s*0 2px;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 420px\)[\s\S]*?\.ds-ai-toolbar__actions \.ds-ai-toolbar__divider\s*\{[\s\S]*?display:\s*none;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 420px\)[\s\S]*?\.ds-ai-toolbar__divider--compact-edit\s*\{[\s\S]*?display:\s*none !important;/,
    );
    expect(styles).not.toContain(
      '.ds-ai-toolbar__actions .ds-ai-toolbar__btn:not(:last-child):not([aria-label="Ask"])',
    );
    expect(styles).toMatch(
      /@media \(max-width: 420px\)[\s\S]*?\.ds-ai-toolbar__actions \.ds-ai-toolbar__btn--ai-action:not\(\[aria-label="Ask"\]\)\s*\{[\s\S]*?display:\s*none;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 420px\)[\s\S]*?\.ds-ai-toolbar__btn--ai-action\s*\{[\s\S]*?width:\s*26px;[\s\S]*?padding:\s*0;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 420px\)[\s\S]*?\.ds-ai-toolbar__btn--edit\s*\{[\s\S]*?display:\s*inline-flex !important;[\s\S]*?width:\s*26px;[\s\S]*?padding:\s*0;/,
    );
  });

  it("focuses the Ask field when the inline prompt opens", async () => {
    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    fireEvent.click((await screen.findAllByRole("button", { name: "Ask" }))[0]);

    const askField = screen.getByRole("textbox", { name: "Ask AI" });
    await waitFor(() => {
      expect(askField).toHaveFocus();
    });
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

    expect(screen.getByRole("textbox", { name: "Ask AI" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Ask AI" })).toHaveAttribute(
      "placeholder",
      "Asking.",
    );
    expect(screen.getByRole("button", { name: "Shorten" })).toBeDisabled();

    rerender(<FloatingAiToolbar {...props} isLoading={false} pendingActionId={null} />);

    expect(screen.getByRole("textbox", { name: "Ask AI" })).not.toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Ask AI" })).not.toHaveAttribute(
      "placeholder",
      "Asking.",
    );
  });

  it("shows the targeted preset action busy state while AI is running", () => {
    render(
      <FloatingAiToolbar
        anchor={{ left: 120, top: 80 }}
        open
        isLoading
        pendingActionId="shorten"
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    const action = screen.getByRole("button", { name: "Shorten" });
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute("aria-busy", "true");
    expect(action.querySelector(".ds-btn__period")).not.toBeNull();
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

    await screen.findByRole("button", { name: "Rewrite" });
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

  it("keeps the current toolbar contents stable during the close animation", async () => {
    const props = {
      anchor: { left: 120, top: 80, bottom: 96 },
      open: true,
      formattingActions: [
        {
          id: "list",
          label: "List",
          onRun: vi.fn(),
        },
      ],
      onClose: vi.fn(),
      onRunAction: vi.fn(),
    };
    const { rerender } = render(<FloatingAiToolbar {...props} />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Back to AI" })).toBeInTheDocument();

    rerender(<FloatingAiToolbar {...props} open={false} formattingActions={[]} />);

    expect(screen.getByRole("toolbar", { hidden: true })).toHaveAttribute(
      "data-state",
      "closing",
    );
    expect(
      document.querySelector(
        ".ds-ai-toolbar__compact-format-actions[data-selection-toolbar-mode='format']",
      ),
    ).toBeTruthy();
    expect(
      document.querySelector("button[aria-label='Back to AI']"),
    ).toBeTruthy();
  });

  it("stays hidden on the first selection until initial DOM metrics are non-zero", async () => {
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
    expect(toolbar).toHaveAttribute("data-state", "closing");

    toolbarMeasurable = true;
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(toolbar).toHaveStyle({ visibility: "visible" });
      expect(toolbar).toHaveAttribute("data-state", "open");
    });
  });

  it("prefers a roomier above placement when space is available", async () => {
    const onSurfacePlacementChange = vi.fn();
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
        onSurfacePlacementChange={onSurfacePlacementChange}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Selected text actions" });
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("data-placement", "above");
      expect(toolbar).toHaveAttribute("data-cv-ai-surface-group", "true");
      expect(toolbar).toHaveAttribute("data-cv-ai-surface-state", "toolbar");
      expect(toolbar).toHaveAttribute("data-cv-ai-surface-placement", "above");
      expect(toolbar).toHaveAttribute("data-cv-ai-surface-mode", "popover");
      expect(toolbar).toHaveStyle({ top: "144px" });
      expect(onSurfacePlacementChange).toHaveBeenCalledWith(
        expect.objectContaining({ placement: "above", mode: "popover" }),
      );
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
      expect(toolbar).toHaveStyle({ top: "60px" });
    });
  });

  it("uses document bottom center only when collapsed density is active", async () => {
    collapsedDensityMatches = true;
    const stage = document.createElement("div");
    stage.className = "dasti-cv-paper-stage";
    const paper = document.createElement("div");
    paper.dataset.documentPage = "true";
    stage.appendChild(paper);
    document.body.appendChild(stage);

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRectMock() {
        if (this === stage) {
          return new DOMRect(100, 0, 600, 500);
        }
        if (this === paper) {
          return new DOMRect(140, 0, 520, 500);
        }

        return new DOMRect(0, 0, 0, 0);
      },
    );

    render(
      <FloatingAiToolbar
        anchor={{
          left: 220,
          top: 200,
          bottom: 216,
          leftEdge: 190,
          rightEdge: 250,
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
      expect(toolbar).toHaveAttribute("data-placement", "center");
      expect(toolbar).toHaveStyle({ left: "290px" });
      expect(toolbar).toHaveStyle({ top: "448px" });
    });
  });

  it("keeps selection anchoring in narrow windows while collapsed density is inactive", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 640,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 700,
    });
    const stage = document.createElement("div");
    stage.className = "dasti-cv-paper-stage";
    const paper = document.createElement("div");
    paper.dataset.documentPage = "true";
    stage.appendChild(paper);
    document.body.appendChild(stage);

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRectMock() {
        if (this === stage) {
          return new DOMRect(100, 0, 600, 500);
        }
        if (this === paper) {
          return new DOMRect(140, 0, 520, 500);
        }

        return new DOMRect(0, 0, 0, 0);
      },
    );

    render(
      <FloatingAiToolbar
        anchor={{
          left: 220,
          top: 200,
          bottom: 216,
          leftEdge: 190,
          rightEdge: 250,
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
      expect(toolbar).toHaveAttribute("data-cv-ai-surface-mode", "popover");
      expect(toolbar).toHaveAttribute("data-placement", "above");
      expect(toolbar).toHaveStyle({ left: "110px" });
      expect(toolbar).toHaveStyle({ top: "144px" });
    });
  });

  it("uses collapsed bottom center in narrow windows only when icon density is active", async () => {
    collapsedDensityMatches = true;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 700,
    });
    const stage = document.createElement("div");
    stage.className = "dasti-cv-paper-stage";
    const paper = document.createElement("div");
    paper.dataset.documentPage = "true";
    stage.appendChild(paper);
    document.body.appendChild(stage);

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRectMock() {
        if (this === stage) {
          return new DOMRect(100, 0, 600, 500);
        }
        if (this === paper) {
          return new DOMRect(140, 0, 520, 500);
        }

        return new DOMRect(0, 0, 0, 0);
      },
    );

    render(
      <FloatingAiToolbar
        anchor={{
          left: 220,
          top: 200,
          bottom: 216,
          leftEdge: 190,
          rightEdge: 250,
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
      expect(toolbar).toHaveAttribute("data-cv-ai-surface-mode", "popover");
      expect(toolbar).toHaveAttribute("data-placement", "center");
      expect(toolbar).toHaveStyle({ left: "149px" });
      expect(toolbar).toHaveStyle({ top: "448px" });
    });
  });

  it("flips above before entering the editor bottom fade zone", async () => {
    render(
      <FloatingAiToolbar
        anchor={{
          left: 220,
          top: 430,
          bottom: 446,
          aboveCenter: 220,
          aboveLeft: 190,
          aboveRight: 250,
          aboveLineHeight: 20,
          belowCenter: 220,
          belowLeft: 190,
          belowRight: 250,
          belowLineHeight: 20,
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
      expect(toolbar).toHaveAttribute("data-placement", "above");
      expect(toolbar).toHaveStyle({ top: "370px" });
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
    });
  });

  it("does not change horizontal position when a scroll refresh replaces the drag caret with range bounds", async () => {
    const stage = document.createElement("div");
    stage.className = "dasti-cv-paper-stage";
    document.body.appendChild(stage);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRectMock() {
        if (this === stage) {
          return new DOMRect(100, 0, 700, 500);
        }

        return new DOMRect(0, 0, 0, 0);
      },
    );

    const initialAnchor = {
      left: 680,
      top: 200,
      bottom: 216,
      leftEdge: 620,
      rightEdge: 740,
      width: 120,
      aboveCenter: 680,
      aboveLeft: 620,
      aboveRight: 740,
      aboveLineHeight: 20,
      focusCenter: 740,
      focusLeft: 740,
      focusRight: 740,
      focusTop: 200,
      focusBottom: 216,
      focusLineHeight: 20,
      containerLeft: 100,
      containerRight: 800,
      containerTop: 0,
      containerBottom: 500,
    };
    const refreshedRangeAnchor = {
      ...initialAnchor,
      focusCenter: 680,
      focusLeft: 620,
      focusRight: 740,
    };
    const { rerender } = render(
      <FloatingAiToolbar
        anchor={initialAnchor}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Selected text actions" });
    await waitFor(() => {
      expect(toolbar).toHaveStyle({ left: "570px" });
    });

    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await Promise.resolve();
    });
    rerender(
      <FloatingAiToolbar
        anchor={refreshedRangeAnchor}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
      />,
    );

    expect(toolbar).toHaveStyle({ left: "570px" });
  });

  it("does not publish the fallback-width position before initial toolbar metrics are measured", async () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function offsetWidthMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 280
          : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function offsetHeightMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true"
          ? 48
          : 0;
      },
    );
    const stage = document.createElement("div");
    stage.className = "dasti-cv-paper-stage";
    document.body.appendChild(stage);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRectMock() {
        if (this === stage) {
          return new DOMRect(100, 0, 700, 500);
        }

        return new DOMRect(0, 0, 0, 0);
      },
    );
    const onSurfacePlacementChange = vi.fn();

    render(
      <FloatingAiToolbar
        anchor={{
          left: 680,
          top: 200,
          bottom: 216,
          leftEdge: 620,
          rightEdge: 740,
          width: 120,
          aboveCenter: 680,
          aboveLeft: 620,
          aboveRight: 740,
          aboveLineHeight: 20,
          belowCenter: 680,
          belowLeft: 620,
          belowRight: 740,
          belowLineHeight: 20,
          containerLeft: 100,
          containerRight: 800,
          containerTop: 0,
          containerBottom: 500,
        }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
        onSurfacePlacementChange={onSurfacePlacementChange}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Selected text actions" });
    await waitFor(() => {
      expect(toolbar).toHaveStyle({ left: "516px" });
    });

    expect(onSurfacePlacementChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ left: 570 }),
    );
  });

  it("does not reveal a fallback-width caret-biased position before real toolbar metrics settle", async () => {
    vi.restoreAllMocks();
    toolbarMeasurable = false;
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function offsetWidthMock() {
        return (this as HTMLElement).dataset.inlineAiToolbar === "true" &&
          toolbarMeasurable
          ? 328
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
    const stage = document.createElement("div");
    stage.className = "dasti-cv-paper-stage";
    document.body.appendChild(stage);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRectMock() {
        if (this === stage) {
          return new DOMRect(100, 0, 700, 500);
        }

        return new DOMRect(0, 0, 0, 0);
      },
    );
    const onSurfacePlacementChange = vi.fn();

    render(
      <FloatingAiToolbar
        anchor={{
          left: 680,
          top: 200,
          bottom: 216,
          leftEdge: 620,
          rightEdge: 740,
          width: 120,
          aboveCenter: 680,
          aboveLeft: 620,
          aboveRight: 740,
          aboveLineHeight: 20,
          belowCenter: 680,
          belowLeft: 620,
          belowRight: 740,
          belowLineHeight: 20,
          focusCenter: 740,
          focusLeft: 740,
          focusRight: 740,
          focusTop: 200,
          focusBottom: 216,
          focusLineHeight: 20,
          containerLeft: 100,
          containerRight: 800,
          containerTop: 0,
          containerBottom: 500,
        }}
        open
        onClose={vi.fn()}
        onRunAction={vi.fn()}
        onSurfacePlacementChange={onSurfacePlacementChange}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { hidden: true });
    expect(toolbar).toHaveStyle({ visibility: "hidden" });
    expect(toolbar).not.toHaveStyle({ left: "570px" });
    expect(onSurfacePlacementChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ left: 570 }),
    );

    toolbarMeasurable = true;
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(toolbar).toHaveStyle({ visibility: "visible" });
      expect(toolbar).toHaveStyle({ left: "468px" });
    });
    expect(onSurfacePlacementChange).toHaveBeenCalledWith(
      expect.objectContaining({ left: 468 }),
    );
    expect(onSurfacePlacementChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ left: 570 }),
    );
  });

  it("uses selected bounds when a left-edge character selection reports a distant focus rect", async () => {
    render(
      <FloatingAiToolbar
        anchor={{
          left: 104,
          top: 200,
          bottom: 216,
          leftEdge: 100,
          rightEdge: 108,
          width: 8,
          aboveCenter: 104,
          aboveLeft: 100,
          aboveRight: 108,
          aboveLineHeight: 20,
          focusCenter: 620,
          focusLeft: 616,
          focusRight: 624,
          focusTop: 176,
          focusBottom: 192,
          focusLineHeight: 20,
          containerLeft: 96,
          containerRight: 760,
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
      expect(toolbar).toHaveStyle({ top: "144px" });
      expect(toolbar).toHaveStyle({ left: "100px" });
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
      expect(toolbar).toHaveStyle({ top: "164px" });
      expect(toolbar).toHaveStyle({ left: "210px" });
    });
  });
});
