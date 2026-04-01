import { describe, expect, it } from "vitest";

import { formSchema } from "../ProposalInputForm.schemas";

describe("ProposalInputForm schema", () => {
  it("accepts Auto tone without explicit preset, formality, or creativity", () => {
    expect(() =>
      formSchema.parse({
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
        proposalType: "cover_letter",
        toneTuning: null,
        characterLimitMode: "none",
        characterLimitValue: 1500,
        modelType: "chatgpt",
      }),
    ).not.toThrow();
  });

  it("still accepts explicit presets with the matching tone controls", () => {
    expect(() =>
      formSchema.parse({
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
        proposalType: "cover_letter",
        voicePreset: "expert",
        formalityLevel: "formal",
        creativity: "low",
        toneTuning: null,
        characterLimitMode: "custom",
        characterLimitValue: 1200,
        modelType: "chatgpt",
      }),
    ).not.toThrow();
  });
});
