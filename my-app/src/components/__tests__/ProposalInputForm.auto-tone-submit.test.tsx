import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProposalInputForm from "../ProposalInputForm";

const {
  mockGenerateProposalAction,
  mockSetCurrentVoicePreset,
  mockUpdateGeneratedProposal,
  mockRequestProposalGenerationCancel,
  mockSetSharedActiveCvSnapshot,
} = vi.hoisted(() => ({
  mockGenerateProposalAction: vi.fn(),
  mockSetCurrentVoicePreset: vi.fn(),
  mockUpdateGeneratedProposal: vi.fn(),
  mockRequestProposalGenerationCancel: vi.fn(),
  mockSetSharedActiveCvSnapshot: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useAction: () => mockGenerateProposalAction,
  useMutation: (reference: string) => {
    if (reference === "proposalSettings.setCurrent") {
      return mockSetCurrentVoicePreset;
    }
    if (reference === "updateProposalPublic.default") {
      return mockUpdateGeneratedProposal;
    }
    if (reference === "jobs.requestProposalGenerationCancel") {
      return mockRequestProposalGenerationCancel;
    }
    if (reference === "activeCvSnapshots.setCurrent") {
      return mockSetSharedActiveCvSnapshot;
    }
    return vi.fn();
  },
  useQuery: () => null,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    jobs: {
      requestProposalGenerationCancel: "jobs.requestProposalGenerationCancel",
    },
    activeCvSnapshots: { setCurrent: "activeCvSnapshots.setCurrent" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    proposalSettings: {
      getCurrent: "proposalSettings.getCurrent",
      setCurrent: "proposalSettings.setCurrent",
    },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    loadCv: vi.fn(),
  }),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: (source: {
    personalizationContext?: Record<string, unknown> | null;
    richness?: string | null;
  }) => ({
    personalizationMode: "explicit_only",
    ...(source?.personalizationContext
      ? { personalizationContext: source.personalizationContext }
      : {}),
    ...(source?.richness ? { personalizationRichness: source.richness } : {}),
  }),
  clearActiveLocalCvId: vi.fn(),
  getActiveLocalPersonalizationSource: () => ({
    title: null,
    personalizationContext: null,
    richness: "none",
  }),
  getLocalPersonalizationSourceByCvId: (id: string | null | undefined) =>
    id === "cv_job_alpha"
      ? {
          title: "Operations Resume",
          personalizationContext: {
            name: "Alex Martin",
            desiredPosition: "Operations Associate",
            topSkills: ["Operations"],
          },
          richness: "rich",
        }
      : {
          title: null,
          personalizationContext: null,
          richness: "none",
        },
  getLocalActiveCvSnapshotById: () => null,
  listLocalCvPickerOptions: () => [],
  setActiveLocalCvId: vi.fn(),
}));

async function confirmNoCvGeneration() {
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Generate anyway",
    }),
  );
}

