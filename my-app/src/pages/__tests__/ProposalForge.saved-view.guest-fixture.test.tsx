import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import { LOCAL_SAVED_PROPOSALS_FIXTURE_KEY } from "../../lib/proposal-saved-fixtures";

const GUEST_SAVED_PROPOSALS = [
  {
    _id: "proposal_guest_saved",
    _creationTime: 1710000000000,
    title: "Guest saved proposal",
    content: "Dear team,\n\nGuest saved proposal content.\n\nBest,",
    status: "saved",
    updatedAt: 1710000000000,
    createdAt: 1710000000000,
    sections: [{ type: "text", content: "Guest saved proposal content." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      requestedVoicePreset: "signature",
      sourceJobDescription:
        "Coordinate recurring operations and maintain cross-team communication.",
    },
  },
] as const;

vi.mock("convex/react", () => ({
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: false,
  }),
  useQuery: () => undefined,
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
    cvs: [],
    currentCv: null,
    currentCvId: null,
    loadCv: vi.fn(),
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: () => <div>Compose shell</div>,
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    proposalContent,
    documentTitle,
  }: {
    proposalContent: string | null;
    documentTitle?: string | null;
  }) => (
    <div data-testid="proposal-display-state">
      {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: ({
    selectedProposalId,
    savedViewActions,
  }: {
    selectedProposalId?: string | null;
    savedViewActions?: React.ReactNode;
  }) => (
    <div data-testid="saved-proposals-list">
      {savedViewActions}
      {selectedProposalId}
    </div>
  ),
}));

describe("ProposalForge saved view guest fixture fallback", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      LOCAL_SAVED_PROPOSALS_FIXTURE_KEY,
      JSON.stringify(GUEST_SAVED_PROPOSALS),
    );
  });

  it("opens a saved proposal from the local fixture when Convex saved proposals are unavailable", () => {
    render(
      <MemoryRouter
        initialEntries={["/proposal?view=saved&id=proposal_guest_saved"]}
      >
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Back to draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Duplicate to draft" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("saved-proposals-list")).toHaveTextContent(
      "proposal_guest_saved",
    );
  });
});
