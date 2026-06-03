import { describe, expect, it } from "vitest";

import {
  getMissingCredentialReason,
  parsePremiumRoutingSmokeModels,
  parseRequirePremiumSuccess,
  resolvePremiumRoutingSmokeCredentials,
  runPremiumRoutingSmoke,
  smokeRecordProvesPremiumSuccess,
} from "../smoke-live-premium-routing";

describe("smoke-live-premium-routing", () => {
  it("defaults to all premium route models", () => {
    expect(parsePremiumRoutingSmokeModels([])).toEqual([
      "chatgpt",
      "mistral-medium-latest",
      "mistral-large-latest",
      "qwen3.7-max",
    ]);
  });

  it("parses an explicit model list and rejects unsupported models", () => {
    expect(
      parsePremiumRoutingSmokeModels([
        "--models=mistral-medium-latest,mistral-large-latest",
      ]),
    ).toEqual(["mistral-medium-latest", "mistral-large-latest"]);

    expect(() =>
      parsePremiumRoutingSmokeModels(["--models=mistral-small-latest"]),
    ).toThrow(/Unsupported smoke model/);
  });

  it("parses the premium-success assertion flag", () => {
    expect(parseRequirePremiumSuccess([])).toBe(false);
    expect(parseRequirePremiumSuccess(["--require-premium-success"])).toBe(
      true,
    );
  });

  it("reports credential availability without exposing secret values", () => {
    const credentials = resolvePremiumRoutingSmokeCredentials({
      OPENAI_API_KEY: "sk-openai",
      MISTRAL_API_KEY: "sk-mistral",
      QWEN_API_KEY: "sk-qwen",
      QWEN_BASE_URL: "https://example.invalid/v1",
    });

    expect(credentials).toEqual({
      openai: true,
      mistral: true,
      qwen: true,
      qwenUrl: true,
    });
  });

  it("identifies the missing credential per provider", () => {
    const credentials = resolvePremiumRoutingSmokeCredentials({});

    expect(getMissingCredentialReason("chatgpt", credentials)).toBe(
      "OPENAI_API_KEY unset",
    );
    expect(
      getMissingCredentialReason("mistral-medium-latest", credentials),
    ).toBe("MISTRAL_API_KEY unset");
    expect(getMissingCredentialReason("qwen3.7-max", credentials)).toBe(
      "QWEN_API_KEY unset",
    );
  });

  it("skips without importing the live action unless explicit live opt-in is set", async () => {
    await expect(
      runPremiumRoutingSmoke({
        models: ["mistral-medium-latest"],
        env: {},
      }),
    ).resolves.toEqual([
      {
        status: "skipped",
        model: "mistral-medium-latest",
        reason: "PROPOSAL_PREMIUM_ROUTING_LIVE=1 required",
      },
    ]);
  });

  it("only treats saved premium routing with current premium metadata as proof", () => {
    const premiumRecord = {
      status: "ok",
      model: "mistral-large-latest",
      proposalId: "proposal_1",
      requestedModelType: "mistral-large-latest",
      actualModelType: "mistral-large-latest",
      actualModelName: "mistral-large-latest",
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
      savedMetadata: {
        premium_path_saved: true,
        premium_validation_passed: true,
        premium_quality_shadow_passed: false,
        executed_path: "structured",
        save_outcome: "structured_saved",
        tags: [
          "model:mistral-large-latest",
          "premium_cover_letter_path_v1",
          "generation_path:premium_path_saved",
        ],
      },
      contentPreview: "Dear Hiring Manager",
    } as const;
    const fallbackRecord = {
      ...premiumRecord,
      routing: {
        ...premiumRecord.routing,
        attemptedPath: "premium fail-closed to legacy fallback",
        saveOutcome: "legacy_saved_parsed",
        premiumFailureStage: "validation",
        premiumFailureReason: "repair_failed_validation",
      },
      savedMetadata: {
        premium_path_saved: false,
        premium_validation_passed: false,
        premium_quality_shadow_passed: null,
        executed_path: "legacy",
        save_outcome: "legacy_saved_parsed",
        tags: [
          "model:mistral-large-latest",
          "generation_path:premium_fail_closed_to_legacy_fallback",
        ],
      },
    } as const;
    const controlledGptFallbackRecord = {
      ...premiumRecord,
      actualModelType: "chatgpt",
      actualModelName: "gpt-5.5",
      fallbackTriggerCode: "premium_mistral_validation_failed",
      routing: {
        ...premiumRecord.routing,
        attemptedPath: "premium Mistral failed to GPT fallback",
        fallbackReason: "premium_mistral_validation_failed",
        saveOutcome: "structured_saved",
      },
      savedMetadata: {
        premium_path_saved: false,
        premium_validation_passed: true,
        premium_quality_shadow_passed: true,
        executed_path: "structured",
        save_outcome: "structured_saved",
        tags: [
          "model:chatgpt",
          "premium_cover_letter_path_v1",
          "generation_path:premium_mistral_failed_to_gpt_fallback",
        ],
      },
    } as const;

    expect(smokeRecordProvesPremiumSuccess(premiumRecord)).toBe(true);
    expect(smokeRecordProvesPremiumSuccess(fallbackRecord)).toBe(false);
    expect(smokeRecordProvesPremiumSuccess(controlledGptFallbackRecord)).toBe(
      false,
    );
    expect(
      smokeRecordProvesPremiumSuccess({
        ...premiumRecord,
        savedMetadata: {
          ...premiumRecord.savedMetadata,
          premium_validation_passed: false,
        },
      }),
    ).toBe(false);
    expect(
      smokeRecordProvesPremiumSuccess({
        ...premiumRecord,
        savedMetadata: {
          premium_path_saved: true,
          premium_validation_passed: true,
          tags: premiumRecord.savedMetadata.tags,
        },
      }),
    ).toBe(false);
    expect(
      smokeRecordProvesPremiumSuccess({
        status: "skipped",
        model: "mistral-large-latest",
        reason: "MISTRAL_API_KEY unset",
      }),
    ).toBe(false);
  });
});
