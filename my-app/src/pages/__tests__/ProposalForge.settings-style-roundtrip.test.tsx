import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";
import { PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY } from "../../lib/proposal-output-draft";
import { createProposalWorkspaceResetState } from "../../lib/proposal-workspace-state";

const defaultCurrentProposalSettings = {
  voicePreset: "signature",
  savedVoicePreset: "signature",
  templateId: "editorial_wide",
  styleChoice: "balanced",
  paletteOverride: null,
  accentHex: null,
  fontPairId: null,
  verbatiStyle: {
    familyId: "workshop",
    layout: "workshop",
    typography: "doto-code",
    palette: "sauge",
  },
  sourceMode: "proposal_local",
} as const;

let mockCurrentProposalSettings: typeof defaultCurrentProposalSettings =
  defaultCurrentProposalSettings;
let mockProposalPresets = {
  preset1: null,
  preset2: {
    fontPairId: "quiet-editorial",
    styleChoice: "balanced",
    paletteOverride: "cobalt",
    accentHex: null,
    voicePreset: null,
    signatureSettings: null,
    name: "Style 2",
    verbatiStyle: {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "cobalt",
      resumeTemplateId: "workshop_resume_twocol_ats",
    },
  },
  preset3: null,
  activeSlot: 2,
};

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (query: string) => {
    if (query === "proposalSettings.getCurrent") {
      return mockCurrentProposalSettings;
    }
    if (query === "proposalSettings.getPresets") {
      return mockProposalPresets;
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
    proposalSettings: {
      getCurrent: "proposalSettings.getCurrent",
      getPresets: "proposalSettings.getPresets",
    },
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
  getActiveLocalPersonalizationSource: () => ({
    title: null,
    personalizationContext: null,
  }),
  getLocalPersonalizationSourceByCvId: () => ({
    title: null,
    personalizationContext: null,
  }),
  getLocalActiveCvSnapshotById: () => null,
  getLocalCvDocumentById: () => null,
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
  getProposalAttachedCvId: () => null,
  getProposalAttachedCvLocalDocument: () => null,
  listLocalCvPickerOptions: () => [],
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: () => <div>Proposal input</div>,
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: () => <div>Compose toolbar</div>,
}));

