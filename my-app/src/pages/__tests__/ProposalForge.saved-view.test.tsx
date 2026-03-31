import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import {
  readStoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";
import { PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY } from "../../lib/proposal-workspace-state";
import { PROPOSAL_ATTACHED_CV_STORAGE_KEY } from "../../lib/proposal-personalization";

const SAVED_PROPOSALS = [
  {
    _id: "proposal_beta",
    _creationTime: 1710000000000,
    title: "Saved proposal beta",
    content: "Dear team,\n\nSaved proposal content.\n\nBest,",
    status: "saved",
    updatedAt: 1710000000000,
    createdAt: 1710000000000,
    sections: [{ type: "text", content: "Saved proposal content." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      requestedVoicePreset: "signature",
      sourceJobDescription:
        "Lead recurring operations and keep cross-team communication on track.",
    },
  },
] as const;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (query: string) => {
    if (query === "proposalsPublic.default") {
      return SAVED_PROPOSALS;
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
  default: () => {
    const storedDraft = JSON.parse(
      window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
    ) as {
      jobTitle?: string;
      jobDescription?: string;
    };

    return (
      <div>
        <div data-testid="compose-job-title">
          {storedDraft.jobTitle ?? "empty-title"}
        </div>
        <div data-testid="compose-job-description">
          {storedDraft.jobDescription ?? "empty-description"}
        </div>
      </div>
    );
  },
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    proposalContent,
    documentTitle,
    mode,
  }: {
    proposalContent: string | null;
    documentTitle?: string | null;
    mode?: "preview" | "edit";
  }) => (
    <div data-testid="proposal-display-state">
      {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}|{mode ?? "preview"}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: ({
    selectedProposalId,
  }: {
    selectedProposalId?: string | null;
  }) => (
    <div data-testid="saved-proposals-list">
      {selectedProposalId ?? "no-selection"}
    </div>
  ),
}));

function ProposalRouteControls(): JSX.Element {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate("/cv")}>
      Open resume workspace
    </button>
  );
}

function ResumeRoundTripControls(): JSX.Element {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate("/proposal")}>
      Back to proposal workspace
    </button>
  );
}

describe("ProposalForge saved view", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders explicit saved proposal actions beside the saved stack", () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Back to draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate to draft" })).toBeInTheDocument();
    expect(screen.getByTestId("saved-proposals-list")).toHaveTextContent(
      "proposal_beta",
    );
  });

  it("treats bare proposal id links as saved view for backward compatibility", () => {
    render(
      <MemoryRouter initialEntries={["/proposal?id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Back to draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate to draft" })).toBeInTheDocument();
    expect(screen.getByTestId("saved-proposals-list")).toHaveTextContent(
      "proposal_beta",
    );
  });

  it("returns to the live editable draft without clearing it", () => {
    window.localStorage.setItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY, "cv_alpha");
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
    writeStoredProposalOutputDraft({
      proposalContent: "Live editable proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Live editable proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "edit",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: null,
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to draft" }));

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Live editable proposal|Live editable proposal body.|edit",
    );
    expect(readStoredProposalOutputDraft()?.proposalContent).toBe(
      "Live editable proposal body.",
    );
    expect(window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY)).toBe(
      "cv_alpha",
    );
  });

  it("copies saved proposal content and source brief back into the live draft explicitly", () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Saved proposal beta",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Saved proposal content.",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "|preview",
    );
    expect(screen.getByTestId("compose-job-title")).toHaveTextContent(
      "Saved proposal beta",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "Lead recurring operations and keep cross-team communication on track.",
    );
  });

  it("keeps the restored live draft after a resume detour", () => {
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
    writeStoredProposalOutputDraft({
      proposalContent: "Live editable proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Live editable proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "edit",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: null,
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <Routes>
          <Route
            path="/proposal"
            element={
              <>
                <ProposalRouteControls />
                <ProposalForge />
              </>
            }
          />
          <Route path="/cv" element={<ResumeRoundTripControls />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to draft" }));
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Live editable proposal|Live editable proposal body.|edit",
    );

    fireEvent.click(screen.getByRole("button", { name: "Open resume workspace" }));
    expect(
      screen.getByRole("button", { name: "Back to proposal workspace" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Back to proposal workspace" }),
    );

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Live editable proposal|Live editable proposal body.|edit",
    );
  });
});
