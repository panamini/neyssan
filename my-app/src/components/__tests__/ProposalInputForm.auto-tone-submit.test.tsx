import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProposalInputForm from "../ProposalInputForm";

const {
  mockGenerateProposalAction,
  mockSetCurrentVoicePreset,
  mockUpdateGeneratedProposal,
  mockRequestProposalGenerationCancel,
  mockSetSharedActiveCvSnapshot,
} = vi.hoisted(() => ({
  mockGenerateProposalAction: vi.fn(),
  mockSetCurrentVoicePreset: vi.fn(),
  mockUpdateGeneratedProposal: vi.fn(),
  mockRequestProposalGenerationCancel: vi.fn(),
  mockSetSharedActiveCvSnapshot: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useAction: () => mockGenerateProposalAction,
  useMutation: (reference: string) => {
    if (reference === "proposalSettings.setCurrent") {
      return mockSetCurrentVoicePreset;
    }
    if (reference === "updateProposalPublic.default") {
      return mockUpdateGeneratedProposal;
    }
    if (reference === "jobs.requestProposalGenerationCancel") {
      return mockRequestProposalGenerationCancel;
    }
    if (reference === "activeCvSnapshots.setCurrent") {
      return mockSetSharedActiveCvSnapshot;
    }
    return vi.fn();
  },
  useQuery: () => null,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    jobs: {
      requestProposalGenerationCancel: "jobs.requestProposalGenerationCancel",
    },
    activeCvSnapshots: { setCurrent: "activeCvSnapshots.setCurrent" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    proposalSettings: {
      getCurrent: "proposalSettings.getCurrent",
      setCurrent: "proposalSettings.setCurrent",
    },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    loadCv: vi.fn(),
  }),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  clearActiveLocalCvId: vi.fn(),
  formatCvDisplaySubtitle: () => "",
  getActiveLocalPersonalizationSource: () => ({
    title: null,
    personalizationContext: null,
    richness: "none",
  }),
  getLocalActiveCvSnapshotById: () => null,
  listLocalCvPickerOptions: () => [],
  setActiveLocalCvId: vi.fn(),
}));

describe("ProposalInputForm auto tone submit", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGenerateProposalAction.mockReset();
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_auto",
      proposalContent: "Hello hiring team,\n\nI would love to contribute.",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });
    mockSetCurrentVoicePreset.mockReset();
    mockUpdateGeneratedProposal.mockReset();
    mockRequestProposalGenerationCancel.mockReset();
    mockSetSharedActiveCvSnapshot.mockReset();
    mockSetCurrentVoicePreset.mockResolvedValue(undefined);
    mockUpdateGeneratedProposal.mockResolvedValue(undefined);
    mockRequestProposalGenerationCancel.mockResolvedValue(undefined);
    mockSetSharedActiveCvSnapshot.mockResolvedValue(undefined);
  });

  it("submits successfully with Auto selected on the real form path", async () => {
    const handleSubmit = vi.fn();

    render(<ProposalInputForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("Enter Job Title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
      {
        target: {
          value:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
        },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          voicePreset: null,
          characterLimitMode: "none",
          characterLimitValue: 1500,
        }),
      );
    });

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: "Operations Associate",
        voicePreset: undefined,
      }),
      "Hello hiring team,\n\nI would love to contribute.",
      expect.objectContaining({
        requestedModelType: "chatgpt",
        actualModelType: "chatgpt",
      }),
      "proposal_auto",
    );
  });
});
