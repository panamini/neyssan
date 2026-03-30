import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForgeNext } from "../ProposalForgeNext";

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

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    loadCv: vi.fn(),
  }),
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

describe("ProposalForgeNext workbench toolbar placement", () => {
  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    window.localStorage.clear();
  });

  it("anchors the live proposal workspace preview to the top of the document stage", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForgeNext />
      </MemoryRouter>,
    );

    const lastCall =
      proposalDisplaySpy.mock.calls[proposalDisplaySpy.mock.calls.length - 1]?.[0];
    expect(lastCall).toMatchObject({ previewAnchor: "top" });
  });

  it("keeps the expanded and collapsed toolbar states in the same page-shell top-left slot", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1400,
      writable: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForgeNext />
      </MemoryRouter>,
    );

    const outputShell = container.querySelector(
      ".dasti-proposal-output-shell--next",
    );
    expect(outputShell).toBeTruthy();

    const pageShellSlot = container.querySelector(
      ".dasti-page-shell > .dasti-cv-workbench-bar .dasti-forge-compose-toolbar-slot",
    );
    expect(pageShellSlot).toBeTruthy();
    expect(pageShellSlot?.querySelector(".dasti-compose-toolbar")).toBeTruthy();
    expect(
      pageShellSlot?.querySelector(".dasti-compose-toolbar--anchored"),
    ).toBeNull();
    expect(
      container.querySelector(
        ".dasti-forge-left-col .dasti-forge-compose-toolbar-slot",
      ),
    ).toBeNull();
    expect(
      outputShell?.querySelector(
        ".dasti-forge-compose-toolbar-slot",
      ),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Hide compose panel" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Show compose panel" }),
      ).toBeInTheDocument(),
    );

    const collapsedPageShellSlot = container.querySelector(
      ".dasti-page-shell > .dasti-cv-workbench-bar .dasti-forge-compose-toolbar-slot",
    );

    expect(
      collapsedPageShellSlot?.querySelector(".dasti-compose-toolbar--collapsed"),
    ).toBeTruthy();
    expect(
      collapsedPageShellSlot?.querySelector(".dasti-compose-toolbar--anchored"),
    ).toBeNull();
    expect(
      outputShell?.querySelector(
        ".dasti-forge-compose-toolbar-slot",
      ),
    ).toBeNull();
  });

  it("keeps the proposal page-shell anchor width stable on compact layouts", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 700,
      writable: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForgeNext />
      </MemoryRouter>,
    );

    const pageShell = container.querySelector(".dasti-page-shell") as
      | HTMLElement
      | null;
    const pageShellSlot = container.querySelector(
      ".dasti-page-shell > .dasti-cv-workbench-bar .dasti-forge-compose-toolbar-slot",
    );

    expect(pageShell).toBeTruthy();
    expect(
      pageShell?.style.getPropertyValue("--page-shell-max-width"),
    ).toBe("100%");
    expect(pageShellSlot).toBeTruthy();
    expect(
      pageShellSlot?.querySelector(".dasti-compose-toolbar--collapsed"),
    ).toBeNull();
    expect(
      (pageShellSlot as HTMLElement | null)?.style.getPropertyValue(
        "--proposal-compose-toolbar-max-inline-size",
      ),
    ).toBe("560px");
  });
});
