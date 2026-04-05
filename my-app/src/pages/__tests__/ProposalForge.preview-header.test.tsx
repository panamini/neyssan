import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";

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
  default: ({ onSubmit, onValuesChange }: any) => {
    const values = {
      jobTitle: "Human Resources Administrator",
      jobDescription:
        "Support day-to-day HR operations and keep internal communication precise.",
      proposalType: "cover_letter",
      voicePreset: "signature",
      toneTuning: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    };

    return (
      <button
        type="button"
        onClick={() => {
          onValuesChange?.(values);
          onSubmit?.(
            values,
            "Generated proposal body.",
            undefined,
            "proposal_generated",
          );
        }}
      >
        Generate proposal
      </button>
    );
  },
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    railTitle,
    railMeta,
    contactLine,
  }: {
    railTitle?: string | null;
    railMeta?: string | null;
    contactLine?: string | null;
  }) => (
    <div data-testid="proposal-display-props">
      {railTitle ?? ""} | {railMeta ?? ""} | {contactLine ?? ""}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge preview applicant fallback", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("uses the Elena Marlowe mock header when no CV is attached", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    expect(screen.getByTestId("proposal-display-props")).toHaveTextContent(
      "Elena Marlowe | Senior Product Designer",
    );
    expect(screen.getByTestId("proposal-display-props")).toHaveTextContent(
      "+31 6 5555 2381",
    );
    expect(screen.getByTestId("proposal-display-props")).toHaveTextContent(
      "elena@sample.design",
    );
  });
});
