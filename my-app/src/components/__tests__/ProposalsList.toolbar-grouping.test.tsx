import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProposalsList from "../ProposalsList";

const proposalDisplaySpy = vi.fn();
const generateProposalActionMock = vi.fn().mockResolvedValue(null);
const linkedJobQueryState = vi.hoisted(() => ({
  value: { id: "job_alpha", company: "Acme Corp." } as
    | { id: string; company: string | null }
    | null
    | undefined,
}));

const SAVED_PROPOSALS = [
  {
    _id: "proposal_alpha",
    _creationTime: 1710000000000,
    title: "Saved proposal alpha",
    content: "Dear team,\n\nSaved proposal alpha.\n\nBest,",
    status: "saved",
    metadata: {
      jobId: "job_alpha",
      proposalType: "cover_letter",
      voicePreset: "signature",
      sourceJobDescription: "Lead operations and coordinate delivery.",
    },
    sections: [{ type: "text", content: "Saved proposal alpha." }],
  },
  {
    _id: "proposal_beta",
    _creationTime: 1710000001000,
    title: "Saved proposal beta",
    content: "Dear team,\n\nSaved proposal beta.\n\nBest,",
    status: "saved",
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      targetEmployerName: "Northwind Inc.",
      sourceJobDescription: "Support operations and scheduling.",
    },
    sections: [{ type: "text", content: "Saved proposal beta." }],
  },
] as const;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (query: string) =>
    query === "proposalsPublic.default"
      ? SAVED_PROPOSALS
      : query === "jobsPublic.getById"
        ? linkedJobQueryState.value
        : null,
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => generateProposalActionMock,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalsPublic: { default: "proposalsPublic.default" },
    jobsPublic: { getById: "jobsPublic.getById" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
    functions: {
      generateProposal: "functions.generateProposal",
    },
  },
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
  }),
}));

vi.mock("../ProposalDisplay", () => ({
  default: (props: Record<string, unknown>) => {
    proposalDisplaySpy(props);
    return (
      <div data-testid="proposal-display">
        {props.detachedActionHeaderSupplement as React.ReactNode}
      </div>
    );
  },
}));

