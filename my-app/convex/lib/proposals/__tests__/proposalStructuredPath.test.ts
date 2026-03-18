import { describe, expect, it, vi } from "vitest";

import {
  assertStructuredCoverLetterRoutingConsistency,
  attemptStructuredCoverLetterGeneration,
  buildCoverLetterRoutingTelemetry,
  evaluateStructuredCoverLetterRolloutEligibility,
} from "../../../generateProposalMutation";
import type { StructuredCoverLetterContentPlan } from "../proposalContentPlan";
import type { ProposalPlannerResult } from "../proposalPlanner";

const basePlannerResult: ProposalPlannerResult = {
  context_mode: "rich",
  domain_gap: "direct",
  credential_status: "exact_required",
  transfer_mode: "literal",
  output_language: "en",
  allowed_concrete_facts: [
    "Improved signup conversion by 11 percent after iterative UI experiments.",
    "Led a design system migration used across 4 product squads.",
    "Built experimentation dashboards used by product and growth teams.",
  ],
  allowed_transfer_themes: [
    "cross-functional collaboration",
    "design systems",
    "product-facing web apps",
  ],
  disallowed_claims: [],
  identity_hard_stops: [],
  proof_strategy: "concrete_supported",
  opening_strategy: "direct_fast",
};

const validContentPlan: StructuredCoverLetterContentPlan = {
  schema_version: 1,
  format: "cover_letter",
  language: "en",
  voice_preset: "direct",
  opening_strategy: "direct_fast",
  no_context_mode: false,
  body_paragraphs: [
    {
      role: "opening",
      fact_ids: [1],
      theme_ids: [0, 2],
    },
    {
      role: "evidence",
      fact_ids: [0, 2],
      theme_ids: [1],
    },
  ],
};

const validStructuredBody = [
  "I led a design system migration used across 4 product squads, and that work kept me close to product-facing web apps and cross-functional collaboration every day.",
  "I improved signup conversion by 11 percent through iterative UI experiments and built experimentation dashboards used by product and growth teams, which gave me a practical view of how interface decisions affect product outcomes.",
].join("\n\n");

const threeParagraphContentPlan: StructuredCoverLetterContentPlan = {
  schema_version: 1,
  format: "cover_letter",
  language: "en",
  voice_preset: "direct",
  opening_strategy: "direct_fast",
  no_context_mode: false,
  body_paragraphs: [
    {
      role: "opening",
      fact_ids: [1],
      theme_ids: [0, 2],
    },
    {
      role: "evidence",
      fact_ids: [0, 2],
      theme_ids: [1],
    },
    {
      role: "motivation",
      fact_ids: [],
      theme_ids: [0, 2],
    },
  ],
};

const validThreeParagraphStructuredBody = [
  "I led a design system migration used across 4 product squads, which kept me close to reusable UI work and day-to-day collaboration with product and design.",
  "I improved signup conversion by 11 percent through iterative UI experiments and built experimentation dashboards used by product and growth teams.",
  "What stands out to me about this role is the chance to keep working on reusable interfaces, performance, and customer-facing workflows in close partnership with product and design.",
].join("\n\n");

const noContextPlannerResult: ProposalPlannerResult = {
  context_mode: "none",
  domain_gap: "distant",
  credential_status: "unsupported",
  transfer_mode: "no_operational_analogy",
  output_language: "en",
  allowed_concrete_facts: [],
  allowed_transfer_themes: [
    "interest in the role",
    "role understanding",
    "reliability",
    "clear communication",
    "willingness to learn",
  ],
  disallowed_claims: [],
  identity_hard_stops: [],
  proof_strategy: "none",
  opening_strategy: "signature_default",
};

const noContextContentPlan: StructuredCoverLetterContentPlan = {
  schema_version: 1,
  format: "cover_letter",
  language: "en",
  voice_preset: "direct",
  opening_strategy: "signature_default",
  no_context_mode: true,
  body_paragraphs: [
    {
      role: "opening",
      fact_ids: [],
      theme_ids: [0, 1],
    },
    {
      role: "evidence",
      fact_ids: [],
      theme_ids: [2, 3, 4],
    },
  ],
};

