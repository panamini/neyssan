import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProposalInputForm from "../ProposalInputForm";

const {
  mockGenerateProposalAction,
  mockMutation,
  mockMutationHookFn,
  mockQuery,
  mockGetActiveLocalPersonalizationSource,
  mockBuildAppProposalPersonalizationPayload,
  mockGeneratedApiModule,
} = vi.hoisted(() => ({
  mockGenerateProposalAction: vi.fn(),
  mockMutation: vi.fn(),
  mockMutationHookFn: Object.assign((...args: any[]) => mockMutation(...args), {
    withOptimisticUpdate: () => {},
  }),
  mockQuery: vi.fn(),
  mockGetActiveLocalPersonalizationSource: vi.fn(),
  mockBuildAppProposalPersonalizationPayload: vi.fn(),
  mockGeneratedApiModule: {
    api: {
      functions: { generateProposal: "generateProposalAction" },
      activeCvSnapshots: { setCurrent: "activeCvSnapshots.setCurrent" },
      updateProposalPublic: { default: "updateProposalPublic.default" },
      proposalSettings: {
        getCurrent: "proposalSettings.getCurrent",
        setCurrent: "proposalSettings.setCurrent",
      },
    },
  },
}));

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => undefined,
}));

vi.mock("clsx", () => ({
  default: (...values: Array<string | undefined | false | null>) =>
    values.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  ArrowUp: () => <span>ArrowUp</span>,
  Loader2: () => <span>Loader2</span>,
  Laugh: () => <span>Laugh</span>,
  Smile: () => <span>Smile</span>,
  SmilePlus: () => <span>SmilePlus</span>,
}));

vi.mock("react-hook-form", () => {
  return {
    useForm: ({ defaultValues }: any) => {
      const [values, setValues] = React.useState(defaultValues);
      const [dirtyFields, setDirtyFields] = React.useState<
        Record<string, boolean>
      >({});

      const setValue = (
        name: string,
        value: unknown,
        options?: { shouldDirty?: boolean },
      ) => {
        setValues((current: Record<string, unknown>) => ({
          ...current,
          [name]: value,
        }));
        if (options?.shouldDirty === false) {
          return;
        }
        setDirtyFields((current) => ({
          ...current,
          [name]: true,
        }));
      };

      return {
        register: (name: string) => ({
          name,
          value: values[name] ?? "",
          onChange: (event: { target?: { value?: unknown } }) => {
            const nextValue = event?.target?.value ?? "";
            setValues((current: Record<string, unknown>) => ({
              ...current,
              [name]: nextValue,
            }));
            setDirtyFields((current) => ({
              ...current,
              [name]: true,
            }));
          },
          onBlur: () => {},
          ref: () => {},
        }),
        watch: (name?: string | ((values: Record<string, unknown>) => void)) => {
          if (typeof name === "function") {
            name(values);
            return {
              unsubscribe: () => {},
            };
          }

          return name ? values[name] ?? "" : values;
        },
        setValue,
        getValues: (name?: string) => (name ? values[name] : values),
        handleSubmit:
          (callback: (values: Record<string, unknown>) => unknown) =>
          async (event?: { preventDefault?: () => void }) => {
            event?.preventDefault?.();
            await callback(values);
          },
        formState: {
          errors: {},
          isDirty: Object.keys(dirtyFields).length > 0,
          dirtyFields,
        },
      };
    },
  };
});

vi.mock("../ProposalInputForm.schemas", () => ({
  formSchema: {},
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useAction: () => mockGenerateProposalAction,
  useMutation: () => mockMutationHookFn,
  useQuery: (...args: any[]) => mockQuery(...args),
}));

vi.mock("../../../convex/_generated/api", () => mockGeneratedApiModule);
vi.mock("../../../convex/_generated/api.js", () => mockGeneratedApiModule);
vi.mock("convex/server", () => {
  return {
    anyApi: mockGeneratedApiModule.api,
    componentsGeneric: () => ({}),
  };
});

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: (...args: any[]) =>
    mockBuildAppProposalPersonalizationPayload(...args),
  clearActiveLocalCvId: vi.fn(),
  getActiveLocalPersonalizationSource: () =>
    mockGetActiveLocalPersonalizationSource(),
  getLocalActiveCvSnapshotById: vi.fn(() => null),
  listLocalCvPickerOptions: vi.fn(() => []),
  setActiveLocalCvId: vi.fn(),
}));

