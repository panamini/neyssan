import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  {
    _id: "proposal_gamma",
    _creationTime: 1710000001000,
    title: "Saved proposal gamma",
    content: "Dear reader,\n\nSaved proposal without brief metadata.\n\nRegards,",
    status: "saved",
    updatedAt: 1710000001000,
    createdAt: 1710000001000,
    sections: [{ type: "text", content: "Saved proposal without brief metadata." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      requestedVoicePreset: "signature",
    },
  },
  {
    _id: "proposal_auto",
    _creationTime: 1710000002000,
    title: "Saved proposal auto",
    content: "Dear team,\n\nAuto tone saved proposal.\n\nBest,",
    status: "saved",
    updatedAt: 1710000002000,
    createdAt: 1710000002000,
    sections: [{ type: "text", content: "Auto tone saved proposal." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "expert",
      requestedVoicePreset: null,
      resolvedVoicePreset: "expert",
      sourceJobDescription:
        "Coordinate operations, keep processes clean, and support team communication.",
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
    savedViewActions,
  }: {
    selectedProposalId?: string | null;
    savedViewActions?: React.ReactNode;
  }) => (
    <div data-testid="saved-proposals-list">
      {savedViewActions ?? null}
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
    const { container } = render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Back to draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate to draft" })).toBeInTheDocument();
    expect(screen.getByTestId("saved-proposals-list")).toHaveTextContent(
      "proposal_beta",
    );
    const toolbar = container.querySelector(
      ".dasti-proposal-saved-view-toolbar",
    ) as HTMLElement | null;
    const pageShell = container.querySelector(
      ".dasti-page-shell",
    ) as HTMLElement | null;
    expect(toolbar).toBeTruthy();
    expect(toolbar).toHaveClass("dasti-toolbar--surface-tooltips");
    expect(toolbar?.closest('[data-testid="saved-proposals-list"]')).toBeTruthy();
    expect(pageShell).toHaveClass("dasti-page-shell--proposal-saved");
    expect(pageShell?.style.getPropertyValue("--page-shell-max-width")).toBe(
      "100%",
    );
    const actionButtons = within(toolbar as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(actionButtons).toEqual([
      "Back to draft",
      "Duplicate to draft",
      "Export proposal as PDF",
    ]);
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

  it("keeps the existing compose brief when the saved proposal lacks source brief metadata", () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Marketing Specialist",
        jobDescription: "Existing compose brief should survive saved reopen.",
        proposalType: "cover_letter",
        voicePreset: "signature",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_gamma"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    expect(screen.getByTestId("compose-job-title")).toHaveTextContent(
      "Saved proposal gamma",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "Existing compose brief should survive saved reopen.",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Saved proposal gamma",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Saved proposal without brief metadata.",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "|preview",
    );
  });

  it("preserves Auto when a saved proposal is duplicated back into the live draft", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_auto"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({
      jobTitle: "Saved proposal auto",
      jobDescription:
        "Coordinate operations, keep processes clean, and support team communication.",
      proposalType: "cover_letter",
      voicePreset: null,
    });

    await waitFor(() => {
      expect(readStoredProposalOutputDraft()).toEqual(
        expect.objectContaining({
          proposalVoicePreset: "expert",
          sourceComposeDraft: expect.objectContaining({
            voicePreset: null,
          }),
        }),
      );
    });
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
