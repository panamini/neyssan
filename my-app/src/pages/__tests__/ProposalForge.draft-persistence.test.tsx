import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import {
  PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
  readStoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";
import {
  PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
} from "../../lib/proposal-workspace-state";
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
    initialComposeDraft,
  }: {
    onSubmit?: (
      values: any,
      proposalContent: string,
      fallbackInfo?: any,
      proposalId?: string,
    ) => void;
    onValuesChange?: (values: any) => void;
    initialComposeDraft?: {
      jobTitle?: string;
      jobDescription?: string;
    } | null;
  }) => {
    const navigate = useNavigate();
    const storedDraft = (initialComposeDraft ??
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      )) as {
      jobTitle?: string;
      jobDescription?: string;
    };

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

  it("restores the generated draft after leaving the proposal workspace immediately", () => {
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
      screen.getByRole("button", { name: "Generate and go to resume" }),
    );

    expect(screen.getByRole("button", { name: "Back to proposal" })).toBeInTheDocument();
    expect(readStoredProposalOutputDraft()?.proposalContent).toBe(
      "Freshly generated proposal body.",
    );
    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({
      jobTitle: "Operations Associate",
      jobDescription: "Support recurring processes and coordinate communication.",
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to proposal" }));

    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Freshly generated proposal body.|preview",
    );
    expect(screen.getByTestId("compose-job-title")).toHaveTextContent(
      "Operations Associate",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "Support recurring processes and coordinate communication.",
    );
    expect(window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY)).toBe(
      "cv_alpha",
    );
    expect(window.localStorage.getItem("cvActiveId")).toBe("cv_beta");
  });

  it("restores stored compose input and editable workspace state on plain proposal re-entry", () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Staff Product Designer",
        jobDescription: "Shape product direction with engineering and research.",
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
      "Staff Product Designer",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "Shape product direction with engineering and research.",
    );
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Saved editable proposal.|edit",
    );
  });

  it("prefers the generated output source brief over later unsent compose edits on plain proposal re-entry", () => {
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
      "UI / UX Artist For Game Development",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "Design tactile game interfaces, polish interaction details, and support gameplay presentation.",
    );
    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({
      jobTitle: "UI / UX Artist For Game Development",
      jobDescription:
        "Design tactile game interfaces, polish interaction details, and support gameplay presentation.",
    });
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Generated proposal body.|preview",
    );
  });

  it("restores the generated brief from the session output fallback when localStorage is full", () => {
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
      "Social Media Marketing Intern",
    );
    expect(screen.getByTestId("compose-job-description")).toHaveTextContent(
      "Plan content calendars, support paid social reporting, and coordinate creative handoffs.",
    );
    expect(
      JSON.parse(
        window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({
      jobTitle: "Social Media Marketing Intern",
      jobDescription:
        "Plan content calendars, support paid social reporting, and coordinate creative handoffs.",
    });
    expect(screen.getByTestId("proposal-display-state")).toHaveTextContent(
      "Generated proposal body.|preview",
    );
  });
});
