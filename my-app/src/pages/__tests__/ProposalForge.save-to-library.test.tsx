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
let mockAttachedCvId: string | null = null;
const mockSourceCv = {
  id: "cv_alpha",
  title: "Alex Martin Resume",
  metadata: {
    verbatiStyle: {
      layout: "editorial",
      typography: "engaging",
      palette: "encre",
    },
  },
} as any;

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

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  clearActiveLocalCvId: () => {
    mockAttachedCvId = null;
  },
  getActiveLocalPersonalizationSource: () => ({
    title: mockAttachedCvId === "cv_alpha" ? "Alex Martin Resume" : null,
    personalizationContext: null,
  }),
  getLocalActiveCvSnapshotById: (id: string) =>
    id === "cv_alpha" ? { title: "Alex Martin Resume" } : null,
  getLocalPersonalizationSourceByCvId: (id: string | null) => ({
    title: id === "cv_alpha" ? "Alex Martin Resume" : null,
    personalizationContext: null,
  }),
  listLocalCvPickerOptions: () =>
    mockAttachedCvId === "cv_alpha"
      ? [{ id: "cv_alpha", title: "Alex Martin Resume", isActive: true }]
      : [],
  getLocalCvDocumentById: (id: string) => (id === "cv_alpha" ? mockSourceCv : null),
  getProposalApplicantHeaderData: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
    email: "alex@example.com",
    phone: null,
    linkedin: null,
    website: null,
    location: null,
    tag: null,
  }),
  getProposalApplicantIdentity: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
  }),
  getProposalAttachedCvId: () => mockAttachedCvId,
  getProposalAttachedCvLocalDocument: () =>
    mockAttachedCvId === "cv_alpha" ? mockSourceCv : null,
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
  setProposalAttachedCvId: (id: string) => {
    mockAttachedCvId = id;
  },
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
    mockAttachedCvId = null;
  });

  it("confirms the title, saves the generated proposal to the library, and opens the saved route", async () => {
    mockAttachedCvId = "cv_alpha";

    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes and coordinate communication.",
        sourceUrl: null,
        platform: null,
        proposalType: "cover_letter",
        voicePreset: "signature",
      }),
    );
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Freshly generated proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "inherit_cv",
        proposalStyleChoice: "auto",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Operations Associate",
        proposalDocumentMeta: "alex@example.com",
        generatedProposalId: "proposal_generated",
        proposalOutputMode: "preview",
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
      await screen.findByRole("button", { name: "Save proposal to library" }),
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
          content: expect.stringContaining("Freshly generated proposal body."),
          status: "saved",
          metadata: expect.objectContaining({
            sourceCvId: "cv_alpha",
            templateId: expect.any(String),
            styleLinkMode: "inherit_cv",
            verbatiStyle: expect.objectContaining({
              palette: "encre",
            }),
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Saved proposals")).toBeInTheDocument();
    });

    expect(readStoredProposalComposeDraft()).toBeNull();
    expect(readStoredProposalOutputDraft()).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(
      "Saved.",
      expect.objectContaining({
        variant: "success",
      }),
    );
  });

  it("persists a custom detached style while keeping the saved proposal source cv association", async () => {
    mockAttachedCvId = "cv_alpha";
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Detached styled proposal.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "bordeaux",
        },
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "balanced",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Detached proposal",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: null,
        proposalOutputMode: "preview",
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
          content: expect.stringContaining("Detached styled proposal."),
          metadata: expect.objectContaining({
            sourceCvId: "cv_alpha",
            templateId: expect.any(String),
            styleLinkMode: "proposal_local",
            verbatiStyle: expect.objectContaining({
              palette: "bordeaux",
            }),
          }),
        }),
      );
    });
  });

  it("creates a new saved proposal when the live draft has no server id", async () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes and coordinate communication.",
        sourceUrl: "https://www.linkedin.com/jobs/view/123456",
        platform: "linkedin",
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
          content: expect.stringContaining("Edited detached draft."),
          status: "saved",
          metadata: expect.objectContaining({
            sourceJobDescription:
              "Support recurring processes and coordinate communication.",
            sourceUrl: "https://www.linkedin.com/jobs/view/123456",
            platform: "linkedin",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Saved proposals")).toBeInTheDocument();
    });
    expect(readStoredProposalComposeDraft()).toBeNull();
    expect(readStoredProposalOutputDraft()).toBeNull();
  });
});
