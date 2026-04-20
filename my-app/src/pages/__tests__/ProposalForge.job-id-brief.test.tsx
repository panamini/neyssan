import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    jobsPublic: { getById: "jobsPublic.getById" },
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
  default: () => <div>Proposal output</div>,
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge canonical job brief", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseQuery.mockReset();
    mockUseQuery.mockImplementation((query: string) => {
      if (query === "jobsPublic.getById") {
        return {
          id: "job_123",
          title: "Operations Associate",
          company: "Studio North",
          sourceUrl: "https://example.com/jobs/123",
          sourceDomain: "example.com",
          sourceType: "extension",
          parseStatus: "parsed",
          reviewState: "needs_review",
          rawDescription:
            "Coordinate recurring launches, keep handoffs clear, and maintain documentation.",
          summary:
            "Operations Associate role focused on recurring launches and structured handoffs.",
          responsibilities: [
            "Coordinate recurring launches",
            "Maintain documentation",
          ],
          keywords: ["operations", "handoffs"],
          mustHaves: ["documentation"],
          toneCues: ["structured"],
          linkedProposalCount: 2,
          linkedProposals: [
            {
              id: "proposal_alpha",
              title: "Operations Associate cover letter",
              status: "saved",
              updatedAt: 1710000000000,
            },
            {
              id: "proposal_beta",
              title: "Operations Associate follow-up note",
              status: "draft",
              updatedAt: 1700000000000,
            },
          ],
          reviewItems: [
            {
              id: "review_1",
              fieldKey: "responsibilities",
              label: "Responsibilities",
              reviewStatus: "pending",
              suggestedValue: ["Coordinate recurring launches"],
              sourceText:
                "Coordinate recurring launches, keep handoffs clear, and maintain documentation.",
            },
          ],
        };
      }

      return null;
    });
  });

  it("loads the canonical job from jobId routes and surfaces reviewable source context", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal?jobId=job_123"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    expect(
      await screen.findByRole("link", {
        name: /Open original job offer on Example\.com/i,
      }),
    ).toHaveAttribute("href", "https://example.com/jobs/123");
    expect(screen.getByText("Responsibilities")).toBeInTheDocument();
    expect(screen.getByText("Linked documents")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Open linked proposal Operations Associate cover letter",
      }),
    ).toHaveAttribute("href", "/proposal?view=saved&id=proposal_alpha");
    expect(
      screen.getAllByText(
        "Coordinate recurring launches, keep handoffs clear, and maintain documentation.",
      ).length,
    ).toBeGreaterThan(0);
  });
});
