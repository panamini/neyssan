import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";
import { writeStoredProposalOutputDraft } from "../../lib/proposal-output-draft";

const {
  downloadFirstMatchingNodeAsPdfMock,
} = vi.hoisted(() => ({
  downloadFirstMatchingNodeAsPdfMock: vi.fn(),
}));

const showToastMock = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
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
  default: () => <div data-testid="saved-proposals-list" />,
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

vi.mock("../../lib/document-export", () => ({
  downloadFirstMatchingNodeAsPdf: downloadFirstMatchingNodeAsPdfMock,
}));

describe("ProposalForge export behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    showToastMock.mockReset();
    downloadFirstMatchingNodeAsPdfMock.mockReset();
    downloadFirstMatchingNodeAsPdfMock.mockResolvedValue(true);
  });

  it("downloads the mounted proposal document root directly from compose preview", async () => {
    const user = userEvent.setup();

    writeStoredProposalOutputDraft({
      proposalContent: "Generated proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Lead",
      proposalDocumentTitle: "Generated proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
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
      screen.getByRole("button", { name: "Export proposal as PDF" }),
    );

    expect(downloadFirstMatchingNodeAsPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectors: expect.arrayContaining([".dasti-proposal-document"]),
      }),
    );
  });

  it("switches from edit to preview before downloading a PDF", async () => {
    const user = userEvent.setup();

    writeStoredProposalOutputDraft({
      proposalContent: "Editable proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Lead",
      proposalDocumentTitle: "Editable proposal",
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

    expect(screen.getByTestId("proposal-display-mode")).toHaveTextContent(
      "edit",
    );

    await user.click(
      screen.getByRole("button", { name: "Export proposal as PDF" }),
    );

    expect(downloadFirstMatchingNodeAsPdfMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-mode")).toHaveTextContent(
        "preview",
      );
    });

    await waitFor(() => {
      expect(downloadFirstMatchingNodeAsPdfMock).toHaveBeenCalledWith(
        expect.objectContaining({
          selectors: expect.arrayContaining([".dasti-proposal-document"]),
        }),
      );
    });
  });

  it("retries PDF export after switching from edit into preview", async () => {
    const user = userEvent.setup();

    writeStoredProposalOutputDraft({
      proposalContent: "Generated proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Lead",
      proposalDocumentTitle: "Generated proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    });

    downloadFirstMatchingNodeAsPdfMock.mockResolvedValueOnce(false).mockResolvedValue(true);

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Export proposal as PDF" }),
    );

    await waitFor(() => {
      expect(downloadFirstMatchingNodeAsPdfMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectors: expect.arrayContaining([
            ".dasti-proposal-document",
            ".dasti-proposal-sheet__preview-stage[data-document-stage='true']",
          ]),
        }),
      );
    });
  });
});
