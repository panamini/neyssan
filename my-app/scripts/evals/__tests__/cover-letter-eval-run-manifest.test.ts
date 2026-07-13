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
      tokenUsage: {
        inputTokens: 3000,
        outputTokens: 1200,
        totalTokens: 4200,
      },
      observedCostUpperBoundUsd: 0.051,
    });
    expect(entry).not.toHaveProperty("prompt");
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
        writerModel: "mistral-medium-latest",
        tokenUsage: null,
      }),
    ).toBeNull();
  });
});