describe("ProposalsList toolbar grouping", () => {
  function getMainProposalDisplayCall() {
    return [...proposalDisplaySpy.mock.calls]
      .reverse()
      .find(
        ([props]) =>
          (props as Record<string, unknown> | undefined)?.documentHeaderMode ===
          "actions-only",
      )?.[0] as
      | Record<string, unknown>
      | undefined;
  }

  function getSecondaryProposalDisplayCall() {
    return [...proposalDisplaySpy.mock.calls]
      .reverse()
      .find(
        ([props]) =>
          (props as Record<string, unknown> | undefined)?.hideDocumentHeader ===
          true,
      )?.[0] as
      | Record<string, unknown>
      | undefined;
  }

  beforeEach(() => {
    linkedJobQueryState.value = { id: "job_alpha", company: "Acme Corp." };
  });

  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    generateProposalActionMock.mockClear();
    window.localStorage.clear();
  });

  it("keeps the saved-proposal chrome detached above the shell with preview-only read controls", async () => {
    const { container } = render(
      <ProposalsList
        savedViewActions={
          <div data-testid="saved-view-actions">Saved actions</div>
        }
      />,
    );

    await waitFor(() => {
      const mainCall = getMainProposalDisplayCall();

      expect(mainCall).toBeTruthy();
      expect(mainCall?.documentHeaderMode).toBe("actions-only");
      expect(mainCall?.detachedActionHeader).toBe(true);
      expect(mainCall?.showDocumentCaption).toBe(false);
      expect(mainCall?.previewAnchor).toBe("body");
      expect(mainCall?.previewScaleMultiplier).toBeUndefined();
      expect(mainCall?.previewFitMode).toBeUndefined();
      expect(mainCall?.showPreviewParagraphActions).toBe(false);
      expect(mainCall?.showPageCountBadge).not.toBe(false);
      expect(mainCall?.showModeToggle).toBeFalsy();
      expect(mainCall?.onCopy).toBeUndefined();
      expect(mainCall?.railStartAddon).toBeUndefined();
      expect(mainCall?.actions).toBeUndefined();
      expect(mainCall?.detachedActionHeaderSupplement).toBeTruthy();

      const secondaryCall = getSecondaryProposalDisplayCall();
      expect(secondaryCall).toBeTruthy();
      expect(secondaryCall?.showPreviewParagraphActions).toBe(false);
      expect(secondaryCall?.showPageCountBadge).toBe(false);
    });

    expect(screen.getByTestId("saved-view-actions")).toBeInTheDocument();
    const selectedSidebar = container.querySelector(
      ".dasti-proposal-library-selected-sidebar",
    );
    expect(selectedSidebar).toBeTruthy();
    expect(selectedSidebar?.firstElementChild).toHaveClass(
      "dasti-proposal-library-sidebar__actions",
    );
    const selectedCard = container.querySelector(
      ".dasti-proposal-library-card",
    );
    expect(selectedCard).toBeTruthy();
    expect(selectedCard).toHaveClass("dasti-proposal-library-card--selected");
    expect(selectedCard).not.toHaveClass("dasti-proposal-output-shell");
    expect(selectedCard).not.toHaveClass("dasti-proposal-output-shell--saved");
    expect(
      container.querySelector(
        ".dasti-proposal-library-card > .dasti-proposal-library-info-card",
      ),
    ).toBeNull();
    expect(
      container.querySelector(
        ".dasti-proposal-library-selected-sidebar .dasti-proposal-library-info-card",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Proposal Library")).toBeInTheDocument();
    expect(
      screen.getByLabelText("0 draft proposals and 2 saved proposals"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-proposal-library-info-card"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rename saved proposal" }));
    const titleInput = screen.getByRole("textbox", {
      name: "Proposal title",
    }) as HTMLInputElement;
    expect(titleInput).toHaveValue("Saved proposal beta");
    fireEvent.change(titleInput, {
      target: { value: "Renamed proposal beta" },
    });
    fireEvent.blur(titleInput);
    await waitFor(() => {
      expect(screen.getByText("Renamed proposal beta")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("searchbox", { name: "Search saved proposals" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", {
        name: "Filter saved proposals by tone",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Sort saved proposals" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Natural").length).toBeGreaterThan(0);

    expect(
      screen.queryByRole("button", { name: /tone of voice/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refine saved proposal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open text styles" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Tone of voice" }),
    ).not.toBeInTheDocument();
    expect(generateProposalActionMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open text styles" }));
    expect(
      screen.getByRole("menu", { name: "Text styles" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Soft Serif" }));

    await waitFor(() => {
      expect(getMainProposalDisplayCall()?.stylePreset).toEqual(
        expect.objectContaining({
          typography: "soft-serif",
        }),
      );
    });

    const layoutButton = screen.getByRole("button", { name: /Layout/i });
    expect(layoutButton).toBeInTheDocument();
    fireEvent.click(layoutButton);
    expect(
      screen.getByRole("menu", { name: "Layout options" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", {
        name: "Workshop two-column",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("menuitemradio", {
        name: "Workshop two-column",
      }),
    );

    await waitFor(() => {
      expect(getMainProposalDisplayCall()?.stylePreset).toEqual(
        expect.objectContaining({
          layout: "workshop",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Open zoom controls" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    await waitFor(() => {
      expect(getMainProposalDisplayCall()?.zoomIndex).toBe(2);
    });
  });

  it("does not render the removed mobile focus and library buttons", () => {
    render(<ProposalsList />);

    expect(
      screen.queryByRole("button", { name: /focus selected proposal/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /open proposal library overview/i }),
    ).not.toBeInTheDocument();
  });

  it("preserves the structured employer when refining a saved proposal", async () => {
    render(<ProposalsList />);

    let refine: (() => void) | undefined;
    await waitFor(() => {
      const toolbar = getMainProposalDisplayCall()
        ?.detachedActionHeaderSupplement;
      expect(React.isValidElement(toolbar)).toBe(true);
      refine = (
        toolbar as React.ReactElement<{ onRefine?: () => void }>
      ).props.onRefine;
      expect(refine).toBeTypeOf("function");
    });
    await act(async () => {
      refine?.();
    });

    await waitFor(() => {
      expect(generateProposalActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          targetEmployerName: "Northwind Inc.",
        }),
      );
    });
  });

  it("backfills the employer from a linked job when historical metadata predates the field", async () => {
    render(<ProposalsList selectedProposalId="proposal_alpha" />);

    let refine: (() => void) | undefined;
    await waitFor(() => {
      const toolbar = getMainProposalDisplayCall()
        ?.detachedActionHeaderSupplement;
      expect(React.isValidElement(toolbar)).toBe(true);
      refine = (
        toolbar as React.ReactElement<{ onRefine?: () => void }>
      ).props.onRefine;
      expect(refine).toBeTypeOf("function");
    });
    await act(async () => {
      refine?.();
    });

    await waitFor(() => {
      expect(generateProposalActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          targetEmployerName: "Acme Corp.",
        }),
      );
    });
  });

  it("guards Refine until the linked employer backfill resolves", async () => {
    linkedJobQueryState.value = undefined;
    render(<ProposalsList selectedProposalId="proposal_alpha" />);

    let toolbar: React.ReactElement<{
      onRefine?: () => void;
      isRegenerating?: boolean;
    }> | null = null;
    await waitFor(() => {
      const candidate = getMainProposalDisplayCall()
        ?.detachedActionHeaderSupplement;
      expect(React.isValidElement(candidate)).toBe(true);
      toolbar = candidate as React.ReactElement<{
        onRefine?: () => void;
        isRegenerating?: boolean;
      }>;
      expect(toolbar.props.isRegenerating).toBe(true);
    });

    await act(async () => {
      toolbar?.props.onRefine?.();
    });
    expect(generateProposalActionMock).not.toHaveBeenCalled();
  });

  it("treats a resolved linked job without company as MISSING", async () => {
    linkedJobQueryState.value = { id: "job_alpha", company: null };
    render(<ProposalsList selectedProposalId="proposal_alpha" />);

    let refine: (() => void) | undefined;
    await waitFor(() => {
      const toolbar = getMainProposalDisplayCall()
        ?.detachedActionHeaderSupplement;
      expect(React.isValidElement(toolbar)).toBe(true);
      refine = (toolbar as React.ReactElement<{ onRefine?: () => void }>).props
        .onRefine;
    });
    await act(async () => {
      refine?.();
    });

    await waitFor(() => {
      expect(generateProposalActionMock).toHaveBeenCalledWith(
        expect.objectContaining({ targetEmployerName: null }),
      );
    });
  });
});
