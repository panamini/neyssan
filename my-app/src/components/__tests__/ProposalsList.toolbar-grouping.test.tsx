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
  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    generateProposalActionMock.mockClear();
    window.localStorage.clear();
  });

  it("keeps the saved-proposal chrome detached above the shell with a separate tone drawer and refine action", async () => {
    const { container } = render(
      <ProposalsList
        savedViewActions={<div data-testid="saved-view-actions">Saved actions</div>}
      />,
    );

    await waitFor(() => {
      const mainCall = proposalDisplaySpy.mock.calls.find(
        ([props]) => props.documentHeaderMode === "actions-only",
      )?.[0] as Record<string, unknown> | undefined;

      expect(mainCall).toBeTruthy();
      expect(mainCall?.documentHeaderMode).toBe("actions-only");
      expect(mainCall?.detachedActionHeader).toBe(true);
      expect(mainCall?.showDocumentCaption).toBe(false);
      expect(mainCall?.railStartAddon).toBeUndefined();
      expect(mainCall?.actions).toBeUndefined();
      expect(mainCall?.detachedActionHeaderSupplement).toBeTruthy();
    });

    expect(screen.getByTestId("saved-view-actions")).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-proposal-library-selected-sidebar"),
    ).toBeTruthy();
    expect(container.querySelector(".dasti-proposal-library-card")).toBeTruthy();

    expect(screen.getByRole("button", { name: /tone of voice/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refine saved proposal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refine saved proposal" }),
    ).not.toHaveClass("dasti-toolbar-tooltip-trigger--above");

    fireEvent.click(screen.getByRole("button", { name: /tone of voice/i }));

    expect(screen.getByRole("dialog", { name: "Tone of voice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Formal" })).toHaveAttribute(
      "data-toolbar-tooltip-placement",
      "inline-end",
    );
    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    expect(
      screen.getByRole("button", { name: "Apply tone change" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply tone change" }));

    await waitFor(() => {
      expect(generateProposalActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          voicePreset: null,
        }),
      );
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
