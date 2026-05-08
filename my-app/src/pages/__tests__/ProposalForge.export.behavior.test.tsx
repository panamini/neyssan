import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";
import { writeStoredProposalOutputDraft } from "../../lib/proposal-output-draft";
import { LOCAL_SAVED_PROPOSALS_FIXTURE_KEY } from "../../lib/proposal-saved-fixtures";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    void nextReject;
  });

  return { promise, resolve };
}

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
  ProposalComposeToolbar: (props: Record<string, unknown>) => (
    <div data-testid="proposal-compose-toolbar">
      {props.rightActions as React.ReactNode}
    </div>
  ),
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

  it("exports compose styled PDFs through the stage share menu", async () => {
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

    await user.click(screen.getByRole("button", { name: "Share proposal" }));
    await user.click(screen.getByRole("menuitem", { name: "Export PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "proposal",
        format: "pdf",
        mode: "styled",
        fileNameBase: "Proposal - Styled",
        stylePreset: expect.objectContaining({
          layout: "workshop",
          typography: "geist-baskervville",
          palette: "terre",
        }),
        data: expect.objectContaining({
          kind: "proposal",
          documentTitle: "Generated proposal",
          renderSource: "preview",
        }),
      }),
    );
  });

  it("exports compose styled PDFs from the live preview render state", async () => {
    const user = userEvent.setup();

    writeStoredProposalOutputDraft({
      proposalContent:
        "Dear Hiring Manager,\n\nGenerated proposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "two_column_rail",
      proposalVerbatiStyle: {
        layout: "two-column",
        typography: "mono-signal",
        palette: "graphite",
      },
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "balanced",
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

    await user.click(screen.getByRole("button", { name: "Share proposal" }));
    await user.click(screen.getByRole("menuitem", { name: "Export PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "proposal",
        format: "pdf",
        mode: "styled",
        stylePreset: expect.objectContaining({
          layout: "workshop",
          typography: "geist-baskervville",
          palette: "terre",
        }),
        data: expect.objectContaining({
          kind: "proposal",
          renderSource: "preview",
          templateId: "workshop_proposal_margin",
          stylePreset: expect.objectContaining({
            layout: "workshop",
            typography: "geist-baskervville",
            palette: "terre",
          }),
        }),
      }),
    );
  });

  it("exports compose styled PDFs from slot-only draft style metadata", async () => {
    const user = userEvent.setup();

    writeStoredProposalOutputDraft({
      proposalContent:
        "Dear Hiring Manager,\n\nGenerated proposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      verbatiStyleSlotId: 2,
      verbatiStyleSlotSource: "factory",
      verbatiStyleSlotNameSnapshot: "Style 2",
      verbatiStyleBaseSnapshot: {
        familyId: "workshop",
        layout: "workshop",
        typography: "soft-serif",
        palette: "cobalt",
      },
      documentStyleVersion: 1,
      proposalStyleLinkMode: "proposal_local",
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

    await user.click(screen.getByRole("button", { name: "Share proposal" }));
    await user.click(screen.getByRole("menuitem", { name: "Export PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "proposal",
        format: "pdf",
        mode: "styled",
        stylePreset: expect.objectContaining({
          layout: "workshop",
          typography: "soft-serif",
          palette: "cobalt",
        }),
        data: expect.objectContaining({
          kind: "proposal",
          renderSource: "preview",
          templateId: "workshop_proposal_margin",
          stylePreset: expect.objectContaining({
            layout: "workshop",
            typography: "soft-serif",
            palette: "cobalt",
          }),
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
      expect(screen.getByRole("button", { name: "Share proposal" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Share proposal" }));
    await user.click(screen.getByRole("menuitem", { name: "Export PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "proposal",
        format: "pdf",
        mode: "styled",
        fileNameBase: "Proposal - Styled",
        stylePreset: expect.objectContaining({
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }),
        data: expect.objectContaining({
          kind: "proposal",
          renderSource: "preview",
          documentTitle: "Saved proposal",
          templateId: "swiss_margin",
        }),
      }),
    );

    exportDocumentFileMock.mockResolvedValueOnce({
      filename: "Proposal - Editable.docx",
    });

    await user.click(screen.getByRole("button", { name: "Share proposal" }));
    await user.click(screen.getByRole("menuitem", { name: /Export DOCX/i }));

    expect(exportDocumentFileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "proposal",
        format: "docx",
        fileNameBase: "Proposal - Editable",
        stylePreset: expect.objectContaining({
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }),
        data: expect.objectContaining({
          kind: "proposal",
          documentTitle: "Saved proposal",
        }),
      }),
    );
  });

  it("disables proposal export actions while an export is already in flight", async () => {
    const user = userEvent.setup();
    const pendingExport = createDeferred<{ filename: string }>();
    exportDocumentFileMock.mockReturnValueOnce(pendingExport.promise);

    writeStoredProposalOutputDraft({
      proposalContent: "Dear Hiring Manager,\n\nGenerated proposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "swiss_margin",
      proposalVerbatiStyle: {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      },
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

    const exportButton = screen.getByRole("button", { name: "Share proposal" });

    await user.click(exportButton);
    await user.click(screen.getByRole("menuitem", { name: "Export PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledTimes(1);

    await user.click(exportButton);
    expect(screen.getByRole("menuitem", { name: "Export PDF" })).toBeDisabled();
    await user.click(screen.getByRole("menuitem", { name: "Export PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledTimes(1);

    pendingExport.resolve({
      filename: "Proposal - Styled.pdf",
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Share proposal" })).toBeInTheDocument();
    });

    expect(showToastMock).toHaveBeenCalledWith("Exported.", {
      variant: "success",
    });
  });
});
