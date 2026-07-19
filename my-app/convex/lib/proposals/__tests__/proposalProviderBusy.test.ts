import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAgentComplete,
  mockChatComplete,
  mockChatParse,
  mockGenerateCreativeProposal,
  mockGenerateTechnicalProposal,
  mockGpt4Generate,
  mockEstimateTokens,
  mockModelInvoke,
  mockOpenAIResponsesCreate,
  mockChatMistralAI,
} = vi.hoisted(() => ({
  mockAgentComplete: vi.fn(),
  mockChatComplete: vi.fn(),
  mockChatParse: vi.fn(),
  mockGenerateCreativeProposal: vi.fn(),
  mockGenerateTechnicalProposal: vi.fn(),
  mockGpt4Generate: vi.fn(),
  mockEstimateTokens: vi.fn((text: string) => text.length / 4),
  mockModelInvoke: vi.fn(),
  mockOpenAIResponsesCreate: vi.fn(),
  mockChatMistralAI: vi.fn(),
}));

vi.mock("@mistralai/mistralai", () => ({
  Mistral: vi.fn().mockImplementation(() => ({
    chat: {
      parse: mockChatParse,
      complete: mockChatComplete,
    },
    agents: {
      complete: mockAgentComplete,
    },
  })),
}));

vi.mock("@langchain/mistralai", () => ({
  ChatMistralAI: mockChatMistralAI.mockImplementation(() => ({
    invoke: mockModelInvoke,
  })),
}));

vi.mock("../../../langchain", () => ({
  ProposalService: vi.fn().mockImplementation(
    (config?: {
      modelAdapters?: Array<{ getModelName?: () => string }>;
    }) => {
      const textModelName =
        config?.modelAdapters?.[0]?.getModelName?.() ?? "gpt-5.5";

      return {
        generateCreativeProposal: async (...args: unknown[]) => {
          const result = await mockGenerateCreativeProposal(...args);
          if (!result || typeof result !== "object") return result;
          const typedResult = result as {
            content?: string;
            metadata?: Record<string, unknown>;
          };
          return {
            ...typedResult,
            metadata: {
              modelName: "gpt-5.5",
              ...(typedResult.metadata ?? {}),
            },
          };
        },
        generateTechnicalProposal: async (...args: unknown[]) => {
          const result = await mockGenerateTechnicalProposal(...args);
          if (!result || typeof result !== "object") return result;
          const typedResult = result as {
            content?: string;
            metadata?: Record<string, unknown>;
          };
          return {
            ...typedResult,
            metadata: {
              modelName: "mistral-large-latest",
              ...(typedResult.metadata ?? {}),
            },
          };
        },
        generateTextWithFallbacks: async (
          prompt: string,
          config: { signal?: AbortSignal },
        ) => ({
          text: await mockGpt4Generate(prompt, config ?? {}),
          modelName: textModelName,
        }),
      };
    },
  ),
}));

vi.mock("../../../langchain/models/gpt4_adapter", () => ({
  GPT4Adapter: vi.fn().mockImplementation(() => ({
    generate: mockGpt4Generate,
    estimateTokens: mockEstimateTokens,
  })),
}));

vi.mock("openai", () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    responses: {
      create: mockOpenAIResponsesCreate,
    },
  }));
  return {
    default: MockOpenAI,
    OpenAI: MockOpenAI,
  };
});

function makeRateLimitError(retryAfterSeconds = 17): Error & {
  statusCode: number;
  body: string;
  rawResponse: Response;
} {
  const rawResponse = new Response(
    JSON.stringify({ code: "rate_limited", retryAfter: retryAfterSeconds }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
  const error = new Error(
    `Request failed: Status 429 Body {"code":"rate_limited"}`,
  ) as Error & {
    statusCode: number;
    body: string;
    rawResponse: Response;
  };
  error.name = "SDKError";
  error.statusCode = 429;
  error.body = JSON.stringify({
    code: "rate_limited",
    retryAfter: retryAfterSeconds,
  });
  error.rawResponse = rawResponse;
  return error;
}

function makeContentLengthRequiredError(): Error & {
  statusCode: number;
  body: string;
  rawResponse: Response;
} {
  const rawResponse = new Response(
    JSON.stringify({
      message: "A valid Content-Length header is required",
      request_id: "req_411_test",
    }),
    {
      status: 411,
      headers: {
        "content-type": "application/json",
      },
    },
  );
  const error = new Error(
    `API error occurred: Status 411 Content-Type application/json; charset=utf-8 Body {"message":"A valid Content-Length header is required","request_id":"req_411_test"}`,
  ) as Error & {
    statusCode: number;
    body: string;
    rawResponse: Response;
  };
  error.name = "SDKError";
  error.statusCode = 411;
  error.body = JSON.stringify({
    message: "A valid Content-Length header is required",
    request_id: "req_411_test",
  });
  error.rawResponse = rawResponse;
  return error;
}

async function loadProposalModule() {
  vi.resetModules();
  return import("../../../generateProposalMutation");
}

function getLoggedRoutingTelemetry(infoSpy: ReturnType<typeof vi.spyOn>) {
  const telemetryCall = infoSpy.mock.calls.find(
    ([message]) => message === "Cover letter routing telemetry",
  );
  expect(telemetryCall).toBeTruthy();
  return telemetryCall?.[1] as Record<string, unknown>;
}

function getLoggedMistralDiagnostics(infoSpy: ReturnType<typeof vi.spyOn>) {
  const diagnosticsCall = infoSpy.mock.calls.find(
    ([message]) => message === "Proposal Mistral diagnostics",
  );
  expect(diagnosticsCall).toBeTruthy();
  return diagnosticsCall?.[1] as Record<string, unknown>;
}

const qwenPremiumBodyPartsFixture = {
  opening:
    "I am applying for the Senior Frontend Engineer role because my recent work has centered on shipping customer-facing React and TypeScript products.",
  proofBlock:
    "At Acme, I led a design system migration used across four product squads and improved release consistency across shared interface work.",
  employerValueBlock:
    "That background is most relevant in roles where interface quality, collaboration, and iteration all shape the final product experience.",
  closeLine: "I would welcome the opportunity to discuss the role further.",
};

function qwenChatResponse(content: string) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    },
  ) as Response;
}

function createQwenPremiumCtx() {
  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
    },
    runQuery: vi.fn().mockResolvedValue({
      _id: "profile_123",
      proposalVoicePreset: "signature",
      experience: [],
      skills: [],
      achievements: [],
    }),
    runMutation: vi.fn().mockResolvedValue("proposal_123"),
  };
}

function qwenPremiumArgs() {
  return {
    jobTitle: "Senior Frontend Engineer",
    jobDescription:
      "Lead React and TypeScript development across customer-facing product surfaces and collaborate closely with product teams.",
    proposalType: "cover_letter" as const,
    modelType: "qwen3.7-max" as const,
    voicePreset: "signature" as const,
    personalizationMode: "explicit_only" as const,
    personalizationRichness: "rich" as const,
    personalizationContext: {
      name: "Alex Martin",
      summary: "Frontend engineer focused on design systems.",
      topSkills: ["React", "TypeScript", "Design systems"],
      recentExperience: [
        {
          company: "Acme",
          position: "Senior Frontend Engineer",
          highlights: [
            "Led a design system migration used across four product squads.",
            "Improved release consistency across shared interface work.",
          ],
        },
      ],
      standoutAchievements: [
        "Improved release consistency across shared interface work.",
      ],
    },
  };
}

function qwenAdjacentPremiumArgs() {
  return {
    jobTitle: "Administrative Liaison",
    jobDescription:
      "Coordinate office schedules, maintain clear records, support vendor correspondence, and share timely updates across teams.",
    proposalType: "cover_letter" as const,
    modelType: "qwen3.7-max" as const,
    voicePreset: "signature" as const,
    personalizationMode: "explicit_only" as const,
    personalizationRichness: "rich" as const,
    personalizationContext: {
      name: "Camille Bernard",
      summary:
        "Customer support specialist with experience in records, scheduling, and vendor correspondence.",
      topSkills: ["Records", "Scheduling", "Vendor correspondence"],
      recentExperience: [
        {
          company: "Northline Services",
          position: "Customer Support Representative",
          highlights: [
            "Maintained clear service records for recurring customer updates.",
            "Coordinated shift schedules and vendor correspondence.",
            "Tracked deadlines and shared timely updates across teams.",
          ],
        },
      ],
      standoutAchievements: [
        "Maintained clear service records for recurring customer updates.",
      ],
    },
  };
}

function expectQwenPremiumRequest(fetchSpy: ReturnType<typeof vi.spyOn>) {
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    "https://qwen.test/chat/completions",
  );
  const headers = fetchSpy.mock.calls[0]?.[1]?.headers as
    | Record<string, string>
    | undefined;
  expect(headers?.Authorization).toBe("Bearer sk-qwen");
  expect(headers?.["Content-Type"]).toBe("application/json");

  const qwenRequest = JSON.parse(
    String(fetchSpy.mock.calls[0]?.[1]?.body ?? "{}"),
  ) as {
    model?: string;
    messages?: Array<{ role?: string; content?: string }>;
    response_format?: { type?: string };
    temperature?: number;
    top_p?: number;
  };
  expect(qwenRequest.model).toBe("qwen3.7-max");
  expect(qwenRequest.response_format).toEqual({ type: "json_object" });
  expect(qwenRequest.temperature).toBe(0.2);
  expect(qwenRequest.top_p).toBe(0.8);
  expect(typeof qwenRequest.messages?.[0]?.content).toBe("string");
  expect(qwenRequest.messages?.[0]?.content).toContain(
    "Provider adapter: Qwen",
  );
  expect(qwenRequest.messages?.[0]?.content).not.toContain(
    "Provider adapter: Mistral",
  );
  return qwenRequest;
}

