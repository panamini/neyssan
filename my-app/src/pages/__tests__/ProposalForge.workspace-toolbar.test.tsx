import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";

const proposalDisplaySpy = vi.fn();
const proposalInputFormSpy = vi.fn();
const proposalComposeToolbarSpy = vi.fn();
const useQueryMock = vi.fn(() => null);

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (...args: any[]) => useQueryMock(...args),
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: (props: Record<string, unknown>) => {
    proposalInputFormSpy(props);
    const submitFromBrief = React.useCallback(
      () =>
        props.onSubmit?.(
          {
            jobTitle: "Game UI Artist",
            jobDescription:
              "Detailed role description for the proposal brief capsule tests.",
            proposalType: "cover_letter",
            voicePreset: undefined,
            formalityLevel: undefined,
            creativity: undefined,
            toneTuning: null,
            characterLimitMode: "none",
            characterLimitValue: 1500,
            modelType: "chatgpt",
          },
          "Generated proposal body.",
        ),
      [props.onSubmit],
    );

    React.useEffect(() => {
      props.onGenerateControlChange?.({
        trigger: submitFromBrief,
        label: "Generate",
        disabled: false,
        state: "idle",
      });

      return () => {
        props.onGenerateControlChange?.(null);
      };
    }, [props.onGenerateControlChange, submitFromBrief]);

    return (
      <div data-testid="proposal-input-form">
        Mock compose shell
        {props.headerAction as React.ReactNode}
        <button
          type="button"
          onClick={submitFromBrief}
        >
          Generate sample proposal
        </button>
      </div>
    );
  },
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: (props: Record<string, any>) => {
    proposalComposeToolbarSpy(props);
    return (
      <div
        data-testid="proposal-compose-toolbar"
        data-collapsed={props.collapsed ? "true" : "false"}
        data-transition-state={props.transitionState ?? "idle"}
      >
        <button
          type="button"
          onClick={() => props.onChange?.("expert")}
        >
          Set toolbar tone
        </button>
        <button
          type="button"
          onClick={() => props.onToggleCvPicker?.()}
        >
          Toggle toolbar CV picker
        </button>
        {props.onCollapseCompose ? (
          <button type="button" onClick={() => props.onCollapseCompose?.()}>
            Collapse compose
          </button>
        ) : null}
        {props.onRestoreCompose ? (
          <button type="button" onClick={() => props.onRestoreCompose?.()}>
            Restore compose
          </button>
        ) : null}
        {props.onGenerateFromBrief ? (
          <button type="button" onClick={() => props.onGenerateFromBrief?.()}>
            {props.generateLabel ?? "Generate"}
          </button>
        ) : null}
      </div>
    );
  },
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: (props: Record<string, unknown>) => {
    proposalDisplaySpy(props);
    return <div data-testid="proposal-display">Mock proposal display</div>;
  },
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge workbench layout", () => {
  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    proposalInputFormSpy.mockClear();
    proposalComposeToolbarSpy.mockClear();
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue(null);
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
      writable: true,
    });
    window.dispatchEvent(new Event("resize"));
  });

  it("anchors the live proposal workspace preview to the top of the document stage", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const lastCall =
      proposalDisplaySpy.mock.calls[proposalDisplaySpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({
      previewAnchor: "top",
      documentHeaderMode: "hidden",
    });
  });

  it("routes the live workbench toolbar through the compose form's external CV and tone controls", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("proposal-compose-toolbar")).toBeInTheDocument();

    let lastInputCall =
      proposalInputFormSpy.mock.calls[proposalInputFormSpy.mock.calls.length - 1]?.[0];
    expect(lastInputCall).toMatchObject({
      suppressToneControls: true,
      suppressCvPicker: true,
      cvPickerOpen: false,
      externalVoicePreset: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Set toolbar tone" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle toolbar CV picker" }),
    );

    lastInputCall =
      proposalInputFormSpy.mock.calls[proposalInputFormSpy.mock.calls.length - 1]?.[0];
    expect(lastInputCall).toMatchObject({
      cvPickerOpen: true,
      externalVoicePreset: "expert",
    });
    const toolbarSlot = container.querySelector(
      '[data-testid="proposal-workbench-toolbar-slot"]',
    ) as HTMLElement | null;
    expect(toolbarSlot).toBeTruthy();
    expect(
      toolbarSlot?.closest(".dasti-proposal-compose-column"),
    ).toBeNull();
    expect(toolbarSlot?.closest(".dasti-flow")).toBeNull();
    const pageShell = container.querySelector(".dasti-page-shell") as
      | HTMLElement
      | null;
    const toolbarRow = container.querySelector(
      ".dasti-workbench-top-left-slot--proposal",
    ) as HTMLElement | null;
    const workbenchFrame = container.querySelector(".dasti-flow") as
      | HTMLElement
      | null;
    const gridSplit = container.querySelector(".dasti-grid-split") as
      | HTMLElement
      | null;
    const outputShell = container.querySelector(".dasti-proposal-output-shell") as
      | HTMLElement
      | null;
    expect(
      pageShell?.style.getPropertyValue("--page-shell-gap"),
    ).toBe("var(--space-2)");
    expect(workbenchFrame?.style.maxWidth).toBe(
      "calc(var(--proposal-workspace-output-shell-inline-size) + var(--proposal-workspace-output-shell-inline-size) + var(--layout-card-grid))",
    );
    expect(
      workbenchFrame?.style.getPropertyValue(
        "--proposal-workspace-output-shell-inline-size",
      ),
    ).toBe("calc(var(--document-sheet-inline-size) - (var(--s4) * 2))");
    expect(
      gridSplit?.style.getPropertyValue("--grid-columns"),
    ).toBe(
      "var(--proposal-workspace-output-shell-inline-size) minmax(0, var(--proposal-workspace-output-shell-inline-size))",
    );
    expect(toolbarRow?.style.maxWidth).toBe(
      "calc(var(--proposal-workspace-output-shell-inline-size) + var(--proposal-workspace-output-shell-inline-size) + var(--layout-card-grid))",
    );
    expect(toolbarRow?.style.marginInline).toBe("0");
    expect(
      toolbarRow?.style.getPropertyValue(
        "--proposal-workspace-output-shell-inline-size",
      ),
    ).toBe("calc(var(--document-sheet-inline-size) - (var(--s4) * 2))");
    expect(outputShell?.style.width).toBe("100%");
    expect(
      outputShell?.style.getPropertyValue("--document-viewer-shell-inline-size"),
    ).toBe("var(--proposal-workspace-output-shell-inline-size)");
    expect(screen.queryByRole("button", { name: /pick cv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Balanced" })).not.toBeInTheDocument();
  });

  it("stacks the live workbench before the expanded sidebar forces the compose shell to shrink", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1366,
      writable: true,
    });
    window.dispatchEvent(new Event("resize"));

    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const workbenchFrame = container.querySelector(".dasti-flow") as
      | HTMLElement
      | null;
    const toolbarRow = container.querySelector(
      ".dasti-workbench-top-left-slot--proposal",
    ) as HTMLElement | null;
    const gridSplit = container.querySelector(".dasti-grid-split") as
      | HTMLElement
      | null;

    expect(workbenchFrame?.style.maxWidth).toBe("560px");
    expect(workbenchFrame?.style.marginInline).toBe("0");
    expect(toolbarRow?.style.marginInline).toBe("0");
    expect(
      gridSplit?.style.getPropertyValue("--grid-columns"),
    ).toBe("minmax(0, 1fr)");
  });

  it("keeps the compose shell width contract stable when the workbench drops from desktop to compact", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const composeColumn = container.querySelector(
      ".dasti-proposal-compose-column--workspace",
    ) as HTMLElement | null;

    expect(
      composeColumn?.style.getPropertyValue("--document-viewer-shell-inline-size"),
    ).toBe("var(--proposal-workspace-output-shell-inline-size)");

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1000,
        writable: true,
      });
      window.dispatchEvent(new Event("resize"));
    });

    const workbenchFrame = container.querySelector(".dasti-flow") as
      | HTMLElement
      | null;
    const gridSplit = container.querySelector(".dasti-grid-split") as
      | HTMLElement
      | null;

    expect(
      composeColumn?.style.getPropertyValue("--document-viewer-shell-inline-size"),
    ).toBe("var(--proposal-workspace-output-shell-inline-size)");
    expect(workbenchFrame?.style.maxWidth).toBe("560px");
    expect(
      gridSplit?.style.getPropertyValue("--grid-columns"),
    ).toBe("minmax(0, 1fr)");
  });

  it("normalizes unsupported saved toolbar tones back to auto", () => {
    useQueryMock.mockImplementation((query: string) => {
      if (query === "proposalSettings.getCurrent") {
        return {
          savedVoicePreset: "direct",
          templateId: null,
        };
      }
      return null;
    });

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const lastInputCall =
      proposalInputFormSpy.mock.calls[proposalInputFormSpy.mock.calls.length - 1]?.[0];
    expect(lastInputCall).toMatchObject({
      externalVoicePreset: null,
    });
  });

  it("restores the donor desktop collapse and restore controls for the compose column", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const composeShell = screen.getByTestId("proposal-input-form");
    expect(composeShell.parentElement).not.toHaveStyle({ display: "none" });

    let lastToolbarCall =
      proposalComposeToolbarSpy.mock.calls[
        proposalComposeToolbarSpy.mock.calls.length - 1
      ]?.[0];
    expect(lastToolbarCall.onCollapseCompose).toEqual(expect.any(Function));
    expect(lastToolbarCall.collapsed).not.toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Collapse compose" }));

    lastToolbarCall =
      proposalComposeToolbarSpy.mock.calls[
        proposalComposeToolbarSpy.mock.calls.length - 1
      ]?.[0];
    expect(lastToolbarCall).toMatchObject({ collapsed: true });
    expect(screen.getByTestId("proposal-compose-toolbar")).toHaveAttribute(
      "data-transition-state",
      "entering",
    );
    expect(lastToolbarCall.onRestoreCompose).toEqual(expect.any(Function));
    expect(lastToolbarCall.onGenerateFromBrief).toEqual(expect.any(Function));
    expect(composeShell.parentElement).toHaveStyle({ display: "none" });
    const gridSplitAfterCollapse = container.querySelector(
      ".dasti-grid-split",
    ) as HTMLElement | null;
    const workbenchFrameAfterCollapse = container.querySelector(
      ".dasti-flow",
    ) as HTMLElement | null;
    expect(
      gridSplitAfterCollapse?.style.getPropertyValue("--grid-justify"),
    ).toBe("center");
    expect(workbenchFrameAfterCollapse?.style.maxWidth).toBe("860px");
    const toolbarRowAfterCollapse = container.querySelector(
      ".dasti-workbench-top-left-slot--proposal",
    ) as HTMLElement | null;
    expect(toolbarRowAfterCollapse?.style.maxWidth).toBe(
      "calc(var(--proposal-workspace-output-shell-inline-size) + var(--proposal-workspace-output-shell-inline-size) + var(--layout-card-grid))",
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore compose" }));

    lastToolbarCall =
      proposalComposeToolbarSpy.mock.calls[
        proposalComposeToolbarSpy.mock.calls.length - 1
      ]?.[0];
    expect(lastToolbarCall.collapsed).not.toBe(true);
    expect(screen.getByTestId("proposal-compose-toolbar")).toHaveAttribute(
      "data-transition-state",
      "entering",
    );
    expect(lastToolbarCall.onCollapseCompose).toEqual(expect.any(Function));
    expect(composeShell.parentElement).not.toHaveStyle({ display: "none" });
    expect(
      container.querySelector(".dasti-cv-workbench-bar--proposal-workspace"),
    ).toBeTruthy();
  });

  it("replaces the desktop floating brief card with a compact capsule under the detached toolbar", () => {
    vi.useFakeTimers();
    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate sample proposal" }));

    const briefCapsule = container.querySelector(
      ".dasti-brief-card--compact",
    ) as HTMLElement | null;
    const toolbarSlot = container.querySelector(
      '[data-testid="proposal-workbench-toolbar-slot"]',
    ) as HTMLElement | null;
    const leftColumn = container.querySelector(".dasti-forge-left-col") as
      | HTMLElement
      | null;
    expect(briefCapsule).toBeTruthy();
    expect(
      briefCapsule?.closest(".dasti-proposal-compose-column"),
    ).toBeTruthy();
    expect(
      briefCapsule?.closest(".dasti-workbench-top-left-slot--proposal"),
    ).toBeNull();
    expect(toolbarSlot).toBeTruthy();
    expect(
      toolbarSlot?.closest(".dasti-workbench-top-left-slot--proposal"),
    ).toBeTruthy();
    expect(
      toolbarSlot?.closest(".dasti-proposal-compose-column"),
    ).toBeNull();
    expect(toolbarSlot?.contains(briefCapsule ?? null)).toBe(false);
    expect(
      container.querySelector(".dasti-proposal-workbench-left-stack"),
    ).toBeTruthy();
    const workbenchFrame = container.querySelector(".dasti-flow") as
      | HTMLElement
      | null;
    const gridSplit = container.querySelector(".dasti-grid-split") as
      | HTMLElement
      | null;
    const outputShell = container.querySelector(
      ".dasti-proposal-output-shell",
    ) as HTMLElement | null;
    expect(leftColumn?.classList.contains("dasti-forge-left-col--hidden")).toBe(false);
    expect(workbenchFrame?.style.marginInline).toBe("0");
    expect(
      gridSplit?.style.getPropertyValue("--grid-columns"),
    ).toBe(
      "var(--proposal-workspace-output-shell-inline-size) minmax(0, var(--proposal-workspace-output-shell-inline-size))",
    );
    expect(gridSplit?.style.getPropertyValue("--grid-justify")).toBe("start");
    expect(outputShell?.style.width).toBe("100%");
    expect(
      outputShell?.closest(".dasti-workbench-top-left-slot--proposal"),
    ).toBeNull();
    expect(
      outputShell?.closest(".dasti-grid-split"),
    ).toBe(gridSplit);
    const expandButton = screen.getByRole("button", { name: "Expand" });
    expect(expandButton).not.toHaveAttribute("data-toolbar-tooltip");

    fireEvent.click(expandButton);
    const composeStage = container.querySelector(
      ".dasti-proposal-compose-panel-stage",
    ) as HTMLElement | null;
    expect(composeStage?.style.display).toBe("none");
    expect(container.querySelector(".dasti-brief-card--compact")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(
      container.querySelector(".dasti-brief-card--compact"),
    ).toBeNull();
    expect(screen.getByTestId("proposal-input-form")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("keeps the compact brief card inside the compose column on compact widths", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
      writable: true,
    });
    window.dispatchEvent(new Event("resize"));

    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate sample proposal" }));

    expect(container.querySelector(".dasti-brief-card--compact")).toBeNull();
    expect(
      container.querySelector(".dasti-proposal-compose-column .dasti-brief-card"),
    ).toBeTruthy();
  });

  it("keeps the compact compose and output cards constrained inside the active page shell", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 700,
      writable: true,
    });
    window.dispatchEvent(new Event("resize"));

    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const pageShell = container.querySelector(".dasti-page-shell") as
      | HTMLElement
      | null;
    const workbenchFrame = container.querySelector(".dasti-flow") as
      | HTMLElement
      | null;
    const gridSplit = container.querySelector(".dasti-grid-split") as
      | HTMLElement
      | null;
    const composeShell = screen.getByTestId("proposal-input-form").parentElement
      ?.parentElement as HTMLElement | null;
    const outputShell = container.querySelector(
      ".dasti-proposal-output-shell",
    ) as HTMLElement | null;

    expect(pageShell).toBeTruthy();
    expect(
      pageShell?.style.getPropertyValue("--page-shell-max-width"),
    ).toBe("100%");
    expect(workbenchFrame?.style.maxWidth).toBe("560px");
    expect(gridSplit).toBeTruthy();
    expect(
      gridSplit?.style.getPropertyValue("--grid-columns"),
    ).toBe("minmax(0, 1fr)");
    expect(composeShell?.style.width).toBe(
      "min(100%, var(--proposal-workspace-output-shell-inline-size))",
    );
    expect(outputShell?.style.width).toBe(
      "min(100%, var(--proposal-workspace-output-shell-inline-size))",
    );
  });

  it("orders compose output actions as save, delete, then copy", () => {
    window.localStorage.setItem(
      "dasti:proposal-output-draft:v1",
      JSON.stringify({
        proposalContent: "Generated proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "inherit_cv",
        proposalStyleChoice: "auto",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Generated proposal",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_live",
        proposalOutputMode: "preview",
        paletteOverride: null,
        customAccentHex: null,
        templateBundleId: null,
        typographyOverride: null,
        layoutOverride: null,
        proposalDocumentTitleManual: false,
        characterLimitMode: null,
        characterLimitValue: null,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const lastCall =
      proposalDisplaySpy.mock.calls[proposalDisplaySpy.mock.calls.length - 1]?.[0];
    const { container } = render(
      <div>
        {lastCall.actions as React.ReactNode}
        <button type="button" aria-label="Copy">
          Copy
        </button>
      </div>,
    );

    const buttonLabels = within(container).getAllByRole("button").map(
      (button) =>
        button.getAttribute("aria-label") ??
        button.getAttribute("data-toolbar-tooltip"),
    );
    expect(buttonLabels).toEqual([
      "Export proposal as PDF",
      "Save proposal to library",
      "Delete",
      "Copy",
    ]);
  });

  it("restores the expanded compose bar once the layout leaves true desktop two-pane mode", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    let lastToolbarCall =
      proposalComposeToolbarSpy.mock.calls[
        proposalComposeToolbarSpy.mock.calls.length - 1
      ]?.[0];
    expect(lastToolbarCall.onCollapseCompose).toEqual(expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "Collapse compose" }));

    lastToolbarCall =
      proposalComposeToolbarSpy.mock.calls[
      proposalComposeToolbarSpy.mock.calls.length - 1
      ]?.[0];
    expect(lastToolbarCall).toMatchObject({ collapsed: true });
    expect(lastToolbarCall.onRestoreCompose).toEqual(expect.any(Function));

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1000,
        writable: true,
      });
      window.dispatchEvent(new Event("resize"));
    });

    lastToolbarCall =
      proposalComposeToolbarSpy.mock.calls[
        proposalComposeToolbarSpy.mock.calls.length - 1
      ]?.[0];
    expect(lastToolbarCall.collapsed).not.toBe(true);
    expect(lastToolbarCall.onCollapseCompose).toBeUndefined();
    expect(lastToolbarCall.onRestoreCompose).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Restore compose" })).toBeNull();
    expect(screen.getByTestId("proposal-input-form")).toBeInTheDocument();
  });
});
