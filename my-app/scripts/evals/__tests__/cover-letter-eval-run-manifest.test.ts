import { describe, expect, it } from "vitest";

import {
  buildCoverLetterEvalRunManifestEntry,
  calculateCoverLetterEvalObservedCostUpperBound,
} from "../cover-letter-eval-run-manifest";

describe("cover-letter eval run manifest", () => {
  it("captures requested and returned models, SDK versions, prompt hash, usage, and bounded cost outside artifact-v1", async () => {
    const entry = await buildCoverLetterEvalRunManifestEntry({
      caseId: "blind-en-clean-engaging-direct",
      provider: "openai",
      requestedModel: "gpt-5.6-sol",
      returnedModel: "gpt-5.6-sol-2026-07-09",
      prompt: "deterministic prompt",
      transport: {
        serializedRequest: JSON.stringify({
          model: "gpt-5.6-sol",
          input: "deterministic prompt",
        }),
        systemPrompt: null,
        schemaTarget: { type: "object", additionalProperties: false },
        schemaEnforcementMode: "openai_responses_json_schema_strict",
        promptContract: "provider_native_v1",
      },
      reasoningEffort: "low",
      writerMaxOutputTokens: 2048,
      providerMaxRetries: 0,
      tokenUsage: {
        inputTokens: 3000,
        outputTokens: 1200,
        totalTokens: 4200,
      },
      sdkVersions: {
        openai: "4.104.0",
        mistral: "1.9.18",
        langchainMistral: "0.2.1",
      },
      artifactHash: "a".repeat(64),
      provenanceHash: "b".repeat(64),
    });

    expect(entry).toMatchObject({
      version: "cover_letter_eval_run_manifest_entry_v1",
      provider: "openai",
      requestedModel: "gpt-5.6-sol",
      returnedModel: "gpt-5.6-sol-2026-07-09",
      promptHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      promptHashScope: "effective_user_prompt",
      transport: {
        version: "cover_letter_eval_transport_metadata_v1",
        requestProjectionHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        requestProjectionByteLength: expect.any(Number),
        requestProjectionScope:
          "application_controlled_request_projection_without_credentials_or_signal",
        systemPromptHash: null,
        schemaTargetHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        schemaEnforcementMode: "openai_responses_json_schema_strict",
        promptContract: "provider_native_v1",
      },
      tokenUsage: {
        inputTokens: 3000,
        outputTokens: 1200,
        totalTokens: 4200,
      },
      observedCostUpperBoundUsd: 0.051,
    });
    expect(entry).not.toHaveProperty("prompt");
    expect(entry.transport).not.toHaveProperty("serializedRequest");
  });

  it("fingerprints the Mistral system instruction and records prompt-only schema enforcement", async () => {
    const entry = await buildCoverLetterEvalRunManifestEntry({
      caseId: "blind-en-clean-engaging-direct",
      provider: "mistral",
      requestedModel: "mistral-medium-latest",
      returnedModel: "mistral-medium-latest",
      prompt: "shared effective user prompt",
      transport: {
        serializedRequest: JSON.stringify({
          model: "mistral-medium-latest",
          messages: [
            { role: "system", content: "return only json" },
            { role: "user", content: "shared effective user prompt" },
          ],
        }),
        systemPrompt: "return only json",
        schemaTarget: { type: "object", additionalProperties: false },
        schemaEnforcementMode: "mistral_prompt_contract_with_local_parser",
        promptContract: "quality_eval_2d_shared_v1",
      },
      reasoningEffort: null,
      writerMaxOutputTokens: 2048,
      providerMaxRetries: 0,
      tokenUsage: null,
      sdkVersions: {
        openai: "4.104.0",
        mistral: "1.9.18",
        langchainMistral: "0.2.1",
      },
      artifactHash: "a".repeat(64),
      provenanceHash: "b".repeat(64),
    });

    expect(entry.transport).toMatchObject({
      systemPromptHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      schemaEnforcementMode: "mistral_prompt_contract_with_local_parser",
      promptContract: "quality_eval_2d_shared_v1",
    });
    expect(entry.transport).not.toHaveProperty("systemPrompt");
  });

  it("uses uncached official short-context rates for a conservative observed cost", () => {
    expect(
      calculateCoverLetterEvalObservedCostUpperBound({
        writerModel: "gpt-5.6-terra",
        tokenUsage: {
          inputTokens: 4000,
          outputTokens: 1000,
          totalTokens: 5000,
        },
      }),
    ).toBe(0.025);
    expect(
      calculateCoverLetterEvalObservedCostUpperBound({
        writerModel: "gpt-5.6-luna",
        tokenUsage: {
          inputTokens: 4000,
          outputTokens: 1000,
          totalTokens: 5000,
        },
      }),
    ).toBe(0.01);
    expect(
      calculateCoverLetterEvalObservedCostUpperBound({
        writerModel: "mistral-medium-latest",
        tokenUsage: null,
      }),
    ).toBeNull();
  });
});