const plannerResultFixture = {
  context_mode: "none",
  domain_gap: "direct",
  credential_status: "adjacent",
  transfer_mode: "literal",
  output_language: "en",
  allowed_concrete_facts: [],
  allowed_transfer_themes: ["records accuracy", "cross-team coordination"],
  disallowed_claims: [],
  identity_hard_stops: [],
  proof_strategy: "job_grounded_interest_only",
  opening_strategy: "interest_first",
};

describe("proposal provider busy handling", () => {
  beforeEach(() => {
    mockAgentComplete.mockReset();
    mockChatComplete.mockReset();
    mockChatParse.mockReset();
    mockGenerateCreativeProposal.mockReset();
    mockGenerateTechnicalProposal.mockReset();
    mockGpt4Generate.mockReset();
    mockEstimateTokens.mockClear();
    mockModelInvoke.mockReset();
    mockOpenAIResponsesCreate.mockReset();
    mockChatMistralAI.mockClear();
    process.env.MISTRAL_API_KEY = "sk-test";
    process.env.OPENAI_API_KEY = "sk-openai";
    delete process.env.QWEN_API_KEY;
    delete process.env.QWEN_CHAT_COMPLETIONS_URL;
    delete process.env.QWEN_BASE_URL;
    delete process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1;
    delete process.env.ENABLE_COVER_LETTER_QUALITY_REPAIR_V1;
    delete process.env.COVER_LETTER_PREMIUM_WRITER_MODEL;
    delete process.env.DEV_STUB;
  });

  it("fails fast on planner parse 429 without attempting the JSON retry call", async () => {
    mockChatParse.mockRejectedValue(makeRateLimitError());
    const { buildStructuredProposalPlan } = await loadProposalModule();

    await expect(
      buildStructuredProposalPlan({
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        prompt: "Return a planner result.",
      }),
    ).rejects.toMatchObject({
      name: "ProposalProviderBusyError",
      provider: "mistral",
      stage: "planner_parse",
      retryAfterMs: 17000,
    });

    expect(mockChatComplete).not.toHaveBeenCalled();
  });

  it("skips planner and persists a successful CV-backed request through the legacy path", async () => {
    mockModelInvoke.mockResolvedValue({
      content:
        "I led a design system migration used across four product squads and stayed close to the product-facing decisions that shaped everyday user experience. That background keeps me especially interested in roles where interface quality, collaboration, and iteration all matter in the final outcome.",
    });
    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "direct",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development across customer-facing product surfaces.",
        proposalType: "cover_letter",
        modelType: "mistral-small-latest",
        voicePreset: "direct",
        personalizationMode: "explicit_only",
        personalizationRichness: "rich",
        personalizationContext: {
          name: "Alex Martin",
          summary: "Frontend engineer focused on design systems.",
          topSkills: ["React", "TypeScript", "Design systems"],
          recentExperience: [
            {
              company: "Acme",
              position: "Senior Frontend Engineer",
              highlights: [
                "Led a design system migration used across four product squads.",
              ],
            },
          ],
        },
      });

      expect(result).toMatchObject({
        proposalId: "proposal_123",
      });
      expect(result.proposalContent).toMatch(/^Dear Hiring Manager,/);
      expect(mockChatParse).not.toHaveBeenCalled();
      expect(mockChatComplete).not.toHaveBeenCalled();
      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      const mutationArgs = ctx.runMutation.mock.calls[0]?.[1];
      expect(mutationArgs).toEqual(
        expect.objectContaining({
          content: result.proposalContent,
          metadata: expect.objectContaining({
            planned_path: "structured",
            executed_path: "legacy",
            fallback_reason: "planner_dependency_bypassed",
            tags: expect.arrayContaining([
              "generation_path:legacy_only_path_after_planner_bypass",
            ]),
          }),
        }),
      );
      const storedMetadata = ctx.runMutation.mock.calls[0]?.[1]?.metadata as
        | { tags?: string[] }
        | undefined;
      expect(storedMetadata?.tags).not.toContain(
        "feature_flag:cover_letter_premium_path_v1",
      );
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        structuredEligible: true,
        structuredEligibilityReason: "eligible",
        outcomeClass: "success",
        normalizedFailureCode: null,
        runtimeFailureReason: null,
        attemptedPath: "legacy-only path after planner bypass",
        finalOutcome: expect.stringMatching(/^legacy_saved_(?:parsed|raw)$/),
        failureStage: null,
      });
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("routes an eligible chatgpt cover letter request through the premium path first without the legacy flag gate", async () => {
    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5-mini";
    mockOpenAIResponsesCreate.mockResolvedValue({
      output: [
        {
          content: [
            {
              json: {
                version: "premium_writer_output_v1",
                bodyParts: {
                  opening: {
                    section: "opening",
                    text: "At Acme, I led a design system migration used across four product squads.",
                    claimIds: ["claim_opening_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: [],
                  },
                  proofBlock: {
                    section: "proofBlock",
                    text: "That migration gave four product squads a shared design-system foundation.",
                    claimIds: ["claim_proof_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: [],
                  },
                  employerValueBlock: {
                    section: "employerValueBlock",
                    text: "That design-system work is relevant to customer-facing product surfaces where React, TypeScript, and collaboration shape interface quality.",
                    claimIds: ["claim_employer_value_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: ["demand_core_001"],
                  },
                  closeLine: {
                    section: "closeLine",
                    text: "I bring discipline around reusable systems, shared interfaces, and product collaboration.",
                    claimIds: ["claim_close_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: [],
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development across customer-facing product surfaces and collaborate closely with product teams.",
        proposalType: "cover_letter",
        modelType: "chatgpt",
        voicePreset: "signature",
        personalizationMode: "explicit_only",
        personalizationRichness: "rich",
        personalizationContext: {
          name: "Alex Martin",
          summary: "Frontend engineer focused on design systems.",
          topSkills: ["React", "TypeScript", "Design systems"],
          recentExperience: [
            {
              company: "Acme",
              position: "Senior Frontend Engineer",
              highlights: [
                "Led a design system migration used across four product squads.",
                "Improved release consistency across shared interface work.",
              ],
            },
          ],
          standoutAchievements: [
            "Improved release consistency across shared interface work.",
          ],
        },
      });

      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: "chatgpt",
        actualModelType: "chatgpt",
        fallbackTriggerCode: null,
      });
      expect(result.proposalContent).toMatch(/^Dear Hiring Manager,/);
      expect(mockOpenAIResponsesCreate).toHaveBeenCalledTimes(1);
      expect(mockOpenAIResponsesCreate.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          model: "gpt-5-mini",
        }),
      );
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGenerateTechnicalProposal).not.toHaveBeenCalled();
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          content: result.proposalContent,
          metadata: expect.objectContaining({
            planned_path: "structured",
            executed_path: "structured",
            fallback_reason: "not_applicable",
            validator_outcome: "structured_success",
            save_outcome: "structured_saved",
            tags: expect.arrayContaining([
              "model:chatgpt",
              "premium_cover_letter_path_v1",
              "premium_quality_repair:disabled",
              "generation_path:premium_path_saved",
            ]),
          }),
        }),
      );
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        structuredEligible: true,
        structuredEligibilityReason: "eligible",
        attemptedPath: "premium path saved",
        premium_path_saved: true,
        premium_validation_passed: true,
        premium_quality_shadow_passed: expect.any(Boolean),
        premium_quality_repair_enabled: false,
        premium_quality_repair_eligible: false,
        premium_quality_repair_attempted: false,
        premium_quality_repair_outcome: "disabled",
        premium_quality_repair_rejection_category: null,
        premium_quality_repair_before: expect.objectContaining({
          passed: expect.any(Boolean),
          score: expect.any(Number),
          issues: expect.any(Array),
        }),
        premium_quality_repair_after: null,
        premium_final_provenance_status: expect.any(String),
        premium_verified_candidate_fact_count: expect.any(Number),
        premium_quality_gate_passed: null,
        finalOutcome: "structured_saved",
        failureStage: null,
        requestedModelType: "chatgpt",
        actualModelType: "chatgpt",
        usedFallback: false,
        normalizedFailureCode: null,
        runtimeFailureReason: null,
      });
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("routes enabled OpenAI quality repair through the body-parts schema and records non-sensitive telemetry", async () => {
    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5-mini";
    process.env.ENABLE_COVER_LETTER_QUALITY_REPAIR_V1 = "1";
    mockOpenAIResponsesCreate
      .mockResolvedValueOnce({
        output: [
          {
            content: [
              {
                json: {
                  version: "premium_writer_output_v1",
                  bodyParts: {
                    opening: {
                      section: "opening",
                      text: "At Acme, I led a design system migration used across four product squads.",
                      claimIds: ["claim_opening_001"],
                      factIds: ["fact_experience_001_highlight_001"],
                      demandIds: [],
                    },
                    proofBlock: {
                      section: "proofBlock",
                      text: "That migration gave four product squads a shared design-system foundation.",
                      claimIds: ["claim_proof_001"],
                      factIds: ["fact_experience_001_highlight_001"],
                      demandIds: [],
                    },
                    employerValueBlock: {
                      section: "employerValueBlock",
                      text: "That design-system work is relevant to customer-facing product surfaces where React, TypeScript, and collaboration shape interface quality.",
                      claimIds: ["claim_employer_value_001"],
                      factIds: ["fact_experience_001_highlight_001"],
                      demandIds: ["demand_core_001"],
                    },
                    closeLine: {
                      section: "closeLine",
                      text: "I would be glad to discuss the position further.",
                      claimIds: ["claim_close_001"],
                      factIds: ["fact_experience_001_highlight_001"],
                      demandIds: [],
                    },
                  },
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        output: [
          {
            content: [
              {
                json: {
                  opening:
                    "At Acme, I led a design system migration used across four product squads.",
                  proofBlock:
                    "That migration gave four product squads a shared design-system foundation.",
                  employerValueBlock:
                    "That design-system work is relevant to customer-facing product surfaces where React, TypeScript, and collaboration shape interface quality.",
                  closeLine:
                    "I led a design system migration used across four product squads.",
                },
              },
            ],
          },
        ],
      });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const { handleGenerateProposal } = await loadProposalModule();
      const ctx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockResolvedValue({
          _id: "profile_123",
          proposalVoicePreset: "direct",
          experience: [],
          skills: [],
          achievements: [],
        }),
        runMutation: vi.fn().mockResolvedValue("proposal_123"),
      };

      await handleGenerateProposal(ctx as any, {
        userId: "user_123",
        jobTitle: "Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development across customer-facing product surfaces and collaborate closely with product teams.",
        proposalType: "cover_letter",
        modelType: "chatgpt",
        voicePreset: "signature",
        personalizationMode: "explicit_only",
        personalizationRichness: "rich",
        personalizationContext: {
          name: "Alex Martin",
          summary: "Frontend engineer focused on design systems.",
          topSkills: ["React", "TypeScript", "Design systems"],
          recentExperience: [
            {
              company: "Acme",
              position: "Senior Frontend Engineer",
              highlights: [
                "Led a design system migration used across four product squads.",
                "Improved release consistency across shared interface work.",
              ],
            },
          ],
          standoutAchievements: [
            "Improved release consistency across shared interface work.",
          ],
        },
      });

      expect(mockOpenAIResponsesCreate).toHaveBeenCalledTimes(2);
      expect(mockOpenAIResponsesCreate.mock.calls[1]?.[0]).toMatchObject({
        text: {
          format: expect.objectContaining({
            name: "premium_cover_letter_body_parts",
          }),
        },
      });
      const mutationPayload = ctx.runMutation.mock.calls[0]?.[1] as {
        metadata?: { tags?: string[]; premium_quality_repair_enabled?: unknown };
      };
      expect(mutationPayload.metadata?.tags).toEqual(
        expect.arrayContaining([
          "premium_quality_repair:attempted_accepted",
          "feature_flag:cover_letter_quality_repair_v1",
        ]),
      );
      expect(mutationPayload.metadata?.premium_quality_repair_enabled).toBeUndefined();
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        premium_quality_repair_enabled: true,
        premium_quality_repair_eligible: true,
        premium_quality_repair_attempted: true,
        premium_quality_repair_outcome: "attempted_accepted",
        premium_quality_repair_after: expect.objectContaining({
          passed: true,
        }),
        premium_final_provenance_status: "validated_after_structured_repair",
        premium_verified_candidate_fact_count: expect.any(Number),
      });
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("propagates OpenAI quality-repair cancellation without legacy fallback or persistence", async () => {
    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5-mini";
    process.env.ENABLE_COVER_LETTER_QUALITY_REPAIR_V1 = "1";
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    mockOpenAIResponsesCreate
      .mockResolvedValueOnce({
        output: [
          {
            content: [
              {
                json: {
                  version: "premium_writer_output_v1",
                  bodyParts: {
                    opening: {
                      section: "opening",
                      text: "At Acme, I led a design system migration used across four product squads.",
                      claimIds: ["claim_opening_001"],
                      factIds: ["fact_experience_001_highlight_001"],
                      demandIds: [],
                    },
                    proofBlock: {
                      section: "proofBlock",
                      text: "That migration gave four product squads a shared design-system foundation.",
                      claimIds: ["claim_proof_001"],
                      factIds: ["fact_experience_001_highlight_001"],
                      demandIds: [],
                    },
                    employerValueBlock: {
                      section: "employerValueBlock",
                      text: "That design-system work is relevant to customer-facing product surfaces where React, TypeScript, and collaboration shape interface quality.",
                      claimIds: ["claim_employer_value_001"],
                      factIds: ["fact_experience_001_highlight_001"],
                      demandIds: ["demand_core_001"],
                    },
                    closeLine: {
                      section: "closeLine",
                      text: "I would be glad to discuss the position further.",
                      claimIds: ["claim_close_001"],
                      factIds: ["fact_experience_001_highlight_001"],
                      demandIds: [],
                    },
                  },
                },
              },
            ],
          },
        ],
      })
      .mockRejectedValueOnce(abortError);
    const { handleGenerateProposal } = await loadProposalModule();
    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "direct",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    await expect(
      handleGenerateProposal(ctx as any, {
        userId: "user_123",
        jobTitle: "Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development across customer-facing product surfaces and collaborate closely with product teams.",
        proposalType: "cover_letter",
        modelType: "chatgpt",
        voicePreset: "signature",
        personalizationMode: "explicit_only",
        personalizationRichness: "rich",
        personalizationContext: {
          name: "Alex Martin",
          summary: "Frontend engineer focused on design systems.",
          topSkills: ["React", "TypeScript", "Design systems"],
          recentExperience: [
            {
              company: "Acme",
              position: "Senior Frontend Engineer",
              highlights: [
                "Led a design system migration used across four product squads.",
                "Improved release consistency across shared interface work.",
              ],
            },
          ],
        },
      }),
    ).rejects.toThrow("Proposal generation canceled.");

    expect(mockOpenAIResponsesCreate).toHaveBeenCalledTimes(2);
    expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
    expect(mockGenerateTechnicalProposal).not.toHaveBeenCalled();
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it.each([
    ["mistral-medium-latest" as const],
    ["mistral-large-latest" as const],
  ])(
    "routes an eligible %s cover letter request through the premium Mistral path before structured or legacy",
    async (mistralModel) => {
    mockModelInvoke.mockImplementation(async (messages: unknown[]) => {
      const messageText = JSON.stringify(messages);
      if (messageText.includes("Return only a valid JSON object")) {
        return {
          content: JSON.stringify({
            opening:
              "I am applying for the Senior Frontend Engineer role because my recent work has centered on customer-facing React and TypeScript products.",
            proofBlock:
              "At Acme, I led a design system migration used across four product squads and improved release consistency across shared interface work.",
            employerValueBlock:
              "That background is most relevant in roles where interface quality, collaboration, and iteration all shape the final product experience.",
            closeLine:
              "I would welcome the opportunity to discuss the role further.",
          }),
        };
      }

      return {
        content:
          "At Acme, I led a design system migration used across four product squads and improved release consistency across shared interface work.\n\nI would welcome the opportunity to discuss the role further.",
      };
    });

    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development across customer-facing product surfaces and collaborate closely with product teams.",
        proposalType: "cover_letter",
        modelType: mistralModel,
        voicePreset: "signature",
        personalizationMode: "explicit_only",
        personalizationRichness: "rich",
        personalizationContext: {
          name: "Alex Martin",
          summary: "Frontend engineer focused on design systems.",
          topSkills: ["React", "TypeScript", "Design systems"],
          recentExperience: [
            {
              company: "Acme",
              position: "Senior Frontend Engineer",
              highlights: [
                "Led a design system migration used across four product squads.",
                "Improved release consistency across shared interface work.",
              ],
            },
          ],
          standoutAchievements: [
            "Improved release consistency across shared interface work.",
          ],
        },
      });

      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: mistralModel,
        actualModelType: mistralModel,
        actualModelName: mistralModel,
        fallbackTriggerCode: null,
        routing: {
          attemptedPath: "premium path saved",
          plannedPath: "structured",
          executedPath: "structured",
          fallbackReason: "not_applicable",
          validatorOutcome: "structured_success",
          saveOutcome: "structured_saved",
          premiumFailureStage: null,
          premiumFailureReason: null,
          premiumFailureContextClass: null,
        },
      });
      expect(result.proposalContent).toMatch(/^Dear Hiring Manager,/);
      expect(mockChatMistralAI).toHaveBeenCalledTimes(1);
      expect(mockChatMistralAI.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          apiKey: "sk-test",
          modelName: mistralModel,
        }),
      );
      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(mockModelInvoke.mock.calls[0]?.[0])).toContain(
        "Return only a valid JSON object",
      );
      expect(mockOpenAIResponsesCreate).not.toHaveBeenCalled();
      expect(mockChatParse).not.toHaveBeenCalled();
      expect(mockChatComplete).not.toHaveBeenCalled();
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGenerateTechnicalProposal).not.toHaveBeenCalled();
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          content: result.proposalContent,
          metadata: expect.objectContaining({
            planned_path: "structured",
            executed_path: "structured",
            fallback_reason: "not_applicable",
            validator_outcome: "structured_success",
            save_outcome: "structured_saved",
            tags: expect.arrayContaining([
              `model:${mistralModel}`,
              "premium_cover_letter_path_v1",
              "generation_path:premium_path_saved",
            ]),
          }),
        }),
      );
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        structuredEligible: false,
        structuredEligibilityReason: "rollout_gate:model_not_in_rollout",
        attemptedPath: "premium path saved",
        premium_path_saved: true,
        premium_validation_passed: true,
        premium_quality_shadow_passed: expect.any(Boolean),
        premium_quality_gate_passed: null,
        finalOutcome: "structured_saved",
        failureStage: null,
        requestedModelType: mistralModel,
        actualModelType: mistralModel,
        usedFallback: false,
        normalizedFailureCode: null,
        runtimeFailureReason: null,
      });
    } finally {
      infoSpy.mockRestore();
    }
    },
  );

  it("blocks legacy Mistral persistence after eligible premium Mistral validation failure and saves controlled GPT fallback", async () => {
    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5-mini";
    const brokenLegacyContent =
      "My experience in team collaboration, conflict resolution, and maintaining store presentation standards.";
    mockModelInvoke
      .mockResolvedValueOnce({
        content:
          "I cannot return the requested JSON body parts for this cover letter.",
      })
      .mockResolvedValueOnce({
        content: brokenLegacyContent,
      });
    mockOpenAIResponsesCreate.mockResolvedValue({
      output: [
        {
          content: [
            {
              json: {
                version: "premium_writer_output_v1",
                bodyParts: {
                  opening: {
                    section: "opening",
                    text: "At Acme, I led a design system migration used across four product squads.",
                    claimIds: ["claim_opening_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: [],
                  },
                  proofBlock: {
                    section: "proofBlock",
                    text: "That migration gave four product squads a shared design-system foundation.",
                    claimIds: ["claim_proof_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: [],
                  },
                  employerValueBlock: {
                    section: "employerValueBlock",
                    text: "That design-system work is relevant to customer-facing product surfaces where React, TypeScript, and collaboration shape interface quality.",
                    claimIds: ["claim_employer_value_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: ["demand_core_001"],
                  },
                  closeLine: {
                    section: "closeLine",
                    text: "I bring discipline around reusable systems, shared interfaces, and product collaboration.",
                    claimIds: ["claim_close_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: [],
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development across customer-facing product surfaces and collaborate closely with product teams.",
        proposalType: "cover_letter",
        modelType: "mistral-medium-latest",
        voicePreset: "signature",
        personalizationMode: "explicit_only",
        personalizationRichness: "rich",
        personalizationContext: {
          name: "Alex Martin",
          summary: "Frontend engineer focused on design systems.",
          topSkills: ["React", "TypeScript", "Design systems"],
          recentExperience: [
            {
              company: "Acme",
              position: "Senior Frontend Engineer",
              highlights: [
                "Led a design system migration used across four product squads.",
                "Improved release consistency across shared interface work.",
              ],
            },
          ],
          standoutAchievements: [
            "Improved release consistency across shared interface work.",
          ],
        },
      });

      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: "mistral-medium-latest",
        actualModelType: "chatgpt",
        actualModelName: "gpt-5-mini",
        fallbackTriggerCode: "premium_mistral_validation_failed",
        routing: {
          attemptedPath: "premium Mistral failed to GPT fallback",
          plannedPath: "structured",
          executedPath: "structured",
          fallbackReason: "premium_mistral_validation_failed",
          validatorOutcome: "structured_success",
          saveOutcome: "structured_saved",
        },
      });
      expect(result.proposalContent).not.toContain(brokenLegacyContent);
      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(mockOpenAIResponsesCreate).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      const mutationArgs = ctx.runMutation.mock.calls[0]?.[1] as {
        content?: string;
        metadata?: {
          requestedModelType?: string;
          actualModelType?: string;
          actualModelName?: string;
          fallbackTriggerCode?: string;
          fallback_reason?: string;
          save_outcome?: string;
          premium_path_saved?: boolean | null;
          premium_validation_passed?: boolean | null;
          tags?: string[];
        };
      };
      expect(mutationArgs.content).not.toContain(brokenLegacyContent);
      expect(mutationArgs.metadata).toEqual(
        expect.objectContaining({
          requestedModelType: "mistral-medium-latest",
          actualModelType: "chatgpt",
          actualModelName: "gpt-5-mini",
          fallbackTriggerCode: "premium_mistral_validation_failed",
          fallback_reason: "premium_mistral_validation_failed",
          save_outcome: "structured_saved",
          premium_path_saved: false,
          premium_validation_passed: true,
        }),
      );
      expect(mutationArgs.metadata?.save_outcome).not.toMatch(
        /^legacy_saved_(?:parsed|raw)$/,
      );
      expect(mutationArgs.metadata?.tags).toEqual(
        expect.arrayContaining([
          "model:chatgpt",
          "premium_cover_letter_path_v1",
          "generation_path:premium_mistral_failed_to_gpt_fallback",
        ]),
      );
      expect(mutationArgs.metadata?.tags ?? []).not.toContain(
        "model:mistral-medium-latest",
      );
      expect(mutationArgs.metadata?.tags ?? []).not.toContain(
        "generation_path:premium_path_saved",
      );
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        attemptedPath: "premium Mistral failed to GPT fallback",
        requestedModelType: "mistral-medium-latest",
        actualModelType: "chatgpt",
        fallbackTriggerCode: "premium_mistral_validation_failed",
        usedFallback: true,
        finalOutcome: "structured_saved",
        premium_path_saved: false,
        premium_validation_passed: true,
        normalizedFailureCode: null,
        runtimeFailureReason: null,
      });
      expect(
        warnSpy.mock.calls.some(
          ([message, details]) =>
            message === "Premium cover-letter returned null; using existing Mistral fallback." &&
            (details as { provider?: string })?.provider === "mistral",
        ),
      ).toBe(true);
    } finally {
      infoSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("logs the chatgpt premium failure trace before falling back to legacy", async () => {
    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5-mini";
    mockOpenAIResponsesCreate.mockResolvedValue({
      output: [
        {
          content: [
            {
              json: {
                version: "premium_writer_output_v1",
                bodyParts: {
                  opening: {
                    section: "opening",
                    text: "In recent roles with ADT Security and Copwatch, I monitored sites and documented observations.",
                    claimIds: ["claim_opening_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: [],
                  },
                  proofBlock: {
                    section: "proofBlock",
                    text: "I maintained HIPAA compliance standards across incident documentation.",
                    claimIds: ["claim_proof_001"],
                    factIds: ["fact_experience_002_highlight_001"],
                    demandIds: [],
                  },
                  employerValueBlock: {
                    section: "employerValueBlock",
                    text: "That records and monitoring background keeps the focus on clear documentation and steady observation.",
                    claimIds: ["claim_employer_value_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: ["demand_core_001"],
                  },
                  closeLine: {
                    section: "closeLine",
                    text: "I would be glad to discuss the position further.",
                    claimIds: ["claim_close_001"],
                    factIds: ["fact_experience_001_highlight_001"],
                    demandIds: [],
                  },
                },
              },
            },
          ],
        },
      ],
    });
    mockGpt4Generate.mockResolvedValue(
      [
        "At ADT Security, I completed reports by recording observations and surveillance activities.",
        "",
        "At Copwatch, I monitored selected areas through CCTV apps and scanned grounds for suspicious items.",
        "",
        "I would be glad to discuss the position further.",
      ].join("\n"),
    );

    const { handleGenerateProposal } = await loadProposalModule();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "engaging",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "High Level Security Officer",
        jobDescription:
          "Maintain site safety through structured patrols, access control, incident response, and clear reporting.",
        proposalType: "cover_letter",
        modelType: "chatgpt",
        voicePreset: "engaging",
        personalizationMode: "explicit_only",
        personalizationRichness: "rich",
        personalizationContext: {
          name: "Robert Cooper",
          summary:
            "Safety conscious Security Guard with eight years experience protecting VIP individuals and defense sites.",
          topSkills: [
            "Investigation skills",
            "Safety compliance",
            "Criminal justice knowledge",
          ],
          recentExperience: [
            {
              company: "ADT Security",
              position: "Security Guard",
              highlights: [
                "Completed reports by recording observations, occurrences, surveillance activities, and interviewing witnesses.",
              ],
            },
            {
              company: "Copwatch",
              position: "Security Guard",
              highlights: [
                "Monitored selected areas via CCTV app on smart devices and scanned grounds for suspicious items.",
              ],
            },
          ],
        },
      });

      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: "chatgpt",
        actualModelType: "chatgpt",
      });
      expect(mockOpenAIResponsesCreate).toHaveBeenCalledTimes(1);
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
      expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
        'Write a tailored employment cover letter for "High Level Security Officer".',
      );
      expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
        "Do not let the body read like a CV summary or a job-description summary",
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "Premium cover-letter failure trace",
        expect.objectContaining({
          provider: "openai",
          writerModel: "gpt-5-mini",
          stage: "validation",
          reason: "non_repairable_validation",
          contextClass: "cv_adjacent",
          issues: expect.arrayContaining(["unsupported_compliance_framework"]),
        }),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "Premium cover-letter returned null; using legacy fallback.",
        expect.objectContaining({
          provider: "openai",
          writerModel: "gpt-5-mini",
          failureTrace: expect.objectContaining({
            stage: "validation",
            reason: "non_repairable_validation",
            contextClass: "cv_adjacent",
            issues: expect.arrayContaining(["unsupported_compliance_framework"]),
          }),
        }),
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: expect.objectContaining({
            planned_path: "structured",
            executed_path: "legacy",
            fallback_reason: "premium_generation_failed",
            validator_outcome: "structured_failed",
            tags: expect.arrayContaining([
              "model:chatgpt",
              "generation_path:premium_fail_closed_to_legacy_fallback",
            ]),
          }),
        }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("routes an eligible qwen cover letter request through the premium path with qwen provider plumbing", async () => {
    process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1 = "1";
    process.env.QWEN_API_KEY = "sk-qwen";
    process.env.QWEN_CHAT_COMPLETIONS_URL =
      "https://qwen.test/chat/completions";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        qwenChatResponse(JSON.stringify(qwenPremiumBodyPartsFixture)),
      );

    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = createQwenPremiumCtx();

    try {
      const result = await handleGenerateProposal(ctx, qwenPremiumArgs());

      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: "qwen3.7-max",
        actualModelType: "qwen3.7-max",
        fallbackTriggerCode: null,
      });
      expect(result.proposalContent).toMatch(/^Dear Hiring Manager,/);
      const qwenRequest = expectQwenPremiumRequest(fetchSpy);
      const qwenPrompt = qwenRequest.messages?.[0]?.content ?? "";
      expect(qwenPrompt).toContain("Acme");
      expect(qwenPrompt).toContain(
        "Led a design system migration used across four product squads.",
      );
      expect(qwenPrompt).toContain(
        "Improved release consistency across shared interface work.",
      );
      expect(mockOpenAIResponsesCreate).not.toHaveBeenCalled();
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGenerateTechnicalProposal).not.toHaveBeenCalled();
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      const qwenMutationPayload = ctx.runMutation.mock.calls[0]?.[1] as {
        content?: string;
        metadata?: {
          planned_path?: string;
          executed_path?: string;
          fallback_reason?: string;
          validator_outcome?: string;
          save_outcome?: string;
          tags?: string[];
        };
      };
      expect(qwenMutationPayload.content).toBe(result.proposalContent);
      expect(qwenMutationPayload.metadata?.planned_path).toBe("structured");
      expect(qwenMutationPayload.metadata?.executed_path).toBe("structured");
      expect(qwenMutationPayload.metadata?.fallback_reason).toBe(
        "not_applicable",
      );
      expect(qwenMutationPayload.metadata?.validator_outcome).toBe(
        "structured_success",
      );
      expect(qwenMutationPayload.metadata?.save_outcome).toBe(
        "structured_saved",
      );
      expect(qwenMutationPayload.metadata?.tags).toEqual(
        expect.arrayContaining([
          "model:qwen3.7-max",
          "premium_cover_letter_path_v1",
          "feature_flag:cover_letter_premium_path_v1",
          "generation_path:premium_path_saved",
        ]),
      );
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        attemptedPath: "premium path saved",
        premium_path_saved: true,
        premium_validation_passed: true,
        premium_quality_shadow_passed: expect.any(Boolean),
        premium_quality_gate_passed: null,
        finalOutcome: "structured_saved",
        failureStage: null,
        requestedModelType: "qwen3.7-max",
        actualModelType: "qwen3.7-max",
        usedFallback: false,
        normalizedFailureCode: null,
        runtimeFailureReason: null,
      });
    } finally {
      infoSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  it.each([
    [
      "fenced json",
      `\`\`\`json\n${JSON.stringify(qwenPremiumBodyPartsFixture)}\n\`\`\``,
    ],
    [
      "single embedded json object",
      `Here is the JSON object:\n${JSON.stringify(qwenPremiumBodyPartsFixture)}\nDone.`,
    ],
  ])(
    "routes qwen premium successfully when response contains %s",
    async (_label, responseContent) => {
      process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1 = "1";
      process.env.QWEN_API_KEY = "sk-qwen";
      process.env.QWEN_CHAT_COMPLETIONS_URL =
        "https://qwen.test/chat/completions";

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(qwenChatResponse(responseContent));

      const { handleGenerateProposal } = await loadProposalModule();
      const ctx = createQwenPremiumCtx();
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      try {
        const result = await handleGenerateProposal(ctx, qwenPremiumArgs());

        expect(result).toMatchObject({
          proposalId: "proposal_123",
          requestedModelType: "qwen3.7-max",
          actualModelType: "qwen3.7-max",
          fallbackTriggerCode: null,
        });
        expectQwenPremiumRequest(fetchSpy);
        expect(mockOpenAIResponsesCreate).not.toHaveBeenCalled();
        expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
        expect(mockGenerateTechnicalProposal).not.toHaveBeenCalled();
        expect(ctx.runMutation).toHaveBeenCalledTimes(1);
        const qwenMutationPayload = ctx.runMutation.mock.calls[0]?.[1] as {
          metadata?: {
            planned_path?: string;
            executed_path?: string;
            fallback_reason?: string;
            validator_outcome?: string;
            save_outcome?: string;
            tags?: string[];
          };
        };
        expect(qwenMutationPayload.metadata?.planned_path).toBe("structured");
        expect(qwenMutationPayload.metadata?.executed_path).toBe("structured");
        expect(qwenMutationPayload.metadata?.fallback_reason).toBe(
          "not_applicable",
        );
        expect(qwenMutationPayload.metadata?.validator_outcome).toBe(
          "structured_success",
        );
        expect(qwenMutationPayload.metadata?.save_outcome).toBe(
          "structured_saved",
        );
        expect(qwenMutationPayload.metadata?.tags).toEqual(
          expect.arrayContaining([
            "premium_cover_letter_path_v1",
            "generation_path:premium_path_saved",
          ]),
        );
        expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
          attemptedPath: "premium path saved",
          premium_path_saved: true,
          premium_validation_passed: true,
          premium_quality_shadow_passed: expect.any(Boolean),
          premium_quality_gate_passed: null,
          finalOutcome: "structured_saved",
          requestedModelType: "qwen3.7-max",
          actualModelType: "qwen3.7-max",
          usedFallback: false,
        });
      } finally {
        infoSpy.mockRestore();
        fetchSpy.mockRestore();
      }
    },
  );

  it.each([
    ["prose-only response", "I cannot provide JSON for this request."],
    ["array json response", JSON.stringify([qwenPremiumBodyPartsFixture])],
    [
      "missing body-part field",
      JSON.stringify({
        opening: qwenPremiumBodyPartsFixture.opening,
        proofBlock: qwenPremiumBodyPartsFixture.proofBlock,
        employerValueBlock: qwenPremiumBodyPartsFixture.employerValueBlock,
      }),
    ],
    [
      "extra body-part field",
      JSON.stringify({
        ...qwenPremiumBodyPartsFixture,
        extra: "This field must not be accepted.",
      }),
    ],
  ])(
    "does not produce qwen premium success for %s",
    async (_label, responseContent) => {
      process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1 = "1";
      process.env.QWEN_API_KEY = "sk-qwen";
      process.env.QWEN_CHAT_COMPLETIONS_URL =
        "https://qwen.test/chat/completions";

      mockGpt4Generate.mockResolvedValue(
        "I led shared React and TypeScript interface work across customer-facing surfaces and stayed close to product decisions that shaped everyday user experience. That background keeps me focused on roles where interface quality, collaboration, and steady delivery all matter.",
      );
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(qwenChatResponse(responseContent));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { handleGenerateProposal } = await loadProposalModule();
      const ctx = createQwenPremiumCtx();

      try {
        const result = await handleGenerateProposal(ctx, qwenPremiumArgs());

        expect(result).toMatchObject({
          proposalId: "proposal_123",
          requestedModelType: "qwen3.7-max",
          actualModelType: "qwen3.7-max",
          fallbackTriggerCode: null,
        });
        expectQwenPremiumRequest(fetchSpy);
        expect(mockOpenAIResponsesCreate).not.toHaveBeenCalled();
        expect(mockGenerateTechnicalProposal).not.toHaveBeenCalled();
        expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
        expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
        expect(ctx.runMutation).toHaveBeenCalledTimes(1);
        const mutationPayload = ctx.runMutation.mock.calls[0]?.[1] as {
          metadata?: {
            planned_path?: string;
            executed_path?: string;
            fallback_reason?: string;
            validator_outcome?: string;
            save_outcome?: string;
            tags?: string[];
          };
        };
        expect(mutationPayload.metadata?.tags ?? []).not.toContain(
          "premium_cover_letter_path_v1",
        );
        expect(mutationPayload.metadata?.fallback_reason).toBe(
          "premium_generation_failed",
        );
        expect(mutationPayload.metadata?.validator_outcome).toBe(
          "structured_failed",
        );
        expect(
          warnSpy.mock.calls.some(
            ([message, details]) =>
              message === "Qwen premium cover-letter diagnostics" &&
              (details as { provider?: string })?.provider === "qwen",
          ),
        ).toBe(true);
      } finally {
        warnSpy.mockRestore();
        fetchSpy.mockRestore();
      }
    },
  );

  it("logs qwen validation diagnostics when valid body parts fail premium validation", async () => {
    process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1 = "1";
    process.env.QWEN_API_KEY = "sk-qwen";
    process.env.QWEN_CHAT_COMPLETIONS_URL =
      "https://qwen.test/chat/completions";

    const invalidButSchemaValidBodyParts = {
      opening:
        "I coordinated schedules, maintained records, handled vendor correspondence, and shared updates across teams.",
      proofBlock:
        "At Northline Services, I tracked deadlines and documented recurring customer updates.",
      employerValueBlock:
        "I hold a current driver's license and can bring licensed office mobility support when needed.",
      closeLine:
        "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
    };
    mockGpt4Generate.mockResolvedValue(
      "I maintained records, coordinated schedules, handled vendor correspondence, and shared timely updates across teams. That background keeps the focus on documentation, scheduling, and communication rather than unsupported claims.",
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        qwenChatResponse(JSON.stringify(invalidButSchemaValidBodyParts)),
      );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { handleGenerateProposal } = await loadProposalModule();
    const ctx = createQwenPremiumCtx();

    try {
      const result = await handleGenerateProposal(
        ctx,
        qwenAdjacentPremiumArgs(),
      );

      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: "qwen3.7-max",
        actualModelType: "qwen3.7-max",
        fallbackTriggerCode: null,
      });
      expectQwenPremiumRequest(fetchSpy);
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      const mutationPayload = ctx.runMutation.mock.calls[0]?.[1] as {
        metadata?: {
          fallback_reason?: string;
          validator_outcome?: string;
          tags?: string[];
        };
      };
      expect(mutationPayload.metadata?.tags ?? []).not.toContain(
        "premium_cover_letter_path_v1",
      );
      expect(mutationPayload.metadata?.fallback_reason).toBe(
        "premium_generation_failed",
      );
      expect(mutationPayload.metadata?.validator_outcome).toBe(
        "structured_failed",
      );
      expect(
        warnSpy.mock.calls.some(
          ([message, details]) =>
            message === "Qwen premium cover-letter diagnostics" &&
            (
              details as {
                provider?: string;
                stage?: string;
                reason?: string;
                validationIssues?: Array<{ code?: string }>;
              }
            )?.provider === "qwen" &&
            (details as { stage?: string })?.stage === "validation" &&
            (details as { reason?: string })?.reason ===
              "non_repairable_validation" &&
            (
              details as { validationIssues?: Array<{ code?: string }> }
            )?.validationIssues?.some(
              (issue) => issue.code === "unsupported_license_claim",
            ),
        ),
      ).toBe(true);
    } finally {
      warnSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  it("fails closed when qwen premium cover-letter credentials are missing", async () => {
    process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1 = "1";
    delete process.env.QWEN_API_KEY;
    process.env.QWEN_CHAT_COMPLETIONS_URL =
      "https://qwen.test/v1/chat/completions";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { handleGenerateProposal } = await loadProposalModule();

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn(),
    };

    try {
      await expect(
        handleGenerateProposal(ctx, {
          jobTitle: "Senior Frontend Engineer",
          jobDescription:
            "Lead React and TypeScript development across customer-facing product surfaces and collaborate closely with product teams.",
          proposalType: "cover_letter",
          modelType: "qwen3.7-max",
          voicePreset: "signature",
          personalizationMode: "explicit_only",
          personalizationRichness: "rich",
          personalizationContext: {
            name: "Alex Martin",
            summary: "Frontend engineer focused on design systems.",
            topSkills: ["React", "TypeScript", "Design systems"],
            recentExperience: [
              {
                company: "Acme",
                position: "Senior Frontend Engineer",
                highlights: [
                  "Led a design system migration used across four product squads.",
                ],
              },
            ],
          },
        }),
      ).rejects.toThrow(
        "Qwen API credentials are not configured for qwen3.7-max.",
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGenerateTechnicalProposal).not.toHaveBeenCalled();
      expect(ctx.runMutation).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("fails closed before fallback when qwen premium chat completions URL is missing", async () => {
    process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1 = "1";
    process.env.QWEN_API_KEY = "sk-qwen";
    delete process.env.QWEN_CHAT_COMPLETIONS_URL;
    delete process.env.QWEN_BASE_URL;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { handleGenerateProposal } = await loadProposalModule();

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn(),
    };

    try {
      await expect(
        handleGenerateProposal(ctx, {
          jobTitle: "Senior Frontend Engineer",
          jobDescription:
            "Lead React and TypeScript development across customer-facing product surfaces and collaborate closely with product teams.",
          proposalType: "cover_letter",
          modelType: "qwen3.7-max",
          voicePreset: "signature",
          personalizationMode: "explicit_only",
          personalizationRichness: "rich",
          personalizationContext: {
            name: "Alex Martin",
            summary: "Frontend engineer focused on design systems.",
            topSkills: ["React", "TypeScript", "Design systems"],
            recentExperience: [
              {
                company: "Acme",
                position: "Senior Frontend Engineer",
                highlights: [
                  "Led a design system migration used across four product squads.",
                ],
              },
            ],
          },
        }),
      ).rejects.toThrow(
        "Qwen API credentials are not configured for qwen3.7-max.",
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGenerateTechnicalProposal).not.toHaveBeenCalled();
      expect(ctx.runMutation).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("falls back to ChatGPT after a legacy-generation 429 in the CV-backed bypass path", async () => {
    mockModelInvoke.mockRejectedValue(makeRateLimitError(5));
    mockGpt4Generate.mockResolvedValue(
      "I led a design system migration used across four product squads and stayed close to the product-facing decisions that shaped everyday user experience. That background keeps me especially interested in roles where interface quality, collaboration, and iteration all matter in the final outcome.",
    );
    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "direct",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development across customer-facing product surfaces.",
        proposalType: "cover_letter",
        modelType: "mistral-small-latest",
        voicePreset: "direct",
        personalizationMode: "explicit_only",
        personalizationRichness: "rich",
        personalizationContext: {
          name: "Alex Martin",
          summary: "Frontend engineer focused on design systems.",
          topSkills: ["React", "TypeScript", "Design systems"],
          recentExperience: [
            {
              company: "Acme",
              position: "Senior Frontend Engineer",
              highlights: [
                "Led a design system migration used across four product squads.",
              ],
            },
          ],
        },
      });

      expect(mockChatParse).not.toHaveBeenCalled();
      expect(mockChatComplete).not.toHaveBeenCalled();
      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: "mistral-small-latest",
        actualModelType: "chatgpt",
        fallbackTriggerCode: "proposal_generation_provider_busy",
      });
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        structuredEligible: true,
        structuredEligibilityReason: "eligible",
        outcomeClass: "success",
        normalizedFailureCode: null,
        runtimeFailureReason: "runtime_failure:provider_busy",
        attemptedPath: "legacy-only path after planner bypass",
        requestedModelType: "mistral-small-latest",
        actualModelType: "chatgpt",
        fallbackTriggerCode: "proposal_generation_provider_busy",
        usedFallback: true,
        finalOutcome: expect.stringMatching(/^legacy_saved_(?:parsed|raw)$/),
        failureStage: "legacy_generation",
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: expect.objectContaining({
            requestedModelType: "mistral-small-latest",
            actualModelType: "chatgpt",
            fallbackTriggerCode: "proposal_generation_provider_busy",
            planned_path: "structured",
            executed_path: "legacy",
            fallback_reason: "provider_busy",
            save_outcome: expect.stringMatching(
              /^legacy_saved_(?:parsed|raw)$/,
            ),
            tags: expect.arrayContaining(["model:chatgpt"]),
          }),
        }),
      );
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("skips the planner and persists a successful no-CV request through the legacy path", async () => {
    mockChatParse.mockRejectedValue(makeRateLimitError());
    mockModelInvoke.mockResolvedValue({
      content:
        "Updating internal records and keeping recurring processes moving across teams depends on careful follow-through. Clear communication, organized handoffs, and consistent status updates are what make that support work effective in practice.",
    });
    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
        proposalType: "cover_letter",
        modelType: "mistral-small-latest",
        voicePreset: "signature",
        personalizationMode: "explicit_only",
      });

      expect(result).toMatchObject({
        proposalId: "proposal_123",
      });
      expect(result.proposalContent).toMatch(/^Dear Hiring Manager,/);
      expect(mockChatParse).not.toHaveBeenCalled();
      expect(mockChatComplete).not.toHaveBeenCalled();
      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          content: result.proposalContent,
          metadata: expect.objectContaining({
            planned_path: "legacy",
            executed_path: "legacy",
            fallback_reason: "missing_candidate_context",
          }),
        }),
      );
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        structuredEligible: false,
        structuredEligibilityReason: "context_gate:missing_candidate_context",
        outcomeClass: "success",
        normalizedFailureCode: null,
        runtimeFailureReason: null,
        attemptedPath: "legacy-only path",
        finalOutcome: expect.stringMatching(/^legacy_saved_(?:parsed|raw)$/),
        failureStage: null,
      });
      expect(getLoggedMistralDiagnostics(infoSpy)).toMatchObject({
        outcome: "success",
        mistralCallCount: 1,
        fallbackTriggered: false,
        requestedModelType: "mistral-small-latest",
        actualModelType: "mistral-small-latest",
        totalApproximateInputChars: expect.any(Number),
        totalApproximateInputTokens: expect.any(Number),
        totalApproximateOutputCharsKnown: expect.any(Number),
        totalApproximateOutputTokensKnown: expect.any(Number),
        perStageBreakdown: {
          legacy_generation: expect.objectContaining({
            count: 1,
          }),
        },
      });
      expect(getLoggedMistralDiagnostics(infoSpy).calls).toEqual([
        expect.objectContaining({
          sequence: 1,
          stage: "legacy_generation",
          modelType: "mistral-small-latest",
          status: "success",
          approximateInputChars: expect.any(Number),
          approximateInputTokens: expect.any(Number),
          approximateOutputChars: expect.any(Number),
          approximateOutputTokens: expect.any(Number),
        }),
      ]);
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("routes chatgpt no-CV cover letters through the inline cover-letter prompt instead of the creative proposal service", async () => {
    delete process.env.OPENAI_API_KEY;
    mockGpt4Generate.mockResolvedValue(
      "Updating internal records and keeping recurring processes moving across teams depends on careful follow-through. Clear communication, organized handoffs, and consistent status updates are what make that support work effective in practice.",
    );
    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
        proposalType: "cover_letter",
        modelType: "chatgpt",
        voicePreset: "signature",
        personalizationMode: "explicit_only",
      });

      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: "chatgpt",
        actualModelType: "chatgpt",
        fallbackTriggerCode: null,
      });
      expect(result.proposalContent).toMatch(/^Dear Hiring Manager,/);
      expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      const prompt = mockGpt4Generate.mock.calls[0]?.[0] ?? "";
      expect(prompt).toContain(
        'Write a tailored employment cover letter for "Operations Associate".',
      );
      expect(prompt).toContain(
        "When no candidate background is available, write a grounded, non-claiming cover-letter body",
      );
      expect(prompt).toContain(
        "Do not let the body read like a CV summary or a job-description summary",
      );
      expect(prompt).not.toContain(
        "Write a client-facing freelance proposal",
      );
      expect(prompt).not.toContain("Return exactly three labeled lines");
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      const mutationPayload = ctx.runMutation.mock.calls[0]?.[1] as {
        metadata?: { executed_path?: string; tags?: string[] };
      };
      expect(mutationPayload.metadata).toEqual(
        expect.objectContaining({
          executed_path: "legacy",
          tags: expect.arrayContaining(["model:chatgpt"]),
        }),
      );
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("falls back to ChatGPT after a legacy-generation 429 in the no-CV path", async () => {
    mockChatParse.mockRejectedValue(makeRateLimitError());
    mockModelInvoke.mockRejectedValue(makeRateLimitError(5));
    mockGpt4Generate.mockResolvedValue(
      "Updating internal records and keeping recurring processes moving across teams depends on careful follow-through. Clear communication, organized handoffs, and consistent status updates are what make that support work effective in practice.",
    );
    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "direct",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
        proposalType: "cover_letter",
        modelType: "mistral-small-latest",
        voicePreset: "direct",
        personalizationMode: "explicit_only",
      });

      expect(mockChatParse).not.toHaveBeenCalled();
      expect(mockChatComplete).not.toHaveBeenCalled();
      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: "mistral-small-latest",
        actualModelType: "chatgpt",
        fallbackTriggerCode: "proposal_generation_provider_busy",
      });
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        structuredEligible: false,
        structuredEligibilityReason: "context_gate:missing_candidate_context",
        outcomeClass: "success",
        normalizedFailureCode: null,
        runtimeFailureReason: "runtime_failure:provider_busy",
        attemptedPath: "legacy-only path",
        requestedModelType: "mistral-small-latest",
        actualModelType: "chatgpt",
        fallbackTriggerCode: "proposal_generation_provider_busy",
        usedFallback: true,
        finalOutcome: expect.stringMatching(/^legacy_saved_(?:parsed|raw)$/),
        failureStage: "legacy_generation",
      });
      expect(getLoggedMistralDiagnostics(infoSpy)).toMatchObject({
        outcome: "success",
        mistralCallCount: 1,
        fallbackTriggered: true,
        requestedModelType: "mistral-small-latest",
        actualModelType: "chatgpt",
        perStageBreakdown: {
          legacy_generation: expect.objectContaining({
            count: 1,
          }),
        },
      });
      expect(getLoggedMistralDiagnostics(infoSpy).calls).toEqual([
        expect.objectContaining({
          sequence: 1,
          stage: "legacy_generation",
          modelType: "mistral-small-latest",
          status: "failed_busy",
          approximateInputChars: expect.any(Number),
          approximateInputTokens: expect.any(Number),
          approximateOutputChars: null,
          approximateOutputTokens: null,
        }),
      ]);
      expect(ctx.runMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: expect.objectContaining({
            requestedModelType: "mistral-small-latest",
            actualModelType: "chatgpt",
            fallbackTriggerCode: "proposal_generation_provider_busy",
            planned_path: "legacy",
            executed_path: "legacy",
            fallback_reason: "provider_busy",
            save_outcome: expect.stringMatching(
              /^legacy_saved_(?:parsed|raw)$/,
            ),
            tags: expect.arrayContaining(["model:chatgpt"]),
          }),
        }),
      );
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("logs the diagnostics summary for a legacy-generation provider-busy failure when fallback is out of scope", async () => {
    mockChatParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: plannerResultFixture,
          },
        },
      ],
    });
    mockModelInvoke.mockRejectedValue(makeRateLimitError(9));
    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "direct",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn(),
    };

    try {
      await expect(
        handleGenerateProposal(ctx, {
          jobTitle: "Operations Associate",
          jobDescription:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
          proposalType: "application_message",
          modelType: "mistral-small-latest",
          voicePreset: "direct",
          personalizationMode: "explicit_only",
        }),
      ).rejects.toMatchObject({
        name: "ConvexError",
        data: expect.objectContaining({
          code: "proposal_generation_provider_busy",
          stage: "legacy_generation",
          retryAfterMs: 9000,
        }),
      });

      expect(mockChatParse).toHaveBeenCalledTimes(1);
      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).not.toHaveBeenCalled();
      expect(getLoggedMistralDiagnostics(infoSpy)).toMatchObject({
        outcome: "failure",
        mistralCallCount: 2,
        fallbackTriggered: false,
        requestedModelType: "mistral-small-latest",
        actualModelType: "mistral-small-latest",
        perStageBreakdown: {
          planner_parse: expect.objectContaining({
            count: 1,
          }),
          legacy_generation: expect.objectContaining({
            count: 1,
          }),
        },
      });
      expect(getLoggedMistralDiagnostics(infoSpy).calls).toEqual([
        expect.objectContaining({
          sequence: 1,
          stage: "planner_parse",
          status: "success",
        }),
        expect.objectContaining({
          sequence: 2,
          stage: "legacy_generation",
          status: "failed_busy",
        }),
      ]);
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("falls back to ChatGPT after a controlled legacy-generation transport failure in the no-CV path", async () => {
    mockModelInvoke.mockRejectedValue(makeContentLengthRequiredError());
    mockGpt4Generate.mockResolvedValue(
      "Updating internal records and keeping recurring processes moving across teams depends on careful follow-through. Clear communication, organized handoffs, and consistent status updates are what make that support work effective in practice.",
    );
    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "direct",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    try {
      const result = await handleGenerateProposal(ctx, {
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
        proposalType: "cover_letter",
        modelType: "mistral-small-latest",
        voicePreset: "direct",
        personalizationMode: "explicit_only",
      });

      expect(mockChatParse).not.toHaveBeenCalled();
      expect(mockChatComplete).not.toHaveBeenCalled();
      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        proposalId: "proposal_123",
        requestedModelType: "mistral-small-latest",
        actualModelType: "chatgpt",
        fallbackTriggerCode: "proposal_generation_provider_transport_error",
      });
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        structuredEligible: false,
        structuredEligibilityReason: "context_gate:missing_candidate_context",
        outcomeClass: "success",
        normalizedFailureCode: null,
        runtimeFailureReason: null,
        attemptedPath: "legacy-only path",
        requestedModelType: "mistral-small-latest",
        actualModelType: "chatgpt",
        fallbackTriggerCode: "proposal_generation_provider_transport_error",
        usedFallback: true,
        finalOutcome: expect.stringMatching(/^legacy_saved_(?:parsed|raw)$/),
        failureStage: "legacy_generation",
      });
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("routes chatgpt application messages through the inline prompt path instead of the legacy creative proposal service, even when a legacy preset must be normalized first", async () => {
    mockGpt4Generate.mockResolvedValue(
      [
        "opener: I’m reaching out about the Customer Support Specialist role because the day-to-day email and chat work is familiar ground for me.",
        "proof_line: At CloudLane, I handled daily chat and email queues and documented recurring issues into internal help content.",
        "follow_up_line: Happy to share the CloudLane example that maps most closely if helpful.",
      ].join("\n"),
    );
    const { handleGenerateProposal } = await loadProposalModule();

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    const result = await handleGenerateProposal(ctx, {
      jobTitle: "Customer Support Specialist",
      jobDescription:
        "Manage email and chat support, document recurring issues, keep communication calm and clear, and stay flexible with Microsoft Excel and Word.",
      proposalType: "application_message",
      modelType: "chatgpt",
      voicePreset: "direct",
      personalizationMode: "default",
      personalizationRichness: "sparse",
      personalizationContext: {
        name: "Marie Lopez",
        desiredPosition: "Customer Support Specialist",
        summary:
          "Customer support specialist with SaaS ticketing and documentation experience.",
        topSkills: ["Email Support", "Chat Support", "Knowledge Base Writing"],
        recentExperience: [
          {
            company: "CloudLane",
            position: "Support Associate",
            highlights: [
              "Handled daily chat and email queues for SaaS customers.",
              "Documented recurring issues into internal help content.",
            ],
          },
        ],
        standoutAchievements: [
          "Handled daily chat and email queues for SaaS customers.",
        ],
      },
    });

    expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
    expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      'Write a short recruiter-facing application message for "Customer Support Specialist".',
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "Application-message writer brief:",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "Write a short recruiter-facing note that reads like a real recruiter DM, a short email body, or a teaser note.",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "Return exactly three labeled lines and nothing else:",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "opener: <one short recruiter-facing sentence>",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "proof_line: <one short grounded sentence>",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "follow_up_line: <one short same-thread continuation sentence>",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "opener = contact context only. Name the role or contact context naturally. Do not carry proof, years, fit language, a background summary, or interest/application formulas.",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "proof_line = the only substantive sentence. Make it one concrete micro-proof: one real thing the candidate handled, shipped, designed, supported, operated, documented, or improved or, in no-context mode, one concrete work surface from the role.",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "When supported experience is the proof, name the employer, site, project, artifact, workflow, result, or operating surface instead of hiding it behind anonymous previous-role or previous-employer setup.",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "Do not open a new topic, ask for a conversation, offer extra detail, point to the profile or portfolio, repeat the proof, mention reply behavior, or summarize fit, readiness, value, or future contribution.",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "Application-message employer priority snapshot:",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "Application-message candidate priority snapshot:",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "Rank candidate-side proof by recruiter-useful overlap with the role before choosing what to lead with; do not default to the first available snippet.",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "strongest_candidate_proof: Handled daily chat and email queues for SaaS customers.",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "supported_scope_or_background: none",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "secondary_profile_signals_nonleading: none",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).not.toContain(
      "Candidate background for personalization:",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).not.toContain(
      "Professional summary:",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "strongest_work_surfaces: Manage email and chat support.",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).toContain(
      "lower_value_checklist_demoted: stay flexible with Microsoft Excel and Word.",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).not.toContain(
      "Voice preset overlay:",
    );
    expect(mockGpt4Generate.mock.calls[0]?.[0]).not.toContain(
      "Specificity contrast example:",
    );
    expect(result).toMatchObject({
      proposalId: "proposal_123",
      proposalContent:
        "I’m reaching out about the Customer Support Specialist role because the day-to-day email and chat work is familiar ground for me. At CloudLane, I handled daily chat and email queues and documented recurring issues into internal help content. Happy to share the CloudLane example that maps most closely if helpful.",
      requestedModelType: "chatgpt",
      actualModelType: "chatgpt",
      fallbackTriggerCode: null,
    });
    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          tags: expect.arrayContaining([
            "model:chatgpt",
            "generation_path:application_message_inline_path",
          ]),
        }),
      }),
    );
  });

  it("filters requirement-style candidate snippets out of the active chatgpt application-message prompt", async () => {
    mockGpt4Generate.mockResolvedValue(
      [
        "opener: I’m reaching out about the asset protection role because the loss-prevention side is the overlap I’d lead with.",
        "proof_line: At Hyatt, I reduced theft by 73% through tighter vigilance and monitoring procedures.",
        "follow_up_line: Open to pointing you to the closest example if helpful.",
      ].join("\n"),
    );
    const { handleGenerateProposal } = await loadProposalModule();

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    await handleGenerateProposal(ctx, {
      jobTitle: "Asset Protection Associate",
      jobDescription:
        "Support security and loss prevention work across the store, with 0-3 years of experience in security and loss prevention required. 1+ years in a retail/apparel environment is preferred, and the role works in customer-facing environments.",
      proposalType: "application_message",
      modelType: "chatgpt",
      voicePreset: "direct",
      personalizationMode: "default",
      personalizationRichness: "sparse",
      personalizationContext: {
        name: "Robert Cooper",
        desiredPosition: "Security Guard",
        summary:
          "I have 0-3 years of experience in security and loss prevention and 1+ years in a retail/apparel environment.",
        topSkills: [
          "Security and Loss Prevention",
          "Customer-Facing Environments",
          "1+ years in retail/apparel environment",
        ],
        recentExperience: [
          {
            company: "Hyatt",
            position: "Security Guard",
            highlights: [
              "Reduced theft by 73% through improved vigilance and monitoring procedures.",
              "Worked in customer-facing environments.",
              "0-3 years of experience in security and loss prevention.",
            ],
          },
        ],
        standoutAchievements: [
          "Reduced theft by 73% through improved vigilance and monitoring procedures.",
          "My background aligns well with the requirements.",
        ],
      },
    });

    const prompt = mockGpt4Generate.mock.calls[0]?.[0] ?? "";
    const candidatePriorityBlock = prompt
      .split("Application-message candidate priority snapshot:\n")[1]
      ?.split("\n\n")[0];

    expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
    expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
    expect(candidatePriorityBlock).toBeTruthy();
    expect(prompt).toContain(
      "Application-message candidate priority snapshot:",
    );
    expect(candidatePriorityBlock).toContain(
      "strongest_candidate_proof: Reduced theft by 73% through improved vigilance and monitoring procedures.",
    );
    expect(candidatePriorityBlock).toContain(
      "supported_scope_or_background: none",
    );
    expect(candidatePriorityBlock).toContain(
      "secondary_profile_signals_nonleading: none",
    );
    expect(candidatePriorityBlock).not.toContain("0-3 years of experience");
    expect(candidatePriorityBlock).not.toContain(
      "1+ years in a retail/apparel environment",
    );
    expect(candidatePriorityBlock).not.toContain(
      "Customer-Facing Environments",
    );
    expect(candidatePriorityBlock).not.toContain(
      "aligns well with the requirements",
    );
  });

  it("keeps generic soft-skill spillover out of last-resort application-message secondary signals", async () => {
    mockGpt4Generate.mockResolvedValue(
      [
        "opener: I’m looking for retail security work where entrance control matters day to day.",
        "proof_line: The loss-prevention side of the role is the part I’d want to build around.",
        "follow_up_line: If useful, I can share a bit more about why that overlap stands out.",
      ].join("\n"),
    );
    const { handleGenerateProposal } = await loadProposalModule();

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    await handleGenerateProposal(ctx, {
      jobTitle: "Security Guard",
      jobDescription:
        "Monitor entrances, help maintain customer flow, and support loss prevention coverage across the store.",
      proposalType: "application_message",
      modelType: "chatgpt",
      voicePreset: "direct",
      personalizationMode: "default",
      personalizationRichness: "sparse",
      personalizationContext: {
        name: "Robert Cooper",
        desiredPosition: "Security Guard",
        topSkills: ["Effective Communication", "Teamwork", "Loss Prevention"],
      },
    });

    const prompt = mockGpt4Generate.mock.calls[0]?.[0] ?? "";
    const candidatePriorityBlock = prompt
      .split("Application-message candidate priority snapshot:\n")[1]
      ?.split("\n\n")[0];

    expect(candidatePriorityBlock).toBeTruthy();
    expect(candidatePriorityBlock).toContain("strongest_candidate_proof: none");
    expect(candidatePriorityBlock).toContain(
      "supported_scope_or_background: none",
    );
    expect(candidatePriorityBlock).toContain(
      "secondary_profile_signals_nonleading: Security Guard | Loss Prevention",
    );
    expect(candidatePriorityBlock).not.toContain("Effective Communication");
    expect(candidatePriorityBlock).not.toContain("Teamwork");
  });

  it("prefers a stronger role-linked candidate proof over an earlier vanity metric in the active application-message prompt", async () => {
    mockGpt4Generate.mockResolvedValue(
      [
        "opener: I’m reaching out about the embedded Rust role because the Linux and real-time side is where my background is closest.",
        "proof_line: I built real-time multithreaded Rust software on Linux-based embedded devices, which is the clearest overlap here.",
        "follow_up_line: Happy to point you to the project that maps most closely if useful.",
      ].join("\n"),
    );
    const { handleGenerateProposal } = await loadProposalModule();

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "signature",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn().mockResolvedValue("proposal_123"),
    };

    await handleGenerateProposal(ctx, {
      jobTitle: "Embedded Software Engineer",
      jobDescription:
        "Build real-time multithreaded embedded software in Rust on Linux-based devices and support long lifecycle maintenance for cybersecurity products.",
      proposalType: "application_message",
      modelType: "chatgpt",
      voicePreset: "direct",
      personalizationMode: "default",
      personalizationRichness: "sparse",
      personalizationContext: {
        name: "Ari Chen",
        desiredPosition: "Embedded Software Engineer",
        recentExperience: [
          {
            company: "North Campus Devices",
            position: "Software Engineer",
            highlights: [
              "Contributed 50K+ lines of code to an established codebase via Git.",
              "Built real-time multithreaded Rust software on Linux-based embedded devices.",
            ],
          },
        ],
      },
    });

    const prompt = mockGpt4Generate.mock.calls[0]?.[0] ?? "";
    const candidatePriorityBlock = prompt
      .split("Application-message candidate priority snapshot:\n")[1]
      ?.split("\n\n")[0];

    expect(candidatePriorityBlock).toBeTruthy();
    expect(candidatePriorityBlock).toContain(
      "strongest_candidate_proof: Built real-time multithreaded Rust software on Linux-based embedded devices.",
    );
    expect(candidatePriorityBlock).toContain(
      "supported_scope_or_background: none",
    );
    expect(candidatePriorityBlock).not.toContain(
      "Contributed 50K+ lines of code to an established codebase via Git.",
    );
  });

  it("preserves the existing error path for unexpected legacy-generation failures without attempting fallback", async () => {
    mockModelInvoke.mockRejectedValue(new Error("unexpected legacy failure"));
    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "direct",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn(),
    };

    try {
      await expect(
        handleGenerateProposal(ctx, {
          jobTitle: "Operations Associate",
          jobDescription:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
          proposalType: "cover_letter",
          modelType: "mistral-small-latest",
          voicePreset: "direct",
          personalizationMode: "explicit_only",
        }),
      ).rejects.toThrow("unexpected legacy failure");

      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(ctx.runMutation).not.toHaveBeenCalled();
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        structuredEligible: false,
        structuredEligibilityReason: "context_gate:missing_candidate_context",
        outcomeClass: "unexpected_failure",
        normalizedFailureCode: null,
        attemptedPath: "legacy-only path",
        requestedModelType: "mistral-small-latest",
        actualModelType: "mistral-small-latest",
        fallbackTriggerCode: null,
        usedFallback: false,
        finalOutcome: "not_saved",
        failureStage: null,
      });
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("does not fall back when the controlled failure is outside the legacy-generation fallback boundary", async () => {
    mockModelInvoke.mockResolvedValue({
      content: [
        "Dear Hiring Manager,",
        "",
        "I would welcome the opportunity to discuss the position further.",
        "",
        "Sincerely,",
        "Board Ramanathapuram",
      ].join("\n"),
    });
    const { handleGenerateProposal } = await loadProposalModule();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockResolvedValue({
        _id: "profile_123",
        proposalVoicePreset: "direct",
        experience: [],
        skills: [],
        achievements: [],
      }),
      runMutation: vi.fn(),
    };

    try {
      await expect(
        handleGenerateProposal(ctx, {
          jobTitle: "Operations Associate",
          jobDescription:
            "Support recurring processes, update internal records, and coordinate communication across teams.",
          proposalType: "cover_letter",
          modelType: "mistral-small-latest",
          voicePreset: "direct",
          personalizationMode: "explicit_only",
        }),
      ).rejects.toMatchObject({
        name: "ConvexError",
        message: expect.stringContaining(
          "Proposal generation failed closed during finalization.",
        ),
      });

      expect(mockModelInvoke).toHaveBeenCalledTimes(1);
      expect(mockGenerateCreativeProposal).not.toHaveBeenCalled();
      expect(ctx.runMutation).not.toHaveBeenCalled();
      expect(getLoggedRoutingTelemetry(infoSpy)).toMatchObject({
        structuredEligible: false,
        structuredEligibilityReason: "context_gate:missing_candidate_context",
        outcomeClass: "other_controlled_failure",
        normalizedFailureCode: "proposal_generation_finalization_failed_closed",
        attemptedPath: "legacy-only path",
        requestedModelType: "mistral-small-latest",
        actualModelType: "mistral-small-latest",
        fallbackTriggerCode: null,
        usedFallback: false,
        finalOutcome: "fail_closed",
        failureStage: "cleaned_body_selection",
      });
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("aborts an in-flight chatgpt generation when cancellation is requested", async () => {
    vi.useFakeTimers();
    mockGpt4Generate.mockImplementation(
      (_prompt: string, config: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          config.signal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );
    const { handleGenerateProposal } = await loadProposalModule();

    let pollCount = 0;
    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
      },
      runQuery: vi.fn().mockImplementation((_ref, args) => {
        if (args && typeof args === "object" && "jobId" in args) {
          pollCount += 1;
          return Promise.resolve({
            status: pollCount >= 3 ? "cancel_requested" : "processing",
          });
        }

        return Promise.resolve({
          _id: "profile_123",
          proposalVoicePreset: "direct",
          experience: [],
          skills: [],
          achievements: [],
        });
      }),
      runMutation: vi.fn().mockImplementation((_ref, args) => {
        if (args?.clientRunId) {
          return Promise.resolve("job_cancel_123");
        }
        if (args?.jobId && args?.status) {
          return Promise.resolve(null);
        }
        if (args?.content) {
          throw new Error("proposal should not be stored after cancellation");
        }
        return Promise.resolve(null);
      }),
    };

    const generationPromise = handleGenerateProposal(ctx, {
      clientRunId: "run_cancel_123",
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes, update internal records, and coordinate communication across teams.",
      proposalType: "application_message",
      modelType: "chatgpt",
      voicePreset: "direct",
      personalizationMode: "explicit_only",
    });
    const settledGenerationPromise = generationPromise.catch((error) => error);

    await vi.advanceTimersByTimeAsync(300);

    const cancellationError = await settledGenerationPromise;
    expect(cancellationError).toMatchObject({
      name: "ConvexError",
      message: "Proposal generation canceled.",
    });
    expect(mockGpt4Generate).toHaveBeenCalledTimes(1);
    expect(ctx.runMutation).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        content: expect.any(String),
      }),
    );
    vi.useRealTimers();
  });
});
