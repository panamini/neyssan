import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { ProposalForgeNext } from "../ProposalForgeNext";
import {
  readStoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";
import {
  PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
  PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
} from "../../lib/proposal-workspace-state";

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
    currentCv: null,
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
  }: {
    onSubmit?: (
      values: any,
      proposalContent: string,
      fallbackInfo?: any,
      proposalId?: string,
    ) => void;
    onValuesChange?: (values: any) => void;
  }) => {
    const navigate = useNavigate();
    const storedDraft = JSON.parse(
      window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY) ?? "{}",
    ) as {
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
            window.localStorage.setItem(
              PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
              JSON.stringify({
                jobTitle: values.jobTitle,
                jobDescription: values.jobDescription,
                proposalType: values.proposalType,
                voicePreset: values.voicePreset,
                characterLimitMode: values.characterLimitMode,
                characterLimitValue: values.characterLimitValue,
              }),
            );
            window.dispatchEvent(new Event(PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT));
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

describe("ProposalForgeNext draft persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores the generated draft after leaving the proposal workspace immediately", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <Routes>
          <Route path="/proposal" element={<ProposalForgeNext />} />
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
        <ProposalForgeNext />
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
});
