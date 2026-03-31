import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";

const { mockGenerateProposalAction, mockProposalInputValues } = vi.hoisted(() => ({
  mockGenerateProposalAction: vi.fn().mockResolvedValue(null),
  mockProposalInputValues: {
    current: {
      proposalType: "cover_letter",
      jobTitle: "Product Designer",
      jobDescription: "Design systems and user flows for complex products.",
      voicePreset: "signature" as "signature" | undefined,
      formalityLevel: "neutral",
      creativity: "medium",
      toneTuning: null,
      characterLimitMode: "custom",
      characterLimitValue: 1500,
      modelType: "mistral-small-latest",
    },
  },
}));

const mockAttachedCvState = {
  current: null as null | { id: string; title: string },
};

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => mockGenerateProposalAction,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
      suggestProposalStyle: "functions.suggestProposalStyle",
    },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  getProposalApplicantIdentity: () => ({
    name: "Alex Martin",
    role: "Product Designer",
  }),
  getProposalAttachedCvLocalDocument: () =>
    mockAttachedCvState.current
      ? {
          id: mockAttachedCvState.current.id,
          title: mockAttachedCvState.current.title,
        }
      : null,
  getActiveLocalPersonalizationSource: () => ({
    title: mockAttachedCvState.current?.title ?? null,
    personalizationContext: mockAttachedCvState.current
      ? { name: "Alex Martin", desiredPosition: "Product Designer" }
      : null,
  }),
  listLocalCvPickerOptions: () =>
    mockAttachedCvState.current
      ? [
          {
            id: mockAttachedCvState.current.id,
            title: mockAttachedCvState.current.title,
            isActive: true,
          },
        ]
      : [],
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({ onStart, onSubmit }: any) => {
    const values = mockProposalInputValues.current;

    return (
      <button
        type="button"
        onClick={() => {
          onStart?.(values);
          onSubmit?.(
            values,
            "Dear Hiring Manager,\n\nI design with care and precision.\n\nBest,",
            {
              requestedModelType: "mistral-small-latest",
              actualModelType: "mistral-small-latest",
              fallbackTriggerCode: null,
            },
          );
        }}
      >
        Trigger generation
      </button>
    );
  },
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge RegenerateMenu", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockAttachedCvState.current = null;
    mockGenerateProposalAction.mockReset();
    mockGenerateProposalAction.mockResolvedValue(null);
    mockProposalInputValues.current = {
      proposalType: "cover_letter",
      jobTitle: "Product Designer",
      jobDescription: "Design systems and user flows for complex products.",
      voicePreset: "signature",
      formalityLevel: "neutral",
      creativity: "medium",
      toneTuning: null,
      characterLimitMode: "custom",
      characterLimitValue: 1500,
      modelType: "mistral-small-latest",
    };
  });

  it("shows local style choices in the output rail when the proposal is not linked", () => {
    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Auto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Formal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Warm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Technical" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Balanced" })).toBeInTheDocument();
  });

  it("hides style choices when the proposal inherits style from the linked CV", () => {
    mockAttachedCvState.current = {
      id: "cv-linked",
      title: "Linked CV",
    };

    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Local" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Linked" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Formal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Warm" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Technical" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Balanced" })).not.toBeInTheDocument();
  });

  it("shows the Regenerate button after a successful generation", async () => {
    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger generation" }));
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Regenerate" }),
      ).toBeInTheDocument();
    });
  });

  it("opens the voice popover when Regenerate is clicked", async () => {
    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger generation" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    });

    const dialog = screen.getByRole("dialog", { name: "Regenerate options" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voice" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Auto" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Natural" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Formal" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Warm" })).toBeInTheDocument();
  });

  it("closes the popover when a voice chip is selected and Regenerate is confirmed", async () => {
    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger generation" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    });

    const dialog = screen.getByRole("dialog", { name: "Regenerate options" });
    expect(dialog).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Formal" }));
    });

    // Confirm regenerate from inside the popover
    const confirmButtons = screen.getAllByRole("button", { name: "Regenerate" });
    // The confirm button inside the dialog
    const confirmButton = confirmButtons.find(
      (btn) => btn.closest('[role="dialog"]') !== null,
    );
    expect(confirmButton).toBeTruthy();
    await act(async () => {
      fireEvent.click(confirmButton!);
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Regenerate options" }),
      ).not.toBeInTheDocument();
    });
  });

  it("sends a null voice preset when Auto is confirmed from regenerate", async () => {
    mockProposalInputValues.current = {
      proposalType: "cover_letter",
      jobTitle: "Customer Support Specialist",
      jobDescription: "Help customers, resolve issues, and coordinate with internal teams.",
      voicePreset: undefined,
      formalityLevel: undefined,
      creativity: undefined,
      toneTuning: null,
      characterLimitMode: "custom",
      characterLimitValue: 1500,
      modelType: "mistral-small-latest",
    };
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_regenerated_auto",
      proposalContent: "Hello team,\n\nI would love to help your customers.\n\nBest,",
      requestedModelType: "mistral-small-latest",
      actualModelType: "mistral-small-latest",
      fallbackTriggerCode: null,
    });

    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger generation" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    });

    const dialog = screen.getByRole("dialog", { name: "Regenerate options" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Auto" }));
    });

    const confirmButton = screen
      .getAllByRole("button", { name: "Regenerate" })
      .find((button) => button.closest('[role="dialog"]') !== null);

    expect(confirmButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(confirmButton!);
    });

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          voicePreset: null,
        }),
      );
    });
  });
});
