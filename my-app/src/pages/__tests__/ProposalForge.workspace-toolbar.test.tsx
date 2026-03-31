import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";

const proposalDisplaySpy = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
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
  default: () => <div>Mock compose shell</div>,
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
    window.localStorage.clear();
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
    const gridSplit = container.querySelector(".dasti-grid-split") as
      | HTMLElement
      | null;
    const composeShell = container.querySelector(
      ".dasti-proposal-style-source-bar",
    )?.parentElement as HTMLElement | null;
    const outputShell = container.querySelector(
      ".dasti-proposal-output-shell",
    ) as HTMLElement | null;

    expect(pageShell).toBeTruthy();
    expect(
      pageShell?.style.getPropertyValue("--page-shell-max-width"),
    ).toBe("720px");
    expect(gridSplit).toBeTruthy();
    expect(
      gridSplit?.style.getPropertyValue("--grid-columns"),
    ).toBe("minmax(0, 1fr)");
    expect(composeShell?.style.width).toBe("min(100%, 560px)");
    expect(outputShell?.style.width).toBe("min(100%, 560px)");
  });
});
