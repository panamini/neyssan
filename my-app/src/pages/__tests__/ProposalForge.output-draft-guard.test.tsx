import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import {
  readStoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";

vi.mock("convex/react", () => ({
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
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
  default: ({ onStart }: { onStart?: (values: any) => void }) => (
    <button
      type="button"
      onClick={() =>
        onStart?.({
          jobTitle: "Content Creation & Social Media Intern",
          jobDescription: "Draft a sharp proposal for social media work.",
          proposalType: "cover_letter",
          voicePreset: "expert",
          toneTuning: null,
          characterLimitMode: "custom",
          characterLimitValue: 1500,
        })
      }
    >
      Start generation
    </button>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    proposalContent,
    documentTitle,
    onProposalDocumentChange,
  }: {
    proposalContent: string | null;
    documentTitle?: string | null;
    onProposalDocumentChange?: (document: any) => void;
  }) => (
    <div data-testid="proposal-display-state">
      {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}
      <button
        type="button"
        onClick={() =>
          onProposalDocumentChange?.({
            schemaVersion: 1,
            kind: "letter",
            source: "structured",
            blocks: [
              {
                id: "salutation-1",
                type: "salutation",
                text: "Dear team,",
              },
              {
                id: "paragraph-1",
                type: "paragraph",
                text: "Preview-edited proposal body.",
              },
              {
                id: "closing-1",
                type: "closing",
                signOff: "Kind regards,",
                signatureName: "Alex Martin",
              },
            ],
          })
        }
      >
        Edit preview document
      </button>
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge output draft guard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does not overwrite a stored generated proposal with a metadata-only start state", () => {
    writeStoredProposalOutputDraft({
      proposalContent: "Freshly generated proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "swiss_margin",
      proposalVerbatiStyle: {
        layout: "swiss",
        typography: "signature",
        palette: "pierre",
      },
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Operations Associate",
      proposalDocumentMeta: "Letter · Signature",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
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
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start generation", hidden: true }));

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Content Creation & Social Media Intern|empty",
    );
    expect(readStoredProposalOutputDraft()).toMatchObject({
      proposalContent: expect.stringContaining("Freshly generated proposal body."),
      generatedProposalId: "proposal_live",
      proposalDocumentTitle: "Operations Associate",
    });
  });

  it("persists preview document edits as canonical output draft content", async () => {
    writeStoredProposalOutputDraft({
      proposalContent: "Dear team,\n\nOriginal proposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "swiss_margin",
      proposalVerbatiStyle: {
        layout: "swiss",
        typography: "signature",
        palette: "pierre",
      },
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Operations Associate",
      proposalDocumentMeta: "Letter · Signature",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
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
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit preview document" }),
    );

    expect(readStoredProposalOutputDraft()).toMatchObject({
      proposalContent: expect.stringContaining("Preview-edited proposal body."),
      generatedProposalId: "proposal_live",
    });
  });
});
