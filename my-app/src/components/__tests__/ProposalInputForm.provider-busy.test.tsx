import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ProposalInputForm from "../ProposalInputForm";

const {
  mockGenerateProposalAction,
  mockMutation,
  mockMutationHookFn,
  mockNavigate,
  mockQuery,
  mockGetActiveLocalPersonalizationSource,
  mockBuildAppProposalPersonalizationPayload,
  mockClearActiveLocalCvId,
  mockGetLocalActiveCvSnapshotById,
  mockListLocalCvPickerOptions,
  mockLoadCv,
  mockSetActiveLocalCvId,
  mockGeneratedApiModule,
} = vi.hoisted(() => ({
  mockGenerateProposalAction: vi.fn(),
  mockMutation: vi.fn(),
  mockMutationHookFn: Object.assign((...args: any[]) => mockMutation(...args), {
    withOptimisticUpdate: () => {},
  }),
  mockNavigate: vi.fn(),
  mockQuery: vi.fn(),
  mockGetActiveLocalPersonalizationSource: vi.fn(),
  mockBuildAppProposalPersonalizationPayload: vi.fn(),
  mockClearActiveLocalCvId: vi.fn(),
  mockGetLocalActiveCvSnapshotById: vi.fn(() => null),
  mockListLocalCvPickerOptions: vi.fn(() => []),
  mockLoadCv: vi.fn(() => true),
  mockSetActiveLocalCvId: vi.fn(),
  mockGeneratedApiModule: {
    api: {
      functions: { generateProposal: "generateProposalAction" },
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
  },
}));

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => undefined,
}));

