import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProposalsList from "../ProposalsList";

const proposalDisplaySpy = vi.fn();
const generateProposalActionMock = vi.fn().mockResolvedValue(null);

const SAVED_PROPOSALS = [
  {
    _id: "proposal_alpha",
    _creationTime: 1710000000000,
    title: "Saved proposal alpha",
    content: "Dear team,\n\nSaved proposal alpha.\n\nBest,",
    status: "saved",
    metadata: {
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
    query === "proposalsPublic.default" ? SAVED_PROPOSALS : null,
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => generateProposalActionMock,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalsPublic: { default: "proposalsPublic.default" },
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
      .find(([props]) => props.documentHeaderMode === "actions-only")
      ?.[0] as Record<string, unknown> | undefined;
  }

  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    generateProposalActionMock.mockClear();
    window.localStorage.clear();
  });

  it("keeps the saved-proposal chrome detached above the shell with preview-only read controls", async () => {
    const { container } = render(
      <ProposalsList
        savedViewActions={<div data-testid="saved-view-actions">Saved actions</div>}
      />,
    );

    await waitFor(() => {
      const mainCall = getMainProposalDisplayCall();

      expect(mainCall).toBeTruthy();
      expect(mainCall?.documentHeaderMode).toBe("actions-only");
      expect(mainCall?.detachedActionHeader).toBe(true);
      expect(mainCall?.showDocumentCaption).toBe(false);
      expect(mainCall?.showModeToggle).toBeFalsy();
      expect(mainCall?.onCopy).toBeUndefined();
      expect(mainCall?.railStartAddon).toBeUndefined();
      expect(mainCall?.actions).toBeUndefined();
      expect(mainCall?.detachedActionHeaderSupplement).toBeTruthy();
    });

    expect(screen.getByTestId("saved-view-actions")).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-proposal-library-selected-sidebar"),
    ).toBeTruthy();
    expect(container.querySelector(".dasti-proposal-library-card")).toBeTruthy();
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
    expect(screen.getByText("Saved proposals")).toBeInTheDocument();
    expect(
      screen.getByLabelText("2 saved proposals"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-proposal-library-info-card"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("searchbox", { name: "Search saved proposals" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Filter saved proposals by tone" }),
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
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open text styles" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Tone of voice" }),
    ).not.toBeInTheDocument();
    expect(generateProposalActionMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open text styles" }));
    expect(
      screen.getByRole("dialog", { name: "Text styles" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Soft Serif" }));

    await waitFor(() => {
      expect(getMainProposalDisplayCall()?.stylePreset).toEqual(
        expect.objectContaining({
          typography: "soft-serif",
        }),
      );
    });

    expect(screen.getByRole("button", { name: /layout swiss/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /layout swiss/i }));
    expect(
      screen.getByRole("dialog", { name: "Layout options" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Workshop Family identity scaffold for the workshop paired templates\./i,
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /^Editorial Editorial split layout with a broader, calmer rhythm\.$/i,
      }),
    );

    await waitFor(() => {
      expect(getMainProposalDisplayCall()?.stylePreset).toEqual(
        expect.objectContaining({
          layout: "editorial",
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

});
