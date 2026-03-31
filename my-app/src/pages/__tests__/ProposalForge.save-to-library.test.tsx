import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import {
  PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
  readStoredProposalComposeDraft,
} from "../../lib/proposal-workspace-state";
import {
  PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
  readStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";

const mockUpdateProposal = vi.fn().mockResolvedValue(undefined);
const mockCreateProposal = vi.fn().mockResolvedValue("proposal_saved_new");
const mockShowToast = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
  useMutation: (reference: string) => {
    if (reference === "updateProposalPublic.default") {
      return mockUpdateProposal;
    }
    if (reference === "createProposalPublic.default") {
      return mockCreateProposal;
    }
    return vi.fn().mockResolvedValue(undefined);
  },
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
    createProposalPublic: { default: "createProposalPublic.default" },
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
    showToast: mockShowToast,
  }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({ onSubmit, onValuesChange }: any) => (
    <button
      type="button"
      onClick={() => {
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
        onValuesChange?.(values);
        onSubmit?.(
          values,
          "Freshly generated proposal body.",
          undefined,
          "proposal_generated",
        );
      }}
    >
      Generate proposal
    </button>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    proposalContent,
    documentTitle,
    mode,
    actions,
  }: {
    proposalContent: string | null;
    documentTitle?: string | null;
    mode?: "preview" | "edit";
    actions?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="proposal-display-state">
        {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}|{mode ?? "preview"}
      </div>
      <div data-testid="proposal-display-actions">{actions}</div>
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge save to library", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockCreateProposal.mockClear();
    mockUpdateProposal.mockClear();
    mockShowToast.mockClear();
  });

  it("confirms the title, saves the generated proposal to the library, and opens the saved route", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate proposal" }));

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Operations Associate|Freshly generated proposal body.|preview",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Save proposal to library" }),
    );
    fireEvent.change(screen.getByPlaceholderText("Proposal title"), {
      target: { value: "Operations Associate saved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to Library" }));

    await waitFor(() => {
      expect(mockUpdateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "proposal_generated",
          title: "Operations Associate saved",
          content: "Freshly generated proposal body.",
          status: "saved",
        }),
      );
    });

    expect(
      screen.getByRole("heading", { name: "Operations Associate saved" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Duplicate to draft" }),
    ).toBeInTheDocument();

    expect(readStoredProposalComposeDraft()).toMatchObject({
      jobTitle: "Operations Associate",
      jobDescription: "Support recurring processes and coordinate communication.",
    });
    expect(readStoredProposalOutputDraft()).toMatchObject({
      proposalContent: "Freshly generated proposal body.",
      generatedProposalId: "proposal_generated",
      proposalDocumentTitle: "Operations Associate saved",
    });
    expect(mockShowToast).toHaveBeenCalledWith(
      "Saved to library",
      expect.objectContaining({
        variant: "success",
      }),
    );
  });

  it("creates a new saved proposal when the live draft has no server id", async () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes and coordinate communication.",
        proposalType: "cover_letter",
        voicePreset: "signature",
      }),
    );
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Edited detached draft.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "inherit_cv",
        proposalStyleChoice: "auto",
        proposalApplicantName: "",
        proposalApplicantRole: "",
        proposalDocumentTitle: "Detached proposal",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: null,
        proposalOutputMode: "edit",
        paletteOverride: null,
        customAccentHex: null,
        templateBundleId: null,
        typographyOverride: null,
        layoutOverride: null,
        proposalDocumentTitleManual: false,
        characterLimitMode: null,
        characterLimitValue: null,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Save proposal to library" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save to Library" }));

    await waitFor(() => {
      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Detached proposal",
          content: "Edited detached draft.",
          status: "saved",
        }),
      );
    });

    expect(
      screen.getByRole("heading", { name: "Detached proposal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Duplicate to draft" }),
    ).toBeInTheDocument();
    expect(readStoredProposalOutputDraft()).toMatchObject({
      proposalContent: "Edited detached draft.",
      proposalDocumentTitle: "Detached proposal",
    });
  });
});