vi.mock("../../../convex/lib/proposals/voicePresets", () => {
  const definitions = [
    {
      id: "signature",
      label: "Signature",
      description: "Balanced",
      formalityLevel: "neutral",
      creativity: "medium",
      guidance: "",
    },
    {
      id: "expert",
      label: "Expert",
      description: "Precise",
      formalityLevel: "formal",
      creativity: "low",
      guidance: "",
    },
    {
      id: "direct",
      label: "Direct",
      description: "Concise",
      formalityLevel: "neutral",
      creativity: "low",
      guidance: "",
    },
    {
      id: "engaging",
      label: "Engaging",
      description: "Warm",
      formalityLevel: "neutral",
      creativity: "medium",
      guidance: "",
    },
    {
      id: "storyteller",
      label: "Storyteller",
      description: "Narrative",
      formalityLevel: "neutral",
      creativity: "medium",
      guidance: "",
    },
  ] as const;

  const premiumCoverLetterPresetIds = [
    "signature",
    "expert",
    "engaging",
  ] as const;
  const chatgptFreelancePresetIds = [
    "signature",
    "expert",
    "engaging",
  ] as const;

  const getSupportedProposalVoicePresetIds = ({
    proposalType,
    modelType,
  }: {
    proposalType?: string | null;
    modelType?: string | null;
  }) => {
    if (proposalType === "application_message") {
      return premiumCoverLetterPresetIds;
    }

    if (proposalType === "cover_letter" && modelType === "chatgpt") {
      return premiumCoverLetterPresetIds;
    }

    if (proposalType === "freelance_proposal" && modelType === "chatgpt") {
      return chatgptFreelancePresetIds;
    }

    return definitions.map((definition) => definition.id);
  };

  const isProposalVoicePresetSupportedForMode = ({
    preset,
    proposalType,
    modelType,
  }: {
    preset: (typeof definitions)[number]["id"];
    proposalType?: string | null;
    modelType?: string | null;
  }) =>
    (
      getSupportedProposalVoicePresetIds({
        proposalType,
        modelType,
      }) as readonly string[]
    ).includes(preset);

  return {
    DEFAULT_PROPOSAL_VOICE_PRESET: "signature",
    PROPOSAL_VOICE_PRESET_DEFINITIONS: definitions,
    getSupportedProposalVoicePresetIds,
    isProposalVoicePresetSupportedForMode,
    getProposalVoicePresetDefinition: (preset: string) =>
      definitions.find((definition) => definition.id === preset) ??
      definitions[0],
  };
});

vi.mock("../../lib/proposal-generation-ui", () => ({
  getProposalGenerationUiErrorMessage: ({ error }: { error: any }) =>
    error?.data?.code === "proposal_generation_provider_busy"
      ? "Proposal generation is temporarily busy because the model provider is rate limited. Please wait a moment and try again."
      : error?.data?.code === "proposal_generation_provider_transport_error"
        ? "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again."
        : "Failed to generate proposal. Please try again.",
}));

vi.mock("../CustomToggle", () => ({
  default: ({ options, value, onChange }: any) => (
    <div data-testid="custom-toggle">
      {options.map((option: any) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {typeof option.label === "string"
            ? option.label
            : String(option.value)}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../ProposalInputForm.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: () => "",
    },
  ),
}));

vi.mock("../ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("../ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogActions: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
}));