vi.mock("clsx", () => ({
  default: (...values: Array<string | undefined | false | null>) =>
    values.filter(Boolean).join(" "),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
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
      const valuesRef = React.useRef(values);
      const dirtyFieldsRef = React.useRef(dirtyFields);
      const subscribersRef = React.useRef(
        new Set<(values: Record<string, unknown>) => void>(),
      );

      valuesRef.current = values;
      dirtyFieldsRef.current = dirtyFields;

      React.useEffect(() => {
        subscribersRef.current.forEach((callback) => callback(values));
      }, [values]);

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

      return React.useMemo(
        () => ({
          register: (name: string) => ({
            name,
            value: valuesRef.current[name] ?? "",
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
          watch: (
            name?: string | ((values: Record<string, unknown>) => void),
          ) => {
            if (typeof name === "function") {
              subscribersRef.current.add(name);
              return {
                unsubscribe: () => subscribersRef.current.delete(name),
              };
            }

            return name ? valuesRef.current[name] ?? "" : valuesRef.current;
          },
          setValue,
          getValues: (name?: string) =>
            name ? valuesRef.current[name] : valuesRef.current,
          handleSubmit:
            (callback: (values: Record<string, unknown>) => unknown) =>
            async (event?: { preventDefault?: () => void }) => {
              event?.preventDefault?.();
              await callback(valuesRef.current);
            },
          formState: {
            get errors() {
              return {};
            },
            get isDirty() {
              return Object.keys(dirtyFieldsRef.current).length > 0;
            },
            get dirtyFields() {
              return dirtyFieldsRef.current;
            },
          },
        }),
        [],
      );
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
  clearActiveLocalCvId: (...args: any[]) => mockClearActiveLocalCvId(...args),
  formatCvDisplaySubtitle: ({ title }: { title?: string | null }) =>
    title ?? "",
  getActiveLocalPersonalizationSource: () =>
    mockGetActiveLocalPersonalizationSource(),
  getLocalActiveCvSnapshotById: (...args: any[]) =>
    mockGetLocalActiveCvSnapshotById(...args),
  listLocalCvPickerOptions: (...args: any[]) =>
    mockListLocalCvPickerOptions(...args),
  setActiveLocalCvId: (...args: any[]) => mockSetActiveLocalCvId(...args),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    loadCv: mockLoadCv,
  }),
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
    resolveProposalVoicePreset: (value: string | null | undefined) =>
      definitions.find((definition) => definition.id === value)?.id,
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
    mockNavigate.mockReset();
    mockGenerateProposalAction.mockReset();
    mockMutation.mockReset().mockResolvedValue(undefined);
    mockQuery.mockReset().mockReturnValue(undefined);
    mockGetActiveLocalPersonalizationSource.mockReset().mockReturnValue({
      title: null,
      personalizationContext: null,
    });
    mockBuildAppProposalPersonalizationPayload.mockReset().mockReturnValue({});
    mockClearActiveLocalCvId.mockReset();
    mockGetLocalActiveCvSnapshotById.mockReset().mockReturnValue(null);
    mockListLocalCvPickerOptions.mockReset().mockReturnValue([]);
    mockLoadCv.mockReset().mockReturnValue(true);
    mockSetActiveLocalCvId.mockReset();
    window.localStorage.clear();
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
      "Paste or write the job offer here…",
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

  it("attaches the selected CV without loading it into the resume workspace", async () => {
    mockListLocalCvPickerOptions.mockReturnValue([
      {
        id: "cv-1",
        title: "Ada Lovelace",
        isActive: false,
      },
    ]);
    mockGetLocalActiveCvSnapshotById.mockReturnValue({
      title: "Ada Lovelace",
      personalizationContext: null,
    });

    render(<ProposalInputForm onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose resume" }));

    const option = await screen.findByRole("button", { name: /Ada Lovelace/i });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(mockSetActiveLocalCvId).toHaveBeenCalledWith("cv-1");
    expect(mockLoadCv).not.toHaveBeenCalled();
  });

  it("still loads the selected CV when explicitly opening it in the resume workspace", async () => {
    mockListLocalCvPickerOptions.mockReturnValue([
      {
        id: "cv-1",
        title: "Ada Lovelace",
        isActive: false,
      },
    ]);
    mockGetLocalActiveCvSnapshotById.mockReturnValue({
      title: "Ada Lovelace",
      personalizationContext: null,
    });

    render(<ProposalInputForm onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose resume" }));

    const option = await screen.findByRole("button", { name: /Ada Lovelace/i });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(mockSetActiveLocalCvId).toHaveBeenCalledWith("cv-1");
    expect(mockLoadCv).toHaveBeenCalledWith("cv-1");
  });

  it("keeps imported handoff values in the form after the prefill prop is cleared", async () => {
    function HandoffPrefillHarness(): JSX.Element {
      const [prefill, setPrefill] = React.useState<{
        handoffId: string;
        jobTitle: string;
        jobDescription: string;
      } | null>({
        handoffId: "handoff_1",
        jobTitle: "Imported Operations Lead",
        jobDescription:
          "Coordinate recurring operations, document handoffs, and keep teams aligned.",
      });

      return (
        <div>
          <button type="button" onClick={() => setPrefill(null)}>
            Clear handoff
          </button>
          <ProposalInputForm onSubmit={vi.fn()} prefill={prefill} />
        </div>
      );
    }

    render(<HandoffPrefillHarness />);

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Enter Job Title"),
      ).toHaveValue("Imported Operations Lead"),
    );
    expect(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
    ).toHaveValue(
      "Coordinate recurring operations, document handoffs, and keep teams aligned.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear handoff" }));

    expect(screen.getByPlaceholderText("Enter Job Title")).toHaveValue(
      "Imported Operations Lead",
    );
    expect(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
    ).toHaveValue(
      "Coordinate recurring operations, document handoffs, and keep teams aligned.",
    );
  });

  it("surfaces the imported source link in the visible summary area when a handoff includes it", async () => {
    render(
      <ProposalInputForm
        onSubmit={vi.fn()}
        prefill={{
          handoffId: "handoff_source",
          jobTitle: "Operations Lead",
          jobDescription:
            "Coordinate recurring operations, document handoffs, and keep teams aligned across a distributed team.",
          platform: "linkedin",
          sourceUrl: "https://www.linkedin.com/jobs/view/123456",
        }}
      />,
    );

    expect(await screen.findByText("Job Offer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View on LinkedIn" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/jobs/view/123456");
    expect(screen.getByText("linkedin.com")).toBeInTheDocument();
  });

  it("keeps the imported source host visible even when the restored url is missing a scheme", async () => {
    window.localStorage.setItem(
      "dasti:proposal-compose-draft:v1",
      JSON.stringify({
        jobTitle: "Operations Lead",
        jobDescription:
          "Coordinate recurring operations, document handoffs, and keep teams aligned across a distributed team.",
        proposalType: "cover_letter",
        sourceUrl: "www.linkedin.com/jobs/view/123456",
        platform: "linkedin",
      }),
    );

    render(<ProposalInputForm onSubmit={vi.fn()} />);

    expect(await screen.findByText("linkedin.com")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View on LinkedIn" }),
    ).toHaveAttribute("href", "www.linkedin.com/jobs/view/123456");
  });

  it("prefers the source url hostname over a generic web platform label", async () => {
    render(
      <ProposalInputForm
        onSubmit={vi.fn()}
        prefill={{
          handoffId: "handoff_source_web",
          jobTitle: "Operations Lead",
          jobDescription:
            "Coordinate recurring operations, document handoffs, and keep teams aligned across a distributed team.",
          platform: "web",
          sourceUrl: "https://www.linkedin.com/jobs/view/123456",
        }}
      />,
    );

    expect(await screen.findByText("Job Offer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View on LinkedIn" }),
    ).toBeInTheDocument();
    expect(screen.getByText("linkedin.com")).toBeInTheDocument();
  });

  it("renders the imported source card from live source props even when storage is empty", async () => {
    render(
      <ProposalInputForm
        onSubmit={vi.fn()}
        sourceUrl="https://www.linkedin.com/jobs/view/123456"
        sourcePlatform="web"
      />,
    );

    expect(await screen.findByText("Job Offer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View on LinkedIn" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/jobs/view/123456");
    expect(screen.getByText("linkedin.com")).toBeInTheDocument();
  });

  it("keeps the imported source card from the initial compose draft seed when live storage is stale", async () => {
    render(
      <ProposalInputForm
        onSubmit={vi.fn()}
        initialComposeDraft={{
          jobTitle: "Operations Lead",
          jobDescription:
            "Coordinate recurring operations, document handoffs, and keep teams aligned across a distributed team.",
          proposalType: "cover_letter",
          sourceUrl: "https://www.linkedin.com/jobs/view/123456",
          platform: "linkedin",
        }}
      />,
    );

    expect(await screen.findByText("Job Offer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View on LinkedIn" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/jobs/view/123456");
    expect(screen.getByText("linkedin.com")).toBeInTheDocument();
  });

  it("keeps the imported source card visible if live source props clear after mount", async () => {
    const { rerender } = render(
      <ProposalInputForm
        onSubmit={vi.fn()}
        sourceUrl="https://www.linkedin.com/jobs/view/123456"
        sourcePlatform="linkedin"
      />,
    );

    expect(await screen.findByText("Job Offer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View on LinkedIn" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/jobs/view/123456");

    rerender(<ProposalInputForm onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("link", { name: "View on LinkedIn" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/jobs/view/123456");
    expect(screen.getByText("linkedin.com")).toBeInTheDocument();
  });

  it("does not clear the active CV id just because Proposal Forge cannot resolve it immediately", () => {
    window.localStorage.setItem("cvActiveId", "cv_alpha");
    mockGetActiveLocalPersonalizationSource.mockReturnValue({
      title: null,
      personalizationContext: null,
    });

    render(<ProposalInputForm />);

    expect(mockClearActiveLocalCvId).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("cvActiveId")).toBe("cv_alpha");
  });

  it("calls onSubmit without waiting for the generated-proposal status sync mutation", async () => {
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_123",
      proposalContent: "Generated proposal body.",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });
    mockMutation.mockImplementation(
      () => new Promise(() => {}),
    );

    const onSubmit = vi.fn();
    const { container } = render(<ProposalInputForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("Enter Job Title"), {
      target: { value: "UI / UX Artist For Game Development" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
      {
        target: {
          value: "Design tactile game interfaces, polish interactions, and support gameplay presentation.",
        },
      },
    );

    fireEvent.click(
      container.querySelector('button[type="submit"]') as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          jobTitle: "UI / UX Artist For Game Development",
          proposalType: "cover_letter",
        }),
        "Generated proposal body.",
        {
          requestedModelType: "chatgpt",
          actualModelType: "chatgpt",
          fallbackTriggerCode: null,
        },
        "proposal_123",
      );
    });
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
      "Paste or write the job offer here…",
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
      "Paste or write the job offer here…",
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

  it("reveals the square before stop and ignores the async result after stopping", async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    let resolveGeneration:
      | ((value: {
          proposalId: string;
          proposalContent: string;
          requestedModelType: string;
          actualModelType: string;
          fallbackTriggerCode: null;
        }) => void)
      | null = null;

    mockGenerateProposalAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        }),
    );

    const { container } = render(
      <ProposalInputForm onSubmit={onSubmit} onStop={onStop} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter Job Title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
      {
        target: {
          value:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
        },
      },
    );

    fireEvent.click(container.querySelector('button[type="submit"]')!);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2880);
    });

    const stopButton = screen.getByRole("button", { name: "Stop generating" });
    fireEvent.click(stopButton);

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Stopping" }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveGeneration?.({
        proposalId: "proposal_stopped",
        proposalContent: "Ignored content",
        requestedModelType: "chatgpt",
        actualModelType: "chatgpt",
        fallbackTriggerCode: null,
      });
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2300);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Generate" }),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("keeps the compose controls compact while hiding removed model and proposal options", () => {
    render(<ProposalInputForm onSubmit={vi.fn()} onError={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Document type" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Letter")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tone" })).toBeInTheDocument();
    expect(screen.getByText("Auto")).toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "Tone" })).toBeInTheDocument();
    expect(screen.getByText("Auto")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tone" }));

    await waitFor(() => {
      expect(screen.getAllByText("Auto")).toHaveLength(2);
    });

    expect(screen.getByText("Natural")).toBeInTheDocument();
    expect(screen.getByText("Formal")).toBeInTheDocument();
    expect(screen.getByText("Warm")).toBeInTheDocument();
    expect(screen.queryByText("Storyteller")).not.toBeInTheDocument();
    expect(screen.queryByText("Direct")).not.toBeInTheDocument();
  });

  it("falls back to Auto while hiding unsupported saved tones in cover-letter mode", async () => {
    mockQuery.mockReturnValue({
      voicePreset: "direct",
      savedVoicePreset: "direct",
      templateId: "editorial_wide",
    });

    render(<ProposalInputForm onSubmit={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Tone" })).toBeInTheDocument();
    expect(screen.getByText("Auto")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tone" }));

    await waitFor(() => {
      expect(screen.getByText("Natural")).toBeInTheDocument();
      expect(screen.getByText("Formal")).toBeInTheDocument();
    });

    expect(screen.queryByText("Direct")).not.toBeInTheDocument();
    expect(screen.queryByText("Storyteller")).not.toBeInTheDocument();
  });

  it("shows only the supported tone options for proposals and falls back to Auto from legacy saved presets", async () => {
    mockQuery.mockReturnValue({
      voicePreset: "direct",
      savedVoicePreset: "direct",
      templateId: "editorial_wide",
    });

    render(<ProposalInputForm onSubmit={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Document type" }));

    await waitFor(() => {
      expect(screen.getByText("Proposal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Proposal"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Document type" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Proposal")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Tone" })).toBeInTheDocument();
    expect(screen.getByText("Auto")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tone" }));

    await waitFor(() => {
      expect(screen.getByText("Natural")).toBeInTheDocument();
      expect(screen.queryByText("Direct")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Formal")).toBeInTheDocument();
    expect(screen.getByText("Warm")).toBeInTheDocument();
    expect(screen.queryByText("Storyteller")).not.toBeInTheDocument();
  });

  it("sends a null auto-tone sentinel while omitting explicit tone fields", async () => {
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_auto",
      proposalContent: "Hello hiring team,\n\nI would love to contribute.",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });

    const { container } = render(<ProposalInputForm onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Enter Job Title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
      {
        target: {
          value:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
        },
      },
    );

    fireEvent.click(container.querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledTimes(1);
    });

    const payload = mockGenerateProposalAction.mock.calls[0][0];
    expect(payload).toHaveProperty("voicePreset", null);
    expect(payload).not.toHaveProperty("formalityLevel");
    expect(payload).not.toHaveProperty("creativity");
    expect(payload).not.toHaveProperty("toneTuning");
    expect(payload).toMatchObject({
      characterLimitMode: "none",
      characterLimitValue: 1500,
    });
  });

  it("reuses the saved explicit preset when the user has one", async () => {
    mockQuery.mockReturnValue({
      voicePreset: "expert",
      savedVoicePreset: "expert",
      templateId: "editorial_wide",
    });
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_saved_preset",
      proposalContent: "Hello hiring team,\n\nI would love to contribute.",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });

    const { container } = render(<ProposalInputForm onSubmit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Formal")).toBeVisible();
    });

    fireEvent.change(screen.getByPlaceholderText("Enter Job Title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
      {
        target: {
          value:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
        },
      },
    );

    fireEvent.click(container.querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          voicePreset: "expert",
          formalityLevel: "formal",
          creativity: "low",
        }),
      );
    });
  });

  it("accepts a workspace-level external tone when the inline tone controls are suppressed", async () => {
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_toolbar_preset",
      proposalContent: "Hello hiring team,\n\nI would love to contribute.",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });

    const { container } = render(
      <ProposalInputForm
        onSubmit={vi.fn()}
        suppressToneControls
        externalVoicePreset="expert"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter Job Title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
      {
        target: {
          value:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
        },
      },
    );

    fireEvent.click(container.querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          voicePreset: "expert",
          formalityLevel: "formal",
          creativity: "low",
        }),
      );
    });
  });

  it("lets an external auto tone override a saved preset in workspace mode", async () => {
    mockQuery.mockReturnValue({
      voicePreset: "expert",
      savedVoicePreset: "expert",
      templateId: "editorial_wide",
    });
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_toolbar_auto",
      proposalContent: "Hello hiring team,\n\nI would love to contribute.",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });

    const { container } = render(
      <ProposalInputForm
        onSubmit={vi.fn()}
        suppressToneControls
        externalVoicePreset={null}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter Job Title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
      {
        target: {
          value:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
        },
      },
    );

    fireEvent.click(container.querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          voicePreset: null,
        }),
      );
    });
  });

  it("rehydrates a legacy draft with toneTuning null without sending it to Convex", async () => {
    window.localStorage.setItem(
      "dasti:proposal-compose-draft:v1",
      JSON.stringify({
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
        proposalType: "cover_letter",
        toneTuning: null,
      }),
    );
    mockGenerateProposalAction.mockResolvedValue({
      proposalId: "proposal_legacy_draft",
      proposalContent: "Hello hiring team,\n\nI would love to contribute.",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });

    const { container } = render(<ProposalInputForm onSubmit={vi.fn()} />);

    fireEvent.click(container.querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerateProposalAction.mock.calls[0][0]).not.toHaveProperty(
      "toneTuning",
    );
  });

  it("retries without clientRunId when the backend validator is one revision behind", async () => {
    const validatorError = new Error(
      "ArgumentValidationError: Object contains extra field `clientRunId` that is not in the validator.",
    );
    const onSubmit = vi.fn();

    mockGenerateProposalAction
      .mockRejectedValueOnce(validatorError)
      .mockResolvedValueOnce({
        proposalId: "proposal_validator_retry",
        proposalContent: "Hello hiring team,\n\nI would love to contribute.",
        requestedModelType: "chatgpt",
        actualModelType: "chatgpt",
        fallbackTriggerCode: null,
      });

    const { container } = render(<ProposalInputForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("Enter Job Title"), {
      target: { value: "Operations Associate" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
      {
        target: {
          value:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
        },
      },
    );

    fireEvent.click(container.querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(mockGenerateProposalAction).toHaveBeenCalledTimes(2);
    });

    expect(mockGenerateProposalAction.mock.calls[0][0]).toHaveProperty(
      "clientRunId",
    );
    expect(mockGenerateProposalAction.mock.calls[1][0]).not.toHaveProperty(
      "clientRunId",
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps the compose toolbar focused on resume, type, and tone controls only", () => {
    render(<ProposalInputForm onSubmit={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /Character limit/i }),
    ).not.toBeInTheDocument();
  });
});
