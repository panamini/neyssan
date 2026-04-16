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
  }: {
    proposalContent: string | null;
    documentTitle?: string | null;
  }) => (
    <div data-testid="proposal-display-state">
      {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}
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

    fireEvent.click(screen.getByRole("button", { name: "Start generation" }));

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Content Creation & Social Media Intern|empty",
    );
    expect(readStoredProposalOutputDraft()).toMatchObject({
      proposalContent: expect.stringContaining("Freshly generated proposal body."),
      generatedProposalId: "proposal_live",
      proposalDocumentTitle: "Operations Associate",
    });
  });
});
