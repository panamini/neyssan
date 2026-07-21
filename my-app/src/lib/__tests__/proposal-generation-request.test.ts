import { describe, expect, it } from "vitest";
import type { FormValues } from "../../components/ProposalInputForm.schemas";
import { buildProposalGenerationRequest } from "../proposal-generation-request";

const baseValues: FormValues = {
  jobTitle: "Operations Manager",
  jobDescription:
    "We are looking for an operations manager with strong team skills.",
  proposalType: "cover_letter",
  modelType: "chatgpt",
  characterLimitMode: "none",
  characterLimitValue: 1500,
};

describe("proposal generation request", () => {
  it("threads document language metadata separately from UI language", () => {
    const payload = buildProposalGenerationRequest(
      baseValues,
      {},
      undefined,
      "job-123",
      {
        requestedLanguage: "fr",
        resolvedLanguage: "fr",
        languageSource: "document-preference",
        jobDetectedLanguage: "en",
      },
      "Acme Corp.",
    );

    expect(payload).toMatchObject({
      jobId: "job-123",
      requestedLanguage: "fr",
      resolvedLanguage: "fr",
      languageSource: "document-preference",
      jobDetectedLanguage: "en",
      targetEmployerName: "Acme Corp.",
    });
  });
});
