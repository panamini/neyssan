import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import {
  PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
  readStoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";
import { PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY } from "../../lib/proposal-workspace-state";
import { PROPOSAL_ATTACHED_CV_STORAGE_KEY } from "../../lib/proposal-personalization";

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
  default: ({
    onSubmit,
    onValuesChange,
    onGenerateControlChange,
    initialComposeDraft,
    externalComposeDraft,
  }: {
    onSubmit?: (
      values: any,
      proposalContent: string,
      fallbackInfo?: any,
      proposalId?: string,
    ) => void;
    onValuesChange?: (values: any) => void;
    onGenerateControlChange?: (control: any) => void;
    initialComposeDraft?: {
      jobTitle?: string;
      jobDescription?: string;
    } | null;
    externalComposeDraft?: {
      jobTitle?: string;
      jobDescription?: string;
    } | null;
  }) => {
    const navigate = useNavigate();
    const storedDraft = (externalComposeDraft ??
      initialComposeDraft ??
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      )) as {
      jobTitle?: string;
      jobDescription?: string;
    };
    const canGenerate = (storedDraft.jobDescription ?? "").trim().length >= 10;

    React.useEffect(() => {
      onGenerateControlChange?.({
        trigger: () => {},
        label: "Generate",
        disabled: !canGenerate,
        state: "idle",
      });
      return () => onGenerateControlChange?.(null);
    }, [canGenerate, onGenerateControlChange]);

    return (
      <div>
        <div data-testid="compose-job-title">
          {storedDraft.jobTitle ?? "empty-title"}
        </div>
        <div data-testid="compose-job-description">
          {storedDraft.jobDescription ?? "empty-description"}
        </div>
        <button
          type="button"
          onClick={() => {
            const values = {
              jobTitle: "Operations Associate",
              jobDescription:
                "Support recurring processes and coordinate communication.",
              proposalType: "cover_letter",
              voicePreset: "signature",
              formalityLevel: undefined,
              creativity: undefined,
              toneTuning: null,
              characterLimitMode: "none",
              characterLimitValue: null,
              modelType: "chatgpt",
            };
            onValuesChange?.(values);
            onSubmit?.(
              values,
              "Freshly generated proposal body.",
              undefined,
              "proposal_new",
            );
            navigate("/cv");
          }}
        >
          Generate and go to resume
        </button>
      </div>
    );
  },
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    proposalContent,
    mode,
  }: {
    proposalContent: string | null;
    mode?: "preview" | "edit";
  }) => (
    <div data-testid="proposal-display-state">
      {proposalContent ?? "empty"}|{mode ?? "preview"}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

function MockResumePage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate("/proposal")}>
      Back to proposal
    </button>
  );
}

