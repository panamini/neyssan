import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProposalsList from "../ProposalsList";

const proposalDisplaySpy = vi.fn();

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
  useAction: () => vi.fn().mockResolvedValue(null),
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

vi.mock("../ProposalArtifactInspector", () => ({
  ProposalArtifactInspector: () => <div>Style inspector</div>,
}));

vi.mock("../ProposalDisplay", () => ({
  default: (props: Record<string, unknown>) => {
    proposalDisplaySpy(props);
    return <div data-testid="proposal-display">Mock proposal display</div>;
  },
}));

describe("ProposalsList toolbar grouping", () => {
  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    window.localStorage.clear();
  });

  it("keeps regenerate and delete actions in the right action slot while style controls stay on the left rail", async () => {
    render(<ProposalsList />);

    await waitFor(() => {
      const mainCall = proposalDisplaySpy.mock.calls.find(
        ([props]) => props.documentHeaderMode === "actions-only",
      )?.[0] as Record<string, unknown> | undefined;

      expect(mainCall).toBeTruthy();
      expect(mainCall?.documentHeaderMode).toBe("actions-only");
      expect(mainCall?.railStartAddon).toBeTruthy();
      expect(mainCall?.actions).toBeTruthy();
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
