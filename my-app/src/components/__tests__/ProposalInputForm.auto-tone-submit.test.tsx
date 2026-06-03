import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("submits successfully with Auto selected on the real form path", async () => {
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

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          voicePreset: null,
          characterLimitMode: "none",
          characterLimitValue: 1500,
        }),
      );
    });

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
