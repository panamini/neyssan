import { describe, expect, it } from "vitest";

import {
  getProposalGenerationFallbackDisclosureMessage,
  getProposalGenerationRoutingDisclosureMessage,
  getProposalGenerationUiErrorMessage,
} from "../proposal-generation-ui";

describe("proposal generation UI error mapping", () => {
  it("maps controlled provider-busy failures to a clean retry message", () => {
    const message = getProposalGenerationUiErrorMessage({
      error: {
        message:
          '{"code":"proposal_generation_provider_busy","message":"Proposal generation is temporarily busy because the model provider is rate limited."}',
        data: {
          code: "proposal_generation_provider_busy",
          message:
            "Proposal generation is temporarily busy because the model provider is rate limited.",
          provider: "mistral",
          stage: "legacy_generation",
        },
      },
      proposalType: "cover_letter",
      hasCandidateContext: true,
    });

    expect(message).toBe(
      "Proposal generation is temporarily busy because the model provider is rate limited. Please wait a moment and try again.",
    );
  });

  it("maps controlled transport failures to a clean retry message", () => {
    const message = getProposalGenerationUiErrorMessage({
      error: {
        message:
          '{"code":"proposal_generation_provider_transport_error","message":"Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again."}',
        data: {
          code: "proposal_generation_provider_transport_error",
          message:
            "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.",
          provider: "mistral",
          stage: "legacy_generation",
          statusCode: 411,
        },
      },
      proposalType: "cover_letter",
      hasCandidateContext: true,
    });

    expect(message).toBe(
      "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.",
    );
  });

  it("maps controlled no-CV cover-letter finalization failures to a clean product message", () => {
    const message = getProposalGenerationUiErrorMessage({
      error: new Error(
        "Proposal generation failed closed during finalization. Attempted path: legacy-only path. Final result: fail-closed final result. Reason: Cleanup removed all substantive body content for cover_letter.",
      ),
      proposalType: "cover_letter",
      hasCandidateContext: false,
    });

    expect(message).toBe(
      "A grounded cover letter could not be generated from the job description alone. Add a CV or more concrete background details and try again.",
    );
    expect(message).not.toContain(
      "Proposal generation failed closed during finalization.",
    );
  });

  it("preserves non-finalization errors verbatim", () => {
    expect(
      getProposalGenerationUiErrorMessage({
        error: new Error("Mistral API key is not configured"),
        proposalType: "cover_letter",
        hasCandidateContext: true,
      }),
    ).toBe("Mistral API key is not configured");
  });

  it("maps provider-busy fallback provenance to a disclosure message", () => {
    expect(
      getProposalGenerationFallbackDisclosureMessage({
        requestedModelType: "mistral-small-latest",
        actualModelType: "chatgpt",
        fallbackTriggerCode: "proposal_generation_provider_busy",
      }),
    ).toBe("Generated with ChatGPT because Mistral was temporarily busy.");
  });

  it("maps transport fallback provenance to a disclosure message", () => {
    expect(
      getProposalGenerationFallbackDisclosureMessage({
        requestedModelType: "mistral-small-latest",
        actualModelType: "chatgpt",
        fallbackTriggerCode: "proposal_generation_provider_transport_error",
      }),
    ).toBe(
      "Generated with ChatGPT because the Mistral request could not be completed.",
    );
  });

  it("formats premium routing provenance for local debugging", () => {
    expect(
      getProposalGenerationRoutingDisclosureMessage({
        requestedModelType: "mistral-large-latest",
        actualModelType: "mistral-large-latest",
        actualModelName: "mistral-large-latest",
        fallbackTriggerCode: null,
        routing: {
          attemptedPath: "premium success",
          plannedPath: "structured",
          executedPath: "structured",
          fallbackReason: "not_applicable",
          validatorOutcome: "structured_success",
          saveOutcome: "structured_saved",
          premiumFailureStage: null,
          premiumFailureReason: null,
          premiumFailureContextClass: null,
        },
      }),
    ).toBe(
      "Generation routing: route premium success; planned structured; executed structured; validator structured_success; save structured_saved.",
    );
  });
});