describe("ProposalInputForm auto tone submit", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGenerateProposalAction.mockReset();
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_auto",
      proposalContent: "Hello hiring team,\n\nI would love to contribute.",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });
    mockSetCurrentVoicePreset.mockReset();
    mockUpdateGeneratedProposal.mockReset();
    mockRequestProposalGenerationCancel.mockReset();
    mockSetSharedActiveCvSnapshot.mockReset();
    mockSetCurrentVoicePreset.mockResolvedValue(undefined);
    mockUpdateGeneratedProposal.mockResolvedValue(undefined);
    mockRequestProposalGenerationCancel.mockResolvedValue(undefined);
    mockSetSharedActiveCvSnapshot.mockResolvedValue(undefined);
  });

  it("soft-confirms a no-CV submit before using the existing generation path once", async () => {
    const handleSubmit = vi.fn();

    render(<ProposalInputForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("Job title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste job offer"),
      {
        target: {
          value:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
        },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    const confirmationDialog = await screen.findByRole("dialog", {
      name: "Generate without a resume?",
    });
    expect(confirmationDialog).toBeInTheDocument();
    expect(
      within(confirmationDialog).getByText(
        "You can still generate from the job description, but the result may be less personalized.",
      ),
    ).toBeInTheDocument();
    expect(
      within(confirmationDialog).getByRole("button", {
        name: "Choose resume",
      }),
    ).toBeInTheDocument();
    expect(mockGenerateProposalAction).not.toHaveBeenCalled();

    const generateAnywayButton = within(confirmationDialog).getByRole("button", {
      name: "Generate anyway",
    });
    fireEvent.click(generateAnywayButton);
    fireEvent.click(generateAnywayButton);

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          voicePreset: null,
          characterLimitMode: "none",
          characterLimitValue: 1500,
        }),
      );
    });
    expect(mockGenerateProposalAction).toHaveBeenCalledTimes(1);

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: "Operations Associate",
        voicePreset: undefined,
      }),
      "Hello hiring team,\n\nI would love to contribute.",
      expect.objectContaining({
        requestedModelType: "chatgpt",
        actualModelType: "chatgpt",
      }),
      "proposal_auto",
      expect.objectContaining({
        requestedLanguage: "auto",
        resolvedLanguage: "en",
      }),
    );
  });

  it("preserves the job draft when the no-CV confirmation is cancelled or changed to resume selection", async () => {
    render(<ProposalInputForm onSubmit={vi.fn()} />);

    const jobTitle = screen.getByPlaceholderText("Job title");
    const jobDescription = screen.getByPlaceholderText("Paste job offer");
    fireEvent.change(jobTitle, {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(jobDescription, {
      target: {
        value:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    const initialConfirmationDialog = await screen.findByRole("dialog", {
      name: "Generate without a resume?",
    });
    expect(initialConfirmationDialog).toBeInTheDocument();

    fireEvent.click(
      within(initialConfirmationDialog).getByRole("button", { name: "Close" }),
    );

    expect(jobTitle).toHaveValue("Operations Associate");
    expect(jobDescription).toHaveValue(
      "Support recurring processes, update internal records, and coordinate communication across teams.",
    );
    expect(mockGenerateProposalAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    const repeatedConfirmationDialog = await screen.findByRole("dialog", {
      name: "Generate without a resume?",
    });
    expect(
      screen.getAllByRole("dialog", {
        name: "Generate without a resume?",
      }),
    ).toHaveLength(1);
    fireEvent.click(
      within(repeatedConfirmationDialog).getByRole("button", {
        name: "Choose resume",
      }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Choose resume" }),
    ).toBeInTheDocument();
    expect(jobTitle).toHaveValue("Operations Associate");
    expect(jobDescription).toHaveValue(
      "Support recurring processes, update internal records, and coordinate communication across teams.",
    );
    expect(mockGenerateProposalAction).not.toHaveBeenCalled();
  });

  it("localizes the no-CV confirmation from the UI language", async () => {
    window.localStorage.setItem("twoweeks:ui-language", "fr");

    render(<ProposalInputForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Job title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste job offer"), {
      target: { value: "Coordinate recurring operations across teams." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    const confirmationDialog = await screen.findByRole("dialog", {
      name: "Générer sans CV ?",
    });
    expect(confirmationDialog).toHaveTextContent(
      "Vous pouvez quand même générer une lettre à partir de l'offre, mais le résultat sera peut-être moins personnalisé.",
    );
    expect(
      within(confirmationDialog).getByRole("button", {
        name: "Choisir un CV",
      }),
    ).toBeInTheDocument();
    expect(
      within(confirmationDialog).getByRole("button", {
        name: "Générer quand même",
      }),
    ).toBeInTheDocument();
  });

  it("uses the controlled job-scoped CV when building the generation request", async () => {
    const handleSubmit = vi.fn();
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_auto",
      proposalContent:
        "Dear Hiring Manager,\n\nI would love to contribute.\n\nKind regards,",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });

    render(
      <ProposalInputForm
        onSubmit={handleSubmit}
        canonicalJobId="job_alpha"
        targetEmployerName="Acme Corp."
        activeCvId="cv_job_alpha"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Job title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste job offer"),
      {
        target: {
          value:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
        },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: "job_alpha",
          targetEmployerName: "Acme Corp.",
          personalizationContext: expect.objectContaining({
            desiredPosition: "Operations Associate",
          }),
        }),
      );
    });
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.anything(),
      "Dear Hiring Manager,\n\nI would love to contribute.\n\nKind regards,\n\nalex martin",
      expect.anything(),
      "proposal_auto",
      expect.anything(),
    );
    expect(mockUpdateGeneratedProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "proposal_auto",
        content:
          "Dear Hiring Manager,\n\nI would love to contribute.\n\nKind regards,\n\nalex martin",
        sections: [
          {
            type: "text",
            content:
              "Dear Hiring Manager,\n\nI would love to contribute.\n\nKind regards,\n\nalex martin",
          },
        ],
      }),
    );
  });

  it("clears a bound employer when edited job text is submitted before parent sync", async () => {
    const sourceDraft = {
      jobTitle: "Operations Associate",
      jobDescription:
        "Support Acme operations, update internal records, and coordinate communication across teams.",
      proposalType: "cover_letter" as const,
    };

    render(
      <ProposalInputForm
        onSubmit={vi.fn()}
        externalComposeDraft={sourceDraft}
        targetEmployerName="Acme Corp."
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Paste job offer")).toHaveValue(
        sourceDraft.jobDescription,
      );
    });
    fireEvent.change(screen.getByPlaceholderText("Paste job offer"), {
      target: {
        value:
          "Support replacement operations, publish new records, and coordinate a different team.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await confirmNoCvGeneration();

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({ targetEmployerName: null }),
      );
    });
  });

  it("uses an explicit personalization source override when the local CV lookup is empty", async () => {
    render(
      <ProposalInputForm
        activeCvId="cv_remote_summary_only"
        personalizationSourceOverride={{
          title: "Remote Security CV",
          personalizationContext: {
            name: "Robert Cooper",
            desiredPosition: "Security Officer",
            topSkills: ["Access control", "Incident reporting"],
            recentExperience: [
              {
                company: "ADT Security",
                position: "Security Guard",
                highlights: ["Maintained patrol logs across assigned shifts."],
              },
            ],
          },
          richness: "rich",
        }}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Job title"), {
      target: { value: "High Level Security Officer" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste job offer"),
      {
        target: {
          value:
            "Maintain site safety through structured patrols, access control, incident response, and clear reporting.",
        },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          personalizationMode: "explicit_only",
          personalizationRichness: "rich",
          personalizationContext: expect.objectContaining({
            name: "Robert Cooper",
            desiredPosition: "Security Officer",
            topSkills: ["Access control", "Incident reporting"],
          }),
        }),
      );
    });
  });

  it("generates from externally synced pasted job text without requiring blur", async () => {
    const handleSubmit = vi.fn();
    const pastedJobOffer =
      "Lead proposal operations, coordinate stakeholder inputs, and turn messy job requirements into polished client-facing application documents.";
    let generateControl: {
      trigger: () => void;
      disabled: boolean;
    } | null = null;

    const { rerender } = render(
      <ProposalInputForm
        onSubmit={handleSubmit}
        onGenerateControlChange={(control) => {
          generateControl = control;
        }}
      />,
    );

    expect(generateControl?.disabled).toBe(true);

    rerender(
      <ProposalInputForm
        onSubmit={handleSubmit}
        externalComposeDraft={{
          jobTitle: "",
          jobDescription: pastedJobOffer,
          proposalType: "cover_letter",
        }}
        onGenerateControlChange={(control) => {
          generateControl = control;
        }}
      />,
    );

    await waitFor(() => {
      expect(generateControl?.disabled).toBe(false);
    });

    generateControl?.trigger();
    await confirmNoCvGeneration();

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          jobTitle: "",
          jobDescription: pastedJobOffer,
          proposalType: "cover_letter",
        }),
      );
    });
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: "",
        jobDescription: pastedJobOffer,
      }),
      "Hello hiring team,\n\nI would love to contribute.",
      expect.anything(),
      "proposal_auto",
      expect.anything(),
    );
  });

  it("keeps generate enabled when only the controlled CV changes", async () => {
    const pastedJobOffer =
      "Support store operations, help customers, organize merchandise, and communicate clearly with the team during each shift.";
    let generateControl: {
      trigger: () => void;
      disabled: boolean;
    } | null = null;
    const onGenerateControlChange = vi.fn((control) => {
      generateControl = control;
    });

    const { rerender } = render(
      <ProposalInputForm
        onSubmit={vi.fn()}
        activeCvId="cv_initial"
        externalComposeDraft={{
          jobTitle: "Retail Key Holder",
          jobDescription: pastedJobOffer,
          proposalType: "cover_letter",
        }}
        onGenerateControlChange={onGenerateControlChange}
      />,
    );

    await waitFor(() => {
      expect(generateControl?.disabled).toBe(false);
    });

    rerender(
      <ProposalInputForm
        onSubmit={vi.fn()}
        activeCvId="cv_job_alpha"
        externalComposeDraft={{
          jobTitle: "Retail Key Holder",
          jobDescription: pastedJobOffer,
          proposalType: "cover_letter",
        }}
        onGenerateControlChange={onGenerateControlChange}
      />,
    );

    await waitFor(() => {
      expect(generateControl?.disabled).toBe(false);
    });
  });

  it("keeps the external generate control trigger stable across neutral rerenders", async () => {
    const handleSubmit = vi.fn();
    let generateControl: {
      trigger: () => void;
      disabled: boolean;
    } | null = null;
    const onGenerateControlChange = vi.fn((control) => {
      generateControl = control;
    });
    const props = {
      onSubmit: handleSubmit,
      onGenerateControlChange,
    };
    const { rerender } = render(<ProposalInputForm {...props} />);

    await waitFor(() => {
      expect(generateControl).not.toBeNull();
    });
    const initialTrigger = generateControl?.trigger;

    fireEvent.change(screen.getByPlaceholderText("Paste job offer"), {
      target: {
        value:
          "Coordinate airport security patrols, customer support, access checks, reporting, and clear communication across a busy public site.",
      },
    });

    await waitFor(() => {
      expect(generateControl?.disabled).toBe(false);
    });
    expect(generateControl?.trigger).toBe(initialTrigger);

    const callsAfterEnabled = onGenerateControlChange.mock.calls.length;
    rerender(<ProposalInputForm {...props} />);

    await waitFor(() => {
      expect(onGenerateControlChange).toHaveBeenCalledTimes(callsAfterEnabled);
    });
    expect(generateControl?.trigger).toBe(initialTrigger);
  });

  it("sends explicit document language independently from UI language and job language", async () => {
    window.localStorage.setItem("twoweeks:ui-language", "en");
    window.localStorage.setItem("twoweeks:document-language", "fr");

    render(<ProposalInputForm onSubmit={vi.fn()} jobSourceLanguage="de" />);

    fireEvent.change(screen.getByPlaceholderText("Job title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste job offer"), {
      target: {
        value:
          "We are looking for an operations associate with strong team skills and clear communication.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await confirmNoCvGeneration();

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedLanguage: "fr",
          resolvedLanguage: "fr",
          languageSource: "document-preference",
          jobDetectedLanguage: "de",
        }),
      );
    });
  });

  it("resolves Auto document language from stored job source language before text detection", async () => {
    window.localStorage.setItem("twoweeks:ui-language", "en");
    window.localStorage.setItem("twoweeks:document-language", "auto");

    render(<ProposalInputForm onSubmit={vi.fn()} jobSourceLanguage="fr" />);

    fireEvent.change(screen.getByPlaceholderText("Job title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste job offer"), {
      target: {
        value:
          "We are looking for an operations associate with strong team skills and clear communication.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await confirmNoCvGeneration();

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedLanguage: "auto",
          resolvedLanguage: "fr",
          languageSource: "job-detected",
          jobDetectedLanguage: "fr",
        }),
      );
    });
  });

  it("resolves Auto document language from German job text before UI fallback", async () => {
    window.localStorage.setItem("twoweeks:ui-language", "en");
    window.localStorage.setItem("twoweeks:document-language", "auto");

    render(<ProposalInputForm onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Job title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste job offer"), {
      target: {
        value:
          "Wir suchen Verstärkung für unser Team. Aufgaben und Kenntnisse im Vertrieb sind wichtig.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await confirmNoCvGeneration();

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedLanguage: "auto",
          resolvedLanguage: "de",
          languageSource: "job-detected",
          jobDetectedLanguage: "de",
        }),
      );
    });
  });
});
