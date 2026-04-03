import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import { writeStoredProposalOutputDraft } from "../../lib/proposal-output-draft";

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

vi.mock("../../components/ProposalInputForm", () => ({
  default: () => <div>Compose</div>,
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: () => <div>Display</div>,
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

function seedStoredDraft(characterLimitMode: string | null): void {
  writeStoredProposalOutputDraft({
    proposalContent: "A".repeat(260),
    proposalType: "cover_letter",
    proposalVoicePreset: "signature",
    proposalTemplateId: "swiss_margin",
    proposalVerbatiStyle: {
      layout: "swiss",
      typography: "quiet-editorial",
      palette: "pierre",
    },
    proposalStyleLinkMode: "proposal_local",
    proposalStyleChoice: "balanced",
    proposalApplicantName: "Alex Martin",
    proposalApplicantRole: "Operations Associate",
    proposalDocumentTitle: "Operations Associate",
    proposalDocumentMeta: "Letter · Signature",
    generatedProposalId: null,
    proposalOutputMode: "preview",
    paletteOverride: null,
    customAccentHex: null,
    templateBundleId: null,
    typographyOverride: null,
    layoutOverride: null,
    proposalDocumentTitleManual: false,
    characterLimitMode: characterLimitMode as any,
    characterLimitValue: null,
  });
}

describe("ProposalForge length guidance", () => {
  beforeEach(() => {
    window.localStorage.clear();
    showToastMock.mockReset();
  });

  it("does not show a generic toast when no character limit mode is active", () => {
    seedStoredDraft(null);

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("shows the advisory toast when a concrete character limit mode is active", () => {
    seedStoredDraft("linkedin_note_200");

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock.mock.calls[0]?.[0]).toMatch(/proposal is getting long/i);
  });
});