describe("ProposalForge draft persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("syncs pasted rail job offer text into the compose draft before blur", async () => {
    const pastedJobOffer =
      "Own proposal operations, coordinate client requirements, and prepare application documents from raw job briefs.";

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const railJobOfferInput = screen.getByPlaceholderText(
      "Paste your job offer here",
    );
    expect(railJobOfferInput).toBeInTheDocument();
    expect(screen.getByText("No job loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();

    const jobSites = screen.getByLabelText("Job sites");
    expect(
      within(jobSites)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["LinkedIn", "Indeed", "Upwork", "ZipRecruiter", "Hellowork"]);

    fireEvent.change(railJobOfferInput, {
      target: { value: pastedJobOffer },
    });

    await waitFor(() => {
      expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
        pastedJobOffer,
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate" })).not.toBeDisabled();
    });
    expect(screen.getByText("Untitled job offer")).toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({
      jobTitle: "",
      jobDescription: pastedJobOffer,
    });
  });

  it("clears active pasted job context and disables generation", async () => {
    const pastedJobOffer =
      "Own proposal operations, coordinate client requirements, and prepare application documents from raw job briefs.";

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Paste your job offer here"), {
      target: { value: pastedJobOffer },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Clear job context" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear job context" }));

    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "empty-description",
    );
    expect(screen.getByText("No job loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toEqual({});
  });

  it("starts a truly fresh Workshop workspace when New proposal is clicked", async () => {
    window.localStorage.setItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY, "cv_alpha");
    writeStoredProposalOutputDraft({
      proposalContent: "Prior generated proposal.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "swiss_margin",
      proposalVerbatiStyle: {
        familyId: "swiss",
        layout: "swiss",
        typography: "signature",
        palette: "sauge",
      },
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Prior proposal",
      proposalDocumentMeta: "Cover letter",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: "swiss_serif",
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: true,
      characterLimitMode: null,
      characterLimitValue: null,
      sourceComposeDraft: {
        jobTitle: "Prior role",
        jobDescription: "Prior job context should not survive.",
      },
    });

    render(
      <MemoryRouter initialEntries={["/proposal?draftId=proposal_live"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Prior role").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "New proposal" }));

    await waitFor(() => {
      expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
        "empty-description",
      );
    });
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "|edit",
    );
    expect(screen.getByText("No job loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(readStoredProposalOutputDraft()).toMatchObject({
      generatedProposalId: null,
      proposalContent: "",
      proposalOutputMode: "edit",
      proposalType: "cover_letter",
      proposalStyleLinkMode: "proposal_local",
      proposalTemplateId: "workshop_proposal_margin",
      proposalVerbatiStyle: expect.objectContaining({
        familyId: "workshop",
        layout: "workshop",
      }),
      sourceComposeDraft: null,
      templateBundleId: null,
    });
    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toEqual({});
    expect(window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY)).toBeNull();
  });

  it("restores generated output without restoring its source as active job context", () => {
    window.localStorage.setItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY, "cv_alpha");
    window.localStorage.setItem("cvActiveId", "cv_beta");

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <Routes>
          <Route path="/proposal" element={<ProposalForge />} />
          <Route path="/cv" element={<MockResumePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Generate and go to resume",
        hidden: true,
      }),
    );

    expect(
      screen.getByRole("button", { name: "Back to proposal" }),
    ).toBeInTheDocument();
    expect(readStoredProposalOutputDraft()?.proposalContent).toBe(
      "Freshly generated proposal body.",
    );
    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes and coordinate communication.",
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to proposal" }));

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Freshly generated proposal body.|preview",
    );
    expect(screen.getByTestId("compose-job-title")).toHaveTextContent(
      "empty-title",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "empty-description",
    );
    expect(screen.getByText("No job loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY)).toBe(
      "cv_alpha",
    );
    expect(window.localStorage.getItem("cvActiveId")).toBe("cv_beta");
  });

  it("ignores stale stored compose and output drafts on plain proposal re-entry", () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Staff Product Designer",
        jobDescription:
          "Shape product direction with engineering and research.",
        proposalType: "cover_letter",
        voicePreset: "expert",
        characterLimitMode: "none",
        characterLimitValue: null,
      }),
    );
    writeStoredProposalOutputDraft({
      proposalContent: "Saved editable proposal.",
      proposalType: "cover_letter",
      proposalVoicePreset: "expert",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Product Designer",
      proposalDocumentTitle: "Saved proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: null,
      proposalOutputMode: "edit",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: true,
      characterLimitMode: null,
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("compose-job-title")).toHaveTextContent(
      "empty-title",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "empty-description",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Saved editable proposal.|edit",
    );
    expect(screen.getByText("No job loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("recovers output appearance without restoring stale job context on plain proposal re-entry", async () => {
    writeStoredProposalOutputDraft({
      proposalContent: "Saved slot-only proposal.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Product Designer",
      proposalDocumentTitle: "Saved slot-only proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: null,
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      verbatiStyleSlotId: 2,
      verbatiStyleSlotSource: "settings",
      verbatiStyleSlotNameSnapshot: "Style 2",
      verbatiStyleBaseSnapshot: {
        familyId: "workshop",
        layout: "workshop",
        typography: "soft-serif",
        palette: "cobalt",
      },
      documentStyleVersion: 1,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: true,
      characterLimitMode: null,
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Design" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Style 2" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    fireEvent.click(screen.getByRole("tab", { name: "Draft" }));
    expect(screen.getByText("No job loaded")).toBeInTheDocument();
  });

  it("ignores stale output source brief on plain proposal re-entry", () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "UI / UX Artist For Game Development",
        jobDescription: "fhtfhttfhtfhtfhttfhtfhtfhtqdss",
        proposalType: "cover_letter",
        voicePreset: "engaging",
        characterLimitMode: "custom",
        characterLimitValue: 1500,
      }),
    );
    writeStoredProposalOutputDraft({
      proposalContent: "Generated proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "engaging",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "warm",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "UI / UX Artist",
      proposalDocumentTitle: "UI / UX Artist For Game Development",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: "custom",
      characterLimitValue: 1500,
      sourceComposeDraft: {
        jobTitle: "UI / UX Artist For Game Development",
        jobDescription:
          "Design tactile game interfaces, polish interaction details, and support gameplay presentation.",
        proposalType: "cover_letter",
        voicePreset: "engaging",
        toneTuning: null,
        characterLimitMode: "custom",
        characterLimitValue: 1500,
      },
    });

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("compose-job-title")).toHaveTextContent(
      "empty-title",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "empty-description",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Generated proposal body.|preview",
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("ignores stale session output source brief on plain proposal re-entry", () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Social Media Marketing Intern",
        jobDescription: "fhtfhttfhtfhtfhttfhtfhtfhtqdss",
        proposalType: "cover_letter",
        voicePreset: "engaging",
        characterLimitMode: "custom",
        characterLimitValue: 1500,
      }),
    );
    window.sessionStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Generated proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "engaging",
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "warm",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Content Designer",
        proposalDocumentTitle: "Social Media Marketing Intern",
        proposalDocumentMeta: "Compose output",
        generatedProposalId: "proposal_live",
        proposalOutputMode: "preview",
        proposalDocumentTitleManual: false,
        characterLimitMode: "custom",
        characterLimitValue: 1500,
        sourceComposeDraft: {
          jobTitle: "Social Media Marketing Intern",
          jobDescription:
            "Plan content calendars, support paid social reporting, and coordinate creative handoffs.",
          proposalType: "cover_letter",
          voicePreset: "engaging",
          toneTuning: null,
          characterLimitMode: "custom",
          characterLimitValue: 1500,
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("compose-job-title")).toHaveTextContent(
      "empty-title",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "empty-description",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Generated proposal body.|preview",
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });
});
