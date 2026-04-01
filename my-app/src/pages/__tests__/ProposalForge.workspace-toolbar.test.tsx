import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
    return <div data-testid="proposal-input-form">Mock compose shell</div>;
  },
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: (props: Record<string, any>) => {
    proposalComposeToolbarSpy(props);
    return (
      <div
        data-testid="proposal-compose-toolbar"
        data-collapsed={props.collapsed ? "true" : "false"}
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
    expect(lastCall).toMatchObject({ previewAnchor: "top" });
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
    expect(screen.queryByRole("button", { name: /pick cv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Balanced" })).not.toBeInTheDocument();
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
    expect(lastToolbarCall.onRestoreCompose).toEqual(expect.any(Function));
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

    fireEvent.click(screen.getByRole("button", { name: "Restore compose" }));

    lastToolbarCall =
      proposalComposeToolbarSpy.mock.calls[
        proposalComposeToolbarSpy.mock.calls.length - 1
      ]?.[0];
    expect(lastToolbarCall.collapsed).not.toBe(true);
    expect(lastToolbarCall.onCollapseCompose).toEqual(expect.any(Function));
    expect(composeShell.parentElement).not.toHaveStyle({ display: "none" });
    expect(
      container.querySelector(".dasti-cv-workbench-bar--proposal-workspace"),
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
    expect(composeShell?.style.width).toBe("min(100%, 560px)");
    expect(outputShell?.style.width).toBe("min(100%, 560px)");
  });

  it("orders compose output actions as regenerate, save, delete, then copy", () => {
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
      "Regenerate proposal",
      "Save proposal to library",
      "Delete",
      "Copy",
    ]);
  });

  it("keeps collapse and restore controls available across the compact breakpoint", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
      writable: true,
    });
    window.dispatchEvent(new Event("resize"));

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
    expect(screen.getByRole("button", { name: "Restore compose" })).toBeInTheDocument();
  });
});
