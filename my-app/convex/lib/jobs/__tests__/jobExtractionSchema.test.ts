import { describe, expect, it } from "vitest";

import {
  classifyJobExtractionPayload,
  extractJsonObjectStrict,
  isUiSafeExtraction,
  type NormalizedJobExtraction,
} from "../jobExtractionSchema";

const baseExtraction: NormalizedJobExtraction = {
  summary_short: "Retail security role",
  role_title_normalized: "Security Guard",
  requirements: [
    { value: "Guard card", type: "certification", required: true },
    { value: "Retail loss prevention", type: "experience", required: true },
    { value: "Surveillance cameras", type: "tool", required: false },
  ],
  keywords_canonical: ["security", "loss prevention"],
  licenses_or_certifications: ["Guard card"],
  schedule_constraints: ["Weekend availability"],
  environment: {
    customer_facing: true,
    retail: true,
    physical_standing: true,
    onsite: true,
  },
  confidence: "high",
};

describe("jobExtractionSchema", () => {
  it("classifies a valid structured extraction after normalization", () => {
    const result = classifyJobExtractionPayload(baseExtraction);

    expect(result.validationStatus).toBe("valid");
    expect(result.normalizedOutput?.role_title_normalized).toBe("Security Guard");
    expect(result.modelConfidence).toBe("high");
    expect(result.finalConfidence).toBe("high");
    expect(isUiSafeExtraction(result)).toBe(true);
  });

  it("classifies invalid JSON and partial JSON as invalid_json", () => {
    expect(classifyJobExtractionPayload("{ nope").validationStatus).toBe("invalid_json");
    expect(extractJsonObjectStrict('{"summary_short":"x"').ok).toBe(false);
    expect(
      classifyJobExtractionPayload('{"summary_short":"valid prefix","requirements":[')
        .validationStatus,
    ).toBe("invalid_json");
    expect(
      classifyJobExtractionPayload(`${JSON.stringify(baseExtraction)} trailing text`)
        .validationStatus,
    ).toBe("invalid_json");
  });

  it("classifies schema violations separately from parse failures", () => {
    const result = classifyJobExtractionPayload({
      ...baseExtraction,
      requirements: [{ value: "Guard card", type: "unknown", required: true }],
    });

    expect(result.validationStatus).toBe("schema_invalid");
  });

  it("classifies empty signal when normalized requirements are absent", () => {
    const result = classifyJobExtractionPayload({
      ...baseExtraction,
      requirements: [{ value: "communication", type: "skill", required: true }],
      keywords_canonical: [],
      licenses_or_certifications: [],
      schedule_constraints: [],
      environment: {
        customer_facing: null,
        retail: null,
        physical_standing: null,
        onsite: null,
      },
    });

    expect(result.validationStatus).toBe("empty_signal");
  });

  it("classifies one meaningful requirement with no other signal as empty_signal", () => {
    const result = classifyJobExtractionPayload({
      ...baseExtraction,
      requirements: [{ value: "cash handling", type: "experience", required: true }],
      keywords_canonical: [],
      licenses_or_certifications: [],
      schedule_constraints: [],
      environment: {
        customer_facing: null,
        retail: null,
        physical_standing: null,
        onsite: null,
      },
    });

    expect(result.validationStatus).toBe("empty_signal");
  });

  it("keeps one meaningful requirement with a certification out of empty_signal", () => {
    const result = classifyJobExtractionPayload({
      ...baseExtraction,
      requirements: [{ value: "cash handling", type: "experience", required: true }],
      keywords_canonical: [],
      licenses_or_certifications: ["CQP APS"],
      schedule_constraints: [],
      environment: {
        customer_facing: null,
        retail: null,
        physical_standing: null,
        onsite: null,
      },
    });

    expect(result.validationStatus).not.toBe("empty_signal");
  });

  it("keeps one meaningful requirement with a schedule constraint out of empty_signal", () => {
    const result = classifyJobExtractionPayload({
      ...baseExtraction,
      requirements: [{ value: "cash handling", type: "experience", required: true }],
      keywords_canonical: [],
      licenses_or_certifications: [],
      schedule_constraints: ["Disponibilité le week-end"],
      environment: {
        customer_facing: null,
        retail: null,
        physical_standing: null,
        onsite: null,
      },
    });

    expect(result.validationStatus).not.toBe("empty_signal");
  });

  it("downgrades overconfident weak outputs and classifies low confidence", () => {
    const result = classifyJobExtractionPayload({
      ...baseExtraction,
      requirements: [
        { value: "administrative support", type: "experience", required: false },
        { value: "customer support", type: "experience", required: false },
        { value: "operations support", type: "experience", required: false },
      ],
      keywords_canonical: [],
      licenses_or_certifications: [],
      schedule_constraints: [],
      environment: {
        customer_facing: null,
        retail: null,
        physical_standing: null,
        onsite: null,
      },
      confidence: "high",
    });

    expect(result.validationStatus).toBe("low_confidence");
    expect(result.normalizedOutput?.confidence).toBe("low");
    expect(result.modelConfidence).toBe("high");
    expect(result.finalConfidence).toBe("low");
    expect(isUiSafeExtraction(result)).toBe(false);
  });
});
