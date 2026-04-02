import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  clearActiveLocalCvId: () => undefined,
  getProposalApplicantIdentity: () => ({
    name: "Alex Martin",
    role: "Product Designer",
  }),
  getProposalAttachedCvId: () => mockAttachedCvState.current?.id ?? null,
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
  getLocalActiveCvSnapshotById: () => null,
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

describe("ProposalForge draft output actions", () => {
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

  it("does not show a Refine action after a successful generation", async () => {
    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger generation" }));
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Refine proposal" })).toBeNull();
    });
  });

  it("keeps tone selection available without rendering a secondary refine trigger", async () => {
    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Formal" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger generation" }));
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Refine proposal" })).toBeNull();
    });
  });
});
