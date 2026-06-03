import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProposalDocumentStage from "../ProposalDocumentStage";

const baseProps = {
  mode: "preview" as const,
  hasProposalContent: false,
  onModeChange: vi.fn(),
};

function renderStage(
  props: Partial<React.ComponentProps<typeof ProposalDocumentStage>> = {},
) {
  return render(
    <ProposalDocumentStage {...baseProps} {...props}>
      <div>Paper body</div>
    </ProposalDocumentStage>,
  );
}

function rect(left: number, width: number, top = 0): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + 100,
    width,
    height: 100,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("ProposalDocumentStage proposal actions", () => {
  it("groups document controls before writing actions and keeps tone out of the toolbar", () => {
    renderStage({
      onOpenHeading: vi.fn(),
      onOpenDesign: vi.fn(),
      onOpenTemplates: vi.fn(),
      onOpenDraft: vi.fn(),
      onOpenAsk: vi.fn(),
    });

    expect(
      screen.queryByRole("button", { name: "Tone: Warm tone" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Warm tone")).not.toBeInTheDocument();
    expect(screen.queryByText("Proposal text")).not.toBeInTheDocument();
    expect(screen.queryByText("Preparing")).not.toBeInTheDocument();
    expect(screen.queryByText("Standard")).not.toBeInTheDocument();
    expect(screen.queryByText("Concise")).not.toBeInTheDocument();
    expect(screen.queryByText("Detailed")).not.toBeInTheDocument();
    expect(screen.queryByText("standard")).not.toBeInTheDocument();
    expect(screen.queryByText("concise")).not.toBeInTheDocument();
    expect(screen.queryByText("detailed")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit proposal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview proposal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heading" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Design" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Templates" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Draft proposal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Document controls" }),
    ).toBeInTheDocument();
    const proposalToolbar = screen.getByRole("group", {
      name: "Proposal toolbar",
    });
    expect(
      screen.getByRole("group", { name: "Primary writing action" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Ask action" }),
    ).not.toBeInTheDocument();
    expect(
      proposalToolbar.querySelector(".dasti-icon-cluster__divider"),
    ).toBeNull();
    expect(
      within(proposalToolbar).getByRole("button", { name: "Draft proposal" }),
    ).toBeInTheDocument();
    expect(
      within(proposalToolbar).queryByRole("button", { name: "Ask" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toHaveAttribute(
      "title",
      "Ask",
    );
    expect(
      screen
        .getByRole("button", { name: "Ask" })
        .closest(".dasti-proposal-skeleton-stage__bar"),
    ).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Ask" })
        .closest(".dasti-proposal-skeleton-stage__ask-handle-layer"),
    ).toBeTruthy();
    const preview = screen.getByRole("button", { name: "Preview proposal" });
    const heading = screen.getByRole("button", { name: "Heading" });
    const design = screen.getByRole("button", { name: "Design" });
    const templates = screen.getByRole("button", { name: "Templates" });
    const draft = screen.getByRole("button", { name: "Draft proposal" });
    const ask = screen.getByRole("button", { name: "Ask" });
    expect(
      preview.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      heading.compareDocumentPosition(design) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      design.compareDocumentPosition(templates) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      templates.compareDocumentPosition(draft) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      draft.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it("wires the Heading action in preview and edit modes", () => {
    const onOpenHeading = vi.fn();
    const { rerender } = renderStage({ onOpenHeading, mode: "preview" });

    const heading = screen.getByRole("button", { name: "Heading" });
    expect(heading).toHaveAttribute("data-toolbar-tooltip", "Heading");
    expect(heading).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(heading);
    expect(onOpenHeading).toHaveBeenCalledTimes(1);

    rerender(
      <ProposalDocumentStage
        {...baseProps}
        mode="edit"
        headingOpen
        onOpenHeading={onOpenHeading}
      >
        <div>Paper body</div>
      </ProposalDocumentStage>,
    );

    expect(screen.getByRole("button", { name: "Heading" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("wires the Design action in preview and edit modes", () => {
    const onOpenDesign = vi.fn();
    const { rerender } = renderStage({ onOpenDesign, mode: "preview" });

    const design = screen.getByRole("button", { name: "Design" });
    expect(design).toHaveAttribute("data-toolbar-tooltip", "Design");
    expect(design).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(design);
    expect(onOpenDesign).toHaveBeenCalledTimes(1);

    rerender(
      <ProposalDocumentStage
        {...baseProps}
        mode="edit"
        designOpen
        onOpenDesign={onOpenDesign}
      >
        <div>Paper body</div>
      </ProposalDocumentStage>,
    );

    expect(screen.getByRole("button", { name: "Design" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows undo and redo only while editing", () => {
    const { rerender } = renderStage({ mode: "preview" });

    expect(
      screen.queryByRole("button", { name: "Undo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Redo" }),
    ).not.toBeInTheDocument();

    rerender(
      <ProposalDocumentStage {...baseProps} mode="edit">
        <div>Paper body</div>
      </ProposalDocumentStage>,
    );

    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redo" })).toBeInTheDocument();
  });

  it("wires Draft proposal and Ask without generating directly", () => {
    const onOpenDraft = vi.fn();
    const onOpenAsk = vi.fn();

    renderStage({ onOpenDraft, onOpenAsk });

    fireEvent.click(screen.getByRole("button", { name: "Draft proposal" }));
    expect(onOpenDraft).toHaveBeenCalledTimes(1);
    expect(onOpenAsk).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(onOpenAsk).toHaveBeenCalledTimes(1);
    expect(onOpenDraft).toHaveBeenCalledTimes(1);
  });

  it("keeps the source drawer directly reachable after generation", () => {
    const onOpenDraft = vi.fn();

    renderStage({
      hasProposalContent: true,
      onOpenDraft,
    });

    expect(
      screen.queryByRole("button", { name: "Draft proposal" }),
    ).not.toBeInTheDocument();

    const sourceContext = screen.getByRole("button", { name: "Job & CV" });
    expect(sourceContext).toHaveAttribute("data-source-context", "true");
    expect(sourceContext).toHaveAttribute("data-toolbar-tooltip", "Job & CV");
    expect(within(sourceContext).queryByText("Job & CV")).not.toBeInTheDocument();

    fireEvent.click(sourceContext);
    expect(onOpenDraft).toHaveBeenCalledTimes(1);
  });

  it("collapses Edit and Preview into one mode toggle in ultra compact paper width", () => {
    const onModeChange = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function getMockRect(this: Element) {
        if (this.classList.contains("dasti-proposal-skeleton-stage")) {
          return rect(0, 900);
        }
        if (this.classList.contains("dasti-proposal-sheet__preview-page")) {
          return rect(128, 238);
        }
        return rect(0, 900);
      });

    try {
      const { rerender } = render(
        <ProposalDocumentStage
          {...baseProps}
          mode="preview"
          onModeChange={onModeChange}
        >
          <div className="dasti-proposal-sheet__preview-page">Paper</div>
        </ProposalDocumentStage>,
      );

      expect(
        screen.queryByRole("button", { name: "Edit proposal" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Preview proposal" }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Switch to Edit" }));
      expect(onModeChange).toHaveBeenCalledWith("edit");

      rerender(
        <ProposalDocumentStage
          {...baseProps}
          mode="edit"
          onModeChange={onModeChange}
        >
          <div className="dasti-proposal-sheet__preview-page">Paper</div>
        </ProposalDocumentStage>,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Switch to Preview" }),
      );
      expect(onModeChange).toHaveBeenCalledWith("preview");
    } finally {
      rectSpy.mockRestore();
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it.each([
    [
      "30% zoom",
      128,
      238,
      "ultraCompact",
      "ultra",
      "iconOnly",
      "outside",
      "icon",
      "iconOnly",
      370,
      300,
    ],
    [
      "50% zoom",
      128,
      397,
      "compact",
      "compact",
      "short",
      "outside",
      "icon",
      "iconOnly",
      537,
      397,
    ],
    [
      "medium paper",
      128,
      520,
      "medium",
      null,
      "short",
      "outside",
      "icon",
      "iconOnly",
      660,
      520,
    ],
    [
      "100% zoom",
      128,
      794,
      "wide",
      null,
      "full",
      "edge-tab",
      "icon",
      "edgeTab",
      844,
      680,
    ],
    [
      "125% zoom",
      128,
      900,
      "wide",
      null,
      "full",
      "edge-tab",
      "icon",
      "edgeTab",
      844,
      680,
    ],
  ])(
    "anchors the toolbar to the rendered proposal paper rect at %s",
    (
      _,
      left,
      width,
      toolbarMode,
      density,
      draftDensity,
      askPlacement,
      askDensity,
      askMode,
      askHandleLeft,
      toolbarWidth,
    ) => {
      const requestAnimationFrameSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback) => {
          callback(0);
          return 1;
        });
      const cancelAnimationFrameSpy = vi
        .spyOn(window, "cancelAnimationFrame")
        .mockImplementation(() => undefined);
      const rectSpy = vi
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockImplementation(function getMockRect(this: Element) {
          if (this.classList.contains("dasti-proposal-skeleton-stage")) {
            return rect(0, 900);
          }
          if (this.classList.contains("dasti-proposal-sheet__preview-page")) {
            return rect(left, width, 96);
          }
          return rect(0, 900);
        });

      try {
        const { container } = render(
          <ProposalDocumentStage
            {...baseProps}
            onOpenDraft={vi.fn()}
            onOpenAsk={vi.fn()}
          >
            <div className="dasti-proposal-sheet__preview-page">Paper</div>
          </ProposalDocumentStage>,
        );

        const toolbar = container.querySelector<HTMLElement>(
          ".dasti-proposal-skeleton-stage__bar",
        );
        expect(
          toolbar?.style.getPropertyValue("--proposal-toolbar-paper-left"),
        ).toBe(`${left}px`);
        expect(
          toolbar?.style.getPropertyValue("--proposal-toolbar-paper-width"),
        ).toBe(`${width}px`);
        expect(
          toolbar?.style.getPropertyValue("--proposal-command-toolbar-width"),
        ).toBe(`${toolbarWidth}px`);
        expect(
          toolbar?.style.getPropertyValue(
            "--proposal-command-toolbar-min-width",
          ),
        ).toBe("300px");
        expect(
          toolbar?.style.getPropertyValue("--proposal-ask-handle-inline-start"),
        ).toBe(`${askHandleLeft}px`);
        const askHandleLayer = container.querySelector<HTMLElement>(
          ".dasti-proposal-skeleton-stage__ask-handle-layer",
        );
        expect(
          askHandleLayer?.style.getPropertyValue(
            "--proposal-toolbar-paper-left",
          ),
        ).toBe(`${left}px`);
        expect(
          askHandleLayer?.style.getPropertyValue(
            "--proposal-toolbar-paper-width",
          ),
        ).toBe(`${width}px`);
        expect(
          askHandleLayer?.style.getPropertyValue(
            "--proposal-ask-handle-block-start",
          ),
        ).toBe("112px");
        expect(
          askHandleLayer?.style.getPropertyValue(
            "--proposal-ask-handle-inline-start",
          ),
        ).toBe(`${askHandleLeft}px`);
        const stage = container.querySelector(".dasti-proposal-skeleton-stage");
        if (density) {
          expect(stage).toHaveAttribute("data-toolbar-density", density);
        } else {
          expect(stage).not.toHaveAttribute("data-toolbar-density");
        }
        expect(stage).toHaveAttribute("data-toolbar-mode", toolbarMode);
        expect(stage).toHaveAttribute("data-draft-label-mode", draftDensity);
        expect(stage).toHaveAttribute("data-ask-mode", askMode);
        expect(stage).toHaveAttribute(
          "data-draft-density",
          draftDensity === "iconOnly" ? "icon" : draftDensity,
        );
        expect(stage).toHaveAttribute("data-ask-placement", askPlacement);
        expect(stage).toHaveAttribute("data-ask-density", askDensity);
      } finally {
        rectSpy.mockRestore();
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
      }
    },
  );

  it("keeps Ask outside the paper when the visible canvas has enough right gutter", () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function getMockRect(this: Element) {
        if (this.classList.contains("dasti-proposal-skeleton-stage")) {
          return rect(0, 1200, 0);
        }
        if (this.classList.contains("dasti-proposal-sheet__preview-page")) {
          return rect(128, 680, 64);
        }
        return rect(0, 1200, 0);
      });

    try {
      const { container } = render(
        <ProposalDocumentStage
          {...baseProps}
          onOpenDraft={vi.fn()}
          onOpenAsk={vi.fn()}
        >
          <div className="dasti-proposal-sheet__preview-page">Paper</div>
        </ProposalDocumentStage>,
      );

      const askHandleLayer = container.querySelector<HTMLElement>(
        ".dasti-proposal-skeleton-stage__ask-handle-layer",
      );
      expect(
        askHandleLayer?.style.getPropertyValue(
          "--proposal-ask-handle-inline-start",
        ),
      ).toBe("820px");
      const stage = container.querySelector(".dasti-proposal-skeleton-stage");
      expect(stage).toHaveAttribute("data-ask-placement", "outside");
      expect(stage).toHaveAttribute("data-ask-density", "icon");
    } finally {
      rectSpy.mockRestore();
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("uses the forge canvas instead of the paper-sized stage for Ask placement", () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function getMockRect(this: Element) {
        if (this.classList.contains("dasti-proposal-skeleton-forge")) {
          return rect(0, 1200, 0);
        }
        if (this.classList.contains("dasti-proposal-skeleton-stage")) {
          return rect(128, 794, 0);
        }
        if (this.classList.contains("dasti-proposal-sheet__preview-page")) {
          return rect(128, 794, 96);
        }
        return rect(0, 1200, 0);
      });

    try {
      const { container } = render(
        <div className="dasti-proposal-skeleton-forge">
          <ProposalDocumentStage
            {...baseProps}
            onOpenDraft={vi.fn()}
            onOpenAsk={vi.fn()}
          >
            <div className="dasti-proposal-sheet__preview-page">Paper</div>
          </ProposalDocumentStage>
        </div>,
      );

      const askHandleLayer = container.querySelector<HTMLElement>(
        ".dasti-proposal-skeleton-stage__ask-handle-layer",
      );
      expect(
        askHandleLayer?.style.getPropertyValue(
          "--proposal-ask-handle-inline-start",
        ),
      ).toBe("934px");
      const stage = container.querySelector(".dasti-proposal-skeleton-stage");
      expect(stage).toHaveAttribute("data-ask-placement", "outside");
      expect(stage).toHaveAttribute("data-ask-density", "icon");
    } finally {
      rectSpy.mockRestore();
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("makes Draft icon-only from actual narrow viewport width", () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function getMockRect(this: Element) {
        if (this.classList.contains("dasti-proposal-skeleton-stage")) {
          return rect(0, 900);
        }
        if (this.classList.contains("dasti-proposal-sheet__preview-page")) {
          return rect(32, 680);
        }
        return rect(0, 900);
      });

    try {
      const { container } = render(
        <ProposalDocumentStage
          {...baseProps}
          onOpenDraft={vi.fn()}
          onOpenAsk={vi.fn()}
        >
          <div className="dasti-proposal-sheet__preview-page">Paper</div>
        </ProposalDocumentStage>,
      );

      const stage = container.querySelector(".dasti-proposal-skeleton-stage");
      expect(stage).toHaveAttribute("data-draft-density", "icon");
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      rectSpy.mockRestore();
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("keeps Job & CV on the same icon-only collapse rules as Draft", () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function getMockRect(this: Element) {
        if (this.classList.contains("dasti-proposal-skeleton-stage")) {
          return rect(0, 900);
        }
        if (this.classList.contains("dasti-proposal-sheet__preview-page")) {
          return rect(32, 680);
        }
        return rect(0, 900);
      });

    try {
      const { container } = render(
        <ProposalDocumentStage
          {...baseProps}
          hasProposalContent
          onOpenDraft={vi.fn()}
          onOpenAsk={vi.fn()}
        >
          <div className="dasti-proposal-sheet__preview-page">Paper</div>
        </ProposalDocumentStage>,
      );

      const stage = container.querySelector(".dasti-proposal-skeleton-stage");
      expect(stage).toHaveAttribute("data-draft-density", "icon");
      expect(screen.getByRole("button", { name: "Job & CV" })).toHaveAttribute(
        "data-source-context",
        "true",
      );
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      rectSpy.mockRestore();
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("positions Ask from the shared command layer baseline", () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function getMockRect(this: Element) {
        if (this.classList.contains("dasti-proposal-skeleton-stage")) {
          return rect(0, 900, 0);
        }
        if (this.classList.contains("dasti-proposal-sheet__preview-page")) {
          return rect(128, 238, 96);
        }
        return rect(0, 900, 0);
      });

    try {
      const { container } = render(
        <ProposalDocumentStage
          {...baseProps}
          onOpenDraft={vi.fn()}
          onOpenAsk={vi.fn()}
        >
          <div className="dasti-proposal-sheet__preview-page">Paper</div>
        </ProposalDocumentStage>,
      );

      const askHandleLayer = container.querySelector<HTMLElement>(
        ".dasti-proposal-skeleton-stage__ask-handle-layer",
      );
      expect(
        askHandleLayer?.style.getPropertyValue(
          "--proposal-ask-handle-block-start",
        ),
      ).toBe("112px");
    } finally {
      rectSpy.mockRestore();
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("uses shared app tooltips without native titles for stage toolbar controls", () => {
    renderStage({
      onOpenDraft: vi.fn(),
      onOpenAsk: vi.fn(),
    });

    const edit = screen.getByRole("button", { name: "Edit proposal" });
    const preview = screen.getByRole("button", { name: "Preview proposal" });
    const draft = screen.getByRole("button", { name: "Draft proposal" });
    const ask = screen.getByRole("button", { name: "Ask" });

    expect(edit).toHaveAttribute("data-toolbar-tooltip", "Edit");
    expect(preview).toHaveAttribute("data-toolbar-tooltip", "Preview");
    expect(edit).not.toHaveAttribute("title");
    expect(preview).not.toHaveAttribute("title");
    expect(draft).not.toHaveAttribute("title");
    expect(ask).toHaveAttribute("title", "Ask");
    expect(ask).toHaveAttribute("data-toolbar-tooltip", "Ask");
    expect(edit.closest(".dasti-toolbar--surface-tooltips")).toBeTruthy();
  });

  it.each([
    {
      locale: "fr",
      heading: "Titre",
      design: "Style",
      templates: "Modèles",
      draft: "Rédiger la lettre",
      ask: "Demander",
    },
    {
      locale: "es",
      heading: "Título",
      design: "Diseño",
      templates: "Plantillas",
      draft: "Redactar carta",
      ask: "Preguntar",
    },
  ])(
    "renders proposal toolbar chrome in $locale and keeps actions wired",
    ({ locale, heading, design, templates, draft, ask }) => {
      const onOpenHeading = vi.fn();
      const onOpenDesign = vi.fn();
      const onOpenTemplates = vi.fn();
      const onOpenDraft = vi.fn();
      const onOpenAsk = vi.fn();
      window.localStorage.setItem("twoweeks:ui-language", locale);
      window.localStorage.setItem("twoweeks:document-language", "ar");

      renderStage({
        labels: {
          heading,
          design,
          templates,
          draftProposal: draft,
          ask,
        },
        onOpenHeading,
        onOpenDesign,
        onOpenTemplates,
        onOpenDraft,
        onOpenAsk,
      });

      fireEvent.click(screen.getByRole("button", { name: heading }));
      fireEvent.click(screen.getByRole("button", { name: design }));
      fireEvent.click(screen.getByRole("button", { name: templates }));
      fireEvent.click(screen.getByRole("button", { name: draft }));
      fireEvent.click(screen.getByRole("button", { name: ask }));

      expect(onOpenHeading).toHaveBeenCalledTimes(1);
      expect(onOpenDesign).toHaveBeenCalledTimes(1);
      expect(onOpenTemplates).toHaveBeenCalledTimes(1);
      expect(onOpenDraft).toHaveBeenCalledTimes(1);
      expect(onOpenAsk).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole("button", { name: /Proposition|Propuesta/i }),
      ).not.toBeInTheDocument();
      expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
        "ar",
      );
    },
  );
});
