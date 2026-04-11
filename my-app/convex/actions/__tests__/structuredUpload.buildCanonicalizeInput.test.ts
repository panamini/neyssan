import { describe, expect, it } from "vitest";

import { buildCanonicalizeInput } from "../structuredUpload";
import { canonicalizeParserResult } from "../../lib/parsing/canonicalize";

describe("buildCanonicalizeInput", () => {
  it("preserves top-level sections for Farman app-side fallback recovery", () => {
    const payload = {
      sections: [
        {
          label: "BODY",
          content:
            "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
        },
      ],
      rawSections: [
        {
          label: "EXPERIENCE",
          content:
            "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator\n" +
            "Jan 1, 2016",
        },
      ],
      result: {
        normalized: {
          experience: [],
        },
      },
    } as any;

    const canonicalizeInput = buildCanonicalizeInput(payload);
    expect(canonicalizeInput.sections).toEqual(payload.sections);
    expect(canonicalizeInput.normalized?.sections).toEqual(payload.sections);

    const normalizedResult = canonicalizeParserResult(canonicalizeInput, {
      rawText: "",
      mode: "auto",
      parserUrl: "test://parser",
    });

    const experience = (normalizedResult.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        company: "CBRE through Strabag",
        position: "BMS Operator",
        startDate: "2016-01-01",
        isCurrent: true,
      }),
    );
  });
});