describe("ProposalInputForm provider-busy handling", () => {
  beforeEach(() => {
    mockGenerateProposalAction.mockReset();
    mockMutation.mockReset().mockResolvedValue(undefined);
    mockQuery.mockReset().mockReturnValue(undefined);
    mockGetActiveLocalPersonalizationSource.mockReset().mockReturnValue({
      title: null,
      personalizationContext: null,
    });
    mockBuildAppProposalPersonalizationPayload.mockReset().mockReturnValue({});
  });

  it("shows the friendly provider-busy message and unlocks the form for a no-CV legacy-generation rejection", async () => {
    const providerBusyError = Object.assign(
      new Error(
        '[CONVEX A(functions:generateProposal)] Server Error Uncaught ConvexError: {"code":"proposal_generation_provider_busy","message":"Proposal generation is temporarily busy because the model provider is rate limited.","provider":"mistral","stage":"legacy_generation"}',
      ),
      {
        data: {
          code: "proposal_generation_provider_busy",
          message:
            "Proposal generation is temporarily busy because the model provider is rate limited.",
          provider: "mistral",
          stage: "legacy_generation",
        },
      },
    );
    mockGenerateProposalAction.mockRejectedValue(providerBusyError);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const onSubmit = vi.fn();
    const onError = vi.fn();
    const { container } = render(
      <ProposalInputForm onSubmit={onSubmit} onError={onError} />,
    );

    const jobTitleInput = screen.getByPlaceholderText("Enter Job Title");
    const jobDescriptionInput = screen.getByPlaceholderText(
      "Paste the job description here…",
    );
    const submitButton = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;

    expect(screen.getByRole("button", { name: "Choose resume" })).toBeVisible();
    expect(submitButton).not.toBeNull();

    fireEvent.change(jobTitleInput, {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(jobDescriptionInput, {
      target: {
        value:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
      },
    });

    fireEvent.click(submitButton!);

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerateProposalAction).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalType: "cover_letter",
        modelType: "chatgpt",
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Proposal generation is temporarily busy because the model provider is rate limited. Please wait a moment and try again.",
      );
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      "Proposal generation is temporarily busy because the model provider is rate limited. Please wait a moment and try again.",
      expect.objectContaining({
        proposalType: "cover_letter",
        jobTitle: "Operations Associate",
      }),
      expect.stringContaining("proposal_generation_provider_busy"),
    );
    expect(mockBuildAppProposalPersonalizationPayload).toHaveBeenCalledWith({
      title: null,
      personalizationContext: null,
    });
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call.some((arg) => String(arg).includes("ReferenceError")),
      ),
    ).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it("shows the friendly transport-error message and unlocks the form for a controlled legacy-generation rejection", async () => {
    const transportError = Object.assign(
      new Error(
        '[CONVEX A(functions:generateProposal)] Server Error Uncaught ConvexError: {"code":"proposal_generation_provider_transport_error","message":"Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.","provider":"mistral","stage":"legacy_generation","statusCode":411}',
      ),
      {
        data: {
          code: "proposal_generation_provider_transport_error",
          message:
            "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.",
          provider: "mistral",
          stage: "legacy_generation",
          statusCode: 411,
        },
      },
    );
    mockGenerateProposalAction.mockRejectedValue(transportError);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const onSubmit = vi.fn();
    const onError = vi.fn();
    const { container } = render(
      <ProposalInputForm onSubmit={onSubmit} onError={onError} />,
    );

    const jobTitleInput = screen.getByPlaceholderText("Enter Job Title");
    const jobDescriptionInput = screen.getByPlaceholderText(
      "Paste the job description here…",
    );
    const submitButton = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;

    expect(submitButton).not.toBeNull();

    fireEvent.change(jobTitleInput, {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(jobDescriptionInput, {
      target: {
        value:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
      },
    });

    fireEvent.click(submitButton!);

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerateProposalAction).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalType: "cover_letter",
        modelType: "chatgpt",
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.",
      );
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.",
      expect.objectContaining({
        proposalType: "cover_letter",
        jobTitle: "Operations Associate",
      }),
      expect.stringContaining("proposal_generation_provider_transport_error"),
    );
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call.some((arg) => String(arg).includes("ReferenceError")),
      ),
    ).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it("passes fallback provenance through the successful submit path without showing an inline error", async () => {
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_123",
      proposalContent:
        "Dear Hiring Manager,\n\nI am writing with interest in the Operations Associate role.\n\nBest regards,",
      requestedModelType: "mistral-small-latest",
      actualModelType: "chatgpt",
      fallbackTriggerCode: "proposal_generation_provider_busy",
    });

    const onSubmit = vi.fn();
    const onError = vi.fn();
    const { container } = render(
      <ProposalInputForm onSubmit={onSubmit} onError={onError} />,
    );

    const jobTitleInput = screen.getByPlaceholderText("Enter Job Title");
    const jobDescriptionInput = screen.getByPlaceholderText(
      "Paste the job description here…",
    );
    const submitButton = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;

    expect(submitButton).not.toBeNull();

    fireEvent.change(jobTitleInput, {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(jobDescriptionInput, {
      target: {
        value:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
      },
    });

    fireEvent.click(submitButton!);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalType: "cover_letter",
          jobTitle: "Operations Associate",
        }),
        "Dear Hiring Manager,\n\nI am writing with interest in the Operations Associate role.\n\nBest regards,",
        {
          requestedModelType: "mistral-small-latest",
          actualModelType: "chatgpt",
          fallbackTriggerCode: "proposal_generation_provider_busy",
        },
        "proposal_123",
      );
    });

    expect(onError).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("keeps the compose controls compact while hiding removed model and proposal options", () => {
    render(<ProposalInputForm onSubmit={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Letter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Balanced" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ChatGPT" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mistral Small" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mistral Large" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mistral Agent" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Application Message" }),
    ).not.toBeInTheDocument();
  });

  it("shows only the supported tone options for cover letters", async () => {
    render(<ProposalInputForm onSubmit={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Balanced" })).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Tone"));

    await waitFor(() => {
      expect(screen.getByText("Formal")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Formal"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Warm"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Storyteller"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Direct"),
    ).not.toBeInTheDocument();
  });

  it("falls back to the balanced tone when an unsupported saved preset enters cover-letter mode", async () => {
    mockQuery.mockReturnValue({ voicePreset: "direct" });

    render(<ProposalInputForm onSubmit={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Balanced" })).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Tone"));

    await waitFor(() => {
      expect(screen.getByText("Formal")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Direct"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Storyteller"),
    ).not.toBeInTheDocument();
  });

  it("shows only the supported tone options for proposals and falls back to balanced from legacy saved presets", async () => {
    mockQuery.mockReturnValue({ voicePreset: "direct" });

    render(<ProposalInputForm onSubmit={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByTitle("Document type"));

    await waitFor(() => {
      expect(screen.getByText("Proposal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Proposal"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Proposal" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Balanced" })).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Tone"));

    await waitFor(() => {
      expect(
        screen.queryByText("Direct"),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByText("Formal"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Warm"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Storyteller"),
    ).not.toBeInTheDocument();
  });
});