const validNoContextStructuredBody = [
  "What interests me about this Operations Associate role is the chance to keep recurring processes organized and communication moving clearly across teams.",
  "The emphasis on reliability, clear communication, and willingness to learn stands out to me because the role depends on steady follow-through in day-to-day work.",
].join("\n\n");

describe("structured cover letter path", () => {
  it("returns a direct-persistence payload when guided whole-body generation succeeds", async () => {
    expect(
      evaluateStructuredCoverLetterRolloutEligibility({
        modelType: "mistral-small-latest",
        outputFormat: "cover_letter",
        contextMode: "rich",
        sourceFactBank: basePlannerResult.allowed_concrete_facts,
      }),
    ).toEqual({
      eligible: true,
      plannedPath: "structured",
      fallbackReason: "not_applicable",
      sourceFactBankWarnings: [],
    });

    const generateBody = vi.fn().mockResolvedValue(validStructuredBody);
    const generateParagraph = vi.fn();

    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi.fn().mockResolvedValue(validContentPlan),
        generateBody,
        generateParagraph,
        analyzeDraft: vi.fn().mockReturnValue({
          issues: [],
          flaggedSentences: [],
        }),
      },
    );

    expect(result).not.toBeNull();
    expect(result?.generationPath).toBe("structured_success");
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("Best regards,");
    expect(result?.content).toContain(
      "I would welcome the opportunity to speak further about the position.",
    );
    expect(result?.sections).toEqual([
      {
        type: "text",
        content: result?.content,
      },
    ]);
    expect(generateBody).toHaveBeenCalledTimes(1);
    expect(generateParagraph).not.toHaveBeenCalled();
  });

  it("keeps no-context cover letters excluded from structured generation under the default rollout", () => {
    expect(
      evaluateStructuredCoverLetterRolloutEligibility({
        modelType: "mistral-small-latest",
        outputFormat: "cover_letter",
        contextMode: "none",
        sourceFactBank: [],
      }),
    ).toEqual({
      eligible: false,
      plannedPath: "legacy",
      fallbackReason: "missing_candidate_context",
      sourceFactBankWarnings: [],
    });
  });

  it("keeps polluted CV-backed cover letters on legacy with an explicit typed reason", () => {
    expect(
      evaluateStructuredCoverLetterRolloutEligibility({
        modelType: "mistral-small-latest",
        outputFormat: "cover_letter",
        contextMode: "rich",
        rolloutValue: "small_cover_letters",
        sourceFactBank: [
          "8 month work experience in Home Credit India Finance Pvt.",
          "Built experimentation dashboards used by product and growth teams.",
        ],
      }),
    ).toEqual({
      eligible: false,
      plannedPath: "legacy",
      fallbackReason: "polluted_source_fact_bank",
      sourceFactBankWarnings: ["numeric_residue"],
    });
  });

  it("builds structured rejected reasons for context, eligibility, and fallback-before-attempt routing logs", () => {
    const noContextTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "expert",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "off",
      contextMode: "none",
      sourceFactBank: [],
      structuredEligible: false,
      structuredEligibilityFallbackReason: "missing_candidate_context",
      fallbackReason: "missing_candidate_context",
      attemptedPath: "legacy-only path",
      finalOutcome: "fail_closed",
    });
    expect(noContextTelemetry.resolvedStructuredRolloutMode).toBe("disabled");
    expect(noContextTelemetry.structuredEligibilityReason).toBe(
      "context_gate:missing_candidate_context",
    );
    expect(noContextTelemetry.runtimeFailureReason).toBeNull();
    expect(noContextTelemetry.counterfactualNextStructuredGate).toBe(
      "missing_candidate_context",
    );
    expect(noContextTelemetry.outcomeClass).toBe("other_controlled_failure");
    expect(noContextTelemetry.normalizedFailureCode).toBeNull();

    const pollutedTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "expert",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "off",
      contextMode: "rich",
      sourceFactBank: [
        "8 month work experience in Home Credit India Finance Pvt.",
      ],
      structuredEligible: false,
      structuredEligibilityFallbackReason: "polluted_source_fact_bank",
      fallbackReason: "polluted_source_fact_bank",
      attemptedPath: "legacy-only path",
      finalOutcome: "legacy_saved_raw",
    });
    expect(pollutedTelemetry.structuredEligibilityReason).toBe(
      "eligibility_gate:polluted_source_fact_bank",
    );
    expect(pollutedTelemetry.runtimeFailureReason).toBeNull();
    expect(pollutedTelemetry.counterfactualNextStructuredGate).toBe(
      "polluted_source_fact_bank",
    );
    expect(pollutedTelemetry.outcomeClass).toBe("success");
    expect(pollutedTelemetry.normalizedFailureCode).toBeNull();

    const fallbackTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "expert",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "small_cover_letters",
      contextMode: "rich",
      sourceFactBank: basePlannerResult.allowed_concrete_facts,
      structuredEligible: true,
      structuredEligibilityFallbackReason: "not_applicable",
      fallbackReason: "structured_plan_parse_fail",
      attemptedPath: "structured fail-closed to legacy fallback",
      finalOutcome: "legacy_saved_raw",
    });
    expect(fallbackTelemetry.structuredEligibilityReason).toBe("eligible");
    expect(fallbackTelemetry.runtimeFailureReason).toBe(
      "fallback_before_attempt:structured_plan_parse_fail",
    );
    expect(fallbackTelemetry.counterfactualNextStructuredGate).toBe("eligible");
    expect(fallbackTelemetry.outcomeClass).toBe("success");
    expect(fallbackTelemetry.normalizedFailureCode).toBeNull();

    const plannerBypassTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "expert",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "small_cover_letters",
      contextMode: "rich",
      sourceFactBank: basePlannerResult.allowed_concrete_facts,
      structuredEligible: true,
      structuredEligibilityFallbackReason: "not_applicable",
      fallbackReason: "planner_dependency_bypassed",
      attemptedPath: "legacy-only path after planner bypass",
      finalOutcome: "legacy_saved_raw",
    });
    expect(plannerBypassTelemetry.structuredEligibilityReason).toBe("eligible");
    expect(plannerBypassTelemetry.runtimeFailureReason).toBeNull();
    expect(plannerBypassTelemetry.attemptedPath).toBe(
      "legacy-only path after planner bypass",
    );
    expect(plannerBypassTelemetry.counterfactualNextStructuredGate).toBe(
      "eligible",
    );
    expect(plannerBypassTelemetry.outcomeClass).toBe("success");
    expect(plannerBypassTelemetry.normalizedFailureCode).toBeNull();

    const finalizationFailureTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "expert",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "small_cover_letters",
      contextMode: "rich",
      sourceFactBank: basePlannerResult.allowed_concrete_facts,
      structuredEligible: true,
      structuredEligibilityFallbackReason: "not_applicable",
      fallbackReason: "planner_dependency_bypassed",
      attemptedPath: "legacy-only path after planner bypass",
      finalOutcome: "fail_closed",
      failureStage: "legacy_generation",
      normalizedFailureCode: "proposal_generation_finalization_failed_closed",
    });
    expect(finalizationFailureTelemetry.outcomeClass).toBe(
      "other_controlled_failure",
    );
    expect(finalizationFailureTelemetry.normalizedFailureCode).toBe(
      "proposal_generation_finalization_failed_closed",
    );
  });

  it("keeps missing candidate context visible when an ineligible request also hits provider busy", () => {
    const providerBusyNoCvTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "signature",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "small_cover_letters",
      contextMode: "none",
      sourceFactBank: [],
      structuredEligible: false,
      structuredEligibilityFallbackReason: "missing_candidate_context",
      fallbackReason: "provider_busy",
      attemptedPath: "legacy-only path",
      finalOutcome: "not_saved",
      failureStage: "planner_parse",
      normalizedFailureCode: "proposal_generation_provider_busy",
    });

    expect(providerBusyNoCvTelemetry.structuredEligibilityReason).toBe(
      "context_gate:missing_candidate_context",
    );
    expect(providerBusyNoCvTelemetry.runtimeFailureReason).toBe(
      "runtime_failure:provider_busy",
    );
    expect(providerBusyNoCvTelemetry.outcomeClass).toBe("provider_busy");
    expect(providerBusyNoCvTelemetry.normalizedFailureCode).toBe(
      "proposal_generation_provider_busy",
    );
    expect(providerBusyNoCvTelemetry.attemptedPath).toBe(
      "planner-only path before legacy generation",
    );
    expect(providerBusyNoCvTelemetry.failureStage).toBe("planner_parse");
    expect(providerBusyNoCvTelemetry.counterfactualNextStructuredGate).toBe(
      "missing_candidate_context",
    );
  });

  it("reports eligible structured routing and provider busy separately for cv-backed requests", () => {
    const providerBusyEligibleTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "signature",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "small_cover_letters",
      contextMode: "rich",
      sourceFactBank: basePlannerResult.allowed_concrete_facts,
      structuredEligible: true,
      structuredEligibilityFallbackReason: "not_applicable",
      fallbackReason: "provider_busy",
      attemptedPath: "structured fail-closed to legacy fallback",
      finalOutcome: "not_saved",
      failureStage: "planner_parse",
      normalizedFailureCode: "proposal_generation_provider_busy",
    });

    expect(providerBusyEligibleTelemetry.structuredEligibilityReason).toBe(
      "eligible",
    );
    expect(providerBusyEligibleTelemetry.runtimeFailureReason).toBe(
      "runtime_failure:provider_busy",
    );
    expect(providerBusyEligibleTelemetry.outcomeClass).toBe("provider_busy");
    expect(providerBusyEligibleTelemetry.normalizedFailureCode).toBe(
      "proposal_generation_provider_busy",
    );
    expect(providerBusyEligibleTelemetry.attemptedPath).toBe(
      "planner-only path before structured generation",
    );
    expect(providerBusyEligibleTelemetry.failureStage).toBe("planner_parse");
    expect(providerBusyEligibleTelemetry.counterfactualNextStructuredGate).toBe(
      "eligible",
    );
  });

  it("records later provider-busy stages with truthful attempted path labels", () => {
    const structuredBodyBusyTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "signature",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "small_cover_letters",
      contextMode: "rich",
      sourceFactBank: basePlannerResult.allowed_concrete_facts,
      structuredEligible: true,
      structuredEligibilityFallbackReason: "not_applicable",
      fallbackReason: "provider_busy",
      attemptedPath: "structured fail-closed to legacy fallback",
      finalOutcome: "not_saved",
      failureStage: "structured_body_generation",
      normalizedFailureCode: "proposal_generation_provider_busy",
    });

    expect(structuredBodyBusyTelemetry.runtimeFailureReason).toBe(
      "runtime_failure:provider_busy",
    );
    expect(structuredBodyBusyTelemetry.outcomeClass).toBe("provider_busy");
    expect(structuredBodyBusyTelemetry.attemptedPath).toBe(
      "structured-only path before legacy fallback",
    );
    expect(structuredBodyBusyTelemetry.failureStage).toBe(
      "structured_body_generation",
    );

    const bypassedEligibleLegacyBusyTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "direct",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "small_cover_letters",
      contextMode: "rich",
      sourceFactBank: basePlannerResult.allowed_concrete_facts,
      structuredEligible: true,
      structuredEligibilityFallbackReason: "not_applicable",
      fallbackReason: "provider_busy",
      attemptedPath: "legacy-only path after planner bypass",
      finalOutcome: "not_saved",
      failureStage: "legacy_generation",
      normalizedFailureCode: "proposal_generation_provider_busy",
    });

    expect(bypassedEligibleLegacyBusyTelemetry.runtimeFailureReason).toBe(
      "runtime_failure:provider_busy",
    );
    expect(bypassedEligibleLegacyBusyTelemetry.outcomeClass).toBe(
      "provider_busy",
    );
    expect(bypassedEligibleLegacyBusyTelemetry.attemptedPath).toBe(
      "legacy-only path after planner bypass",
    );
    expect(bypassedEligibleLegacyBusyTelemetry.failureStage).toBe(
      "legacy_generation",
    );

    const legacyBusyTelemetry = buildCoverLetterRoutingTelemetry({
      preset: "direct",
      modelType: "mistral-small-latest",
      outputFormat: "cover_letter",
      rolloutValue: "small_cover_letters",
      contextMode: "none",
      sourceFactBank: [],
      structuredEligible: false,
      structuredEligibilityFallbackReason: "missing_candidate_context",
      fallbackReason: "provider_busy",
      attemptedPath: "legacy-only path",
      finalOutcome: "not_saved",
      failureStage: "legacy_generation",
      normalizedFailureCode: "proposal_generation_provider_busy",
    });

    expect(legacyBusyTelemetry.runtimeFailureReason).toBe(
      "runtime_failure:provider_busy",
    );
    expect(legacyBusyTelemetry.outcomeClass).toBe("provider_busy");
    expect(legacyBusyTelemetry.attemptedPath).toBe("legacy-only path");
    expect(legacyBusyTelemetry.failureStage).toBe("legacy_generation");
  });

  it("returns null without invoking structured dependencies when the feature flag is off", async () => {
    const buildContentPlan = vi.fn();
    const generateBody = vi.fn();
    const generateParagraph = vi.fn();

    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: false,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan,
        generateBody,
        generateParagraph,
      },
    );

    expect(result).toBeNull();
    expect(buildContentPlan).not.toHaveBeenCalled();
    expect(generateBody).not.toHaveBeenCalled();
    expect(generateParagraph).not.toHaveBeenCalled();
  });

  it("reports a typed fallback reason when an eligible structured request falls back", async () => {
    let fallbackReason: string | null = null;

    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi
          .fn()
          .mockRejectedValue(new Error("plan parse failed")),
        onFallbackReason: (reason) => {
          fallbackReason = reason;
        },
      },
    );

    expect(result).toBeNull();
    expect(fallbackReason).toBe("structured_plan_parse_fail");
  });

  it("propagates provider-busy failures instead of collapsing to a typed structured fallback", async () => {
    let fallbackReason: string | null = null;
    const providerBusyError = {
      name: "ProposalProviderBusyError",
      message:
        "Proposal generation provider busy. provider=mistral stage=structured_plan_parse",
      provider: "mistral",
      stage: "structured_plan_parse",
    };

    await expect(
      attemptStructuredCoverLetterGeneration(
        {
          gateEnabled: true,
          mistralKey: "sk-test",
          modelType: "mistral-small-latest",
          plannerResult: basePlannerResult,
          outputFormat: "cover_letter",
          outputLanguage: "English",
          candidateName: "Alex Martin",
          voicePreset: "direct",
          jobTitle: "Senior Frontend Engineer",
          jobDescription: "Lead React and TypeScript development.",
        },
        {
          buildContentPlan: vi.fn().mockRejectedValue(providerBusyError),
          onFallbackReason: (reason) => {
            fallbackReason = reason;
          },
        },
      ),
    ).rejects.toMatchObject({
      name: "ProposalProviderBusyError",
      provider: "mistral",
      stage: "structured_plan_parse",
    });

    expect(fallbackReason).toBeNull();
  });

  it("does not allow eligible structured routing to collapse to legacy without a typed fallback reason", () => {
    expect(() =>
      assertStructuredCoverLetterRoutingConsistency({
        plannedPath: "structured",
        executedPath: "legacy",
        attemptedGenerationPath: "legacy-only path",
        fallbackReason: "not_applicable",
      }),
    ).toThrow(/typed fallback reason/i);

    expect(() =>
      assertStructuredCoverLetterRoutingConsistency({
        plannedPath: "structured",
        executedPath: "legacy",
        attemptedGenerationPath: "structured fail-closed to legacy fallback",
        fallbackReason: "structured_plan_parse_fail",
      }),
    ).not.toThrow();

    expect(() =>
      assertStructuredCoverLetterRoutingConsistency({
        plannedPath: "structured",
        executedPath: "legacy",
        attemptedGenerationPath: "legacy-only path after planner bypass",
        fallbackReason: "planner_dependency_bypassed",
      }),
    ).not.toThrow();
  });

  it("accepts a coherent three-paragraph body with a distinct motivation close and renders boundaries correctly", async () => {
    const expertThreeParagraphContentPlan: StructuredCoverLetterContentPlan = {
      ...threeParagraphContentPlan,
      voice_preset: "expert",
    };
    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "expert",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi
          .fn()
          .mockResolvedValue(expertThreeParagraphContentPlan),
        generateBody: vi.fn().mockResolvedValue(validThreeParagraphStructuredBody),
        analyzeDraft: vi.fn().mockReturnValue({
          issues: [],
          flaggedSentences: [],
        }),
      },
    );

    expect(result).not.toBeNull();
    expect(result?.generationPath).toBe("structured_success");
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain(
      "What stands out to me about this role is the chance to keep working on reusable interfaces, performance, and customer-facing workflows in close partnership with product and design.",
    );
    expect(result?.content).toContain(
      "I would welcome the chance to discuss the position further.",
    );
  });

  it("fails closed to legacy when a structured stage throws", async () => {
    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi
          .fn()
          .mockRejectedValue(new Error("plan parse failed")),
      },
    );

    expect(result).toBeNull();
  });

  it("fails closed when generated body validation rejects leaked boundary text", async () => {
    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi.fn().mockResolvedValue(validContentPlan),
        generateBody: vi.fn().mockResolvedValue(
          [
            "I led a design system migration used across 4 product squads, and that work kept me close to cross-functional collaboration and product-facing web apps.",
            [
              "I improved signup conversion by 11 percent through iterative UI experiments.",
              "Best regards,",
              "Alex MartinThe remote engagement model requires clear async collaboration.",
            ].join("\n"),
          ].join("\n\n"),
        ),
      },
    );

    expect(result).toBeNull();
  });

  it("retries guided whole-body generation when the first draft fails quality validation", async () => {
    const generateBody = vi
      .fn()
      .mockResolvedValueOnce(
        [
          "I led a design system migration used across 4 product squads, and that work kept me close to product-facing web apps.",
          "I improved signup conversion by 11 percent through iterative UI experiments, which makes me particularly compelling for this role.",
        ].join("\n\n"),
      )
      .mockResolvedValueOnce(validStructuredBody);

    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi.fn().mockResolvedValue(validContentPlan),
        generateBody,
        analyzeDraft: vi.fn().mockReturnValue({
          issues: [],
          flaggedSentences: [],
        }),
      },
    );

    expect(result).not.toBeNull();
    expect(generateBody).toHaveBeenCalledTimes(2);
  });

  it("retries guided whole-body generation when the first draft repeats the same sentence across paragraphs", async () => {
    const repeatedSentence =
      "I led a design system migration used across 4 product squads and improved signup conversion by 11 percent while building experimentation dashboards used by product and growth teams.";
    const generateBody = vi
      .fn()
      .mockResolvedValueOnce([repeatedSentence, repeatedSentence].join("\n\n"))
      .mockResolvedValueOnce(validStructuredBody);

    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi.fn().mockResolvedValue(validContentPlan),
        generateBody,
        analyzeDraft: vi.fn().mockReturnValue({
          issues: [],
          flaggedSentences: [],
        }),
      },
    );

    expect(result).not.toBeNull();
    expect(generateBody).toHaveBeenCalledTimes(2);
  });

  it("retries guided whole-body generation when the first draft repeats the same rhetorical opening across paragraphs", async () => {
    const expertThreeParagraphContentPlan: StructuredCoverLetterContentPlan = {
      ...threeParagraphContentPlan,
      voice_preset: "expert",
    };
    const generateBody = vi
      .fn()
      .mockResolvedValueOnce(
        [
          "What interests me about this role is the mix of reusable UI systems and close product collaboration.",
          "I improved signup conversion by 11 percent through iterative UI experiments and built experimentation dashboards used by product and growth teams.",
          "What interests me about this role is the chance to keep working on reusable interfaces and customer-facing workflows.",
        ].join("\n\n"),
      )
      .mockResolvedValueOnce(validThreeParagraphStructuredBody);

    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "expert",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi
          .fn()
          .mockResolvedValue(expertThreeParagraphContentPlan),
        generateBody,
        analyzeDraft: vi.fn().mockReturnValue({
          issues: [],
          flaggedSentences: [],
        }),
      },
    );

    expect(result).not.toBeNull();
    expect(generateBody).toHaveBeenCalledTimes(2);
  });

  it("reapplies deterministic boundaries after repair", async () => {
    const analyzeDraft = vi
      .fn()
      .mockReturnValueOnce({
        issues: [
          {
            code: "unsupported_operational_history",
            message: "Unsupported bridge.",
          },
        ],
        flaggedSentences: [
          {
            sentenceIndex: 0,
            originalSentence:
              "I led a design system migration used across 4 product squads, and that work kept me close to product-facing web apps and cross-functional collaboration every day.",
            issueCode: "unsupported_operational_history",
            reason: "Replace with a supported past fact.",
            safeRewriteMode: "downgrade_to_past_fact",
          },
        ],
      })
      .mockReturnValueOnce({
        issues: [],
        flaggedSentences: [],
      });
    const repairDraft = vi.fn().mockResolvedValue(
      [
        "My work involved a design system migration across multiple product squads and close cross-functional collaboration on product-facing web apps. which.",
        "",
        "I improved signup conversion by 11 percent through iterative UI experiments and built experimentation dashboards used by product and growth teams.",
        "",
        "I improved signup conversion by 11 percent through iterative UI experiments and built experimentation dashboards used by product and growth teams.",
        "",
        "I would welcome the opportunity to discuss the position further.",
      ].join("\n"),
    );

    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi.fn().mockResolvedValue(validContentPlan),
        generateBody: vi.fn().mockResolvedValue(validStructuredBody),
        analyzeDraft,
        repairDraft,
      },
    );

    expect(result).not.toBeNull();
    expect(result?.generationPath).toBe("structured_repaired_success");
    expect(repairDraft).toHaveBeenCalledTimes(1);
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("Best regards,");
    expect(result?.content).toContain(
      "My work involved a design system migration across multiple product squads and close cross-functional collaboration on product-facing web apps.",
    );
    expect(result?.content).not.toContain("which.");
    expect(result?.content.trim().endsWith("Alex Martin")).toBe(true);
    expect(result?.content).not.toMatch(/Alex Martin\S/);
  });

  it("propagates provider-busy failures during structured repair instead of continuing regeneration", async () => {
    const analyzeDraft = vi.fn().mockReturnValueOnce({
      issues: [
        {
          code: "unsupported_operational_history",
          message: "Unsupported bridge.",
        },
      ],
      flaggedSentences: [
        {
          sentenceIndex: 0,
          originalSentence:
            "I led a design system migration used across 4 product squads, and that work kept me close to product-facing web apps and cross-functional collaboration every day.",
          issueCode: "unsupported_operational_history",
          reason: "Replace with a supported past fact.",
          safeRewriteMode: "downgrade_to_past_fact",
        },
      ],
    });
    const providerBusyError = {
      name: "ProposalProviderBusyError",
      message: "Proposal generation provider busy. provider=mistral stage=repair",
      provider: "mistral",
      stage: "repair",
    };
    const repairDraft = vi.fn().mockRejectedValue(providerBusyError);
    const generateBody = vi.fn().mockResolvedValue(validStructuredBody);

    await expect(
      attemptStructuredCoverLetterGeneration(
        {
          gateEnabled: true,
          mistralKey: "sk-test",
          modelType: "mistral-small-latest",
          plannerResult: basePlannerResult,
          outputFormat: "cover_letter",
          outputLanguage: "English",
          candidateName: "Alex Martin",
          voicePreset: "direct",
          jobTitle: "Senior Frontend Engineer",
          jobDescription: "Lead React and TypeScript development.",
        },
        {
          buildContentPlan: vi.fn().mockResolvedValue(validContentPlan),
          generateBody,
          analyzeDraft,
          repairDraft,
        },
      ),
    ).rejects.toMatchObject({
      name: "ProposalProviderBusyError",
      provider: "mistral",
      stage: "repair",
    });

    expect(repairDraft).toHaveBeenCalledTimes(1);
    expect(generateBody).toHaveBeenCalledTimes(1);
  });

  it("fails closed when repaired body reintroduces invalid structured output", async () => {
    const analyzeDraft = vi
      .fn()
      .mockReturnValueOnce({
        issues: [
          {
            code: "unsupported_operational_history",
            message: "Unsupported bridge.",
          },
        ],
        flaggedSentences: [
          {
            sentenceIndex: 0,
            originalSentence:
              "I led a design system migration used across 4 product squads, and that work kept me close to product-facing web apps and cross-functional collaboration every day.",
            issueCode: "unsupported_operational_history",
            reason: "Replace with a supported past fact.",
            safeRewriteMode: "downgrade_to_past_fact",
          },
        ],
      })
      .mockReturnValueOnce({
        issues: [
          {
            code: "unsupported_operational_history",
            message: "Unsupported bridge remained after repair.",
          },
        ],
        flaggedSentences: [],
      });
    const repairDraft = vi.fn().mockResolvedValue(
      [
        "My work involved a design system migration across multiple product squads and close cross-functional collaboration on product-facing web apps.",
        "",
        [
          "I improved signup conversion by 11 percent through iterative UI experiments.",
          "Best regards,",
          "Alex MartinThe remote engagement model requires clear async collaboration.",
        ].join("\n"),
      ].join("\n\n"),
    );

    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: basePlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Senior Frontend Engineer",
        jobDescription: "Lead React and TypeScript development.",
      },
      {
        buildContentPlan: vi.fn().mockResolvedValue(validContentPlan),
        generateBody: vi.fn().mockResolvedValue(validStructuredBody),
        analyzeDraft,
        repairDraft,
      },
    );

    expect(result).toBeNull();
  });

  it("fails closed when a collapsed no-context repair still cannot satisfy the structured evidence role", async () => {
    const analyzeDraft = vi
      .fn()
      .mockReturnValueOnce({
        issues: [
          {
            code: "no_context_readiness",
            message: "Remove unsupported readiness wording.",
          },
        ],
        flaggedSentences: [
          {
            sentenceIndex: 1,
            originalSentence:
              "The emphasis on reliability, clear communication, and willingness to learn stands out to me because the role depends on steady follow-through in day-to-day work.",
            issueCode: "no_context_readiness",
            reason: "No-context outputs must avoid unsupported readiness wording.",
            safeRewriteMode: "interest_only",
          },
        ],
      })
      .mockReturnValueOnce({
        issues: [],
        flaggedSentences: [],
      });
    const repairDraft = vi.fn().mockResolvedValue(
      [
        "What interests me about this role is the concrete day-to-day work it involves.",
        "I’m interested in learning more about the role.",
      ].join(" "),
    );

    const result = await attemptStructuredCoverLetterGeneration(
      {
        gateEnabled: true,
        mistralKey: "sk-test",
        modelType: "mistral-small-latest",
        plannerResult: noContextPlannerResult,
        outputFormat: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Martin",
        voicePreset: "direct",
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and assist with communication across teams.",
      },
      {
        buildContentPlan: vi.fn().mockResolvedValue(noContextContentPlan),
        generateBody: vi.fn().mockResolvedValue(
          [
            "What interests me about this role is the concrete day-to-day work it involves.",
            validNoContextStructuredBody.split("\n\n")[1] ?? "",
          ].join("\n\n"),
        ),
        analyzeDraft,
        repairDraft,
      },
    );

    expect(result).toBeNull();
  });
});
