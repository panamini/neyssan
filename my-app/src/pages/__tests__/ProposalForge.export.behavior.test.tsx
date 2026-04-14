import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";
import { writeStoredProposalOutputDraft } from "../../lib/proposal-output-draft";
import { LOCAL_SAVED_PROPOSALS_FIXTURE_KEY } from "../../lib/proposal-saved-fixtures";

const {
  exportDocumentFileMock,
  useQueryMock,
  convexAuthState,
} = vi.hoisted(() => ({
  exportDocumentFileMock: vi.fn(),
  useQueryMock: vi.fn(),
  convexAuthState: {
    isLoading: false,
    isAuthenticated: true,
  },
}));

const showToastMock = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => convexAuthState,
  useQuery: (...args: unknown[]) => useQueryMock(...args),
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

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    loadCv: vi.fn(),
  }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: () => <div data-testid="proposal-input-form">Compose shell</div>,
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: () => <div data-testid="proposal-compose-toolbar" />,
}));

vi.mock("../../components/ProposalArtifactInspector", () => ({
  ProposalArtifactInspector: () => null,
}));

vi.mock("../../components/ProposalBriefCard", () => ({
  ProposalBriefCard: () => null,
}));

vi.mock("../../components/ProposalSaveDialog", () => ({
  default: () => null,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: ({
    savedViewActions,
  }: {
    savedViewActions?: React.ReactNode;
  }) => (
    <div data-testid="saved-proposals-list">
      {savedViewActions}
    </div>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="proposal-display">
      <div data-testid="proposal-display-mode">{String(props.mode ?? "preview")}</div>
      {props.actions as React.ReactNode}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../lib/exportDocumentFile", () => ({
  exportDocumentFile: exportDocumentFileMock,
}));

describe("ProposalForge export behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    showToastMock.mockReset();
    exportDocumentFileMock.mockReset();
    useQueryMock.mockReset();
    convexAuthState.isLoading = false;
    convexAuthState.isAuthenticated = true;
    exportDocumentFileMock.mockResolvedValue({
      filename: "Proposal - Styled.pdf",
    });
    useQueryMock.mockReturnValue(null);
  });

  it("exports compose ATS PDFs through the direct-download API", async () => {
    const user = userEvent.setup();

    writeStoredProposalOutputDraft({
      proposalContent: "Dear Hiring Manager,\n\nGenerated proposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Lead",
      proposalContactLine: "alex@example.com · +33 6 00 00 00 00",
      proposalLetterDate: "Paris, April 14, 2026",
      proposalRecipientDetails: "Hiring Manager\nStudio North",
      proposalDocumentTitle: "Generated proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "edit",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Export ATS PDF" }),
    );

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "proposal",
        format: "pdf",
        mode: "ats",
        fileNameBase: "Proposal - ATS",
        data: expect.objectContaining({
          kind: "proposal",
          documentTitle: "Generated proposal",
          body: expect.any(Array),
        }),
      }),
    );
  });

  it("exports saved proposal DOCX and styled PDF from normalized saved state", async () => {
    const user = userEvent.setup();

    convexAuthState.isAuthenticated = false;
    window.localStorage.setItem(
      LOCAL_SAVED_PROPOSALS_FIXTURE_KEY,
      JSON.stringify([
        {
          _id: "proposal_saved",
          title: "Saved proposal",
          content:
            "Dear Hiring Manager,\n\nSaved proposal body.\n\nKind regards,\nAlex Martin",
          status: "saved",
          metadata: {
            proposalType: "cover_letter",
            applicantName: "Alex Martin",
            applicantRole: "Operations Lead",
            contactLine: "alex@example.com · +33 6 00 00 00 00",
            letterDate: "Paris, April 14, 2026",
            recipientDetails: "Hiring Manager\nStudio North",
            templateId: "swiss_margin",
            verbatiStyle: {
              layout: "swiss",
              typography: "quiet-editorial",
              palette: "sauge",
            },
          },
        },
      ]),
    );

    render(
      <MemoryRouter initialEntries={["/proposal?id=proposal_saved"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export Styled PDF" })).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    );

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "proposal",
        format: "pdf",
        mode: "styled",
        fileNameBase: "Proposal - Styled",
        data: expect.objectContaining({
          kind: "proposal",
          documentTitle: "Saved proposal",
        }),
      }),
    );

    exportDocumentFileMock.mockResolvedValueOnce({
      filename: "Proposal - Editable.docx",
    });

    await user.click(screen.getByRole("button", { name: "Export DOCX" }));

    expect(exportDocumentFileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "proposal",
        format: "docx",
        fileNameBase: "Proposal - Editable",
        data: expect.objectContaining({
          kind: "proposal",
          documentTitle: "Saved proposal",
        }),
      }),
    );
  });
});
