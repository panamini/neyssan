import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProposalsList from "../ProposalsList";

const proposalDisplaySpy = vi.fn();

const SAVED_PROPOSALS = [
  {
    _id: "proposal_alpha",
    _creationTime: 1710000000000,
    title: "Saved proposal alpha",
    content: "Saved proposal alpha.",
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
    content: "Saved proposal beta.",
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

vi.mock("../ProposalDisplay", () => ({
  default: (props: Record<string, unknown>) => {
    proposalDisplaySpy(props);
    return <div data-testid="proposal-display" />;
  },
}));

describe("ProposalsList route selection", () => {
  function getMainProposalDisplayCall() {
    return [...proposalDisplaySpy.mock.calls]
      .reverse()
      .find(([props]) => props.documentHeaderMode === "actions-only")
      ?.[0] as Record<string, unknown> | undefined;
  }

  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    window.localStorage.clear();
  });

  it("does not enter the loading skeleton when a saved route already specifies the selected proposal", async () => {
    render(
      <ProposalsList
        selectedProposalId="proposal_beta"
        onSelectedProposalIdChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      const mainCall = getMainProposalDisplayCall();

      expect(mainCall).toBeTruthy();
      expect(mainCall?.loading).toBe(false);
      expect(mainCall?.documentTitle).toBe("Saved proposal beta");
    });
  });
});
