import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import {
  readStoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";
import { PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY } from "../../lib/proposal-workspace-state";

const ATTACHED_CV_STORAGE_KEY = "dasti:proposal-attached-cv-id:v1";

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
      sourceCvId: "cv_alpha",
      styleLinkMode: "inherit_cv",
      templateId: "swiss_margin",
      verbatiStyle: {
        layout: "swiss",
        typography: "signature",
        palette: "bordeaux",
      },
      sourceUrl: "https://www.linkedin.com/jobs/view/123456",
      platform: "linkedin",
      sourceJobDescription:
        "Lead recurring operations and keep cross-team communication on track.",
    },
  },
  {
    _id: "proposal_local_saved",
    _creationTime: 1710000000500,
    title: "Saved proposal local",
    content: "Dear client,\n\nDetached saved proposal content.\n\nBest,",
    status: "saved",
    updatedAt: 1710000000500,
    createdAt: 1710000000500,
    sections: [{ type: "text", content: "Detached saved proposal content." }],
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      requestedVoicePreset: "signature",
      sourceCvId: "cv_alpha",
      styleLinkMode: "proposal_local",
      templateId: "swiss_margin",
      verbatiStyle: {
        layout: "swiss",
        typography: "signature",
        palette: "bordeaux",
      },
      sourceUrl: "https://example.com/jobs/local-123",
      platform: "company_website",
      sourceJobDescription:
        "Build polished client proposals with stable saved styling.",
    },
  },
  {
    _id: "proposal_gamma",
    _creationTime: 1710000001000,
    title: "Saved proposal gamma",
    content:
      "Dear reader,\n\nSaved proposal without brief metadata.\n\nRegards,",
    status: "saved",
    updatedAt: 1710000001000,
    createdAt: 1710000001000,
    sections: [
      { type: "text", content: "Saved proposal without brief metadata." },
    ],
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
      sourceUrl: "https://example.com/jobs/operations-auto",
      platform: "company_website",
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

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  clearActiveLocalCvId: () => {
    mockAttachedCvId = null;
    window.localStorage.removeItem("dasti:proposal-attached-cv-id:v1");
  },
  getActiveLocalPersonalizationSource: () => ({
    title: mockAttachedCvId === "cv_alpha" ? "Alex Martin Resume" : null,
    personalizationContext: null,
  }),
  getLocalPersonalizationSourceByCvId: (id: string | null | undefined) => ({
    title: id === "cv_alpha" ? "Alex Martin Resume" : null,
    personalizationContext: null,
  }),
  getLocalActiveCvSnapshotById: (id: string) =>
    id === "cv_alpha" ? { title: "Alex Martin Resume" } : null,
  getLocalCvDocumentById: (id: string) =>
    id === "cv_alpha" ? mockSourceCv : null,
  listLocalCvPickerOptions: () => [
    {
      id: "cv_alpha",
      title: "Alex Martin Resume",
      subtitle: "Operations Associate",
      isActive: mockAttachedCvId === "cv_alpha",
    },
  ],
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
  getProposalAttachedCvId: () =>
    mockAttachedCvId ??
    window.localStorage.getItem("dasti:proposal-attached-cv-id:v1"),
  getProposalAttachedCvLocalDocument: () =>
    (mockAttachedCvId ??
      window.localStorage.getItem("dasti:proposal-attached-cv-id:v1")) ===
    "cv_alpha"
      ? mockSourceCv
      : null,
  PROPOSAL_ATTACHED_CV_STORAGE_KEY: "dasti:proposal-attached-cv-id:v1",
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
  setProposalAttachedCvId: (id: string) => {
    mockAttachedCvId = id;
    window.localStorage.setItem("dasti:proposal-attached-cv-id:v1", id);
  },
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: (props: {
    cvPickerOpen?: boolean;
    cvPickerRequestKey?: number;
    onValuesChange?: (values: any) => void;
  }) => {
    const storedDraft = JSON.parse(
      window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
    ) as {
      jobTitle?: string;
      jobDescription?: string;
      proposalType?: string;
      voicePreset?: string | null;
      toneTuning?: string | null;
      characterLimitMode?: string | null;
      characterLimitValue?: number | null;
    };

    React.useEffect(() => {
      props.onValuesChange?.({
        jobTitle: storedDraft.jobTitle ?? "",
        jobDescription: storedDraft.jobDescription ?? "",
        proposalType: storedDraft.proposalType ?? "cover_letter",
        voicePreset:
          storedDraft.voicePreset === undefined
            ? undefined
            : storedDraft.voicePreset,
        toneTuning: storedDraft.toneTuning ?? null,
        characterLimitMode: storedDraft.characterLimitMode ?? "none",
        characterLimitValue: storedDraft.characterLimitValue ?? null,
      });
    }, [
      props,
      storedDraft.characterLimitMode,
      storedDraft.characterLimitValue,
      storedDraft.jobDescription,
      storedDraft.jobTitle,
      storedDraft.proposalType,
      storedDraft.toneTuning,
      storedDraft.voicePreset,
    ]);

    return (
      <div>
        <div data-testid="compose-job-title">
          {storedDraft.jobTitle ?? "empty-title"}
        </div>
        <div data-testid="compose-job-description">
          {storedDraft.jobDescription ?? "empty-description"}
        </div>
        <div data-testid="compose-cv-picker-state">
          {props.cvPickerOpen ? "open" : "closed"}
        </div>
        <div data-testid="compose-cv-picker-request-key">
          {props.cvPickerRequestKey ?? 0}
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
    stylePreset,
  }: {
    proposalContent: string | null;
    documentTitle?: string | null;
    mode?: "preview" | "edit";
    stylePreset?: {
      layout?: string | null;
      palette?: string | null;
    } | null;
  }) => (
    <div data-testid="proposal-display-state">
      {documentTitle ?? "untitled"}|{proposalContent ?? "empty"}|
      {mode ?? "preview"}|{stylePreset?.layout ?? "none"}|
      {stylePreset?.palette ?? "none"}
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

describe("ProposalForge saved view", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockAttachedCvId = null;
  });

  it("renders explicit saved proposal actions beside the saved stack", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Back to draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Duplicate to draft" }),
    ).toBeInTheDocument();
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
    expect(
      toolbar?.closest('[data-testid="saved-proposals-list"]'),
    ).toBeTruthy();
    expect(pageShell).toHaveClass("dasti-page-shell--proposal-saved");
    expect(pageShell?.style.getPropertyValue("--page-shell-max-width")).toBe(
      "100%",
    );
    const actionButtons = within(toolbar as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(actionButtons).toEqual([
      "Duplicate to draft",
      "Export proposal",
      "Share proposal",
    ]);
    expect(toolbar).not.toHaveTextContent("Based on CV: Alex Martin Resume");
    expect(
      within(toolbar as HTMLElement).queryByRole("group", {
        name: "Saved proposal status",
      }),
    ).not.toBeInTheDocument();
  });

  it("treats bare proposal id links as saved view for backward compatibility", () => {
    render(
      <MemoryRouter initialEntries={["/proposal?id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Back to draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Duplicate to draft" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("saved-proposals-list")).toHaveTextContent(
      "proposal_beta",
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
    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({
      sourceUrl: "https://www.linkedin.com/jobs/view/123456",
      platform: "linkedin",
    });
    expect(screen.getByTestId("compose-cv-picker-state")).toHaveTextContent(
      "closed",
    );
    expect(
      screen.getByTestId("compose-cv-picker-request-key"),
    ).toHaveTextContent("0");
    expect(window.localStorage.getItem(ATTACHED_CV_STORAGE_KEY)).toBe(
      "cv_alpha",
    );
  });

  it("keeps saved proposal cv provenance visible on reopen even when the saved artifact is stable", () => {
    render(
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const toolbar = screen.getByRole("group", {
      name: "Saved proposal actions",
    });
    expect(toolbar).not.toHaveTextContent("Based on CV: Alex Martin Resume");
    expect(
      within(toolbar as HTMLElement).queryByRole("group", {
        name: "Saved proposal status",
      }),
    ).not.toBeInTheDocument();
  });

  it("duplicates the persisted inherited-style row instead of a stale local draft when reopening the same proposal id", async () => {
    window.localStorage.setItem(ATTACHED_CV_STORAGE_KEY, "cv_alpha");
    mockAttachedCvId = "cv_alpha";
    writeStoredProposalOutputDraft({
      proposalContent: "Stale inherited draft body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "two_column_rail",
      proposalVerbatiStyle: {
        layout: "editorial",
        typography: "engaging",
        palette: "encre",
      },
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Stale inherited draft",
      proposalDocumentMeta: "Stale compose output",
      generatedProposalId: "proposal_beta",
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
      <MemoryRouter initialEntries={["/proposal?view=saved&id=proposal_beta"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    await waitFor(() => {
      const state = screen.getByTestId("proposal-display-state");
      expect(state).toHaveTextContent("Saved proposal beta");
      expect(state).toHaveTextContent("Saved proposal content.");
      expect(state).toHaveTextContent("|preview|editorial|encre");
    });
  });

  it("duplicates the persisted local-style row instead of a stale inherited draft when reopening the same proposal id", async () => {
    window.localStorage.setItem(ATTACHED_CV_STORAGE_KEY, "cv_alpha");
    mockAttachedCvId = "cv_alpha";
    writeStoredProposalOutputDraft({
      proposalContent: "Stale detached draft body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "two_column_rail",
      proposalVerbatiStyle: {
        layout: "editorial",
        typography: "engaging",
        palette: "encre",
      },
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Stale detached draft",
      proposalDocumentMeta: "Stale compose output",
      generatedProposalId: "proposal_local_saved",
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
      <MemoryRouter
        initialEntries={["/proposal?view=saved&id=proposal_local_saved"]}
      >
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate to draft" }));

    await waitFor(() => {
      const state = screen.getByTestId("proposal-display-state");
      expect(state).toHaveTextContent("Saved proposal local");
      expect(state).toHaveTextContent("Detached saved proposal content.");
      expect(state).toHaveTextContent("|preview|swiss|bordeaux");
    });
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
      sourceUrl: "https://example.com/jobs/operations-auto",
      platform: "company_website",
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
});
