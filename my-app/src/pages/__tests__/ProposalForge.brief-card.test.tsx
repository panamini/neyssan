import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";

let mockHandoffRecord: {
  handoffId: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl?: string;
  platform?: string;
} | null = null;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (query: string, args: unknown) => {
    if (query === "proposalHandoffs.get" && args !== "skip") {
      return mockHandoffRecord;
    }
    return null;
  },
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
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes and coordinate communication.",
      proposalType: "cover_letter",
      voicePreset: "signature",
      toneTuning: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    };

    return (
      <div>
        <input id="jobTitle" defaultValue={values.jobTitle} />
        <textarea id="jobDescription" defaultValue={values.jobDescription} />
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
      </div>
    );
  },
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: () => <div>Proposal output</div>,
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge brief card", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockHandoffRecord = null;
  });

  it("shows the brief summary above compose and routes the edit action back to the compose brief fields", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    expect(
      screen.getByRole("heading", {
        name: "Application for the Operations Associate role",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Support recurring processes and coordinate communication.",
      ).length,
    ).toBeGreaterThan(0);

    const expandButton = screen.getByRole("button", { name: "Expand" });
    expect(expandButton).not.toHaveAttribute("data-toolbar-tooltip");

    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(document.getElementById("jobDescription")).toHaveFocus();
    });
  });

  it("keeps the brief source link visible from live state even if storage is cleared after generation", async () => {
    mockHandoffRecord = {
      handoffId: "handoff_source",
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes and coordinate communication.",
      sourceUrl: "https://www.linkedin.com/jobs/view/123456",
      platform: "linkedin",
    };

    render(
      <MemoryRouter initialEntries={["/proposal?handoffId=handoff_source"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    window.localStorage.clear();

    expect(
      await screen.findByRole("link", {
        name: "Open original job offer on LinkedIn",
      }),
    ).toHaveAttribute("href", "https://www.linkedin.com/jobs/view/123456");
  });

  it("keeps the brief source link visible after live handoff data disappears during the same session", async () => {
    mockHandoffRecord = {
      handoffId: "handoff_source_session",
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes and coordinate communication.",
      sourceUrl: "https://www.linkedin.com/jobs/view/123456",
      platform: "linkedin",
    };

    const { rerender } = render(
      <MemoryRouter initialEntries={["/proposal?handoffId=handoff_source_session"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    expect(
      await screen.findByRole("link", {
        name: "Open original job offer on LinkedIn",
      }),
    ).toHaveAttribute("href", "https://www.linkedin.com/jobs/view/123456");

    mockHandoffRecord = null;
    window.localStorage.clear();

    rerender(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("link", {
        name: "Open original job offer on LinkedIn",
      }),
    ).toHaveAttribute("href", "https://www.linkedin.com/jobs/view/123456");
  });
});
