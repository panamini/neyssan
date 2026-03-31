import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForgeNext } from "../ProposalForgeNext";

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
  default: ({
    onStart,
    onStop,
  }: {
    onStart?: (values: any) => void;
    onStop?: () => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onStart?.({
            jobTitle: "Operations Associate",
            jobDescription:
              "Support recurring processes and coordinate communication.",
            proposalType: "cover_letter",
            voicePreset: "signature",
            formalityLevel: undefined,
            creativity: undefined,
            toneTuning: null,
            characterLimitMode: "none",
            characterLimitValue: null,
            modelType: "chatgpt",
          })
        }
      >
        Start mock generation
      </button>
      <button type="button" onClick={() => onStop?.()}>
        Stop mock generation
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    loading,
    statusMessage,
    error,
    proposalContent,
  }: {
    loading: boolean;
    statusMessage?: string | null;
    error: string | null;
    proposalContent: string | null;
  }) => (
    <div data-testid="proposal-display-state">
      {loading
        ? "loading"
        : statusMessage
          ? `status:${statusMessage}`
          : error
            ? `error:${error}`
            : proposalContent
              ? `content:${proposalContent}`
              : "empty"}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

describe("ProposalForgeNext stop state", () => {
  it("clears loading and shows a stopped message when the compose form stops generation", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForgeNext />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "empty",
    );

    fireEvent.click(screen.getByRole("button", { name: "Start mock generation" }));

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "loading",
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop mock generation" }));

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "status:Generation stopped.",
    );
  });
});
