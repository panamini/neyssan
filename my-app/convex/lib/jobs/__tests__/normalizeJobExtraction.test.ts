import { describe, expect, it } from "vitest";

import {
  GENERIC_REQUIREMENTS,
  normalizeJobExtraction,
  normalizeRawJobTextForHash,
} from "../normalizeJobExtraction";
import type { NormalizedJobExtraction } from "../jobExtractionSchema";

const extraction: NormalizedJobExtraction = {
  summary_short: " Customer-facing retail security role. ",
  role_title_normalized: " security guard ",
  requirements: [
    { value: " Guard Card. ", type: "certification", required: true },
    { value: "guard card", type: "certification", required: true },
    { value: "communication", type: "skill", required: true },
    { value: "Fast-paced environment", type: "constraint", required: false },
    { value: " loss prevention experience ", type: "experience", required: true },
  ],
  keywords_canonical: [" Security ", "security", "Loss Prevention"],
  licenses_or_certifications: [" Guard Card ", "guard card"],
  schedule_constraints: [" Weekend availability ", "weekend availability"],
  environment: {
    customer_facing: true,
    retail: true,
    physical_standing: null,
    onsite: true,
  },
  confidence: "high",
};

describe("normalizeJobExtraction", () => {
  it("deduplicates, normalizes casing, and removes generic requirements", () => {
    const result = normalizeJobExtraction(extraction);

    expect(GENERIC_REQUIREMENTS).toEqual(
      expect.arrayContaining(["detail oriented", "fast paced", "self starter", "multitasking"]),
    );
    expect(result.requirements).toEqual([
      { value: "Guard card", type: "certification", required: true },
      { value: "Loss prevention experience", type: "experience", required: true },
    ]);
    expect(result.keywords_canonical).toEqual(["security", "loss prevention"]);
    expect(result.licenses_or_certifications).toEqual(["Guard card"]);
    expect(result.schedule_constraints).toEqual(["Weekend availability"]);
  });

  it("normalizes raw job text before hashing", () => {
    expect(normalizeRawJobTextForHash("  Required:   Guard card\n\nRetail  experience ")).toBe(
      "Required: Guard card Retail experience",
    );
  });
});