vi.mock("../../components/EmbeddedStyleInspector", () => ({
  default: () => <div>Style inspector</div>,
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    stylePreset,
    templateId,
  }: {
    stylePreset?: {
      layout?: string | null;
      typography?: string | null;
      palette?: string | null;
    } | null;
    templateId?: string | null;
  }) => (
    <div data-testid="proposal-settings-style">
      {stylePreset?.layout ?? "none"}|{stylePreset?.typography ?? "none"}|
      {stylePreset?.palette ?? "none"}|{templateId ?? "none"}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge settings style round-trip", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockCurrentProposalSettings = defaultCurrentProposalSettings;
    mockProposalPresets = {
      preset1: null,
      preset2: {
        fontPairId: "quiet-editorial",
        styleChoice: "balanced",
        paletteOverride: "cobalt",
        accentHex: null,
        voicePreset: null,
        signatureSettings: null,
        name: "Style 2",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "cobalt",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      },
      preset3: null,
      activeSlot: 2,
    };
  });

  it("keeps workshop proposal settings stable across reloads", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|quiet-editorial|cobalt|workshop_proposal_margin",
      );
    });

    unmount();

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|quiet-editorial|cobalt|workshop_proposal_margin",
      );
    });
  });

  it("lets Settings style win over an empty stale local output draft when no CV is attached", async () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: {
          layout: "workshop",
          typography: "geist-baskervville",
          palette: "terre",
        },
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "balanced",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "",
        proposalDocumentMeta: "",
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

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|quiet-editorial|cobalt|workshop_proposal_margin",
      );
    });
  });

  it("applies a Templates cover-letter template query intent", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal?templateId=direct"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|quiet-editorial|cobalt|workshop_proposal_margin",
      );
    });
  });

  it.each([
    ["minimal", "workshop|geist-baskervville|ink|workshop_proposal_margin"],
    ["direct", "workshop|quiet-editorial|cobalt|workshop_proposal_margin"],
    ["editorial", "workshop|ledger-sans|ink|workshop_proposal_margin"],
  ] as const)(
    "skips style onboarding from Templates and applies %s",
    async (templateId, expectedStyle) => {
      render(
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/proposal",
              search: `?templateId=${templateId}`,
              state: createProposalWorkspaceResetState(),
            },
          ]}
        >
          <ProposalForge />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
          expectedStyle,
        );
      });
      expect(
        screen.queryByRole("heading", { name: "Pick a starting style." }),
      ).toBeNull();
      expect(screen.queryByTestId("cover-letter-start-surface")).toBeNull();
      expect(screen.queryByText("Bring in the job")).toBeNull();
      expect(screen.queryByText("Bring in your resume")).toBeNull();
    },
  );

  it("keeps a direct canonical template id after a Templates workspace reset", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/proposal",
            search: "?templateId=modernist_signal&templateStart=1",
            state: createProposalWorkspaceResetState(),
          },
        ]}
      >
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "modernist_signal",
      );
    });
    expect(
      await screen.findByText("Load a job to tailor this letter."),
    ).toBeInTheDocument();
  });

  it("shows a job-context empty state for Templates-driven proposal starts", async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/proposal",
            search: "?templateId=direct",
            state: createProposalWorkspaceResetState(),
          },
        ]}
      >
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Load a job to tailor this letter."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use saved job" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Job boards" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open job sites" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Paste job URL" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Start blank" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Pick a starting style." }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Job boards" }));
    expect(await screen.findByRole("menuitem", { name: "LinkedIn" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Indeed" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Upwork" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "ZipRecruiter" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "HelloWork" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "LinkedIn" }));
    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://www.linkedin.com/jobs/",
      "_blank",
      "noopener,noreferrer",
    );
    windowOpenSpy.mockRestore();
  });

  it("keeps the Templates-selected style when starting blank", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/proposal",
            search: "?templateId=editorial",
            state: createProposalWorkspaceResetState(),
          },
        ]}
      >
        <ProposalForge />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Start blank" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|ledger-sans|ink|workshop_proposal_margin",
      );
    });
    expect(screen.queryByText("Load a job to tailor this letter.")).toBeNull();
    expect(screen.queryByTestId("cover-letter-start-surface")).toBeNull();
  });

  it("resets proposal Style 2 to the Settings slot color", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Style 2" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|quiet-editorial|cobalt|workshop_proposal_margin",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Use Sage accent" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|quiet-editorial|sauge|workshop_proposal_margin",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset Style 2" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|quiet-editorial|cobalt|workshop_proposal_margin",
      );
    });
  });

  it("reselects a custom selected Style 2 from latest Settings instead of preserving stale Sage", async () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Draft body",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: "workshop_proposal_margin",
        proposalVerbatiStyle: {
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        },
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "balanced",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Draft",
        proposalDocumentMeta: "",
        generatedProposalId: "draft-1",
        proposalOutputMode: "preview",
        paletteOverride: "sauge",
        customAccentHex: null,
        templateBundleId: "magazine_editorial",
        typographyOverride: null,
        layoutOverride: null,
        verbatiStyleSlotId: 2,
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

    fireEvent.click(screen.getByRole("button", { name: "Design" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Customized")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Style 2" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|quiet-editorial|cobalt|workshop_proposal_margin",
      );
    });
    expect(screen.queryByLabelText("Customized")).not.toBeInTheDocument();
  });

  it("does not let partial Settings Style 3 fall through to Sage when selecting Style 3", async () => {
    mockProposalPresets = {
      preset1: null,
      preset2: null,
      preset3: {
        fontPairId: "ledger-sans",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: null,
        voicePreset: null,
        signatureSettings: null,
        name: "Style 3",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "ledger-sans",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      },
      activeSlot: 3,
    };
    mockCurrentProposalSettings = {
      ...defaultCurrentProposalSettings,
      paletteOverride: null,
      verbatiStyle: {
        familyId: "workshop",
        layout: "workshop",
        typography: "ledger-sans",
        palette: "sauge",
      },
    };

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Style 3" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|ledger-sans|ink|workshop_proposal_margin",
      );
    });
    expect(screen.getByTestId("proposal-settings-style")).not.toHaveTextContent(
      "sauge",
    );
  });

  it("uses Settings slot typography when switching proposal Style 2", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Style 2" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-settings-style")).toHaveTextContent(
        "workshop|quiet-editorial|cobalt|workshop_proposal_margin",
      );
    });
    expect(screen.getByTestId("proposal-settings-style")).not.toHaveTextContent(
      "engaging",
    );
  });
});
